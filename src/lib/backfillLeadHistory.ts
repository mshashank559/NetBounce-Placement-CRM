import { supabase } from '@/integrations/supabase/client';

export interface BackfillResult {
  totalLeadsScanned: number;
  leadsNeedingBackfill: number;
  logsCreated: number;
  success: boolean;
  error?: string;
}

/**
 * Safely backfills missing baseline history records (creation & assignment)
 * for all historical leads that currently have 0 entries in lead_history_logs.
 */
export async function backfillMissingLeadHistory(): Promise<BackfillResult> {
  try {
    // 1. Fetch all leads
    let allLeads: any[] = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('leads')
        .select('unique_id, name, created_at, updated_at, assigned_at, assigned_to, lead_generated_by, lead_status, team_lead_id')
        .order('created_at', { ascending: false })
        .range(from, from + step - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        allLeads = [...allLeads, ...data];
        if (data.length < step) {
          hasMore = false;
        } else {
          from += step;
        }
      } else {
        hasMore = false;
      }
    }

    if (allLeads.length === 0) {
      return { totalLeadsScanned: 0, leadsNeedingBackfill: 0, logsCreated: 0, success: true };
    }

    // 2. Fetch profiles map for user names
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name');
    const profileMap = new Map<string, string>();
    profiles?.forEach(p => {
      if (p.user_id && p.full_name) {
        profileMap.set(p.user_id, p.full_name);
      }
    });

    // 3. Fetch all lead_ids currently in lead_history_logs
    const { data: existingLogs } = await supabase
      .from('lead_history_logs')
      .select('lead_id');

    const leadsWithHistory = new Set(existingLogs?.map(l => l.lead_id) || []);

    // 4. Identify leads needing baseline backfill
    const leadsToBackfill = allLeads.filter(l => !leadsWithHistory.has(l.unique_id));

    if (leadsToBackfill.length === 0) {
      return {
        totalLeadsScanned: allLeads.length,
        leadsNeedingBackfill: 0,
        logsCreated: 0,
        success: true
      };
    }

    // 5. Construct baseline history rows
    const rowsToInsert: any[] = [];

    for (const lead of leadsToBackfill) {
      const creatorName = lead.lead_generated_by
        ? profileMap.get(lead.lead_generated_by) || 'System'
        : 'System';

      // Creation Log
      rowsToInsert.push({
        lead_id: lead.unique_id,
        changed_by: lead.lead_generated_by || lead.assigned_to || '00000000-0000-0000-0000-000000000000',
        action_type: 'LEAD_CREATION',
        old_value: 'None',
        new_value: lead.lead_status || 'New',
        comments: `Created by ${creatorName}`,
        created_at: lead.created_at
      });

      // Assignment Log (if assigned)
      if (lead.assigned_to && lead.assigned_to !== 'Unassigned') {
        const assigneeName = profileMap.get(lead.assigned_to) || 'salesperson';
        const isTL = lead.team_lead_id === lead.assigned_to;
        const assignerId = lead.team_lead_id || lead.lead_generated_by || 'system';
        const assignerName = profileMap.get(assignerId) || 'System';

        const assignComment = isTL
          ? `Assigned to TL ${assigneeName} by ${assignerName}`
          : `Assigned to ${assigneeName} by ${assignerName}`;

        const assignmentTimestamp = lead.assigned_at || lead.updated_at || lead.created_at;

        rowsToInsert.push({
          lead_id: lead.unique_id,
          changed_by: assignerId === 'system' ? (lead.assigned_to || lead.lead_generated_by) : assignerId,
          action_type: isTL ? 'TL_ASSIGN' : 'TM_ASSIGN',
          old_value: 'Unassigned Pool',
          new_value: lead.assigned_to,
          comments: assignComment,
          created_at: assignmentTimestamp
        });
      }
    }

    // 6. Batch insert rows (500 at a time)
    const BATCH_SIZE = 500;
    for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
      const chunk = rowsToInsert.slice(i, i + BATCH_SIZE);
      const { error: insertErr } = await supabase
        .from('lead_history_logs')
        .insert(chunk);

      if (insertErr) {
        console.error('Backfill batch insert error:', insertErr);
        throw insertErr;
      }
    }

    return {
      totalLeadsScanned: allLeads.length,
      leadsNeedingBackfill: leadsToBackfill.length,
      logsCreated: rowsToInsert.length,
      success: true
    };
  } catch (err: any) {
    console.error('Backfill missing lead history failed:', err);
    return {
      totalLeadsScanned: 0,
      leadsNeedingBackfill: 0,
      logsCreated: 0,
      success: false,
      error: err.message || 'Backfill failed'
    };
  }
}

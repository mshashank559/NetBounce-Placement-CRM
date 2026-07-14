import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getWorkingDaysDifference, getWorkingDaysAgo } from '@/lib/dateUtils';

/**
 * SLA Hook — runs on every session load.
 * Rule 1: Same-Day Sales Update Rule (no update today for active/assigned) -> notify TL + Admin
 * Rule 2: Document Dispatch SLA (no review doc sent within 24h of closure) -> notify Accountant + PA + Admin
 * Rule 3: Payment due today -> notify Accountant + Admin
 * Rule 4: Payment Pending SLA -> escalate to Admin if overdue 3+ days
 */
export const useSLA = () => {
  const { user, role } = useAuth();

  useEffect(() => {
    if (!user) return;
    // SLA checks are run by TLs, Admins, Accountants, and Process Analysts
    if (role !== 'ADMIN' && role !== 'SALES_TL' && role !== 'LEAD_TL' && role !== 'ACCOUNTANT' && role !== 'PROCESS_ANALYST') return;

    const runSLAChecks = async () => {
      const today = new Date().toISOString().split('T')[0];
      const todayStart = `${today}T00:00:00`;
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Helper to fetch user IDs by role
      const getRoleUserIds = async (roles: ("ADMIN" | "PROCESS_ANALYST" | "LEAD_TL" | "LEAD_GEN" | "SALES_TL" | "SALES_TM" | "ACCOUNTANT")[]): Promise<string[]> => {
        const { data } = await supabase
          .from('user_roles')
          .select('user_id')
          .in('role', roles);
        return data?.map(r => r.user_id) || [];
      };

      // ── Batch Query: Fetch all notifications created today ──
      // This allows us to perform O(1) in-memory de-duplication instead of running individual select queries inside loops.
      const { data: todayNotifications } = await supabase
        .from('notifications')
        .select('lead_id, type')
        .gte('created_at', todayStart);

      const existingNotifsSet = new Set<string>();
      todayNotifications?.forEach(n => {
        if (n.lead_id && n.type) {
          existingNotifsSet.add(`${n.lead_id}_${n.type}`);
        }
      });

      // ── Rule 1: Unassigned Lead (5 Working Days) Rule ──
      const fiveDaysAgo = getWorkingDaysAgo(5);
      const { data: unassignedLeads } = (await supabase
        .from('leads')
        .select('unique_id, name, assigned_to, team_lead_id' as any)
        .is('assigned_to', null)
        .not('lead_status', 'in', '("Closed","Non Interested")')
        .lte('created_at', fiveDaysAgo.toISOString())) as { data: any[] | null };

      if (unassignedLeads && unassignedLeads.length > 0) {
        const admins = await getRoleUserIds(['ADMIN']);
        const salesTLs = await getRoleUserIds(['SALES_TL']);

        for (const lead of unassignedLeads) {
          const key = `${lead.unique_id}_sla_sales_update_missed`;
          if (!existingNotifsSet.has(key)) {
            const targets = new Set<string>([...admins]);
            if (lead.team_lead_id) {
              targets.add(lead.team_lead_id);
            } else {
              salesTLs.forEach(id => targets.add(id));
            }

            if (targets.size > 0) {
              const notifs = Array.from(targets).map(userId => ({
                user_id: userId,
                title: '🔴 SLA Alert: Unassigned Lead (5 Days)',
                message: `Lead "${lead.name}" has been in the system for 5 days and has not yet been assigned to a salesperson.`,
                type: 'sla_sales_update_missed',
                lead_id: lead.unique_id,
              }));
              await supabase.from('notifications').insert(notifs);
              targets.forEach(() => existingNotifsSet.add(key));
            }
          }
        }
      }

      // ── Rule 2: Document Dispatch SLA ──
      const { data: closures } = await supabase
        .from('leads')
        .select('unique_id, name, agreement_status, agreement_sent_at')
        .eq('lead_status', 'Closed');

      if (closures && closures.length > 0) {
        const admins = await getRoleUserIds(['ADMIN']);
        const accountants = await getRoleUserIds(['ACCOUNTANT']);
        const analysts = await getRoleUserIds(['PROCESS_ANALYST']);
        const dispatchTargets = Array.from(new Set([...admins, ...accountants, ...analysts]));

        const closedLeadIds = closures.map(l => l.unique_id);

        // Batch fetch all lead closures for these closed leads
        const { data: allLeadClosures } = await supabase
          .from('lead_closures')
          .select('lead_id, created_at')
          .in('lead_id', closedLeadIds)
          .lt('created_at', twentyFourHoursAgo);

        const closureCreatedMap = new Map<string, string>();
        allLeadClosures?.forEach(c => {
          closureCreatedMap.set(c.lead_id, c.created_at);
        });

        // Batch fetch all performas for these closed leads
        const { data: allPerformas } = await supabase
          .from('performas')
          .select('lead_id')
          .in('lead_id', closedLeadIds);
        
        const performasLeadIdSet = new Set(allPerformas?.map(p => p.lead_id) || []);

        for (const lead of closures) {
          const closureCreatedAt = closureCreatedMap.get(lead.unique_id);

          if (closureCreatedAt) {
            // Check if review document has NOT been sent
            const isDocSentInLeads = lead.agreement_status === 'Review Doc Sent' || lead.agreement_status === 'Final Agreement Sent' || lead.agreement_sent_at !== null;
            
            const isDocSentInPerformas = performasLeadIdSet.has(lead.unique_id);

            if (!isDocSentInLeads && !isDocSentInPerformas) {
              const key = `${lead.unique_id}_sla_document_pending`;
              if (!existingNotifsSet.has(key) && dispatchTargets.length > 0) {
                const notifs = dispatchTargets.map(userId => ({
                  user_id: userId,
                  title: '🚨 SLA Alert: Review Document Pending',
                  message: `Review document is pending for candidate "${lead.name}" for over 24 hours since conversion.`,
                  type: 'sla_document_pending',
                  lead_id: lead.unique_id,
                }));
                await supabase.from('notifications').insert(notifs);
                existingNotifsSet.add(key);
              }
            }
          }
        }
      }

      // ── Rule 3: Payment due today (Notify Account Person) ──
      const { data: dueToday } = await supabase
        .from('payment_ledgers')
        .select('*, leads(name)')
        .eq('next_payment_date', today);

      if (dueToday && dueToday.length > 0) {
        const admins = await getRoleUserIds(['ADMIN']);
        const accountants = await getRoleUserIds(['ACCOUNTANT']);
        const paymentTargets = Array.from(new Set([...admins, ...accountants]));

        for (const ledger of dueToday) {
          const key = `${ledger.lead_id}_payment_due`;
          if (!existingNotifsSet.has(key) && paymentTargets.length > 0) {
            await supabase.from('notifications').insert(
              paymentTargets.map(userId => ({
                user_id: userId,
                title: '💰 Payment Due Today',
                message: `Candidate "${(ledger.leads as any)?.name}" has a payment of $${ledger.next_payment_amount} due today.`,
                type: 'payment_due',
                lead_id: ledger.lead_id,
              }))
            );
            existingNotifsSet.add(key);
          }
        }
      }

      // ── Rule 4: Payment Pending SLA (Escalate to Admin if overdue 3+ days) ──
      const { data: overdueLeads } = await supabase
        .from('payment_ledgers')
        .select('*, leads(name)')
        .eq('payment_status', 'Pending')
        .lt('next_payment_date', threeDaysAgo);

      if (overdueLeads && overdueLeads.length > 0) {
        const admins = await getRoleUserIds(['ADMIN']);

        for (const ledger of overdueLeads) {
          const key = `${ledger.lead_id}_payment_overdue_escalation`;
          if (!existingNotifsSet.has(key) && admins.length > 0) {
            await supabase.from('notifications').insert(
              admins.map(userId => ({
                user_id: userId,
                title: '🚨 Payment Overdue Escalation',
                message: `Candidate "${(ledger.leads as any)?.name}" payment has been PENDING for 3+ days past due date (${ledger.next_payment_date}).`,
                type: 'payment_overdue_escalation',
                lead_id: ledger.lead_id,
              }))
            );
            existingNotifsSet.add(key);
          }
        }
      }

      // ── Rule 5: Follow-up SLA Notification Logic ──
      const { data: activeFollowupLeads } = await supabase
        .from('leads')
        .select('unique_id, display_id, name, assigned_to, team_lead_id, lead_status, updated_at, dnr_followup_done, assigned_at');

      if (activeFollowupLeads && activeFollowupLeads.length > 0) {
        const pendingLeads = activeFollowupLeads.filter(
          l => !l.dnr_followup_done && ['New', 'DNR1', 'DNR2', 'DNR3', 'Connected', 'Qualified', 'Hot Prospect', 'Non Interested'].includes(l.lead_status || '')
        );

        if (pendingLeads.length > 0) {
          const { data: allProfiles } = await supabase
            .from('profiles')
            .select('user_id, reports_to');
          const profileMap = new Map<string, string | null>();
          allProfiles?.forEach(p => {
            profileMap.set(p.user_id, p.reports_to);
          });

          const admins = await getRoleUserIds(['ADMIN']);
          const analysts = await getRoleUserIds(['PROCESS_ANALYST']);
          const bdTLs = await getRoleUserIds(['LEAD_TL']);
          const salesTLs = await getRoleUserIds(['SALES_TL']);

          for (const lead of pendingLeads) {
            let delayDays = 1;
            const status = lead.lead_status;
            if (status === 'Hot Prospect') delayDays = 90;
            else if (status === 'Qualified') delayDays = 60;
            else if (status === 'Connected') delayDays = 30;
            else if (status === 'DNR1') delayDays = 20;
            else if (status === 'DNR2') delayDays = 15;
            else if (status === 'DNR3') delayDays = 10;
            else if (status === 'New') {
              if (!lead.assigned_to) continue; // Unassigned "New" leads are handled by Rule 1
              delayDays = 5;
            }
            else if (status === 'Non Interested') delayDays = 2;
            else continue;

            const baseDateStr = status === 'New' ? (lead.assigned_at || lead.updated_at) : lead.updated_at;
            const baseDateObj = new Date(baseDateStr);
            const workingDaysElapsed = getWorkingDaysDifference(baseDateObj, new Date());

            if (workingDaysElapsed === delayDays) {
              const key = `${lead.unique_id}_sla_followup_reminder`;
              if (!existingNotifsSet.has(key)) {
                const recipients = new Set<string>();

                // 1. Assigned Salesperson
                if (lead.assigned_to) {
                  recipients.add(lead.assigned_to);

                  // 2. Reporting Sales TL of that Salesperson
                  const tlId = profileMap.get(lead.assigned_to);
                  if (tlId) {
                    recipients.add(tlId);
                  }
                }

                // 3. BD TL (assigned team_lead_id or all BD TLs)
                if (lead.team_lead_id) {
                  recipients.add(lead.team_lead_id);
                } else {
                  bdTLs.forEach(id => recipients.add(id));
                }

                // 4. Sales TLs
                salesTLs.forEach(id => recipients.add(id));

                // 5. Admin (for monitoring purposes)
                admins.forEach(id => recipients.add(id));

                // 6. Process Analyst
                analysts.forEach(id => recipients.add(id));

                if (recipients.size > 0) {
                  const leadId = (lead as any).display_id || lead.name;
                  const notificationsToInsert = Array.from(recipients).map(userId => ({
                    user_id: userId,
                    title: '⏰ Action Required: Final Follow-up Day',
                    message: `Action Required: Lead ${leadId} has reached its final follow-up day for ${status}. Please review immediately.`,
                    type: 'sla_followup_reminder',
                    lead_id: lead.unique_id,
                  }));
                  await supabase.from('notifications').insert(notificationsToInsert);
                  existingNotifsSet.add(key);
                }
              }
            }
          }
        }
      }
    };

    // Run once on mount with a small delay to not block render
    const timer = setTimeout(runSLAChecks, 3000);
    return () => clearTimeout(timer);
  }, [user, role]);
};

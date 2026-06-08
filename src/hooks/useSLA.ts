import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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

      // ── Rule 1: Unassigned Lead (5 Days) Rule ──
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const { data: unassignedLeads } = (await supabase
        .from('leads')
        .select('unique_id, name, assigned_to, team_lead_id' as any)
        .is('assigned_to', null)
        .not('lead_status', 'in', '("Closed","Non Interested")')
        .lte('created_at', fiveDaysAgo)) as { data: any[] | null };

      if (unassignedLeads && unassignedLeads.length > 0) {
        const admins = await getRoleUserIds(['ADMIN']);
        const salesTLs = await getRoleUserIds(['SALES_TL']);

        for (const lead of unassignedLeads) {
          // De-dup: check if SLA same-day notification already sent today
          const { data: existing } = await supabase
            .from('notifications')
            .select('id')
            .eq('lead_id', lead.unique_id)
            .eq('type', 'sla_sales_update_missed')
            .gte('created_at', todayStart)
            .limit(1);

          if (!existing || existing.length === 0) {
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

        for (const lead of closures) {
          // Find closures submitted more than 24 hours ago
          const { data: closureDetail } = await supabase
            .from('lead_closures')
            .select('created_at')
            .eq('lead_id', lead.unique_id)
            .lt('created_at', twentyFourHoursAgo)
            .maybeSingle();

          if (closureDetail) {
            // Check if review document has NOT been sent
            const isDocSentInLeads = lead.agreement_status === 'Review Doc Sent' || lead.agreement_status === 'Final Agreement Sent' || lead.agreement_sent_at !== null;
            
            const { data: performas } = await supabase
              .from('performas')
              .select('id')
              .eq('lead_id', lead.unique_id)
              .limit(1);

            const isDocSentInPerformas = performas && performas.length > 0;

            if (!isDocSentInLeads && !isDocSentInPerformas) {
              // De-dup: check if dispatch notification already sent today
              const { data: existing } = await supabase
                .from('notifications')
                .select('id')
                .eq('lead_id', lead.unique_id)
                .eq('type', 'sla_document_pending')
                .gte('created_at', todayStart)
                .limit(1);

              if ((!existing || existing.length === 0) && dispatchTargets.length > 0) {
                const notifs = dispatchTargets.map(userId => ({
                  user_id: userId,
                  title: '🚨 SLA Alert: Review Document Pending',
                  message: `Review document is pending for candidate "${lead.name}" for over 24 hours since conversion.`,
                  type: 'sla_document_pending',
                  lead_id: lead.unique_id,
                }));
                await supabase.from('notifications').insert(notifs);
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
          const { data: existingDue } = await supabase
            .from('notifications')
            .select('id')
            .eq('lead_id', ledger.lead_id)
            .eq('type', 'payment_due')
            .gte('created_at', todayStart)
            .limit(1);

          if ((!existingDue || existingDue.length === 0) && paymentTargets.length > 0) {
            await supabase.from('notifications').insert(
              paymentTargets.map(userId => ({
                user_id: userId,
                title: '💰 Payment Due Today',
                message: `Candidate "${(ledger.leads as any)?.name}" has a payment of $${ledger.next_payment_amount} due today.`,
                type: 'payment_due',
                lead_id: ledger.lead_id,
              }))
            );
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
          const { data: existingEsc } = await supabase
            .from('notifications')
            .select('id')
            .eq('lead_id', ledger.lead_id)
            .eq('type', 'payment_overdue_escalation')
            .gte('created_at', todayStart)
            .limit(1);

          if ((!existingEsc || existingEsc.length === 0) && admins.length > 0) {
            await supabase.from('notifications').insert(
              admins.map(userId => ({
                user_id: userId,
                title: '🚨 Payment Overdue Escalation',
                message: `Candidate "${(ledger.leads as any)?.name}" payment has been PENDING for 3+ days past due date (${ledger.next_payment_date}).`,
                type: 'payment_overdue_escalation',
                lead_id: ledger.lead_id,
              }))
            );
          }
        }
      }
    };

    // Run once on mount with a small delay to not block render
    const timer = setTimeout(runSLAChecks, 3000);
    return () => clearTimeout(timer);
  }, [user, role]);
};

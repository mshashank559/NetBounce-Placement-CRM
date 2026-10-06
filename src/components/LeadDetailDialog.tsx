import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { History, CalendarDays, FileText, Info, MessageSquare, CheckCircle2, Phone, AlertCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getWorkingDaysDifference } from '@/lib/dateUtils';

const formatToIST = (dateInput: string | Date | null | undefined): string => {
  if (!dateInput) return '';
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [year, month, day] = dateInput.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
  }
  const dateObj = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(dateObj.getTime())) return '';
  return dateObj.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
};

const formatDateTimeToIST = (dateInput: string | Date | null | undefined): string => {
  if (!dateInput) return '';
  const dateObj = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(dateObj.getTime())) return '';
  return dateObj.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
};

interface LeadDetailDialogProps {
  lead: any;
  open: boolean;
  onClose: () => void;
  onOpenClosure?: (lead: any) => void;
}

const LeadDetailDialog: React.FC<LeadDetailDialogProps> = ({ lead, open, onClose, onOpenClosure }) => {
  const { user, role } = useAuth();

  const { data: followups } = useQuery({
    queryKey: ['followups', lead.unique_id],
    queryFn: async () => {
      const { data } = await supabase.from('followups').select('*').eq('lead_id', lead.unique_id).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: open,
  });

  const isUUID = (val: any): boolean =>
    typeof val === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val);

  const { data: closure } = useQuery({
    queryKey: ['closure', lead?.unique_id, lead?.display_id, lead?.id],
    queryFn: async () => {
      if (!lead) return null;
      let targetUuid = isUUID(lead.unique_id) ? lead.unique_id : null;
      if (!targetUuid) {
        if (lead.display_id) {
          const { data } = await supabase.from('leads').select('unique_id').eq('display_id', lead.display_id).maybeSingle();
          if (data?.unique_id) targetUuid = data.unique_id;
        } else if (lead.id) {
          const { data } = await supabase.from('leads').select('unique_id').eq('id', lead.id).maybeSingle();
          if (data?.unique_id) targetUuid = data.unique_id;
        }
      }
      if (!targetUuid || !isUUID(targetUuid)) return null;
      const { data } = await supabase.from('lead_closures').select('*').eq('lead_id', targetUuid).maybeSingle();
      return data;
    },
    enabled: open && !!lead,
  });

  const { data: generatedByProfile } = useQuery({
    queryKey: ['generated-by', lead.lead_generated_by],
    queryFn: async () => {
      if (!lead.lead_generated_by) return null;
      const { data } = await supabase.from('profiles').select('full_name, email').eq('user_id', lead.lead_generated_by).maybeSingle();
      return data;
    },
    enabled: open && !!lead.lead_generated_by,
  });

  // Fetch profiles to map user_id -> full_name for status history
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-map-detail'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name, reports_to');
      return data || [];
    },
    enabled: open,
  });

  const isSameTeam = React.useMemo(() => {
    if (!user) return false;
    if (role === 'ADMIN' || role === 'PROCESS_ANALYST' || role === 'ACCOUNTANT') return true;
    
    // For SALES_TL: they can see if it's their own lead, or if the lead's assignee reports to them, or if the lead's team_lead_id matches their user_id
    if (role === 'SALES_TL') {
      if (lead.assigned_to === user.id || lead.team_lead_id === user.id) return true;
      const assigneeProfile = profiles.find(p => p.user_id === lead.assigned_to);
      if (assigneeProfile?.reports_to === user.id) return true;
      return false;
    }

    // For SALES_TM: same team member can view revenue. So they can see if it's their own lead, or if they report to the same TL as the lead's assignee.
    if (role === 'SALES_TM') {
      if (lead.assigned_to === user.id) return true;
      
      // Find my profile's reports_to (my Sales TL)
      const myProfile = profiles.find(p => p.user_id === user.id);
      const myTL = myProfile?.reports_to;
      if (!myTL) return false;
      
      // Check if the lead's assignee reports to the same TL
      const assigneeProfile = profiles.find(p => p.user_id === lead.assigned_to);
      if (assigneeProfile?.reports_to === myTL) return true;
      return false;
    }

    return false;
  }, [user, role, lead.assigned_to, lead.team_lead_id, profiles]);

  // Status history from logs table with fallback baseline for older leads
  const { data: statusHistory } = useQuery({
    queryKey: ['lead-status-history', lead.unique_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_history_logs')
        .select('*')
        .eq('lead_id', lead.unique_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const effectiveHistory = React.useMemo(() => {
    const logs = statusHistory ? [...statusHistory] : [];
    if (!lead) return logs;

    const hasAssignment = logs.some(l => 
      ['ASSIGNMENT', 'OWNER_CHANGE', 'TL_ASSIGN', 'TM_ASSIGN', 'RE_ASSIGN'].includes(l.action_type) ||
      l.comments?.toLowerCase().includes('assigned') ||
      l.comments?.toLowerCase().includes('re-assigned')
    );

    const assigneeName = lead.assigned_to && lead.assigned_to !== 'Unassigned'
      ? (profiles.find(p => p.user_id === lead.assigned_to)?.full_name)
      : null;

    if (!hasAssignment && assigneeName) {
      const isTL = lead.team_lead_id === lead.assigned_to;
      const assignerId = lead.team_lead_id || lead.lead_generated_by || user?.id || 'system';
      const assignerName = profiles.find(p => p.user_id === assignerId)?.full_name || 'System';

      const comment = isTL
        ? `Assigned to TL ${assigneeName} by ${assignerName}`
        : `Assigned to ${assigneeName} by ${assignerName}`;

      logs.push({
        id: `fallback-assigned-${lead.unique_id}`,
        lead_id: lead.unique_id,
        changed_by: assignerId === 'system' ? (lead.assigned_to || lead.lead_generated_by) : assignerId,
        action_type: isTL ? 'TL_ASSIGN' : 'TM_ASSIGN',
        old_value: 'Unassigned Pool',
        new_value: lead.assigned_to,
        comments: comment,
        created_at: lead.assigned_at || lead.updated_at || lead.created_at
      });
    }

    const hasCreation = logs.some(l => 
      l.action_type === 'LEAD_CREATION' || 
      l.comments?.toLowerCase().includes('created by')
    );

    if (!hasCreation && lead.created_at) {
      const creatorName = generatedByProfile?.full_name || 
        (lead as any).generated_by_name ||
        (lead.lead_generated_by ? (profiles.find(p => p.user_id === lead.lead_generated_by)?.full_name) : 'System') || 'System';

      logs.push({
        id: `fallback-created-${lead.unique_id}`,
        lead_id: lead.unique_id,
        changed_by: lead.lead_generated_by || lead.assigned_to || user?.id || 'system',
        action_type: 'LEAD_CREATION',
        old_value: 'None',
        new_value: lead.lead_status || 'New',
        comments: `Created by ${creatorName}`,
        created_at: lead.created_at
      });
    }

    // Deduplicate logs by action, comment, and minute timestamp
    const sorted = logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const uniqueLogs: any[] = [];
    const seenKeys = new Set<string>();

    for (const log of sorted) {
      const commentKey = (log.comments || '').trim().toLowerCase();
      const actionKey = (log.action_type || '').trim().toLowerCase();
      const dateKey = log.created_at ? new Date(log.created_at).toISOString().slice(0, 16) : '';
      const key = `${actionKey}|${commentKey}|${dateKey}`;

      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueLogs.push(log);
      }
    }

    return uniqueLogs;
  }, [statusHistory, lead, generatedByProfile, profiles, user?.id]);

  // Submitted documents (performas)
  const { data: submittedDocs } = useQuery({
    queryKey: ['lead-submitted-docs', lead.unique_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('performas')
        .select('*')
        .eq('lead_id', lead.unique_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const effectiveClosure = React.useMemo(() => {
    if (closure) return closure;
    if (!lead) return null;

    const commentStr = lead.comment || '';
    if (commentStr.includes('[Closure Payment]') || commentStr.includes('[Closure Details]')) {
      const planMatch = commentStr.match(/Plan:\s*([^|,\n]+)/);
      const upfrontMatch = commentStr.match(/Upfront:\s*\$?([0-9.]+)/) || commentStr.match(/Amount:\s*\$?([0-9.]+)/);
      const modeMatch = commentStr.match(/Payment Mode:\s*([^|,\n]+)/) || commentStr.match(/Mode:\s*([^|,\n]+)/);
      const amountMatch = commentStr.match(/On-Offer:\s*\$?([0-9.]+)/) || commentStr.match(/Amount:\s*\$?([0-9.]+)/);
      const percentageMatch = commentStr.match(/Percentage:\s*([0-9.]+)%/);

      return {
        plan: planMatch ? planMatch[1].trim() : 'Standard',
        upfront_amount: upfrontMatch ? parseFloat(upfrontMatch[1]) : 0,
        payment_mode: modeMatch ? modeMatch[1].trim() : 'N/A',
        amount: amountMatch ? parseFloat(amountMatch[1]) : null,
        percentage: percentageMatch ? parseFloat(percentageMatch[1]) : null,
        interview_plan: false,
        interviews_guaranteed: null,
      };
    }

    if (statusHistory && Array.isArray(statusHistory)) {
      const closureLog = statusHistory.find((l: any) => l.new_value === 'Closed' && l.comments && (l.comments.includes('[Closure Details]') || l.comments.includes('[Closure Payment]')));
      if (closureLog) {
        const cStr = closureLog.comments;
        const planMatch = cStr.match(/Plan:\s*([^|,\n]+)/);
        const upfrontMatch = cStr.match(/Upfront:\s*\$?([0-9.]+)/);
        const modeMatch = cStr.match(/Payment Mode:\s*([^|,\n]+)/);
        const amountMatch = cStr.match(/On-Offer:\s*\$?([0-9.]+)/);
        const percentageMatch = cStr.match(/Percentage:\s*([0-9.]+)%/);

        return {
          plan: planMatch ? planMatch[1].trim() : 'Standard',
          upfront_amount: upfrontMatch ? parseFloat(upfrontMatch[1]) : 0,
          payment_mode: modeMatch ? modeMatch[1].trim() : 'N/A',
          amount: amountMatch ? parseFloat(amountMatch[1]) : null,
          percentage: percentageMatch ? parseFloat(percentageMatch[1]) : null,
          interview_plan: false,
          interviews_guaranteed: null,
        };
      }
    }

    return null;
  }, [closure, lead, statusHistory]);

  const parsedOnOfferAmount = React.useMemo(() => {
    if (effectiveClosure && effectiveClosure.amount != null) return `$${effectiveClosure.amount}`;
    
    // Parse from lead.comment if available
    if (lead?.comment && (lead.comment.includes('[Closure Payment]') || lead.comment.includes('[Closure Details]'))) {
      const match = lead.comment.match(/Amount:\s*\$?([0-9.]+)/) || lead.comment.match(/On-Offer:\s*\$?([0-9.]+)/);
      if (match && match[1]) {
        return `$${match[1]}`;
      }
    }
    return null;
  }, [effectiveClosure, lead?.comment]);

  const parsedData = React.useMemo(() => {
    const data = {
      percentage: effectiveClosure?.percentage != null ? `${effectiveClosure.percentage}%` : null,
      slot1_due_date: effectiveClosure?.slot1_due_date ? formatToIST(effectiveClosure.slot1_due_date) : null,
      next_slot_due_date: effectiveClosure?.next_slot_due_date ? formatToIST(effectiveClosure.next_slot_due_date) : null,
      additional_slots: Array.isArray(effectiveClosure?.additional_slots) ? (effectiveClosure.additional_slots as any[]) : null,
    };

    if (lead?.comment && lead.comment.includes('[Closure Payment]')) {
      // Parse percentage
      if (!data.percentage) {
        const match = lead.comment.match(/Percentage:\s*([0-9.]+)%/);
        if (match && match[1]) {
          data.percentage = `${match[1]}%`;
        }
      }
      // Parse slot1 due date
      if (!data.slot1_due_date) {
        const match = lead.comment.match(/Slot1 Due:\s*([^,]+)/);
        if (match && match[1] && match[1].trim() !== 'N/A') {
          const dtStr = match[1].trim();
          const parsedDate = new Date(dtStr);
          if (!isNaN(parsedDate.getTime())) {
            data.slot1_due_date = formatToIST(parsedDate);
          } else {
            data.slot1_due_date = dtStr;
          }
        }
      }
      // Parse next slot due date
      if (!data.next_slot_due_date) {
        const match = lead.comment.match(/Next Slot Due:\s*([^,]+)/);
        if (match && match[1] && match[1].trim() !== 'N/A') {
          const dtStr = match[1].trim();
          const parsedDate = new Date(dtStr);
          if (!isNaN(parsedDate.getTime())) {
            data.next_slot_due_date = formatToIST(parsedDate);
          } else {
            data.next_slot_due_date = dtStr;
          }
        }
      }
      // Parse additional slots
      if (!data.additional_slots || data.additional_slots.length === 0) {
        const match = lead.comment.match(/Additional Slots:\s*(\[.*\])/);
        if (match && match[1]) {
          try {
            const parsed = JSON.parse(match[1]);
            if (Array.isArray(parsed)) {
              data.additional_slots = parsed;
            }
          } catch (e) {
            console.error("Failed to parse additional slots from comment", e);
          }
        }
      }
    }

    return data;
  }, [closure, lead?.comment]);

  const canSeeGeneratedBy = role === 'SALES_TM' || role === 'SALES_TL' || role === 'LEAD_TL' || role === 'PROCESS_ANALYST' || role === 'ADMIN';

  const Field = ({ label, value }: { label: string; value: any }) => (
    value ? (
      <div className="bg-background/40 p-2.5 rounded-md border border-accent/5">
        <span className="text-xs text-muted-foreground block mb-0.5">{label}</span>
        <p className="text-sm font-semibold text-foreground">{String(value)}</p>
      </div>
    ) : null
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl glass-card max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center justify-between">
            <div>
              <span className="text-xs font-mono text-muted-foreground block mb-0.5">ID: {lead.display_id || lead.unique_id}</span>
              <span className="text-lg font-bold">{lead.name}</span>
            </div>
            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary text-xs px-2.5 py-0.5 font-semibold">
              {lead.lead_status || 'New'}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {lead && (() => {
          const status = lead.lead_status;
          const updatedDate = lead.updated_at ? new Date(lead.updated_at) : null;
          if (!status || !updatedDate) return null;
          
          const now = new Date();
          const days = getWorkingDaysDifference(updatedDate, now);
          
          const getStatusThreshold = (st: string) => {
            switch (st) {
              case 'New': return 5;
              case 'DNR1': return 20;
              case 'DNR2': return 15;
              case 'DNR3': return 10;
              case 'Connected': return 30;
              case 'Qualified': return 60;
              case 'Hot Prospect': return 90;
              case 'Non Interested': return 2;
              default: return null;
            }
          };
          
          const threshold = getStatusThreshold(status);
          if (threshold !== null && days === threshold) {
            return (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-md text-xs flex items-center gap-2 mt-4">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <div>
                  <span className="font-semibold block">⚠️ Aging Deadline Reached</span>
                  <span>Status: {status} – No activity for exactly {days} days. This lead is eligible for immediate reassignment.</span>
                </div>
              </div>
            );
          }
          return null;
        })()}

        <Tabs defaultValue="general" className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-4 bg-background/50 border border-accent/20 p-1 rounded-lg">
            <TabsTrigger value="general" className="text-xs font-medium flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" /> Info
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs font-medium flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" /> Status History ({effectiveHistory.length})
            </TabsTrigger>
            <TabsTrigger value="calls" className="text-xs font-medium flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" /> Call History ({followups?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="documents" className="text-xs font-medium flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Documents ({submittedDocs?.length || 0})
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: General Info & details */}
          <TabsContent value="general" className="space-y-4 mt-4 outline-none">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email" value={lead.email} />
              <Field label="Phone" value={lead.phone} />
              <Field label="University" value={lead.university} />
              <Field label="Technology" value={lead.technology} />
              <Field label="LinkedIn" value={lead.linkedin_url} />
              <Field label="Resume" value={lead.resume_url} />
              <Field label="Time for Call" value={lead.time_for_call} />
              <Field label="Timezone" value={lead.timezone} />
              <Field label="Category" value={lead.lead_category} />
              <Field label="Type" value={lead.lead_type} />
              {lead.lead_type === 'Reference' && (
                <Field label="Referee Name" value={lead.referee_name} />
              )}
              <Field label="Source" value={lead.lead_source} />
              <Field label="Visa Status" value={lead.visa_status} />
              <Field label="Concern" value={lead.concern ? 'Yes' : 'No'} />
              {canSeeGeneratedBy && generatedByProfile && (
                <>
                  <Field label="Lead Generated By" value={generatedByProfile.full_name} />
                  <Field label="BD Member Email" value={generatedByProfile.email} />
                </>
              )}
            </div>
            {lead.comment && (
              <div className="bg-accent/20 p-3 rounded-lg border border-accent/10">
                <span className="text-xs text-muted-foreground font-semibold">Latest Comment/Remarks:</span>
                <p className="text-sm mt-1 text-foreground leading-relaxed">
                  {(!isSameTeam && lead.comment.includes('[Closure Payment]')) ? 'Payment details hidden (cross-team restriction)' : lead.comment}
                </p>
              </div>
            )}

            {effectiveClosure ? (
              <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                <h4 className="text-sm font-semibold mb-3 text-green-600 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Closure Details
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Field label="Plan" value={effectiveClosure.plan} />
                  <Field label="Interview Plan" value={effectiveClosure.interview_plan ? 'Yes' : 'No'} />
                  {effectiveClosure.interviews_guaranteed !== null && effectiveClosure.interviews_guaranteed !== undefined && (
                    <Field label="Number of Interviews" value={String(effectiveClosure.interviews_guaranteed)} />
                  )}
                  <Field label="Upfront Amount" value={`$${effectiveClosure.upfront_amount}`} />
                  <Field label="Payment Mode" value={effectiveClosure.payment_mode} />
                  {(parsedOnOfferAmount || parsedData.percentage != null) && (
                    <div className="col-span-2 grid grid-cols-2 gap-3">
                      {parsedOnOfferAmount ? (
                        <Field label="On-Offer Amount" value={parsedOnOfferAmount} />
                      ) : (
                        <div />
                      )}
                      {parsedData.percentage != null ? (
                        <Field label="Percentage" value={parsedData.percentage} />
                      ) : (
                        <div />
                      )}
                    </div>
                  )}
                  {effectiveClosure.slot1_amount !== null && effectiveClosure.slot1_amount !== undefined && (
                    <div className="col-span-2 grid grid-cols-2 gap-3">
                      <Field label="Slot 1 Amount" value={`$${effectiveClosure.slot1_amount} (${effectiveClosure.slot1 ? 'Paid' : 'Unpaid'})`} />
                      {parsedData.slot1_due_date ? (
                        <Field label="Slot 1 Due Date" value={parsedData.slot1_due_date} />
                      ) : (
                        <div />
                      )}
                    </div>
                  )}
                  {effectiveClosure.slot2_amount !== null && effectiveClosure.slot2_amount !== undefined && (
                    <div className="col-span-2 grid grid-cols-2 gap-3">
                      <Field label="Next Slot Amount" value={`$${effectiveClosure.slot2_amount} (${effectiveClosure.slot2 ? 'Paid' : 'Unpaid'})`} />
                      {parsedData.next_slot_due_date ? (
                        <Field label="Next Slot Due Date" value={parsedData.next_slot_due_date} />
                      ) : (
                        <div />
                      )}
                    </div>
                  )}
                  {Array.isArray(parsedData.additional_slots) && (parsedData.additional_slots as any[]).map((slot: any, idx: number) => (
                    <div key={idx} className="col-span-2 grid grid-cols-2 gap-3">
                      <Field label={`Slot ${slot.slot_number || (idx + 3)} Amount`} value={`$${slot.amount} (${slot.paid ? 'Paid' : 'Unpaid'})`} />
                      {slot.due_date ? (
                        <Field label={`Slot ${slot.slot_number || (idx + 3)} Due Date`} value={
                          isNaN(new Date(slot.due_date).getTime()) ? slot.due_date : formatToIST(slot.due_date)
                        } />
                      ) : (
                        <div />
                      )}
                    </div>
                  ))}
                  <div className="col-span-2 bg-background/50 p-3 rounded-md border border-green-500/10 shadow-sm select-text">
                    <span className="text-xs text-muted-foreground block mb-1">Candidate Email ID</span>
                    <p className="text-sm font-semibold text-foreground select-text">
                      {effectiveClosure.candidate_email || lead.email || 'None specified'}
                    </p>
                  </div>
                  <div className="col-span-2 bg-background/50 p-3 rounded-md border border-green-500/10 shadow-sm select-text">
                    <span className="text-xs text-muted-foreground block mb-1">Final Payment Conditions</span>
                    <p className="text-sm font-semibold text-foreground whitespace-pre-wrap select-text">
                      {effectiveClosure.final_payment_conditions || 'None specified'}
                    </p>
                  </div>
                  <div className="col-span-2 bg-background/50 p-3 rounded-md border border-green-500/10 shadow-sm select-text">
                    <span className="text-xs text-muted-foreground block mb-1">Current agreed payment conditions</span>
                    <p className="text-sm font-semibold text-foreground whitespace-pre-wrap select-text">
                      {effectiveClosure.current_agreed_payment_conditions || 'None specified'}
                    </p>
                  </div>
                </div>
              </div>
            ) : lead?.lead_status === 'Closed' ? (
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                  <span>Lead is marked as Closed, but closure payment & plan details have not been submitted yet.</span>
                </div>
                {onOpenClosure && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onClose();
                      onOpenClosure(lead);
                    }}
                    className="border-amber-500/30 text-amber-600 hover:bg-amber-500/10 shrink-0 ml-2"
                  >
                    Fill Closure Details
                  </Button>
                )}
              </div>
            ) : null}
          </TabsContent>

          {/* Tab 2: Status History logs */}
          <TabsContent value="history" className="mt-4 outline-none">
            {effectiveHistory && effectiveHistory.length > 0 ? (
              <div className="relative border-l border-accent/30 pl-4 space-y-5 py-2 max-h-[50vh] overflow-y-auto pr-1">
                {effectiveHistory.map((log) => {
                  const author = profiles.find(p => p.user_id === log.changed_by)?.full_name || 'System';
                  
                  const resolveName = (val: string | null | undefined) => {
                    if (!val || val === 'None' || val === 'Unassigned') return val || 'None';
                    const p = profiles.find(pr => pr.user_id === val);
                    return p?.full_name || val;
                  };

                  const oldFormatted = resolveName(log.old_value);
                  const newFormatted = resolveName(log.new_value);

                  const isAssignment = ['ASSIGNMENT', 'OWNER_CHANGE', 'TL_ASSIGN', 'TM_ASSIGN', 'RE_ASSIGN'].includes(log.action_type) ||
                    log.comments?.toLowerCase().includes('assigned') ||
                    log.comments?.toLowerCase().includes('re-assigned');

                  const isEdit = log.action_type === 'LEAD_EDIT' || log.comments?.toLowerCase().includes('edited');

                  const actionTitle = isAssignment
                    ? (log.comments?.toLowerCase().includes('re-assigned') || log.action_type === 'RE_ASSIGN' ? 're-assigned lead' : 'assigned lead')
                    : isEdit
                    ? 'edited details'
                    : 'changed status';

                  return (
                    <div key={log.id} className="relative">
                      {/* Timeline Dot */}
                      <span className="absolute -left-[21px] top-1 h-3.5 w-3.5 rounded-full border-2 border-primary bg-background shadow-sm" />
                      
                      <div className="bg-background/40 p-3 rounded-lg border border-accent/10">
                        <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground/80">{author}</span>
                            <span className="text-xs text-muted-foreground">{actionTitle}</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground">{formatDateTimeToIST(log.created_at)}</span>
                        </div>

                        {(oldFormatted !== 'None' || newFormatted !== 'None') && (
                          <div className="flex items-center gap-2 text-xs font-semibold mt-1">
                            <span className="text-muted-foreground">{oldFormatted}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="text-primary font-bold">{newFormatted}</span>
                          </div>
                        )}

                        {log.comments && (
                          <p className="mt-2 text-sm text-foreground/90 bg-accent/20 p-2 rounded leading-relaxed border-l-2 border-primary/50">
                            {log.comments}
                          </p>
                        )}

                        {log.new_value === 'Closed' && effectiveClosure && (
                          <div className="mt-2 text-xs bg-green-500/10 border border-green-500/20 p-2 rounded text-green-700 dark:text-green-400 space-y-1">
                            <div className="font-semibold flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Payment Plan Details:
                            </div>
                            <div>Plan: <strong>{effectiveClosure.plan}</strong> | Upfront: <strong>${effectiveClosure.upfront_amount}</strong> | Mode: <strong>{effectiveClosure.payment_mode}</strong></div>
                            {effectiveClosure.amount != null && <div>On-Offer Amount: <strong>${effectiveClosure.amount}</strong> ({effectiveClosure.percentage || 0}%)</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground text-sm bg-accent/5 rounded-lg border border-dashed border-accent/20">
                No status history recorded for this lead.
              </div>
            )}
          </TabsContent>

          {/* Tab 3: Call History */}
          <TabsContent value="calls" className="mt-4 outline-none">
            {followups && followups.length > 0 ? (
              <div className="relative border-l border-accent/30 pl-4 space-y-5 py-2 max-h-[50vh] overflow-y-auto pr-1">
                {followups.map((log) => {
                  const author = profiles.find(p => p.user_id === log.user_id)?.full_name || 'System';
                  return (
                    <div key={log.id} className="relative">
                      {/* Timeline Dot */}
                      <span className="absolute -left-[21px] top-1 h-3.5 w-3.5 rounded-full border-2 border-primary bg-background shadow-sm flex items-center justify-center">
                        <Phone className="h-2.5 w-2.5 text-primary" />
                      </span>
                      
                      <div className="bg-background/40 p-3 rounded-lg border border-accent/10">
                        <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground/80">{author}</span>
                            <span className="text-xs text-muted-foreground font-normal">contacted candidate</span>
                            <span className="text-xs font-semibold text-foreground/80">{lead.name}</span>
                            <Badge variant="secondary" className="text-[10px] ml-1 px-1 py-0">{log.way_of_contact || 'Call'}</Badge>
                          </div>
                          <span className="text-[11px] text-muted-foreground">{formatDateTimeToIST(log.created_at)}</span>
                        </div>

                        {log.notes && (
                          <p className="mt-2 text-sm text-foreground/90 bg-accent/20 p-2 rounded leading-relaxed border-l-2 border-primary/50">
                            {log.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground text-sm bg-accent/5 rounded-lg border border-dashed border-accent/20">
                No call/follow-up history recorded for this lead.
              </div>
            )}
          </TabsContent>

          {/* Tab 4: Submitted Documents */}
          <TabsContent value="documents" className="mt-4 outline-none">
            {submittedDocs && submittedDocs.length > 0 ? (
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {submittedDocs.map((doc) => {
                  let comment = 'No remarks provided.';
                  if (doc.notes) {
                    if (typeof doc.notes === 'object') {
                      comment = (doc.notes as any).comment || (doc.notes as any).remarks || JSON.stringify(doc.notes);
                    } else {
                      try {
                        const parsed = JSON.parse(doc.notes);
                        comment = parsed.comment || parsed.remarks || doc.notes;
                      } catch (e) {
                        comment = doc.notes;
                      }
                    }
                  }

                  return (
                    <div key={doc.id} className="p-3.5 bg-background/40 border border-accent/15 rounded-lg flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-foreground">{doc.type}</span>
                          <span className="text-xs text-muted-foreground">{formatDateTimeToIST(doc.created_at)}</span>
                        </div>
                        <p className="text-sm text-muted-foreground font-mono truncate">{doc.document_url || 'N/A'}</p>
                        <div className="bg-accent/10 p-2.5 rounded text-xs text-foreground leading-relaxed border-l-2 border-purple-500/50 mt-1">
                          <span className="font-semibold block text-[10px] text-purple-600 mb-0.5 uppercase tracking-wider">Remarks / Comments</span>
                          {comment}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground text-sm bg-accent/5 rounded-lg border border-dashed border-accent/20">
                No documents have been submitted for this lead yet.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default LeadDetailDialog;

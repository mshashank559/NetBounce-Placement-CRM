import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Phone, Send, FileText, Plus, Trash2, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

interface CallActivityDialogProps {
  lead: any;
  open: boolean;
  onClose: () => void;
  initialStatus?: string;
}

const ALL_STATUSES = ['DNR1','DNR2','DNR3','Connected','Qualified','Hot Prospect','Closed','Non Interested'];

const STATUS_FLOW: Record<string, string[]> = {
  'New':          ALL_STATUSES,
  'DNR1':         ALL_STATUSES,
  'DNR2':         ALL_STATUSES,
  'DNR3':         ALL_STATUSES,
  'Connected':    ALL_STATUSES,
  'Qualified':    ALL_STATUSES,
  'Hot Prospect': ALL_STATUSES,
  'Stagnant':     ALL_STATUSES,
  'Closed':       [],
  'Non Interested': [],
};

const CallActivityDialog: React.FC<CallActivityDialogProps> = ({ lead, open, onClose, initialStatus }) => {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();

  const currentStatus = lead.lead_status || 'New';
  const nextStatuses = role === 'ADMIN'
    ? ['New', 'DNR1', 'DNR2', 'DNR3', 'Connected', 'Qualified', 'Hot Prospect', 'Closed', 'Non Interested']
    : (STATUS_FLOW[currentStatus] || []);

  const [notes, setNotes] = useState('');
  const [wayOfContact, setWayOfContact] = useState('Call');
  const [newStatus, setNewStatus] = useState(initialStatus || currentStatus);
  const [emailSent, setEmailSent] = useState(false);
  const [nextFollowUpDate, setNextFollowUpDate] = useState(lead.next_followup_date || '');

  const handleStatusChange = (status: string) => {
    setNewStatus(status);
    if (status === 'Connected') {
      toast("Reminder: Please ensure you send the introductory email to the candidate containing the company introduction and our structured pricing plans.", {
        duration: 10000,
      });
    }
  };

  // Send Document State
  const [sendDocument, setSendDocument] = useState(false);
  const [docComment, setDocComment] = useState('');

  // Closure Form State
  const [plan, setPlan] = useState<'Starter' | 'Premium' | 'Elite' | 'Pro' | 'Custom' | ''>('');
  const [interviewPlan, setInterviewPlan] = useState(false);
  const [interviewsGuaranteed, setInterviewsGuaranteed] = useState('');
  const [upfrontAmount, setUpfrontAmount] = useState('');
  const [amount, setAmount] = useState('');
  const [percentage, setPercentage] = useState('');
  const [slot1, setSlot1] = useState(false);
  const [slot1Amount, setSlot1Amount] = useState('');
  const [slot1DueDate, setSlot1DueDate] = useState(new Date().toISOString().split('T')[0]);
  const [slot2, setSlot2] = useState(false);
  const [slot2Amount, setSlot2Amount] = useState('');
  const [nextSlotDueDate, setNextSlotDueDate] = useState('');
  const [customPlanNote, setCustomPlanNote] = useState('');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'Card' | 'UPI' | 'Bank Transfer' | 'Stripe' | 'Other' | ''>('');
  const [finalPaymentConditions, setFinalPaymentConditions] = useState('');
  const [currentAgreedPaymentConditions, setCurrentAgreedPaymentConditions] = useState('');
  const [candidateEmail, setCandidateEmail] = useState(lead?.email || '');

  interface AdditionalSlot {
    amount: string;
    due_date: string;
    paid?: boolean;
    slot_number?: number;
  }
  const [additionalSlots, setAdditionalSlots] = useState<AdditionalSlot[]>([]);

  const addSlot = () => {
    setAdditionalSlots(prev => [...prev, { amount: '', due_date: '' }]);
  };
  const removeSlot = (index: number) => {
    setAdditionalSlots(prev => prev.filter((_, i) => i !== index));
  };
  const updateSlot = (index: number, field: keyof AdditionalSlot, value: any) => {
    setAdditionalSlots(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const { data: closure, isSuccess: isClosureLoaded } = useQuery({
    queryKey: ['closure', lead?.unique_id],
    queryFn: async () => {
      if (!lead?.unique_id) return null;
      const { data } = await supabase.from('lead_closures').select('*').eq('lead_id', lead.unique_id).maybeSingle();
      return data;
    },
    enabled: open && !!lead?.unique_id,
  });

  React.useEffect(() => {
    if (isClosureLoaded && closure) {
      setPlan(closure.plan || '');
      setInterviewPlan(!!closure.interview_plan);
      setInterviewsGuaranteed(closure.interviews_guaranteed ? String(closure.interviews_guaranteed) : '');
      setUpfrontAmount(closure.upfront_amount ? String(closure.upfront_amount) : '');
      setAmount(closure.amount ? String(closure.amount) : '');
      setPercentage(closure.percentage ? String(closure.percentage) : '');
      setSlot1(!!closure.slot1);
      setSlot1Amount(closure.slot1_amount ? String(closure.slot1_amount) : '');
      setSlot1DueDate(closure.slot1_due_date || new Date().toISOString().split('T')[0]);
      setSlot2(!!closure.slot2);
      setSlot2Amount(closure.slot2_amount ? String(closure.slot2_amount) : '');
      setNextSlotDueDate(closure.next_slot_due_date || '');
      setPaymentMode(closure.payment_mode || '');
      setFinalPaymentConditions(closure.final_payment_conditions || '');
      setCurrentAgreedPaymentConditions(closure.current_agreed_payment_conditions || '');
      setCandidateEmail(closure.candidate_email || lead?.email || '');

      const parsedAdditionalSlots = Array.isArray(closure.additional_slots)
        ? (closure.additional_slots as any[]).map(s => ({
            amount: s.amount ? String(s.amount) : '',
            due_date: s.due_date || '',
            paid: !!s.paid
          }))
        : [];
      setAdditionalSlots(parsedAdditionalSlots);
    }
  }, [isClosureLoaded, closure]);


  const mutation = useMutation({
    mutationFn: async () => {
      if (!notes.trim()) throw new Error('Follow-up notes are required');

      const isDateOptional = ['Closed', 'Non Interested', 'DNR1', 'DNR2', 'DNR3'].includes(newStatus || '');
      if (!isDateOptional && !nextFollowUpDate) {
        throw new Error('Next Follow-Up Date is required');
      }


      // Validation for Closed status
      if (newStatus === 'Closed') {
        if (!candidateEmail.trim()) throw new Error('Candidate Email ID is required');
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(candidateEmail.trim())) throw new Error('Candidate Email ID must be a valid email address');
        if (!plan || !paymentMode) throw new Error('Plan and Payment Mode are required');
        if (plan === 'Custom' && !customPlanNote.trim()) throw new Error('Please describe your Custom Plan');
        if (!upfrontAmount || parseFloat(upfrontAmount) <= 0) throw new Error('Upfront Amount is required');
        if (!amount || parseFloat(amount) <= 0) throw new Error('On-Offer Amount is required');
        if (percentage === '' || parseFloat(percentage) < 0) throw new Error('Percentage is required');
      }

      // Validation for Send Document
      if (sendDocument && !docComment.trim()) {
        throw new Error('Document remarks are required when Send Document is checked');
      }

      const todayDate = new Date().toISOString().split('T')[0];

      // 1. Log the call only if the communication method is 'Call'
      if (wayOfContact.toLowerCase() === 'call') {
        const { data: existing } = await supabase
          .from('call_logs')
          .select('*')
          .eq('user_id', user!.id)
          .eq('lead_id', lead.unique_id)
          .eq('call_date', todayDate)
          .maybeSingle();

        if (existing) {
          await supabase.from('call_logs')
            .update({ call_count: (existing.call_count || 0) + 1 })
            .eq('id', existing.id);
        } else {
          await supabase.from('call_logs').insert({
            user_id: user!.id,
            lead_id: lead.unique_id,
            call_date: todayDate,
            call_count: 1,
          });
        }
      }

      // 2. Insert follow-up record
      await supabase.from('followups').insert({
        lead_id: lead.unique_id,
        user_id: user!.id,
        notes: notes.trim(),
        way_of_contact: emailSent ? 'Email' : wayOfContact,
      });

      // 3. Update lead status and next follow-up date
      const leadUpdatePayload: any = {
        next_followup_date: (newStatus === 'Closed' || newStatus === 'Non Interested') ? null : (nextFollowUpDate || null)
      };

      if (newStatus && newStatus !== currentStatus) {
        leadUpdatePayload.lead_status = newStatus as any;
      }
      if (newStatus === 'Closed') {
        leadUpdatePayload.email = candidateEmail.trim();
      }

      const { error: updateLeadErr } = await supabase.from('leads')
        .update(leadUpdatePayload)
        .eq('unique_id', lead.unique_id);
      
      if (updateLeadErr) throw updateLeadErr;

      if (newStatus && newStatus !== currentStatus) {
        if (newStatus === 'Closed') {
          await supabase.from('lead_history_logs').insert({
            lead_id: lead.unique_id,
            changed_by: user!.id,
            action_type: 'STATUS_CHANGE',
            old_value: currentStatus,
            new_value: 'Closed',
            comments: notes.trim() || null
          });

          // 1. Identify the target Sales TL for the lead
          let salesTLId = lead.team_lead_id;
          if (!salesTLId && lead.assigned_to) {
            const { data: assigneeProfile } = await supabase
              .from('profiles')
              .select('reports_to')
              .eq('user_id', lead.assigned_to)
              .maybeSingle();
            salesTLId = assigneeProfile?.reports_to || null;
          }

          // 2. Fetch ADMIN user IDs
          const { data: adminRoles } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'ADMIN');
          
          const adminUserIds = adminRoles?.map(r => r.user_id) || [];
          const notifyUserIds = new Set<string>(adminUserIds);
          if (salesTLId) {
            notifyUserIds.add(salesTLId);
          }
          const notifyUserIdsArray = Array.from(notifyUserIds);

          // Notify Admin and the lead's Sales TL about closure
          if (notifyUserIdsArray.length > 0) {
            const notifications = notifyUserIdsArray.map(userId => ({
              user_id: userId,
              title: 'Lead Closed',
              message: `${lead.name} has been closed successfully.`,
              type: 'closure',
              lead_id: lead.unique_id,
            }));
            await supabase.from('notifications').insert(notifications);
          }

          // Revenue notification for Admin + lead's Sales TL
          const totalRevenue = (slot1 ? (parseFloat(slot1Amount) || 0) : 0)
            + (slot2 ? (parseFloat(slot2Amount) || 0) : 0)
            + additionalSlots.reduce((sum, s) => sum + (s.paid ? (parseFloat(s.amount) || 0) : 0), 0);

          if (totalRevenue > 0 && notifyUserIdsArray.length > 0) {
            const revenueNotifs = notifyUserIdsArray.map(userId => ({
              user_id: userId,
              title: 'New Revenue Generated',
              message: `New revenue of $${totalRevenue.toFixed(2)} generated from ${lead.name}.`,
              type: 'revenue',
              lead_id: lead.unique_id,
            }));
            await supabase.from('notifications').insert(revenueNotifs);
          }
        } else {
          await supabase.from('lead_history_logs').insert({
            lead_id: lead.unique_id,
            changed_by: user!.id,
            action_type: 'STATUS_CHANGE',
            old_value: currentStatus,
            new_value: newStatus,
            comments: notes.trim() || null
          });

          // Notify BD member on DNR / Non Interested
          if (['DNR1', 'DNR2', 'DNR3', 'Non Interested'].includes(newStatus) && lead.lead_generated_by) {
            await supabase.from('notifications').insert({
              user_id: lead.lead_generated_by,
              title: 'Lead Status Update',
              message: `${lead.name} marked as ${newStatus}. Please reconnect.`,
              type: 'dnr',
              lead_id: lead.unique_id,
            });
          }
        }
      }

      // 3.5 Save lead closure details if new status is Closed (even if status was already Closed)
      if (newStatus === 'Closed') {
        // Build closure payload with new fields including additional_slots
        const closurePayload: any = {
          lead_id: lead.unique_id,
          plan: plan as any,
          interview_plan: interviewPlan,
          interviews_guaranteed: interviewsGuaranteed ? parseInt(interviewsGuaranteed) || null : null,
          upfront_amount: parseFloat(upfrontAmount) || 0,
          amount: parseFloat(amount) || 0,
          percentage: parseFloat(percentage) || 0,
          slot1: slot1,
          slot1_amount: slot1Amount ? parseFloat(slot1Amount) || 0 : null,
          slot1_due_date: slot1DueDate || null,
          slot2: slot2,
          slot2_amount: slot2Amount ? parseFloat(slot2Amount) || 0 : null,
          next_slot_due_date: nextSlotDueDate || null,
          payment_mode: paymentMode as any,
          additional_slots: additionalSlots.map((s, idx) => ({
            slot_number: idx + 3,
            amount: parseFloat(s.amount) || 0,
            due_date: s.due_date || null,
            paid: !!s.paid
          })),
          final_payment_conditions: finalPaymentConditions,
          current_agreed_payment_conditions: currentAgreedPaymentConditions,
          candidate_email: candidateEmail.trim()
        };

        // Try inserting/updating with the new columns; fallback if columns don't exist yet
        let error;
        if (closure?.id) {
          const { error: err } = await supabase.from('lead_closures').update(closurePayload).eq('id', closure.id);
          error = err;
        } else {
          const { error: err } = await supabase.from('lead_closures').insert(closurePayload);
          error = err;
        }

        if (!error) {
          await supabase.from('leads')
            .update({ email: candidateEmail.trim() } as any)
            .eq('unique_id', lead.unique_id);
        }

        if (error) {
          if (error.code === '42703' || error.message?.includes('column')) {
            const fallbackPayload: any = {
              lead_id: lead.unique_id,
              plan: plan as any,
              interview_plan: interviewPlan,
              upfront_amount: parseFloat(upfrontAmount) || 0,
              slot1: slot1,
              slot1_amount: slot1Amount ? parseFloat(slot1Amount) || 0 : null,
              slot2: slot2,
              slot2_amount: slot2Amount ? parseFloat(slot2Amount) || 0 : null,
              payment_mode: paymentMode as any,
              amount: parseFloat(amount) || 0,
              percentage: parseFloat(percentage) || 0,
              slot1_due_date: slot1DueDate || null,
              next_slot_due_date: nextSlotDueDate || null,
              final_payment_conditions: finalPaymentConditions,
              current_agreed_payment_conditions: currentAgreedPaymentConditions,
              candidate_email: candidateEmail.trim(),
              interviews_guaranteed: interviewsGuaranteed ? parseInt(interviewsGuaranteed) || null : null,
            };
            let fallbackErr;
            if (closure?.id) {
              const { error: err } = await supabase.from('lead_closures').update(fallbackPayload).eq('id', closure.id);
              fallbackErr = err;
            } else {
              const { error: err } = await supabase.from('lead_closures').insert(fallbackPayload);
              fallbackErr = err;
            }
            if (fallbackErr) throw fallbackErr;

            const paymentDetails = `[Closure Payment] Amount: $${amount}, Percentage: ${percentage}%, Slot1 Due: ${slot1DueDate || 'N/A'}, Next Slot Due: ${nextSlotDueDate || 'N/A'}, Additional Slots: ${JSON.stringify(additionalSlots)}`;
            await supabase.from('leads').update({ comment: paymentDetails, email: candidateEmail.trim() } as any).eq('unique_id', lead.unique_id);
          } else {
            throw error;
          }
        }
      }

      // 4. Send document if toggled
      if (sendDocument && docComment.trim()) {
        const docRef = 'DOC-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        const { error: perfErr } = await supabase.from('performas').insert({
          lead_id: lead.unique_id,
          sent_by: user!.id,
          type: 'Pre-Performa',
          document_url: docRef,
          notes: JSON.stringify({
            status: 'Sent',
            sla: 'Pending',
            sent_at: new Date().toISOString(),
            docRefId: docRef,
            comment: docComment.trim(),
          }),
        });
        if (perfErr) throw perfErr;

        const { data: accountants } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'ACCOUNTANT');

        if (accountants && accountants.length > 0) {
          const { error: notifErr } = await supabase.from('notifications').insert(
            accountants.map(t => ({
              user_id: t.user_id,
              title: '📄 Document Sent with Status Update',
              message: `"${lead.name}" status: ${newStatus || currentStatus}. Document remark: "${docComment.trim()}"`,
              type: 'accountant_update',
              lead_id: lead.unique_id,
            }))
          );
          if (notifErr) throw notifErr;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['all-leads-admin'] });
      queryClient.invalidateQueries({ queryKey: ['all-leads-pa'] });
      queryClient.invalidateQueries({ queryKey: ['sm-leads-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['sm-leads-stats'] });
      queryClient.invalidateQueries({ queryKey: ['sales-tl-leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-calls'] });
      queryClient.invalidateQueries({ queryKey: ['call-logs'] });
      queryClient.invalidateQueries({ queryKey: ['sm-leads'] });
      queryClient.invalidateQueries({ queryKey: ['salestl-leads'] });
      queryClient.invalidateQueries({ queryKey: ['followups', lead.unique_id] });
      queryClient.invalidateQueries({ queryKey: ['all-performas'] });
      queryClient.invalidateQueries({ queryKey: ['all-leads-accountant'] });
      queryClient.invalidateQueries({ queryKey: ['account-closures'] });
      queryClient.invalidateQueries({ queryKey: ['all-closures'] });
      queryClient.invalidateQueries({ queryKey: ['closure', lead.unique_id] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['revenue-closures'] });

      // Compute next follow-up date based on status delay
      let delayDays = 1;
      const statusToCheck = newStatus || currentStatus;
      if (statusToCheck === 'Hot Prospect') delayDays = 90;
      else if (statusToCheck === 'Qualified') delayDays = 60;
      else if (statusToCheck === 'Connected') delayDays = 30;
      else if (statusToCheck === 'DNR1') delayDays = 20;
      else if (statusToCheck === 'DNR2') delayDays = 15;
      else if (statusToCheck === 'DNR3') delayDays = 10;

      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + delayDays);

      if (statusToCheck === 'Closed') {
        toast.success(`Lead successfully closed and payment logged!`);
      } else {
        toast.success(`Call logged! Next follow-up: ${nextDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`);
      }
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Query 24h call metrics for the salesperson
  const { data: callCount24h = 0 } = useQuery({
    queryKey: ['call-count-24h', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('call_logs')
        .select('call_count')
        .eq('user_id', user.id)
        .gte('created_at', yesterday);
      if (error) throw error;
      return data?.reduce((sum, log) => sum + (log.call_count || 0), 0) || 0;
    },
    enabled: !!user && open,
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="glass-card max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              Call Activity — {lead.name}
            </span>
            <Badge variant="secondary" className="text-xs bg-primary/10 text-primary hover:bg-primary/20 border-none px-3 py-1 font-semibold">
              24h Calls: {callCount24h}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={e => { e.preventDefault(); mutation.mutate(); }}
          className="space-y-4 mt-2"
        >
          <div>
            <Label className="text-xs text-muted-foreground">Way of Contact</Label>
            <Select value={wayOfContact} onValueChange={setWayOfContact}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Call">Call</SelectItem>
                <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                <SelectItem value="Email">Email</SelectItem>
                <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                <SelectItem value="SMS">SMS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Follow-up Notes *</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="What happened on this call? Any next steps?"
              className="mt-1 min-h-[100px]"
              required
            />
          </div>

          {newStatus !== 'Closed' && newStatus !== 'Non Interested' && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3 text-primary" />
                Next Follow-Up Date {!['DNR1', 'DNR2', 'DNR3'].includes(newStatus || '') && '*'}
              </Label>
              <Input
                type="date"
                value={nextFollowUpDate}
                onChange={e => setNextFollowUpDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="mt-1"
                required={!['DNR1', 'DNR2', 'DNR3'].includes(newStatus || '')}
              />
            </div>
          )}

          {nextStatuses.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">
                Update Status <span className="text-muted-foreground/60">(current: {currentStatus})</span>
              </Label>
              <Select value={newStatus} onValueChange={handleStatusChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {!nextStatuses.includes(currentStatus) && (
                    <SelectItem value={currentStatus}>{currentStatus}</SelectItem>
                  )}
                  {nextStatuses.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {nextStatuses.length === 0 && (
            <p className="text-xs text-muted-foreground bg-accent/30 rounded-lg p-2">
              Lead is in terminal status ({currentStatus}) — notes will still be logged.
            </p>
          )}

          {/* Conditional Checkbox for Connected Status */}
          {newStatus === 'Connected' && (
            <div className="flex items-center gap-2 py-1 mt-2">
              <Checkbox
                checked={emailSent}
                onCheckedChange={(v) => setEmailSent(!!v)}
                id="email-sent-checkbox"
              />
              <Label htmlFor="email-sent-checkbox" className="cursor-pointer text-xs font-medium text-foreground"> Email Sent</Label>
            </div>
          )}

          {/* Send Document block (available on any status for SALES_TL, SALES_TM, ADMIN) */}
          {(role === 'SALES_TL' || role === 'SALES_TM' || role === 'ADMIN') && (
            <div className="border border-border/50 rounded-lg p-3 space-y-3 bg-background/50 mt-4">
              <button
                type="button"
                onClick={() => { setSendDocument(v => !v); if (sendDocument) setDocComment(''); }}
                className={`flex items-center gap-2 text-sm font-medium w-full rounded-md px-2 py-1.5 transition-colors ${
                  sendDocument
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
                }`}
              >
                <Send className="h-4 w-4" />
                Send Document
                <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  sendDocument ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>{sendDocument ? 'ON' : 'OFF'}</span>
              </button>

              {sendDocument && (
                <div className="space-y-1.5">
                  <Label htmlFor="dlg-doc-comment" className="text-xs">
                    <FileText className="h-3.5 w-3.5 inline mr-1 text-primary" />
                    Document Remarks <span className="text-destructive">*</span>
                    <span className="text-xs text-muted-foreground ml-1">(sent to Accountant Dashboard)</span>
                  </Label>
                  <Textarea
                    id="dlg-doc-comment"
                    value={docComment}
                    onChange={e => setDocComment(e.target.value)}
                    placeholder="Add remarks about the document being sent..."
                    rows={3}
                    className="resize-none"
                    required={sendDocument}
                  />
                </div>
              )}
            </div>
          )}

          {/* Render Payment details fields if Closed is selected */}
          {newStatus === 'Closed' && (
            <div className="border-t border-border/50 pt-4 mt-4 space-y-4">
              <h3 className="text-sm font-semibold text-foreground font-display">Closure & Payment Details</h3>
              
              <div>
                <Label htmlFor="candidate-email">Candidate Email ID *</Label>
                <Input
                  id="candidate-email"
                  type="email"
                  value={candidateEmail}
                  onChange={e => setCandidateEmail(e.target.value.trim())}
                  placeholder="candidate@example.com"
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <Label>Plan *</Label>
                <Select value={plan} onValueChange={v => setPlan(v as any)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select plan" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Starter">Starter</SelectItem>
                    <SelectItem value="Premium">Premium</SelectItem>
                    <SelectItem value="Elite">Elite</SelectItem>
                    <SelectItem value="Pro">Pro</SelectItem>
                    <SelectItem value="Custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {plan === 'Custom' && (
                <div>
                  <Label>Custom Plan Description *</Label>
                  <textarea
                    value={customPlanNote}
                    onChange={e => setCustomPlanNote(e.target.value)}
                    placeholder="Add your custom plan details here..."
                    rows={3}
                    className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 py-1">
                <Checkbox checked={interviewPlan} onCheckedChange={v => setInterviewPlan(!!v)} id="ip" />
                <Label htmlFor="ip" className="cursor-pointer">Interview Plan</Label>
              </div>
              
              {interviewPlan && (
                <div>
                  <Label>Number of Interviews Guaranteed</Label>
                  <Input type="number" value={interviewsGuaranteed} onChange={e => setInterviewsGuaranteed(e.target.value)} placeholder="e.g. 3" className="mt-1" />
                </div>
              )}

              <div>
                <Label>Upfront Amount (USD) *</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input type="number" value={upfrontAmount} onChange={e => setUpfrontAmount(e.target.value)} placeholder="0.00" className="pl-7" />
                </div>
              </div>

              <div>
                <Label>On-Offer Amount (USD) *</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="pl-7" />
                </div>
              </div>

              <div>
                <Label>Percentage (%) *</Label>
                <div className="relative mt-1">
                  <Input type="number" value={percentage} onChange={e => setPercentage(e.target.value)} placeholder="0" className="pr-7" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                </div>
              </div>

              {/* Slot 1 */}
              <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Slot 1 Details</span>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={slot1} onCheckedChange={v => setSlot1(!!v)} id="s1" />
                    <Label htmlFor="s1" className="text-xs cursor-pointer">Mark as Paid</Label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input type="number" value={slot1Amount} onChange={e => setSlot1Amount(e.target.value)} placeholder="Slot 1 Amount" className="pl-7 text-xs h-9" />
                  </div>
                  <div>
                    <Input type="date" value={slot1DueDate} onChange={e => setSlot1DueDate(e.target.value)} className="text-xs h-9" />
                  </div>
                </div>
              </div>

              {/* Next Slot (Slot 2) */}
              <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Next Slot (Slot 2) Details</span>
                  <div className="flex items-center gap-2">
                    <Checkbox checked={slot2} onCheckedChange={v => setSlot2(!!v)} id="s2" />
                    <Label htmlFor="s2" className="text-xs cursor-pointer">Mark as Paid</Label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input type="number" value={slot2Amount} onChange={e => setSlot2Amount(e.target.value)} placeholder="Next Slot Amount" className="pl-7 text-xs h-9" />
                  </div>
                  <div>
                    <Input type="date" value={nextSlotDueDate} onChange={e => setNextSlotDueDate(e.target.value)} className="text-xs h-9" />
                  </div>
                </div>
              </div>

              {/* Additional Slots */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Additional Slots</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSlot}
                    className="h-7 px-2 flex items-center gap-1 border-primary/20 text-primary hover:bg-primary/5"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Slot
                  </Button>
                </div>
                
                {additionalSlots.map((slot, index) => (
                  <div key={index} className="space-y-2 pl-4 border-l-2 border-primary/20 relative">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">Slot {index + 3} Details</span>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={!!slot.paid}
                          onCheckedChange={v => updateSlot(index, 'paid', !!v)}
                          id={`add-slot-paid-${index}`}
                        />
                        <Label htmlFor={`add-slot-paid-${index}`} className="text-xs cursor-pointer">Mark as Paid</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSlot(index)}
                          className="h-6 w-6 text-destructive hover:bg-destructive/10 ml-2"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                        <Input
                          type="number"
                          value={slot.amount}
                          onChange={e => updateSlot(index, 'amount', e.target.value)}
                          placeholder={`Slot ${index + 3} Amount`}
                          className="pl-7 text-xs h-9"
                        />
                      </div>
                      <div>
                        <Input
                          type="date"
                          value={slot.due_date}
                          onChange={e => updateSlot(index, 'due_date', e.target.value)}
                          className="text-xs h-9"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <Label>Payment Mode *</Label>
                <Select value={paymentMode} onValueChange={v => setPaymentMode(v as any)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select mode" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Card">Card</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Stripe">Stripe</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Final Payment Conditions</Label>
                <textarea
                  value={finalPaymentConditions}
                  onChange={e => setFinalPaymentConditions(e.target.value)}
                  placeholder="Enter final payment conditions..."
                  rows={3}
                  className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
              </div>

              <div>
                <Label>Current agreed payment conditions</Label>
                <textarea
                  value={currentAgreedPaymentConditions}
                  onChange={e => setCurrentAgreedPaymentConditions(e.target.value)}
                  placeholder="Enter current agreed payment conditions..."
                  rows={3}
                  className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1 nb-gradient" disabled={mutation.isPending}>
              {mutation.isPending ? 'Logging...' : (newStatus === 'Closed' ? 'Close Lead & Save' : 'Log Call & Save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CallActivityDialog;

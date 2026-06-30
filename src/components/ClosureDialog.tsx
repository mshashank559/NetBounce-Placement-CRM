import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Trash2 } from 'lucide-react';

interface ClosureDialogProps {
  lead: any;
  open: boolean;
  onClose: () => void;
}

const ClosureDialog: React.FC<ClosureDialogProps> = ({ lead, open, onClose }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    plan: '' as 'Starter' | 'Premium' | 'Elite' | 'Pro' | 'Custom' | '',
    interview_plan: false,
    interviews_guaranteed: '',
    movement: '',
    custom_plan_note: '',
    upfront_amount: '',
    amount: '',
    percentage: '',
    slot1: false,
    slot1_amount: '',
    slot1_due_date: new Date().toISOString().split('T')[0],
    slot2: false,
    slot2_amount: '',
    next_slot_due_date: '',
    payment_mode: '' as 'Cash' | 'Card' | 'UPI' | 'Bank Transfer' | 'Stripe' | 'Other' | '',
    final_payment_conditions: '',
    current_agreed_payment_conditions: '',
    candidate_email: lead?.email || '',
  });

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
      setForm({
        plan: closure.plan || '',
        interview_plan: !!closure.interview_plan,
        interviews_guaranteed: closure.interviews_guaranteed ? String(closure.interviews_guaranteed) : '',
        movement: '',
        custom_plan_note: '',
        upfront_amount: closure.upfront_amount ? String(closure.upfront_amount) : '',
        amount: closure.amount ? String(closure.amount) : '',
        percentage: closure.percentage ? String(closure.percentage) : '',
        slot1: !!closure.slot1,
        slot1_amount: closure.slot1_amount ? String(closure.slot1_amount) : '',
        slot1_due_date: closure.slot1_due_date || new Date().toISOString().split('T')[0],
        slot2: !!closure.slot2,
        slot2_amount: closure.slot2_amount ? String(closure.slot2_amount) : '',
        next_slot_due_date: closure.next_slot_due_date || '',
        payment_mode: closure.payment_mode || '',
        final_payment_conditions: closure.final_payment_conditions || '',
        current_agreed_payment_conditions: closure.current_agreed_payment_conditions || '',
        candidate_email: closure.candidate_email || lead?.email || '',
      });

      const parsedAdditionalSlots = Array.isArray(closure.additional_slots)
        ? (closure.additional_slots as any[]).map(s => ({
            amount: s.amount ? String(s.amount) : '',
            due_date: s.due_date || ''
          }))
        : [];
      setAdditionalSlots(parsedAdditionalSlots);
    } else if (lead?.email) {
      setForm(f => ({ ...f, candidate_email: f.candidate_email || lead.email }));
    }
  }, [isClosureLoaded, closure, lead?.email]);

  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.candidate_email.trim()) throw new Error('Candidate Email ID is required');
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.candidate_email.trim())) throw new Error('Candidate Email ID must be a valid email address');
      if (!form.plan || !form.payment_mode) throw new Error('Plan and Payment Mode are required');
      if (!form.movement.trim()) throw new Error('Comment is required');
      if (form.plan === 'Custom' && !form.custom_plan_note.trim()) throw new Error('Please describe your Custom Plan');
      if (!form.upfront_amount || parseFloat(form.upfront_amount) <= 0) throw new Error('Upfront Amount is required');
      if (!form.amount || parseFloat(form.amount) <= 0) throw new Error('On-Offer Amount is required');
      if (form.percentage === '' || parseFloat(form.percentage) < 0) throw new Error('Percentage is required');

      // Update lead status to Closed and sync email
      await supabase.from('leads').update({ lead_status: 'Closed' as any, email: form.candidate_email.trim() }).eq('unique_id', lead.unique_id);

      await supabase.from('lead_history_logs').insert({
        lead_id: lead.unique_id,
        changed_by: user!.id,
        action_type: 'STATUS_CHANGE',
        old_value: lead.lead_status || 'New',
        new_value: 'Closed',
        comments: form.movement.trim() || null
      });

      // Build closure payload with new fields
      const closurePayload: any = {
        lead_id: lead.unique_id,
        plan: form.plan as any,
        interview_plan: form.interview_plan,
        interviews_guaranteed: form.interviews_guaranteed ? parseInt(form.interviews_guaranteed) || null : null,
        upfront_amount: parseFloat(form.upfront_amount) || 0,
        amount: parseFloat(form.amount) || 0,
        percentage: parseFloat(form.percentage) || 0,
        slot1: form.slot1,
        slot1_amount: form.slot1_amount ? parseFloat(form.slot1_amount) || 0 : null,
        slot1_due_date: form.slot1_due_date || null,
        slot2: form.slot2,
        slot2_amount: form.slot2_amount ? parseFloat(form.slot2_amount) || 0 : null,
        next_slot_due_date: form.next_slot_due_date || null,
        payment_mode: form.payment_mode as any,
        additional_slots: additionalSlots.map((s, idx) => ({
          slot_number: idx + 3,
          amount: parseFloat(s.amount) || 0,
          due_date: s.due_date || null,
          paid: !!s.paid
        })),
        final_payment_conditions: form.final_payment_conditions,
        current_agreed_payment_conditions: form.current_agreed_payment_conditions,
        candidate_email: form.candidate_email.trim()
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
          .update({ email: form.candidate_email.trim() } as any)
          .eq('unique_id', lead.unique_id);
      }

      if (error) {
        // If the error is about unknown columns, retry with only the standard columns
        if (error.code === '42703' || error.message?.includes('column')) {
          const fallbackPayload: any = {
            lead_id: lead.unique_id,
            plan: form.plan as any,
            interview_plan: form.interview_plan,
            upfront_amount: parseFloat(form.upfront_amount) || 0,
            slot1: form.slot1,
            slot1_amount: form.slot1_amount ? parseFloat(form.slot1_amount) || 0 : null,
            slot2: form.slot2,
            slot2_amount: form.slot2_amount ? parseFloat(form.slot2_amount) || 0 : null,
            payment_mode: form.payment_mode as any,
            amount: parseFloat(form.amount) || 0,
            percentage: parseFloat(form.percentage) || 0,
            slot1_due_date: form.slot1_due_date || null,
            next_slot_due_date: form.next_slot_due_date || null,
            final_payment_conditions: form.final_payment_conditions,
            current_agreed_payment_conditions: form.current_agreed_payment_conditions,
            candidate_email: form.candidate_email.trim(),
            interviews_guaranteed: form.interviews_guaranteed ? parseInt(form.interviews_guaranteed) || null : null,
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

          const paymentDetails = `[Closure Payment] Amount: $${form.amount}, Percentage: ${form.percentage}%, Slot1 Due: ${form.slot1_due_date || 'N/A'}, Next Slot Due: ${form.next_slot_due_date || 'N/A'}, Additional Slots: ${JSON.stringify(additionalSlots)}`;
          await supabase.from('leads').update({ comment: paymentDetails, email: form.candidate_email.trim() } as any).eq('unique_id', lead.unique_id);
        } else {
          throw error;
        }
      }

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
      const totalRevenue = (form.slot1 ? (parseFloat(form.slot1_amount) || 0) : 0)
        + (form.slot2 ? (parseFloat(form.slot2_amount) || 0) : 0)
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
    },
    onSuccess: () => {
      toast.success('Lead closed successfully!');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['all-leads-admin'] });
      queryClient.invalidateQueries({ queryKey: ['all-leads-pa'] });
      queryClient.invalidateQueries({ queryKey: ['sm-leads-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['sm-leads-stats'] });
      queryClient.invalidateQueries({ queryKey: ['sales-tl-leads'] });
      queryClient.invalidateQueries({ queryKey: ['salestl-leads'] });
      queryClient.invalidateQueries({ queryKey: ['all-leads-accountant'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['closure', lead.unique_id] });
      queryClient.invalidateQueries({ queryKey: ['all-closures'] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="glass-card max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {lead?.lead_status === 'Closed' ? 'Edit Closure & Payment Details' : `Close Lead — ${lead?.name}`}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={e => { e.preventDefault(); mutation.mutate(); }} className="space-y-4 mt-4">
          <div>
            <Label htmlFor="candidate-email">Candidate Email ID *</Label>
            <Input
              id="candidate-email"
              type="email"
              value={form.candidate_email}
              onChange={e => set('candidate_email', e.target.value.trim())}
              placeholder="candidate@example.com"
              required
            />
          </div>

          <div>
            <Label>Plan *</Label>
            <Select value={form.plan} onValueChange={v => set('plan', v)}>
              <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Starter">Starter</SelectItem>
                <SelectItem value="Premium">Premium</SelectItem>
                <SelectItem value="Elite">Elite</SelectItem>
                <SelectItem value="Pro">Pro</SelectItem>
                <SelectItem value="Custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Comment — always mandatory */}
          <div>
            <Label>Comment *</Label>
            <Input
              value={form.movement}
              onChange={e => set('movement', e.target.value)}
              placeholder="Add your comment"
            />
          </div>

          {/* Custom Plan Note — only when Custom selected */}
          {form.plan === 'Custom' && (
            <div>
              <Label>Custom Plan Description *</Label>
              <textarea
                value={form.custom_plan_note}
                onChange={e => set('custom_plan_note', e.target.value)}
                placeholder="Add your custom plan details here..."
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox checked={form.interview_plan} onCheckedChange={v => set('interview_plan', !!v)} id="ip" />
            <Label htmlFor="ip">Interview Plan</Label>
          </div>
          {form.interview_plan && (
            <div>
              <Label>Number of Interviews Guaranteed</Label>
              <Input type="number" value={form.interviews_guaranteed} onChange={e => set('interviews_guaranteed', e.target.value)} placeholder="e.g. 3" />
            </div>
          )}

          {/* Upfront Amount (renamed from Total Collection Amount) */}
          <div>
            <Label>Upfront Amount (USD) *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input type="number" value={form.upfront_amount} onChange={e => set('upfront_amount', e.target.value)} placeholder="0.00" className="pl-7" />
            </div>
          </div>

          {/* On-Offer Amount — mandatory */}
          <div>
            <Label>On-Offer Amount (USD) *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" className="pl-7" />
            </div>
          </div>

          {/* Percentage — mandatory */}
          <div>
            <Label>Percentage (%) *</Label>
            <div className="relative">
              <Input type="number" value={form.percentage} onChange={e => set('percentage', e.target.value)} placeholder="0" className="pr-7" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            </div>
          </div>

          {/* Slot 1 */}
          <div className="space-y-2 pl-4 border-l-2 border-primary/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Slot 1 Details</span>
              <div className="flex items-center gap-2">
                <Checkbox checked={form.slot1} onCheckedChange={v => set('slot1', !!v)} id="s1" />
                <Label htmlFor="s1" className="text-xs cursor-pointer">Mark as Paid</Label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input type="number" value={form.slot1_amount} onChange={e => set('slot1_amount', e.target.value)} placeholder="Slot 1 Amount" className="pl-7 text-xs h-9" />
              </div>
              <div>
                <Input type="date" value={form.slot1_due_date} onChange={e => set('slot1_due_date', e.target.value)} className="text-xs h-9" />
              </div>
            </div>
          </div>

          {/* Next Slot (Slot 2) */}
          <div className="space-y-2 pl-4 border-l-2 border-primary/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">Next Slot (Slot 2) Details</span>
              <div className="flex items-center gap-2">
                <Checkbox checked={form.slot2} onCheckedChange={v => set('slot2', !!v)} id="s2" />
                <Label htmlFor="s2" className="text-xs cursor-pointer">Mark as Paid</Label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input type="number" value={form.slot2_amount} onChange={e => set('slot2_amount', e.target.value)} placeholder="Next Slot Amount" className="pl-7 text-xs h-9" />
              </div>
              <div>
                <Input type="date" value={form.next_slot_due_date} onChange={e => set('next_slot_due_date', e.target.value)} className="text-xs h-9" />
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
            <Select value={form.payment_mode} onValueChange={v => set('payment_mode', v)}>
              <SelectTrigger><SelectValue placeholder="Select mode" /></SelectTrigger>
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
              value={form.final_payment_conditions}
              onChange={e => set('final_payment_conditions', e.target.value)}
              placeholder="Enter final payment conditions..."
              rows={3}
              className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          <div>
            <Label>Current agreed payment conditions</Label>
            <textarea
              value={form.current_agreed_payment_conditions}
              onChange={e => set('current_agreed_payment_conditions', e.target.value)}
              placeholder="Enter current agreed payment conditions..."
              rows={3}
              className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          <Button type="submit" className="w-full nb-gradient" disabled={mutation.isPending}>
            {mutation.isPending ? 'Processing...' : (lead?.lead_status === 'Closed' ? 'Save Closure Details' : 'Close Lead')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ClosureDialog;

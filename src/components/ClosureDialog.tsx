import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

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
  });

  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.plan || !form.payment_mode) throw new Error('Plan and Payment Mode are required');
      if (!form.movement.trim()) throw new Error('Comment is required');
      if (form.plan === 'Custom' && !form.custom_plan_note.trim()) throw new Error('Please describe your Custom Plan');
      if (!form.upfront_amount || parseFloat(form.upfront_amount) <= 0) throw new Error('Upfront Amount is required');
      if (!form.amount || parseFloat(form.amount) <= 0) throw new Error('On-Offer Amount is required');
      if (!form.percentage || parseFloat(form.percentage) <= 0) throw new Error('Percentage is required');

      // Update lead status to Closed
      await supabase.from('leads').update({ lead_status: 'Closed' as any }).eq('unique_id', lead.unique_id);

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
        upfront_amount: parseFloat(form.upfront_amount) || 0,
        amount: parseFloat(form.amount) || 0,
        percentage: parseFloat(form.percentage) || 0,
        slot1: form.slot1,
        slot1_amount: form.slot1 ? parseFloat(form.slot1_amount) || 0 : null,
        slot1_due_date: (form.slot1 && form.slot1_due_date) ? form.slot1_due_date : null,
        slot2: form.slot2,
        slot2_amount: form.slot2 ? parseFloat(form.slot2_amount) || 0 : null,
        next_slot_due_date: (form.slot2 && form.next_slot_due_date) ? form.next_slot_due_date : null,
        payment_mode: form.payment_mode as any,
      };

      // Try inserting with the new columns; fallback if columns don't exist yet
      const { error } = await supabase.from('lead_closures').insert(closurePayload);

      if (error) {
        // If the error is about unknown columns, retry with only the standard columns
        if (error.code === '42703' || error.message?.includes('column')) {
          const fallbackPayload: any = {
            lead_id: lead.unique_id,
            plan: form.plan as any,
            interview_plan: form.interview_plan,
            upfront_amount: parseFloat(form.upfront_amount) || 0,
            slot1: form.slot1,
            slot1_amount: form.slot1 ? parseFloat(form.slot1_amount) || 0 : null,
            slot2: form.slot2,
            slot2_amount: form.slot2 ? parseFloat(form.slot2_amount) || 0 : null,
            payment_mode: form.payment_mode as any,
          };
          const { error: fallbackErr } = await supabase.from('lead_closures').insert(fallbackPayload);
          if (fallbackErr) throw fallbackErr;

          // Store extended payment info in lead comment for durability
          const paymentDetails = `[Closure Payment] Amount: $${form.amount}, Percentage: ${form.percentage}%, Slot1 Due: ${form.slot1_due_date || 'N/A'}, Next Slot Due: ${form.next_slot_due_date || 'N/A'}`;
          await supabase.from('leads').update({ comment: paymentDetails } as any).eq('unique_id', lead.unique_id);
        } else {
          throw error;
        }
      }

      // Notify Admin, Sales TL, BD TL, Process Analyst about closure
      const { data: notifyRoles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['ADMIN', 'SALES_TL', 'LEAD_TL', 'PROCESS_ANALYST']);

      if (notifyRoles) {
        const notifications = notifyRoles.map(r => ({
          user_id: r.user_id,
          title: 'Lead Closed',
          message: `${lead.name} has been closed successfully.`,
          type: 'closure',
          lead_id: lead.unique_id,
        }));
        if (notifications.length > 0) {
          await supabase.from('notifications').insert(notifications);
        }
      }

      // Revenue notification for Admin + Sales TL
      const totalRevenue = (parseFloat(form.upfront_amount) || 0)
        + (form.slot1 ? (parseFloat(form.slot1_amount) || 0) : 0)
        + (form.slot2 ? (parseFloat(form.slot2_amount) || 0) : 0);

      if (totalRevenue > 0) {
        const { data: revenueRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .in('role', ['ADMIN', 'SALES_TL']);

        if (revenueRoles) {
          const revenueNotifs = revenueRoles.map(r => ({
            user_id: r.user_id,
            title: 'New Revenue Generated',
            message: `New revenue of $${totalRevenue.toFixed(2)} generated from ${lead.name}.`,
            type: 'revenue',
            lead_id: lead.unique_id,
          }));
          if (revenueNotifs.length > 0) {
            await supabase.from('notifications').insert(revenueNotifs);
          }
        }
      }
    },
    onSuccess: () => {
      toast.success('Lead closed successfully!');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="glass-card max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Close Lead — {lead?.name}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={e => { e.preventDefault(); mutation.mutate(); }} className="space-y-4 mt-4">
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
          <div className="flex items-center gap-2">
            <Checkbox checked={form.slot1} onCheckedChange={v => set('slot1', !!v)} id="s1" />
            <Label htmlFor="s1">Slot 1</Label>
          </div>
          {form.slot1 && (
            <div className="space-y-2 pl-6 border-l-2 border-primary/20">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input type="number" value={form.slot1_amount} onChange={e => set('slot1_amount', e.target.value)} placeholder="Slot 1 Amount" className="pl-7" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Due Date (auto-set to today)</Label>
                <Input type="date" value={form.slot1_due_date} onChange={e => set('slot1_due_date', e.target.value)} className="text-xs" />
              </div>
            </div>
          )}

          {/* Next Slot (Slot 2) */}
          <div className="flex items-center gap-2">
            <Checkbox checked={form.slot2} onCheckedChange={v => set('slot2', !!v)} id="s2" />
            <Label htmlFor="s2">Next Slot</Label>
          </div>
          {form.slot2 && (
            <div className="space-y-2 pl-6 border-l-2 border-primary/20">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input type="number" value={form.slot2_amount} onChange={e => set('slot2_amount', e.target.value)} placeholder="Next Slot Amount" className="pl-7" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Due Date</Label>
                <Input type="date" value={form.next_slot_due_date} onChange={e => set('next_slot_due_date', e.target.value)} className="text-xs" />
              </div>
            </div>
          )}

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
          <Button type="submit" className="w-full nb-gradient" disabled={mutation.isPending}>
            {mutation.isPending ? 'Processing...' : 'Close Lead'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ClosureDialog;

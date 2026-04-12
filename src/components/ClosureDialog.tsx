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

interface ClosureDialogProps {
  lead: any;
  open: boolean;
  onClose: () => void;
}

const ClosureDialog: React.FC<ClosureDialogProps> = ({ lead, open, onClose }) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    plan: '' as 'Starter' | 'Premium' | 'Elite' | '',
    interview_plan: false,
    upfront_amount: '',
    slot1: false,
    slot1_amount: '',
    slot2: false,
    slot2_amount: '',
    payment_mode: '' as 'Cash' | 'Card' | 'UPI' | 'Bank Transfer' | 'Other' | '',
  });

  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

  const mutation = useMutation({
    mutationFn: async () => {
      if (!form.plan || !form.payment_mode) throw new Error('Plan and Payment Mode are required');

      // Update lead status to Closed
      await supabase.from('leads').update({ lead_status: 'Closed' as any }).eq('unique_id', lead.unique_id);

      // Insert closure details
      const { error } = await supabase.from('lead_closures').insert({
        lead_id: lead.unique_id,
        plan: form.plan as any,
        interview_plan: form.interview_plan,
        upfront_amount: parseFloat(form.upfront_amount) || 0,
        slot1: form.slot1,
        slot1_amount: form.slot1 ? parseFloat(form.slot1_amount) || 0 : null,
        slot2: form.slot2,
        slot2_amount: form.slot2 ? parseFloat(form.slot2_amount) || 0 : null,
        payment_mode: form.payment_mode as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Lead closed successfully!');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="glass-card max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Close Lead — {lead.name}</DialogTitle>
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
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={form.interview_plan} onCheckedChange={v => set('interview_plan', !!v)} id="ip" />
            <Label htmlFor="ip">Interview Plan</Label>
          </div>
          <div>
            <Label>Upfront Amount</Label>
            <Input type="number" value={form.upfront_amount} onChange={e => set('upfront_amount', e.target.value)} placeholder="0.00" />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={form.slot1} onCheckedChange={v => set('slot1', !!v)} id="s1" />
            <Label htmlFor="s1">Slot 1</Label>
          </div>
          {form.slot1 && (
            <Input type="number" value={form.slot1_amount} onChange={e => set('slot1_amount', e.target.value)} placeholder="Slot 1 Amount" />
          )}
          <div className="flex items-center gap-2">
            <Checkbox checked={form.slot2} onCheckedChange={v => set('slot2', !!v)} id="s2" />
            <Label htmlFor="s2">Slot 2</Label>
          </div>
          {form.slot2 && (
            <Input type="number" value={form.slot2_amount} onChange={e => set('slot2_amount', e.target.value)} placeholder="Slot 2 Amount" />
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
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full nb-gradient" disabled={mutation.isPending}>
            {mutation.isPending ? 'Closing...' : 'Close Lead'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ClosureDialog;

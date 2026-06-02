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
import { Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CallActivityDialogProps {
  lead: any;
  open: boolean;
  onClose: () => void;
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
  'Closed':       [],
  'Non Interested': [],
};

const CallActivityDialog: React.FC<CallActivityDialogProps> = ({ lead, open, onClose }) => {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();

  const currentStatus = lead.lead_status || 'New';
  const nextStatuses = role === 'ADMIN'
    ? ['New', 'DNR1', 'DNR2', 'DNR3', 'Connected', 'Qualified', 'Hot Prospect', 'Closed', 'Non Interested']
    : (STATUS_FLOW[currentStatus] || []);

  const [notes, setNotes] = useState('');
  const [wayOfContact, setWayOfContact] = useState('Call');
  const [newStatus, setNewStatus] = useState(nextStatuses[0] || currentStatus);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!notes.trim()) throw new Error('Follow-up notes are required');

      const today = new Date().toISOString().split('T')[0];

      // 1. Log the call
      const { data: existing } = await supabase
        .from('call_logs')
        .select('*')
        .eq('user_id', user!.id)
        .eq('lead_id', lead.unique_id)
        .eq('call_date', today)
        .maybeSingle();

      if (existing) {
        await supabase.from('call_logs')
          .update({ call_count: (existing.call_count || 0) + 1 })
          .eq('id', existing.id);
      } else {
        await supabase.from('call_logs').insert({
          user_id: user!.id,
          lead_id: lead.unique_id,
          call_date: today,
          call_count: 1,
        });
      }

      // 2. Insert follow-up record
      await supabase.from('followups').insert({
        lead_id: lead.unique_id,
        user_id: user!.id,
        notes: notes.trim(),
        way_of_contact: wayOfContact,
      });

      // 3. Update lead status if changed
      if (newStatus && newStatus !== currentStatus) {
        await supabase.from('leads')
          .update({ lead_status: newStatus as any })
          .eq('unique_id', lead.unique_id);

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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-calls'] });
      queryClient.invalidateQueries({ queryKey: ['call-logs'] });
      queryClient.invalidateQueries({ queryKey: ['sm-leads'] });
      queryClient.invalidateQueries({ queryKey: ['salestl-leads'] });
      queryClient.invalidateQueries({ queryKey: ['followups', lead.unique_id] });

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

      toast.success(`Call logged! Next follow-up: ${nextDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`);
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
      <DialogContent className="glass-card max-w-md">
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

          {nextStatuses.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground">
                Update Status <span className="text-muted-foreground/60">(current: {currentStatus})</span>
              </Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
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

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1 nb-gradient" disabled={mutation.isPending}>
              {mutation.isPending ? 'Logging...' : 'Log Call & Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CallActivityDialog;

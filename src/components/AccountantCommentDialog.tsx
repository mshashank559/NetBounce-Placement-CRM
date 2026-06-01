import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { FileText } from 'lucide-react';

interface AccountantCommentDialogProps {
  lead: any;
  open: boolean;
  onClose: () => void;
}

const AccountantCommentDialog: React.FC<AccountantCommentDialogProps> = ({ lead, open, onClose }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [documentDetails, setDocumentDetails] = useState('');
  const [documentType, setDocumentType] = useState<'Pre-Performa' | 'Post-Performa'>('Pre-Performa');

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('You must be logged in to submit documents.');
      if (!documentDetails.trim()) throw new Error('Remarks/comments are required.');

      const docRef = 'DOC-' + Math.random().toString(36).substr(2, 9).toUpperCase();

      // 1. Insert record in performas table
      const { error: docError } = await supabase.from('performas').insert({
        lead_id: lead.unique_id,
        sent_by: user.id,
        type: documentType,
        document_url: docRef,
        notes: JSON.stringify({
          status: 'Sent',
          sla: 'Pending',
          sent_at: new Date().toISOString(),
          docRefId: docRef,
          comment: documentDetails.trim()
        })
      });

      if (docError) throw docError;

      // 2. Notify Accountants
      const { data: targets } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'ACCOUNTANT');

      if (targets && targets.length > 0) {
        const { error: notifError } = await supabase.from('notifications').insert(
          targets.map(t => ({
            user_id: t.user_id,
            title: '📄 New Document Submitted',
            message: `Lead "${lead.name}" submitted a new ${documentType}. Remark: "${documentDetails.trim()}"`,
            type: 'accountant_update',
            lead_id: lead.unique_id,
          }))
        );
        if (notifError) throw notifError;
      }
    },
    onSuccess: () => {
      toast.success('Document submitted successfully!');
      queryClient.invalidateQueries({ queryKey: ['all-performas'] });
      queryClient.invalidateQueries({ queryKey: ['lead-performas', lead.unique_id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['sm-leads'] });
      queryClient.invalidateQueries({ queryKey: ['all-leads-accountant'] });
      queryClient.invalidateQueries({ queryKey: ['account-closures'] });
      setDocumentDetails('');
      setDocumentType('Pre-Performa');
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="glass-card max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Add Document — {lead?.name}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={e => { e.preventDefault(); mutation.mutate(); }}
          className="space-y-4 mt-2"
        >
          <div>
            <Label className="text-xs text-muted-foreground">Document Type *</Label>
            <Select value={documentType} onValueChange={(v: any) => setDocumentType(v)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pre-Performa">Pre-Performa</SelectItem>
                <SelectItem value="Post-Performa">Post-Performa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Comments / Remarks *</Label>
            <Textarea
              value={documentDetails}
              onChange={e => setDocumentDetails(e.target.value)}
              placeholder="Enter remarks about the document..."
              className="mt-1 min-h-[100px]"
              required
            />
          </div>

          <DialogFooter className="pt-2">
            <div className="flex gap-2 w-full">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" className="flex-1 nb-gradient" disabled={mutation.isPending}>
                {mutation.isPending ? 'Submitting...' : 'Submit'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AccountantCommentDialog;

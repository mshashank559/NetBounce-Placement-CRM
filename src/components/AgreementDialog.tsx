import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FileSignature, Send } from 'lucide-react';

interface AgreementDialogProps {
  lead: any;
  open: boolean;
  onClose: () => void;
}

export default function AgreementDialog({ lead, open, onClose }: AgreementDialogProps) {
  const queryClient = useQueryClient();
  const agreementStatus = lead?.agreement_status || 'Not Started';

  const reviewDocMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('leads').update({ 
        agreement_status: 'Review Doc Sent',
        agreement_sent_at: new Date().toISOString()
      }).eq('unique_id', lead.unique_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Review document sent successfully!');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const finalMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('leads').update({ 
        agreement_status: 'Final Agreement Sent'
      }).eq('unique_id', lead.unique_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Final agreement sent to candidate!');
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="glass-card max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" /> 
            Agreement Workflow
          </DialogTitle>
          <DialogDescription>
            Manage the review and final agreement documents for {lead?.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {agreementStatus === 'Not Started' ? (
            <div className="space-y-4">
              <div className="p-4 bg-accent/10 border border-accent/20 rounded-lg text-sm text-center">
                <p className="mb-4">Send the initial draft agreement to the candidate for their review.</p>
                <Button 
                  onClick={() => reviewDocMutation.mutate()} 
                  className="w-full nb-gradient" 
                  disabled={reviewDocMutation.isPending}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {reviewDocMutation.isPending ? 'Sending...' : 'Send Review Doc'}
                </Button>
              </div>
            </div>
          ) : agreementStatus === 'Review Doc Sent' ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-center mb-4 text-green-500 font-medium">
                ✓ Review Document Sent
              </div>
              <div className="p-4 bg-accent/10 border border-accent/20 rounded-lg text-sm text-center">
                <p className="mb-4">Once the candidate approves the draft, send the final agreement.</p>
                <Button 
                  onClick={() => finalMutation.mutate()} 
                  className="w-full nb-gradient" 
                  disabled={finalMutation.isPending}
                >
                  <FileSignature className="h-4 w-4 mr-2" />
                  {finalMutation.isPending ? 'Sending...' : 'Send Final Agreement'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-center text-green-500 font-medium">
                ✓ Final Agreement Sent
              </div>
              <p className="text-sm text-center text-muted-foreground mt-4">
                The agreement workflow for this lead is complete. The Account Person will handle Performas and payments.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

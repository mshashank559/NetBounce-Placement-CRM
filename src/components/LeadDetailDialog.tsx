import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { History, CalendarDays, FileText, Info, MessageSquare, CheckCircle2, Phone } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface LeadDetailDialogProps {
  lead: any;
  open: boolean;
  onClose: () => void;
}

const LeadDetailDialog: React.FC<LeadDetailDialogProps> = ({ lead, open, onClose }) => {
  const { role } = useAuth();

  const { data: followups } = useQuery({
    queryKey: ['followups', lead.unique_id],
    queryFn: async () => {
      const { data } = await supabase.from('followups').select('*').eq('lead_id', lead.unique_id).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: open,
  });

  const { data: closure } = useQuery({
    queryKey: ['closure', lead.unique_id],
    queryFn: async () => {
      const { data } = await supabase.from('lead_closures').select('*').eq('lead_id', lead.unique_id).maybeSingle();
      return data;
    },
    enabled: open && lead.lead_status === 'Closed',
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
      const { data } = await supabase.from('profiles').select('user_id, full_name');
      return data || [];
    },
    enabled: open,
  });

  // Status history from logs table
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

        <Tabs defaultValue="general" className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-4 bg-background/50 border border-accent/20 p-1 rounded-lg">
            <TabsTrigger value="general" className="text-xs font-medium flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" /> Info
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs font-medium flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" /> Status History ({statusHistory?.length || 0})
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
              <Field label="Source" value={lead.lead_source} />
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
                <p className="text-sm mt-1 text-foreground leading-relaxed">{lead.comment}</p>
              </div>
            )}

            {closure && (
              <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                <h4 className="text-sm font-semibold mb-3 text-green-600 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Closure Details
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Field label="Plan" value={closure.plan} />
                  <Field label="Interview Plan" value={closure.interview_plan ? 'Yes' : 'No'} />
                  <Field label="Upfront Amount" value={`$${closure.upfront_amount}`} />
                  <Field label="Payment Mode" value={closure.payment_mode} />
                  {closure.amount != null && <Field label="On-Offer Amount" value={`$${closure.amount}`} />}
                  {closure.percentage != null && <Field label="Percentage" value={`${closure.percentage}%`} />}
                  {closure.slot1 && <Field label="Slot 1 Amount" value={`$${closure.slot1_amount}`} />}
                  {closure.slot1_due_date && <Field label="Slot 1 Due Date" value={new Date(closure.slot1_due_date).toLocaleDateString()} />}
                  {closure.slot2 && <Field label="Next Slot Amount" value={`$${closure.slot2_amount}`} />}
                  {closure.next_slot_due_date && <Field label="Next Slot Due Date" value={new Date(closure.next_slot_due_date).toLocaleDateString()} />}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Tab 2: Status History logs */}
          <TabsContent value="history" className="mt-4 outline-none">
            {statusHistory && statusHistory.length > 0 ? (
              <div className="relative border-l border-accent/30 pl-4 space-y-5 py-2 max-h-[50vh] overflow-y-auto pr-1">
                {statusHistory.map((log) => {
                  const author = profiles.find(p => p.user_id === log.changed_by)?.full_name || 'System';
                  return (
                    <div key={log.id} className="relative">
                      {/* Timeline Dot */}
                      <span className="absolute -left-[21px] top-1 h-3.5 w-3.5 rounded-full border-2 border-primary bg-background shadow-sm" />
                      
                      <div className="bg-background/40 p-3 rounded-lg border border-accent/10">
                        <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground/80">{author}</span>
                            <span className="text-xs text-muted-foreground">changed status</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                        </div>

                        <div className="flex items-center gap-2 text-xs font-semibold mt-1">
                          <span className="text-muted-foreground">{log.old_value || 'None'}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="text-primary font-bold">{log.new_value}</span>
                        </div>

                        {log.comments && (
                          <p className="mt-2 text-sm text-foreground/90 bg-accent/20 p-2 rounded leading-relaxed border-l-2 border-primary/50">
                            {log.comments}
                          </p>
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
                          <span className="text-[11px] text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
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
                          <span className="text-xs text-muted-foreground">{new Date(doc.created_at).toLocaleString()}</span>
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

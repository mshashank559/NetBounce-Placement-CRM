import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { User, Activity, Clock, FileText } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  leadId: string | null;
}

export default function LeadHistorySidebar({ open, onClose, leadId }: Props) {
  const { role } = useAuth();
  
  const canView = ['ADMIN', 'PROCESS_ANALYST', 'LEAD_TL', 'SALES_TL'].includes(role || '');

  const { data: historyLogs, isLoading } = useQuery({
    queryKey: ['lead_history', leadId],
    queryFn: async () => {
      if (!leadId || !canView) return [];
      
      const { data, error } = await supabase
        .from('lead_history_logs')
        .select(`
          *,
          profiles:changed_by (full_name)
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return data;
    },
    enabled: !!leadId && open && canView
  });

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-md bg-card/95 backdrop-blur border-l-accent/20">
        <SheetHeader className="mb-6">
          <SheetTitle className="font-display flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" /> Lead History & Audit
          </SheetTitle>
          <SheetDescription>
            Comprehensive audit trail for this lead.
          </SheetDescription>
        </SheetHeader>
        
        {!canView ? (
          <div className="text-center p-8 text-muted-foreground bg-accent/5 rounded-lg">
            You do not have permission to view the audit trail.
          </div>
        ) : isLoading ? (
          <div className="text-center p-8 text-muted-foreground">Loading history...</div>
        ) : !historyLogs || historyLogs.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground bg-accent/5 rounded-lg border border-border/50">
            No history logs found for this lead.
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-140px)] pr-4">
            <div className="space-y-6">
              {historyLogs.map((log: any, idx) => (
                <div key={log.id} className="relative pl-6 pb-6 border-l border-border last:border-0 last:pb-0">
                  <div className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                  <div className="bg-accent/5 border border-border/50 rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <User className="h-3 w-3 text-muted-foreground" />
                        {log.profiles?.full_name || 'System'}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    
                    <div className="text-sm font-semibold text-primary mb-1">
                      {log.action_type.replace(/_/g, ' ')}
                    </div>
                    
                    {log.old_value && log.new_value && (
                      <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
                        <span className="line-through opacity-70">{log.old_value}</span>
                        <span>→</span>
                        <span className="text-foreground">{log.new_value}</span>
                      </div>
                    )}
                    
                    {log.comments && (
                      <div className="text-sm text-foreground/80 bg-background/50 p-2 rounded flex items-start gap-2">
                        <FileText className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <p>{log.comments}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}

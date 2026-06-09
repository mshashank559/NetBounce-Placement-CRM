import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Clock, Eye } from 'lucide-react';
import { toast } from 'sonner';
import LeadDetailDialog from '@/components/LeadDetailDialog';

const DNRFollowupsPage: React.FC = () => {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const PAGE_SIZE = 50;

  const { data: leads, isLoading } = useQuery({
    queryKey: ['dnr-leads'],
    queryFn: async () => {
      const { data } = await supabase
        .from('leads')
        .select('*')
        .in('lead_status', ['New', 'DNR1', 'DNR2', 'DNR3', 'Connected', 'Qualified', 'Hot Prospect', 'Non Interested'])
        .order('updated_at', { ascending: false });

      const getStatusThreshold = (status: string): number | null => {
        switch (status) {
          case 'New': return 5;
          case 'DNR1': return 20;
          case 'DNR2': return 15;
          case 'DNR3': return 10;
          case 'Connected': return 30;
          case 'Qualified': return 60;
          case 'Hot Prospect': return 90;
          case 'Non Interested':
            return 2;
          default: return null;
        }
      };

      const now = new Date();
      const filteredLeads = (data || []).filter(lead => {
        const threshold = getStatusThreshold(lead.lead_status);
        if (threshold === null) return false;
        
        const updatedDate = new Date(lead.updated_at);
        const start = new Date(updatedDate.getFullYear(), updatedDate.getMonth(), updatedDate.getDate());
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const diffTime = end.getTime() - start.getTime();
        const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        return days === threshold;
      });

      return filteredLeads;
    },
    enabled: !!user,
  });

  const { data: profilesMap } = useQuery({
    queryKey: ['profiles-map-dnr'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name, email');
      const map: Record<string, { full_name: string; email: string }> = {};
      data?.forEach(p => { map[p.user_id] = { full_name: p.full_name, email: p.email }; });
      return map;
    },
    enabled: !!user,
  });

  const markDoneMutation = useMutation({
    mutationFn: async (lead: any) => {
      const { error } = await supabase.from('leads').update({
        dnr_followup_done: true,
        dnr_followup_done_at: new Date().toISOString(),
        dnr_followup_done_by: user!.id,
      }).eq('unique_id', lead.unique_id);
      if (error) throw error;

      // Determine who to notify based on the role of the person marking done
      let notifyRoles: any[] = [];
      if (role === 'SALES_TM' || role === 'SALES_TL') {
        notifyRoles = ['SALES_TL', 'ADMIN', 'PROCESS_ANALYST'];
      } else if (role === 'LEAD_GEN') {
        notifyRoles = ['LEAD_TL', 'ADMIN', 'PROCESS_ANALYST'];
      }

      if (notifyRoles.length > 0) {
        const { data: targets } = await supabase
          .from('user_roles')
          .select('user_id')
          .in('role', notifyRoles);

        if (targets && targets.length > 0) {
          await supabase.from('notifications').insert(
            targets.map(t => ({
              user_id: t.user_id,
              title: '✅ DNR Follow-up Done',
              message: `DNR follow-up for lead "${lead.name}" has been successfully completed.`,
              type: 'dnr_done',
              lead_id: lead.unique_id,
            }))
          );
        }
      }
    },
    onSuccess: () => {
      toast.success('DNR follow-up marked as done!');
      queryClient.invalidateQueries({ queryKey: ['dnr-leads'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Filter based on role
  const filtered = leads?.filter(l => {
    if (role === 'LEAD_GEN') return l.lead_generated_by === user?.id;
    if (role === 'SALES_TM') return l.assigned_to === user?.id;
    return true; // ADMIN, PROCESS_ANALYST, TLs see all
  }) || [];

  useEffect(() => {
    setPage(1);
  }, [filtered.length]);

  const totalCount = filtered.length;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;
  const paginatedLeads = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Can the current user mark follow-up as done?
  const canMark = (lead: any) => {
    if ((lead as any).dnr_followup_done) return false;
    if (role === 'SALES_TM') return lead.assigned_to === user?.id;
    if (role === 'LEAD_GEN') return lead.lead_generated_by === user?.id;
    return false;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-orange-500" />
        <h1 className="text-2xl font-display font-bold">DNR Follow-ups</h1>
      </div>

      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {filtered.length} lead(s) require follow-up · {filtered.filter(l => (l as any).dnr_followup_done).length} completed
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No DNR leads</div>
          ) : (
            <div>
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 font-medium text-muted-foreground">ID</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Email</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Phone</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Generated By</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Last Updated</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Follow-up Status</th>
                    {(role === 'SALES_TM' || role === 'LEAD_GEN') && (
                      <th className="text-left p-3 font-medium text-muted-foreground">Action</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {paginatedLeads.map((lead, i) => {
                    const gen = lead.lead_generated_by && profilesMap?.[lead.lead_generated_by];
                    const done = (lead as any).dnr_followup_done;
                    const doneBy = (lead as any).dnr_followup_done_by && profilesMap?.[(lead as any).dnr_followup_done_by];
                    const doneAt = (lead as any).dnr_followup_done_at;
                    return (
                      <motion.tr
                        key={lead.unique_id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className={`border-b border-border/50 hover:bg-accent/30 transition-colors ${done ? 'bg-green-500/5' : ''}`}
                      >
                        <td className="p-3 text-xs font-mono text-muted-foreground">{(lead as any).display_id || '—'}</td>
                        <td className="p-3 font-medium">{lead.name}</td>
                        <td className="p-3 text-muted-foreground">{lead.email}</td>
                        <td className="p-3 text-muted-foreground">{lead.phone}</td>
                        <td className="p-3">
                          <Badge variant="secondary" className="bg-orange-500/10 text-orange-600">{lead.lead_status}</Badge>
                        </td>
                        <td className="p-3 text-xs">
                          {gen ? gen.full_name : '—'}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {new Date(lead.updated_at).toLocaleDateString()}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div>
                              {done ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Follow-up Done
                                  </span>
                                  {doneBy && (
                                    <span className="text-xs text-muted-foreground">
                                      by {doneBy.full_name}
                                      {doneAt && ` · ${new Date(doneAt).toLocaleDateString()}`}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="flex items-center gap-1 text-xs text-orange-500">
                                  <Clock className="h-3.5 w-3.5" />
                                  Pending
                                </span>
                              )}
                            </div>
                            <button
                              title="View Details & Comments"
                              onClick={() => setSelectedLead(lead)}
                              className="ml-1 text-muted-foreground hover:text-primary transition-colors"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                        {(role === 'SALES_TM' || role === 'LEAD_GEN') && (
                          <td className="p-3">
                            {canMark(lead) ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs border-green-500/40 text-green-600 hover:bg-green-500/10"
                                disabled={markDoneMutation.isPending}
                                onClick={() => markDoneMutation.mutate(lead)}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                Mark Done
                              </Button>
                            ) : done ? (
                              <span className="text-xs text-green-600 font-medium">✓ Done</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        )}
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Pagination Controls */}
            {totalCount > 0 && (
              <div className="flex justify-between items-center p-4 border-t border-border flex-wrap gap-2">
                <span className="text-xs text-muted-foreground">
                  Showing {Math.min(totalCount, (page - 1) * PAGE_SIZE + 1)} to {Math.min(totalCount, page * PAGE_SIZE)} of {totalCount} leads
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-xs font-medium">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page * PAGE_SIZE >= totalCount}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedLead && (
        <LeadDetailDialog
          lead={selectedLead}
          open={!!selectedLead}
          onClose={() => setSelectedLead(null)}
        />
      )}
    </div>
  );
};

export default DNRFollowupsPage;

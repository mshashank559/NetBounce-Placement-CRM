import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, TrendingUp, Calendar, Lock, Pencil, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import ClosureDialog from '@/components/ClosureDialog';

const formatDate = (dateString?: string) => {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const RevenuePage: React.FC = () => {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState(String(currentYear));
  const [activeView, setActiveView] = useState<'my_view' | 'team_view' | 'restricted_view'>('my_view');

  React.useEffect(() => {
    if (role === 'ADMIN' || role === 'ACCOUNTANT') {
      setActiveView('restricted_view');
    } else {
      setActiveView('my_view');
    }
  }, [role]);
  
  // Data Grid Pagination and Dialog states
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const [editingLead, setEditingLead] = useState<any>(null);
  const [deletingClosureId, setDeletingClosureId] = useState<string | null>(null);

  const isTLOrHigher = role === 'ADMIN' || role === 'ACCOUNTANT' || role === 'SALES_TL' || role === 'LEAD_TL';

  const { data: closures, isLoading } = useQuery<any[]>({
    queryKey: ['revenue-closures', user?.id, role, activeView],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_revenue_closures_v2', { view_type: activeView });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (closureId: string) => {
      // 1. Fetch the closure to get the lead_id
      const { data: closureData, error: fetchErr } = await supabase
        .from('lead_closures')
        .select('lead_id')
        .eq('id', closureId)
        .single();
      if (fetchErr) throw fetchErr;

      const leadId = closureData.lead_id;

      // 2. Delete the lead closure
      const { error: deleteErr } = await supabase
        .from('lead_closures')
        .delete()
        .eq('id', closureId);
      if (deleteErr) throw deleteErr;

      // 3. Reset the lead's status to 'Qualified'
      const { error: updateErr } = await supabase
        .from('leads')
        .update({ lead_status: 'Qualified' as any })
        .eq('unique_id', leadId);
      if (updateErr) throw updateErr;

      // 4. Log history
      await supabase.from('lead_history_logs').insert({
        lead_id: leadId,
        changed_by: user!.id,
        action_type: 'STATUS_CHANGE',
        old_value: 'Closed',
        new_value: 'Qualified',
        comments: 'Closure deleted and lead status reset to Qualified.'
      });
    },
    onSuccess: () => {
      toast.success('Closure deleted and lead status reset to Qualified');
      queryClient.invalidateQueries({ queryKey: ['revenue-closures'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['all-leads-admin'] });
      setDeletingClosureId(null);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete closure');
    }
  });

  const calcRevenue = (closure: any) => {
    const s1 = closure.slot1 ? (Number(closure.slot1_amount) || 0) : 0;
    const s2 = closure.slot2 ? (Number(closure.slot2_amount) || 0) : 0;
    let additional = 0;
    if (Array.isArray(closure.additional_slots)) {
      closure.additional_slots.forEach((slot: any) => {
        if (slot.paid === true) {
          additional += Number(slot.amount) || 0;
        }
      });
    }
    return s1 + s2 + additional;
  };

  const monthlyRevenue = useMemo(() => {
    if (!closures) return [];
    const months: Record<string, number> = {};
    closures.forEach(c => {
      const d = new Date(c.created_at);
      if (d.getFullYear() !== parseInt(yearFilter)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const amount = calcRevenue(c);
      months[key] = (months[key] || 0) + amount;
    });

    const result = [];
    for (let m = 1; m <= 12; m++) {
      const key = `${yearFilter}-${String(m).padStart(2, '0')}`;
      const date = new Date(parseInt(yearFilter), m - 1);
      result.push({
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        revenue: months[key] || 0,
      });
    }
    return result;
  }, [closures, yearFilter]);

  const totalYearRevenue = monthlyRevenue.reduce((s, m) => s + m.revenue, 0);
  const currentMonthKey = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const currentMonthRevenue = closures?.reduce((s, c) => {
    const d = new Date(c.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (key !== currentMonthKey) return s;
    return s + calcRevenue(c);
  }, 0) || 0;

  // Authorization check for the page
  if (role !== 'ADMIN' && role !== 'SALES_TL' && role !== 'ACCOUNTANT') {
    return <div className="text-center text-muted-foreground p-8">Access denied</div>;
  }

  // Filter closures specifically for pagination in the data table
  const paginatedClosures = closures ? closures.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : [];

  const handleEditClick = (c: any) => {
    setEditingLead({
      unique_id: c.lead_id,
      name: c.candidate_name,
      email: c.candidate_email || '',
      lead_status: 'Closed',
      assigned_to: c.assigned_to
    });
  };

  const handleDeleteClick = (c: any) => {
    setDeletingClosureId(c.id);
  };

  const canModify = (c: any) => {
    if (role === 'ADMIN' || role === 'ACCOUNTANT') return true;
    return c.assigned_to === user?.id || c.lead_generated_by === user?.id;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header and Switchable Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-background/50 backdrop-blur-xl p-4 rounded-2xl border border-primary/10 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <h1 className="text-2xl font-display font-bold">Revenue</h1>
          {role !== 'ADMIN' && role !== 'ACCOUNTANT' && (
            <Tabs value={activeView} onValueChange={(v) => { setActiveView(v as any); setPage(1); }} className="w-[360px]">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="my_view" className="text-xs">My View</TabsTrigger>
                <TabsTrigger value="team_view" className="text-xs" disabled={!isTLOrHigher}>My Team View</TabsTrigger>
                <TabsTrigger value="restricted_view" className="text-xs">Restricted View</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[currentYear, currentYear - 1, currentYear - 2].map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass-card nb-glow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Revenue</CardTitle>
              <Calendar className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold">
                {activeView === 'restricted_view' && !(role === 'ADMIN' || role === 'ACCOUNTANT') ? (
                  <span className="flex items-center gap-1.5 text-xl text-muted-foreground">
                    <Lock className="h-4 w-4 text-amber-500" /> Masked
                  </span>
                ) : (
                  `$${currentMonthRevenue.toLocaleString()}`
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Current month</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Yearly Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold">
                {activeView === 'restricted_view' && !(role === 'ADMIN' || role === 'ACCOUNTANT') ? (
                  <span className="flex items-center gap-1.5 text-xl text-muted-foreground">
                    <Lock className="h-4 w-4 text-amber-500" /> Masked
                  </span>
                ) : (
                  `$${totalYearRevenue.toLocaleString()}`
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{yearFilter}</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Monthly Revenue Breakdown Chart */}
      {!(activeView === 'restricted_view' && !(role === 'ADMIN' || role === 'ACCOUNTANT')) && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg font-display">Monthly Revenue Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `$${v}`} />
                  <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, 'Revenue']} />
                  <Bar dataKey="revenue" fill="hsl(222, 100%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Detailed Closures Data Grid */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg font-display">Closed Lead Transactions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Candidate Name</TableHead>
                    <TableHead className="text-xs">Sales Person</TableHead>
                    <TableHead className="text-xs">Date of Payment</TableHead>
                    <TableHead className="text-xs">Upfront Amount</TableHead>
                    <TableHead className="text-xs">Slot 1 Amount</TableHead>
                    <TableHead className="text-xs">Slot 2 Amount</TableHead>
                    <TableHead className="text-xs">Plan Details</TableHead>
                    <TableHead className="text-xs">Job Guarantee</TableHead>
                    <TableHead className="text-xs">Lead Source</TableHead>
                    <TableHead className="text-xs">Payment Mode</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Loading transactions...</TableCell>
                    </TableRow>
                  ) : paginatedClosures.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">No transactions found</TableCell>
                    </TableRow>
                  ) : (
                    paginatedClosures.map((c) => {
                      const isMasked = c.plan === null; // RPC returns null if record is masked
                      return (
                        <TableRow key={c.id} className="hover:bg-accent/20 border-border/50">
                          <TableCell className="text-xs font-medium">{c.candidate_name}</TableCell>
                          <TableCell className="text-xs">{c.sales_person_name || 'System'}</TableCell>
                          <TableCell className="text-xs">{formatDate(c.created_at)}</TableCell>
                          
                          {/* Upfront Amount */}
                          <TableCell className="text-xs">
                            {isMasked ? (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Lock className="h-3 w-3 text-amber-500" /> Masked
                              </span>
                            ) : (
                              `$${Number(c.upfront_amount).toLocaleString()}`
                            )}
                          </TableCell>

                          {/* Slot 1 Amount */}
                          <TableCell className="text-xs">
                            {isMasked ? (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Lock className="h-3 w-3 text-amber-500" /> Masked
                              </span>
                            ) : (
                              c.slot1_amount ? `$${Number(c.slot1_amount).toLocaleString()}` : '—'
                            )}
                          </TableCell>

                          {/* Slot 2 Amount */}
                          <TableCell className="text-xs">
                            {isMasked ? (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Lock className="h-3 w-3 text-amber-500" /> Masked
                              </span>
                            ) : (
                              c.slot2_amount ? `$${Number(c.slot2_amount).toLocaleString()}` : '—'
                            )}
                          </TableCell>

                          {/* Plan Details */}
                          <TableCell className="text-xs">
                            {isMasked ? (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Lock className="h-3 w-3 text-amber-500" /> Masked
                              </span>
                            ) : (
                              <Badge variant="outline">{c.plan}</Badge>
                            )}
                          </TableCell>

                          {/* Job Guarantee */}
                          <TableCell className="text-xs">
                            {c.interview_plan ? (
                              <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20 flex items-center gap-1 w-fit">
                                <CheckCircle2 className="h-3 w-3" /> Yes
                              </Badge>
                            ) : (
                              <Badge className="bg-slate-500/10 text-slate-500 hover:bg-slate-500/20 border-slate-500/20 flex items-center gap-1 w-fit">
                                <XCircle className="h-3 w-3" /> No
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell className="text-xs">{c.lead_source || '—'}</TableCell>
                          <TableCell className="text-xs">{c.payment_mode}</TableCell>
                          
                          {/* Actions */}
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1.5">
                              {canModify(c) ? (
                                <>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10" onClick={() => handleEditClick(c)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-500/10" onClick={() => handleDeleteClick(c)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              ) : (
                                <span className="text-[10px] text-muted-foreground italic px-2 select-none">ReadOnly</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          
          {/* Pagination Controls */}
          {closures && closures.length > PAGE_SIZE && (
            <div className="flex justify-between items-center p-4 border-t border-border flex-wrap gap-2 bg-accent/5">
              <span className="text-xs text-muted-foreground">
                Showing {Math.min(closures.length, (page - 1) * PAGE_SIZE + 1)} to {Math.min(closures.length, page * PAGE_SIZE)} of {closures.length} transactions
              </span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                  Previous
                </Button>
                <span className="text-xs font-medium">Page {page} of {Math.ceil(closures.length / PAGE_SIZE)}</span>
                <Button size="sm" variant="outline" disabled={page * PAGE_SIZE >= closures.length} onClick={() => setPage(p => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Edit Closure Dialog */}
      {editingLead && (
        <ClosureDialog
          lead={editingLead}
          open={!!editingLead}
          onClose={() => {
            setEditingLead(null);
            queryClient.invalidateQueries({ queryKey: ['revenue-closures'] });
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deletingClosureId !== null} onOpenChange={() => setDeletingClosureId(null)}>
        <DialogContent className="glass-card max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Transaction Closure</DialogTitle>
            <DialogDescription className="text-xs mt-2">
              Are you sure you want to delete this lead closure? Doing so will permanently remove this financial record and revert the candidate's status to <strong>Qualified</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button size="sm" variant="outline" onClick={() => setDeletingClosureId(null)}>Cancel</Button>
            <Button size="sm" variant="destructive" onClick={() => deletingClosureId && deleteMutation.mutate(deletingClosureId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RevenuePage;

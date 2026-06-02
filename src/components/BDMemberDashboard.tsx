import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Users, Plus, CheckCircle, UserPlus, AlertTriangle, CheckCircle2, Clock, Eye } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LeadDetailDialog from './LeadDetailDialog';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const BDMemberDashboard: React.FC = () => {
  const { user, profile, role } = useAuth();
  const queryClient = useQueryClient();

  // ── Filters ────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'personal' | 'global'>('personal');
  const [detailsLead, setDetailsLead] = useState<any>(null);
  const [monthFilter, setMonthFilter] = useState(() => String(new Date().getMonth() + 1));
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [nameSearch, setNameSearch] = useState('');

  // ── Concern Dialog State ─────────────────────────────────
  const [concernLead, setConcernLead] = useState<any>(null);
  const [concernText, setConcernText] = useState('');
  const [concernRecipient, setConcernRecipient] = useState('');

  // ── Fetch leads ──────────────────────────────────
  const { data: myLeads = [], isLoading } = useQuery({
    queryKey: ['bd-member-leads', user?.id, viewMode],
    queryFn: async () => {
      let query = supabase.from('leads').select('*');
      if (viewMode === 'personal') {
        query = query.eq('lead_generated_by', user!.id);
      }
      const { data } = await query.order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  // ── Fetch profile names for "Assigned To" ───────────────
  const { data: profiles = [] } = useQuery({
    queryKey: ['all-profiles-bd'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name');
      return data || [];
    },
  });

  // ── Apply Filters ────────────────────────────────────────
  const filteredLeads = useMemo(() => {
    return myLeads.filter(l => {
      const d = new Date(l.created_at);
      if (monthFilter !== 'all' && d.getMonth() + 1 !== parseInt(monthFilter)) return false;
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false;
      if (nameSearch && !l.name.toLowerCase().includes(nameSearch.toLowerCase())) return false;
      return true;
    });
  }, [myLeads, monthFilter, dateFrom, dateTo, nameSearch]);

  // ── KPI Calculations ─────────────────────────────────────
  const today = new Date().toISOString().split('T')[0];
  const totalLeads = filteredLeads.length;
  const newToday = myLeads.filter(l => l.created_at.startsWith(today)).length;
  const assignedLeads = filteredLeads.filter(l => l.assigned_to !== null).length;
  const closures = filteredLeads.filter(l => l.lead_status === 'Closed').length;

  // ── Chart Data ───────────────────────────────────────────
  const chartData = useMemo(() => {
    const dailyMap: Record<string, number> = {};
    const sourceMap: Record<string, number> = {};
    let hot = 0, cold = 0;

    filteredLeads.forEach(l => {
      const date = l.created_at.split('T')[0];
      dailyMap[date] = (dailyMap[date] || 0) + 1;
      const src = l.lead_source || 'Unknown';
      sourceMap[src] = (sourceMap[src] || 0) + 1;
      if (l.lead_category === 'Hot') hot++;
      if (l.lead_category === 'Cold') cold++;
    });

    const dailyTrend = Object.keys(dailyMap).sort().slice(-14).map(date => ({
      date: date.slice(5), count: dailyMap[date]
    }));
    const sourceBreakdown = Object.keys(sourceMap).map(src => ({ name: src, value: sourceMap[src] }));
    const categoryData = [{ name: 'Hot', value: hot }, { name: 'Cold', value: cold }];

    return { dailyTrend, sourceBreakdown, categoryData };
  }, [filteredLeads]);

  // ── Raise Concern ────────────────────────────────────────
  const raiseConcernMutation = useMutation({
    mutationFn: async ({ leadId, recipientId, comment }: { leadId: string; recipientId: string; comment: string }) => {
      if (!comment.trim()) throw new Error('Please enter a comment');
      if (!recipientId) throw new Error('Please select a recipient');

      const lead = myLeads.find(l => l.unique_id === leadId);

      // Mark lead as concern
      const { error: updateErr } = await supabase.from('leads').update({ concern: true }).eq('unique_id', leadId);
      if (updateErr) throw updateErr;

      // Insert into concerns table
      const { error: concernErr } = await supabase.from('concerns').insert({
        lead_id: leadId,
        raised_by: user!.id,
        description: comment.trim(),
      });
      if (concernErr) throw concernErr;

      // Send notification to the selected recipient
      const { error: notifyErr } = await supabase.from('notifications').insert({
        user_id: recipientId,
        title: '⚠️ Concern Raised',
        message: `BD Member raised a concern about lead "${lead?.name}": ${comment.trim()}`,
        type: 'concern',
        lead_id: leadId,
      });
      if (notifyErr) throw notifyErr;
    },
    onSuccess: () => {
      toast.success('Concern raised successfully');
      queryClient.invalidateQueries({ queryKey: ['bd-member-leads'] });
      setConcernLead(null);
      setConcernText('');
      setConcernRecipient('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Fetch Concern Recipients ──────────────────────────────────
  const { data: concernRecipients = [] } = useQuery({
    queryKey: ['concern-recipients-bd', user?.id, role],
    queryFn: async () => {
      if (!user) return [];

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name, reports_to');
      
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role');

      const profiles = profilesData || [];
      const roles = rolesData || [];

      const myProfile = profiles.find(p => p.user_id === user.id);
      const reportsTo = myProfile?.reports_to;

      let list: { user_id: string; label: string }[] = [];

      // BD Member role is LEAD_GEN
      if (reportsTo) {
        const tl = profiles.find(p => p.user_id === reportsTo);
        if (tl) {
          list.push({
            user_id: tl.user_id,
            label: `${tl.full_name} (BD TL)`
          });
        }
      } else {
        const leadTlUserIds = new Set(roles.filter(r => r.role === 'LEAD_TL').map(r => r.user_id));
        profiles.forEach(p => {
          if (leadTlUserIds.has(p.user_id)) {
            list.push({
              user_id: p.user_id,
              label: `${p.full_name} (BD TL)`
            });
          }
        });
      }

      return list;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (concernRecipients && concernRecipients.length === 1) {
      setConcernRecipient(concernRecipients[0].user_id);
    }
  }, [concernRecipients]);

  const dnrDoneMutation = useMutation({
    mutationFn: async (lead: any) => {
      const { error } = await supabase.from('leads').update({
        dnr_followup_done: true,
        dnr_followup_done_at: new Date().toISOString(),
        dnr_followup_done_by: user!.id,
      }).eq('unique_id', lead.unique_id);
      if (error) throw error;
      // Notify BD TL, Process Analyst, Admin
      const { data: targets } = await supabase
        .from('user_roles').select('user_id')
        .in('role', ['LEAD_TL', 'ADMIN', 'PROCESS_ANALYST']);
      if (targets && targets.length > 0) {
        await supabase.from('notifications').insert(
          targets.map(t => ({
            user_id: t.user_id,
            title: '✅ DNR Follow-up Done',
            message: `BD Member completed DNR follow-up for lead "${lead.name}".`,
            type: 'dnr_done',
            lead_id: lead.unique_id,
          }))
        );
      }
    },
    onSuccess: () => {
      toast.success('DNR follow-up marked as done!');
      queryClient.invalidateQueries({ queryKey: ['bd-member-leads'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const getProfileName = (id: string | null) => {
    if (!id) return '—';
    return profiles.find(p => p.user_id === id)?.full_name || 'Unknown';
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading your dashboard...</div>;

  return (
    <div className="space-y-8 pb-12">

      {/* ── Header & Global Filters ── */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-display font-bold">Welcome back, {profile?.full_name || 'BD Member'}</h1>
          <p className="text-sm text-muted-foreground">Your personal lead generation dashboard</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)} className="w-[200px]">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="personal">My View</TabsTrigger>
              <TabsTrigger value="global">Global View</TabsTrigger>
            </TabsList>
          </Tabs>
          <Input
            placeholder="Search by name..."
            value={nameSearch}
            onChange={e => setNameSearch(e.target.value)}
            className="w-44"
          />
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-28"><SelectValue placeholder="Month" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5 bg-background px-2.5 rounded-md border border-input h-10 shrink-0">
            <span className="text-xs text-muted-foreground font-medium pr-1 select-none">Date:</span>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[120px] h-8 text-xs border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-accent/40 rounded-sm px-1.5" title="From" />
            <span className="text-muted-foreground text-xs px-0.5 select-none">—</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[120px] h-8 text-xs border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-accent/40 rounded-sm px-1.5" title="To" />
          </div>
        </div>
      </div>

      {/* ── SECTION 1: KPI Cards ── */}
      {viewMode !== 'global' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Leads', value: totalLeads, icon: Users, color: 'text-primary' },
            { label: 'Added Today', value: newToday, icon: Plus, color: 'text-blue-500' },
            { label: 'Assigned to Sales', value: assignedLeads, icon: UserPlus, color: 'text-amber-500' },
            { label: 'Closures', value: closures, icon: CheckCircle, color: 'text-green-500' },
          ].map(({ label, value, icon: Icon, color }, i) => (
            <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className="glass-card hover:nb-glow transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                  <Icon className={`h-4 w-4 ${color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-display font-bold">{value}</div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── SECTION 2 & 3: Analytics Charts ── */}
      {viewMode !== 'global' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Daily Trend - spans 2 cols */}
          <Card className="glass-card lg:col-span-2">
            <CardHeader><CardTitle className="text-sm font-medium">Daily Lead Addition Trend</CardTitle></CardHeader>
            <CardContent className="h-[220px]">
              {chartData.dailyTrend.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data for selected filters</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.dailyTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Source + Category */}
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-sm font-medium">Lead Source & Category</CardTitle></CardHeader>
            <CardContent className="h-[220px] flex flex-col gap-2">
              <ResponsiveContainer width="100%" height="50%">
                <PieChart>
                  <Pie data={chartData.sourceBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={40}>
                    {chartData.sourceBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '9px' }} />
                </PieChart>
              </ResponsiveContainer>
              <ResponsiveContainer width="100%" height="50%">
                <PieChart>
                  <Pie data={chartData.categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={20} outerRadius={40}>
                    <Cell fill="#ef4444" /><Cell fill="#3b82f6" />
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '9px' }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── SECTION 4: My Leads Table ── */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg font-display flex items-center justify-between">
            {viewMode === 'global' ? 'Global Leads' : 'My Leads'} ({filteredLeads.length})
            <span className="text-xs text-muted-foreground font-normal">
              {viewMode === 'global' ? 'Viewing all system leads' : 'You can only see leads you created'}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['ID', 'Name', 'Email', 'Phone', 'LinkedIn', 'Uni', 'Tech', 'Source', 'Category', 'Date Added', 'Status', 'Assigned To', 'Comment', 'DNR Follow-up', 'Actions'].map(h => (
                    <th key={h} className="text-left p-2 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLeads.length === 0 ? (
                  <tr><td colSpan={15} className="text-center py-8 text-muted-foreground">No leads found. Start by adding leads!</td></tr>
                ) : filteredLeads.map(lead => (
                  <tr
                    key={lead.unique_id}
                    className={`border-b border-border/50 hover:bg-accent/30 transition-colors ${lead.concern ? 'bg-orange-500/10' : ''}`}
                  >
                    <td className="p-2 font-mono text-xs text-primary font-bold">{(lead as any).display_id || '—'}</td>
                    <td className="p-2 font-medium whitespace-nowrap">{lead.name}</td>
                    <td className="p-2 text-xs">{lead.email}</td>
                    <td className="p-2 text-xs">{lead.phone}</td>
                    <td className="p-2 text-xs">
                      {lead.linkedin_url ? (
                        <a href={lead.linkedin_url} target="_blank" rel="noreferrer" className="text-primary underline text-xs">View</a>
                      ) : '—'}
                    </td>
                    <td className="p-2 text-xs">{lead.university || '—'}</td>
                    <td className="p-2 text-xs">{lead.technology || '—'}</td>
                    <td className="p-2 text-xs">{lead.lead_source || '—'}</td>
                    <td className="p-2">
                      <Badge variant="outline" className={lead.lead_category === 'Hot' ? 'border-amber-500 text-amber-500 text-xs' : 'text-xs'}>
                        {lead.lead_category}
                      </Badge>
                    </td>
                    <td className="p-2 text-xs whitespace-nowrap">{new Date(lead.created_at).toLocaleDateString()}</td>
                    {/* Status - READ ONLY */}
                    <td className="p-2">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        lead.lead_status === 'New' ? 'bg-primary/10 text-primary' :
                        lead.lead_status === 'Closed' ? 'bg-green-500/10 text-green-600' :
                        lead.lead_status === 'Non Interested' ? 'bg-destructive/10 text-destructive' :
                        'bg-secondary text-secondary-foreground'
                      }`}>{lead.lead_status}</span>
                    </td>
                    {/* Assigned To - READ ONLY */}
                    <td className="p-2 text-xs">
                      {lead.assigned_to ? (
                        <span className="text-primary">{getProfileName(lead.assigned_to)}</span>
                      ) : '—'}
                    </td>
                    {/* Comment - READ ONLY view */}
                    <td className="p-2 text-xs max-w-[120px]">
                      <span className="truncate block" title={lead.comment || ''}>{lead.comment || '—'}</span>
                    </td>
                    {/* DNR Follow-up */}
                    <td className="p-2">
                      {lead.lead_status?.startsWith('DNR') && (
                        (lead as any).dnr_followup_done ? (
                          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Done
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs border-green-500/40 text-green-600 hover:bg-green-500/10"
                            disabled={dnrDoneMutation.isPending || lead.lead_generated_by !== user?.id}
                            onClick={() => dnrDoneMutation.mutate(lead)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark Done
                          </Button>
                        )
                      )}
                      {!lead.lead_status?.startsWith('DNR') && <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    {/* Actions */}
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => setDetailsLead(lead)}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {lead.lead_generated_by === user?.id && (
                          !lead.concern ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-orange-500 hover:text-orange-600 hover:bg-orange-500/10 text-xs h-7 px-2"
                              onClick={() => { setConcernLead(lead); setConcernText(''); setConcernRecipient(''); }}
                            >
                              <AlertTriangle className="h-3 w-3 mr-1" /> Concern
                            </Button>
                          ) : (
                            <span className="text-xs text-orange-500 font-medium flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Raised
                            </span>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Raise Concern Dialog ── */}
      <Dialog open={!!concernLead} onOpenChange={open => { if (!open) { setConcernLead(null); setConcernText(''); setConcernRecipient(''); }}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-500">
              <AlertTriangle className="h-5 w-5" />
              Raise Concern — {concernLead?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="concern-recipient">Whom to send concern</Label>
              <Select value={concernRecipient} onValueChange={setConcernRecipient}>
                <SelectTrigger id="concern-recipient" className="w-full">
                  <SelectValue placeholder="Select recipient..." />
                </SelectTrigger>
                <SelectContent>
                  {concernRecipients.map((r) => (
                    <SelectItem key={r.user_id} value={r.user_id}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="concern-comment">Comment</Label>
              <Textarea
                id="concern-comment"
                value={concernText}
                onChange={e => setConcernText(e.target.value)}
                placeholder="Write your concern details here..."
                rows={4}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConcernLead(null); setConcernText(''); setConcernRecipient(''); }}>
              Cancel
            </Button>
            <Button
              disabled={!concernRecipient || !concernText.trim() || raiseConcernMutation.isPending}
              onClick={() => {
                if (!concernLead) return;
                raiseConcernMutation.mutate({
                  leadId: concernLead.unique_id,
                  recipientId: concernRecipient,
                  comment: concernText,
                });
              }}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {raiseConcernMutation.isPending ? 'Sending...' : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead Detail Dialog */}
      {detailsLead && (
        <LeadDetailDialog
          open={detailsLead !== null}
          onClose={() => setDetailsLead(null)}
          lead={detailsLead}
        />
      )}
    </div>
  );
};

export default BDMemberDashboard;

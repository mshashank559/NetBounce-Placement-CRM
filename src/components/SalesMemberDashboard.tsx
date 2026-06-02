import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, CheckCircle, Phone, Calendar, Eye, AlertTriangle, CheckCircle2, Clock, FileText as FileTextIcon, Send, MessageSquare } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import LeadDetailDialog from '@/components/LeadDetailDialog';
import CallActivityDialog from '@/components/CallActivityDialog';
import ClosureDialog from '@/components/ClosureDialog';
import AccountantCommentDialog from '@/components/AccountantCommentDialog';

const ALL_STATUSES = ['New', 'DNR1', 'DNR2', 'DNR3', 'Connected', 'Qualified', 'Hot Prospect', 'Closed', 'Non Interested'];

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

const statusColors: Record<string, string> = {
  'New': 'bg-primary/10 text-primary',
  'DNR1': 'bg-orange-500/10 text-orange-600',
  'DNR2': 'bg-orange-500/10 text-orange-600',
  'DNR3': 'bg-orange-500/10 text-orange-600',
  'Connected': 'bg-blue-500/10 text-blue-600',
  'Qualified': 'bg-indigo-500/10 text-indigo-600',
  'Hot Prospect': 'bg-amber-500/10 text-amber-600',
  'Closed': 'bg-green-500/10 text-green-600',
  'Non Interested': 'bg-destructive/10 text-destructive',
};

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const statusBadgeClass = (s: string) => {
  if (s === 'Closed') return 'bg-green-500/10 text-green-600';
  if (s?.startsWith('DNR')) return 'bg-orange-500/10 text-orange-600';
  if (s === 'Non Interested') return 'bg-destructive/10 text-destructive';
  if (s === 'Hot Prospect') return 'bg-amber-500/10 text-amber-600';
  if (s === 'Connected') return 'bg-blue-500/10 text-blue-600';
  return 'bg-secondary text-secondary-foreground';
};

const SalesMemberDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<'personal' | 'global'>('personal');
  const [monthFilter, setMonthFilter] = useState(() => String(new Date().getMonth() + 1));
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [callLead, setCallLead] = useState<any>(null);
  const [closureLead, setClosureLead] = useState<any>(null);
  const [accountantLead, setAccountantLead] = useState<any>(null);

  // ── Status change with mandatory comment ──
  const [pendingStatusChange, setPendingStatusChange] = useState<{ lead: any; status: string } | null>(null);
  const [statusComment, setStatusComment] = useState('');
  const [sendDocument, setSendDocument] = useState(false);
  const [docComment, setDocComment] = useState('');

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      leadId,
      status,
      comment,
      withDocument,
      documentComment,
    }: {
      leadId: string;
      status: string;
      comment: string;
      withDocument?: boolean;
      documentComment?: string;
    }) => {
      if (status === 'Closed') {
        const lead = myLeads.find(l => l.unique_id === leadId);
        setClosureLead(lead);
        return;
      }
      const { error } = await supabase.from('leads')
        .update({ lead_status: status as any, comment })
        .eq('unique_id', leadId);
      if (error) throw error;

      const lead = myLeads.find(l => l.unique_id === leadId);

      // Notify BD member on DNR / Non Interested
      if (['DNR1', 'DNR2', 'DNR3', 'Non Interested'].includes(status) && lead?.lead_generated_by) {
        await supabase.from('notifications').insert({
          user_id: lead.lead_generated_by,
          title: 'Lead Status Update',
          message: `${lead.name} marked as ${status}. Comment: ${comment}`,
          type: 'dnr',
          lead_id: leadId,
        });
      }

      // Notify Sales TL, Process Analyst, Admin, BD TL
      const { data: targets } = await supabase
        .from('user_roles').select('user_id')
        .in('role', ['SALES_TL', 'PROCESS_ANALYST', 'ADMIN', 'LEAD_TL']);
      if (targets && targets.length > 0) {
        await supabase.from('notifications').insert(
          targets.map(t => ({
            user_id: t.user_id,
            title: '📋 Lead Status Changed',
            message: `"${lead?.name}" → ${status}. Comment: ${comment}`,
            type: 'status_change',
            lead_id: leadId,
          }))
        );
      }

      // ── If "Send Document" was toggled: insert performa + notify accountants ──
      if (withDocument && documentComment?.trim()) {
        const docRef = 'DOC-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        await supabase.from('performas').insert({
          lead_id: leadId,
          sent_by: user!.id,
          type: 'Pre-Performa',
          document_url: docRef,
          notes: JSON.stringify({
            status: 'Sent',
            sla: 'Pending',
            sent_at: new Date().toISOString(),
            docRefId: docRef,
            comment: documentComment.trim(),
          }),
        });

        const { data: accountants } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'ACCOUNTANT');

        if (accountants && accountants.length > 0) {
          await supabase.from('notifications').insert(
            accountants.map(t => ({
              user_id: t.user_id,
              title: '📄 Document Sent with Status Update',
              message: `"${lead?.name}" status changed to ${status}. Document remark: "${documentComment.trim()}"`,
              type: 'accountant_update',
              lead_id: leadId,
            }))
          );
        }
      }

      // Next follow-up date toast
      let delayDays = 1;
      if (status === 'Hot Prospect') delayDays = 90;
      else if (status === 'Qualified') delayDays = 60;
      else if (status === 'Connected') delayDays = 30;
      else if (status === 'DNR1') delayDays = 20;
      else if (status === 'DNR2') delayDays = 15;
      else if (status === 'DNR3') delayDays = 10;

      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + delayDays);
      toast.info(`Status updated → ${status}. Next follow-up: ${nextDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sm-leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['all-performas'] });
      queryClient.invalidateQueries({ queryKey: ['all-leads-accountant'] });
      queryClient.invalidateQueries({ queryKey: ['account-closures'] });
      setPendingStatusChange(null);
      setStatusComment('');
      setSendDocument(false);
      setDocComment('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleStatusChangeRequest = (lead: any, newStatus: string) => {
    if (newStatus === lead.lead_status) return;
    if (newStatus === 'Closed') {
      setClosureLead(lead);
      return;
    }
    setPendingStatusChange({ lead, status: newStatus });
    setStatusComment('');
    setSendDocument(false);
    setDocComment('');
  };

  const dnrDoneMutation = useMutation({
    mutationFn: async (lead: any) => {
      const { error } = await supabase.from('leads').update({
        dnr_followup_done: true,
        dnr_followup_done_at: new Date().toISOString(),
        dnr_followup_done_by: user!.id,
      }).eq('unique_id', lead.unique_id);
      if (error) throw error;
      // Notify Sales TL, Admin, Process Analyst
      const { data: targets } = await supabase
        .from('user_roles').select('user_id')
        .in('role', ['SALES_TL', 'ADMIN', 'PROCESS_ANALYST']);
      if (targets && targets.length > 0) {
        await supabase.from('notifications').insert(
          targets.map(t => ({
            user_id: t.user_id,
            title: '✅ DNR Follow-up Done',
            message: `Salesperson completed DNR follow-up for lead "${lead.name}".`,
            type: 'dnr_done',
            lead_id: lead.unique_id,
          }))
        );
      }
    },
    onSuccess: () => {
      toast.success('DNR follow-up marked as done!');
      queryClient.invalidateQueries({ queryKey: ['sm-leads'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── My assigned leads ──
  const { data: myLeads = [] } = useQuery({
    queryKey: ['sm-leads', user?.id, viewMode],
    queryFn: async () => {
      let query = supabase.from('leads').select('*');
      if (viewMode === 'personal') {
        query = query.eq('assigned_to', user!.id).neq('assignment_type', 'Team');
      } else {
        query = query.not('assigned_to', 'is', null);
      }
      const { data } = await query.order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  // ── My call logs ──
  const { data: callLogs = [] } = useQuery({
    queryKey: ['sm-calls', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('call_logs').select('*').eq('user_id', user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  // ── All profiles (for "generated by") ──
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-sm'],
    queryFn: async () => { const { data } = await supabase.from('profiles').select('user_id, full_name'); return data || []; }
  });

  // ── Follow-up history ──
  const { data: followups = [] } = useQuery({
    queryKey: ['sm-followups', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('followups').select('*').eq('user_id', user!.id).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  // ── Filters ──
  const filteredLeads = useMemo(() => {
    return myLeads.filter(l => {
      const d = new Date(l.created_at);
      if (monthFilter !== 'all' && d.getMonth() + 1 !== parseInt(monthFilter)) return false;
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false;
      if (nameSearch && !l.name?.toLowerCase().includes(nameSearch.toLowerCase())) return false;
      if (statusFilter !== 'all' && l.lead_status !== statusFilter) return false;
      return true;
    });
  }, [myLeads, monthFilter, dateFrom, dateTo, nameSearch, statusFilter]);

  // ── KPIs ──
  const today = new Date().toISOString().split('T')[0];
  const activeLeads = myLeads.filter(l => !['Closed','Non Interested'].includes(l.lead_status || '')).length;
  const closures = myLeads.filter(l => l.lead_status === 'Closed').length;
  const todayCalls = callLogs.filter(c => c.call_date === today).reduce((s, c) => s + (c.call_count || 0), 0);
  const monthCallLogs = callLogs.filter(c => {
    const m = new Date(c.call_date + 'T00:00:00').getMonth() + 1;
    return m === parseInt(monthFilter === 'all' ? String(new Date().getMonth() + 1) : monthFilter);
  });
  const monthlyCalls = monthCallLogs.reduce((s, c) => s + (c.call_count || 0), 0);

  // ── SLA: stale leads (no update >24h) ──
  const staleLeads = myLeads.filter(l => {
    const hrs = (Date.now() - new Date(l.updated_at).getTime()) / 3600000;
    return hrs > 24 && !['Closed','Non Interested'].includes(l.lead_status || '');
  });

  // ── Chart data ──
  const chartData = useMemo(() => {
    const callMap: Record<string, number> = {};
    callLogs.forEach(c => { callMap[c.call_date] = (callMap[c.call_date] || 0) + (c.call_count || 0); });
    const callTrend = Object.keys(callMap).sort().slice(-7).map(d => ({ date: d.slice(5), calls: callMap[d] }));

    const statusMap: Record<string, number> = {};
    myLeads.forEach(l => { const s = l.lead_status || 'New'; statusMap[s] = (statusMap[s] || 0) + 1; });
    const statusBreakdown = Object.keys(statusMap).map(s => ({ name: s, value: statusMap[s] }));

    return { callTrend, statusBreakdown };
  }, [callLogs, myLeads]);

  const getName = (id: string | null) => profiles.find(p => p.user_id === id)?.full_name || '—';

  return (
    <div className="space-y-8 pb-12">

      {/* Header & Filters */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-display font-bold">Welcome back, {profile?.full_name || 'Sales Member'}</h1>
          <p className="text-sm text-muted-foreground">Your personal execution dashboard</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)} className="w-[200px]">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="personal">My View</TabsTrigger>
              <TabsTrigger value="global">Global View</TabsTrigger>
            </TabsList>
          </Tabs>
          <Input placeholder="Search name..." value={nameSearch} onChange={e => setNameSearch(e.target.value)} className="w-40" />
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {MONTHS.map((m, i) => <SelectItem key={m} value={String(i+1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {['New','DNR1','DNR2','DNR3','Connected','Qualified','Hot Prospect','Closed','Non Interested'].map(s =>
                <SelectItem key={s} value={s}>{s}</SelectItem>
              )}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5 bg-background px-2.5 rounded-md border border-input h-10 shrink-0">
            <span className="text-xs text-muted-foreground font-medium pr-1 select-none">Date:</span>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[120px] h-8 text-xs border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-accent/40 rounded-sm px-1.5" />
            <span className="text-muted-foreground text-xs px-0.5 select-none">—</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[120px] h-8 text-xs border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-accent/40 rounded-sm px-1.5" />
          </div>
        </div>
      </div>

      {/* SECTION 1: KPI Cards */}
      {viewMode !== 'global' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Active Leads', value: activeLeads, icon: TrendingUp, color: 'text-primary' },
            { label: 'Closures', value: closures, icon: CheckCircle, color: 'text-green-500' },
            { label: "Today's Calls", value: todayCalls, icon: Phone, color: 'text-blue-500' },
            { label: 'Monthly Calls', value: monthlyCalls, icon: Calendar, color: 'text-amber-500' },
          ].map(({ label, value, icon: Icon, color }, i) => (
            <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className="glass-card hover:nb-glow transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                  <Icon className={`h-4 w-4 ${color}`} />
                </CardHeader>
                <CardContent><div className="text-3xl font-display font-bold">{value}</div></CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* SLA Alert */}
      {viewMode !== 'global' && staleLeads.length > 0 && (
        <Card className="border-red-500/50 bg-red-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Attention Required — {staleLeads.length} lead(s) with no update in 24h
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {staleLeads.map(l => (
              <Button key={l.unique_id} size="sm" variant="outline" className="border-red-500/30 text-xs h-7"
                onClick={() => setCallLead(l)}>
                <Phone className="h-3 w-3 mr-1" /> {l.name}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* SECTION 2: Charts */}
      {viewMode !== 'global' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-sm font-medium">Daily Call Trend (Last 7 Days)</CardTitle></CardHeader>
            <CardContent className="h-[200px]">
              {chartData.callTrend.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No calls logged yet</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData.callTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="calls" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader><CardTitle className="text-sm font-medium">Lead Status Breakdown</CardTitle></CardHeader>
            <CardContent className="h-[200px]">
              {chartData.statusBreakdown.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No leads yet</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData.statusBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                      {chartData.statusBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* SECTION 3 & 4: My Leads Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg font-display">My Leads ({filteredLeads.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['ID','Name','Email','Phone','Uni','Tech','LinkedIn','Time','TZ','Category','Source','Status','Generated By','Last Activity','DNR Follow-up','Actions'].map(h => (
                    <th key={h} className="text-left p-2 text-muted-foreground font-medium whitespace-nowrap text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLeads.length === 0 ? (
                  <tr><td colSpan={15} className="text-center py-8 text-muted-foreground">No leads assigned to you yet.</td></tr>
                ) : filteredLeads.map(lead => {
                  const isDNR = lead.lead_status?.startsWith('DNR');
                  const isHot = lead.lead_status === 'Hot Prospect';
                  const hoursSince = (Date.now() - new Date(lead.updated_at).getTime()) / 3600000;
                  const isStale = hoursSince > 24 && !['Closed','Non Interested'].includes(lead.lead_status || '');
                  const lastFollowup = followups.find(f => f.lead_id === lead.unique_id);

                  return (
                    <tr
                      key={lead.unique_id}
                      className={`border-b border-border/50 hover:bg-accent/30 transition-colors ${
                        isDNR ? 'bg-orange-500/5' : isHot ? 'bg-amber-500/5' : isStale ? 'bg-red-500/5' : ''
                      }`}
                    >
                      <td className="p-2 font-mono text-xs text-primary font-bold">{(lead as any).display_id || '—'}</td>
                      <td className="p-2 font-medium whitespace-nowrap">{lead.name}</td>
                      <td className="p-2 text-xs">{lead.email}</td>
                      <td className="p-2 text-xs">{lead.phone}</td>
                      <td className="p-2 text-xs">{lead.university || '—'}</td>
                      <td className="p-2 text-xs">{lead.technology || '—'}</td>
                      <td className="p-2 text-xs">
                        {lead.linkedin_url ? (
                          <a href={lead.linkedin_url} target="_blank" rel="noreferrer" className="text-primary underline text-xs">View</a>
                        ) : '—'}
                      </td>
                      <td className="p-2 text-xs">{lead.time_for_call || '—'}</td>
                      <td className="p-2 text-xs">{lead.timezone || '—'}</td>
                      <td className="p-2">
                        <Badge variant="outline" className={`text-xs ${lead.lead_category === 'Hot' ? 'border-amber-500 text-amber-500' : ''}`}>
                          {lead.lead_category}
                        </Badge>
                      </td>
                      <td className="p-2 text-xs">{lead.lead_source || '—'}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-1.5">
                          <Select
                            value={lead.lead_status || 'New'}
                            onValueChange={v => handleStatusChangeRequest(lead, v)}
                            disabled={lead.assigned_to !== user?.id}
                          >
                            <SelectTrigger className="h-7 w-36 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ALL_STATUSES.map(s => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {isStale && (
                            <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-red-500/20 text-[9px] px-1 py-0 font-bold uppercase shrink-0">
                              Stagnant
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-2 text-xs">{getName(lead.lead_generated_by)}</td>
                      <td className="p-2 text-xs whitespace-nowrap">{new Date(lead.updated_at).toLocaleDateString()}</td>
                      <td className="p-2">
                        {lead.lead_status?.startsWith('DNR') ? (
                          (lead as any).dnr_followup_done ? (
                            <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Done
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs border-green-500/40 text-green-600 hover:bg-green-500/10"
                              disabled={dnrDoneMutation.isPending || lead.assigned_to !== user?.id}
                              onClick={() => dnrDoneMutation.mutate(lead)}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark Done
                            </Button>
                          )
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" title="View" onClick={() => setSelectedLead(lead)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {lead.lead_status !== 'Closed' && lead.lead_status !== 'Non Interested' && lead.assigned_to === user?.id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-primary hover:bg-primary/10"
                              title="Log Call"
                              onClick={() => {
                                if (lead.lead_status === 'Hot Prospect') {
                                  setClosureLead(lead);
                                } else {
                                  setCallLead(lead);
                                }
                              }}
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {lead.lead_status === 'Hot Prospect' && lead.assigned_to === user?.id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-green-500 hover:bg-green-500/10 text-xs h-7 px-2"
                              onClick={() => setClosureLead(lead)}
                            >
                              Close
                            </Button>
                          )}
                         </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 7: Follow-up History */}
      {viewMode !== 'global' && followups.length > 0 && (
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-sm font-medium">Recent Follow-up Activity</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {followups.slice(0, 10).map(f => (
                <div key={f.id} className="flex items-start justify-between text-xs p-2 bg-accent/30 rounded">
                  <div>
                    <span className="font-medium">{myLeads.find(l => l.unique_id === f.lead_id)?.name || 'Lead'}</span>
                    <span className="text-muted-foreground ml-2">via {f.way_of_contact}</span>
                    <p className="text-muted-foreground mt-0.5">{f.notes}</p>
                  </div>
                  <span className="text-muted-foreground/60 whitespace-nowrap ml-4">{new Date(f.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      {selectedLead && <LeadDetailDialog lead={selectedLead} open={!!selectedLead} onClose={() => setSelectedLead(null)} />}
      {callLead && <CallActivityDialog lead={callLead} open={!!callLead} onClose={() => { setCallLead(null); queryClient.invalidateQueries({ queryKey: ['sm-leads'] }); }} />}
      {closureLead && <ClosureDialog lead={closureLead} open={!!closureLead} onClose={() => { setClosureLead(null); queryClient.invalidateQueries({ queryKey: ['sm-leads'] }); }} />}
      {accountantLead && <AccountantCommentDialog lead={accountantLead} open={!!accountantLead} onClose={() => setAccountantLead(null)} />}

      {/* ── Mandatory Comment Dialog on Status Change ── */}
      <Dialog
        open={!!pendingStatusChange}
        onOpenChange={open => { if (!open) { setPendingStatusChange(null); setStatusComment(''); setSendDocument(false); setDocComment(''); } }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Status Change — Mandatory Comment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Lead + new status pill */}
            <div className="bg-accent/40 rounded-lg p-3 text-sm">
              <span className="text-muted-foreground">Lead: </span>
              <span className="font-medium">{pendingStatusChange?.lead?.name}</span>
              <span className="text-muted-foreground mx-2">→</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[pendingStatusChange?.status || ''] || 'bg-secondary'}`}>
                {pendingStatusChange?.status}
              </span>
            </div>

            {/* Mandatory status comment */}
            <div className="space-y-1.5">
              <Label htmlFor="sm-status-comment">
                Comment <span className="text-destructive">*</span>
                <span className="text-xs text-muted-foreground ml-1">(required — visible to Sales TL, Process Analyst, Admin, BD TL)</span>
              </Label>
              <Textarea
                id="sm-status-comment"
                value={statusComment}
                onChange={e => setStatusComment(e.target.value)}
                placeholder="Describe why the status is being changed..."
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Send Document toggle */}
            <div className="border border-border/50 rounded-lg p-3 space-y-3 bg-background/50">
              <button
                type="button"
                onClick={() => { setSendDocument(v => !v); if (sendDocument) setDocComment(''); }}
                className={`flex items-center gap-2 text-sm font-medium w-full rounded-md px-2 py-1.5 transition-colors ${
                  sendDocument
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
                }`}
              >
                <Send className="h-4 w-4" />
                Send Document
                <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  sendDocument ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>{sendDocument ? 'ON' : 'OFF'}</span>
              </button>

              {sendDocument && (
                <div className="space-y-1.5">
                  <Label htmlFor="sm-doc-comment" className="text-xs">
                    <FileTextIcon className="h-3.5 w-3.5 inline mr-1 text-primary" />
                    Document Remarks <span className="text-destructive">*</span>
                    <span className="text-xs text-muted-foreground ml-1">(sent to Accountant Dashboard)</span>
                  </Label>
                  <Textarea
                    id="sm-doc-comment"
                    value={docComment}
                    onChange={e => setDocComment(e.target.value)}
                    placeholder="Add remarks about the document being sent..."
                    rows={3}
                    className="resize-none"
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPendingStatusChange(null); setStatusComment(''); setSendDocument(false); setDocComment(''); }}>
              Cancel
            </Button>
            <Button
              disabled={!statusComment.trim() || (sendDocument && !docComment.trim()) || updateStatusMutation.isPending}
              onClick={() => {
                if (!pendingStatusChange || !statusComment.trim()) return;
                if (sendDocument && !docComment.trim()) return;
                updateStatusMutation.mutate({
                  leadId: pendingStatusChange.lead.unique_id,
                  status: pendingStatusChange.status,
                  comment: statusComment.trim(),
                  withDocument: sendDocument,
                  documentComment: docComment.trim(),
                });
              }}
            >
              {updateStatusMutation.isPending ? 'Updating...' : 'Confirm Status Change'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesMemberDashboard;

import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllLeads } from '@/lib/leads';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { TrendingUp, CheckCircle, Phone, DollarSign, AlertTriangle, Clock, UserPlus, Eye } from 'lucide-react';
import LeadDetailDialog from './LeadDetailDialog';
import {
  LineChart, Line, BarChart, Bar, FunnelChart, Funnel, LabelList,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell
} from 'recharts';

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const STATUS_FUNNEL = ['New','DNR1','DNR2','DNR3','Connected','Qualified','Hot Prospect','Closed'];

const SalesTLDashboard: React.FC = () => {
  const { user, profile, role } = useAuth();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState('team'); // 'personal', 'team', or 'global'
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [monthFilter, setMonthFilter] = useState(() => String(new Date().getMonth() + 1));
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // ── Fetch all team leads (assigned to me or my team) ──
  const { data: leads = [] } = useQuery({
    queryKey: ['salestl-leads', user?.id],
    queryFn: fetchAllLeads,
    enabled: !!user,
  });

  // ── Sales team members ──
  const { data: salesMembers = [] } = useQuery({
    queryKey: ['sales-team-members', user?.id, role],
    queryFn: async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('role', ['SALES_TM', 'SALES_TL']);
      if (!roles?.length) return [];
      
      const tlIds = roles.filter(r => r.role === 'SALES_TL').map(r => r.user_id);
      const tmIds = roles.filter(r => r.role === 'SALES_TM').map(r => r.user_id);
      
      let tlQuery = supabase.from('profiles').select('*').in('user_id', tlIds) as any;
      if (role === 'SALES_TL') {
        tlQuery = tlQuery.eq('user_id', user!.id);
      }
      const { data: tlProfiles } = await tlQuery;
      
      let tmQuery = supabase.from('profiles').select('*').in('user_id', tmIds) as any;
      if (role === 'SALES_TL') {
        tmQuery = tmQuery.eq('reports_to', user!.id);
      }
      const { data: tmProfiles } = await tmQuery;
      
      const combined = [...(tlProfiles || []), ...(tmProfiles || [])];
      const uniqueMap: Record<string, any> = {};
      combined.forEach(p => {
        uniqueMap[p.user_id] = p;
      });
      return Object.values(uniqueMap);
    },
    enabled: !!user,
  });

  // ── All profiles map ──
  const { data: profiles = [] } = useQuery({
    queryKey: ['all-profiles-stl'],
    queryFn: async () => { const { data } = await supabase.from('profiles').select('*'); return data || []; }
  });

  // ── Call logs ──
  const { data: callLogs = [] } = useQuery({
    queryKey: ['all-call-logs'],
    queryFn: async () => { const { data } = await supabase.from('call_logs').select('*'); return data || []; }
  });

  // ── Database aggregated revenue stats ──
  const { data: dbRevenueStats } = useQuery({
    queryKey: ['tl-revenue-stats', viewMode, monthFilter, dateFrom, dateTo, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_revenue_stats', {
        p_month_filter: monthFilter === 'all' ? null : monthFilter,
        p_start_date: dateFrom || null,
        p_end_date: dateTo || null,
        p_view_mode: viewMode,
      });
      if (error) throw error;
      return data as any;
    },
    enabled: !!user,
  });

  // ── Scoped closures for lead list payment displays ──
  const { data: closureData = [] } = useQuery({
    queryKey: ['scoped-closures', viewMode, myTeamIds.size, user?.id],
    queryFn: async () => {
      let query = supabase.from('lead_closures').select('id, lead_id, amount');
      if (viewMode === 'team' || viewMode === 'personal') {
        const teamUserIds = viewMode === 'personal' 
          ? [user!.id] 
          : [...salesMembers.map(m => m.user_id), user!.id];
        const { data: leadsInTeam } = await supabase
          .from('leads')
          .select('unique_id')
          .in('assigned_to', teamUserIds);
        const teamLeadIds = leadsInTeam?.map(l => l.unique_id) || [];
        if (teamLeadIds.length === 0) return [];
        query = query.in('lead_id', teamLeadIds);
      }
      const { data } = await query;
      return data || [];
    },
    enabled: !!user && salesMembers.length > 0,
  });

  // ── Filters ──
  const myTeamIds = useMemo(() => new Set(salesMembers.map(m => m.user_id)), [salesMembers]);

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      if (viewMode === 'personal' && l.assigned_to !== user?.id) return false;
      if (viewMode === 'team' && l.assigned_to && !myTeamIds.has(l.assigned_to) && l.assigned_to !== user?.id) return false;
      if (viewMode === 'global' && !l.assigned_to) return false;
      const d = new Date(l.created_at);
      if (monthFilter !== 'all' && d.getMonth() + 1 !== parseInt(monthFilter)) return false;
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false;
      if (nameSearch) {
        const query = nameSearch.toLowerCase();
        const matchesName = l.name?.toLowerCase().includes(query);
        const matchesEmail = l.email?.toLowerCase().includes(query);
        const matchesPhone = l.phone?.toLowerCase().includes(query);
        const matchesId = String(l.display_id || '').toLowerCase().includes(query) || String(l.unique_id || '').toLowerCase().includes(query);
        if (!matchesName && !matchesEmail && !matchesPhone && !matchesId) return false;
      }
      if (statusFilter !== 'all' && l.lead_status !== statusFilter) return false;
      return true;
    });
  }, [leads, viewMode, monthFilter, dateFrom, dateTo, nameSearch, statusFilter, user?.id, myTeamIds]);

  // ── Unassigned to team member (pool leads) ──
  const poolLeads = leads.filter(l => l.assigned_to === user?.id && l.assignment_type === 'Team');

  // ── KPIs ──
  const today = new Date().toISOString().split('T')[0];
  const activeLeads = filteredLeads.filter(l => !['Closed','Non Interested'].includes(l.lead_status || '')).length;
  const closures = filteredLeads.filter(l => l.lead_status === 'Closed').length;

  const filteredLeadIds = useMemo(() => new Set(filteredLeads.map(l => l.unique_id)), [filteredLeads]);

  const todayCalls = useMemo(() => {
    return callLogs
      .filter(c => c.call_date === today && filteredLeadIds.has(c.lead_id))
      .reduce((s, c) => s + (c.call_count || 0), 0);
  }, [callLogs, today, filteredLeadIds]);

  const revenue = useMemo(() => {
    return dbRevenueStats?.total_revenue || 0;
  }, [dbRevenueStats]);

  // ── SLA Alerts ──
  const staleLeads = useMemo(() => {
    return leads.filter(l => {
      if (l.assigned_to !== user?.id && !myTeamIds.has(l.assigned_to)) return false;
      const hrs = (Date.now() - new Date(l.updated_at).getTime()) / 3600000;
      return hrs > 24 && !['Closed','Non Interested'].includes(l.lead_status || '');
    });
  }, [leads, myTeamIds, user?.id]);

  const concernLeads = useMemo(() => {
    return leads.filter(l => {
      if (l.assigned_to !== user?.id && !myTeamIds.has(l.assigned_to)) return false;
      return l.concern === true;
    });
  }, [leads, myTeamIds, user?.id]);



  // ── Chart Data ──
  const chartData = useMemo(() => {
    const callMap: Record<string, number> = {};
    callLogs.forEach(c => {
      if (filteredLeadIds.has(c.lead_id)) {
        callMap[c.call_date] = (callMap[c.call_date] || 0) + (c.call_count || 0);
      }
    });
    const callTrend = Object.keys(callMap).sort().slice(-7).map(d => ({ date: d.slice(5), calls: callMap[d] }));

    const funnelData = STATUS_FUNNEL.map(s => ({
      name: s, value: filteredLeads.filter(l => l.lead_status === s).length
    }));

    const memberPerf = salesMembers.map(m => ({
      name: m.full_name?.split(' ')[0],
      leads: filteredLeads.filter(l => l.assigned_to === m.user_id).length,
      closed: filteredLeads.filter(l => l.assigned_to === m.user_id && l.lead_status === 'Closed').length,
    }));

    return { callTrend, funnelData, memberPerf };
  }, [callLogs, filteredLeads, filteredLeadIds, salesMembers]);

  // ── Assign lead mutation ──
  const assignMutation = useMutation({
    mutationFn: async ({ leadId, memberId }: { leadId: string; memberId: string }) => {
      await supabase.from('leads').update({ assigned_to: memberId }).eq('unique_id', leadId);
      const lead = leads.find(l => l.unique_id === leadId);
      await supabase.from('notifications').insert([
        { user_id: memberId, title: 'Lead Assigned', message: `"${lead?.name}" has been assigned to you.`, type: 'assignment', lead_id: leadId },
      ]);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['salestl-leads'] }); toast.success('Lead assigned!'); },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Reassign for SLA ──
  const reassignMutation = useMutation({
    mutationFn: async ({ leadId, memberId }: { leadId: string; memberId: string }) => {
      await supabase.from('leads').update({ assigned_to: memberId }).eq('unique_id', leadId);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['salestl-leads'] }); toast.success('Lead reassigned!'); }
  });

  const resolveSalesConcernMutation = useMutation({
    mutationFn: async (leadId: string) => {
      // Find unresolved concern
      const { data: unresolved, error: fetchErr } = await supabase
        .from('concerns')
        .select('id, raised_by')
        .eq('lead_id', leadId)
        .eq('resolved', false)
        .limit(1)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      if (unresolved) {
        const { error: err1 } = await supabase.from('concerns').update({ resolved: true }).eq('id', unresolved.id);
        if (err1) throw err1;
      }

      const { error: err2 } = await supabase.from('leads').update({ concern: false }).eq('unique_id', leadId);
      if (err2) throw err2;

      if (unresolved) {
        const { data: lead } = await supabase.from('leads').select('name').eq('unique_id', leadId).single();
        await supabase.from('notifications').insert({
          user_id: unresolved.raised_by,
          title: '✅ Concern Resolved',
          message: `The concern raised for lead "${lead?.name || 'Lead'}" has been resolved by Sales Team Lead.`,
          type: 'concern_resolved',
          lead_id: leadId,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salestl-leads'] });
      toast.success('Concern resolved successfully!');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const getName = (id: string | null) => profiles.find(p => p.user_id === id)?.full_name || '—';

  return (
    <div className="space-y-8 pb-12">

      {/* Header & Filters */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-display font-bold">Sales Team Lead Dashboard</h1>
          <p className="text-sm text-muted-foreground">Full team execution control & revenue tracking</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={viewMode} onValueChange={setViewMode} className="w-[300px]">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="personal">My View</TabsTrigger>
              <TabsTrigger value="team">Team View</TabsTrigger>
              <TabsTrigger value="global">Global View</TabsTrigger>
            </TabsList>
          </Tabs>
          <Input placeholder="Search name, id, email, phone..." value={nameSearch} onChange={e => setNameSearch(e.target.value)} className="w-56" />
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
              {['DNR1','DNR2','DNR3','Connected','Qualified','Hot Prospect','Closed','Non Interested'].map(s =>
                <SelectItem key={s} value={s}>{s}</SelectItem>
              )}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5 bg-background px-2.5 rounded-md border border-input h-10 shrink-0">
            <span className="text-xs text-muted-foreground font-medium pr-1 select-none">Date:</span>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[130px] h-8 text-xs border-0 bg-transparent pl-1.5 pr-3 focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-accent/40 rounded-sm" />
            <span className="text-muted-foreground text-xs px-0.5 select-none">—</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[130px] h-8 text-xs border-0 bg-transparent pl-1.5 pr-3 focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-accent/40 rounded-sm" />
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
            { label: 'Revenue', value: `$${revenue.toLocaleString()}`, icon: DollarSign, color: 'text-amber-500' },
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

      {/* SLA Alerts & Concerns */}
      {viewMode !== 'global' && (staleLeads.length > 0 || concernLeads.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {staleLeads.length > 0 && (
            <Card className="border-red-500/50 bg-red-500/5">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-red-600 flex items-center gap-2"><Clock className="h-4 w-4" /> Stale Leads — No Update &gt;24h ({staleLeads.length})</CardTitle></CardHeader>
              <CardContent className="space-y-2 max-h-40 overflow-y-auto">
                {staleLeads.map(l => (
                  <div key={l.unique_id} className="flex items-center justify-between text-xs p-2 bg-background rounded border border-red-500/20">
                    <span className="truncate max-w-[150px]"><b>{l.name}</b> — {l.lead_status}</span>
                    <Select onValueChange={v => reassignMutation.mutate({ leadId: l.unique_id, memberId: v })}>
                      <SelectTrigger className="w-24 h-6 text-xs"><SelectValue placeholder="Reassign" /></SelectTrigger>
                      <SelectContent>{salesMembers.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          
          {concernLeads.length > 0 && (
            <Card className="border-orange-500/50 bg-orange-500/5 shadow-[0_0_15px_rgba(249,115,22,0.1)]">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-orange-600 flex items-center"><AlertTriangle className="h-4 w-4 mr-2" /> Unresolved Concerns ({concernLeads.length})</CardTitle></CardHeader>
              <CardContent className="space-y-2 max-h-40 overflow-y-auto">
                {concernLeads.map(l => (
                  <div key={l.unique_id} className="text-xs p-2 bg-background rounded border border-orange-500/20 flex items-center justify-between gap-1">
                    <span className="font-semibold truncate max-w-[120px]" title={l.name}>{l.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1.5 text-[10px] text-orange-600 hover:bg-orange-500/10 border border-orange-500/20 shrink-0"
                      onClick={() => resolveSalesConcernMutation.mutate(l.unique_id)}
                      disabled={resolveSalesConcernMutation.isPending}
                    >
                      Resolve
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* SECTION 3: Analytics */}
      {viewMode !== 'global' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="glass-card lg:col-span-2">
            <CardHeader><CardTitle className="text-sm font-medium">Call Activity Trend (Last 7 Days)</CardTitle></CardHeader>
            <CardContent className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData.callTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="calls" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader><CardTitle className="text-sm font-medium">Lead Status Funnel</CardTitle></CardHeader>
            <CardContent className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.funnelData} layout="vertical" margin={{ top: 0, right: 10, left: 60, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 9 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {chartData.funnelData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SECTION 2: Team Performance */}
      {viewMode === 'team' && (
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-lg font-display">Team Performance Overview</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {['Member','Daily Calls','Monthly Calls','Leads Handled','Closures','Conv. Rate','Status'].map(h => (
                      <th key={h} className="text-left p-2 text-muted-foreground font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {salesMembers.map(m => {
                    const mLeads = leads.filter(l => l.assigned_to === m.user_id);
                    const mMonthLeads = mLeads.filter(l => new Date(l.created_at).getMonth() + 1 === parseInt(monthFilter === 'all' ? String(new Date().getMonth()+1) : monthFilter));
                    const mClosed = mLeads.filter(l => l.lead_status === 'Closed').length;
                    const mDailyCalls = callLogs.filter(c => c.user_id === m.user_id && c.call_date === today).reduce((s, c) => s + (c.call_count || 0), 0);
                    const mMonthlyCalls = callLogs.filter(c => c.user_id === m.user_id && new Date(c.call_date + 'T00:00:00').getMonth() + 1 === parseInt(monthFilter === 'all' ? String(new Date().getMonth()+1) : monthFilter)).reduce((s, c) => s + (c.call_count || 0), 0);
                    const convRate = mLeads.length > 0 ? ((mClosed / mLeads.length) * 100).toFixed(1) : '0.0';
                    const isInactive = mDailyCalls === 0;
                    const isTop = mClosed >= 3;

                    return (
                      <tr key={m.user_id} className={`border-b border-border/50 ${isTop ? 'bg-green-500/5' : isInactive ? 'bg-red-500/5' : ''}`}>
                        <td className="p-2 font-medium">{m.full_name} {isTop && <span className="text-xs text-green-500 ml-1">⭐</span>}{isInactive && <span className="text-xs text-red-500 ml-1">⚠</span>}</td>
                        <td className="p-2">{mDailyCalls}</td>
                        <td className="p-2">{mMonthlyCalls}</td>
                        <td className="p-2">{mMonthLeads.length}</td>
                        <td className="p-2 text-green-500 font-bold">{mClosed}</td>
                        <td className="p-2">{convRate}%</td>
                        <td className="p-2"><Badge variant="outline" className={isTop ? 'border-green-500 text-green-500' : isInactive ? 'border-red-500 text-red-500' : ''}>{isTop ? 'Top' : isInactive ? 'Inactive' : 'Active'}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SECTION 5: Assign Pool Leads to Team */}
      {viewMode !== 'global' && poolLeads.length > 0 && (
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-lg font-display flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary" /> Assign Leads to Team ({poolLeads.length} pending)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {poolLeads.map(lead => (
                <div key={lead.unique_id} className="flex items-center justify-between p-3 rounded-lg bg-accent/30 border border-border">
                  <div>
                    <p className="font-medium text-sm">{lead.name}</p>
                    <p className="text-xs text-muted-foreground">{lead.email} · {lead.lead_status}</p>
                  </div>
                  <Select onValueChange={v => assignMutation.mutate({ leadId: lead.unique_id, memberId: v })}>
                    <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Assign to..." /></SelectTrigger>
                    <SelectContent>
                      {salesMembers.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SECTION 7: Revenue Dashboard */}
      {viewMode !== 'global' && (
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-lg font-display flex items-center gap-2"><DollarSign className="h-5 w-5 text-amber-500" /> Revenue Dashboard</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="p-4 rounded-lg bg-accent/30 text-center">
                <p className="text-xs text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold text-amber-500">${revenue.toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-lg bg-accent/30 text-center">
                <p className="text-xs text-muted-foreground">Upfront Collected</p>
                <p className="text-2xl font-bold text-green-500">${(dbRevenueStats?.upfront_collected || 0).toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-lg bg-accent/30 text-center">
                <p className="text-xs text-muted-foreground">Pending Slots</p>
                <p className="text-2xl font-bold text-blue-500">${(dbRevenueStats?.pending_slots || 0).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SECTION 4: All Team Leads Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg font-display">
            {viewMode === 'global' ? 'Global Leads' : 'Team Leads'} ({filteredLeads.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['ID','Name','Email','Phone','LinkedIn','Tech','Status','Assigned To','Source','Last Activity', ...(viewMode === 'global' ? [] : ['Payment']), 'Actions'].map(h => (
                    <th key={h} className="text-left p-2 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={viewMode === 'global' ? 11 : 12} className="text-center py-8 text-muted-foreground">
                      No leads found.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.slice(0, 50).map(lead => {
                    const closure = closureData.find(c => c.lead_id === lead.unique_id);
                    const hoursSince = (Date.now() - new Date(lead.updated_at).getTime()) / 3600000;
                    const isStale = hoursSince > 48 && !['Closed','Non Interested'].includes(lead.lead_status || '');
                    const isDNR = lead.lead_status?.startsWith('DNR');
                    return (
                      <tr key={lead.unique_id} className={`border-b border-border/50 hover:bg-accent/30 ${isStale ? 'bg-red-500/5' : isDNR ? 'bg-orange-500/5' : ''}`}>
                        <td className="p-2 font-mono text-xs text-primary font-bold">{(lead as any).display_id || '—'}</td>
                        <td className="p-2 font-medium">{lead.name}</td>
                        <td className="p-2 text-xs text-muted-foreground">{lead.email}</td>
                        <td className="p-2 text-xs">{lead.phone || '—'}</td>
                        <td className="p-2 text-xs">
                          {lead.linkedin_url ? (
                            <a href={lead.linkedin_url} target="_blank" rel="noreferrer" className="text-primary underline text-xs">View</a>
                          ) : '—'}
                        </td>
                        <td className="p-2 text-xs">{lead.technology || '—'}</td>
                        <td className="p-2">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            lead.lead_status === 'Closed' ? 'bg-green-500/10 text-green-600' :
                            isDNR ? 'bg-orange-500/10 text-orange-600' :
                            lead.lead_status === 'Non Interested' ? 'bg-destructive/10 text-destructive' :
                            'bg-secondary text-secondary-foreground'
                          }`}>{lead.lead_status}</span>
                          {isStale && <span className="ml-1 text-red-500 text-xs">⚠</span>}
                        </td>
                        <td className="p-2 text-xs">{getName(lead.assigned_to)}</td>
                        <td className="p-2 text-xs">{lead.lead_source || '—'}</td>
                        <td className="p-2 text-xs">{new Date(lead.updated_at).toLocaleDateString()}</td>
                        {viewMode !== 'global' && (
                          <td className="p-2 text-xs">
                            {closure ? <span className="text-green-500 font-medium">${(closure.amount || 0).toLocaleString()}</span> : '—'}
                          </td>
                        )}
                        <td className="p-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => setSelectedLead(lead)}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      {/* Lead Detail Dialog */}
      {selectedLead && (
        <LeadDetailDialog
          open={selectedLead !== null}
          onClose={() => setSelectedLead(null)}
          lead={selectedLead}
        />
      )}
    </div>
  );
};

export default SalesTLDashboard;

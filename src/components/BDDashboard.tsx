import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllLeads } from '@/lib/leads';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Users, TrendingUp, CheckCircle, Plus, AlertTriangle, UserPlus, Shuffle, Clock, Eye } from 'lucide-react';
import LeadDetailDialog from './LeadDetailDialog';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const BDDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  // ── Global Filters ──────────────────────────────────────
  const [viewMode, setViewMode] = useState('team'); // 'personal', 'team', or 'global'
  const [detailsLead, setDetailsLead] = useState<any>(null);
  const [monthFilter, setMonthFilter] = useState(() => String(new Date().getMonth() + 1));
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [bdMemberFilter, setBdMemberFilter] = useState('all');
  const [queueTab, setQueueTab] = useState('pending'); // 'pending' or 'all'
  const [nameSearch, setNameSearch] = useState('');

  // ── Data Fetching ───────────────────────────────────────
  const { data: leads, isLoading } = useQuery({
    queryKey: ['bdtl-leads-master'],
    queryFn: fetchAllLeads
  });

  const { data: profiles } = useQuery({
    queryKey: ['all-profiles-map'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*');
      return data || [];
    }
  });

  const { data: salesTeams } = useQuery({
    queryKey: ['sales-team-hierarchy'],
    queryFn: async () => {
      const { data } = await supabase.from('user_roles').select('user_id, role').in('role', ['SALES_TL', 'SALES_TM']);
      const tls = data?.filter(r => r.role === 'SALES_TL').map(r => r.user_id) || [];
      const tms = data?.filter(r => r.role === 'SALES_TM').map(r => r.user_id) || [];
      return { tls, tms };
    }
  });

  // Unique list of BD members (based on lead_source which stores emails)
  const bdMembersList = useMemo(() => {
    if (!leads) return [];
    const members = new Set<string>();
    leads.forEach(l => {
      if (l.lead_source && l.lead_source.includes('@')) {
        members.add(l.lead_source.trim().toLowerCase());
      }
    });
    return Array.from(members).sort();
  }, [leads]);

  // ── Apply Filters ───────────────────────────────────────
  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    return leads.filter(l => {
      // 1. Personal vs Team vs Global scoping
      if (viewMode === 'personal') {
        if (l.lead_generated_by !== user?.id) return false;
      } else if (viewMode === 'team') {
        // Team View: ONLY show leads from members, NOT the TL themselves
        if (l.lead_generated_by === user?.id) return false;
      }
      
      // 2. Month Filter
      if (monthFilter !== 'all') {
        if (new Date(l.created_at).getMonth() + 1 !== parseInt(monthFilter)) return false;
      }

      // 3. Date Range Filter
      if (dateFrom && new Date(l.created_at) < new Date(dateFrom)) return false;
      if (dateTo && new Date(l.created_at) > new Date(dateTo + 'T23:59:59')) return false;

      // 4. Status Filter
      if (statusFilter !== 'all' && l.lead_status !== statusFilter) return false;

      // 5. BD Member Filter (only relevant in Team view)
      if (viewMode === 'team' && bdMemberFilter !== 'all') {
        const targetProfile = profiles?.find(p => p.email?.trim().toLowerCase() === bdMemberFilter);
        const matchesSource = l.lead_source?.trim().toLowerCase() === bdMemberFilter;
        const matchesCreator = targetProfile && l.lead_generated_by === targetProfile.user_id;
        if (!matchesSource && !matchesCreator) return false;
      }

      if (nameSearch) {
        const query = nameSearch.toLowerCase();
        const matchesName = l.name?.toLowerCase().includes(query);
        const matchesEmail = l.email?.toLowerCase().includes(query);
        const matchesPhone = l.phone?.toLowerCase().includes(query);
        const matchesId = String(l.display_id || '').toLowerCase().includes(query) || String(l.unique_id || '').toLowerCase().includes(query);
        if (!matchesName && !matchesEmail && !matchesPhone && !matchesId) return false;
      }

      return true;
    });
  }, [leads, viewMode, monthFilter, dateFrom, dateTo, statusFilter, bdMemberFilter, profiles, user?.id, nameSearch]);

  // ── KPI Calculations (Section 1) ─────────────────────────
  // Total Leads = all leads in the system
  const totalLeads = useMemo(() => {
    return leads ? leads.length : 0;
  }, [leads]);

  // New Leads = leads that are UNASSIGNED (added by BD team but not yet assigned to a Sales TL)
  // These are leads with no assignment OR assignment_type = 'Pending' (salesperson not found)
  const newLeads = useMemo(() => {
    return leads ? leads.filter(l =>
      l.assigned_to === null || (l.assignment_type as string) === 'Pending'
    ).length : 0;
  }, [leads]);

  // Assigned Leads = leads that have been properly assigned to a Sales TL
  const assignedLeads = useMemo(() => {
    return leads ? leads.filter(l =>
      l.assigned_to !== null && (l.assignment_type as string) !== 'Pending'
    ).length : 0;
  }, [leads]);

  const closures = useMemo(() => {
    return leads ? leads.filter(l => l.lead_status === 'Closed').length : 0;
  }, [leads]);

  const displayedLeads = useMemo(() => {
    if (queueTab === 'pending') {
      return filteredLeads.filter(l => l.assignment_type === 'Pending' && l.lead_status !== 'Closed');
    }
    return filteredLeads;
  }, [filteredLeads, queueTab]);

  // ── Team Performance Overview (Section 2) ────────────────
  const teamMetrics = useMemo(() => {
    if (!profiles || !leads) return [];
    // Only map BD Team Members (LEAD_GEN) + TLs
    const bdUsers = profiles.filter(p => true); // In real app, filter by LEAD_GEN role using user_roles join
    
    return bdUsers.map(p => {
      const pLeads = leads.filter(l => l.lead_generated_by === p.user_id);
      const today = new Date().toISOString().split('T')[0];
      const dailyAdded = pLeads.filter(l => l.created_at.startsWith(today)).length;
      const monthlyAdded = pLeads.filter(l => new Date(l.created_at).getMonth() + 1 === parseInt(monthFilter)).length;
      const converted = pLeads.filter(l => l.lead_status === 'Closed').length;

      return { ...p, dailyAdded, monthlyAdded, converted, total: pLeads.length };
    }).filter(p => p.total > 0).sort((a, b) => b.monthlyAdded - a.monthlyAdded);
  }, [leads, profiles, monthFilter]);

  // ── Chart Data (Section 3) ───────────────────────────────
  const chartData = useMemo(() => {
    // 1. Daily Additions
    const dailyMap: Record<string, number> = {};
    // 2. Source Breakdown
    const sourceMap: Record<string, number> = {};
    // 3. Category
    let hot = 0, cold = 0;

    filteredLeads.forEach(l => {
      const date = l.date || l.created_at.split('T')[0];
      dailyMap[date] = (dailyMap[date] || 0) + 1;
      
      const src = l.lead_source || 'Unknown';
      sourceMap[src] = (sourceMap[src] || 0) + 1;

      if (l.lead_category === 'Hot') hot++;
      if (l.lead_category === 'Cold') cold++;
    });

    const dailyTrend = Object.keys(dailyMap).sort().slice(-15).map(date => ({ date, count: dailyMap[date] }));
    const sourceBreakdown = Object.keys(sourceMap).map(src => ({ name: src, value: sourceMap[src] }));
    const categoryBreakdown = [
      { name: 'Hot', value: hot },
      { name: 'Cold', value: cold }
    ];

    return { dailyTrend, sourceBreakdown, categoryBreakdown };
  }, [filteredLeads]);

  // ── SLA & Concerns (Section 5 & 7) ────────────────────────
  const concernLeads = filteredLeads.filter(l => l.concern === true);
  
  const staleLeads = filteredLeads.filter(l => {
    const hoursSinceUpdate = (new Date().getTime() - new Date(l.updated_at).getTime()) / (1000 * 60 * 60);
    return hoursSinceUpdate > 48 && !['Closed', 'Non Interested'].includes(l.lead_status || '');
  });



  // ── Mutations ─────────────────────────────────────────────
  const assignMutation = useMutation({
    mutationFn: async ({ leadId, selection }: { leadId: string; selection: string }) => {
      const [userId, type] = selection.split('_');
      await supabase.from('leads').update({ 
        assigned_to: userId,
        assignment_type: type,
        team_lead_id: userId // Since it's a TL, they are the team owner
      } as any).eq('unique_id', leadId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bdtl-leads-master'] });
      toast.success('Lead assigned successfully');
    }
  });

  const resolveBDConcernMutation = useMutation({
    mutationFn: async (leadId: string) => {
      // Find the unresolved concern for this lead
      const { data: unresolved, error: fetchErr } = await supabase
        .from('concerns')
        .select('id, raised_by')
        .eq('lead_id', leadId)
        .eq('resolved', false)
        .limit(1)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      // Update concern resolved status
      if (unresolved) {
        const { error: err1 } = await supabase.from('concerns').update({ resolved: true }).eq('id', unresolved.id);
        if (err1) throw err1;
      }
      
      // Reset lead concern flag
      const { error: err2 } = await supabase.from('leads').update({ concern: false }).eq('unique_id', leadId);
      if (err2) throw err2;
      
      // Send notification to reporter
      if (unresolved) {
        const { data: lead } = await supabase.from('leads').select('name').eq('unique_id', leadId).single();
        await supabase.from('notifications').insert({
          user_id: unresolved.raised_by,
          title: '✅ Concern Resolved',
          message: `The concern raised for lead "${lead?.name || 'Lead'}" has been resolved by BD Team Lead.`,
          type: 'concern_resolved',
          lead_id: leadId,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bdtl-leads-master'] });
      toast.success('Concern resolved successfully!');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const getProfileName = (id: string | null) => {
    if (!id) return '—';
    return profiles?.find(p => p.user_id === id)?.full_name || 'Unknown';
  };

  const getSalesDropdownOptions = () => {
    if (!profiles || !salesTeams) return [];
    
    const options: any[] = [];
    
    // ONLY show TLs to BD TL
    salesTeams.tls.forEach(tlId => {
      const p = profiles.find(p => p.user_id === tlId);
      if (p) {
        options.push({ value: `${p.user_id}_Personal`, label: `${p.full_name} -- Personal` });
        options.push({ value: `${p.user_id}_Team`, label: `${p.full_name} -- Team` });
      }
    });

    return options;
  };

  if (isLoading) return <div className="p-8 text-center">Loading BD Dashboard...</div>;

  return (
    <div className="space-y-8 pb-12">
      
      {/* ── Global Header & Filters ── */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 sticky top-0 bg-background/80 backdrop-blur z-20 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-display font-bold">BD Team Lead Dashboard</h1>
          <p className="text-sm text-muted-foreground">Monitor performance, control assignments, and track SLAs.</p>
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
            <SelectTrigger className="w-32"><SelectValue placeholder="Month" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="New">New</SelectItem>
              <SelectItem value="Assigned">Assigned</SelectItem>
              <SelectItem value="Closed">Closed</SelectItem>
            </SelectContent>
          </Select>

          {viewMode === 'team' && (
            <Select value={bdMemberFilter} onValueChange={setBdMemberFilter}>
              <SelectTrigger className="w-56"><SelectValue placeholder="All BD Members" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All BD Members</SelectItem>
                {bdMembersList.map(email => (
                  <SelectItem key={email} value={email}>{email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex items-center gap-1.5 bg-background px-2.5 rounded-md border border-input h-10 shrink-0">
            <span className="text-xs text-muted-foreground font-medium pr-1 select-none">Date:</span>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[120px] h-8 text-xs border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-accent/40 rounded-sm px-1.5" title="From Date" />
            <span className="text-muted-foreground text-xs px-0.5 select-none">—</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[120px] h-8 text-xs border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-accent/40 rounded-sm px-1.5" title="To Date" />
          </div>
        </div>
      </div>

      {/* ── SECTION 1: KPI Cards ── */}
      {viewMode !== 'global' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="glass-card nb-glow"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Leads</CardTitle><Users className="h-4 w-4 text-primary absolute right-4 top-4" /></CardHeader><CardContent><div className="text-3xl font-display font-bold">{totalLeads}</div></CardContent></Card>
          <Card className="glass-card"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Unassigned Leads</CardTitle><Plus className="h-4 w-4 text-blue-500 absolute right-4 top-4" /></CardHeader><CardContent><div className="text-3xl font-display font-bold">{newLeads}</div></CardContent></Card>
          <Card className="glass-card"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Assigned Leads</CardTitle><UserPlus className="h-4 w-4 text-amber-500 absolute right-4 top-4" /></CardHeader><CardContent><div className="text-3xl font-display font-bold">{assignedLeads}</div></CardContent></Card>
          <Card className="glass-card"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Closures</CardTitle><CheckCircle className="h-4 w-4 text-green-500 absolute right-4 top-4" /></CardHeader><CardContent><div className="text-3xl font-display font-bold">{closures}</div></CardContent></Card>
        </div>
      )}

      {/* ── SLA & Concerns Alerts (Sections 5 & 7) ── */}
      {viewMode !== 'global' && (concernLeads.length > 0 || staleLeads.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      onClick={() => resolveBDConcernMutation.mutate(l.unique_id)}
                      disabled={resolveBDConcernMutation.isPending}
                    >
                      Resolve
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          
          {staleLeads.length > 0 && (
            <Card className="border-red-500/50 bg-red-500/5 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-red-600 flex items-center"><Clock className="h-4 w-4 mr-2" /> Stale Leads ({staleLeads.length})</CardTitle></CardHeader>
              <CardContent className="space-y-2 max-h-40 overflow-y-auto">
                {staleLeads.map(l => (
                  <div key={l.unique_id} className="text-xs p-2 bg-background rounded border border-red-500/20">
                    <span className="font-semibold">{l.name}</span> — No update &gt; 48h
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── SECTION 3: Analytics Charts ── */}
      {viewMode !== 'global' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-sm font-medium">Daily Lead Addition Trend</CardTitle></CardHeader>
            <CardContent className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData.dailyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{fontSize: 10}} />
                  <YAxis tick={{fontSize: 10}} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader><CardTitle className="text-sm font-medium">Lead Categories Breakdown</CardTitle></CardHeader>
            <CardContent className="h-[250px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData.categoryBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}>
                    <Cell fill="#ef4444" />
                    <Cell fill="#3b82f6" />
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── SECTION 2: Team Performance Overview ── */}
      {viewMode === 'team' && (
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-lg font-display">BD Team Performance</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-2 text-muted-foreground font-medium">BD Member</th>
                    <th className="text-left p-2 text-muted-foreground font-medium">Daily Added</th>
                    <th className="text-left p-2 text-muted-foreground font-medium">Monthly Added</th>
                    <th className="text-left p-2 text-muted-foreground font-medium">Converted</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMetrics.map(tm => (
                    <tr key={tm.id} className="border-b border-border/50 hover:bg-accent/30">
                      <td className="p-2 font-medium">{tm.full_name}</td>
                      <td className="p-2">{tm.dailyAdded}</td>
                      <td className="p-2">{tm.monthlyAdded}</td>
                      <td className="p-2 text-green-500 font-bold">{tm.converted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── SECTION 4: Lead Management Table ── */}
      <Card className="glass-card">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg font-display">Lead Management Queue</CardTitle>
            <div className="flex gap-1 bg-accent/40 rounded p-1">
              <Button
                variant={queueTab === 'pending' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs px-3"
                onClick={() => setQueueTab('pending')}
              >
                Pending ({leads ? leads.filter(l => l.assignment_type === 'Pending' && l.lead_status !== 'Closed').length : 0})
              </Button>
              <Button
                variant={queueTab === 'all' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs px-3"
                onClick={() => setQueueTab('all')}
              >
                All Leads
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline"><Shuffle className="h-3.5 w-3.5 mr-2"/> Round Robin All</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-2 text-muted-foreground font-medium">Name</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Email</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Phone</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">LinkedIn</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Tech / Uni</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Source</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Category</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Status</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Generated By</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Assignment</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedLeads.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-8 text-muted-foreground">
                      No leads in this queue.
                    </td>
                  </tr>
                ) : (
                  displayedLeads.slice(0, 50).map(lead => (
                    <tr key={lead.unique_id} className={`border-b border-border/50 hover:bg-accent/30 ${lead.concern ? 'bg-orange-500/10' : ''}`}>
                      <td className="p-2">
                        <div className="font-medium">{lead.name}</div>
                        <div className="text-xs text-muted-foreground">ID: {(lead as any).display_id}</div>
                      </td>
                      <td className="p-2 text-xs">{lead.email}</td>
                      <td className="p-2 text-xs">{lead.phone || '—'}</td>
                      <td className="p-2 text-xs">
                        {lead.linkedin_url ? (
                          <a href={lead.linkedin_url} target="_blank" rel="noreferrer" className="text-primary underline text-xs">View</a>
                        ) : '—'}
                      </td>
                      <td className="p-2">
                        <div className="text-xs">{lead.technology || '—'}</div>
                        <div className="text-xs text-muted-foreground">{lead.university || '—'}</div>
                      </td>
                      <td className="p-2 text-xs">{lead.lead_source}</td>
                      <td className="p-2">
                        <Badge variant="outline" className={lead.lead_category === 'Hot' ? 'border-amber-500 text-amber-500' : ''}>{lead.lead_category}</Badge>
                      </td>
                      <td className="p-2">
                        <span className="text-xs bg-secondary px-2 py-1 rounded-full">{lead.lead_status}</span>
                      </td>
                      <td className="p-2 text-xs">{getProfileName(lead.lead_generated_by)}</td>
                      
                      {/* MANUAL ASSIGNMENT LOGIC */}
                      <td className="p-2">
                        {lead.assigned_to && lead.assignment_type !== 'Pending' ? (
                          <div className="text-xs text-primary flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" /> {getProfileName(lead.assigned_to)}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <Select onValueChange={v => assignMutation.mutate({ leadId: lead.unique_id, selection: v })}>
                              <SelectTrigger className="w-32 h-7 text-xs">
                                <SelectValue placeholder="Assign To..." />
                              </SelectTrigger>
                              <SelectContent>
                                {getSalesDropdownOptions().map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {lead.assigned_to && (
                              <span className="text-[10px] text-muted-foreground block mt-0.5">
                                Current: {getProfileName(lead.assigned_to)}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => setDetailsLead(lead)}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

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

export default BDDashboard;

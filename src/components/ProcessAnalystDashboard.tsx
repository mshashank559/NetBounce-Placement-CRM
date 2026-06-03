import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllLeads } from '@/lib/leads';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  TrendingUp, 
  Phone, 
  CheckCircle, 
  Search, 
  Filter, 
  RefreshCw,
  UserCircle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  DollarSign,
  Bell,
  Clock,
  BarChart3,
  Activity,
  ArrowUpRight,
  AlertTriangle,
  LayoutDashboard,
  PieChart as PieChartIcon
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { format, subDays, isBefore, parseISO, isSameDay } from 'date-fns';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ElementType;
  delay?: number;
}> = ({ title, value, icon: Icon, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay }}
  >
    <Card className="glass-card hover:nb-glow transition-all duration-300 border-primary/10 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
        <Icon className="h-12 w-12 text-primary" />
      </div>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="p-2 bg-primary/10 rounded-lg">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-display font-bold">{value}</div>
      </CardContent>
    </Card>
  </motion.div>
);

const ProcessAnalystDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('analytics');
  const [monthFilter, setMonthFilter] = useState(() => format(new Date(), 'yyyy-MM'));
  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Queries (READ ONLY)
  const { data: leads } = useQuery({
    queryKey: ['all-leads-pa'],
    queryFn: fetchAllLeads,
  });

  const { data: profiles } = useQuery({
    queryKey: ['all-profiles-pa'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: userRoles } = useQuery({
    queryKey: ['all-user-roles-pa'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_roles').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: callLogs } = useQuery({
    queryKey: ['all-call-logs-pa'],
    queryFn: async () => {
      const { data, error } = await supabase.from('call_logs').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: leadClosures } = useQuery({
    queryKey: ['all-closures-pa'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lead_closures').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: notifications } = useQuery({
    queryKey: ['all-notifications-pa'],
    queryFn: async () => {
      const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: concerns } = useQuery({
    queryKey: ['all-concerns-pa'],
    queryFn: async () => {
      const { data, error } = await supabase.from('concerns').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const allUsers = useMemo(() => {
    if (!profiles || !userRoles) return [];
    const roleMap: Record<string, string> = {};
    userRoles.forEach(r => { roleMap[r.user_id] = r.role; });
    return profiles.map(p => ({
      ...p,
      role: roleMap[p.user_id] || 'Unknown',
      team: roleMap[p.user_id]?.startsWith('SALES') ? 'Sales' : roleMap[p.user_id]?.startsWith('LEAD') ? 'Lead Gen' : 'Admin'
    }));
  }, [profiles, userRoles]);

  // Filtering Logic
  const filteredData = useMemo(() => {
    if (!leads || !leadClosures) return { leads: [], closures: [] };
    let fLeads = leads;
    let fClosures = leadClosures;

    if (monthFilter && monthFilter !== 'all') {
      const [year, month] = monthFilter.split('-').map(Number);
      fLeads = fLeads.filter(l => { const d = new Date(l.created_at); return d.getFullYear() === year && d.getMonth() + 1 === month; });
      fClosures = fClosures.filter(c => { const d = new Date(c.created_at); return d.getFullYear() === year && d.getMonth() + 1 === month; });
    }
    if (statusFilter !== 'all') fLeads = fLeads.filter(l => l.lead_status === statusFilter);
    if (teamFilter !== 'all') {
      const teamUserIds = allUsers.filter(u => u.team === teamFilter).map(u => u.user_id);
      fLeads = fLeads.filter(l => (teamFilter === 'Lead Gen' && teamUserIds.includes(l.lead_generated_by || '')) || (teamFilter === 'Sales' && teamUserIds.includes(l.assigned_to || '')));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      fLeads = fLeads.filter(l => l.name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q) || (l.display_id || '').toLowerCase().includes(q));
    }
    return { leads: fLeads, closures: fClosures };
  }, [leads, leadClosures, monthFilter, statusFilter, teamFilter, searchQuery, allUsers]);

  // Revenue Calculations
  const revenueStats = useMemo(() => {
    const calcRevenue = (closure: any) => closure.amount || 0;
    const total = filteredData.closures.reduce((sum, c) => sum + calcRevenue(c), 0);
    const salesTeamIds = allUsers.filter(u => u.team === 'Sales').map(u => u.user_id);
    const leadGenTeamIds = allUsers.filter(u => u.team === 'Lead Gen').map(u => u.user_id);
    return {
      total,
      team: {
        Sales: filteredData.closures.filter(c => salesTeamIds.includes(leads?.find(l => l.unique_id === c.lead_id)?.assigned_to || '')).reduce((sum, c) => sum + calcRevenue(c), 0),
        LeadGen: filteredData.closures.filter(c => leadGenTeamIds.includes(leads?.find(l => l.unique_id === c.lead_id)?.lead_generated_by || '')).reduce((sum, c) => sum + calcRevenue(c), 0)
      }
    };
  }, [filteredData.closures, allUsers, leads]);

  const analyticsData = useMemo(() => {
    const last15Days = Array.from({ length: 15 }).map((_, i) => {
      const d = subDays(new Date(), 14 - i);
      return { name: format(d, 'MMM dd'), count: leads?.filter(l => isSameDay(parseISO(l.created_at), d)).length || 0 };
    });
    const statusMap: Record<string, number> = {};
    leads?.forEach(l => { statusMap[l.lead_status || 'Unknown'] = (statusMap[l.lead_status || 'Unknown'] || 0) + 1; });
    return { inflow: last15Days, funnel: [{ name: 'Total', value: leads?.length || 0 }, { name: 'Qualified', value: leads?.filter(l => l.lead_status === 'Qualified').length || 0 }, { name: 'Hot', value: leads?.filter(l => l.lead_status === 'Hot Prospect').length || 0 }, { name: 'Closed', value: leads?.filter(l => l.lead_status === 'Closed').length || 0 }], status: Object.entries(statusMap).map(([name, value]) => ({ name, value })) };
  }, [leads]);

  const slaAlerts = useMemo(() => {
    if (!leads) return [];
    const today = new Date();
    return leads.filter(l => {
      if (['Closed', 'Non Interested'].includes(l.lead_status || '')) return false;
      const lastUpdate = parseISO(l.updated_at);
      return !isSameDay(lastUpdate, today) || isBefore(lastUpdate, subDays(today, 2));
    });
  }, [leads]);

  const teamPerformance = useMemo(() => {
    const teams = [{ name: 'Lead Gen Team', roles: ['LEAD_TL', 'LEAD_GEN'] }, { name: 'Sales Team', roles: ['SALES_TL', 'SALES_TM'] }];
    return teams.map(team => {
      const teamUsers = allUsers.filter(u => team.roles.includes(u.role));
      const teamUserIds = teamUsers.map(u => u.user_id);
      const teamLeads = leads?.filter(l => (team.name === 'Lead Gen Team' && teamUserIds.includes(l.lead_generated_by || '')) || (team.name === 'Sales Team' && teamUserIds.includes(l.assigned_to || ''))) || [];
      return {
        name: team.name,
        leads: teamLeads.length,
        closures: teamLeads.filter(l => l.lead_status === 'Closed').length,
        calls: callLogs?.filter(c => teamUserIds.includes(c.user_id)).reduce((sum, c) => sum + (c.call_count || 0), 0) || 0,
        members: teamUsers.map(u => ({ id: u.user_id, name: u.full_name, role: u.role, leads: (leads?.filter(l => (team.name === 'Lead Gen Team' && l.lead_generated_by === u.user_id) || (team.name === 'Sales Team' && l.assigned_to === u.user_id)) || []).length }))
      };
    });
  }, [allUsers, leads, callLogs]);

  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'New': return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">New</Badge>;
      case 'Closed': return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Closed</Badge>;
      case 'Hot Prospect': return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Hot Prospect</Badge>;
      case 'Non Interested': return <Badge className="bg-slate-500/10 text-slate-500 border-slate-500/20">Non Interested</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 bg-background/50 backdrop-blur-xl p-6 rounded-2xl border border-primary/10 shadow-2xl sticky top-0 z-30">
        <div className="flex items-center gap-4"><div className="p-3 bg-primary/10 rounded-xl"><LayoutDashboard className="h-6 w-6 text-primary" /></div><div><h1 className="text-2xl font-display font-bold tracking-tight nb-gradient bg-clip-text text-transparent">Process Analyst Dashboard</h1><p className="text-muted-foreground text-[10px] font-medium uppercase tracking-widest mt-0.5">Intelligence & Monitoring Engine</p></div></div>
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="bg-accent/30 p-1 rounded-lg border border-border/50"><TabsList className="bg-transparent border-none"><TabsTrigger value="analytics" className="data-[state=active]:bg-background text-xs">Analytics</TabsTrigger><TabsTrigger value="leads" className="data-[state=active]:bg-background text-xs">Leads View</TabsTrigger><TabsTrigger value="monitoring" className="data-[state=active]:bg-background text-xs">Monitoring</TabsTrigger></TabsList></Tabs>
          <div className="h-8 w-[1px] bg-border/50 mx-1" />
          <Select value={monthFilter} onValueChange={setMonthFilter}><SelectTrigger className="w-36 h-9 bg-accent/30 border-border/50 text-xs"><SelectValue placeholder="Month" /></SelectTrigger><SelectContent><SelectItem value="all">All Time</SelectItem>{["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => { const val = `${new Date().getFullYear()}-${String(i + 1).padStart(2, '0')}`; return <SelectItem key={val} value={val}>{m}</SelectItem>; })}</SelectContent></Select>
          <Select value={teamFilter} onValueChange={setTeamFilter}><SelectTrigger className="w-32 h-9 bg-accent/30 border-border/50 text-xs"><SelectValue placeholder="Team" /></SelectTrigger><SelectContent><SelectItem value="all">All Teams</SelectItem><SelectItem value="Lead Gen">Lead Gen</SelectItem><SelectItem value="Sales">Sales</SelectItem></SelectContent></Select>
          <div className="relative w-48 h-9"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input placeholder="Search..." className="pl-9 h-full bg-accent/30 border-border/50 focus-visible:ring-primary/30 text-xs" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'analytics' && (
          <motion.div key="analytics" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard title="Total Leads" value={filteredData.leads.length} icon={Users} delay={0} />
              <StatCard title="Active Leads" value={filteredData.leads.filter(l => !['Closed', 'Non Interested'].includes(l.lead_status || '')).length} icon={TrendingUp} delay={0.1} />
              <StatCard title="Closures" value={filteredData.leads.filter(l => l.lead_status === 'Closed').length} icon={CheckCircle} delay={0.2} />
              <StatCard title="Total Calls" value={callLogs?.reduce((sum, c) => sum + (c.call_count || 0), 0) || 0} icon={Phone} delay={0.3} />
              <StatCard title="Revenue" value={`$${revenueStats.total.toLocaleString()}`} icon={DollarSign} delay={0.4} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="glass-card"><CardHeader><CardTitle className="text-lg font-display flex items-center gap-2"><DollarSign className="h-5 w-5 text-green-500" /> Revenue Analytics</CardTitle></CardHeader><CardContent className="h-[250px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{ name: 'Sales', value: revenueStats.team.Sales }, { name: 'Lead Gen', value: revenueStats.team.LeadGen }]} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"><Cell fill={COLORS[0]} /><Cell fill={COLORS[1]} /></Pie><Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} /><Legend verticalAlign="bottom" /></PieChart></ResponsiveContainer></CardContent></Card>
              <Card className="glass-card lg:col-span-2"><CardHeader><CardTitle className="text-lg font-display flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> Daily Activity Flow</CardTitle></CardHeader><CardContent className="h-[250px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={analyticsData.inflow}><defs><linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs><XAxis dataKey="name" tick={{fontSize: 10}} /><YAxis tick={{fontSize: 10}} /><Tooltip /><Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorInflow)" /></AreaChart></ResponsiveContainer></CardContent></Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="glass-card"><CardHeader><CardTitle className="text-lg font-display flex items-center gap-2"><BarChart3 className="h-5 w-5 text-amber-500" /> Lead Funnel</CardTitle></CardHeader><CardContent className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart layout="vertical" data={analyticsData.funnel}><XAxis type="number" hide /><YAxis dataKey="name" type="category" tick={{fontSize: 12}} /><Tooltip /><Bar dataKey="value" radius={[0, 4, 4, 0]}>{analyticsData.funnel.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer></CardContent></Card>
              <Card className="glass-card"><CardHeader><CardTitle className="text-lg font-display flex items-center gap-2"><PieChartIcon className="h-5 w-5 text-purple-500" /> Status Distribution</CardTitle></CardHeader><CardContent className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={analyticsData.status} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({name}) => name}>{analyticsData.status.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></CardContent></Card>
            </div>

            <Card className="glass-card"><CardHeader><CardTitle className="text-xl font-display">Team Contribution Analysis</CardTitle></CardHeader><CardContent className="space-y-4">{teamPerformance.map(team => (<div key={team.name} className="border border-border/50 rounded-xl overflow-hidden bg-accent/5"><div className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/20 transition-colors" onClick={() => setExpandedTeam(expandedTeam === team.name ? null : team.name)}><div className="flex items-center gap-3">{expandedTeam === team.name ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}<span className="font-bold">{team.name}</span></div><div className="flex gap-10"><div className="text-center"><p className="text-[10px] uppercase text-muted-foreground">Generated</p><p className="font-bold">{team.leads}</p></div><div className="text-center"><p className="text-[10px] uppercase text-muted-foreground">Closures</p><p className="font-bold text-green-500">{team.closures}</p></div><div className="text-center"><p className="text-[10px] uppercase text-muted-foreground">Calls</p><p className="font-bold text-blue-500">{team.calls}</p></div></div></div>{expandedTeam === team.name && (<div className="p-4 border-t border-border/50 bg-background/50"><Table><TableHeader><TableRow><TableHead>Member</TableHead><TableHead className="text-center">Leads</TableHead></TableRow></TableHeader><TableBody>{team.members.map(m => (<TableRow key={m.id}><TableCell className="text-xs font-medium">{m.name}</TableCell><TableCell className="text-center text-xs font-bold">{m.leads}</TableCell></TableRow>))}</TableBody></Table></div>)}</div>))}</CardContent></Card>
          </motion.div>
        )}

        {activeTab === 'leads' && (
          <motion.div key="leads" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card className="glass-card overflow-hidden"><CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-accent/5"><div><CardTitle className="text-xl font-display">System Leads View (Read-Only)</CardTitle><CardDescription>Full visibility without modification access</CardDescription></div><Badge className="nb-gradient border-none">{filteredData.leads.length} Records</Badge></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader className="bg-accent/50"><TableRow><TableHead className="text-xs">Candidate</TableHead><TableHead className="text-xs">Assigned To</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-xs">Activity</TableHead></TableRow></TableHeader><TableBody>{filteredData.leads.slice(0, 20).map(lead => (<TableRow key={lead.unique_id}><TableCell className="text-xs font-bold">{lead.name}<p className="text-[10px] font-normal text-muted-foreground">{lead.email}</p></TableCell><TableCell className="text-xs">{allUsers.find(u => u.user_id === lead.assigned_to)?.full_name || 'Unassigned'}</TableCell><TableCell>{getStatusBadge(lead.lead_status || '')}</TableCell><TableCell className="text-[10px] text-muted-foreground font-mono">{format(parseISO(lead.updated_at), 'dd MMM, HH:mm')}</TableCell></TableRow>))}</TableBody></Table></div></CardContent></Card>
          </motion.div>
        )}

        {activeTab === 'monitoring' && (
          <motion.div key="monitoring" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Card className="glass-card border-red-500/20 bg-red-500/5"><CardHeader className="pb-2 text-red-500 flex flex-row items-center justify-between"><CardTitle className="text-lg font-display flex items-center gap-2"><Clock className="h-5 w-5" /> SLA Monitoring</CardTitle><Badge variant="destructive" className="animate-pulse">{slaAlerts.length} Alerts</Badge></CardHeader><CardContent className="p-0"><div className="max-h-[350px] overflow-y-auto"><Table><TableHeader className="bg-red-500/10"><TableRow><TableHead className="text-xs">Lead</TableHead><TableHead className="text-xs">Assigned</TableHead><TableHead className="text-xs text-right">Status</TableHead></TableRow></TableHeader><TableBody>{slaAlerts.slice(0, 10).map(l => (<TableRow key={l.unique_id} className="border-red-500/10"><TableCell className="text-xs font-bold">{l.name}</TableCell><TableCell className="text-xs">{allUsers.find(u => u.user_id === l.assigned_to)?.full_name || 'Unassigned'}</TableCell><TableCell className="text-right text-[10px] font-bold text-red-500">INACTIVE</TableCell></TableRow>))}</TableBody></Table></div></CardContent></Card>
              <Card className="glass-card border-amber-500/20 bg-amber-500/5"><CardHeader className="pb-2 text-amber-500"><CardTitle className="text-lg font-display flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Concern Center</CardTitle></CardHeader><CardContent className="p-0"><div className="max-h-[350px] overflow-y-auto"><Table><TableHeader className="bg-amber-500/10"><TableRow><TableHead className="text-xs">Lead</TableHead><TableHead className="text-xs">Issue</TableHead></TableRow></TableHeader><TableBody>{concerns?.slice(0, 10).map(c => (<TableRow key={c.id} className="border-amber-500/10"><TableCell className="text-xs font-bold">{leads?.find(l => l.unique_id === c.lead_id)?.name || 'Unknown'}</TableCell><TableCell className="text-xs italic">"{c.description}"</TableCell></TableRow>))}</TableBody></Table></div></CardContent></Card>
            </div>
            <Card className="glass-card"><CardHeader><CardTitle className="text-lg font-display flex items-center gap-2"><Bell className="h-5 w-5 text-primary animate-bell-shake" /> Notification Monitoring</CardTitle></CardHeader><CardContent className="p-0"><div className="max-h-[400px] overflow-y-auto divide-y divide-border/50">{notifications?.slice(0, 20).map(n => (<div key={n.id} className="p-4 hover:bg-accent/20 flex items-start gap-4"><div className="p-2 rounded-full bg-primary/10 text-primary"><Activity className="h-4 w-4" /></div><div className="flex-1"><p className="text-sm font-bold">{n.title}</p><p className="text-xs text-muted-foreground">{n.message}</p><p className="text-[9px] text-muted-foreground mt-1 font-mono uppercase">{format(parseISO(n.created_at), 'PPPP p')}</p></div></div>))}</div></CardContent></Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProcessAnalystDashboard;

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
import { TrendingUp, CheckCircle, Phone, DollarSign, AlertTriangle, Clock, UserPlus, Eye, Search, RefreshCw } from 'lucide-react';
import LeadDetailDialog from './LeadDetailDialog';
import {
  LineChart, Line, BarChart, Bar, LabelList,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell
} from 'recharts';

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const STATUS_FUNNEL = ['New','DNR1','DNR2','DNR3','Connected','Qualified','Hot Prospect','Closed'];

interface SalesTLReassignDropdownMenuProps {
  candidates: any[];
  onSelect: (memberId: string) => void;
  onClose: () => void;
}

const SalesTLReassignDropdownMenu: React.FC<SalesTLReassignDropdownMenuProps> = ({ candidates, onSelect, onClose }) => {
  const [search, setSearch] = React.useState('');
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [onClose]);

  const filteredCandidates = React.useMemo(() => {
    const sorted = [...candidates].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter(c => (c.full_name || '').toLowerCase().includes(q));
  }, [candidates, search]);

  return (
    <div
      ref={menuRef}
      className="absolute right-0 mt-1.5 w-60 rounded-md border border-border bg-popover text-popover-foreground shadow-md z-50 p-1 flex flex-col max-h-[300px]"
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border/50">
        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <Input
          placeholder="Search team member..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 text-xs border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
      <div className="overflow-y-auto flex-1 mt-1 space-y-0.5 max-h-[220px]">
        {filteredCandidates.length === 0 ? (
          <div className="text-[11px] text-muted-foreground text-center py-2">No team members found</div>
        ) : (
          filteredCandidates.map((c) => (
            <button
              key={c.user_id}
              onClick={() => onSelect(c.user_id)}
              className="w-full text-left px-2 py-1.5 text-xs rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {c.full_name}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

const SalesTLDashboard: React.FC = () => {
  const { user, profile, role } = useAuth();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState('team'); // 'personal', 'team', or 'global'
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [reassigningLeadId, setReassigningLeadId] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState(() => String(new Date().getMonth() + 1));
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [globalMemberFilter, setGlobalMemberFilter] = useState('all');
  const [globalLeadGenFilter, setGlobalLeadGenFilter] = useState('all');
  const [leadsPage, setLeadsPage] = useState(1);
  const PAGE_SIZE = 50;

  React.useEffect(() => {
    setLeadsPage(1);
  }, [viewMode, monthFilter, dateFrom, dateTo, nameSearch, statusFilter, globalMemberFilter, globalLeadGenFilter]);

  // ── Fetch all team leads (assigned to me or my team) ──
  const { data: leads = [] } = useQuery({
    queryKey: ['salestl-leads', user?.id, role],
    queryFn: async () => {
      if (role === 'SALES_TL') {
        const { data: teamProfiles } = await supabase
          .from('profiles')
          .select('user_id')
          .or(`reports_to.eq.${user!.id},user_id.eq.${user!.id}`);
        const teamUserIds = teamProfiles?.map(p => p.user_id) || [user!.id];
        
        let allLeads: any[] = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;
        
        while (hasMore) {
          const { data, error } = await supabase
            .from('leads')
            .select('*')
            .or(`assigned_to.in.(${teamUserIds.join(',')}),team_lead_id.eq.${user!.id}`)
            .order('created_at', { ascending: false })
            .range(from, from + step - 1);
            
          if (error) throw error;
          
          if (data && data.length > 0) {
            allLeads = [...allLeads, ...data];
            if (data.length < step) {
              hasMore = false;
            } else {
              from += step;
            }
          } else {
            hasMore = false;
          }
        }
        return allLeads;
      } else {
        return fetchAllLeads();
      }
    },
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

  // ── Fetch all sales users (TLs and TMs) for global view dropdown ──
  const { data: globalSalesUsers = [] } = useQuery({
    queryKey: ['global-sales-users', user?.id, role],
    queryFn: async () => {
      let query = supabase.from('profiles').select('user_id, full_name');
      if (role === 'SALES_TL') {
        query = query.or(`reports_to.eq.${user!.id},user_id.eq.${user!.id}`);
      } else {
        const { data: roles } = await supabase.from('user_roles').select('user_id').in('role', ['SALES_TM', 'SALES_TL']);
        if (!roles?.length) return [];
        const userIds = roles.map(r => r.user_id);
        query = query.in('user_id', userIds);
      }
      const { data: profilesData } = await query;
      return (profilesData || []).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    },
    enabled: !!user,
  });

  // ── Fetch all BD users (LEAD_GEN and LEAD_TL) for global view dropdown ──
  const { data: bdUsers = [] } = useQuery({
    queryKey: ['global-bd-users-stl'],
    queryFn: async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id').in('role', ['LEAD_GEN', 'LEAD_TL']);
      if (!roles?.length) return [];
      const userIds = roles.map(r => r.user_id);
      const { data: profilesData } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
      return (profilesData || []).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    },
    enabled: !!user,
  });

  // ── Call logs ──
  const { data: callLogs = [] } = useQuery({
    queryKey: ['all-call-logs', user?.id, role],
    queryFn: async () => {
      let query = supabase.from('call_logs').select('*');
      if (role === 'SALES_TL') {
        const { data: teamProfiles } = await supabase
          .from('profiles')
          .select('user_id')
          .or(`reports_to.eq.${user!.id},user_id.eq.${user!.id}`);
        const teamUserIds = teamProfiles?.map(p => p.user_id) || [user!.id];
        const { data: leadsInTeam } = await supabase
          .from('leads')
          .select('unique_id')
          .or(`assigned_to.in.(${teamUserIds.join(',')}),team_lead_id.eq.${user!.id}`);
        const teamLeadIds = leadsInTeam?.map(l => l.unique_id) || [];
        if (teamLeadIds.length === 0) return [];
        query = query.in('lead_id', teamLeadIds);
      }
      const { data } = await query;
      return data || [];
    },
    enabled: !!user,
  });

  // ── Closures with payment ──
  const { data: closureData = [] } = useQuery({
    queryKey: ['all-closures', user?.id, role],
    queryFn: async () => {
      let query = supabase.from('lead_closures').select('*');
      if (role === 'SALES_TL') {
        const { data: teamProfiles } = await supabase
          .from('profiles')
          .select('user_id')
          .or(`reports_to.eq.${user!.id},user_id.eq.${user!.id}`);
        const teamUserIds = teamProfiles?.map(p => p.user_id) || [user!.id];
        const { data: leadsInTeam } = await supabase
          .from('leads')
          .select('unique_id')
          .or(`assigned_to.in.(${teamUserIds.join(',')}),team_lead_id.eq.${user!.id}`);
        const teamLeadIds = leadsInTeam?.map(l => l.unique_id) || [];
        if (teamLeadIds.length === 0) return [];
        query = query.in('lead_id', teamLeadIds);
      }
      const { data } = await query;
      return data || [];
    },
    enabled: !!user,
  });

  // ── Filters ──
  const myTeamIds = useMemo(() => new Set(salesMembers.map(m => m.user_id)), [salesMembers]);

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      if (viewMode === 'personal' && l.assigned_to !== user?.id) return false;
      if (viewMode === 'team') {
        if (!l.assigned_to || (!myTeamIds.has(l.assigned_to) && l.assigned_to !== user?.id)) return false;
      }
      if (viewMode === 'global') {
        if (role === 'SALES_TL') {
          if (!l.assigned_to || (!myTeamIds.has(l.assigned_to) && l.assigned_to !== user?.id)) return false;
        } else {
          if (!l.assigned_to) return false;
        }
      }
      // Global view member filter
      if (viewMode === 'global' && globalMemberFilter !== 'all' && l.assigned_to !== globalMemberFilter) return false;
      if (viewMode === 'global' && globalLeadGenFilter !== 'all' && l.lead_generated_by !== globalLeadGenFilter) return false;
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
  }, [leads, viewMode, monthFilter, dateFrom, dateTo, nameSearch, statusFilter, user?.id, myTeamIds, globalMemberFilter, globalLeadGenFilter]);

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
    return closureData
      .filter(c => filteredLeadIds.has(c.lead_id))
      .reduce((s, c) => {
        const s1 = c.slot1 ? (Number(c.slot1_amount) || 0) : 0;
        const s2 = c.slot2 ? (Number(c.slot2_amount) || 0) : 0;
        let additional = 0;
        if (Array.isArray(c.additional_slots)) {
          c.additional_slots.forEach((slot: any) => {
            if (slot.paid === true) {
              additional += Number(slot.amount) || 0;
            }
          });
        }
        return s + s1 + s2 + additional;
      }, 0);
  }, [closureData, filteredLeadIds]);

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

  // ── Sales TL Within-Team Reassignment ──
  const salesReassignLead = useMutation({
    mutationFn: async ({ leadId, newMemberId }: { leadId: string; newMemberId: string }) => {
      const { data: lead, error: fetchErr } = await supabase
        .from('leads')
        .select('name, assigned_to')
        .eq('unique_id', leadId)
        .single();
      if (fetchErr) throw fetchErr;

      const leadName = lead?.name || 'Lead';
      const oldAssigneeId = lead?.assigned_to;

      const { error: updateErr } = await supabase
        .from('leads')
        .update({
          assigned_to: newMemberId,
          assignment_type: 'Personal',
          team_lead_id: user!.id
        } as any)
        .eq('unique_id', leadId);
      if (updateErr) throw updateErr;

      await supabase.from('lead_history_logs').insert({
        lead_id: leadId,
        changed_by: user!.id,
        action_type: 'OWNER_CHANGE',
        old_value: oldAssigneeId || 'Unassigned',
        new_value: newMemberId,
        comments: `Reassigned within team by Sales TL.`
      });

      const oldName = oldAssigneeId ? (profiles.find(p => p.user_id === oldAssigneeId)?.full_name || 'former salesperson') : 'unassigned';
      const newName = profiles.find(p => p.user_id === newMemberId)?.full_name || 'new salesperson';

      const notifs: any[] = [];
      notifs.push({
        user_id: newMemberId,
        title: 'Lead Reassigned to You',
        message: `Lead "${leadName}" has been reassigned to you from ${oldName}.`,
        type: 'reassign',
        lead_id: leadId
      });

      if (oldAssigneeId && oldAssigneeId !== newMemberId) {
        notifs.push({
          user_id: oldAssigneeId,
          title: 'Lead Reassigned Away',
          message: `Lead "${leadName}" has been reassigned from you to ${newName}.`,
          type: 'reassign',
          lead_id: leadId
        });
      }

      if (user!.id !== newMemberId && user!.id !== oldAssigneeId) {
        notifs.push({
          user_id: user!.id,
          title: 'Lead Reassigned within Team',
          message: `You reassigned Lead "${leadName}" from ${oldName} to ${newName}.`,
          type: 'reassign',
          lead_id: leadId
        });
      }

      await supabase.from('notifications').insert(notifs);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salestl-leads'] });
      toast.success('Lead reassigned successfully within team!');
    },
    onError: (err: Error) => toast.error(err.message),
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
                <p className="text-2xl font-bold text-green-500">${closureData.filter(c => filteredLeadIds.has(c.lead_id)).reduce((s, c) => s + (c.upfront_amount || 0), 0).toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-lg bg-accent/30 text-center">
                <p className="text-xs text-muted-foreground">Pending Slots</p>
                <p className="text-2xl font-bold text-blue-500">${closureData.filter(c => filteredLeadIds.has(c.lead_id)).reduce((s, c) => {
                  const s1 = !c.slot1 ? (Number(c.slot1_amount) || 0) : 0;
                  const s2 = !c.slot2 ? (Number(c.slot2_amount) || 0) : 0;
                  let additional = 0;
                  if (Array.isArray(c.additional_slots)) {
                    c.additional_slots.forEach((slot: any) => {
                      if (!slot.paid) {
                        additional += Number(slot.amount) || 0;
                      }
                    });
                  }
                  return s + s1 + s2 + additional;
                }, 0).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SECTION 4: All Team Leads Table */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-display">
                {viewMode === 'global' ? 'Global Leads' : 'Team Leads'} ({filteredLeads.length})
              </CardTitle>
            </div>
            {/* Global View Filters */}
            {viewMode === 'global' && (
              <div className="flex flex-wrap items-center gap-3">
                <Select value={globalMemberFilter} onValueChange={setGlobalMemberFilter}>
                  <SelectTrigger className="w-44 h-8 text-xs bg-accent/30 border-border/50">
                    <SelectValue placeholder="All Members" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Members</SelectItem>
                    {globalSalesUsers.map((u: any) => (
                      <SelectItem key={u.user_id} value={u.user_id}>{u.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={globalLeadGenFilter} onValueChange={setGlobalLeadGenFilter}>
                  <SelectTrigger className="w-48 h-8 text-xs bg-accent/30 border-border/50">
                    <SelectValue placeholder="All Lead Generators" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Lead Generators</SelectItem>
                    {bdUsers.map((u: any) => (
                      <SelectItem key={u.user_id} value={u.user_id}>{u.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(globalMemberFilter !== 'all' || globalLeadGenFilter !== 'all') && (
                  <button onClick={() => { setGlobalMemberFilter('all'); setGlobalLeadGenFilter('all'); }} className="text-xs text-muted-foreground hover:text-foreground underline">
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['#','ID','Name','Email','Phone','LinkedIn','Tech','Status', ...(viewMode === 'global' ? ['Generated By'] : []), 'Assigned To','Source','Last Activity', ...(viewMode === 'global' ? [] : ['Payment']), 'Actions'].map(h => (
                    <th key={h} className="text-left p-2 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="text-center py-8 text-muted-foreground">
                      No leads found.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.slice((leadsPage - 1) * 50, leadsPage * 50).map((lead, idx) => {
                    const closure = closureData.find(c => c.lead_id === lead.unique_id);
                    const hoursSince = (Date.now() - new Date(lead.updated_at).getTime()) / 3600000;
                    const isStale = hoursSince > 48 && !['Closed','Non Interested'].includes(lead.lead_status || '');
                    const isDNR = lead.lead_status?.startsWith('DNR');
                    return (
                      <tr key={lead.unique_id} className={`border-b border-border/50 hover:bg-accent/30 ${isStale ? 'bg-red-500/5' : isDNR ? 'bg-orange-500/5' : ''}`}>
                        <td className="p-2 text-xs text-muted-foreground font-medium">{(leadsPage - 1) * 50 + idx + 1}</td>
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
                        {viewMode === 'global' && (
                          <td className="p-2 text-xs">
                            {lead.lead_generated_by ? (profiles.find(p => p.user_id === lead.lead_generated_by)?.full_name || 'System') : 'System'}
                          </td>
                        )}
                        <td className="p-2 text-xs">{getName(lead.assigned_to)}</td>
                        <td className="p-2 text-xs">{lead.lead_source || '—'}</td>
                        <td className="p-2 text-xs">{new Date(lead.updated_at).toLocaleDateString()}</td>
                        {viewMode !== 'global' && (
                          <td className="p-2 text-xs">
                            {closure ? <span className="text-green-500 font-medium">${(closure.amount || 0).toLocaleString()}</span> : '—'}
                          </td>
                        )}
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => setSelectedLead(lead)}
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>

                            {/* Reassign Button (only for Sales TL and not in Global View) */}
                            {role === 'SALES_TL' && viewMode !== 'global' && (
                              <div className="relative reassign-dropdown-container">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                                  disabled={salesReassignLead.isPending}
                                  onClick={() => setReassigningLeadId(reassigningLeadId === lead.unique_id ? null : lead.unique_id)}
                                  title="Reassign Lead within Team"
                                >
                                  <RefreshCw className={`h-4 w-4 ${salesReassignLead.isPending && reassigningLeadId === lead.unique_id ? 'animate-spin' : ''}`} />
                                </Button>
                                {reassigningLeadId === lead.unique_id && (
                                  <SalesTLReassignDropdownMenu
                                    candidates={salesMembers}
                                    onSelect={(memberId) => {
                                      salesReassignLead.mutate({ leadId: lead.unique_id, newMemberId: memberId });
                                      setReassigningLeadId(null);
                                    }}
                                    onClose={() => setReassigningLeadId(null)}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        </CardContent>
        {filteredLeads.length > 0 && (
          <div className="flex justify-between items-center p-4 border-t border-border flex-wrap gap-2 bg-accent/5">
            <span className="text-xs text-muted-foreground">
              Showing {Math.min(filteredLeads.length, (leadsPage - 1) * 50 + 1)} to {Math.min(filteredLeads.length, leadsPage * 50)} of {filteredLeads.length} leads
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={leadsPage === 1}
                onClick={() => setLeadsPage(p => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-xs font-medium">
                Page {leadsPage} of {Math.ceil(filteredLeads.length / 50) || 1}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={leadsPage * 50 >= filteredLeads.length}
                onClick={() => setLeadsPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
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

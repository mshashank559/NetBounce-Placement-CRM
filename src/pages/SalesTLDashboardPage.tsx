import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Phone, Users, CheckCircle, DollarSign, RefreshCw, Eye, LayoutDashboard, User } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SalesTLDashboardPage: React.FC = () => {
  const { user, role } = useAuth();
  const [viewMode, setViewMode] = useState('team'); // 'personal' or 'team'
  const [monthFilter, setMonthFilter] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const { data: salesMembers } = useQuery({
    queryKey: ['sales-members-perf', user?.id],
    queryFn: async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('role', ['SALES_TM', 'SALES_TL']);
      if (!roles) return [];
      const userIds = roles.map(r => r.user_id);
      
      let query = supabase.from('profiles').select('*').in('user_id', userIds);
      if (role !== 'ADMIN') {
        query = query.or(`reports_to.eq.${user!.id},user_id.eq.${user!.id}`);
      }
      
      const { data: profiles } = await query;
      return profiles || [];
    },
    enabled: !!user,
  });

  const { data: allLeads } = useQuery({
    queryKey: ['sales-tl-leads'],
    queryFn: async () => {
      // Only fetch the columns needed for per-member KPI calculations — not select('*')
      const { data } = await supabase
        .from('leads')
        .select('unique_id, lead_status, assigned_to, team_lead_id, created_at');
      return data || [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const { data: callLogs } = useQuery({
    queryKey: ['sales-tl-calls'],
    queryFn: async () => {
      const { data } = await supabase.from('call_logs').select('*');
      return data || [];
    },
    enabled: !!user,
  });

  const { data: closures } = useQuery({
    queryKey: ['sales-tl-closures'],
    queryFn: async () => {
      const { data } = await supabase.from('lead_closures').select('*');
      return data || [];
    },
    enabled: !!user,
  });

  const today = new Date().toISOString().split('T')[0];
  const [filterYear, filterMonth] = monthFilter.split('-').map(Number);

  const memberStats = useMemo(() => {
    if (!salesMembers) return [];
    return salesMembers.map(member => {
      const memberLeads = allLeads?.filter(l => l.assigned_to === member.user_id) || [];
      const memberCalls = callLogs?.filter(c => c.user_id === member.user_id) || [];
      const memberClosedIds = new Set(memberLeads.filter(l => l.lead_status === 'Closed').map(l => l.unique_id));
      const memberClosures = closures?.filter(c => memberClosedIds.has(c.lead_id)) || [];

      const todayCalls = memberCalls.filter(c => c.call_date === today).reduce((s, c) => s + (c.call_count || 0), 0);
      const monthlyCalls = memberCalls.filter(c => {
        const d = new Date(c.call_date);
        return d.getFullYear() === filterYear && d.getMonth() + 1 === filterMonth;
      }).reduce((s, c) => s + (c.call_count || 0), 0);

      const leadsToday = memberLeads.filter(l => l.created_at?.startsWith(today)).length;
      const leadsMonth = memberLeads.filter(l => {
        const d = new Date(l.created_at);
        return d.getFullYear() === filterYear && d.getMonth() + 1 === filterMonth;
      }).length;

      const statusBreakdown: Record<string, number> = {};
      memberLeads.forEach(l => {
        const s = l.lead_status || 'New';
        statusBreakdown[s] = (statusBreakdown[s] || 0) + 1;
      });

      const totalRevenue = memberClosures.reduce((s, c) => {
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

      return {
        ...member,
        todayCalls,
        monthlyCalls,
        leadsToday,
        leadsMonth,
        statusBreakdown,
        closures: memberClosures,
        totalRevenue,
        totalLeads: memberLeads.length,
        closedCount: memberClosedIds.size,
      };
    });
  }, [salesMembers, allLeads, callLogs, closures, today, filterYear, filterMonth]);

  const displayedStats = useMemo(() => {
    if (viewMode === 'personal') {
      return memberStats.filter(m => m.user_id === user?.id);
    }
    return memberStats.filter(m => m.user_id !== user?.id);
  }, [memberStats, viewMode, user?.id]);

  if (role !== 'SALES_TL' && role !== 'ADMIN') {
    return <div className="text-center text-muted-foreground p-8">Access denied</div>;
  }

  // Month options
  const monthOptions = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    monthOptions.push({ val, label });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h1 className="text-2xl font-display font-bold">Sales Team Performance</h1>
        <div className="flex items-center gap-3">
          <Tabs value={viewMode} onValueChange={setViewMode} className="w-[200px]">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="personal">My View</TabsTrigger>
              <TabsTrigger value="team">Team View</TabsTrigger>
            </TabsList>
          </Tabs>

          <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map(o => (
              <SelectItem key={o.val} value={o.val}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>

    <div className="space-y-4">
        {displayedStats.map((m, i) => (
          <motion.div key={m.user_id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg font-display">{m.full_name}</CardTitle>
                <p className="text-xs text-muted-foreground">{m.email}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-accent/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Phone className="h-3 w-3" /> Calls Today
                    </div>
                    <p className="text-xl font-display font-bold">{m.todayCalls}</p>
                  </div>
                  <div className="bg-accent/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Phone className="h-3 w-3" /> Calls (Month)
                    </div>
                    <p className="text-xl font-display font-bold">{m.monthlyCalls}</p>
                  </div>
                  <div className="bg-accent/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Users className="h-3 w-3" /> Leads Today
                    </div>
                    <p className="text-xl font-display font-bold">{m.leadsToday}</p>
                  </div>
                  <div className="bg-accent/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Users className="h-3 w-3" /> Leads (Month)
                    </div>
                    <p className="text-xl font-display font-bold">{m.leadsMonth}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-2">Status Breakdown</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(m.statusBreakdown).map(([status, count]) => (
                      <Badge key={status} variant="secondary" className="text-xs">
                        {status}: {count as number}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <CheckCircle className="h-3 w-3" /> Closures
                    </div>
                    <p className="text-xl font-display font-bold text-green-600">{m.closedCount}</p>
                  </div>
                  <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <DollarSign className="h-3 w-3" /> Revenue
                    </div>
                    <p className="text-xl font-display font-bold text-green-600">${m.totalRevenue.toLocaleString()}</p>
                  </div>
                </div>

                {m.closures.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Payment Details</p>
                    <div className="space-y-1">
                      {m.closures.map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between text-xs bg-accent/20 rounded p-2">
                          <span>{c.plan} · {c.payment_mode}</span>
                          <span className="font-medium">
                            Upfront: ${c.upfront_amount}
                            {c.slot1_amount !== null && ` · S1: $${c.slot1_amount}${c.slot1 ? ' (Paid)' : ' (Unpaid)'}`}
                            {c.slot2_amount !== null && ` · S2: $${c.slot2_amount}${c.slot2 ? ' (Paid)' : ' (Unpaid)'}`}
                            {Array.isArray(c.additional_slots) && c.additional_slots.map((s: any, idx: number) => ` · S${s.slot_number || (idx + 3)}: $${s.amount}${s.paid ? ' (Paid)' : ' (Unpaid)'}`)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {displayedStats.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No {viewMode} performance data found</p>
        )}
      </div>

    </div>
  );
};

export default SalesTLDashboardPage;

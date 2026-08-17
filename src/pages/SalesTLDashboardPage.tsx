import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Phone, Users, CheckCircle, DollarSign, Calendar, Eye, ShieldAlert } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getISTYearAndMonth, getISTDateString } from '@/lib/dateUtils';
import { recordAuthActivity } from '@/lib/auditLogger';

const SalesTLDashboardPage: React.FC = () => {
  const { user, role } = useAuth();
  const [viewMode, setViewMode] = useState<'personal' | 'team'>('team');

  React.useEffect(() => {
    if (user && role === 'ADMIN') {
      recordAuthActivity({
        actorId: user.id,
        actorRole: 'ADMIN',
        actionType: 'DASHBOARD_ACCESS',
        dashboardAccessed: 'Sales Performance & TL Dashboard',
      });
    }
  }, [user, role]);

  // ── Date Range Calendar Filter (Default: Current Month) ──
  const [dateFrom, setDateFrom] = useState(() => {
    const { year, month } = getISTYearAndMonth(new Date());
    return `${year}-${String(month).padStart(2, '0')}-01`;
  });
  const [dateTo, setDateTo] = useState(() => {
    const { year, month } = getISTYearAndMonth(new Date());
    const lastDay = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  });

  // Helper to check if a date string falls inside [dateFrom, dateTo] in IST
  const isDateInRange = (dateInput: string | null | undefined) => {
    if (!dateInput) return false;
    const istDate = getISTDateString(dateInput);
    if (dateFrom && istDate < dateFrom) return false;
    if (dateTo && istDate > dateTo) return false;
    return true;
  };

  // ── 1. Fetch authorized sales profiles based on role hierarchy ──
  const { data: salesMembers = [] } = useQuery({
    queryKey: ['sales-members-perf', user?.id, role],
    queryFn: async () => {
      if (!user) return [];
      const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('role', ['SALES_TM', 'SALES_TL']);
      if (!roles) return [];
      const userIds = roles.map(r => r.user_id);

      let query = supabase.from('profiles').select('*').in('user_id', userIds);
      if (role === 'SALES_TM') {
        // Sales Member: strictly own profile
        query = query.eq('user_id', user.id);
      } else if (role === 'SALES_TL') {
        // Sales TL: strictly own profile + mapped team members
        query = query.or(`reports_to.eq.${user.id},user_id.eq.${user.id}`);
      }
      // ADMIN gets all sales profiles

      const { data: profiles } = await query;
      return (profiles || []).sort((a, b) => {
        if (a.user_id === user.id) return -1;
        if (b.user_id === user.id) return 1;
        return (a.full_name || '').localeCompare(b.full_name || '');
      });
    },
    enabled: !!user && !!role,
  });

  const memberUserIds = useMemo(() => salesMembers.map(m => m.user_id), [salesMembers]);

  // ── 2. Fetch leads assigned to authorized users ──
  const { data: allLeads = [] } = useQuery({
    queryKey: ['sales-tl-leads', user?.id, role, memberUserIds],
    queryFn: async () => {
      if (!user || memberUserIds.length === 0) return [];
      let query = supabase
        .from('leads')
        .select('unique_id, lead_status, assigned_to, team_lead_id, created_at, updated_at');
      if (role !== 'ADMIN') {
        query = query.in('assigned_to', memberUserIds);
      }
      const { data } = await query;
      return data || [];
    },
    enabled: !!user && !!role && memberUserIds.length > 0,
    staleTime: 60_000,
  });

  const leadIds = useMemo(() => allLeads.map(l => l.unique_id), [allLeads]);

  // ── 3. Fetch call activities strictly for authorized users ──
  const { data: callActivities = [] } = useQuery({
    queryKey: ['sales-perf-calls', user?.id, role, memberUserIds],
    queryFn: async () => {
      if (!user || memberUserIds.length === 0) return [];
      const { data } = await supabase
        .from('followups')
        .select('id, user_id, lead_id, created_at, way_of_contact')
        .in('user_id', memberUserIds);
      return data || [];
    },
    enabled: !!user && !!role && memberUserIds.length > 0,
  });

  // ── 4. Fetch lead closures strictly for accessible leads ──
  const { data: closures = [] } = useQuery({
    queryKey: ['sales-perf-closures', user?.id, role, leadIds],
    queryFn: async () => {
      if (!user || leadIds.length === 0) return [];
      const { data } = await supabase
        .from('lead_closures')
        .select('*')
        .in('lead_id', leadIds);
      return data || [];
    },
    enabled: !!user && !!role && leadIds.length > 0,
  });

  // ── 5. Calculate per-member KPIs using real DB records & Mark-as-Paid truth ──
  const memberStats = useMemo(() => {
    if (!salesMembers.length) return [];
    const today = getISTDateString(new Date());

    return salesMembers.map(member => {
      const memberLeads = allLeads.filter(l => l.assigned_to === member.user_id);
      
      // Actual calls only (excluding emails/WhatsApp)
      const memberCalls = callActivities.filter(c => {
        const isCall = !c.way_of_contact || c.way_of_contact.trim().toUpperCase() === 'CALL';
        return c.user_id === member.user_id && isCall;
      });

      const todayCalls = memberCalls.filter(c => getISTDateString(c.created_at) === today).length;
      const totalCalls = memberCalls.filter(c => isDateInRange(c.created_at)).length;

      // Status breakdown for all active leads assigned to member
      const statusBreakdown: Record<string, number> = {};
      memberLeads.forEach(l => {
        const s = l.lead_status || 'New';
        statusBreakdown[s] = (statusBreakdown[s] || 0) + 1;
      });

      // ── Closures & Revenue Calculation strictly based on Mark as Paid ──
      const memberLeadIds = new Set(memberLeads.map(l => l.unique_id));
      const memberClosureRecords = closures.filter(c => memberLeadIds.has(c.lead_id));

      let totalRevenue = 0;
      const paidClosureItems: any[] = [];
      const paidLeadIds = new Set<string>();

      memberClosureRecords.forEach(c => {
        let leadPaidRevenueInRange = 0;
        const paidSlotsSummary: string[] = [];

        // Check Slot 1
        if (c.slot1 && Number(c.slot1_amount) > 0) {
          const slot1Date = c.slot1_due_date ? getISTDateString(c.slot1_due_date) : getISTDateString(c.created_at);
          if (isDateInRange(slot1Date)) {
            leadPaidRevenueInRange += Number(c.slot1_amount);
            paidLeadIds.add(c.lead_id);
          }
          paidSlotsSummary.push(`S1: $${Number(c.slot1_amount).toLocaleString()} (Paid)`);
        } else if (c.slot1_amount !== null && c.slot1_amount !== undefined) {
          paidSlotsSummary.push(`S1: $${Number(c.slot1_amount).toLocaleString()} (Unpaid)`);
        }

        // Check Slot 2
        if (c.slot2 && Number(c.slot2_amount) > 0) {
          const slot2Date = c.next_slot_due_date ? getISTDateString(c.next_slot_due_date) : getISTDateString(c.created_at);
          if (isDateInRange(slot2Date)) {
            leadPaidRevenueInRange += Number(c.slot2_amount);
            paidLeadIds.add(c.lead_id);
          }
          paidSlotsSummary.push(`S2: $${Number(c.slot2_amount).toLocaleString()} (Paid)`);
        } else if (c.slot2_amount !== null && c.slot2_amount !== undefined) {
          paidSlotsSummary.push(`S2: $${Number(c.slot2_amount).toLocaleString()} (Unpaid)`);
        }

        // Check Additional Slots
        if (Array.isArray(c.additional_slots)) {
          c.additional_slots.forEach((slot: any, idx: number) => {
            const slotNum = slot.slot_number || (idx + 3);
            if (slot.paid === true && Number(slot.amount) > 0) {
              const addSlotDate = slot.due_date ? getISTDateString(slot.due_date) : (slot.paid_at ? getISTDateString(slot.paid_at) : getISTDateString(c.created_at));
              if (isDateInRange(addSlotDate)) {
                leadPaidRevenueInRange += Number(slot.amount);
                paidLeadIds.add(c.lead_id);
              }
              paidSlotsSummary.push(`S${slotNum}: $${Number(slot.amount).toLocaleString()} (Paid)`);
            } else if (slot.amount !== null && slot.amount !== undefined) {
              paidSlotsSummary.push(`S${slotNum}: $${Number(slot.amount).toLocaleString()} (Unpaid)`);
            }
          });
        }

        totalRevenue += leadPaidRevenueInRange;

        // Keep records with payment info for the details list
        const hasAnyPaid = c.slot1 || c.slot2 || (Array.isArray(c.additional_slots) && c.additional_slots.some((s: any) => s.paid));
        if (hasAnyPaid && (leadPaidRevenueInRange > 0 || (!dateFrom && !dateTo))) {
          paidClosureItems.push({
            ...c,
            paidSlotsSummary,
            leadPaidRevenueInRange
          });
        }
      });

      const closedCount = paidLeadIds.size;
      const activeLeads = memberLeads.filter(l => l.lead_status !== 'Closed').length;

      return {
        ...member,
        todayCalls,
        totalCalls,
        statusBreakdown,
        closures: paidClosureItems,
        totalRevenue,
        totalLeads: memberLeads.length,
        activeLeads,
        closedCount,
      };
    });
  }, [salesMembers, allLeads, callActivities, closures, dateFrom, dateTo]);

  // ── 6. Filter displayed stats by view mode ──
  const displayedStats = useMemo(() => {
    if (role === 'SALES_TM' || viewMode === 'personal') {
      return memberStats.filter(m => m.user_id === user?.id);
    }
    // Team View: Sales TL + all team members mapped under them (or all for Admin)
    return memberStats;
  }, [memberStats, viewMode, user?.id, role]);

  // ── 7. Summary Header KPIs ──
  const summaryKPIs = useMemo(() => {
    const activeLeadsCount = displayedStats.reduce((s, m) => s + m.activeLeads, 0);
    const totalClosuresCount = displayedStats.reduce((s, m) => s + m.closedCount, 0);
    const todayCallsCount = displayedStats.reduce((s, m) => s + m.todayCalls, 0);
    const totalCallsCount = displayedStats.reduce((s, m) => s + m.totalCalls, 0);
    const totalRevenueSum = displayedStats.reduce((s, m) => s + m.totalRevenue, 0);

    return {
      activeLeads: activeLeadsCount,
      closures: totalClosuresCount,
      todayCalls: todayCallsCount,
      totalCalls: totalCallsCount,
      revenue: totalRevenueSum
    };
  }, [displayedStats]);

  if (role !== 'SALES_TM' && role !== 'SALES_TL' && role !== 'ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-center p-8">
        <ShieldAlert className="h-10 w-10 text-destructive mb-3" />
        <h2 className="text-lg font-semibold">Access Denied</h2>
        <p className="text-sm text-muted-foreground mt-1">You do not have permission to view Sales Performance.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Date Range Filter */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">
            {role === 'SALES_TM' ? 'My Sales Performance' : 'Sales Team Performance'}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time tracking of calls, paid closures, active pipeline, and revenue.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {role !== 'SALES_TM' && (
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'personal' | 'team')} className="w-[200px]">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="personal">My View</TabsTrigger>
                <TabsTrigger value="team">Team View</TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {/* Date Range Calendar Filter */}
          <div className="flex items-center gap-1.5 bg-background/50 border border-border/50 rounded-md p-1 shadow-sm">
            <Calendar className="h-4 w-4 text-muted-foreground ml-1.5" />
            <span className="text-xs text-muted-foreground font-medium">Date:</span>
            <Input 
              type="date" 
              value={dateFrom} 
              onChange={e => setDateFrom(e.target.value)} 
              className="w-[130px] h-8 text-xs border-0 bg-transparent pl-1.5 pr-3 focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-accent/40 rounded-sm" 
              title="Start Date"
            />
            <span className="text-muted-foreground text-xs font-medium">to</span>
            <Input 
              type="date" 
              value={dateTo} 
              onChange={e => setDateTo(e.target.value)} 
              className="w-[130px] h-8 text-xs border-0 bg-transparent pl-1.5 pr-3 focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-accent/40 rounded-sm" 
              title="End Date"
            />
            {(dateFrom || dateTo) && (
              <button 
                onClick={() => { setDateFrom(''); setDateTo(''); }} 
                className="text-xs text-muted-foreground hover:text-foreground underline px-1.5"
                title="Clear date filter"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary KPI Cards Grid (5 Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="glass-card hover:nb-glow transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Active Leads</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold">{summaryKPIs.activeLeads}</div>
          </CardContent>
        </Card>

        <Card className="glass-card hover:nb-glow transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Closures</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold text-green-600">{summaryKPIs.closures}</div>
          </CardContent>
        </Card>

        <Card className="glass-card hover:nb-glow transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Today's Calls</CardTitle>
            <Phone className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold">{summaryKPIs.todayCalls}</div>
          </CardContent>
        </Card>

        <Card className="glass-card hover:nb-glow transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Calls</CardTitle>
            <Phone className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold">{summaryKPIs.totalCalls}</div>
          </CardContent>
        </Card>

        <Card className="glass-card hover:nb-glow transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold text-green-600">${summaryKPIs.revenue.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Member Cards Grid */}
      <div className="space-y-4">
        {displayedStats.map((m, i) => (
          <motion.div key={m.user_id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="glass-card">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg font-display">{m.full_name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      Active: {m.activeLeads}
                    </Badge>
                    <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600">
                      Paid Closures: {m.closedCount}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 2 Call metrics (Leads Today and Leads Month removed) */}
                <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
                  <div className="bg-accent/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Phone className="h-3 w-3 text-blue-500" /> Calls Today
                    </div>
                    <p className="text-xl font-display font-bold">{m.todayCalls}</p>
                  </div>
                  <div className="bg-accent/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Phone className="h-3 w-3 text-indigo-500" /> Calls (Selected Period)
                    </div>
                    <p className="text-xl font-display font-bold">{m.totalCalls}</p>
                  </div>
                </div>

                {/* Status Breakdown */}
                {Object.keys(m.statusBreakdown).length > 0 && (
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
                )}

                {/* Closures & Revenue */}
                <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
                  <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <CheckCircle className="h-3 w-3 text-green-500" /> Closures (Paid)
                    </div>
                    <p className="text-xl font-display font-bold text-green-600">{m.closedCount}</p>
                  </div>
                  <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <DollarSign className="h-3 w-3 text-amber-500" /> Revenue
                    </div>
                    <p className="text-xl font-display font-bold text-green-600">${m.totalRevenue.toLocaleString()}</p>
                  </div>
                </div>

                {/* Payment Details List */}
                {m.closures.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2 font-medium">Payment & Slot Details</p>
                    <div className="space-y-1.5">
                      {m.closures.map((c: any) => (
                        <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between text-xs bg-accent/20 rounded p-2.5 gap-1.5">
                          <span className="font-semibold text-primary">{c.plan || 'Custom Plan'} · {c.payment_mode || 'Payment'}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {c.paidSlotsSummary && c.paidSlotsSummary.length > 0 ? c.paidSlotsSummary.join(' · ') : 'No slots'}
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
          <p className="text-center text-muted-foreground py-12">No sales performance records found for this period</p>
        )}
      </div>
    </div>
  );
};

export default SalesTLDashboardPage;

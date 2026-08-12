import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Plus } from 'lucide-react';

import { getISTYearAndMonth, getISTDateString, isInCurrentShift, getBDBusinessDate, getShiftStart } from '@/lib/dateUtils';
import { recordAuthActivity } from '@/lib/auditLogger';

const BDTLDashboardPage: React.FC = () => {
  const { user, role } = useAuth();

  React.useEffect(() => {
    if (user && role === 'ADMIN') {
      recordAuthActivity({
        actorId: user.id,
        actorRole: 'ADMIN',
        actionType: 'DASHBOARD_ACCESS',
        dashboardAccessed: 'BD Performance & TL Dashboard',
      });
    }
  }, [user, role]);

  const monthOptions = useMemo(() => {
    const options = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      options.push({ val, label });
    }
    return options;
  }, []);

  const [monthFilter, setMonthFilter] = useState(() => {
    const saved = localStorage.getItem('netbounce_crm_bd_perf_month_key');
    if (saved && /^\d{4}-\d{2}$/.test(saved)) return saved;
    const { year, month } = getISTYearAndMonth(new Date());
    return `${year}-${String(month).padStart(2, '0')}`;
  });

  const { data: bdMembers } = useQuery({
    queryKey: ['bd-members-perf'],
    queryFn: async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id').in('role', ['LEAD_GEN', 'LEAD_TL']);
      if (!roles) return [];
      const userIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase.from('profiles').select('*').in('user_id', userIds);
      return (profiles || []).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    },
    enabled: !!user,
  });

  // ── Fetch all lead records with chunked pagination for accurate stats ──
  const { data: leadStats } = useQuery({
    queryKey: ['bd-tl-lead-stats'],
    queryFn: async () => {
      let allLeads: { lead_generated_by: string | null; created_at: string }[] = [];
      let from = 0;
      const step = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('leads')
          .select('lead_generated_by, created_at')
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
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const memberStats = useMemo(() => {
    if (!bdMembers) return [];

    let fYear: number;
    let fMonth: number;
    if (monthFilter && monthFilter.includes('-')) {
      const [y, m] = monthFilter.split('-').map(Number);
      fYear = y || new Date().getFullYear();
      fMonth = m || (new Date().getMonth() + 1);
    } else {
      const { year, month } = getISTYearAndMonth(new Date());
      fYear = year;
      fMonth = month;
    }

    const todayDateStr = getISTDateString(new Date());
    const shiftStart = getShiftStart();

    return bdMembers.map(member => {
      const memberLeads = leadStats?.filter(l => l.lead_generated_by === member.user_id) || [];
      
      // Leads today: created during current shift OR today in IST
      const leadsToday = memberLeads.filter(l => {
        if (!l.created_at) return false;
        const d = new Date(l.created_at);
        const lDateStr = getISTDateString(l.created_at);
        return d >= shiftStart || lDateStr === todayDateStr || isInCurrentShift(l.created_at);
      }).length;

      // Leads in the selected month:
      const leadsMonth = memberLeads.filter(l => {
        if (!l.created_at) return false;
        const { year, month } = getISTYearAndMonth(l.created_at);
        return year === fYear && month === fMonth;
      }).length;

      return {
        ...member,
        totalLeads: memberLeads.length,
        leadsToday,
        leadsMonth,
      };
    });
  }, [bdMembers, leadStats, monthFilter]);

  if (role !== 'LEAD_TL' && role !== 'ADMIN') {
    return <div className="text-center text-muted-foreground p-8">Access denied</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold">BD Team Performance</h1>
        <Select 
          value={monthFilter} 
          onValueChange={(v) => { 
            setMonthFilter(v); 
            localStorage.setItem('netbounce_crm_bd_perf_month_key', v); 
          }}
        >
          <SelectTrigger className="w-48 h-9 bg-accent/20">
            <SelectValue placeholder="Select Month" />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map(o => (
              <SelectItem key={o.val} value={o.val}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {memberStats.map((m, i) => (
          <motion.div key={m.user_id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg font-display">{m.full_name}</CardTitle>
                <p className="text-xs text-muted-foreground">{m.email}</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-accent/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Users className="h-3 w-3" /> Total Leads
                    </div>
                    <p className="text-xl font-display font-bold">{m.totalLeads}</p>
                  </div>
                  <div className="bg-accent/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Plus className="h-3 w-3" /> Today
                    </div>
                    <p className="text-xl font-display font-bold">{m.leadsToday}</p>
                  </div>
                  <div className="bg-accent/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Plus className="h-3 w-3" /> This Month
                    </div>
                    <p className="text-xl font-display font-bold">{m.leadsMonth}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {memberStats.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No BD team members found</p>
        )}
      </div>
    </div>
  );
};

export default BDTLDashboardPage;



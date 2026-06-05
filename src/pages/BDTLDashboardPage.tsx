import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Plus } from 'lucide-react';

const BDTLDashboardPage: React.FC = () => {
  const { user, role } = useAuth();
  const [monthFilter, setMonthFilter] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const { data: bdMembers } = useQuery({
    queryKey: ['bd-members-perf'],
    queryFn: async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'LEAD_GEN');
      if (!roles) return [];
      const userIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase.from('profiles').select('*').in('user_id', userIds);
      return profiles || [];
    },
    enabled: !!user,
  });

  // ── Fetch only minimal columns needed for stats (no select('*')) ──
  const { data: leadStats } = useQuery({
    queryKey: ['bd-tl-lead-stats'],
    queryFn: async () => {
      const { data } = await supabase
        .from('leads')
        .select('lead_generated_by, created_at');
      return data || [];
    },
    enabled: !!user,
    staleTime: 60_000, // cache for 1 minute — stats don't need to be live
  });

  const [filterYear, filterMonth] = monthFilter.split('-').map(Number);
  const today = new Date().toISOString().split('T')[0];

  const memberStats = useMemo(() => {
    if (!bdMembers) return [];
    return bdMembers.map(member => {
      const memberLeads = leadStats?.filter(l => l.lead_generated_by === member.user_id) || [];
      const leadsToday = memberLeads.filter(l => l.created_at?.startsWith(today)).length;
      const leadsMonth = memberLeads.filter(l => {
        const d = new Date(l.created_at);
        return d.getFullYear() === filterYear && d.getMonth() + 1 === filterMonth;
      }).length;

      return {
        ...member,
        totalLeads: memberLeads.length,
        leadsToday,
        leadsMonth,
      };
    });
  }, [bdMembers, leadStats, today, filterYear, filterMonth]);

  if (role !== 'LEAD_TL' && role !== 'ADMIN') {
    return <div className="text-center text-muted-foreground p-8">Access denied</div>;
  }

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold">BD Team Performance</h1>
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



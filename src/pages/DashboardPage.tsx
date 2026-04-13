import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Users, TrendingUp, Phone, CheckCircle, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  delay?: number;
}> = ({ title, value, icon: Icon, trend, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay }}
  >
    <Card className="glass-card hover:nb-glow transition-shadow duration-300">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-display font-bold">{value}</div>
        {trend && <p className="text-xs text-muted-foreground mt-1">{trend}</p>}
      </CardContent>
    </Card>
  </motion.div>
);

const DashboardPage: React.FC = () => {
  const { user, role, profile } = useAuth();
  const [monthFilter, setMonthFilter] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [filterYear, filterMonth] = monthFilter.split('-').map(Number);

  const { data: leads } = useQuery({
    queryKey: ['dashboard-leads', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('leads').select('*');
      return data || [];
    },
    enabled: !!user,
  });

  const { data: callLogs } = useQuery({
    queryKey: ['dashboard-calls', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('call_logs')
        .select('*')
        .eq('call_date', today);
      return data || [];
    },
    enabled: !!user && (role === 'SALES_TM' || role === 'SALES_TL' || role === 'ADMIN'),
  });

  const monthLeads = leads?.filter(l => {
    const d = new Date(l.created_at);
    return d.getFullYear() === filterYear && d.getMonth() + 1 === filterMonth;
  }) || [];

  const totalLeads = monthLeads.length;
  const newLeads = monthLeads.filter(l => l.lead_status === 'New').length;
  const closures = monthLeads.filter(l => l.lead_status === 'Closed').length;
  const activeLeads = monthLeads.filter(l => !['Closed', 'Non Interested'].includes(l.lead_status || '')).length;
  const todayCalls = callLogs?.reduce((sum, c) => sum + (c.call_count || 0), 0) || 0;

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
        <div>
          <h1 className="text-2xl font-display font-bold">
            Welcome back, {profile?.full_name || 'User'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Here's your CRM overview
          </p>
        </div>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Leads" value={totalLeads} icon={Users} delay={0} />
        <StatCard title="New Leads" value={newLeads} icon={Plus} delay={0.1} />
        <StatCard title="Active Leads" value={activeLeads} icon={TrendingUp} delay={0.2} />
        <StatCard title="Closures" value={closures} icon={CheckCircle} delay={0.3} />
        {(role === 'SALES_TM' || role === 'SALES_TL' || role === 'ADMIN') && (
          <StatCard title="Today's Calls" value={todayCalls} icon={Phone} delay={0.4} />
        )}
      </div>

      {leads && leads.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg font-display">Recent Leads</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {leads.slice(0, 5).map(lead => (
                  <div
                    key={lead.unique_id}
                    className="flex items-center justify-between p-3 rounded-lg bg-accent/50 hover:bg-accent transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        <span className="text-xs font-mono text-muted-foreground mr-2">{(lead as any).display_id}</span>
                        {lead.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{lead.email}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      lead.lead_status === 'New' ? 'bg-primary/10 text-primary' :
                      lead.lead_status === 'Closed' ? 'bg-green-500/10 text-green-600' :
                      lead.lead_status === 'Non Interested' ? 'bg-destructive/10 text-destructive' :
                      'bg-accent text-accent-foreground'
                    }`}>
                      {lead.lead_status}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default DashboardPage;

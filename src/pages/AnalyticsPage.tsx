import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllLeads } from '@/lib/leads';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LabelList } from 'recharts';

const COLORS = ['hsl(222, 100%, 50%)', 'hsl(222, 100%, 65%)', 'hsl(222, 80%, 40%)', 'hsl(222, 60%, 75%)', 'hsl(200, 80%, 50%)'];

const AnalyticsPage: React.FC = () => {
  const { user, role } = useAuth();

  const { data: leads } = useQuery({
    queryKey: ['analytics-leads', user?.id, role],
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
            .in('assigned_to', teamUserIds)
            .order('created_at', { ascending: false })
            .range(from, from + step - 1);
            
          if (error) {
            console.error("Error fetching team leads for analytics:", error);
            throw error;
          }
          
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
      }
      return fetchAllLeads();
    },
    enabled: !!user,
  });

  if (role !== 'ADMIN' && role !== 'PROCESS_ANALYST' && role !== 'LEAD_TL' && role !== 'SALES_TL') {
    return <div className="text-center text-muted-foreground p-8">Access denied</div>;
  }

  const statusCounts = leads?.reduce((acc, l) => {
    const s = l.lead_status || 'New';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  const funnelOrder = ['New', 'DNR1', 'DNR2', 'DNR3', 'Connected', 'Qualified', 'Hot Prospect', 'Closed'];
  const funnelData = funnelOrder.map(name => ({
    name,
    value: statusCounts[name] || 0,
  })).filter(d => d.value > 0);

  const normalizeSource = (source: string | null | undefined): string => {
    if (!source) return 'Other';
    const clean = source.trim().toLowerCase();
    
    // LinkedIn typos & variants
    if (
      clean.includes('linkedin') ||
      clean.includes('linkdin') ||
      clean.includes('linkeln') ||
      clean.includes('linkin') ||
      clean.includes('linked')
    ) {
      return 'LinkedIn';
    }

    // Gmail variants
    if (clean.includes('gmail') || clean.includes('google')) {
      return 'Gmail';
    }

    // WhatsApp variants
    if (clean.includes('whatsapp') || clean.includes('whats app') || clean.includes('whats-app')) {
      return 'WhatsApp';
    }

    // OPT Nation variants
    if (clean.includes('opt') || clean.includes('optnation') || clean.includes('opt nation')) {
      return 'OPT Nation';
    }

    // Default formatting: Capitalize first letter of each word
    return source
      .trim()
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const sourceCounts = leads?.reduce((acc, l) => {
    const s = normalizeSource(l.lead_source);
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};
  const sourceData = Object.entries(sourceCounts).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold">Analytics</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg font-display">Lead Status Distribution</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(222, 100%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg font-display">Source Analysis</CardTitle>
            </CardHeader>
            <CardContent className="h-64 flex flex-row items-center justify-between gap-4">
              <div className="w-1/2 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sourceData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={false}>
                      {sourceData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-1/2 h-full overflow-y-auto pr-2 space-y-1.5 text-xs custom-scrollbar">
                {sourceData.map((item, i) => (
                  <div key={item.name} className="flex items-center justify-between gap-2 py-1 border-b border-border/40">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="font-medium truncate" title={item.name}>{item.name}</span>
                    </div>
                    <span className="text-muted-foreground font-semibold shrink-0">{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-2">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg font-display">Sales Funnel</CardTitle>
            </CardHeader>
            <CardContent className="h-80">
              {funnelData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(222, 100%, 50%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-8">No data to display</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default AnalyticsPage;

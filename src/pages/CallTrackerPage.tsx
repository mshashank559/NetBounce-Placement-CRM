import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Phone } from 'lucide-react';

const CallTrackerPage: React.FC = () => {
  const { user, role } = useAuth();

  const { data: callLogs } = useQuery({
    queryKey: ['call-logs', user?.id],
    queryFn: async () => {
      let query = supabase.from('call_logs').select('*').order('call_date', { ascending: false });
      if (role === 'SALES_TM') {
        query = query.eq('user_id', user!.id);
      }
      const { data } = await query;
      return data || [];
    },
    enabled: !!user,
  });

  const today = new Date().toISOString().split('T')[0];
  const todayCalls = callLogs?.filter(c => c.call_date === today).reduce((sum, c) => sum + (c.call_count || 0), 0) || 0;
  const totalCalls = callLogs?.reduce((sum, c) => sum + (c.call_count || 0), 0) || 0;

  if (role !== 'SALES_TM' && role !== 'SALES_TL' && role !== 'ADMIN') {
    return <div className="text-center text-muted-foreground p-8">Access denied</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold">Call Tracker</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass-card nb-glow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Today's Calls</CardTitle>
              <Phone className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-display font-bold">{todayCalls}</div>
              <p className="text-xs text-muted-foreground mt-1">Resets at midnight</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Calls</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-display font-bold">{totalCalls}</div>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg font-display">Call History</CardTitle>
        </CardHeader>
        <CardContent>
          {!callLogs?.length ? (
            <p className="text-muted-foreground text-center py-4">No calls logged yet</p>
          ) : (
            <div className="space-y-2">
              {callLogs.map(log => (
                <div key={log.id} className="flex items-center justify-between p-3 bg-accent/30 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{log.call_date}</p>
                    <p className="text-xs text-muted-foreground">Lead: {log.lead_id.substring(0, 8)}...</p>
                  </div>
                  <span className="text-sm font-display font-bold text-primary">{log.call_count} calls</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CallTrackerPage;

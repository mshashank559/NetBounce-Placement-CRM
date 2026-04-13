import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, TrendingUp, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const RevenuePage: React.FC = () => {
  const { user, role } = useAuth();
  const currentYear = new Date().getFullYear();
  const [yearFilter, setYearFilter] = useState(String(currentYear));

  const { data: closures } = useQuery({
    queryKey: ['revenue-closures'],
    queryFn: async () => {
      const { data } = await supabase.from('lead_closures').select('*');
      return data || [];
    },
    enabled: !!user,
  });

  const monthlyRevenue = useMemo(() => {
    if (!closures) return [];
    const months: Record<string, number> = {};
    closures.forEach(c => {
      const d = new Date(c.created_at);
      if (d.getFullYear() !== parseInt(yearFilter)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const amount = (c.upfront_amount || 0) + (c.slot1_amount || 0) + (c.slot2_amount || 0);
      months[key] = (months[key] || 0) + amount;
    });

    const result = [];
    for (let m = 1; m <= 12; m++) {
      const key = `${yearFilter}-${String(m).padStart(2, '0')}`;
      const date = new Date(parseInt(yearFilter), m - 1);
      result.push({
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        revenue: months[key] || 0,
      });
    }
    return result;
  }, [closures, yearFilter]);

  const totalYearRevenue = monthlyRevenue.reduce((s, m) => s + m.revenue, 0);
  const currentMonthKey = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const currentMonthRevenue = closures?.reduce((s, c) => {
    const d = new Date(c.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (key !== currentMonthKey) return s;
    return s + (c.upfront_amount || 0) + (c.slot1_amount || 0) + (c.slot2_amount || 0);
  }, 0) || 0;

  if (role !== 'ADMIN' && role !== 'SALES_TL') {
    return <div className="text-center text-muted-foreground p-8">Access denied</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold">Revenue</h1>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[currentYear, currentYear - 1, currentYear - 2].map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass-card nb-glow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Revenue</CardTitle>
              <Calendar className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold">${currentMonthRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Current month</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Yearly Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold">${totalYearRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">{yearFilter}</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg font-display">Monthly Revenue Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `$${v}`} />
                <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, 'Revenue']} />
                <Bar dataKey="revenue" fill="hsl(222, 100%, 50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default RevenuePage;

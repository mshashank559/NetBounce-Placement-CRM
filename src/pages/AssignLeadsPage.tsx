import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { Shuffle, UserPlus } from 'lucide-react';

const AssignLeadsPage: React.FC = () => {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [selectedSales, setSelectedSales] = useState('');

  const { data: unassignedLeads } = useQuery({
    queryKey: ['unassigned-leads'],
    queryFn: async () => {
      const { data } = await supabase.from('leads').select('*').is('assigned_to', null).order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: salesMembers } = useQuery({
    queryKey: ['sales-members'],
    queryFn: async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('role', ['SALES_TM', 'SALES_TL']);
      if (!roles) return [];
      const userIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase.from('profiles').select('*').in('user_id', userIds);
      return profiles || [];
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ leadId, salesUserId }: { leadId: string; salesUserId: string }) => {
      const { error } = await supabase.from('leads').update({ assigned_to: salesUserId }).eq('unique_id', leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unassigned-leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead assigned!');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const roundRobin = useMutation({
    mutationFn: async () => {
      if (!salesMembers || salesMembers.length === 0) throw new Error('No sales members available');
      if (!unassignedLeads || unassignedLeads.length === 0) throw new Error('No unassigned leads');

      const updates = unassignedLeads.map((lead, i) => ({
        leadId: lead.unique_id,
        salesUserId: salesMembers[i % salesMembers.length].user_id,
      }));

      for (const u of updates) {
        await supabase.from('leads').update({ assigned_to: u.salesUserId }).eq('unique_id', u.leadId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unassigned-leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Round robin assignment complete!');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (role !== 'ADMIN' && role !== 'LEAD_TL' && role !== 'SALES_TL') {
    return <div className="text-center text-muted-foreground p-8">Access denied</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold">Assign Leads</h1>
        <Button onClick={() => roundRobin.mutate()} disabled={roundRobin.isPending} className="nb-gradient">
          <Shuffle className="h-4 w-4 mr-2" />
          Round Robin Assign
        </Button>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg font-display">Unassigned Leads ({unassignedLeads?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!unassignedLeads?.length ? (
            <p className="text-muted-foreground text-center py-4">All leads are assigned</p>
          ) : (
            <div className="space-y-3">
              {unassignedLeads.map((lead, i) => (
                <motion.div
                  key={lead.unique_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-accent/30"
                >
                  <div>
                    <p className="font-medium text-sm">{lead.name}</p>
                    <p className="text-xs text-muted-foreground">{lead.email} · {lead.phone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={selectedSales} onValueChange={setSelectedSales}>
                      <SelectTrigger className="w-48 h-8 text-xs">
                        <SelectValue placeholder="Select salesperson" />
                      </SelectTrigger>
                      <SelectContent>
                        {salesMembers?.map(m => (
                          <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!selectedSales}
                      onClick={() => assignMutation.mutate({ leadId: lead.unique_id, salesUserId: selectedSales })}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AssignLeadsPage;

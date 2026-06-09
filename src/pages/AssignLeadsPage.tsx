import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { Shuffle, UserPlus, AlertCircle, User, RefreshCw, Search } from 'lucide-react';

const AssignLeadsPage: React.FC = () => {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedSales, setSelectedSales] = useState<Record<string, string>>({});
  const [selectedTeamMember, setSelectedTeamMember] = useState<Record<string, string>>({});
  const [assignTarget, setAssignTarget] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const getBusinessDays = (startDate: Date, endDate: Date) => {
    let count = 0;
    const curDate = new Date(startDate.getTime());
    while (curDate <= endDate) {
      const dayOfWeek = curDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
      curDate.setDate(curDate.getDate() + 1);
    }
    return count;
  };

  const { data: unassignedLeads } = useQuery({
    queryKey: ['unassigned-leads'],
    queryFn: async () => {
      if (role !== 'ADMIN' && role !== 'LEAD_TL') return [];
      let allLeads: any[] = [];
      let from = 0;
      const step = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('leads')
          .select('*')
          .or('assigned_to.is.null,assignment_type.eq.Pending')
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
    enabled: (role === 'ADMIN' || role === 'LEAD_TL') && !!user,
  });

  const { data: agingLeads, isLoading: agingLoading } = useQuery({
    queryKey: ['aging-leads'],
    queryFn: async () => {
      let allLeads: any[] = [];
      let from = 0;
      const step = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('leads')
          .select('*')
          .in('lead_status', ['DNR1', 'DNR2', 'DNR3', 'Connected', 'Qualified', 'Hot Prospect'])
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
      
      const now = new Date();
      return allLeads.map(lead => {
        const days = getBusinessDays(new Date(lead.updated_at), now);
        return { ...lead, aging_days: days };
      }).filter(lead => lead.aging_days >= 10)
        .sort((a, b) => b.aging_days - a.aging_days);
    },
  });

  const { data: salesMembers } = useQuery({
    queryKey: ['sales-members', user?.id],
    queryFn: async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('role', ['SALES_TM', 'SALES_TL']);
      if (!roles) return [];
      const userIds = roles.map(r => r.user_id);
      
      const { data: profiles } = await supabase.from('profiles').select('*').in('user_id', userIds);
      if (!profiles) return [];
      
      const filteredProfiles = role === 'SALES_TL'
        ? profiles.filter((p: any) => p.reports_to === user!.id)
        : profiles;
      
      return filteredProfiles.map(p => ({
        ...p,
        role: roles.find(r => r.user_id === p.user_id)?.role
      })) || [];
    },
  });

  const { data: teamQueueLeads } = useQuery({
    queryKey: ['team-queue-leads', user?.id],
    queryFn: async () => {
      if (role !== 'SALES_TL') return [];
      let allLeads: any[] = [];
      let from = 0;
      const step = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from('leads')
          .select('*')
          .eq('assigned_to', user!.id)
          .eq('assignment_type', 'Team')
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
    enabled: role === 'SALES_TL' && !!user,
  });

  const filteredUnassigned = useMemo(() => {
    if (!unassignedLeads) return [];
    if (!searchQuery) return unassignedLeads;
    const q = searchQuery.toLowerCase().trim();
    return unassignedLeads.filter(l => 
      l.name?.toLowerCase().includes(q)
    );
  }, [unassignedLeads, searchQuery]);

  const filteredTeamQueue = useMemo(() => {
    if (!teamQueueLeads) return [];
    if (!searchQuery) return teamQueueLeads;
    const q = searchQuery.toLowerCase().trim();
    return teamQueueLeads.filter(l => 
      l.name?.toLowerCase().includes(q)
    );
  }, [teamQueueLeads, searchQuery]);

  const assignMutation = useMutation({
    mutationFn: async ({ leadId, selection }: { leadId: string; selection: string }) => {
      const [userId, type] = selection.split('_');
      const isTL = salesMembers?.find(m => m.user_id === userId)?.role === 'SALES_TL';
      
      const { data: lead } = await supabase.from('leads').select('name').eq('unique_id', leadId).single();
      const leadName = lead?.name || 'Lead';

      const { error } = await supabase.from('leads').update({ 
        assigned_to: userId,
        assignment_type: type,
        team_lead_id: isTL ? userId : null // If assigned to TL, they are the team lead
      } as any).eq('unique_id', leadId);
      if (error) throw error;

      // Notifications
      const admins = (await supabase.from('user_roles').select('user_id').eq('role', 'ADMIN')).data?.map(r => r.user_id) || [];
      const targets = new Set<string>([...admins, userId]);
      if (isTL) {
        targets.add(userId);
      }
      
      const notifs = Array.from(targets).map(tId => ({
        user_id: tId,
        title: 'Lead Assigned',
        message: `Lead "${leadName}" has been assigned to ${salesMembers?.find(m => m.user_id === userId)?.full_name || 'salesperson'}.`,
        type: 'lead_assigned',
        lead_id: leadId,
      }));
      await supabase.from('notifications').insert(notifs);
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
      // FIX: Only round robin to Sales Team Leads for BD TL
      const tls = salesMembers?.filter(m => m.role === 'SALES_TL') || [];
      if (tls.length === 0) throw new Error('No sales team leads available');
      if (!unassignedLeads || unassignedLeads.length === 0) throw new Error('No unassigned leads');

      // Group lead unique_ids by salesUserId
      const groups: Record<string, string[]> = {};
      tls.forEach(tl => {
        groups[tl.user_id] = [];
      });

      unassignedLeads.forEach((lead, i) => {
        const targetTl = tls[i % tls.length];
        groups[targetTl.user_id].push(lead.unique_id);
      });

      const admins = (await supabase.from('user_roles').select('user_id').eq('role', 'ADMIN')).data?.map(r => r.user_id) || [];

      // Perform one update per TL (bulk update using .in())
      for (const [salesUserId, leadIds] of Object.entries(groups)) {
        if (leadIds.length === 0) continue;
        const { error } = await supabase
          .from('leads')
          .update({ 
            assigned_to: salesUserId,
            assignment_type: 'Team', // Assign to Team Queue of the TL
            team_lead_id: salesUserId
          } as any)
          .in('unique_id', leadIds);
          
        if (error) throw error;

        // Send notifications
        const salesName = salesMembers?.find(m => m.user_id === salesUserId)?.full_name || 'Sales TL';
        const targets = new Set<string>([...admins, salesUserId]);
        const notifs: any[] = [];
        
        for (const leadId of leadIds) {
          const lName = unassignedLeads.find(l => l.unique_id === leadId)?.name || 'Lead';
          targets.forEach(tId => {
            notifs.push({
              user_id: tId,
              title: 'Lead Assigned (Round Robin)',
              message: `Lead "${lName}" has been assigned to ${salesName} (Team Queue).`,
              type: 'lead_assigned',
              lead_id: leadId,
            });
          });
        }
        await supabase.from('notifications').insert(notifs);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unassigned-leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Round robin assignment complete!');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reassignMutation = useMutation({
    mutationFn: async ({ leadId, tlId, queueType }: { leadId: string, tlId: string, queueType: 'Personal' | 'Team' }) => {
      const lead = agingLeads?.find(l => l.unique_id === leadId);
      if (!lead) return;

      const { error } = await supabase.from('leads').update({
        assigned_to: tlId,
        assignment_type: queueType,
        team_lead_id: tlId // Update team ownership
      } as any).eq('unique_id', leadId);
      
      if (error) throw error;

      await supabase.from('lead_history_logs').insert({
        lead_id: leadId,
        changed_by: user!.id,
        action_type: 'OWNER_CHANGE',
        old_value: lead.assigned_to || 'Unassigned',
        new_value: tlId,
        comments: `Reassigned to ${queueType} Queue due to aging.`
      });

      const notifs = [
        { user_id: tlId, title: 'Lead Reassigned', message: `Lead ${lead.name} has been assigned to your ${queueType} queue.`, type: 'reassign', lead_id: leadId }
      ];
      if (lead.assigned_to) {
        notifs.push({ user_id: lead.assigned_to, title: 'Lead Reassigned', message: `Lead ${lead.name} was removed due to aging.`, type: 'reassign', lead_id: leadId });
      }
      await supabase.from('notifications').insert(notifs);
    },
    onSuccess: () => {
      toast.success('Lead successfully reassigned');
      queryClient.invalidateQueries({ queryKey: ['aging-leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (err: Error) => toast.error(err.message)
  });

  const assignTeamLeadMutation = useMutation({
    mutationFn: async ({ leadId, salesUserId }: { leadId: string; salesUserId: string }) => {
      const { data: lead } = await supabase.from('leads').select('name, team_lead_id').eq('unique_id', leadId).single();
      const leadName = lead?.name || 'Lead';
      const originalTL = lead?.team_lead_id || user!.id;

      const { error } = await supabase.from('leads').update({ 
        assigned_to: salesUserId,
        assignment_type: 'Personal',
        team_lead_id: originalTL // Keep current TL as team owner
      } as any).eq('unique_id', leadId);
      if (error) throw error;

      // Notify ADMIN, assigned salesperson, and original TL
      const admins = (await supabase.from('user_roles').select('user_id').eq('role', 'ADMIN')).data?.map(r => r.user_id) || [];
      const targets = new Set<string>([...admins, salesUserId, originalTL]);
      const salesName = salesMembers?.find(m => m.user_id === salesUserId)?.full_name || 'Sales TM';

      const notifs = Array.from(targets).map(tId => ({
        user_id: tId,
        title: 'Lead Assigned',
        message: `Lead "${leadName}" has been assigned to ${salesName} (Personal).`,
        type: 'lead_assigned',
        lead_id: leadId,
      }));
      await supabase.from('notifications').insert(notifs);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-queue-leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead assigned from Team Queue!');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const roundRobinTeam = useMutation({
    mutationFn: async () => {
      const targetMembers = salesMembers?.filter(m => m.role === 'SALES_TM') || [];
      if (!targetMembers || targetMembers.length === 0) throw new Error('No sales team members available');
      if (!teamQueueLeads || teamQueueLeads.length === 0) throw new Error('No team queue leads');

      // Group lead unique_ids by salesUserId
      const groups: Record<string, string[]> = {};
      targetMembers.forEach(m => {
        groups[m.user_id] = [];
      });

      teamQueueLeads.forEach((lead, i) => {
        const targetMember = targetMembers[i % targetMembers.length];
        groups[targetMember.user_id].push(lead.unique_id);
      });

      const admins = (await supabase.from('user_roles').select('user_id').eq('role', 'ADMIN')).data?.map(r => r.user_id) || [];
      const currentTL = user!.id;

      // Perform one update per team member (bulk update using .in())
      for (const [salesUserId, leadIds] of Object.entries(groups)) {
        if (leadIds.length === 0) continue;
        const { error } = await supabase
          .from('leads')
          .update({ 
            assigned_to: salesUserId,
            assignment_type: 'Personal',
            team_lead_id: currentTL // Keep current TL as team owner
          } as any)
          .in('unique_id', leadIds);
          
        if (error) throw error;

        // Send notifications
        const salesName = targetMembers.find(m => m.user_id === salesUserId)?.full_name || 'Sales TM';
        const targets = new Set<string>([...admins, salesUserId, currentTL]);
        const notifs: any[] = [];
        
        for (const leadId of leadIds) {
          const lName = teamQueueLeads.find(l => l.unique_id === leadId)?.name || 'Lead';
          targets.forEach(tId => {
            notifs.push({
              user_id: tId,
              title: 'Lead Assigned (Round Robin Team)',
              message: `Lead "${lName}" has been assigned to ${salesName} (Personal).`,
              type: 'lead_assigned',
              lead_id: leadId,
            });
          });
        }
        await supabase.from('notifications').insert(notifs);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-queue-leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Team queue round robin complete!');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (role !== 'ADMIN' && role !== 'LEAD_TL' && role !== 'SALES_TL') {
    return <div className="text-center text-muted-foreground p-8">Access denied</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <h1 className="text-2xl font-display font-bold">Assign Leads</h1>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-accent/20"
            />
          </div>
          {(role === 'ADMIN' || role === 'LEAD_TL') && (
            <Button onClick={() => roundRobin.mutate()} disabled={roundRobin.isPending} className="nb-gradient h-9">
              <Shuffle className="h-4 w-4 mr-2" />
              Round Robin Assign
            </Button>
          )}
        </div>
      </div>

      {(role === 'ADMIN' || role === 'LEAD_TL') && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg font-display">Unassigned Leads ({filteredUnassigned?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {!filteredUnassigned?.length ? (
              <p className="text-muted-foreground text-center py-4">
                {searchQuery ? 'No matching leads found' : 'All leads are assigned'}
              </p>
            ) : (
              <div className="space-y-3">
                {filteredUnassigned.map((lead) => (
                  <div
                    key={lead.unique_id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-accent/30 gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{lead.name}</p>
                      <div className="flex flex-wrap items-center gap-1 mt-0.5">
                        <span className="text-xs text-muted-foreground truncate">{lead.email} · {lead.phone}</span>
                        {lead.lead_source && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-500">{lead.lead_source}</span>
                        )}
                        {lead.lead_category && (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            lead.lead_category === 'Hot' ? 'bg-orange-500/10 text-orange-500' : 'bg-slate-500/10 text-slate-400'
                          }`}>{lead.lead_category}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={selectedSales[lead.unique_id] || ''}
                        onValueChange={(v) => setSelectedSales(prev => ({ ...prev, [lead.unique_id]: v }))}
                      >
                        <SelectTrigger className="w-48 h-8 text-xs">
                          <SelectValue placeholder="Select salesperson" />
                        </SelectTrigger>
                        <SelectContent>
                          {salesMembers?.filter(m => {
                            // If Admin or BD TL, only show Sales TLs
                            if (role === 'ADMIN' || role === 'LEAD_TL') return m.role === 'SALES_TL';
                            // If Sales TL, only show their team members (already filtered in query)
                            return true;
                          }).map(m => 
                            m.role === 'SALES_TL' ? (
                              <React.Fragment key={m.user_id}>
                                <SelectItem value={`${m.user_id}_Personal`}>{m.full_name} -- Personal</SelectItem>
                                <SelectItem value={`${m.user_id}_Team`}>{m.full_name} -- Team</SelectItem>
                              </React.Fragment>
                            ) : (
                              <SelectItem key={`${m.user_id}_Personal`} value={`${m.user_id}_Personal`}>{m.full_name} -- Personal</SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!selectedSales[lead.unique_id]}
                        onClick={() => {
                          assignMutation.mutate({ leadId: lead.unique_id, selection: selectedSales[lead.unique_id] });
                          setSelectedSales(prev => { const n = { ...prev }; delete n[lead.unique_id]; return n; });
                        }}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {role === 'SALES_TL' && (
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg font-display">My Team Queue Leads ({filteredTeamQueue?.length || 0})</CardTitle>
            </div>
            {filteredTeamQueue && filteredTeamQueue.length > 0 && (
              <Button onClick={() => roundRobinTeam.mutate()} disabled={roundRobinTeam.isPending} size="sm" className="nb-gradient">
                <Shuffle className="h-3.5 w-3.5 mr-2" />
                Round Robin Team Queue
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!filteredTeamQueue?.length ? (
              <p className="text-muted-foreground text-center py-4">
                {searchQuery ? 'No matching leads in your team queue' : 'Your team queue is empty'}
              </p>
            ) : (
              <div className="space-y-3">
                {filteredTeamQueue.map((lead) => (
                  <div
                    key={lead.unique_id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-accent/30 gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{lead.name}</p>
                      <div className="flex flex-wrap items-center gap-1 mt-0.5">
                        <span className="text-xs text-muted-foreground truncate">{lead.email} · {lead.phone}</span>
                        {lead.lead_source && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-500">{lead.lead_source}</span>
                        )}
                        {lead.lead_category && (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            lead.lead_category === 'Hot' ? 'bg-orange-500/10 text-orange-500' : 'bg-slate-500/10 text-slate-400'
                          }`}>{lead.lead_category}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={selectedTeamMember[lead.unique_id] || ''}
                        onValueChange={(v) => setSelectedTeamMember(prev => ({ ...prev, [lead.unique_id]: v }))}
                      >
                        <SelectTrigger className="w-48 h-8 text-xs">
                          <SelectValue placeholder="Select salesperson" />
                        </SelectTrigger>
                        <SelectContent>
                          {salesMembers?.filter(m => m.role === 'SALES_TM').map(m => (
                            <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!selectedTeamMember[lead.unique_id] || assignTeamLeadMutation.isPending}
                        onClick={() => {
                          assignTeamLeadMutation.mutate({ leadId: lead.unique_id, salesUserId: selectedTeamMember[lead.unique_id] });
                          setSelectedTeamMember(prev => { const n = { ...prev }; delete n[lead.unique_id]; return n; });
                        }}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-display">Lead To Be Reassigned ({agingLeads?.length || 0} pending)</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {agingLoading ? (
            <p className="text-muted-foreground text-center py-4">Analyzing lifecycle aging...</p>
          ) : !agingLeads?.length ? (
            <p className="text-muted-foreground text-center py-4">No aging leads require reassignment at this time.</p>
          ) : (
            <div className="space-y-4">
              {agingLeads.map((lead) => (
                <div
                  key={lead.unique_id}
                  className="bg-accent/5 border border-border/50 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-semibold text-sm">{lead.name}</h4>
                      <p className="text-xs text-muted-foreground">{lead.email} · {lead.lead_status}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-medium text-orange-500 bg-orange-500/10 px-2 py-1 rounded">
                      <AlertCircle className="h-3 w-3" />
                      {lead.aging_days} Days
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2 mt-4 sm:flex-row sm:items-center sm:justify-end">
                    <Select value={assignTarget} onValueChange={setAssignTarget}>
                      <SelectTrigger className="w-full sm:w-48 h-8 text-xs">
                        <SelectValue placeholder="Assign to..." />
                      </SelectTrigger>
                      <SelectContent>
                        {salesMembers?.filter(m => {
                          if (role === 'ADMIN' || role === 'LEAD_TL') return m.role === 'SALES_TL';
                          return true;
                        }).map(m => 
                          m.role === 'SALES_TL' ? (
                            <React.Fragment key={m.user_id}>
                              <SelectItem value={`${m.user_id}_Personal`}>{m.full_name} -- Personal</SelectItem>
                              <SelectItem value={`${m.user_id}_Team`}>{m.full_name} -- Team</SelectItem>
                            </React.Fragment>
                          ) : (
                            <SelectItem key={`${m.user_id}_Personal`} value={`${m.user_id}_Personal`}>{m.full_name} -- Personal</SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-xs h-8"
                        disabled={!assignTarget || reassignMutation.isPending}
                        onClick={() => {
                          const [id] = assignTarget.split('_');
                          reassignMutation.mutate({ leadId: lead.unique_id, tlId: id, queueType: 'Personal' });
                        }}
                      >
                        <User className="h-3 w-3 mr-1" /> Personal
                      </Button>
                      <Button 
                        size="sm" 
                        className="text-xs h-8 nb-gradient"
                        disabled={!assignTarget || reassignMutation.isPending}
                        onClick={() => {
                          const [id] = assignTarget.split('_');
                          reassignMutation.mutate({ leadId: lead.unique_id, tlId: id, queueType: 'Team' });
                        }}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" /> Master
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AssignLeadsPage;

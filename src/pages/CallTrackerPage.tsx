import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, User, Calendar, MessageSquare, Search } from 'lucide-react';

const CallTrackerPage: React.FC = () => {
  const { user, role } = useAuth();
  const [viewMode, setViewMode] = useState<'my' | 'team'>('team');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  // Reset page when search query or viewMode changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery, viewMode]);

  // 1. Fetch all profiles to map user_id -> Full Name
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-for-call-tracker'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name');
      return data || [];
    },
    enabled: !!user,
  });

  const getProfileName = (id: string) => {
    return profiles.find(p => p.user_id === id)?.full_name || 'Unknown Salesperson';
  };

  // 2. Fetch team members if user is a Sales TL
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members-for-calls', user?.id],
    queryFn: async () => {
      if (!user || role !== 'SALES_TL') return [];
      const { data } = await (supabase
        .from('profiles')
        .select('user_id, reports_to') as any)
        .eq('reports_to', user.id);
      return data || [];
    },
    enabled: !!user && role === 'SALES_TL',
  });

  const teamMemberIds = useMemo(() => {
    return teamMembers.map(m => m.user_id);
  }, [teamMembers]);

  // 3. Fetch call logs (followups table since it holds the notes/comments)
  const { data: followups = [], isLoading } = useQuery({
    queryKey: ['call-tracker-followups', user?.id, role, viewMode, teamMemberIds],
    queryFn: async () => {
      if (!user) return [];
      
      // Select the follow-up details along with the lead's name
      let query = supabase
        .from('followups')
        .select('*, leads(name)')
        .order('created_at', { ascending: false });

      if (role === 'SALES_TM') {
        // Sales member: can only see their own logs
        query = query.eq('user_id', user.id);
      } else if (role === 'SALES_TL') {
        if (viewMode === 'my') {
          // Sales TL personal view: only see own logs
          query = query.eq('user_id', user.id);
        } else {
          // Sales TL team view: strictly see own + reporting team members
          const allowedIds = [user.id, ...teamMemberIds];
          query = query.in('user_id', allowedIds);
        }
      }
      // ADMIN and PROCESS_ANALYST get full access with no restrictions

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && (role !== 'SALES_TL' || !!teamMembers),
  });

  // Filter logs locally based on search query (by salesperson or candidate name)
  const filteredFollowups = useMemo(() => {
    if (!searchQuery.trim()) return followups;
    
    const query = searchQuery.toLowerCase();
    return followups.filter((item: any) => {
      const candidateName = item.leads?.name?.toLowerCase() || '';
      const salespersonName = getProfileName(item.user_id).toLowerCase();
      const notes = item.notes?.toLowerCase() || '';
      return (
        candidateName.includes(query) ||
        salespersonName.includes(query) ||
        notes.includes(query)
      );
    });
  }, [followups, searchQuery, profiles]);

  const totalCount = filteredFollowups.length;
  const paginatedFollowups = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return filteredFollowups.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredFollowups, page, PAGE_SIZE]);

  // Compute live KPIs dynamically based on what is currently displayed
  const stats = useMemo(() => {
    const todayStr = new Date().toDateString();
    
    let todayCalls = 0;
    filteredFollowups.forEach((item: any) => {
      const itemDate = new Date(item.created_at).toDateString();
      if (itemDate === todayStr) {
        todayCalls++;
      }
    });

    return {
      todayCalls,
      totalCalls: filteredFollowups.length,
    };
  }, [filteredFollowups]);

  if (role !== 'SALES_TM' && role !== 'SALES_TL' && role !== 'ADMIN' && role !== 'PROCESS_ANALYST') {
    return <div className="text-center text-muted-foreground p-8">Access denied</div>;
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Phone className="h-6 w-6 text-primary" />
            Call Tracker
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {role === 'SALES_TL'
              ? 'View and audit personal and team client calls'
              : role === 'SALES_TM'
              ? 'Your personal outbound calling history and notes'
              : 'Enterprise-wide call audit and tracker'}
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search candidate, user..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 pl-8 h-9 text-xs"
            />
          </div>

          {/* Toggle button for Sales TL */}
          {role === 'SALES_TL' && (
            <Tabs
              value={viewMode}
              onValueChange={(val) => setViewMode(val as 'my' | 'team')}
              className="w-[200px]"
            >
              <TabsList className="grid w-full grid-cols-2 h-9">
                <TabsTrigger value="my" className="text-xs">My View</TabsTrigger>
                <TabsTrigger value="team" className="text-xs">Team View</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass-card border-primary/20 hover:nb-glow transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
                {viewMode === 'my' && role === 'SALES_TL' ? 'My Today\'s Calls' : 'Today\'s Calls'}
              </CardTitle>
              <Phone className="h-4 w-4 text-primary animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-display font-bold">{stats.todayCalls}</div>
              <p className="text-xs text-muted-foreground mt-1.5">Resets automatically at midnight</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
                {viewMode === 'my' && role === 'SALES_TL' ? 'My Total Calls' : 'Total Calls'}
              </CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-display font-bold">{stats.totalCalls}</div>
              <p className="text-xs text-muted-foreground mt-1.5">Accumulated count across active timeline</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Tabular Call History */}
      <Card className="glass-card overflow-hidden">
        <CardHeader className="border-b border-border/30 bg-accent/10 px-5 py-4">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span>Call History Logs</span>
            {isLoading && <span className="text-xs font-normal text-muted-foreground">Loading logs...</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/40 bg-accent/20">
                  <th className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-5">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3 w-3" /> Salesperson
                    </div>
                  </th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" /> Calling Date
                    </div>
                  </th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Candidate Name
                  </th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Method
                  </th>
                  <th className="p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider pr-5">
                    <div className="flex items-center gap-1.5">
                      <MessageSquare className="h-3 w-3" /> Comment
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {!paginatedFollowups.length ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-muted-foreground text-sm">
                        No call logs matched the current view/filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedFollowups.map((log: any, idx: number) => {
                      const salespersonName = getProfileName(log.user_id);
                      const candidateName = log.leads?.name || 'Unknown Candidate';
                      const formattedDate = new Date(log.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      }) + ' ' + new Date(log.created_at).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      });

                      return (
                        <motion.tr
                          key={log.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ delay: Math.min(idx * 0.02, 0.2) }}
                          className="border-b border-border/30 hover:bg-accent/40 transition-colors"
                        >
                          {/* Salesperson Name */}
                          <td className="p-3 text-xs font-medium pl-5 whitespace-nowrap">
                            {salespersonName}
                            {log.user_id === user?.id && (
                              <Badge variant="outline" className="ml-2 text-[9px] px-1 py-0 border-primary/40 text-primary">
                                You
                              </Badge>
                            )}
                          </td>

                          {/* Calling Date */}
                          <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                            {formattedDate}
                          </td>

                          {/* Candidate/Lead Name */}
                          <td className="p-3 text-xs font-semibold text-primary">
                            {candidateName}
                          </td>

                          {/* Method of contact */}
                          <td className="p-3 text-xs">
                            <Badge variant="secondary" className="text-[10px] uppercase font-semibold">
                              {log.way_of_contact || 'Call'}
                            </Badge>
                          </td>

                          {/* Comment Box */}
                          <td className="p-3 text-xs text-muted-foreground pr-5 max-w-sm truncate" title={log.notes}>
                            {log.notes || '—'}
                          </td>
                        </motion.tr>
                      );
                    })
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalCount > 0 && (
            <div className="flex justify-between items-center p-4 border-t border-border flex-wrap gap-2 bg-background/50">
              <span className="text-xs text-muted-foreground">
                Showing {Math.min(totalCount, (page - 1) * PAGE_SIZE + 1)} to {Math.min(totalCount, page * PAGE_SIZE)} of {totalCount} leads
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="h-8 text-xs"
                >
                  Previous
                </Button>
                <span className="text-xs font-medium">
                  Page {page} of {Math.ceil(totalCount / PAGE_SIZE) || 1}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page * PAGE_SIZE >= totalCount}
                  onClick={() => setPage(p => p + 1)}
                  className="h-8 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CallTrackerPage;

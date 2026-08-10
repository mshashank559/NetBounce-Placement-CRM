import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, Calendar, Clock, LogIn, LogOut, ShieldCheck, UserCheck, LayoutDashboard, Eye, RefreshCw } from 'lucide-react';

import { getISTYearAndMonth, getISTDateString, formatToISTDateString } from '@/lib/dateUtils';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const fmt = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
};

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
};

const duration = (loginIso: string, logoutIso: string | null) => {
  if (!logoutIso) return '—';
  const diff = new Date(logoutIso).getTime() - new Date(loginIso).getTime();
  if (diff <= 0) return '—';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const LoginActivityPage: React.FC = () => {
  const { role } = useAuth();

  // ── Filters ──────────────────────────────────────────────────
  const [userFilter, setUserFilter]     = useState('all');
  const [actionFilter, setActionFilter] = useState('all'); // 'all', 'LOGIN', 'DASHBOARD_ACCESS'
  const [monthFilter, setMonthFilter]   = useState('all');
  const [dateFrom, setDateFrom]         = useState('');
  const [dateTo, setDateTo]             = useState('');
  const [page, setPage]                 = useState(1);
  const PAGE_SIZE = 50;

  // ── Fetch all users for the filter dropdown ───────────────────
  const { data: allUsers } = useQuery({
    queryKey: ['all-users-activity'],
    queryFn: async () => {
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, email');
      const { data: roles }    = await supabase.from('user_roles').select('user_id, role');
      const roleMap: Record<string, string> = {};
      roles?.forEach(r => { roleMap[r.user_id] = r.role; });
      return (profiles || []).map(p => ({ ...p, role: roleMap[p.user_id] || 'Unknown' }));
    },
  });

  // ── Fetch login activity ──────────────────────────────────────
  const { data: activity = [], isLoading, refetch: refetchActivity, isFetching: isFetchingActivity } = useQuery({
    queryKey: ['login-activity'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('login_activity')
        .select('*')
        .order('logged_in_at', { ascending: false });
      if (error) {
        console.error('Error loading login activity:', error);
        return [];
      }
      return data || [];
    },
    staleTime: 0,
    refetchInterval: 10000, // refresh every 10s
  });

  // ── Client-side filtering ─────────────────────────────────────
  const filtered = useMemo(() => {
    return activity.filter((row: any) => {
      if (userFilter !== 'all' && row.user_id !== userFilter && row.target_user_id !== userFilter) return false;

      if (actionFilter !== 'all') {
        const type = row.action_type || 'LOGIN';
        if (type !== actionFilter) return false;
      }

      if (monthFilter !== 'all') {
        const ist = getISTYearAndMonth(row.logged_in_at);
        if (ist.month !== parseInt(monthFilter)) return false;
      }

      const istDateStr = getISTDateString(row.logged_in_at);
      if (dateFrom && istDateStr < dateFrom) return false;
      if (dateTo && istDateStr > dateTo) return false;

      return true;
    });
  }, [activity, userFilter, actionFilter, monthFilter, dateFrom, dateTo]);

  useEffect(() => {
    setPage(1);
  }, [userFilter, actionFilter, monthFilter, dateFrom, dateTo, activity.length]);

  const totalCount = filtered.length;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;
  const paginatedActivity = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Build profile map for display (fallback for legacy rows without denorm data) ──
  const profileMap = useMemo(() => {
    const m: Record<string, { full_name: string; email: string; role: string }> = {};
    allUsers?.forEach(u => { m[u.user_id] = u; });
    return m;
  }, [allUsers]);

  if (role !== 'ADMIN') {
    return <div className="text-center text-muted-foreground p-8">Access denied</div>;
  }

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-display font-bold">Login & Access Audit Trail</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetchActivity()}
            disabled={isFetchingActivity}
            className="h-8 text-xs gap-1.5 border-border/60 hover:bg-accent/40 shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetchingActivity ? 'animate-spin text-primary' : ''}`} />
            Refresh Logs
          </Button>
          <span className="text-xs text-muted-foreground bg-accent/40 px-3 py-1 rounded-full border border-border/50">
            {filtered.length} total event{filtered.length !== 1 ? 's' : ''} recorded
          </span>
        </div>
      </div>

      {/* ── Filters ───────────────────────────────────────────── */}
      <Card className="glass-card">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            {/* User filter */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Actor / Member</p>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Members" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Members</SelectItem>
                  {allUsers?.map(u => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.full_name} ({u.role?.replace(/_/g, ' ')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Event Action Type filter */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Event Type</p>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Events" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  <SelectItem value="LOGIN">Direct Logins</SelectItem>
                  <SelectItem value="DASHBOARD_ACCESS">Dashboard Access</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Month filter */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Month</p>
              <Select value={monthFilter} onValueChange={setMonthFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="All Months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {MONTH_NAMES.map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date range */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Date Range</p>
              <div className="flex items-center gap-1.5 bg-background px-2.5 rounded-md border border-input h-10">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="w-[130px] h-8 text-xs border-0 bg-transparent pl-1 pr-2 focus-visible:ring-0 focus-visible:ring-offset-0"
                  title="From date"
                />
                <span className="text-muted-foreground text-xs">—</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="w-[130px] h-8 text-xs border-0 bg-transparent pl-1 pr-2 focus-visible:ring-0 focus-visible:ring-offset-0"
                  title="To date"
                />
              </div>
            </div>

            {/* Clear */}
            {(userFilter !== 'all' || actionFilter !== 'all' || monthFilter !== 'all' || dateFrom || dateTo) && (
              <button
                onClick={() => { setUserFilter('all'); setActionFilter('all'); setMonthFilter('all'); setDateFrom(''); setDateTo(''); }}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 mt-5"
              >
                Clear filters
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Activity Table ────────────────────────────────────── */}
      <Card className="glass-card">
        <CardHeader className="pb-3 border-b border-border/30">
          <CardTitle className="text-lg font-display flex items-center justify-between">
            <span>Audit Records</span>
            <span className="text-xs font-normal text-muted-foreground">Times displayed in IST (Asia/Kolkata)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading activity...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No audit activity found</div>
          ) : (
            <div>
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-accent/30">
                    <th className="text-left p-3 font-medium text-muted-foreground text-xs">Date & Time</th>
                    <th className="text-left p-3 font-medium text-muted-foreground text-xs">Actor (Logged-In User)</th>
                    <th className="text-left p-3 font-medium text-muted-foreground text-xs">Action</th>
                    <th className="text-left p-3 font-medium text-muted-foreground text-xs">Target Account / Dashboard</th>
                    <th className="text-left p-3 font-medium text-muted-foreground text-xs">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-muted-foreground" /> Session Duration</span>
                    </th>
                    <th className="text-left p-3 font-medium text-muted-foreground text-xs">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedActivity.map((row: any, i: number) => {
                    const profile = profileMap[row.user_id];
                    const actorName  = row.user_name  || profile?.full_name || 'User';
                    const actorEmail = row.user_email || profile?.email     || '—';
                    const actorRole  = row.user_role  || profile?.role      || 'USER';
                    const actionType = row.action_type || 'LOGIN';
                    const isDirectLogin = actionType === 'LOGIN';
                    const isImpersonated = !isDirectLogin || (row.target_user_id && row.target_user_id !== row.user_id);
                    const isActive = !row.logged_out_at;

                    const targetName = row.target_user_name || (isDirectLogin ? actorName : 'Target Dashboard');
                    const targetRole = row.target_user_role || (isDirectLogin ? actorRole : null);
                    const dashboardName = row.dashboard_accessed || (isDirectLogin ? `${actorRole.replace(/_/g, ' ')} Dashboard` : 'Dashboard');

                    return (
                      <motion.tr
                        key={row.id || i}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.01 }}
                        className="border-b border-border/50 hover:bg-accent/20 transition-colors"
                      >
                        {/* Timestamp */}
                        <td className="p-3 text-xs whitespace-nowrap">
                          <div className="font-medium text-foreground">{fmt(row.logged_in_at)}</div>
                          <div className="text-[11px] text-muted-foreground">{fmtDate(row.logged_in_at)}</div>
                        </td>

                        {/* Actor */}
                        <td className="p-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-foreground text-xs">{actorName}</span>
                            <Badge variant="outline" className="text-[10px] font-normal py-0 h-4">
                              {actorRole.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                          <div className="text-[11px] text-muted-foreground">{actorEmail}</div>
                        </td>

                        {/* Action Type Badge */}
                        <td className="p-3 whitespace-nowrap">
                          {isDirectLogin ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] flex items-center gap-1 w-fit">
                              <LogIn className="h-3 w-3" /> Direct Login
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[10px] flex items-center gap-1 w-fit">
                              <LayoutDashboard className="h-3 w-3" /> Accessed Dashboard
                            </Badge>
                          )}
                        </td>

                        {/* Target Account / Dashboard */}
                        <td className="p-3">
                          {isImpersonated ? (
                            <div>
                              <div className="font-medium text-foreground text-xs flex items-center gap-1">
                                <Eye className="h-3 w-3 text-blue-400" />
                                {targetName}
                                {targetRole && (
                                  <Badge variant="secondary" className="text-[9px] py-0 h-3.5 ml-1">
                                    {targetRole.replace(/_/g, ' ')}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {dashboardName}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="text-xs text-foreground font-medium">{dashboardName}</div>
                              <div className="text-[10px] text-muted-foreground">Self Account</div>
                            </div>
                          )}
                        </td>

                        {/* Duration */}
                        <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                          {isDirectLogin ? duration(row.logged_in_at, row.logged_out_at) : '—'}
                        </td>

                        {/* Status */}
                        <td className="p-3 whitespace-nowrap">
                          {isDirectLogin ? (
                            isActive ? (
                              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 font-medium">
                                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground">
                                Logged Out ({fmt(row.logged_out_at)})
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">
                              Inspected
                            </span>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalCount > 0 && (
              <div className="flex justify-between items-center p-4 border-t border-border flex-wrap gap-2">
                <span className="text-xs text-muted-foreground">
                  Showing {Math.min(totalCount, (page - 1) * PAGE_SIZE + 1)} to {Math.min(totalCount, page * PAGE_SIZE)} of {totalCount} records
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-xs font-medium">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page * PAGE_SIZE >= totalCount}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginActivityPage;

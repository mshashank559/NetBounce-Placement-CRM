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
import { Activity, Calendar, Clock, LogIn, LogOut } from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const fmt = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
};

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
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
  const [userFilter, setUserFilter]   = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [dateFrom, setDateFrom]       = useState('');
  const [dateTo, setDateTo]           = useState('');
  const [page, setPage]               = useState(1);
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
  const { data: activity = [], isLoading } = useQuery({
    queryKey: ['login-activity'],
    queryFn: async () => {
      const { data } = await supabase
        .from('login_activity')
        .select('*')
        .order('logged_in_at', { ascending: false });
      return data || [];
    },
    refetchInterval: 30000, // refresh every 30s
  });

  // ── Client-side filtering ─────────────────────────────────────
  const filtered = useMemo(() => {
    return activity.filter(row => {
      const loginDate = new Date(row.logged_in_at);

      if (userFilter !== 'all' && row.user_id !== userFilter) return false;

      if (monthFilter !== 'all') {
        if (loginDate.getMonth() + 1 !== parseInt(monthFilter)) return false;
      }

      if (dateFrom) {
        if (loginDate < new Date(dateFrom + 'T00:00:00')) return false;
      }
      if (dateTo) {
        if (loginDate > new Date(dateTo + 'T23:59:59')) return false;
      }

      return true;
    });
  }, [activity, userFilter, monthFilter, dateFrom, dateTo]);

  useEffect(() => {
    setPage(1);
  }, [userFilter, monthFilter, dateFrom, dateTo, activity.length]);

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
          <h1 className="text-2xl font-display font-bold">Login Activity</h1>
        </div>
        <span className="text-sm text-muted-foreground">{filtered.length} record{filtered.length !== 1 ? 's' : ''} found</span>
      </div>

      {/* ── Filters ───────────────────────────────────────────── */}
      <Card className="glass-card">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            {/* User filter */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Member</p>
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Members" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Members</SelectItem>
                  {allUsers?.map(u => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.full_name}
                    </SelectItem>
                  ))}
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
            {(userFilter !== 'all' || monthFilter !== 'all' || dateFrom || dateTo) && (
              <button
                onClick={() => { setUserFilter('all'); setMonthFilter('all'); setDateFrom(''); setDateTo(''); }}
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
        <CardHeader>
          <CardTitle className="text-lg font-display">Login Records</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading activity...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No login activity found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 font-medium text-muted-foreground">Member</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Role</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">
                      <span className="flex items-center gap-1"><LogIn className="h-3.5 w-3.5 text-green-500" /> Login Time</span>
                    </th>
                    <th className="text-left p-3 font-medium text-muted-foreground">
                      <span className="flex items-center gap-1"><LogOut className="h-3.5 w-3.5 text-red-400" /> Logout Time</span>
                    </th>
                    <th className="text-left p-3 font-medium text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Duration</span>
                    </th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedActivity.map((row, i) => {
                    // Prefer denormalized data stored at login time;
                    // fall back to profileMap for older rows that predate this fix
                    const profile = profileMap[row.user_id];
                    const displayName  = (row as any).user_name  || profile?.full_name || null;
                    const displayEmail = (row as any).user_email || profile?.email     || null;
                    const displayRole  = (row as any).user_role  || profile?.role      || null;
                    const isActive = !row.logged_out_at;
                    return (
                      <motion.tr
                        key={row.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        className="border-b border-border/50 hover:bg-accent/30 transition-colors"
                      >
                        <td className="p-3">
                          <p className="font-medium">{displayName || '—'}</p>
                          <p className="text-xs text-muted-foreground">{displayEmail || '—'}</p>
                        </td>
                        <td className="p-3">
                          <Badge variant="secondary" className="text-xs">
                            {displayRole ? displayRole.replace(/_/g, ' ') : '—'}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">{fmtDate(row.logged_in_at)}</td>
                        <td className="p-3">
                          <span className="text-green-600 font-medium">{fmt(row.logged_in_at)}</span>
                        </td>
                        <td className="p-3">
                          <span className={row.logged_out_at ? 'text-red-400 font-medium' : 'text-muted-foreground'}>
                            {fmt(row.logged_out_at)}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground">{duration(row.logged_in_at, row.logged_out_at)}</td>
                        <td className="p-3">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 font-medium">
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                              Logged Out
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginActivityPage;

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, ExternalLink, Filter, Trash2, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const chunkArray = <T,>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [filterType, setFilterType] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', user?.id, currentPage, filterType, dateFrom, dateTo],
    queryFn: async () => {
      try {
        let query = supabase
          .from('notifications')
          .select('*', { count: 'exact' })
          .eq('user_id', user!.id)
          .order('created_at', { ascending: false });

        if (dateFrom) {
          query = query.gte('created_at', `${dateFrom}T00:00:00`);
        }
        if (dateTo) {
          query = query.lte('created_at', `${dateTo}T23:59:59`);
        }

        if (filterType !== 'all') {
          if (filterType === 'DNR Updates') {
            query = query.eq('type', 'dnr');
          } else if (filterType === 'Lead Added') {
            query = query.in('type', ['new_lead', 'lead_added']);
          } else if (filterType === 'Lead Closed') {
            query = query.eq('type', 'closure');
          } else if (filterType === 'Revenue') {
            query = query.eq('type', 'revenue');
          } else if (filterType === 'Follow-ups') {
            query = query.eq('type', 'followup');
          } else if (filterType === 'Document Updates') {
            query = query.eq('type', 'accountant_update');
          } else if (filterType === 'SLA Alerts') {
            query = query.like('title', '%SLA Alert%');
          } else {
            query = query.eq('type', filterType);
          }
        }

        const from = (currentPage - 1) * pageSize;
        const to = from + pageSize - 1;
        const { data: dbData, count, error } = await query.range(from, to);

        if (error) {
          console.warn('Notifications range error, falling back:', error);
          const fallback = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user!.id)
            .order('created_at', { ascending: false })
            .limit(pageSize);
          return { list: fallback.data || [], totalCount: fallback.data?.length || 0 };
        }

        return { list: dbData || [], totalCount: count ?? (dbData?.length || 0) };
      } catch (err) {
        console.error('Notifications query exception:', err);
        return { list: [], totalCount: 0 };
      }
    },
    enabled: !!user?.id,
    staleTime: 5000,
    retry: 1,
  });

  const notificationsList = data?.list || [];
  const totalCount = data?.totalCount || 0;

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
    onError: (error: any) => {
      console.error('Failed to mark notification as read:', error);
      toast.error(error.message || 'Failed to mark notification as read');
    },
  });

  const bulkMarkRead = useMutation({
    mutationFn: async (ids: string[]) => {
      const chunks = chunkArray(ids, 100);
      for (const chunk of chunks) {
        const { error } = await supabase.from('notifications').update({ read: true }).in('id', chunk);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      setSelectedIds(new Set());
      toast.success('Selected notifications marked as read');
    },
    onError: (error: any) => {
      console.error('Failed to bulk mark notifications as read:', error);
      toast.error(error.message || 'Failed to mark notifications as read');
    },
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const chunks = chunkArray(ids, 100);
      for (const chunk of chunks) {
        const { error } = await supabase.from('notifications').delete().in('id', chunk);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      setSelectedIds(new Set());
      toast.success('Selected notifications deleted');
    },
    onError: (error: any) => {
      console.error('Failed to delete notifications:', error);
      toast.error(error.message || 'Failed to delete notifications');
    },
  });

  const handleNotificationClick = (n: any) => {
    if (!n.read) {
      markRead.mutate(n.id);
    }
    toggleSelection(n.id);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isAllSelected = notificationsList && notificationsList.length > 0 && notificationsList.every(n => selectedIds.has(n.id));

  const toggleSelectAll = () => {
    if (!notificationsList) return;
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notificationsList.map(n => n.id)));
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-display font-bold">Notifications</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-background px-2.5 rounded-md border border-input h-9 shrink-0">
            <span className="text-xs text-muted-foreground font-medium pr-1 select-none">Date:</span>
            <Input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setCurrentPage(1); }}
              className="w-[130px] h-7 text-xs border-0 bg-transparent pl-1 pr-3 focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-accent/40 rounded-sm"
              title="From date"
            />
            <span className="text-muted-foreground text-xs px-0.5 select-none">—</span>
            <Input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setCurrentPage(1); }}
              className="w-[130px] h-7 text-xs border-0 bg-transparent pl-1 pr-3 focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-accent/40 rounded-sm"
              title="To date"
            />
          </div>
          <Select
            value={filterType}
            onValueChange={(val) => {
              setFilterType(val);
              setCurrentPage(1);
              setSelectedIds(new Set());
            }}
          >
            <SelectTrigger className="w-40 h-9">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="Lead Added">Lead Added</SelectItem>
              <SelectItem value="Lead Closed">Lead Closed</SelectItem>
              <SelectItem value="DNR Updates">DNR Updates</SelectItem>
              <SelectItem value="Follow-ups">Follow-ups</SelectItem>
              <SelectItem value="Revenue">Revenue</SelectItem>
              <SelectItem value="concern">Concerns</SelectItem>
              <SelectItem value="SLA Alerts">SLA Alerts</SelectItem>
              <SelectItem value="Document Updates">📄 Document Updates</SelectItem>
              <SelectItem value="payment_due">💰 Payment Due Today</SelectItem>
              <SelectItem value="payment_overdue_escalation">🚨 Payment Overdue Escalation</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Card className="glass-card">
        <CardContent className="p-4">
          {/* Select All & Bulk Actions Bar */}
          {notificationsList && notificationsList.length > 0 && (
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all-notifications"
                  checked={isAllSelected}
                  onCheckedChange={toggleSelectAll}
                />
                <label htmlFor="select-all-notifications" className="text-xs font-medium text-muted-foreground cursor-pointer select-none">
                  Select All ({notificationsList.length})
                </label>
              </div>
              <AnimatePresence>
                {selectedIds.size > 0 && (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="flex items-center gap-2"
                  >
                    <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => bulkMarkRead.mutate(Array.from(selectedIds))}
                      disabled={bulkMarkRead.isPending}
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      Mark Read
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => bulkDelete.mutate(Array.from(selectedIds))}
                      disabled={bulkDelete.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-xs text-muted-foreground mt-2">Loading notifications...</p>
            </div>
          ) : !notificationsList?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No notifications</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notificationsList.map((n, i) => (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => handleNotificationClick(n)}
                  className={`flex items-start gap-3 p-3 rounded-lg transition-all duration-250 hover:bg-accent/80 cursor-pointer select-none ${
                    n.type === 'accountant_update'
                      ? n.read
                        ? 'bg-purple-500/5 border-l-2 border-purple-400/40'
                        : 'bg-purple-500/10 border-l-2 border-purple-500 shadow-sm'
                      : n.read
                        ? 'bg-accent/20'
                        : 'bg-accent/50 border-l-2 border-primary shadow-sm'
                  }`}
                >
                  {/* Checkbox */}
                  <div className="pt-0.5" onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(n.id)}
                      onCheckedChange={() => toggleSelection(n.id)}
                    />
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-sm font-semibold text-foreground">
                        {n.title}
                      </p>
                      {n.lead_id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs gap-1 text-primary hover:text-primary-foreground hover:bg-primary shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!n.read) {
                              markRead.mutate(n.id);
                            }
                            navigate('/leads');
                          }}
                        >
                          <ExternalLink className="h-3 w-3" />
                          View Lead
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{n.message}</p>
                    <span className="text-[10px] text-muted-foreground/60 mt-1.5 block">
                      {new Date(n.created_at).toLocaleString()}
                    </span>
                  </div>
                </motion.div>
              ))}

              {/* Pagination controls */}
              {totalCount > pageSize && (
                <div className="flex justify-between items-center pt-4 border-t border-border flex-wrap gap-2">
                  <span className="text-xs text-muted-foreground">
                    Showing {Math.min(totalCount, (currentPage - 1) * pageSize + 1)} to {Math.min(totalCount, currentPage * pageSize)} of {totalCount} notifications
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <span className="text-xs font-medium">
                      Page {currentPage} of {Math.ceil(totalCount / pageSize) || 1}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={currentPage * pageSize >= totalCount}
                      onClick={() => setCurrentPage(p => p + 1)}
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

export default NotificationsPage;

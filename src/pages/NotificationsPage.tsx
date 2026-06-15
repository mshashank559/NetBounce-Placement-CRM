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

  const { data: notifications } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

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

  const filteredNotifications = notifications?.filter(n => {
    // Filter by date range
    if (n.created_at) {
      const createdDate = new Date(n.created_at);
      if (dateFrom && createdDate < new Date(dateFrom)) return false;
      if (dateTo && createdDate > new Date(dateTo + 'T23:59:59')) return false;
    }

    // Filter by type
    if (filterType === 'all') return true;
    if (filterType === 'DNR Updates') return n.type === 'dnr';
    if (filterType === 'Lead Added') return n.type === 'new_lead' || n.type === 'lead_added';
    if (filterType === 'Lead Closed') return n.type === 'closure';
    if (filterType === 'Revenue') return n.type === 'revenue';
    if (filterType === 'Follow-ups') return n.type === 'followup';
    if (filterType === 'Document Updates') return n.type === 'accountant_update';
    if (filterType === 'SLA Alerts') return !!(n.title && n.title.includes('SLA Alert'));
    return n.type === filterType;
  });

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isAllSelected = filteredNotifications && filteredNotifications.length > 0 && filteredNotifications.every(n => selectedIds.has(n.id));

  const toggleSelectAll = () => {
    if (!filteredNotifications) return;
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredNotifications.map(n => n.id)));
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
              onChange={e => setDateFrom(e.target.value)}
              className="w-[130px] h-7 text-xs border-0 bg-transparent pl-1 pr-3 focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-accent/40 rounded-sm"
              title="From date"
            />
            <span className="text-muted-foreground text-xs px-0.5 select-none">—</span>
            <Input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-[130px] h-7 text-xs border-0 bg-transparent pl-1 pr-3 focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-accent/40 rounded-sm"
              title="To date"
            />
          </div>
          <Select
            value={filterType}
            onValueChange={(val) => {
              setFilterType(val);
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
          {filteredNotifications && filteredNotifications.length > 0 && (
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all-notifications"
                  checked={isAllSelected}
                  onCheckedChange={toggleSelectAll}
                />
                <label htmlFor="select-all-notifications" className="text-xs font-medium text-muted-foreground cursor-pointer select-none">
                  Select All ({filteredNotifications.length})
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

          {!filteredNotifications?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No notifications</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredNotifications.map((n, i) => (
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationsPage;

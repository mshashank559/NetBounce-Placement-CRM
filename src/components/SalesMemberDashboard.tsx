import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, CheckCircle, Phone, Calendar, Eye, AlertTriangle, CheckCircle2, Clock, FileText as FileTextIcon, Send, MessageSquare, DollarSign } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import LeadDetailDialog from '@/components/LeadDetailDialog';
import CallActivityDialog from '@/components/CallActivityDialog';
import ClosureDialog from '@/components/ClosureDialog';
import AccountantCommentDialog from '@/components/AccountantCommentDialog';
import { getWorkingDaysDifference, getISTYearAndMonth, getISTDateString, formatToISTDateString } from '@/lib/dateUtils';
import { useDeferredRender } from '@/hooks/useDeferredRender';
import { DebouncedSearchInput } from '@/components/ui/DebouncedSearchInput';

const ALL_STATUSES = ['New', 'DNR1', 'DNR2', 'DNR3', 'Connected', 'Qualified', 'Hot Prospect', 'Closed', 'Non Interested'];

const formatDate = (dateString?: string) => formatToISTDateString(dateString);

const STATUS_FLOW: Record<string, string[]> = {
  'New':          ALL_STATUSES,
  'DNR1':         ALL_STATUSES,
  'DNR2':         ALL_STATUSES,
  'DNR3':         ALL_STATUSES,
  'Connected':    ALL_STATUSES,
  'Qualified':    ALL_STATUSES,
  'Hot Prospect': ALL_STATUSES,
  'Closed':       ALL_STATUSES,
  'Non Interested': ALL_STATUSES,
};

const statusColors: Record<string, string> = {
  'New': 'bg-primary/10 text-primary',
  'DNR1': 'bg-orange-500/10 text-orange-600',
  'DNR2': 'bg-orange-500/10 text-orange-600',
  'DNR3': 'bg-orange-500/10 text-orange-600',
  'Connected': 'bg-blue-500/10 text-blue-600',
  'Qualified': 'bg-indigo-500/10 text-indigo-600',
  'Hot Prospect': 'bg-amber-500/10 text-amber-600',
  'Closed': 'bg-green-500/10 text-green-600',
  'Non Interested': 'bg-destructive/10 text-destructive',
  'Stagnant': 'bg-red-500/10 text-red-600 border border-red-500/20 font-semibold',
};

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const statusBadgeClass = (s: string) => {
  if (s === 'Closed') return 'bg-green-500/10 text-green-600';
  if (s?.startsWith('DNR')) return 'bg-orange-500/10 text-orange-600';
  if (s === 'Non Interested') return 'bg-destructive/10 text-destructive';
  if (s === 'Hot Prospect') return 'bg-amber-500/10 text-amber-600';
  if (s === 'Connected') return 'bg-blue-500/10 text-blue-600';
  if (s === 'Stagnant') return 'bg-red-500/10 text-red-600 border border-red-500/20 font-semibold';
  return 'bg-secondary text-secondary-foreground';
};

const SalesMemberDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const renderDeferred = useDeferredRender(80);

  const [viewMode, setViewMode] = useState<'personal' | 'global'>('personal');
  const [monthFilter, setMonthFilter] = useState(() => {
    const saved = localStorage.getItem('netbounce_crm_month_filter_month_num');
    return saved || String(getISTYearAndMonth(new Date()).month);
  });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [globalSalesTLFilter, setGlobalSalesTLFilter] = useState('all');
  const [globalSalesMemberFilter, setGlobalSalesMemberFilter] = useState('all');
  const [selectedGenerator, setSelectedGenerator] = useState('all');
  const [page, setPage] = useState(1);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const PAGE_SIZE = 50;

  // Reset page to 1 whenever any filter changes
  React.useEffect(() => {
    setPage(1);
  }, [viewMode, monthFilter, dateFrom, dateTo, nameSearch, statusFilter, globalSalesTLFilter, globalSalesMemberFilter, selectedGenerator]);

  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [callLead, setCallLead] = useState<any>(null);
  const [callLeadInitialStatus, setCallLeadInitialStatus] = useState<string | undefined>(undefined);
  const [closureLead, setClosureLead] = useState<any>(null);
  const [accountantLead, setAccountantLead] = useState<any>(null);

  // ── Status change with mandatory comment ──
  const [pendingStatusChange, setPendingStatusChange] = useState<{ lead: any; status: string } | null>(null);
  const [statusComment, setStatusComment] = useState('');
  const [sendDocument, setSendDocument] = useState(false);
  const [docComment, setDocComment] = useState('');

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      leadId,
      status,
      comment,
      withDocument,
      documentComment,
    }: {
      leadId: string;
      status: string;
      comment: string;
      withDocument?: boolean;
      documentComment?: string;
    }) => {
      if (status === 'Closed') {
        const lead = filteredLeads.find(l => l.unique_id === leadId);
        setClosureLead(lead);
        return;
      }
      const lead = filteredLeads.find(l => l.unique_id === leadId);
      const oldStatus = lead?.lead_status || 'New';

      const { error } = await supabase.from('leads')
        .update({ lead_status: status as any, comment })
        .eq('unique_id', leadId);
      if (error) throw error;

      await supabase.from('lead_history_logs').insert({
        lead_id: leadId,
        changed_by: user!.id,
        action_type: 'STATUS_CHANGE',
        old_value: oldStatus,
        new_value: status,
        comments: comment || null
      });

      // Notify BD member on DNR / Non Interested
      if (['DNR1', 'DNR2', 'DNR3', 'Non Interested'].includes(status) && lead?.lead_generated_by) {
        await supabase.from('notifications').insert({
          user_id: lead.lead_generated_by,
          title: 'Lead Status Update',
          message: `${lead.name} marked as ${status}. Comment: ${comment}`,
          type: 'dnr',
          lead_id: leadId,
        });
      }

      // Notify Sales TL, Process Analyst, Admin, BD TL
      const { data: targets } = await supabase
        .from('user_roles').select('user_id')
        .in('role', ['SALES_TL', 'PROCESS_ANALYST', 'ADMIN', 'LEAD_TL']);
      if (targets && targets.length > 0) {
        await supabase.from('notifications').insert(
          targets.map(t => ({
            user_id: t.user_id,
            title: '📋 Lead Status Changed',
            message: `"${lead?.name}" → ${status}. Comment: ${comment}`,
            type: 'status_change',
            lead_id: leadId,
          }))
        );
      }

      // ── If "Send Document" was toggled: insert performa + notify accountants ──
      if (withDocument && documentComment?.trim()) {
        const docRef = 'DOC-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        await supabase.from('performas').insert({
          lead_id: leadId,
          sent_by: user!.id,
          type: 'Pre-Performa',
          document_url: docRef,
          notes: JSON.stringify({
            status: 'Sent',
            sla: 'Pending',
            sent_at: new Date().toISOString(),
            docRefId: docRef,
            comment: documentComment.trim(),
          }),
        });

        const { data: accountants } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'ACCOUNTANT');

        if (accountants && accountants.length > 0) {
          await supabase.from('notifications').insert(
            accountants.map(t => ({
              user_id: t.user_id,
              title: '📄 Document Sent with Status Update',
              message: `"${lead?.name}" status changed to ${status}. Document remark: "${documentComment.trim()}"`,
              type: 'accountant_update',
              lead_id: leadId,
            }))
          );
        }
      }

      // Next follow-up date toast
      let delayDays = 1;
      if (status === 'Hot Prospect') delayDays = 90;
      else if (status === 'Qualified') delayDays = 60;
      else if (status === 'Connected') delayDays = 30;
      else if (status === 'DNR1') delayDays = 20;
      else if (status === 'DNR2') delayDays = 15;
      else if (status === 'DNR3') delayDays = 10;

      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + delayDays);
      toast.info(`Status updated → ${status}. Next follow-up: ${nextDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sm-leads-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['sm-leads-stats'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['all-leads-admin'] });
      queryClient.invalidateQueries({ queryKey: ['all-leads-pa'] });
      queryClient.invalidateQueries({ queryKey: ['sales-tl-leads'] });
      queryClient.invalidateQueries({ queryKey: ['all-performas'] });
      queryClient.invalidateQueries({ queryKey: ['all-leads-accountant'] });
      queryClient.invalidateQueries({ queryKey: ['account-closures'] });
      setPendingStatusChange(null);
      setStatusComment('');
      setSendDocument(false);
      setDocComment('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleStatusChangeRequest = (lead: any, newStatus: string) => {
    if (newStatus === lead.lead_status) return;
    if (newStatus === 'Closed') {
      setClosureLead(lead);
      return;
    }
    setPendingStatusChange({ lead, status: newStatus });
    setStatusComment('');
    setSendDocument(false);
    setDocComment('');
  };

  const dnrDoneMutation = useMutation({
    mutationFn: async (lead: any) => {
      const { error } = await supabase.from('leads').update({
        dnr_followup_done: true,
        dnr_followup_done_at: new Date().toISOString(),
        dnr_followup_done_by: user!.id,
      }).eq('unique_id', lead.unique_id);
      if (error) throw error;
      // Notify Sales TL, Admin, Process Analyst
      const { data: targets } = await supabase
        .from('user_roles').select('user_id')
        .in('role', ['SALES_TL', 'ADMIN', 'PROCESS_ANALYST']);
      if (targets && targets.length > 0) {
        await supabase.from('notifications').insert(
          targets.map(t => ({
            user_id: t.user_id,
            title: '✅ DNR Follow-up Done',
            message: `Salesperson completed DNR follow-up for lead "${lead.name}".`,
            type: 'dnr_done',
            lead_id: lead.unique_id,
          }))
        );
      }
    },
    onSuccess: () => {
      toast.success('DNR follow-up marked as done!');
      queryClient.invalidateQueries({ queryKey: ['sm-leads-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['sm-leads-stats'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Fetch all user IDs in the Sales Member's team ──
  const { data: teamUserIds = [] } = useQuery({
    queryKey: ['salesmember-team-ids', user?.id, profile?.reports_to],
    queryFn: async () => {
      const tlId = profile?.reports_to;
      if (!tlId) return [user!.id];
      const { data: teamProfiles } = await supabase
        .from('profiles')
        .select('user_id')
        .or(`reports_to.eq.${tlId},user_id.eq.${tlId}`);
      return teamProfiles?.map(p => p.user_id) || [user!.id];
    },
    enabled: !!user,
  });

  // ── My assigned leads (paginated) ──
  const { data: leadsResponse, isLoading } = useQuery({
    queryKey: ['sm-leads-paginated', user?.id, viewMode, page, monthFilter, dateFrom, dateTo, nameSearch, statusFilter, globalSalesTLFilter, globalSalesMemberFilter, selectedGenerator, teamUserIds],
    queryFn: async () => {
      const isSearching = !!nameSearch.trim();
      let query = isSearching 
        ? supabase.from('leads').select('*')
        : supabase.from('leads').select('*', { count: 'exact' });

      if (viewMode === 'personal') {
        query = query.eq('assigned_to', user!.id);
      } else if (viewMode === 'global') {
        query = query.not('assigned_to', 'is', null);
      } else {
        query = query.in('assigned_to', teamUserIds.length > 0 ? teamUserIds : [user!.id]);
      }

      // Apply smart targeted search filter
      if (isSearching) {
        const raw = nameSearch.trim();
        const digitsOnly = raw.replace(/\D/g, '');
        const cleanStr = raw.replace(/\s+/g, '');
        const isNumeric = digitsOnly.length > 0 && /^\d+$/.test(raw.replace(/[\s\-\(\)\+]/g, ''));

        let orConditions: string[] = [];

        if (isNumeric && digitsOnly.length >= 7) {
          orConditions = [`phone.ilike.%${digitsOnly}%`, `phone.ilike.%${raw}%`];
        } else if (/^nbc/i.test(cleanStr)) {
          orConditions = [`display_id.ilike.%${cleanStr}%`, `display_id.ilike.%${raw}%`];
        } else if (isNumeric && digitsOnly.length < 7) {
          orConditions = [`display_id.ilike.%NBC${digitsOnly}%`, `display_id.ilike.%${digitsOnly}%`, `phone.ilike.%${digitsOnly}%`];
        } else if (raw.includes('@')) {
          orConditions = [`email.ilike.%${raw}%`];
        } else {
          orConditions = [`name.ilike.%${raw}%`, `display_id.ilike.%${cleanStr}%`];
        }

        query = query.or(orConditions.join(','));

        const { data, error } = await query
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        return {
          leads: data || [],
          totalCount: data?.length || 0,
        };
      }

      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('lead_status', statusFilter as any);
      }

      // Apply month filter
      if (monthFilter !== 'all') {
        const year = getISTYearAndMonth(new Date()).year;
        const monthNum = parseInt(monthFilter);
        const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01T00:00:00+05:30`;
        const lastDay = new Date(year, monthNum, 0).getDate();
        const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59+05:30`;
        query = query.gte('created_at', startDate).lte('created_at', endDate);
      }

      // Apply date range filters
      if (dateFrom) {
        query = query.gte('created_at', `${dateFrom}T00:00:00+05:30`);
      }
      if (dateTo) {
        query = query.lte('created_at', `${dateTo}T23:59:59+05:30`);
      }

      // Apply global filters
      if (viewMode === 'global' && globalSalesTLFilter !== 'all') {
        query = query.eq('team_lead_id', globalSalesTLFilter);
      }
      if (viewMode === 'global' && globalSalesMemberFilter !== 'all') {
        query = query.eq('assigned_to', globalSalesMemberFilter);
      }
      if (viewMode === 'global' && selectedGenerator !== 'all') {
        query = query.eq('lead_generated_by', selectedGenerator);
      }

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      return {
        leads: data || [],
        totalCount: count || 0,
      };
    },
    enabled: !!user,
    placeholderData: (previousData) => previousData,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (leadsResponse) setHasLoadedOnce(true);
  }, [leadsResponse]);

  // ── Dual-Layer Instant In-Memory Filter for 0ms visual rendering ──
  const filteredLeads = useMemo(() => {
    const serverLeads = leadsResponse?.leads || [];
    if (!nameSearch.trim()) return serverLeads;

    const raw = nameSearch.trim().toLowerCase();
    const digits = raw.replace(/\D/g, '');
    const inMem = serverLeads.filter((l: any) => {
      const nameMatch = l.name?.toLowerCase().includes(raw);
      const emailMatch = l.email?.toLowerCase().includes(raw);
      const phoneMatch = digits.length >= 4 && (l.phone?.replace(/\D/g, '').includes(digits) || l.phone?.toLowerCase().includes(raw));
      const idMatch = l.display_id?.toLowerCase().includes(raw) || (digits.length >= 2 && l.display_id?.toLowerCase().includes(digits));
      return nameMatch || emailMatch || phoneMatch || idMatch;
    });

    return inMem.length > 0 ? inMem : serverLeads;
  }, [leadsResponse?.leads, nameSearch]);

  const totalCount = nameSearch.trim() ? filteredLeads.length : (leadsResponse?.totalCount || 0);

  // ── Fetch lightweight lead records for KPIs and charts ──
  const { data: statsLeads = [] } = useQuery({
    queryKey: ['sm-leads-stats', user?.id, viewMode, monthFilter, dateFrom, dateTo, statusFilter, globalSalesTLFilter, globalSalesMemberFilter, selectedGenerator, teamUserIds],
    queryFn: async () => {
      // Auto-trigger stagnant leads scan
      await supabase.rpc('update_stagnant_leads');

      let query = supabase
        .from('leads')
        .select('created_at, updated_at, assigned_to, team_lead_id, lead_status, lead_source, lead_category, name, email, phone, display_id, unique_id, next_followup_date');

      if (viewMode === 'personal') {
        query = query.eq('assigned_to', user!.id);
      } else if (viewMode === 'global') {
        query = query.not('assigned_to', 'is', null);
      } else {
        query = query.in('assigned_to', teamUserIds.length > 0 ? teamUserIds : [user!.id]);
      }

      // Apply search filter
      if (nameSearch.trim()) {
        const s = `%${nameSearch.trim()}%`;
        query = query.or(`name.ilike.${s},email.ilike.${s},phone.ilike.${s},display_id.ilike.${s}`);
      }

      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('lead_status', statusFilter as any);
      }

      // Apply month filter
      if (monthFilter !== 'all') {
        const year = getISTYearAndMonth(new Date()).year;
        const monthNum = parseInt(monthFilter);
        const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01T00:00:00+05:30`;
        const lastDay = new Date(year, monthNum, 0).getDate();
        const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59+05:30`;
        query = query.gte('created_at', startDate).lte('created_at', endDate);
      }

      // Apply date range filters
      if (dateFrom) {
        query = query.gte('created_at', `${dateFrom}T00:00:00+05:30`);
      }
      if (dateTo) {
        query = query.lte('created_at', `${dateTo}T23:59:59+05:30`);
      }

      // Apply global filters
      if (viewMode === 'global' && globalSalesTLFilter !== 'all') {
        query = query.eq('team_lead_id', globalSalesTLFilter);
      }
      if (viewMode === 'global' && globalSalesMemberFilter !== 'all') {
        query = query.eq('assigned_to', globalSalesMemberFilter);
      }
      if (viewMode === 'global' && selectedGenerator !== 'all') {
        query = query.eq('lead_generated_by', selectedGenerator);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // ── My call logs ──
  const { data: callLogs = [] } = useQuery({
    queryKey: ['sm-calls', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('call_logs').select('*').eq('user_id', user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  // ── Fetch closure data (restricted to leads owned/generated by the salesperson) ──
  const { data: closureData = [] } = useQuery({
    queryKey: ['sm-closures', user?.id],
    queryFn: async () => {
      const { data: myLeads } = await supabase.from('leads').select('unique_id').or(`assigned_to.eq.${user!.id},lead_generated_by.eq.${user!.id}`);
      const leadIds = myLeads?.map(l => l.unique_id) || [];
      if (leadIds.length === 0) return [];
      const { data, error } = await supabase.from('lead_closures').select('*').in('lead_id', leadIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // ── All profiles (for "generated by" and global filter dropdowns) ──
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-sm'],
    queryFn: async () => { const { data } = await supabase.from('profiles').select('user_id, full_name, reports_to'); return data || []; }
  });

  // ── All user roles (for Sales TL / Member dropdowns in global view) ──
  const { data: allUserRoles = [] } = useQuery({
    queryKey: ['all-user-roles-sm'],
    queryFn: async () => { const { data } = await supabase.from('user_roles').select('user_id, role').in('role', ['SALES_TL', 'SALES_TM']); return data || []; },
  });

  // ── Fetch all BD users (LEAD_GEN and LEAD_TL) for global view dropdown ──
  const { data: bdUsers = [] } = useQuery({
    queryKey: ['global-bd-users-sm'],
    queryFn: async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id').in('role', ['LEAD_GEN', 'LEAD_TL']);
      if (!roles?.length) return [];
      const userIds = roles.map(r => r.user_id);
      const { data: profilesData } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
      return (profilesData || []).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    },
    enabled: !!user,
  });

  const globalSalesTLList = useMemo(() => {
    const tlIds = new Set(allUserRoles.filter((r: any) => r.role === 'SALES_TL').map((r: any) => r.user_id));
    return profiles.filter(p => tlIds.has(p.user_id));
  }, [allUserRoles, profiles]);

  const globalSalesMemberList = useMemo(() => {
    const tmIds = new Set(allUserRoles.filter((r: any) => r.role === 'SALES_TM').map((r: any) => r.user_id));
    const members = profiles.filter(p => tmIds.has(p.user_id));
    if (globalSalesTLFilter === 'all') return members;
    return members.filter(p => p.reports_to === globalSalesTLFilter);
  }, [allUserRoles, profiles, globalSalesTLFilter]);

  // ── Follow-up history ──
  const { data: followups = [] } = useQuery({
    queryKey: ['sm-followups', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('followups').select('*').eq('user_id', user!.id).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const today = getISTDateString(new Date());
  const activeLeads = statsLeads.filter(l => l.lead_status !== 'Closed').length;
  const closures = statsLeads.filter(l => l.lead_status === 'Closed').length;
  const todayCalls = callLogs.filter(c => c.call_date === today).reduce((s, c) => s + (c.call_count || 0), 0);
  const currentISTMonth = getISTYearAndMonth(new Date()).month;
  const targetMonth = parseInt(monthFilter === 'all' ? String(currentISTMonth) : monthFilter);
  const monthCallLogs = callLogs.filter(c => {
    const m = parseInt(c.call_date.split('-')[1], 10);
    return m === targetMonth;
  });
  const monthlyCalls = monthCallLogs.reduce((s, c) => s + (c.call_count || 0), 0);

  // Calculate follow-up counts
  const dueTodayLeads = statsLeads.filter(l => 
    l.next_followup_date === today && 
    l.lead_status !== 'Closed' && 
    l.lead_status !== 'Non Interested'
  );
  
  const overdueLeads = statsLeads.filter(l => 
    l.next_followup_date && 
    l.next_followup_date < today && 
    l.lead_status !== 'Closed' && 
    l.lead_status !== 'Non Interested' &&
    l.lead_status !== 'Stagnant'
  );

  const stagnantLeadsCount = statsLeads.filter(l => 
    l.lead_status === 'Stagnant'
  ).length;

  const getStatusThreshold = (st: string) => {
    switch (st) {
      case 'New': return 5;
      case 'DNR1': return 20;
      case 'DNR2': return 15;
      case 'DNR3': return 10;
      case 'Connected': return 30;
      case 'Qualified': return 60;
      case 'Hot Prospect': return 90;
      case 'Non Interested': return 2;
      default: return null;
    }
  };

  // ── SLA: stale leads (reaching deadline today) ──
  const staleLeads = statsLeads.filter(l => {
    const status = l.lead_status;
    const updatedDate = l.updated_at ? new Date(l.updated_at) : null;
    if (!status || !updatedDate) return false;
    if ((l as any).dnr_followup_done || ['Closed', 'Non Interested'].includes(status)) return false;

    const now = new Date();
    const days = getWorkingDaysDifference(updatedDate, now);

    const threshold = getStatusThreshold(status);
    return threshold !== null && days === threshold;
  });

  // ── Chart data ──
  const chartData = useMemo(() => {
    const isAllMonths = monthFilter === 'all' && !dateFrom && !dateTo;

    if (isAllMonths) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthMap: Record<number, number> = {};

      callLogs.forEach(c => {
        if (!c.call_date) return;
        const parts = c.call_date.split('-');
        if (parts.length >= 2) {
          const mIndex = parseInt(parts[1], 10) - 1;
          if (mIndex >= 0 && mIndex < 12) {
            monthMap[mIndex] = (monthMap[mIndex] || 0) + (c.call_count || 1);
          }
        }
      });

      const currentMonthIndex = new Date().getMonth();
      const callTrend: { date: string; calls: number }[] = [];
      for (let i = 0; i <= Math.max(currentMonthIndex, 7); i++) {
        if (i < 12) {
          callTrend.push({
            date: monthNames[i],
            calls: monthMap[i] || 0
          });
        }
      }

      const statusMap: Record<string, number> = {};
      statsLeads.forEach(l => { const s = l.lead_status || 'New'; statusMap[s] = (statusMap[s] || 0) + 1; });
      const statusBreakdown = Object.keys(statusMap).map(s => ({ name: s, value: statusMap[s] }));

      return { callTrend, statusBreakdown, title: 'Monthly Call Trend' };
    } else {
      const callMap: Record<string, number> = {};
      callLogs.forEach(c => {
        if (!c.call_date) return;
        if (dateFrom && c.call_date < dateFrom) return;
        if (dateTo && c.call_date > dateTo) return;
        if (monthFilter !== 'all') {
          const m = parseInt(c.call_date.split('-')[1], 10);
          if (m !== parseInt(monthFilter)) return;
        }
        callMap[c.call_date] = (callMap[c.call_date] || 0) + (c.call_count || 1);
      });

      let dates = Object.keys(callMap).sort();
      if (dates.length === 0) {
        const todayObj = new Date();
        for (let i = 6; i >= 0; i--) {
          const d = new Date(todayObj);
          d.setDate(d.getDate() - i);
          const dStr = getISTDateString(d);
          dates.push(dStr);
        }
      }

      const callTrend = dates.map(d => ({
        date: d.length >= 10 ? d.slice(5) : d,
        calls: callMap[d] || 0
      }));

      const statusMap: Record<string, number> = {};
      statsLeads.forEach(l => { const s = l.lead_status || 'New'; statusMap[s] = (statusMap[s] || 0) + 1; });
      const statusBreakdown = Object.keys(statusMap).map(s => ({ name: s, value: statusMap[s] }));

      return { callTrend, statusBreakdown, title: 'Daily Call Trend' };
    }
  }, [callLogs, statsLeads, monthFilter, dateFrom, dateTo]);

  const getName = (id: string | null) => profiles.find(p => p.user_id === id)?.full_name || '—';

  return (
    <div className="space-y-8 pb-12">

      {/* Header & Filters */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-display font-bold">Welcome back, {profile?.full_name || 'Sales Member'}</h1>
          <p className="text-sm text-muted-foreground">Your personal execution dashboard</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)} className="w-[200px]">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="personal">My View</TabsTrigger>
              <TabsTrigger value="global">Global View</TabsTrigger>
            </TabsList>
          </Tabs>
          <DebouncedSearchInput value={nameSearch} onChange={setNameSearch} className="w-56" placeholder="Search name, id, email, phone..." />
          <Select value={monthFilter} onValueChange={(v) => { setMonthFilter(v); localStorage.setItem('netbounce_crm_month_filter_month_num', v); }}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {MONTHS.map((m, i) => <SelectItem key={m} value={String(i+1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {['New','DNR1','DNR2','DNR3','Connected','Qualified','Hot Prospect','Closed','Non Interested','Stagnant'].map(s =>
                <SelectItem key={s} value={s}>{s}</SelectItem>
              )}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5 bg-background px-2.5 rounded-md border border-input h-10 shrink-0">
            <span className="text-xs text-muted-foreground font-medium pr-1 select-none">Date:</span>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[130px] h-8 text-xs border-0 bg-transparent pl-1.5 pr-3 focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-accent/40 rounded-sm" />
            <span className="text-muted-foreground text-xs px-0.5 select-none">—</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[130px] h-8 text-xs border-0 bg-transparent pl-1.5 pr-3 focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-accent/40 rounded-sm" />
          </div>
        </div>
      </div>

      {/* SECTION 1: KPI Cards */}
      {viewMode !== 'global' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          {[
            { label: 'Active Leads', value: activeLeads, icon: TrendingUp, color: 'text-primary' },
            { label: 'Closures', value: closures, icon: CheckCircle, color: 'text-green-500' },
            { label: "Today's Calls", value: todayCalls, icon: Phone, color: 'text-blue-500' },
            { label: 'Monthly Calls', value: monthlyCalls, icon: Calendar, color: 'text-amber-500' },
            { label: 'Due Today', value: dueTodayLeads.length, icon: Clock, color: 'text-amber-500' },
            { label: 'Overdue', value: overdueLeads.length, icon: AlertTriangle, color: 'text-red-500' },
            { label: 'Stagnant Leads', value: stagnantLeadsCount, icon: AlertTriangle, color: 'text-red-600' },
          ].map(({ label, value, icon: Icon, color }, i) => (
            <motion.div key={label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="glass-card hover:nb-glow transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-[11px] font-medium text-muted-foreground">{label}</CardTitle>
                  <Icon className={`h-3.5 w-3.5 ${color}`} />
                </CardHeader>
                <CardContent><div className="text-xl font-display font-bold">{value}</div></CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Follow-Up Action Required Alert */}
      {viewMode !== 'global' && (dueTodayLeads.length > 0 || overdueLeads.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dueTodayLeads.length > 0 && (
            <Card className="border-amber-500/50 bg-amber-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-amber-600 flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Follow-Up Due Today ({dueTodayLeads.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {dueTodayLeads.map(l => (
                  <Button key={l.unique_id} size="sm" variant="outline" className="border-amber-500/30 text-xs h-7"
                    onClick={() => setCallLead(l)}>
                    <Phone className="h-3 w-3 mr-1" /> {l.name}
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}
          
          {overdueLeads.length > 0 && (
            <Card className="border-red-500/50 bg-red-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-red-600 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Overdue Follow-Up ({overdueLeads.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {overdueLeads.map(l => (
                  <Button key={l.unique_id} size="sm" variant="outline" className="border-red-500/30 text-xs h-7 text-red-600 hover:text-red-700 hover:bg-red-500/5"
                    onClick={() => setCallLead(l)}>
                    <Phone className="h-3 w-3 mr-1" /> {l.name}
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* SLA Alert */}
      {viewMode !== 'global' && staleLeads.length > 0 && (
        <Card className="border-red-500/50 bg-red-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Attention Required — {staleLeads.length} lead(s) reaching aging deadline today
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {staleLeads.map(l => (
              <Button key={l.unique_id} size="sm" variant="outline" className="border-red-500/30 text-xs h-7"
                onClick={() => setCallLead(l)}>
                <Phone className="h-3 w-3 mr-1" /> {l.name}
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* SECTION 2: Charts */}
      {viewMode !== 'global' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-sm font-medium">{chartData.title}</CardTitle></CardHeader>
            <CardContent className="h-[200px]">
              {!renderDeferred ? (
                <div className="h-full flex flex-col items-center justify-center space-y-2 text-muted-foreground text-xs animate-pulse">
                  <div className="h-4 w-24 bg-accent/40 rounded" />
                  <span>Loading trends...</span>
                </div>
              ) : chartData.callTrend.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No calls logged yet</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData.callTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="calls" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader><CardTitle className="text-sm font-medium">Lead Status Breakdown</CardTitle></CardHeader>
            <CardContent className="h-[200px]">
              {!renderDeferred ? (
                <div className="h-full flex flex-col items-center justify-center space-y-2 text-muted-foreground text-xs animate-pulse">
                  <div className="h-4 w-24 bg-accent/40 rounded" />
                  <span>Loading breakdown...</span>
                </div>
              ) : chartData.statusBreakdown.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No leads yet</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData.statusBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                      {chartData.statusBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* SECTION 3 & 4: My Leads Table */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex flex-col gap-3">
            <CardTitle className="text-lg font-display">
              {viewMode === 'global' ? 'Global View Leads' : 'My Leads'} ({totalCount})
            </CardTitle>
            {/* Global view filters */}
            {viewMode === 'global' && (
              <div className="flex flex-wrap items-center gap-3">
                <Select value={globalSalesTLFilter} onValueChange={v => { setGlobalSalesTLFilter(v); setGlobalSalesMemberFilter('all'); }}>
                  <SelectTrigger className="w-44 h-8 text-xs bg-accent/30 border-border/50">
                    <SelectValue placeholder="All Sales TLs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sales TLs</SelectItem>
                    {globalSalesTLList.map((u: any) => (
                      <SelectItem key={u.user_id} value={u.user_id}>{u.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={globalSalesMemberFilter} onValueChange={setGlobalSalesMemberFilter}>
                  <SelectTrigger className="w-44 h-8 text-xs bg-accent/30 border-border/50">
                    <SelectValue placeholder="All Sales Members" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sales Members</SelectItem>
                    {globalSalesMemberList.map((u: any) => (
                      <SelectItem key={u.user_id} value={u.user_id}>{u.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedGenerator} onValueChange={setSelectedGenerator}>
                  <SelectTrigger className="w-48 h-8 text-xs bg-accent/30 border-border/50">
                    <SelectValue placeholder="All Lead Generators" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Lead Generators</SelectItem>
                    {bdUsers.map((u: any) => (
                      <SelectItem key={u.user_id} value={u.user_id}>{u.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(globalSalesTLFilter !== 'all' || globalSalesMemberFilter !== 'all' || selectedGenerator !== 'all') && (
                  <button onClick={() => { setGlobalSalesTLFilter('all'); setGlobalSalesMemberFilter('all'); setSelectedGenerator('all'); }} className="text-xs text-muted-foreground hover:text-foreground underline">
                    Clear filters
                  </button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['#','ID','Date','Name','Email','Phone','Uni','Tech','LinkedIn','Time','TZ','Category','Source','Status','Payment','Next Follow-up', ...(viewMode === 'global' ? ['Generated By', 'Assigned To'] : ['Generated By']), 'Last Activity','DNR Follow-up','Actions'].map(h => (
                    <th key={h} className="text-left p-2 text-muted-foreground font-medium whitespace-nowrap text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={viewMode === 'global' ? 20 : 19} className="text-center py-8 text-muted-foreground">
                      {viewMode === 'global' ? 'No leads found.' : 'No leads assigned to you yet.'}
                    </td>
                  </tr>
                ) : filteredLeads.map((lead, idx) => {
                  const isDNR = lead.lead_status?.startsWith('DNR');
                  const isHot = lead.lead_status === 'Hot Prospect';
                  const hoursSince = (Date.now() - new Date(lead.updated_at).getTime()) / 3600000;
                  const isStale = hoursSince > 24 && !['Closed','Non Interested'].includes(lead.lead_status || '');
                  const lastFollowup = followups.find(f => f.lead_id === lead.unique_id);

                  return (
                    <tr
                      key={lead.unique_id}
                      className={`border-b border-border/50 hover:bg-accent/30 transition-colors ${
                        isDNR ? 'bg-orange-500/5' : isHot ? 'bg-amber-500/5' : isStale ? 'bg-red-500/5' : ''
                      }`}
                    >
                      <td className="p-2 text-xs text-muted-foreground font-medium">{idx + 1}</td>
                      <td className="p-2 font-mono text-xs text-primary font-bold">{(lead as any).display_id || '—'}</td>
                      <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">{formatDate(lead.created_at)}</td>
                      <td className="p-2 font-medium whitespace-nowrap">{lead.name}</td>
                      <td className="p-2 text-xs">{lead.email}</td>
                      <td className="p-2 text-xs">{lead.phone}</td>
                      <td className="p-2 text-xs">{lead.university || '—'}</td>
                      <td className="p-2 text-xs">{lead.technology || '—'}</td>
                      <td className="p-2 text-xs">
                        {lead.linkedin_url ? (
                          <a 
                            href={lead.linkedin_url.trim().startsWith('http') || lead.linkedin_url.trim().startsWith('//') ? lead.linkedin_url.trim() : `https://${lead.linkedin_url.trim()}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-primary underline text-xs"
                          >
                            View
                          </a>
                        ) : '—'}
                      </td>
                      <td className="p-2 text-xs">{lead.time_for_call || '—'}</td>
                      <td className="p-2 text-xs">{lead.timezone || '—'}</td>
                      <td className="p-2">
                        <Badge variant="outline" className={`text-xs ${lead.lead_category === 'Hot' ? 'border-amber-500 text-amber-500' : ''}`}>
                          {lead.lead_category}
                        </Badge>
                      </td>
                      <td className="p-2 text-xs">{lead.lead_source || '—'}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs px-2 py-1 rounded-full ${statusColors[lead.lead_status || 'New'] || ''} inline-flex items-center gap-1.5`}>
                            {lead.lead_status || 'New'}
                          </span>
                          {lead.lead_status === 'Stagnant' && (
                            <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-red-500/20 text-[9px] px-1 py-0 font-bold uppercase shrink-0">
                              Stagnant
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-2">
                        {(() => {
                          const closure = closureData.find(c => c.lead_id === lead.unique_id);
                          if (!closure) return <span className="text-muted-foreground">—</span>;
                          if (lead.assigned_to !== user?.id && lead.lead_generated_by !== user?.id) {
                            return <span className="text-muted-foreground">—</span>;
                          }
                          
                          const s1 = closure.slot1 ? (Number(closure.slot1_amount) || 0) : 0;
                          const s2 = closure.slot2 ? (Number(closure.slot2_amount) || 0) : 0;
                          let additional = 0;
                          if (Array.isArray(closure.additional_slots)) {
                            closure.additional_slots.forEach((slot: any) => {
                              if (slot.paid === true) {
                                additional += Number(slot.amount) || 0;
                              }
                            });
                          }
                          const amountReceived = s1 + s2 + additional;
                          if (amountReceived === 0) return <span className="text-muted-foreground">—</span>;
                          return (
                            <span className="text-green-500 font-medium font-mono text-xs">
                              ${amountReceived.toLocaleString()}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="p-2 text-xs font-medium whitespace-nowrap">
                        {lead.next_followup_date ? (
                          <span className={lead.next_followup_date < today ? 'text-red-500 font-semibold flex items-center gap-1' : lead.next_followup_date === today ? 'text-amber-500 font-semibold flex items-center gap-1' : 'text-muted-foreground'}>
                            <Calendar className="h-3 w-3 shrink-0" />
                            {formatDate(lead.next_followup_date)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="p-2 text-xs">
                        {lead.lead_generated_by ? (profiles.find(p => p.user_id === lead.lead_generated_by)?.full_name || 'System') : 'System'}
                      </td>
                      {viewMode === 'global' && (
                        <td className="p-2 text-xs">{getName(lead.assigned_to)}</td>
                      )}
                      <td className="p-2 text-xs whitespace-nowrap">{new Date(lead.updated_at).toLocaleDateString()}</td>
                      <td className="p-2">
                        {lead.lead_status?.startsWith('DNR') ? (
                          (lead as any).dnr_followup_done ? (
                            <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Done
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs border-green-500/40 text-green-600 hover:bg-green-500/10"
                              disabled={dnrDoneMutation.isPending || lead.assigned_to !== user?.id}
                              onClick={() => dnrDoneMutation.mutate(lead)}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark Done
                            </Button>
                          )
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" title="View" onClick={() => setSelectedLead(lead)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {lead.lead_status !== 'Closed' && lead.lead_status !== 'Non Interested' && lead.assigned_to === user?.id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-primary hover:bg-primary/10"
                              title="Log Call"
                              onClick={() => {
                                setCallLead(lead);
                                setCallLeadInitialStatus(undefined);
                              }}
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {lead.lead_status === 'Hot Prospect' && lead.assigned_to === user?.id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-green-500 hover:bg-green-500/10 text-xs h-7 px-2"
                              onClick={() => {
                                setCallLead(lead);
                                setCallLeadInitialStatus('Closed');
                              }}
                            >
                              Close
                            </Button>
                          )}
                          {lead.lead_status === 'Closed' && lead.assigned_to === user?.id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-green-600 hover:text-green-700 hover:bg-green-500/10 h-7 w-7 p-0"
                              title="Edit Closure Details"
                              onClick={() => setClosureLead(lead)}
                            >
                              <DollarSign className="h-3.5 w-3.5" />
                            </Button>
                          )}
                         </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalCount > 0 && (
            <div className="flex justify-between items-center p-4 border-t border-border flex-wrap gap-2">
              <span className="text-xs text-muted-foreground">
                Showing {Math.min(totalCount, (page - 1) * PAGE_SIZE + 1)} to {Math.min(totalCount, page * PAGE_SIZE)} of {totalCount} leads
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
                  Page {page} of {Math.ceil(totalCount / PAGE_SIZE) || 1}
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
        </CardContent>
      </Card>

      {/* SECTION 7: Follow-up History */}
      {viewMode !== 'global' && followups.length > 0 && (
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-sm font-medium">Recent Follow-up Activity</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {followups.slice(0, 10).map(f => (
                <div key={f.id} className="flex items-start justify-between text-xs p-2 bg-accent/30 rounded">
                  <div>
                    <span className="font-medium">{statsLeads.find(l => l.unique_id === f.lead_id)?.name || 'Lead'}</span>
                    <span className="text-muted-foreground ml-2">via {f.way_of_contact}</span>
                    <p className="text-muted-foreground mt-0.5">{f.notes}</p>
                  </div>
                  <span className="text-muted-foreground/60 whitespace-nowrap ml-4">{new Date(f.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      {selectedLead && <LeadDetailDialog lead={selectedLead} open={!!selectedLead} onClose={() => setSelectedLead(null)} />}
      {callLead && (
        <CallActivityDialog
          lead={callLead}
          open={!!callLead}
          initialStatus={callLeadInitialStatus}
          onClose={() => {
            setCallLead(null);
            setCallLeadInitialStatus(undefined);
            queryClient.invalidateQueries({ queryKey: ['sm-leads'] });
          }}
        />
      )}
      {closureLead && <ClosureDialog lead={closureLead} open={!!closureLead} onClose={() => { setClosureLead(null); queryClient.invalidateQueries({ queryKey: ['sm-leads'] }); }} />}
      {accountantLead && <AccountantCommentDialog lead={accountantLead} open={!!accountantLead} onClose={() => setAccountantLead(null)} />}

      {/* ── Mandatory Comment Dialog on Status Change ── */}
      <Dialog
        open={!!pendingStatusChange}
        onOpenChange={open => { if (!open) { setPendingStatusChange(null); setStatusComment(''); setSendDocument(false); setDocComment(''); } }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Status Change — Mandatory Comment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Lead + new status pill */}
            <div className="bg-accent/40 rounded-lg p-3 text-sm">
              <span className="text-muted-foreground">Lead: </span>
              <span className="font-medium">{pendingStatusChange?.lead?.name}</span>
              <span className="text-muted-foreground mx-2">→</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[pendingStatusChange?.status || ''] || 'bg-secondary'}`}>
                {pendingStatusChange?.status}
              </span>
            </div>

            {/* Mandatory status comment */}
            <div className="space-y-1.5">
              <Label htmlFor="sm-status-comment">
                Comment <span className="text-destructive">*</span>
                <span className="text-xs text-muted-foreground ml-1">(required — visible to Sales TL, Process Analyst, Admin, BD TL)</span>
              </Label>
              <Textarea
                id="sm-status-comment"
                value={statusComment}
                onChange={e => setStatusComment(e.target.value)}
                placeholder="Describe why the status is being changed..."
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Send Document toggle */}
            <div className="border border-border/50 rounded-lg p-3 space-y-3 bg-background/50">
              <button
                type="button"
                onClick={() => { setSendDocument(v => !v); if (sendDocument) setDocComment(''); }}
                className={`flex items-center gap-2 text-sm font-medium w-full rounded-md px-2 py-1.5 transition-colors ${
                  sendDocument
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
                }`}
              >
                <Send className="h-4 w-4" />
                Send Document
                <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  sendDocument ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>{sendDocument ? 'ON' : 'OFF'}</span>
              </button>

              {sendDocument && (
                <div className="space-y-1.5">
                  <Label htmlFor="sm-doc-comment" className="text-xs">
                    <FileTextIcon className="h-3.5 w-3.5 inline mr-1 text-primary" />
                    Document Remarks <span className="text-destructive">*</span>
                    <span className="text-xs text-muted-foreground ml-1">(sent to Accountant Dashboard)</span>
                  </Label>
                  <Textarea
                    id="sm-doc-comment"
                    value={docComment}
                    onChange={e => setDocComment(e.target.value)}
                    placeholder="Add remarks about the document being sent..."
                    rows={3}
                    className="resize-none"
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPendingStatusChange(null); setStatusComment(''); setSendDocument(false); setDocComment(''); }}>
              Cancel
            </Button>
            <Button
              disabled={!statusComment.trim() || (sendDocument && !docComment.trim()) || updateStatusMutation.isPending}
              onClick={() => {
                if (!pendingStatusChange || !statusComment.trim()) return;
                if (sendDocument && !docComment.trim()) return;
                updateStatusMutation.mutate({
                  leadId: pendingStatusChange.lead.unique_id,
                  status: pendingStatusChange.status,
                  comment: statusComment.trim(),
                  withDocument: sendDocument,
                  documentComment: docComment.trim(),
                });
              }}
            >
              {updateStatusMutation.isPending ? 'Updating...' : 'Confirm Status Change'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesMemberDashboard;

import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllLeads } from '@/lib/leads';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { 
  Users, 
  TrendingUp, 
  Phone, 
  CheckCircle, 
  UserPlus, 
  Trash2, 
  Search, 
  Filter, 
  RefreshCw,
  MoreVertical,
  UserCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  DollarSign,
  Bell,
  Clock,
  BarChart3,
  Activity,
  ArrowUpRight,
  AlertTriangle,
  LayoutDashboard,
  PieChart as PieChartIcon,
  Eye,
  Palette,
  FileSignature,
  FileText,
  Pencil
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

import LeadDetailDialog from '@/components/LeadDetailDialog';
import ClosureDialog from '@/components/ClosureDialog';
import CallActivityDialog from '@/components/CallActivityDialog';
import AgreementDialog from '@/components/AgreementDialog';
import AccountantCommentDialog from '@/components/AccountantCommentDialog';
import EditLeadDialog from '@/components/EditLeadDialog';

import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  AreaChart,
  Area,
  CartesianGrid
} from 'recharts';
import { format, subDays, isBefore, parseISO, isSameDay } from 'date-fns';

const ROLES = ['ADMIN', 'PROCESS_ANALYST', 'LEAD_TL', 'LEAD_GEN', 'SALES_TL', 'SALES_TM'] as const;
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ElementType;
  delay?: number;
  trend?: { value: string; positive: boolean };
}> = ({ title, value, icon: Icon, delay = 0, trend }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay }}
  >
    <Card className="glass-card hover:nb-glow transition-all duration-300 border-primary/10 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
        <Icon className="h-12 w-12 text-primary" />
      </div>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="p-2 bg-primary/10 rounded-lg">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-display font-bold">{value}</div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs mt-1 ${trend.positive ? 'text-green-500' : 'text-red-500'}`}>
            {trend.positive ? <ArrowUpRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {trend.value}
          </div>
        )}
      </CardContent>
    </Card>
  </motion.div>
);

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
};

const HIGHLIGHT_COLORS = [
  { label: 'None', value: '' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Purple', value: '#a855f7' },
];

const AdminDashboard: React.FC = () => {
  const { user, role: currentRole } = useAuth();
  const queryClient = useQueryClient();

  const isAdmin = currentRole === 'ADMIN';

  // Global Filters
  const [activeTab, setActiveTab] = useState('control');
  const [monthFilter, setMonthFilter] = useState(() => format(new Date(), 'yyyy-MM'));
  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [salesMetric, setSalesMetric] = useState<'calls' | 'revenue' | 'closures'>('revenue');
  const [bdMetric, setBdMetric] = useState<'calls' | 'leads'>('leads');
  const [adminViewMode, setAdminViewMode] = useState<'personal' | 'team' | 'global'>('global');
  const [globalDateFrom, setGlobalDateFrom] = useState('');
  const [globalDateTo, setGlobalDateTo] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [globalSalesTLFilter, setGlobalSalesTLFilter] = useState('all');
  const [globalSalesMemberFilter, setGlobalSalesMemberFilter] = useState('all');
  const [selectedGenerator, setSelectedGenerator] = useState('all');

  // Dialog state
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [closureLead, setClosureLead] = useState<any>(null);
  const [callLead, setCallLead] = useState<any>(null);
  const [agreementLead, setAgreementLead] = useState<any>(null);
  const [highlightLead, setHighlightLead] = useState<string | null>(null);
  const [accountantLead, setAccountantLead] = useState<any>(null);
  const [editLead, setEditLead] = useState<any>(null);


  // Concern Dialog State
  const [concernLead, setConcernLead] = useState<any>(null);
  const [concernText, setConcernText] = useState('');
  const [concernRecipient, setConcernRecipient] = useState('');

  // Helper to resolve profile name
  const getName = (id: string | null) => allUsers.find(u => u.user_id === id)?.full_name || '—';

  // ── Fetch Concern Recipients ──────────────────────────────────
  const { data: concernRecipients = [] } = useQuery({
    queryKey: ['concern-recipients', user?.id, currentRole],
    queryFn: async () => {
      if (!user || !currentRole) return [];

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name, reports_to');
      
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role');

      const profiles = profilesData || [];
      const roles = rolesData || [];

      const myProfile = profiles.find(p => p.user_id === user.id);
      const reportsTo = myProfile?.reports_to;

      let list: { user_id: string; label: string }[] = [];

      const adminUserIds = new Set(roles.filter(r => r.role === 'ADMIN').map(r => r.user_id));
      const salesTlUserIds = new Set(roles.filter(r => r.role === 'SALES_TL').map(r => r.user_id));
      const leadTlUserIds = new Set(roles.filter(r => r.role === 'LEAD_TL').map(r => r.user_id));
      const salesTmUserIds = new Set(roles.filter(r => r.role === 'SALES_TM').map(r => r.user_id));
      const leadGenUserIds = new Set(roles.filter(r => r.role === 'LEAD_GEN').map(r => r.user_id));

      profiles.forEach(p => {
        if (p.user_id !== user.id) {
          let roleLabel = '';
          if (adminUserIds.has(p.user_id)) roleLabel = 'Admin';
          else if (salesTlUserIds.has(p.user_id)) roleLabel = 'Sales TL';
          else if (leadTlUserIds.has(p.user_id)) roleLabel = 'BD TL';
          else if (salesTmUserIds.has(p.user_id)) roleLabel = 'Sales Member';
          else if (leadGenUserIds.has(p.user_id)) roleLabel = 'Lead Member';
          
          list.push({
            user_id: p.user_id,
            label: roleLabel ? `${p.full_name} (${roleLabel})` : p.full_name
          });
        }
      });

      return list;
    },
    enabled: !!user && !!currentRole,
  });

  // ── Raise Concern mutation ────────────────────────────────────
  const raiseConcern = useMutation({
    mutationFn: async ({ leadId, recipientId, comment }: { leadId: string; recipientId: string; comment: string }) => {
      if (!comment.trim()) throw new Error('Please enter a comment');
      if (!recipientId) throw new Error('Please select a recipient');

      const lead = leads?.find(l => l.unique_id === leadId);

      // Mark lead as having a concern
      const { error: updateErr } = await supabase.from('leads').update({ concern: true }).eq('unique_id', leadId);
      if (updateErr) throw updateErr;
      
      // Add concern entry
      const { error: concernErr } = await supabase.from('concerns').insert({
        lead_id: leadId,
        raised_by: user!.id,
        description: comment.trim()
      });
      if (concernErr) throw concernErr;

      // Send notification to the selected recipient
      const { error: notifyErr } = await supabase.from('notifications').insert({
        user_id: recipientId,
        title: '⚠️ Concern Raised',
        message: `Concern raised for lead "${lead?.name}": ${comment.trim()}`,
        type: 'concern',
        lead_id: leadId,
      });
      if (notifyErr) throw notifyErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-leads-admin'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['all-concerns-admin'] });
      toast.success('Concern raised and recipient notified');
      setConcernLead(null);
      setConcernText('');
      setConcernRecipient('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateHighlight = useMutation({
    mutationFn: async ({ leadId, color }: { leadId: string; color: string }) => {
      const { error } = await supabase.from('leads')
        .update({ highlight_color: color || null })
        .eq('unique_id', leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-leads-admin'] });
      setHighlightLead(null);
      toast.success('Highlight updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // User Management State
  const [userForm, setUserForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: '' as string,
    department: '',
  });

  // Queries
  const { data: leads } = useQuery({
    queryKey: ['all-leads-admin'],
    queryFn: fetchAllLeads,
  });

  const { data: profiles } = useQuery({
    queryKey: ['all-profiles-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: userRoles } = useQuery({
    queryKey: ['all-user-roles-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_roles').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: callLogs } = useQuery({
    queryKey: ['all-call-logs-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('call_logs').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: leadClosures } = useQuery({
    queryKey: ['all-closures-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lead_closures').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: notifications } = useQuery({
    queryKey: ['all-notifications-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: concerns } = useQuery({
    queryKey: ['all-concerns-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('concerns')
        .select('*')
        .eq('resolved', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const resolveConcernMutation = useMutation({
    mutationFn: async ({ concernId, leadId, raisedBy }: { concernId: string; leadId: string; raisedBy: string }) => {
      // Update concern resolved status
      const { error: err1 } = await supabase.from('concerns').update({ resolved: true }).eq('id', concernId);
      if (err1) throw err1;
      
      // Reset lead concern flag
      const { error: err2 } = await supabase.from('leads').update({ concern: false }).eq('unique_id', leadId);
      if (err2) throw err2;
      
      // Send notification to reporter
      const { data: lead } = await supabase.from('leads').select('name').eq('unique_id', leadId).single();
      await supabase.from('notifications').insert({
        user_id: raisedBy,
        title: '✅ Concern Resolved',
        message: `The concern raised for lead "${lead?.name || 'Lead'}" has been resolved by Admin.`,
        type: 'concern_resolved',
        lead_id: leadId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-concerns-admin'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Concern marked as resolved!');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Combined User Data
  const allUsers = useMemo(() => {
    if (!profiles || !userRoles) return [];
    const roleMap: Record<string, string> = {};
    userRoles.forEach(r => { roleMap[r.user_id] = r.role; });
    return profiles.map(p => ({
      ...p,
      role: roleMap[p.user_id] || 'Unknown',
      team: roleMap[p.user_id]?.startsWith('SALES') ? 'Sales' : roleMap[p.user_id]?.startsWith('LEAD') ? 'Lead Gen' : 'Admin'
    }));
  }, [profiles, userRoles]);

  // SLA Monitoring Logic
  const slaAlerts = useMemo(() => {
    if (!leads) return [];
    const today = new Date();
    return leads.filter(l => {
      if (['Closed', 'Non Interested'].includes(l.lead_status || '')) return false;
      const lastUpdate = parseISO(l.updated_at);
      return !isSameDay(lastUpdate, today) || isBefore(lastUpdate, subDays(today, 2));
    });
  }, [leads]);

  // Filtering Logic
  const filteredData = useMemo(() => {
    if (!leads || !leadClosures) return { leads: [], closures: [] };
    let fLeads = leads;
    let fClosures = leadClosures;

    if (monthFilter && monthFilter !== 'all') {
      const [year, month] = monthFilter.split('-').map(Number);
      fLeads = fLeads.filter(l => { const d = new Date(l.created_at); return d.getFullYear() === year && d.getMonth() + 1 === month; });
      fClosures = fClosures.filter(c => { const d = new Date(c.created_at); return d.getFullYear() === year && d.getMonth() + 1 === month; });
    }
    if (statusFilter !== 'all') fLeads = fLeads.filter(l => l.lead_status === statusFilter);
    if (teamFilter !== 'all') {
      const teamUserIds = allUsers.filter(u => u.team === teamFilter).map(u => u.user_id);
      fLeads = fLeads.filter(l => (teamFilter === 'Lead Gen' && teamUserIds.includes(l.lead_generated_by || '')) || (teamFilter === 'Sales' && teamUserIds.includes(l.assigned_to || '')));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      fLeads = fLeads.filter(l => l.name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q) || (l.display_id || '').toLowerCase().includes(q));
    }
    return { leads: fLeads, closures: fClosures };
  }, [leads, leadClosures, monthFilter, statusFilter, teamFilter, searchQuery, allUsers]);

  // Admin lead view filtered by viewMode
  const adminViewLeads = useMemo(() => {
    return filteredData.leads.filter(l => {
      if (adminViewMode === 'personal') return l.assigned_to === null || l.assigned_to === undefined;
      if (adminViewMode === 'team') return !!l.assigned_to;
      return true;
    });
  }, [filteredData.leads, adminViewMode]);

  // Global view — all leads with optional date/search/team filter
  const globalLeads = useMemo(() => {
    if (!leads) return [];
    return leads.filter(l => {
      if (globalDateFrom && new Date(l.created_at) < new Date(globalDateFrom)) return false;
      if (globalDateTo && new Date(l.created_at) > new Date(globalDateTo + 'T23:59:59')) return false;
      if (globalSalesTLFilter !== 'all' && l.team_lead_id !== globalSalesTLFilter) return false;
      if (globalSalesMemberFilter !== 'all' && l.assigned_to !== globalSalesMemberFilter) return false;
      if (selectedGenerator !== 'all' && l.lead_generated_by !== selectedGenerator) return false;
      if (globalSearch) {
        const q = globalSearch.toLowerCase();
        return (
          l.name?.toLowerCase().includes(q) ||
          l.email?.toLowerCase().includes(q) ||
          (l.display_id || '').toLowerCase().includes(q) ||
          l.phone?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [leads, globalDateFrom, globalDateTo, globalSearch, globalSalesTLFilter, globalSalesMemberFilter, selectedGenerator]);

  // Derived lists for Global View filter dropdowns
  const globalSalesTLList = useMemo(() => allUsers.filter(u => u.role === 'SALES_TL'), [allUsers]);
  const globalSalesMemberList = useMemo(() => {
    if (globalSalesTLFilter === 'all') return allUsers.filter(u => u.role === 'SALES_TM');
    return allUsers.filter(u => u.role === 'SALES_TM' && u.reports_to === globalSalesTLFilter);
  }, [allUsers, globalSalesTLFilter]);
  const globalBdUsersList = useMemo(() => {
    return allUsers.filter(u => u.role === 'LEAD_GEN' || u.role === 'LEAD_TL').sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  }, [allUsers]);

  // Revenue
  const revenueStats = useMemo(() => {
    const calcRevenue = (closure: any) => {
      const s1 = closure.slot1 ? (Number(closure.slot1_amount) || 0) : 0;
      const s2 = closure.slot2 ? (Number(closure.slot2_amount) || 0) : 0;
      let additional = 0;
      if (Array.isArray(closure.additional_slots)) {
        closure.additional_slots.forEach((slot: any) => {
          additional += Number(slot.amount) || 0;
        });
      }
      return s1 + s2 + additional;
    };
    const total = filteredData.closures.reduce((sum, c) => sum + calcRevenue(c), 0);
    const salesTeamIds = allUsers.filter(u => u.team === 'Sales').map(u => u.user_id);
    const leadGenTeamIds = allUsers.filter(u => u.team === 'Lead Gen').map(u => u.user_id);
    return {
      total,
      team: {
        Sales: filteredData.closures.filter(c => salesTeamIds.includes(leads?.find(l => l.unique_id === c.lead_id)?.assigned_to || '')).reduce((sum, c) => sum + calcRevenue(c), 0),
        LeadGen: filteredData.closures.filter(c => leadGenTeamIds.includes(leads?.find(l => l.unique_id === c.lead_id)?.lead_generated_by || '')).reduce((sum, c) => sum + calcRevenue(c), 0)
      }
    };
  }, [filteredData.closures, allUsers, leads]);

  // Charts
  const analyticsData = useMemo(() => {
    const last15Days = Array.from({ length: 15 }).map((_, i) => {
      const d = subDays(new Date(), 14 - i);
      return { name: format(d, 'MMM dd'), count: leads?.filter(l => isSameDay(parseISO(l.created_at), d)).length || 0 };
    });
    const statusMap: Record<string, number> = {};
    leads?.forEach(l => { statusMap[l.lead_status || 'Unknown'] = (statusMap[l.lead_status || 'Unknown'] || 0) + 1; });
    return { inflow: last15Days, funnel: [{ name: 'Total', value: leads?.length || 0 }, { name: 'Qualified', value: leads?.filter(l => l.lead_status === 'Qualified').length || 0 }, { name: 'Hot', value: leads?.filter(l => l.lead_status === 'Hot Prospect').length || 0 }, { name: 'Closed', value: leads?.filter(l => l.lead_status === 'Closed').length || 0 }], status: Object.entries(statusMap).map(([name, value]) => ({ name, value })) };
  }, [leads]);

  // ── Sorted users for comparison charts ──
  const sortedSalesUsers = useMemo(() => {
    const tls = allUsers.filter(u => u.role === 'SALES_TL');
    const tms = allUsers.filter(u => u.role === 'SALES_TM');
    const result: typeof allUsers = [];
    tls.forEach(tl => {
      result.push(tl);
      tms.filter(tm => tm.reports_to === tl.user_id).forEach(tm => result.push(tm));
    });
    const assigned = new Set(result.map(u => u.user_id));
    tms.filter(tm => !assigned.has(tm.user_id)).forEach(tm => result.push(tm));
    return result;
  }, [allUsers]);

  const sortedBdUsers = useMemo(() => {
    const tls = allUsers.filter(u => u.role === 'LEAD_TL');
    const tms = allUsers.filter(u => u.role === 'LEAD_GEN');
    const result: typeof allUsers = [];
    tls.forEach(tl => {
      result.push(tl);
      tms.filter(tm => tm.reports_to === tl.user_id).forEach(tm => result.push(tm));
    });
    const assigned = new Set(result.map(u => u.user_id));
    tms.filter(tm => !assigned.has(tm.user_id)).forEach(tm => result.push(tm));
    return result;
  }, [allUsers]);

  const calcRevenueLocal = (closure: any) => {
    const s1 = closure.slot1 ? (Number(closure.slot1_amount) || 0) : 0;
    const s2 = closure.slot2 ? (Number(closure.slot2_amount) || 0) : 0;
    let additional = 0;
    if (Array.isArray(closure.additional_slots)) {
      closure.additional_slots.forEach((slot: any) => { additional += Number(slot.amount) || 0; });
    }
    return s1 + s2 + additional;
  };

  const salesChartData = useMemo(() => {
    return sortedSalesUsers.map(u => {
      const callsCount = (callLogs || []).filter(c => {
        if (c.user_id !== u.user_id) return false;
        if (monthFilter && monthFilter !== 'all') {
          const [yr, mo] = monthFilter.split('-').map(Number);
          const d = new Date(c.call_date);
          return d.getFullYear() === yr && d.getMonth() + 1 === mo;
        }
        return true;
      }).reduce((sum, c) => sum + (c.call_count || 0), 0);

      const userClosures = filteredData.closures.filter(c => {
        const lead = (leads || []).find(l => l.unique_id === c.lead_id);
        return lead?.assigned_to === u.user_id;
      });

      const revenueSum = userClosures.reduce((sum, c) => sum + calcRevenueLocal(c), 0);
      const closuresCount = userClosures.length;

      return {
        name: u.full_name?.split(' ')[0] || u.full_name,
        fullName: u.full_name,
        role: u.role === 'SALES_TL' ? 'TL' : 'Member',
        value: salesMetric === 'calls' ? callsCount : salesMetric === 'revenue' ? revenueSum : closuresCount,
      };
    });
  }, [sortedSalesUsers, callLogs, filteredData.closures, leads, monthFilter, salesMetric]);

  const bdChartData = useMemo(() => {
    return sortedBdUsers.map(u => {
      const callsCount = (callLogs || []).filter(c => {
        if (c.user_id !== u.user_id) return false;
        if (monthFilter && monthFilter !== 'all') {
          const [yr, mo] = monthFilter.split('-').map(Number);
          const d = new Date(c.call_date);
          return d.getFullYear() === yr && d.getMonth() + 1 === mo;
        }
        return true;
      }).reduce((sum, c) => sum + (c.call_count || 0), 0);

      const leadsCount = filteredData.leads.filter(l => l.lead_generated_by === u.user_id).length;

      return {
        name: u.full_name?.split(' ')[0] || u.full_name,
        fullName: u.full_name,
        role: u.role === 'LEAD_TL' ? 'TL' : 'Member',
        value: bdMetric === 'calls' ? callsCount : leadsCount,
      };
    });
  }, [sortedBdUsers, callLogs, filteredData.leads, monthFilter, bdMetric]);

  // Mutations
  const createUserMutation = useMutation({
    mutationFn: async () => {
      const { email, password, full_name, role, department } = userForm;
      if (!email || !password || !full_name || !role) throw new Error('All fields are required');
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name, role, department } } });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success('User created'); queryClient.invalidateQueries({ queryKey: ['all-profiles-admin'] }); setUserForm({ email: '', password: '', full_name: '', role: '', department: '' }); },
    onError: (err: any) => toast.error(err.message)
  });

  const reassignLeadMutation = useMutation({
    mutationFn: async ({ leadId, userId }: { leadId: string, userId: string }) => { await supabase.from('leads').update({ assigned_to: userId }).eq('unique_id', leadId); },
    onSuccess: () => { toast.success('Reassigned'); queryClient.invalidateQueries({ queryKey: ['all-leads-admin'] }); },
    onError: (err: any) => toast.error(err.message)
  });

  // Team snapshot members
  const teamPerformance = useMemo(() => {
    const teams = [{ name: 'Lead Gen Team', roles: ['LEAD_TL', 'LEAD_GEN'] }, { name: 'Sales Team', roles: ['SALES_TL', 'SALES_TM'] }];
    return teams.map(team => {
      const teamUsers = allUsers.filter(u => team.roles.includes(u.role));
      const teamUserIds = teamUsers.map(u => u.user_id);
      const teamLeads = leads?.filter(l => (team.name === 'Lead Gen Team' && teamUserIds.includes(l.lead_generated_by || '')) || (team.name === 'Sales Team' && teamUserIds.includes(l.assigned_to || ''))) || [];
      return {
        name: team.name,
        leads: teamLeads.length,
        closures: teamLeads.filter(l => l.lead_status === 'Closed').length,
        calls: callLogs?.filter(c => teamUserIds.includes(c.user_id)).reduce((sum, c) => sum + (c.call_count || 0), 0) || 0,
        members: teamUsers.map(u => ({ id: u.user_id, name: u.full_name, role: u.role, leads: (leads?.filter(l => (team.name === 'Lead Gen Team' && l.lead_generated_by === u.user_id) || (team.name === 'Sales Team' && l.assigned_to === u.user_id)) || []).length }))
      };
    });
  }, [allUsers, leads, callLogs]);

  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'New': return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">New</Badge>;
      case 'Closed': return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Closed</Badge>;
      case 'Hot Prospect': return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Hot Prospect</Badge>;
      case 'Non Interested': return <Badge className="bg-slate-500/10 text-slate-500 border-slate-500/20">Non Interested</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 bg-background/50 backdrop-blur-xl p-6 rounded-2xl border border-primary/10 shadow-2xl sticky top-0 z-30">
        <div className="flex items-center gap-4"><div className="p-3 bg-primary/10 rounded-xl"><LayoutDashboard className="h-6 w-6 text-primary" /></div><div><h1 className="text-2xl font-display font-bold tracking-tight nb-gradient bg-clip-text text-transparent">Admin Dashboard</h1><p className="text-muted-foreground text-[10px] font-medium uppercase tracking-widest mt-0.5">Admin Analytics & Monitoring Layer</p></div></div>
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="bg-accent/30 p-1 rounded-lg border border-border/50"><TabsList className="bg-transparent border-none"><TabsTrigger value="control" className="data-[state=active]:bg-background text-xs">Control</TabsTrigger><TabsTrigger value="analytics" className="data-[state=active]:bg-background text-xs">Analytics</TabsTrigger><TabsTrigger value="monitoring" className="data-[state=active]:bg-background text-xs">Monitoring</TabsTrigger><TabsTrigger value="global" className="data-[state=active]:bg-background text-xs">Global View</TabsTrigger></TabsList></Tabs>
          <div className="h-8 w-[1px] bg-border/50 mx-1" />
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-36 h-9 bg-accent/30 border-border/50 text-xs">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => {
                const val = `${new Date().getFullYear()}-${String(i + 1).padStart(2, '0')}`;
                return <SelectItem key={val} value={val}>{m}</SelectItem>;
              })}
            </SelectContent>
          </Select>
          <Select value={teamFilter} onValueChange={setTeamFilter}><SelectTrigger className="w-32 h-9 bg-accent/30 border-border/50 text-xs"><SelectValue placeholder="Team" /></SelectTrigger><SelectContent><SelectItem value="all">All Teams</SelectItem><SelectItem value="Lead Gen">Lead Gen</SelectItem><SelectItem value="Sales">Sales</SelectItem></SelectContent></Select>
          <div className="relative w-48 h-9"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input placeholder="Search..." className="pl-9 h-full bg-accent/30 border-border/50 focus-visible:ring-primary/30 text-xs" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'control' && (
          <motion.div key="control" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Total Leads" value={filteredData.leads.length} icon={Users} delay={0} />
              <StatCard title="Pipeline" value={filteredData.leads.filter(l => !['Closed', 'Non Interested'].includes(l.lead_status || '')).length} icon={TrendingUp} delay={0.1} />
              <StatCard title="Closures" value={filteredData.leads.filter(l => l.lead_status === 'Closed').length} icon={CheckCircle} delay={0.2} />
              <StatCard title="Revenue" value={`$${revenueStats.total.toLocaleString()}`} icon={DollarSign} delay={0.3} />
            </div>
            {isAdmin && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <Card className="glass-card xl:col-span-1"><CardHeader><CardTitle className="text-xl font-display">Create User</CardTitle></CardHeader><CardContent className="space-y-3"><Input placeholder="Full Name" value={userForm.full_name} onChange={e => setUserForm(f => ({...f, full_name: e.target.value}))} className="h-9 bg-accent/20 text-xs" /><Input placeholder="Email" value={userForm.email} onChange={e => setUserForm(f => ({...f, email: e.target.value}))} className="h-9 bg-accent/20 text-xs" /><Input placeholder="Password" type="password" value={userForm.password} onChange={e => setUserForm(f => ({...f, password: e.target.value}))} className="h-9 bg-accent/20 text-xs" /><div className="grid grid-cols-2 gap-3"><Select value={userForm.role} onValueChange={v => setUserForm(f => ({...f, role: v}))}><SelectTrigger className="h-9 bg-accent/20 text-xs"><SelectValue placeholder="Role" /></SelectTrigger><SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select><Input placeholder="Dept" value={userForm.department} onChange={e => setUserForm(f => ({...f, department: e.target.value}))} className="h-9 bg-accent/20 text-xs" /></div><Button className="w-full nb-gradient h-9 text-xs" onClick={() => createUserMutation.mutate()}>Create Member</Button></CardContent></Card>
                <Card className="glass-card xl:col-span-2 overflow-hidden"><CardHeader className="pb-2"><CardTitle className="text-xl font-display">Active Directory</CardTitle></CardHeader><CardContent className="p-0"><div className="max-h-[300px] overflow-y-auto"><Table><TableHeader className="bg-accent/50 sticky top-0"><TableRow><TableHead className="text-xs">User</TableHead><TableHead className="text-xs">Role</TableHead><TableHead className="text-xs text-right">Action</TableHead></TableRow></TableHeader><TableBody>{allUsers.map(u => (<TableRow key={u.user_id}><TableCell className="text-xs font-medium">{u.full_name}</TableCell><TableCell><Badge variant="outline" className="text-[10px]">{u.role}</Badge></TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if(confirm('Delete user?')) supabase.from('profiles').delete().eq('user_id', u.user_id).then(() => queryClient.invalidateQueries({queryKey:['all-profiles-admin']})) }}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell></TableRow>))}</TableBody></Table></div></CardContent></Card>
              </div>
            )}
            {/* Lead View with Personal/Team/Global toggle */}
            <Card className="glass-card border-primary/10 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-accent/5 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-xl font-display">Lead Management</CardTitle>
                  <Badge className="nb-gradient border-none">{adminViewLeads.length} Records</Badge>
                </div>
                <div className="flex items-center gap-1 bg-accent/40 rounded-lg p-1">
                  {(['personal', 'team', 'global'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setAdminViewMode(m)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                        adminViewMode === m
                          ? 'nb-gradient text-white shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {m === 'personal' ? 'Unassigned' : m === 'team' ? 'Assigned' : 'All Leads'}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[520px] overflow-y-auto">
                  <Table>
                    <TableHeader className="bg-accent/50 sticky top-0">
                      <TableRow>
                        <TableHead className="text-xs">ID</TableHead>
                        <TableHead className="text-xs">Candidate</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Assigned To</TableHead>
                        <TableHead className="text-xs">Generated By</TableHead>
                        <TableHead className="text-xs text-right">Reassign</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminViewLeads.slice(0, 30).map(lead => (
                        <TableRow key={lead.unique_id} className={lead.lead_status === 'Hot Prospect' ? 'bg-red-500/10' : ''}>
                          <TableCell className="text-[10px] text-muted-foreground font-mono">{lead.display_id || lead.unique_id?.slice(0,8)}</TableCell>
                          <TableCell>
                            <div className="text-xs font-bold">{lead.name}</div>
                            <div className="text-[10px] text-muted-foreground">{lead.email}</div>
                          </TableCell>
                          <TableCell>
                            <Badge className="text-[10px]" variant={lead.lead_status === 'Closed' ? 'default' : 'outline'}>{lead.lead_status}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{allUsers.find(u => u.user_id === lead.assigned_to)?.full_name || <span className="text-muted-foreground italic">Unassigned</span>}</TableCell>
                          <TableCell className="text-xs">{allUsers.find(u => u.user_id === lead.lead_generated_by)?.full_name || '—'}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8"><RefreshCw className="h-3.5 w-3.5" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase border-b mb-1">Reassign To</div>
                                {allUsers.filter(u => u.team === 'Sales').map(u => (
                                  <DropdownMenuItem key={u.user_id} className="text-xs" onClick={() => reassignLeadMutation.mutate({ leadId: lead.unique_id, userId: u.user_id })}>{u.full_name}</DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {adminViewLeads.length === 0 && (
                    <div className="text-center py-10 text-muted-foreground text-sm">No leads in this view</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {activeTab === 'analytics' && (
          <motion.div key="analytics" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            {/* Daily Inflow — full width */}
            <Card className="glass-card"><CardHeader><CardTitle className="text-lg font-display flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> Daily Inflow</CardTitle></CardHeader><CardContent className="h-[250px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={analyticsData.inflow}><defs><linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs><XAxis dataKey="name" tick={{fontSize: 10}} /><YAxis tick={{fontSize: 10}} /><Tooltip /><Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorInflow)" /></AreaChart></ResponsiveContainer></CardContent></Card>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sales Team Performance Chart */}
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-lg font-display flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-blue-500" /> Sales Team Performance
                    </CardTitle>
                    <div className="flex items-center gap-1 bg-accent/40 rounded-lg p-1">
                      {(['calls', 'revenue', 'closures'] as const).map(m => (
                        <button
                          key={m}
                          onClick={() => setSalesMetric(m)}
                          className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                            salesMetric === m
                              ? 'bg-blue-500 text-white shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {m.charAt(0).toUpperCase() + m.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="inline-flex items-center gap-1 mr-3"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> TL</span>
                    <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-400 inline-block" /> Member</span>
                  </p>
                </CardHeader>
                <CardContent className="h-[280px]">
                  {salesChartData.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No sales team data</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={salesChartData} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip
                          formatter={(value: any) => [
                            salesMetric === 'revenue' ? `$${Number(value).toLocaleString()}` : value,
                            salesMetric.charAt(0).toUpperCase() + salesMetric.slice(1)
                          ]}
                          labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {salesChartData.map((entry, idx) => (
                            <Cell key={idx} fill={entry.role === 'TL' ? '#3b82f6' : '#38bdf8'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* BD Team Performance Chart */}
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-lg font-display flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-emerald-500" /> BD Team Performance
                    </CardTitle>
                    <div className="flex items-center gap-1 bg-accent/40 rounded-lg p-1">
                      {(['calls', 'leads'] as const).map(m => (
                        <button
                          key={m}
                          onClick={() => setBdMetric(m)}
                          className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                            bdMetric === m
                              ? 'bg-emerald-500 text-white shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {m.charAt(0).toUpperCase() + m.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="inline-flex items-center gap-1 mr-3"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> TL</span>
                    <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-400 inline-block" /> Member</span>
                  </p>
                </CardHeader>
                <CardContent className="h-[280px]">
                  {bdChartData.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No BD team data</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={bdChartData} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip
                          formatter={(value: any) => [value, bdMetric === 'calls' ? 'Calls' : 'Leads Generated']}
                          labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {bdChartData.map((entry, idx) => (
                            <Cell key={idx} fill={entry.role === 'TL' ? '#10b981' : '#2dd4bf'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Distribution chart row — no inline labels to prevent overlap */}
            <div className="grid grid-cols-1 gap-6">
              <Card className="glass-card"><CardHeader><CardTitle className="text-lg font-display flex items-center gap-2"><PieChartIcon className="h-5 w-5 text-purple-500" /> Lead Status Distribution</CardTitle></CardHeader><CardContent className="h-[320px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={analyticsData.status} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={100} innerRadius={40}>{analyticsData.status.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(value: any, name: any) => [value, name]} /><Legend verticalAlign="bottom" height={36} /></PieChart></ResponsiveContainer></CardContent></Card>
            </div>
          </motion.div>
        )}

        {activeTab === 'monitoring' && (
          <motion.div key="monitoring" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Card className="glass-card border-red-500/20 bg-red-500/5"><CardHeader className="pb-2 text-red-500 flex flex-row items-center justify-between"><CardTitle className="text-lg font-display flex items-center gap-2"><Clock className="h-5 w-5" /> SLA Breaches</CardTitle><Badge variant="destructive" className="animate-pulse">{slaAlerts.length} Alerts</Badge></CardHeader><CardContent className="p-0"><div className="max-h-[350px] overflow-y-auto"><Table><TableHeader className="bg-red-500/10"><TableRow><TableHead className="text-xs">Lead</TableHead><TableHead className="text-xs">Assigned</TableHead><TableHead className="text-xs text-right">Action</TableHead></TableRow></TableHeader><TableBody>{slaAlerts.slice(0, 10).map(l => (<TableRow key={l.unique_id} className="border-red-500/10"><TableCell className="text-xs font-bold">{l.name}</TableCell><TableCell className="text-xs">{allUsers.find(u => u.user_id === l.assigned_to)?.full_name || 'Unassigned'}</TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" className="h-7 text-[10px] text-red-500" onClick={() => setActiveTab('control')}>Reassign</Button></TableCell></TableRow>))}</TableBody></Table></div></CardContent></Card>
              <Card className="glass-card border-amber-500/20 bg-amber-500/5"><CardHeader className="pb-2 text-amber-500"><CardTitle className="text-lg font-display flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Concern Center</CardTitle></CardHeader><CardContent className="p-0"><div className="max-h-[350px] overflow-y-auto"><Table><TableHeader className="bg-amber-500/10"><TableRow><TableHead className="text-xs">Lead</TableHead><TableHead className="text-xs">Issue</TableHead><TableHead className="text-xs text-right">Action</TableHead></TableRow></TableHeader><TableBody>{concerns?.slice(0, 10).map(c => (<TableRow key={c.id} className="border-amber-500/10"><TableCell className="text-xs font-bold">{leads?.find(l => l.unique_id === c.lead_id)?.name || 'Unknown'}</TableCell><TableCell className="text-xs italic">"{c.description}"</TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" className="h-7 text-[10px] text-amber-500 hover:bg-amber-500/10" onClick={() => resolveConcernMutation.mutate({ concernId: c.id, leadId: c.lead_id, raisedBy: c.raised_by })} disabled={resolveConcernMutation.isPending}>Resolve</Button></TableCell></TableRow>))}</TableBody></Table></div></CardContent></Card>
            </div>
            <Card className="glass-card"><CardHeader><CardTitle className="text-lg font-display flex items-center gap-2"><Bell className="h-5 w-5 text-primary animate-bell-shake" /> Notification Hub</CardTitle></CardHeader><CardContent className="p-0"><div className="max-h-[400px] overflow-y-auto divide-y divide-border/50">{notifications?.slice(0, 20).map(n => (<div key={n.id} className="p-4 hover:bg-accent/20 flex items-start gap-4"><div className="p-2 rounded-full bg-primary/10 text-primary"><Activity className="h-4 w-4" /></div><div className="flex-1"><p className="text-sm font-bold">{n.title}</p><p className="text-xs text-muted-foreground">{n.message}</p><p className="text-[9px] text-muted-foreground mt-1 font-mono uppercase">{format(parseISO(n.created_at), 'PPPP p')}</p></div></div>))}</div></CardContent></Card>
          </motion.div>
        )}

        {activeTab === 'global' && (
          <motion.div key="global" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <Card className="glass-card border-primary/10 overflow-hidden">
              <CardHeader className="flex flex-col gap-3 border-b border-border/50 bg-accent/5">
                <div className="flex flex-row items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-xl font-display">Global Leads</CardTitle>
                    <Badge className="nb-gradient border-none">{globalLeads.length} Records</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-background px-2.5 rounded-md border border-input h-9 shrink-0">
                      <span className="text-xs text-muted-foreground font-medium pr-1 select-none">Date:</span>
                      <Input type="date" value={globalDateFrom} onChange={e => setGlobalDateFrom(e.target.value)} className="w-[120px] h-7 text-xs border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0" />
                      <span className="text-muted-foreground text-xs px-0.5 select-none">—</span>
                      <Input type="date" value={globalDateTo} onChange={e => setGlobalDateTo(e.target.value)} className="w-[120px] h-7 text-xs border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0" />
                    </div>
                    <div className="relative h-9 w-48">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input placeholder="Search..." className="pl-9 h-full bg-accent/30 border-border/50 text-xs" value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} />
                    </div>
                  </div>
                </div>
                {/* Advanced Filters Row */}
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={globalSalesTLFilter} onValueChange={v => { setGlobalSalesTLFilter(v); setGlobalSalesMemberFilter('all'); }}>
                    <SelectTrigger className="w-44 h-8 text-xs bg-accent/30 border-border/50">
                      <SelectValue placeholder="All Sales TLs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sales TLs</SelectItem>
                      {globalSalesTLList.map(u => (
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
                      {globalSalesMemberList.map(u => (
                        <SelectItem key={u.user_id} value={u.user_id}>{u.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedGenerator} onValueChange={setSelectedGenerator}>
                    <SelectTrigger className="w-44 h-8 text-xs bg-accent/30 border-border/50">
                      <SelectValue placeholder="All Lead Generators" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Lead Generators</SelectItem>
                      {globalBdUsersList.map(u => (
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
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <Table>
                    <TableHeader className="bg-accent/50 sticky top-0">
                      <TableRow>
                        <TableHead className="text-xs w-10">#</TableHead>
                        <TableHead className="text-xs">ID</TableHead>
                        <TableHead className="text-xs">Name</TableHead>
                        <TableHead className="text-xs">Email</TableHead>
                        <TableHead className="text-xs">Phone</TableHead>
                        <TableHead className="text-xs">LinkedIn</TableHead>
                        <TableHead className="text-xs">Tech</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Generated By</TableHead>
                        <TableHead className="text-xs">Assigned To</TableHead>
                        <TableHead className="text-xs">Source</TableHead>
                        <TableHead className="text-xs">Last Activity</TableHead>
                        <TableHead className="text-xs text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {globalLeads.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={13} className="text-center py-10 text-muted-foreground text-sm">No leads found</TableCell>
                        </TableRow>
                      ) : (
                        globalLeads.map((lead, idx) => (
                          <TableRow key={lead.unique_id} className="hover:bg-accent/20 border-border/50">
                            <TableCell className="text-xs text-muted-foreground font-medium w-10">{idx + 1}</TableCell>
                            <TableCell className="text-xs font-mono text-primary font-bold">{(lead as any).display_id || '—'}</TableCell>
                            <TableCell className="text-xs font-medium">{lead.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{lead.email}</TableCell>
                            <TableCell className="text-xs">{lead.phone || '—'}</TableCell>
                            <TableCell className="text-xs">
                              {lead.linkedin_url ? (
                                <a href={lead.linkedin_url} target="_blank" rel="noreferrer" className="text-primary underline">View</a>
                              ) : '—'}
                            </TableCell>
                            <TableCell className="text-xs">{lead.technology || '—'}</TableCell>
                            <TableCell>
                              <Badge className={`text-[10px] ${statusColors[lead.lead_status || ''] || 'bg-secondary/10 text-secondary-foreground'}`}>
                                {lead.lead_status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{lead.lead_generated_by ? (allUsers.find(u => u.user_id === lead.lead_generated_by)?.full_name || 'System') : 'System'}</TableCell>
                            <TableCell className="text-xs">{allUsers.find(u => u.user_id === lead.assigned_to)?.full_name || <span className="italic text-muted-foreground">Unassigned</span>}</TableCell>
                            <TableCell className="text-xs">{lead.lead_source || '—'}</TableCell>
                            <TableCell className="text-xs">{new Date(lead.updated_at).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedLead(lead)} title="View Details">
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10" onClick={() => setEditLead(lead)} title="Edit Lead">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {selectedLead && (
        <LeadDetailDialog
          open={selectedLead !== null}
          onClose={() => setSelectedLead(null)}
          lead={selectedLead}
        />
      )}

      {editLead && (
        <EditLeadDialog
          open={!!editLead}
          onClose={() => setEditLead(null)}
          lead={editLead}
          queryKeys={[['leads'], ['leads-with-comments']]}
        />
      )}
    </div>
  );
};

export default AdminDashboard;

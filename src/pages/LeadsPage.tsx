import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Phone, Eye, Filter, Palette, AlertTriangle, MessageSquare, FileText as FileTextIcon, Send, Pencil, Trash2, UserMinus, UserPlus } from 'lucide-react';
import LeadDetailDialog from '@/components/LeadDetailDialog';
import ClosureDialog from '@/components/ClosureDialog';
import CallActivityDialog from '@/components/CallActivityDialog';
import AgreementDialog from '@/components/AgreementDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Shuffle, FileSignature, FileText, ChevronDown, Search, RefreshCw, DollarSign } from 'lucide-react';
import AccountantCommentDialog from '@/components/AccountantCommentDialog';
import EditLeadDialog from '../components/EditLeadDialog';
import { useDeferredRender } from '@/hooks/useDeferredRender';
import { DebouncedSearchInput } from '@/components/ui/DebouncedSearchInput';

// ── Status color map ─────────────────────────────────────────────────────────
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

const allStatuses = ['New', 'DNR1', 'DNR2', 'DNR3', 'Connected', 'Qualified', 'Hot Prospect', 'Closed', 'Non Interested', 'Stagnant'];

// ── Ordered status flow (Sales role only) ───────────────────────────────────
const STATUS_FLOW: Record<string, string[]> = {
  'New':          allStatuses,
  'DNR1':         allStatuses,
  'DNR2':         allStatuses,
  'DNR3':         allStatuses,
  'Connected':    allStatuses,
  'Qualified':    allStatuses,
  'Hot Prospect': allStatuses,
  'Stagnant':     allStatuses,
  'Closed':       allStatuses,
  'Non Interested': allStatuses,
};

const getNextStatuses = (current: string, role: string | null): string[] => {
  return allStatuses;
};

// ── Highlight color palette ──────────────────────────────────────────────────
const HIGHLIGHT_COLORS = [
  { label: 'None', value: '' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Purple', value: '#a855f7' },
];

// ── Month label helper ────────────────────────────────────────────────────────
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

import { getISTYearAndMonth, getISTDateString, formatToISTDateString } from '@/lib/dateUtils';

const formatDate = (dateString?: string) => formatToISTDateString(dateString);

interface ReassignDropdownMenuProps {
  candidates: { user_id: string; full_name: string; role: string }[];
  onSelect: (selection: string) => void;
  onClose: () => void;
}

const ReassignDropdownMenu: React.FC<ReassignDropdownMenuProps> = ({ candidates, onSelect, onClose }) => {
  const [search, setSearch] = useState('');
  const menuRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [onClose]);

  // Flatten candidates to show clean member names
  const options = React.useMemo(() => {
    return candidates.map(c => ({
      label: c.full_name.trim(),
      value: `${c.user_id}_Personal`
    }));
  }, [candidates]);

  const filteredOptions = React.useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, search]);

  return (
    <div
      ref={menuRef}
      className="absolute right-0 mt-1.5 w-60 rounded-md border border-border bg-popover text-popover-foreground shadow-md z-50 p-1 flex flex-col max-h-[300px]"
    >
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border/50">
        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <Input
          placeholder="Search salesperson..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 text-xs border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
      <div className="overflow-y-auto flex-1 mt-1 space-y-0.5 max-h-[220px]">
        {filteredOptions.length === 0 ? (
          <div className="text-[11px] text-muted-foreground text-center py-2">No options found</div>
        ) : (
          filteredOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onSelect(opt.value)}
              className="w-full text-left px-2 py-1.5 text-xs rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {opt.label}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

const LeadsPage: React.FC = () => {
  const { user, role, profile } = useAuth();
  const queryClient = useQueryClient();

  // ── Filter state ──────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all'); // 'all' | '1'..'12'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [memberFilter, setMemberFilter] = useState('all');
  const [bdMemberFilter, setBdMemberFilter] = useState('all');

  // ── Dialog state ─────────────────────────────────────────────
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [closureLead, setClosureLead] = useState<any>(null);
  const [callLead, setCallLead] = useState<any>(null);
  const [agreementLead, setAgreementLead] = useState<any>(null);
  const [highlightLead, setHighlightLead] = useState<string | null>(null);
  const [reassigningLeadId, setReassigningLeadId] = useState<string | null>(null);
  const [accountantLead, setAccountantLead] = useState<any>(null);
  const [editLead, setEditLead] = useState<any>(null);
  const [deleteConfirmLead, setDeleteConfirmLead] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Status comment dialog state ───────────────────────────────
  const [pendingStatusChange, setPendingStatusChange] = useState<{ lead: any; status: string } | null>(null);
  const [statusComment, setStatusComment] = useState('');
  // Send Document toggle inside the status-change dialog
  const [sendDocument, setSendDocument] = useState(false);
  const [docComment, setDocComment] = useState('');

  // ── Concern Dialog State ─────────────────────────────────────
  const [concernLead, setConcernLead] = useState<any>(null);
  const [concernText, setConcernText] = useState('');
  const [concernRecipient, setConcernRecipient] = useState('');

  // ── Pagination state ──────────────────────────────────────────
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  // Reset page to 1 whenever any filter changes
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, monthFilter, dateFrom, dateTo, memberFilter, bdMemberFilter]);

  // ── Fetch leads (role-scoped, server-side filtered, paginated) ─
  const { data: leadsData, isLoading } = useQuery({
    queryKey: ['leads', user?.id, role, page, search, statusFilter, monthFilter, dateFrom, dateTo, memberFilter, bdMemberFilter],
    queryFn: async () => {
      // Auto-trigger stagnant leads scan
      await supabase.rpc('update_stagnant_leads');

      let query = supabase.from('leads').select('*', { count: 'exact' });

      // Role permission constraints
      if (role === 'LEAD_GEN') {
        query = query.eq('lead_generated_by', user!.id);
      } else if (role === 'SALES_TM') {
        query = query.eq('assigned_to', user!.id);
      } else if (role === 'SALES_TL') {
        const { data: teamProfiles } = await supabase
          .from('profiles')
          .select('user_id')
          .or(`reports_to.eq.${user!.id},user_id.eq.${user!.id}`);
        const teamUserIds = teamProfiles?.map(p => p.user_id) || [user!.id];
        query = query.or(`assigned_to.in.(${teamUserIds.join(',')}),team_lead_id.eq.${user!.id}`);
      }

      // 1. Smart targeted search filter
      if (search.trim()) {
        const raw = search.trim();
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

      // 2. Status filter
      if (statusFilter !== 'all') {
        query = query.eq('lead_status', statusFilter as any);
      }

      // 3. Month filter (for current year)
      if (monthFilter !== 'all') {
        const year = getISTYearAndMonth(new Date()).year;
        const monthNum = parseInt(monthFilter);
        const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01T00:00:00+05:30`;
        const lastDay = new Date(year, monthNum, 0).getDate();
        const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59+05:30`;
        query = query.gte('created_at', startDate).lte('created_at', endDate);
      }

      // 4. Date range filter
      if (dateFrom) {
        query = query.gte('created_at', `${dateFrom}T00:00:00+05:30`);
      }
      if (dateTo) {
        query = query.lte('created_at', `${dateTo}T23:59:59+05:30`);
      }

      // 5. Team member filter
      if (memberFilter !== 'all') {
        query = query.or(`assigned_to.eq.${memberFilter},lead_generated_by.eq.${memberFilter}`);
      }

      // 6. BD member filter
      if (bdMemberFilter !== 'all') {
        query = query.eq('lead_generated_by', bdMemberFilter);
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
    enabled: !!user && !!role,
    placeholderData: (previousData) => previousData,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const leads = useMemo(() => {
    const serverLeads = leadsData?.leads || [];
    if (!search.trim()) return serverLeads;

    const raw = search.trim().toLowerCase();
    const digits = raw.replace(/\D/g, '');
    const inMem = serverLeads.filter((l: any) => {
      const nameMatch = l.name?.toLowerCase().includes(raw);
      const emailMatch = l.email?.toLowerCase().includes(raw);
      const phoneMatch = digits.length >= 4 && (l.phone?.replace(/\D/g, '').includes(digits) || l.phone?.toLowerCase().includes(raw));
      const idMatch = l.display_id?.toLowerCase().includes(raw) || (digits.length >= 2 && l.display_id?.toLowerCase().includes(digits));
      return nameMatch || emailMatch || phoneMatch || idMatch;
    });

    return inMem.length > 0 ? inMem : serverLeads;
  }, [leadsData?.leads, search]);

  const totalCount = search.trim() ? leads.length : (leadsData?.totalCount || 0);

  // ── Profiles map ─────────────────────────────────────────────
  const { data: profilesMap } = useQuery({
    queryKey: ['profiles-map'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name, email');
      const map: Record<string, { full_name: string; email: string }> = {};
      data?.forEach(p => { map[p.user_id] = { full_name: p.full_name, email: p.email }; });
      return map;
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
  });

  // ── BD user IDs (to show "Generated By" column) ──────────────
  const { data: bdUserIds } = useQuery({
    queryKey: ['bd-user-ids'],
    queryFn: async () => {
      const { data } = await supabase.from('user_roles').select('user_id').in('role', ['LEAD_GEN', 'LEAD_TL']);
      return new Set(data?.map(r => r.user_id) || []);
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
  });

  // ── Fetch all user roles for PA/BD TL permission checks ──
  const { data: userRolesMap } = useQuery({
    queryKey: ['user-roles-map'],
    queryFn: async () => {
      const { data } = await supabase.from('user_roles').select('user_id, role');
      const map: Record<string, string> = {};
      data?.forEach(r => { map[r.user_id] = r.role; });
      return map;
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
  });

  // ── Fetch all profiles with reports_to for TL permission checks ──
  const { data: allProfilesList } = useQuery({
    queryKey: ['all-profiles-list'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name, email, reports_to');
      return data || [];
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
  });

  // ── Fetch closure data (for Admin/Sales/TL view of payments) ────────────
  const { data: closureData = [] } = useQuery({
    queryKey: ['account-closures', user?.id, role],
    queryFn: async () => {
      let query = supabase.from('lead_closures').select('*');
      if (role === 'SALES_TM') {
        const { data: myLeads } = await supabase.from('leads').select('unique_id').or(`assigned_to.eq.${user!.id},lead_generated_by.eq.${user!.id}`);
        const leadIds = myLeads?.map(l => l.unique_id) || [];
        if (leadIds.length === 0) return [];
        query = query.in('lead_id', leadIds);
      } else if (role === 'SALES_TL') {
        const { data: teamProfiles } = await supabase
          .from('profiles')
          .select('user_id')
          .or(`reports_to.eq.${user!.id},user_id.eq.${user!.id}`);
        const teamUserIds = teamProfiles?.map(p => p.user_id) || [user!.id];
        const { data: leadsInTeam } = await supabase
          .from('leads')
          .select('unique_id')
          .or(`assigned_to.in.(${teamUserIds.join(',')}),team_lead_id.eq.${user!.id}`);
        const teamLeadIds = leadsInTeam?.map(l => l.unique_id) || [];
        if (teamLeadIds.length === 0) return [];
        query = query.in('lead_id', teamLeadIds);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && (role === 'ADMIN' || role === 'SALES_TL' || role === 'SALES_TM'),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  // ── Team members list (for TL/Admin member filter) ───────────
  const { data: teamMembers } = useQuery({
    queryKey: ['team-members-list', user?.id, role],
    queryFn: async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('role', ['SALES_TM', 'SALES_TL', 'LEAD_TL']);
      if (!roles) return [];
      
      const tlIds = roles.filter(r => r.role === 'SALES_TL' || r.role === 'LEAD_TL').map(r => r.user_id);
      const tmIds = roles.filter(r => r.role === 'SALES_TM').map(r => r.user_id);
      
      let tlQuery = supabase.from('profiles').select('user_id, full_name').in('user_id', tlIds) as any;
      if (role === 'SALES_TL') {
        tlQuery = tlQuery.eq('user_id', user!.id);
      }
      const { data: tlProfiles } = await tlQuery;
      
      let tmQuery = supabase.from('profiles').select('user_id, full_name').in('user_id', tmIds) as any;
      if (role === 'SALES_TL') {
        tmQuery = tmQuery.eq('reports_to', user!.id);
      }
      const { data: tmProfiles } = await tmQuery;
      
      const combined = [...(tlProfiles || []), ...(tmProfiles || [])];
      const uniqueMap: Record<string, any> = {};
      combined.forEach(p => {
        uniqueMap[p.user_id] = p;
      });
      return Object.values(uniqueMap);
    },
    enabled: !!user && (role === 'ADMIN' || role === 'SALES_TL' || role === 'LEAD_TL'),
  });

  // ── BD members list (for TL/Admin BD member filter) ───────────
  const { data: bdMembers } = useQuery({
    queryKey: ['bd-members-list', user?.id, role],
    queryFn: async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('role', ['LEAD_GEN', 'LEAD_TL']);
      if (!roles) return [];
      
      const userIds = roles.map(r => r.user_id);
      
      let query = supabase.from('profiles').select('user_id, full_name').in('user_id', userIds) as any;
      if (role === 'LEAD_TL') {
        query = query.or(`user_id.eq.${user!.id},reports_to.eq.${user!.id}`);
      }
      const { data: profiles, error } = await query;
      if (error) throw error;
      
      const uniqueMap: Record<string, any> = {};
      profiles?.forEach(p => {
        uniqueMap[p.user_id] = p;
      });
      
      const combined = Object.values(uniqueMap) as any[];
      combined.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
      return combined;
    },
    enabled: !!user && (role === 'ADMIN' || role === 'SALES_TL' || role === 'LEAD_TL'),
  });

  // ── Reassign candidates list (SALES_TL and team members) ───────────────
  const reassignCandidates = useMemo(() => {
    if (!profilesMap || !userRolesMap) return [];
    
    if (role === 'SALES_TL') {
      // For Sales TL: show self and all Sales TMs reporting to this Sales TL
      const myTeamMembers = (allProfilesList || []).filter(p => p.reports_to === user?.id && userRolesMap[p.user_id] === 'SALES_TM');
      
      const candidates = [
        {
          user_id: user!.id,
          full_name: `${profilesMap[user!.id]?.full_name || 'Me'} (Self)`,
          role: 'SALES_TL'
        },
        ...myTeamMembers.map(p => ({
          user_id: p.user_id,
          full_name: p.full_name || 'Team Member',
          role: 'SALES_TM'
        }))
      ];
      return candidates.sort((a, b) => a.full_name.localeCompare(b.full_name));
    }
    
    // For Admin / LEAD_TL: show all Sales TLs and Sales TMs
    return Object.entries(userRolesMap)
      .filter(([_, r]) => r === 'SALES_TL' || r === 'SALES_TM')
      .map(([userId, r]) => {
        const profile = profilesMap[userId];
        return {
          user_id: userId,
          full_name: profile?.full_name || 'Unknown',
          role: r
        };
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [profilesMap, userRolesMap, role, user?.id, allProfilesList]);

  // ── Reassign lead mutation ────────────────────────────────────
  const reassignLead = useMutation({
    mutationFn: async ({ leadId, selection }: { leadId: string; selection: string }) => {
      const [userId, type] = selection.split('_');
      
      const { data: lead, error: fetchErr } = await supabase
        .from('leads')
        .select('name, assigned_to, team_lead_id')
        .eq('unique_id', leadId)
        .single();
      if (fetchErr) throw fetchErr;

      const leadName = lead?.name || 'Lead';
      const oldAssignee = lead?.assigned_to;

      // Determine the correct team lead ID
      let teamLeadId = user!.id;
      if (role !== 'SALES_TL') {
        const targetRole = userRolesMap?.[userId];
        if (targetRole === 'SALES_TL') {
          teamLeadId = userId;
        } else {
          const tmProfile = (allProfilesList || []).find(p => p.user_id === userId);
          teamLeadId = tmProfile?.reports_to || lead?.team_lead_id || userId;
        }
      }

      const { error } = await supabase.from('leads').update({ 
        assigned_to: userId,
        assignment_type: type || 'Personal',
        team_lead_id: teamLeadId,
        assigned_at: new Date().toISOString(),
      } as any).eq('unique_id', leadId);
      if (error) throw error;

      await supabase.from('lead_history_logs').insert({
        lead_id: leadId,
        changed_by: user!.id,
        action_type: 'OWNER_CHANGE',
        old_value: oldAssignee || 'Unassigned',
        new_value: userId,
        comments: `Assigned to ${profilesMap?.[userId]?.full_name || 'Sales Person'} by ${profile?.full_name || 'TL'}.`
      });

      const adminsAndTls = (await supabase.from('user_roles').select('user_id').in('role', ['ADMIN', 'LEAD_TL'])).data?.map(r => r.user_id) || [];
      const targets = new Set<string>([...adminsAndTls, userId]);
      if (lead?.team_lead_id) targets.add(lead.team_lead_id);
      if (teamLeadId) targets.add(teamLeadId);
      
      const salesName = profilesMap?.[userId]?.full_name || 'Salesperson';
      const performerName = profile?.full_name || 'System';
      const prevOwnerName = oldAssignee ? (profilesMap?.[oldAssignee]?.full_name || 'Unknown') : 'Unassigned Pool';
      const msg = oldAssignee
        ? `Lead "${leadName}" has been reassigned from ${prevOwnerName} to ${salesName} by ${performerName}.`
        : `Lead "${leadName}" has been assigned from ${prevOwnerName} to ${salesName} by ${performerName}.`;

      const notifs = Array.from(targets).map(tId => ({
        user_id: tId,
        title: oldAssignee ? 'Lead Reassigned' : 'Lead Assigned',
        message: msg,
        type: 'reassign',
        lead_id: leadId,
      }));
      await supabase.from('notifications').insert(notifs);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['salestl-leads'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success('Lead assigned successfully!');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Unassign lead mutation ────────────────────────────────────
  const unassignLead = useMutation({
    mutationFn: async ({ leadId }: { leadId: string }) => {
      // 1. Fetch details of the lead before clearing them
      const { data: lead, error: fetchErr } = await supabase
        .from('leads')
        .select('name, display_id, assigned_to, team_lead_id')
        .eq('unique_id', leadId)
        .single();
      if (fetchErr) throw fetchErr;
      if (!lead) throw new Error('Lead not found');

      const leadName = lead.name || 'Lead';
      const leadDisplayId = lead.display_id || '';
      const oldAssigneeId = lead.assigned_to;
      const teamLeadId = lead.team_lead_id;

      // 2. Clear assignment on lead
      const { error: updateErr } = await supabase
        .from('leads')
        .update({
          assigned_to: null,
          assignment_type: null,
          team_lead_id: null,
          assigned_at: null
        } as any)
        .eq('unique_id', leadId);
      if (updateErr) throw updateErr;

      // 3. Log history
      const oldAssigneeName = oldAssigneeId && profilesMap?.[oldAssigneeId]
        ? profilesMap[oldAssigneeId].full_name
        : 'Unassigned';
      
      const currentUserName = profile?.full_name || 'Admin/BD TL';

      await supabase.from('lead_history_logs').insert({
        lead_id: leadId,
        changed_by: user!.id,
        action_type: 'OWNER_CHANGE',
        old_value: oldAssigneeId || 'Unassigned',
        new_value: 'Unassigned',
        comments: `Unassigned by ${currentUserName}.`
      });

      // 4. Send Notifications
      const notifs: any[] = [];
      const adminAndBdTlIds = Object.entries(userRolesMap || {})
        .filter(([_, r]) => r === 'ADMIN' || r === 'LEAD_TL')
        .map(([uid]) => uid);

      // A. To Respective Salesperson (if was assigned)
      if (oldAssigneeId) {
        notifs.push({
          user_id: oldAssigneeId,
          title: 'Lead Unassigned',
          message: `Lead "${leadName}" (${leadDisplayId || '—'}) has been unassigned from you by ${currentUserName}.`,
          type: 'lead_unassigned',
          lead_id: leadId,
        });

        // B. To Respective Sales TL
        const salespersonProfile = allProfilesList?.find(p => p.user_id === oldAssigneeId);
        const salesTLId = teamLeadId || salespersonProfile?.reports_to;
        if (salesTLId && salesTLId !== oldAssigneeId) {
          notifs.push({
            user_id: salesTLId,
            title: 'Lead Unassigned from Team Member',
            message: `Lead "${leadName}" (${leadDisplayId || '—'}) has been unassigned from your team member ${oldAssigneeName} by ${currentUserName}.`,
            type: 'lead_unassigned',
            lead_id: leadId,
          });
        }
      }

      // C. To Admins and BD TLs
      adminAndBdTlIds.forEach(uid => {
        notifs.push({
          user_id: uid,
          title: 'Lead Unassigned',
          message: `Lead "${leadName}" (${leadDisplayId || '—'}) has been successfully unassigned and moved back to the Assign Lead queue by ${currentUserName}.`,
          type: 'lead_unassigned',
          lead_id: leadId,
        });
      });

      if (notifs.length > 0) {
        const { error: notifErr } = await supabase.from('notifications').insert(notifs);
        if (notifErr) console.error('Failed to create unassign notifications:', notifErr);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead unassigned successfully and returned to queue');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Update status mutation (requires comment) ────────────────
  const updateStatus = useMutation({
    mutationFn: async ({ leadId, status, comment, withDocument, documentComment }: { leadId: string; status: string; comment: string; withDocument?: boolean; documentComment?: string }) => {
      if (role !== 'SALES_TM' && role !== 'SALES_TL' && role !== 'ADMIN') {
        throw new Error('Only Sales team can update lead status');
      }
      if (status === 'Closed') {
        const lead = leads?.find(l => l.unique_id === leadId);
        setClosureLead(lead);
        return;
      }

      const lead = leads?.find(l => l.unique_id === leadId);
      const oldStatus = lead?.lead_status || 'New';

      // Save status + comment together
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
      if (['DNR1', 'DNR2', 'DNR3', 'Non Interested'].includes(status)) {
        if (lead?.lead_generated_by) {
          await supabase.from('notifications').insert({
            user_id: lead.lead_generated_by,
            title: 'Lead Status Update',
            message: `${lead.name} marked as ${status}. Comment: ${comment}`,
            type: 'dnr',
            lead_id: leadId,
          });
        }
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
      queryClient.invalidateQueries({ queryKey: ['leads'] });
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

  // ── Handler: open comment dialog before status change ─────────
  const handleStatusChangeRequest = (lead: any, newStatus: string) => {
    if (newStatus === lead.lead_status) return; // no-op
    if (newStatus === 'Closed') {
      setClosureLead(lead);
      return;
    }
    setPendingStatusChange({ lead, status: newStatus });
    setStatusComment('');
  };

  // ── Highlight color mutation ──────────────────────────────────
  const updateHighlight = useMutation({
    mutationFn: async ({ leadId, color }: { leadId: string; color: string }) => {
      const { error } = await supabase.from('leads')
        .update({ highlight_color: color || null })
        .eq('unique_id', leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setHighlightLead(null);
      toast.success('Highlight updated');
    },
    onError: (err: Error) => toast.error(err.message),
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
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['bd-member-leads'] });
      toast.success('Concern raised and recipient notified');
      setConcernLead(null);
      setConcernText('');
      setConcernRecipient('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Fetch Concern Recipients ──────────────────────────────────
  const { data: concernRecipients = [] } = useQuery({
    queryKey: ['concern-recipients', user?.id, role],
    queryFn: async () => {
      if (!user || !role) return [];

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

      if (role === 'SALES_TM') {
        if (reportsTo) {
          const tl = profiles.find(p => p.user_id === reportsTo);
          if (tl) {
            list.push({
              user_id: tl.user_id,
              label: `${tl.full_name} (Sales TL)`
            });
          }
        } else {
          const salesTlUserIds = new Set(roles.filter(r => r.role === 'SALES_TL').map(r => r.user_id));
          profiles.forEach(p => {
            if (salesTlUserIds.has(p.user_id)) {
              list.push({
                user_id: p.user_id,
                label: `${p.full_name} (Sales TL)`
              });
            }
          });
        }
      } else if (role === 'LEAD_GEN') {
        if (reportsTo) {
          const tl = profiles.find(p => p.user_id === reportsTo);
          if (tl) {
            list.push({
              user_id: tl.user_id,
              label: `${tl.full_name} (BD TL)`
            });
          }
        } else {
          const leadTlUserIds = new Set(roles.filter(r => r.role === 'LEAD_TL').map(r => r.user_id));
          profiles.forEach(p => {
            if (leadTlUserIds.has(p.user_id)) {
              list.push({
                user_id: p.user_id,
                label: `${p.full_name} (BD TL)`
              });
            }
          });
        }
      } else if (role === 'SALES_TL' || role === 'LEAD_TL') {
        profiles.forEach(p => {
          if (p.reports_to === user.id) {
            list.push({
              user_id: p.user_id,
              label: `${p.full_name} (Team Member)`
            });
          }
        });

        const adminUserIds = new Set(roles.filter(r => r.role === 'ADMIN').map(r => r.user_id));
        profiles.forEach(p => {
          if (adminUserIds.has(p.user_id)) {
            list.push({
              user_id: p.user_id,
              label: `${p.full_name} (Admin)`
            });
          }
        });
      } else {
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
      }

      return list;
    },
    enabled: !!user && !!role,
  });

  useEffect(() => {
    if (concernRecipients && concernRecipients.length === 1) {
      setConcernRecipient(concernRecipients[0].user_id);
    }
  }, [concernRecipients]);

  // ── Client-side filtering (Disabled — handled server-side above) ─
  const filtered = leads;

  // ── Permission flags ──────────────────────────────────────────
  const canCall = role === 'SALES_TM' || role === 'SALES_TL' || role === 'ADMIN';
  const canUpdateStatus = role === 'SALES_TM' || role === 'SALES_TL' || role === 'ADMIN';
  const canHighlight = role === 'SALES_TM' || role === 'SALES_TL' || role === 'ADMIN';
  const canSeeGeneratedBy = role === 'SALES_TM' || role === 'SALES_TL' || role === 'LEAD_TL' || role === 'PROCESS_ANALYST' || role === 'ADMIN';
  const showMemberFilter = role === 'ADMIN' || role === 'SALES_TL' || role === 'LEAD_TL';
  const canSendToAccountant = role === 'ADMIN';

  const canEditLead = (lead: any) => {
    if (!user || !role) return false;
    
    // 1. ADMIN can edit all leads
    if (role === 'ADMIN') return true;
    
    // 2. PROCESS_ANALYST can edit all leads belonging to Sales or BD teams (TL + team members)
    if (role === 'PROCESS_ANALYST') {
      const generatorId = lead.lead_generated_by;
      const assigneeId = lead.assigned_to;
      const teamLeadId = lead.team_lead_id;
      const generatorRole = generatorId ? userRolesMap?.[generatorId] : null;
      const assigneeRole = assigneeId ? userRolesMap?.[assigneeId] : null;
      const teamLeadRole = teamLeadId ? userRolesMap?.[teamLeadId] : null;
      
      const isSalesOrBdRole = (r: string | null) => 
        r && ['SALES_TL', 'SALES_TM', 'LEAD_TL', 'LEAD_GEN'].includes(r);
        
      if (isSalesOrBdRole(generatorRole) || isSalesOrBdRole(assigneeRole) || isSalesOrBdRole(teamLeadRole)) {
        return true;
      }
      if (!generatorId && !assigneeId && !teamLeadId) return true;
      return false;
    }
    
    // 3. SALES_TL can edit leads assigned to themselves OR their team members (reports_to = user.id)
    if (role === 'SALES_TL') {
      const assigneeId = lead.assigned_to;
      if (!assigneeId) return false;
      if (assigneeId === user.id) return true;
      
      const assigneeProfile = allProfilesList?.find(p => p.user_id === assigneeId);
      if (assigneeProfile?.reports_to === user.id) return true;
      
      return false;
    }
    
    // 4. BD_TL (role is LEAD_TL) can edit leads generated by themselves OR their team members (reports_to = user.id)
    if (role === 'LEAD_TL') {
      const generatorId = lead.lead_generated_by;
      if (!generatorId) return false;
      if (generatorId === user.id) return true;
      
      const generatorProfile = allProfilesList?.find(p => p.user_id === generatorId);
      if (generatorProfile?.reports_to === user.id) return true;
      
      return false;
    }
    
    return false;
  };


  return (
    <div className="space-y-4">
      {/* ── Header + Filters ───────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-display font-bold">Leads</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Name search */}
          <DebouncedSearchInput
            placeholder="Search name, id, email, phone..."
            value={search}
            onChange={setSearch}
            className="w-52"
          />

          {/* Status filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <Filter className="h-4 w-4 mr-1" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {allStatuses.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Month filter (Jan–Dec only, no year) */}
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {MONTH_NAMES.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date range */}
          <div className="flex items-center gap-1.5 bg-background px-2.5 rounded-md border border-input h-10 shrink-0">
            <span className="text-xs text-muted-foreground font-medium pr-1 select-none">Date:</span>
            <Input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-[130px] h-8 text-xs border-0 bg-transparent pl-1.5 pr-3 focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-accent/40 rounded-sm"
              title="From date"
            />
            <span className="text-muted-foreground text-xs px-0.5 select-none">—</span>
            <Input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-[130px] h-8 text-xs border-0 bg-transparent pl-1.5 pr-3 focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-accent/40 rounded-sm"
              title="To date"
            />
          </div>

          {/* Team member filter (TL + Admin only) */}
          {showMemberFilter && teamMembers && teamMembers.length > 0 && (
            <Select value={memberFilter} onValueChange={setMemberFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Members" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Members</SelectItem>
                {teamMembers.map(m => (
                  <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* BD member filter (TL + Admin only) */}
          {showMemberFilter && bdMembers && bdMembers.length > 0 && (
            <Select value={bdMemberFilter} onValueChange={setBdMemberFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All BD members" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All BD members</SelectItem>
                {bdMembers.map(m => (
                  <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* ── Leads Table ───────────────────────────────────────── */}
      <Card className="glass-card">
        <CardContent className="p-0">
          {(!leadsData && isLoading) ? (
            <div className="p-8 text-center text-muted-foreground">Loading leads...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No leads found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 font-medium text-muted-foreground">ID</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Email</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Phone</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">LinkedIn</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">University</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Technology</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Source</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Category</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Next Follow-up</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Visa Status</th>
                    {canSeeGeneratedBy && <th className="text-left p-3 font-medium text-muted-foreground">Generated By</th>}
                    {(role === 'LEAD_TL' || role === 'ADMIN' || role === 'SALES_TL' || role === 'SALES_TM' || role === 'LEAD_GEN') && <th className="text-left p-3 font-medium text-muted-foreground">Assigned To</th>}
                    {role === 'ADMIN' && <th className="text-left p-3 font-medium text-muted-foreground">Last Activity</th>}
                    {(role === 'ADMIN' || role === 'SALES_TL' || role === 'SALES_TM') && <th className="text-left p-3 font-medium text-muted-foreground">Payment</th>}
                    <th className="text-left p-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((lead, i) => {
                    const generatedByProfile = lead.lead_generated_by && profilesMap?.[lead.lead_generated_by];
                    const isBdLead = lead.lead_generated_by && bdUserIds?.has(lead.lead_generated_by);
                    const currentStatus = lead.lead_status || 'New';
                    const nextStatuses = getNextStatuses(currentStatus, role);
                    const isTerminal = nextStatuses.length === 0 && role !== 'ADMIN';
                    const hrsSinceUpdate = (Date.now() - new Date(lead.updated_at).getTime()) / 3600000;
                    const isStale = hrsSinceUpdate > 24 && !['Closed', 'Non Interested'].includes(currentStatus);

                    return (
                      <motion.tr
                        key={lead.unique_id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className="border-b border-border/50 hover:bg-accent/30 transition-colors"
                        style={lead.highlight_color ? { backgroundColor: lead.highlight_color + '20' } : {}}
                      >
                        <td className="p-3 text-xs font-mono text-muted-foreground">{(lead as any).display_id || '—'}</td>
                        <td className="p-3 text-xs text-muted-foreground">{formatDate(lead.created_at)}</td>
                        <td className="p-3 font-medium">{lead.name}</td>
                        <td className="p-3 text-muted-foreground">{lead.email}</td>
                        <td className="p-3 text-muted-foreground">{lead.phone}</td>
                        <td className="p-3">
                          {lead.linkedin_url ? (
                            <a
                              href={lead.linkedin_url.trim().startsWith('http') || lead.linkedin_url.trim().startsWith('//') ? lead.linkedin_url.trim() : `https://${lead.linkedin_url.trim()}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline font-medium text-xs"
                            >
                              View
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground">{lead.university || '—'}</td>
                        <td className="p-3 text-muted-foreground">{lead.technology || '—'}</td>
                        <td className="p-3 text-muted-foreground">{lead.lead_source || '—'}</td>
                        <td className="p-3">
                          <Badge variant="secondary" className={lead.lead_category === 'Hot' ? 'bg-amber-500/10 text-amber-600' : ''}>
                            {lead.lead_category}
                          </Badge>
                        </td>

                        {/* ── Status cell: flow-enforced dropdown or static badge ── */}
                        <td className="p-3">
                          <span className={`text-xs px-2 py-1 rounded-full ${statusColors[currentStatus] || ''} inline-flex items-center gap-1.5`}>
                            {currentStatus}
                            {lead.lead_status === 'Stagnant' && lead.assigned_to && (
                              <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-red-500/20 text-[9px] px-1 py-0 font-bold uppercase shrink-0">
                                Stagnant
                              </Badge>
                            )}
                          </span>
                        </td>

                        {/* ── Next Follow-up ── */}
                        <td className="p-3 text-xs font-medium whitespace-nowrap">
                          {lead.next_followup_date ? (
                            <span className={lead.next_followup_date < getISTDateString(new Date()) ? 'text-red-500 font-semibold' : lead.next_followup_date === getISTDateString(new Date()) ? 'text-amber-600 font-semibold' : 'text-muted-foreground'}>
                              {formatDate(lead.next_followup_date)}
                            </span>
                          ) : '—'}
                        </td>

                        {/* ── Visa Status ── */}
                        <td className="p-3 text-xs text-muted-foreground">
                          {lead.visa_status || '—'}
                        </td>

                        {/* ── Generated By ── */}
                        {canSeeGeneratedBy && (
                          <td className="p-3">
                            {generatedByProfile ? (
                              <div>
                                <p className="text-xs font-medium">{generatedByProfile.full_name}</p>
                                <p className="text-xs text-muted-foreground">{generatedByProfile.email}</p>
                              </div>
                            ) : (lead as any).generated_by_name ? (
                              <div>
                                <p className="text-xs font-medium">{(lead as any).generated_by_name}</p>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        )}

                        {/* ── Assigned To ── */}
                        {(role === 'LEAD_TL' || role === 'ADMIN' || role === 'SALES_TL' || role === 'SALES_TM' || role === 'LEAD_GEN') && (
                          <td className="p-3">
                            {lead.assigned_to && profilesMap?.[lead.assigned_to] ? (
                              <div>
                                <p className="text-xs font-medium text-primary">
                                  {profilesMap[lead.assigned_to].full_name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {profilesMap[lead.assigned_to].email}
                                </p>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Unassigned</span>
                            )}
                          </td>
                        )}

                        {/* ── Last Activity ── */}
                        {role === 'ADMIN' && (
                          <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(lead.updated_at).toLocaleDateString()}
                          </td>
                        )}

                         {/* ── Payment ── */}
                        {(role === 'ADMIN' || role === 'SALES_TL' || role === 'SALES_TM') && (
                          <td className="p-3 text-xs">
                            {(() => {
                              const closure = closureData?.find(c => c.lead_id === lead.unique_id);
                              if (!closure) return <span className="text-muted-foreground">—</span>;
                              
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
                                <span className="text-green-500 font-medium font-mono">
                                  ${amountReceived.toLocaleString()}
                                </span>
                              );
                            })()}
                          </td>
                        )}

                        {/* ── Actions ── */}
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            {/* View detail */}
                            <Button size="sm" variant="ghost" onClick={() => setSelectedLead(lead)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>

                            {/* Call → popup */}
                            {canCall && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setCallLead(lead)}
                                className="text-primary"
                                title="Log Call"
                              >
                                <Phone className="h-3.5 w-3.5" />
                              </Button>
                            )}

                            {/* Edit Lead */}
                            {canEditLead(lead) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditLead(lead)}
                                className="text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                                title="Edit Lead"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}

                            {/* Quick Assign / Reassign Dropdown (for Admin, LEAD_TL, and SALES_TL) */}
                            {(role === 'ADMIN' || role === 'LEAD_TL' || role === 'SALES_TL') && (
                              <div className="relative reassign-dropdown-container">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={reassignLead.isPending}
                                  onClick={() => setReassigningLeadId(reassigningLeadId === lead.unique_id ? null : lead.unique_id)}
                                  className="text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                                  title={role === 'SALES_TL' ? "Assign to Sales Member" : "Reassign Lead"}
                                >
                                  {role === 'SALES_TL' ? (
                                    <UserPlus className={`h-3.5 w-3.5 ${reassignLead.isPending && reassigningLeadId === lead.unique_id ? 'animate-spin' : ''}`} />
                                  ) : (
                                    <RefreshCw className={`h-3.5 w-3.5 ${reassignLead.isPending && reassigningLeadId === lead.unique_id ? 'animate-spin' : ''}`} />
                                  )}
                                </Button>
                                {reassigningLeadId === lead.unique_id && (
                                  <ReassignDropdownMenu
                                    candidates={reassignCandidates}
                                    onSelect={(selection) => {
                                      reassignLead.mutate({ leadId: lead.unique_id, selection });
                                      setReassigningLeadId(null);
                                    }}
                                    onClose={() => setReassigningLeadId(null)}
                                  />
                                )}
                              </div>
                            )}

                            {/* Unassign Lead (only for Admin and LEAD_TL) */}
                            {(role === 'ADMIN' || role === 'LEAD_TL') && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={!lead.assigned_to || unassignLead.isPending}
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to unassign "${lead.name}"?`)) {
                                    unassignLead.mutate({ leadId: lead.unique_id });
                                  }
                                }}
                                className="text-red-500 hover:text-red-600 hover:bg-red-500/10 disabled:opacity-30"
                                title="Unassign Lead"
                              >
                                <UserMinus className="h-3.5 w-3.5" />
                              </Button>
                            )}


                            {/* Agreement Button for Closed Leads */}
                            {currentStatus === 'Closed' && (role === 'PROCESS_ANALYST') && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setAgreementLead(lead)}
                                className="text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                                title="Agreement Workflow"
                              >
                                <FileSignature className="h-3.5 w-3.5" />
                              </Button>
                            )}

                            {/* Edit Closure Details Button */}
                            {currentStatus === 'Closed' && (role === 'ADMIN' || role === 'SALES_TL' || role === 'SALES_TM' || role === 'PROCESS_ANALYST') && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setClosureLead(lead)}
                                className="text-green-600 hover:text-green-700 hover:bg-green-500/10"
                                title="Edit Closure details"
                              >
                                <DollarSign className="h-3.5 w-3.5" />
                              </Button>
                            )}

                            {/* Add Document Button */}
                            {canSendToAccountant && role !== 'ADMIN' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setAccountantLead(lead)}
                                className="text-purple-500 hover:text-purple-600 hover:bg-purple-500/10"
                                title="Add Document"
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </Button>
                            )}

                            {/* Raise Concern */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setConcernLead(lead); setConcernText(''); setConcernRecipient(''); }}
                              className="text-orange-500 hover:text-orange-600 hover:bg-orange-500/10"
                              title="Raise a Concern"
                            >
                              <AlertTriangle className="h-3.5 w-3.5" />
                            </Button>

                            {/* Highlight color picker */}
                            {canHighlight && (
                              <div className="relative">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setHighlightLead(
                                    highlightLead === lead.unique_id ? null : lead.unique_id
                                  )}
                                  className="text-muted-foreground"
                                >
                                  <Palette className="h-3.5 w-3.5" />
                                </Button>
                                {highlightLead === lead.unique_id && (
                                  <div className="absolute right-0 top-8 z-50 bg-card border border-border rounded-lg p-2 shadow-lg flex gap-1.5">
                                    {HIGHLIGHT_COLORS.map(c => (
                                      <button
                                        key={c.value}
                                        title={c.label}
                                        onClick={() => updateHighlight.mutate({ leadId: lead.unique_id, color: c.value })}
                                        className="h-5 w-5 rounded-full border-2 border-border hover:scale-110 transition-transform"
                                        style={{ backgroundColor: c.value || 'transparent' }}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Delete Lead — Admin only (next to paint symbol) */}
                            {role === 'ADMIN' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDeleteConfirmLead(lead)}
                                className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                title="Delete Lead"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {filtered.length > 0 && (
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

      {/* ── Dialogs ──────────────────────────────────────────────── */}
      {selectedLead && (
        <LeadDetailDialog lead={selectedLead} open={!!selectedLead} onClose={() => setSelectedLead(null)} />
      )}
      {closureLead && (
        <ClosureDialog
          lead={closureLead}
          open={!!closureLead}
          onClose={() => { setClosureLead(null); queryClient.invalidateQueries({ queryKey: ['leads'] }); }}
        />
      )}
      {callLead && (
        <CallActivityDialog
          lead={callLead}
          open={!!callLead}
          onClose={() => setCallLead(null)}
        />
      )}
      {agreementLead && (
        <AgreementDialog
          lead={agreementLead}
          open={!!agreementLead}
          onClose={() => setAgreementLead(null)}
        />
      )}
      {accountantLead && (
        <AccountantCommentDialog
          lead={accountantLead}
          open={!!accountantLead}
          onClose={() => setAccountantLead(null)}
        />
      )}
      {editLead && (
        <EditLeadDialog
          lead={editLead}
          open={!!editLead}
          onClose={() => setEditLead(null)}
          queryKeys={[['leads'], ['leads-with-comments']]}
        />
      )}

      {/* ── Delete Lead Confirmation Dialog (Admin only) ── */}
      <Dialog
        open={!!deleteConfirmLead}
        onOpenChange={open => { if (!open && !isDeleting) setDeleteConfirmLead(null); }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Lead
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-2">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to permanently delete the lead for
            </p>
            <p className="font-semibold text-foreground">{deleteConfirmLead?.name}</p>
            <p className="text-xs text-destructive/80 bg-destructive/10 rounded-md px-3 py-2">
              ⚠️ This action cannot be undone. All associated data will be deleted.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmLead(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={async () => {
                if (!deleteConfirmLead || !user?.id) return;
                setIsDeleting(true);
                try {
                  // ── Fetch profiles + roles to build notification targets ──
                  const { data: allProfiles } = await supabase
                    .from('profiles')
                    .select('user_id, reports_to, full_name');
                  const { data: allUserRoles } = await supabase
                    .from('user_roles')
                    .select('user_id, role');

                  // ── Delete the lead ──
                  const { error: delErr } = await supabase
                    .from('leads')
                    .delete()
                    .eq('unique_id', deleteConfirmLead.unique_id);
                  if (delErr) throw delErr;

                  // ── Build notification recipients ──
                  if (allProfiles && allUserRoles) {
                    const profilesMap = new Map(allProfiles.map(p => [p.user_id, p]));
                    const rolesMap = new Map(allUserRoles.map(r => [r.user_id, r.role]));

                    const salesPersonId: string | null = deleteConfirmLead.assigned_to || null;

                    let salesTLId: string | null = deleteConfirmLead.team_lead_id || null;
                    if (!salesTLId && salesPersonId) {
                      salesTLId = profilesMap.get(salesPersonId)?.reports_to || null;
                    }

                    const bdMemberId: string | null = deleteConfirmLead.lead_generated_by || null;
                    let bdTLId: string | null = null;
                    if (bdMemberId) {
                      const genRole = rolesMap.get(bdMemberId);
                      bdTLId = genRole === 'LEAD_TL'
                        ? bdMemberId
                        : profilesMap.get(bdMemberId)?.reports_to || null;
                    }

                    const processAnalystIds = allUserRoles
                      .filter(r => r.role === 'PROCESS_ANALYST')
                      .map(r => r.user_id);

                    const recipients = new Set<string>();
                    processAnalystIds.forEach(id => recipients.add(id));
                    if (salesPersonId) recipients.add(salesPersonId);
                    if (salesTLId) recipients.add(salesTLId);
                    if (bdTLId) recipients.add(bdTLId);
                    recipients.delete(user.id); // don't notify the deleting admin

                    if (recipients.size > 0) {
                      const adminName = profilesMap.get(user.id)?.full_name || 'Admin';
                      const notifRows = Array.from(recipients).map(uid => ({
                        user_id: uid,
                        title: '🗑️ Lead Deleted',
                        message: `Lead "${deleteConfirmLead.name}" (${deleteConfirmLead.email}) has been permanently deleted by ${adminName}.`,
                        type: 'lead_deleted',
                        lead_id: null,
                      }));
                      await supabase.from('notifications').insert(notifRows);
                    }
                  }

                  toast.success(`Lead "${deleteConfirmLead.name}" deleted successfully`);
                  queryClient.invalidateQueries({ queryKey: ['leads'] });
                  setDeleteConfirmLead(null);
                } catch (err: any) {
                  console.error('Delete lead error:', err);
                  toast.error(err.message || 'Failed to delete lead');
                } finally {
                  setIsDeleting(false);
                }
              }}
            >
              {isDeleting ? 'Deleting…' : 'Yes, Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <Label htmlFor="status-comment">
                Comment <span className="text-destructive">*</span>
                <span className="text-xs text-muted-foreground ml-1">(required — visible to Sales TL, Process Analyst, Admin, BD TL)</span>
              </Label>
              <Textarea
                id="status-comment"
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
                  <Label htmlFor="doc-comment" className="text-xs">
                    <FileTextIcon className="h-3.5 w-3.5 inline mr-1 text-primary" />
                    Document Remarks <span className="text-destructive">*</span>
                    <span className="text-xs text-muted-foreground ml-1">(sent to Accountant Dashboard)</span>
                  </Label>
                  <Textarea
                    id="doc-comment"
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
              disabled={!statusComment.trim() || (sendDocument && !docComment.trim()) || updateStatus.isPending}
              onClick={() => {
                if (!pendingStatusChange || !statusComment.trim()) return;
                if (sendDocument && !docComment.trim()) return;
                updateStatus.mutate({
                  leadId: pendingStatusChange.lead.unique_id,
                  status: pendingStatusChange.status,
                  comment: statusComment.trim(),
                  withDocument: sendDocument,
                  documentComment: docComment.trim(),
                });
              }}
            >
              {updateStatus.isPending ? 'Updating...' : 'Confirm Status Change'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Raise Concern Dialog ── */}
      <Dialog open={!!concernLead} onOpenChange={open => { if (!open) { setConcernLead(null); setConcernText(''); setConcernRecipient(''); }}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-500">
              <AlertTriangle className="h-5 w-5" />
              Raise Concern — {concernLead?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="concern-recipient">Whom to send concern</Label>
              <Select value={concernRecipient} onValueChange={setConcernRecipient}>
                <SelectTrigger id="concern-recipient" className="w-full">
                  <SelectValue placeholder="Select recipient..." />
                </SelectTrigger>
                <SelectContent>
                  {concernRecipients.map((r) => (
                    <SelectItem key={r.user_id} value={r.user_id}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="concern-comment">Comment</Label>
              <Textarea
                id="concern-comment"
                value={concernText}
                onChange={e => setConcernText(e.target.value)}
                placeholder="Write your concern details here..."
                rows={4}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConcernLead(null); setConcernText(''); setConcernRecipient(''); }}>
              Cancel
            </Button>
            <Button
              disabled={!concernRecipient || !concernText.trim() || raiseConcern.isPending}
              onClick={() => {
                if (!concernLead) return;
                raiseConcern.mutate({
                  leadId: concernLead.unique_id,
                  recipientId: concernRecipient,
                  comment: concernText,
                });
              }}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {raiseConcern.isPending ? 'Sending...' : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
};

export default LeadsPage;

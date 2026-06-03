import React, { useState, useEffect } from 'react';
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
import { Phone, Eye, Filter, Palette, AlertTriangle, MessageSquare, FileText as FileTextIcon, Send } from 'lucide-react';
import LeadDetailDialog from '@/components/LeadDetailDialog';
import ClosureDialog from '@/components/ClosureDialog';
import CallActivityDialog from '@/components/CallActivityDialog';
import AgreementDialog from '@/components/AgreementDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Shuffle, FileSignature, FileText } from 'lucide-react';
import AccountantCommentDialog from '@/components/AccountantCommentDialog';

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
};

const allStatuses = ['New', 'DNR1', 'DNR2', 'DNR3', 'Connected', 'Qualified', 'Hot Prospect', 'Closed', 'Non Interested'];

// ── Ordered status flow (Sales role only) ───────────────────────────────────
const STATUS_FLOW: Record<string, string[]> = {
  'New':          ['DNR1', 'DNR2', 'DNR3', 'Connected', 'Qualified', 'Hot Prospect', 'Closed', 'Non Interested'],
  'DNR1':         ['DNR2', 'DNR3', 'Connected', 'Qualified', 'Hot Prospect', 'Closed', 'Non Interested'],
  'DNR2':         ['DNR3', 'Connected', 'Qualified', 'Hot Prospect', 'Closed', 'Non Interested'],
  'DNR3':         ['Connected', 'Qualified', 'Hot Prospect', 'Closed', 'Non Interested'],
  'Connected':    ['Qualified', 'Hot Prospect', 'Closed', 'Non Interested'],
  'Qualified':    ['Hot Prospect', 'Closed', 'Non Interested'],
  'Hot Prospect': ['Closed', 'Non Interested'],
  'Closed':       [],
  'Non Interested': [],
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

const LeadsPage: React.FC = () => {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();

  // ── Filter state ──────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all'); // 'all' | '1'..'12'
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [memberFilter, setMemberFilter] = useState('all');

  // ── Dialog state ─────────────────────────────────────────────
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [closureLead, setClosureLead] = useState<any>(null);
  const [callLead, setCallLead] = useState<any>(null);
  const [agreementLead, setAgreementLead] = useState<any>(null);
  const [highlightLead, setHighlightLead] = useState<string | null>(null);
  const [accountantLead, setAccountantLead] = useState<any>(null);

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

  // ── Fetch leads (role-scoped) ────────────────────────────────
  const { data: leads, isLoading } = useQuery({
    queryKey: ['leads', user?.id, role],
    queryFn: async () => {
      let query = supabase.from('leads').select('*').order('created_at', { ascending: false });
      if (role === 'LEAD_GEN') {
        query = query.eq('lead_generated_by', user!.id);
      } else if (role === 'SALES_TM') {
        query = query.eq('assigned_to', user!.id);
      } else if (role === 'SALES_TL') {
        query = query.or(`team_lead_id.eq.${user!.id},assigned_to.eq.${user!.id}`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

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
  });

  // ── BD user IDs (to show "Generated By" column) ──────────────
  const { data: bdUserIds } = useQuery({
    queryKey: ['bd-user-ids'],
    queryFn: async () => {
      const { data } = await supabase.from('user_roles').select('user_id').in('role', ['LEAD_GEN', 'LEAD_TL']);
      return new Set(data?.map(r => r.user_id) || []);
    },
    enabled: !!user,
  });

  // ── Team members list (for TL/Admin member filter) ───────────
  const { data: teamMembers } = useQuery({
    queryKey: ['team-members-list', user?.id, role],
    queryFn: async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('role', ['SALES_TM', 'SALES_TL']);
      if (!roles) return [];
      
      const tlIds = roles.filter(r => r.role === 'SALES_TL').map(r => r.user_id);
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

  // ── Client-side filtering ─────────────────────────────────────
  const filtered = leads?.filter(l => {
    const matchesSearch = !search
      || l.name?.toLowerCase().includes(search.toLowerCase())
      || l.email?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || l.lead_status === statusFilter;

    const matchesMonth = monthFilter === 'all'
      || new Date(l.created_at).getMonth() + 1 === parseInt(monthFilter);

    const createdAt = new Date(l.created_at);
    const matchesDateFrom = !dateFrom || createdAt >= new Date(dateFrom);
    const matchesDateTo = !dateTo || createdAt <= new Date(dateTo + 'T23:59:59');

    const matchesMember = memberFilter === 'all'
      || l.assigned_to === memberFilter
      || l.lead_generated_by === memberFilter;

    return matchesSearch && matchesStatus && matchesMonth && matchesDateFrom && matchesDateTo && matchesMember;
  }) || [];

  // ── Permission flags ──────────────────────────────────────────
  const canCall = role === 'SALES_TM' || role === 'SALES_TL' || role === 'ADMIN';
  const canUpdateStatus = role === 'SALES_TM' || role === 'SALES_TL' || role === 'ADMIN';
  const canHighlight = role === 'SALES_TM' || role === 'SALES_TL' || role === 'ADMIN';
  const canSeeGeneratedBy = role === 'SALES_TM' || role === 'SALES_TL' || role === 'LEAD_TL' || role === 'PROCESS_ANALYST' || role === 'ADMIN';
  const showMemberFilter = role === 'ADMIN' || role === 'SALES_TL' || role === 'LEAD_TL';
  const canSendToAccountant = role === 'ADMIN';

  return (
    <div className="space-y-4">
      {/* ── Header + Filters ───────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-display font-bold">Leads</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Name search */}
          <Input
            placeholder="Search name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
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
              className="w-[120px] h-8 text-xs border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-accent/40 rounded-sm px-1.5"
              title="From date"
            />
            <span className="text-muted-foreground text-xs px-0.5 select-none">—</span>
            <Input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-[120px] h-8 text-xs border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-accent/40 rounded-sm px-1.5"
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
        </div>
      </div>

      {/* ── Leads Table ───────────────────────────────────────── */}
      <Card className="glass-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading leads...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No leads found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 font-medium text-muted-foreground">ID</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Email</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Phone</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">University</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Technology</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Source</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Category</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                    {canSeeGeneratedBy && <th className="text-left p-3 font-medium text-muted-foreground">Generated By</th>}
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
                        <td className="p-3 font-medium">{lead.name}</td>
                        <td className="p-3 text-muted-foreground">{lead.email}</td>
                        <td className="p-3 text-muted-foreground">{lead.phone}</td>
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
                          {role === 'ADMIN' && !isTerminal ? (
                            <div className="flex items-center gap-1.5">
                              <Select
                                value={currentStatus}
                                onValueChange={v => handleStatusChangeRequest(lead, v)}
                              >
                                <SelectTrigger className="h-7 w-36 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {/* Current status always selectable (no-op) */}
                                  <SelectItem value={currentStatus}>{currentStatus}</SelectItem>
                                  {nextStatuses.filter(s => s !== currentStatus).map(s => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {isStale && lead.assigned_to && (
                                <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-red-500/20 text-[9px] px-1 py-0 font-bold uppercase shrink-0">
                                  Stagnant
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className={`text-xs px-2 py-1 rounded-full ${statusColors[currentStatus] || ''} inline-flex items-center gap-1.5`}>
                              {currentStatus}
                              {isStale && lead.assigned_to && (
                                <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-red-500/20 text-[9px] px-1 py-0 font-bold uppercase shrink-0">
                                  Stagnant
                                </Badge>
                              )}
                            </span>
                          )}
                        </td>

                        {/* ── Generated By ── */}
                        {canSeeGeneratedBy && (
                          <td className="p-3">
                            {isBdLead && generatedByProfile ? (
                              <div>
                                <p className="text-xs font-medium">{generatedByProfile.full_name}</p>
                                <p className="text-xs text-muted-foreground">{generatedByProfile.email}</p>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
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

                            {/* Agreement Button for Closed Leads */}
                            {currentStatus === 'Closed' && (role === 'ADMIN' || role === 'PROCESS_ANALYST') && (
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

                            {/* Add Document Button */}
                            {canSendToAccountant && (
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
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
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

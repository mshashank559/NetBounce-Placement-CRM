import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  FileText, DollarSign, Calendar, Filter, Send, 
  TrendingUp, AlertCircle, CheckCircle2, Clock, 
  ArrowUpRight, Users, Activity, FileSignature, MessageSquare, History,
  Eye
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLocation } from 'react-router-dom';
import LeadDetailDialog from './LeadDetailDialog';
import AgreementDialog from './AgreementDialog';
import { fetchAllLeads } from '@/lib/leads';
import { 
  AreaChart, Area, PieChart, Pie, Cell, 
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

// ── Lead Type age calculation helper ──────────────────────────────────
const getLeadType = (createdAtStr: string) => {
  const days = (Date.now() - new Date(createdAtStr).getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 3) return 'New';
  if (days <= 15) return 'Existing';
  return 'Old';
};

// ── Safe Notes Parsing helper ──────────────────────────────────────────
const safeParseNotes = (notes: any) => {
  if (!notes) return { status: 'Sent', sla: 'Pending', comment: '', date: '', docRefId: '' };
  if (typeof notes === 'object') {
    return {
      status: notes.status || 'Sent',
      sla: notes.sla || 'Pending',
      comment: notes.comment || notes.remarks || '',
      date: notes.date || '',
      docRefId: notes.docRefId || ''
    };
  }
  try {
    const parsed = JSON.parse(notes);
    return {
      status: parsed.status || 'Sent',
      sla: parsed.sla || 'Pending',
      comment: parsed.comment || parsed.remarks || '',
      date: parsed.date || '',
      docRefId: parsed.docRefId || ''
    };
  } catch (e) {
    return { status: 'Sent', sla: 'Pending', comment: notes, date: '', docRefId: '' };
  }
};

// ── Last Activity timestamp helper ──────────────────────────────────────────────
const getLastActivity = (lead: any, performas: any[]) => {
  let latest = new Date(lead.updated_at).getTime();
  if (performas && performas.length > 0) {
    const perfTime = new Date(performas[0].created_at).getTime();
    if (perfTime > latest) latest = perfTime;
  }
  return latest;
};

// â”€â”€ Comment categories helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const COMMENT_CATEGORIES = [
  'Candidate Details',
  'Plan Details',
  'Salesperson Comments',
  'Accounting Comments',
  'Internal Notes'
];

export default function AccountantDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.pathname === '/leads-view' ? 'leads' : 'ledger');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  React.useEffect(() => {
    setActiveTab(location.pathname === '/leads-view' ? 'leads' : 'ledger');
  }, [location.pathname]);
  
  // Dialog states
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [isPerformaOpen, setIsPerformaOpen] = useState(false);

  // Leads View filtering states
  const [leadsSearch, setLeadsSearch] = useState('');
  const [leadsTypeFilter, setLeadsTypeFilter] = useState('all');
  const [leadsStatusFilter, setLeadsStatusFilter] = useState('all');
  const [leadStatusFilter, setLeadStatusFilter] = useState('all');
  const [leadsPage, setLeadsPage] = useState(1);

  // Manual Status / SLA state
  const [statusUpdateLead, setStatusUpdateLead] = useState<any>(null);
  const [targetStatus, setTargetStatus] = useState<string>('Sent');
  const [statusComment, setStatusComment] = useState<string>('');
  const [statusDate, setStatusDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [statusSLA, setStatusSLA] = useState<string>('Pending');

  // Leads view detail dialog state
  const [detailsLead, setDetailsLead] = useState<any>(null);

  // Document history dialog state
  const [historyLead, setHistoryLead] = useState<any>(null);

  // Agreement Workflow state
  const [agreementLead, setAgreementLead] = useState<any>(null);

  // Fetch closed leads with payment data
  const { data: closures, isLoading } = useQuery({
    queryKey: ['account-closures'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          lead_closures (*),
          payment_ledgers (*)
        `)
        .eq('lead_status', 'Closed');

      if (error) throw error;
      return data || [];
    }
  });

  // Fetch all leads for Leads View (Global Leads)
  const { data: allLeads, isLoading: isAllLeadsLoading, refetch: refetchAllLeads } = useQuery({
    queryKey: ['all-leads-accountant'],
    queryFn: async () => {
      return fetchAllLeads();
    }
  });

  // Fetch all performas
  const { data: allPerformas, refetch: refetchPerformas } = useQuery({
    queryKey: ['all-performas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('performas')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch profiles map
  const { data: profilesMap } = useQuery({
    queryKey: ['profiles-map-accountant'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name, email');
      const map: Record<string, { full_name: string; email: string }> = {};
      data?.forEach(p => { map[p.user_id] = { full_name: p.full_name, email: p.email }; });
      return map;
    }
  });

  // Map performas by lead ID
  const performasByLead = React.useMemo(() => {
    const map: Record<string, any[]> = {};
    allPerformas?.forEach(p => {
      if (!map[p.lead_id]) map[p.lead_id] = [];
      map[p.lead_id].push(p);
    });
    return map;
  }, [allPerformas]);

  // Filter closures by date range for Enrolled Candidate Ledger
  const filteredClosures = closures?.filter(c => {
    const closureDateStr = new Date(c.lead_closures?.[0]?.created_at || c.created_at).toISOString().split('T')[0];
    if (startDateFilter && closureDateStr < startDateFilter) return false;
    if (endDateFilter && closureDateStr > endDateFilter) return false;
    return true;
  }) || [];

  // Filter and sort Leads for Leads View
  const filteredLeads = React.useMemo(() => {
    if (!allLeads) return [];
    return allLeads
      .filter(lead => {
        if (leadsSearch.trim()) {
          const s = leadsSearch.toLowerCase();
          const nameMatch = lead.name?.toLowerCase().includes(s);
          const emailMatch = lead.email?.toLowerCase().includes(s);
          const phoneMatch = lead.phone?.toLowerCase().includes(s);
          const idMatch = lead.display_id?.toLowerCase().includes(s) || lead.unique_id?.toLowerCase().includes(s);
          if (!nameMatch && !emailMatch && !phoneMatch && !idMatch) return false;
        }

        if (leadsTypeFilter !== 'all') {
          const type = getLeadType(lead.created_at);
          if (type !== leadsTypeFilter) return false;
        }

        if (leadsStatusFilter !== 'all') {
          const perf = performasByLead[lead.unique_id]?.[0];
          let status = 'Not Sent';
          if (perf) {
            status = safeParseNotes(perf.notes).status;
          }
          if (status !== leadsStatusFilter) return false;
        }

        if (leadStatusFilter !== 'all' && (lead.lead_status || 'New') !== leadStatusFilter) return false;

        // Date range filter
        const leadDateStr = new Date(lead.created_at).toISOString().split('T')[0];
        if (startDateFilter && leadDateStr < startDateFilter) return false;
        if (endDateFilter && leadDateStr > endDateFilter) return false;

        return true;
      })
      .sort((a, b) => {
        const timeA = getLastActivity(a, performasByLead[a.unique_id] || []);
        const timeB = getLastActivity(b, performasByLead[b.unique_id] || []);
        return timeB - timeA;
      });
  }, [allLeads, leadsSearch, leadsTypeFilter, leadsStatusFilter, leadStatusFilter, performasByLead]);

  // Paginated leads for Leads View
  const paginatedLeads = React.useMemo(() => {
    const startIndex = (leadsPage - 1) * 50;
    return filteredLeads.slice(startIndex, startIndex + 50);
  }, [filteredLeads, leadsPage]);

  const totalLeadsPages = Math.max(1, Math.ceil(filteredLeads.length / 50));

  // Reset page when search or filters change
  React.useEffect(() => {
    setLeadsPage(1);
  }, [leadsSearch, leadsTypeFilter, leadsStatusFilter, leadStatusFilter]);

  // KPI Calculations
  const activeEnrollments = closures?.length || 0;
  
  const pendingDocumentsCount = React.useMemo(() => {
    if (!allPerformas) return 0;
    return allPerformas.filter(p => {
      const notesObj = safeParseNotes(p.notes);
      return notesObj.status !== 'Signed';
    }).length;
  }, [allPerformas]);

  const activeSLACount = React.useMemo(() => {
    if (!allPerformas) return 0;
    return allPerformas.filter(p => {
      const notesObj = safeParseNotes(p.notes);
      return ['Active', 'Overdue', 'Critical'].includes(notesObj.sla);
    }).length;
  }, [allPerformas]);

  // Chart data calculations
  const collectionTrendData = React.useMemo(() => {
    if (!closures) return [];
    const days = Array.from({ length: 15 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (14 - i));
      const dStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const totalPaidUpToDay = closures.reduce((sum, lead) => {
        const ledger = lead.payment_ledgers?.[0];
        if (!ledger) return sum;
        const ledgerDate = new Date(ledger.created_at);
        if (ledgerDate <= d) {
          return sum + (ledger.total_paid || 0);
        }
        return sum;
      }, 0);
      return { name: dStr, amount: totalPaidUpToDay };
    });
    return days;
  }, [closures]);

  const revenueVsOutstandingData = React.useMemo(() => {
    if (!closures) return [];
    let totalCollected = 0;
    let totalOutstanding = 0;
    closures.forEach(lead => {
      const ledger = lead.payment_ledgers?.[0];
      if (ledger) {
        totalCollected += (ledger.total_paid || 0);
        totalOutstanding += (ledger.total_due || 0);
      }
    });
    return [
      { name: 'Collected', value: totalCollected, color: '#3b82f6' },
      { name: 'Outstanding', value: totalOutstanding, color: '#ef4444' }
    ];
  }, [closures]);

  // Mutation to handle manual status change
  const updateStatusMutation = useMutation({
    mutationFn: async () => {
      if (!statusComment.trim()) throw new Error('Comment is mandatory');

      const latestPerf = performasByLead[statusUpdateLead.unique_id]?.[0];
      const previousStatus = latestPerf ? safeParseNotes(latestPerf.notes).status : 'Not Sent';

      const updatedNotes = JSON.stringify({
        status: targetStatus,
        sla: statusSLA,
        comment: statusComment,
        date: statusDate,
        docRefId: latestPerf?.document_url || 'EDOC-' + Math.random().toString(36).substr(2, 9).toUpperCase()
      });

      if (latestPerf) {
        const { error } = await supabase
          .from('performas')
          .update({ notes: updatedNotes })
          .eq('id', latestPerf.id);
        if (error) throw error;
      } else {
        const docRef = 'EDOC-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        const { error } = await supabase
          .from('performas')
          .insert({
            lead_id: statusUpdateLead.unique_id,
            sent_by: user!.id,
            type: 'Pre-Performa',
            document_url: docRef,
            notes: updatedNotes
          });
        if (error) throw error;
      }

      // Add audit log
      const { error: logError } = await supabase
        .from('lead_history_logs')
        .insert({
          lead_id: statusUpdateLead.unique_id,
          changed_by: user!.id,
          action_type: 'accounting_status_update',
          old_value: previousStatus,
          new_value: targetStatus,
          comments: statusComment,
          created_at: new Date(statusDate).toISOString()
        });
      if (logError) throw logError;
    },
    onSuccess: () => {
      toast.success('Status manual override saved.');
      setStatusUpdateLead(null);
      setStatusComment('');
      refetchPerformas();
      refetchAllLeads();
      queryClient.invalidateQueries({ queryKey: ['account-closures'] });
    },
    onError: (err: Error) => toast.error(err.message)
  });

  // Render document cell component
  const DocumentTrackingCell = ({ lead }: { lead: any }) => {
    const docs = performasByLead[lead.unique_id] || [];
    const latest = docs[0];
    if (docs.length === 0) {
      return <span className="text-muted-foreground text-[11px]">No documents</span>;
    }
    return (
      <div 
        className="text-xs space-y-0.5 cursor-pointer hover:text-primary transition-colors bg-primary/5 p-1.5 rounded border border-primary/10 inline-block w-[140px]"
        onClick={(e) => {
          e.stopPropagation();
          setHistoryLead(lead);
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[10px]">Total sent:</span>
          <span className="font-semibold text-foreground text-[11px]">{docs.length}</span>
        </div>
        {latest && (
          <>
            <div className="flex items-center justify-between gap-1">
              <span className="text-muted-foreground text-[10px]">Latest:</span>
              <span className="font-medium text-foreground text-[10px] truncate max-w-[80px]" title={latest.document_url || 'Performa'}>
                {latest.document_url || 'Performa'}
              </span>
            </div>
            <div className="text-[9px] text-muted-foreground text-right">
              {new Date(latest.created_at).toLocaleDateString()}
            </div>
          </>
        )}
      </div>
    );
  };

  // Render status selector component
  const StatusSelectorCell = ({ lead }: { lead: any }) => {
    const latestPerf = performasByLead[lead.unique_id]?.[0];
    const notesObj = safeParseNotes(latestPerf?.notes);
    let currentStatus = latestPerf ? notesObj.status : 'Not Sent';

    return (
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <Select
          value={currentStatus}
          onValueChange={(val) => {
            setTargetStatus(val);
            setStatusUpdateLead(lead);
            // Default other modal states
            setStatusComment('');
            setStatusDate(new Date().toISOString().split('T')[0]);
            setStatusSLA(latestPerf ? notesObj.sla : 'Pending');
          }}
        >
          <SelectTrigger className="h-8 w-[100px] text-xs bg-background/50 border-accent/20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Sent">Sent</SelectItem>
            <SelectItem value="Viewed">Viewed</SelectItem>
            <SelectItem value="Signed">Signed</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h1 className="text-3xl font-display font-bold gradient-text">Accountant Dashboard</h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Financial Pipeline & Payment Execution
          </p>
        </motion.div>
      </div>

      {/* KPI Cards (Simplified Compact Summary) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          title="Active Enrollments" 
          value={activeEnrollments.toString()} 
          icon={Users} 
          trend="Candidates in Pipeline"
          color="indigo"
        />
        <KPICard 
          title="Sent Documents" 
          value={(allPerformas?.length || 0).toString()} 
          icon={FileText} 
          trend="Total dispatch record"
          color="primary"
        />
        <KPICard 
          title="Pending Documents" 
          value={pendingDocumentsCount.toString()} 
          icon={Clock} 
          trend="Awaiting candidate action"
          color="destructive"
        />
        <KPICard 
          title="Active SLA Count" 
          value={activeSLACount.toString()} 
          icon={AlertCircle} 
          trend="SLAs requiring attention"
          color="emerald"
        />
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Tab 1: Candidate Ledger */}
        <TabsContent value="ledger">
          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Chart 1: Collection Growth Trend */}
            <Card className="glass-card border-accent/10 shadow-lg p-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Collection Growth Trend
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[250px] mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={collectionTrendData}>
                    <defs>
                      <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" stroke="currentColor" className="text-muted-foreground text-[10px]" tickLine={false} />
                    <YAxis stroke="currentColor" className="text-muted-foreground text-[10px]" tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
                      labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                      itemStyle={{ color: '#3b82f6' }}
                      formatter={(val: any) => [`$${Number(val).toLocaleString()}`, 'Total Collected']}
                    />
                    <Area type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorGrowth)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Chart 2: Revenue vs Outstanding */}
            <Card className="glass-card border-accent/10 shadow-lg p-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                  <Activity className="h-4 w-4 text-emerald-500" />
                  Revenue vs Outstanding
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[250px] flex items-center justify-center mt-2 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={revenueVsOutstandingData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {revenueVsOutstandingData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
                      formatter={(val: any) => `$${Number(val).toLocaleString()}`}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      iconType="circle"
                      formatter={(value) => <span className="text-xs text-muted-foreground font-medium">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="glass-card border-accent/10 shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-border/50 bg-background/50 flex justify-between items-center flex-wrap gap-4">
              <h3 className="font-display font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Enrolled Candidate Ledger
              </h3>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-background px-2.5 rounded-md border border-accent/20 h-10 shrink-0">
                  <span className="text-xs text-muted-foreground font-medium pr-1 select-none">Date:</span>
                  <Input
                    type="date"
                    value={startDateFilter}
                    onChange={e => setStartDateFilter(e.target.value)}
                    className="w-[130px] h-8 text-xs border-0 bg-transparent pl-1.5 pr-3 focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-accent/40 rounded-sm"
                    title="Start date"
                  />
                  <span className="text-muted-foreground text-xs px-0.5 select-none">—</span>
                  <Input
                    type="date"
                    value={endDateFilter}
                    onChange={e => setEndDateFilter(e.target.value)}
                    className="w-[130px] h-8 text-xs border-0 bg-transparent pl-1.5 pr-3 focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-accent/40 rounded-sm"
                    title="End date"
                  />
                </div>
                {(startDateFilter || endDateFilter) && (
                  <Button variant="ghost" size="sm" onClick={() => { setStartDateFilter(''); setEndDateFilter(''); }} className="hover:bg-destructive/10 text-destructive">
                    Clear
                  </Button>
                )}
                <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">
                  {filteredClosures.length} Total
                </Badge>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-border/50">
                    <TableHead className="w-[220px]">Candidate</TableHead>
                    <TableHead className="w-[180px]">Payment Summary</TableHead>
                    <TableHead className="w-[180px]">Document Tracking</TableHead>
                    <TableHead className="w-[150px]">Status & SLA</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-20"><LoadingSpinner /></TableCell></TableRow>
                  ) : filteredClosures.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground">No records found for the selected date.</TableCell></TableRow>
                  ) : (
                    filteredClosures.map((lead) => {
                      const latestPerf = performasByLead[lead.unique_id]?.[0];
                      let parsedSLA = 'Pending';
                      if (latestPerf) {
                        try {
                          parsedSLA = JSON.parse(latestPerf.notes || '{}').sla || 'Pending';
                        } catch (e) {}
                      }

                      const closure = lead.lead_closures?.[0];
                      let onOfferAmt = null;
                      if (closure && closure.amount != null) {
                        onOfferAmt = `$${closure.amount}`;
                      } else if (lead.comment && lead.comment.includes('[Closure Payment]')) {
                        const match = lead.comment.match(/Amount:\s*\$?([0-9.]+)/);
                        if (match && match[1]) {
                          onOfferAmt = `$${match[1]}`;
                        }
                      }

                      return (
                        <TableRow 
                          key={lead.unique_id}
                          className="group hover:bg-accent/5 transition-colors border-b border-border/20"
                        >
                          <TableCell>
                            <div 
                              className="flex flex-col cursor-pointer group/cand"
                              onClick={() => setHistoryLead(lead)}
                              title="Click to view document history"
                            >
                              <span className="font-bold text-foreground group-hover/cand:text-primary group-hover/cand:underline transition-colors">{lead.name}</span>
                              <span className="text-xs text-muted-foreground">{closure?.candidate_email || lead.email}</span>
                              <div className="mt-2 flex gap-1 items-center">
                                <span className="text-[10px] text-muted-foreground">ID: {lead.display_id}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Plan:</span>
                                <span className="font-medium text-primary uppercase">{closure?.plan}</span>
                              </div>
                              {closure?.interviews_guaranteed !== null && closure?.interviews_guaranteed !== undefined && (
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">Interviews:</span>
                                  <span className="font-semibold text-foreground">{closure.interviews_guaranteed}</span>
                                </div>
                              )}
                              {onOfferAmt && (
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">On-Offer:</span>
                                  <span className="font-semibold text-foreground">{onOfferAmt}</span>
                                </div>
                              )}
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Total:</span>
                                <span className="font-semibold text-foreground">${lead.payment_ledgers?.[0]?.total_amount || 0}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground text-green-500/80">Paid:</span>
                                <span className="font-bold text-green-500">${lead.payment_ledgers?.[0]?.total_paid || 0}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground text-red-500/80">Due:</span>
                                <span className="font-bold text-red-500">${lead.payment_ledgers?.[0]?.total_due || 0}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <DocumentTrackingCell lead={lead} />
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1.5">
                              <StatusBadge status={lead.payment_ledgers?.[0]?.payment_status || 'Pending'} />
                              <div className="text-[10px] text-muted-foreground flex flex-col gap-0.5">
                                <span>Doc SLA: <strong className="text-foreground">{parsedSLA}</strong></span>
                                {lead.payment_ledgers?.[0]?.next_payment_date && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    Due: {new Date(lead.payment_ledgers[0].next_payment_date).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 w-8 p-0 rounded-full hover:bg-primary/10 hover:text-primary border-accent/20"
                                onClick={() => { setSelectedLead(lead); setIsLedgerOpen(true); }}
                                title="Ledger details"
                              >
                                <DollarSign className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 w-8 p-0 rounded-full hover:bg-indigo-500/10 hover:text-indigo-500 border-accent/20"
                                onClick={() => { setSelectedLead(lead); setIsPerformaOpen(true); }}
                                title="Send Document"
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 w-8 p-0 rounded-full hover:bg-blue-500/10 hover:text-blue-500 border-accent/20"
                                onClick={() => setAgreementLead(lead)}
                                title="Agreement Workflow"
                              >
                                <FileSignature className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Tab 2: Leads View */}
        <TabsContent value="leads">
          <Card className="glass-card border-accent/10 shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-border/50 bg-background/50 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
              <h3 className="font-display font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Leads Complete Registry
              </h3>
              
              {/* Search and Filters */}
              <div className="flex flex-wrap items-center gap-2 md:self-end">
                <Input 
                  placeholder="Search name, id, email, phone..."
                  value={leadsSearch}
                  onChange={e => setLeadsSearch(e.target.value)}
                  className="w-[200px] h-9 bg-background/50 border-accent/20"
                />
                
                <Select value={leadsTypeFilter} onValueChange={setLeadsTypeFilter}>
                  <SelectTrigger className="w-[120px] h-9 bg-background/50 border-accent/20 text-xs">
                    <SelectValue placeholder="Lead Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="Existing">Existing</SelectItem>
                    <SelectItem value="Old">Old</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={leadStatusFilter} onValueChange={setLeadStatusFilter}>
                  <SelectTrigger className="w-[130px] h-9 bg-background/50 border-accent/20 text-xs">
                    <SelectValue placeholder="Lead Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="New">New</SelectItem>
                    <SelectItem value="DNR1">DNR1</SelectItem>
                    <SelectItem value="DNR2">DNR2</SelectItem>
                    <SelectItem value="DNR3">DNR3</SelectItem>
                    <SelectItem value="Connected">Connected</SelectItem>
                    <SelectItem value="Qualified">Qualified</SelectItem>
                    <SelectItem value="Hot Prospect">Hot Prospect</SelectItem>
                    <SelectItem value="Closed">Closed</SelectItem>
                    <SelectItem value="Non Interested">Non Interested</SelectItem>
                  </SelectContent>
                </Select>


                <div className="flex items-center gap-1.5 bg-background px-2.5 rounded-md border border-accent/20 h-9 shrink-0">
                  <span className="text-[10px] text-muted-foreground font-medium pr-1 select-none">Date:</span>
                  <Input
                    type="date"
                    value={startDateFilter}
                    onChange={e => setStartDateFilter(e.target.value)}
                    className="w-[125px] h-7 text-[11px] border-0 bg-transparent pl-1 pr-2.5 focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-accent/40 rounded-sm"
                    title="Start date"
                  />
                  <span className="text-muted-foreground text-[10px] px-0.5 select-none">—</span>
                  <Input
                    type="date"
                    value={endDateFilter}
                    onChange={e => setEndDateFilter(e.target.value)}
                    className="w-[125px] h-7 text-[11px] border-0 bg-transparent pl-1 pr-2.5 focus-visible:ring-0 focus-visible:ring-offset-0 focus:bg-accent/40 rounded-sm"
                    title="End date"
                  />
                </div>
                {(startDateFilter || endDateFilter) && (
                  <Button variant="ghost" size="sm" onClick={() => { setStartDateFilter(''); setEndDateFilter(''); }} className="hover:bg-destructive/10 text-destructive h-9 px-2">
                    Clear
                  </Button>
                )}

                <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 py-1">
                  {filteredLeads.length} Matches
                </Badge>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-border/50">
                    <TableHead className="w-[180px]">Lead ID & Name</TableHead>
                    <TableHead className="w-[150px]">Email</TableHead>
                    <TableHead className="w-[120px]">Phone</TableHead>
                    <TableHead className="w-[120px]">Technology</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isAllLeadsLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-20"><LoadingSpinner /></TableCell></TableRow>
                  ) : paginatedLeads.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground">No leads found matching your criteria.</TableCell></TableRow>
                  ) : (
                    paginatedLeads.map((lead) => {
                      return (
                        <TableRow 
                          key={lead.unique_id}
                          onClick={() => setDetailsLead(lead)}
                          className="group hover:bg-accent/5 cursor-pointer transition-colors border-b border-border/20"
                        >
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-[10px] font-mono text-muted-foreground">ID: {lead.display_id || lead.unique_id.slice(0,8)}</span>
                              <span className="font-bold text-foreground group-hover:text-primary transition-colors">{lead.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{lead.email || '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{lead.phone || '—'}</TableCell>
                          <TableCell className="text-xs font-medium text-foreground/80">{lead.technology || '—'}</TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={`text-[10px] ${
                                lead.lead_status === 'Closed' ? 'border-green-500/30 text-green-500 bg-green-500/5' :
                                lead.lead_status === 'New' ? 'border-blue-500/30 text-blue-500 bg-blue-500/5' :
                                lead.lead_status?.startsWith('DNR') ? 'border-orange-500/30 text-orange-500 bg-orange-500/5' :
                                lead.lead_status === 'Non Interested' ? 'border-red-500/30 text-red-500 bg-red-500/5' :
                                'border-amber-500/30 text-amber-500 bg-amber-500/5'
                              }`}
                            >
                              {lead.lead_status || 'New'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1.5">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 w-8 p-0 rounded-full hover:bg-primary/10 hover:text-primary border-accent/20"
                                onClick={() => setDetailsLead(lead)}
                                title="View Details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 w-8 p-0 rounded-full hover:bg-indigo-500/10 hover:text-indigo-500 border-accent/20"
                                onClick={() => { setSelectedLead(lead); setIsPerformaOpen(true); }}
                                title="Send Document"
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                              {lead.lead_status === 'Closed' && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-8 w-8 p-0 rounded-full hover:bg-blue-500/10 hover:text-blue-500 border-accent/20"
                                  onClick={() => setAgreementLead(lead)}
                                  title="Agreement Workflow"
                                >
                                  <FileSignature className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {filteredLeads.length > 50 && (
              <div className="p-4 border-t border-border/50 bg-background/50 flex justify-between items-center gap-4 text-xs flex-wrap">
                <span className="text-muted-foreground font-medium">
                  Showing {((leadsPage - 1) * 50) + 1} - {Math.min(leadsPage * 50, filteredLeads.length)} of {filteredLeads.length} leads
                </span>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={leadsPage === 1} 
                    onClick={() => setLeadsPage(prev => prev - 1)}
                    className="h-8 border-accent/20 hover:bg-accent/10"
                  >
                    Previous
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={leadsPage === totalLeadsPages} 
                    onClick={() => setLeadsPage(prev => prev + 1)}
                    className="h-8 border-accent/20 hover:bg-accent/10"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog 1: Financial Ledger Dialog */}
      <LedgerDialog 
        open={isLedgerOpen} 
        onClose={() => setIsLedgerOpen(false)} 
        lead={selectedLead} 
        user={user}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['account-closures'] })}
      />

      {/* Dialog 2: E-Doc Dialog */}
      <PerformaDialog 
        open={isPerformaOpen} 
        onClose={() => setIsPerformaOpen(false)} 
        lead={selectedLead} 
        user={user}
        onSuccess={() => {
          refetchPerformas();
          refetchAllLeads();
          queryClient.invalidateQueries({ queryKey: ['account-closures'] });
        }}
      />

      {/* Dialog 3: Manual Status comment modal */}
      <Dialog open={statusUpdateLead !== null} onOpenChange={() => setStatusUpdateLead(null)}>
        <DialogContent className="glass-card max-w-md border-accent/20">
          <DialogHeader>
            <DialogTitle className="font-display">Update Status Manually</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="bg-primary/5 p-3 rounded border border-primary/10 text-sm">
              Change status of <strong className="text-foreground">{statusUpdateLead?.name}</strong> to: <strong className="text-primary">{targetStatus}</strong>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">SLA Status</Label>
              <Select value={statusSLA} onValueChange={setStatusSLA}>
                <SelectTrigger className="h-9 bg-background/50 border-accent/20 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Overdue">Overdue</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                  <SelectItem value="Met">Met</SelectItem>
                  <SelectItem value="N/A">N/A</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Comment / Notes (Mandatory) *</Label>
              <Textarea 
                value={statusComment} 
                onChange={e => setStatusComment(e.target.value)} 
                placeholder="Why is this document status changing?"
                className="min-h-[80px]"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Override Log Date</Label>
              <Input 
                type="date" 
                value={statusDate} 
                onChange={e => setStatusDate(e.target.value)} 
                className="h-9 bg-background/50 border-accent/20"
              />
            </div>

            <DialogFooter className="pt-2">
              <div className="flex gap-2 w-full">
                <Button type="button" variant="outline" onClick={() => setStatusUpdateLead(null)} className="flex-1">
                  Cancel
                </Button>
                <Button 
                  onClick={() => updateStatusMutation.mutate()} 
                  className="flex-1 nb-gradient"
                  disabled={updateStatusMutation.isPending}
                >
                  {updateStatusMutation.isPending ? 'Saving...' : 'Save Override'}
                </Button>
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog 4: Lead detail flash screen (Info / Status History / Documents) */}
      {detailsLead && (
        <LeadDetailDialog
          open={detailsLead !== null}
          onClose={() => setDetailsLead(null)}
          lead={detailsLead}
        />
      )}

      {/* Dialog for Agreement Workflow */}
      {agreementLead && (
        <AgreementDialog
          lead={agreementLead}
          open={!!agreementLead}
          onClose={() => {
            setAgreementLead(null);
            refetchAllLeads();
            queryClient.invalidateQueries({ queryKey: ['account-closures'] });
          }}
        />
      )}

      {/* Dialog 5: Document History Dialog */}
      <DocumentHistoryDialog 
        open={historyLead !== null}
        onClose={() => setHistoryLead(null)}
        lead={historyLead}
        performas={historyLead ? (performasByLead[historyLead.unique_id] || []) : []}
        profilesMap={profilesMap}
      />
    </div>
  );
}

// â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function KPICard({ title, value, icon: Icon, trend, color }: any) {
  const colors: any = {
    primary: 'text-primary bg-primary/10 border-primary/20',
    destructive: 'text-red-500 bg-red-500/10 border-red-500/20',
    indigo: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
    emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  };

  return (
    <Card className="glass-card border-accent/10 hover:border-primary/30 transition-all group">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`p-2 rounded-lg ${colors[color] || colors.primary}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-display font-bold mb-1">{value}</div>
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <ArrowUpRight className="h-3 w-3 text-green-500" />
          {trend}
        </p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: any = {
    Paid: 'bg-green-500/10 text-green-500 border-green-500/20',
    Overdue: 'bg-red-500/10 text-red-500 border-red-500/20 animate-pulse',
    Pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  };
  return (
    <div className={`inline-flex items-center rounded-full border text-[10px] font-bold px-2 py-0 h-5 ${styles[status] || styles.Pending}`}>
      {status}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="h-10 w-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      <span className="text-sm text-muted-foreground font-medium">Crunching financial data...</span>
    </div>
  );
}

function Badge({ className, children, ...props }: any) {
  return (
    <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`} {...props}>
      {children}
    </div>
  );
}

// â”€â”€ LedgerDialog Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function LedgerDialog({ open, onClose, lead, user, onSuccess }: any) {
  const existingLedger = lead?.payment_ledgers?.[0];
  const closure = lead?.lead_closures?.[0];
  
  const [form, setForm] = useState({
    total_amount: String(existingLedger?.total_amount ?? closure?.upfront_amount ?? 0),
    total_paid: String(existingLedger?.total_paid ?? 0),
    total_due: String(existingLedger?.total_due ?? 0),
    next_payment_amount: String(existingLedger?.next_payment_amount ?? ''),
    next_payment_date: existingLedger?.next_payment_date || '',
    payment_status: existingLedger?.payment_status || 'Pending'
  });

  const cleanNumberString = (val: string) => {
    // Strip non-numeric/non-dot characters
    let cleaned = val.replace(/[^0-9.]/g, '');
    
    // Strip leading zeros before any digits (e.g. "01500" -> "1500", "0" -> "0")
    cleaned = cleaned.replace(/^0+(?=\d)/, '');
    
    return cleaned;
  };

  React.useEffect(() => {
    if (open && lead) {
      const el = lead.payment_ledgers?.[0];
      const cl = lead.lead_closures?.[0];
      setForm({
        total_amount: String(el?.total_amount ?? cl?.upfront_amount ?? 0),
        total_paid: String(el?.total_paid ?? 0),
        total_due: String(el?.total_due ?? 0),
        next_payment_amount: String(el?.next_payment_amount ?? ''),
        next_payment_date: el?.next_payment_date || '',
        payment_status: el?.payment_status || 'Pending'
      });
    }
  }, [open, lead]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        lead_id: lead.unique_id,
        managed_by: user.id,
        total_amount: parseFloat(form.total_amount) || 0,
        total_paid: parseFloat(form.total_paid) || 0,
        total_due: parseFloat(form.total_due) || 0,
        next_payment_amount: form.next_payment_amount ? parseFloat(form.next_payment_amount) : null,
        next_payment_date: form.next_payment_date || null,
        payment_status: form.payment_status
      };

      if (existingLedger) {
        const { error } = await supabase.from('payment_ledgers').update(payload).eq('id', existingLedger.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('payment_ledgers').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Ledger updated successfully');
      onSuccess();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message)
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="glass-card max-w-md border-accent/20">
        <DialogHeader>
          <DialogTitle className="font-display">Payment Ledger â€” {lead?.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Total Amount ($)</Label>
              <Input type="number" className="bg-background/50 h-9" value={form.total_amount} onChange={e => setForm({...form, total_amount: cleanNumberString(e.target.value)})} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Total Paid ($)</Label>
              <Input type="number" className="bg-background/50 h-9" value={form.total_paid} onChange={e => setForm({...form, total_paid: cleanNumberString(e.target.value)})} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-red-500 font-semibold">Total Due ($)</Label>
              <Input type="number" className="bg-background/50 h-9 border-red-500/20" value={form.total_due} onChange={e => setForm({...form, total_due: cleanNumberString(e.target.value)})} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Status</Label>
              <Select value={form.payment_status} onValueChange={v => setForm({...form, payment_status: v})}>
                <SelectTrigger className="h-9 bg-background/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                  <SelectItem value="Overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border/10 pt-4">
            <div className="space-y-2">
              <Label className="text-xs text-primary">Next Payment Amt</Label>
              <Input type="number" className="bg-background/50 h-9" value={form.next_payment_amount} onChange={e => setForm({...form, next_payment_amount: cleanNumberString(e.target.value)})} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-primary">Next Due Date</Label>
              <Input type="date" className="bg-background/50 h-9" value={form.next_payment_date} onChange={e => setForm({...form, next_payment_date: e.target.value})} />
            </div>
          </div>
          <Button type="submit" className="w-full nb-gradient h-10 shadow-lg shadow-primary/20" disabled={mutation.isPending}>
            {mutation.isPending ? 'Syncing...' : 'Save Financial Update'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// â”€â”€ PerformaDialog Component (E-Doc Flow) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function PerformaDialog({ open, onClose, lead, user, onSuccess }: any) {
  const mutation = useMutation({
    mutationFn: async () => {
      const docRef = 'EDOC-' + Math.random().toString(36).substr(2, 9).toUpperCase();
      const { error } = await supabase.from('performas').insert({
        lead_id: lead.unique_id,
        sent_by: user.id,
        type: 'Pre-Performa',
        document_url: docRef,
        notes: JSON.stringify({
          status: 'Sent',
          sla: 'Pending',
          sent_at: new Date().toISOString(),
          docRefId: docRef
        })
      });
      if (error) {
        console.warn('Supabase insert failed (possibly due to RLS), but continuing redirect:', error);
      }
      
      const edocUrl = `https://netbounceplacement-docsign.vercel.app/login`;
      window.open(edocUrl, '_blank');
    },
    onSuccess: () => {
      toast.success('Document dispatch logged and redirected to E-Doc Sign');
      onSuccess();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message)
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="glass-card max-w-sm border-accent/20">
        <DialogHeader>
          <DialogTitle className="font-display">Redirect to Netbounce E-doc sign</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 mt-4">
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/10 text-center text-sm">
            <p className="text-muted-foreground mb-2">
              {" "}You are about to redirect to Netbounce E-doc sign for Documentation  :
            </p>
            <p className="font-bold text-foreground">
              Candidate mail -- {lead?.name}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              candidate mail id -{lead?.email}
            </p>
          </div>
          <Button onClick={() => mutation.mutate()} className="w-full nb-gradient h-12 shadow-xl shadow-primary/20" disabled={mutation.isPending}>
            {mutation.isPending ? 'Logging Dispatch...' : 'Send Doc'}
            <ArrowUpRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// â”€â”€ DocumentHistoryDialog Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function DocumentHistoryDialog({ open, onClose, lead, performas, profilesMap }: any) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="glass-card max-w-2xl border-accent/20">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" />
            Document History — {lead?.name}
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-x-auto mt-4 max-h-[350px]">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Reference ID</TableHead>
                <TableHead>Sent At</TableHead>
                <TableHead>Sent By</TableHead>
                <TableHead>Status & SLA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {performas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-10">No documents found for this candidate.</TableCell>
                </TableRow>
              ) : (
                performas.map((perf: any) => {
                  const notesObj = safeParseNotes(perf.notes);
                  const status = notesObj.status;
                  const sla = notesObj.sla;

                  const senderName = profilesMap?.[perf.sent_by]?.full_name || 'System';

                  return (
                    <TableRow key={perf.id} className="hover:bg-accent/5">
                      <TableCell className="font-mono text-xs font-semibold">{perf.document_url || perf.id.slice(0, 8)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(perf.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{senderName}</TableCell>
                      <TableCell>
                        <div className="flex flex-col text-[11px]">
                          <span>Status: <strong className="text-foreground">{status}</strong></span>
                          <span>SLA: <strong className="text-foreground">{sla}</strong></span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// LeadsViewDetailsDialog removed â€“ replaced by the global <LeadDetailDialog>

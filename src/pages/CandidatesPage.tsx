import React, { useState, useMemo, useEffect } from 'react';
import { Candidate, CandidateFilters, SortField, SortOrder } from '@/types/candidateTypes';
import { INITIAL_MOCK_CANDIDATES, TECHNOLOGIES_LIST, TEAMS_LIST, SENIOR_RECRUITERS_LIST, POCS_LIST } from '@/data/mockCandidatesData';
import { CandidateTable } from '@/components/candidates/CandidateTable';
import { CandidateInfoDrawer } from '@/components/candidates/CandidateInfoDrawer';
import { CandidateEditDrawer } from '@/components/candidates/CandidateEditDrawer';
import { CandidateSkeletonLoader } from '@/components/candidates/CandidateSkeletonLoader';
import { CandidateEmptyState } from '@/components/candidates/CandidateEmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Download, Plus, Filter, RotateCcw, Sparkles, UserCheck, ShieldCheck, MailCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export const CandidatesPage: React.FC = () => {
  const [candidates, setCandidates] = useState<Candidate[]>(INITIAL_MOCK_CANDIDATES);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Filters State
  const [filters, setFilters] = useState<CandidateFilters>({
    status: 'ALL',
    technology: 'ALL',
    team: 'ALL',
    seniorRecruiter: 'ALL',
    poc: 'ALL',
    lastScanDate: 'ALL'
  });

  // Sorting State
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Drawers & Modals
  const [infoCandidate, setInfoCandidate] = useState<Candidate | null>(null);
  const [isInfoOpen, setIsInfoOpen] = useState<boolean>(false);

  const [editCandidate, setEditCandidate] = useState<Candidate | null>(null);
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newCandidateName, setNewCandidateName] = useState('');
  const [newCandidateEmail, setNewCandidateEmail] = useState('');
  const [newCandidateTech, setNewCandidateTech] = useState(TECHNOLOGIES_LIST[0]);

  // Simulate initial load for Skeleton Loader
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  // Filter & Search Logic
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      // Search across Name, Tech, Email, Status, Team, SR, POC
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesEmail = c.email.toLowerCase().includes(q);
        const matchesTech = c.technology.toLowerCase().includes(q);
        const matchesStatus = c.status.toLowerCase().includes(q);
        const matchesTeam = c.assignedTeam.toLowerCase().includes(q);
        const matchesSR = c.assignedSeniorRecruiter.toLowerCase().includes(q);
        const matchesPOC = c.assignedPOC.toLowerCase().includes(q);

        if (!matchesName && !matchesEmail && !matchesTech && !matchesStatus && !matchesTeam && !matchesSR && !matchesPOC) {
          return false;
        }
      }

      // Filter by Status
      if (filters.status !== 'ALL' && c.status !== filters.status) return false;

      // Filter by Technology
      if (filters.technology !== 'ALL' && c.technology !== filters.technology) return false;

      // Filter by Team
      if (filters.team !== 'ALL' && c.assignedTeam !== filters.team) return false;

      // Filter by Senior Recruiter
      if (filters.seniorRecruiter !== 'ALL' && c.assignedSeniorRecruiter !== filters.seniorRecruiter) return false;

      // Filter by POC
      if (filters.poc !== 'ALL' && c.assignedPOC !== filters.poc) return false;

      // Filter by Last Scan Date
      if (filters.lastScanDate !== 'ALL') {
        if (filters.lastScanDate === 'Today' && c.lastScanDate !== 'Today') return false;
        if (filters.lastScanDate === 'Yesterday' && c.lastScanDate !== 'Yesterday') return false;
      }

      return true;
    });
  }, [candidates, searchQuery, filters]);

  // Sort Logic
  const sortedCandidates = useMemo(() => {
    return [...filteredCandidates].sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredCandidates, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(sortedCandidates.map((c) => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectCandidate = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const resetFilters = () => {
    setSearchQuery('');
    setFilters({
      status: 'ALL',
      technology: 'ALL',
      team: 'ALL',
      seniorRecruiter: 'ALL',
      poc: 'ALL',
      lastScanDate: 'ALL'
    });
  };

  const hasActiveFilters = searchQuery.trim() !== '' || Object.values(filters).some((val) => val !== 'ALL');

  const handleOpenInfo = (candidate: Candidate) => {
    setInfoCandidate(candidate);
    setIsInfoOpen(true);
  };

  const handleOpenEdit = (candidate: Candidate) => {
    setEditCandidate(candidate);
    setIsEditOpen(true);
  };

  const handleSaveEdit = (updated: Candidate) => {
    setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const handleExportCSV = () => {
    if (sortedCandidates.length === 0) {
      toast.error('No candidate data to export');
      return;
    }

    const headers = ['Candidate Name', 'Email', 'Technology', 'Status', 'Total Applications', 'Today Applications', 'Last Scan Date', 'Assigned Team', 'Senior Recruiter', 'POC'];
    const rows = sortedCandidates.map((c) => [
      `"${c.name}"`,
      `"${c.email}"`,
      `"${c.technology}"`,
      `"${c.status}"`,
      c.totalApplications,
      c.todaysApplications,
      `"${c.lastScanDate} ${c.lastScanTime}"`,
      `"${c.assignedTeam}"`,
      `"${c.assignedSeniorRecruiter}"`,
      `"${c.assignedPOC}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NetBounce_Candidates_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`Exported ${sortedCandidates.length} candidates to CSV`);
  };

  const handleCreateCandidate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCandidateName || !newCandidateEmail) {
      toast.error('Please enter name and email');
      return;
    }

    const newCand: Candidate = {
      id: `cand-${Date.now()}`,
      name: newCandidateName,
      email: newCandidateEmail,
      phone: '+1 (555) 000-0000',
      technology: newCandidateTech,
      status: 'Active',
      totalApplications: 0,
      todaysApplications: 0,
      lastScanDate: 'Today',
      lastScanTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      scannedBy: 'Shashank Mishra',
      enrollmentDate: new Date().toISOString().slice(0, 10),
      assignedTeam: 'Rudra Team',
      assignedSeniorRecruiter: 'Vikramaditya Sharma',
      assignedPOC: 'Ananya Roy',
      marketingGmail: `${newCandidateName.toLowerCase().replace(/\s+/g, '.')}@gmail.com`,
      connectionStatus: 'Connected',
      lastGmailSync: 'Just now',
      lastScannerRun: 'Just now',
      notes: 'Newly created candidate record.'
    };

    setCandidates((prev) => [newCand, ...prev]);
    toast.success(`Candidate ${newCandidateName} added successfully!`);
    setIsAddModalOpen(false);
    setNewCandidateName('');
    setNewCandidateEmail('');
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto min-h-screen">
      {/* ── HEADER BANNER ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Candidates</h1>
            <span className="bg-primary/10 text-primary text-xs font-semibold px-2.5 py-0.5 rounded-full border border-primary/20 flex items-center gap-1">
              <MailCheck className="h-3 w-3" /> Mail Intelligence
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            NetBounce Marketing Mail Intelligence System Candidate Management
          </p>
        </div>

        {/* TOP ACTION BUTTONS */}
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>

          <Button size="sm" onClick={() => setIsAddModalOpen(true)} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            New Candidate
          </Button>
        </div>
      </div>

      {/* ── SEARCH & FILTERS BAR ──────────────────────────────────────────── */}
      <div className="bg-card border border-border/80 rounded-xl p-4 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* SEARCH INPUT */}
          <div className="md:col-span-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by Name, Tech, Email, Status, Team, SR, POC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background text-sm"
            />
          </div>

          {/* FILTER: STATUS */}
          <div className="md:col-span-2">
            <Select
              value={filters.status}
              onValueChange={(val) => setFilters((prev) => ({ ...prev, status: val }))}
            >
              <SelectTrigger className="bg-background text-xs">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="Active">Active (Green)</SelectItem>
                <SelectItem value="Placed">Placed (Blue)</SelectItem>
                <SelectItem value="Back Out">Back Out (Orange)</SelectItem>
                <SelectItem value="On Hold">On Hold (Red)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* FILTER: TECHNOLOGY */}
          <div className="md:col-span-2">
            <Select
              value={filters.technology}
              onValueChange={(val) => setFilters((prev) => ({ ...prev, technology: val }))}
            >
              <SelectTrigger className="bg-background text-xs">
                <SelectValue placeholder="All Technologies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Technologies</SelectItem>
                {TECHNOLOGIES_LIST.map((tech) => (
                  <SelectItem key={tech} value={tech}>
                    {tech}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* FILTER: TEAM */}
          <div className="md:col-span-2">
            <Select
              value={filters.team}
              onValueChange={(val) => setFilters((prev) => ({ ...prev, team: val }))}
            >
              <SelectTrigger className="bg-background text-xs">
                <SelectValue placeholder="All Teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Teams</SelectItem>
                {TEAMS_LIST.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* RESET FILTERS */}
          <div className="md:col-span-2 flex items-center justify-end gap-2">
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs text-muted-foreground hover:text-foreground gap-1">
                <RotateCcw className="h-3.5 w-3.5" /> Clear Filters
              </Button>
            )}
          </div>
        </div>

        {/* SECONDARY ROW FILTERS FOR SR & POC & LAST SCAN */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/50 text-xs">
          <span className="text-muted-foreground font-semibold flex items-center gap-1">
            <Filter className="h-3 w-3 text-primary" /> Advanced Filters:
          </span>

          {/* SR FILTER */}
          <div className="w-44">
            <Select
              value={filters.seniorRecruiter}
              onValueChange={(val) => setFilters((prev) => ({ ...prev, seniorRecruiter: val }))}
            >
              <SelectTrigger className="bg-background text-xs h-8">
                <SelectValue placeholder="Senior Recruiter (SR)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All SRs</SelectItem>
                {SENIOR_RECRUITERS_LIST.map((sr) => (
                  <SelectItem key={sr} value={sr}>
                    {sr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* POC FILTER */}
          <div className="w-44">
            <Select
              value={filters.poc}
              onValueChange={(val) => setFilters((prev) => ({ ...prev, poc: val }))}
            >
              <SelectTrigger className="bg-background text-xs h-8">
                <SelectValue placeholder="Point of Contact (POC)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All POCs</SelectItem>
                {POCS_LIST.map((poc) => (
                  <SelectItem key={poc} value={poc}>
                    {poc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* LAST SCAN DATE FILTER */}
          <div className="w-40">
            <Select
              value={filters.lastScanDate}
              onValueChange={(val) => setFilters((prev) => ({ ...prev, lastScanDate: val }))}
            >
              <SelectTrigger className="bg-background text-xs h-8">
                <SelectValue placeholder="Last Scan Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Scan Dates</SelectItem>
                <SelectItem value="Today">Scanned Today</SelectItem>
                <SelectItem value="Yesterday">Scanned Yesterday</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="ml-auto text-muted-foreground">
            Showing <span className="font-bold text-foreground">{sortedCandidates.length}</span> of <span className="font-bold text-foreground">{candidates.length}</span> candidates
          </div>
        </div>
      </div>

      {/* ── TABLE / SKELETON / EMPTY STATE ────────────────────────────────── */}
      {isLoading ? (
        <CandidateSkeletonLoader />
      ) : sortedCandidates.length === 0 ? (
        <CandidateEmptyState
          onAddCandidate={() => setIsAddModalOpen(true)}
          resetFilters={resetFilters}
          hasFiltersActive={hasActiveFilters}
        />
      ) : (
        <CandidateTable
          candidates={sortedCandidates}
          selectedIds={selectedIds}
          onSelectAll={handleSelectAll}
          onSelectCandidate={handleSelectCandidate}
          sortField={sortField}
          sortOrder={sortOrder}
          onSort={handleSort}
          onOpenInfo={handleOpenInfo}
          onOpenEdit={handleOpenEdit}
        />
      )}

      {/* ── INFORMATION DRAWER (`ⓘ`) ───────────────────────────────────────── */}
      <CandidateInfoDrawer
        candidate={infoCandidate}
        isOpen={isInfoOpen}
        onClose={() => {
          setIsInfoOpen(false);
          setInfoCandidate(null);
        }}
      />

      {/* ── EDIT DRAWER (`✏️`) ──────────────────────────────────────────────── */}
      <CandidateEditDrawer
        candidate={editCandidate}
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setEditCandidate(null);
        }}
        onSave={handleSaveEdit}
      />

      {/* ── NEW CANDIDATE MODAL ───────────────────────────────────────────── */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Add New Candidate</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCandidate} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="candName">Full Name *</Label>
              <Input
                id="candName"
                placeholder="e.g. Alex Johnson"
                value={newCandidateName}
                onChange={(e) => setNewCandidateName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="candEmail">Email Address *</Label>
              <Input
                id="candEmail"
                type="email"
                placeholder="alex.johnson@gmail.com"
                value={newCandidateEmail}
                onChange={(e) => setNewCandidateEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="candTech">Technology</Label>
              <Select value={newCandidateTech} onValueChange={setNewCandidateTech}>
                <SelectTrigger id="candTech">
                  <SelectValue placeholder="Select Technology" />
                </SelectTrigger>
                <SelectContent>
                  {TECHNOLOGIES_LIST.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Candidate</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CandidatesPage;

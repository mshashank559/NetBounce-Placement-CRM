import React from 'react';
import { Candidate, SortField, SortOrder } from '@/types/candidateTypes';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, Pencil, ArrowUpDown, ArrowUp, ArrowDown, Scan, Sparkles } from 'lucide-react';

interface CandidateTableProps {
  candidates: Candidate[];
  selectedIds: string[];
  onSelectAll: (checked: boolean) => void;
  onSelectCandidate: (id: string, checked: boolean) => void;
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  onOpenInfo: (candidate: Candidate) => void;
  onOpenEdit: (candidate: Candidate) => void;
}

export const CandidateTable: React.FC<CandidateTableProps> = ({
  candidates,
  selectedIds,
  onSelectAll,
  onSelectCandidate,
  sortField,
  sortOrder,
  onSort,
  onOpenInfo,
  onOpenEdit
}) => {
  const isAllSelected = candidates.length > 0 && selectedIds.length === candidates.length;

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-foreground transition-colors ml-1" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 text-primary ml-1" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-primary ml-1" />
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20 font-semibold px-2.5 py-0.5 rounded-full">
            Active
          </Badge>
        );
      case 'Placed':
        return (
          <Badge className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border border-blue-500/20 font-semibold px-2.5 py-0.5 rounded-full">
            Placed
          </Badge>
        );
      case 'Back Out':
        return (
          <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border border-amber-500/20 font-semibold px-2.5 py-0.5 rounded-full">
            Back Out
          </Badge>
        );
      case 'On Hold':
        return (
          <Badge className="bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border border-rose-500/20 font-semibold px-2.5 py-0.5 rounded-full">
            On Hold
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="w-full">
      {/* ── DESKTOP & TABLET TABLE VIEW ───────────────────────────────────────── */}
      <div className="hidden md:block bg-card border border-border/80 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-muted-foreground text-xs uppercase font-semibold tracking-wider select-none">
                {/* 1. Checkbox */}
                <th className="py-3.5 px-4 w-10">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={(checked) => onSelectAll(!!checked)}
                    aria-label="Select all candidates"
                  />
                </th>

                {/* 2. Candidate Name */}
                <th className="py-3.5 px-4 cursor-pointer group" onClick={() => onSort('name')}>
                  <div className="flex items-center">
                    Candidate Name
                    {renderSortIcon('name')}
                  </div>
                </th>

                {/* 3. Technology */}
                <th className="py-3.5 px-4 cursor-pointer group" onClick={() => onSort('technology')}>
                  <div className="flex items-center">
                    Technology
                    {renderSortIcon('technology')}
                  </div>
                </th>

                {/* 4. Status */}
                <th className="py-3.5 px-4 cursor-pointer group" onClick={() => onSort('status')}>
                  <div className="flex items-center">
                    Status
                    {renderSortIcon('status')}
                  </div>
                </th>

                {/* 5. Total Applications */}
                <th className="py-3.5 px-4 cursor-pointer group text-center" onClick={() => onSort('totalApplications')}>
                  <div className="flex items-center justify-center">
                    Total Apps
                    {renderSortIcon('totalApplications')}
                  </div>
                </th>

                {/* 6. Today's Applications */}
                <th className="py-3.5 px-4 cursor-pointer group text-center" onClick={() => onSort('todaysApplications')}>
                  <div className="flex items-center justify-center">
                    Today's Apps
                    {renderSortIcon('todaysApplications')}
                  </div>
                </th>

                {/* 7. Last Scan */}
                <th className="py-3.5 px-4 cursor-pointer group" onClick={() => onSort('lastScanDate')}>
                  <div className="flex items-center">
                    Last Scan
                    {renderSortIcon('lastScanDate')}
                  </div>
                </th>

                {/* 8. Actions */}
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border/60">
              {candidates.map((candidate) => {
                const isSelected = selectedIds.includes(candidate.id);
                return (
                  <tr
                    key={candidate.id}
                    className={`transition-colors duration-150 hover:bg-muted/30 ${
                      isSelected ? 'bg-primary/5' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3.5 px-4">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => onSelectCandidate(candidate.id, !!checked)}
                        aria-label={`Select ${candidate.name}`}
                      />
                    </td>

                    {/* Candidate Name & Avatar */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-border shrink-0">
                          <AvatarImage src={candidate.avatarUrl} alt={candidate.name} />
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                            {getInitials(candidate.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-foreground truncate hover:text-primary transition-colors cursor-pointer" onClick={() => onOpenInfo(candidate)}>
                            {candidate.name}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">{candidate.email}</span>
                        </div>
                      </div>
                    </td>

                    {/* Technology */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-muted text-foreground border border-border/50">
                        {candidate.technology}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      {getStatusBadge(candidate.status)}
                    </td>

                    {/* Total Applications (Read only) */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-semibold text-foreground bg-muted/50 px-2.5 py-1 rounded-lg text-xs font-mono">
                        {candidate.totalApplications}
                      </span>
                    </td>

                    {/* Today's Applications (Read only) */}
                    <td className="py-3.5 px-4 text-center">
                      <span className={`font-bold px-2.5 py-1 rounded-lg text-xs font-mono ${
                        candidate.todaysApplications > 0
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : 'bg-muted/30 text-muted-foreground'
                      }`}>
                        {candidate.todaysApplications}
                      </span>
                    </td>

                    {/* Last Scan with Tooltip */}
                    <td className="py-3.5 px-4">
                      <TooltipProvider>
                        <Tooltip delayDuration={200}>
                          <TooltipTrigger asChild>
                            <div className="flex flex-col items-start cursor-help group/scan">
                              <div className="flex items-center gap-1.5">
                                <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 text-[10px] px-1.5 py-0 border-blue-500/20 font-semibold gap-1">
                                  <Scan className="h-3 w-3" /> Last Scan
                                </Badge>
                                <span className="text-xs font-medium text-foreground">{candidate.lastScanDate}</span>
                              </div>
                              <span className="text-[11px] text-muted-foreground mt-0.5">
                                {candidate.lastScanTime} • <span className="text-foreground/80 font-medium">{candidate.scannedBy}</span>
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="bg-popover text-popover-foreground border border-border shadow-md">
                            <p className="text-xs">
                              Last Gmail scan performed by <span className="font-semibold text-primary">{candidate.scannedBy}</span>
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>

                    {/* Actions: ONLY Info & Edit */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Info Button ⓘ */}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onOpenInfo(candidate)}
                                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                              >
                                <Info className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Candidate Information</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        {/* Edit Button Pencil */}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onOpenEdit(candidate)}
                                className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit Candidate</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MOBILE CARDS VIEW ─────────────────────────────────────────────────── */}
      <div className="md:hidden space-y-3">
        {candidates.map((candidate) => {
          const isSelected = selectedIds.includes(candidate.id);
          return (
            <div
              key={candidate.id}
              className={`bg-card border border-border/80 rounded-xl p-4 space-y-3 shadow-xs transition-all ${
                isSelected ? 'ring-2 ring-primary/40 bg-primary/5' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => onSelectCandidate(candidate.id, !!checked)}
                    className="mt-1"
                  />
                  <Avatar className="h-10 w-10 border border-border shrink-0">
                    <AvatarImage src={candidate.avatarUrl} alt={candidate.name} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                      {getInitials(candidate.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-foreground truncate">{candidate.name}</span>
                    <span className="text-xs text-muted-foreground truncate">{candidate.email}</span>
                  </div>
                </div>

                {getStatusBadge(candidate.status)}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 p-2.5 rounded-lg border border-border/40">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Technology</span>
                  <span className="font-semibold text-foreground">{candidate.technology}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Assigned Team</span>
                  <span className="font-semibold text-primary">{candidate.assignedTeam}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Total Apps</span>
                  <span className="font-mono font-bold text-foreground">{candidate.totalApplications}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Today's Apps</span>
                  <span className="font-mono font-bold text-primary">{candidate.todaysApplications}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 text-[10px] px-1.5 py-0 border-blue-500/20 font-semibold">
                    Last Scan
                  </Badge>
                  <span>{candidate.lastScanDate} • {candidate.lastScanTime}</span>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onOpenInfo(candidate)}
                    className="h-8 w-8 text-foreground"
                  >
                    <Info className="h-4 w-4 text-primary" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onOpenEdit(candidate)}
                    className="h-8 w-8 text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

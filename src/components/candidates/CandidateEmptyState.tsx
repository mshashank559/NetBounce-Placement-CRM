import React from 'react';
import { UserX, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CandidateEmptyStateProps {
  onAddCandidate?: () => void;
  resetFilters?: () => void;
  hasFiltersActive?: boolean;
}

export const CandidateEmptyState: React.FC<CandidateEmptyStateProps> = ({
  onAddCandidate,
  resetFilters,
  hasFiltersActive
}) => {
  return (
    <div className="bg-card border border-border/70 rounded-xl p-12 text-center flex flex-col items-center justify-center my-6 shadow-sm">
      <div className="w-20 h-20 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4 ring-8 ring-primary/5 animate-pulse">
        <UserX className="w-10 h-10" />
      </div>

      <h3 className="text-xl font-bold text-foreground mb-1">No Candidates Found</h3>
      <p className="text-muted-foreground text-sm max-w-md mb-6">
        {hasFiltersActive
          ? "We couldn't find any candidate matching your selected filters or search terms."
          : "There are currently no candidates registered in the Mail Intelligence System."}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {hasFiltersActive && resetFilters && (
          <Button variant="outline" onClick={resetFilters}>
            Clear Filters
          </Button>
        )}
        {onAddCandidate && (
          <Button onClick={onAddCandidate} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Candidate
          </Button>
        )}
      </div>
    </div>
  );
};

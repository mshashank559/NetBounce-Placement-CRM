import React from 'react';

export const CandidateSkeletonLoader: React.FC = () => {
  return (
    <div className="w-full space-y-4 animate-pulse">
      {/* Desktop Skeleton Rows */}
      <div className="hidden md:block bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30 grid grid-cols-12 gap-4 items-center">
          <div className="col-span-1 h-4 bg-muted rounded w-4" />
          <div className="col-span-3 h-4 bg-muted rounded w-3/4" />
          <div className="col-span-2 h-4 bg-muted rounded w-1/2" />
          <div className="col-span-1 h-4 bg-muted rounded w-16" />
          <div className="col-span-1 h-4 bg-muted rounded w-12" />
          <div className="col-span-1 h-4 bg-muted rounded w-10" />
          <div className="col-span-2 h-4 bg-muted rounded w-24" />
          <div className="col-span-1 h-4 bg-muted rounded w-12" />
        </div>

        {[1, 2, 3, 4, 5].map((idx) => (
          <div key={idx} className="p-4 border-b border-border/50 grid grid-cols-12 gap-4 items-center">
            <div className="col-span-1">
              <div className="h-4 w-4 bg-muted/60 rounded" />
            </div>
            <div className="col-span-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted/60 shrink-0" />
              <div className="space-y-2 w-full">
                <div className="h-4 bg-muted/60 rounded w-2/3" />
                <div className="h-3 bg-muted/40 rounded w-1/2" />
              </div>
            </div>
            <div className="col-span-2">
              <div className="h-4 bg-muted/60 rounded w-3/4" />
            </div>
            <div className="col-span-1">
              <div className="h-6 bg-muted/60 rounded-full w-16" />
            </div>
            <div className="col-span-1">
              <div className="h-5 bg-muted/60 rounded w-10" />
            </div>
            <div className="col-span-1">
              <div className="h-5 bg-muted/60 rounded w-8" />
            </div>
            <div className="col-span-2 space-y-1">
              <div className="h-3 bg-muted/60 rounded w-20" />
              <div className="h-3 bg-muted/40 rounded w-16" />
            </div>
            <div className="col-span-1 flex gap-2">
              <div className="h-8 w-8 bg-muted/60 rounded-lg" />
              <div className="h-8 w-8 bg-muted/60 rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      {/* Mobile Skeleton Cards */}
      <div className="md:hidden space-y-3">
        {[1, 2, 3].map((idx) => (
          <div key={idx} className="bg-card p-4 rounded-xl border border-border space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted/60 shrink-0" />
              <div className="space-y-2 w-full">
                <div className="h-4 bg-muted/60 rounded w-1/2" />
                <div className="h-3 bg-muted/40 rounded w-1/3" />
              </div>
            </div>
            <div className="h-4 bg-muted/50 rounded w-full" />
            <div className="h-4 bg-muted/50 rounded w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
};

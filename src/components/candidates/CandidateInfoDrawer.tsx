import React, { useState } from 'react';
import { Candidate } from '@/types/candidateTypes';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Eye, EyeOff, Mail, Phone, ShieldCheck, User, Users, Calendar, Briefcase, Key, RefreshCw, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface CandidateInfoDrawerProps {
  candidate: Candidate | null;
  isOpen: boolean;
  onClose: () => void;
}

export const CandidateInfoDrawer: React.FC<CandidateInfoDrawerProps> = ({
  candidate,
  isOpen,
  onClose
}) => {
  const [showPassword, setShowPassword] = useState(false);

  if (!candidate) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Active':
        return <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/30">Active</Badge>;
      case 'Placed':
        return <Badge className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-500/30">Placed</Badge>;
      case 'Back Out':
        return <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/30">Back Out</Badge>;
      case 'On Hold':
        return <Badge className="bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border-rose-500/30">On Hold</Badge>;
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
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md md:max-w-lg overflow-y-auto bg-card text-card-foreground border-l border-border p-0">
        {/* Drawer Header Banner */}
        <div className="p-6 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border">
          <SheetHeader className="text-left space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">Mail Intelligence CRM</span>
              {getStatusBadge(candidate.status)}
            </div>
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 border-2 border-primary/20 shadow-sm">
                <AvatarImage src={candidate.avatarUrl} alt={candidate.name} />
                <AvatarFallback className="bg-primary/20 text-primary font-bold text-lg">
                  {getInitials(candidate.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <SheetTitle className="text-xl font-bold text-foreground">{candidate.name}</SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <Briefcase className="h-3.5 w-3.5 text-primary" />
                  {candidate.technology}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
        </div>

        <div className="p-6 space-y-6">
          {/* Group 1: Candidate Identity & Credentials */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <User className="h-4 w-4 text-primary" />
              Candidate Profile & Login
            </div>
            <div className="bg-muted/40 rounded-xl p-4 space-y-3 border border-border/60">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground/70" /> Email
                </span>
                <span className="font-medium text-foreground">{candidate.email}</span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground/70" /> Phone
                </span>
                <span className="font-medium text-foreground">{candidate.phone || 'N/A'}</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Key className="h-4 w-4 text-muted-foreground/70" /> Password
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold tracking-wider text-foreground">
                    {showPassword ? (candidate.password || '••••••••') : '••••••••'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted"
                    title={showPassword ? "Hide password" : "Reveal password"}
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground/70" /> Enrollment Date
                </span>
                <span className="font-medium text-foreground">{candidate.enrollmentDate}</span>
              </div>
            </div>
          </div>

          {/* Group 2: Assigned Hierarchy (Team Lead -> SR -> POC) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Users className="h-4 w-4 text-primary" />
              Organizational Hierarchy
            </div>
            <div className="bg-muted/40 rounded-xl p-4 space-y-3 border border-border/60">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">1. Team Lead / Team</span>
                <Badge variant="secondary" className="font-semibold text-primary bg-primary/10">
                  {candidate.assignedTeam}
                </Badge>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">2. Senior Recruiter (SR)</span>
                <span className="font-semibold text-foreground">{candidate.assignedSeniorRecruiter}</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">3. Point of Contact (POC)</span>
                <span className="font-semibold text-foreground">{candidate.assignedPOC}</span>
              </div>
            </div>
          </div>

          {/* Group 3: Mail Intelligence System Metrics & Status */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Mail Intelligence Connection
            </div>
            <div className="bg-muted/40 rounded-xl p-4 space-y-3 border border-border/60">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Marketing Gmail</span>
                <span className="font-mono text-xs text-foreground font-medium">{candidate.marketingGmail}</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Connection Status</span>
                <div className="flex items-center gap-1.5">
                  {candidate.connectionStatus === 'Connected' ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                      <AlertCircle className="h-3.5 w-3.5" /> {candidate.connectionStatus}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Last Gmail Sync</span>
                <span className="text-xs font-medium text-foreground">{candidate.lastGmailSync}</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Last Scanner Run</span>
                <span className="text-xs font-medium text-foreground">{candidate.lastScannerRun}</span>
              </div>

              <div className="pt-2 grid grid-cols-2 gap-3 border-t border-border/60 text-center">
                <div className="bg-background rounded-lg p-2.5 border border-border/50">
                  <div className="text-xs text-muted-foreground">Total Applications</div>
                  <div className="text-lg font-bold text-foreground mt-0.5">{candidate.totalApplications}</div>
                </div>
                <div className="bg-background rounded-lg p-2.5 border border-border/50">
                  <div className="text-xs text-muted-foreground">Today's Applications</div>
                  <div className="text-lg font-bold text-primary mt-0.5">{candidate.todaysApplications}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Group 4: Notes */}
          {candidate.notes && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <FileText className="h-4 w-4 text-primary" />
                Candidate Notes
              </div>
              <div className="bg-muted/40 rounded-xl p-4 border border-border/60 text-sm text-foreground leading-relaxed">
                {candidate.notes}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

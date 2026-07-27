import React, { useState, useEffect } from 'react';
import { Candidate, CandidateStatus, TeamLead } from '@/types/candidateTypes';
import { TECHNOLOGIES_LIST, TEAMS_LIST, SENIOR_RECRUITERS_LIST, POCS_LIST } from '@/data/mockCandidatesData';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Save, X } from 'lucide-react';
import { toast } from 'sonner';

interface CandidateEditDrawerProps {
  candidate: Candidate | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedCandidate: Candidate) => void;
}

export const CandidateEditDrawer: React.FC<CandidateEditDrawerProps> = ({
  candidate,
  isOpen,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState<Partial<Candidate>>({});

  useEffect(() => {
    if (candidate) {
      setFormData({ ...candidate });
    }
  }, [candidate]);

  if (!candidate) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      toast.error('Candidate Name and Email are required');
      return;
    }

    onSave(formData as Candidate);
    toast.success(`Candidate ${formData.name} updated successfully!`);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md md:max-w-[520px] overflow-y-auto bg-card text-card-foreground border-l border-border p-0">
        <div className="p-6 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border">
          <SheetHeader className="text-left space-y-1">
            <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
              <Pencil className="h-3.5 w-3.5" />
              Edit Candidate Details
            </div>
            <SheetTitle className="text-xl font-bold text-foreground">Edit {candidate.name}</SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Update candidate info, organizational hierarchy, and marketing Gmail credentials.
            </SheetDescription>
          </SheetHeader>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Candidate Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-semibold text-foreground">Candidate Name *</Label>
            <Input
              id="name"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. John Smith"
              required
            />
          </div>

          {/* Technology */}
          <div className="space-y-1.5">
            <Label htmlFor="technology" className="text-xs font-semibold text-foreground">Technology / Stack *</Label>
            <Select
              value={formData.technology || ''}
              onValueChange={(val) => setFormData({ ...formData, technology: val })}
            >
              <SelectTrigger id="technology">
                <SelectValue placeholder="Select Technology" />
              </SelectTrigger>
              <SelectContent>
                {TECHNOLOGIES_LIST.map((tech) => (
                  <SelectItem key={tech} value={tech}>
                    {tech}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label htmlFor="status" className="text-xs font-semibold text-foreground">Status *</Label>
            <Select
              value={formData.status || 'Active'}
              onValueChange={(val) => setFormData({ ...formData, status: val as CandidateStatus })}
            >
              <SelectTrigger id="status">
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active (Green)</SelectItem>
                <SelectItem value="Placed">Placed (Blue)</SelectItem>
                <SelectItem value="Back Out">Back Out (Orange)</SelectItem>
                <SelectItem value="On Hold">On Hold (Red)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Grid for Email & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-foreground">Candidate Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@gmail.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs font-semibold text-foreground">Phone Number</Label>
              <Input
                id="phone"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>

          {/* Organizational Hierarchy Section */}
          <div className="pt-2 border-t border-border/60 space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-primary">
              Organizational Hierarchy
            </div>

            {/* Assigned Team */}
            <div className="space-y-1.5">
              <Label htmlFor="assignedTeam" className="text-xs font-semibold text-foreground">Assigned Team (Team Lead)</Label>
              <Select
                value={formData.assignedTeam || 'Rudra Team'}
                onValueChange={(val) => setFormData({ ...formData, assignedTeam: val as TeamLead })}
              >
                <SelectTrigger id="assignedTeam">
                  <SelectValue placeholder="Select Team" />
                </SelectTrigger>
                <SelectContent>
                  {TEAMS_LIST.map((team) => (
                    <SelectItem key={team} value={team}>
                      {team}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Grid for SR & POC */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="sr" className="text-xs font-semibold text-foreground">Senior Recruiter (SR)</Label>
                <Select
                  value={formData.assignedSeniorRecruiter || ''}
                  onValueChange={(val) => setFormData({ ...formData, assignedSeniorRecruiter: val })}
                >
                  <SelectTrigger id="sr">
                    <SelectValue placeholder="Select SR" />
                  </SelectTrigger>
                  <SelectContent>
                    {SENIOR_RECRUITERS_LIST.map((sr) => (
                      <SelectItem key={sr} value={sr}>
                        {sr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="poc" className="text-xs font-semibold text-foreground">Assigned POC</Label>
                <Select
                  value={formData.assignedPOC || ''}
                  onValueChange={(val) => setFormData({ ...formData, assignedPOC: val })}
                >
                  <SelectTrigger id="poc">
                    <SelectValue placeholder="Select POC" />
                  </SelectTrigger>
                  <SelectContent>
                    {POCS_LIST.map((poc) => (
                      <SelectItem key={poc} value={poc}>
                        {poc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Marketing Gmail */}
          <div className="space-y-1.5 pt-2 border-t border-border/60">
            <Label htmlFor="marketingGmail" className="text-xs font-semibold text-foreground">Marketing Gmail</Label>
            <Input
              id="marketingGmail"
              type="email"
              value={formData.marketingGmail || ''}
              onChange={(e) => setFormData({ ...formData, marketingGmail: e.target.value })}
              placeholder="candidate.marketing@gmail.com"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs font-semibold text-foreground">Notes</Label>
            <Textarea
              id="notes"
              rows={3}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add candidate notes or application preferences..."
              className="resize-none"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="gap-1.5">
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button type="submit" className="gap-1.5">
              <Save className="h-4 w-4" /> Save Changes
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};

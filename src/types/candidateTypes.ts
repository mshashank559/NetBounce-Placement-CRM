export type CandidateStatus = 'Active' | 'Placed' | 'Back Out' | 'On Hold';

export type TeamLead = 'Rudra Team' | 'Shilp Team';

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  technology: string;
  status: CandidateStatus;
  totalApplications: number;
  todaysApplications: number;
  lastScanDate: string; // e.g., "Today", "2026-07-27"
  lastScanTime: string; // e.g., "08:32 PM"
  scannedBy: string; // e.g., "Shashank Mishra"
  
  // Drawer Info & Edit fields
  password?: string;
  enrollmentDate: string;
  assignedTeam: TeamLead;
  assignedSeniorRecruiter: string;
  assignedPOC: string;
  marketingGmail: string;
  connectionStatus: 'Connected' | 'Disconnected' | 'Syncing' | 'Auth Required';
  lastGmailSync: string;
  lastScannerRun: string;
  notes?: string;
}

export interface CandidateFilters {
  status: string;
  technology: string;
  team: string;
  seniorRecruiter: string;
  poc: string;
  lastScanDate: string;
}

export type SortField = 
  | 'name' 
  | 'technology' 
  | 'status' 
  | 'totalApplications' 
  | 'todaysApplications' 
  | 'lastScanDate';

export type SortOrder = 'asc' | 'desc';

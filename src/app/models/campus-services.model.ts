export interface MenteeStudent {
  allocationId?: number;
  studentId: number;
  usn: string;
  fullName: string;
  departmentName?: string;
  semester?: number;
  mobile?: string;
  email?: string;
  cgpa?: number;
  attendancePercent?: number;
}

export interface MentoringSessionRecord {
  sessionId: number;
  meetingDate: string;
  meetingTime?: string;
  mentorName: string;
  mentorDesignation?: string;
  mentorEmail?: string;
  topicsDiscussed: string;
  remarks?: string;
  actionItems?: string;
  status: 'Scheduled' | 'Completed' | 'Pending Review' | string;
}

export interface BorrowedBookItem {
  issueId: number;
  biblioId?: number;
  title: string;
  author?: string;
  isbn?: string;
  barcode: string;
  issuedDate: string;
  dueDate: string;
  daysRemaining?: number;
  isOverdue: boolean;
  fineAmount?: number;
  coverUrl?: string;
}

export interface CirculationHistoryItem {
  title: string;
  author?: string;
  barcode: string;
  issuedDate: string;
  returnedDate: string;
}

export interface PlacementJobItem {
  jobId: number;
  companyName: string;
  jobRole: string;
  packageLpa?: number;
  applicationDeadline: string;
  driveDate?: string;
  status: 'Eligible' | 'Applied' | 'Shortlisted' | 'Selected' | 'Rejected' | string;
  eligibilityCriteria?: string;
}

export interface PlacementOverview {
  studentSlnum: number;
  eligibleDrivesCount: number;
  appliedCount: number;
  shortlistedCount: number;
  offersCount: number;
  jobs: PlacementJobItem[];
}

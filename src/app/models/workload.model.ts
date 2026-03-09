export type WorkloadStatus = 'Draft' | 'Submitted' | 'Under_Review' | 'Approved' | 'Rejected';

export interface Workload {
  workloadId?: number;
  facultyId: number;
  departmentId?: number;
  semesterId: number;
  sessionId?: number;
  teachingHours: number;
  prepEvaluationHours: number;
  researchHours: number;
  adminHours: number;
  counselingHours: number;
  otherHours: number;
  totalWorkloadHours: number;
  workloadStatus: WorkloadStatus;
  facultyName?: string;
  departmentName?: string;
  hodRemarks?: string;
  createdAt?: string;
  submittedAt?: string;
}

export interface FacultyTimetableSlot {
  timetableSlotId: number;
  subjectSlnum?: number;
  semesterId?: number;
  dayOfWeek: number;
  dayName: string;
  startTime: string;
  endTime: string;
  weekNumber: number;
  subjectName: string;
  subjectCode: string;
  roomNumber: string;
  sectionName: string;
  courseName: string;
  programName: string;
  scheduledDate: string | null;
  attendanceMarked: boolean;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
}

export interface Session {
  sessionslnum: number;
  sessionName: string;
  isCurrent: boolean;
  sessionfrom?: number;
  sessionto?: number;
  sessiononefrom?: string;
  sessiononeto?: string;
}

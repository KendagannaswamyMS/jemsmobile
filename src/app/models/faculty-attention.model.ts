export interface CiePendingItem {
  id: number;
  subjectCode: string;
  subjectName: string;
  className: string;
  entryType: string;
  pendingCount: number;
  lastDate?: string;
  isCompleted: boolean;
  academicYear?: string;
  semesterType?: string;
  urgency: 'overdue' | 'due_soon' | 'normal';
  delayDays?: number;
}

export interface QpsInviteItem {
  slnum: number;
  subjectCode: number;
  subjectCodeName: string;
  subjectCodeTitle: string;
  questionpaperfor?: number;
  renumerationName?: string;
  qpsStatus?: number;
  qpsStatusName?: string;
  submittedon?: string;
  remarkifrejected?: string;
  actionNeeded: boolean;
}

export interface PendingLeaveItem {
  applicationId: number;
  employeeName: string;
  employeeCode: string;
  departmentName?: string;
  leaveTypeName: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  reason: string;
  appliedDate: string;
}

export interface UnmarkedAttendanceItem {
  time: string;
  end: string;
  code: string;
  title: string;
  room: string;
  slotId: number;
  subjectSlnum: number;
  sessionId: number;
}

export interface FacultyAttentionSummary {
  cieCount: number;
  qpsCount: number;
  leaveCount: number;
  unmarkedAttendanceCount: number;
  totalPendingCount: number;
  cieItems: CiePendingItem[];
  qpsItems: QpsInviteItem[];
  leaveItems: PendingLeaveItem[];
  unmarkedAttendanceItems: UnmarkedAttendanceItem[];
}

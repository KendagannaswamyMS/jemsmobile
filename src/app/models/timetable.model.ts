export type AttendanceStatus = 'present' | 'absent' | 'not_marked' | 'not_conducted' | 'upcoming';

export interface TimetableSlot {
  timetableSlotId: number;
  weekNumber: number | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  expectedDate: string | null;
  subjectSlnum: number | null;
  subjectName: string;
  subjectCode: string;
  roomNumber: string;
  activityType: string;
  facultyId: number;
  facultyName: string;
  facultyPhoto: string;
  scheduleId: number | null;
  scheduledDate: string | null;
  attendanceStatus: AttendanceStatus;
  isPresent: boolean | null;
  attendanceRemarks: string | null;
  topicNodeId: number | null;
  topicTitle: string | null;
  isTopicCompleted: boolean;
}

export interface WeekInfo {
  weekNumber: number;
  label: string;
  weekStartDate: string;
  weekEndDate: string;
}

export interface SubjectAttendance {
  subjectSlnum: number | null;
  subjectName: string;
  subjectCode: string;
  totalClasses: number;
  presentClasses: number;
  absentClasses: number;
  attendancePercentage: number;
  status: 'Good' | 'Low' | 'Critical';
  facultyName: string;
  facultyPhoto: string;
}

export interface AttendanceSummary {
  overallAttendancePercentage: number;
  overallTotal: number;
  overallPresent: number;
  overallAbsent: number;
  subjects: SubjectAttendance[];
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

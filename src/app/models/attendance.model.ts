export interface AttendanceStudentRaw {
  studentregistrationslnum: number;
  studentbasicsslnum: number;
  studentbasiccompletename: string;
  studentbasicusnnumber: string;
  studentregisternum: string;
}

export interface AttendanceSectionResponse {
  vsectionId: number;
  vsectionName: string;
  students: AttendanceStudentRaw[];
}

export interface AttendanceEntry {
  studentregistrationslnum: number;
  studentbasicsslnum: number;
  name: string;
  usn: string;
  registerNum: string;
  isPresent: boolean;
}

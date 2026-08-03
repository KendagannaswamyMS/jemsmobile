export interface TimetableSession {
  sessionslnum: number;
  sessionname: string;
  iscurrentsession: boolean;
}

export interface SessionWeek {
  weekNumber: number;
  weekStartDate: string;
  weekEndDate: string;
  label: string;
}

export interface TimetableSlot {
  timetableslotslnum: number;
  dayofweek: number;
  starttime: string;
  endtime: string;
  courseName: string;
  courseCode: string;
  activitytype: string;
  roomnumber: string;
  isShared: boolean;
  sharedWith: any[];
  subjectslnum?: number;
  subjectSlnum?: number;
}

export interface DayGroup {
  dayofweek: number;
  label: string;
  date: string;
  slots: TimetableSlot[];
}

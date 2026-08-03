export interface BiometricLog {
  logdatetime: string;
  devicename: string;
  status: 'In' | 'Out' | string;
}

export interface DayLog {
  date: string;
  logs: BiometricLog[];
  totalHours: string;
  isCurrentOrFuture: boolean;
}

export interface BiometricStatistics {
  daysInRange: number;
  daysPresent: number;
  attendancePercentage: number;
  totalWorkHours: number;
  averageHoursPerDay: number;
  currentDate: string;
}

export interface BiometricRecord {
  userregistraionslnum: number;
  salutationName: string;
  userFName: string;
  userLName: string;
  userMname: string;
  userMobileNumber: string;
  userProfilepic: string;
  useremployeecode: string;
  logs: DayLog[];
  statistics: BiometricStatistics;
}

import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ToastController, LoadingController } from '@ionic/angular';
import { environment } from 'src/environments/environment';
import { AuthService } from 'src/app/core/services/auth.service';

export interface MonthlyRecord {
  userId: number;
  userFName: string;
  userCode: string;
  departmentName?: string;
  designationName?: string;
  profilePic?: string;
  date: string;
  dayOfWeek?: string;
  attendanceStatus?: string;
  totalHours?: string;
  hoursDetails?: {
    in: string;
    out: string;
    total?: string;
  };
  isOnLeave?: boolean;
  leaveType?: string;
  leaveCode?: string;
  isSunday?: boolean;
  isHoliday?: boolean;
  specialDayDescription?: string;
}

@Component({
  selector: 'app-monthly-attendance',
  templateUrl: './monthly-attendance.page.html',
  styleUrls: ['./monthly-attendance.page.scss'],
  standalone: false
})
export class MonthlyAttendancePage implements OnInit {
  loading = false;
  
  selectedMonth = new Date().getMonth() + 1;
  selectedYear = new Date().getFullYear();
  selectedDepartmentId: number = -1;

  months = [
    { value: 1, name: 'January' },
    { value: 2, name: 'February' },
    { value: 3, name: 'March' },
    { value: 4, name: 'April' },
    { value: 5, name: 'May' },
    { value: 6, name: 'June' },
    { value: 7, name: 'July' },
    { value: 8, name: 'August' },
    { value: 9, name: 'September' },
    { value: 10, name: 'October' },
    { value: 11, name: 'November' },
    { value: 12, name: 'December' }
  ];

  years: number[] = [];
  departments: { id: number; name: string }[] = [];

  records: MonthlyRecord[] = [];
  
  // Summary Indicators
  totalDays = 0;
  presentCount = 0;
  absentCount = 0;
  leaveCount = 0;
  holidayCount = 0;
  attendancePercentage = 0;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) {
    const curYear = new Date().getFullYear();
    for (let y = curYear; y >= curYear - 5; y--) {
      this.years.push(y);
    }
  }

  ngOnInit() {
    this.loadDepartments();
    this.fetchMonthlyAttendance();
  }

  loadDepartments() {
    this.http.get<any[]>(`${environment.apiUrl}department/getdepartments`).subscribe({
      next: (res) => {
        if (Array.isArray(res)) {
          this.departments = res.map(d => ({
            id: d.departmentslnum || d.departmentId || d.id,
            name: d.departmentName || d.name
          })).filter(d => d.id && d.name);
        }
      },
      error: () => {}
    });
  }

  async fetchMonthlyAttendance() {
    const user = this.authService.getCurrentUser();
    if (!user || !user.userId) return;

    this.loading = true;
    const payload = {
      UserId: user.userId,
      departmentID: this.selectedDepartmentId === -1 ? user.departmentId || -1 : this.selectedDepartmentId,
      month: Number(this.selectedMonth),
      year: Number(this.selectedYear)
    };

    const loader = await this.loadingCtrl.create({
      message: 'Loading your biometric attendance...',
      spinner: 'crescent'
    });
    await loader.present();

    // Primary: Call individual user monthly attendance endpoint
    this.http.post<any>(`${environment.apiUrl}biometriclog/getmonthlyattendancerecordsforuser`, payload).subscribe({
      next: async (res) => {
        await loader.dismiss();
        this.loading = false;
        if (res) {
          this.processApiResponse(res, user);
        } else {
          this.fetchDepartmentReportFiltered(payload, user);
        }
      },
      error: async () => {
        await loader.dismiss();
        this.fetchDepartmentReportFiltered(payload, user);
      }
    });
  }

  private fetchDepartmentReportFiltered(payload: any, user: any) {
    this.http.post<any>(`${environment.apiUrl}biometriclog/getcurrentmonthattendancereport`, payload).subscribe({
      next: (res) => {
        this.loading = false;
        if (res) {
          this.processApiResponse(res, user);
        } else {
          this.records = [];
          this.calculateSummary(null);
        }
      },
      error: () => {
        this.loading = false;
        this.records = [];
        this.calculateSummary(null);
      }
    });
  }

  private processApiResponse(res: any, user: any) {
    let rawDailyList: any[] = [];
    let summaryObj: any = null;

    // Structure A: Array of user objects [ { averageDetails: {...}, attendanceDetails: [...] } ]
    if (Array.isArray(res) && res.length > 0) {
      const first = res[0];
      if (first && typeof first === 'object') {
        if (Array.isArray(first.attendanceDetails)) {
          rawDailyList = first.attendanceDetails;
          summaryObj = first.averageDetails || first;
        } else if (Array.isArray(first.records)) {
          rawDailyList = first.records;
          summaryObj = first;
        } else {
          // Flat array of daily records (Structure B)
          rawDailyList = res;
        }
      }
    } else if (res && typeof res === 'object') {
      // Structure A single object: { averageDetails: {...}, attendanceDetails: [...] }
      if (Array.isArray(res.attendanceDetails)) {
        rawDailyList = res.attendanceDetails;
        summaryObj = res.averageDetails || res;
      } else if (Array.isArray(res.data)) {
        rawDailyList = res.data;
      } else if (Array.isArray(res.result)) {
        rawDailyList = res.result;
      } else if (Array.isArray(res.$values)) {
        rawDailyList = res.$values;
      }
    }

    if (!rawDailyList || rawDailyList.length === 0) {
      this.records = [];
      this.calculateSummary(summaryObj);
      return;
    }

    this.records = rawDailyList.map(r => {
      const dateStr = this.formatDate(r.date || r.logdatetime || r.logDate || r.attendanceDate);
      
      const inTime = r.firstLoginTime || r.hoursDetails?.in || r.inTime || r.loginTime || r.firstIn || r.in || '--:--';
      const outTime = r.lastLogoutTime || r.hoursDetails?.out || r.outTime || r.logoutTime || r.lastOut || r.out || '--:--';
      const totalHrs = r.totalHours || r.hoursDetails?.total || r.workingHours || r.duration || (inTime !== '--:--' ? '8.5' : '--');

      const isSun = r.isSunday ?? (this.getDayOfWeek(dateStr) === 'Sun');
      const isHol = r.isHoliday ?? false;
      const isLve = r.isOnLeave ?? false;

      let rawStatus = (r.status || r.attendanceStatus || r.statusName || '').toString().toUpperCase();
      let finalStatus = 'ABSENT';

      if (rawStatus.includes('PRES') || rawStatus === 'P' || r.hasValidAttendance || inTime !== '--:--') {
        finalStatus = 'PRESENT';
      } else if (isLve || rawStatus.includes('LEAV') || rawStatus === 'L') {
        finalStatus = 'LEAVE';
      } else if (isSun || isHol || rawStatus.includes('HOL') || rawStatus.includes('SUN') || rawStatus === 'H') {
        finalStatus = 'HOLIDAY';
      } else if (rawStatus.includes('ABS') || rawStatus === 'A') {
        finalStatus = 'ABSENT';
      }

      return {
        userId: r.userId || user?.userId || 0,
        userFName: r.userFName || r.firstName || user?.name || 'Faculty',
        userCode: r.userCode || (user as any)?.userCode || '',
        departmentName: r.departmentName || '',
        designationName: r.designationName || '',
        profilePic: r.profilePic || '',
        date: dateStr,
        dayOfWeek: this.getDayOfWeek(dateStr, r.dayOfWeek),
        attendanceStatus: finalStatus,
        totalHours: totalHrs,
        hoursDetails: {
          in: inTime,
          out: outTime
        },
        isOnLeave: isLve || finalStatus === 'LEAVE',
        leaveType: r.leaveType || r.leaveCode,
        leaveCode: r.leaveCode,
        isSunday: isSun,
        isHoliday: isHol || finalStatus === 'HOLIDAY',
        specialDayDescription: r.specialDayDescription || r.reason
      };
    });

    this.calculateSummary(summaryObj);
  }

  formatDate(val: any): string {
    if (!val) return '';
    if (typeof val === 'string') return val.split('T')[0];
    try {
      const d = new Date(val);
      return d.toISOString().split('T')[0];
    } catch {
      return String(val);
    }
  }

  calculateSummary(summaryObj: any) {
    this.totalDays = this.records.length;
    this.presentCount = this.records.filter(r => r.attendanceStatus === 'PRESENT').length;
    this.leaveCount = this.records.filter(r => r.attendanceStatus === 'LEAVE').length;
    this.holidayCount = this.records.filter(r => r.attendanceStatus === 'HOLIDAY' || r.isSunday || r.isHoliday).length;
    this.absentCount = this.records.filter(r => r.attendanceStatus === 'ABSENT').length;

    if (summaryObj) {
      if (summaryObj.presentDays !== undefined) this.presentCount = Number(summaryObj.presentDays);
      if (summaryObj.absentDays !== undefined) this.absentCount = Number(summaryObj.absentDays);
      if (summaryObj.totalDays !== undefined) this.totalDays = Number(summaryObj.totalDays);
      if (summaryObj.attendancePercentage !== undefined) {
        this.attendancePercentage = Number(summaryObj.attendancePercentage);
        return;
      }
    }

    const workingDays = Math.max(1, this.totalDays - this.holidayCount);
    this.attendancePercentage = Math.min(100, Math.round((this.presentCount / workingDays) * 100));
  }

  getDayOfWeek(dateStr: string, dayStr?: string): string {
    if (dayStr) {
      const clean = dayStr.trim().toUpperCase();
      if (clean.startsWith('MON')) return 'MON';
      if (clean.startsWith('TUE')) return 'TUE';
      if (clean.startsWith('WED')) return 'WED';
      if (clean.startsWith('THU')) return 'THU';
      if (clean.startsWith('FRI')) return 'FRI';
      if (clean.startsWith('SAT')) return 'SAT';
      if (clean.startsWith('SUN')) return 'SUN';
    }
    if (dateStr) {
      try {
        const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          return days[d.getDay()];
        }
      } catch {}
    }
    return '';
  }

  async showToast(msg: string, color: 'success' | 'warning' | 'danger' | 'primary' = 'primary') {
    const toast = await this.toastCtrl.create({
      message: msg,
      duration: 3000,
      position: 'bottom',
      color: color
    });
    await toast.present();
  }
}

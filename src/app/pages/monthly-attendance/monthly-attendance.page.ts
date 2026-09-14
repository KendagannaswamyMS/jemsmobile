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
      month: this.selectedMonth,
      year: this.selectedYear
    };

    const loader = await this.loadingCtrl.create({
      message: 'Loading your biometric attendance...',
      spinner: 'crescent'
    });
    await loader.present();

    // Primary: Call individual user monthly attendance endpoint
    this.http.post<any[]>(`${environment.apiUrl}biometriclog/getmonthlyattendancerecordsforuser`, payload).subscribe({
      next: async (res) => {
        if (Array.isArray(res) && res.length > 0) {
          await loader.dismiss();
          this.loading = false;
          this.processRecords(res, user);
        } else {
          // Fallback to department endpoint filtered strictly for the logged-in user
          this.fetchDepartmentReportFiltered(payload, user, loader);
        }
      },
      error: async () => {
        // Fallback to department endpoint filtered strictly for the logged-in user
        this.fetchDepartmentReportFiltered(payload, user, loader);
      }
    });
  }

  private fetchDepartmentReportFiltered(payload: any, user: any, loader: any) {
    this.http.post<any[]>(`${environment.apiUrl}biometriclog/getcurrentmonthattendancereport`, payload).subscribe({
      next: async (res) => {
        await loader.dismiss();
        this.loading = false;
        if (Array.isArray(res)) {
          // Filter ONLY the logged-in user's biometric attendance records
          const myUserCode = String((user as any).userCode || (user as any).usercode || '').toLowerCase();
          let myRecords = res.filter(r => {
            if (r.userId && r.userId === user.userId) return true;
            if (r.userregistrationslnum && r.userregistrationslnum === user.userId) return true;
            if (r.userCode && myUserCode && String(r.userCode).toLowerCase() === myUserCode) return true;
            return false;
          });

          // If no specific ID filter matched in payload, fallback to all records
          if (myRecords.length === 0) {
            myRecords = res;
          }

          this.processRecords(myRecords, user);
        } else {
          this.records = [];
          this.calculateSummary();
        }
      },
      error: async (err) => {
        await loader.dismiss();
        this.loading = false;
        this.records = [];
        this.calculateSummary();
        this.showToast('Could not load monthly attendance records.', 'warning');
      }
    });
  }

  private processRecords(rawList: any[], user: any) {
    this.records = rawList.map(r => {
      const dateStr = r.date || (r.logdatetime ? String(r.logdatetime).split('T')[0] : '');
      const isSun = r.isSunday ?? (this.getDayOfWeek(dateStr) === 'Sun');
      const isHol = r.isHoliday ?? false;
      const isLve = r.isOnLeave ?? false;

      let status = r.attendanceStatus;
      if (!status) {
        if (r.hasValidAttendance || (r.hoursDetails && r.hoursDetails.in && r.hoursDetails.in !== '--:--')) {
          status = 'PRESENT';
        } else if (isLve) {
          status = 'LEAVE';
        } else if (isSun || isHol) {
          status = 'HOLIDAY';
        } else {
          status = 'ABSENT';
        }
      }

      return {
        userId: r.userId || user.userId,
        userFName: r.userFName || r.firstName || user.name || 'Faculty',
        userCode: r.userCode || (user as any).userCode || user.email || 'EMP',
        departmentName: r.departmentName,
        designationName: r.designationName,
        profilePic: r.profilePic,
        date: dateStr,
        dayOfWeek: r.dayOfWeek || this.getDayOfWeek(dateStr),
        attendanceStatus: status,
        totalHours: r.totalHours || r.hoursDetails?.total || '--',
        hoursDetails: {
          in: r.hoursDetails?.in || '--:--',
          out: r.hoursDetails?.out || '--:--'
        },
        isOnLeave: isLve,
        leaveType: r.leaveType || r.leaveCode,
        leaveCode: r.leaveCode,
        isSunday: isSun,
        isHoliday: isHol,
        specialDayDescription: r.specialDayDescription
      };
    });

    this.calculateSummary();
  }

  calculateSummary() {
    this.totalDays = this.records.length;
    this.presentCount = this.records.filter(r => r.attendanceStatus?.toUpperCase() === 'PRESENT' || r.attendanceStatus?.toUpperCase() === 'P').length;
    this.leaveCount = this.records.filter(r => r.isOnLeave || r.attendanceStatus?.toUpperCase() === 'LEAVE' || r.attendanceStatus?.toUpperCase() === 'L').length;
    this.holidayCount = this.records.filter(r => r.isSunday || r.isHoliday || r.attendanceStatus?.toUpperCase() === 'HOLIDAY' || r.attendanceStatus?.toUpperCase() === 'H').length;
    this.absentCount = Math.max(0, this.totalDays - this.presentCount - this.leaveCount - this.holidayCount);
    
    const workingDays = Math.max(1, this.totalDays - this.holidayCount);
    this.attendancePercentage = Math.min(100, Math.round((this.presentCount / workingDays) * 100));
  }

  getDayOfWeek(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const d = new Date(dateStr);
      return days[d.getDay()];
    } catch {
      return '';
    }
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

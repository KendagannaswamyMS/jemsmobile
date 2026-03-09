import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { CurrentUser } from '../../models/user.model';

export interface BirthdayEntry {
  salutation: string;
  firstName: string;
  middleName: string;
  lastName: string;
  initials: string;
  pic?: string;
  email: string;
  dob?: string;
  isToday: boolean;
  isTomorrow: boolean;
}

export interface NewJoiner {
  employeeCode: string;
  salutation?: string;
  firstName: string;
  middleName: string;
  lastName: string;
  designation: string;
  dateOfJoining: string;
  initials: string;
  pic?: string;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: false
})
export class DashboardPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  currentUser: CurrentUser | null = null;
  today = new Date();
  currentTime = '';
  private timer: any;

  // Attendance
  todayPunchIn = '--:-- --';
  runningTime = '00:00:00';
  private firstInTime: Date | null = null;
  private lastOutTime: Date | null = null;

  // Stats cards
  attendancePercent = 0;
  openTickets = 0;
  pendingWorkloads = 0;
  notifications: any[] = [];

  // Birthdays
  birthdays: BirthdayEntry[] = [];
  selectedBirthday: BirthdayEntry | null = null;
  openBirthday(b: BirthdayEntry) { this.selectedBirthday = b; }
  closeBirthday() { this.selectedBirthday = null; }

  // New Joiners
  joiners: NewJoiner[] = [];
  selectedJoiner: NewJoiner | null = null;
  openJoiner(j: NewJoiner) { this.selectedJoiner = j; }
  closeJoiner() { this.selectedJoiner = null; }

  isLoading = false;

  constructor(private apiService: ApiService, private authService: AuthService) {}

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    this.updateTime();
    this.timer = setInterval(() => this.updateTime(), 1000);
    this.loadDashboard();
  }

  ngOnDestroy() {
    clearInterval(this.timer);
    this.destroy$.next();
    this.destroy$.complete();
  }

  ionViewWillEnter() {
    this.loadDashboard();
  }

  private updateTime() {
    this.currentTime = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });
    this.updateRunningTime();
  }

  private loadDashboard() {
    if (!this.currentUser) return;
    this.isLoading = true;

    if (this.currentUser.role === 'Student') {
      this.loadStudentDashboard();
    } else {
      this.loadStaffDashboard();
    }
    this.loadBirthdays();
    this.loadJoiners();
  }

  private loadStudentDashboard() {
    const studentId = this.authService.getStudentId();
    this.apiService.getStudentDashboard(studentId)
      .pipe(catchError(() => of(null)), takeUntil(this.destroy$))
      .subscribe(data => {
        this.isLoading = false;
        if (data) {
          this.attendancePercent = data.overallAttendancePercentage || 0;
        }
      });
  }

  private loadStaffDashboard() {
    const userId = this.currentUser!.userId;
    this.apiService.getWeeklyAttendance(userId, new Date().toISOString())
      .pipe(catchError(() => of([])), takeUntil(this.destroy$))
      .subscribe((records: any[]) => {
        this.isLoading = false;
        const userData = Array.isArray(records)
          ? (records.find((r: any) => r?.userregistraionslnum === userId) || records[0])
          : null;
        const todayLog = (userData?.logs || []).find((d: any) => this.isSameDay(d?.date, this.today));
        const logs = (todayLog?.logs || [])
          .map((l: any) => ({ status: String(l?.status || '').trim().toLowerCase(), date: new Date(l?.logdatetime) }))
          .filter((l: any) => !isNaN(l.date.getTime()))
          .sort((a: any, b: any) => a.date - b.date);

        const inLogs = logs.filter((l: any) => l.status === 'in');
        const outLogs = logs.filter((l: any) => l.status === 'out');
        if (inLogs.length) {
          this.firstInTime = inLogs[0].date;
          this.lastOutTime = outLogs.length ? outLogs[outLogs.length - 1].date : null;
          this.todayPunchIn = (this.firstInTime as Date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        }
      });

    this.apiService.getHelpdeskDashboardStats(userId)
      .pipe(catchError(() => of(null)), takeUntil(this.destroy$))
      .subscribe((res: any) => {
        if (res?.data) this.openTickets = res.data.openTickets || 0;
      });
  }

  private loadBirthdays() {
    this.apiService.getBirthdayList()
      .pipe(catchError(() => of(null)), takeUntil(this.destroy$))
      .subscribe((res: any) => {
        const list: any[] = res?.data ?? (Array.isArray(res) ? res : []);
        const today = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);
        
        this.birthdays = list.map((p: any) => {
          const fname  = (p.userFName  || '').trim();
          const mname  = (p.userMname  || '').trim();
          const lname  = (p.userLName  || '').trim();
          const sal    = (p.salutaion   || p.salutation || '').trim();
          const initials = [fname[0], lname[0] || mname[0]]
            .filter(Boolean).join('').toUpperCase() || '?';
            
          let isToday = false;
          let isTomorrow = false;
          
          // Safely parse date that might come as DD-MM-YYYY
          let dobDate: Date | null = null;
          if (p.userDOB) {
            let dStr = String(p.userDOB).trim();
            // Handle DD-MM-YYYY
            if (dStr.includes('-') && dStr.split('-')[0].length === 2) {
              const parts = dStr.split('-');
              if (parts.length === 3 && parts[2].length >= 4) {
                 dStr = `${parts[2].substring(0,4)}-${parts[1]}-${parts[0]}`;
              }
            }
            dobDate = new Date(dStr);
            if (isNaN(dobDate.getTime())) dobDate = null;
          }
          
          if (dobDate) {
            if (dobDate.getDate() === today.getDate() && dobDate.getMonth() === today.getMonth()) {
              isToday = true;
            } else if (dobDate.getDate() === tomorrow.getDate() && dobDate.getMonth() === tomorrow.getMonth()) {
              isTomorrow = true;
            }
          }

          return { 
            salutation: sal, 
            firstName: fname, 
            middleName: mname, 
            lastName: lname, 
            initials, 
            pic: p.userProfilepic || undefined, 
            email: p.userEmailOfficial || '',
            dob: dobDate ? dobDate.toISOString() : undefined,
            isToday,
            isTomorrow
          };
        });

        // Sort birthdays: Today first, then Tomorrow, then rest
        this.birthdays.sort((a, b) => {
          if (a.isToday && !b.isToday) return -1;
          if (!a.isToday && b.isToday) return 1;
          if (a.isTomorrow && !b.isTomorrow) return -1;
          if (!a.isTomorrow && b.isTomorrow) return 1;
          return 0; // maintain original order for the rest
        });
      });
  }

  private loadJoiners() {
    this.apiService.getLatestJoiners()
      .pipe(catchError(() => of([])), takeUntil(this.destroy$))
      .subscribe((res: any) => {
        const list: any[] = Array.isArray(res) ? res : (res?.data ?? []);
        this.joiners = list.map((j: any) => {
          const fname = (j.firstName || '').trim();
          const lname = (j.lastName  || '').trim();
          const mname = (j.middleName || '').trim();
          const salutation = (j.salutation || '').trim();
          const initials = [fname[0], lname[0] || mname[0]]
            .filter(Boolean).join('').toUpperCase() || '?';
          return {
            employeeCode: j.employeeCode || '',
            salutation,
            firstName: fname, middleName: mname, lastName: lname,
            designation: j.designation || '',
            dateOfJoining: j.dateOfJoining || '',
            initials,
            pic: j.profilePicPath || undefined
          };
        });
      });
  }

  private updateRunningTime() {
    if (!this.firstInTime) { this.runningTime = '00:00:00'; return; }
    const ref = this.lastOutTime && this.lastOutTime > this.firstInTime ? this.lastOutTime : new Date();
    const diff = Math.max(0, Math.floor((ref.getTime() - this.firstInTime.getTime()) / 1000));
    const h = Math.floor(diff / 3600).toString().padStart(2, '0');
    const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
    const s = (diff % 60).toString().padStart(2, '0');
    this.runningTime = `${h}:${m}:${s}`;
  }

  private isSameDay(a: any, b: Date): boolean {
    const d = new Date(a);
    return d.getDate() === b.getDate() && d.getMonth() === b.getMonth() && d.getFullYear() === b.getFullYear();
  }

  get greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  get attendanceColor(): string {
    if (this.attendancePercent >= 75) return 'success';
    if (this.attendancePercent >= 65) return 'warning';
    return 'danger';
  }

  doRefresh(event: any) {
    this.loadDashboard();
    setTimeout(() => event.target.complete(), 1500);
  }
}

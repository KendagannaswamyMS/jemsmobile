import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { filter, take } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { AcademicService, ClassScheduleItem } from '../../core/services/academic.service';
import { FacultyAttentionService } from '../../core/services/faculty-attention.service';
import { FacultyAttentionSummary, CiePendingItem, QpsInviteItem, PendingLeaveItem } from '../../models/faculty-attention.model';
import { CurrentUser } from '../../models/user.model';
import { BirthdayUser } from '../../models/birthday.model';
import { BiometricRecord, DayLog } from '../../models/biometric.model';
import { LatestJoiner } from '../../models/joiner.model';
import { environment } from 'src/environments/environment';

import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false
})
export class HomePage implements OnInit, OnDestroy {
  user: CurrentUser | null = null;
  unreadNotificationsCount = 0;

  // Faculty Attention Action Center
  facultyAttention: FacultyAttentionSummary | null = null;
  attentionLoading = false;

  // Student Timetable & Next-Class
  studentScheduleLoading = false;
  studentScheduleError = false;
  studentTodayClasses: ClassScheduleItem[] = [];
  studentNextClass: ClassScheduleItem | null = null;

  // Faculty Teaching Schedule & Next-Class
  facultyScheduleLoading = false;
  facultyScheduleError = false;
  facultyTodayClasses: ClassScheduleItem[] = [];
  facultyNextClass: ClassScheduleItem | null = null;

  // Biometric
  biometric: BiometricRecord | null = null;
  bioLoading = true;
  bioFailed = false;
  bioImgError = false;
  runningTime = '';
  private timerInterval: any;

  // Latest Joiners
  latestJoiners: LatestJoiner[] = [];
  selectedJoiner: LatestJoiner | null = null;
  joinerImgError = false;

  // Birthdays
  todayBirthdays: BirthdayUser[] = [];
  tomorrowBirthdays: BirthdayUser[] = [];
  selectedUser: BirthdayUser | null = null;
  selectedImgError = false;

  showStudentProfileModal = false;

  constructor(
    public authService: AuthService,
    public notificationService: NotificationService,
    private academicService: AcademicService,
    private facultyAttentionService: FacultyAttentionService,
    private http: HttpClient
  ) {}

  get isStudent(): boolean {
    return this.authService.isStudent();
  }

  get isDocRequestOnly(): boolean {
    return this.authService.isDocRequestOnly();
  }

  get isHod(): boolean {
    return this.authService.isHod();
  }

  get isFaculty(): boolean {
    return this.authService.isFaculty();
  }

  get isNonTeaching(): boolean {
    return this.authService.isNonTeaching();
  }

  get roleBadge(): string {
    if (this.isHod) return 'HOD';
    if (this.isFaculty) return 'FACULTY';
    if (this.isNonTeaching) return 'STAFF';
    if (this.authService.isAdmin()) return 'ADMIN';
    return 'EMPLOYEE';
  }

  ngOnInit() {
    this.notificationService.unreadCount$.subscribe(c => {
      this.unreadNotificationsCount = c;
    });

    this.authService.user$.subscribe(u => {
      this.user = u;
      if (u) {
        if (this.authService.isStudent()) {
          this.loadStudentSchedule(u.userId);
        } else {
          this.loadBiometric(u.userId);
          this.loadBirthdays();
          this.loadLatestJoiners();
          if (this.authService.isFaculty() || this.authService.isHod()) {
            this.loadFacultySchedule(u.userId);
            this.loadFacultyAttention(u.userId, this.authService.isHod(), this.authService.isFaculty(), u.departmentId);
          }
        }
      }
    });
  }

  // ── Biometric ──────────────────────────────────────────────────────────────

  loadBiometric(userId: number) {
    this.bioLoading = true;
    this.bioFailed = false;
    this.http.post<BiometricRecord[]>(
      `${environment.apiUrl}biometriclog/getweeklyattendancerecords`,
      { UserId: userId, selectedDate: new Date().toISOString() }
    ).subscribe({
      next: res => {
        this.biometric = res?.[0] || null;
        this.bioLoading = false;
        this.bioFailed = false;
        this.startTimer();
      },
      error: () => {
        this.bioLoading = false;
        this.bioFailed = true;
      }
    });
  }

  retryBiometric() {
    if (this.user?.userId) {
      this.loadBiometric(this.user.userId);
    }
  }

  get todayLog(): DayLog | null {
    if (!this.biometric?.logs?.length) return null;
    const today = new Date().toDateString();
    return this.biometric.logs.find(l => new Date(l.date).toDateString() === today) || null;
  }

  get todayDateLabel(): string {
    return new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  // First "In" punch time, e.g. "10:13 AM"
  firstIn(day: DayLog): string {
    const entry = day.logs.find(l => l.status === 'In');
    if (!entry) return '—';
    return new Date(entry.logdatetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  // Last "Out" punch time
  lastOut(day: DayLog): string {
    const outs = day.logs.filter(l => l.status === 'Out');
    if (!outs.length) return '—';
    return new Date(outs[outs.length - 1].logdatetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  isStillIn(day: DayLog): boolean {
    return day.logs.some(l => l.status === 'In') && !day.logs.some(l => l.status === 'Out');
  }

  private startTimer() {
    this.updateRunningTime();
    this.timerInterval = setInterval(() => this.updateRunningTime(), 1000);
  }

  private updateRunningTime() {
    const day = this.todayLog;
    if (!day?.logs?.length) { this.runningTime = ''; return; }
    const firstInLog = day.logs.find(l => l.status === 'In');
    if (!firstInLog) { this.runningTime = ''; return; }
    const outs = day.logs.filter(l => l.status === 'Out');
    const end = outs.length ? new Date(outs[outs.length - 1].logdatetime).getTime() : Date.now();
    const elapsed = end - new Date(firstInLog.logdatetime).getTime();
    const h = Math.floor(elapsed / 3600000);
    const m = Math.floor((elapsed % 3600000) / 60000);
    const s = Math.floor((elapsed % 60000) / 1000);
    this.runningTime = `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  }

  ngOnDestroy() {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  // ── Latest Joiners ─────────────────────────────────────────────────────────

  private loadLatestJoiners() {
    this.http.get<LatestJoiner[]>(`${environment.apiUrl}UserMaster/getthelatest`)
      .subscribe({ next: res => (this.latestJoiners = res || []), error: () => {} });
  }

  joinerName(j: LatestJoiner): string {
    return [j.firstName, j.middleName, j.lastName].filter(s => s?.trim()).join(' ').trim();
  }

  joinerInitials(j: LatestJoiner): string {
    const f = j.firstName?.trim()[0] || '';
    const l = j.lastName?.trim()[0] || j.firstName?.trim().split(' ')?.[1]?.[0] || '';
    return (f + l).toUpperCase() || '?';
  }

  joiningDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // ── Birthdays ──────────────────────────────────────────────────────────────

  private loadBirthdays() {
    this.http.get<{ status: string; data: BirthdayUser[] }>(
      `${environment.apiUrl}UserMaster/getuserbirthdaylist`
    ).subscribe({
      next: res => {
        const list = res?.data || [];
        this.todayBirthdays    = list.filter(b => this.matchesDay(b.userDoB, 0));
        this.tomorrowBirthdays = list.filter(b => this.matchesDay(b.userDoB, 1));
      },
      error: () => {}
    });
  }

  private matchesDay(dob: string, offset: number): boolean {
    const ref = new Date();
    ref.setDate(ref.getDate() + offset);
    const d = new Date(dob);
    return d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
  }

  fullName(b: BirthdayUser): string {
    return [b.salutaion, b.userFName, b.userMname, b.userLName].filter(Boolean).join(' ');
  }

  initials(b: BirthdayUser): string {
    return ((b.userFName?.[0] || '') + (b.userLName?.[0] || b.userMname?.[0] || '')).toUpperCase() || '?';
  }

  openPopup(b: BirthdayUser) { this.selectedUser = b; this.selectedImgError = false; }
  closePopup() { this.selectedUser = null; }

  openJoinerPopup(j: LatestJoiner) { this.selectedJoiner = j; this.joinerImgError = false; }
  closeJoinerPopup() { this.selectedJoiner = null; }

  openStudentProfile() { this.showStudentProfileModal = true; }
  closeStudentProfile() { this.showStudentProfileModal = false; }

  // ── Student Schedule & Next Class ──────────────────────────────────────────

  loadStudentSchedule(studentSlnum?: number) {
    const slnum = studentSlnum || this.user?.userId;
    if (!slnum) return;

    this.studentScheduleLoading = true;
    this.studentScheduleError = false;

    this.academicService.getSessions().subscribe({
      next: (sessions) => {
        const cur = sessions.find(s => s.iscurrentsession) || sessions[0];
        if (!cur) {
          this.studentScheduleLoading = false;
          return;
        }

        this.academicService.getSessionWeeks(cur.sessionslnum).subscribe({
          next: (weeks) => {
            const today = new Date();
            const curWeek = (weeks || []).find(w => {
              const s = new Date(w.weekStartDate);
              const e = new Date(w.weekEndDate);
              return today >= s && today <= e;
            }) || (weeks || [])[0];

            const weekNum = curWeek ? curWeek.weekNumber : undefined;

            this.academicService.getStudentTimetable(slnum, cur.sessionslnum, weekNum).subscribe({
              next: (res) => {
                const allSlots: any[] = res?.slots ?? (Array.isArray(res) ? res : []);
                const dayOfWeek = today.getDay();
                const todaySlots = allSlots.filter(s => Number(s.dayOfWeek ?? s.dayofweek ?? 0) === dayOfWeek);

                this.studentTodayClasses = this.academicService.computeClassSchedule(todaySlots);
                this.studentNextClass = this.academicService.findNextClass(this.studentTodayClasses);
                this.studentScheduleLoading = false;
              },
              error: () => {
                this.studentScheduleLoading = false;
                this.studentScheduleError = true;
              }
            });
          },
          error: () => {
            this.studentScheduleLoading = false;
            this.studentScheduleError = true;
          }
        });
      },
      error: () => {
        this.studentScheduleLoading = false;
        this.studentScheduleError = true;
      }
    });
  }

  // ── Faculty Schedule & Next Class ──────────────────────────────────────────

  loadFacultySchedule(facultyUserId?: number) {
    const userId = facultyUserId || this.user?.userId;
    if (!userId) return;

    this.facultyScheduleLoading = true;
    this.facultyScheduleError = false;

    this.academicService.getSessions().subscribe({
      next: (sessions) => {
        const cur = sessions.find(s => s.iscurrentsession) || sessions[0];
        if (!cur) {
          this.facultyScheduleLoading = false;
          return;
        }

        this.academicService.getSessionWeeks(cur.sessionslnum).subscribe({
          next: (weeks) => {
            const today = new Date();
            const curWeek = (weeks || []).find(w => {
              const s = new Date(w.weekStartDate);
              const e = new Date(w.weekEndDate);
              return today >= s && today <= e;
            }) || (weeks || [])[0];

            const weekNum = curWeek ? curWeek.weekNumber : undefined;

            this.academicService.getFacultyTimetable(userId, cur.sessionslnum, weekNum).subscribe({
              next: (slots) => {
                const dayOfWeek = today.getDay();
                const todaySlots = (slots || []).filter(s => Number(s.dayofweek ?? (s as any).dayOfWeek ?? 0) === dayOfWeek);

                this.facultyTodayClasses = this.academicService.computeClassSchedule(todaySlots);
                this.facultyNextClass = this.academicService.findNextClass(this.facultyTodayClasses);
                this.facultyScheduleLoading = false;
              },
              error: () => {
                this.facultyScheduleLoading = false;
                this.facultyScheduleError = true;
              }
            });
          },
          error: () => {
            this.facultyScheduleLoading = false;
            this.facultyScheduleError = true;
          }
        });
      },
      error: () => {
        this.facultyScheduleLoading = false;
        this.facultyScheduleError = true;
      }
    });
  }

  // ── Faculty Attention Center ──────────────────────────────────────────────

  loadFacultyAttention(userId: number, isHod: boolean, isFaculty: boolean, departmentId?: number) {
    this.attentionLoading = true;
    this.facultyAttentionService.getFacultyAttentionSummary(userId, isHod, isFaculty, departmentId).subscribe({
      next: (summary) => {
        // Find unmarked past classes for today
        const unmarked = this.facultyTodayClasses.filter(c => c.status === 'done' && !c.marked);
        summary.unmarkedAttendanceCount = unmarked.length;
        summary.totalPendingCount += unmarked.length;

        this.facultyAttention = summary;
        this.attentionLoading = false;
      },
      error: () => {
        this.attentionLoading = false;
      }
    });
  }

  get hasAttentionItems(): boolean {
    return !!(this.facultyAttention && this.facultyAttention.totalPendingCount > 0);
  }
}

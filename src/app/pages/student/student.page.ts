import { Component, OnInit } from '@angular/core';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import {
  TimetableSlot, WeekInfo, SubjectAttendance, AttendanceSummary,
  AttendanceStatus, DAY_NAMES
} from '../../models/timetable.model';

@Component({
  selector: 'app-student',
  templateUrl: './student.page.html',
  styleUrls: ['./student.page.scss'],
  standalone: false
})
export class StudentPage implements OnInit {
  activeTab: 'timetable' | 'attendance' = 'timetable';
  isLoading = false;
  error: string | null = null;

  studentId = 0;
  sessions: any[] = [];
  selectedSessionId: number | null = null;

  weeks: WeekInfo[] = [];
  selectedWeek: number | null = null;
  slotsByDay: { day: number; dayName: string; slots: TimetableSlot[] }[] = [];

  attendanceSummary: AttendanceSummary | null = null;
  subjects: SubjectAttendance[] = [];

  constructor(private apiService: ApiService, private authService: AuthService) {}

  ngOnInit() {
    this.studentId = this.authService.getStudentId();
    if (!this.studentId) { this.error = 'Session expired. Please login again.'; return; }
    this.loadSessions();
  }

  ionViewWillEnter() {
    if (this.studentId && !this.sessions.length) this.loadSessions();
  }

  private loadSessions() {
    this.isLoading = true;
    this.apiService.getSessions().pipe(catchError(() => of([]))).subscribe((sessions: any[]) => {
      this.sessions = sessions || [];
      if (this.sessions.length) {
        const current = this.sessions.find(s => s?.iscurrentsession === true || s?.Iscurrentsession === true);
        this.selectedSessionId = current?.sessionslnum || this.sessions[this.sessions.length - 1]?.sessionslnum || null;
        this.loadWeeks();
      } else {
        this.isLoading = false;
      }
    });
  }

  private loadWeeks() {
    if (!this.selectedSessionId) return;
    this.apiService.getSessionWeeks(this.selectedSessionId)
      .pipe(catchError(() => of([])))
      .subscribe((weeks: any[]) => {
        if (weeks?.length) {
          this.weeks = weeks.map((w: any) => ({
            weekNumber: w.weekNumber, label: `Week ${w.weekNumber}`,
            weekStartDate: w.weekStartDate, weekEndDate: w.weekEndDate
          }));
        } else {
          this.weeks = Array.from({ length: 20 }, (_, i) => ({
            weekNumber: i + 1, label: `Week ${i + 1}`, weekStartDate: '', weekEndDate: ''
          }));
        }
        this.selectedWeek = this.detectCurrentWeek();
        this.loadAll();
      });
  }

  private detectCurrentWeek(): number {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (const w of this.weeks) {
      if (!w.weekStartDate || !w.weekEndDate) continue;
      const start = new Date(w.weekStartDate); start.setHours(0, 0, 0, 0);
      const end = new Date(w.weekEndDate); end.setHours(23, 59, 59, 999);
      if (today >= start && today <= end) return w.weekNumber;
    }
    return this.weeks[0]?.weekNumber || 1;
  }

  onSessionChange() {
    this.slotsByDay = []; this.subjects = []; this.attendanceSummary = null;
    this.weeks = []; this.selectedWeek = null;
    this.loadWeeks();
  }

  onWeekChange() {
    this.slotsByDay = [];
    this.loadTimetable();
  }

  onTabChange(tab: 'timetable' | 'attendance') {
    this.activeTab = tab;
    if (tab === 'attendance' && !this.attendanceSummary) this.loadAttendance();
  }

  private loadAll() {
    this.loadTimetable();
    this.loadAttendance();
  }

  private loadTimetable() {
    if (!this.selectedSessionId) return;
    this.isLoading = true;
    this.apiService.getStudentTimetable(this.studentId, this.selectedSessionId, this.selectedWeek ?? undefined)
      .pipe(catchError(() => of(null)))
      .subscribe(data => {
        this.isLoading = false;
        this.slotsByDay = this.groupByDay(data?.slots || []);
      });
  }

  private loadAttendance() {
    if (!this.selectedSessionId) return;
    this.apiService.getStudentAttendanceSummary(this.studentId, this.selectedSessionId)
      .pipe(catchError(() => of(null)))
      .subscribe(data => {
        this.attendanceSummary = data;
        this.subjects = (data?.subjects || []).map((s: any) => ({
          subjectSlnum: s.subjectSlnum, subjectName: s.subjectName || 'Unknown',
          subjectCode: s.subjectCode || '', totalClasses: s.totalClasses || 0,
          presentClasses: s.presentClasses || 0, absentClasses: s.absentClasses || 0,
          attendancePercentage: s.attendancePercentage || 0, status: s.status || 'Critical',
          facultyName: s.facultyName || '', facultyPhoto: s.facultyPhoto || ''
        }));
      });
  }

  private groupByDay(slots: TimetableSlot[]) {
    const map = new Map<number, TimetableSlot[]>();
    for (const slot of slots) {
      const d = slot.dayOfWeek ?? 0;
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(slot);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b)
      .map(([day, s]) => ({ day, dayName: DAY_NAMES[day] ?? `Day ${day}`, slots: s }));
  }

  statusColor(status: AttendanceStatus): string {
    const map: Record<AttendanceStatus, string> = {
      present: 'success', absent: 'danger',
      not_marked: 'medium', not_conducted: 'warning', upcoming: 'tertiary'
    };
    return map[status] || 'medium';
  }

  statusIcon(status: AttendanceStatus): string {
    const map: Record<AttendanceStatus, string> = {
      present: 'checkmark-circle', absent: 'close-circle',
      not_marked: 'help-circle', not_conducted: 'ban', upcoming: 'time'
    };
    return map[status] || 'help-circle';
  }

  attendanceBadgeColor(pct: number): string {
    if (pct >= 75) return 'success';
    if (pct >= 65) return 'warning';
    return 'danger';
  }

  get overallPct(): number { return this.attendanceSummary?.overallAttendancePercentage ?? 0; }
  get overallTotal(): number { return this.attendanceSummary?.overallTotal ?? 0; }
  get overallPresent(): number { return this.attendanceSummary?.overallPresent ?? 0; }
  get overallAbsent(): number { return this.attendanceSummary?.overallAbsent ?? 0; }

  get currentWeekInfo(): WeekInfo | undefined {
    return this.weeks.find(w => w.weekNumber === this.selectedWeek);
  }

  sessionLabel(s: any): string {
    return s?.sessionname || s?.Sessionname || `Session ${s?.sessionslnum}`;
  }

  doRefresh(event: any) {
    this.loadAll();
    setTimeout(() => event.target.complete(), 1500);
  }
}

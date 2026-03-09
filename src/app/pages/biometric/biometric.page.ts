import { Component, OnInit } from '@angular/core';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

export interface BiometricRecord {
  date: string;       // ISO date  'YYYY-MM-DD'
  dayName: string;
  checkIn?: string;   // 'HH:mm'
  checkOut?: string;
  status: 'present' | 'absent' | 'late' | 'holiday';
  totalHours?: number | string;  // number when known, 'NA' from API
  isCurrentOrFuture: boolean;
}

@Component({
  selector: 'app-biometric',
  templateUrl: './biometric.page.html',
  styleUrls: ['./biometric.page.scss'],
  standalone: false
})
export class BiometricPage implements OnInit {
  userName = '';
  userId = 0;
  isLoading = false;

  weekOffset = 0;   // 0 = current week, -1 = last week …
  weekRecords: BiometricRecord[] = [];

  // API-level stats (from the `statistics` object in the response)
  apiStats: {
    daysPresent: number;
    totalWorkHours: number;
    attendancePercentage: number;
    averageHoursPerDay: number;
  } | null = null;

  private readonly DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  constructor(private apiService: ApiService, private authService: AuthService) {}

  ngOnInit() {
    const u = this.authService.getCurrentUser();
    this.userName = u?.fullName || u?.name || 'Faculty';
    this.userId = u?.userId || 0;
    this.load();
  }

  ionViewWillEnter() { this.load(); }

  // ── Week helpers ─────────────────────────────────────────────────

  get weekStart(): Date {
    const today = new Date();
    const mon = new Date(today);
    mon.setDate(today.getDate() - today.getDay() + 1 + this.weekOffset * 7);
    mon.setHours(0, 0, 0, 0);
    return mon;
  }

  get weekEnd(): Date {
    const end = new Date(this.weekStart);
    end.setDate(this.weekStart.getDate() + 6);
    return end;
  }

  get weekLabel(): string {
    const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    return `${fmt(this.weekStart)} – ${fmt(this.weekEnd)}`;
  }

  // The API selectedDate should be any date within the target week.
  // We send the Monday of the selected week (or today for current week).
  private get selectedDateIso(): string {
    return this.weekStart.toISOString();
  }

  prevWeek() { this.weekOffset--; this.load(); }
  nextWeek() { if (this.weekOffset < 0) { this.weekOffset++; this.load(); } }
  get isCurrentWeek(): boolean { return this.weekOffset === 0; }

  // ── API call ─────────────────────────────────────────────────────

  load() {
    if (!this.userId) return;
    this.isLoading = true;
    this.apiService
      .getWeeklyAttendance(this.userId, this.selectedDateIso)
      .pipe(catchError(() => of(null)))
      .subscribe((res: any) => {
        this.isLoading = false;
        const record = Array.isArray(res) ? res[0] : res;
        if (!record) { this.buildEmptyWeek(); return; }

        this.apiStats = record.statistics
          ? {
              daysPresent: record.statistics.daysPresent ?? 0,
              totalWorkHours: record.statistics.totalWorkHours ?? 0,
              attendancePercentage: record.statistics.attendancePercentage ?? 0,
              averageHoursPerDay: record.statistics.averageHoursPerDay ?? 0
            }
          : null;

        this.weekRecords = this.mapLogs(record.logs ?? []);
      });
  }

  // ── Mapping ──────────────────────────────────────────────────────

  private mapLogs(logs: any[]): BiometricRecord[] {
    const todayStr = new Date().toISOString().slice(0, 10);
    // The API may return one entry per day or a flat array — normalise by date
    const byDate = new Map<string, any>();
    for (const l of logs) {
      const dateStr = this.extractDate(l);
      if (dateStr) byDate.set(dateStr, l);
    }

    // Build a 7-day grid for the selected week
    const start = this.weekStart;
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const log = byDate.get(dateStr);
      const isSun = d.getDay() === 0;
      const isFuture = dateStr > todayStr;
      const isCurrent = dateStr === todayStr;

      if (isSun) {
        return { date: dateStr, dayName: this.DAY_NAMES[0], status: 'holiday', isCurrentOrFuture: false };
      }

      if (!log) {
        // No log entry for this day
        return {
          date: dateStr,
          dayName: this.DAY_NAMES[d.getDay()],
          status: isFuture || isCurrent ? 'absent' : 'absent',
          isCurrentOrFuture: isFuture || isCurrent
        } as BiometricRecord;
      }

      // Parse the log entry
      const totalHoursRaw = log.totalHours;
      const totalHoursNum = (totalHoursRaw === 'NA' || totalHoursRaw == null)
        ? undefined
        : Number(totalHoursRaw);

      const checkIn = log.punchIn ?? log.checkIn ?? log.inTime ?? log.firstPunch ?? undefined;
      const checkOut = log.punchOut ?? log.checkOut ?? log.outTime ?? log.lastPunch ?? undefined;

      const isPresent = totalHoursRaw !== 'NA' && totalHoursNum != null && totalHoursNum > 0;
      const isLate = isPresent && !!log.isLate;

      return {
        date: dateStr,
        dayName: this.DAY_NAMES[d.getDay()],
        checkIn:  checkIn  ? String(checkIn).slice(0, 5)  : undefined,
        checkOut: checkOut ? String(checkOut).slice(0, 5) : undefined,
        status: isLate ? 'late' : isPresent ? 'present' : 'absent',
        totalHours: totalHoursNum,
        isCurrentOrFuture: log.isCurrentOrFuture ?? (isFuture || isCurrent)
      } as BiometricRecord;
    });
  }

  private extractDate(log: any): string | null {
    const raw = log.date ?? log.logDate ?? log.attendanceDate ?? log.punchDate;
    if (!raw) return null;
    return String(raw).slice(0, 10);
  }

  private buildEmptyWeek() {
    const todayStr = new Date().toISOString().slice(0, 10);
    const start = this.weekStart;
    this.weekRecords = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const isFuture = dateStr > todayStr;
      return {
        date: dateStr,
        dayName: this.DAY_NAMES[d.getDay()],
        status: d.getDay() === 0 ? 'holiday' : 'absent',
        isCurrentOrFuture: isFuture
      } as BiometricRecord;
    });
  }

  // ── Computed stats ────────────────────────────────────────────────

  get presentDays(): number {
    return this.apiStats?.daysPresent
      ?? this.weekRecords.filter(r => r.status === 'present').length;
  }

  get absentDays(): number {
    return this.weekRecords.filter(r => r.status === 'absent').length;
  }

  get totalHours(): number {
    return this.apiStats?.totalWorkHours
      ?? this.weekRecords.reduce((s, r) => s + (typeof r.totalHours === 'number' ? r.totalHours : 0), 0);
  }

  get attendancePct(): number {
    return this.apiStats?.attendancePercentage ?? 0;
  }

  // ── Helpers ──────────────────────────────────────────────────────

  statusColor(status: string): string {
    const map: Record<string, string> = {
      present: 'success', absent: 'danger', late: 'warning', holiday: 'medium'
    };
    return map[status] || 'medium';
  }

  statusIcon(status: string): string {
    const map: Record<string, string> = {
      present: 'checkmark-circle-outline',
      absent: 'close-circle-outline',
      late: 'time-outline',
      holiday: 'sunny-outline'
    };
    return map[status] || 'ellipse-outline';
  }

  isToday(dateStr: string): boolean {
    return dateStr === new Date().toISOString().slice(0, 10);
  }

  doRefresh(event: any) {
    this.load();
    setTimeout(() => event.target.complete(), 1500);
  }
}

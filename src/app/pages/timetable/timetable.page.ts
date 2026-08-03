import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { filter, take, switchMap } from 'rxjs/operators';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { TimetableSession, SessionWeek, TimetableSlot, DayGroup } from '../../models/timetable.model';
import { environment } from 'src/environments/environment';

const DAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

@Component({
  selector: 'app-timetable',
  templateUrl: './timetable.page.html',
  styleUrls: ['./timetable.page.scss'],
  standalone: false
})
export class TimetablePage implements OnInit {
  loading = true;
  error = false;

  weeks: SessionWeek[] = [];
  selectedWeek: SessionWeek | null = null;
  dayGroups: DayGroup[] = [];

  private sessionId = 0;
  private userId = 0;

  constructor(private authService: AuthService, private http: HttpClient, private router: Router) {}

  ngOnInit() {
    this.authService.user$.pipe(filter(u => !!u), take(1)).subscribe(u => {
      this.userId = u!.userId;
      this.bootstrap();
    });
  }

  private bootstrap() {
    // 1. Get sessions → find current
    this.http.get<TimetableSession[]>(`${environment.apiUrl}univesitymaster/getsessions`)
      .subscribe({
        next: sessions => {
          const cur = sessions.find(s => s.iscurrentsession) || sessions[0];
          this.sessionId = cur.sessionslnum;
          // 2. Get weeks for that session
          this.http.get<SessionWeek[]>(`${environment.apiUrl}Timetable/session/${this.sessionId}/weeks`)
            .subscribe({
              next: weeks => {
                this.weeks = weeks;
                // 3. Default to current week
                const today = new Date();
                const cur = weeks.find(w => {
                  const s = new Date(w.weekStartDate);
                  const e = new Date(w.weekEndDate);
                  return today >= s && today <= e;
                }) || weeks[0];
                this.selectedWeek = cur;
                this.loadTimetable(cur.weekNumber);
              },
              error: () => { this.loading = false; this.error = true; }
            });
        },
        error: () => { this.loading = false; this.error = true; }
      });
  }

  loadTimetable(weekNumber: number) {
    this.loading = true;
    this.http.get<TimetableSlot[]>(
      `${environment.apiUrl}FacultyWorkload/gettimetable/${this.userId}/${this.sessionId}`,
      { params: { weekNumber: weekNumber.toString() } }
    ).subscribe({
      next: slots => {
        this.dayGroups = this.groupByDay(slots || [], this.selectedWeek!);
        this.loading = false;
      },
      error: () => { this.loading = false; this.error = true; }
    });
  }

  private groupByDay(slots: TimetableSlot[], week: SessionWeek): DayGroup[] {
    const start = new Date(week.weekStartDate);
    const groups: DayGroup[] = [];

    for (let d = 1; d <= 6; d++) {  // Mon–Sat
      const daySlots = slots.filter(s => s.dayofweek === d)
        .sort((a, b) => a.starttime.localeCompare(b.starttime));

      const date = new Date(start);
      date.setDate(start.getDate() + (d - 1));

      groups.push({
        dayofweek: d,
        label: DAY_NAMES[d],
        date: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        slots: daySlots
      });
    }
    return groups;
  }

  selectWeek(weekNum: number) {
    const w = this.weeks.find(x => x.weekNumber === weekNum);
    if (w) { this.selectedWeek = w; this.loadTimetable(w.weekNumber); }
  }

  prevWeek() {
    if (!this.selectedWeek) return;
    const idx = this.weeks.findIndex(w => w.weekNumber === this.selectedWeek!.weekNumber);
    if (idx > 0) this.selectWeek(this.weeks[idx - 1].weekNumber);
  }

  nextWeek() {
    if (!this.selectedWeek) return;
    const idx = this.weeks.findIndex(w => w.weekNumber === this.selectedWeek!.weekNumber);
    if (idx < this.weeks.length - 1) this.selectWeek(this.weeks[idx + 1].weekNumber);
  }

  get isFirstWeek(): boolean {
    return this.selectedWeek?.weekNumber === this.weeks[0]?.weekNumber;
  }

  get isLastWeek(): boolean {
    return this.selectedWeek?.weekNumber === this.weeks[this.weeks.length - 1]?.weekNumber;
  }

  openAttendance(slot: TimetableSlot) {
    this.router.navigate(['/tabs/attendance'], {
      queryParams: {
        sessionId:    this.sessionId,
        subjectSlnum: slot.subjectslnum ?? slot.subjectSlnum ?? 0,
        slotId:       slot.timetableslotslnum,
        courseName:   slot.courseName
      }
    });
  }

  activityColor(type: string): string {
    switch (type?.toLowerCase()) {
      case 'lab':      return 'lab';
      case 'tutorial': return 'tutorial';
      default:         return 'theory';
    }
  }

  isToday(group: DayGroup): boolean {
    if (!this.selectedWeek) return false;
    const today = new Date();
    const start = new Date(this.selectedWeek.weekStartDate);
    const d = new Date(start);
    d.setDate(start.getDate() + (group.dayofweek - 1));
    return d.toDateString() === today.toDateString();
  }
}

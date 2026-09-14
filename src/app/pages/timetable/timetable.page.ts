import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { filter, take } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { AcademicService } from '../../core/services/academic.service';
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

  isStudent = false;
  private sessionId = 0;
  private userId = 0;

  constructor(
    private authService: AuthService,
    private academicService: AcademicService,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit() {
    this.authService.user$.pipe(filter(u => !!u), take(1)).subscribe(u => {
      this.userId = u!.userId;
      this.isStudent = this.authService.isStudent();
      this.bootstrap();
    });
  }

  private bootstrap() {
    this.academicService.getSessions().subscribe({
      next: sessions => {
        const cur = sessions.find(s => s.iscurrentsession) || sessions[0];
        if (!cur) {
          this.loading = false;
          this.error = true;
          return;
        }
        this.sessionId = cur.sessionslnum;
        this.academicService.getSessionWeeks(this.sessionId).subscribe({
          next: weeks => {
            this.weeks = weeks || [];
            const today = new Date();
            const curWeek = this.weeks.find(w => {
              const s = new Date(w.weekStartDate);
              const e = new Date(w.weekEndDate);
              return today >= s && today <= e;
            }) || this.weeks[0];
            this.selectedWeek = curWeek || null;
            if (curWeek) {
              this.loadTimetable(curWeek.weekNumber);
            } else {
              this.loading = false;
            }
          },
          error: () => { this.loading = false; this.error = true; }
        });
      },
      error: () => { this.loading = false; this.error = true; }
    });
  }

  loadTimetable(weekNumber: number) {
    this.loading = true;
    this.error = false;

    if (this.isStudent) {
      this.academicService.getStudentTimetable(this.userId, this.sessionId, weekNumber).subscribe({
        next: (res) => {
          const rawSlots: any[] = res?.slots ?? (Array.isArray(res) ? res : []);
          const normalized: TimetableSlot[] = rawSlots.map((s, idx) => ({
            timetableslotslnum: s.timetableSlotSlnum || s.slotId || s.timetableslotslnum || idx + 1,
            dayofweek: Number(s.dayOfWeek ?? s.dayofweek ?? 1),
            starttime: (s.startTime ?? s.starttime ?? '').substring(0, 5),
            endtime: (s.endTime ?? s.endtime ?? '').substring(0, 5),
            courseName: s.subjectName ?? s.courseTitle ?? s.courseName ?? 'Subject',
            courseCode: s.subjectCode ?? s.courseCode ?? '',
            activitytype: s.activityType ?? s.activitytype ?? 'Theory',
            roomnumber: s.roomNumber ?? s.roomnumber ?? s.room ?? 'TBD',
            isShared: !!s.isShared,
            sharedWith: s.sharedWith || [],
            subjectslnum: s.subjectSlnum ?? s.subjectslnum
          }));
          this.dayGroups = this.groupByDay(normalized, this.selectedWeek!);
          this.loading = false;
        },
        error: () => { this.loading = false; this.error = true; }
      });
    } else {
      this.academicService.getFacultyTimetable(this.userId, this.sessionId, weekNumber).subscribe({
        next: slots => {
          this.dayGroups = this.groupByDay(slots || [], this.selectedWeek!);
          this.loading = false;
        },
        error: () => { this.loading = false; this.error = true; }
      });
    }
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
    if (this.isStudent) return;
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

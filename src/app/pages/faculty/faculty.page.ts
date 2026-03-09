import { Component, OnInit } from '@angular/core';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { Workload, FacultyTimetableSlot, Session } from '../../models/workload.model';
import { DAY_NAMES } from '../../models/timetable.model';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-faculty',
  templateUrl: './faculty.page.html',
  styleUrls: ['./faculty.page.scss'],
  standalone: false
})
export class FacultyPage implements OnInit {
  activeTab: 'workload' | 'timetable' = 'workload';
  isLoading = false;

  facultyId = 0;
  sessions: Session[] = [];
  selectedSessionId: number | null = null;

  // Workload
  workloads: Workload[] = [];

  // Session Timetable (Workload)
  sessionTeachingTotalMinutes = 0;
  sessionSubjects: any[] = [];
  sessionProgrammesCount = 0;
  stayHourActivities: any[] = [];
  isLoadingSessionTimetable = false;

  // Timetable
  selectedWeek: number | null = null;
  selectedDate = '';
  dayMode = false;
  slotsByDay: { day: number; dayName: string; slots: FacultyTimetableSlot[] }[] = [];

  constructor(private apiService: ApiService, private authService: AuthService, private router: Router, private route: ActivatedRoute) {}

  ngOnInit() {
    this.facultyId = this.authService.getCurrentUser()?.userId || 0;
  }

  ionViewWillEnter() {
    // Read ?tab= query param to open the correct segment
    const tabParam = this.route.snapshot.queryParamMap.get('tab');
    if (tabParam === 'timetable' || tabParam === 'workload') {
      this.activeTab = tabParam;
    }
    
    // Defer loading until the component is truly the active route view
    // to prevent background API spinners from overlaying the dashboard upon login
    if (this.router.url.includes('/tabs/faculty')) {
      if (!this.sessions.length) {
        this.loadSessions();
      }
      if (this.facultyId && this.workloads.length === 0) {
        this.loadWorkloads();
      }
      if (this.facultyId && this.activeTab === 'workload' && this.sessionSubjects.length === 0) {
        this.loadSessionTimetable();
      }
      if (this.activeTab === 'timetable' && !this.slotsByDay.length) {
        this.loadTimetable();
      }
    }
  }

  private loadSessions() {
    this.apiService.getSessions().pipe(catchError(() => of([]))).subscribe((sessions: any[]) => {
      this.sessions = (sessions || []).map((s: any) => ({
        sessionslnum: Number(s?.sessionslnum ?? s?.Sessionslnum),
        sessionName: s?.sessionName ?? s?.sessionname ?? s?.SessionName ?? '',
        isCurrent: !!(s?.isCurrent || s?.IsCurrent || s?.iscurrent || s?.iscurrentsession),
        sessionfrom: Number(s?.sessionfrom ?? s?.sessionFrom ?? 0),
        sessionto: Number(s?.sessionto ?? s?.sessionTo ?? 0),
        sessiononefrom: s?.sessiononefrom ?? s?.sessionOneFrom ?? null,
        sessiononeto: s?.sessiononeto ?? s?.sessionOneTo ?? null
      }));
      const current = this.sessions.find(s => s.isCurrent);
      this.selectedSessionId = current?.sessionslnum ?? this.sessions[this.sessions.length - 1]?.sessionslnum ?? null;
      this.setDefaultDateAndWeek();
      if (this.activeTab === 'timetable') this.loadTimetable();
      if (this.activeTab === 'workload') this.loadSessionTimetable();
    });
  }

  loadWorkloads() {
    this.isLoading = true;
    this.apiService.getMyWorkloads(this.facultyId).pipe(catchError(() => of([]))).subscribe(data => {
      this.isLoading = false;
      this.workloads = data || [];
    });
  }

  loadSessionTimetable() {
    if (!this.selectedSessionId) return;
    this.isLoadingSessionTimetable = true;
    this.apiService.getFacultyTimetable(this.facultyId, this.selectedSessionId)
      .pipe(catchError(() => of(null)))
      .subscribe(data => {
        this.isLoadingSessionTimetable = false;
        const slots = data?.slots || data || [];
        this.processSessionTimetable(slots);
      });
  }

  processSessionTimetable(slots: any[]) {
    let totalMinutes = 0;
    const subjectMap = new Map<string, any>();
    const programmeSet = new Set<string>();
    
    const teachingSlots = slots.filter(s => !s.isStayHour && !s.IsStayHour && !s.isstayhour);
    const stayHours = slots.filter(s => s.isStayHour || s.IsStayHour || s.isstayhour);

    teachingSlots.forEach(slot => {
      const start = this.parseTime(slot.starttime || slot.startTime);
      const end = this.parseTime(slot.endtime || slot.endTime);
      let mins = 0;
      if (start !== null && end !== null && end >= start) {
        mins = end - start;
      }
      
      totalMinutes += mins;

      const code = slot.courseCode || slot.subjectCode || '';
      const name = slot.courseName || slot.subjectName || '';
      const prog = slot.programName || '-';
      const activity = slot.activitytype || slot.sectionName || 'Theory';
      const key = `${code}_${name}_${prog}_${activity}`;

      if (!subjectMap.has(key)) {
        subjectMap.set(key, { code, name, prog, activity, totalMins: 0, uniqueSlots: new Map() });
      }
      
      const dayOfWeek = slot.dayofweek ?? slot.dayOfWeek ?? 0;
      const startStr = slot.starttime || slot.startTime || '';
      const endStr = slot.endtime || slot.endTime || '';
      const roomStr = slot.roomnumber || slot.roomNumber || '';
      const slotKey = `${dayOfWeek}_${startStr}_${endStr}_${roomStr}`;
      
      const uSlots = subjectMap.get(key).uniqueSlots;
      if (!uSlots.has(slotKey)) {
        uSlots.set(slotKey, { 
          dayOfWeek, 
          dayName: DAY_NAMES[dayOfWeek] || '', 
          start: startStr, 
          end: endStr, 
          room: roomStr 
        });
      }

      subjectMap.get(key).totalMins += mins;

      if (prog && prog !== '-') {
        programmeSet.add(prog);
      } else {
        programmeSet.add('Unknown');
      }
    });

    this.sessionTeachingTotalMinutes = totalMinutes;
    this.sessionSubjects = Array.from(subjectMap.values()).map((sub: any) => {
      const scheduleSlots = Array.from(sub.uniqueSlots.values()).sort((a: any, b: any) => {
        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
        return a.start.localeCompare(b.start);
      });
      return { ...sub, scheduleSlots };
    });
    this.sessionProgrammesCount = programmeSet.size === 1 && programmeSet.has('Unknown') ? 1 : programmeSet.size;
    
    // Process stay hours
    const stayHourMap = new Map<string, any>();
    stayHours.forEach(slot => {
      const start = this.parseTime(slot.starttime || slot.startTime);
      const end = this.parseTime(slot.endtime || slot.endTime);
      let mins = 0;
      if (start !== null && end !== null && end >= start) {
        mins = end - start;
      }
      const activity = slot.activitytype || slot.sectionName || 'Stay Hour';
      const key = activity;
      if (!stayHourMap.has(key)) {
        stayHourMap.set(key, { activity, totalMins: 0 });
      }
      stayHourMap.get(key).totalMins += mins;
    });
    this.stayHourActivities = Array.from(stayHourMap.values());
  }

  private parseTime(timeStr: string): number | null {
    if (!timeStr) return null;
    const parts = timeStr.split(':');
    if (parts.length >= 2) {
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }
    return null;
  }

  formatDuration(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  }

  loadTimetable() {
    if (!this.selectedSessionId || !this.selectedWeek) return;
    this.isLoading = true;
    this.apiService.getFacultyTimetable(this.facultyId, this.selectedSessionId, this.selectedWeek)
      .pipe(catchError(() => of(null)))
      .subscribe(data => {
        this.isLoading = false;
        const rows: any[] = data?.slots || data || [];
        const slots: FacultyTimetableSlot[] = rows.map((row: any) => this.normalizeTimetableSlot(row));
        this.slotsByDay = this.groupByDay(slots);
      });
  }

  private normalizeTimetableSlot(row: any): FacultyTimetableSlot {
    return {
      timetableSlotId: Number(row?.timetableSlotId ?? row?.timetableslotslnum ?? 0),
      dayOfWeek: Number(row?.dayOfWeek ?? row?.dayofweek ?? 0),
      dayName: row?.dayName ?? DAY_NAMES[Number(row?.dayOfWeek ?? row?.dayofweek ?? 0)] ?? '',
      startTime: row?.startTime ?? row?.starttime ?? '--:--',
      endTime: row?.endTime ?? row?.endtime ?? '--:--',
      weekNumber: Number(row?.weekNumber ?? row?.weeknumber ?? this.selectedWeek ?? 0),
      subjectSlnum: Number(row?.subjectSlnum ?? row?.subjectslnum ?? 0),
      semesterId: Number(row?.semesterId ?? row?.semesterslnum ?? 0),
      subjectName: row?.subjectName ?? row?.courseName ?? '-',
      subjectCode: row?.subjectCode ?? row?.courseCode ?? '-',
      roomNumber: row?.roomNumber ?? row?.roomnumber ?? '',
      sectionName: row?.sectionName ?? row?.activitytype ?? row?.activityType ?? '',
      courseName: row?.courseName ?? row?.subjectName ?? '-',
      programName: row?.programName ?? '',
      scheduledDate: row?.scheduledDate ?? null,
      attendanceMarked: !!row?.attendanceMarked,
      totalStudents: Number(row?.totalStudents ?? 0),
      presentCount: Number(row?.presentCount ?? 0),
      absentCount: Number(row?.absentCount ?? 0)
    };
  }

  private groupByDay(slots: FacultyTimetableSlot[]) {
    const map = new Map<number, FacultyTimetableSlot[]>();
    for (const slot of slots) {
      const d = slot.dayOfWeek ?? 0;
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(slot);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b)
      .map(([day, s]) => ({
        day,
        dayName: DAY_NAMES[day] ?? `Day ${day}`,
        slots: s.sort((a, b) => a.startTime.localeCompare(b.startTime))
      }));
  }

  get totalClasses(): number {
    return this.displayDays.reduce((sum, day) => sum + day.slots.length, 0);
  }

  get totalTeachingDays(): number {
    return this.displayDays.filter(day => day.slots.length > 0).length;
  }

  get uniqueSubjects(): number {
    const subjects = new Set<string>();
    for (const day of this.displayDays) {
      for (const slot of day.slots) {
        subjects.add(slot.subjectCode || slot.subjectName);
      }
    }
    return subjects.size;
  }

  get selectedSessionName(): string {
    return this.sessions.find(s => s.sessionslnum === this.selectedSessionId)?.sessionName || '';
  }

  get selectedDateLabel(): string {
    if (!this.selectedDate) return '--';
    const date = new Date(`${this.selectedDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  get selectedWeekRangeLabel(): string {
    if (!this.selectedDate) return '--';
    const selected = new Date(`${this.selectedDate}T00:00:00`);
    if (Number.isNaN(selected.getTime())) return '--';
    const weekStart = new Date(selected);
    weekStart.setDate(selected.getDate() - selected.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const startLabel = weekStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    const endLabel = weekEnd.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    return `${startLabel} - ${endLabel}`;
  }

  get todayLabel(): string {
    return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  get selectedDaySlots(): FacultyTimetableSlot[] {
    if (!this.selectedDate) return [];
    const date = new Date(`${this.selectedDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) return [];
    const day = date.getDay();
    return this.slotsByDay.find(d => d.day === day)?.slots || [];
  }

  get selectedDayName(): string {
    if (!this.selectedDate) return '';
    const date = new Date(`${this.selectedDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    return DAY_NAMES[date.getDay()] || '';
  }

  get displayDays(): { day: number; dayName: string; slots: FacultyTimetableSlot[] }[] {
    if (!this.dayMode) return this.slotsByDay;
    if (!this.selectedDate) return [];
    const date = new Date(`${this.selectedDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) return [];
    const dayIndex = date.getDay();
    const slots = this.selectedDaySlots;
    if (!slots.length) return [];
    return [{ day: dayIndex, dayName: DAY_NAMES[dayIndex] || '', slots }];
  }

  get sessionStartDate(): string {
    const s = this.currentSession();
    if (s?.sessiononefrom) return s.sessiononefrom.slice(0, 10);
    if (s?.sessionfrom) return `${s.sessionfrom}-01-01`;
    return '2020-01-01';
  }

  get sessionEndDate(): string {
    const s = this.currentSession();
    if (s?.sessiononeto) return s.sessiononeto.slice(0, 10);
    if (s?.sessionto) return `${s.sessionto}-12-31`;
    return '2035-12-31';
  }

  onTabChange(tab: 'workload' | 'timetable') {
    this.activeTab = tab;
    if (tab === 'timetable' && !this.slotsByDay.length) this.loadTimetable();
    if (tab === 'workload' && !this.sessionSubjects.length) this.loadSessionTimetable();
  }

  onDateChange(event: any) {
    const value = String(event?.detail?.value || '');
    if (!value) return;
    this.selectedDate = value.slice(0, 10);
    this.selectedWeek = this.computeWeekNumber(this.selectedDate);
    this.slotsByDay = [];
    this.loadTimetable();
  }

  setToday() {
    const today = new Date();
    this.selectedDate = today.toISOString().slice(0, 10);
    this.selectedWeek = this.computeWeekNumber(this.selectedDate);
    this.slotsByDay = [];
    this.loadTimetable();
  }

  openAttendance(slot: FacultyTimetableSlot) {
    if (!this.selectedSessionId || !slot?.subjectSlnum || !slot?.timetableSlotId) return;
    const courseName = slot.subjectCode && slot.subjectCode !== '-'
      ? `${slot.subjectCode} - ${slot.subjectName}`
      : slot.subjectName;
    this.router.navigate(['/tabs/faculty/attendance'], {
      queryParams: {
        sessionId: this.selectedSessionId,
        subjectSlnum: slot.subjectSlnum,
        slotId: slot.timetableSlotId,
        semesterId: slot.semesterId || undefined,
        courseName,
        sessionName: this.selectedSessionName,
        date: this.selectedDate || undefined,
        startTime: slot.startTime || undefined,
        endTime: slot.endTime || undefined,
        facultyId: this.facultyId || undefined
      }
    });
  }

  statusColor(status: string): string {
    const map: Record<string, string> = {
      Draft: 'medium', Submitted: 'primary', Under_Review: 'warning',
      Approved: 'success', Rejected: 'danger'
    };
    return map[status] || 'medium';
  }

  statusIcon(status: string): string {
    const map: Record<string, string> = {
      Draft: 'create-outline', Submitted: 'paper-plane-outline',
      Under_Review: 'hourglass-outline', Approved: 'checkmark-circle-outline',
      Rejected: 'close-circle-outline'
    };
    return map[status] || 'help-circle-outline';
  }

  doRefresh(event: any) {
    if (this.activeTab === 'workload') {
      this.loadWorkloads();
      this.loadSessionTimetable();
    }
    else this.loadTimetable();
    setTimeout(() => event.target.complete(), 1500);
  }

  private currentSession(): Session | undefined {
    return this.sessions.find(s => s.sessionslnum === this.selectedSessionId);
  }

  private setDefaultDateAndWeek() {
    const start = new Date(this.sessionStartDate);
    const end = new Date(this.sessionEndDate);
    const today = new Date();
    const clamped = today < start ? start : (today > end ? end : today);
    this.selectedDate = clamped.toISOString().slice(0, 10);
    this.selectedWeek = this.computeWeekNumber(this.selectedDate);
  }

  private computeWeekNumber(dateStr: string): number {
    const picked = new Date(dateStr);
    const sessionStart = new Date(this.sessionStartDate);
    const diffMs = picked.getTime() - sessionStart.getTime();
    if (Number.isNaN(diffMs)) return 1;
    return Math.max(1, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1);
  }

  getSlotDateLabel(slot: FacultyTimetableSlot): string {
    if (slot.scheduledDate) {
      return this.formatDateLabel(new Date(slot.scheduledDate));
    }

    if (!this.selectedDate) return '';
    const selected = new Date(`${this.selectedDate}T00:00:00`);
    const weekStart = new Date(selected);
    weekStart.setDate(selected.getDate() - selected.getDay());
    const slotDate = new Date(weekStart);
    slotDate.setDate(weekStart.getDate() + (slot.dayOfWeek || 0));
    return this.formatDateLabel(slotDate);
  }

  private formatDateLabel(date: Date): string {
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }
}

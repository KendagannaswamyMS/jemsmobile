import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { ToastController } from '@ionic/angular';

type AttendanceRow = {
  seq: number;
  studentRegistrationSlnum: number;
  studentBasicsSlnum: number;
  name: string;
  usn: string;
  registerNumber: string;
  isPresent: boolean;
  profilePic?: string;
};

@Component({
  selector: 'app-faculty-attendance',
  templateUrl: './faculty-attendance.page.html',
  styleUrls: ['./faculty-attendance.page.scss'],
  standalone: false
})
export class FacultyAttendancePage implements OnInit {
  isLoading = false;
  isSaving = false;
  students: any[] = [];
  attendanceRows: AttendanceRow[] = [];
  loadError = '';
  vsectionName = '';
  markAllMode: 'present' | 'absent' = 'present';
  selectedInitial = '';
  readonly alphabetList: string[] = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  isAlphaPopoverOpen = false;

  sessionId = 0;
  subjectSlnum = 0;
  slotId = 0;
  semesterId = 0;
  facultyId = 0;

  courseName = '';
  sessionName = '';
  date = '';
  startTime = '';
  endTime = '';

  constructor(
    private route: ActivatedRoute,
    private apiService: ApiService,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    const rp = this.route.snapshot.paramMap;
    const qp = this.route.snapshot.queryParamMap;
    this.sessionId = Number(qp.get('sessionId') || 0);
    this.subjectSlnum = Number(qp.get('subjectSlnum') || rp.get('subjectSlnum') || 0);
    this.slotId = Number(qp.get('slotId') || rp.get('slotId') || 0);
    this.semesterId = Number(qp.get('semesterId') || rp.get('semesterId') || 0);
    this.facultyId = Number(qp.get('facultyId') || 0);

    this.courseName = String(qp.get('courseName') || '').trim();
    this.sessionName = String(qp.get('sessionName') || '').trim();
    this.date = String(qp.get('date') || '').trim();
    this.startTime = String(qp.get('startTime') || '').trim();
    this.endTime = String(qp.get('endTime') || '').trim();
    this.loadStudents();
  }

  loadStudents() {
    if (!this.sessionId || !this.subjectSlnum || !this.slotId) {
      this.students = [];
      this.loadError = 'Missing required values: sessionId, subjectSlnum or slotId.';
      return;
    }
    this.loadError = '';
    this.isLoading = true;
    this.apiService.getStudentsForAttendance(this.sessionId, this.subjectSlnum, this.slotId)
      .pipe(catchError((err: any) => {
        const code = err?.status ? ` (${err.status})` : '';
        const msg = err?.error?.message || err?.message || 'Failed to load students';
        this.loadError = `${msg}${code}`;
        return of([]);
      }))
      .subscribe((data: any) => {
        this.isLoading = false;
        this.students = this.toArray(data);
        this.vsectionName = String(data?.vsectionName || data?.sectionName || '').trim();
        this.attendanceRows = this.students.map((s: any, index: number) => ({
          seq: index + 1,
          studentRegistrationSlnum: Number(s?.studentregistrationslnum || s?.studentRegistrationSlnum || 0),
          studentBasicsSlnum: Number(s?.studentbasicsslnum || s?.studentBasicsSlnum || 0),
          name: this.getName(s),
          usn: String(s?.studentbasicusnnumber || s?.usn || ''),
          registerNumber: String(s?.studentregisternum || s?.registerNumber || ''),
          isPresent: true,
          profilePic: s?.profilePic || s?.profilepic || ''
        }));
      });
  }

  private toArray(data: any): any[] {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.students)) return data.students;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.result)) return data.result;
    if (Array.isArray(data?.$values)) return data.$values;
    return [];
  }

  getName(s: any): string {
    const full = [s?.firstName, s?.middleName, s?.lastName].filter(Boolean).join(' ').trim();
    return full
      || s?.studentbasiccompletename
      || s?.name
      || s?.studentName
      || 'Student';
  }

  getSub(s: any): string {
    return s?.studentbasicusnnumber
      || s?.studentregisternum
      || s?.usn
      || s?.registerNumber
      || s?.rollNo
      || s?.email
      || '';
  }

  get totalStudents(): number {
    return this.attendanceRows.length;
  }

  get presentStudents(): number {
    return this.attendanceRows.filter(s => s.isPresent).length;
  }

  get absentStudents(): number {
    return this.totalStudents - this.presentStudents;
  }

  get filteredAttendanceRows(): AttendanceRow[] {
    if (!this.selectedInitial) return this.attendanceRows;
    return this.attendanceRows.filter(s => {
      const name = (s.name || '').trim().toUpperCase();
      return name.startsWith(this.selectedInitial);
    });
  }

  setInitialFilter(letter: string) {
    this.selectedInitial = (letter || '').toUpperCase();
    this.isAlphaPopoverOpen = false;
  }

  clearInitialFilter() {
    this.selectedInitial = '';
    this.isAlphaPopoverOpen = false;
  }

  openAlphaFilter() {
    this.isAlphaPopoverOpen = true;
  }

  closeAlphaFilter() {
    this.isAlphaPopoverOpen = false;
  }

  markAllPresent() {
    this.attendanceRows = this.attendanceRows.map(s => ({ ...s, isPresent: true }));
    this.markAllMode = 'present';
  }

  markAllAbsent() {
    this.attendanceRows = this.attendanceRows.map(s => ({ ...s, isPresent: false }));
    this.markAllMode = 'absent';
  }

  onMarkAllToggle(checked: boolean) {
    if (!checked) {
      this.markAllAbsent();
      return;
    }
    this.markAllPresent();
  }

  setStudentAttendance(student: AttendanceRow, isPresent: boolean) {
    student.isPresent = isPresent;
  }

  getInitials(name: string): string {
    if (!name) return 'S';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(n => n[0].toUpperCase())
      .join('');
  }

  async saveAttendance() {
    if (!this.attendanceRows.length || this.isSaving) return;
    this.isSaving = true;
    const payload = {
      sessionId: this.sessionId,
      subjectSlnum: this.subjectSlnum,
      slotId: this.slotId,
      semesterId: this.semesterId || null,
      facultyId: this.facultyId || null,
      attendanceDate: this.date || null,
      students: this.attendanceRows.map(s => ({
        studentregistrationslnum: s.studentRegistrationSlnum,
        studentbasicsslnum: s.studentBasicsSlnum,
        isPresent: s.isPresent
      }))
    };

    this.apiService.post<any>('VirtualSection/save-attendance', payload)
      .pipe(catchError((err: any) => {
        const msg = err?.error?.message || err?.message || 'Failed to save attendance';
        this.showToast(msg, 'danger');
        this.isSaving = false;
        return of(null);
      }))
      .subscribe(async (res: any) => {
        this.isSaving = false;
        if (!res) return;
        await this.showToast('Attendance saved successfully', 'success');
      });
  }

  private async showToast(message: string, color: 'success' | 'danger') {
    const toast = await this.toastController.create({
      message,
      color,
      duration: 1800,
      position: 'bottom'
    });
    await toast.present();
  }

  get headerCourse(): string {
    return this.courseName || `Subject ${this.subjectSlnum}`;
  }

  get headerSession(): string {
    return this.sessionName || (this.sessionId ? `Session ${this.sessionId}` : '');
  }

  get headerDate(): string {
    if (!this.date) return '';
    const d = new Date(`${this.date}T00:00:00`);
    if (Number.isNaN(d.getTime())) return this.date;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  get headerTime(): string {
    const start = this.toTwelveHour(this.startTime);
    const end = this.toTwelveHour(this.endTime);
    if (start && end) return `${start} - ${end}`;
    return start || end;
  }

  private toTwelveHour(time: string): string {
    if (!time) return '';
    const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    if (!m) return time;
    let hh = Number(m[1]);
    const mm = m[2];
    const ap = hh >= 12 ? 'PM' : 'AM';
    hh = hh % 12 || 12;
    return `${hh}:${mm} ${ap}`;
  }
}

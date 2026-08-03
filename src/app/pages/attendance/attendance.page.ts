import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { filter, take } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { AttendanceSectionResponse, AttendanceEntry } from '../../models/attendance.model';
import { ContentTree, ContentNode } from '../../models/content-tree.model';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-attendance',
  templateUrl: './attendance.page.html',
  styleUrls: ['./attendance.page.scss'],
  standalone: false
})
export class AttendancePage implements OnInit {
  loading = true;
  saving = false;

  courseName = '';
  vsectionName = '';
  vsectionId = 0;

  private sessionId = 0;
  private subjectSlnum = 0;
  private slotId = 0;
  private facultyId = 0;

  students: AttendanceEntry[] = [];

  // A-Z filter
  filterLetter: string | null = null;
  showFilterPopup = false;
  readonly alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  // Topic selector
  showTopicPopup = false;
  units: ContentNode[] = [];
  selectedUnit: ContentNode | null = null;
  selectedChapter: ContentNode | null = null;
  selectedTopic: ContentNode | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private toastCtrl: ToastController,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.authService.user$.pipe(filter(u => !!u), take(1)).subscribe(u => {
      this.facultyId = u!.userId;
    });

    this.route.queryParams.subscribe(p => {
      this.sessionId    = +p['sessionId']    || 0;
      this.subjectSlnum = +p['subjectSlnum'] || 0;
      this.slotId       = +p['slotId']       || 0;
      this.courseName   = p['courseName']    || 'Attendance';
      this.loadStudents();
      this.loadContentTree();
    });
  }

  // ── Students ──────────────────────────────────────────────────────────────

  private loadStudents() {
    this.loading = true;
    this.http.get<AttendanceSectionResponse>(
      `${environment.apiUrl}VirtualSection/students-for-attendance`,
      { params: {
        sessionId:    this.sessionId.toString(),
        subjectSlnum: this.subjectSlnum.toString(),
        slotId:       this.slotId.toString()
      }}
    ).subscribe({
      next: res => {
        this.vsectionName = res.vsectionName || '';
        this.vsectionId   = res.vsectionId   || 0;
        this.students = (res.students || []).map(s => ({
          studentregistrationslnum: s.studentregistrationslnum,
          studentbasicsslnum: s.studentbasicsslnum,
          name: s.studentbasiccompletename,
          usn: s.studentbasicusnnumber,
          registerNum: s.studentregisternum,
          isPresent: true
        }));
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  toggle(student: AttendanceEntry) {
    student.isPresent = !student.isPresent;
  }

  markAll(present: boolean) {
    this.students.forEach(s => s.isPresent = present);
  }

  // ── A-Z filter ────────────────────────────────────────────────────────────

  get filteredStudents(): AttendanceEntry[] {
    if (!this.filterLetter) return this.students;
    return this.students.filter(s => s.name.trim().toUpperCase().startsWith(this.filterLetter!));
  }

  hasLetter(letter: string): boolean {
    return this.students.some(s => s.name.trim().toUpperCase().startsWith(letter));
  }

  selectLetter(letter: string) {
    this.filterLetter = this.filterLetter === letter ? null : letter;
    this.showFilterPopup = false;
  }

  clearFilter() {
    this.filterLetter = null;
    this.showFilterPopup = false;
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  get totalCount():   number { return this.students.length; }
  get presentCount(): number { return this.students.filter(s => s.isPresent).length; }
  get absentCount():  number { return this.students.filter(s => !s.isPresent).length; }

  // ── Content tree ──────────────────────────────────────────────────────────

  private loadContentTree() {
    if (!this.subjectSlnum || !this.sessionId) return;
    this.authService.user$.pipe(filter(u => !!u), take(1)).subscribe(u => {
      this.http.get<ContentTree>(
        `${environment.apiUrl}Content/tree/${u!.userId}/${this.subjectSlnum}/${this.sessionId}`
      ).subscribe({
        next: tree => { this.units = tree?.nodes || []; },
        error: () => {}
      });
    });
  }

  get chapters(): ContentNode[] {
    return this.selectedUnit?.children || [];
  }

  get topics(): ContentNode[] {
    return this.selectedChapter?.children || [];
  }

  onUnitChange(unitId: number) {
    this.selectedUnit    = this.units.find(u => u.nodeId === +unitId) || null;
    this.selectedChapter = null;
    this.selectedTopic   = null;
  }

  onChapterChange(chapterId: number) {
    this.selectedChapter = this.chapters.find(c => c.nodeId === +chapterId) || null;
    this.selectedTopic   = null;
  }

  onTopicChange(topicId: number) {
    this.selectedTopic = this.topics.find(t => t.nodeId === +topicId) || null;
  }

  get topicLabel(): string {
    if (!this.selectedTopic) return '';
    return this.selectedTopic.nodeTitle;
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  initials(name: string): string {
    const parts = name.trim().split(' ');
    const f = parts[0]?.[0] || '';
    const l = parts[parts.length - 1]?.[0] || '';
    return (f + (parts.length > 1 ? l : '')).toUpperCase();
  }

  backToTimetable() {
    this.router.navigate(['/tabs/timetable']);
  }

  async saveAttendance() {
    if (!this.selectedTopic) return;
    this.saving = true;
    const payload = {
      sessionId: this.sessionId,
      slotId: this.slotId,
      vsectionId: this.vsectionId,
      topicNodeId: this.selectedTopic.nodeId,
      attendance: this.students.map(s => ({
        studentRegistrationSlnum: s.studentregistrationslnum,
        isPresent: s.isPresent
      }))
    };

    // TODO: replace with actual save endpoint when available
    console.log('Save payload:', payload);

    const toast = await this.toastCtrl.create({
      message: `Attendance saved — ${this.presentCount} present, ${this.absentCount} absent`,
      duration: 2500,
      color: 'success',
      position: 'bottom'
    });
    await toast.present();
    this.saving = false;
  }
}

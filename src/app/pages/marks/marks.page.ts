import { Component, OnInit } from '@angular/core';
import { filter, take } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { AcademicService, SubjectMarksRecord } from '../../core/services/academic.service';
import { TimetableSession } from '../../models/timetable.model';

@Component({
  selector: 'app-marks',
  templateUrl: './marks.page.html',
  styleUrls: ['./marks.page.scss'],
  standalone: false
})
export class MarksPage implements OnInit {
  isLoading = true;
  error = false;
  errorMessage = '';

  sessions: TimetableSession[] = [];
  selectedSessionId: number | null = null;
  selectedSessionName = '';

  subjects: SubjectMarksRecord[] = [];
  studentSlnum = 0;
  totalCreditsRequired = 160;

  grandTotalObtained = 0;
  grandTotalMax = 0;
  overallPercentage: number | null = null;

  constructor(
    private authService: AuthService,
    private academicService: AcademicService
  ) {}

  ngOnInit() {
    this.authService.user$.pipe(
      filter(u => !!u),
      take(1)
    ).subscribe(u => {
      this.studentSlnum = u!.userId;
      this.totalCreditsRequired = u!.totalCreditsRequired || 160;
      this.loadSessions();
    });
  }

  loadSessions() {
    this.isLoading = true;
    this.error = false;

    this.academicService.getSessions().subscribe({
      next: (sessions) => {
        this.sessions = sessions || [];
        if (this.sessions.length > 0) {
          const current = this.sessions.find(s => s.iscurrentsession) || this.sessions[0];
          this.selectedSessionId = current.sessionslnum;
          this.selectedSessionName = current.sessionname;
          this.loadMarks();
        } else {
          this.isLoading = false;
        }
      },
      error: () => {
        this.isLoading = false;
        this.error = true;
        this.errorMessage = 'Unable to load academic sessions. Please try again.';
      }
    });
  }

  onSessionChange(event: any) {
    const sessionId = Number(event.detail.value);
    if (sessionId && sessionId !== this.selectedSessionId) {
      this.selectedSessionId = sessionId;
      const found = this.sessions.find(s => s.sessionslnum === sessionId);
      this.selectedSessionName = found ? found.sessionname : '';
      this.loadMarks();
    }
  }

  loadMarks(event?: any) {
    if (!this.studentSlnum || !this.selectedSessionId) {
      this.isLoading = false;
      event?.target?.complete();
      return;
    }

    this.isLoading = true;
    this.error = false;

    this.academicService.getStudentMarks(this.studentSlnum, this.selectedSessionId).subscribe({
      next: (records) => {
        this.subjects = records || [];
        this.calculateMetrics();
        this.isLoading = false;
        event?.target?.complete();
      },
      error: () => {
        this.isLoading = false;
        this.error = true;
        this.errorMessage = 'Unable to load assessment marks. Please check your network.';
        event?.target?.complete();
      }
    });
  }

  private calculateMetrics() {
    this.grandTotalObtained = this.subjects.reduce((sum, s) => sum + s.totalObtained, 0);
    this.grandTotalMax = this.subjects.reduce((sum, s) => sum + s.totalMax, 0);
    if (this.grandTotalMax > 0) {
      this.overallPercentage = Math.round((this.grandTotalObtained / this.grandTotalMax) * 100);
    } else {
      this.overallPercentage = null;
    }
  }

  toggleSubject(subject: SubjectMarksRecord) {
    subject.panelOpen = !subject.panelOpen;
  }

  getGrade(pct: number | null): { text: string; color: string } {
    if (pct == null) return { text: 'N/A', color: '#64748b' };
    if (pct >= 90) return { text: 'O (Outstanding)', color: '#059669' };
    if (pct >= 80) return { text: 'A+ (Excellent)', color: '#10b981' };
    if (pct >= 70) return { text: 'A (Very Good)', color: '#2563eb' };
    if (pct >= 60) return { text: 'B+ (Good)', color: '#3b82f6' };
    if (pct >= 50) return { text: 'B (Above Average)', color: '#d97706' };
    if (pct >= 40) return { text: 'C (Pass)', color: '#f59e0b' };
    return { text: 'F (Fail)', color: '#dc2626' };
  }

  getPercentageBadgeClass(pct: number | null): string {
    if (pct == null) return 'badge-neutral';
    if (pct >= 75) return 'badge-success';
    if (pct >= 50) return 'badge-warning';
    return 'badge-danger';
  }
}

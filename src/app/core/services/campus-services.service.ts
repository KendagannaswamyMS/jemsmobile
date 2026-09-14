import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import {
  MenteeStudent,
  MentoringSessionRecord,
  BorrowedBookItem,
  CirculationHistoryItem,
  PlacementOverview,
  PlacementJobItem
} from '../../models/campus-services.model';

@Injectable({ providedIn: 'root' })
export class CampusServicesService {
  constructor(private http: HttpClient) {}

  // ── Mentoring ──────────────────────────────────────────────────────────────

  /**
   * Fetch a student's mentoring meetings, topics discussed, and mentor feedback.
   */
  getStudentMentoring(studentId: number): Observable<MentoringSessionRecord[]> {
    return this.http.get<any>(`${environment.apiUrl}Mentoring/GetStudentMentoringSessions/${studentId}`).pipe(
      map(res => {
        const list: any[] = res?.data || (Array.isArray(res) ? res : []);
        return list.map(s => ({
          sessionId: s.sessionId || s.id || 0,
          meetingDate: s.meetingDate || s.sessionDate || s.createdDate || '',
          meetingTime: s.meetingTime || s.startTime || '',
          mentorName: s.mentorName || s.facultyName || 'Assigned Mentor',
          mentorDesignation: s.mentorDesignation || s.designation || 'Faculty',
          mentorEmail: s.mentorEmail || s.email || '',
          topicsDiscussed: s.topicsDiscussed || s.topic || s.agenda || 'Academic Progress Review',
          remarks: s.remarks || s.notes || '',
          actionItems: s.actionItems || '',
          status: s.status || 'Completed'
        }));
      }),
      catchError(() => of([]))
    );
  }

  /**
   * Fetch a faculty mentor's allocated mentees list.
   */
  getFacultyMentees(facultyId: number): Observable<MenteeStudent[]> {
    return this.http.get<any>(`${environment.apiUrl}Mentoring/GetMyMentees/${facultyId}`).pipe(
      map(res => {
        const list: any[] = res?.data || (Array.isArray(res) ? res : []);
        return list.map(m => ({
          allocationId: m.allocationId || m.id,
          studentId: m.studentId || m.studentSlnum || 0,
          usn: m.usn || m.studentUsn || '',
          fullName: m.fullName || m.studentName || 'Student',
          departmentName: m.departmentName || '',
          semester: Number(m.semester || m.semesterId || 1),
          mobile: m.mobile || m.phone || '',
          email: m.email || '',
          cgpa: m.cgpa != null ? Number(m.cgpa) : undefined,
          attendancePercent: m.attendancePercent != null ? Number(m.attendancePercent) : undefined
        }));
      }),
      catchError(() => of([]))
    );
  }

  // ── Library Services (Koha) ────────────────────────────────────────────────

  /**
   * Fetch currently borrowed books for student (USN) or staff (employee code).
   */
  getBorrowedBooks(patronId: string): Observable<BorrowedBookItem[]> {
    if (!patronId) return of([]);
    return this.http.get<any[]>(`${environment.apiUrl}koha/borrowed-books?userid=${encodeURIComponent(patronId)}`).pipe(
      map(items => {
        if (!Array.isArray(items)) return [];
        return items.map((b: any) => {
          const due = b.date_due || b.dueDate || '';
          const daysRemaining = b.daysRemaining != null ? Number(b.daysRemaining) : undefined;
          const isOverdue = !!b.isOverdue || (daysRemaining != null && daysRemaining < 0);

          return {
            issueId: b.issue_id || b.issueId || 0,
            biblioId: b.biblionumber || b.biblioId,
            title: b.title || 'Library Book',
            author: b.author || 'Author',
            isbn: b.isbn || '',
            barcode: b.barcode || '—',
            issuedDate: b.issuedate || b.issuedDate || '',
            dueDate: due,
            daysRemaining,
            isOverdue,
            fineAmount: b.fineAmount != null ? Number(b.fineAmount) : 0,
            coverUrl: b.coverUrl || ''
          };
        });
      }),
      catchError(() => of([]))
    );
  }

  /**
   * Fetch circulation / returned checkouts history.
   */
  getCirculationHistory(patronId: string): Observable<CirculationHistoryItem[]> {
    if (!patronId) return of([]);
    return this.http.get<any[]>(`${environment.apiUrl}koha/circulation-history?userid=${encodeURIComponent(patronId)}`).pipe(
      map(items => {
        if (!Array.isArray(items)) return [];
        return items.map((c: any) => ({
          title: c.title || 'Book',
          author: c.author || '',
          barcode: c.barcode || '—',
          issuedDate: c.issuedate || c.issuedDate || '',
          returnedDate: c.returndate || c.returnedDate || ''
        }));
      }),
      catchError(() => of([]))
    );
  }

  // ── Placement & Training ───────────────────────────────────────────────────

  /**
   * Fetch student placement dashboard including active job drives and applications.
   */
  getStudentPlacements(studentSlnum: number): Observable<PlacementOverview> {
    return this.http.get<any>(`${environment.apiUrl}placement/dashboard/student/${studentSlnum}`).pipe(
      map(data => {
        const rawJobs: any[] = Array.isArray(data?.jobs || data?.drives) ? (data.jobs || data.drives) : [];
        const jobs: PlacementJobItem[] = rawJobs.map((j: any) => ({
          jobId: j.jobId || j.id || 0,
          companyName: j.companyName || j.company || 'Company',
          jobRole: j.jobRole || j.role || j.designation || 'Position',
          packageLpa: j.packageLpa != null ? Number(j.packageLpa) : (j.ctc ? Number(j.ctc) : undefined),
          applicationDeadline: j.applicationDeadline || j.deadline || '',
          driveDate: j.driveDate || '',
          status: j.status || 'Eligible',
          eligibilityCriteria: j.eligibilityCriteria || j.criteria || ''
        }));

        return {
          studentSlnum,
          eligibleDrivesCount: Number(data?.eligibleDrivesCount ?? jobs.length),
          appliedCount: Number(data?.appliedCount ?? jobs.filter(j => j.status === 'Applied').length),
          shortlistedCount: Number(data?.shortlistedCount ?? jobs.filter(j => j.status === 'Shortlisted').length),
          offersCount: Number(data?.offersCount ?? jobs.filter(j => j.status === 'Selected').length),
          jobs
        };
      }),
      catchError(() => of({
        studentSlnum,
        eligibleDrivesCount: 0,
        appliedCount: 0,
        shortlistedCount: 0,
        offersCount: 0,
        jobs: []
      }))
    );
  }
}

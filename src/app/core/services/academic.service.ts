import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { TimetableSession, SessionWeek, TimetableSlot } from '../../models/timetable.model';

export interface ClassScheduleItem {
  time: string;
  end: string;
  code: string;
  title: string;
  room: string;
  faculty: string;
  status: 'done' | 'now' | 'upcoming';
  activityType?: string;
  marked?: boolean;
}

export interface EnrolledSubject {
  subjectSlnum: number;
  code: string;
  name: string;
  faculty: string;
  credits: number;
  status: 'Ongoing' | 'Completed' | 'Pending';
  subjectType: string;
  department: string;
  program: string;
}

export interface QuizAssessment {
  index: number;
  quizTitle: string;
  startedAt: string;
  questionType: string;
  marksObtained: number | null;
  totalMarks: number;
  percentage: number | null;
  expanded?: boolean;
}

export interface SubjectMarksRecord {
  subjectId: number;
  subjectName: string;
  subjectCode: string;
  quizzes: QuizAssessment[];
  totalObtained: number;
  totalMax: number;
  overallPercentage: number | null;
  panelOpen?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AcademicService {
  constructor(private http: HttpClient) {}

  getSessions(): Observable<TimetableSession[]> {
    return this.http.get<TimetableSession[]>(`${environment.apiUrl}univesitymaster/getsessions`).pipe(
      catchError(() => of([]))
    );
  }

  getSessionWeeks(sessionId: number): Observable<SessionWeek[]> {
    return this.http.get<SessionWeek[]>(`${environment.apiUrl}timetable/session/${sessionId}/weeks`).pipe(
      catchError(() => of([]))
    );
  }

  getStudentTimetable(studentSlnum: number, sessionId: number, weekNumber?: number): Observable<any> {
    let params = new HttpParams().set('sessionId', sessionId.toString());
    if (weekNumber != null) {
      params = params.set('weekNumber', weekNumber.toString());
    }
    return this.http.get<any>(`${environment.apiUrl}timetable/student/${studentSlnum}`, { params }).pipe(
      catchError(() => of({ slots: [] }))
    );
  }

  getFacultyTimetable(userId: number, sessionId: number, weekNumber?: number): Observable<TimetableSlot[]> {
    let params = new HttpParams();
    if (weekNumber != null) {
      params = params.set('weekNumber', weekNumber.toString());
    }
    return this.http.get<TimetableSlot[]>(
      `${environment.apiUrl}FacultyWorkload/gettimetable/${userId}/${sessionId}`,
      { params }
    ).pipe(catchError(() => of([])));
  }

  getStudentSubjects(studentSlnum: number): Observable<EnrolledSubject[]> {
    return this.http.get<any[]>(`${environment.apiUrl}studentauth/subjects/${studentSlnum}`).pipe(
      map(items => {
        if (!Array.isArray(items)) return [];
        return items.map(s => ({
          subjectSlnum: Number(s.subjectSlnum ?? s.SubjectSlnum ?? s.slnum ?? 0),
          code: s.code || s.subjectCode || s.subCode || 'N/A',
          name: s.name || s.subjectName || s.subName || 'Subject',
          faculty: s.faculty || s.facultyName || s.staffName || 'Faculty',
          credits: Number(s.credits ?? s.credit ?? 0),
          status: this.resolveSubjectStatus(s.status),
          subjectType: s.subjectType || 'Theory',
          department: s.department || s.departmentName || '',
          program: s.program || s.programName || ''
        }));
      }),
      catchError(() => of([]))
    );
  }

  getStudentMarks(studentSlnum: number, sessionId: number): Observable<SubjectMarksRecord[]> {
    return this.http.get<any[]>(`${environment.apiUrl}quiz/student/${studentSlnum}/marks?sessionId=${sessionId}`).pipe(
      map(data => {
        if (!Array.isArray(data)) return [];
        return data.map(item => {
          const sorted = [...(item.quizzes || [])].sort(
            (a: any, b: any) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
          );
          const quizzes: QuizAssessment[] = sorted.map((q: any, i: number) => {
            const obtained = q.marksObtained != null ? Number(q.marksObtained) : null;
            const total = Number(q.totalMarks ?? 0);
            const percentage = obtained != null && total > 0 ? Math.round((obtained / total) * 100) : null;
            return {
              index: i + 1,
              quizTitle: q.quizTitle || `Assessment ${i + 1}`,
              startedAt: q.startedAt || '',
              questionType: q.questionType || 'Quiz',
              marksObtained: obtained,
              totalMarks: total,
              percentage,
              expanded: false
            };
          });

          const totalObtained = quizzes.reduce((sum, q) => sum + (q.marksObtained ?? 0), 0);
          const totalMax = quizzes.reduce((sum, q) => sum + q.totalMarks, 0);
          const overallPercentage = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : null;

          return {
            subjectId: item.subjectId || 0,
            subjectName: item.subjectName || 'Subject',
            subjectCode: item.subjectCode || '',
            quizzes,
            totalObtained,
            totalMax,
            overallPercentage,
            panelOpen: true
          };
        });
      }),
      catchError(() => of([]))
    );
  }

  getStudentAttendanceSummary(studentSlnum: number, sessionId: number): Observable<any> {
    return this.http.get<any>(
      `${environment.apiUrl}timetable/student/${studentSlnum}/attendance-summary?sessionId=${sessionId}`
    ).pipe(catchError(() => of(null)));
  }

  /** Calculate current/upcoming/past status for today's classes */
  computeClassSchedule(rawSlots: any[]): ClassScheduleItem[] {
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();

    const normalized = (rawSlots || []).map(s => {
      const startStr = s.startTime ?? s.starttime ?? '';
      const endStr = s.endTime ?? s.endtime ?? '';
      const [sh, sm] = startStr.split(':').map(Number);
      const [eh, em] = endStr ? endStr.split(':').map(Number) : [sh + 1, sm || 0];
      const startMins = (sh || 0) * 60 + (sm || 0);
      const endMins = (eh || 0) * 60 + (em || 0);

      let status: 'done' | 'now' | 'upcoming';
      if (nowMins > endMins) {
        status = 'done';
      } else if (nowMins >= startMins && nowMins <= endMins) {
        status = 'now';
      } else {
        status = 'upcoming';
      }

      return {
        time: startStr ? startStr.substring(0, 5) : '--:--',
        end: endStr ? endStr.substring(0, 5) : '--:--',
        code: s.subjectCode ?? s.courseCode ?? '',
        title: s.subjectName ?? s.courseName ?? s.activityType ?? s.activitytype ?? 'Class',
        room: s.roomNumber ?? s.roomnumber ?? '',
        faculty: s.facultyName ?? s.faculty ?? s.staffName ?? '',
        activityType: s.activityType ?? s.activitytype ?? 'Lecture',
        status,
        marked: s.attendanceStatus === 'present' || s.attendanceStatus === 'absent'
      } as ClassScheduleItem;
    });

    return normalized.sort((a, b) => a.time.localeCompare(b.time));
  }

  findNextClass(items: ClassScheduleItem[]): ClassScheduleItem | null {
    if (!items || items.length === 0) return null;
    const current = items.find(i => i.status === 'now');
    if (current) return current;
    return items.find(i => i.status === 'upcoming') || null;
  }

  private resolveSubjectStatus(raw: any): 'Ongoing' | 'Completed' | 'Pending' {
    if (!raw) return 'Ongoing';
    const s = String(raw).toLowerCase();
    if (s === 'completed' || s === 'complete') return 'Completed';
    if (s === 'pending' || s === 'upcoming') return 'Pending';
    return 'Ongoing';
  }
}

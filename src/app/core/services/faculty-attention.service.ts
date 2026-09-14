import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import {
  CiePendingItem,
  QpsInviteItem,
  PendingLeaveItem,
  FacultyAttentionSummary,
  UnmarkedAttendanceItem
} from '../../models/faculty-attention.model';

@Injectable({ providedIn: 'root' })
export class FacultyAttentionService {
  constructor(private http: HttpClient) {}

  /**
   * Fetch pending CIE entries assigned to the logged-in faculty member.
   * Endpoint: GET /api/CiePending/entries/my/{userId}
   */
  getMyCiePending(userId: number): Observable<CiePendingItem[]> {
    return this.http.get<any[]>(`${environment.apiUrl}CiePending/entries/my/${userId}`).pipe(
      map(items => {
        if (!Array.isArray(items)) return [];
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        return items
          .filter(e => !e.isCompleted)
          .map(e => {
            let urgency: 'overdue' | 'due_soon' | 'normal' = 'normal';
            let delayDays = 0;

            if (e.lastDate) {
              const last = new Date(e.lastDate);
              last.setHours(0, 0, 0, 0);
              const diffTime = last.getTime() - now.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

              if (diffDays < 0) {
                urgency = 'overdue';
                delayDays = Math.abs(diffDays);
              } else if (diffDays <= 3) {
                urgency = 'due_soon';
                delayDays = diffDays;
              } else {
                urgency = 'normal';
              }
            }

            return {
              id: e.id,
              subjectCode: e.subjectCode || '',
              subjectName: e.subjectName || 'Subject',
              className: e.className || '',
              entryType: e.entryType || 'CIE',
              pendingCount: Number(e.pendingCount ?? 0),
              lastDate: e.lastDate,
              isCompleted: !!e.isCompleted,
              academicYear: e.academicYear,
              semesterType: e.semesterType,
              urgency,
              delayDays
            };
          });
      }),
      catchError(() => of([]))
    );
  }

  /**
   * Fetch Question Paper Setting (QPS) invites for the logged-in faculty member.
   * Endpoint: POST /api/Examination/getmyexamppsinvites
   */
  getMyQpsInvites(userId: number): Observable<QpsInviteItem[]> {
    return this.http.post<any[]>(`${environment.apiUrl}Examination/getmyexamppsinvites`, { UserId: userId }).pipe(
      map(items => {
        if (!Array.isArray(items)) return [];
        return items.map(q => {
          const statusName = q.qpsStatusName || (q.qpsstatus === 1 ? 'Invited' : q.qpsstatus === 2 ? 'Accepted' : 'Pending');
          const isPending = !q.submittedon || statusName.toLowerCase().includes('invite') || statusName.toLowerCase().includes('accept');

          return {
            slnum: q.slnum,
            subjectCode: q.subjectcode,
            subjectCodeName: q.subjectCodeName || 'QP Setting',
            subjectCodeTitle: q.subjectCodeTitle || '',
            questionpaperfor: q.questionpaperfor,
            renumerationName: q.renumerationName || '',
            qpsStatus: q.qpsstatus,
            qpsStatusName: statusName,
            submittedon: q.submittedon,
            remarkifrejected: q.remarkifrejected,
            actionNeeded: isPending
          };
        });
      }),
      catchError(() => of([]))
    );
  }

  /**
   * Fetch pending leave approval requests for HOD / Approver.
   * Endpoint: GET /api/hrms/LeaveApproval/approver-dashboard/{userId}
   * Fallback: POST /api/leavemanagement/getleavesbydepartmentid
   */
  getPendingLeavesForApprover(userId: number, departmentId?: number): Observable<PendingLeaveItem[]> {
    return this.http.get<any>(`${environment.apiUrl}hrms/LeaveApproval/approver-dashboard/${userId}`).pipe(
      map(res => {
        const pending = res?.pendingApprovals || (Array.isArray(res) ? res : []);
        if (Array.isArray(pending) && pending.length > 0) {
          return pending.map((item: any) => ({
            applicationId: item.applicationId || item.applicationid || item.id,
            employeeName: item.employeeName || item.applicantName || item.employee?.fullName || 'Faculty Member',
            employeeCode: item.employeeCode || item.empCode || item.employee?.employeeCode || '',
            departmentName: item.departmentName || item.dept || '',
            leaveTypeName: item.leaveTypeName || item.leaveType?.leaveName || item.leaveType || 'Leave',
            fromDate: item.fromDate || item.fromdate || '',
            toDate: item.toDate || item.todate || '',
            totalDays: Number(item.totalDays ?? item.totaldays ?? 1),
            reason: item.reason || '',
            appliedDate: item.appliedDate || item.applieddate || item.createdOn || ''
          }));
        }
        return [];
      }),
      catchError(() => {
        if (!departmentId) return of([]);
        return this.http.post<any>(`${environment.apiUrl}leavemanagement/getleavesbydepartmentid`, { departmentId }).pipe(
          map(res => {
            const apps: any[] = res?.applications || (Array.isArray(res) ? res : []);
            return apps
              .filter((a: any) => (a.status || a.finalStatusName || '').toUpperCase() === 'PENDING')
              .map((a: any) => ({
                applicationId: a.applicationId || a.id,
                employeeName: a.employeeName || a.employee?.fullName || 'Faculty Member',
                employeeCode: a.employeeCode || a.employee?.employeeCode || '',
                departmentName: a.departmentName || '',
                leaveTypeName: a.leaveTypeName || a.leaveType?.leaveName || 'Leave',
                fromDate: a.fromDate || '',
                toDate: a.toDate || '',
                totalDays: Number(a.totalDays ?? 1),
                reason: a.reason || '',
                appliedDate: a.appliedDate || ''
              }));
          }),
          catchError(() => of([]))
        );
      })
    );
  }

  /**
   * Aggregate complete faculty attention summary strictly respecting role permissions:
   * - Faculty only sees their own CIE marks and QPS invites.
   * - HOD additionally sees department leave approvals.
   * - Non-teaching staff gets empty faculty actions.
   */
  getFacultyAttentionSummary(
    userId: number,
    isHod: boolean,
    isFaculty: boolean,
    departmentId?: number
  ): Observable<FacultyAttentionSummary> {
    if (!isFaculty && !isHod) {
      return of({
        cieCount: 0,
        qpsCount: 0,
        leaveCount: 0,
        unmarkedAttendanceCount: 0,
        totalPendingCount: 0,
        cieItems: [],
        qpsItems: [],
        leaveItems: [],
        unmarkedAttendanceItems: []
      });
    }

    const cie$ = isFaculty || isHod ? this.getMyCiePending(userId) : of([]);
    const qps$ = isFaculty || isHod ? this.getMyQpsInvites(userId) : of([]);
    const leaves$ = isHod ? this.getPendingLeavesForApprover(userId, departmentId) : of([]);

    return forkJoin({
      cie: cie$,
      qps: qps$,
      leaves: leaves$
    }).pipe(
      map(({ cie, qps, leaves }) => {
        const pendingQps = qps.filter(q => q.actionNeeded);
        const total = cie.length + pendingQps.length + leaves.length;

        return {
          cieCount: cie.length,
          qpsCount: pendingQps.length,
          leaveCount: leaves.length,
          unmarkedAttendanceCount: 0,
          totalPendingCount: total,
          cieItems: cie,
          qpsItems: pendingQps,
          leaveItems: leaves,
          unmarkedAttendanceItems: []
        };
      })
    );
  }
}

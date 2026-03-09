import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private url(path: string) { return `${this.base}${path}`; }

  get<T>(path: string, params?: any): Observable<T> {
    return this.http.get<T>(this.url(path), { params });
  }

  post<T>(path: string, body: any): Observable<T> {
    return this.http.post<T>(this.url(path), body);
  }

  put<T>(path: string, body: any): Observable<T> {
    return this.http.put<T>(this.url(path), body);
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(this.url(path));
  }

  // ── Auth ────────────────────────────────────────────────────────────
  login(payload: any): Observable<any> {
    return this.post('userAuth/authenticateuser', payload);
  }

  studentLogin(payload: any): Observable<any> {
    return this.post('StudentPortal/login', payload);
  }

  // ── Sessions ────────────────────────────────────────────────────────
  getSessions(): Observable<any[]> {
    return this.get('univesitymaster/getsessions');
  }

  getSessionWeeks(sessionId: number): Observable<any[]> {
    return this.get(`academicsessions/${sessionId}/weeks`);
  }

  // ── Student Portal ──────────────────────────────────────────────────
  getStudentDashboard(studentId: number): Observable<any> {
    return this.get(`StudentPortal/${studentId}/dashboard`);
  }

  getStudentTimetable(studentId: number, sessionId: number, week?: number): Observable<any> {
    let params: any = { sessionId };
    if (week != null) params['weekNumber'] = week;
    return this.get(`StudentPortal/${studentId}/timetable`, params);
  }

  getStudentAttendanceSummary(studentId: number, sessionId: number): Observable<any> {
    return this.get(`StudentPortal/${studentId}/attendance`, { sessionId });
  }

  // ── Faculty Workload ────────────────────────────────────────────────
  getMyWorkloads(facultyId: number): Observable<any[]> {
    return this.get(`FacultyWorkload/getworkloadbyfaculty/${facultyId}`);
  }

  getDepartmentWorkloads(hodId: number): Observable<any[]> {
    return this.get(`FacultyWorkload/getdepartmentworkloads/${hodId}`);
  }

  getFacultyTimetable(facultyId: number, sessionId: number, week?: number): Observable<any> {
    let params: any = {};
    if (week != null) params.weekNumber = week;
    return this.get(`FacultyWorkload/gettimetable/${facultyId}/${sessionId}`, params);
  }

  getStudentsForAttendance(sessionId: number, subjectSlnum: number, slotId: number): Observable<any[]> {
    return this.get('VirtualSection/students-for-attendance', { sessionId, subjectSlnum, slotId });
  }

  submitWorkload(id: number, remarks?: string): Observable<any> {
    return this.post(`FacultyWorkload/submitworkload`, { workloadId: id, remarks });
  }

  // ── Biometric / Attendance ──────────────────────────────────────────
  getWeeklyAttendance(userId: number, selectedDate: string): Observable<any> {
    return this.post('biometriclog/getweeklyattendancerecords', {
      UserId: userId,
      selectedDate
    });
  }

  getBirthdayList(): Observable<any> {
    return this.get('UserMaster/getuserbirthdaylist');
  }

  getLatestJoiners(): Observable<any> {
    return this.get('UserMaster/getthelatest');
  }

  getEvents(): Observable<any> {
    return this.get('newsandevent/getevent');
  }

  getEmployeeDirectory(payload?: { departmentId?: number[]; designationId?: number; EmptypeID?: number; StaffTypeId?: number }): Observable<any[]> {
    const body = {
      departmentId: payload?.departmentId ?? [-1],
      designationId: payload?.designationId ?? -1,
      EmptypeID: payload?.EmptypeID ?? -1,
      StaffTypeId: payload?.StaffTypeId ?? -1
    };
    return this.post('DashboardDep/GetUserMasterForDept', body);
  }

  // ── Help Desk ───────────────────────────────────────────────────────
  getHelpdeskDashboardStats(userId: number): Observable<any> {
    return this.post('HelpDesk/dashboard', { UserId: userId });
  }

  getAllHelpdeskTickets(filter: any, userId: number): Observable<any> {
    return this.http.post(this.url('HelpDesk/tickets'), filter, { headers: { userId: String(userId) } });
  }

  getHelpdeskTicketById(id: number, userId: number): Observable<any> {
    return this.http.get(this.url(`HelpDesk/ticket/${id}`), { headers: { userId: String(userId) } });
  }

  getMyHelpdeskTickets(userId: number): Observable<any> {
    return this.post('HelpDesk/mytickets', { UserId: userId });
  }

  getAssignedHelpdeskTickets(userId: number): Observable<any> {
    return this.post('HelpDesk/assignedtickets', { UserId: userId });
  }

  createHelpdeskTicket(payload: any, userId: number): Observable<any> {
    return this.http.post(this.url('HelpDesk/createticket'), payload, { headers: { userId: String(userId) } });
  }

  updateHelpdeskTicket(id: number, payload: any, userId: number): Observable<any> {
    return this.http.put(this.url(`HelpDesk/updateticket/${id}`), payload, { headers: { userId: String(userId) } });
  }

  addHelpdeskConversation(payload: any, userId: number): Observable<any> {
    return this.http.post(this.url('HelpDesk/addconversation'), payload, { headers: { userId: String(userId) } });
  }

  closeHelpdeskTicket(payload: any, userId: number): Observable<any> {
    return this.http.post(this.url('HelpDesk/closeticket'), payload, { headers: { userId: String(userId) } });
  }

  reopenHelpdeskTicket(payload: any, userId: number): Observable<any> {
    return this.post('HelpDesk/reopenticket', payload);
  }

  rateHelpdeskTicket(payload: any, userId: number): Observable<any> {
    return this.http.post(this.url('HelpDesk/rateticket'), payload, { headers: { userId: String(userId) } });
  }

  getHelpdeskRequestTypes(): Observable<any> {
    return this.get('HelpDesk/requesttypes');
  }

  getHelpdeskStatuses(): Observable<any> {
    return this.get('HelpDesk/statuses');
  }

  getHelpdeskPriorities(): Observable<any> {
    return this.get('HelpDesk/priorities');
  }

  getHelpdeskDepartments(): Observable<any> {
    return this.get('HelpDesk/departments');
  }

  downloadHelpdeskAttachment(id: number): Observable<Blob> {
    return this.http.get(`${this.base}HelpDesk/attachment/${id}`, { responseType: 'blob' });
  }

  deleteHelpdeskAttachment(id: number): Observable<any> {
    return this.delete(`HelpDesk/attachments/${id}`);
  }
}

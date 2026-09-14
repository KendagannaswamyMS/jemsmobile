import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap, catchError, of, switchMap } from 'rxjs';
import { environment } from 'src/environments/environment';
import { StorageService } from './storage.service';
import { CurrentUser, MenuItem } from '../../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly USER_KEY = 'currentUser';
  private readonly STUDENT_KEY = 'studentSlnum';
  private currentUser$ = new BehaviorSubject<CurrentUser | null>(null);

  user$ = this.currentUser$.asObservable();

  constructor(private http: HttpClient, private storage: StorageService) {
    const saved = this.storage.getJson<CurrentUser>(this.USER_KEY);
    if (saved) this.currentUser$.next(saved);
  }

  login(email: string, password: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}userAuth/authenticateuser`, {
      UserauthEmail: email,
      UserauthPassword: password
    }).pipe(
      tap(res => {
        console.log('[AuthService.login] raw response:', JSON.stringify(res));
        if (!res) throw new Error('Empty response from server');
        if (res?.message && !res?.token) throw new Error(res.message);
        
        // login() is strictly for Staff / Faculty / HOD / Admin
        const roleName = res.useraccesslist?.[0]?.useraccessaccess || 'Staff';

        const base: CurrentUser = {
          token: res.token || '',
          email: res.userauthEmail || email,
          userId: res.userauthUserslnum || res.userId || 0,
          name: res.userauthEmail || email,
          role: roleName as any,
          isAdmin: res.isAdmin || false,
          departmentId: 0,
          departmentName: '',
          menus: this.mapMenus(res.menus),
          isHod: false,
          isFaculty: false,
          isNonTeaching: false
        };
        // Explicitly set isStudentLogin to 'false' for staff
        this.storage.set('isStudentLogin', 'false');
        this.storage.setJson(this.USER_KEY, base);
        this.currentUser$.next(base);

        // Enrich user details in background — fire and forget
        this.http.get<any>(`${environment.apiUrl}usermaster/getuser`, {
          params: { UserEmailOfficial: email }
        }).subscribe({
          next: (u) => {
            if (!u || !this.currentUser$.value) return;
            const sal = (u.salutation || '').trim();
            const fn = (u.userFName || u.firstName || '').trim();
            const mn = (u.userMname || u.middleName || '').trim();
            const ln = (u.userLName || u.lastName || '').trim();
            const standardizedName = [sal, fn, ln, mn].filter(Boolean).join(' ').trim();

            // Distinct staff role determination
            const employeeRoles = u.employeeRoles || [];
            const isHod = employeeRoles.some((r: any) =>
              (r.roleTypeName || '').includes('Head of the Department') && (r.isActive !== false)
            ) || base.role === 'HOD';

            const desig = (u.registration?.designationName || u.primaryRole?.roleTypeName || u.designation || '').toLowerCase();
            const isFaculty = isHod || desig.includes('prof') || desig.includes('faculty') || desig.includes('lecturer') || desig.includes('teacher') || base.role === 'Faculty';
            const isNonTeaching = !isFaculty && !isHod && !u.isAdmin;

            let determinedRole: any = 'Staff';
            if (u.isAdmin || base.isAdmin) determinedRole = 'Admin';
            else if (isHod) determinedRole = 'HOD';
            else if (isFaculty) determinedRole = 'Faculty';
            else if (isNonTeaching) determinedRole = 'Staff';

            const enriched: CurrentUser = {
              ...base,
              name: standardizedName || u.fullName || base.name,
              salutation: sal,
              firstName: fn,
              middleName: mn,
              lastName: ln,
              fullName: u.fullName || '',
              role: determinedRole,
              isHod,
              isFaculty,
              isNonTeaching,
              isAdmin: u.isAdmin || base.isAdmin,
              employeeRoles,
              employeeCode: u.registration?.employeeCode || u.useremployeecode || '',
              departmentId: u.primaryRole?.departmentId || u.registration?.departmentId || 0,
              departmentName: u.primaryRole?.departmentName || u.registration?.departmentName || '',
              designation: u.registration?.designationName || u.primaryRole?.roleTypeName || '',
              profilePic: u.userProfilepic || '',
              menus: this.mapMenus(u.menus) || base.menus || []
            };
            this.storage.set('isStudentLogin', 'false');
            this.storage.setJson(this.USER_KEY, enriched);
            this.currentUser$.next(enriched);
          },
          error: () => { /* silently ignore background fetch failure */ }
        });
      })
    );
  }

  studentLogin(username: string, password: string): Observable<any> {
    const cleanUser = username.trim().toUpperCase();
    // Use the official studentauth/login contract from the web platform
    return this.http.post<any>(`${environment.apiUrl}studentauth/login`, {
      srNumber: cleanUser,
      password: password,
      rememberMe: true
    }).pipe(
      catchError(err => {
        // Fallback to legacy StudentPortal/login if studentauth/login 404s
        if (err.status === 404 || err.status === 405) {
          return this.http.post<any>(`${environment.apiUrl}StudentPortal/login`, {
            username: cleanUser,
            password
          });
        }
        throw err;
      }),
      tap(res => {
        if (res) {
          const fn = (res.firstName || res.studentName || '').trim();
          const mn = (res.middleName || '').trim();
          const ln = (res.lastName || '').trim();
          const sal = (res.salutation || '').trim();
          const standardizedName = [sal, fn, ln, mn].filter(Boolean).join(' ').trim();

          const isAlumni = !!res.isAlumni;
          const isAutonomousArchive = !!res.isAutonomousArchive;
          const isPassedOut = !!res.isPassedOut;
          const isDocRequestOnly = isAlumni || isAutonomousArchive || isPassedOut;

          const user: CurrentUser = {
            token: res.token || '',
            email: res.email || username,
            userId: res.studentSlnum || res.userId || 0,
            name: standardizedName || res.name || res.studentName || username,
            salutation: sal,
            firstName: fn,
            middleName: mn,
            lastName: ln,
            fullName: res.name || res.studentName || username,
            role: 'Student',
            isAdmin: false,
            departmentId: res.departmentId || 0,
            departmentName: res.departmentName || res.deptName || res.branchName || 'Student',
            profilePic: res.profilePic || res.profilepic || res.userProfilepic || '',
            usn: res.usnNumber || res.usn || res.studentbasicusnnumber || username,
            srNumber: res.srNumber || cleanUser,
            program: res.programName || res.degreeName || res.courseName || '',
            semester: res.semester || res.currentSemester ? `Semester ${res.semester || res.currentSemester}` : '',
            regNumber: res.regNumber || res.registerNumber || res.studentregisternum || '',
            isFirstLogin: !!res.isFirstLogin,
            isAlumni,
            alumniId: res.alumniId ?? null,
            isAutonomousArchive,
            autonomousArchiveId: res.autonomousArchiveId ?? null,
            isPassedOut,
            isDocRequestOnly,
            totalCreditsRequired: res.totalCredits || res.totalCreditsRequired || 160
          };
          this.storage.setJson(this.USER_KEY, user);
          this.storage.set(this.STUDENT_KEY, String(user.userId));
          this.storage.set('isStudentLogin', 'true');
          this.storage.set('isDocRequestOnly', isDocRequestOnly ? 'true' : 'false');
          this.currentUser$.next(user);
        }
      })
    );
  }

  initLogin(srNumber: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}studentauth/initlogin`, {
      srNumber: srNumber.trim().toUpperCase()
    });
  }

  resetPassword(srNumber: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}studentauth/resetpassword`, {
      srNumber: srNumber.trim().toUpperCase()
    });
  }

  changePassword(payload: { srNumber: string; oldPassword?: string; newPassword: string }): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}studentauth/changepassword`, {
      srNumber: payload.srNumber.trim().toUpperCase(),
      oldPassword: payload.oldPassword || '',
      newPassword: payload.newPassword
    });
  }

  logout(): void {
    this.storage.clear();
    this.currentUser$.next(null);
  }

  isLoggedIn(): boolean {
    return !!this.currentUser$.value;
  }

  getCurrentUser(): CurrentUser | null {
    return this.currentUser$.value || this.storage.getJson<CurrentUser>(this.USER_KEY);
  }

  getToken(): string | null {
    return this.currentUser$.value?.token ?? null;
  }

  getStudentId(): number {
    return Number(this.storage.get(this.STUDENT_KEY) || '0');
  }

  isStudent(): boolean {
    if (this.storage.get('isStudentLogin') === 'false') return false;
    if (this.storage.get('isStudentLogin') === 'true') return true;
    const u = this.currentUser$.value || this.storage.getJson<any>(this.USER_KEY);
    if (!u) return false;
    return u.role === 'Student' || !!u.usn || this.getStudentId() > 0;
  }

  isDocRequestOnly(): boolean {
    if (this.storage.get('isDocRequestOnly') === 'true') return true;
    const u = this.getCurrentUser();
    return !!(u?.isDocRequestOnly || u?.isAlumni || u?.isAutonomousArchive || u?.isPassedOut);
  }

  isHod(): boolean {
    const u = this.getCurrentUser();
    return !!(u?.isHod || u?.role === 'HOD');
  }

  isFaculty(): boolean {
    const u = this.getCurrentUser();
    return !!(u?.isFaculty || u?.role === 'Faculty' || this.isHod());
  }

  isNonTeaching(): boolean {
    const u = this.getCurrentUser();
    return !!(u?.isNonTeaching || (u?.role === 'Staff' && !this.isFaculty() && !this.isHod() && !this.isAdmin()));
  }

  isFirstLogin(): boolean {
    const u = this.getCurrentUser();
    return !!u?.isFirstLogin;
  }

  isAdmin(): boolean {
    return this.currentUser$.value?.isAdmin === true || this.getCurrentUser()?.isAdmin === true;
  }

  private mapMenus(raw: any[]): MenuItem[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((m: any) => ({
      id: m.id ?? m.menuId ?? m.menuslnum,
      title: m.title ?? m.menuTitle ?? m.name ?? m.menuName ?? '',
      icon: m.icon ?? m.menuIcon ?? 'ellipse-outline',
      route: m.route ?? m.menuRoute ?? m.url ?? undefined,
      children: this.mapMenus(m.children ?? m.subMenus ?? [])
    }));
  }
}

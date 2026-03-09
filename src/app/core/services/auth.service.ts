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
        if (!res) throw new Error('Empty response from server');
        if (res?.message && !res?.token) throw new Error(res.message);
        
        const base: CurrentUser = {
          token: res.token || '',
          email: res.userauthEmail || email,
          userId: res.userauthUserslnum || res.userId || 0,
          name: res.userauthEmail || email,
          role: res.useraccesslist?.[0]?.useraccessaccess || 'Staff',
          isAdmin: res.isAdmin || false,
          departmentId: 0,
          departmentName: '',
          menus: this.mapMenus(res.menus)
        };
        // Store base user immediately so login can proceed without waiting for getuser
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
            
            const enriched: CurrentUser = {
              ...base,
              name: standardizedName || u.fullName || base.name,
              salutation: sal,
              firstName: fn,
              middleName: mn,
              lastName: ln,
              fullName: u.fullName || '',
              departmentId: u.primaryRole?.departmentId || 0,
              departmentName: u.primaryRole?.departmentName || '',
              designation: u.registration?.designationName || u.primaryRole?.roleTypeName || '',
              profilePic: u.userProfilepic || '',
              menus: this.mapMenus(u.menus) || base.menus || []
            };
            this.storage.setJson(this.USER_KEY, enriched);
            this.currentUser$.next(enriched);
          },
          error: () => { /* silently ignore background fetch failure */ }
        });
      })
    );
  }

  studentLogin(username: string, password: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}StudentPortal/login`, {
      username,
      password
    }).pipe(
      tap(res => {
        if (res) {
          const fn = (res.firstName || res.studentName || '').trim();
          const mn = (res.middleName || '').trim();
          const ln = (res.lastName || '').trim();
          const sal = (res.salutation || '').trim();
          const standardizedName = [sal, fn, ln, mn].filter(Boolean).join(' ').trim();

          const user: CurrentUser = {
            token: res.token || '',
            email: res.email || username,
            userId: res.studentSlnum || res.userId || 0,
            name: standardizedName || res.name || username,
            salutation: sal,
            firstName: fn,
            middleName: mn,
            lastName: ln,
            fullName: res.name || res.studentName || username,
            role: 'Student',
            isAdmin: false,
            departmentId: res.departmentId || 0,
            departmentName: res.departmentName || '',
            profilePic: res.profilePic || res.profilepic || res.userProfilepic || ''
          };
          this.storage.setJson(this.USER_KEY, user);
          this.storage.set(this.STUDENT_KEY, String(user.userId));
          this.currentUser$.next(user);
        }
      })
    );
  }

  logout(): void {
    this.storage.clear();
    this.currentUser$.next(null);
  }

  isLoggedIn(): boolean {
    return !!this.currentUser$.value;
  }

  getCurrentUser(): CurrentUser | null {
    return this.currentUser$.value;
  }

  getToken(): string | null {
    return this.currentUser$.value?.token ?? null;
  }

  getStudentId(): number {
    return Number(this.storage.get(this.STUDENT_KEY) || '0');
  }

  isStudent(): boolean {
    return this.currentUser$.value?.role === 'Student';
  }

  isAdmin(): boolean {
    return this.currentUser$.value?.isAdmin === true;
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

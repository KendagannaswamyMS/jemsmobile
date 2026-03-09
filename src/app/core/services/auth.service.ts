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
  private readonly MAX_MENU_DEPTH = 4;
  private readonly MAX_MENU_ITEMS = 50;
  private currentUser$ = new BehaviorSubject<CurrentUser | null>(null);
  private readonly menuIconAliases: Record<string, string> = {
    dashboard: 'home-outline',
    work: 'briefcase-outline',
    assignment: 'document-text-outline',
    schedule: 'calendar-outline',
    assessment: 'analytics-outline',
    verified: 'checkmark-done-outline',
    approval: 'checkmark-circle-outline',
    domain: 'globe-outline',
    science: 'flask-outline',
    quiz: 'help-circle-outline',
    payments: 'card-outline',
    biotech: 'medkit-outline',
    groups: 'people-outline',
    description: 'document-outline',
    event: 'calendar-number-outline',
    timeline: 'time-outline',
    leaderboard: 'trophy-outline',
    label: 'pricetag-outline',
    contacts: 'people-circle-outline',
    subscriptions: 'layers-outline',
    psychology: 'accessibility-outline',
    apartment: 'business-outline',
    category: 'grid-outline',
    class: 'school-outline',
    security: 'shield-outline',
    church: 'business-outline',
    translate: 'language-outline',
    email: 'mail-outline',
    percent: 'percent-outline',
    balance: 'scale-outline',
    transform: 'swap-horizontal-outline'
  };

  user$ = this.currentUser$.asObservable();

  constructor(private http: HttpClient, private storage: StorageService) {
    const saved = this.storage.getJson<CurrentUser>(this.USER_KEY);
    if (saved) {
      const normalized = this.normalizeStoredUser(saved);
      this.storage.setJson(this.USER_KEY, normalized);
      this.currentUser$.next(normalized);
    }
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
    return this.mapMenusInternal(raw, 0, { count: 0 });
  }

  private mapMenusInternal(raw: any, depth: number, state: { count: number }): MenuItem[] {
    if (!Array.isArray(raw) || depth > this.MAX_MENU_DEPTH || state.count >= this.MAX_MENU_ITEMS) {
      return [];
    }

    const result: MenuItem[] = [];

    for (const m of raw) {
      if (state.count >= this.MAX_MENU_ITEMS) {
        break;
      }

      const children = this.mapMenusInternal(m?.children ?? m?.subMenus ?? [], depth + 1, state);
      const route = this.normalizeMenuRoute(m);
      const title = m?.title ?? m?.menuTitle ?? m?.name ?? m?.menuName ?? '';

      // Ignore web-only menu entries that do not map to a mobile screen.
      if (!route && children.length === 0) {
        continue;
      }

      state.count += 1;
      result.push({
        id: m?.id ?? m?.menuId ?? m?.menuslnum,
        title,
        icon: this.normalizeMenuIcon(m?.icon ?? m?.menuIcon),
        route,
        children
      });
    }

    return result;
  }

  private normalizeStoredUser(user: CurrentUser): CurrentUser {
    return {
      ...user,
      menus: this.mapMenus(user.menus ?? [])
    };
  }

  private normalizeMenuIcon(icon: unknown): string {
    if (typeof icon !== 'string') return 'ellipse-outline';

    const normalized = icon.trim().toLowerCase();
    if (!normalized) return 'ellipse-outline';

    if (normalized.includes('-outline') || normalized.includes('-sharp')) {
      return normalized;
    }

    if (this.menuIconAliases[normalized]) {
      return this.menuIconAliases[normalized];
    }

    return 'ellipse-outline';
  }

  private normalizeMenuRoute(menu: any): string | undefined {
    const rawRoute = String(menu?.route ?? menu?.menuRoute ?? menu?.url ?? menu?.menuUrl ?? '').trim().toLowerCase();
    const rawTitle = String(menu?.title ?? menu?.menuTitle ?? menu?.name ?? menu?.menuName ?? '').trim().toLowerCase();

    if (rawRoute.includes('/tabs/') || rawRoute === '/events') {
      return rawRoute;
    }

    if (rawRoute.includes('dashboard') || rawTitle === 'dashboard' || rawTitle === 'general') {
      return '/tabs/dashboard';
    }

    if (
      rawRoute.includes('faculty-workload') ||
      rawRoute.includes('timetable') ||
      rawTitle.includes('workload') ||
      rawTitle.includes('timetable') ||
      rawTitle.includes('academic')
    ) {
      return '/tabs/faculty';
    }

    if (rawRoute.includes('helpdesk') || rawTitle.includes('help')) {
      return '/tabs/helpdesk';
    }

    if (rawRoute.includes('biometric') || rawTitle.includes('biometric')) {
      return '/tabs/biometric';
    }

    if (
      rawRoute.includes('employee') ||
      rawRoute.includes('directory') ||
      rawTitle.includes('employee') ||
      rawTitle.includes('directory')
    ) {
      return '/tabs/employee-directory';
    }

    if (rawRoute.includes('student') || rawTitle.includes('student')) {
      return '/tabs/student';
    }

    if (rawRoute.includes('event') || rawTitle.includes('event')) {
      return '/events';
    }

    return undefined;
  }
}

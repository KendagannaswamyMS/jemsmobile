import { Component, OnInit } from '@angular/core';
import { MenuController } from '@ionic/angular';
import { Router } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { CurrentUser, MenuItem } from './models/user.model';
import { App } from '@capacitor/app';

type MobileMenuDef = {
  route: string;
  title: string;
  icon: string;
  student?: boolean;
  staff?: boolean;
};

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  private readonly mobileMenuDefs: MobileMenuDef[] = [
    { route: '/tabs/dashboard', title: 'Home', icon: 'home-outline', student: true, staff: true },
    { route: '/tabs/student', title: 'Student', icon: 'school-outline', student: true },
    { route: '/tabs/faculty', title: 'Faculty', icon: 'briefcase-outline', staff: true },
    { route: '/tabs/helpdesk', title: 'Help Desk', icon: 'help-circle-outline', student: true, staff: true },
    { route: '/tabs/biometric', title: 'Weekly Biometric', icon: 'finger-print-outline', staff: true },
    { route: '/tabs/employee-directory', title: 'Employee Directory', icon: 'people-circle-outline', staff: true },
    { route: '/events', title: 'Events', icon: 'calendar-number-outline', student: true, staff: true }
  ];

  user: CurrentUser | null = null;
  expandedMenuIds = new Set<string | number>();

  constructor(
    private authService: AuthService,
    private menuCtrl: MenuController,
    private router: Router
  ) {}

  ngOnInit() {
    this.authService.user$.subscribe(u => {
      this.user = u;
      this.expandedMenuIds.clear();
    });
    App.addListener('backButton', () => {
      const rootRoutes = ['/tabs/dashboard', '/login'];
      const current = this.router.url;
      if (rootRoutes.some(r => current.startsWith(r))) {
        App.exitApp();
      } else {
        window.history.back();
      }
    });
  }

  get userInitials(): string {
    if (!this.user?.name) return 'U';
    return this.user.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(n => n[0].toUpperCase())
      .join('');
  }

  get isStudent(): boolean {
    return this.user?.role === 'Student';
  }

  get menuItems(): MenuItem[] {
    const isStudent = this.isStudent;
    const allowedRoutes = new Set(this.collectRoutes(this.user?.menus ?? []));

    return this.mobileMenuDefs
      .filter(item => this.isMenuAllowed(item, isStudent, allowedRoutes))
      .map(item => ({
        id: item.route,
        title: item.title,
        icon: item.icon,
        route: item.route
      }));
  }

  get hasApiMenus(): boolean {
    return this.menuItems.length > 0;
  }

  isExpanded(item: MenuItem): boolean {
    const key = item.id ?? item.title;
    return this.expandedMenuIds.has(key);
  }

  toggleAccordion(item: MenuItem): void {
    const key = item.id ?? item.title;
    if (this.expandedMenuIds.has(key)) {
      this.expandedMenuIds.delete(key);
    } else {
      this.expandedMenuIds.add(key);
    }
  }

  navigate(route: string): void {
    this.menuCtrl.close();
    this.router.navigateByUrl(route);
  }

  closeMenu() {
    this.menuCtrl.close();
  }

  logout() {
    this.menuCtrl.close();
    this.authService.logout();
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  private collectRoutes(items: MenuItem[]): string[] {
    const routes: string[] = [];

    for (const item of items) {
      if (item.route) {
        routes.push(item.route);
      }
      if (item.children?.length) {
        routes.push(...this.collectRoutes(item.children));
      }
    }

    return routes;
  }

  private isMenuAllowed(item: MobileMenuDef, isStudent: boolean, allowedRoutes: Set<string>): boolean {
    if (isStudent && !item.student) return false;
    if (!isStudent && !item.staff) return false;

    if (item.route === '/tabs/dashboard' || item.route === '/events') {
      return true;
    }

    if (allowedRoutes.size === 0) {
      return true;
    }

    return allowedRoutes.has(item.route);
  }
}

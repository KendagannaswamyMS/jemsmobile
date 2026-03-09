import { Component, OnInit } from '@angular/core';
import { MenuController } from '@ionic/angular';
import { Router } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { CurrentUser, MenuItem } from './models/user.model';
import { App } from '@capacitor/app';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
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
    const apiMenus = this.user?.menus ?? [];
    // Inject custom 'Events' page at bottom for all users dynamically
    if (apiMenus.length > 0 && !apiMenus.some(m => m.route === '/events' || m.route === '/pages/events')) {
      return [...apiMenus, { id: 'evt-custom', title: 'Events', icon: 'calendar-number-outline', route: '/events' }];
    }
    return apiMenus;
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
}

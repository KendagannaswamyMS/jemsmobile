import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: false,
})
export class TabsPage {
  showLogoutModal = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  logout() {
    this.showLogoutModal = true;
  }

  confirmLogout() {
    this.showLogoutModal = false;
    this.authService.logout();
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  cancelLogout() {
    this.showLogoutModal = false;
  }

  goToWorkloads() {
    this.router.navigate(['/tabs/faculty'], { queryParams: { tab: 'workload' } });
  }

  goToTimetable() {
    this.router.navigate(['/tabs/faculty'], { queryParams: { tab: 'timetable' } });
  }
}

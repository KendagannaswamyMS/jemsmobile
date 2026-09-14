import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MenuController } from '@ionic/angular';
import { AuthService } from './core/services/auth.service';
import { CurrentUser } from './models/user.model';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  user: CurrentUser | null = null;
  imgError = false;
  expandedSections: { [key: string]: boolean } = {};

  constructor(
    private authService: AuthService,
    private menuCtrl: MenuController,
    private router: Router
  ) {}

  ngOnInit() {
    this.authService.user$.subscribe(u => {
      this.user = u;
      this.imgError = false;
    });
  }

  get isStudent(): boolean {
    return this.authService.isStudent();
  }

  get displayName(): string {
    const { salutation, firstName, middleName, lastName } = this.user || {};
    return [salutation, firstName, middleName, lastName].filter(Boolean).join(' ') || this.user?.name || '';
  }

  get initials(): string {
    const fn = this.user?.firstName || '';
    const ln = this.user?.lastName || '';
    return ((fn[0] || '') + (ln[0] || '')).toUpperCase() || 'U';
  }

  toggleSection(section: string) {
    this.expandedSections[section] = !this.expandedSections[section];
  }

  isExpanded(section: string): boolean {
    return !!this.expandedSections[section];
  }

  onImgError() {
    this.imgError = true;
  }

  close() {
    this.menuCtrl.close();
  }

  navigate(path: string) {
    this.menuCtrl.close();
    this.router.navigateByUrl(path);
  }

  logout() {
    this.menuCtrl.close();
    this.authService.logout();
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}

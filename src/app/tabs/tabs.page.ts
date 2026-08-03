import { Component } from '@angular/core';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: false
})
export class TabsPage {
  constructor(private authService: AuthService) {}

  get isStudent(): boolean {
    return this.authService.isStudent();
  }
}

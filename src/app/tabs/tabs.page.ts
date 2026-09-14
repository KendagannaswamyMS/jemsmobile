import { Component, OnInit } from '@angular/core';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: false
})
export class TabsPage implements OnInit {
  isStudent = false;

  constructor(private authService: AuthService) {}

  ngOnInit() {
    this.authService.user$.subscribe(() => {
      this.isStudent = this.authService.isStudent();
    });
  }
}

import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class DocRequestOnlyGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): boolean | UrlTree {
    // If the account is an alumni, autonomous archive, or passed-out student,
    // they only have access to document requests — not the academic portal.
    if (this.authService.isDocRequestOnly()) {
      return this.router.createUrlTree(['/tabs/student/doc-request']);
    }
    return true;
  }
}

import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class StaffGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree {
    if (this.authService.isStudent()) {
      return this.router.createUrlTree(['/tabs/home']);
    }

    const requiredRoles = route.data?.['roles'] as string[] | undefined;
    if (requiredRoles && requiredRoles.length > 0) {
      const isHod = this.authService.isHod();
      const isFaculty = this.authService.isFaculty();
      const isAdmin = this.authService.isAdmin();
      const isStaff = this.authService.isNonTeaching();

      const hasRequiredRole = requiredRoles.some(r => {
        if (r === 'Admin') return isAdmin;
        if (r === 'HOD') return isHod || isAdmin;
        if (r === 'Faculty') return isFaculty || isHod || isAdmin;
        if (r === 'Staff') return isStaff || isFaculty || isHod || isAdmin;
        return false;
      });

      if (!hasRequiredRole) {
        return this.router.createUrlTree(['/tabs/home']);
      }
    }

    return true;
  }
}


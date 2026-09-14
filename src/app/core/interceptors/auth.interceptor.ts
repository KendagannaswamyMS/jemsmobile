import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { environment } from 'src/environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService, private router: Router) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.authService.getToken();
    const isApiRequest = request.url.startsWith(environment.apiUrl);
    const isLoginRequest = /\/(?:userAuth\/authenticateuser|studentauth\/login|student\/login)(?:\?|$)/i.test(request.url);
    if (token && isApiRequest && !isLoginRequest) {
      request = request.clone({
        setHeaders: { Authorization: `Bearer ${token}` }
      });
    }
    return next.handle(request).pipe(
      catchError((err: HttpErrorResponse) => {
        // Skip 401 handling for the user-enrichment endpoint so a slow/failing
        // getuser call does not wipe a freshly authenticated session.
        const isEnrichmentCall = request.url.includes('usermaster/getuser');
        if (err.status === 401 && isApiRequest && !isLoginRequest && !isEnrichmentCall
            && token && this.authService.getToken() === token) {
          this.authService.logout();
          this.router.navigate(['/login']);
        }
        return throwError(() => err);
      })
    );
  }
}

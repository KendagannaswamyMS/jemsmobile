import { HttpErrorResponse, HttpHandler, HttpRequest, HttpResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { AuthInterceptor } from './auth.interceptor';
import { environment } from 'src/environments/environment';

describe('AuthInterceptor session isolation', () => {
  let auth: any;
  let router: any;
  let interceptor: AuthInterceptor;
  beforeEach(() => {
    auth = { getToken: jasmine.createSpy().and.returnValue('session-a'), logout: jasmine.createSpy() };
    router = { navigate: jasmine.createSpy() };
    interceptor = new AuthInterceptor(auth, router);
  });

  it('only sends the token to the configured API, excluding login', () => {
    for (const [url, expected] of [
      [environment.apiUrl + 'studentnotice/student/1', 'Bearer session-a'],
      ['https://external.example/file', null],
      [environment.apiUrl + 'studentauth/login', null]
    ]) {
      const next = { handle: (req: HttpRequest<any>) => {
        expect(req.headers.get('Authorization')).toBe(expected);
        return of(new HttpResponse());
      }} as HttpHandler;
      interceptor.intercept(new HttpRequest('GET', url!), next).subscribe();
    }
  });

  it('does not let a late unauthorized response log out a newer session', () => {
    const next = { handle: () => {
      auth.getToken.and.returnValue('session-b');
      return throwError(() => new HttpErrorResponse({ status: 401 }));
    }} as HttpHandler;
    interceptor.intercept(new HttpRequest('GET', environment.apiUrl + 'notices'), next)
      .subscribe({ error: () => {} });
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it('ends the matching session on an API 401', () => {
    const next = { handle: () => throwError(() => new HttpErrorResponse({ status: 401 })) } as HttpHandler;
    interceptor.intercept(new HttpRequest('GET', environment.apiUrl + 'notices'), next)
      .subscribe({ error: () => {} });
    expect(auth.logout).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});

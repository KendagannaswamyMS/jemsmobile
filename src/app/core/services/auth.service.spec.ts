import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { StorageService } from './storage.service';
import { environment } from 'src/environments/environment';

describe('AuthService login contracts', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: StorageService, useValue: { getJson: () => null, setJson: () => {}, set: () => {}, clear: () => {} } }
    ] });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('preserves the student account-not-found error without retrying another endpoint', () => {
    let code = '';
    auth.studentLogin('student', 'password').subscribe({ error: err => code = err.error.code });
    http.expectOne(environment.apiUrl + 'studentauth/login').flush({ code: 'NOT_REGISTERED', message: 'No account' }, { status: 404, statusText: 'Not Found' });
    http.expectNone(environment.apiUrl + 'student/login');
    expect(code).toBe('NOT_REGISTERED');
    expect(auth.isLoggedIn()).toBeFalse();
  });

  it('rejects a tokenless success response', () => {
    const error = jasmine.createSpy();
    auth.studentLogin('student', 'password').subscribe({ error });
    http.expectOne(environment.apiUrl + 'studentauth/login').flush({ message: 'Invalid session' });
    expect(error).toHaveBeenCalled();
    expect(auth.isLoggedIn()).toBeFalse();
  });

  it('ignores a previous staff profile after another login', () => {
    auth.login('first@example.org', 'password').subscribe();
    http.expectOne(environment.apiUrl + 'userAuth/authenticateuser').flush({ token: 'first' });
    const oldProfile = http.expectOne(req => req.url.endsWith('usermaster/getuser'));
    auth.login('second@example.org', 'password').subscribe();
    http.expectOne(environment.apiUrl + 'userAuth/authenticateuser').flush({ token: 'second' });
    const newProfile = http.expectOne(req => req.url.endsWith('usermaster/getuser'));
    oldProfile.flush({ firstName: 'Wrong profile' });
    expect(auth.getCurrentUser()?.token).toBe('second');
    expect(auth.getCurrentUser()?.name).toBe('second@example.org');
    newProfile.flush({ firstName: 'Correct profile' });
    expect(auth.getCurrentUser()?.name).toBe('Correct profile');
  });
});

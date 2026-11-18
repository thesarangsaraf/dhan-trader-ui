import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { userAuthInterceptor } from './user-auth.interceptor';
import { UserAuthService } from '../api/user-auth.service';

describe('userAuthInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authService: UserAuthService;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([userAuthInterceptor])),
        provideHttpClientTesting(),
        provideRouter([{ path: 'login', component: {} as any }]),
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(UserAuthService);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should attach Authorization Bearer header when access token is present', () => {
    localStorage.setItem('dhan_access_token', 'sample-bearer-token');

    http.get('/api/alerts').subscribe();

    const req = httpMock.expectOne('/api/alerts');
    expect(req.request.headers.get('Authorization')).toBe('Bearer sample-bearer-token');
    req.flush([]);
  });

  it('should not attach Authorization header on login endpoint', () => {
    localStorage.setItem('dhan_access_token', 'sample-bearer-token');

    http.post('/api/user-auth/login', { username: 'admin', password: 'pwd' }).subscribe();

    const req = httpMock.expectOne('/api/user-auth/login');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('should automatically refresh token and retry original request when 401 occurs', () => {
    localStorage.setItem('dhan_access_token', 'expired-token');
    localStorage.setItem('dhan_refresh_token', 'valid-refresh-token');

    let responseData: any = null;
    http.get('/api/alerts').subscribe((res) => {
      responseData = res;
    });

    // 1. Initial request fails with 401
    const req1 = httpMock.expectOne('/api/alerts');
    req1.flush({ message: 'Invalid or expired access token' }, { status: 401, statusText: 'Unauthorized' });

    // 2. Interceptor triggers refresh call
    const refreshReq = httpMock.expectOne('/api/user-auth/refresh');
    refreshReq.flush({ accessToken: 'brand-new-access-token' });

    // 3. Original request retried with new token
    const req2 = httpMock.expectOne('/api/alerts');
    expect(req2.request.headers.get('Authorization')).toBe('Bearer brand-new-access-token');
    req2.flush([{ id: 'ALT-1' }]);

    expect(responseData).toEqual([{ id: 'ALT-1' }]);
  });

  it('should NOT call logout when server is restarting (refresh returns null due to status 0)', () => {
    localStorage.setItem('dhan_access_token', 'old-token');
    localStorage.setItem('dhan_refresh_token', 'valid-refresh-token');
    localStorage.setItem('dhan_user', JSON.stringify({ username: 'sarang', role: 'admin' }));
    authService.currentUser.set({ username: 'sarang', role: 'admin' });

    const logoutSpy = vi.spyOn(authService, 'logout');

    let hadError = false;
    http.get('/api/alerts').subscribe({
      error: () => {
        hadError = true;
      },
    });

    // 1. Initial request fails with 401
    const req1 = httpMock.expectOne('/api/alerts');
    req1.flush({ message: 'Token expired' }, { status: 401, statusText: 'Unauthorized' });

    // 2. Refresh endpoint called, but server is down/restarting (status 0)
    const refreshReq = httpMock.expectOne('/api/user-auth/refresh');
    refreshReq.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    expect(hadError).toBe(true);
    // User must NOT be logged out
    expect(logoutSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem('dhan_refresh_token')).toBe('valid-refresh-token');
    expect(authService.isAuthenticated()).toBe(true);
  });
});

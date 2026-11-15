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
        provideRouter([]),
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
});

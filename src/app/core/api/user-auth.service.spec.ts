import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UserAuthService } from './user-auth.service';
import { ActiveSession } from '../models/user-auth.models';

describe('UserAuthService', () => {
  let service: UserAuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        UserAuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'login', component: {} as any }]),
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    });

    service = TestBed.inject(UserAuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created and start as unauthenticated when localStorage is empty', () => {
    expect(service).toBeTruthy();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
  });

  it('should store credentials in localStorage on successful login', () => {
    const mockResponse = {
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      user: { username: 'admin', role: 'admin' },
    };

    service.login({ username: 'admin', password: 'password123' }).subscribe((res) => {
      expect(res).toEqual(mockResponse);
      expect(service.isAuthenticated()).toBe(true);
      expect(service.currentUser()?.username).toBe('admin');
      expect(localStorage.getItem('dhan_access_token')).toBe('test-access-token');
      expect(localStorage.getItem('dhan_refresh_token')).toBe('test-refresh-token');
    });

    const req = httpMock.expectOne('/api/user-auth/login');
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });

  it('should refresh access token using stored refresh token', () => {
    localStorage.setItem('dhan_refresh_token', 'stored-refresh-token');

    service.refreshToken().subscribe((res) => {
      expect(res?.accessToken).toBe('new-access-token');
      expect(localStorage.getItem('dhan_access_token')).toBe('new-access-token');
    });

    const req = httpMock.expectOne('/api/user-auth/refresh');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ refreshToken: 'stored-refresh-token' });
    req.flush({ accessToken: 'new-access-token' });
  });

  it('should NOT call logout when refresh fails due to server restart (status 0) or 500 error', () => {
    localStorage.setItem('dhan_access_token', 'my-token');
    localStorage.setItem('dhan_refresh_token', 'stored-refresh-token');
    localStorage.setItem('dhan_user', JSON.stringify({ username: 'sarang', role: 'admin' }));
    service.currentUser.set({ username: 'sarang', role: 'admin' });

    const logoutSpy = vi.spyOn(service, 'logout');

    service.refreshToken().subscribe((res) => {
      expect(res).toBeNull();
      // Tokens must NOT be cleared when server is restarting / connection refused (status 0)
      expect(logoutSpy).not.toHaveBeenCalled();
      expect(localStorage.getItem('dhan_refresh_token')).toBe('stored-refresh-token');
      expect(service.isAuthenticated()).toBe(true);
    });

    const req = httpMock.expectOne('/api/user-auth/refresh');
    req.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
  });

  it('should call logout when refresh returns 401 Unauthorized (session revoked)', () => {
    localStorage.setItem('dhan_access_token', 'my-token');
    localStorage.setItem('dhan_refresh_token', 'expired-refresh-token');
    const logoutSpy = vi.spyOn(service, 'logout');

    service.refreshToken().subscribe((res) => {
      expect(res).toBeNull();
      expect(logoutSpy).toHaveBeenCalledWith(true);
    });

    const req = httpMock.expectOne('/api/user-auth/refresh');
    req.flush({ message: 'Session expired' }, { status: 401, statusText: 'Unauthorized' });

    const logoutReq = httpMock.expectOne('/api/user-auth/logout');
    logoutReq.flush({ success: true });
  });

  it('should clear localStorage and reset signals on logout', () => {
    localStorage.setItem('dhan_access_token', 'token');
    localStorage.setItem('dhan_refresh_token', 'refresh');
    localStorage.setItem('dhan_user', JSON.stringify({ username: 'admin', role: 'admin' }));
    service.currentUser.set({ username: 'admin', role: 'admin' });

    service.logout(false);

    const req = httpMock.expectOne('/api/user-auth/logout');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ refreshToken: 'refresh' });
    req.flush({ success: true });

    expect(localStorage.getItem('dhan_access_token')).toBeNull();
    expect(localStorage.getItem('dhan_refresh_token')).toBeNull();
    expect(localStorage.getItem('dhan_user')).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  describe('isAdmin computed signal', () => {
    it('should be true when current user role is admin regardless of username', () => {
      service.currentUser.set({ username: 'john_admin', role: 'admin' });
      expect(service.isAdmin()).toBe(true);

      service.currentUser.set({ username: 'alex_admin', role: 'admin' });
      expect(service.isAdmin()).toBe(true);
    });

    it('should be false when user has non-admin role or is null', () => {
      service.currentUser.set({ username: 'trader1', role: 'trader' });
      expect(service.isAdmin()).toBe(false);

      service.currentUser.set({ username: 'viewer1', role: 'viewer' });
      expect(service.isAdmin()).toBe(false);

      service.currentUser.set(null);
      expect(service.isAdmin()).toBe(false);
    });
  });

  describe('User CRUD operations', () => {
    it('should list users via GET /api/user-auth/users', () => {
      const mockUsers = [
        { username: 'sarang', role: 'admin', createdAt: '2026-11-15T00:00:00Z', updatedAt: '2026-11-15T00:00:00Z', sessionCount: 1 },
        { username: 'admin', role: 'admin', createdAt: '2026-11-15T00:00:00Z', updatedAt: '2026-11-15T00:00:00Z', sessionCount: 0 },
      ];

      service.listUsers().subscribe((users) => {
        expect(users).toEqual(mockUsers);
      });

      const req = httpMock.expectOne('/api/user-auth/users');
      expect(req.request.method).toBe('GET');
      req.flush(mockUsers);
    });

    it('should create user via POST /api/user-auth/users', () => {
      service.createUser({ username: 'john', password: 'password123', role: 'trader' }).subscribe((res) => {
        expect(res.success).toBe(true);
      });

      const req = httpMock.expectOne('/api/user-auth/users');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ username: 'john', password: 'password123', role: 'trader' });
      req.flush({ success: true, user: { username: 'john', role: 'trader' } });
    });

    it('should update user via PUT /api/user-auth/users/:username', () => {
      service.updateUser('john', { role: 'admin' }).subscribe((res) => {
        expect(res.success).toBe(true);
      });

      const req = httpMock.expectOne('/api/user-auth/users/john');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ role: 'admin' });
      req.flush({ success: true });
    });

    it('should delete user via DELETE /api/user-auth/users/:username', () => {
      service.deleteUser('john').subscribe((res) => {
        expect(res.success).toBe(true);
      });

      const req = httpMock.expectOne('/api/user-auth/users/john');
      expect(req.request.method).toBe('DELETE');
      req.flush({ success: true });
    });
  });

  describe('Active session management', () => {
    it('should list user sessions via GET /api/user-auth/sessions with x-refresh-token header', () => {
      localStorage.setItem('dhan_refresh_token', 'my-refresh-token');

      const mockSessions: ActiveSession[] = [
        {
          id: 'sess-1',
          username: 'admin',
          browser: 'Chrome',
          os: 'macOS',
          deviceType: 'Desktop',
          createdAt: '2026-11-15T00:00:00Z',
          expiresAt: '2027-11-15T00:00:00Z',
          isCurrent: true,
        },
      ];

      service.getMySessions().subscribe((sessions) => {
        expect(sessions).toEqual(mockSessions);
      });

      const req = httpMock.expectOne('/api/user-auth/sessions');
      expect(req.request.method).toBe('GET');
      expect(req.request.headers.get('x-refresh-token')).toBe('my-refresh-token');
      req.flush(mockSessions);
    });

    it('should kill session via DELETE /api/user-auth/sessions/:id', () => {
      service.killSession('sess-1').subscribe((res) => {
        expect(res.success).toBe(true);
      });

      const req = httpMock.expectOne('/api/user-auth/sessions/sess-1');
      expect(req.request.method).toBe('DELETE');
      req.flush({ success: true, message: 'Session terminated' });
    });

    it('should kill all other sessions via DELETE /api/user-auth/sessions?othersOnly=true', () => {
      localStorage.setItem('dhan_refresh_token', 'my-refresh-token');

      service.killOtherSessions().subscribe((res) => {
        expect(res.revokedCount).toBe(2);
      });

      const req = httpMock.expectOne('/api/user-auth/sessions?othersOnly=true');
      expect(req.request.method).toBe('DELETE');
      expect(req.request.headers.get('x-refresh-token')).toBe('my-refresh-token');
      req.flush({ success: true, message: '2 other sessions terminated', revokedCount: 2 });
    });

    it('should list another user sessions for admin via GET /api/user-auth/users/:username/sessions', () => {
      service.getUserSessions('trader1').subscribe((sessions) => {
        expect(sessions.length).toBe(1);
      });

      const req = httpMock.expectOne('/api/user-auth/users/trader1/sessions');
      expect(req.request.method).toBe('GET');
      req.flush([
        {
          id: 'sess-trader',
          username: 'trader1',
          browser: 'Safari',
          os: 'iOS',
          deviceType: 'Mobile',
          createdAt: '2026-11-15T00:00:00Z',
          expiresAt: '2027-11-15T00:00:00Z',
          isCurrent: false,
        },
      ]);
    });

    it('should kill all sessions for a user via DELETE /api/user-auth/users/:username/sessions', () => {
      service.killAllUserSessions('trader1').subscribe((res) => {
        expect(res.revokedCount).toBe(3);
      });

      const req = httpMock.expectOne('/api/user-auth/users/trader1/sessions');
      expect(req.request.method).toBe('DELETE');
      req.flush({ success: true, revokedCount: 3 });
    });
  });
});

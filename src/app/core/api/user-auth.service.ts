import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';
import {
  ActiveSession,
  ChangePasswordDto,
  CreateUserPayload,
  LoginDto,
  LoginResponse,
  RefreshResponse,
  UpdateUserPayload,
  UserProfile,
  UserSummary,
} from '../models/user-auth.models';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'dhan_access_token',
  REFRESH_TOKEN: 'dhan_refresh_token',
  USER: 'dhan_user',
} as const;

@Injectable({
  providedIn: 'root',
})
export class UserAuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  readonly currentUser = signal<UserProfile | null>(this.loadStoredUser());
  readonly isAuthenticated = computed(() => !!this.currentUser());
  readonly isAdmin = computed(() => {
    const user = this.currentUser();
    if (!user) return false;
    return (user.role || '').trim().toLowerCase() === 'admin';
  });
  readonly isLoading = signal<boolean>(false);

  private isRefreshing = false;

  constructor() {
    // If we have a stored refresh token on startup, ensure session is valid
    if (this.getRefreshToken() && !this.currentUser()) {
      const user = this.loadStoredUser();
      if (user) {
        this.currentUser.set(user);
      }
    }
  }

  private loadStoredUser(): UserProfile | null {
    try {
      const userJson = localStorage.getItem(STORAGE_KEYS.USER);
      if (userJson) {
        return JSON.parse(userJson);
      }
    } catch {
      // Ignore parse errors
    }
    return null;
  }

  public getAccessToken(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    } catch {
      return null;
    }
  }

  public getRefreshToken(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    } catch {
      return null;
    }
  }

  public login(credentials: LoginDto, returnUrl: string = '/'): Observable<LoginResponse> {
    this.isLoading.set(true);
    return this.http.post<LoginResponse>('/api/user-auth/login', credentials).pipe(
      tap((res) => {
        this.isLoading.set(false);
        try {
          localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, res.accessToken);
          localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, res.refreshToken);
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(res.user));
        } catch (e) {
          console.warn('Could not persist auth to localStorage', e);
        }
        this.currentUser.set(res.user);
        this.snackBar.open(`Welcome back, ${res.user.username}!`, 'OK', { duration: 3000 });
        this.router.navigateByUrl(returnUrl);
      }),
      catchError((err) => {
        this.isLoading.set(false);
        return throwError(() => err);
      }),
    );
  }

  public refreshToken(): Observable<RefreshResponse | null> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.logout(true);
      return of(null);
    }

    if (this.isRefreshing) {
      return of(null);
    }

    this.isRefreshing = true;
    return this.http
      .post<RefreshResponse>('/api/user-auth/refresh', { refreshToken })
      .pipe(
        tap((res) => {
          this.isRefreshing = false;
          try {
            localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, res.accessToken);
            if (res.user) {
              localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(res.user));
              this.currentUser.set(res.user);
            }
          } catch (e) {
            console.warn('Could not update refreshed token in localStorage', e);
          }
        }),
        catchError((err) => {
          this.isRefreshing = false;
          // Only logout if server explicitly rejected the refresh token (401 Unauthorized or 403 Forbidden).
          // If the backend is restarting (status 0, connection refused) or 5xx, keep the local session intact!
          if (err instanceof HttpErrorResponse && (err.status === 401 || err.status === 403)) {
            this.logout(true);
          }
          return of(null);
        }),
      );
  }

  public logout(redirectToLogin: boolean = true): void {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      // Fire-and-forget backend session revocation
      this.http.post('/api/user-auth/logout', { refreshToken }).pipe(catchError(() => of(null))).subscribe();
    }

    try {
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
    } catch (e) {
      console.warn('Could not clear localStorage', e);
    }

    this.currentUser.set(null);

    if (redirectToLogin) {
      this.router.navigate(['/login']);
    }
  }

  public changePassword(dto: ChangePasswordDto): Observable<{ success: boolean; message: string }> {
    return this.http.put<{ success: boolean; message: string }>('/api/user-auth/password', dto).pipe(
      tap((res) => {
        this.snackBar.open(res.message || 'Password changed successfully', 'OK', { duration: 4000 });
      }),
    );
  }

  // =========================================================================
  // USER CRUD OPERATIONS (Restricted strictly to superuser 'sarang')
  // =========================================================================

  public listUsers(): Observable<UserSummary[]> {
    return this.http.get<UserSummary[]>('/api/user-auth/users');
  }

  public createUser(payload: CreateUserPayload): Observable<{ success: boolean; message: string; user: { username: string; role: string } }> {
    return this.http.post<{ success: boolean; message: string; user: { username: string; role: string } }>('/api/user-auth/users', payload).pipe(
      tap((res) => {
        this.snackBar.open(res.message || `User '${payload.username}' created successfully`, 'OK', { duration: 4000 });
      }),
    );
  }

  public updateUser(username: string, payload: UpdateUserPayload): Observable<{ success: boolean; message: string }> {
    return this.http.put<{ success: boolean; message: string }>(`/api/user-auth/users/${encodeURIComponent(username)}`, payload).pipe(
      tap((res) => {
        this.snackBar.open(res.message || `User '${username}' updated successfully`, 'OK', { duration: 4000 });
      }),
    );
  }

  public deleteUser(username: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`/api/user-auth/users/${encodeURIComponent(username)}`).pipe(
      tap((res) => {
        this.snackBar.open(res.message || `User '${username}' deleted successfully`, 'OK', { duration: 4000 });
      }),
    );
  }

  // =========================================================================
  // ACTIVE SESSIONS MANAGEMENT
  // =========================================================================

  public getMySessions(): Observable<ActiveSession[]> {
    const refreshToken = this.getRefreshToken() || '';
    return this.http.get<ActiveSession[]>('/api/user-auth/sessions', {
      headers: { 'x-refresh-token': refreshToken },
    });
  }

  public getAllSessions(): Observable<ActiveSession[]> {
    const refreshToken = this.getRefreshToken() || '';
    return this.http.get<ActiveSession[]>('/api/user-auth/all-sessions', {
      headers: { 'x-refresh-token': refreshToken },
    });
  }

  public killSession(sessionId: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`/api/user-auth/sessions/${encodeURIComponent(sessionId)}`).pipe(
      tap((res) => {
        this.snackBar.open(res.message || 'Session terminated successfully', 'OK', { duration: 4000 });
      }),
    );
  }

  public killOtherSessions(): Observable<{ success: boolean; message: string; revokedCount: number }> {
    const refreshToken = this.getRefreshToken() || '';
    return this.http.delete<{ success: boolean; message: string; revokedCount: number }>('/api/user-auth/sessions?othersOnly=true', {
      headers: { 'x-refresh-token': refreshToken },
    }).pipe(
      tap((res) => {
        this.snackBar.open(res.message || 'Other active sessions terminated', 'OK', { duration: 4000 });
      }),
    );
  }

  public getUserSessions(username: string): Observable<ActiveSession[]> {
    return this.http.get<ActiveSession[]>(`/api/user-auth/users/${encodeURIComponent(username)}/sessions`);
  }

  public killUserSession(username: string, sessionId: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`/api/user-auth/users/${encodeURIComponent(username)}/sessions/${encodeURIComponent(sessionId)}`).pipe(
      tap((res) => {
        this.snackBar.open(res.message || `Session terminated for '${username}'`, 'OK', { duration: 4000 });
      }),
    );
  }

  public killAllUserSessions(username: string): Observable<{ success: boolean; message: string; revokedCount: number }> {
    return this.http.delete<{ success: boolean; message: string; revokedCount: number }>(`/api/user-auth/users/${encodeURIComponent(username)}/sessions`).pipe(
      tap((res) => {
        this.snackBar.open(res.message || `All active sessions terminated for '${username}'`, 'OK', { duration: 4000 });
      }),
    );
  }
}

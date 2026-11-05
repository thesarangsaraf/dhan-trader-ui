import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, of, tap } from 'rxjs';
import { TokenInspection, TokenUpdateDto, TokenVerifyResult } from '../models/auth.models';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);

  readonly tokenStatus = signal<TokenInspection | null>(null);
  readonly isBackendOnline = signal<boolean>(false);
  readonly isRenewing = signal<boolean>(false);
  readonly secondsRemaining = signal<number>(0);
  readonly error = signal<string | null>(null);

  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private statusPollTimer: ReturnType<typeof setInterval> | null = null;

  // Computed state
  readonly statusColor = computed<'green' | 'yellow' | 'red'>(() => {
    if (!this.isBackendOnline()) return 'red';
    const sec = this.secondsRemaining();
    if (!this.tokenStatus()?.configured || sec <= 0) return 'red';
    if (sec < 3600) return 'red'; // under 60 mins -> red/urgent
    if (sec < 7200) return 'yellow'; // under 120 mins -> yellow
    return 'green';
  });

  readonly isExpiringSoon = computed(() => {
    if (!this.isBackendOnline()) return false;
    const sec = this.secondsRemaining();
    return sec > 0 && sec < 3600;
  });

  readonly isExpired = computed(() => {
    if (!this.isBackendOnline()) return true;
    return this.tokenStatus()?.isExpired || this.secondsRemaining() <= 0;
  });

  readonly timeRemainingFormatted = computed(() => {
    if (!this.isBackendOnline()) return 'Backend Offline';
    const token = this.tokenStatus();
    if (!token || !token.configured) return 'No Token';
    const sec = this.secondsRemaining();
    if (sec <= 0) return 'Expired';
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m ${s}s`;
    }
    return `${mins}m ${s}s`;
  });

  constructor() {
    this.refreshStatus();
    this.startCountdown();
    this.startPeriodicStatusPoll();
  }

  private startCountdown(): void {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.countdownTimer = setInterval(() => {
      const current = this.secondsRemaining();
      if (current > 0 && this.isBackendOnline()) {
        this.secondsRemaining.set(current - 1);
      }
    }, 1000);
  }

  private startPeriodicStatusPoll(): void {
    if (this.statusPollTimer) clearInterval(this.statusPollTimer);
    this.statusPollTimer = setInterval(() => {
      this.refreshStatus();
    }, 15000);
  }

  refreshStatus(): void {
    this.http
      .get<TokenInspection>('/api/auth/status')
      .pipe(
        tap((data) => {
          this.tokenStatus.set(data);
          this.secondsRemaining.set(data.secondsRemaining || 0);
          this.isBackendOnline.set(true);
          this.error.set(null);
        }),
        catchError((err) => {
          this.isBackendOnline.set(false);
          this.tokenStatus.set(null);
          this.secondsRemaining.set(0);
          this.error.set('Backend server offline (127.0.0.1:8000)');
          return of(null);
        })
      )
      .subscribe();
  }

  checkHealth() {
    return this.http.get<{ status?: string }>('/health').pipe(
      tap(() => {
        this.isBackendOnline.set(true);
        this.error.set(null);
      }),
      catchError(() => {
        this.isBackendOnline.set(false);
        this.error.set('Backend server offline (127.0.0.1:8000)');
        return of({ status: 'offline' });
      })
    );
  }

  renewToken() {
    this.isRenewing.set(true);
    return this.http.post<{ success: boolean; message?: string; inspection?: TokenInspection }>('/api/auth/renew', {}).pipe(
      tap((res) => {
        this.isRenewing.set(false);
        this.refreshStatus();
        this.snackBar.open(res.message || 'Dhan Access Token renewed successfully!', 'OK', {
          duration: 4000,
        });
      }),
      catchError((err) => {
        this.isRenewing.set(false);
        this.snackBar.open(err.error?.message || 'Failed to renew token. Please ensure backend is online.', 'Dismiss', {
          duration: 5000,
          panelClass: ['snackbar-error'],
        });
        return of(null);
      })
    );
  }

  updateToken(payload: TokenUpdateDto) {
    return this.http.post<{ success: boolean; message?: string }>('/api/auth/update', payload).pipe(
      tap((res) => {
        this.refreshStatus();
        this.snackBar.open(res.message || 'Token updated successfully!', 'OK', {
          duration: 4000,
        });
      })
    );
  }

  verifyToken() {
    return this.http.get<TokenVerifyResult>('/api/auth/verify');
  }
}

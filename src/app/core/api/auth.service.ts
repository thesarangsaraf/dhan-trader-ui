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

  refreshStatus(notify = false): void {
    this.http
      .get<TokenInspection>('/api/auth/status')
      .pipe(
        tap((data) => {
          this.tokenStatus.set(data);
          this.secondsRemaining.set(data.secondsRemaining || 0);
          this.isBackendOnline.set(true);
          this.error.set(null);
          if (notify) {
            this.snackBar.open(`Token status refreshed (${data.statusText})`, 'OK', { duration: 3000 });
          }
        }),
        catchError((err) => {
          this.isBackendOnline.set(false);
          this.tokenStatus.set(null);
          this.secondsRemaining.set(0);
          this.error.set('Backend server offline (127.0.0.1:8000)');
          if (notify) {
            this.snackBar.open('Could not connect to backend server', 'Dismiss', { duration: 4000 });
          }
          return of(null);
        })
      )
      .subscribe();
  }

  renewToken() {
    if (this.isRenewing()) return;
    this.isRenewing.set(true);
    this.http
      .post<{ success: boolean; message?: string; error?: string; inspection?: TokenInspection }>('/api/auth/renew', {})
      .pipe(
        tap((res) => {
          this.isRenewing.set(false);
          if (res.success) {
            this.refreshStatus();
            this.snackBar.open(res.message || 'Dhan Access Token renewed successfully!', 'OK', {
              duration: 4000,
            });
          } else {
            this.snackBar.open(res.error || 'Dhan rejected token renewal. Token may already be expired.', 'Dismiss', {
              duration: 6000,
              panelClass: ['snackbar-error'],
            });
          }
        }),
        catchError((err) => {
          this.isRenewing.set(false);
          const errorMsg = err.error?.message || err.error?.error || 'Failed to renew token. Please ensure backend is online.';
          this.snackBar.open(errorMsg, 'Dismiss', {
            duration: 6000,
            panelClass: ['snackbar-error'],
          });
          return of(null);
        })
      )
      .subscribe();
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

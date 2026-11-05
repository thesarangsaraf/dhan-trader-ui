import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, of, tap } from 'rxjs';
import { TelegramStatus, TelegramUpdateDto } from '../models/telegram.models';

@Injectable({
  providedIn: 'root',
})
export class TelegramApiService {
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);

  readonly status = signal<TelegramStatus>({
    configured: false,
    chatId: 'Not Set',
    botConfigured: false,
  });

  readonly isTesting = signal<boolean>(false);

  constructor() {
    this.refreshStatus();
  }

  refreshStatus(): void {
    this.http
      .get<TelegramStatus>('/api/telegram/status')
      .pipe(
        tap((res) => {
          if (res) this.status.set(res);
        }),
        catchError(() => of(null))
      )
      .subscribe();
  }

  sendTest(): void {
    this.isTesting.set(true);
    this.http
      .post<{ success: boolean; error?: string }>('/api/telegram/test', {})
      .pipe(
        tap((res) => {
          this.isTesting.set(false);
          if (res?.success) {
            this.snackBar.open('✅ Telegram test message dispatched successfully!', 'OK', {
              duration: 4000,
            });
          } else {
            this.snackBar.open(`⚠️ Telegram test failed: ${res?.error || 'Unknown error'}`, 'Dismiss', {
              duration: 5000,
              panelClass: ['snackbar-error'],
            });
          }
        }),
        catchError((err) => {
          this.isTesting.set(false);
          this.snackBar.open(`Failed: ${err.message}`, 'Dismiss', { duration: 4000 });
          return of(null);
        })
      )
      .subscribe();
  }

  updateCredentials(payload: TelegramUpdateDto) {
    return this.http
      .post<{ success: boolean; message?: string; status?: TelegramStatus }>('/api/telegram/update', payload)
      .pipe(
        tap((res) => {
          this.refreshStatus();
          this.snackBar.open(res.message || 'Telegram credentials updated and saved to .env', 'OK', {
            duration: 4000,
          });
        })
      );
  }
}

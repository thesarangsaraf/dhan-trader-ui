import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, of, tap } from 'rxjs';
import {
  NotificationSettings,
  NotificationTestResult,
  UpdateNotificationSettingsPayload,
} from '../models/notification.models';

@Injectable({
  providedIn: 'root',
})
export class NotificationApiService {
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);

  readonly settings = signal<NotificationSettings | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);
  readonly isTestingAll = signal<boolean>(false);
  readonly isTestingNtfy = signal<boolean>(false);

  constructor() {
    this.refreshSettings();
  }

  refreshSettings(): void {
    this.isLoading.set(true);
    this.http
      .get<NotificationSettings>('/api/notifications/settings')
      .pipe(
        tap((res) => {
          this.isLoading.set(false);
          if (res) this.settings.set(res);
        }),
        catchError((err) => {
          this.isLoading.set(false);
          return of(null);
        })
      )
      .subscribe();
  }

  updateSettings(payload: UpdateNotificationSettingsPayload) {
    this.isSaving.set(true);
    return this.http
      .put<{ success: boolean; message: string; settings: NotificationSettings }>(
        '/api/notifications/settings',
        payload
      )
      .pipe(
        tap((res) => {
          this.isSaving.set(false);
          if (res?.settings) {
            this.settings.set(res.settings);
          }
          this.snackBar.open(res?.message || 'Notification channel settings saved to Firestore', 'OK', {
            duration: 4000,
          });
        }),
        catchError((err) => {
          this.isSaving.set(false);
          this.snackBar.open(`Failed to save settings: ${err.message}`, 'Dismiss', {
            duration: 5000,
            panelClass: ['snackbar-error'],
          });
          throw err;
        })
      );
  }

  sendTestAll() {
    this.isTestingAll.set(true);
    return this.http
      .post<NotificationTestResult>('/api/notifications/test', {})
      .pipe(
        tap((res) => {
          this.isTestingAll.set(false);
          const parts: string[] = [];
          if (res?.telegram?.sent) parts.push('Telegram: Delivered ✅');
          else if (res?.telegram?.reason) parts.push(`Telegram: ${res.telegram.reason}`);

          if (res?.ntfy?.sent) parts.push('ntfy.sh: Delivered 📱');
          else if (res?.ntfy?.reason) parts.push(`ntfy.sh: ${res.ntfy.reason}`);

          this.snackBar.open(parts.join(' | ') || 'Test notification evaluated', 'OK', {
            duration: 5000,
          });
        }),
        catchError((err) => {
          this.isTestingAll.set(false);
          this.snackBar.open(`Test dispatch error: ${err.message}`, 'Dismiss', { duration: 4000 });
          return of(null);
        })
      );
  }

  sendNtfyTest(topic?: string) {
    this.isTestingNtfy.set(true);
    return this.http
      .post<{ success: boolean; topic?: string; error?: string }>('/api/ntfy/test', { topic })
      .pipe(
        tap((res) => {
          this.isTestingNtfy.set(false);
          if (res?.success) {
            this.snackBar.open(`✅ ntfy.sh test notification pushed to [${res.topic || topic || 'topic'}]! Check your phone.`, 'OK', {
              duration: 5000,
            });
          } else {
            this.snackBar.open(`⚠️ ntfy test failed: ${res?.error || 'Unknown error'}`, 'Dismiss', {
              duration: 5000,
              panelClass: ['snackbar-error'],
            });
          }
        }),
        catchError((err) => {
          this.isTestingNtfy.set(false);
          this.snackBar.open(`ntfy test error: ${err.message}`, 'Dismiss', { duration: 4000 });
          return of(null);
        })
      );
  }
}

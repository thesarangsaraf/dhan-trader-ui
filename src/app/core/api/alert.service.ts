import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, of, tap } from 'rxjs';
import {
  AlertTriggerEvent,
  CreateAlertDto,
  DhanAlert,
  GroupedAlert,
  UpdateAlertDto,
} from '../models/alert.models';
import { AudioChimeService } from '../services/audio-chime.service';

@Injectable({
  providedIn: 'root',
})
export class AlertService {
  private readonly http = inject(HttpClient);
  private readonly audioChime = inject(AudioChimeService);
  private readonly snackBar = inject(MatSnackBar);

  readonly alerts = signal<DhanAlert[]>([]);
  readonly groupedAlerts = signal<GroupedAlert[]>([]);
  readonly recentEvents = signal<AlertTriggerEvent[]>([]);
  readonly lastPollTime = signal<Date | null>(null);

  readonly alertsError = signal<string | null>(null);
  readonly isLoadingAlerts = signal<boolean>(false);

  readonly activeAlerts = computed(() => this.alerts().filter((a) => a.status === 'ACTIVE'));
  readonly triggeredAlerts = computed(() => this.alerts().filter((a) => a.status === 'TRIGGERED'));
  readonly cancelledAlerts = computed(() => this.alerts().filter((a) => a.status === 'CANCELLED'));

  constructor() {
    this.refreshAlerts();
    this.refreshGrouped();
  }

  refreshAlerts(): void {
    this.isLoadingAlerts.set(true);
    this.http
      .get<DhanAlert[]>('/api/alerts')
      .pipe(
        tap((data) => {
          this.isLoadingAlerts.set(false);
          this.alertsError.set(null);
          this.lastPollTime.set(new Date());
          if (Array.isArray(data)) {
            this.alerts.set(data);
          }
        }),
        catchError((err) => {
          this.isLoadingAlerts.set(false);
          this.alertsError.set('Failed to load alerts: Backend server not available (127.0.0.1:8000).');
          return of([]);
        })
      )
      .subscribe();
  }

  refreshGrouped(): void {
    this.http
      .get<GroupedAlert[]>('/api/alerts/grouped')
      .pipe(
        tap((data) => {
          if (Array.isArray(data)) {
            this.groupedAlerts.set(data);
          }
        }),
        catchError(() => of([]))
      )
      .subscribe();
  }

  createAlert(dto: CreateAlertDto) {
    const url = dto.conditionalOrder || dto.attachedOrder?.enabled
      ? '/api/alerts/conditional-order'
      : '/api/alerts';

    return this.http.post<{ success: boolean; message: string; alert: DhanAlert }>(url, dto).pipe(
      tap((res) => {
        this.refreshAlerts();
        this.refreshGrouped();
        this.snackBar.open(res.message || 'Alert created successfully!', 'OK', {
          duration: 4000,
        });
      })
    );
  }

  updateAlert(id: string, dto: UpdateAlertDto) {
    return this.http.put<{ success: boolean; alert: DhanAlert }>(`/api/alerts/${id}`, dto).pipe(
      tap(() => {
        this.refreshAlerts();
        this.refreshGrouped();
        this.snackBar.open('Alert updated successfully!', 'OK', { duration: 3000 });
      })
    );
  }

  cancelAlert(id: string) {
    // Optimistic local state update
    this.alerts.update((alerts) =>
      alerts.map((a) => (a.id === id || a.dhanAlertId === id ? { ...a, status: 'CANCELLED' } : a))
    );
    this.groupedAlerts.update((groups) =>
      groups.map((g) => ({
        ...g,
        alerts: g.alerts.map((a) => (a.id === id || a.dhanAlertId === id ? { ...a, status: 'CANCELLED' } : a)),
        activeCount: g.alerts.filter((a) => (a.id !== id && a.dhanAlertId !== id ? a.status === 'ACTIVE' : false)).length,
      }))
    );

    return this.http.post<{ success: boolean; message?: string }>(`/api/alerts/${id}/cancel`, {}).pipe(
      tap(() => {
        this.refreshAlerts();
        this.refreshGrouped();
        this.snackBar.open(`Alert ${id} cancelled`, 'OK', { duration: 3000 });
      }),
      catchError((err) => {
        this.refreshAlerts();
        this.refreshGrouped();
        throw err;
      })
    );
  }

  deleteAlert(id: string) {
    // Optimistic local state update so it disappears immediately from UI
    this.alerts.update((alerts) => alerts.filter((a) => a.id !== id && a.dhanAlertId !== id));
    this.groupedAlerts.update((groups) =>
      groups
        .map((g) => ({
          ...g,
          alerts: g.alerts.filter((a) => a.id !== id && a.dhanAlertId !== id),
          activeCount: g.alerts.filter((a) => a.id !== id && a.dhanAlertId !== id && a.status === 'ACTIVE').length,
          triggeredCount: g.alerts.filter((a) => a.id !== id && a.dhanAlertId !== id && a.status === 'TRIGGERED').length,
        }))
        .filter((g) => g.alerts.length > 0)
    );

    return this.http.delete<{ success: boolean; message?: string }>(`/api/alerts/${id}`).pipe(
      tap(() => {
        this.refreshAlerts();
        this.refreshGrouped();
        this.snackBar.open(`Alert ${id} deleted`, 'OK', { duration: 3000 });
      }),
      catchError((err) => {
        this.refreshAlerts();
        this.refreshGrouped();
        throw err;
      })
    );
  }

  testChime(instrument = 'NIFTY 50') {
    return this.http
      .post<{ success: boolean; message: string; event: AlertTriggerEvent }>('/api/alerts/test-chime', {
        instrument,
      })
      .pipe(
        tap((res) => {
          this.audioChime.playTestChime();
          this.snackBar.open(`Chime Test Sent for ${instrument}!`, 'OK', { duration: 3000 });
          if (res?.event) {
            this.recentEvents.set([res.event, ...this.recentEvents()].slice(0, 30));
          }
        }),
        catchError((err) => {
          this.audioChime.playTestChime();
          this.snackBar.open('Audio synth chime tested locally.', 'OK', { duration: 3000 });
          return of(null);
        })
      );
  }
}

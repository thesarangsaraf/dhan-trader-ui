import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, of, tap } from 'rxjs';
import {
  AlertTriggerEvent,
  CreateAlertDto,
  DhanAlert,
} from '../models/alert.models';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AlertService {
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);

  readonly alerts = signal<DhanAlert[]>([]);
  readonly recentEvents = signal<AlertTriggerEvent[]>([]);
  readonly lastPollTime = signal<Date | null>(null);

  readonly alertsError = signal<string | null>(null);
  readonly isLoadingAlerts = signal<boolean>(false);

  readonly activeAlerts = computed(() => this.alerts().filter((a) => a.status === 'ACTIVE'));
  readonly triggeredAlerts = computed(() => this.alerts().filter((a) => a.status === 'TRIGGERED'));
  readonly cancelledAlerts = computed(() => this.alerts().filter((a) => a.status === 'CANCELLED'));

  constructor() {
    this.refreshAlerts();
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
          this.alertsError.set(`Failed to load alerts: Backend server not available (${environment.apiUrl}).`);
          return of([]);
        })
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
        this.snackBar.open(res.message || 'Alert created successfully!', 'OK', {
          duration: 4000,
        });
      })
    );
  }

  cancelAlert(id: string) {
    // Optimistic local state update
    this.alerts.update((alerts) =>
      alerts.map((a) => (a.id === id || a.dhanAlertId === id ? { ...a, status: 'CANCELLED' } : a))
    );

    return this.http.post<{ success: boolean; message?: string }>(`/api/alerts/${id}/cancel`, {}).pipe(
      tap(() => {
        this.refreshAlerts();
        this.snackBar.open(`Alert ${id} cancelled`, 'OK', { duration: 3000 });
      }),
      catchError((err) => {
        this.refreshAlerts();
        throw err;
      })
    );
  }

  deleteAlert(id: string) {
    // Optimistic local state update so it disappears immediately from UI
    this.alerts.update((alerts) => alerts.filter((a) => a.id !== id && a.dhanAlertId !== id));

    return this.http.delete<{ success: boolean; message?: string }>(`/api/alerts/${id}`).pipe(
      tap(() => {
        this.refreshAlerts();
        this.snackBar.open(`Alert ${id} deleted`, 'OK', { duration: 3000 });
      }),
      catchError((err) => {
        this.refreshAlerts();
        throw err;
      })
    );
  }
}

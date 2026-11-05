import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, of, tap } from 'rxjs';
import {
  AlertTriggerEvent,
  CreateAlertDto,
  DhanAlert,
  GroupedAlert,
  PopularIndex,
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
  readonly indices = signal<PopularIndex[]>([]);
  readonly recentEvents = signal<AlertTriggerEvent[]>([]);
  readonly isPolling = signal<boolean>(true);
  readonly lastPollTime = signal<Date | null>(null);

  readonly alertsError = signal<string | null>(null);
  readonly indicesError = signal<string | null>(null);
  readonly isLoadingAlerts = signal<boolean>(false);
  readonly isLoadingIndices = signal<boolean>(false);

  private lastReceivedEventId: string | null = null;
  private pollIntervalTimer: ReturnType<typeof setInterval> | null = null;
  private isPollInFlight = false;

  readonly activeAlerts = computed(() => this.alerts().filter((a) => a.status === 'ACTIVE'));
  readonly triggeredAlerts = computed(() => this.alerts().filter((a) => a.status === 'TRIGGERED'));
  readonly cancelledAlerts = computed(() => this.alerts().filter((a) => a.status === 'CANCELLED'));

  constructor() {
    this.refreshAlerts();
    this.refreshIndices();
    this.refreshGrouped();
    this.startPollingEngine();
  }

  startPollingEngine(): void {
    if (this.pollIntervalTimer) clearInterval(this.pollIntervalTimer);
    this.pollIntervalTimer = setInterval(() => {
      this.pollTriggeredEvents();
    }, 1500);
  }

  stopPollingEngine(): void {
    if (this.pollIntervalTimer) {
      clearInterval(this.pollIntervalTimer);
      this.pollIntervalTimer = null;
    }
  }

  private pollTriggeredEvents(): void {
    if (this.isPollInFlight) return;
    this.isPollInFlight = true;

    const url = this.lastReceivedEventId
      ? `/api/alerts/poll?since=${encodeURIComponent(this.lastReceivedEventId)}`
      : '/api/alerts/poll';

    this.http
      .get<{ events?: AlertTriggerEvent[] }>(url)
      .pipe(
        tap((res) => {
          this.lastPollTime.set(new Date());
          const newEvents = res?.events || [];

          if (newEvents.length > 0) {
            this.lastReceivedEventId = newEvents[newEvents.length - 1].id;
            this.audioChime.playAlertTriggerChime();

            const updatedEvents = [...newEvents, ...this.recentEvents()].slice(0, 30);
            this.recentEvents.set(updatedEvents);

            const latest = newEvents[newEvents.length - 1];
            this.snackBar.open(
              `🔔 ALERT TRIGGERED: ${latest.instrument} hit ₹${latest.triggeredPrice} (${latest.operator})`,
              'View',
              { duration: 6000, horizontalPosition: 'right', verticalPosition: 'top' }
            );

            this.refreshAlerts();
            this.refreshIndices();
          }
        }),
        catchError(() => of(null))
      )
      .subscribe({
        complete: () => {
          this.isPollInFlight = false;
        },
      });
  }

  refreshAlerts(): void {
    this.isLoadingAlerts.set(true);
    this.http
      .get<DhanAlert[]>('/api/alerts')
      .pipe(
        tap((data) => {
          this.isLoadingAlerts.set(false);
          this.alertsError.set(null);
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

  refreshIndices(): void {
    this.isLoadingIndices.set(true);
    this.http
      .get<PopularIndex[]>('/api/alerts/indices')
      .pipe(
        tap((data) => {
          this.isLoadingIndices.set(false);
          this.indicesError.set(null);
          if (Array.isArray(data)) {
            this.indices.set(data);
          }
        }),
        catchError((err) => {
          this.isLoadingIndices.set(false);
          this.indicesError.set('Failed to load indices: Backend server not available (127.0.0.1:8000).');
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
    return this.http.post<{ success: boolean; message: string; alert: DhanAlert }>('/api/alerts', dto).pipe(
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
    return this.http.post<{ success: boolean; message?: string }>(`/api/alerts/${id}/cancel`, {}).pipe(
      tap(() => {
        this.refreshAlerts();
        this.refreshGrouped();
        this.snackBar.open(`Alert ${id} cancelled`, 'OK', { duration: 3000 });
      })
    );
  }

  deleteAlert(id: string) {
    return this.http.delete<{ success: boolean; message?: string }>(`/api/alerts/${id}`).pipe(
      tap(() => {
        this.refreshAlerts();
        this.refreshGrouped();
        this.snackBar.open(`Alert ${id} deleted`, 'OK', { duration: 3000 });
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

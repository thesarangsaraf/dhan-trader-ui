import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, of, tap } from 'rxjs';
import { AutoSLExecutionSummary, AutoSLPayload } from '../models/order.models';

@Injectable({
  providedIn: 'root',
})
export class StrategyService {
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);

  readonly logs = signal<AutoSLExecutionSummary[]>([]);
  readonly isExecuting = signal<boolean>(false);
  readonly lastExecution = signal<AutoSLExecutionSummary | null>(null);
  readonly logsError = signal<string | null>(null);

  constructor() {
    this.refreshLogs();
  }

  refreshLogs(): void {
    this.http
      .get<AutoSLExecutionSummary[]>('/api/strategy/auto-sl/logs')
      .pipe(
        tap((data) => {
          this.logsError.set(null);
          if (Array.isArray(data)) {
            this.logs.set(data);
          }
        }),
        catchError((err) => {
          this.logsError.set('Failed to load strategy logs: Backend server not available.');
          return of([]);
        })
      )
      .subscribe();
  }

  executeAutoSl(payload: AutoSLPayload) {
    this.isExecuting.set(true);
    return this.http
      .post<AutoSLExecutionSummary>('/api/strategy/auto-sl', payload)
      .pipe(
        tap((result) => {
          this.isExecuting.set(false);
          this.lastExecution.set(result);
          this.refreshLogs();
          this.snackBar.open(
            `⚡ Real Bracket Deployed! Entry: ₹${result.entryPrice} | SL: ₹${result.slPrice} (-7) | Target: ₹${result.targetPrice} (+30)`,
            'OK',
            { duration: 6000 }
          );
        }),
        catchError((err) => {
          this.isExecuting.set(false);
          this.snackBar.open(err.error?.message || 'Bracket execution failed: Backend error', 'Dismiss', {
            duration: 5000,
            panelClass: ['snackbar-error'],
          });
          return of(null);
        })
      );
  }
}

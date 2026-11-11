import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, catchError, finalize, of, tap } from 'rxjs';
import { FirestoreStatus, FirestoreTestResult } from '../models/firestore.models';

@Injectable({
  providedIn: 'root',
})
export class FirestoreApiService {
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);

  readonly status = signal<FirestoreStatus | null>(null);
  readonly isTesting = signal<boolean>(false);
  readonly lastTestResult = signal<FirestoreTestResult | null>(null);

  constructor() {
    this.refreshStatus().subscribe();
  }

  refreshStatus(): Observable<FirestoreStatus | null> {
    return this.http.get<FirestoreStatus>('/api/firestore/status').pipe(
      tap((res) => {
        if (res) this.status.set(res);
      }),
      catchError((err) => {
        console.warn('Backend /api/firestore/status unavailable:', err);
        return of(null);
      })
    );
  }

  testConnection(): Observable<FirestoreTestResult | null> {
    this.isTesting.set(true);
    return this.http.post<FirestoreTestResult>('/api/firestore/test', {}).pipe(
      tap((res) => {
        this.lastTestResult.set(res);
        if (res?.success) {
          this.snackBar.open(
            `✅ Firestore Connected (${res.latencyMs || 0}ms latency, DB: ${res.databaseId})!`,
            'OK',
            { duration: 4000 }
          );
        } else {
          this.snackBar.open(`❌ Firestore test failed: ${res?.message}`, 'Dismiss', {
            duration: 6000,
          });
        }
      }),
      catchError((err) => {
        const errMsg = err?.error?.message || err?.message || 'Firestore connection failed';
        this.snackBar.open(`❌ ${errMsg}`, 'Dismiss', { duration: 6000 });
        this.lastTestResult.set({
          success: false,
          message: errMsg,
        });
        return of(null);
      }),
      finalize(() => this.isTesting.set(false))
    );
  }

  getTradeSecurityStatus(): Observable<{ configured: boolean; updatedAt?: string } | null> {
    return this.http.get<{ configured: boolean; updatedAt?: string }>('/api/firestore/trade-security').pipe(
      catchError(() => of(null))
    );
  }

  updateTradeSecurity(password: string): Observable<{ success: boolean; message: string } | null> {
    return this.http.post<{ success: boolean; message: string }>('/api/firestore/trade-security', { password }).pipe(
      tap((res) => {
        if (res?.success) {
          this.snackBar.open('Trade password updated in Firebase config/security!', 'OK', { duration: 3000 });
        }
      }),
      catchError((err) => {
        this.snackBar.open(err?.error?.message || 'Failed to update trade password', 'Dismiss', { duration: 5000 });
        return of(null);
      })
    );
  }
}

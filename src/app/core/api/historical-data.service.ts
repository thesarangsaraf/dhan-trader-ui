import { HttpClient } from '@angular/common/http';
import { Injectable, WritableSignal, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, catchError, finalize, of, tap } from 'rxjs';
import {
  HistoricalCandlesQueryResult,
  HistoricalDataStatusResult,
  HistoricalDataSyncResult,
} from '../models/historical-data.models';

export type HistoricalIndexKey = 'NIFTY50' | 'BANKNIFTY';

export interface HistoricalCandlesQueryParams {
  fromMonth?: string;
  toMonth?: string;
  fromEpoch?: number;
  toEpoch?: number;
  limit?: number;
}

interface IndexSignalState {
  routeSlug: string;
  displayLabel: string;
  status: WritableSignal<HistoricalDataStatusResult | null>;
  isSyncing: WritableSignal<boolean>;
  syncMode: WritableSignal<'incremental' | 'full' | null>;
  lastSyncResult: WritableSignal<HistoricalDataSyncResult | null>;
}

@Injectable({
  providedIn: 'root',
})
export class HistoricalDataService {
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);

  readonly status = signal<HistoricalDataStatusResult | null>(null);
  readonly isSyncing = signal<boolean>(false);
  readonly syncMode = signal<'incremental' | 'full' | null>(null);
  readonly lastSyncResult = signal<HistoricalDataSyncResult | null>(null);

  readonly bankNiftyStatus = signal<HistoricalDataStatusResult | null>(null);
  readonly isSyncingBankNifty = signal<boolean>(false);
  readonly bankNiftySyncMode = signal<'incremental' | 'full' | null>(null);
  readonly lastBankNiftySyncResult = signal<HistoricalDataSyncResult | null>(null);

  private readonly indexStates: Record<HistoricalIndexKey, IndexSignalState> = {
    NIFTY50: {
      routeSlug: 'nifty50-5m',
      displayLabel: 'NIFTY 50',
      status: this.status,
      isSyncing: this.isSyncing,
      syncMode: this.syncMode,
      lastSyncResult: this.lastSyncResult,
    },
    BANKNIFTY: {
      routeSlug: 'banknifty-5m',
      displayLabel: 'BANK NIFTY',
      status: this.bankNiftyStatus,
      isSyncing: this.isSyncingBankNifty,
      syncMode: this.bankNiftySyncMode,
      lastSyncResult: this.lastBankNiftySyncResult,
    },
  };

  /**
   * Fetch current NIFTY 50 5-minute historical data metadata from Firestore (1 Firestore read).
   */
  fetchStatus(): Observable<HistoricalDataStatusResult | null> {
    return this.fetchStatusForIndex('NIFTY50');
  }

  /**
   * Fetch current BANK NIFTY 5-minute historical data metadata from Firestore (1 Firestore read).
   */
  fetchBankNiftyStatus(): Observable<HistoricalDataStatusResult | null> {
    return this.fetchStatusForIndex('BANKNIFTY');
  }

  /**
   * Trigger on-demand sync of NIFTY 50 1-minute GitHub CSVs -> 5-minute candles -> Firestore.
   */
  syncNifty50FiveMin(force = false): Observable<HistoricalDataSyncResult | null> {
    return this.syncForIndex('NIFTY50', force);
  }

  /**
   * Trigger on-demand sync of BANK NIFTY 1-minute GitHub CSVs -> 5-minute candles -> Firestore.
   */
  syncBankNiftyFiveMin(force = false): Observable<HistoricalDataSyncResult | null> {
    return this.syncForIndex('BANKNIFTY', force);
  }

  /**
   * Query stored 5-minute NIFTY 50 candles from Firestore.
   */
  getCandles(params?: HistoricalCandlesQueryParams): Observable<HistoricalCandlesQueryResult | null> {
    return this.getCandlesForIndex('NIFTY50', params);
  }

  /**
   * Query stored 5-minute BANK NIFTY candles from Firestore.
   */
  getBankNiftyCandles(params?: HistoricalCandlesQueryParams): Observable<HistoricalCandlesQueryResult | null> {
    return this.getCandlesForIndex('BANKNIFTY', params);
  }

  private fetchStatusForIndex(indexKey: HistoricalIndexKey): Observable<HistoricalDataStatusResult | null> {
    const state = this.indexStates[indexKey];
    const url = `/api/historical-data/${state.routeSlug}/status`;

    return this.http.get<HistoricalDataStatusResult>(url).pipe(
      tap((res) => {
        if (res) {
          state.status.set(res);
        }
      }),
      catchError((err) => {
        console.warn(`Backend ${url} unavailable:`, err);
        return of(null);
      }),
    );
  }

  private syncForIndex(
    indexKey: HistoricalIndexKey,
    force = false,
  ): Observable<HistoricalDataSyncResult | null> {
    const state = this.indexStates[indexKey];
    const url = `/api/historical-data/${state.routeSlug}/sync`;
    state.isSyncing.set(true);
    state.syncMode.set(force ? 'full' : 'incremental');

    return this.http.post<HistoricalDataSyncResult>(url, { force }).pipe(
      tap((res) => {
        if (res?.success) {
          state.lastSyncResult.set(res);
          this.snackBar.open(
            `✅ ${res.message || `Synced ${res.totalCandlesInDb.toLocaleString()} ${state.displayLabel} 5m candles to Firestore!`}`,
            'OK',
            { duration: 6000 },
          );
          this.fetchStatusForIndex(indexKey).subscribe();
        }
      }),
      catchError((err) => {
        console.error(`Failed to sync ${state.displayLabel} 5m historical data:`, err);
        const errMsg =
          err?.error?.message || err?.message || `Failed to sync ${state.displayLabel} 5-minute historical data`;
        this.snackBar.open(`❌ Sync failed: ${errMsg}`, 'Dismiss', { duration: 6000 });
        return of(null);
      }),
      finalize(() => {
        state.isSyncing.set(false);
        state.syncMode.set(null);
      }),
    );
  }

  public getCandlesForIndex(
    indexKey: HistoricalIndexKey,
    params?: HistoricalCandlesQueryParams,
  ): Observable<HistoricalCandlesQueryResult | null> {
    const state = this.indexStates[indexKey];
    const query = new URLSearchParams();
    if (params?.fromMonth) query.set('fromMonth', params.fromMonth);
    if (params?.toMonth) query.set('toMonth', params.toMonth);
    if (params?.fromEpoch !== undefined) query.set('fromEpoch', String(params.fromEpoch));
    if (params?.toEpoch !== undefined) query.set('toEpoch', String(params.toEpoch));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    const url = `/api/historical-data/${state.routeSlug}/candles${qs ? `?${qs}` : ''}`;

    return this.http.get<HistoricalCandlesQueryResult>(url).pipe(
      catchError((err) => {
        console.warn(`Failed to fetch ${state.displayLabel} 5m candles from Firestore:`, err);
        return of(null);
      }),
    );
  }
}

import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, catchError, finalize, of, tap } from 'rxjs';
import {
  CachedIndexOption,
  EquitiesQueryResult,
  FlushAndReloadEquitiesResult,
  FlushAndReloadOptionsResult,
  FlushAndReloadResult,
  IndexConfigItem,
  IndexLotSizesConfig,
  IndexOptionsStatusResult,
  Instrument,
  OptionContractsResult,
  OptionExpiryItem,
  OptionsQueryResult,
  SyncEquitiesResult,
  SyncMasterResult,
  SyncOptionsResult,
  SyncStatusResult,
  UpdateLotSizesDto,
} from '../models/instrument.models';

export interface InstrumentLtpResponse {
  symbol: string;
  ltp: number | null;
}

export interface LotSizesResponse {
  success: boolean;
  data: IndexLotSizesConfig;
  message?: string;
}

@Injectable({
  providedIn: 'root',
})
export class InstrumentService {
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);

  readonly isSyncing = signal<boolean>(false);
  readonly isSyncingEquities = signal<boolean>(false);
  readonly isSyncingOptions = signal<boolean>(false);
  readonly isFlushingAndReloading = signal<boolean>(false);
  readonly isFlushingEquities = signal<boolean>(false);
  readonly isFlushingOptions = signal<boolean>(false);
  readonly lastFlushReloadResult = signal<FlushAndReloadResult | null>(null);
  readonly lastFlushEquitiesResult = signal<FlushAndReloadEquitiesResult | null>(null);
  readonly lastFlushOptionsResult = signal<FlushAndReloadOptionsResult | null>(null);
  readonly syncStatus = signal<SyncStatusResult | null>(null);
  readonly optionsSyncStatus = signal<IndexOptionsStatusResult | null>(null);
  readonly configuredIndices = signal<Instrument[]>([]);
  readonly lotSizes = signal<IndexLotSizesConfig>({
    nifty50: 0,
    bankNifty: 0,
    midcapNifty: 0,
    sensex: 0,
    nifty50Lots: 0,
    bankNiftyLots: 0,
    midcapNiftyLots: 0,
    sensexLots: 0,
    indices: [],
  });
  readonly isSavingLotSizes = signal<boolean>(false);
  readonly isLoadingLotSizes = signal<boolean>(false);
  readonly isSyncingTradedInstrumentsJson = signal<boolean>(false);

  /**
   * Fetch list of tradeable indices configured in Firestore for Conditional Alert Composer dropdown.
   */
  fetchConfiguredIndices(force = false): Observable<Instrument[]> {
    if (!force && this.configuredIndices().length > 0) {
      return of(this.configuredIndices());
    }
    return this.http.get<Instrument[]>('/api/instruments/indices').pipe(
      tap((res) => {
        this.configuredIndices.set(Array.isArray(res) ? res : []);
      }),
      catchError((err) => {
        console.warn('Backend /api/instruments/indices unavailable:', err);
        if (force) {
          this.configuredIndices.set([]);
        }
        return of([]);
      })
    );
  }

  /**
   * Fetch current traded instruments configuration from Firestore (master_data/traded_instruments).
   */
  fetchLotSizes(force = false): Observable<LotSizesResponse | null> {
    if (!force && ((this.lotSizes().instruments?.length ?? this.lotSizes().indices?.length ?? 0) > 0)) {
      return of({ success: true, data: this.lotSizes() });
    }
    this.isLoadingLotSizes.set(true);
    return this.http.get<LotSizesResponse>('/api/instruments/traded-instruments').pipe(
      tap((res) => {
        if (res?.success && res.data) {
          this.lotSizes.set(res.data);
        }
      }),
      catchError((err) => {
        console.warn('Backend /api/instruments/traded-instruments unavailable:', err);
        return of(null);
      }),
      finalize(() => this.isLoadingLotSizes.set(false))
    );
  }

  /**
   * Update traded instruments configuration in Firestore (master_data/traded_instruments).
   */
  updateLotSizes(dto: UpdateLotSizesDto): Observable<LotSizesResponse | null> {
    this.isSavingLotSizes.set(true);
    return this.http.put<LotSizesResponse>('/api/instruments/traded-instruments', dto).pipe(
      tap((res) => {
        if (res?.success && res.data) {
          this.lotSizes.set(res.data);
          this.snackBar.open('✅ Traded instruments saved to Firestore (master_data/traded_instruments)!', 'OK', {
            duration: 4000,
          });
        }
      }),
      catchError((err) => {
        console.error('Failed to update traded instruments:', err);
        const errMsg = err?.error?.message || err?.message || 'Failed to update traded instruments';
        this.snackBar.open(`❌ ${errMsg}`, 'Dismiss', { duration: 5000 });
        return of(null);
      }),
      finalize(() => this.isSavingLotSizes.set(false))
    );
  }

  /**
   * Fast sync of master_data/traded_instruments directly from the static backend JSON file
   * without downloading the full Dhan CSV. Preserves user preferences unless resetPreferences=true.
   */
  syncTradedInstrumentsFromJson(resetPreferences = false): Observable<LotSizesResponse | null> {
    this.isSyncingTradedInstrumentsJson.set(true);
    return this.http
      .post<LotSizesResponse>('/api/instruments/traded-instruments/sync-json', { resetPreferences })
      .pipe(
        tap((res) => {
          if (res?.success && res.data) {
            this.lotSizes.set(res.data);
            this.snackBar.open(
              res.message || '✅ Synced traded instruments from static master JSON to Firestore!',
              'OK',
              { duration: 4500 },
            );
            this.fetchConfiguredIndices(true).subscribe();
          }
        }),
        catchError((err) => {
          console.error('Failed to sync traded instruments from master JSON:', err);
          const errMsg = err?.error?.message || err?.message || 'Sync from master JSON failed';
          this.snackBar.open(`❌ ${errMsg}`, 'Dismiss', { duration: 5000 });
          return of(null);
        }),
        finalize(() => this.isSyncingTradedInstrumentsJson.set(false)),
      );
  }

  /**
   * Trigger on-demand sync of NSE Security ID to Name mapping (options + equities + indices) to Firestore.
   */
  syncMaster(force = true): Observable<SyncMasterResult | null> {
    this.isSyncing.set(true);
    return this.http
      .post<SyncMasterResult>('/api/instruments/sync', { force })
      .pipe(
        tap((res) => {
          if (res?.success) {
            this.snackBar.open(
              `✅ Synced ${res.totalInstruments} NSE instruments across ${res.documents.length} Firestore documents!`,
              'OK',
              { duration: 5000 }
            );
            this.fetchSyncStatus().subscribe();
          }
        }),
        catchError((err) => {
          console.error('Failed to sync master to Firestore:', err);
          const errMsg = err?.error?.message || err?.message || 'Sync failed. Check backend connection.';
          this.snackBar.open(`❌ Sync failed: ${errMsg}`, 'Dismiss', { duration: 6000 });
          return of(null);
        })
      );
  }

  /**
   * Flush and reload cash equities & benchmark indices into sec_id_to_name_mapping.
   */
  flushAndReloadEquities(): Observable<FlushAndReloadEquitiesResult | null> {
    this.isFlushingEquities.set(true);
    return this.http.post<FlushAndReloadEquitiesResult>('/api/instruments/flush-and-reload/equities', {}).pipe(
      tap((res) => {
        if (res?.success) {
          this.lastFlushEquitiesResult.set(res);
          this.snackBar.open(
            `✅ Equities flushed and reloaded: ${res.totalInstruments} instruments (${res.totalEquities} equities, ${res.totalIndices} indices)`,
            'OK',
            { duration: 6000 }
          );
          this.fetchSyncStatus().subscribe();
        }
      }),
      catchError((err) => {
        console.error('Failed to flush and reload equities:', err);
        const errMsg = err?.error?.message || err?.message || 'Flush and reload equities failed';
        this.snackBar.open(`❌ Flush equities failed: ${errMsg}`, 'Dismiss', { duration: 6000 });
        return of(null);
      }),
      finalize(() => this.isFlushingEquities.set(false))
    );
  }

  /**
   * Flush and reload traded index options contracts into index_options.
   */
  flushAndReloadOptions(): Observable<FlushAndReloadOptionsResult | null> {
    this.isFlushingOptions.set(true);
    return this.http.post<FlushAndReloadOptionsResult>('/api/instruments/flush-and-reload/options', {}).pipe(
      tap((res) => {
        if (res?.success) {
          this.lastFlushOptionsResult.set(res);
          this.snackBar.open(
            `✅ Options flushed and reloaded: ${res.totalItems} contracts for ${res.tradedIndices?.join(', ')}`,
            'OK',
            { duration: 6000 }
          );
          this.fetchOptionsSyncStatus().subscribe();
        }
      }),
      catchError((err) => {
        console.error('Failed to flush and reload options:', err);
        const errMsg = err?.error?.message || err?.message || 'Flush and reload options failed';
        this.snackBar.open(`❌ Flush options failed: ${errMsg}`, 'Dismiss', { duration: 6000 });
        return of(null);
      }),
      finalize(() => this.isFlushingOptions.set(false))
    );
  }

  /**
   * Fetch current status and metadata of collection index_options from Firestore.
   */
  fetchOptionsSyncStatus(): Observable<IndexOptionsStatusResult | null> {
    return this.http.get<IndexOptionsStatusResult>('/api/instruments/sync/options/status').pipe(
      tap((res) => {
        if (res) {
          this.optionsSyncStatus.set(res);
        }
      }),
      catchError((err) => {
        console.warn('Backend /api/instruments/sync/options/status unavailable:', err);
        return of(null);
      })
    );
  }

  /**
   * Fetch current status and document counts for sec_id_to_name_mapping from Firestore.
   */
  fetchSyncStatus(): Observable<SyncStatusResult | null> {
    return this.http.get<SyncStatusResult>('/api/instruments/sync/status').pipe(
      tap((res) => {
        if (res) {
          this.syncStatus.set(res);
        }
      }),
      catchError((err) => {
        console.warn('Backend /api/instruments/sync/status unavailable:', err);
        return of(null);
      })
    );
  }

  getExpiries(instrument = 'NIFTY 50'): Observable<OptionExpiryItem[]> {
    const clean = (instrument || 'NIFTY 50').trim();
    return this.http
      .get<OptionExpiryItem[]>(`/api/instruments/expiries?instrument=${encodeURIComponent(clean)}`)
      .pipe(
        catchError((err) => {
          console.warn(`Backend /api/instruments/expiries unavailable for ${clean}:`, err);
          return of([]);
        })
      );
  }

  getOptionContracts(
    instrument: string,
    price?: number | null,
    expiry?: string | null
  ): Observable<OptionContractsResult | null> {
    const clean = (instrument || 'NIFTY 50').trim();
    let url = `/api/instruments/option-contracts?instrument=${encodeURIComponent(clean)}`;
    if (price && price > 0) {
      url += `&price=${price}`;
    }
    if (expiry) {
      url += `&expiry=${encodeURIComponent(expiry)}`;
    }

    return this.http.get<OptionContractsResult>(url).pipe(
      catchError((err) => {
        console.warn(`Backend /api/instruments/option-contracts unavailable for ${clean}:`, err);
        return of(null);
      })
    );
  }

  search(term: string, limit = 10): Observable<Instrument[]> {
    const q = (term || '').trim();
    return this.http
      .get<Instrument[]>(`/api/instruments?q=${encodeURIComponent(q)}&limit=${limit}`)
      .pipe(
        catchError((err) => {
          console.warn('Backend /api/instruments unavailable:', err);
          return of([]);
        })
      );
  }

  getLtp(symbol: string): Observable<InstrumentLtpResponse> {
    const clean = (symbol || '').trim();
    if (!clean) {
      return of({ symbol: '', ltp: null });
    }
    return this.http
      .get<InstrumentLtpResponse>(`/api/instruments/ltp?symbol=${encodeURIComponent(clean)}`)
      .pipe(
        catchError((err) => {
          console.warn(`Backend /api/instruments/ltp unavailable for ${clean}:`, err);
          return of({ symbol: clean, ltp: null });
        })
      );
  }
}

import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, catchError, finalize, of, shareReplay, tap } from 'rxjs';
import {
  IndexConfigItem,
  IndexLotSizesConfig,
  Instrument,
  OptionContractsResult,
  OptionExpiryItem,
  SyncMasterResult,
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
  readonly syncStatus = signal<SyncStatusResult | null>(null);
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

  /**
   * Fetch list of tradeable indices configured in Firestore for Conditional Alert Composer dropdown.
   */
  fetchConfiguredIndices(): Observable<Instrument[]> {
    return this.http.get<Instrument[]>('/api/instruments/indices').pipe(
      tap((res) => {
        if (res && res.length > 0) {
          this.configuredIndices.set(res);
        }
      }),
      catchError((err) => {
        console.warn('Backend /api/instruments/indices unavailable:', err);
        return of([]);
      }),
      shareReplay(1)
    );
  }

  /**
   * Fetch current index lot sizes configuration from Firestore.
   */
  fetchLotSizes(): Observable<LotSizesResponse | null> {
    return this.http.get<LotSizesResponse>('/api/instruments/lot-sizes').pipe(
      tap((res) => {
        if (res?.success && res.data) {
          this.lotSizes.set(res.data);
        }
      }),
      catchError((err) => {
        console.warn('Backend /api/instruments/lot-sizes unavailable:', err);
        return of(null);
      })
    );
  }

  /**
   * Update index lot sizes configuration in Firestore.
   */
  updateLotSizes(dto: UpdateLotSizesDto): Observable<LotSizesResponse | null> {
    this.isSavingLotSizes.set(true);
    return this.http.put<LotSizesResponse>('/api/instruments/lot-sizes', dto).pipe(
      tap((res) => {
        if (res?.success && res.data) {
          this.lotSizes.set(res.data);
          this.snackBar.open('✅ Index lot sizes updated and saved to Firestore!', 'OK', {
            duration: 4000,
          });
        }
      }),
      catchError((err) => {
        console.error('Failed to update lot sizes:', err);
        const errMsg = err?.error?.message || err?.message || 'Failed to update lot sizes';
        this.snackBar.open(`❌ ${errMsg}`, 'Dismiss', { duration: 5000 });
        return of(null);
      }),
      finalize(() => this.isSavingLotSizes.set(false))
    );
  }

  /**
   * Upload and sync raw CSV content to Firestore collection sec_id_to_name_mapping.
   */
  syncCsv(csvContent: string): Observable<SyncMasterResult | null> {
    this.isSyncing.set(true);
    return this.http.post<SyncMasterResult>('/api/instruments/sync/csv', { csvContent }).pipe(
      tap((res) => {
        if (res?.success) {
          this.snackBar.open(
            `✅ Synced ${res.totalInstruments} instruments from CSV to Firestore!`,
            'OK',
            { duration: 5000 }
          );
          this.fetchSyncStatus().subscribe();
        }
      }),
      catchError((err) => {
        console.error('Failed to sync CSV to Firestore:', err);
        const errMsg = err?.error?.message || err?.message || 'CSV sync failed';
        this.snackBar.open(`❌ CSV sync failed: ${errMsg}`, 'Dismiss', { duration: 6000 });
        return of(null);
      }),
      finalize(() => this.isSyncing.set(false))
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
        }),
        finalize(() => this.isSyncing.set(false))
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

  getInstruments(limit = 20): Observable<Instrument[]> {
    return this.http
      .get<Instrument[]>(`/api/instruments?limit=${limit}`)
      .pipe(
        catchError((err) => {
          console.warn('Backend /api/instruments unavailable:', err);
          return of([]);
        }),
        shareReplay(1)
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
        }),
        shareReplay(1)
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
      }),
      shareReplay(1)
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
        }),
        shareReplay(1)
      );
  }

  getBySecurityId(securityId: string): Observable<Instrument | null> {
    const clean = (securityId || '').trim();
    if (!clean) {
      return of(null);
    }
    return this.http
      .get<Instrument>(`/api/instruments/by-security-id/${encodeURIComponent(clean)}`)
      .pipe(
        catchError((err) => {
          console.warn(`Backend /api/instruments/by-security-id unavailable for ${clean}:`, err);
          return of(null);
        }),
        shareReplay(1)
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
        }),
        shareReplay(1)
      );
  }
}

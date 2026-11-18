import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { catchError, finalize, tap } from 'rxjs/operators';
import {
  LiquiditySweepSignal,
  ScreenerInstrumentItem,
  ScreenerInstrumentsResponse,
  ScreenerScanMode,
  ScreenerScanRequest,
  ScreenerScanResponse,
} from '../models/screener.models';

/** Format a local/IST date string YYYY-MM-DD offset by deltaDays */
function formatIstDateOffset(deltaDays = 0): string {
  const istNowMs = Date.now() + 5.5 * 3600 * 1000 + deltaDays * 86400 * 1000;
  return new Date(istNowMs).toISOString().slice(0, 10);
}

@Injectable({
  providedIn: 'root',
})
export class ScreenerService {
  private readonly http = inject(HttpClient);

  // --- CONFIGURED INDICES (from Firestore config/lot_sizes) ---
  readonly instruments = signal<ScreenerInstrumentItem[]>([]);
  readonly isLoadingInstruments = signal<boolean>(false);
  readonly instrumentsError = signal<string | null>(null);

  // --- ON-DEMAND SCAN STATE ---
  readonly scanMode = signal<ScreenerScanMode>('live');
  readonly historicalStartDate = signal<string>(formatIstDateOffset(-1));
  readonly historicalEndDate = signal<string>(formatIstDateOffset(-1));

  readonly isScanning = signal<boolean>(false);
  readonly scanError = signal<string | null>(null);
  readonly scanResults = signal<ScreenerScanResponse | null>(null);
  readonly lastScannedAt = signal<string | null>(null);

  // --- COMPUTED SIGNALS ---
  readonly recommendations = computed<LiquiditySweepSignal[]>(
    () => this.scanResults()?.recommendations || [],
  );
  readonly totalRecommendations = computed<number>(
    () => this.scanResults()?.totalRecommendations || 0,
  );
  readonly bullishCount = computed<number>(() => this.scanResults()?.bullishCount || 0);
  readonly bearishCount = computed<number>(() => this.scanResults()?.bearishCount || 0);
  readonly totalScanned = computed<number>(() => this.scanResults()?.totalScanned || 0);
  readonly instrumentCount = computed<number>(() => this.instruments().length);

  constructor() {
    this.loadInstruments();
  }

  /**
   * Load the configured indices universe from Firestore config/lot_sizes.
   * Does NOT trigger any scan automatically.
   */
  loadInstruments(): void {
    this.isLoadingInstruments.set(true);
    this.instrumentsError.set(null);

    this.http
      .get<ScreenerInstrumentsResponse>('/api/screener/instruments')
      .pipe(
        tap((res) => {
          if (res && Array.isArray(res.instruments)) {
            this.instruments.set(res.instruments);
          }
        }),
        catchError((err) => {
          const msg =
            err.error?.message ||
            err.message ||
            'Failed to load configured indices from backend';
          this.instrumentsError.set(msg);
          return of(null);
        }),
        finalize(() => this.isLoadingInstruments.set(false)),
      )
      .subscribe();
  }

  setMode(mode: ScreenerScanMode): void {
    this.scanMode.set(mode);
    this.scanError.set(null);
  }

  setHistoricalDates(startDate: string, endDate?: string): void {
    this.historicalStartDate.set(startDate);
    this.historicalEndDate.set(endDate || startDate);
    this.scanError.set(null);
  }

  /**
   * Strictly on-demand 5m Liquidity Sweep & Reversal scan.
   * Only executed when the user clicks "Run Scan".
   */
  runScan(override?: Partial<ScreenerScanRequest>): void {
    const mode: ScreenerScanMode = override?.mode || this.scanMode();
    const payload: ScreenerScanRequest = { mode };

    if (mode === 'historical') {
      const startDate = override?.startDate || override?.date || this.historicalStartDate();
      const endDate = override?.endDate || override?.date || this.historicalEndDate() || startDate;

      if (!startDate) {
        this.scanError.set('Please select a date for Historical mode.');
        return;
      }
      if (startDate > endDate) {
        this.scanError.set('Start date must be earlier than or equal to End date.');
        return;
      }

      payload.startDate = startDate;
      payload.endDate = endDate;
    }

    if (override?.symbols && override.symbols.length > 0) {
      payload.symbols = override.symbols;
    }

    this.isScanning.set(true);
    this.scanError.set(null);

    this.http
      .post<ScreenerScanResponse>('/api/screener/scan', payload)
      .pipe(
        tap((res) => {
          this.scanResults.set(res);
          this.lastScannedAt.set(res.scannedAt || new Date().toISOString());
        }),
        catchError((err) => {
          const rawMsg = err.error?.message;
          const msg = Array.isArray(rawMsg)
            ? rawMsg.join(', ')
            : rawMsg ||
              err.message ||
              'Failed to execute liquidity sweep scan. Please ensure backend is running.';
          this.scanError.set(msg);
          return of(null);
        }),
        finalize(() => this.isScanning.set(false)),
      )
      .subscribe();
  }
}

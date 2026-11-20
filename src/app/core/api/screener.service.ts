import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { catchError, finalize, tap } from 'rxjs/operators';
import {
  LiquiditySweepScanResponse,
  LiquiditySweepSignal,
  LiquiditySweepSymbolResult,
  OrderBlockScanResponse,
  OrderBlockSymbolResult,
  ScreenerInstrumentItem,
  ScreenerInstrumentsResponse,
  ScreenerScanMode,
  ScreenerScanRequest,
  ScreenerScanResponse,
  ScreenerStrategyType,
  SweepEntryMode,
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

  // --- CONFIGURED INDICES (from Firestore master_data/traded_instruments) ---
  readonly instruments = signal<ScreenerInstrumentItem[]>([]);
  readonly isLoadingInstruments = signal<boolean>(false);
  readonly instrumentsError = signal<string | null>(null);

  // --- STRATEGY SELECTION ('liquidity-sweep' | 'order-block') ---
  readonly activeStrategy = signal<ScreenerStrategyType>('liquidity-sweep');

  // --- LIQUIDITY SWEEP STANDALONE PARAMETERS & STATE ---
  readonly sweepTimeframe = signal<'5m' | '15m' | '1h'>('15m');
  readonly sweepEntryMode = signal<SweepEntryMode>('RECLAIM_CLOSE');
  readonly liquiditySweepResults = signal<LiquiditySweepScanResponse | null>(null);

  // --- ORDER BLOCK PARAMETERS ---
  readonly htfTimeframe = signal<'1h' | '4h'>('1h');
  readonly ltfTimeframe = signal<'5m' | '15m'>('5m');
  readonly orderBlockResults = signal<OrderBlockScanResponse | null>(null);

  // --- ON-DEMAND SCAN STATE ---
  readonly scanMode = signal<ScreenerScanMode>('live');
  readonly historicalStartDate = signal<string>(formatIstDateOffset(-1));
  readonly historicalEndDate = signal<string>(formatIstDateOffset(-1));

  readonly isScanning = signal<boolean>(false);
  readonly scanError = signal<string | null>(null);
  readonly scanResults = signal<ScreenerScanResponse | null>(null);
  readonly lastScannedAt = signal<string | null>(null);

  // --- COMPUTED SIGNALS (Liquidity Sweep Standalone & Legacy) ---
  readonly liquiditySweepSymbols = computed<LiquiditySweepSymbolResult[]>(
    () => this.liquiditySweepResults()?.results || [],
  );
  readonly totalActivePools = computed<number>(
    () => this.liquiditySweepResults()?.totalActivePools || 0,
  );
  readonly totalSweepSignals = computed<number>(
    () => this.liquiditySweepResults()?.totalSignals || 0,
  );
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

  // --- COMPUTED SIGNALS (Order Block SMC) ---
  readonly orderBlockSymbols = computed<OrderBlockSymbolResult[]>(
    () => this.orderBlockResults()?.results || [],
  );
  readonly totalActiveOrderBlocks = computed<number>(
    () => this.orderBlockResults()?.totalActiveOrderBlocks || 0,
  );
  readonly totalSniperSignals = computed<number>(
    () => this.orderBlockResults()?.totalSignals || 0,
  );
  readonly approachingCount = computed<number>(
    () => this.orderBlockResults()?.approachingCount || 0,
  );
  readonly mitigatingCount = computed<number>(
    () => this.orderBlockResults()?.mitigatingCount || 0,
  );

  constructor() {
    this.loadInstruments();
  }

  /**
   * Load the configured indices universe from Firestore master_data/traded_instruments.
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

  setStrategy(strategy: ScreenerStrategyType): void {
    this.activeStrategy.set(strategy);
    this.scanError.set(null);
  }

  setSweepTimeframe(tf: '5m' | '15m' | '1h'): void {
    this.sweepTimeframe.set(tf);
  }

  setSweepEntryMode(mode: SweepEntryMode): void {
    this.sweepEntryMode.set(mode);
  }

  setHtfTimeframe(tf: '1h' | '4h'): void {
    this.htfTimeframe.set(tf);
  }

  setLtfTimeframe(tf: '5m' | '15m'): void {
    this.ltfTimeframe.set(tf);
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
   * Strictly on-demand scan.
   * Dispatches to either Liquidity Sweep or Order Block scanner based on activeStrategy.
   */
  runScan(override?: Partial<ScreenerScanRequest>): void {
    const mode: ScreenerScanMode = override?.mode || this.scanMode();
    const strategy: ScreenerStrategyType = override?.strategy || this.activeStrategy();
    const payload: ScreenerScanRequest = {
      mode,
      strategy,
    };

    if (strategy === 'order-block' || strategy === 'ORDER_BLOCK') {
      payload.htfTimeframe = override?.htfTimeframe || this.htfTimeframe();
      payload.ltfTimeframe = override?.ltfTimeframe || this.ltfTimeframe();
    } else {
      payload.timeframe = override?.timeframe || this.sweepTimeframe();
      payload.entryMode = override?.entryMode || this.sweepEntryMode();
    }

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
          if (res.orderBlockData) {
            this.orderBlockResults.set(res.orderBlockData);
          } else if (res.strategy === 'order-block' || res.strategy === 'ORDER_BLOCK') {
            this.orderBlockResults.set(res as unknown as OrderBlockScanResponse);
          }

          if (res.liquiditySweepData) {
            this.liquiditySweepResults.set(res.liquiditySweepData);
          } else if (res.strategy === 'LIQUIDITY_SWEEP' || res.strategy === 'liquidity-sweep') {
            this.liquiditySweepResults.set(res as unknown as LiquiditySweepScanResponse);
          }
        }),
        catchError((err) => {
          const rawMsg = err.error?.message;
          const msg = Array.isArray(rawMsg)
            ? rawMsg.join(', ')
            : rawMsg ||
              err.message ||
              'Failed to execute screener scan. Please ensure backend is running.';
          this.scanError.set(msg);
          return of(null);
        }),
        finalize(() => this.isScanning.set(false)),
      )
      .subscribe();
  }
}

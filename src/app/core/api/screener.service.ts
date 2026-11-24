import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, of, tap } from 'rxjs';
import {
  BacktestSummary,
  ChartCandlesResponse,
  ScanRequestPayload,
  ScanResultResponse,
  ScreenerInstrumentItem,
  ScreenerSignal,
} from '../models/screener.models';

@Injectable({
  providedIn: 'root',
})
export class ScreenerService {
  private readonly http = inject(HttpClient);

  // Available Instruments State
  readonly instruments = signal<ScreenerInstrumentItem[]>([]);
  readonly isLoadingInstruments = signal<boolean>(false);
  readonly instrumentsError = signal<string | null>(null);

  // Screener Parameters State
  readonly scope = signal<'indices' | 'custom' | 'all'>('indices');
  readonly selectedSymbols = signal<string[]>([]);
  readonly lookbackPeriod = signal<'5d' | '15d' | '30d' | '60d'>('60d');
  readonly swingLookback = signal<number>(20);
  readonly slBuffer = signal<number>(3);
  readonly targetRr = signal<number>(2.0);
  readonly maxRetestBars = signal<number>(15);

  // Scan Execution State
  readonly isScanning = signal<boolean>(false);
  readonly scanProgressText = signal<string>('');
  readonly scanError = signal<string | null>(null);
  readonly scanResult = signal<ScanResultResponse | null>(null);
  readonly signals = signal<ScreenerSignal[]>([]);
  readonly summary = signal<BacktestSummary | null>(null);

  // Table & View Filters
  readonly searchQuery = signal<string>('');
  readonly filterOutcome = signal<'ALL' | 'WIN' | 'LOSS' | 'EOD_EXIT' | 'OPEN'>('ALL');
  readonly selectedSignal = signal<ScreenerSignal | null>(null);

  // Computed Filtered Signals
  readonly filteredSignals = computed(() => {
    let list = this.signals();
    const query = this.searchQuery().trim().toLowerCase();
    const outcomeFilter = this.filterOutcome();

    if (query) {
      list = list.filter(
        (s) =>
          s.symbol.toLowerCase().includes(query) ||
          s.name.toLowerCase().includes(query) ||
          s.date.includes(query) ||
          s.id.toLowerCase().includes(query),
      );
    }

    if (outcomeFilter !== 'ALL') {
      list = list.filter((s) => s.outcome === outcomeFilter);
    }

    return list;
  });

  constructor() {
    this.loadInstruments();
  }

  /**
   * Load master instruments available for scanning.
   */
  loadInstruments(): Observable<{ success: boolean; data: ScreenerInstrumentItem[] }> {
    this.isLoadingInstruments.set(true);
    this.instrumentsError.set(null);

    const obs = this.http.get<{ success: boolean; data: ScreenerInstrumentItem[] }>('/api/screener/instruments').pipe(
      tap({
        next: (res) => {
          this.isLoadingInstruments.set(false);
          this.instruments.set(res.data || []);
        },
        error: (err) => {
          this.isLoadingInstruments.set(false);
          this.instrumentsError.set(err?.error?.message || err?.message || 'Failed to load master instruments');
        },
      }),
      catchError((err) => {
        this.isLoadingInstruments.set(false);
        this.instrumentsError.set(err?.error?.message || err?.message || 'Failed to load master instruments');
        return of({ success: false, data: [] });
      }),
    );
    obs.subscribe();
    return obs;
  }

  /**
   * Run the 5m trade screener & backtest.
   */
  runScan(overridePayload?: Partial<ScanRequestPayload>): Observable<ScanResultResponse | null> {
    this.isScanning.set(true);
    this.scanProgressText.set('Fetching 5m historical data via Yahoo Finance...');
    this.scanError.set(null);

    const payload: ScanRequestPayload = {
      scope: this.scope(),
      symbols: this.scope() === 'custom' ? this.selectedSymbols() : undefined,
      lookbackPeriod: this.lookbackPeriod(),
      swingLookback: this.swingLookback(),
      slBuffer: this.slBuffer(),
      targetRr: this.targetRr(),
      maxRetestBars: this.maxRetestBars(),
      ...overridePayload,
    };

    return this.http.post<ScanResultResponse>('/api/screener/scan', payload).pipe(
      tap({
        next: (res) => {
          this.isScanning.set(false);
          this.scanProgressText.set('');
          this.scanResult.set(res);
          this.signals.set(res.signals || []);
          this.summary.set(res.summary || null);

          // Auto-select first signal for chart viewer if available and none selected
          if (res.signals && res.signals.length > 0 && !this.selectedSignal()) {
            this.selectedSignal.set(res.signals[0]);
          }
        },
        error: (err) => {
          this.isScanning.set(false);
          this.scanProgressText.set('');
          const msg = err?.error?.message || err?.message || 'Failed to complete 5m screener scan';
          this.scanError.set(msg);
        },
      }),
      catchError((err) => {
        this.isScanning.set(false);
        this.scanProgressText.set('');
        const msg = err?.error?.message || err?.message || 'Failed to complete 5m screener scan';
        this.scanError.set(msg);
        return of(null);
      }),
    );
  }

  /**
   * Fetch 5m candles for chart viewing.
   */
  getCandles(symbol: string, range?: string): Observable<ChartCandlesResponse> {
    let params = new HttpParams().set('symbol', symbol);
    if (range) {
      params = params.set('range', range);
    }
    return this.http.get<ChartCandlesResponse>('/api/charts/candles', { params });
  }

  /**
   * Select a signal for interactive chart inspection.
   */
  selectSignal(signal: ScreenerSignal | null): void {
    this.selectedSignal.set(signal);
  }

  /**
   * Toggle symbol selection in custom scope.
   */
  toggleSymbolSelection(symbol: string): void {
    const current = this.selectedSymbols();
    const idx = current.indexOf(symbol);
    if (idx >= 0) {
      this.selectedSymbols.set(current.filter((s) => s !== symbol));
    } else {
      this.selectedSymbols.set([...current, symbol]);
    }
  }

  /**
   * Set instrument scope.
   */
  setScope(scope: 'indices' | 'custom' | 'all'): void {
    this.scope.set(scope);
  }

  /**
   * Select all available instruments for custom scope.
   */
  selectAllInstruments(): void {
    const all = this.instruments().map((i) => i.symbol);
    this.selectedSymbols.set(all);
  }

  /**
   * Clear all selected instruments.
   */
  clearSelectedInstruments(): void {
    this.selectedSymbols.set([]);
  }
}

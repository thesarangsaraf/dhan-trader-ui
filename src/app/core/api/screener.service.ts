import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, finalize, tap } from 'rxjs/operators';
import { of, Observable } from 'rxjs';
import {
  ScreenerMatch,
  ScreenerScanResponse,
  ScreenerWatchlistDoc,
  WatchlistStockItem,
} from '../models/screener.models';

@Injectable({
  providedIn: 'root',
})
export class ScreenerService {
  private readonly http = inject(HttpClient);

  // --- SIGNALS STATE ---
  readonly watchlist = signal<WatchlistStockItem[]>([]);
  readonly isLoadingWatchlist = signal<boolean>(false);
  readonly watchlistError = signal<string | null>(null);

  readonly selectedTimeframe = signal<string>('15m');
  readonly isScanning = signal<boolean>(false);
  readonly scanError = signal<string | null>(null);
  readonly scanResults = signal<ScreenerScanResponse | null>(null);
  readonly lastScannedAt = signal<string | null>(null);

  // --- COMPUTED SIGNALS ---
  readonly matches = computed<ScreenerMatch[]>(() => this.scanResults()?.matches || []);
  readonly totalMatches = computed<number>(() => this.scanResults()?.totalMatches || 0);
  readonly bullishMatches = computed<number>(() => this.scanResults()?.bullishMatches || 0);
  readonly bearishMatches = computed<number>(() => this.scanResults()?.bearishMatches || 0);
  readonly totalScanned = computed<number>(() => this.scanResults()?.totalScanned || 0);
  readonly enabledWatchlistCount = computed<number>(() => this.watchlist().filter((s) => s.enabled).length);

  constructor() {
    this.loadWatchlist();
  }

  /**
   * Load configurable stock watchlist from Firestore
   */
  loadWatchlist(): void {
    this.isLoadingWatchlist.set(true);
    this.watchlistError.set(null);

    this.http
      .get<ScreenerWatchlistDoc>('/api/screener/watchlist')
      .pipe(
        tap((res) => {
          if (res && Array.isArray(res.symbols)) {
            this.watchlist.set(res.symbols);
          }
        }),
        catchError((err) => {
          const msg = err.error?.message || err.message || 'Failed to load stock watchlist from backend';
          this.watchlistError.set(msg);
          return of(null);
        }),
        finalize(() => this.isLoadingWatchlist.set(false)),
      )
      .subscribe();
  }

  /**
   * Update full stock watchlist in Firestore
   */
  updateWatchlist(symbols: WatchlistStockItem[]): Observable<any> {
    this.isLoadingWatchlist.set(true);
    return this.http
      .put<{ success: boolean; data: ScreenerWatchlistDoc }>('/api/screener/watchlist', { symbols })
      .pipe(
        tap((res) => {
          if (res?.data?.symbols) {
            this.watchlist.set(res.data.symbols);
          }
        }),
        finalize(() => this.isLoadingWatchlist.set(false)),
      );
  }

  /**
   * Toggle a specific stock enabled / disabled
   */
  toggleStock(symbol: string): void {
    const current = this.watchlist();
    const updated = current.map((item) =>
      item.symbol.toUpperCase() === symbol.toUpperCase()
        ? { ...item, enabled: !item.enabled }
        : item,
    );
    this.watchlist.set(updated);
    this.updateWatchlist(updated).subscribe();
  }

  /**
   * Add a new stock ticker to the watchlist
   */
  addStock(symbol: string, name: string, sector?: string): void {
    const cleanSym = symbol.replace(/\.NS$/i, '').trim().toUpperCase();
    if (!cleanSym) return;

    const current = this.watchlist();
    if (current.some((s) => s.symbol.toUpperCase() === cleanSym)) {
      return; // Already exists
    }

    const newItem: WatchlistStockItem = {
      symbol: cleanSym,
      name: name.trim() || cleanSym,
      sector: sector?.trim() || 'Equity',
      enabled: true,
      order: current.length + 1,
    };

    const updated = [...current, newItem];
    this.watchlist.set(updated);
    this.updateWatchlist(updated).subscribe();
  }

  /**
   * Remove a stock ticker from the watchlist
   */
  removeStock(symbol: string): void {
    const cleanSym = symbol.replace(/\.NS$/i, '').trim().toUpperCase();
    const current = this.watchlist();
    const updated = current.filter((s) => s.symbol.toUpperCase() !== cleanSym);
    this.watchlist.set(updated);
    this.updateWatchlist(updated).subscribe();
  }

  /**
   * Reset watchlist back to the default 28 large-cap stocks
   */
  resetWatchlist(): void {
    this.isLoadingWatchlist.set(true);
    this.http
      .post<{ success: boolean; data: ScreenerWatchlistDoc }>('/api/screener/watchlist/reset', {})
      .pipe(
        tap((res) => {
          if (res?.data?.symbols) {
            this.watchlist.set(res.data.symbols);
          }
        }),
        catchError((err) => {
          this.watchlistError.set(err.message || 'Failed to reset watchlist');
          return of(null);
        }),
        finalize(() => this.isLoadingWatchlist.set(false)),
      )
      .subscribe();
  }

  /**
   * Execute manual technical price action scan for selected timeframe
   */
  runScan(timeframe?: string): void {
    const tf = timeframe || this.selectedTimeframe();
    this.selectedTimeframe.set(tf);
    this.isScanning.set(true);
    this.scanError.set(null);

    this.http
      .post<ScreenerScanResponse>('/api/screener/scan', { timeframe: tf })
      .pipe(
        tap((res) => {
          this.scanResults.set(res);
          this.lastScannedAt.set(res.scannedAt || new Date().toISOString());
        }),
        catchError((err) => {
          const msg =
            err.error?.message ||
            err.message ||
            'Failed to execute screener scan. Please ensure backend is running.';
          this.scanError.set(msg);
          return of(null);
        }),
        finalize(() => this.isScanning.set(false)),
      )
      .subscribe();
  }

  /**
   * Change selected timeframe interval
   */
  setTimeframe(tf: string): void {
    this.selectedTimeframe.set(tf);
  }
}

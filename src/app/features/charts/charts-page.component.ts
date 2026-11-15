import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
} from 'lightweight-charts';
import { ChartService } from '../../core/api/chart.service';
import { InstrumentService } from '../../core/api/instrument.service';
import { Instrument } from '../../core/models/instrument.models';
import { CandleData, ChartCandlesResponse } from '../../core/models/chart.models';
import { SectionErrorComponent } from '../../shared/components/section-error/section-error.component';
import { ScripSearcherModalComponent } from '../../shared/components/scrip-searcher-modal/scrip-searcher-modal.component';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';

export interface TimeframeOption {
  label: string;
  value: string;
}

export interface RangeOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-charts-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    SectionErrorComponent,
    CurrencyInrPipe,
  ],
  templateUrl: './charts-page.component.html',
  styleUrls: ['./charts-page.component.scss'],
})
export class ChartsPageComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chartContainer') chartContainerRef!: ElementRef<HTMLDivElement>;

  private readonly chartService = inject(ChartService);
  private readonly instrumentService = inject(InstrumentService);
  private readonly dialog = inject(MatDialog);

  // Dynamic instrument list from backend API (matching Alert Composer dropdown)
  readonly instruments = signal<Instrument[]>([]);

  // Reactive state signals
  readonly selectedSymbol = signal<string>('NIFTY 50');
  readonly customSymbolInput = signal<string>('');
  readonly selectedInterval = signal<string>('5m');
  readonly selectedRange = signal<string>('5d');
  readonly isLoading = signal<boolean>(false);
  readonly isLoadingMoreHistory = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly chartData = signal<ChartCandlesResponse | null>(null);
  readonly hoveredCandle = signal<CandleData | null>(null);
  readonly isAutoRefresh = signal<boolean>(false);

  // Timeframe presets
  readonly timeframes: TimeframeOption[] = [
    { label: '1m', value: '1m' },
    { label: '5m', value: '5m' },
    { label: '15m', value: '15m' },
    { label: '1h', value: '1h' },
    { label: '1D', value: '1d' },
  ];

  // Duration presets
  readonly ranges: RangeOption[] = [
    { label: '1D', value: '1d' },
    { label: '5D', value: '5d' },
    { label: '1M', value: '1mo' },
    { label: '3M', value: '3mo' },
    { label: '1Y', value: '1y' },
  ];

  // Derived metrics
  readonly currentLtp = computed<number | null>(() => {
    const data = this.chartData();
    if (!data || data.candles.length === 0) return null;
    return data.candles[data.candles.length - 1].close;
  });

  readonly dayOpen = computed<number | null>(() => {
    const data = this.chartData();
    if (!data || data.candles.length === 0) return null;
    return data.candles[0].open;
  });

  readonly priceChange = computed<{ points: number; percent: number } | null>(() => {
    const ltp = this.currentLtp();
    const open = this.dayOpen();
    if (ltp === null || open === null || open === 0) return null;
    const points = ltp - open;
    const percent = (points / open) * 100;
    return { points, percent };
  });

  // Lightweight Charts instances & in-memory candle data
  private chart: IChartApi | null = null;
  private candlestickSeries: ISeriesApi<'Candlestick'> | null = null;
  private volumeSeries: ISeriesApi<'Histogram'> | null = null;
  private autoRefreshTimer: any = null;
  private allCandles: CandleData[] = [];
  private hasMoreHistoricalData = true;

  ngOnInit(): void {
    this.loadInstruments();
  }

  /**
   * Load instruments using the exact same backend API (GET /api/instruments/indices) as Alert Composer.
   */
  loadInstruments(): void {
    this.instrumentService.fetchConfiguredIndices().subscribe((indicesList) => {
      let activeIndices: Instrument[] = [];
      if (indicesList && indicesList.length > 0) {
        activeIndices = indicesList;
      } else {
        const cfg = this.instrumentService.lotSizes();
        if (cfg?.indices && cfg.indices.length > 0) {
          activeIndices = cfg.indices
            .filter((i) => i.enabled !== false)
            .map((i) => ({
              symbol: i.symbol,
              name: i.name,
              securityId: i.securityId,
              exchangeSegment: i.exchangeSegment,
              instrumentType: 'INDEX',
              lotSize: i.lotSize,
              ltp: 0,
            }));
        }
      }

      this.instruments.set(activeIndices);
      if (activeIndices.length > 0) {
        const current = this.selectedSymbol();
        const exists = activeIndices.find((i) => i.symbol === current);
        if (!exists) {
          const nifty = activeIndices.find((i) => i.symbol === 'NIFTY 50') || activeIndices[0];
          if (nifty) {
            this.selectedSymbol.set(nifty.symbol);
          }
        }
      }
    });
  }

  /**
   * Open the global scrip search modal (Ctrl+K) to find and chart any equity or contract.
   */
  openScripSearchModal(): void {
    const dialogRef = this.dialog.open(ScripSearcherModalComponent, {
      width: '640px',
      panelClass: 'dhan-spotlight-dialog',
    });
    dialogRef.afterClosed().subscribe((item?: Instrument) => {
      if (item) {
        const sym = item.symbol || item.name;
        const exists = this.instruments().some((i) => i.symbol.toUpperCase() === sym.toUpperCase());
        if (!exists) {
          this.instruments.set([...this.instruments(), { ...item, symbol: sym }]);
        }
        this.selectedSymbol.set(sym);
        this.loadCandles();
      }
    });
  }

  ngAfterViewInit(): void {
    this.initChart();
    this.loadCandles();
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
    if (this.chart) {
      this.chart.remove();
      this.chart = null;
    }
  }

  /**
   * Initialize TradingView lightweight-charts with strict Dark Mode design tokens.
   */
  private initChart(): void {
    if (!this.chartContainerRef?.nativeElement) return;
    if (typeof window === 'undefined') return;

    // Safety guard for environments without matchMedia (e.g. jsdom in test runners)
    if (!window.matchMedia) {
      window.matchMedia = (query: string) =>
        ({
          matches: false,
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }) as any;
    }

    // Safety guard for environments without ResizeObserver (e.g. test runners)
    if (typeof (window as any).ResizeObserver === 'undefined') {
      (window as any).ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }

    const container = this.chartContainerRef.nativeElement;

    this.chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#0B0F19' },
        textColor: '#94A3B8',
        fontSize: 12,
        fontFamily: "'JetBrains Mono', monospace, sans-serif",
      },
      localization: {
        locale: 'en-IN',
        dateFormat: 'dd MMM yyyy',
        timeFormatter: (time: number) => {
          const date = new Date(time * 1000);
          return date.toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
        },
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.6)' },
        horzLines: { color: 'rgba(30, 41, 59, 0.6)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#6366F1',
          width: 1,
          style: 1,
          visible: true,
          labelBackgroundColor: '#1E293B',
        },
        horzLine: {
          color: '#6366F1',
          width: 1,
          style: 1,
          visible: true,
          labelBackgroundColor: '#1E293B',
        },
      },
      rightPriceScale: {
        borderColor: '#1E293B',
        scaleMargins: {
          top: 0.1,
          bottom: 0.2, // Leave bottom 20% for volume histogram
        },
      },
      timeScale: {
        borderColor: '#1E293B',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    // Add Candlestick Series (Mint Emerald #10B981 for up, Rose Coral #F43F5E for down)
    this.candlestickSeries = this.chart.addSeries(CandlestickSeries, {
      upColor: '#10B981',
      downColor: '#F43F5E',
      borderVisible: false,
      wickUpColor: '#10B981',
      wickDownColor: '#F43F5E',
    });

    // Add Volume Series (Histogram at bottom on dedicated 'volume' scale)
    this.volumeSeries = this.chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
    });

    this.chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.8, // Position volume at the bottom 20%
        bottom: 0,
      },
    });

    // Crosshair hover legend listener
    this.chart.subscribeCrosshairMove((param) => {
      if (
        !param.time ||
        !param.seriesData ||
        !this.candlestickSeries ||
        !param.seriesData.has(this.candlestickSeries)
      ) {
        this.hoveredCandle.set(null);
        return;
      }

      const candle = param.seriesData.get(this.candlestickSeries) as any;
      if (candle) {
        const volumeData = this.volumeSeries && param.seriesData.has(this.volumeSeries)
          ? (param.seriesData.get(this.volumeSeries) as any)
          : null;

        this.hoveredCandle.set({
          time: Number(param.time),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: volumeData ? volumeData.value : 0,
        });
      }
    });

    // Dynamically load older historical candles when the user scrolls the chart to the left
    this.chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (!range) return;
      if (range.from < 15) {
        this.loadOlderCandles();
      }
    });
  }

  /**
   * Fetch candlestick data from backend and render on chart.
   */
  loadCandles(fitContent = true): void {
    const symbol = this.selectedSymbol();
    const interval = this.selectedInterval();
    const range = this.selectedRange();

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.hasMoreHistoricalData = true;

    this.chartService.getCandles(symbol, interval, range).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.chartData.set(res);

        if (!res.candles || res.candles.length === 0) {
          this.errorMessage.set(`No candlestick data returned for ${symbol} (${interval}, ${range}).`);
          this.allCandles = [];
          if (this.candlestickSeries) this.candlestickSeries.setData([]);
          if (this.volumeSeries) this.volumeSeries.setData([]);
          return;
        }

        // Deduplicate and sort strictly ascending
        const seen = new Set<number>();
        const sanitized: CandleData[] = [];
        for (const c of res.candles) {
          if (
            c &&
            typeof c.time === 'number' &&
            !isNaN(c.time) &&
            !isNaN(c.close) &&
            !seen.has(c.time)
          ) {
            seen.add(c.time);
            sanitized.push({
              time: c.time,
              open: Number(c.open),
              high: Number(c.high),
              low: Number(c.low),
              close: Number(c.close),
              volume: typeof c.volume === 'number' && !isNaN(c.volume) ? c.volume : 0,
            });
          }
        }
        sanitized.sort((a, b) => a.time - b.time);
        this.allCandles = sanitized;

        // Render candlestick data
        if (this.candlestickSeries) {
          const chartCandles = this.allCandles.map((c) => ({
            time: c.time as UTCTimestamp,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }));
          this.candlestickSeries.setData(chartCandles);
        }

        // Render volume data (only when positive volume exists)
        if (this.volumeSeries) {
          const hasVolume = this.allCandles.some((c) => c.volume > 0);
          if (hasVolume) {
            const volumeData = this.allCandles.map((c) => ({
              time: c.time as UTCTimestamp,
              value: c.volume,
              color: c.close >= c.open ? 'rgba(16, 185, 129, 0.35)' : 'rgba(244, 63, 94, 0.35)',
            }));
            this.volumeSeries.setData(volumeData);
          } else {
            this.volumeSeries.setData([]);
          }
        }

        // Fit content into view
        if (fitContent && this.chart) {
          this.chart.timeScale().fitContent();
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        const msg = err.error?.message || err.message || 'Failed to fetch candlestick data from backend.';
        this.errorMessage.set(`Error loading chart: ${msg}`);
      },
    });
  }

  /**
   * Dynamically fetch older historical candles as the user scrolls the chart to the left.
   */
  loadOlderCandles(): void {
    if (this.isLoadingMoreHistory() || this.isLoading() || !this.hasMoreHistoricalData) {
      return;
    }
    if (this.allCandles.length === 0) return;

    const oldestCandle = this.allCandles[0];
    const period2 = oldestCandle.time - 1;
    const interval = this.selectedInterval();
    const symbol = this.selectedSymbol();

    // Determine how many days back to query based on interval
    let daysBack = 7;
    if (interval === '1m') daysBack = 3;
    else if (interval === '5m') daysBack = 7;
    else if (interval === '15m') daysBack = 20;
    else if (interval === '1h') daysBack = 60;
    else if (interval === '1d') daysBack = 180;

    const period1 = period2 - daysBack * 86400;

    this.isLoadingMoreHistory.set(true);

    this.chartService.getCandles(symbol, interval, undefined, undefined, period1, period2).subscribe({
      next: (res) => {
        this.isLoadingMoreHistory.set(false);
        if (!res.candles || res.candles.length === 0) {
          this.hasMoreHistoricalData = false;
          return;
        }

        const existingTimes = new Set(this.allCandles.map((c) => c.time));
        const newCandles = res.candles
          .filter(
            (c) =>
              c &&
              typeof c.time === 'number' &&
              !isNaN(c.time) &&
              !isNaN(c.close) &&
              c.time < oldestCandle.time &&
              !existingTimes.has(c.time),
          )
          .map((c) => ({
            time: c.time,
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
            volume: typeof c.volume === 'number' && !isNaN(c.volume) ? c.volume : 0,
          }));

        if (newCandles.length === 0) {
          this.hasMoreHistoricalData = false;
          return;
        }

        // Merge older candles before existing candles and sort strictly ascending
        this.allCandles = [...newCandles, ...this.allCandles].sort((a, b) => a.time - b.time);

        // Update candlestick series without resetting scroll position
        if (this.candlestickSeries) {
          const chartCandles = this.allCandles.map((c) => ({
            time: c.time as UTCTimestamp,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }));
          this.candlestickSeries.setData(chartCandles);
        }

        // Update volume series if available
        if (this.volumeSeries) {
          const hasVolume = this.allCandles.some((c) => c.volume > 0);
          if (hasVolume) {
            const volumeData = this.allCandles.map((c) => ({
              time: c.time as UTCTimestamp,
              value: c.volume,
              color: c.close >= c.open ? 'rgba(16, 185, 129, 0.35)' : 'rgba(244, 63, 94, 0.35)',
            }));
            this.volumeSeries.setData(volumeData);
          } else {
            this.volumeSeries.setData([]);
          }
        }
      },
      error: () => {
        this.isLoadingMoreHistory.set(false);
        this.hasMoreHistoricalData = false;
      },
    });
  }

  selectSymbol(symbol: string): void {
    if (this.selectedSymbol() === symbol) return;
    this.selectedSymbol.set(symbol);
    this.allCandles = [];
    this.loadCandles();
  }

  applyCustomSymbol(): void {
    const sym = this.customSymbolInput().trim().toUpperCase();
    if (!sym) return;
    const exists = this.instruments().some((i) => i.symbol.toUpperCase() === sym);
    if (!exists) {
      this.instruments.set([
        ...this.instruments(),
        {
          symbol: sym,
          name: sym,
          securityId: '',
          exchangeSegment: 'NSE_EQ',
          instrumentType: 'EQUITY',
          ltp: 0,
        },
      ]);
    }
    this.selectedSymbol.set(sym);
    this.customSymbolInput.set('');
    this.allCandles = [];
    this.loadCandles();
  }

  selectInterval(interval: string): void {
    if (this.selectedInterval() === interval) return;
    this.selectedInterval.set(interval);
    if (interval === '1d') {
      this.selectedRange.set('1y');
    } else if (interval === '1m') {
      this.selectedRange.set('5d');
    }
    this.allCandles = [];
    this.loadCandles();
  }

  selectRange(range: string): void {
    if (this.selectedRange() === range) return;
    this.selectedRange.set(range);
    this.allCandles = [];
    this.loadCandles();
  }

  toggleAutoRefresh(): void {
    const nextState = !this.isAutoRefresh();
    this.isAutoRefresh.set(nextState);

    if (nextState) {
      this.startAutoRefresh();
    } else {
      this.stopAutoRefresh();
    }
  }

  private startAutoRefresh(): void {
    this.stopAutoRefresh();
    // Refresh every 15 seconds
    this.autoRefreshTimer = setInterval(() => {
      this.loadCandles();
    }, 15000);
  }

  private stopAutoRefresh(): void {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
  }

  formatEpochTime(epoch: number): string {
    const date = new Date(epoch * 1000);
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }
}

import {
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  CandlestickSeries,
  IChartApi,
  ISeriesApi,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
} from 'lightweight-charts';
import { CandleData, ScreenerSignal } from '../../../../core/models/screener.models';
import { ScreenerService } from '../../../../core/api/screener.service';
import { CurrencyInrPipe } from '../../../../shared/pipes/currency-inr.pipe';

@Component({
  selector: 'app-signal-chart-viewer',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, CurrencyInrPipe],
  template: `
    <div class="chart-viewer-card" [class.fullscreen]="isFullscreen()">
      <!-- Header Banner with Signal Meta -->
      <div class="viewer-header">
        <div class="header-left">
          <div class="symbol-badge">
            <span class="symbol-name">{{ signal()?.symbol || 'No Signal Selected' }}</span>
            <span class="timeframe-tag">5m OHLCV</span>
          </div>

          <div *ngIf="signal() as sig" class="signal-metrics-row">
            <span class="outcome-badge" [ngClass]="sig.outcome.toLowerCase()">
              <span class="material-symbols-rounded outcome-icon">
                {{ sig.outcome === 'WIN' ? 'check_circle' : sig.outcome === 'LOSS' ? 'cancel' : sig.outcome === 'EOD_EXIT' ? 'schedule' : 'hourglass_top' }}
              </span>
              {{ sig.outcome === 'WIN' ? 'TARGET HIT' : sig.outcome === 'LOSS' ? 'STOP LOSS HIT' : sig.outcome === 'EOD_EXIT' ? '15:25 EOD EXIT' : 'OPEN TRADE' }}
            </span>

            <span class="pnl-chip" [class.profit]="sig.pnlPoints > 0" [class.loss]="sig.pnlPoints < 0">
              <span class="mono-val">
                {{ sig.pnlPoints > 0 ? '+' : '' }}{{ sig.pnlPoints }} pts
                ({{ sig.rMultiple > 0 ? '+' : '' }}{{ sig.rMultiple }}R)
              </span>
            </span>

            <span class="meta-item">
              <span class="meta-label">Date:</span>
              <span class="meta-val mono-val">{{ sig.date }}</span>
            </span>

            <span class="meta-item">
              <span class="meta-label">Entry:</span>
              <span class="meta-val mono-val">{{ sig.entryPrice | currencyInr : false }} ({{ sig.entryTimeFormatted }})</span>
            </span>

            <span class="meta-item">
              <span class="meta-label">Target:</span>
              <span class="meta-val mono-val profit">{{ sig.targetPrice | currencyInr : false }}</span>
            </span>

            <span class="meta-item">
              <span class="meta-label">SL:</span>
              <span class="meta-val mono-val loss">{{ sig.stopLoss | currencyInr : false }}</span>
            </span>
          </div>
        </div>

        <div class="header-actions">
          <button
            mat-icon-button
            class="action-btn"
            (click)="fitChartContent()"
            matTooltip="Reset zoom & fit content"
          >
            <span class="material-symbols-rounded">zoom_out_map</span>
          </button>
          <button
            mat-icon-button
            class="action-btn"
            (click)="toggleFullscreen()"
            [matTooltip]="isFullscreen() ? 'Exit fullscreen' : 'Expand full screen'"
          >
            <span class="material-symbols-rounded">{{ isFullscreen() ? 'fullscreen_exit' : 'fullscreen' }}</span>
          </button>
          <button
            *ngIf="showCloseButton"
            mat-icon-button
            class="action-btn close-btn"
            (click)="closeViewer()"
            matTooltip="Close Chart Viewer"
          >
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>
      </div>

      <!-- Chart Legend & Overlays Indicator -->
      <div class="chart-legend-bar" *ngIf="signal() as sig">
        <div class="legend-chip low-chip">
          <span class="legend-color-dot low-dot"></span>
          <span>LOW: {{ sig.swingLow }}</span>
        </div>
        <div class="legend-chip sweep-chip">
          <span class="legend-color-dot sweep-dot"></span>
          <span>LOW SWEEP: {{ sig.sweepLow }}</span>
        </div>
        <div class="legend-chip ob-chip">
          <span class="legend-color-dot ob-dot"></span>
          <span>ORDER BLOCK: {{ sig.orderBlock.bottom }} - {{ sig.orderBlock.top }}</span>
        </div>
        <div class="legend-chip entry-chip">
          <span class="legend-color-dot entry-dot"></span>
          <span>ENTRY: {{ sig.entryPrice }}</span>
        </div>
        <div class="legend-chip sl-chip">
          <span class="legend-color-dot sl-dot"></span>
          <span>SL: {{ sig.stopLoss }}</span>
        </div>
        <div class="legend-chip target-chip">
          <span class="legend-color-dot target-dot"></span>
          <span>TARGET: {{ sig.targetPrice }}</span>
        </div>
      </div>

      <!-- Chart Viewport Container -->
      <div class="chart-canvas-wrapper" #chartWrapper>
        <div class="chart-container" #chartContainer></div>

        <!-- SVG Layer for Order Block Box Overlay -->
        <svg class="order-block-svg-overlay" *ngIf="orderBlockCoords() as ob">
          <rect
            [attr.x]="ob.x"
            [attr.y]="ob.y"
            [attr.width]="ob.width"
            [attr.height]="ob.height"
            class="order-block-rect"
          />
          <text
            [attr.x]="ob.x + 8"
            [attr.y]="ob.y + 16"
            class="order-block-text"
          >
            ORDER BLOCK [{{ signal()?.orderBlock?.bottom }} - {{ signal()?.orderBlock?.top }}]
          </text>
        </svg>

        <!-- Loading State Spinner -->
        <div *ngIf="isLoadingCandles()" class="chart-loading-overlay">
          <div class="spinner"></div>
          <span>Loading 5m candles from Yahoo Finance...</span>
        </div>

        <!-- Empty State -->
        <div *ngIf="!signal() && !isLoadingCandles()" class="chart-empty-overlay">
          <span class="material-symbols-rounded empty-icon">candlestick_chart</span>
          <span>Select any detected signal row from the table below to inspect interactive 5m chart</span>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

      .chart-viewer-card {
        background: var(--bg-surface-card, #151c2c);
        border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
        border-radius: 12px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        transition: all 0.2s ease;
        position: relative;
      }

      .chart-viewer-card.fullscreen {
        position: fixed;
        inset: 12px;
        z-index: 2000;
        border-color: var(--brand-cyan, #00d2c4);
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.8);
      }

      .viewer-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 16px;
        background: rgba(11, 15, 25, 0.6);
        border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
        flex-wrap: wrap;
        gap: 10px;
      }

      .header-left {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      .symbol-badge {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .symbol-name {
        font-size: 1.05rem;
        font-weight: 700;
        color: var(--text-primary, #ffffff);
        letter-spacing: 0.3px;
      }

      .timeframe-tag {
        font-size: 0.7rem;
        font-weight: 600;
        padding: 2px 6px;
        background: rgba(99, 102, 241, 0.2);
        color: #818cf8;
        border: 1px solid rgba(99, 102, 241, 0.4);
        border-radius: 4px;
      }

      .signal-metrics-row {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      .outcome-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.75rem;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 6px;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }

      .outcome-badge.win {
        background: rgba(16, 185, 129, 0.15);
        color: var(--trading-profit, #10b981);
        border: 1px solid rgba(16, 185, 129, 0.4);
      }

      .outcome-badge.loss {
        background: rgba(244, 63, 94, 0.15);
        color: var(--trading-loss, #f43f5e);
        border: 1px solid rgba(244, 63, 94, 0.4);
      }

      .outcome-badge.eod_exit {
        background: rgba(245, 158, 11, 0.15);
        color: var(--trading-pending, #f59e0b);
        border: 1px solid rgba(245, 158, 11, 0.4);
      }

      .outcome-badge.open {
        background: rgba(0, 210, 196, 0.15);
        color: var(--brand-cyan, #00d2c4);
        border: 1px solid rgba(0, 210, 196, 0.4);
      }

      .outcome-icon {
        font-size: 14px;
      }

      .pnl-chip {
        font-size: 0.8rem;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.05);
      }

      .pnl-chip.profit {
        color: var(--trading-profit, #10b981);
        background: rgba(16, 185, 129, 0.12);
      }

      .pnl-chip.loss {
        color: var(--trading-loss, #f43f5e);
        background: rgba(244, 63, 94, 0.12);
      }

      .meta-item {
        font-size: 0.75rem;
        color: var(--text-muted, #94a3b8);
        display: flex;
        gap: 4px;
      }

      .meta-val {
        color: var(--text-primary, #ffffff);
        font-weight: 600;
      }

      .meta-val.profit {
        color: var(--trading-profit, #10b981);
      }

      .meta-val.loss {
        color: var(--trading-loss, #f43f5e);
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .action-btn {
        color: var(--text-muted, #94a3b8);
        width: 32px;
        height: 32px;
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .action-btn:hover {
        color: #ffffff;
        background: rgba(255, 255, 255, 0.08);
      }

      .chart-legend-bar {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 6px 16px;
        background: rgba(11, 15, 25, 0.35);
        border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.05));
        overflow-x: auto;
        white-space: nowrap;
        font-size: 0.72rem;
      }

      .legend-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: var(--text-secondary, #cbd5e1);
        font-family: 'JetBrains Mono', monospace;
      }

      .legend-color-dot {
        width: 8px;
        height: 8px;
        border-radius: 2px;
      }

      .low-dot {
        background: #f59e0b;
      }

      .sweep-dot {
        background: #fbbf24;
        border-radius: 50%;
      }

      .ob-dot {
        background: rgba(0, 210, 196, 0.7);
      }

      .entry-dot {
        background: #00d2c4;
      }

      .sl-dot {
        background: #f43f5e;
      }

      .target-dot {
        background: #10b981;
      }

      .chart-canvas-wrapper {
        position: relative;
        width: 100%;
        height: 480px;
        background: #0b0f19;
      }

      .chart-viewer-card.fullscreen .chart-canvas-wrapper {
        height: calc(100vh - 120px);
      }

      .chart-container {
        width: 100%;
        height: 100%;
      }

      .order-block-svg-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 5;
      }

      .order-block-rect {
        fill: rgba(0, 210, 196, 0.15);
        stroke: rgba(0, 210, 196, 0.75);
        stroke-width: 1.5;
        stroke-dasharray: 4 2;
      }

      .order-block-text {
        fill: #00d2c4;
        font-size: 11px;
        font-family: 'JetBrains Mono', monospace;
        font-weight: 700;
        letter-spacing: 0.3px;
      }

      .chart-loading-overlay,
      .chart-empty-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        background: rgba(11, 15, 25, 0.85);
        color: var(--text-muted, #94a3b8);
        font-size: 0.875rem;
        z-index: 10;
      }

      .empty-icon {
        font-size: 48px;
        color: rgba(255, 255, 255, 0.2);
      }

      .spinner {
        width: 32px;
        height: 32px;
        border: 3px solid rgba(0, 210, 196, 0.2);
        border-top-color: var(--brand-cyan, #00d2c4);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      @media (max-width: 768px) {
        .chart-canvas-wrapper {
          height: 360px;
        }

        .viewer-header {
          padding: 8px 12px;
        }

        .symbol-name {
          font-size: 0.95rem;
        }

        .meta-item {
          display: none;
        }
      }
    `,
  ],
})
export class SignalChartViewerComponent implements OnChanges, OnDestroy {
  private readonly screenerService = inject(ScreenerService);

  @Input() signalInput: ScreenerSignal | null = null;
  @Input() showCloseButton = false;

  @ViewChild('chartContainer', { static: true }) chartContainerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('chartWrapper', { static: true }) chartWrapperRef!: ElementRef<HTMLDivElement>;

  readonly signal = signal<ScreenerSignal | null>(null);
  readonly isFullscreen = signal<boolean>(false);
  readonly isLoadingCandles = signal<boolean>(false);
  readonly orderBlockCoords = signal<{ x: number; y: number; width: number; height: number } | null>(null);

  private chart: IChartApi | null = null;
  private candlestickSeries: ISeriesApi<'Candlestick'> | null = null;
  private lowLineSeries: ISeriesApi<'Line'> | null = null;
  private resizeObserver: ResizeObserver | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['signalInput']) {
      this.signal.set(this.signalInput);
      this.renderSignalChart();
    }
  }

  ngOnDestroy(): void {
    this.cleanupChart();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  toggleFullscreen(): void {
    this.isFullscreen.update((v) => !v);
    setTimeout(() => {
      this.resizeChart();
      this.fitChartContent();
    }, 100);
  }

  fitChartContent(): void {
    if (this.chart) {
      this.chart.timeScale().fitContent();
      this.updateOrderBlockOverlay();
    }
  }

  closeViewer(): void {
    this.screenerService.selectSignal(null);
  }

  private cleanupChart(): void {
    if (this.chart) {
      this.chart.remove();
      this.chart = null;
      this.candlestickSeries = null;
      this.lowLineSeries = null;
      this.orderBlockCoords.set(null);
    }
  }

  private renderSignalChart(): void {
    const sig = this.signal();
    if (!sig || !this.chartContainerRef?.nativeElement) {
      this.cleanupChart();
      return;
    }

    if (sig.candles && sig.candles.length > 0) {
      this.buildChartWithCandles(sig, sig.candles);
    } else {
      // Fetch 5m candles if not embedded
      this.isLoadingCandles.set(true);
      this.screenerService.getCandles(sig.symbol, '60d').subscribe({
        next: (res) => {
          this.isLoadingCandles.set(false);
          if (res && res.candles && res.candles.length > 0) {
            this.buildChartWithCandles(sig, res.candles);
          }
        },
        error: () => {
          this.isLoadingCandles.set(false);
        },
      });
    }
  }

  private buildChartWithCandles(sig: ScreenerSignal, candles: CandleData[]): void {
    this.cleanupChart();
    const container = this.chartContainerRef.nativeElement;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 480;

    // 1. Initialize Lightweight Chart instance
    this.chart = createChart(container, {
      width,
      height,
      layout: {
        background: { color: '#0B0F19' },
        textColor: '#94A3B8',
        fontFamily: "'JetBrains Mono', 'Roboto Flex', sans-serif",
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.04)' },
      },
      crosshair: {
        vertLine: {
          color: 'rgba(99, 102, 241, 0.5)',
          width: 1,
          style: LineStyle.Dashed,
        },
        horzLine: {
          color: 'rgba(99, 102, 241, 0.5)',
          width: 1,
          style: LineStyle.Dashed,
        },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: 'rgba(255, 255, 255, 0.08)',
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
      },
    });

    // 2. Add Candlestick Series
    this.candlestickSeries = this.chart.addSeries(CandlestickSeries, {
      upColor: '#10B981',
      downColor: '#F43F5E',
      borderUpColor: '#10B981',
      borderDownColor: '#F43F5E',
      wickUpColor: '#10B981',
      wickDownColor: '#F43F5E',
    });

    // Format candle timestamps strictly ascending for TradingView
    const sortedCandles = [...candles].sort((a, b) => a.time - b.time);
    const tvData = sortedCandles.map((c) => ({
      time: c.time as any,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    this.candlestickSeries.setData(tvData);

    // 3. Overlay Step A: Horizontal Line labeled 'LOW' from prior swing low to sweep
    this.lowLineSeries = this.chart.addSeries(LineSeries, {
      color: '#F59E0B',
      lineWidth: 2,
      lineStyle: LineStyle.Dotted,
      title: `LOW: ${sig.swingLow}`,
    });

    this.lowLineSeries.setData([
      { time: sig.swingLowTime as any, value: sig.swingLow },
      { time: sig.sweepTime as any, value: sig.swingLow },
    ]);

    // 4. Overlay Step B: Marker labeled 'LOW SWEEP' at the sweep wick low
    const markers: any[] = [
      {
        time: sig.sweepTime as any,
        position: 'belowBar',
        color: '#F59E0B',
        shape: 'arrowUp',
        text: `LOW SWEEP (${sig.sweepLow})`,
      },
      {
        time: sig.entryTime as any,
        position: 'aboveBar',
        color: '#00D2C4',
        shape: 'arrowDown',
        text: `ENTRY (${sig.entryPrice})`,
      },
    ];

    if (sig.exitTime) {
      markers.push({
        time: sig.exitTime as any,
        position: sig.outcome === 'WIN' ? 'aboveBar' : 'belowBar',
        color: sig.outcome === 'WIN' ? '#10B981' : sig.outcome === 'LOSS' ? '#F43F5E' : '#F59E0B',
        shape: sig.outcome === 'WIN' ? 'circle' : 'square',
        text: `${sig.outcome} (${sig.exitPrice || ''})`,
      });
    }

    try {
      createSeriesMarkers(this.candlestickSeries, markers);
    } catch {
      // Gracefully handle marker setting
    }

    // 5. Overlay Step E: Price Lines for Entry, Stop-Loss, and Target
    this.candlestickSeries.createPriceLine({
      price: sig.entryPrice,
      color: '#00D2C4',
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: `ENTRY: ${sig.entryPrice}`,
    });

    this.candlestickSeries.createPriceLine({
      price: sig.stopLoss,
      color: '#F43F5E',
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: `STOP LOSS: ${sig.stopLoss}`,
    });

    this.candlestickSeries.createPriceLine({
      price: sig.targetPrice,
      color: '#10B981',
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: `TARGET: ${sig.targetPrice} (${sig.targetRr}R)`,
    });

    // 6. Setup resize observer
    this.setupResizeObserver();

    // 7. Subscribe to timescale scroll/zoom to keep Order Block SVG updated
    this.chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      this.updateOrderBlockOverlay();
    });

    // Fit content initially and update Order Block overlay
    this.chart.timeScale().fitContent();
    setTimeout(() => {
      this.updateOrderBlockOverlay();
    }, 50);
  }

  private updateOrderBlockOverlay(): void {
    const sig = this.signal();
    if (!this.chart || !this.candlestickSeries || !sig || !sig.orderBlock) {
      this.orderBlockCoords.set(null);
      return;
    }

    try {
      const timeScale = this.chart.timeScale();
      const x1 = timeScale.timeToCoordinate(sig.orderBlock.startTime as any);
      const x2 = timeScale.timeToCoordinate((sig.orderBlock.endTime || sig.entryTime) as any);

      const y1 = this.candlestickSeries.priceToCoordinate(sig.orderBlock.top);
      const y2 = this.candlestickSeries.priceToCoordinate(sig.orderBlock.bottom);

      if (x1 !== null && x2 !== null && y1 !== null && y2 !== null) {
        const left = Math.min(x1, x2);
        const top = Math.min(y1, y2);
        const width = Math.max(12, Math.abs(x2 - x1));
        const height = Math.max(8, Math.abs(y2 - y1));

        this.orderBlockCoords.set({
          x: Math.round(left),
          y: Math.round(top),
          width: Math.round(width),
          height: Math.round(height),
        });
        return;
      }
    } catch {
      // Fallback
    }

    this.orderBlockCoords.set(null);
  }

  private setupResizeObserver(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    const container = this.chartContainerRef?.nativeElement;
    if (!container) return;

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          this.resizeChart();
        }
      }
    });

    this.resizeObserver.observe(container);
  }

  private resizeChart(): void {
    if (this.chart && this.chartContainerRef?.nativeElement) {
      const container = this.chartContainerRef.nativeElement;
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width > 0 && height > 0) {
        this.chart.applyOptions({ width, height });
        this.updateOrderBlockOverlay();
      }
    }
  }
}

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CandlestickData,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  IChartApi,
  IPriceLine,
  ISeriesApi,
  ISeriesMarkersPluginApi,
  LineStyle,
  SeriesMarker,
  Time,
  UTCTimestamp,
  createChart,
  createSeriesMarkers,
} from 'lightweight-charts';
import {
  LiquidityLevelType,
  LiquiditySweepSignal,
  ScreenerCandle,
} from '../../../../core/models/screener.models';

const IST_TIME_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const IST_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

@Component({
  selector: 'app-sweep-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sweep-chart-shell">
      <div class="chart-mini-bar">
        <div class="chart-legend">
          <span class="legend-chip level-chip" [class.pd-level]="isPriorDayLevel">
            <span class="legend-dash"></span>
            <span>{{ levelAxisLabel }}</span>
          </span>
          <span class="legend-chip sweep-chip">
            <span class="legend-dot"></span>
            <span>Sweep: {{ signal.sweepPrice | number : '1.2-2' }}</span>
          </span>
          <span
            class="legend-chip confirm-chip"
            [class.buy-chip]="signal.signalType === 'BUY'"
            [class.sell-chip]="signal.signalType === 'SELL'"
          >
            <span class="legend-arrow">{{ signal.signalType === 'BUY' ? '▲' : '▼' }}</span>
            <span>{{ signal.signalType }} Close: {{ signal.confirmationClosePrice | number : '1.2-2' }}</span>
          </span>
        </div>

        <div class="chart-controls">
          <button
            type="button"
            class="chart-ctrl-btn icon-only"
            (click)="zoomBy(0.75)"
            title="Zoom in"
            aria-label="Zoom in chart"
          >
            <span class="material-symbols-rounded">add</span>
          </button>
          <button
            type="button"
            class="chart-ctrl-btn icon-only"
            (click)="zoomBy(1.33)"
            title="Zoom out"
            aria-label="Zoom out chart"
          >
            <span class="material-symbols-rounded">remove</span>
          </button>
          <button
            type="button"
            class="chart-ctrl-btn"
            (click)="focusOnSignal()"
            title="Zoom into the liquidity sweep signal"
          >
            <span class="material-symbols-rounded">center_focus_strong</span>
            <span>Zoom Signal</span>
          </button>
          <button
            type="button"
            class="chart-ctrl-btn"
            (click)="fitFullSession()"
            title="Fit complete 09:15 – 15:30 session & reset vertical scale"
          >
            <span class="material-symbols-rounded">fit_screen</span>
            <span>Full Day</span>
          </button>
        </div>
      </div>

      <div #chartContainer class="lw-chart-container"></div>
    </div>
  `,
  styles: [
    `
      .sweep-chart-shell {
        width: 100%;
        background: #0b0f19;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        overflow: hidden;
      }

      .chart-mini-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 8px;
        padding: 8px 12px;
        background: rgba(15, 23, 42, 0.85);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      }

      .chart-legend {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.72rem;
      }

      .legend-chip {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 2px 8px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.04);
        color: #cbd5e1;
      }

      .level-chip {
        color: #00d2c4;
        background: rgba(0, 210, 196, 0.1);

        .legend-dash {
          width: 12px;
          height: 0;
          border-top: 2px dashed #00d2c4;
        }

        &.pd-level {
          color: #f59e0b;
          background: rgba(245, 158, 11, 0.12);

          .legend-dash {
            border-top-color: #f59e0b;
          }
        }
      }

      .sweep-chip {
        color: #fbbf24;
        background: rgba(245, 158, 11, 0.1);

        .legend-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #f59e0b;
        }
      }

      .confirm-chip {
        &.buy-chip {
          color: #10b981;
          background: rgba(16, 185, 129, 0.12);
        }

        &.sell-chip {
          color: #f43f5e;
          background: rgba(244, 63, 94, 0.12);
        }
      }

      .chart-controls {
        display: inline-flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
      }

      .chart-ctrl-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #94a3b8;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 0.72rem;
        font-weight: 600;
        cursor: pointer;
        min-height: 28px;
        transition: all 0.15s ease;

        &.icon-only {
          padding: 4px 6px;
          min-width: 28px;
        }

        .material-symbols-rounded {
          font-size: 16px;
        }

        &:hover {
          color: #f8fafc;
          border-color: rgba(0, 210, 196, 0.45);
          background: rgba(0, 210, 196, 0.12);
        }
      }

      .lw-chart-container {
        width: 100%;
        height: 360px;
        position: relative;
        cursor: grab;

        &:active {
          cursor: grabbing;
        }
      }

      @media (max-width: 768px) {
        .lw-chart-container {
          height: 280px;
        }

        .chart-mini-bar {
          padding: 8px 10px;
        }

        .chart-ctrl-btn {
          min-height: 34px;
          padding: 4px 8px;
        }
      }
    `,
  ],
})
export class SweepChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) signal!: LiquiditySweepSignal;

  @ViewChild('chartContainer', { static: true })
  chartContainerRef!: ElementRef<HTMLDivElement>;

  private chart: IChartApi | null = null;
  private candleSeries: ISeriesApi<'Candlestick', Time> | null = null;
  private levelPriceLine: IPriceLine | null = null;
  private markersPlugin: ISeriesMarkersPluginApi<Time> | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private normalizedCandles: ScreenerCandle[] = [];
  private isViewInitialized = false;
  private autoScaleUnlockRafId: number | null = null;

  private readonly handleWheelBound = (event: WheelEvent) => this.onWheel(event);

  get isPriorDayLevel(): boolean {
    return this.signal?.levelType === 'PDH' || this.signal?.levelType === 'PDL';
  }

  get levelAxisLabel(): string {
    if (!this.signal) return '';
    return `${this.formatLevelPrefix(this.signal.levelType)}: ${this.signal.levelPrice.toFixed(2)}`;
  }

  ngAfterViewInit(): void {
    this.isViewInitialized = true;
    this.initAndRenderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['signal'] && this.isViewInitialized) {
      this.renderSignalData();
    }
  }

  ngOnDestroy(): void {
    this.destroyChart();
  }

  /**
   * Fit the complete trading session (09:15 – 15:30 IST) across the chart
   * and reset vertical price scale, then unlock free vertical pan.
   */
  fitFullSession(): void {
    if (!this.chart || this.normalizedCandles.length === 0) {
      return;
    }

    this.chart.priceScale('right').setAutoScale(true);
    this.chart.timeScale().fitContent();
    this.scheduleVerticalPanUnlock();
  }

  /**
   * Zoom into the signal's sweep & confirmation area (±20 candles around confirmation).
   */
  focusOnSignal(): void {
    if (!this.chart || !this.signal || this.normalizedCandles.length === 0) {
      return;
    }

    const confirmIdx = this.normalizedCandles.findIndex(
      (c) => c.time === this.signal.confirmationTimestamp,
    );

    this.chart.priceScale('right').setAutoScale(true);

    if (confirmIdx < 0 || this.normalizedCandles.length <= 25) {
      this.chart.timeScale().fitContent();
    } else {
      const from = Math.max(0, confirmIdx - 20);
      const to = Math.min(this.normalizedCandles.length - 1, confirmIdx + 20);
      this.chart.timeScale().setVisibleLogicalRange({ from, to });
    }

    this.scheduleVerticalPanUnlock();
  }

  /**
   * Zoom time scale by a factor (< 1 zooms in, > 1 zooms out) around the viewport center.
   */
  zoomBy(factor: number, anchorRatio = 0.5): void {
    if (!this.chart || this.normalizedCandles.length === 0) {
      return;
    }

    const timeScale = this.chart.timeScale();
    const range = timeScale.getVisibleLogicalRange();
    if (!range) {
      return;
    }

    const currentSpan = range.to - range.from;
    const minSpan = 6;
    const maxSpan = Math.max(this.normalizedCandles.length + 12, 90);
    const nextSpan = Math.min(maxSpan, Math.max(minSpan, currentSpan * factor));

    const clampedAnchor = Math.min(1, Math.max(0, anchorRatio));
    const anchorLogical = range.from + currentSpan * clampedAnchor;
    const newFrom = anchorLogical - nextSpan * clampedAnchor;
    const newTo = newFrom + nextSpan;

    timeScale.setVisibleLogicalRange({ from: newFrom, to: newTo });
  }

  private initAndRenderChart(): void {
    const container = this.chartContainerRef?.nativeElement;
    if (!container) return;

    // Guard for jsdom/headless unit test environments without HTML5 Canvas support
    if (!this.canCreateCanvas()) {
      return;
    }

    this.destroyChart();

    const width = Math.max(container.clientWidth || 600, 260);
    const height = container.clientHeight || 360;

    this.chart = createChart(container, {
      width,
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#0B0F19' },
        textColor: '#94A3B8',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.08)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.08)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(0, 210, 196, 0.35)',
          labelBackgroundColor: '#1E293B',
        },
        horzLine: {
          color: 'rgba(0, 210, 196, 0.35)',
          labelBackgroundColor: '#1E293B',
        },
      },
      rightPriceScale: {
        visible: true,
        autoScale: true,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        scaleMargins: { top: 0.12, bottom: 0.12 },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 2,
        barSpacing: 10,
        minBarSpacing: 2,
        tickMarkFormatter: (time: Time) => this.formatTickIst(time),
      },
      localization: {
        timeFormatter: (time: Time) => this.formatCrosshairIst(time),
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: {
          time: true,
          price: true,
        },
        axisDoubleClickReset: {
          time: true,
          price: true,
        },
        mouseWheel: true,
        pinch: true,
      },
    });

    // Lightweight Charts v5 API: chart.addSeries(CandlestickSeries, options)
    this.candleSeries = this.chart.addSeries(CandlestickSeries, {
      upColor: '#10B981',
      downColor: '#F43F5E',
      borderVisible: false,
      wickUpColor: '#10B981',
      wickDownColor: '#F43F5E',
    });

    // Attach capture-phase wheel handler for responsive trackpad/mouse zoom (both X time & Y price axes)
    container.addEventListener('wheel', this.handleWheelBound, { passive: false, capture: true });

    this.renderSignalData();

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const newWidth = Math.floor(entry.contentRect.width);
          const newHeight = Math.floor(entry.contentRect.height);
          if (this.chart && newWidth > 0 && newHeight > 0) {
            this.chart.applyOptions({ width: newWidth, height: newHeight });
          }
        }
      });
      this.resizeObserver.observe(container);
    }
  }

  /**
   * Handles vertical wheel / trackpad scroll & pinch-to-zoom smoothly:
   * - Over the right price scale (or with Shift/Alt held): zooms the vertical price axis.
   * - Over the main candlestick pane: zooms the time axis smoothly around the pointer X.
   * - Horizontal scroll (|deltaX| > |deltaY|): passes through to Lightweight Charts native horizontal pan.
   */
  private onWheel(event: WheelEvent): void {
    if (!this.chart || !this.chartContainerRef?.nativeElement) {
      return;
    }

    const absX = Math.abs(event.deltaX);
    const absY = Math.abs(event.deltaY);

    // Let native horizontal scroll pass through untouched
    if (absY === 0 || (absX > absY && !event.ctrlKey)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const container = this.chartContainerRef.nativeElement;
    const rect = container.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const priceScale = this.chart.priceScale('right');
    const priceAxisWidth = Math.max(priceScale.width() || 60, 56);
    const isOverPriceAxis = localX >= rect.width - priceAxisWidth;

    // Normalize wheel delta across mouse wheels & high-resolution macOS trackpads
    const rawDelta =
      event.deltaMode === 1
        ? event.deltaY * 16
        : event.deltaMode === 2
          ? event.deltaY * 120
          : event.deltaY;
    const clampedDelta = Math.max(-120, Math.min(120, rawDelta));
    // Scroll UP (negative deltaY) -> zoom IN (factor < 1); Scroll DOWN (positive deltaY) -> zoom OUT (factor > 1)
    const zoomFactor = Math.exp(clampedDelta * 0.0025);

    if (isOverPriceAxis || event.shiftKey || event.altKey) {
      // Vertical price axis zoom
      const visiblePriceRange = priceScale.getVisibleRange();
      if (visiblePriceRange) {
        const center = (visiblePriceRange.from + visiblePriceRange.to) / 2;
        const halfSpan = ((visiblePriceRange.to - visiblePriceRange.from) / 2) * zoomFactor;
        if (halfSpan > 0.01) {
          priceScale.setAutoScale(false);
          priceScale.setVisibleRange({
            from: center - halfSpan,
            to: center + halfSpan,
          });
        }
      }
      return;
    }

    // Time axis zoom anchored at cursor X position
    const paneWidth = Math.max(1, rect.width - priceAxisWidth);
    const anchorRatio = Math.min(1, Math.max(0, localX / paneWidth));
    this.zoomBy(zoomFactor, anchorRatio);
  }

  private renderSignalData(): void {
    if (!this.chart || !this.candleSeries || !this.signal) {
      return;
    }

    // 1. Deduplicate and strictly sort candles ascending in UNIX seconds (defense-in-depth)
    const byTime = new Map<number, ScreenerCandle>();
    for (const c of this.signal.candles || []) {
      const t = Math.floor(Number(c.time));
      if (Number.isFinite(t) && t > 0 && !byTime.has(t)) {
        byTime.set(t, { ...c, time: t });
      }
    }
    this.normalizedCandles = Array.from(byTime.values()).sort((a, b) => a.time - b.time);

    const chartData: CandlestickData<Time>[] = this.normalizedCandles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    this.candleSeries.setData(chartData);

    // 2. Horizontal Liquidity Level Line via createPriceLine
    if (this.levelPriceLine) {
      this.candleSeries.removePriceLine(this.levelPriceLine);
      this.levelPriceLine = null;
    }

    const levelColor = this.isPriorDayLevel ? '#F59E0B' : '#00D2C4';
    this.levelPriceLine = this.candleSeries.createPriceLine({
      price: this.signal.levelPrice,
      color: levelColor,
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: this.levelAxisLabel,
    });

    // 3. Sweep & Confirmation Markers via v5 createSeriesMarkers
    const markers = this.buildMarkers(this.signal);
    if (this.markersPlugin) {
      this.markersPlugin.setMarkers(markers);
    } else {
      this.markersPlugin = createSeriesMarkers(this.candleSeries, markers);
    }

    // 4. Display the complete 09:15 – 15:30 session by default, then unlock vertical panning
    this.fitFullSession();
  }

  /**
   * After Lightweight Charts renders one frame with autoScale fitting all candles,
   * disable autoScale so vertical dragging inside the chart pans smoothly up & down.
   */
  private scheduleVerticalPanUnlock(attempt = 0): void {
    if (this.autoScaleUnlockRafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.autoScaleUnlockRafId);
      this.autoScaleUnlockRafId = null;
    }

    if (typeof requestAnimationFrame !== 'function') {
      return;
    }

    this.autoScaleUnlockRafId = requestAnimationFrame(() => {
      this.autoScaleUnlockRafId = null;
      if (!this.chart) return;

      const priceScale = this.chart.priceScale('right');
      const range = priceScale.getVisibleRange();
      if (range && range.to > range.from) {
        priceScale.setAutoScale(false);
      } else if (attempt < 5) {
        this.scheduleVerticalPanUnlock(attempt + 1);
      }
    });
  }

  private buildMarkers(signal: LiquiditySweepSignal): SeriesMarker<Time>[] {
    const markers: SeriesMarker<Time>[] = [];
    const isBuy = signal.signalType === 'BUY';
    const sweepTime = Math.floor(signal.sweepTimestamp) as UTCTimestamp;
    const confirmTime = Math.floor(signal.confirmationTimestamp) as UTCTimestamp;

    // Mark Sweep Candle extreme
    markers.push({
      time: sweepTime,
      position: isBuy ? 'belowBar' : 'aboveBar',
      shape: 'circle',
      color: '#F59E0B',
      text: sweepTime === confirmTime ? '' : 'SWEEP',
      size: 1,
    });

    // Mark Confirmation Candle BUY / SELL trigger
    markers.push({
      time: confirmTime,
      position: isBuy ? 'belowBar' : 'aboveBar',
      shape: isBuy ? 'arrowUp' : 'arrowDown',
      color: isBuy ? '#10B981' : '#F43F5E',
      text: isBuy ? 'BUY' : 'SELL',
      size: 2,
    });

    // lightweight-charts requires markers sorted ascending by time
    return markers.sort((a, b) => Number(a.time) - Number(b.time));
  }

  private formatLevelPrefix(levelType: LiquidityLevelType): string {
    switch (levelType) {
      case 'PDL':
        return 'PDL';
      case 'PDH':
        return 'PDH';
      case 'DAY_LOW':
        return 'Day Low';
      case 'DAY_HIGH':
        return 'Day High';
      default:
        return levelType;
    }
  }

  private formatTickIst(time: Time): string {
    if (typeof time !== 'number') return String(time);
    return IST_TIME_FORMATTER.format(new Date(time * 1000));
  }

  private formatCrosshairIst(time: Time): string {
    if (typeof time !== 'number') return String(time);
    return `${IST_DATE_TIME_FORMATTER.format(new Date(time * 1000))} IST`;
  }

  private canCreateCanvas(): boolean {
    try {
      if (typeof document === 'undefined') return false;
      const canvas = document.createElement('canvas');
      return typeof canvas.getContext === 'function' && Boolean(canvas.getContext('2d'));
    } catch {
      return false;
    }
  }

  private destroyChart(): void {
    if (this.autoScaleUnlockRafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.autoScaleUnlockRafId);
      this.autoScaleUnlockRafId = null;
    }
    if (this.chartContainerRef?.nativeElement) {
      this.chartContainerRef.nativeElement.removeEventListener('wheel', this.handleWheelBound, {
        capture: true,
      });
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.markersPlugin) {
      this.markersPlugin.setMarkers([]);
      this.markersPlugin = null;
    }
    this.levelPriceLine = null;
    this.candleSeries = null;
    if (this.chart) {
      this.chart.remove();
      this.chart = null;
    }
  }
}

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
  OrderBlockSymbolResult,
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
  selector: 'app-order-block-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ob-chart-shell">
      <div class="chart-mini-bar">
        <div class="chart-legend">
          <!-- Primary OB Status Chip -->
          <ng-container *ngIf="primaryOB as ob">
            <span
              class="legend-chip ob-chip"
              [class.demand-chip]="ob.type === 'BULLISH'"
              [class.supply-chip]="ob.type === 'BEARISH'"
            >
              <span class="legend-box-indicator"></span>
              <span>
                {{ ob.type === 'BULLISH' ? 'Demand OB' : 'Supply OB' }} ({{ ob.obType }}):
                {{ ob.zoneLow | number : '1.2-2' }} – {{ ob.zoneHigh | number : '1.2-2' }}
              </span>
            </span>

            <span class="legend-chip eq-chip">
              <span class="legend-dash"></span>
              <span>50% EQ: {{ ob.equilibrium | number : '1.2-2' }}</span>
            </span>
          </ng-container>

          <!-- Trade Setup Signal Chip if triggered -->
          <span
            *ngIf="result?.tradeSignal as sig"
            class="legend-chip signal-chip"
            [class.buy-chip]="sig.signalType === 'BUY'"
            [class.sell-chip]="sig.signalType === 'SELL'"
          >
            <span class="legend-arrow">{{ sig.signalType === 'BUY' ? '▲' : '▼' }}</span>
            <span>
              {{ sig.signalType }} (1:{{ sig.rrRatio | number : '1.1-1' }} R:R) &bull; Entry:
              {{ sig.entryPrice | number : '1.2-2' }} | SL: {{ sig.stopLoss | number : '1.2-2' }} | TP:
              {{ sig.takeProfit | number : '1.2-2' }}
            </span>
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
            (click)="focusOnLatestOB()"
            title="Zoom into the primary Order Block and structure break"
          >
            <span class="material-symbols-rounded">center_focus_strong</span>
            <span>Zoom OB</span>
          </button>
          <button
            type="button"
            class="chart-ctrl-btn"
            (click)="fitContent()"
            title="Fit complete candle range"
          >
            <span class="material-symbols-rounded">fit_screen</span>
            <span>Fit All</span>
          </button>
        </div>
      </div>

      <div #chartContainer class="lw-chart-container"></div>
    </div>
  `,
  styles: [
    `
      .ob-chart-shell {
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

      .ob-chip {
        &.demand-chip {
          color: #10b981;
          background: rgba(16, 185, 129, 0.12);

          .legend-box-indicator {
            width: 10px;
            height: 10px;
            background: rgba(16, 185, 129, 0.35);
            border: 1px solid #10b981;
            border-radius: 2px;
          }
        }

        &.supply-chip {
          color: #f43f5e;
          background: rgba(244, 63, 94, 0.12);

          .legend-box-indicator {
            width: 10px;
            height: 10px;
            background: rgba(244, 63, 94, 0.35);
            border: 1px solid #f43f5e;
            border-radius: 2px;
          }
        }
      }

      .eq-chip {
        color: #f59e0b;
        background: rgba(245, 158, 11, 0.1);

        .legend-dash {
          width: 12px;
          height: 0;
          border-top: 2px dashed #f59e0b;
        }
      }

      .signal-chip {
        &.buy-chip {
          color: #00d2c4;
          background: rgba(0, 210, 196, 0.12);
        }

        &.sell-chip {
          color: #fb7185;
          background: rgba(251, 113, 133, 0.12);
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
        height: 380px;
        position: relative;
        cursor: grab;

        &:active {
          cursor: grabbing;
        }
      }

      @media (max-width: 768px) {
        .lw-chart-container {
          height: 300px;
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
export class OrderBlockChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) result!: OrderBlockSymbolResult;

  @ViewChild('chartContainer', { static: true })
  chartContainerRef!: ElementRef<HTMLDivElement>;

  private chart: IChartApi | null = null;
  private candleSeries: ISeriesApi<'Candlestick', Time> | null = null;
  private priceLines: IPriceLine[] = [];
  private markersPlugin: ISeriesMarkersPluginApi<Time> | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private normalizedCandles: ScreenerCandle[] = [];
  private isViewInitialized = false;
  private autoScaleUnlockRafId: number | null = null;

  private readonly handleWheelBound = (event: WheelEvent) => this.onWheel(event);

  get primaryOB() {
    return this.result?.activeOrderBlocks?.[0] || this.result?.allOrderBlocks?.[0] || null;
  }

  ngAfterViewInit(): void {
    this.isViewInitialized = true;
    this.initAndRenderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['result'] && this.isViewInitialized) {
      this.renderChartData();
    }
  }

  ngOnDestroy(): void {
    this.destroyChart();
  }

  fitContent(): void {
    if (!this.chart || this.normalizedCandles.length === 0) return;
    this.chart.priceScale('right').setAutoScale(true);
    this.chart.timeScale().fitContent();
    this.scheduleVerticalPanUnlock();
  }

  focusOnLatestOB(): void {
    if (!this.chart || !this.primaryOB || this.normalizedCandles.length === 0) return;

    const obTime = this.primaryOB.createdAt;
    const obIdx = this.normalizedCandles.findIndex((c) => c.time === obTime);

    this.chart.priceScale('right').setAutoScale(true);

    if (obIdx < 0 || this.normalizedCandles.length <= 25) {
      this.chart.timeScale().fitContent();
    } else {
      const from = Math.max(0, obIdx - 10);
      const to = Math.min(this.normalizedCandles.length - 1, obIdx + 20);
      this.chart.timeScale().setVisibleLogicalRange({ from, to });
    }

    this.scheduleVerticalPanUnlock();
  }

  zoomBy(factor: number, anchorRatio = 0.5): void {
    if (!this.chart || this.normalizedCandles.length === 0) return;

    const timeScale = this.chart.timeScale();
    const range = timeScale.getVisibleLogicalRange();
    if (!range) return;

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
    if (!container || !this.canCreateCanvas()) return;

    this.destroyChart();

    const width = Math.max(container.clientWidth || 600, 260);
    const height = container.clientHeight || 380;

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
        rightOffset: 3,
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
        axisPressedMouseMove: { time: true, price: true },
        axisDoubleClickReset: { time: true, price: true },
        mouseWheel: true,
        pinch: true,
      },
    });

    this.candleSeries = this.chart.addSeries(CandlestickSeries, {
      upColor: '#10B981',
      downColor: '#F43F5E',
      borderVisible: false,
      wickUpColor: '#10B981',
      wickDownColor: '#F43F5E',
    });

    container.addEventListener('wheel', this.handleWheelBound, { passive: false, capture: true });

    this.renderChartData();

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

  private onWheel(event: WheelEvent): void {
    if (!this.chart || !this.chartContainerRef?.nativeElement) return;

    const absX = Math.abs(event.deltaX);
    const absY = Math.abs(event.deltaY);

    if (absY === 0 || (absX > absY && !event.ctrlKey)) return;

    event.preventDefault();
    event.stopPropagation();

    const container = this.chartContainerRef.nativeElement;
    const rect = container.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const priceScale = this.chart.priceScale('right');
    const priceAxisWidth = Math.max(priceScale.width() || 60, 56);
    const isOverPriceAxis = localX >= rect.width - priceAxisWidth;

    const rawDelta =
      event.deltaMode === 1
        ? event.deltaY * 16
        : event.deltaMode === 2
          ? event.deltaY * 120
          : event.deltaY;
    const clampedDelta = Math.max(-120, Math.min(120, rawDelta));
    const zoomFactor = Math.exp(clampedDelta * 0.0025);

    if (isOverPriceAxis || event.shiftKey || event.altKey) {
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

    const paneWidth = Math.max(1, rect.width - priceAxisWidth);
    const anchorRatio = Math.min(1, Math.max(0, localX / paneWidth));
    this.zoomBy(zoomFactor, anchorRatio);
  }

  private renderChartData(): void {
    if (!this.chart || !this.candleSeries || !this.result) return;

    // 1. Normalize and set candles
    const byTime = new Map<number, ScreenerCandle>();
    for (const c of this.result.candles || []) {
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

    // 2. Clear old price lines
    for (const pl of this.priceLines) {
      this.candleSeries.removePriceLine(pl);
    }
    this.priceLines = [];

    // 3. Render Order Block Lines (Zone High, Zone Low, and 50% Equilibrium)
    const overlay = this.result.chartOverlay;
    if (overlay) {
      for (const ob of overlay.orderBlocks || []) {
        const isDemand = ob.type === 'BULLISH';
        const lineColor = isDemand ? '#10B981' : '#F43F5E';

        // Zone High (Proximal / Distal)
        this.priceLines.push(
          this.candleSeries.createPriceLine({
            price: ob.zoneHigh,
            color: lineColor,
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: true,
            title: `${ob.type === 'BULLISH' ? 'Demand' : 'Supply'} (${ob.obType}) High: ${ob.zoneHigh.toFixed(2)}`,
          }),
        );

        // Zone Low
        this.priceLines.push(
          this.candleSeries.createPriceLine({
            price: ob.zoneLow,
            color: lineColor,
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: true,
            title: `${ob.type === 'BULLISH' ? 'Demand' : 'Supply'} Low: ${ob.zoneLow.toFixed(2)}`,
          }),
        );

        // 50% Equilibrium
        this.priceLines.push(
          this.candleSeries.createPriceLine({
            price: ob.equilibrium,
            color: '#F59E0B',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `50% EQ: ${ob.equilibrium.toFixed(2)}`,
          }),
        );
      }

      // 4. Render Structure Breaks (BoS / CHoCH lines)
      for (const brk of overlay.breaks || []) {
        this.priceLines.push(
          this.candleSeries.createPriceLine({
            price: brk.price,
            color: brk.direction === 'BULLISH' ? 'rgba(16, 185, 129, 0.7)' : 'rgba(244, 63, 94, 0.7)',
            lineWidth: 1,
            lineStyle: LineStyle.LargeDashed,
            axisLabelVisible: true,
            title: brk.label,
          }),
        );
      }

      // 5. Render Trade Signal levels if active
      if (overlay.tradeSignal) {
        const sig = overlay.tradeSignal;
        // Entry
        this.priceLines.push(
          this.candleSeries.createPriceLine({
            price: sig.entryPrice,
            color: '#00D2C4',
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: true,
            title: `ENTRY: ${sig.entryPrice.toFixed(2)}`,
          }),
        );

        // Stop Loss
        this.priceLines.push(
          this.candleSeries.createPriceLine({
            price: sig.stopLoss,
            color: '#F43F5E',
            lineWidth: 2,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `SL: ${sig.stopLoss.toFixed(2)}`,
          }),
        );

        // Take Profit
        this.priceLines.push(
          this.candleSeries.createPriceLine({
            price: sig.takeProfit,
            color: '#10B981',
            lineWidth: 2,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: `TP (1:${sig.rrRatio} R:R): ${sig.takeProfit.toFixed(2)}`,
          }),
        );
      }
    }

    // 6. Build and set Markers
    const markers = this.buildMarkers();
    if (this.markersPlugin) {
      this.markersPlugin.setMarkers(markers);
    } else {
      this.markersPlugin = createSeriesMarkers(this.candleSeries, markers);
    }

    this.fitContent();
  }

  private buildMarkers(): SeriesMarker<Time>[] {
    const markers: SeriesMarker<Time>[] = [];

    // Mark Structure Breaks
    for (const brk of this.result.structureBreaks || []) {
      const time = Math.floor(brk.breakCandleTime) as UTCTimestamp;
      const isBull = brk.direction === 'BULLISH';
      markers.push({
        time,
        position: isBull ? 'belowBar' : 'aboveBar',
        shape: isBull ? 'arrowUp' : 'arrowDown',
        color: isBull ? '#10B981' : '#F43F5E',
        text: brk.type,
        size: 1,
      });
    }

    // Mark Trade Signal Entry Trigger
    if (this.result.tradeSignal) {
      const sig = this.result.tradeSignal;
      const time = Math.floor(sig.triggerTimestamp) as UTCTimestamp;
      const isBuy = sig.signalType === 'BUY';
      markers.push({
        time,
        position: isBuy ? 'belowBar' : 'aboveBar',
        shape: isBuy ? 'arrowUp' : 'arrowDown',
        color: isBuy ? '#00D2C4' : '#FB7185',
        text: `SNIPER ${sig.signalType}`,
        size: 2,
      });
    }

    return markers.sort((a, b) => Number(a.time) - Number(b.time));
  }

  private scheduleVerticalPanUnlock(attempt = 0): void {
    if (this.autoScaleUnlockRafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.autoScaleUnlockRafId);
      this.autoScaleUnlockRafId = null;
    }

    if (typeof requestAnimationFrame !== 'function') return;

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
    this.priceLines = [];
    this.candleSeries = null;
    if (this.chart) {
      this.chart.remove();
      this.chart = null;
    }
  }
}

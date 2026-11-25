import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  CandlestickSeries,
  IChartApi,
  IPriceLine,
  ISeriesApi,
  LineStyle,
  createChart,
  createSeriesMarkers,
} from 'lightweight-charts';
import { HistoricalDataService } from '../../../../core/api/historical-data.service';
import { HistoricalCandle } from '../../../../core/models/historical-data.models';
import { HistoricalTradeItem } from '../../../../core/models/trade.models';
import { CurrencyInrPipe } from '../../../../shared/pipes/currency-inr.pipe';
import { IstDatePipe } from '../../../../shared/pipes/ist-date.pipe';

export interface ResolvedTradeTiming {
  entryEpoch: number;
  exitEpoch: number | null;
  entrySide: 'BUY' | 'SELL';
  exitSide: 'BUY' | 'SELL' | null;
  entryOptionPrice: number | null;
  exitOptionPrice: number | null;
  entryRawTime: string;
  exitRawTime: string | null;
  startDateIst: string; // YYYY-MM-DD
  endDateIst: string; // YYYY-MM-DD
}

const IST_OFFSET_SEC = 19800;

export function parseIstTimeToEpoch(rawTime?: string | null): number | null {
  if (!rawTime || typeof rawTime !== 'string') return null;
  const trimmed = rawTime.trim();
  if (!trimmed) return null;

  const normalized = trimmed.includes(' ') && !trimmed.includes('T')
    ? trimmed.replace(' ', 'T')
    : trimmed;

  // If timestamp already carries explicit timezone info (Z or +HH:MM / -HH:MM)
  if (/(Z|[+-]\d{2}:?\d{2})$/i.test(normalized)) {
    const ms = Date.parse(normalized);
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
  }

  // Date-only fallback -> 09:15 IST
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const ms = Date.parse(`${normalized}T09:15:00+05:30`);
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
  }

  // Wall-clock IST without offset (e.g. 2026-05-10T10:15:00)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(normalized)) {
    const ms = Date.parse(`${normalized}+05:30`);
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
  }

  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

export function epochToIstDate(epochSeconds: number): string {
  return new Date((epochSeconds + IST_OFFSET_SEC) * 1000).toISOString().slice(0, 10);
}

export function epochToIstTimeLabel(epochSeconds: number): string {
  return new Date((epochSeconds + IST_OFFSET_SEC) * 1000).toISOString().slice(11, 16);
}

export function resolveTradeEntryExit(trade: HistoricalTradeItem): ResolvedTradeTiming | null {
  const buyEpoch = parseIstTimeToEpoch(trade.buyTime);
  const sellEpoch = parseIstTimeToEpoch(trade.sellTime);
  const fallbackEpoch = parseIstTimeToEpoch(trade.executionTime || trade.tradeDate);

  if (buyEpoch !== null && sellEpoch !== null) {
    const isBuyFirst = buyEpoch <= sellEpoch;
    const entryEpoch = isBuyFirst ? buyEpoch : sellEpoch;
    const exitEpoch = isBuyFirst ? sellEpoch : buyEpoch;
    return {
      entryEpoch,
      exitEpoch,
      entrySide: isBuyFirst ? 'BUY' : 'SELL',
      exitSide: isBuyFirst ? 'SELL' : 'BUY',
      entryOptionPrice: isBuyFirst ? trade.buyPrice : trade.sellPrice,
      exitOptionPrice: isBuyFirst ? trade.sellPrice : trade.buyPrice,
      entryRawTime: (isBuyFirst ? trade.buyTime : trade.sellTime) || trade.executionTime,
      exitRawTime: (isBuyFirst ? trade.sellTime : trade.buyTime) || null,
      startDateIst: epochToIstDate(entryEpoch),
      endDateIst: epochToIstDate(exitEpoch),
    };
  }

  const entryEpoch = buyEpoch ?? sellEpoch ?? fallbackEpoch;
  if (entryEpoch === null) return null;

  const isBuyOnly = buyEpoch !== null || trade.status === 'OPEN_BUY';
  return {
    entryEpoch,
    exitEpoch: null,
    entrySide: isBuyOnly ? 'BUY' : 'SELL',
    exitSide: null,
    entryOptionPrice: isBuyOnly ? trade.buyPrice : trade.sellPrice,
    exitOptionPrice: null,
    entryRawTime: (isBuyOnly ? trade.buyTime : trade.sellTime) || trade.executionTime,
    exitRawTime: null,
    startDateIst: epochToIstDate(entryEpoch),
    endDateIst: epochToIstDate(entryEpoch),
  };
}

export function findMatchingFiveMinCandle(
  candles: HistoricalCandle[],
  targetEpoch: number,
): HistoricalCandle | null {
  if (!candles || candles.length === 0) return null;
  const bucketEpoch = Math.floor(targetEpoch / 300) * 300;
  const exact = candles.find((c) => c.epoch === bucketEpoch);
  if (exact) return exact;

  // Fallback to closest candle within 10 minutes
  let closest: HistoricalCandle | null = null;
  let minDiff = Infinity;
  for (const c of candles) {
    const diff = Math.abs(c.epoch - bucketEpoch);
    if (diff < minDiff) {
      minDiff = diff;
      closest = c;
    }
  }
  return minDiff <= 600 ? closest : null;
}

export interface ResolvedChartTradePlot {
  index: number;
  trade: HistoricalTradeItem;
  timing: ResolvedTradeTiming;
  entryIndexLevel: number | null;
  exitIndexLevel: number | null;
  indexMovePoints: number | null;
}

export function buildTradeMarkersAndPlots(
  trades: HistoricalTradeItem[],
  sortedCandles: HistoricalCandle[],
  detailedSingle = false,
): { plots: ResolvedChartTradePlot[]; markers: any[] } {
  const withTiming = trades
    .map((trade) => ({ trade, timing: resolveTradeEntryExit(trade) }))
    .filter((item): item is { trade: HistoricalTradeItem; timing: ResolvedTradeTiming } => item.timing !== null)
    .sort((a, b) => a.timing.entryEpoch - b.timing.entryEpoch);

  const plots: ResolvedChartTradePlot[] = [];
  const markers: any[] = [];

  withTiming.forEach(({ trade, timing }, idx) => {
    const entryCandle = findMatchingFiveMinCandle(sortedCandles, timing.entryEpoch);
    const exitCandle =
      timing.exitEpoch !== null ? findMatchingFiveMinCandle(sortedCandles, timing.exitEpoch) : null;

    const entryLevel = entryCandle ? Number(entryCandle.close.toFixed(2)) : null;
    const exitLevel = exitCandle ? Number(exitCandle.close.toFixed(2)) : null;
    const indexMovePoints =
      entryLevel !== null && exitLevel !== null ? Number((exitLevel - entryLevel).toFixed(2)) : null;

    plots.push({
      index: idx,
      trade,
      timing,
      entryIndexLevel: entryLevel,
      exitIndexLevel: exitLevel,
      indexMovePoints,
    });

    const tradeTag = `#${idx + 1}`;
    const isProfit = (trade.pnl ?? 0) >= 0;
    const exitColor = isProfit ? '#10B981' : '#F43F5E';

    if (entryCandle && entryLevel !== null) {
      const optText =
        timing.entryOptionPrice !== null ? ` · Opt ₹${timing.entryOptionPrice.toFixed(2)}` : '';
      const shortOpt =
        timing.entryOptionPrice !== null ? ` ₹${timing.entryOptionPrice.toFixed(0)}` : '';
      markers.push({
        time: entryCandle.epoch as any,
        position: 'belowBar',
        color: timing.entrySide === 'BUY' ? '#00D2C4' : '#F59E0B',
        shape: 'arrowUp',
        text: detailedSingle
          ? `ENTRY @ ${entryLevel}${optText} (${epochToIstTimeLabel(timing.entryEpoch)})`
          : `${tradeTag} ${timing.entrySide === 'BUY' ? 'IN' : 'SELL'}${shortOpt} (${epochToIstTimeLabel(timing.entryEpoch)})`,
      });
    }

    if (exitCandle && exitLevel !== null && timing.exitEpoch !== null) {
      const pnlText =
        trade.pnl !== null && trade.pnl !== undefined
          ? ` · ${trade.pnl >= 0 ? '+' : ''}₹${trade.pnl.toFixed(0)}`
          : '';
      const shortPnl =
        trade.pnl !== null && trade.pnl !== undefined
          ? ` ${trade.pnl >= 0 ? '+' : ''}₹${trade.pnl.toFixed(0)}`
          : '';
      markers.push({
        time: exitCandle.epoch as any,
        position: 'aboveBar',
        color: exitColor,
        shape: 'arrowDown',
        text: detailedSingle
          ? `EXIT @ ${exitLevel}${pnlText} (${epochToIstTimeLabel(timing.exitEpoch)})`
          : `${tradeTag} OUT${shortPnl}`,
      });
    }
  });

  markers.sort((a, b) => Number(a.time) - Number(b.time));
  return { plots, markers };
}

@Component({
  selector: 'app-trade-index-chart',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    CurrencyInrPipe,
    IstDatePipe,
  ],
  template: `
    <div
      class="chart-modal-backdrop"
      [class.fullscreen-backdrop]="isFullscreen()"
      (click)="onBackdropClick($event)"
    >
      <div
        class="chart-modal-dialog"
        [class.fullscreen]="isFullscreen()"
        (click)="$event.stopPropagation()"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="indexDisplayName() + ' Index Trade Chart'"
      >
        <!-- HEADER -->
        <div class="viewer-header">
          <div class="header-left">
            <div class="symbol-badge">
              <span class="symbol-name">{{ indexDisplayName() }}</span>
              <span class="timeframe-tag">
                {{
                  isAllTradesMode()
                    ? '5m · All Trades (' + (loadedMonthsLabel() || '--') + ')'
                    : '5m · Full Month (' + (loadedMonthsLabel() || '--') + ')'
                }}
              </span>
              <span class="bars-count-pill" *ngIf="loadedCandleCount() > 0">{{ loadedCandleCount() | number }} bars</span>
              <span class="contract-pill" *ngIf="!isAllTradesMode() && trade() as t">{{ t.customSymbol || t.symbol }}</span>
              <span class="contract-pill" *ngIf="isAllTradesMode() && activePlot() as ap">
                #{{ ap.index + 1 }} · {{ ap.trade.customSymbol || ap.trade.symbol }}
              </span>
            </div>

            <!-- Single-trade metrics -->
            <div *ngIf="!isAllTradesMode() && trade() as t" class="trade-metrics-row">
              <span
                class="pnl-chip"
                [class.profit]="(t.pnl || 0) > 0"
                [class.loss]="(t.pnl || 0) < 0"
                *ngIf="t.pnl !== null && t.pnl !== undefined"
              >
                <span class="mono-val">P&amp;L: {{ t.pnl | currencyInr : true }}</span>
              </span>

              <span
                class="index-move-chip"
                *ngIf="indexMovePoints() !== null"
                [class.positive]="(indexMovePoints() || 0) > 0"
                [class.negative]="(indexMovePoints() || 0) < 0"
              >
                <span class="mono-val">
                  Index Move: {{ (indexMovePoints() || 0) > 0 ? '+' : '' }}{{ indexMovePoints() | number : '1.2-2' }} pts
                </span>
              </span>

              <span class="meta-item" *ngIf="t.quantity">
                <span class="meta-label">Qty:</span>
                <span class="meta-val mono-val">{{ t.quantity }}</span>
              </span>

              <span class="meta-item" *ngIf="t.holdingDuration">
                <span class="meta-label">Held:</span>
                <span class="meta-val mono-val">{{ t.holdingDuration }}</span>
              </span>
            </div>

            <!-- All-trades aggregate metrics -->
            <div *ngIf="isAllTradesMode()" class="trade-metrics-row">
              <span class="meta-item">
                <span class="meta-label">Trades:</span>
                <span class="meta-val mono-val">{{ aggregateSummary().totalTrades }}</span>
              </span>

              <span
                class="pnl-chip"
                [class.profit]="aggregateSummary().totalPnl > 0"
                [class.loss]="aggregateSummary().totalPnl < 0"
              >
                <span class="mono-val">Total P&amp;L: {{ aggregateSummary().totalPnl | currencyInr : true }}</span>
              </span>

              <span class="meta-item">
                <span class="meta-label">W/L:</span>
                <span class="meta-val mono-val">
                  <span class="win-count">{{ aggregateSummary().wins }}W</span>
                  /
                  <span class="loss-count">{{ aggregateSummary().losses }}L</span>
                </span>
              </span>

              <span
                class="index-move-chip"
                *ngIf="activePlot() as ap"
                [class.positive]="(ap.indexMovePoints || 0) > 0"
                [class.negative]="(ap.indexMovePoints || 0) < 0"
              >
                <span class="mono-val" *ngIf="ap.indexMovePoints !== null">
                  #{{ ap.index + 1 }} Move: {{ ap.indexMovePoints > 0 ? '+' : '' }}{{ ap.indexMovePoints | number : '1.2-2' }} pts
                </span>
              </span>
            </div>
          </div>

          <div class="header-actions">
            <div class="mode-switch-group" *ngIf="canToggleAllTrades()">
              <button
                *ngIf="trade()"
                type="button"
                class="view-mode-btn"
                [class.active]="!isAllTradesMode()"
                (click)="switchChartMode('single')"
                matTooltip="View only this trade on the chart"
              >
                <span>This Trade</span>
              </button>
              <button
                type="button"
                class="view-mode-btn"
                [class.active]="isAllTradesMode()"
                (click)="switchChartMode('all')"
                matTooltip="Show entry and exit markings for all trades of this index"
              >
                <span>All Trades ({{ instrumentTrades().length }})</span>
              </button>
            </div>

            <ng-container *ngIf="isAllTradesMode() && plottedTrades().length > 0">
              <button
                mat-icon-button
                class="action-btn"
                (click)="stepFocusedTrade(-1)"
                matTooltip="Previous trade"
              >
                <span class="material-symbols-rounded">chevron_left</span>
              </button>
              <button
                mat-icon-button
                class="action-btn"
                (click)="stepFocusedTrade(1)"
                matTooltip="Next trade"
              >
                <span class="material-symbols-rounded">chevron_right</span>
              </button>
            </ng-container>

            <button
              type="button"
              class="view-mode-btn"
              [class.active]="activeViewMode() === 'month'"
              (click)="fitChartContent()"
              [matTooltip]="isAllTradesMode() ? 'Show all candles across loaded trades' : 'Show entire month candles'"
            >
              <span class="material-symbols-rounded">calendar_view_month</span>
              <span>{{ isAllTradesMode() ? 'All Range' : 'Full Month' }}</span>
            </button>
            <button
              type="button"
              class="view-mode-btn"
              [class.active]="activeViewMode() === 'trade'"
              (click)="focusTradeRange()"
              matTooltip="Zoom in on selected trade day & entry/exit bars"
              *ngIf="!isAllTradesMode() || activePlot()"
            >
              <span class="material-symbols-rounded">center_focus_strong</span>
              <span>Focus Trade</span>
            </button>
            <button
              type="button"
              class="view-mode-btn"
              [class.active]="isAutoScale()"
              (click)="toggleAutoScale()"
              matTooltip="Toggle auto-fit price scale (double-click price axis to reset)"
            >
              <span class="material-symbols-rounded">fit_screen</span>
              <span>Auto</span>
            </button>
            <button
              mat-icon-button
              class="action-btn"
              (click)="zoomIn()"
              matTooltip="Zoom in (Scroll up)"
            >
              <span class="material-symbols-rounded">zoom_in</span>
            </button>
            <button
              mat-icon-button
              class="action-btn"
              (click)="zoomOut()"
              matTooltip="Zoom out (Scroll down)"
            >
              <span class="material-symbols-rounded">zoom_out</span>
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
              mat-icon-button
              class="action-btn close-btn"
              (click)="closeModal()"
              matTooltip="Close (Esc)"
            >
              <span class="material-symbols-rounded">close</span>
            </button>
          </div>
        </div>

        <!-- ALL TRADES SELECTOR STRIP -->
        <div class="all-trades-strip" *ngIf="isAllTradesMode() && plottedTrades().length > 0">
          <button
            type="button"
            class="trade-strip-chip clear-focus-chip"
            [class.active]="focusedTradeIndex() === null"
            (click)="fitChartContent()"
          >
            <span>All ({{ plottedTrades().length }})</span>
          </button>
          <button
            *ngFor="let plot of plottedTrades()"
            type="button"
            class="trade-strip-chip"
            [class.active]="focusedTradeIndex() === plot.index"
            [class.profit]="(plot.trade.pnl || 0) >= 0"
            [class.loss]="(plot.trade.pnl || 0) < 0"
            (click)="focusTradeByIndex(plot.index)"
            [matTooltip]="(plot.trade.customSymbol || plot.trade.symbol) + ' · Click to focus on this trade'"
          >
            <span class="strip-dot"></span>
            <span class="mono-val">#{{ plot.index + 1 }}</span>
            <span>{{ plot.timing.entryRawTime | istDate : 'full' : false }}</span>
            <span class="strip-pnl mono-val" *ngIf="plot.trade.pnl !== null && plot.trade.pnl !== undefined">
              {{ plot.trade.pnl | currencyInr : true }}
            </span>
          </button>
        </div>

        <!-- ENTRY / EXIT LEGEND BAR -->
        <div class="chart-legend-bar" *ngIf="activeLegendTiming() as tm">
          <div class="legend-chip entry-chip">
            <span class="legend-color-dot entry-dot"></span>
            <span>
              ENTRY ({{ tm.entrySide }}):
              <strong>{{ activeLegendEntryLevel() !== null ? (activeLegendEntryLevel() | number : '1.2-2') : '--' }}</strong>
              <span *ngIf="tm.entryOptionPrice !== null"> · Opt {{ tm.entryOptionPrice | currencyInr : false }}</span>
              · {{ tm.entryRawTime | istDate : 'timeOnly' : false }}
            </span>
          </div>

          <div class="legend-chip exit-chip" *ngIf="tm.exitEpoch !== null">
            <span
              class="legend-color-dot"
              [class.profit-dot]="(activeLegendTrade()?.pnl || 0) >= 0"
              [class.loss-dot]="(activeLegendTrade()?.pnl || 0) < 0"
            ></span>
            <span>
              EXIT ({{ tm.exitSide }}):
              <strong>{{ activeLegendExitLevel() !== null ? (activeLegendExitLevel() | number : '1.2-2') : '--' }}</strong>
              <span *ngIf="tm.exitOptionPrice !== null"> · Opt {{ tm.exitOptionPrice | currencyInr : false }}</span>
              <span *ngIf="tm.exitRawTime"> · {{ tm.exitRawTime | istDate : 'timeOnly' : false }}</span>
            </span>
          </div>

          <div class="legend-chip open-chip" *ngIf="tm.exitEpoch === null">
            <span class="legend-color-dot open-dot"></span>
            <span>OPEN POSITION (No Exit Recorded)</span>
          </div>
        </div>

        <!-- CHART BODY -->
        <div class="chart-canvas-wrapper">
          <div class="chart-container" #chartContainer></div>

          <!-- Loading Overlay -->
          <div *ngIf="isLoading()" class="chart-overlay">
            <div class="spinner"></div>
            <span>Loading {{ indexDisplayName() }} 5m candles from Firestore...</span>
          </div>

          <!-- Error / Missing Data Overlay -->
          <div *ngIf="!isLoading() && errorMessage()" class="chart-overlay error-overlay">
            <span class="material-symbols-rounded empty-icon">candlestick_chart</span>
            <div class="error-title">{{ errorMessage() }}</div>
            <div class="error-hint">
              Run <strong>Sync Latest 5m Data</strong> in
              <a routerLink="/settings" class="settings-link" (click)="closeModal()">Settings</a>
              to update {{ indexDisplayName() }} historical candles in Firestore.
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .chart-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1200;
        background: rgba(5, 8, 16, 0.8);
        backdrop-filter: blur(6px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        overflow-y: auto;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
      }

      .chart-modal-backdrop.fullscreen-backdrop {
        padding: 0;
        overflow: hidden;
      }

      .chart-modal-dialog {
        width: 100%;
        max-width: min(96vw, 1520px);
        height: 92vh;
        height: 92dvh;
        margin: auto;
        background: #0f172a;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 14px;
        overflow: hidden;
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.65);
        display: flex;
        flex-direction: column;
      }

      .chart-modal-dialog.fullscreen {
        max-width: 100%;
        width: 100%;
        height: 100vh;
        height: 100dvh;
        border-radius: 0;
        border: none;
      }

      .viewer-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 18px;
        background: rgba(15, 23, 42, 0.95);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        flex-wrap: wrap;
      }

      .header-left {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .symbol-badge {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .symbol-name {
        font-size: 1rem;
        font-weight: 800;
        color: #f8fafc;
        letter-spacing: 0.02em;
      }

      .timeframe-tag {
        font-size: 0.72rem;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 4px;
        background: rgba(0, 210, 196, 0.15);
        color: #00d2c4;
        border: 1px solid rgba(0, 210, 196, 0.35);
      }

      .contract-pill {
        font-size: 0.78rem;
        font-weight: 600;
        padding: 2px 10px;
        border-radius: 999px;
        background: rgba(99, 102, 241, 0.16);
        color: #c7d2fe;
        border: 1px solid rgba(99, 102, 241, 0.35);
      }

      .bars-count-pill {
        font-size: 0.72rem;
        font-weight: 600;
        font-family: 'JetBrains Mono', monospace;
        padding: 2px 8px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.06);
        color: #cbd5e1;
      }

      .view-mode-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 5px 10px;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #cbd5e1;
        font-size: 0.74rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .view-mode-btn .material-symbols-rounded {
        font-size: 15px;
      }

      .view-mode-btn:hover {
        background: rgba(0, 210, 196, 0.14);
        border-color: rgba(0, 210, 196, 0.4);
        color: #ffffff;
      }

      .view-mode-btn.active {
        background: rgba(0, 210, 196, 0.18);
        border-color: #00d2c4;
        color: #00d2c4;
      }

      .trade-metrics-row {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      .pnl-chip,
      .index-move-chip {
        font-size: 0.78rem;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.06);
        color: #e2e8f0;
      }

      .pnl-chip.profit,
      .index-move-chip.positive {
        color: #10b981;
        background: rgba(16, 185, 129, 0.14);
      }

      .pnl-chip.loss,
      .index-move-chip.negative {
        color: #f43f5e;
        background: rgba(244, 63, 94, 0.14);
      }

      .meta-item {
        font-size: 0.75rem;
        color: #94a3b8;
        display: flex;
        gap: 4px;
      }

      .meta-val {
        color: #f8fafc;
        font-weight: 600;
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .action-btn {
        color: #94a3b8;
        width: 34px;
        height: 34px;
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
        gap: 16px;
        padding: 8px 18px;
        background: rgba(11, 15, 25, 0.7);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        overflow-x: auto;
        white-space: nowrap;
        font-size: 0.75rem;
      }

      .legend-chip {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        color: #cbd5e1;
        font-family: 'JetBrains Mono', monospace;
      }

      .legend-color-dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
      }

      .entry-dot {
        background: #00d2c4;
      }

      .profit-dot {
        background: #10b981;
      }

      .loss-dot {
        background: #f43f5e;
      }

      .open-dot {
        background: #f59e0b;
      }

      .mode-switch-group {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding-right: 6px;
        margin-right: 4px;
        border-right: 1px solid rgba(255, 255, 255, 0.12);
      }

      .win-count {
        color: #10b981;
      }

      .loss-count {
        color: #f43f5e;
      }

      .all-trades-strip {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 18px;
        background: rgba(11, 15, 25, 0.85);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        overflow-x: auto;
        white-space: nowrap;
      }

      .trade-strip-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #cbd5e1;
        font-size: 0.72rem;
        font-weight: 600;
        cursor: pointer;
        flex-shrink: 0;
        transition: all 0.15s ease;
      }

      .trade-strip-chip:hover {
        background: rgba(0, 210, 196, 0.12);
        border-color: rgba(0, 210, 196, 0.4);
        color: #ffffff;
      }

      .trade-strip-chip.active {
        background: rgba(0, 210, 196, 0.18);
        border-color: #00d2c4;
        color: #ffffff;
      }

      .trade-strip-chip .strip-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #94a3b8;
      }

      .trade-strip-chip.profit .strip-dot {
        background: #10b981;
      }

      .trade-strip-chip.loss .strip-dot {
        background: #f43f5e;
      }

      .trade-strip-chip.profit .strip-pnl {
        color: #10b981;
      }

      .trade-strip-chip.loss .strip-pnl {
        color: #f43f5e;
      }

      .chart-canvas-wrapper {
        position: relative;
        width: 100%;
        flex: 1;
        min-height: 360px;
        background: #0b0f19;
      }

      .chart-modal-dialog.fullscreen .chart-canvas-wrapper {
        flex: 1;
        height: auto;
        min-height: 0;
      }

      .chart-container {
        width: 100%;
        height: 100%;
        touch-action: none;
      }

      .chart-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 24px;
        text-align: center;
        background: rgba(11, 15, 25, 0.88);
        color: #94a3b8;
        font-size: 0.9rem;
        z-index: 10;
      }

      .empty-icon {
        font-size: 46px;
        color: rgba(255, 255, 255, 0.25);
      }

      .error-title {
        font-size: 1rem;
        font-weight: 700;
        color: #f8fafc;
      }

      .error-hint {
        font-size: 0.82rem;
        color: #94a3b8;
        max-width: 460px;
        line-height: 1.5;
      }

      .settings-link {
        color: #00d2c4;
        font-weight: 700;
        text-decoration: underline;
      }

      .spinner {
        width: 32px;
        height: 32px;
        border: 3px solid rgba(0, 210, 196, 0.2);
        border-top-color: #00d2c4;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .mono-val {
        font-family: 'JetBrains Mono', monospace;
      }

      @media (max-width: 768px) {
        .chart-modal-backdrop {
          padding: 8px;
        }
        .chart-modal-dialog {
          height: 96dvh;
        }
        .chart-canvas-wrapper {
          min-height: 320px;
        }
      }
    `,
  ],
})
export class TradeIndexChartComponent implements OnChanges, OnDestroy {
  private readonly historicalDataService = inject(HistoricalDataService);

  @Input() tradeInput: HistoricalTradeItem | null = null;
  @Input() instrumentTradesInput: HistoricalTradeItem[] = [];
  @Input() chartModeInput: 'single' | 'all' = 'single';
  @Input() instrumentKeyInput: 'NIFTY50' | 'BANKNIFTY' | null = null;
  @Output() close = new EventEmitter<void>();

  @ViewChild('chartContainer', { static: true }) chartContainerRef!: ElementRef<HTMLDivElement>;

  readonly trade = signal<HistoricalTradeItem | null>(null);
  readonly instrumentTrades = signal<HistoricalTradeItem[]>([]);
  readonly chartMode = signal<'single' | 'all'>('single');
  readonly instrumentKeyOverride = signal<'NIFTY50' | 'BANKNIFTY' | null>(null);
  readonly isAllTradesMode = computed<boolean>(() => this.chartMode() === 'all');
  readonly canToggleAllTrades = computed<boolean>(() => this.instrumentTrades().length > 1);
  readonly isBankNifty = computed<boolean>(() => {
    const override = this.instrumentKeyOverride();
    if (override) return override === 'BANKNIFTY';
    const sample = this.trade() || this.instrumentTrades()[0] || null;
    if (!sample) return false;
    const text = `${sample.customSymbol || ''} ${sample.tradingSymbol || ''} ${sample.symbol || ''}`
      .trim()
      .toUpperCase();
    return text.includes('BANKNIFTY') || text.includes('BANK NIFTY') || text.includes('NIFTY BANK');
  });
  readonly indexDisplayName = computed<string>(() => (this.isBankNifty() ? 'BANK NIFTY' : 'NIFTY 50'));
  readonly timing = signal<ResolvedTradeTiming | null>(null);
  readonly plottedTrades = signal<ResolvedChartTradePlot[]>([]);
  readonly focusedTradeIndex = signal<number | null>(null);
  readonly activePlot = computed<ResolvedChartTradePlot | null>(() => {
    const idx = this.focusedTradeIndex();
    const plots = this.plottedTrades();
    if (idx === null || idx < 0 || idx >= plots.length) return null;
    return plots[idx];
  });
  readonly activeLegendTrade = computed<HistoricalTradeItem | null>(() =>
    this.isAllTradesMode() ? this.activePlot()?.trade || null : this.trade(),
  );
  readonly activeLegendTiming = computed<ResolvedTradeTiming | null>(() =>
    this.isAllTradesMode() ? this.activePlot()?.timing || null : this.timing(),
  );
  readonly activeLegendEntryLevel = computed<number | null>(() =>
    this.isAllTradesMode() ? this.activePlot()?.entryIndexLevel ?? null : this.entryIndexLevel(),
  );
  readonly activeLegendExitLevel = computed<number | null>(() =>
    this.isAllTradesMode() ? this.activePlot()?.exitIndexLevel ?? null : this.exitIndexLevel(),
  );
  readonly aggregateSummary = computed(() => {
    const plots = this.plottedTrades();
    let totalPnl = 0;
    let wins = 0;
    let losses = 0;
    for (const p of plots) {
      const pnl = p.trade.pnl ?? 0;
      totalPnl += pnl;
      if (pnl > 0) wins++;
      else if (pnl < 0) losses++;
    }
    return {
      totalTrades: plots.length,
      totalPnl: Math.round(totalPnl * 100) / 100,
      wins,
      losses,
    };
  });
  readonly isLoading = signal<boolean>(false);
  readonly isFullscreen = signal<boolean>(true);
  readonly errorMessage = signal<string | null>(null);
  readonly entryIndexLevel = signal<number | null>(null);
  readonly exitIndexLevel = signal<number | null>(null);
  readonly indexMovePoints = signal<number | null>(null);
  readonly loadedCandleCount = signal<number>(0);
  readonly loadedMonthsLabel = signal<string>('');
  readonly activeViewMode = signal<'month' | 'trade'>('month');
  readonly isAutoScale = signal<boolean>(true);

  private chart: IChartApi | null = null;
  private candlestickSeries: ISeriesApi<'Candlestick'> | null = null;
  private activePriceLines: IPriceLine[] = [];
  private resizeObserver: ResizeObserver | null = null;
  private detachInteractionListeners: (() => void) | null = null;

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.closeModal();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['tradeInput'] ||
      changes['instrumentTradesInput'] ||
      changes['chartModeInput'] ||
      changes['instrumentKeyInput']
    ) {
      this.trade.set(this.tradeInput);
      this.instrumentTrades.set(this.instrumentTradesInput || []);
      this.chartMode.set(this.chartModeInput || 'single');
      this.instrumentKeyOverride.set(this.instrumentKeyInput || null);
      this.focusedTradeIndex.set(null);
      this.loadAndRenderChart();
    }
  }

  ngOnDestroy(): void {
    this.cleanupChart();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  onBackdropClick(_event: MouseEvent): void {
    this.closeModal();
  }

  closeModal(): void {
    this.close.emit();
  }

  toggleFullscreen(): void {
    this.isFullscreen.update((v) => !v);
    setTimeout(() => {
      this.resizeChart();
      if (this.activeViewMode() === 'trade') {
        this.focusTradeRange();
      } else {
        this.fitChartContent();
      }
    }, 80);
  }

  zoomIn(): void {
    this.zoomTimeByFactor(0.75);
  }

  zoomOut(): void {
    this.zoomTimeByFactor(1.33);
  }

  toggleAutoScale(): void {
    if (!this.chart) return;
    const next = !this.isAutoScale();
    this.chart.priceScale('right').applyOptions({ autoScale: next });
    this.isAutoScale.set(next);
  }

  fitChartContent(): void {
    this.activeViewMode.set('month');
    if (this.isAllTradesMode()) {
      this.focusedTradeIndex.set(null);
      this.clearActivePriceLines();
    }
    if (this.chart) {
      this.chart.priceScale('right').applyOptions({ autoScale: true });
      this.isAutoScale.set(true);
      this.chart.timeScale().fitContent();
    }
  }

  switchChartMode(mode: 'single' | 'all'): void {
    if (this.chartMode() === mode) return;
    if (mode === 'single' && !this.trade()) return;
    this.chartMode.set(mode);
    this.focusedTradeIndex.set(null);
    this.loadAndRenderChart();
  }

  stepFocusedTrade(direction: -1 | 1): void {
    const plots = this.plottedTrades();
    if (plots.length === 0) return;
    const current = this.focusedTradeIndex();
    let next: number;
    if (current === null) {
      next = direction > 0 ? 0 : plots.length - 1;
    } else {
      next = (current + direction + plots.length) % plots.length;
    }
    this.focusTradeByIndex(next);
  }

  focusTradeByIndex(index: number): void {
    const plots = this.plottedTrades();
    if (index < 0 || index >= plots.length) return;
    this.focusedTradeIndex.set(index);
    const plot = plots[index];
    this.renderPriceLinesForPlot(plot);
    this.focusRangeForTiming(plot.timing);
  }

  focusTradeRange(): void {
    const resolved = this.isAllTradesMode() ? this.activePlot()?.timing || null : this.timing();
    this.focusRangeForTiming(resolved);
  }

  private focusRangeForTiming(resolved: ResolvedTradeTiming | null): void {
    this.activeViewMode.set('trade');
    if (!this.chart || !resolved) return;

    const fromEpoch = Math.floor(Date.parse(`${resolved.startDateIst}T09:15:00+05:30`) / 1000);
    const toEpoch = Math.floor(Date.parse(`${resolved.endDateIst}T15:30:00+05:30`) / 1000);
    try {
      this.chart.priceScale('right').applyOptions({ autoScale: true });
      this.isAutoScale.set(true);
      this.chart.timeScale().setVisibleRange({
        from: fromEpoch as any,
        to: toEpoch as any,
      });
    } catch {
      this.chart.timeScale().fitContent();
    }
  }

  private syncAutoScaleState(): void {
    if (!this.chart) return;
    this.isAutoScale.set(this.chart.priceScale('right').options().autoScale);
  }

  private zoomTimeByFactor(factor: number, anchorRelX = 0.5): void {
    if (!this.chart) return;
    const timeScale = this.chart.timeScale();
    const logicalRange = timeScale.getVisibleLogicalRange();
    if (!logicalRange || logicalRange.to <= logicalRange.from) return;

    const span = logicalRange.to - logicalRange.from;
    const maxSpan = Math.max(100, this.loadedCandleCount() * 1.5, span);
    const newSpan = factor < 1 ? Math.max(5, span * factor) : Math.min(maxSpan, span * factor);
    const anchor = logicalRange.from + anchorRelX * span;

    timeScale.setVisibleLogicalRange({
      from: anchor - anchorRelX * newSpan,
      to: anchor + (1 - anchorRelX) * newSpan,
    });
  }

  private panHorizontallyByPixels(pixelDelta: number): void {
    if (!this.chart || !this.chartContainerRef?.nativeElement) return;
    const container = this.chartContainerRef.nativeElement;
    const timeScale = this.chart.timeScale();
    const logicalRange = timeScale.getVisibleLogicalRange();
    if (!logicalRange || logicalRange.to <= logicalRange.from) return;

    const span = logicalRange.to - logicalRange.from;
    const plotWidth = Math.max(1, (container.clientWidth || 960) - this.chart.priceScale('right').width());
    const barsDelta = (pixelDelta * span) / plotWidth;

    timeScale.setVisibleLogicalRange({
      from: logicalRange.from + barsDelta,
      to: logicalRange.to + barsDelta,
    });
  }

  private scalePriceAxisAroundCursor(deltaY: number, localY: number, rectHeight: number): void {
    if (!this.chart) return;
    const priceScale = this.chart.priceScale('right');
    const priceRange = priceScale.getVisibleRange();
    if (!priceRange || priceRange.to <= priceRange.from) return;

    const paneHeight = Math.max(1, rectHeight - 28);
    const relY = 1 - Math.max(0, Math.min(1, localY / paneHeight));
    const span = priceRange.to - priceRange.from;
    const clampedDelta = Math.max(-200, Math.min(200, deltaY));
    const zoomFactor = Math.exp(clampedDelta * 0.004);
    const newSpan = Math.max(0.5, span * zoomFactor);
    const anchor = priceRange.from + relY * span;

    priceScale.setVisibleRange({
      from: anchor - relY * newSpan,
      to: anchor + (1 - relY) * newSpan,
    });
    this.isAutoScale.set(false);
  }

  private attachChartInteractionListeners(container: HTMLDivElement): void {
    this.detachChartInteractionListeners();

    const normalizeWheelDelta = (raw: number, deltaMode: number): number => {
      if (deltaMode === 2) return raw * 120; // DOM_DELTA_PAGE
      if (deltaMode === 1) return raw * 32; // DOM_DELTA_LINE
      return raw;
    };

    // Match official TradingView charts:
    // - Wheel over main chart pane: lightweight-charts zooms time (deltaY) & scrolls time (deltaX)
    // - Wheel over right price axis: scales/scrolls price axis vertically around cursor Y
    // - Shift + Wheel (when deltaX === 0): pans time horizontally
    const onWheelCapture = (event: WheelEvent): void => {
      if (!this.chart || !this.candlestickSeries) return;
      const deltaX = normalizeWheelDelta(event.deltaX, event.deltaMode);
      const deltaY = normalizeWheelDelta(event.deltaY, event.deltaMode);

      const rect = container.getBoundingClientRect();
      const priceScaleWidth = this.chart.priceScale('right').width();
      const plotWidth = Math.max(1, rect.width - priceScaleWidth);
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      const isOverPriceAxis = priceScaleWidth > 0 && localX >= plotWidth && localY >= 0 && localY < rect.height - 28;

      if (isOverPriceAxis && deltaY !== 0) {
        if (event.cancelable) event.preventDefault();
        event.stopPropagation();
        this.scalePriceAxisAroundCursor(deltaY, localY, rect.height);
        return;
      }

      if (event.shiftKey && deltaX === 0 && deltaY !== 0) {
        if (event.cancelable) event.preventDefault();
        event.stopPropagation();
        this.panHorizontallyByPixels(deltaY);
      }
    };

    // Keep Auto pill synchronized when user drags or double-clicks the right price scale
    const onPointerSettle = (): void => {
      setTimeout(() => this.syncAutoScaleState(), 0);
    };

    container.addEventListener('wheel', onWheelCapture, { capture: true, passive: false });
    container.addEventListener('mouseup', onPointerSettle);
    container.addEventListener('touchend', onPointerSettle, { passive: true });
    container.addEventListener('dblclick', onPointerSettle);

    this.detachInteractionListeners = () => {
      container.removeEventListener('wheel', onWheelCapture, { capture: true });
      container.removeEventListener('mouseup', onPointerSettle);
      container.removeEventListener('touchend', onPointerSettle);
      container.removeEventListener('dblclick', onPointerSettle);
    };
  }

  private detachChartInteractionListeners(): void {
    if (this.detachInteractionListeners) {
      this.detachInteractionListeners();
      this.detachInteractionListeners = null;
    }
  }

  private clearActivePriceLines(): void {
    if (this.candlestickSeries && this.activePriceLines.length > 0) {
      for (const line of this.activePriceLines) {
        try {
          this.candlestickSeries.removePriceLine(line);
        } catch {
          // Ignore already removed lines
        }
      }
    }
    this.activePriceLines = [];
  }

  private renderPriceLinesForPlot(plot: {
    trade: HistoricalTradeItem;
    timing: ResolvedTradeTiming;
    entryIndexLevel: number | null;
    exitIndexLevel: number | null;
  }): void {
    if (!this.candlestickSeries) return;
    this.clearActivePriceLines();

    const isProfit = (plot.trade.pnl ?? 0) >= 0;
    const exitColor = isProfit ? '#10B981' : '#F43F5E';

    if (plot.entryIndexLevel !== null) {
      const optPriceLabel =
        plot.timing.entryOptionPrice !== null
          ? ` (Opt ₹${plot.timing.entryOptionPrice.toFixed(2)})`
          : '';
      this.activePriceLines.push(
        this.candlestickSeries.createPriceLine({
          price: plot.entryIndexLevel,
          color: '#00D2C4',
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `ENTRY ${plot.entryIndexLevel}${optPriceLabel}`,
        }),
      );
    }

    if (plot.exitIndexLevel !== null) {
      const optExitLabel =
        plot.timing.exitOptionPrice !== null
          ? ` (Opt ₹${plot.timing.exitOptionPrice.toFixed(2)})`
          : '';
      this.activePriceLines.push(
        this.candlestickSeries.createPriceLine({
          price: plot.exitIndexLevel,
          color: exitColor,
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `EXIT ${plot.exitIndexLevel}${optExitLabel}`,
        }),
      );
    }
  }

  private cleanupChart(): void {
    this.detachChartInteractionListeners();
    this.activePriceLines = [];
    if (this.chart) {
      this.chart.remove();
      this.chart = null;
      this.candlestickSeries = null;
    }
  }

  private loadAndRenderChart(): void {
    this.errorMessage.set(null);
    this.entryIndexLevel.set(null);
    this.exitIndexLevel.set(null);
    this.indexMovePoints.set(null);
    this.loadedCandleCount.set(0);
    this.loadedMonthsLabel.set('');
    this.activeViewMode.set('month');
    this.plottedTrades.set([]);
    this.focusedTradeIndex.set(null);
    this.cleanupChart();

    if (this.isAllTradesMode()) {
      const allTrades = this.instrumentTrades();
      const resolvedList = allTrades
        .map((trade) => ({ trade, timing: resolveTradeEntryExit(trade) }))
        .filter((x): x is { trade: HistoricalTradeItem; timing: ResolvedTradeTiming } => x.timing !== null);

      if (resolvedList.length === 0) {
        this.timing.set(null);
        this.errorMessage.set(`No ${this.indexDisplayName()} trades with valid entry/exit timestamps.`);
        return;
      }

      let fromMonth = resolvedList[0].timing.startDateIst.slice(0, 7);
      let toMonth = resolvedList[0].timing.endDateIst.slice(0, 7);
      for (const item of resolvedList) {
        const sMonth = item.timing.startDateIst.slice(0, 7);
        const eMonth = item.timing.endDateIst.slice(0, 7);
        if (sMonth < fromMonth) fromMonth = sMonth;
        if (eMonth > toMonth) toMonth = eMonth;
      }

      this.timing.set(resolvedList[0].timing);
      this.loadedMonthsLabel.set(fromMonth === toMonth ? fromMonth : `${fromMonth} → ${toMonth}`);
      this.fetchCandlesAndBuild(allTrades, fromMonth, toMonth);
      return;
    }

    const t = this.trade();
    if (!t) {
      this.timing.set(null);
      return;
    }

    const resolved = resolveTradeEntryExit(t);
    this.timing.set(resolved);
    if (!resolved) {
      this.errorMessage.set('Could not determine trade entry/exit timestamp.');
      return;
    }

    const fromMonth = resolved.startDateIst.slice(0, 7);
    const toMonth = resolved.endDateIst.slice(0, 7);
    this.loadedMonthsLabel.set(fromMonth === toMonth ? fromMonth : `${fromMonth} → ${toMonth}`);
    this.fetchCandlesAndBuild([t], fromMonth, toMonth);
  }

  private fetchCandlesAndBuild(
    tradesToPlot: HistoricalTradeItem[],
    fromMonth: string,
    toMonth: string,
  ): void {
    const indexLabel = this.indexDisplayName();
    const candlesObs = this.isBankNifty()
      ? this.historicalDataService.getBankNiftyCandles({ fromMonth, toMonth })
      : this.historicalDataService.getCandles({ fromMonth, toMonth });

    this.isLoading.set(true);
    candlesObs.subscribe({
      next: (res) => {
        this.isLoading.set(false);
        const candles = res?.candles || [];
        if (candles.length === 0) {
          this.errorMessage.set(
            `No ${indexLabel} 5m candles found in Firestore for ${this.loadedMonthsLabel()}.`,
          );
          return;
        }
        this.loadedCandleCount.set(candles.length);
        this.buildChart(tradesToPlot, candles);
      },
      error: () => {
        this.isLoading.set(false);
        this.errorMessage.set(`Failed to load ${indexLabel} historical 5m candles from Firestore.`);
      },
    });
  }

  private buildChart(tradesToPlot: HistoricalTradeItem[], candles: HistoricalCandle[]): void {
    this.cleanupChart();
    const sorted = [...candles].sort((a, b) => a.epoch - b.epoch);
    const isSingle = !this.isAllTradesMode();
    const { plots, markers } = buildTradeMarkersAndPlots(tradesToPlot, sorted, isSingle);
    this.plottedTrades.set(plots);

    const firstPlot = plots[0] || null;
    if (isSingle && firstPlot) {
      this.entryIndexLevel.set(firstPlot.entryIndexLevel);
      this.exitIndexLevel.set(firstPlot.exitIndexLevel);
      this.indexMovePoints.set(firstPlot.indexMovePoints);
    }

    const container = this.chartContainerRef?.nativeElement;
    if (!container) return;

    // In headless DOM test environments (e.g. jsdom) without matchMedia/canvas, skip chart DOM creation
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    try {
      const width = container.clientWidth || window.innerWidth || 1280;
      const height = container.clientHeight || window.innerHeight || 720;

      const istDateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      const istTimeFormatter = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      this.chart = this.makeChart(container, {
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
        localization: {
          timeFormatter: (time: number) => istDateTimeFormatter.format(new Date(Number(time) * 1000)),
        },
        crosshair: {
          vertLine: {
            color: 'rgba(0, 210, 196, 0.45)',
            width: 1,
            style: LineStyle.Dashed,
          },
          horzLine: {
            color: 'rgba(0, 210, 196, 0.45)',
            width: 1,
            style: LineStyle.Dashed,
          },
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          borderColor: 'rgba(255, 255, 255, 0.08)',
          tickMarkFormatter: (time: number) => istTimeFormatter.format(new Date(Number(time) * 1000)),
        },
        rightPriceScale: {
          borderColor: 'rgba(255, 255, 255, 0.08)',
          autoScale: true,
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: true,
        },
        handleScale: {
          mouseWheel: true,
          pinch: true,
          axisPressedMouseMove: {
            time: true,
            price: true,
          },
          axisDoubleClickReset: {
            time: true,
            price: true,
          },
        },
      });

      this.candlestickSeries = this.chart.addSeries(CandlestickSeries, {
        upColor: '#10B981',
        downColor: '#F43F5E',
        borderUpColor: '#10B981',
        borderDownColor: '#F43F5E',
        wickUpColor: '#10B981',
        wickDownColor: '#F43F5E',
      });

      this.candlestickSeries.setData(
        sorted.map((c) => ({
          time: c.epoch as any,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })),
      );

      // Markers on entry & exit 5m candles
      if (markers.length > 0) {
        this.attachSeriesMarkers(this.candlestickSeries, markers);
      }

      // Horizontal price lines marking index levels at Entry and Exit (single-trade mode initially)
      if (isSingle && firstPlot) {
        this.renderPriceLinesForPlot(firstPlot);
      }

      this.setupResizeObserver();
      this.attachChartInteractionListeners(container);
      this.isAutoScale.set(true);
      this.chart.timeScale().fitContent();
    } catch {
      // Gracefully skip canvas rendering in non-canvas test environments (e.g. jsdom)
    }
  }

  protected makeChart(container: HTMLElement, options: Parameters<typeof createChart>[1]): IChartApi {
    return createChart(container, options);
  }

  protected attachSeriesMarkers(series: ISeriesApi<'Candlestick'>, markers: any[]): void {
    createSeriesMarkers(series, markers);
  }

  private resizeChart(): void {
    if (!this.chart || !this.chartContainerRef?.nativeElement) return;
    const container = this.chartContainerRef.nativeElement;
    if (container.clientWidth > 0 && container.clientHeight > 0) {
      this.chart.resize(container.clientWidth, container.clientHeight);
    }
  }

  private setupResizeObserver(): void {
    if (typeof ResizeObserver === 'undefined' || !this.chartContainerRef?.nativeElement) return;
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    this.resizeObserver = new ResizeObserver(() => {
      this.resizeChart();
    });
    this.resizeObserver.observe(this.chartContainerRef.nativeElement);
  }
}

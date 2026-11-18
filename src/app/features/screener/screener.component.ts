import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ScreenerService } from '../../core/api/screener.service';
import {
  LiquidityLevelType,
  LiquiditySweepSignal,
  ScreenerScanMode,
} from '../../core/models/screener.models';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';
import { IstDatePipe } from '../../shared/pipes/ist-date.pipe';
import { SectionErrorComponent } from '../../shared/components/section-error/section-error.component';
import { SweepChartComponent } from './components/sweep-chart/sweep-chart.component';

const IST_TIME_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

const IST_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

function formatIstDateOffset(deltaDays = 0): string {
  const istNowMs = Date.now() + 5.5 * 3600 * 1000 + deltaDays * 86400 * 1000;
  return new Date(istNowMs).toISOString().slice(0, 10);
}

@Component({
  selector: 'app-screener',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    CurrencyInrPipe,
    IstDatePipe,
    SectionErrorComponent,
    SweepChartComponent,
  ],
  template: `
    <div class="screener-root">
      <main class="page-body">
        <!-- TOP CONTROL & ACTION BAR -->
        <section class="control-header-card">
          <div class="header-top-row">
            <div class="title-group">
              <div class="page-title">
                <span class="material-symbols-rounded page-icon">radar</span>
                <span>Liquidity Sweep &amp; Reversal Screener</span>
                <span class="tf-pill mono-val">5m</span>
              </div>
              <div class="page-subtitle">
                On-Demand PDH / PDL &amp; Intraday High / Low Sweep Detection &bull; Yahoo Finance 5m OHLC
                <span *ngIf="screenerService.lastScannedAt() as lastScan">
                  &bull; Last run at {{ lastScan | istDate : 'timeOnly' }}
                </span>
              </div>
            </div>

            <!-- Mode Selector + Run Scan CTA -->
            <div class="controls-toolbar">
              <div class="mode-toggle" role="group" aria-label="Scan mode selector">
                <button
                  type="button"
                  class="mode-btn"
                  [class.active]="screenerService.scanMode() === 'live'"
                  (click)="selectMode('live')"
                  [disabled]="screenerService.isScanning()"
                  matTooltip="Evaluates only the latest 2-3 closed 5m candles of the current session"
                >
                  <span class="live-dot" [class.pulsing]="screenerService.scanMode() === 'live'"></span>
                  <span>Live</span>
                </button>
                <button
                  type="button"
                  class="mode-btn"
                  [class.active]="screenerService.scanMode() === 'historical'"
                  (click)="selectMode('historical')"
                  [disabled]="screenerService.isScanning()"
                  matTooltip="Backtest full trading session(s) for a selected date or date range"
                >
                  <span class="material-symbols-rounded mode-icon">history</span>
                  <span>Historical</span>
                </button>
              </div>

              <button
                type="button"
                class="run-scan-btn"
                (click)="runScan()"
                [disabled]="screenerService.isScanning() || screenerService.instrumentCount() === 0"
                matTooltip="Execute on-demand 5m Liquidity Sweep scan"
              >
                <span
                  class="material-symbols-rounded"
                  [class.spinning]="screenerService.isScanning()"
                >
                  {{ screenerService.isScanning() ? 'autorenew' : 'play_arrow' }}
                </span>
                <span>{{ screenerService.isScanning() ? 'Scanning...' : 'Run Scan' }}</span>
              </button>
            </div>
          </div>

          <!-- Historical Date / Date Range Picker Row -->
          <div *ngIf="screenerService.scanMode() === 'historical'" class="historical-bar">
            <div class="date-inputs-group">
              <label class="date-field">
                <span class="date-label">From Date</span>
                <input
                  type="date"
                  class="date-input mono-val"
                  [min]="minHistoricalDate"
                  [max]="maxHistoricalDate"
                  [ngModel]="screenerService.historicalStartDate()"
                  (ngModelChange)="onStartDateChange($event)"
                  [disabled]="screenerService.isScanning()"
                />
              </label>

              <label class="date-field">
                <span class="date-label">To Date</span>
                <input
                  type="date"
                  class="date-input mono-val"
                  [min]="screenerService.historicalStartDate() || minHistoricalDate"
                  [max]="maxHistoricalDate"
                  [ngModel]="screenerService.historicalEndDate()"
                  (ngModelChange)="onEndDateChange($event)"
                  [disabled]="screenerService.isScanning()"
                />
              </label>
            </div>

            <div class="date-presets">
              <span class="preset-label">Quick Range:</span>
              <button type="button" class="preset-chip" (click)="applyPreset(0)">Today</button>
              <button type="button" class="preset-chip" (click)="applyPreset(1)">Yesterday</button>
              <button type="button" class="preset-chip" (click)="applyPreset(3)">Last 3D</button>
              <button type="button" class="preset-chip" (click)="applyPreset(5)">Last 5D</button>
            </div>
          </div>

          <!-- Configured Master Indices Universe Strip (config/lot_sizes) -->
          <div class="universe-strip">
            <span class="universe-label">
              <span class="material-symbols-rounded">hub</span>
              <span>Configured Indices ({{ screenerService.instrumentCount() }}):</span>
            </span>
            <div class="universe-chips" *ngIf="screenerService.instruments().length > 0">
              <span
                *ngFor="let inst of screenerService.instruments()"
                class="index-chip mono-val"
                [matTooltip]="inst.name"
              >
                {{ inst.symbol }}
              </span>
            </div>
            <span
              *ngIf="screenerService.isLoadingInstruments()"
              class="universe-loading"
            >
              Loading configured indices...
            </span>
          </div>
        </section>

        <!-- SECTION ERROR: INSTRUMENTS LOAD FAILURE -->
        <app-section-error
          *ngIf="screenerService.instrumentsError() as instErr"
          [title]="'Configured Indices Unavailable'"
          [message]="instErr"
          (retry)="screenerService.loadInstruments()"
        ></app-section-error>

        <!-- KPI SUMMARY METRICS -->
        <section class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">
              <span class="material-symbols-rounded icon-dim">hub</span>
              <span>Indices Scanned</span>
            </div>
            <div class="kpi-value mono-val">
              {{ screenerService.scanResults() ? screenerService.totalScanned() : screenerService.instrumentCount() }}
            </div>
            <div class="kpi-subtext">From Firestore config/lot_sizes</div>
          </div>

          <div class="kpi-card highlight-cyan">
            <div class="kpi-label">
              <span class="material-symbols-rounded icon-cyan">insights</span>
              <span>Total Signals</span>
            </div>
            <div class="kpi-value mono-val">
              {{ screenerService.totalRecommendations() }}
            </div>
            <div class="kpi-subtext">
              {{ screenerService.scanResults()?.mode === 'historical' ? 'Full-session historical setups' : 'Latest 2-3 closed 5m bars' }}
            </div>
          </div>

          <div class="kpi-card highlight-emerald">
            <div class="kpi-label">
              <span class="material-symbols-rounded icon-emerald">trending_up</span>
              <span>Bullish Sweeps (BUY)</span>
            </div>
            <div class="kpi-value mono-val text-emerald">
              {{ screenerService.bullishCount() }}
            </div>
            <div class="kpi-subtext">PDL / Day Low &rarr; Green Close</div>
          </div>

          <div class="kpi-card highlight-coral">
            <div class="kpi-label">
              <span class="material-symbols-rounded icon-coral">trending_down</span>
              <span>Bearish Sweeps (SELL)</span>
            </div>
            <div class="kpi-value mono-val text-coral">
              {{ screenerService.bearishCount() }}
            </div>
            <div class="kpi-subtext">PDH / Day High &rarr; Red Close</div>
          </div>
        </section>

        <!-- SECTION ERROR: SCAN FAILURE -->
        <app-section-error
          *ngIf="screenerService.scanError() as err"
          [title]="'Screener Scan Notice'"
          [message]="err"
          (retry)="runScan()"
        ></app-section-error>

        <!-- RECOMMENDATIONS CONTAINER -->
        <section class="setups-container">
          <div class="setups-header">
            <div class="section-title">
              <span class="material-symbols-rounded">candlestick_chart</span>
              <span>Detected Liquidity Sweep Recommendations</span>
              <span class="count-badge mono-val" *ngIf="screenerService.totalRecommendations() > 0">
                {{ filteredRecommendations().length }}
              </span>
            </div>

            <!-- Filters Bar -->
            <div class="filter-bar" *ngIf="screenerService.totalRecommendations() > 0">
              <div class="filter-chips-bar">
                <button
                  type="button"
                  class="filter-pill"
                  [class.active]="activeSignalFilter() === 'ALL'"
                  (click)="activeSignalFilter.set('ALL')"
                >
                  All ({{ screenerService.totalRecommendations() }})
                </button>
                <button
                  type="button"
                  class="filter-pill pill-bullish"
                  [class.active]="activeSignalFilter() === 'BUY'"
                  (click)="activeSignalFilter.set('BUY')"
                >
                  <span class="material-symbols-rounded mini-icon">trending_up</span>
                  BUY ({{ screenerService.bullishCount() }})
                </button>
                <button
                  type="button"
                  class="filter-pill pill-bearish"
                  [class.active]="activeSignalFilter() === 'SELL'"
                  (click)="activeSignalFilter.set('SELL')"
                >
                  <span class="material-symbols-rounded mini-icon">trending_down</span>
                  SELL ({{ screenerService.bearishCount() }})
                </button>
              </div>

              <div class="filter-selects">
                <select
                  class="compact-select"
                  [ngModel]="activeLevelFilter()"
                  (ngModelChange)="activeLevelFilter.set($event)"
                  aria-label="Filter by liquidity level"
                >
                  <option value="ALL">All Levels</option>
                  <option value="PDL">PDL</option>
                  <option value="PDH">PDH</option>
                  <option value="DAY_LOW">Day Low</option>
                  <option value="DAY_HIGH">Day High</option>
                </select>

                <select
                  class="compact-select"
                  [ngModel]="activeSymbolFilter()"
                  (ngModelChange)="activeSymbolFilter.set($event)"
                  aria-label="Filter by index symbol"
                >
                  <option value="ALL">All Indices</option>
                  <option *ngFor="let sym of matchedSymbols()" [value]="sym">
                    {{ sym }}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <!-- Initial State (No Scan Executed Yet) -->
          <div
            *ngIf="!screenerService.scanResults() && !screenerService.isScanning()"
            class="empty-state-card"
          >
            <div class="empty-icon-wrap">
              <span class="material-symbols-rounded">radar</span>
            </div>
            <div class="empty-title">Ready for On-Demand 5m Liquidity Sweep Scan</div>
            <div class="empty-desc">
              Select <strong>Live</strong> (evaluates the latest 2&ndash;3 closed 5m candles) or
              <strong>Historical</strong> (backtests full trading sessions by date/range), then click
              <strong>&ldquo;Run Scan&rdquo;</strong> to detect PDH/PDL and Intraday High/Low sweeps with interactive TradingView charts.
            </div>
            <button
              type="button"
              class="empty-action-btn"
              (click)="runScan()"
              [disabled]="screenerService.instrumentCount() === 0"
            >
              <span class="material-symbols-rounded">play_arrow</span>
              <span>Run {{ screenerService.scanMode() === 'live' ? 'Live' : 'Historical' }} Scan</span>
            </button>
          </div>

          <!-- Scanning Loading State -->
          <div *ngIf="screenerService.isScanning()" class="loading-state-card">
            <div class="scan-spinner"></div>
            <div class="loading-title">Scanning 5-Minute Candles via Yahoo Finance...</div>
            <div class="loading-desc">
              Evaluating PDH/PDL and causal Intraday High/Low liquidity sweeps across
              {{ screenerService.instrumentCount() }} configured indices ({{ screenerService.scanMode() }} mode).
            </div>
          </div>

          <!-- Zero Recommendations Found State -->
          <div
            *ngIf="
              screenerService.scanResults() &&
              screenerService.totalRecommendations() === 0 &&
              !screenerService.isScanning()
            "
            class="empty-state-card"
          >
            <div class="empty-icon-wrap amber">
              <span class="material-symbols-rounded">search_off</span>
            </div>
            <div class="empty-title">No Liquidity Sweep Setups Detected</div>
            <div class="empty-desc">
              <ng-container *ngIf="screenerService.scanResults()?.mode === 'live'; else histEmpty">
                None of the {{ screenerService.totalScanned() }} configured indices triggered a confirmed
                5-minute sweep &amp; reversal within the latest 2&ndash;3 closed candles. Try switching to
                <strong>Historical</strong> mode to inspect earlier sessions.
              </ng-container>
              <ng-template #histEmpty>
                No 5-minute PDH/PDL or Intraday High/Low sweep reversals occurred between
                <strong>{{ screenerService.scanResults()?.startDate }}</strong> and
                <strong>{{ screenerService.scanResults()?.endDate }}</strong> across the scanned indices.
              </ng-template>
            </div>
          </div>

          <!-- Compact Summary Jump Table (Desktop) -->
          <div
            *ngIf="filteredRecommendations().length > 0 && !screenerService.isScanning()"
            class="summary-table-wrapper desktop-only"
          >
            <table class="summary-table">
              <thead>
                <tr>
                  <th>Index</th>
                  <th>Signal</th>
                  <th>Swept Level</th>
                  <th>Level Price</th>
                  <th>Sweep Extreme</th>
                  <th>Confirm Close</th>
                  <th>Time (IST)</th>
                  <th class="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  *ngFor="let rec of filteredRecommendations(); trackBy: trackBySignalId"
                  class="summary-row"
                  [class.buy-row]="rec.signalType === 'BUY'"
                  [class.sell-row]="rec.signalType === 'SELL'"
                  (click)="scrollToCard(rec.id)"
                >
                  <td class="mono-val sym-cell">{{ rec.symbol }}</td>
                  <td>
                    <span
                      class="signal-badge"
                      [class.badge-buy]="rec.signalType === 'BUY'"
                      [class.badge-sell]="rec.signalType === 'SELL'"
                    >
                      <span class="material-symbols-rounded">
                        {{ rec.signalType === 'BUY' ? 'trending_up' : 'trending_down' }}
                      </span>
                      {{ rec.signalType }}
                    </span>
                  </td>
                  <td>
                    <span
                      class="level-pill mono-val"
                      [class.pd-pill]="rec.levelType === 'PDH' || rec.levelType === 'PDL'"
                    >
                      {{ formatLevelLabel(rec.levelType) }}
                    </span>
                  </td>
                  <td class="mono-val">{{ rec.levelPrice | currencyInr }}</td>
                  <td class="mono-val sweep-val">{{ rec.sweepPrice | currencyInr }}</td>
                  <td
                    class="mono-val"
                    [class.text-emerald]="rec.signalType === 'BUY'"
                    [class.text-coral]="rec.signalType === 'SELL'"
                  >
                    {{ rec.confirmationClosePrice | currencyInr }}
                  </td>
                  <td class="mono-val time-cell">{{ formatIstDateTime(rec.confirmationTimestamp) }}</td>
                  <td class="text-right" (click)="$event.stopPropagation()">
                    <button
                      type="button"
                      class="mini-chart-btn"
                      (click)="scrollToCard(rec.id)"
                      matTooltip="Jump to interactive chart card"
                    >
                      <span class="material-symbols-rounded">candlestick_chart</span>
                      <span>Chart</span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- INDIVIDUAL RECOMMENDATION CARDS + INTERACTIVE LIGHTWEIGHT CHARTS -->
          <div
            *ngIf="filteredRecommendations().length > 0 && !screenerService.isScanning()"
            class="recommendation-cards-list"
          >
            <article
              *ngFor="let rec of filteredRecommendations(); trackBy: trackBySignalId"
              [id]="'signal-card-' + rec.id"
              class="recommendation-card"
              [class.buy-card]="rec.signalType === 'BUY'"
              [class.sell-card]="rec.signalType === 'SELL'"
            >
              <!-- Card Header -->
              <div class="rec-card-header">
                <div class="rec-identity">
                  <span
                    class="signal-badge lg"
                    [class.badge-buy]="rec.signalType === 'BUY'"
                    [class.badge-sell]="rec.signalType === 'SELL'"
                  >
                    <span class="material-symbols-rounded">
                      {{ rec.signalType === 'BUY' ? 'trending_up' : 'trending_down' }}
                    </span>
                    <span>{{ rec.signalType }}</span>
                  </span>

                  <div class="rec-title-wrap">
                    <div class="rec-symbol-line">
                      <span class="rec-symbol mono-val">{{ rec.symbol }}</span>
                      <span
                        class="level-pill mono-val"
                        [class.pd-pill]="rec.levelType === 'PDH' || rec.levelType === 'PDL'"
                      >
                        {{ formatLevelLabel(rec.levelType) }} Sweep
                      </span>
                      <span class="session-date-pill mono-val">{{ rec.sessionDate }}</span>
                    </div>
                    <div class="rec-subline">
                      {{ rec.name }} &bull; Confirmed {{ formatIstDateTime(rec.confirmationTimestamp) }} IST
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  class="trade-setup-btn"
                  (click)="goToComposerWithSetup(rec)"
                  matTooltip="Pre-fill Conditional Alert Composer on Live Monitor"
                >
                  <span class="material-symbols-rounded">bolt</span>
                  <span>Create Alert</span>
                </button>
              </div>

              <!-- Key Metrics Grid -->
              <div class="rec-metrics-grid mono-val">
                <div class="metric-box">
                  <span class="metric-label">Swept {{ formatLevelLabel(rec.levelType) }}</span>
                  <span
                    class="metric-value"
                    [class.text-amber]="rec.levelType === 'PDH' || rec.levelType === 'PDL'"
                    [class.text-cyan]="rec.levelType === 'DAY_HIGH' || rec.levelType === 'DAY_LOW'"
                  >
                    {{ rec.levelPrice | currencyInr }}
                  </span>
                  <span class="metric-meta">Key Liquidity Level</span>
                </div>

                <div class="metric-box">
                  <span class="metric-label">
                    Sweep {{ rec.signalType === 'BUY' ? 'Low' : 'High' }}
                  </span>
                  <span class="metric-value text-amber">
                    {{ rec.sweepPrice | currencyInr }}
                  </span>
                  <span class="metric-meta">
                    {{ formatIstTime(rec.sweepTimestamp) }} IST
                    ({{ formatSweepDistance(rec) }} pts)
                  </span>
                </div>

                <div class="metric-box">
                  <span class="metric-label">Confirmation Close</span>
                  <span
                    class="metric-value"
                    [class.text-emerald]="rec.signalType === 'BUY'"
                    [class.text-coral]="rec.signalType === 'SELL'"
                  >
                    {{ rec.confirmationClosePrice | currencyInr }}
                  </span>
                  <span class="metric-meta">
                    {{ formatIstTime(rec.confirmationTimestamp) }} IST
                    ({{ rec.signalType === 'BUY' ? 'Green Bar' : 'Red Bar' }})
                  </span>
                </div>

                <div class="metric-box">
                  <span class="metric-label">Risk (Close &rarr; Sweep)</span>
                  <span class="metric-value">
                    {{ formatRiskPoints(rec) }} pts
                  </span>
                  <span class="metric-meta">
                    {{ formatRiskPercent(rec) }}% distance
                  </span>
                </div>
              </div>

              <!-- Interactive TradingView Lightweight Chart (v5) -->
              <div class="rec-chart-wrap">
                <app-sweep-chart [signal]="rec"></app-sweep-chart>
              </div>
            </article>
          </div>
        </section>
      </main>
    </div>
  `,
  styles: [
    `
      .screener-root {
        min-height: calc(100vh - 64px);
        background-color: #0b0f19;
        color: #f1f5f9;
        padding-bottom: 56px;
        max-width: 100vw;
        overflow-x: hidden;
        font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      }

      .page-body {
        max-width: 1400px;
        margin: 0 auto;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 18px;
        box-sizing: border-box;
      }

      .mono-val {
        font-family: 'JetBrains Mono', monospace;
      }

      .text-emerald {
        color: #10b981 !important;
      }

      .text-coral {
        color: #f43f5e !important;
      }

      .text-amber {
        color: #f59e0b !important;
      }

      .text-cyan {
        color: #00d2c4 !important;
      }

      /* CONTROL HEADER CARD */
      .control-header-card {
        background: #151c2c;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 14px;
        padding: 18px 22px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .header-top-row {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
      }

      .title-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .page-title {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
        font-size: 1.3rem;
        font-weight: 700;
        color: #f8fafc;
        letter-spacing: -0.01em;

        .page-icon {
          color: #00d2c4;
          font-size: 26px;
        }
      }

      .tf-pill {
        font-size: 0.72rem;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 999px;
        background: rgba(0, 210, 196, 0.14);
        color: #00d2c4;
        border: 1px solid rgba(0, 210, 196, 0.3);
      }

      .page-subtitle {
        font-size: 0.84rem;
        color: #94a3b8;
      }

      .controls-toolbar {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
      }

      /* MODE SELECTOR */
      .mode-toggle {
        display: inline-flex;
        background: #0b0f19;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 10px;
        padding: 3px;
        gap: 3px;
      }

      .mode-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: transparent;
        border: none;
        color: #94a3b8;
        padding: 8px 14px;
        border-radius: 7px;
        font-size: 0.84rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
        min-height: 36px;

        .mode-icon {
          font-size: 17px;
        }

        &:hover:not(:disabled) {
          color: #f1f5f9;
          background: rgba(255, 255, 255, 0.04);
        }

        &.active {
          background: #1e293b;
          color: #00d2c4;
          box-shadow: inset 0 0 0 1px rgba(0, 210, 196, 0.35);
        }
      }

      .live-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #64748b;

        &.pulsing {
          background: #10b981;
          box-shadow: 0 0 8px rgba(16, 185, 129, 0.8);
        }
      }

      .run-scan-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        background: linear-gradient(135deg, #00d2c4 0%, #0284c7 100%);
        border: none;
        color: #0b0f19;
        padding: 10px 20px;
        border-radius: 10px;
        font-size: 0.88rem;
        font-weight: 700;
        cursor: pointer;
        min-height: 42px;
        transition: all 0.2s ease;
        box-shadow: 0 2px 10px rgba(0, 210, 196, 0.28);

        &:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(0, 210, 196, 0.45);
        }

        &:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          box-shadow: none;
        }

        .spinning {
          animation: spin 1s linear infinite;
        }
      }

      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      /* HISTORICAL DATE PICKER BAR */
      .historical-bar {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        justify-content: space-between;
        gap: 14px;
        padding: 12px 14px;
        background: #0b0f19;
        border: 1px solid rgba(99, 102, 241, 0.25);
        border-radius: 10px;
      }

      .date-inputs-group {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
      }

      .date-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .date-label {
        font-size: 0.72rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #94a3b8;
      }

      .date-input {
        background: #151c2c;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 8px;
        color: #f8fafc;
        padding: 8px 12px;
        font-size: 0.84rem;
        outline: none;
        min-height: 38px;
        color-scheme: dark;

        &:focus {
          border-color: #00d2c4;
        }
      }

      .date-presets {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
      }

      .preset-label {
        font-size: 0.75rem;
        color: #64748b;
        margin-right: 2px;
      }

      .preset-chip {
        background: rgba(99, 102, 241, 0.12);
        border: 1px solid rgba(99, 102, 241, 0.3);
        color: #c7d2fe;
        padding: 6px 10px;
        border-radius: 7px;
        font-size: 0.76rem;
        font-weight: 600;
        cursor: pointer;
        min-height: 34px;
        transition: all 0.15s ease;

        &:hover {
          background: rgba(99, 102, 241, 0.25);
          color: #ffffff;
        }
      }

      /* CONFIGURED INDICES STRIP */
      .universe-strip {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        padding-top: 10px;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
      }

      .universe-label {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 0.78rem;
        font-weight: 600;
        color: #94a3b8;

        .material-symbols-rounded {
          font-size: 16px;
          color: #6366f1;
        }
      }

      .universe-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .index-chip {
        font-size: 0.74rem;
        font-weight: 600;
        padding: 3px 9px;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #e2e8f0;
      }

      .universe-loading {
        font-size: 0.78rem;
        color: #64748b;
      }

      /* KPI GRID */
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 14px;
      }

      .kpi-card {
        background: #151c2c;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 16px 18px;
        display: flex;
        flex-direction: column;
        gap: 6px;

        &.highlight-cyan {
          border-color: rgba(0, 210, 196, 0.22);
        }

        &.highlight-emerald {
          border-color: rgba(16, 185, 129, 0.22);
        }

        &.highlight-coral {
          border-color: rgba(244, 63, 94, 0.22);
        }
      }

      .kpi-label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.78rem;
        font-weight: 600;
        color: #94a3b8;

        .material-symbols-rounded {
          font-size: 18px;
        }
      }

      .icon-dim {
        color: #94a3b8;
      }
      .icon-cyan {
        color: #00d2c4;
      }
      .icon-emerald {
        color: #10b981;
      }
      .icon-coral {
        color: #f43f5e;
      }

      .kpi-value {
        font-size: 1.65rem;
        font-weight: 700;
        color: #f8fafc;
        line-height: 1.15;
      }

      .kpi-subtext {
        font-size: 0.74rem;
        color: #64748b;
      }

      /* SETUPS CONTAINER */
      .setups-container {
        background: #151c2c;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 14px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 18px;
      }

      .setups-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
      }

      .section-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 1.05rem;
        font-weight: 700;
        color: #f8fafc;

        .material-symbols-rounded {
          color: #00d2c4;
          font-size: 22px;
        }
      }

      .count-badge {
        background: rgba(0, 210, 196, 0.14);
        color: #00d2c4;
        padding: 2px 9px;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 700;
      }

      .filter-bar {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
      }

      .filter-chips-bar {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
      }

      .filter-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: #0b0f19;
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #94a3b8;
        padding: 6px 12px;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 600;
        cursor: pointer;
        min-height: 34px;

        .mini-icon {
          font-size: 15px;
        }

        &:hover {
          color: #f8fafc;
          border-color: rgba(255, 255, 255, 0.25);
        }

        &.active {
          background: rgba(0, 210, 196, 0.16);
          border-color: #00d2c4;
          color: #00d2c4;
        }

        &.pill-bullish.active {
          background: rgba(16, 185, 129, 0.16);
          border-color: #10b981;
          color: #10b981;
        }

        &.pill-bearish.active {
          background: rgba(244, 63, 94, 0.16);
          border-color: #f43f5e;
          color: #f43f5e;
        }
      }

      .filter-selects {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .compact-select {
        background: #0b0f19;
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #e2e8f0;
        padding: 6px 10px;
        border-radius: 8px;
        font-size: 0.78rem;
        font-weight: 600;
        min-height: 34px;
        outline: none;

        &:focus {
          border-color: #00d2c4;
        }
      }

      /* EMPTY / LOADING STATES */
      .empty-state-card,
      .loading-state-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 40px 20px;
        background: #0b0f19;
        border: 1px dashed rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        gap: 12px;
      }

      .empty-icon-wrap {
        width: 56px;
        height: 56px;
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 210, 196, 0.12);
        color: #00d2c4;

        &.amber {
          background: rgba(245, 158, 11, 0.12);
          color: #f59e0b;
        }

        .material-symbols-rounded {
          font-size: 30px;
        }
      }

      .empty-title,
      .loading-title {
        font-size: 1.05rem;
        font-weight: 700;
        color: #f8fafc;
      }

      .empty-desc,
      .loading-desc {
        max-width: 560px;
        font-size: 0.85rem;
        line-height: 1.5;
        color: #94a3b8;
      }

      .empty-action-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #00d2c4;
        border: none;
        color: #0b0f19;
        padding: 10px 18px;
        border-radius: 9px;
        font-size: 0.86rem;
        font-weight: 700;
        cursor: pointer;
        margin-top: 4px;
        min-height: 40px;

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }

      .scan-spinner {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 3px solid rgba(0, 210, 196, 0.18);
        border-top-color: #00d2c4;
        animation: spin 0.9s linear infinite;
      }

      /* SUMMARY TABLE (DESKTOP) */
      .summary-table-wrapper {
        overflow-x: auto;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        background: #0b0f19;
      }

      .summary-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.83rem;

        th {
          text-align: left;
          padding: 10px 14px;
          color: #94a3b8;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        td {
          padding: 10px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          color: #e2e8f0;
        }

        tbody tr:last-child td {
          border-bottom: none;
        }

        .text-right {
          text-align: right;
        }
      }

      .summary-row {
        cursor: pointer;
        transition: background 0.15s ease;

        &:hover {
          background: rgba(255, 255, 255, 0.04);
        }
      }

      .sym-cell {
        font-weight: 700;
        color: #f8fafc;
      }

      .sweep-val {
        color: #fbbf24;
      }

      .time-cell {
        color: #94a3b8;
        font-size: 0.78rem;
      }

      .mini-chart-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: rgba(0, 210, 196, 0.12);
        border: 1px solid rgba(0, 210, 196, 0.3);
        color: #00d2c4;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;

        .material-symbols-rounded {
          font-size: 15px;
        }
      }

      /* BADGES */
      .signal-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 9px;
        border-radius: 6px;
        font-size: 0.74rem;
        font-weight: 800;
        letter-spacing: 0.03em;

        .material-symbols-rounded {
          font-size: 15px;
        }

        &.lg {
          padding: 6px 12px;
          font-size: 0.84rem;
          border-radius: 8px;

          .material-symbols-rounded {
            font-size: 18px;
          }
        }

        &.badge-buy {
          background: rgba(16, 185, 129, 0.16);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.38);
        }

        &.badge-sell {
          background: rgba(244, 63, 94, 0.16);
          color: #f43f5e;
          border: 1px solid rgba(244, 63, 94, 0.38);
        }
      }

      .level-pill {
        display: inline-flex;
        align-items: center;
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 0.72rem;
        font-weight: 700;
        background: rgba(0, 210, 196, 0.12);
        color: #00d2c4;
        border: 1px solid rgba(0, 210, 196, 0.3);

        &.pd-pill {
          background: rgba(245, 158, 11, 0.14);
          color: #f59e0b;
          border-color: rgba(245, 158, 11, 0.35);
        }
      }

      .session-date-pill {
        font-size: 0.72rem;
        color: #94a3b8;
        background: rgba(255, 255, 255, 0.05);
        padding: 2px 8px;
        border-radius: 6px;
      }

      /* RECOMMENDATION CARDS */
      .recommendation-cards-list {
        display: flex;
        flex-direction: column;
        gap: 18px;
      }

      .recommendation-card {
        background: #1e293b;
        border: 1px solid rgba(255, 255, 255, 0.09);
        border-radius: 14px;
        padding: 18px;
        display: flex;
        flex-direction: column;
        gap: 14px;

        &.buy-card {
          border-left: 4px solid #10b981;
        }

        &.sell-card {
          border-left: 4px solid #f43f5e;
        }
      }

      .rec-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px;
      }

      .rec-identity {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      .rec-title-wrap {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .rec-symbol-line {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
      }

      .rec-symbol {
        font-size: 1.05rem;
        font-weight: 800;
        color: #f8fafc;
      }

      .rec-subline {
        font-size: 0.78rem;
        color: #94a3b8;
      }

      .trade-setup-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        background: rgba(99, 102, 241, 0.16);
        border: 1px solid rgba(99, 102, 241, 0.4);
        color: #c7d2fe;
        padding: 8px 14px;
        border-radius: 8px;
        font-size: 0.82rem;
        font-weight: 700;
        cursor: pointer;
        min-height: 38px;
        transition: all 0.15s ease;

        .material-symbols-rounded {
          font-size: 17px;
        }

        &:hover {
          background: #6366f1;
          color: #ffffff;
        }
      }

      .rec-metrics-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
      }

      .metric-box {
        background: #0b0f19;
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 10px;
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .metric-label {
        font-size: 0.7rem;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }

      .metric-value {
        font-size: 0.98rem;
        font-weight: 700;
        color: #f8fafc;
      }

      .metric-meta {
        font-size: 0.7rem;
        color: #64748b;
      }

      .rec-chart-wrap {
        width: 100%;
      }

      /* RESPONSIVE BREAKPOINTS (RULE 6) */
      @media (max-width: 1023px) {
        .kpi-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .rec-metrics-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 768px) {
        .screener-root {
          padding-bottom: 88px;
        }

        .page-body {
          padding: 14px 12px;
          gap: 14px;
        }

        .control-header-card,
        .setups-container {
          padding: 14px;
        }

        .desktop-only {
          display: none !important;
        }

        .controls-toolbar {
          width: 100%;
          justify-content: space-between;
        }

        .mode-toggle {
          flex: 1;
        }

        .mode-btn {
          flex: 1;
          justify-content: center;
        }

        .run-scan-btn {
          width: 100%;
        }

        .historical-bar {
          flex-direction: column;
          align-items: stretch;
        }

        .date-inputs-group {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .date-input {
          width: 100%;
          box-sizing: border-box;
        }

        .recommendation-card {
          padding: 14px;
        }

        .trade-setup-btn {
          width: 100%;
        }
      }

      @media (max-width: 480px) {
        .page-title {
          font-size: 1.12rem;
        }

        .date-inputs-group {
          grid-template-columns: 1fr;
        }

        .kpi-value {
          font-size: 1.35rem;
        }

        .filter-selects {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr 1fr;
        }

        .compact-select {
          width: 100%;
        }
      }
    `,
  ],
})
export class ScreenerComponent {
  readonly screenerService = inject(ScreenerService);
  private readonly router = inject(Router);

  readonly minHistoricalDate = formatIstDateOffset(-59);
  readonly maxHistoricalDate = formatIstDateOffset(0);

  readonly activeSignalFilter = signal<'ALL' | 'BUY' | 'SELL'>('ALL');
  readonly activeLevelFilter = signal<'ALL' | LiquidityLevelType>('ALL');
  readonly activeSymbolFilter = signal<string>('ALL');

  readonly matchedSymbols = computed<string[]>(() => {
    const recs = this.screenerService.recommendations();
    return Array.from(new Set(recs.map((r) => r.symbol))).sort();
  });

  readonly filteredRecommendations = computed<LiquiditySweepSignal[]>(() => {
    const recs = this.screenerService.recommendations();
    const signalFilter = this.activeSignalFilter();
    const levelFilter = this.activeLevelFilter();
    const symbolFilter = this.activeSymbolFilter();

    return recs.filter((rec) => {
      if (signalFilter !== 'ALL' && rec.signalType !== signalFilter) return false;
      if (levelFilter !== 'ALL' && rec.levelType !== levelFilter) return false;
      if (symbolFilter !== 'ALL' && rec.symbol !== symbolFilter) return false;
      return true;
    });
  });

  selectMode(mode: ScreenerScanMode): void {
    this.screenerService.setMode(mode);
  }

  onStartDateChange(date: string): void {
    const currentEnd = this.screenerService.historicalEndDate();
    const nextEnd = !currentEnd || currentEnd < date ? date : currentEnd;
    this.screenerService.setHistoricalDates(date, nextEnd);
  }

  onEndDateChange(date: string): void {
    const currentStart = this.screenerService.historicalStartDate();
    const nextStart = !currentStart || currentStart > date ? date : currentStart;
    this.screenerService.setHistoricalDates(nextStart, date);
  }

  applyPreset(daysAgo: number): void {
    if (daysAgo === 0) {
      const today = formatIstDateOffset(0);
      this.screenerService.setHistoricalDates(today, today);
      return;
    }
    if (daysAgo === 1) {
      const yesterday = formatIstDateOffset(-1);
      this.screenerService.setHistoricalDates(yesterday, yesterday);
      return;
    }
    const start = formatIstDateOffset(-(daysAgo - 1));
    const end = formatIstDateOffset(0);
    this.screenerService.setHistoricalDates(start, end);
  }

  runScan(): void {
    this.activeSignalFilter.set('ALL');
    this.activeLevelFilter.set('ALL');
    this.activeSymbolFilter.set('ALL');
    this.screenerService.runScan();
  }

  trackBySignalId(_index: number, item: LiquiditySweepSignal): string {
    return item.id;
  }

  formatLevelLabel(levelType: LiquidityLevelType): string {
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

  formatIstTime(unixSeconds: number): string {
    if (!unixSeconds) return '--';
    return IST_TIME_FORMATTER.format(new Date(unixSeconds * 1000));
  }

  formatIstDateTime(unixSeconds: number): string {
    if (!unixSeconds) return '--';
    return IST_DATE_TIME_FORMATTER.format(new Date(unixSeconds * 1000));
  }

  formatSweepDistance(rec: LiquiditySweepSignal): string {
    const diff = Math.abs(rec.levelPrice - rec.sweepPrice);
    return diff.toFixed(2);
  }

  formatRiskPoints(rec: LiquiditySweepSignal): string {
    const diff = Math.abs(rec.confirmationClosePrice - rec.sweepPrice);
    return diff.toFixed(2);
  }

  formatRiskPercent(rec: LiquiditySweepSignal): string {
    if (!rec.confirmationClosePrice) return '0.00';
    const pct = (Math.abs(rec.confirmationClosePrice - rec.sweepPrice) / rec.confirmationClosePrice) * 100;
    return pct.toFixed(2);
  }

  scrollToCard(signalId: string): void {
    const el = document.getElementById(`signal-card-${signalId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  goToComposerWithSetup(rec: LiquiditySweepSignal): void {
    this.router.navigate(['/'], {
      queryParams: {
        symbol: rec.symbol,
        targetPrice: rec.confirmationClosePrice,
        stopLoss: rec.sweepPrice,
        strategy: `${rec.signalType}_${rec.levelType}_SWEEP`,
      },
    });
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ScreenerService } from '../../core/api/screener.service';
import {
  LiquidityLevelType,
  LiquiditySweepEvent,
  LiquiditySweepSignal,
  LiquiditySweepSymbolResult,
  OrderBlockSymbolResult,
  ScreenerScanMode,
  ScreenerStrategyType,
  SweepEntryMode,
} from '../../core/models/screener.models';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';
import { IstDatePipe } from '../../shared/pipes/ist-date.pipe';
import { SectionErrorComponent } from '../../shared/components/section-error/section-error.component';
import { SweepChartComponent } from './components/sweep-chart/sweep-chart.component';
import { OrderBlockChartComponent } from './components/order-block-chart/order-block-chart.component';

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
    MatTooltipModule,
    CurrencyInrPipe,
    IstDatePipe,
    SectionErrorComponent,
    SweepChartComponent,
    OrderBlockChartComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="screener-root">
      <main class="page-body">
        <!-- STRATEGY SELECTOR TABS -->
        <div class="strategy-switcher-bar">
          <div class="strategy-tabs" role="tablist" aria-label="Screener strategy switcher">
            <button
              type="button"
              class="strategy-tab"
              [class.active]="screenerService.activeStrategy() === 'liquidity-sweep'"
              (click)="selectStrategy('liquidity-sweep')"
              role="tab"
              [attr.aria-selected]="screenerService.activeStrategy() === 'liquidity-sweep'"
            >
              <span class="material-symbols-rounded tab-icon">radar</span>
              <span class="tab-title">Liquidity Sweep &amp; Reversal</span>
              <span class="strategy-pill">5m Intraday</span>
            </button>

            <button
              type="button"
              class="strategy-tab"
              [class.active]="screenerService.activeStrategy() === 'order-block'"
              (click)="selectStrategy('order-block')"
              role="tab"
              [attr.aria-selected]="screenerService.activeStrategy() === 'order-block'"
            >
              <span class="material-symbols-rounded tab-icon">layers</span>
              <span class="tab-title">Order Block (SMC / Supply &amp; Demand)</span>
              <span class="strategy-pill highlight-pill">MTF POI</span>
            </button>
          </div>
        </div>

        <!-- TOP CONTROL & ACTION BAR -->
        <section class="control-header-card">
          <div class="header-top-row">
            <div class="title-group">
              <div class="page-title">
                <span class="material-symbols-rounded page-icon">
                  {{ screenerService.activeStrategy() === 'order-block' ? 'layers' : 'radar' }}
                </span>
                <span>
                  {{ screenerService.activeStrategy() === 'order-block' ? 'Order Block (SMC) Strategy Scanner' : 'Liquidity Sweep Strategy Scanner' }}
                </span>
                <span class="tf-pill mono-val">
                  {{ screenerService.activeStrategy() === 'order-block' ? screenerService.htfTimeframe() + ' + ' + screenerService.ltfTimeframe() : screenerService.sweepTimeframe() }}
                </span>
              </div>
              <div class="page-subtitle">
                <ng-container *ngIf="screenerService.activeStrategy() === 'order-block'">
                  Institutional Order Blocks &bull; Fair Value Gaps (FVG) &bull; BoS / CHoCH &bull; Unmitigated POI Sniper Confirmation
                </ng-container>
                <ng-container *ngIf="screenerService.activeStrategy() === 'liquidity-sweep'">
                  Resting Stop Pools (BSL/SSL) &bull; Equal Highs / Lows (EQH/EQL) &bull; Sweep Rejection &bull; Opposing Target TP (1:2.5+ R:R)
                </ng-container>
                <span *ngIf="screenerService.lastScannedAt() as lastScan">
                  &bull; Last run at {{ lastScan | istDate : 'timeOnly' }}
                </span>
              </div>
            </div>

            <!-- Mode Selector + TF Selectors + Run Scan CTA -->
            <div class="controls-toolbar">
              <!-- Liquidity Sweep Strategy Pickers -->
              <div *ngIf="screenerService.activeStrategy() === 'liquidity-sweep'" class="mtf-pickers-group">
                <div class="tf-toggle-wrap">
                  <span class="tf-caption">Timeframe:</span>
                  <div class="mini-toggle" role="group">
                    <button
                      type="button"
                      class="mini-toggle-btn"
                      [class.active]="screenerService.sweepTimeframe() === '5m'"
                      (click)="selectSweepTf('5m')"
                      [disabled]="screenerService.isScanning()"
                    >
                      5m
                    </button>
                    <button
                      type="button"
                      class="mini-toggle-btn"
                      [class.active]="screenerService.sweepTimeframe() === '15m'"
                      (click)="selectSweepTf('15m')"
                      [disabled]="screenerService.isScanning()"
                    >
                      15m
                    </button>
                    <button
                      type="button"
                      class="mini-toggle-btn"
                      [class.active]="screenerService.sweepTimeframe() === '1h'"
                      (click)="selectSweepTf('1h')"
                      [disabled]="screenerService.isScanning()"
                    >
                      1H
                    </button>
                  </div>
                </div>

                <div class="tf-toggle-wrap">
                  <span class="tf-caption">Entry Mode:</span>
                  <div class="mini-toggle" role="group">
                    <button
                      type="button"
                      class="mini-toggle-btn"
                      [class.active]="screenerService.sweepEntryMode() === 'RECLAIM_CLOSE'"
                      (click)="selectSweepEntry('RECLAIM_CLOSE')"
                      [disabled]="screenerService.isScanning()"
                      title="Immediate Post-Sweep Reclaim Close"
                    >
                      Reclaim Close
                    </button>
                    <button
                      type="button"
                      class="mini-toggle-btn"
                      [class.active]="screenerService.sweepEntryMode() === 'LTF_STRUCTURE_SHIFT'"
                      (click)="selectSweepEntry('LTF_STRUCTURE_SHIFT')"
                      [disabled]="screenerService.isScanning()"
                      title="Confirmation Entry on LTF Structure Break (CHoCH)"
                    >
                      LTF CHoCH
                    </button>
                  </div>
                </div>
              </div>

              <!-- Order Block MTF Pickers -->
              <div *ngIf="screenerService.activeStrategy() === 'order-block'" class="mtf-pickers-group">
                <div class="tf-toggle-wrap">
                  <span class="tf-caption">HTF POI:</span>
                  <div class="mini-toggle" role="group">
                    <button
                      type="button"
                      class="mini-toggle-btn"
                      [class.active]="screenerService.htfTimeframe() === '1h'"
                      (click)="selectHtf('1h')"
                      [disabled]="screenerService.isScanning()"
                    >
                      1H
                    </button>
                    <button
                      type="button"
                      class="mini-toggle-btn"
                      [class.active]="screenerService.htfTimeframe() === '4h'"
                      (click)="selectHtf('4h')"
                      [disabled]="screenerService.isScanning()"
                    >
                      4H
                    </button>
                  </div>
                </div>

                <div class="tf-toggle-wrap">
                  <span class="tf-caption">LTF Entry:</span>
                  <div class="mini-toggle" role="group">
                    <button
                      type="button"
                      class="mini-toggle-btn"
                      [class.active]="screenerService.ltfTimeframe() === '5m'"
                      (click)="selectLtf('5m')"
                      [disabled]="screenerService.isScanning()"
                    >
                      5m
                    </button>
                    <button
                      type="button"
                      class="mini-toggle-btn"
                      [class.active]="screenerService.ltfTimeframe() === '15m'"
                      (click)="selectLtf('15m')"
                      [disabled]="screenerService.isScanning()"
                    >
                      15m
                    </button>
                  </div>
                </div>
              </div>

              <!-- Live vs Historical Mode Toggle -->
              <div class="mode-toggle" role="group" aria-label="Scan mode selector">
                <button
                  type="button"
                  class="mode-btn"
                  [class.active]="screenerService.scanMode() === 'live'"
                  (click)="selectMode('live')"
                  [disabled]="screenerService.isScanning()"
                  matTooltip="Evaluates current market bars and unmitigated POIs"
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
                matTooltip="Execute on-demand scan"
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

          <!-- Configured Traded Instruments Strip (master_data/traded_instruments) -->
          <div class="universe-strip">
            <span class="universe-label">
              <span class="material-symbols-rounded">playlist_add_check</span>
              <span>Traded Instruments ({{ screenerService.instrumentCount() }}):</span>
            </span>
            <div class="universe-chips" *ngIf="screenerService.instruments().length > 0">
              <span
                class="inst-chip index-chip"
                *ngFor="let inst of screenerService.instruments()"
                [title]="inst.symbol"
              >
                {{ inst.displayName || inst.name || inst.symbol }}
              </span>
            </div>
            <div
              class="universe-empty"
              *ngIf="!screenerService.isLoadingInstruments() && screenerService.instruments().length === 0 && !screenerService.instrumentsError()"
            >
              No traded instruments configured in Firestore. Please add records to master_data/traded_instruments.
            </div>
            <div
              class="universe-loading"
              *ngIf="screenerService.isLoadingInstruments()"
            >
              <span class="material-symbols-rounded spinning">sync</span>
              <span>Loading traded instruments...</span>
            </div>
          </div>
        </section>

        <!-- SECTION ERROR: INSTRUMENTS LOAD FAILURE -->
        <app-section-error
          *ngIf="screenerService.instrumentsError() as instErr"
          [title]="'Traded Instruments Offline'"
          [message]="instErr"
          (retry)="screenerService.loadInstruments()"
        ></app-section-error>

        <!-- KPI SUMMARY METRICS STRIP -->
        <!-- 1. LIQUIDITY SWEEP METRICS -->
        <section *ngIf="screenerService.activeStrategy() === 'liquidity-sweep'" class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">
              <span class="material-symbols-rounded icon-dim">hub</span>
              <span>Instruments Scanned</span>
            </div>
            <div class="kpi-value mono-val">
              {{ screenerService.scanResults() ? screenerService.totalScanned() : screenerService.instrumentCount() }}
            </div>
            <div class="kpi-subtext">From Firestore master_data/traded_instruments</div>
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

        <!-- 2. ORDER BLOCK (SMC) METRICS -->
        <section *ngIf="screenerService.activeStrategy() === 'order-block'" class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">
              <span class="material-symbols-rounded icon-dim">hub</span>
              <span>Instruments</span>
            </div>
            <div class="kpi-value mono-val">
              {{ screenerService.orderBlockResults() ? screenerService.orderBlockResults()?.totalScanned : screenerService.instrumentCount() }}
            </div>
            <div class="kpi-subtext">Traded master universe</div>
          </div>

          <div class="kpi-card highlight-cyan">
            <div class="kpi-label">
              <span class="material-symbols-rounded icon-cyan">layers</span>
              <span>Active Unmitigated OBs</span>
            </div>
            <div class="kpi-value mono-val">
              {{ screenerService.totalActiveOrderBlocks() }}
            </div>
            <div class="kpi-subtext">{{ screenerService.htfTimeframe() }} POI with FVG confluence</div>
          </div>

          <div class="kpi-card highlight-amber">
            <div class="kpi-label">
              <span class="material-symbols-rounded text-amber">near_me</span>
              <span>Approaching POI</span>
            </div>
            <div class="kpi-value mono-val text-amber">
              {{ screenerService.approachingCount() }}
            </div>
            <div class="kpi-subtext">Within 0.5% of proximal edge</div>
          </div>

          <div class="kpi-card highlight-coral">
            <div class="kpi-label">
              <span class="material-symbols-rounded text-coral">touch_app</span>
              <span>Active Taps (Mitigating)</span>
            </div>
            <div class="kpi-value mono-val text-coral">
              {{ screenerService.mitigatingCount() }}
            </div>
            <div class="kpi-subtext">Price inside [zoneLow, zoneHigh]</div>
          </div>

          <div class="kpi-card highlight-emerald">
            <div class="kpi-label">
              <span class="material-symbols-rounded icon-emerald">gps_fixed</span>
              <span>Sniper Setups</span>
            </div>
            <div class="kpi-value mono-val text-emerald">
              {{ screenerService.totalSniperSignals() }}
            </div>
            <div class="kpi-subtext">LTF CHoCH confirmed (&ge; 1:2.5 R:R)</div>
          </div>
        </section>

        <!-- SECTION ERROR: SCAN FAILURE -->
        <app-section-error
          *ngIf="screenerService.scanError() as err"
          [title]="'Screener Scan Notice'"
          [message]="err"
          (retry)="runScan()"
        ></app-section-error>

        <!-- ======================================================== -->
        <!-- STRATEGY 1: LIQUIDITY SWEEP & REVERSAL RESULTS VIEW      -->
        <!-- ======================================================== -->
        <section *ngIf="screenerService.activeStrategy() === 'liquidity-sweep'" class="setups-container">
          <div class="setups-header">
            <div class="section-title">
              <span class="material-symbols-rounded">radar</span>
              <span>Liquidity Sweep Strategy Scanned Instruments &amp; Pools</span>
              <span class="count-badge mono-val" *ngIf="filteredSweepSymbols().length > 0">
                {{ filteredSweepSymbols().length }}
              </span>
              <span class="count-badge mono-val" *ngIf="filteredSweepSymbols().length === 0 && filteredRecommendations().length > 0">
                {{ filteredRecommendations().length }}
              </span>
            </div>

            <!-- Filters Bar -->
            <div class="filter-bar" *ngIf="screenerService.liquiditySweepSymbols().length > 0 || screenerService.totalRecommendations() > 0">
              <div class="filter-chips-bar">
                <button
                  type="button"
                  class="filter-pill"
                  [class.active]="activeSignalFilter() === 'ALL' && activeSweepFilter() === 'ALL'"
                  (click)="activeSignalFilter.set('ALL'); activeSweepFilter.set('ALL')"
                >
                  All ({{ screenerService.liquiditySweepSymbols().length || screenerService.totalRecommendations() }})
                </button>
                <button
                  type="button"
                  class="filter-pill pill-bullish"
                  [class.active]="activeSignalFilter() === 'BUY' || activeSweepFilter() === 'BUY'"
                  (click)="activeSignalFilter.set('BUY'); activeSweepFilter.set('BUY')"
                >
                  <span class="material-symbols-rounded mini-icon">trending_up</span>
                  BUY ({{ screenerService.bullishCount() }})
                </button>
                <button
                  type="button"
                  class="filter-pill pill-bearish"
                  [class.active]="activeSignalFilter() === 'SELL' || activeSweepFilter() === 'SELL'"
                  (click)="activeSignalFilter.set('SELL'); activeSweepFilter.set('SELL')"
                >
                  <span class="material-symbols-rounded mini-icon">trending_down</span>
                  SELL ({{ screenerService.bearishCount() }})
                </button>
                <button
                  type="button"
                  class="filter-pill pill-amber"
                  [class.active]="activeSweepFilter() === 'SIGNAL'"
                  (click)="activeSweepFilter.set('SIGNAL')"
                  *ngIf="screenerService.liquiditySweepSymbols().length > 0"
                >
                  <span class="material-symbols-rounded mini-icon">bolt</span>
                  Signals ({{ screenerService.totalSweepSignals() }})
                </button>
                <button
                  type="button"
                  class="filter-pill pill-tap"
                  [class.active]="activeSweepFilter() === 'EQ_POOLS'"
                  (click)="activeSweepFilter.set('EQ_POOLS')"
                  *ngIf="screenerService.liquiditySweepSymbols().length > 0"
                >
                  <span class="material-symbols-rounded mini-icon">join_inner</span>
                  EQH / EQL Pools
                </button>
              </div>

              <div class="filter-selects">
                <select
                  class="compact-select"
                  [ngModel]="activeLevelFilter()"
                  (ngModelChange)="activeLevelFilter.set($event)"
                  aria-label="Filter by liquidity level"
                  *ngIf="screenerService.liquiditySweepSymbols().length === 0"
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
            <div class="empty-title">Ready for Standalone Liquidity Sweep Scan</div>
            <div class="empty-desc">
              Click <strong>Run Scan</strong> to detect resting stop pools (BSL/SSL, EQH/EQL) and confirmed rejection sweeps.
            </div>
            <button
              type="button"
              class="run-scan-btn lg"
              (click)="runScan()"
              [disabled]="screenerService.instrumentCount() === 0"
            >
              <span class="material-symbols-rounded">play_arrow</span>
              <span>Run {{ screenerService.scanMode() === 'live' ? 'Live' : 'Historical' }} Scan</span>
            </button>
          </div>

          <!-- Loading State -->
          <div *ngIf="screenerService.isScanning()" class="loading-state-card">
            <div class="spinner-large">
              <span class="material-symbols-rounded spinning">sync</span>
            </div>
            <div class="loading-title">Scanning Market Data for Liquidity Sweeps...</div>
            <div class="loading-desc">
              Analyzing {{ screenerService.sweepTimeframe() }} candles across {{ screenerService.instrumentCount() }} configured indices ({{ screenerService.scanMode() }} mode).
            </div>
          </div>

          <!-- Empty Results State (Scan completed with 0 matches) -->
          <div
            *ngIf="
              screenerService.scanResults() &&
              screenerService.liquiditySweepSymbols().length === 0 &&
              screenerService.totalRecommendations() === 0 &&
              !screenerService.isScanning()
            "
            class="empty-state-card no-signals"
          >
            <div class="empty-icon-wrap dim">
              <span class="material-symbols-rounded">check_circle</span>
            </div>
            <div class="empty-title">No Liquidity Sweep Signals Detected</div>
            <div class="empty-desc">
              No confirmed liquidity sweeps were detected across the configured indices for the current lookback.
            </div>
          </div>

          <!-- 1. STANDALONE LIQUIDITY SWEEP SYMBOLS VIEW -->
          <div
            *ngIf="filteredSweepSymbols().length > 0 && !screenerService.isScanning()"
            class="recommendation-cards-list"
          >
            <article
              *ngFor="let item of filteredSweepSymbols(); trackBy: trackBySweepSymbol"
              [id]="'sweep-card-' + item.symbol"
              class="recommendation-card"
              [class.buy-card]="item.signal?.action === 'BUY'"
              [class.sell-card]="item.signal?.action === 'SELL'"
            >
              <div class="rec-card-header">
                <div class="rec-identity">
                  <span
                    class="signal-badge lg"
                    [class.badge-buy]="item.signal?.action === 'BUY'"
                    [class.badge-sell]="item.signal?.action === 'SELL'"
                    *ngIf="item.signal"
                  >
                    <span class="material-symbols-rounded">
                      {{ item.signal.action === 'BUY' ? 'trending_up' : 'trending_down' }}
                    </span>
                    <span>{{ item.signal.action }} (1:{{ item.signal.rrRatio | number : '1.1-1' }} R:R)</span>
                  </span>

                  <span
                    class="signal-badge lg badge-neutral"
                    *ngIf="!item.signal && item.recentSweeps.length > 0"
                  >
                    <span class="material-symbols-rounded">radar</span>
                    <span>{{ item.recentSweeps[item.recentSweeps.length - 1].direction }} SWEEP</span>
                  </span>

                  <div class="rec-title-wrap">
                    <div class="rec-symbol-line">
                      <span class="rec-symbol mono-val">{{ item.displayName || item.name || item.symbol }}</span>
                      <span class="level-pill mono-val">{{ item.timeframe }}</span>
                      <span class="session-date-pill mono-val" *ngIf="item.activePools.length > 0">
                        {{ item.activePools.length }} Active Pools
                      </span>
                    </div>
                    <div class="rec-subline">
                      {{ item.symbol }} &bull; {{ getBslPoolsCount(item) }} BSL / {{ getSslPoolsCount(item) }} SSL
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  class="trade-setup-btn"
                  (click)="goToComposerWithSweepSymbol(item)"
                  matTooltip="Pre-fill Conditional Alert Composer on Live Monitor"
                >
                  <span class="material-symbols-rounded">bolt</span>
                  <span>Create Alert</span>
                </button>
              </div>

              <!-- Key Metrics Grid -->
              <div class="rec-metrics-grid mono-val">
                <div class="metric-box" *ngIf="getLatestSweep(item) as sw">
                  <span class="metric-label">Latest Swept Level</span>
                  <span class="metric-value text-amber">
                    {{ sw.sweptPrice | currencyInr }}
                  </span>
                  <span class="metric-meta">{{ sw.poolType }} level</span>
                </div>

                <div class="metric-box" *ngIf="getLatestSweep(item) as sw">
                  <span class="metric-label">Extreme Sweep Wick</span>
                  <span class="metric-value text-amber">
                    {{ sw.sweepWickExtreme | currencyInr }}
                  </span>
                  <span class="metric-meta">Absorption pivot</span>
                </div>

                <div class="metric-box" *ngIf="item.signal as sig">
                  <span class="metric-label">Entry ({{ sig.entryMode }})</span>
                  <span
                    class="metric-value"
                    [class.text-emerald]="sig.action === 'BUY'"
                    [class.text-coral]="sig.action === 'SELL'"
                  >
                    {{ sig.entryPrice | currencyInr }}
                  </span>
                  <span class="metric-meta">Reclaim Close</span>
                </div>

                <div class="metric-box" *ngIf="item.signal as sig">
                  <span class="metric-label">Stop Loss &bull; Target TP</span>
                  <span class="metric-value text-emerald">
                    SL: {{ sig.stopLoss | currencyInr }} &bull; TP: {{ sig.takeProfit | currencyInr }}
                  </span>
                  <span class="metric-meta">1:{{ sig.rrRatio }} R:R to {{ sig.targetPoolPrice | currencyInr }}</span>
                </div>
              </div>

              <!-- Interactive TradingView Lightweight Chart (v5) -->
              <div class="rec-chart-wrap">
                <app-sweep-chart [result]="item"></app-sweep-chart>
              </div>
            </article>
          </div>

          <!-- 2. LEGACY / FALLBACK RECOMMENDATION CARDS VIEW -->
          <div
            *ngIf="filteredSweepSymbols().length === 0 && filteredRecommendations().length > 0 && !screenerService.isScanning()"
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
                      <span class="rec-symbol mono-val">{{ rec.displayName || rec.name || rec.symbol }}</span>
                      <span
                        class="level-pill mono-val"
                        [class.pd-pill]="rec.levelType === 'PDH' || rec.levelType === 'PDL'"
                      >
                        {{ formatLevelLabel(rec.levelType) }} Sweep
                      </span>
                      <span class="session-date-pill mono-val">{{ rec.sessionDate }}</span>
                    </div>
                    <div class="rec-subline">
                      {{ rec.symbol }} &bull; Confirmed {{ formatIstDateTime(rec.confirmationTimestamp) }} IST
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

        <!-- ======================================================== -->
        <!-- STRATEGY 2: ORDER BLOCK (SMC / DEMAND & SUPPLY) VIEW     -->
        <!-- ======================================================== -->
        <section *ngIf="screenerService.activeStrategy() === 'order-block'" class="setups-container">
          <div class="setups-header">
            <div class="section-title">
              <span class="material-symbols-rounded">layers</span>
              <span>Order Block (SMC) Scanned Instruments &amp; POIs</span>
              <span class="count-badge mono-val" *ngIf="filteredOrderBlocks().length > 0">
                {{ filteredOrderBlocks().length }}
              </span>
            </div>

            <!-- Order Block Filter Bar -->
            <div class="filter-bar" *ngIf="screenerService.orderBlockSymbols().length > 0">
              <div class="filter-chips-bar">
                <button
                  type="button"
                  class="filter-pill"
                  [class.active]="activeObFilter() === 'ALL'"
                  (click)="activeObFilter.set('ALL')"
                >
                  All ({{ screenerService.orderBlockSymbols().length }})
                </button>
                <button
                  type="button"
                  class="filter-pill pill-bullish"
                  [class.active]="activeObFilter() === 'DEMAND'"
                  (click)="activeObFilter.set('DEMAND')"
                >
                  <span class="material-symbols-rounded mini-icon">trending_up</span>
                  Demand OBs
                </button>
                <button
                  type="button"
                  class="filter-pill pill-bearish"
                  [class.active]="activeObFilter() === 'SUPPLY'"
                  (click)="activeObFilter.set('SUPPLY')"
                >
                  <span class="material-symbols-rounded mini-icon">trending_down</span>
                  Supply OBs
                </button>
                <button
                  type="button"
                  class="filter-pill pill-amber"
                  [class.active]="activeObFilter() === 'APPROACHING'"
                  (click)="activeObFilter.set('APPROACHING')"
                >
                  <span class="material-symbols-rounded mini-icon">near_me</span>
                  Approaching ({{ screenerService.approachingCount() }})
                </button>
                <button
                  type="button"
                  class="filter-pill pill-tap"
                  [class.active]="activeObFilter() === 'MITIGATING'"
                  (click)="activeObFilter.set('MITIGATING')"
                >
                  <span class="material-symbols-rounded mini-icon">touch_app</span>
                  Active Tap ({{ screenerService.mitigatingCount() }})
                </button>
                <button
                  type="button"
                  class="filter-pill pill-sniper"
                  [class.active]="activeObFilter() === 'SNIPER'"
                  (click)="activeObFilter.set('SNIPER')"
                >
                  <span class="material-symbols-rounded mini-icon">gps_fixed</span>
                  Sniper Setups ({{ screenerService.totalSniperSignals() }})
                </button>
              </div>

              <div class="filter-selects">
                <select
                  class="compact-select"
                  [ngModel]="activeObSymbolFilter()"
                  (ngModelChange)="activeObSymbolFilter.set($event)"
                  aria-label="Filter by instrument"
                >
                  <option value="ALL">All Instruments</option>
                  <option *ngFor="let sym of matchedObSymbols()" [value]="sym">
                    {{ sym }}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <!-- Initial State (No Scan Executed Yet) -->
          <div
            *ngIf="!screenerService.orderBlockResults() && !screenerService.isScanning()"
            class="empty-state-card"
          >
            <div class="empty-icon-wrap">
              <span class="material-symbols-rounded">layers</span>
            </div>
            <div class="empty-title">Ready for Multi-Timeframe Order Block Scan</div>
            <div class="empty-desc">
              Scan institutional Order Blocks across <strong>{{ screenerService.htfTimeframe() }}</strong> HTF and <strong>{{ screenerService.ltfTimeframe() }}</strong> LTF with FVG confluence and structural BoS/CHoCH confirmation.
            </div>
            <button
              type="button"
              class="run-scan-btn lg"
              (click)="runScan()"
              [disabled]="screenerService.instrumentCount() === 0"
            >
              <span class="material-symbols-rounded">play_arrow</span>
              <span>Run {{ screenerService.htfTimeframe() }} + {{ screenerService.ltfTimeframe() }} SMC Scan</span>
            </button>
          </div>

          <!-- Loading State -->
          <div *ngIf="screenerService.isScanning()" class="loading-state-card">
            <div class="spinner-large">
              <span class="material-symbols-rounded spinning">sync</span>
            </div>
            <div class="loading-title">Scanning HTF &amp; LTF Order Blocks...</div>
            <div class="loading-desc">
              Analyzing fractal swings, Fair Value Gaps, and unmitigated POIs across {{ screenerService.instrumentCount() }} configured instruments.
            </div>
          </div>

          <!-- Empty Results State (Scan completed with 0 matches) -->
          <div
            *ngIf="
              screenerService.orderBlockResults() &&
              screenerService.orderBlockSymbols().length === 0 &&
              !screenerService.isScanning()
            "
            class="empty-state-card no-signals"
          >
            <div class="empty-icon-wrap dim">
              <span class="material-symbols-rounded">check_circle</span>
            </div>
            <div class="empty-title">No Active Order Blocks Found</div>
            <div class="empty-desc">
              All detected historical Order Blocks in this lookback have been mitigated or invalidated.
            </div>
          </div>

          <!-- Summary Jump Table for Order Blocks (Desktop) -->
          <div
            *ngIf="filteredOrderBlocks().length > 0 && !screenerService.isScanning()"
            class="summary-table-wrapper desktop-only"
          >
            <table class="summary-table">
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th>Trend Bias</th>
                  <th>Active POI</th>
                  <th>Zone Range</th>
                  <th>50% EQ</th>
                  <th>Status</th>
                  <th>Trade Setup</th>
                  <th class="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  *ngFor="let item of filteredOrderBlocks(); trackBy: trackByObSymbol"
                  class="summary-row"
                  [class.buy-row]="item.tradeSignal?.signalType === 'BUY'"
                  [class.sell-row]="item.tradeSignal?.signalType === 'SELL'"
                  (click)="scrollToObCard(item.symbol)"
                >
                  <td class="mono-val sym-cell">{{ item.displayName || item.name || item.symbol }}</td>
                  <td>
                    <span
                      class="bias-badge mono-val"
                      [class.bias-bullish]="item.trendBias === 'BULLISH'"
                      [class.bias-bearish]="item.trendBias === 'BEARISH'"
                      [class.bias-neutral]="item.trendBias === 'NEUTRAL'"
                    >
                      {{ item.trendBias }}
                    </span>
                  </td>
                  <td>
                    <ng-container *ngIf="item.activeOrderBlocks[0] as ob; else noOb">
                      <span
                        class="level-pill mono-val"
                        [class.demand-pill]="ob.type === 'BULLISH'"
                        [class.supply-pill]="ob.type === 'BEARISH'"
                      >
                        {{ ob.type === 'BULLISH' ? 'Demand' : 'Supply' }} ({{ ob.obType }})
                      </span>
                    </ng-container>
                    <ng-template #noOb>
                      <span class="dim-text mono-val">None active</span>
                    </ng-template>
                  </td>
                  <td class="mono-val">
                    {{ item.activeOrderBlocks[0] ? (item.activeOrderBlocks[0].zoneLow | currencyInr) + ' – ' + (item.activeOrderBlocks[0].zoneHigh | currencyInr) : '--' }}
                  </td>
                  <td class="mono-val">
                    {{ item.activeOrderBlocks[0] ? (item.activeOrderBlocks[0].equilibrium | currencyInr) : '--' }}
                  </td>
                  <td>
                    <span
                      class="status-pill mono-val"
                      [class.status-sniper]="item.tradeSignal"
                      [class.status-mitigating]="item.proximityStatus === 'MITIGATING' && !item.tradeSignal"
                      [class.status-approaching]="item.proximityStatus === 'APPROACHING' && !item.tradeSignal"
                    >
                      {{ item.tradeSignal ? 'SNIPER ' + item.tradeSignal.signalType : item.proximityStatus }}
                    </span>
                  </td>
                  <td class="mono-val">
                    <ng-container *ngIf="item.tradeSignal as sig; else noSig">
                      <span class="text-emerald">Entry {{ sig.entryPrice | currencyInr }} (1:{{ sig.rrRatio }} R:R)</span>
                    </ng-container>
                    <ng-template #noSig>
                      <span class="dim-text">--</span>
                    </ng-template>
                  </td>
                  <td class="text-right" (click)="$event.stopPropagation()">
                    <button
                      type="button"
                      class="mini-chart-btn"
                      (click)="scrollToObCard(item.symbol)"
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

          <!-- INDIVIDUAL ORDER BLOCK CARDS + INTERACTIVE LIGHTWEIGHT CHARTS -->
          <div
            *ngIf="filteredOrderBlocks().length > 0 && !screenerService.isScanning()"
            class="recommendation-cards-list"
          >
            <article
              *ngFor="let item of filteredOrderBlocks(); trackBy: trackByObSymbol"
              [id]="'ob-card-' + item.symbol"
              class="recommendation-card"
              [class.buy-card]="item.tradeSignal?.signalType === 'BUY'"
              [class.sell-card]="item.tradeSignal?.signalType === 'SELL'"
            >
              <!-- Card Header -->
              <div class="rec-card-header">
                <div class="rec-identity">
                  <!-- Trade Signal or Status Badge -->
                  <span
                    *ngIf="item.tradeSignal as sig; else statusBadgeTpl"
                    class="signal-badge lg"
                    [class.badge-buy]="sig.signalType === 'BUY'"
                    [class.badge-sell]="sig.signalType === 'SELL'"
                  >
                    <span class="material-symbols-rounded">
                      {{ sig.signalType === 'BUY' ? 'trending_up' : 'trending_down' }}
                    </span>
                    <span>SNIPER {{ sig.signalType }} (1:{{ sig.rrRatio }} R:R)</span>
                  </span>

                  <ng-template #statusBadgeTpl>
                    <span
                      class="status-badge-lg mono-val"
                      [class.badge-mitigating]="item.proximityStatus === 'MITIGATING'"
                      [class.badge-approaching]="item.proximityStatus === 'APPROACHING'"
                    >
                      <span class="material-symbols-rounded">
                        {{ item.proximityStatus === 'MITIGATING' ? 'touch_app' : item.proximityStatus === 'APPROACHING' ? 'near_me' : 'layers' }}
                      </span>
                      <span>{{ item.proximityStatus === 'MITIGATING' ? 'ACTIVE TAP' : item.proximityStatus === 'APPROACHING' ? 'APPROACHING' : 'MONITORING' }}</span>
                    </span>
                  </ng-template>

                  <div class="rec-title-wrap">
                    <div class="rec-symbol-line">
                      <span class="rec-symbol mono-val">{{ item.displayName || item.name || item.symbol }}</span>
                      <span
                        class="bias-badge mono-val"
                        [class.bias-bullish]="item.trendBias === 'BULLISH'"
                        [class.bias-bearish]="item.trendBias === 'BEARISH'"
                        [class.bias-neutral]="item.trendBias === 'NEUTRAL'"
                      >
                        {{ item.trendBias }}
                      </span>
                      <span class="tf-badge mono-val">{{ item.timeframe }}</span>
                    </div>
                    <div class="rec-subline">
                      {{ item.symbol }} &bull; {{ item.activeOrderBlocks.length }} active unmitigated POIs
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  class="trade-setup-btn"
                  (click)="goToComposerWithOrderBlock(item)"
                  matTooltip="Pre-fill Conditional Alert Composer with setup"
                >
                  <span class="material-symbols-rounded">bolt</span>
                  <span>Create Alert</span>
                </button>
              </div>

              <!-- Key Metrics Grid -->
              <div class="rec-metrics-grid mono-val">
                <div class="metric-box">
                  <span class="metric-label">Primary POI</span>
                  <span
                    class="metric-value"
                    [class.text-emerald]="item.activeOrderBlocks[0]?.type === 'BULLISH'"
                    [class.text-coral]="item.activeOrderBlocks[0]?.type === 'BEARISH'"
                  >
                    {{ item.activeOrderBlocks[0] ? item.activeOrderBlocks[0].type + ' (' + item.activeOrderBlocks[0].obType + ')' : '--' }}
                  </span>
                  <span class="metric-meta">
                    Zone: {{ item.activeOrderBlocks[0] ? (item.activeOrderBlocks[0].zoneLow | currencyInr) + ' – ' + (item.activeOrderBlocks[0].zoneHigh | currencyInr) : '--' }}
                  </span>
                </div>

                <div class="metric-box">
                  <span class="metric-label">50% Equilibrium (EQ)</span>
                  <span class="metric-value text-amber">
                    {{ item.activeOrderBlocks[0] ? (item.activeOrderBlocks[0].equilibrium | currencyInr) : '--' }}
                  </span>
                  <span class="metric-meta">Institutional Midline</span>
                </div>

                <div class="metric-box">
                  <span class="metric-label">Fair Value Gap (FVG)</span>
                  <span class="metric-value text-cyan">
                    {{ item.activeOrderBlocks[0]?.fvgBounds ? (item.activeOrderBlocks[0]!.fvgBounds!.bottom | currencyInr) + ' – ' + (item.activeOrderBlocks[0]!.fvgBounds!.top | currencyInr) : 'None' }}
                  </span>
                  <span class="metric-meta">Displacement Imbalance</span>
                </div>

                <div class="metric-box">
                  <span class="metric-label">
                    {{ item.tradeSignal ? 'Sniper Risk:Reward' : 'Proximity Distance' }}
                  </span>
                  <span
                    class="metric-value"
                    [class.text-emerald]="item.tradeSignal"
                  >
                    {{ item.tradeSignal ? '1:' + item.tradeSignal.rrRatio + ' R:R' : (item.activeOrderBlocks[0]?.proximityPercent ? item.activeOrderBlocks[0]?.proximityPercent + '%' : 'Tapped') }}
                  </span>
                  <span class="metric-meta">
                    {{ item.tradeSignal ? 'Entry: ' + (item.tradeSignal.entryPrice | currencyInr) : 'To Proximal Edge' }}
                  </span>
                </div>
              </div>

              <!-- Interactive TradingView Lightweight Chart (Order Block Overlay) -->
              <div class="rec-chart-wrap">
                <app-order-block-chart [result]="item"></app-order-block-chart>
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
        display: flex;
        flex-direction: column;
        min-height: 100%;
        background-color: #0b0f19;
        color: #e2e8f0;
        font-family: 'Google Sans', 'Roboto Flex', sans-serif;
        padding-bottom: 72px;
      }

      .page-body {
        max-width: 1400px;
        width: 100%;
        margin: 0 auto;
        padding: 20px 24px 32px;
        display: flex;
        flex-direction: column;
        gap: 20px;
        box-sizing: border-box;
      }

      .mono-val {
        font-family: 'JetBrains Mono', monospace;
      }

      /* STRATEGY SWITCHER TABS */
      .strategy-switcher-bar {
        width: 100%;
      }

      .strategy-tabs {
        display: inline-flex;
        align-items: center;
        background: #151c2c;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 4px;
        gap: 6px;
        flex-wrap: wrap;
      }

      .strategy-tab {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        background: transparent;
        border: none;
        border-radius: 8px;
        color: #94a3b8;
        font-size: 0.82rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;

        .tab-icon {
          font-size: 18px;
        }

        .strategy-pill {
          padding: 2px 7px;
          border-radius: 999px;
          font-size: 0.68rem;
          font-weight: 700;
          background: rgba(255, 255, 255, 0.06);
          color: #94a3b8;
          font-family: 'JetBrains Mono', monospace;

          &.highlight-pill {
            background: rgba(0, 210, 196, 0.15);
            color: #00d2c4;
          }
        }

        &:hover {
          color: #f8fafc;
          background: rgba(255, 255, 255, 0.04);
        }

        &.active {
          color: #f8fafc;
          background: #1e293b;
          border: 1px solid rgba(0, 210, 196, 0.35);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
        }
      }

      /* CONTROL HEADER CARD */
      .control-header-card {
        background: #151c2c;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 14px;
        padding: 20px 24px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .header-top-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
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
        gap: 10px;
        font-size: 1.25rem;
        font-weight: 700;
        color: #f8fafc;
        letter-spacing: -0.01em;

        .page-icon {
          color: #00d2c4;
          font-size: 24px;
        }

        .tf-pill {
          font-size: 0.72rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 6px;
          background: rgba(0, 210, 196, 0.15);
          color: #00d2c4;
          border: 1px solid rgba(0, 210, 196, 0.35);
        }
      }

      .page-subtitle {
        font-size: 0.8rem;
        color: #94a3b8;
      }

      .controls-toolbar {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
      }

      /* MTF Pickers */
      .mtf-pickers-group {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .tf-toggle-wrap {
        display: flex;
        align-items: center;
        gap: 6px;

        .tf-caption {
          font-size: 0.72rem;
          color: #94a3b8;
          font-weight: 600;
        }
      }

      .mini-toggle {
        display: inline-flex;
        background: #0b0f19;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        padding: 2px;
      }

      .mini-toggle-btn {
        background: transparent;
        border: none;
        color: #94a3b8;
        padding: 3px 8px;
        font-size: 0.72rem;
        font-weight: 600;
        border-radius: 6px;
        cursor: pointer;
        font-family: 'JetBrains Mono', monospace;
        transition: all 0.15s ease;

        &:hover {
          color: #f8fafc;
        }

        &.active {
          color: #00d2c4;
          background: #1e293b;
        }
      }

      /* Mode Toggle */
      .mode-toggle {
        display: inline-flex;
        background: #0b0f19;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        padding: 3px;
        gap: 2px;
      }

      .mode-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: transparent;
        border: none;
        color: #94a3b8;
        padding: 6px 14px;
        font-size: 0.8rem;
        font-weight: 600;
        border-radius: 7px;
        cursor: pointer;
        transition: all 0.15s ease;

        .mode-icon {
          font-size: 16px;
        }

        .live-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #94a3b8;

          &.pulsing {
            background: #10b981;
            box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
          }
        }

        &:hover {
          color: #f8fafc;
        }

        &.active {
          color: #f8fafc;
          background: #1e293b;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        }
      }

      /* Run Scan CTA */
      .run-scan-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: linear-gradient(135deg, #00d2c4, #009688);
        border: none;
        color: #0b0f19;
        font-weight: 700;
        font-size: 0.85rem;
        padding: 8px 18px;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 12px rgba(0, 210, 196, 0.25);

        .material-symbols-rounded {
          font-size: 20px;
        }

        &:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(0, 210, 196, 0.35);
        }

        &:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        &.lg {
          padding: 12px 24px;
          font-size: 0.95rem;
        }
      }

      /* Historical Bar */
      .historical-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px;
        padding: 12px 16px;
        background: #0b0f19;
        border: 1px dashed rgba(255, 255, 255, 0.12);
        border-radius: 10px;
      }

      .date-inputs-group {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      .date-field {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 0.78rem;
        color: #94a3b8;

        .date-input {
          background: #151c2c;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 6px;
          color: #f8fafc;
          padding: 4px 8px;
          font-size: 0.78rem;

          &:focus {
            outline: none;
            border-color: #00d2c4;
          }
        }
      }

      .date-presets {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        font-size: 0.75rem;

        .preset-label {
          color: #64748b;
          font-weight: 600;
        }

        .preset-chip {
          background: #1e293b;
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #94a3b8;
          border-radius: 6px;
          padding: 3px 8px;
          font-size: 0.72rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;

          &:hover {
            color: #00d2c4;
            border-color: rgba(0, 210, 196, 0.35);
          }
        }
      }

      /* Universe Strip */
      .universe-strip {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        font-size: 0.78rem;
        color: #94a3b8;
        padding-top: 4px;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
      }

      .universe-label {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-weight: 600;
        color: #cbd5e1;

        .material-symbols-rounded {
          font-size: 16px;
          color: #00d2c4;
        }
      }

      .universe-chips {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }

      .inst-chip {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        color: #cbd5e1;
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 0.72rem;
        font-family: 'JetBrains Mono', monospace;
      }

      .universe-loading {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: #94a3b8;
        font-size: 0.75rem;

        .spinning {
          font-size: 16px;
        }
      }

      /* KPI GRID */
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 14px;
      }

      .kpi-card {
        background: #151c2c;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 4px;

        &.highlight-cyan {
          border-left: 3px solid #00d2c4;
        }

        &.highlight-emerald {
          border-left: 3px solid #10b981;
        }

        &.highlight-coral {
          border-left: 3px solid #f43f5e;
        }

        &.highlight-amber {
          border-left: 3px solid #f59e0b;
        }
      }

      .kpi-label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.75rem;
        font-weight: 600;
        color: #94a3b8;

        .material-symbols-rounded {
          font-size: 16px;
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
      }

      .kpi-value {
        font-size: 1.5rem;
        font-weight: 700;
        color: #f8fafc;
      }

      .kpi-subtext {
        font-size: 0.7rem;
        color: #64748b;
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

      /* SETUPS CONTAINER */
      .setups-container {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .setups-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
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
          font-size: 20px;
        }

        .count-badge {
          background: rgba(0, 210, 196, 0.15);
          color: #00d2c4;
          font-size: 0.72rem;
          padding: 2px 7px;
          border-radius: 999px;
          font-weight: 700;
        }
      }

      /* Filter Bar */
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
        gap: 5px;
        background: #151c2c;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        padding: 5px 12px;
        color: #94a3b8;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;

        .mini-icon {
          font-size: 14px;
        }

        &:hover {
          color: #f8fafc;
          background: #1e293b;
        }

        &.active {
          color: #f8fafc;
          background: #1e293b;
          border-color: rgba(0, 210, 196, 0.45);
        }

        &.pill-bullish.active {
          color: #10b981;
          border-color: rgba(16, 185, 129, 0.45);
          background: rgba(16, 185, 129, 0.1);
        }

        &.pill-bearish.active {
          color: #f43f5e;
          border-color: rgba(244, 63, 94, 0.45);
          background: rgba(244, 63, 94, 0.1);
        }

        &.pill-amber.active {
          color: #f59e0b;
          border-color: rgba(245, 158, 11, 0.45);
          background: rgba(245, 158, 11, 0.1);
        }

        &.pill-tap.active {
          color: #f43f5e;
          border-color: rgba(244, 63, 94, 0.45);
          background: rgba(244, 63, 94, 0.1);
        }

        &.pill-sniper.active {
          color: #00d2c4;
          border-color: rgba(0, 210, 196, 0.45);
          background: rgba(0, 210, 196, 0.12);
        }
      }

      .filter-selects {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .compact-select {
        background: #151c2c;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 8px;
        color: #cbd5e1;
        padding: 5px 10px;
        font-size: 0.75rem;
        cursor: pointer;

        &:focus {
          outline: none;
          border-color: #00d2c4;
        }
      }

      /* EMPTY & LOADING STATES */
      .empty-state-card {
        background: #151c2c;
        border: 1px dashed rgba(255, 255, 255, 0.12);
        border-radius: 14px;
        padding: 40px 24px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 12px;

        .empty-icon-wrap {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: rgba(0, 210, 196, 0.12);
          color: #00d2c4;
          display: flex;
          align-items: center;
          justify-content: center;

          .material-symbols-rounded {
            font-size: 28px;
          }

          &.dim {
            background: rgba(255, 255, 255, 0.05);
            color: #94a3b8;
          }
        }

        .empty-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: #f8fafc;
        }

        .empty-desc {
          font-size: 0.85rem;
          color: #94a3b8;
          max-width: 520px;
          line-height: 1.5;
        }
      }

      .loading-state-card {
        background: #151c2c;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 14px;
        padding: 48px 24px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 12px;

        .spinner-large {
          font-size: 32px;
          color: #00d2c4;

          .spinning {
            font-size: 36px;
          }
        }

        .loading-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: #f8fafc;
        }

        .loading-desc {
          font-size: 0.85rem;
          color: #94a3b8;
        }
      }

      /* SUMMARY JUMP TABLE */
      .summary-table-wrapper {
        background: #151c2c;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        overflow-x: auto;
      }

      .summary-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.8rem;

        th {
          background: rgba(15, 23, 42, 0.7);
          color: #94a3b8;
          font-weight: 600;
          padding: 10px 14px;
          text-align: left;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        td {
          padding: 10px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          color: #e2e8f0;
        }

        .summary-row {
          cursor: pointer;
          transition: background 0.15s ease;

          &:hover {
            background: rgba(255, 255, 255, 0.03);
          }

          &.buy-row {
            border-left: 3px solid #10b981;
          }

          &.sell-row {
            border-left: 3px solid #f43f5e;
          }
        }

        .sym-cell {
          font-weight: 700;
          color: #f8fafc;
        }
      }

      .mini-chart-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #94a3b8;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 0.72rem;
        cursor: pointer;
        transition: all 0.15s ease;

        .material-symbols-rounded {
          font-size: 15px;
        }

        &:hover {
          color: #00d2c4;
          border-color: rgba(0, 210, 196, 0.45);
        }
      }

      /* BADGES & PILLS */
      .signal-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 0.72rem;
        font-weight: 700;
        font-family: 'JetBrains Mono', monospace;

        .material-symbols-rounded {
          font-size: 14px;
        }

        &.badge-buy {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.35);
        }

        &.badge-sell {
          background: rgba(244, 63, 94, 0.15);
          color: #f43f5e;
          border: 1px solid rgba(244, 63, 94, 0.35);
        }

        &.lg {
          padding: 6px 12px;
          font-size: 0.85rem;

          .material-symbols-rounded {
            font-size: 18px;
          }
        }
      }

      .bias-badge {
        font-size: 0.68rem;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;

        &.bias-bullish {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
        }

        &.bias-bearish {
          background: rgba(244, 63, 94, 0.15);
          color: #f43f5e;
        }

        &.bias-neutral {
          background: rgba(255, 255, 255, 0.06);
          color: #94a3b8;
        }
      }

      .status-pill {
        font-size: 0.72rem;
        font-weight: 700;
        padding: 2px 7px;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.05);
        color: #94a3b8;

        &.status-sniper {
          background: rgba(0, 210, 196, 0.15);
          color: #00d2c4;
          border: 1px solid rgba(0, 210, 196, 0.35);
        }

        &.status-mitigating {
          background: rgba(244, 63, 94, 0.15);
          color: #f43f5e;
        }

        &.status-approaching {
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
        }
      }

      .status-badge-lg {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 8px;
        font-size: 0.78rem;
        font-weight: 700;
        background: rgba(255, 255, 255, 0.05);
        color: #94a3b8;

        .material-symbols-rounded {
          font-size: 18px;
        }

        &.badge-mitigating {
          background: rgba(244, 63, 94, 0.15);
          color: #f43f5e;
          border: 1px solid rgba(244, 63, 94, 0.35);
        }

        &.badge-approaching {
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.35);
        }
      }

      .level-pill {
        display: inline-flex;
        padding: 2px 7px;
        border-radius: 6px;
        font-size: 0.72rem;
        font-weight: 600;
        background: rgba(0, 210, 196, 0.1);
        color: #00d2c4;

        &.pd-pill {
          background: rgba(245, 158, 11, 0.12);
          color: #f59e0b;
        }

        &.demand-pill {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
        }

        &.supply-pill {
          background: rgba(244, 63, 94, 0.15);
          color: #f43f5e;
        }
      }

      .tf-badge {
        font-size: 0.68rem;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.06);
        color: #cbd5e1;
      }

      .session-date-pill {
        font-size: 0.72rem;
        color: #64748b;
      }

      /* RECOMMENDATION CARDS */
      .recommendation-cards-list {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .recommendation-card {
        background: #151c2c;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 14px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        transition: border-color 0.2s ease;

        &:hover {
          border-color: rgba(255, 255, 255, 0.16);
        }

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
        gap: 2px;
      }

      .rec-symbol-line {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .rec-symbol {
        font-size: 1.15rem;
        font-weight: 700;
        color: #f8fafc;
      }

      .rec-subline {
        font-size: 0.75rem;
        color: #94a3b8;
      }

      .trade-setup-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(0, 210, 196, 0.12);
        border: 1px solid rgba(0, 210, 196, 0.35);
        color: #00d2c4;
        font-weight: 600;
        font-size: 0.78rem;
        padding: 6px 14px;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s ease;

        .material-symbols-rounded {
          font-size: 16px;
        }

        &:hover {
          background: #00d2c4;
          color: #0b0f19;
        }
      }

      /* Rec Metrics Grid */
      .rec-metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
        background: #0b0f19;
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 10px;
        padding: 12px 16px;
      }

      .metric-box {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .metric-label {
        font-size: 0.7rem;
        color: #64748b;
        font-weight: 600;
      }

      .metric-value {
        font-size: 1.05rem;
        font-weight: 700;
        color: #f8fafc;
      }

      .metric-meta {
        font-size: 0.68rem;
        color: #94a3b8;
      }

      .rec-chart-wrap {
        width: 100%;
        border-radius: 10px;
        overflow: hidden;
      }

      .spinning {
        animation: spin 1.2s linear infinite;
      }

      @keyframes spin {
        100% {
          transform: rotate(360deg);
        }
      }

      /* RESPONSIVE DESIGN (Rule 6 compliant) */
      @media (max-width: 1023px) {
        .page-body {
          padding: 16px;
        }

        .desktop-only {
          display: none !important;
        }
      }

      @media (max-width: 768px) {
        .screener-root {
          padding-bottom: 80px;
        }

        .control-header-card {
          padding: 16px;
        }

        .header-top-row {
          flex-direction: column;
          align-items: flex-start;
        }

        .controls-toolbar {
          width: 100%;
          justify-content: space-between;
        }

        .mode-toggle,
        .mini-toggle {
          flex: 1;
        }

        .mode-btn,
        .mini-toggle-btn {
          flex: 1;
          justify-content: center;
        }

        .run-scan-btn {
          width: 100%;
          justify-content: center;
        }

        .strategy-tabs {
          width: 100%;
        }

        .strategy-tab {
          flex: 1;
          justify-content: center;
          padding: 8px 10px;
        }

        .kpi-grid {
          grid-template-columns: repeat(2, 1fr);
        }

        .rec-metrics-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (max-width: 480px) {
        .kpi-grid {
          grid-template-columns: 1fr;
        }

        .rec-metrics-grid {
          grid-template-columns: 1fr;
        }

        .date-inputs-group {
          flex-direction: column;
          width: 100%;
        }

        .date-field {
          width: 100%;
          justify-content: space-between;
        }

        .filter-selects {
          width: 100%;
          display: grid;
          grid-template-columns: 1fr;
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

  // --- Liquidity Sweep Filters ---
  readonly activeSignalFilter = signal<'ALL' | 'BUY' | 'SELL'>('ALL');
  readonly activeSweepFilter = signal<'ALL' | 'BUY' | 'SELL' | 'SIGNAL' | 'EQ_POOLS'>('ALL');
  readonly activeLevelFilter = signal<'ALL' | LiquidityLevelType>('ALL');
  readonly activeSymbolFilter = signal<string>('ALL');

  // --- Order Block Filters ---
  readonly activeObFilter = signal<'ALL' | 'DEMAND' | 'SUPPLY' | 'APPROACHING' | 'MITIGATING' | 'SNIPER'>('ALL');
  readonly activeObSymbolFilter = signal<string>('ALL');

  readonly matchedSymbols = computed<string[]>(() => {
    const recs = this.screenerService.recommendations();
    const sweepSymbols = this.screenerService.liquiditySweepSymbols();
    const set = new Set<string>();
    for (const r of recs) set.add(r.displayName || r.name || r.symbol);
    for (const s of sweepSymbols) set.add(s.displayName || s.name || s.symbol);
    return Array.from(set).sort();
  });

  readonly filteredSweepSymbols = computed<LiquiditySweepSymbolResult[]>(() => {
    const items = this.screenerService.liquiditySweepSymbols();
    const filter = this.activeSweepFilter();
    const symbolFilter = this.activeSymbolFilter();

    return items.filter((item) => {
      const display = item.displayName || item.name || item.symbol;
      if (symbolFilter !== 'ALL' && display !== symbolFilter && item.symbol !== symbolFilter) {
        return false;
      }
      if (filter === 'BUY') {
        return (
          item.signal?.action === 'BUY' ||
          item.recentSweeps.some((s) => s.direction === 'BULLISH')
        );
      }
      if (filter === 'SELL') {
        return (
          item.signal?.action === 'SELL' ||
          item.recentSweeps.some((s) => s.direction === 'BEARISH')
        );
      }
      if (filter === 'SIGNAL') {
        return Boolean(item.signal);
      }
      if (filter === 'EQ_POOLS') {
        return item.activePools.some((p) => p.poolType === 'EQH' || p.poolType === 'EQL');
      }
      return true;
    });
  });

  readonly filteredRecommendations = computed<LiquiditySweepSignal[]>(() => {
    const recs = this.screenerService.recommendations();
    const signalFilter = this.activeSignalFilter();
    const levelFilter = this.activeLevelFilter();
    const symbolFilter = this.activeSymbolFilter();

    return recs.filter((rec) => {
      if (signalFilter !== 'ALL' && rec.signalType !== signalFilter) return false;
      if (levelFilter !== 'ALL' && rec.levelType !== levelFilter) return false;
      const recDisplay = rec.displayName || rec.name || rec.symbol;
      if (symbolFilter !== 'ALL' && recDisplay !== symbolFilter && rec.symbol !== symbolFilter) return false;
      return true;
    });
  });

  readonly matchedObSymbols = computed<string[]>(() => {
    const items = this.screenerService.orderBlockSymbols();
    return Array.from(new Set(items.map((r) => r.displayName || r.name || r.symbol))).sort();
  });

  readonly filteredOrderBlocks = computed<OrderBlockSymbolResult[]>(() => {
    const items = this.screenerService.orderBlockSymbols();
    const obFilter = this.activeObFilter();
    const symbolFilter = this.activeObSymbolFilter();

    return items.filter((item) => {
      const display = item.displayName || item.name || item.symbol;
      if (symbolFilter !== 'ALL' && display !== symbolFilter && item.symbol !== symbolFilter) {
        return false;
      }

      const primaryOB = item.activeOrderBlocks[0];

      if (obFilter === 'DEMAND') {
        return primaryOB?.type === 'BULLISH' || item.tradeSignal?.signalType === 'BUY';
      }
      if (obFilter === 'SUPPLY') {
        return primaryOB?.type === 'BEARISH' || item.tradeSignal?.signalType === 'SELL';
      }
      if (obFilter === 'APPROACHING') {
        return item.proximityStatus === 'APPROACHING';
      }
      if (obFilter === 'MITIGATING') {
        return item.proximityStatus === 'MITIGATING';
      }
      if (obFilter === 'SNIPER') {
        return Boolean(item.tradeSignal);
      }
      return true;
    });
  });

  selectStrategy(strategy: ScreenerStrategyType): void {
    this.screenerService.setStrategy(strategy);
  }

  selectSweepTf(tf: '5m' | '15m' | '1h'): void {
    this.screenerService.setSweepTimeframe(tf);
  }

  selectSweepEntry(mode: SweepEntryMode): void {
    this.screenerService.setSweepEntryMode(mode);
  }

  selectHtf(tf: '1h' | '4h'): void {
    this.screenerService.setHtfTimeframe(tf);
  }

  selectLtf(tf: '5m' | '15m'): void {
    this.screenerService.setLtfTimeframe(tf);
  }

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
    this.activeObFilter.set('ALL');
    this.activeObSymbolFilter.set('ALL');
    this.screenerService.runScan();
  }

  trackBySignalId(_index: number, item: LiquiditySweepSignal): string {
    return item.id;
  }

  trackBySweepSymbol(_index: number, item: LiquiditySweepSymbolResult): string {
    return item.symbol;
  }

  trackByObSymbol(_index: number, item: OrderBlockSymbolResult): string {
    return item.symbol;
  }

  getBslPoolsCount(item: LiquiditySweepSymbolResult): number {
    return (item.activePools || []).filter((p) => p.side === 'BSL').length;
  }

  getSslPoolsCount(item: LiquiditySweepSymbolResult): number {
    return (item.activePools || []).filter((p) => p.side === 'SSL').length;
  }

  getLatestSweep(item: LiquiditySweepSymbolResult): LiquiditySweepEvent | null {
    if (!item.recentSweeps || item.recentSweeps.length === 0) return null;
    return item.recentSweeps[item.recentSweeps.length - 1];
  }

  goToComposerWithSweepSymbol(item: LiquiditySweepSymbolResult): void {
    const symbol = item.displayName || item.name || item.symbol;
    if (item.signal) {
      this.router.navigate(['/'], {
        queryParams: {
          symbol,
          targetPrice: item.signal.entryPrice,
          stopLoss: item.signal.stopLoss,
          strategy: `LIQUIDITY_SWEEP_${item.signal.action}`,
        },
      });
    } else {
      const latestSweep = this.getLatestSweep(item);
      this.router.navigate(['/'], {
        queryParams: {
          symbol,
          targetPrice: latestSweep?.sweptPrice,
          stopLoss: latestSweep?.sweepWickExtreme,
          strategy: `LIQUIDITY_SWEEP_${latestSweep?.direction || 'SETUP'}`,
        },
      });
    }
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

  scrollToObCard(symbol: string): void {
    const el = document.getElementById(`ob-card-${symbol}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  goToComposerWithSetup(rec: LiquiditySweepSignal): void {
    this.router.navigate(['/'], {
      queryParams: {
        symbol: rec.displayName || rec.name || rec.symbol,
        targetPrice: rec.confirmationClosePrice,
        stopLoss: rec.sweepPrice,
        strategy: `${rec.signalType}_${rec.levelType}_SWEEP`,
      },
    });
  }

  goToComposerWithOrderBlock(item: OrderBlockSymbolResult): void {
    if (item.tradeSignal) {
      this.router.navigate(['/'], {
        queryParams: {
          symbol: item.displayName || item.name || item.symbol,
          targetPrice: item.tradeSignal.entryPrice,
          stopLoss: item.tradeSignal.stopLoss,
          strategy: `ORDER_BLOCK_${item.tradeSignal.signalType}_SNIPER`,
        },
      });
    } else if (item.activeOrderBlocks[0]) {
      const ob = item.activeOrderBlocks[0];
      this.router.navigate(['/'], {
        queryParams: {
          symbol: item.displayName || item.name || item.symbol,
          targetPrice: ob.equilibrium,
          strategy: `ORDER_BLOCK_${ob.type}_${ob.obType}`,
        },
      });
    }
  }
}

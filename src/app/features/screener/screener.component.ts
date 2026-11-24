import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { ScreenerService } from '../../core/api/screener.service';
import { ScreenerSignal } from '../../core/models/screener.models';
import { SignalChartViewerComponent } from './components/signal-chart-viewer/signal-chart-viewer.component';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';
import { SectionErrorComponent } from '../../shared/components/section-error/section-error.component';

@Component({
  selector: 'app-screener',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatChipsModule,
    SignalChartViewerComponent,
    CurrencyInrPipe,
    SectionErrorComponent,
  ],
  template: `
    <div class="screener-root">
      <main class="page-body">
        <!-- 1. PAGE HEADER & INTRO BANNER -->
        <section class="control-header-card">
          <div class="title-and-badge-row">
            <div class="title-group">
              <div class="page-title">
                <span class="material-symbols-rounded page-icon">query_stats</span>
                <span>Trade Screener & Backtester</span>
              </div>
              <div class="page-subtitle">
                5-Minute State Machine:
                <span class="flow-pill">Liquidity Low</span>
                <span class="flow-arrow">&rarr;</span>
                <span class="flow-pill">Sweep</span>
                <span class="flow-arrow">&rarr;</span>
                <span class="flow-pill">Base (1–2c)</span>
                <span class="flow-arrow">&rarr;</span>
                <span class="flow-pill">Impulse Break</span>
                <span class="flow-arrow">&rarr;</span>
                <span class="flow-pill">Retest Entry</span>
              </div>
            </div>

            <div class="source-badge">
              <span class="material-symbols-rounded badge-icon">verified</span>
              <span>Yahoo Finance 5m (<code class="mono-code">yfinance</code> scope &le; 60d)</span>
            </div>
          </div>

          <!-- 2. CONTROL & FILTER BAR -->
          <div class="controls-grid">
            <!-- Instrument Scope Selector -->
            <div class="control-group scope-group">
              <label class="control-label">Instrument Scope:</label>
              <div class="scope-toggle-buttons">
                <button
                  type="button"
                  class="scope-btn"
                  [class.active]="screenerService.scope() === 'indices'"
                  (click)="setScope('indices')"
                  matTooltip="Execute scan strictly for the 4 Traded Benchmark Indices: NIFTY 50, BANK NIFTY, MIDCAP NIFTY, SENSEX"
                >
                  <span class="material-symbols-rounded">trending_up</span>
                  <span>Traded Indices Only (4)</span>
                </button>
                <button
                  type="button"
                  class="scope-btn"
                  [class.active]="screenerService.scope() === 'custom'"
                  (click)="setScope('custom')"
                  matTooltip="Select specific instruments to scan"
                >
                  <span class="material-symbols-rounded">checklist</span>
                  <span>Custom Selection</span>
                </button>
              </div>
            </div>

            <!-- Lookback Period Dropdown (Strictly native Yahoo Finance 5m limit <= 60d) -->
            <div class="control-group">
              <label for="lookbackSelect" class="control-label">5m Lookback Window:</label>
              <div class="select-wrapper">
                <select
                  id="lookbackSelect"
                  class="styled-select"
                  [ngModel]="screenerService.lookbackPeriod()"
                  (ngModelChange)="onLookbackChange($event)"
                >
                  <option value="60d">60 Days (Native Max Limit)</option>
                  <option value="30d">30 Days (~1 Month)</option>
                  <option value="15d">15 Days</option>
                  <option value="5d">5 Days (Recent Week)</option>
                </select>
                <span class="material-symbols-rounded select-arrow">expand_more</span>
              </div>
            </div>

            <!-- Swing Lookback (default: 20) -->
            <div class="control-group">
              <label for="swingInput" class="control-label" matTooltip="Minimum N-candles before & after for swing low pivot">
                Swing Lookback (Bars):
              </label>
              <input
                id="swingInput"
                type="number"
                class="styled-input mono-val"
                [ngModel]="screenerService.swingLookback()"
                (ngModelChange)="screenerService.swingLookback.set(+$event)"
                min="5"
                max="100"
              />
            </div>

            <!-- SL Buffer (default: 3) -->
            <div class="control-group">
              <label for="slBufferInput" class="control-label" matTooltip="Stop Loss offset buffer below sweep low">
                SL Buffer (Pts):
              </label>
              <input
                id="slBufferInput"
                type="number"
                step="0.5"
                class="styled-input mono-val"
                [ngModel]="screenerService.slBuffer()"
                (ngModelChange)="screenerService.slBuffer.set(+$event)"
                min="0.1"
                max="50"
              />
            </div>

            <!-- Target RR (default: 2.0) -->
            <div class="control-group">
              <label for="rrInput" class="control-label" matTooltip="Target Risk-to-Reward ratio multiple">
                Target RR Multiple:
              </label>
              <input
                id="rrInput"
                type="number"
                step="0.1"
                class="styled-input mono-val"
                [ngModel]="screenerService.targetRr()"
                (ngModelChange)="screenerService.targetRr.set(+$event)"
                min="0.5"
                max="10"
              />
            </div>

            <!-- Max Retest Candles (default: 15) -->
            <div class="control-group">
              <label for="retestInput" class="control-label" matTooltip="Maximum 5m candles to wait for retest before discarding">
                Max Retest Candles:
              </label>
              <input
                id="retestInput"
                type="number"
                class="styled-input mono-val"
                [ngModel]="screenerService.maxRetestBars()"
                (ngModelChange)="screenerService.maxRetestBars.set(+$event)"
                min="3"
                max="60"
              />
            </div>

            <!-- Run CTA Button -->
            <div class="control-group action-group">
              <label class="control-label">&nbsp;</label>
              <button
                type="button"
                class="run-screener-btn"
                [disabled]="screenerService.isScanning()"
                (click)="onRunScreener()"
              >
                <span class="material-symbols-rounded" [class.spinning]="screenerService.isScanning()">
                  {{ screenerService.isScanning() ? 'sync' : 'play_arrow' }}
                </span>
                <span>{{ screenerService.isScanning() ? 'Scanning...' : 'Run Scanner' }}</span>
              </button>
            </div>
          </div>

          <!-- Custom Instrument Selector Drawer (when scope === 'custom') -->
          <div *ngIf="screenerService.scope() === 'custom'" class="custom-instruments-drawer">
            <div class="drawer-header">
              <span class="drawer-title">Select Instruments from Master List ({{ screenerService.selectedSymbols().length }} selected):</span>
              <div class="drawer-actions">
                <button type="button" class="mini-text-btn" (click)="screenerService.selectAllInstruments()">Select All</button>
                <button type="button" class="mini-text-btn" (click)="screenerService.clearSelectedInstruments()">Clear All</button>
              </div>
            </div>
            <div class="instruments-chip-cloud">
              <button
                *ngFor="let item of screenerService.instruments()"
                type="button"
                class="instrument-pill"
                [class.selected]="isSymbolSelected(item.symbol)"
                (click)="screenerService.toggleSymbolSelection(item.symbol)"
              >
                <span class="material-symbols-rounded pill-check">
                  {{ isSymbolSelected(item.symbol) ? 'check_box' : 'check_box_outline_blank' }}
                </span>
                <span class="pill-name">{{ item.symbol }}</span>
                <span *ngIf="item.isIndex" class="pill-idx-tag">INDEX</span>
              </button>
            </div>
          </div>

          <!-- Progress notification bar during scanning -->
          <div *ngIf="screenerService.isScanning()" class="scan-progress-strip">
            <div class="pulse-dot"></div>
            <span>{{ screenerService.scanProgressText() || 'Scanning Yahoo Finance 5m historical data...' }}</span>
          </div>
        </section>

        <!-- ERROR STATE (Graceful Section Error) -->
        <app-section-error
          *ngIf="screenerService.scanError()"
          [title]="'Screener Execution Error'"
          [message]="screenerService.scanError() || 'Unknown error occurred'"
          (retry)="onRunScreener()"
        ></app-section-error>

        <!-- 3. BACKTEST SUMMARY METRICS CARDS -->
        <section class="summary-cards-grid" *ngIf="screenerService.summary() as sum">
          <!-- Total Signals -->
          <div class="metric-card">
            <div class="card-icon-wrap total">
              <span class="material-symbols-rounded">radar</span>
            </div>
            <div class="card-content">
              <div class="metric-label">Total Signals</div>
              <div class="metric-value mono-val">{{ sum.totalSignals }}</div>
              <div class="metric-sub">Across {{ screenerService.scanResult()?.matchedSymbolsCount || 0 }} symbols</div>
            </div>
          </div>

          <!-- Win Rate -->
          <div class="metric-card win-rate-card">
            <div class="card-icon-wrap win">
              <span class="material-symbols-rounded">verified</span>
            </div>
            <div class="card-content">
              <div class="metric-label">Win Rate (%)</div>
              <div class="metric-value mono-val" [class.profit]="sum.winRate >= 50" [class.loss]="sum.winRate < 50">
                {{ sum.winRate }}%
              </div>
              <div class="metric-sub">{{ sum.wins }} of {{ sum.wins + sum.losses + sum.eodExits }} completed trades</div>
            </div>
          </div>

          <!-- Net R-Multiple -->
          <div class="metric-card">
            <div class="card-icon-wrap r-multi">
              <span class="material-symbols-rounded">trending_up</span>
            </div>
            <div class="card-content">
              <div class="metric-label">Net R-Multiple</div>
              <div class="metric-value mono-val" [class.profit]="sum.netRMultiple > 0" [class.loss]="sum.netRMultiple < 0">
                {{ sum.netRMultiple > 0 ? '+' : '' }}{{ sum.netRMultiple }}R
              </div>
              <div class="metric-sub">P&L: {{ sum.totalPnlPoints > 0 ? '+' : '' }}{{ sum.totalPnlPoints }} pts</div>
            </div>
          </div>

          <!-- Profit Factor -->
          <div class="metric-card">
            <div class="card-icon-wrap pf">
              <span class="material-symbols-rounded">calculate</span>
            </div>
            <div class="card-content">
              <div class="metric-label">Profit Factor</div>
              <div class="metric-value mono-val" [class.profit]="sum.profitFactor >= 1.5">
                {{ sum.profitFactor >= 99 ? '&infin;' : sum.profitFactor }}
              </div>
              <div class="metric-sub">Gain: +{{ sum.grossProfitPoints }} | Loss: -{{ sum.grossLossPoints }}</div>
            </div>
          </div>

          <!-- Breakdown: Wins / Losses / EOD Exits -->
          <div class="metric-card breakdown-card">
            <div class="card-icon-wrap breakdown">
              <span class="material-symbols-rounded">pie_chart</span>
            </div>
            <div class="card-content">
              <div class="metric-label">Trade Outcomes</div>
              <div class="outcomes-chips-list">
                <span class="outcome-pill win" matTooltip="Target Hit (Win)">
                  <span class="pill-dot win"></span>
                  <span>{{ sum.wins }} Wins</span>
                </span>
                <span class="outcome-pill loss" matTooltip="Stop Loss Hit (Loss)">
                  <span class="pill-dot loss"></span>
                  <span>{{ sum.losses }} Losses</span>
                </span>
                <span class="outcome-pill eod" matTooltip="15:25 IST Intraday Close">
                  <span class="pill-dot eod"></span>
                  <span>{{ sum.eodExits }} EOD</span>
                </span>
                <span *ngIf="sum.openTrades > 0" class="outcome-pill open" matTooltip="Active Open Trade">
                  <span class="pill-dot open"></span>
                  <span>{{ sum.openTrades }} Open</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        <!-- 4. INTERACTIVE 5-MINUTE SIGNAL CHART VIEWER -->
        <section class="chart-viewer-section" *ngIf="screenerService.selectedSignal() as sel">
          <div class="section-title-bar">
            <div class="section-title">
              <span class="material-symbols-rounded">candlestick_chart</span>
              <span>5-Minute Interactive Signal Chart Viewer</span>
            </div>
            <div class="chart-tip">
              Click & drag to pan &bull; Scroll to zoom &bull; Overlays: LOW, LOW SWEEP, ORDER BLOCK, Entry, SL, Target
            </div>
          </div>

          <app-signal-chart-viewer
            [signalInput]="sel"
            [showCloseButton]="true"
          ></app-signal-chart-viewer>
        </section>

        <!-- 5. DETECTED SIGNALS TABLE SECTION -->
        <section class="signals-table-card">
          <div class="table-header-toolbar">
            <div class="left-tools">
              <div class="table-heading">
                <span>Detected Trade Setups</span>
                <span class="signals-count-badge mono-val">{{ screenerService.filteredSignals().length }}</span>
              </div>

              <!-- Outcome filter chips -->
              <div class="outcome-filter-tabs">
                <button
                  type="button"
                  class="filter-tab"
                  [class.active]="screenerService.filterOutcome() === 'ALL'"
                  (click)="screenerService.filterOutcome.set('ALL')"
                >
                  All ({{ screenerService.signals().length }})
                </button>
                <button
                  type="button"
                  class="filter-tab win"
                  [class.active]="screenerService.filterOutcome() === 'WIN'"
                  (click)="screenerService.filterOutcome.set('WIN')"
                >
                  Wins ({{ screenerService.summary()?.wins || 0 }})
                </button>
                <button
                  type="button"
                  class="filter-tab loss"
                  [class.active]="screenerService.filterOutcome() === 'LOSS'"
                  (click)="screenerService.filterOutcome.set('LOSS')"
                >
                  Losses ({{ screenerService.summary()?.losses || 0 }})
                </button>
                <button
                  type="button"
                  class="filter-tab eod"
                  [class.active]="screenerService.filterOutcome() === 'EOD_EXIT'"
                  (click)="screenerService.filterOutcome.set('EOD_EXIT')"
                >
                  EOD Exits ({{ screenerService.summary()?.eodExits || 0 }})
                </button>
              </div>
            </div>

            <!-- Search input -->
            <div class="search-box">
              <span class="material-symbols-rounded search-icon">search</span>
              <input
                type="text"
                class="search-input"
                placeholder="Filter by Symbol or Date..."
                [ngModel]="screenerService.searchQuery()"
                (ngModelChange)="screenerService.searchQuery.set($event)"
              />
              <button
                *ngIf="screenerService.searchQuery()"
                type="button"
                class="clear-search-btn"
                (click)="screenerService.searchQuery.set('')"
              >
                <span class="material-symbols-rounded">close</span>
              </button>
            </div>
          </div>

          <!-- Desktop Results Table (Screens >= 769px) -->
          <div class="table-container desktop-table-view">
            <table class="signals-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Date</th>
                  <th>Sweep Time</th>
                  <th>Entry Time</th>
                  <th>Entry Price</th>
                  <th>Stop Loss</th>
                  <th>Target</th>
                  <th>Outcome</th>
                  <th>PnL (Pts & R)</th>
                  <th class="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  *ngFor="let s of screenerService.filteredSignals()"
                  [class.selected-row]="screenerService.selectedSignal()?.id === s.id"
                  (click)="onSelectSignal(s)"
                >
                  <!-- Symbol -->
                  <td class="symbol-col">
                    <div class="symbol-cell">
                      <span class="sym-ticker">{{ s.symbol }}</span>
                      <span class="sym-name">{{ s.name }}</span>
                    </div>
                  </td>

                  <!-- Date -->
                  <td class="mono-val date-cell">{{ s.date }}</td>

                  <!-- Sweep Time -->
                  <td class="mono-val">
                    <span class="sweep-text">{{ s.sweepTimeFormatted }}</span>
                    <span class="sub-price mono-val">({{ s.sweepLow }})</span>
                  </td>

                  <!-- Entry Time -->
                  <td class="mono-val">{{ s.entryTimeFormatted }}</td>

                  <!-- Entry Price -->
                  <td class="mono-val entry-price-cell">
                    {{ s.entryPrice | currencyInr : false }}
                  </td>

                  <!-- Stop Loss -->
                  <td class="mono-val sl-price-cell">
                    {{ s.stopLoss | currencyInr : false }}
                  </td>

                  <!-- Target -->
                  <td class="mono-val target-price-cell">
                    {{ s.targetPrice | currencyInr : false }}
                  </td>

                  <!-- Outcome -->
                  <td>
                    <span class="outcome-badge" [ngClass]="s.outcome.toLowerCase()">
                      <span class="material-symbols-rounded badge-icon">
                        {{ s.outcome === 'WIN' ? 'check_circle' : s.outcome === 'LOSS' ? 'cancel' : s.outcome === 'EOD_EXIT' ? 'schedule' : 'hourglass_top' }}
                      </span>
                      {{ s.outcome }}
                    </span>
                  </td>

                  <!-- PnL (Pts & R) -->
                  <td class="mono-val pnl-cell" [class.profit]="s.pnlPoints > 0" [class.loss]="s.pnlPoints < 0">
                    <span class="pnl-pts">{{ s.pnlPoints > 0 ? '+' : '' }}{{ s.pnlPoints }} pts</span>
                    <span class="pnl-r">({{ s.rMultiple > 0 ? '+' : '' }}{{ s.rMultiple }}R)</span>
                  </td>

                  <!-- Action: View Chart Button -->
                  <td class="text-right">
                    <button
                      type="button"
                      class="view-chart-btn"
                      [class.active]="screenerService.selectedSignal()?.id === s.id"
                      (click)="$event.stopPropagation(); onSelectSignal(s)"
                      matTooltip="Inspect interactive 5m candlestick chart with overlays"
                    >
                      <span class="material-symbols-rounded">show_chart</span>
                      <span>Chart</span>
                    </button>
                  </td>
                </tr>

                <!-- Empty state if no signals matched filter -->
                <tr *ngIf="screenerService.filteredSignals().length === 0">
                  <td colspan="10" class="empty-table-cell">
                    <div class="empty-state-box">
                      <span class="material-symbols-rounded empty-icon">filter_alt_off</span>
                      <span class="empty-title">
                        {{ screenerService.signals().length === 0 ? 'No signals scanned yet' : 'No setups match active filter' }}
                      </span>
                      <span class="empty-hint">
                        {{ screenerService.signals().length === 0 ? 'Click "Run Scanner" above to execute scan for traded indices via Yahoo Finance' : 'Try adjusting the search query or outcome filter tabs' }}
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Mobile Cards View (Screens <= 768px, Rule 6 responsive) -->
          <div class="screener-mobile-card-list">
            <div
              *ngFor="let s of screenerService.filteredSignals()"
              class="screener-mobile-card"
              [class.selected]="screenerService.selectedSignal()?.id === s.id"
              (click)="onSelectSignal(s)"
            >
              <div class="mobile-card-top">
                <div class="mobile-sym-info">
                  <span class="mobile-ticker">{{ s.symbol }}</span>
                  <span class="mobile-date mono-val">{{ s.date }} &bull; {{ s.entryTimeFormatted }}</span>
                </div>
                <span class="outcome-badge" [ngClass]="s.outcome.toLowerCase()">
                  {{ s.outcome }}
                </span>
              </div>

              <div class="mobile-card-prices-grid">
                <div class="price-box">
                  <span class="price-box-label">ENTRY</span>
                  <span class="price-box-val mono-val">{{ s.entryPrice }}</span>
                </div>
                <div class="price-box">
                  <span class="price-box-label">SL</span>
                  <span class="price-box-val mono-val loss">{{ s.stopLoss }}</span>
                </div>
                <div class="price-box">
                  <span class="price-box-label">TARGET</span>
                  <span class="price-box-val mono-val profit">{{ s.targetPrice }}</span>
                </div>
                <div class="price-box">
                  <span class="price-box-label">PnL</span>
                  <span class="price-box-val mono-val" [class.profit]="s.pnlPoints > 0" [class.loss]="s.pnlPoints < 0">
                    {{ s.pnlPoints > 0 ? '+' : '' }}{{ s.pnlPoints }} pts
                  </span>
                </div>
              </div>

              <div class="mobile-card-bottom">
                <span class="mobile-r-multi mono-val" [class.profit]="s.rMultiple > 0" [class.loss]="s.rMultiple < 0">
                  Multiple: {{ s.rMultiple > 0 ? '+' : '' }}{{ s.rMultiple }}R
                </span>
                <button
                  type="button"
                  class="mobile-view-btn"
                  (click)="$event.stopPropagation(); onSelectSignal(s)"
                >
                  <span class="material-symbols-rounded">candlestick_chart</span>
                  <span>View 5m Chart</span>
                </button>
              </div>
            </div>

            <div *ngIf="screenerService.filteredSignals().length === 0" class="empty-mobile-box">
              <span class="material-symbols-rounded empty-icon">filter_alt_off</span>
              <span>No signals match current criteria</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100%;
        background-color: var(--bg-app, #0b0f19);
        color: var(--text-primary, #ffffff);
      }

      .screener-root {
        padding: 20px 24px 80px;
        max-width: 1600px;
        margin: 0 auto;
        box-sizing: border-box;
      }

      .page-body {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      /* Control Header Card */
      .control-header-card {
        background: var(--bg-surface-card, #151c2c);
        border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
        border-radius: 14px;
        padding: 20px 24px;
        display: flex;
        flex-direction: column;
        gap: 18px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
      }

      .title-and-badge-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 14px;
      }

      .title-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .page-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 1.35rem;
        font-weight: 700;
        color: var(--text-primary, #ffffff);
        letter-spacing: 0.3px;
      }

      .page-icon {
        color: var(--brand-cyan, #00d2c4);
        font-size: 28px;
      }

      .page-subtitle {
        font-size: 0.85rem;
        color: var(--text-muted, #94a3b8);
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
      }

      .flow-pill {
        background: rgba(255, 255, 255, 0.06);
        padding: 2px 8px;
        border-radius: 4px;
        color: var(--text-secondary, #cbd5e1);
        font-weight: 600;
        font-size: 0.75rem;
      }

      .flow-arrow {
        color: var(--brand-cyan, #00d2c4);
        font-weight: 700;
      }

      .source-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        background: rgba(0, 210, 196, 0.1);
        border: 1px solid rgba(0, 210, 196, 0.3);
        border-radius: 8px;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--brand-cyan, #00d2c4);
      }

      .source-badge .badge-icon {
        font-size: 16px;
      }

      .mono-code {
        font-family: 'JetBrains Mono', monospace;
        background: rgba(0, 0, 0, 0.3);
        padding: 1px 4px;
        border-radius: 3px;
      }

      /* Controls Grid */
      .controls-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 14px;
        align-items: flex-end;
      }

      .scope-group {
        grid-column: span 2;
      }

      .control-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .control-label {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--text-muted, #94a3b8);
        white-space: nowrap;
      }

      .scope-toggle-buttons {
        display: flex;
        background: rgba(11, 15, 25, 0.7);
        border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
        border-radius: 8px;
        padding: 3px;
        gap: 4px;
      }

      .scope-btn {
        flex: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 6px 10px;
        background: transparent;
        border: none;
        border-radius: 6px;
        color: var(--text-muted, #94a3b8);
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
      }

      .scope-btn span.material-symbols-rounded {
        font-size: 16px;
      }

      .scope-btn:hover {
        color: #ffffff;
      }

      .scope-btn.active {
        background: var(--brand-cyan, #00d2c4);
        color: #0b0f19;
        font-weight: 700;
        box-shadow: 0 2px 8px rgba(0, 210, 196, 0.3);
      }

      .select-wrapper {
        position: relative;
        display: flex;
        align-items: center;
      }

      .styled-select,
      .styled-input {
        width: 100%;
        background: rgba(11, 15, 25, 0.7);
        border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
        border-radius: 8px;
        padding: 8px 12px;
        color: var(--text-primary, #ffffff);
        font-size: 0.85rem;
        font-weight: 600;
        box-sizing: border-box;
        outline: none;
        transition: border-color 0.2s;
        height: 38px;
      }

      .styled-select {
        appearance: none;
        padding-right: 30px;
        cursor: pointer;
      }

      .styled-select:focus,
      .styled-input:focus {
        border-color: var(--brand-cyan, #00d2c4);
      }

      .select-arrow {
        position: absolute;
        right: 8px;
        pointer-events: none;
        color: var(--text-muted, #94a3b8);
        font-size: 20px;
      }

      .run-screener-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        background: linear-gradient(135deg, #00d2c4 0%, #00b4a7 100%);
        color: #0b0f19;
        font-size: 0.85rem;
        font-weight: 700;
        border: none;
        border-radius: 8px;
        padding: 0 16px;
        height: 38px;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 14px rgba(0, 210, 196, 0.35);
        white-space: nowrap;
      }

      .run-screener-btn:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 6px 18px rgba(0, 210, 196, 0.45);
      }

      .run-screener-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .spinning {
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      /* Custom Instruments Drawer */
      .custom-instruments-drawer {
        background: rgba(11, 15, 25, 0.5);
        border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
        border-radius: 10px;
        padding: 12px 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .drawer-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .drawer-title {
        font-size: 0.78rem;
        font-weight: 600;
        color: var(--text-secondary, #cbd5e1);
      }

      .drawer-actions {
        display: flex;
        gap: 8px;
      }

      .mini-text-btn {
        background: none;
        border: none;
        color: var(--brand-cyan, #00d2c4);
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        padding: 0;
      }

      .mini-text-btn:hover {
        text-decoration: underline;
      }

      .instruments-chip-cloud {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        max-height: 120px;
        overflow-y: auto;
      }

      .instrument-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 6px;
        padding: 4px 8px;
        color: var(--text-secondary, #cbd5e1);
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .instrument-pill.selected {
        background: rgba(0, 210, 196, 0.15);
        border-color: rgba(0, 210, 196, 0.5);
        color: var(--brand-cyan, #00d2c4);
      }

      .pill-check {
        font-size: 16px;
      }

      .pill-idx-tag {
        font-size: 0.65rem;
        padding: 1px 4px;
        background: rgba(99, 102, 241, 0.2);
        color: #818cf8;
        border-radius: 3px;
      }

      .scan-progress-strip {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        background: rgba(0, 210, 196, 0.08);
        border: 1px solid rgba(0, 210, 196, 0.25);
        border-radius: 8px;
        color: var(--brand-cyan, #00d2c4);
        font-size: 0.8rem;
        font-weight: 600;
      }

      .pulse-dot {
        width: 8px;
        height: 8px;
        background: var(--brand-cyan, #00d2c4);
        border-radius: 50%;
        animation: pulse 1s infinite alternate;
      }

      @keyframes pulse {
        from {
          opacity: 0.3;
          transform: scale(0.8);
        }
        to {
          opacity: 1;
          transform: scale(1.2);
        }
      }

      /* 3. Summary Cards Grid */
      .summary-cards-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 14px;
      }

      .metric-card {
        background: var(--bg-surface-card, #151c2c);
        border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
        border-radius: 12px;
        padding: 16px;
        display: flex;
        align-items: center;
        gap: 14px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      }

      .card-icon-wrap {
        width: 44px;
        height: 44px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .card-icon-wrap.total {
        background: rgba(99, 102, 241, 0.15);
        color: #818cf8;
      }

      .card-icon-wrap.win {
        background: rgba(16, 185, 129, 0.15);
        color: var(--trading-profit, #10b981);
      }

      .card-icon-wrap.r-multi {
        background: rgba(0, 210, 196, 0.15);
        color: var(--brand-cyan, #00d2c4);
      }

      .card-icon-wrap.pf {
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
      }

      .card-icon-wrap.breakdown {
        background: rgba(255, 255, 255, 0.08);
        color: #cbd5e1;
      }

      .card-content {
        display: flex;
        flex-direction: column;
        gap: 2px;
        overflow: hidden;
      }

      .metric-label {
        font-size: 0.72rem;
        font-weight: 600;
        color: var(--text-muted, #94a3b8);
        text-transform: uppercase;
        letter-spacing: 0.4px;
      }

      .metric-value {
        font-size: 1.35rem;
        font-weight: 700;
        color: #ffffff;
      }

      .metric-value.profit {
        color: var(--trading-profit, #10b981);
      }

      .metric-value.loss {
        color: var(--trading-loss, #f43f5e);
      }

      .metric-sub {
        font-size: 0.7rem;
        color: var(--text-muted, #94a3b8);
      }

      .outcomes-chips-list {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 4px;
      }

      .outcome-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.7rem;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.05);
      }

      .pill-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
      }

      .pill-dot.win {
        background: var(--trading-profit, #10b981);
      }

      .pill-dot.loss {
        background: var(--trading-loss, #f43f5e);
      }

      .pill-dot.eod {
        background: #f59e0b;
      }

      .pill-dot.open {
        background: var(--brand-cyan, #00d2c4);
      }

      /* 4. Chart Viewer Section */
      .chart-viewer-section {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .section-title-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
      }

      .section-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 1.05rem;
        font-weight: 700;
        color: #ffffff;
      }

      .chart-tip {
        font-size: 0.75rem;
        color: var(--text-muted, #94a3b8);
      }

      /* 5. Signals Table Section */
      .signals-table-card {
        background: var(--bg-surface-card, #151c2c);
        border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
        border-radius: 14px;
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
      }

      .table-header-toolbar {
        padding: 14px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 14px;
        background: rgba(11, 15, 25, 0.5);
        border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
      }

      .left-tools {
        display: flex;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;
      }

      .table-heading {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 1rem;
        font-weight: 700;
        color: #ffffff;
      }

      .signals-count-badge {
        font-size: 0.72rem;
        font-weight: 700;
        background: rgba(0, 210, 196, 0.15);
        color: var(--brand-cyan, #00d2c4);
        padding: 2px 8px;
        border-radius: 10px;
      }

      .outcome-filter-tabs {
        display: flex;
        gap: 4px;
        background: rgba(11, 15, 25, 0.6);
        padding: 3px;
        border-radius: 8px;
        border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
      }

      .filter-tab {
        background: transparent;
        border: none;
        border-radius: 6px;
        padding: 4px 10px;
        color: var(--text-muted, #94a3b8);
        font-size: 0.72rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .filter-tab:hover {
        color: #ffffff;
      }

      .filter-tab.active {
        background: rgba(255, 255, 255, 0.12);
        color: #ffffff;
      }

      .filter-tab.win.active {
        background: rgba(16, 185, 129, 0.2);
        color: var(--trading-profit, #10b981);
      }

      .filter-tab.loss.active {
        background: rgba(244, 63, 94, 0.2);
        color: var(--trading-loss, #f43f5e);
      }

      .filter-tab.eod.active {
        background: rgba(245, 158, 11, 0.2);
        color: #f59e0b;
      }

      .search-box {
        position: relative;
        display: flex;
        align-items: center;
        min-width: 240px;
      }

      .search-icon {
        position: absolute;
        left: 10px;
        color: var(--text-muted, #94a3b8);
        font-size: 18px;
        pointer-events: none;
      }

      .search-input {
        width: 100%;
        background: rgba(11, 15, 25, 0.6);
        border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
        border-radius: 8px;
        padding: 6px 30px 6px 34px;
        color: #ffffff;
        font-size: 0.8rem;
        outline: none;
      }

      .search-input:focus {
        border-color: var(--brand-cyan, #00d2c4);
      }

      .clear-search-btn {
        position: absolute;
        right: 8px;
        background: none;
        border: none;
        color: var(--text-muted, #94a3b8);
        cursor: pointer;
        padding: 0;
        display: flex;
      }

      .clear-search-btn span {
        font-size: 16px;
      }

      /* Signals Table */
      .table-container {
        width: 100%;
        overflow-x: auto;
      }

      .signals-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.82rem;
      }

      .signals-table th {
        text-align: left;
        padding: 10px 16px;
        background: rgba(11, 15, 25, 0.4);
        color: var(--text-muted, #94a3b8);
        font-weight: 600;
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.4px;
        border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
      }

      .signals-table td {
        padding: 12px 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        vertical-align: middle;
      }

      .signals-table tr:hover td {
        background: rgba(255, 255, 255, 0.02);
      }

      .signals-table tr.selected-row td {
        background: rgba(0, 210, 196, 0.08);
      }

      .symbol-cell {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .sym-ticker {
        font-weight: 700;
        color: #ffffff;
        font-size: 0.85rem;
      }

      .sym-name {
        font-size: 0.7rem;
        color: var(--text-muted, #94a3b8);
      }

      .sub-price {
        font-size: 0.7rem;
        color: var(--text-muted, #94a3b8);
        margin-left: 4px;
      }

      .entry-price-cell {
        color: var(--brand-cyan, #00d2c4);
        font-weight: 700;
      }

      .sl-price-cell {
        color: var(--trading-loss, #f43f5e);
      }

      .target-price-cell {
        color: var(--trading-profit, #10b981);
        font-weight: 700;
      }

      .outcome-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.7rem;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
      }

      .outcome-badge.win {
        background: rgba(16, 185, 129, 0.15);
        color: var(--trading-profit, #10b981);
      }

      .outcome-badge.loss {
        background: rgba(244, 63, 94, 0.15);
        color: var(--trading-loss, #f43f5e);
      }

      .outcome-badge.eod_exit {
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
      }

      .outcome-badge.open {
        background: rgba(0, 210, 196, 0.15);
        color: var(--brand-cyan, #00d2c4);
      }

      .badge-icon {
        font-size: 13px;
      }

      .pnl-cell {
        font-weight: 700;
        display: flex;
        flex-direction: column;
      }

      .pnl-cell.profit {
        color: var(--trading-profit, #10b981);
      }

      .pnl-cell.loss {
        color: var(--trading-loss, #f43f5e);
      }

      .pnl-r {
        font-size: 0.7rem;
        opacity: 0.85;
      }

      .view-chart-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 5px 10px;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        color: var(--text-secondary, #cbd5e1);
        font-size: 0.72rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .view-chart-btn:hover {
        background: rgba(0, 210, 196, 0.15);
        border-color: rgba(0, 210, 196, 0.4);
        color: var(--brand-cyan, #00d2c4);
      }

      .view-chart-btn.active {
        background: var(--brand-cyan, #00d2c4);
        border-color: var(--brand-cyan, #00d2c4);
        color: #0b0f19;
      }

      .view-chart-btn span.material-symbols-rounded {
        font-size: 15px;
      }

      .text-right {
        text-align: right;
      }

      .empty-table-cell {
        padding: 48px 16px;
        text-align: center;
      }

      .empty-state-box {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        color: var(--text-muted, #94a3b8);
      }

      .empty-icon {
        font-size: 40px;
        opacity: 0.4;
      }

      .empty-title {
        font-size: 0.95rem;
        font-weight: 600;
        color: #ffffff;
      }

      .empty-hint {
        font-size: 0.8rem;
      }

      /* Mobile Card View (Screens <= 768px) */
      .screener-mobile-card-list {
        display: none;
        flex-direction: column;
        gap: 10px;
        padding: 12px;
      }

      .screener-mobile-card {
        background: rgba(11, 15, 25, 0.5);
        border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
        border-radius: 10px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .screener-mobile-card.selected {
        border-color: var(--brand-cyan, #00d2c4);
        background: rgba(0, 210, 196, 0.05);
      }

      .mobile-card-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .mobile-sym-info {
        display: flex;
        flex-direction: column;
      }

      .mobile-ticker {
        font-size: 0.95rem;
        font-weight: 700;
        color: #ffffff;
      }

      .mobile-date {
        font-size: 0.7rem;
        color: var(--text-muted, #94a3b8);
      }

      .mobile-card-prices-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 6px;
        background: rgba(255, 255, 255, 0.02);
        padding: 8px;
        border-radius: 6px;
      }

      .price-box {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .price-box-label {
        font-size: 0.65rem;
        color: var(--text-muted, #94a3b8);
      }

      .price-box-val {
        font-size: 0.78rem;
        font-weight: 700;
      }

      .price-box-val.profit {
        color: var(--trading-profit, #10b981);
      }

      .price-box-val.loss {
        color: var(--trading-loss, #f43f5e);
      }

      .mobile-card-bottom {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .mobile-r-multi {
        font-size: 0.75rem;
        font-weight: 700;
      }

      .mobile-r-multi.profit {
        color: var(--trading-profit, #10b981);
      }

      .mobile-r-multi.loss {
        color: var(--trading-loss, #f43f5e);
      }

      .mobile-view-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 5px 10px;
        background: rgba(0, 210, 196, 0.15);
        border: 1px solid rgba(0, 210, 196, 0.35);
        border-radius: 6px;
        color: var(--brand-cyan, #00d2c4);
        font-size: 0.72rem;
        font-weight: 600;
        cursor: pointer;
      }

      .empty-mobile-box {
        padding: 32px 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        color: var(--text-muted, #94a3b8);
        font-size: 0.8rem;
      }

      @media (max-width: 1023px) {
        .screener-root {
          padding: 14px 16px 80px;
        }

        .controls-grid {
          grid-template-columns: repeat(2, 1fr);
        }

        .scope-group {
          grid-column: span 2;
        }

        .action-group {
          grid-column: span 2;
        }
      }

      @media (max-width: 768px) {
        .desktop-table-view {
          display: none;
        }

        .screener-mobile-card-list {
          display: flex;
        }

        .controls-grid {
          grid-template-columns: 1fr;
        }

        .scope-group,
        .action-group {
          grid-column: span 1;
        }

        .left-tools {
          width: 100%;
        }

        .search-box {
          width: 100%;
        }
      }
    `,
  ],
})
export class ScreenerComponent implements OnInit {
  readonly screenerService = inject(ScreenerService);

  ngOnInit(): void {
    // Note: Do not auto run the scan on page load. Run the scan only when user clicks Run Scanner.
  }

  setScope(scope: 'indices' | 'custom' | 'all'): void {
    this.screenerService.setScope(scope);
  }

  isSymbolSelected(symbol: string): boolean {
    return this.screenerService.selectedSymbols().includes(symbol);
  }

  onLookbackChange(period: '5d' | '15d' | '30d' | '60d'): void {
    this.screenerService.lookbackPeriod.set(period);
  }

  onRunScreener(): void {
    this.screenerService.runScan().subscribe();
  }

  onSelectSignal(sig: ScreenerSignal): void {
    this.screenerService.selectSignal(sig);
    // Smooth scroll chart viewer into view if below viewport
    try {
      const el = document.querySelector('.chart-viewer-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } catch {
      // Ignore scroll error
    }
  }
}

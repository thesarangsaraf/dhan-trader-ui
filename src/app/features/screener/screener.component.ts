import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ScreenerService } from '../../core/api/screener.service';
import { ScreenerMatch, WatchlistStockItem } from '../../core/models/screener.models';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';
import { IstDatePipe } from '../../shared/pipes/ist-date.pipe';
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
    CurrencyInrPipe,
    IstDatePipe,
    SectionErrorComponent,
  ],
  template: `
    <div class="screener-root">
      <main class="page-body">
        <!-- TOP CONTROL & ACTION BAR -->
        <section class="control-header-card">
          <div class="title-group">
            <div class="page-title">
              <span class="material-symbols-rounded page-icon">radar</span>
              <span>NSE Stock Screener</span>
            </div>
            <div class="page-subtitle">
              Configurable Large-Cap Universe &bull; Supply &amp; Demand Order Blocks &bull; Liquidity Sweep Reversals
              <span *ngIf="screenerService.lastScannedAt() as lastScan">
                &bull; Last scanned at {{ lastScan | istDate : 'timeOnly' }}
              </span>
            </div>
          </div>

          <!-- Controls Toolbar -->
          <div class="controls-toolbar">
            <!-- Timeframe Selector -->
            <div class="timeframe-group">
              <span class="control-label">Timeframe:</span>
              <div class="timeframe-chips">
                <button
                  type="button"
                  *ngFor="let tf of availableTimeframes"
                  class="tf-chip"
                  [class.active]="screenerService.selectedTimeframe() === tf.value"
                  (click)="onSelectTimeframe(tf.value)"
                  [disabled]="screenerService.isScanning()"
                >
                  {{ tf.label }}
                </button>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="actions-group">
              <button
                type="button"
                class="manage-watchlist-btn"
                (click)="isWatchlistOpen.set(!isWatchlistOpen())"
                [class.active]="isWatchlistOpen()"
                matTooltip="Manage configurable Firestore watchlist"
              >
                <span class="material-symbols-rounded">format_list_bulleted</span>
                <span>Watchlist ({{ screenerService.enabledWatchlistCount() }}/{{ screenerService.watchlist().length }})</span>
                <span class="material-symbols-rounded chevron">
                  {{ isWatchlistOpen() ? 'expand_less' : 'expand_more' }}
                </span>
              </button>

              <button
                type="button"
                class="run-scan-btn"
                (click)="runScan()"
                [disabled]="screenerService.isScanning() || screenerService.enabledWatchlistCount() === 0"
                matTooltip="Run Technical Price Action Scan"
              >
                <span
                  class="material-symbols-rounded"
                  [class.spinning]="screenerService.isScanning()"
                >
                  {{ screenerService.isScanning() ? 'autorenew' : 'search_insights' }}
                </span>
                <span>{{ screenerService.isScanning() ? 'Scanning...' : 'Run Technical Scan' }}</span>
              </button>
            </div>
          </div>
        </section>

        <!-- WATCHLIST MANAGER PANEL (COLLAPSIBLE) -->
        <section *ngIf="isWatchlistOpen()" class="watchlist-manager-card">
          <div class="watchlist-header">
            <div class="wl-title-group">
              <div class="wl-title">
                <span class="material-symbols-rounded">playlist_add_check</span>
                <span>Configurable Stock Universe (Firestore: <code>config/screener_watchlist</code>)</span>
              </div>
              <div class="wl-subtitle">
                Select which large-cap Indian stocks to scan, add new NSE tickers, or reset to defaults.
              </div>
            </div>

            <div class="wl-header-actions">
              <button
                type="button"
                class="wl-reset-btn"
                (click)="screenerService.resetWatchlist()"
                [disabled]="screenerService.isLoadingWatchlist()"
                matTooltip="Reset to default 28 Large-Cap stocks"
              >
                <span class="material-symbols-rounded">restart_alt</span>
                <span>Reset Defaults</span>
              </button>
            </div>
          </div>

          <!-- Add Ticker Row -->
          <div class="add-ticker-bar">
            <div class="input-field">
              <label>NSE Symbol:</label>
              <input
                type="text"
                placeholder="e.g. TATAPOWER"
                [(ngModel)]="newSymbol"
                (keyup.enter)="addNewStock()"
              />
            </div>
            <div class="input-field grow">
              <label>Company Name:</label>
              <input
                type="text"
                placeholder="e.g. Tata Power Co Ltd"
                [(ngModel)]="newName"
                (keyup.enter)="addNewStock()"
              />
            </div>
            <div class="input-field">
              <label>Sector / Category:</label>
              <input
                type="text"
                placeholder="e.g. Power"
                [(ngModel)]="newSector"
                (keyup.enter)="addNewStock()"
              />
            </div>
            <button
              type="button"
              class="add-btn"
              (click)="addNewStock()"
              [disabled]="!newSymbol.trim()"
            >
              <span class="material-symbols-rounded">add</span>
              <span>Add Ticker</span>
            </button>
          </div>

          <!-- Search / Filter in Watchlist -->
          <div class="watchlist-filter-bar">
            <div class="search-input-wrap">
              <span class="material-symbols-rounded">search</span>
              <input
                type="text"
                placeholder="Filter watchlist stocks..."
                [(ngModel)]="watchlistSearch"
              />
            </div>
            <div class="bulk-toggles">
              <button type="button" class="mini-link-btn" (click)="toggleAll(true)">Enable All</button>
              <span class="divider">&bull;</span>
              <button type="button" class="mini-link-btn" (click)="toggleAll(false)">Disable All</button>
            </div>
          </div>

          <!-- Tickers Grid -->
          <div class="tickers-grid">
            <div
              *ngFor="let stock of filteredWatchlist()"
              class="ticker-card"
              [class.disabled]="!stock.enabled"
            >
              <label class="ticker-checkbox">
                <input
                  type="checkbox"
                  [checked]="stock.enabled"
                  (change)="screenerService.toggleStock(stock.symbol)"
                />
                <span class="custom-checkbox"></span>
              </label>
              <div class="ticker-info" (click)="screenerService.toggleStock(stock.symbol)">
                <div class="ticker-symbol">{{ stock.symbol }}</div>
                <div class="ticker-name" [matTooltip]="stock.name">{{ stock.name }}</div>
                <div *ngIf="stock.sector" class="ticker-sector">{{ stock.sector }}</div>
              </div>
              <button
                type="button"
                class="ticker-del-btn"
                (click)="screenerService.removeStock(stock.symbol)"
                matTooltip="Remove stock from universe"
              >
                <span class="material-symbols-rounded">delete</span>
              </button>
            </div>
          </div>
        </section>

        <!-- KPI SUMMARY METRICS -->
        <section class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-label">
              <span class="material-symbols-rounded icon-dim">grid_view</span>
              <span>Total Scanned</span>
            </div>
            <div class="kpi-value mono-val">
              {{ screenerService.totalScanned() }}
            </div>
            <div class="kpi-subtext">Active universe tickers</div>
          </div>

          <div class="kpi-card highlight-cyan">
            <div class="kpi-label">
              <span class="material-symbols-rounded icon-cyan">insights</span>
              <span>Matches Found</span>
            </div>
            <div class="kpi-value mono-val">
              {{ screenerService.totalMatches() }}
            </div>
            <div class="kpi-subtext">Actionable setups identified</div>
          </div>

          <div class="kpi-card highlight-emerald">
            <div class="kpi-label">
              <span class="material-symbols-rounded icon-emerald">trending_up</span>
              <span>Bullish Setups (Buy)</span>
            </div>
            <div class="kpi-value mono-val text-emerald">
              {{ screenerService.bullishMatches() }}
            </div>
            <div class="kpi-subtext">Demand OB / Sell-Side Sweeps</div>
          </div>

          <div class="kpi-card highlight-coral">
            <div class="kpi-label">
              <span class="material-symbols-rounded icon-coral">trending_down</span>
              <span>Bearish Setups (Sell)</span>
            </div>
            <div class="kpi-value mono-val text-coral">
              {{ screenerService.bearishMatches() }}
            </div>
            <div class="kpi-subtext">Supply OB / Buy-Side Sweeps</div>
          </div>
        </section>

        <!-- SECTION LEVEL ERROR (RULE 2) -->
        <app-section-error
          *ngIf="screenerService.scanError() as err"
          [title]="'Screener Execution Notice'"
          [message]="err"
          (retry)="runScan()"
        ></app-section-error>

        <!-- MATCHED SETUPS CONTAINER -->
        <section class="setups-container">
          <!-- Setups Header & Strategy Filter Switcher -->
          <div class="setups-header">
            <div class="section-title">
              <span class="material-symbols-rounded">candlestick_chart</span>
              <span>Identified Trade Setups</span>
              <span class="count-badge" *ngIf="screenerService.totalMatches() > 0">
                {{ filteredMatches().length }}
              </span>
            </div>

            <!-- Strategy Filter Chips -->
            <div class="filter-chips-bar" *ngIf="screenerService.totalMatches() > 0">
              <button
                type="button"
                class="filter-pill"
                [class.active]="activeStrategyFilter() === 'ALL'"
                (click)="activeStrategyFilter.set('ALL')"
              >
                All ({{ screenerService.totalMatches() }})
              </button>
              <button
                type="button"
                class="filter-pill pill-bullish"
                [class.active]="activeStrategyFilter() === 'BUY'"
                (click)="activeStrategyFilter.set('BUY')"
              >
                <span class="material-symbols-rounded mini-icon">trending_up</span>
                Bullish ({{ screenerService.bullishMatches() }})
              </button>
              <button
                type="button"
                class="filter-pill pill-bearish"
                [class.active]="activeStrategyFilter() === 'SELL'"
                (click)="activeStrategyFilter.set('SELL')"
              >
                <span class="material-symbols-rounded mini-icon">trending_down</span>
                Bearish ({{ screenerService.bearishMatches() }})
              </button>
              <button
                type="button"
                class="filter-pill"
                [class.active]="activeStrategyFilter() === 'OB'"
                (click)="activeStrategyFilter.set('OB')"
              >
                Order Blocks
              </button>
              <button
                type="button"
                class="filter-pill"
                [class.active]="activeStrategyFilter() === 'SWEEP'"
                (click)="activeStrategyFilter.set('SWEEP')"
              >
                Liquidity Sweeps
              </button>
            </div>
          </div>

          <!-- Empty / Initial States -->
          <div *ngIf="!screenerService.scanResults() && !screenerService.isScanning()" class="empty-state-card">
            <div class="empty-icon-wrap">
              <span class="material-symbols-rounded">radar</span>
            </div>
            <div class="empty-title">Ready to Scan Large-Cap Stocks</div>
            <div class="empty-desc">
              Select your preferred timeframe (15m, 1h, 1d, 1wk) above and click <strong>"Run Technical Scan"</strong>
              to scan the active universe for unmitigated Order Blocks and Liquidity Sweep Reversals.
            </div>
            <button type="button" class="empty-action-btn" (click)="runScan()">
              <span class="material-symbols-rounded">play_arrow</span>
              <span>Execute First Scan ({{ screenerService.selectedTimeframe() }})</span>
            </button>
          </div>

          <!-- Zero Matches Found State -->
          <div
            *ngIf="screenerService.scanResults() && screenerService.totalMatches() === 0 && !screenerService.isScanning()"
            class="empty-state-card"
          >
            <div class="empty-icon-wrap amber">
              <span class="material-symbols-rounded">search_off</span>
            </div>
            <div class="empty-title">No Strategy Matches Found on {{ screenerService.selectedTimeframe() }}</div>
            <div class="empty-desc">
              None of the {{ screenerService.totalScanned() }} scanned stocks currently test fresh Order Block zones
              or recent Liquidity Sweep rejection levels on the <strong>{{ screenerService.selectedTimeframe() }}</strong> timeframe.
              Try selecting a different timeframe (e.g. 1h or 1d) or re-scanning later in the session.
            </div>
          </div>

          <!-- Scanning Loading State -->
          <div *ngIf="screenerService.isScanning()" class="loading-state-card">
            <div class="scan-spinner"></div>
            <div class="loading-title">Analyzing Historical OHLCV Candles...</div>
            <div class="loading-desc">
              Executing Order Block impulse &amp; freshness checks and liquidity sweep detections across {{ screenerService.enabledWatchlistCount() }} stocks.
            </div>
          </div>

          <!-- RESULTS TABLE (DESKTOP) / CARDS (MOBILE) -->
          <div *ngIf="filteredMatches().length > 0 && !screenerService.isScanning()" class="results-table-wrapper">
            <table class="setups-table">
              <thead>
                <tr>
                  <th>Stock Ticker / Name</th>
                  <th>Current Price (CMP)</th>
                  <th>Matched Strategy</th>
                  <th>Suggested Entry</th>
                  <th>Suggested Stop-Loss</th>
                  <th>Risk Distance</th>
                  <th>Timeframe</th>
                  <th class="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let match of filteredMatches()" class="setup-row" [class.bullish-row]="match.signalType === 'BUY'" [class.bearish-row]="match.signalType === 'SELL'">
                  <!-- Stock Ticker & Name (No .NS clutter) -->
                  <td class="stock-cell">
                    <div class="ticker-box">
                      <span class="ticker-symbol mono-val">{{ match.symbol }}</span>
                      <span class="ticker-fullname">{{ match.name }}</span>
                    </div>
                  </td>

                  <!-- Current Market Price (CMP) in INR -->
                  <td class="cmp-cell">
                    <div class="cmp-value mono-val">
                      {{ match.cmp | currencyInr }}
                    </div>
                  </td>

                  <!-- Matched Strategy Badge -->
                  <td class="strategy-cell">
                    <div
                      class="strategy-badge"
                      [class.badge-demand]="match.strategy === 'DEMAND_ORDER_BLOCK'"
                      [class.badge-supply]="match.strategy === 'SUPPLY_ORDER_BLOCK'"
                      [class.badge-bull-sweep]="match.strategy === 'BULLISH_LIQUIDITY_SWEEP'"
                      [class.badge-bear-sweep]="match.strategy === 'BEARISH_LIQUIDITY_SWEEP'"
                    >
                      <span class="material-symbols-rounded badge-icon">
                        {{ match.signalType === 'BUY' ? 'trending_up' : 'trending_down' }}
                      </span>
                      <span>{{ match.strategyLabel }}</span>
                    </div>
                    <div *ngIf="match.details?.notes" class="strategy-subnote">
                      {{ match.details?.notes }}
                    </div>
                  </td>

                  <!-- Suggested Entry Price -->
                  <td class="entry-cell">
                    <div class="price-val mono-val entry-price">
                      {{ match.entryPrice | currencyInr }}
                    </div>
                  </td>

                  <!-- Suggested Stop-Loss Price -->
                  <td class="sl-cell">
                    <div class="price-val mono-val sl-price">
                      {{ match.stopLossPrice | currencyInr }}
                    </div>
                  </td>

                  <!-- Risk Distance (Pts & %) -->
                  <td class="risk-cell">
                    <div class="risk-points mono-val">
                      &plusmn;{{ match.riskPoints | number : '1.2-2' }} pts
                    </div>
                    <div class="risk-pct mono-val text-muted">
                      ({{ match.riskPercent | number : '1.2-2' }}%)
                    </div>
                  </td>

                  <!-- Timeframe -->
                  <td class="tf-cell">
                    <span class="tf-badge">{{ match.timeframe }}</span>
                  </td>

                  <!-- Action: Quick Alert Composer Trigger -->
                  <td class="action-cell text-right">
                    <button
                      type="button"
                      class="trade-setup-btn"
                      (click)="goToComposerWithSetup(match)"
                      matTooltip="Pre-fill alert composer on Live Monitor"
                    >
                      <span class="material-symbols-rounded">bolt</span>
                      <span>Create Alert</span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
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
        padding-bottom: 48px;
        font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      }

      .page-body {
        max-width: 1400px;
        margin: 0 auto;
        padding: 24px 20px;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .mono-val {
        font-family: 'JetBrains Mono', monospace;
      }

      /* CONTROL HEADER CARD */
      .control-header-card {
        background: #151c2c;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 14px;
        padding: 20px 24px;
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
        gap: 10px;
        font-size: 1.35rem;
        font-weight: 700;
        color: #f8fafc;
        letter-spacing: -0.01em;

        .page-icon {
          color: #00d2c4;
          font-size: 28px;
        }
      }

      .page-subtitle {
        font-size: 0.85rem;
        color: #94a3b8;
      }

      .controls-toolbar {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 16px;
      }

      .timeframe-group {
        display: flex;
        align-items: center;
        gap: 8px;

        .control-label {
          font-size: 0.82rem;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
      }

      .timeframe-chips {
        display: flex;
        background: #0b0f19;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 3px;
        gap: 2px;
      }

      .tf-chip {
        background: transparent;
        border: none;
        color: #94a3b8;
        padding: 6px 12px;
        font-size: 0.82rem;
        font-weight: 600;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover:not(:disabled) {
          color: #f1f5f9;
          background: rgba(255, 255, 255, 0.04);
        }

        &.active {
          background: #00d2c4;
          color: #0b0f19;
          font-weight: 700;
        }
      }

      .actions-group {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .manage-watchlist-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #cbd5e1;
        padding: 8px 14px;
        border-radius: 8px;
        font-size: 0.84rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #f8fafc;
        }

        &.active {
          border-color: #6366f1;
          color: #a5b4fc;
          background: rgba(99, 102, 241, 0.1);
        }

        .chevron {
          font-size: 18px;
        }
      }

      .run-scan-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: linear-gradient(135deg, #00d2c4 0%, #0284c7 100%);
        border: none;
        color: #0b0f19;
        padding: 9px 18px;
        border-radius: 8px;
        font-size: 0.86rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 2px 8px rgba(0, 210, 196, 0.25);

        &:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 210, 196, 0.4);
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

      /* WATCHLIST MANAGER */
      .watchlist-manager-card {
        background: #151c2c;
        border: 1px solid rgba(99, 102, 241, 0.25);
        border-radius: 14px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
      }

      .watchlist-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
      }

      .wl-title-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .wl-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 1.05rem;
        font-weight: 700;
        color: #f8fafc;

        code {
          background: #0b0f19;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.8rem;
          color: #00d2c4;
          font-family: 'JetBrains Mono', monospace;
        }
      }

      .wl-subtitle {
        font-size: 0.82rem;
        color: #94a3b8;
      }

      .wl-reset-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #94a3b8;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 0.78rem;
        font-weight: 600;
        cursor: pointer;

        &:hover:not(:disabled) {
          color: #f1f5f9;
          border-color: rgba(255, 255, 255, 0.25);
        }
      }

      .add-ticker-bar {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: flex-end;
        background: #0b0f19;
        padding: 12px 14px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.05);

        .input-field {
          display: flex;
          flex-direction: column;
          gap: 4px;

          &.grow {
            flex-grow: 1;
            min-width: 200px;
          }

          label {
            font-size: 0.74rem;
            font-weight: 600;
            color: #94a3b8;
          }

          input {
            background: #151c2c;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 6px;
            color: #f1f5f9;
            padding: 8px 10px;
            font-size: 0.84rem;
            outline: none;

            &:focus {
              border-color: #00d2c4;
            }
          }
        }

        .add-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #6366f1;
          border: none;
          color: #fff;
          padding: 8px 14px;
          border-radius: 6px;
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          height: 35px;

          &:hover:not(:disabled) {
            background: #4f46e5;
          }

          &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
        }
      }

      .watchlist-filter-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
      }

      .search-input-wrap {
        display: flex;
        align-items: center;
        gap: 6px;
        background: #0b0f19;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 6px;
        padding: 6px 10px;
        width: 260px;

        span {
          color: #64748b;
          font-size: 18px;
        }

        input {
          background: transparent;
          border: none;
          outline: none;
          color: #f1f5f9;
          font-size: 0.82rem;
          width: 100%;
        }
      }

      .bulk-toggles {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.8rem;

        .mini-link-btn {
          background: none;
          border: none;
          color: #00d2c4;
          cursor: pointer;
          padding: 0;

          &:hover {
            text-decoration: underline;
          }
        }

        .divider {
          color: #475569;
        }
      }

      .tickers-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 8px;
        max-height: 280px;
        overflow-y: auto;
        padding-right: 4px;
      }

      .ticker-card {
        background: #0b0f19;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        padding: 8px 12px;
        display: flex;
        align-items: center;
        gap: 10px;
        transition: all 0.15s;

        &.disabled {
          opacity: 0.45;
          border-style: dashed;
        }

        .ticker-checkbox {
          cursor: pointer;
          display: flex;
          align-items: center;

          input {
            accent-color: #00d2c4;
            cursor: pointer;
          }
        }

        .ticker-info {
          flex: 1;
          cursor: pointer;
          overflow: hidden;
        }

        .ticker-symbol {
          font-weight: 700;
          font-size: 0.86rem;
          color: #f8fafc;
          font-family: 'JetBrains Mono', monospace;
        }

        .ticker-name {
          font-size: 0.72rem;
          color: #94a3b8;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ticker-sector {
          font-size: 0.65rem;
          color: #64748b;
          text-transform: uppercase;
        }

        .ticker-del-btn {
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 2px;
          border-radius: 4px;

          &:hover {
            color: #f43f5e;
            background: rgba(244, 63, 94, 0.1);
          }

          span {
            font-size: 16px;
          }
        }
      }

      /* KPI METRICS GRID */
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 14px;
      }

      .kpi-card {
        background: #151c2c;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 16px 20px;
        display: flex;
        flex-direction: column;
        gap: 4px;

        &.highlight-cyan {
          border-color: rgba(0, 210, 196, 0.25);
        }

        &.highlight-emerald {
          border-color: rgba(16, 185, 129, 0.25);
        }

        &.highlight-coral {
          border-color: rgba(244, 63, 94, 0.25);
        }

        .kpi-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.78rem;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.02em;

          span.material-symbols-rounded {
            font-size: 18px;
          }
        }

        .kpi-value {
          font-size: 1.85rem;
          font-weight: 700;
          color: #f8fafc;
          line-height: 1.1;
        }

        .kpi-subtext {
          font-size: 0.74rem;
          color: #64748b;
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
        .text-emerald {
          color: #10b981;
        }
        .text-coral {
          color: #f43f5e;
        }
      }

      /* SETUPS CONTAINER */
      .setups-container {
        background: #151c2c;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 14px;
        padding: 20px 24px;
        display: flex;
        flex-direction: column;
        gap: 16px;
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
        font-size: 1.1rem;
        font-weight: 700;
        color: #f8fafc;

        span.material-symbols-rounded {
          color: #6366f1;
        }

        .count-badge {
          background: #6366f1;
          color: #fff;
          font-size: 0.74rem;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 10px;
        }
      }

      .filter-chips-bar {
        display: flex;
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
        padding: 5px 11px;
        border-radius: 6px;
        font-size: 0.78rem;
        font-weight: 600;
        cursor: pointer;

        &:hover {
          color: #f1f5f9;
        }

        &.active {
          background: #6366f1;
          border-color: #6366f1;
          color: #fff;
        }

        &.pill-bullish.active {
          background: #10b981;
          border-color: #10b981;
        }

        &.pill-bearish.active {
          background: #f43f5e;
          border-color: #f43f5e;
        }

        .mini-icon {
          font-size: 14px;
        }
      }

      /* EMPTY & LOADING STATES */
      .empty-state-card {
        padding: 48px 24px;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;

        .empty-icon-wrap {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: rgba(0, 210, 196, 0.1);
          color: #00d2c4;
          display: flex;
          align-items: center;
          justify-content: center;

          &.amber {
            background: rgba(245, 158, 11, 0.1);
            color: #f59e0b;
          }

          span {
            font-size: 30px;
          }
        }

        .empty-title {
          font-size: 1.15rem;
          font-weight: 700;
          color: #f8fafc;
        }

        .empty-desc {
          max-width: 540px;
          font-size: 0.86rem;
          color: #94a3b8;
          line-height: 1.5;
        }

        .empty-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 8px;
          background: #00d2c4;
          border: none;
          color: #0b0f19;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 0.84rem;
          font-weight: 700;
          cursor: pointer;
        }
      }

      .loading-state-card {
        padding: 56px 24px;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;

        .scan-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(0, 210, 196, 0.15);
          border-top-color: #00d2c4;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .loading-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: #f8fafc;
        }

        .loading-desc {
          font-size: 0.84rem;
          color: #94a3b8;
        }
      }

      /* RESULTS TABLE */
      .results-table-wrapper {
        overflow-x: auto;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.06);
      }

      .setups-table {
        width: 100%;
        border-collapse: collapse;
        text-align: left;
        font-size: 0.84rem;

        th {
          background: #0e1422;
          color: #94a3b8;
          font-weight: 600;
          font-size: 0.74rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 12px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          white-space: nowrap;
        }

        td {
          padding: 14px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          vertical-align: middle;
        }

        tr.setup-row {
          transition: background-color 0.15s;

          &:hover {
            background-color: rgba(255, 255, 255, 0.03);
          }

          &.bullish-row {
            border-left: 3px solid #10b981;
          }

          &.bearish-row {
            border-left: 3px solid #f43f5e;
          }
        }
      }

      .stock-cell {
        min-width: 160px;

        .ticker-box {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .ticker-symbol {
          font-weight: 700;
          font-size: 0.95rem;
          color: #f8fafc;
        }

        .ticker-fullname {
          font-size: 0.74rem;
          color: #94a3b8;
        }
      }

      .cmp-cell {
        .cmp-value {
          font-size: 0.92rem;
          font-weight: 700;
          color: #f8fafc;
        }
      }

      .strategy-cell {
        min-width: 220px;

        .strategy-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 9px;
          border-radius: 6px;
          font-size: 0.76rem;
          font-weight: 700;

          .badge-icon {
            font-size: 15px;
          }

          &.badge-demand,
          &.badge-bull-sweep {
            background: rgba(16, 185, 129, 0.15);
            color: #10b981;
            border: 1px solid rgba(16, 185, 129, 0.3);
          }

          &.badge-supply,
          &.badge-bear-sweep {
            background: rgba(244, 63, 94, 0.15);
            color: #f43f5e;
            border: 1px solid rgba(244, 63, 94, 0.3);
          }
        }

        .strategy-subnote {
          font-size: 0.7rem;
          color: #64748b;
          margin-top: 3px;
        }
      }

      .entry-cell {
        .entry-price {
          font-size: 0.9rem;
          font-weight: 700;
          color: #00d2c4;
        }
      }

      .sl-cell {
        .sl-price {
          font-size: 0.9rem;
          font-weight: 700;
          color: #f43f5e;
        }
      }

      .risk-cell {
        .risk-points {
          font-size: 0.82rem;
          font-weight: 600;
          color: #cbd5e1;
        }

        .risk-pct {
          font-size: 0.72rem;
          color: #64748b;
        }
      }

      .tf-cell {
        .tf-badge {
          background: #0b0f19;
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 0.74rem;
          font-weight: 600;
          color: #94a3b8;
          font-family: 'JetBrains Mono', monospace;
        }
      }

      .trade-setup-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: rgba(99, 102, 241, 0.12);
        border: 1px solid rgba(99, 102, 241, 0.35);
        color: #a5b4fc;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 0.76rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.15s;

        &:hover {
          background: #6366f1;
          color: #fff;
        }

        span.material-symbols-rounded {
          font-size: 16px;
        }
      }

      .text-right {
        text-align: right;
      }

      /* RESPONSIVE DESIGN (RULE 6) */
      @media (max-width: 768px) {
        .page-body {
          padding: 16px 12px;
          gap: 16px;
        }

        .control-header-card {
          padding: 16px;
          flex-direction: column;
          align-items: stretch;
        }

        .controls-toolbar {
          flex-direction: column;
          align-items: stretch;
        }

        .timeframe-group {
          justify-content: space-between;
        }

        .actions-group {
          justify-content: stretch;

          button {
            flex: 1;
          }
        }

        .kpi-grid {
          grid-template-columns: 1fr 1fr;
        }

        .setups-container {
          padding: 16px;
        }
      }
    `,
  ],
})
export class ScreenerComponent {
  readonly screenerService = inject(ScreenerService);
  private readonly router = inject(Router);

  readonly availableTimeframes = [
    { value: '15m', label: '15 Min' },
    { value: '1h', label: '1 Hour' },
    { value: '1d', label: '1 Day' },
    { value: '1wk', label: '1 Week' },
  ];

  readonly isWatchlistOpen = signal<boolean>(false);
  readonly watchlistSearch = signal<string>('');
  readonly activeStrategyFilter = signal<string>('ALL');

  // New stock form state
  newSymbol = '';
  newName = '';
  newSector = '';

  readonly filteredWatchlist = computed<WatchlistStockItem[]>(() => {
    const list = this.screenerService.watchlist();
    const query = this.watchlistSearch().trim().toUpperCase();
    if (!query) return list;
    return list.filter(
      (s) =>
        s.symbol.toUpperCase().includes(query) ||
        (s.name && s.name.toUpperCase().includes(query)) ||
        (s.sector && s.sector.toUpperCase().includes(query)),
    );
  });

  readonly filteredMatches = computed<ScreenerMatch[]>(() => {
    const matches = this.screenerService.matches();
    const filter = this.activeStrategyFilter();

    if (filter === 'BUY') {
      return matches.filter((m) => m.signalType === 'BUY');
    }
    if (filter === 'SELL') {
      return matches.filter((m) => m.signalType === 'SELL');
    }
    if (filter === 'OB') {
      return matches.filter((m) => m.strategy.includes('ORDER_BLOCK'));
    }
    if (filter === 'SWEEP') {
      return matches.filter((m) => m.strategy.includes('SWEEP'));
    }
    return matches;
  });

  onSelectTimeframe(tf: string): void {
    this.screenerService.setTimeframe(tf);
    this.runScan();
  }

  runScan(): void {
    this.screenerService.runScan();
  }

  addNewStock(): void {
    if (!this.newSymbol.trim()) return;
    this.screenerService.addStock(this.newSymbol, this.newName, this.newSector);
    this.newSymbol = '';
    this.newName = '';
    this.newSector = '';
  }

  toggleAll(enabled: boolean): void {
    const current = this.screenerService.watchlist();
    const updated = current.map((s) => ({ ...s, enabled }));
    this.screenerService.watchlist.set(updated);
    this.screenerService.updateWatchlist(updated).subscribe();
  }

  goToComposerWithSetup(match: ScreenerMatch): void {
    // Navigate to dashboard live monitor with prefill query params
    this.router.navigate(['/'], {
      queryParams: {
        symbol: match.symbol,
        targetPrice: match.entryPrice,
        stopLoss: match.stopLossPrice,
        strategy: match.strategy,
      },
    });
  }
}

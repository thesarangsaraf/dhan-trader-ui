import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TradeService } from '../../core/api/trade.service';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';
import { IstDatePipe } from '../../shared/pipes/ist-date.pipe';
import { SectionErrorComponent } from '../../shared/components/section-error/section-error.component';
import { HistoricalTradeItem } from '../../core/models/trade.models';

@Component({
  selector: 'app-trade-history',
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
    <div class="trade-history-root">
      <!-- MAIN PAGE CONTENT -->
      <main class="page-body">
        <!-- PAGE CONTROL HEADER -->
        <section class="control-header-card">
          <div class="title-group">
            <div class="page-title">
              <span class="material-symbols-rounded page-icon">history_edu</span>
              <span>Historical Trade Book</span>
            </div>
            <div class="page-subtitle">
              Consolidated trades with executed buy & sell prices, realized P&L, and human-readable instrument names
            </div>
          </div>

          <!-- Financial Year & Range Selectors -->
          <div class="controls-toolbar">
            <!-- Financial Year Dropdown -->
            <div class="fy-selector-group">
              <label for="fySelect" class="control-label">Financial Year:</label>
              <div class="select-wrapper">
                <select
                  id="fySelect"
                  class="styled-select"
                  [ngModel]="isCustomMode() ? 'CUSTOM' : tradeService.selectedFinancialYear()"
                  (ngModelChange)="onFyChange($event)"
                >
                  <option *ngFor="let fy of tradeService.financialYears()" [value]="fy.value">
                    {{ fy.label }}
                  </option>
                  <option value="CUSTOM">Custom Date Range...</option>
                </select>
                <span class="material-symbols-rounded select-arrow">expand_more</span>
              </div>
            </div>

            <!-- Custom Date Inputs (when in custom mode) -->
            <div *ngIf="isCustomMode()" class="custom-dates-group">
              <div class="date-field">
                <label class="control-label">From:</label>
                <input
                  type="date"
                  class="styled-date-input"
                  [(ngModel)]="customFrom"
                />
              </div>
              <div class="date-field">
                <label class="control-label">To:</label>
                <input
                  type="date"
                  class="styled-date-input"
                  [(ngModel)]="customTo"
                />
              </div>
              <button class="apply-date-btn" (click)="applyCustomDateRange()">
                Apply
              </button>
            </div>

            <!-- Active Date Range Pill -->
            <div class="date-range-badge" *ngIf="tradeService.fromDate() && tradeService.toDate()">
              <span class="material-symbols-rounded">calendar_month</span>
              <span class="mono-val">
                {{ tradeService.fromDate() | istDate : 'full' | slice : 0 : 11 }} —
                {{ tradeService.toDate() | istDate : 'full' | slice : 0 : 11 }}
              </span>
              <span *ngIf="tradeService.isCurrent()" class="current-pill">Current FY</span>
            </div>

            <!-- Refresh Button -->
            <button
              class="refresh-btn"
              (click)="tradeService.refresh()"
              [disabled]="tradeService.isLoading()"
              matTooltip="Refresh Trade Book from Dhan API"
            >
              <span class="material-symbols-rounded" [class.spinning]="tradeService.isLoading()">sync</span>
              <span>Refresh</span>
            </button>
          </div>
        </section>

        <!-- KPI SUMMARY CARDS (FOCUSED ON P&L AND TRADES) -->
        <section class="summary-cards-grid" *ngIf="tradeService.summary() as sum">
          <!-- Realized P&L Card -->
          <div
            class="kpi-card pnl-kpi"
            [ngClass]="(sum.totalRealizedPnL || 0) >= 0 ? 'profit' : 'loss'"
          >
            <div class="kpi-icon-wrap">
              <span class="material-symbols-rounded">{{ (sum.totalRealizedPnL || 0) >= 0 ? 'trending_up' : 'trending_down' }}</span>
            </div>
            <div class="kpi-content">
              <div class="kpi-label">Realized P&L</div>
              <div class="kpi-value mono-val">{{ (sum.totalRealizedPnL || 0) | currencyInr : true }}</div>
              <div class="kpi-hint">
                <span *ngIf="sum.totalCharges">Charges: -{{ sum.totalCharges | currencyInr : false }}</span>
                <span *ngIf="!sum.totalCharges">Gross Realized Profit & Loss</span>
              </div>
            </div>
          </div>

          <!-- Completed Roundtrip Trades -->
          <div class="kpi-card trades-kpi">
            <div class="kpi-icon-wrap">
              <span class="material-symbols-rounded">check_circle</span>
            </div>
            <div class="kpi-content">
              <div class="kpi-label">Completed Trades</div>
              <div class="kpi-value mono-val">{{ sum.closedTradesCount ?? sum.totalTrades ?? 0 }} Trades</div>
              <div class="kpi-hint">{{ sum.totalTrades }} Total Recorded Positions</div>
            </div>
          </div>

          <!-- Win Rate Card -->
          <div class="kpi-card winrate-kpi">
            <div class="kpi-icon-wrap">
              <span class="material-symbols-rounded">military_tech</span>
            </div>
            <div class="kpi-content">
              <div class="kpi-label">Trade Win Rate</div>
              <div class="kpi-value mono-val">{{ sum.winRate || 0 }}%</div>
              <div class="kpi-hint">{{ sum.profitableTradesCount || 0 }} Wins / {{ sum.lossTradesCount || 0 }} Losses</div>
            </div>
          </div>

          <!-- Total Quantity Traded -->
          <div class="kpi-card volume-kpi">
            <div class="kpi-icon-wrap">
              <span class="material-symbols-rounded">layers</span>
            </div>
            <div class="kpi-content">
              <div class="kpi-label">Total Traded Quantity</div>
              <div class="kpi-value mono-val">{{ sum.totalQuantity || 0 }} Shares / Lots</div>
              <div class="kpi-hint">Total Volume Executed</div>
            </div>
          </div>
        </section>

        <!-- ERROR STATE -->
        <app-section-error
          *ngIf="tradeService.error() as err"
          title="Failed to Load Historical Trades"
          [message]="err"
          icon="history_edu"
          [showRetry]="true"
          (retry)="tradeService.refresh()"
        ></app-section-error>

        <!-- FILTERS AND TABLE CARD -->
        <section class="table-card">
          <div class="table-header-bar">
            <!-- Search by Instrument Name -->
            <div class="search-box">
              <span class="material-symbols-rounded search-icon">search</span>
              <input
                type="text"
                class="search-input"
                placeholder="Search by Instrument Name (e.g. NIFTY, SENSEX, RELIANCE)..."
                [ngModel]="tradeService.searchQuery()"
                (ngModelChange)="tradeService.setSearchQuery($event)"
              />
              <button
                *ngIf="tradeService.searchQuery()"
                class="clear-search-btn"
                (click)="tradeService.setSearchQuery('')"
              >
                <span class="material-symbols-rounded">close</span>
              </button>
            </div>

            <!-- Status Filter Pills (Profitable / Loss / All) -->
            <div class="status-filter-pills">
              <button
                class="pill-btn"
                [ngClass]="{ 'active': tradeService.selectedStatus() === 'ALL' }"
                (click)="tradeService.setStatusFilter('ALL')"
              >
                All Trades
              </button>
              <button
                class="pill-btn profit-pill"
                [ngClass]="{ 'active': tradeService.selectedStatus() === 'PROFIT' }"
                (click)="tradeService.setStatusFilter('PROFIT')"
              >
                Profitable
              </button>
              <button
                class="pill-btn loss-pill"
                [ngClass]="{ 'active': tradeService.selectedStatus() === 'LOSS' }"
                (click)="tradeService.setStatusFilter('LOSS')"
              >
                Loss-making
              </button>
            </div>

            <!-- Count Indicator -->
            <div class="trades-count-badge">
              <span>Showing {{ tradeService.filteredTrades().length }} of {{ tradeService.trades().length }} trades</span>
            </div>
          </div>

          <!-- CLEAN CONSOLIDATED TRADES TABLE -->
          <div class="table-responsive">
            <table class="trades-table" *ngIf="!tradeService.isLoading() && tradeService.filteredTrades().length > 0">
              <thead>
                <tr>
                  <th class="time-col">Buy / Sell / Duration</th>
                  <th>Instrument Name</th>
                  <th class="num-col">Quantity</th>
                  <th class="num-col">Trade Value</th>
                  <th class="num-col">Buy Price</th>
                  <th class="num-col">Sell Price</th>
                  <th class="num-col">Charges</th>
                  <th class="num-col">Realized P&L</th>
                  <th class="center-col">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let t of tradeService.filteredTrades(); let isEven = even; let isOdd = odd; let isFirst = first; let isLast = last" class="trade-row" [ngClass]="{ 'row-even': isEven, 'row-odd': isOdd, 'row-first': isFirst, 'row-last': isLast }">
                  <!-- Buy / Sell / Duration -->
                  <td class="time-cell mono-val">
                    <div class="time-date">
                      {{ (t.tradeDate || t.executionTime) | istDate : 'full' : false | slice : 0 : 11 }}
                    </div>
                    <div class="timing-sub-row">
                      <span class="fill-time buy-tag" *ngIf="t.buyTime">
                        <span class="side-char">B:</span>{{ t.buyTime | istDate : 'timeOnly' : false }}
                      </span>
                      <span class="time-arrow" *ngIf="t.buyTime && t.sellTime">&rarr;</span>
                      <span class="fill-time sell-tag" *ngIf="t.sellTime">
                        <span class="side-char">S:</span>{{ t.sellTime | istDate : 'timeOnly' : false }}
                      </span>
                      <span *ngIf="!t.buyTime && !t.sellTime">
                        {{ t.executionTime | istDate : 'timeOnly' : false }}
                      </span>
                    </div>
                    <div class="duration-badge-wrap" *ngIf="getTradeDuration(t)">
                      <span class="duration-badge">
                        <span class="material-symbols-rounded timer-icon">timer</span>
                        {{ getTradeDuration(t) }}
                      </span>
                    </div>
                  </td>

                  <!-- Instrument Name (Human Readable) -->
                  <td class="symbol-cell">
                    <div class="symbol-name">{{ t.customSymbol || t.symbol }}</div>
                  </td>

                  <!-- Quantity -->
                  <td class="num-col qty-cell mono-val">
                    {{ t.quantity }}
                  </td>

                  <!-- Trade Value (Turnover) -->
                  <td class="num-col trade-val-cell mono-val">
                    <span>{{ getTradeTurnover(t) | currencyInr : false }}</span>
                  </td>

                  <!-- Buy Price -->
                  <td class="num-col buy-cell mono-val">
                    <span *ngIf="t.buyPrice !== null && t.buyPrice !== undefined">{{ t.buyPrice | currencyInr : false }}</span>
                    <span *ngIf="t.buyPrice === null || t.buyPrice === undefined" class="muted">--</span>
                  </td>

                  <!-- Sell Price -->
                  <td class="num-col sell-cell mono-val">
                    <span *ngIf="t.sellPrice !== null && t.sellPrice !== undefined">{{ t.sellPrice | currencyInr : false }}</span>
                    <span *ngIf="t.sellPrice === null || t.sellPrice === undefined" class="muted">--</span>
                  </td>

                  <!-- Charges with Itemized Breakdown Tooltip -->
                  <td
                    class="num-col charges-cell mono-val"
                    [matTooltip]="getChargesBreakdownTooltip(t)"
                    matTooltipPosition="above"
                  >
                    <span *ngIf="t.totalCharges !== null && t.totalCharges !== undefined && t.totalCharges > 0" class="charges-amount">
                      {{ t.totalCharges | currencyInr : false }}
                    </span>
                    <span *ngIf="!t.totalCharges" class="muted">--</span>
                  </td>

                  <!-- Realized P&L (Gross) -->
                  <td class="num-col pnl-cell mono-val" [ngClass]="{ 'profit-text': (t.pnl || 0) > 0, 'loss-text': (t.pnl || 0) < 0 }">
                    <span *ngIf="t.pnl !== null && t.pnl !== undefined">{{ t.pnl | currencyInr : true }}</span>
                    <span *ngIf="t.pnl === null || t.pnl === undefined" class="muted">--</span>
                  </td>

                  <!-- Status Badge -->
                  <td class="center-col status-cell">
                    <span
                      class="status-pill"
                      [ngClass]="{
                        'closed-profit': (t.status === 'CLOSED' || !t.status) && (t.pnl || 0) >= 0,
                        'closed-loss': (t.status === 'CLOSED' || !t.status) && (t.pnl || 0) < 0,
                        'open-pill': !!t.status?.startsWith('OPEN')
                      }"
                    >
                      {{ t.status === 'CLOSED' || !t.status ? ((t.pnl || 0) >= 0 ? 'PROFIT' : 'LOSS') : t.status }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- LOADING SKELETON / SPINNER -->
            <div class="loading-state" *ngIf="tradeService.isLoading()">
              <span class="material-symbols-rounded spinning load-icon">sync</span>
              <div class="load-text">Fetching and consolidating trades from Dhan HQ API...</div>
            </div>

            <!-- EMPTY STATE -->
            <div
              class="empty-state"
              *ngIf="!tradeService.isLoading() && !tradeService.error() && tradeService.filteredTrades().length === 0"
            >
              <div class="empty-icon-wrap">
                <span class="material-symbols-rounded">history_toggle_off</span>
              </div>
              <div class="empty-title">No Trade Records Found</div>
              <div class="empty-desc">
                {{
                  tradeService.searchQuery() || tradeService.selectedStatus() !== 'ALL'
                    ? 'No trades matched your active filters. Try clearing your search query.'
                    : 'No executed trades were found for ' + (tradeService.selectedFinancialYear() || 'the selected period') + ' in your Dhan account.'
                }}
              </div>
            </div>
          </div>

          <!-- FOOTNOTE INFO BANNER -->
          <footer class="table-footnote">
            <span class="material-symbols-rounded note-icon">info</span>
            <span>
              <strong>Regulatory & Taxes Note:</strong> Raw exchange fills display the exact executed buy and sell prices.
              Applicable statutory levies (STT, Stamp Duty, GST, Exchange Turnover & SEBI fees) and Dhan brokerage are consolidated in your daily Contract Notes and debited via the Dhan Account Ledger.
            </span>
          </footer>
        </section>
      </main>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        min-height: 100%;
      }

      .trade-history-root {
        min-height: 100%;
        width: 100%;
        background-color: var(--mat-sys-background, #0b0f19);
        color: var(--mat-sys-on-background, #f1f5f9);
        display: flex;
        flex-direction: column;
      }

      /* PAGE BODY */
      .page-body {
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 20px;
        max-width: 1440px;
        margin: 0 auto;
        width: 100%;
        box-sizing: border-box;
        flex: 1 0 auto;
        padding-bottom: 64px;
      }

      /* CONTROL HEADER CARD */
      .control-header-card {
        background: var(--mat-sys-surface-container, #151c2c);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        padding: 20px 24px;
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
        font-size: 20px;
        font-weight: 700;
        color: #ffffff;
      }

      .page-icon {
        color: #00d2c4;
        font-size: 26px;
      }

      .page-subtitle {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.6);
      }

      .controls-toolbar {
        display: flex;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;
      }

      .fy-selector-group {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .control-label {
        font-size: 13px;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.7);
      }

      .select-wrapper {
        position: relative;
        display: flex;
        align-items: center;
      }

      .styled-select {
        appearance: none;
        background: rgba(255, 255, 255, 0.06);
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 10px;
        padding: 8px 36px 8px 14px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        outline: none;
        transition: border-color 0.2s;
      }

      .styled-select:focus {
        border-color: #00d2c4;
      }

      .styled-select option {
        background: #151c2c;
        color: #ffffff;
      }

      .select-arrow {
        position: absolute;
        right: 8px;
        pointer-events: none;
        color: rgba(255, 255, 255, 0.6);
        font-size: 20px;
      }

      .custom-dates-group {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .date-field {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .styled-date-input {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: #ffffff;
        padding: 6px 10px;
        border-radius: 8px;
        font-size: 12px;
        outline: none;
      }

      .apply-date-btn {
        background: #00d2c4;
        color: #0b0f19;
        border: none;
        border-radius: 8px;
        padding: 7px 14px;
        font-weight: 600;
        font-size: 12px;
        cursor: pointer;
      }

      .date-range-badge {
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(99, 102, 241, 0.12);
        border: 1px solid rgba(99, 102, 241, 0.3);
        color: #a5b4fc;
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 12px;
      }

      .current-pill {
        background: #10b981;
        color: #0b0f19;
        font-size: 10px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 10px;
      }

      .refresh-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: #ffffff;
        padding: 8px 16px;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }

      .refresh-btn:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.14);
      }

      /* KPI SUMMARY CARDS */
      .summary-cards-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
      }

      .kpi-card {
        background: var(--mat-sys-surface-container, #151c2c);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 14px;
        padding: 16px 20px;
        display: flex;
        align-items: center;
        gap: 16px;
        position: relative;
        overflow: hidden;
      }

      .kpi-icon-wrap {
        width: 46px;
        height: 46px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .pnl-kpi.profit .kpi-icon-wrap {
        background: rgba(16, 185, 129, 0.15);
        color: #10b981;
      }
      .pnl-kpi.profit {
        border-left: 4px solid #10b981;
      }
      .pnl-kpi.profit .kpi-value {
        color: #10b981;
      }

      .pnl-kpi.loss .kpi-icon-wrap {
        background: rgba(244, 63, 94, 0.15);
        color: #f43f5e;
      }
      .pnl-kpi.loss {
        border-left: 4px solid #f43f5e;
      }
      .pnl-kpi.loss .kpi-value {
        color: #f43f5e;
      }

      .trades-kpi .kpi-icon-wrap {
        background: rgba(0, 210, 196, 0.15);
        color: #00d2c4;
      }
      .trades-kpi {
        border-left: 4px solid #00d2c4;
      }

      .winrate-kpi .kpi-icon-wrap {
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
      }
      .winrate-kpi {
        border-left: 4px solid #f59e0b;
      }

      .volume-kpi .kpi-icon-wrap {
        background: rgba(99, 102, 241, 0.15);
        color: #818cf8;
      }
      .volume-kpi {
        border-left: 4px solid #6366f1;
      }

      .kpi-label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: rgba(255, 255, 255, 0.6);
      }

      .kpi-value {
        font-size: 20px;
        font-weight: 700;
        margin: 2px 0;
      }

      .kpi-hint {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.5);
      }

      /* TABLE CARD */
      .table-card {
        background: var(--mat-sys-surface-container, #151c2c);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        display: flex;
        flex-direction: column;
      }

      .table-header-bar {
        padding: 16px 20px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        flex-wrap: wrap;
      }

      .search-box {
        position: relative;
        display: flex;
        align-items: center;
        min-width: 320px;
        flex: 1;
        max-width: 480px;
      }

      .search-icon {
        position: absolute;
        left: 12px;
        color: rgba(255, 255, 255, 0.4);
        font-size: 20px;
      }

      .search-input {
        width: 100%;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #ffffff;
        padding: 8px 36px 8px 38px;
        border-radius: 10px;
        font-size: 13px;
        outline: none;
      }

      .search-input:focus {
        border-color: #00d2c4;
      }

      .clear-search-btn {
        position: absolute;
        right: 8px;
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.5);
        cursor: pointer;
        display: flex;
      }

      .status-filter-pills {
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(0, 0, 0, 0.2);
        padding: 4px;
        border-radius: 10px;
      }

      .pill-btn {
        background: transparent;
        border: none;
        color: rgba(255, 255, 255, 0.6);
        padding: 6px 12px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }

      .pill-btn.active {
        background: rgba(255, 255, 255, 0.12);
        color: #ffffff;
      }

      .pill-btn.profit-pill.active {
        background: rgba(16, 185, 129, 0.2);
        color: #10b981;
      }

      .pill-btn.loss-pill.active {
        background: rgba(244, 63, 94, 0.2);
        color: #f43f5e;
      }

      .trades-count-badge {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.5);
      }

      /* TABLE */
      .table-responsive {
        width: 100%;
        max-height: 620px;
        overflow-y: auto;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }

      .table-responsive::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }
      .table-responsive::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.2);
      }
      .table-responsive::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 4px;
      }
      .table-responsive::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.35);
      }

      .trades-table {
        width: 100%;
        min-width: 1040px;
        border-collapse: separate;
        border-spacing: 0;
        text-align: left;
        font-size: 13px;
      }

      .trades-table th {
        position: sticky;
        top: 0;
        z-index: 10;
        background: #151c2c;
        color: rgba(255, 255, 255, 0.6);
        font-weight: 600;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        padding: 12px 18px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow: 0 1px 0 rgba(255, 255, 255, 0.08);
      }

      .trades-table td {
        padding: 14px 18px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      }

      .trade-row:hover {
        background: rgba(255, 255, 255, 0.02);
      }

      .num-col {
        text-align: right;
      }

      .center-col {
        text-align: center;
      }

      .time-date {
        color: #ffffff;
        font-weight: 600;
        font-size: 13px;
      }

      .timing-sub-row {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.6);
        margin-top: 3px;
      }

      .fill-time {
        display: inline-flex;
        align-items: center;
        gap: 2px;
      }

      .buy-tag .side-char {
        color: #10b981;
        font-weight: 700;
      }

      .sell-tag .side-char {
        color: #f43f5e;
        font-weight: 700;
      }

      .time-arrow {
        color: rgba(255, 255, 255, 0.4);
        font-size: 11px;
      }

      .duration-badge-wrap {
        margin-top: 4px;
      }

      .duration-badge {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        background: rgba(99, 102, 241, 0.15);
        border: 1px solid rgba(99, 102, 241, 0.3);
        color: #a5b4fc;
        padding: 1px 6px;
        border-radius: 4px;
        font-size: 10.5px;
        font-weight: 600;
      }

      .timer-icon {
        font-size: 12px;
      }

      .symbol-name {
        font-weight: 700;
        font-size: 13.5px;
        color: #ffffff;
        letter-spacing: 0.2px;
      }

      .trade-val-cell {
        color: rgba(255, 255, 255, 0.85);
      }

      .buy-cell {
        color: rgba(255, 255, 255, 0.85);
      }

      .sell-cell {
        color: rgba(255, 255, 255, 0.85);
      }

      .charges-cell {
        color: rgba(255, 255, 255, 0.7);
        cursor: help;
        transition: color 0.15s;
      }

      .charges-cell:hover {
        color: #00d2c4;
      }

      .pnl-cell {
        font-weight: 700;
        font-size: 13.5px;
      }

      .profit-text {
        color: #10b981 !important;
      }

      .loss-text {
        color: #f43f5e !important;
      }

      .status-pill {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 6px;
        font-weight: 700;
        font-size: 11px;
        text-transform: uppercase;
      }

      .status-pill.closed-profit {
        background: rgba(16, 185, 129, 0.15);
        color: #10b981;
        border: 1px solid rgba(16, 185, 129, 0.3);
      }

      .status-pill.closed-loss {
        background: rgba(244, 63, 94, 0.15);
        color: #f43f5e;
        border: 1px solid rgba(244, 63, 94, 0.3);
      }

      .status-pill.open-pill {
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
        border: 1px solid rgba(245, 158, 11, 0.3);
      }

      /* LOADING AND EMPTY STATES */
      .loading-state,
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px 24px;
        gap: 12px;
        text-align: center;
      }

      .load-icon {
        font-size: 36px;
        color: #00d2c4;
      }

      .empty-icon-wrap {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.05);
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(255, 255, 255, 0.4);
      }

      .empty-icon-wrap span {
        font-size: 32px;
      }

      .empty-title {
        font-size: 16px;
        font-weight: 700;
        color: #ffffff;
      }

      .empty-desc {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.5);
        max-width: 440px;
      }

      /* FOOTNOTE */
      .table-footnote {
        padding: 14px 20px;
        background: rgba(0, 0, 0, 0.2);
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        display: flex;
        align-items: flex-start;
        gap: 10px;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
        line-height: 1.5;
      }

      .note-icon {
        color: #00d2c4;
        font-size: 18px;
        flex-shrink: 0;
        margin-top: 1px;
      }

      /* Mobile Optimizations for Historical Trade Book */
      @media (max-width: 768px) {
        .page-body {
          padding: 12px 12px 80px;
          gap: 12px;
        }

        .control-header-card {
          padding: 14px 16px;
          gap: 12px;
        }

        .page-title {
          font-size: 1.15rem;
        }

        .controls-toolbar {
          width: 100%;
          flex-direction: column;
          align-items: stretch;
          gap: 10px;
        }

        .fy-selector-group {
          width: 100%;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
        }

        .select-wrapper,
        .styled-select {
          width: 100%;
        }

        .custom-dates-group {
          width: 100%;
          flex-wrap: wrap;
          gap: 8px;
        }

        .date-field {
          flex: 1;
        }

        .styled-date-input {
          width: 100%;
          box-sizing: border-box;
        }

        .date-range-badge {
          width: 100%;
          box-sizing: border-box;
          justify-content: center;
        }

        .refresh-btn {
          width: 100%;
          justify-content: center;
          min-height: 40px;
        }

        .summary-cards-grid {
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .kpi-card {
          padding: 12px 14px;
          gap: 10px;
        }

        .kpi-icon-wrap {
          width: 36px;
          height: 36px;
        }

        .kpi-value {
          font-size: 1rem;
        }

        .table-header-bar {
          padding: 12px 14px;
          gap: 10px;
        }

        .search-box {
          min-width: 0;
          max-width: 100%;
          width: 100%;
        }

        .status-filter-pills {
          width: 100%;
          justify-content: space-between;
        }

        .pill-btn {
          flex: 1;
          text-align: center;
          padding: 6px 4px;
        }
      }

      @media (max-width: 460px) {
        .summary-cards-grid {
          grid-template-columns: 1fr;
        }
      }
    `
  ],
})
export class TradeHistoryComponent {
  readonly tradeService = inject(TradeService);

  readonly isCustomMode = signal<boolean>(false);
  customFrom = '';
  customTo = '';

  onFyChange(val: string): void {
    if (val === 'CUSTOM') {
      this.isCustomMode.set(true);
      if (!this.customFrom) this.customFrom = this.tradeService.fromDate();
      if (!this.customTo) this.customTo = this.tradeService.toDate();
    } else {
      this.isCustomMode.set(false);
      this.tradeService.selectFinancialYear(val);
    }
  }

  applyCustomDateRange(): void {
    if (this.customFrom && this.customTo) {
      this.tradeService.setCustomDateRange(this.customFrom, this.customTo);
    }
  }

  getTradeDuration(t: HistoricalTradeItem): string | null {
    if (t.holdingDuration) return t.holdingDuration;
    if (!t.buyTime || !t.sellTime) return null;
    const d1 = new Date(t.buyTime).getTime();
    const d2 = new Date(t.sellTime).getTime();
    if (isNaN(d1) || isNaN(d2) || d1 <= 0 || d2 <= 0) return null;
    const diffSec = Math.max(0, Math.round(Math.abs(d2 - d1) / 1000));
    const days = Math.floor(diffSec / 86400);
    const hours = Math.floor((diffSec % 86400) / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);
    const secs = diffSec % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  }

  getTradeTurnover(t: HistoricalTradeItem): number {
    if (t.tradeValue !== null && t.tradeValue !== undefined && t.tradeValue > 0) {
      return t.tradeValue;
    }
    const buy = (t.buyPrice || 0) * t.quantity;
    const sell = (t.sellPrice || 0) * t.quantity;
    return Math.round((buy + sell) * 100) / 100;
  }

  getChargesBreakdownTooltip(t: HistoricalTradeItem): string {
    if (!t.totalCharges) return 'No charges levied';
    const b = t.chargesBreakdown;
    if (b && (b.brokerage || b.stt || b.gst || b.exchangeCharges || b.stampDuty || b.sebiTax)) {
      const parts: string[] = [];
      if (b.brokerage !== undefined) parts.push(`Brokerage: ₹${b.brokerage.toFixed(2)}`);
      if (b.stt !== undefined) parts.push(`STT: ₹${b.stt.toFixed(2)}`);
      if (b.exchangeCharges !== undefined) parts.push(`Exchange: ₹${b.exchangeCharges.toFixed(2)}`);
      if (b.gst !== undefined) parts.push(`GST: ₹${b.gst.toFixed(2)}`);
      if (b.stampDuty !== undefined) parts.push(`Stamp Duty: ₹${b.stampDuty.toFixed(2)}`);
      if (b.sebiTax !== undefined) parts.push(`SEBI: ₹${b.sebiTax.toFixed(2)}`);
      return parts.join(' • ');
    }
    return `Dhan Brokerage & Statutory Taxes: ₹${t.totalCharges}`;
  }
}

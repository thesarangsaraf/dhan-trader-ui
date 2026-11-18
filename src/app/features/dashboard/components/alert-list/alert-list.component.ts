import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AlertService } from '../../../../core/api/alert.service';
import { InstrumentService } from '../../../../core/api/instrument.service';
import { AlertAttachedOrder, DhanAlert } from '../../../../core/models/alert.models';
import { SectionErrorComponent } from '../../../../shared/components/section-error/section-error.component';
import { CurrencyInrPipe } from '../../../../shared/pipes/currency-inr.pipe';
import { IstDatePipe } from '../../../../shared/pipes/ist-date.pipe';
import {
  AlertPreviewDialogComponent,
  AlertPreviewData,
} from '../../../../shared/components/alert-preview-dialog/alert-preview-dialog.component';

export interface LinkedStopLossDetails {
  alertId?: string;
  targetPrice: number;
  points?: number;
  operator?: string;
  status?: string;
  action: 'BUY' | 'SELL';
  symbol?: string;
  customSymbol?: string;
  quantity?: number;
  lots?: number;
  lotSize?: number;
  orderType?: string;
  orderId?: string | null;
  isPlaced?: boolean;
}

export interface AlertOrderLegRow {
  side: 'BUY' | 'SELL';
  contract: string;
  lots: number | null;
  lotSize: number | null;
  quantity: number;
  triggerPrice: number;
  orderType?: string;
  limitPrice?: number;
  orderId?: string | null;
  statusLabel?: string;
  isPlaced: boolean;
  isFailed: boolean;
  isPending: boolean;
}

export function normalizeAlertId(id?: string | null): string {
  return (id || '').replace(/^DHAN-/, '').trim();
}

export function areAlertIdsEqual(idA?: string | null, idB?: string | null): boolean {
  const a = normalizeAlertId(idA);
  const b = normalizeAlertId(idB);
  return Boolean(a && b && a === b);
}

export function matchesAlertId(candidateId?: string | null, alert?: DhanAlert | null): boolean {
  if (!candidateId || !alert) return false;
  return areAlertIdsEqual(candidateId, alert.id) || areAlertIdsEqual(candidateId, alert.dhanAlertId);
}

export function isClaimedByAnother(
  candidate: DhanAlert,
  currentAlert: DhanAlert,
  allAlerts: DhanAlert[],
): boolean {
  return allAlerts.some((other) => {
    if (other === currentAlert || other === candidate) return false;

    // 1. Other explicitly has candidate as linkedStopLossAlert
    if (
      other.linkedStopLossAlert &&
      (other.linkedStopLossAlert === candidate ||
        matchesAlertId(other.linkedStopLossAlert.id, candidate))
    ) {
      return true;
    }

    // 2. Other's stopLossAlertId matches candidate
    if (other.stopLossAlertId && matchesAlertId(other.stopLossAlertId, candidate)) {
      return true;
    }

    // 3. Candidate explicitly has parentAlertId matching other
    if (candidate.parentAlertId && matchesAlertId(candidate.parentAlertId, other)) {
      return true;
    }

    // 4. Candidate's remarks explicitly lists other's alert ID: Exit for #<otherId>
    const m = (candidate.remarks || '').match(/Exit (?:order )?for (?:parent )?(?:alert )?#([\w-]+)/i);
    if (m && matchesAlertId(m[1], other)) {
      return true;
    }

    return false;
  });
}

@Component({
  selector: 'app-alert-list',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDialogModule,
    SectionErrorComponent,
    CurrencyInrPipe,
    IstDatePipe,
  ],
  template: `
    <div class="alert-list-card m3-card">
      <div class="list-header">
        <div class="header-left">
          <span class="material-symbols-rounded alert-icon">radar</span>
          <div>
            <h3 class="card-title">Live Alert Monitor</h3>
            <span class="sub-status" *ngIf="!alertService.alertsError()">
              {{ headerSummaryText() }}
            </span>
            <span class="sub-status error-text" *ngIf="alertService.alertsError()">
              Server Unreachable
            </span>
          </div>
        </div>

        <div class="header-actions">
          <button mat-icon-button (click)="alertService.refreshAlerts()" matTooltip="Refresh Alerts">
            <span class="material-symbols-rounded">refresh</span>
          </button>
        </div>
      </div>

      <!-- Section Error State -->
      <app-section-error
        *ngIf="alertService.alertsError() as err"
        title="Failed to Load Alerts"
        [message]="err"
        (retry)="alertService.refreshAlerts()"
      ></app-section-error>

      <!-- Alerts List (Direct from Dhan) -->
      <div class="alerts-scroll-area" *ngIf="!alertService.alertsError()">
        <div *ngIf="displayAlerts().length === 0" class="empty-state">
          <span class="material-symbols-rounded empty-icon">notifications_none</span>
          <p>No alerts found from Dhan.</p>
        </div>

        <!-- SECTION 1: ALERTS WITH ORDERS (Priority Top Section) -->
        <section
          class="alert-section order-alerts-section"
          *ngIf="alertsWithOrders().length > 0"
          aria-label="Alerts with Orders"
        >
          <div class="section-header">
            <div class="section-title-group">
              <span class="material-symbols-rounded section-icon order-section-icon">bolt</span>
              <span class="section-title">Alerts with Orders</span>
            </div>
            <span class="section-count-badge order-count mono-val">{{ alertsWithOrders().length }}</span>
          </div>

          <div class="section-items">
            <div
              *ngFor="let alert of alertsWithOrders(); let isEven = even; let isOdd = odd"
              class="alert-item order-alert-card"
              [ngClass]="{
                'triggered': alert.status === 'TRIGGERED',
                'cancelled': alert.status === 'CANCELLED',
                'has-stop-loss': getLinkedStopLoss(alert) !== null,
                'row-even': isEven,
                'row-odd': isOdd
              }"
            >
              <!-- Card Header: Underlying Instrument + Status + Actions -->
              <div class="item-main order-card-header">
                <div class="col-inst">
                  <div class="inst-line">
                    <span class="inst-name">{{ alert.instrument }}</span>

                    <!-- Status chip: Omit 'ACTIVE' because all alerts are active by default -->
                    <span
                      class="status-chip"
                      *ngIf="alert.status !== 'ACTIVE'"
                      [ngClass]="{
                        'triggered': alert.status === 'TRIGGERED',
                        'cancelled': alert.status === 'CANCELLED'
                      }"
                    >
                      {{ alert.status }}
                    </span>

                    <!-- Triggered timestamp only when triggered -->
                    <span class="time-trigger mono-val" *ngIf="alert.triggeredAt">
                      &bull; Triggered: {{ alert.triggeredAt | istDate : 'timeOnly' }}
                    </span>
                  </div>
                </div>

                <!-- Action buttons: View Raw JSON from Dhan + Instant Delete -->
                <div class="col-actions">
                  <button
                    class="action-icon-btn json-btn"
                    (click)="openJsonDialog(alert)"
                    matTooltip="View Raw JSON from Dhan"
                    aria-label="View Raw JSON from Dhan"
                  >
                    <span class="material-symbols-rounded">data_object</span>
                  </button>
                  <button
                    class="action-icon-btn delete"
                    (click)="deleteAlert(alert)"
                    [matTooltip]="getLinkedStopLoss(alert) ? 'Delete Entry & Exit Orders' : 'Delete Order Alert'"
                    aria-label="Delete Order Alert"
                  >
                    <span class="material-symbols-rounded">delete</span>
                  </button>
                </div>
              </div>

              <!-- Structured Order Table -->
              <div class="order-table-wrap">
                <table class="order-legs-table">
                  <thead>
                    <tr>
                      <th class="col-side">Side</th>
                      <th class="col-contract">Contract</th>
                      <th class="col-lots">Lots</th>
                      <th class="col-trigger">Trigger Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      *ngFor="let leg of getOrderLegRows(alert)"
                      class="order-leg-row"
                      [ngClass]="leg.side === 'BUY' ? 'leg-buy' : 'leg-sell'"
                    >
                      <td class="col-side" data-label="Side">
                        <span
                          class="ord-side-chip"
                          [ngClass]="leg.side === 'BUY' ? 'buy' : 'sell'"
                        >
                          {{ leg.side }}
                        </span>
                      </td>

                      <td class="col-contract" data-label="Contract">
                        <div class="contract-cell">
                          <span class="ord-symbol mono-val">{{ leg.contract }}</span>
                          <span
                            class="ord-meta-pill mono-val"
                            *ngIf="leg.orderType && leg.orderType !== 'MARKET'"
                          >
                            {{ leg.orderType }}<ng-container *ngIf="leg.limitPrice && leg.limitPrice > 0"> {{ leg.limitPrice | currencyInr : false }}</ng-container>
                          </span>
                          <span
                            class="ord-meta-pill order-id-pill mono-val"
                            *ngIf="leg.orderId"
                            matTooltip="Dhan Order ID"
                          >
                            #{{ leg.orderId }}
                          </span>
                          <span
                            class="ord-status-badge"
                            *ngIf="!leg.isPending && leg.statusLabel"
                            [ngClass]="{
                              'placed': leg.isPlaced,
                              'failed': leg.isFailed
                            }"
                          >
                            {{ leg.statusLabel }}
                          </span>
                        </div>
                      </td>

                      <td
                        class="col-lots mono-val"
                        data-label="Lots"
                        [matTooltip]="leg.lots !== null ? (leg.lots + ' lots · ' + leg.quantity + ' qty') : (leg.quantity + ' qty')"
                      >
                        <ng-container *ngIf="leg.lots !== null; else qtyOnlyTpl">
                          <span class="lots-primary">{{ leg.lots }}</span>
                        </ng-container>
                        <ng-template #qtyOnlyTpl>
                          <span class="lots-primary">{{ leg.quantity }}</span>&nbsp;<span class="lots-unit">qty</span>
                        </ng-template>
                      </td>

                      <td class="col-trigger mono-val" data-label="Trigger">
                        <span
                          class="trigger-price-val"
                          [ngClass]="leg.side === 'BUY' ? 'buy-price' : 'sell-price'"
                        >
                          {{ leg.triggerPrice | currencyInr : false }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <!-- SECTION 2: PRICE ALERTS (Alerts without attached orders) -->
        <section
          class="alert-section price-alerts-section"
          *ngIf="priceOnlyAlerts().length > 0"
          aria-label="Price Alerts"
        >
          <div class="section-header">
            <div class="section-title-group">
              <span class="material-symbols-rounded section-icon price-section-icon">notifications_active</span>
              <span class="section-title">Price Alerts</span>
            </div>
            <span class="section-count-badge mono-val">{{ priceOnlyAlerts().length }}</span>
          </div>

          <div class="section-items">
            <div
              *ngFor="let alert of priceOnlyAlerts(); let isEven = even; let isOdd = odd"
              class="alert-item price-alert-card"
              [ngClass]="{
                'triggered': alert.status === 'TRIGGERED',
                'cancelled': alert.status === 'CANCELLED',
                'row-even': isEven,
                'row-odd': isOdd
              }"
            >
              <!-- Main Row: Instrument, Target Price, Actions -->
              <div class="item-main">
                <div class="col-inst">
                  <div class="inst-line">
                    <span class="inst-name">{{ alert.instrument }}</span>

                    <!-- Status chip: Omit 'ACTIVE' because all alerts are active by default -->
                    <span
                      class="status-chip"
                      *ngIf="alert.status !== 'ACTIVE'"
                      [ngClass]="{
                        'triggered': alert.status === 'TRIGGERED',
                        'cancelled': alert.status === 'CANCELLED'
                      }"
                    >
                      {{ alert.status }}
                    </span>

                    <!-- Triggered timestamp only when triggered -->
                    <span class="time-trigger mono-val" *ngIf="alert.triggeredAt">
                      &bull; Triggered: {{ alert.triggeredAt | istDate : 'timeOnly' }}
                    </span>
                  </div>
                </div>

                <div class="col-target">
                  <span class="target-label">Target</span>
                  <div class="price-val mono-val">
                    {{ alert.targetPrice | currencyInr : false }}
                  </div>
                </div>

                <!-- Action buttons: View Raw JSON from Dhan + Instant Delete -->
                <div class="col-actions">
                  <button
                    class="action-icon-btn json-btn"
                    (click)="openJsonDialog(alert)"
                    matTooltip="View Raw JSON from Dhan"
                    aria-label="View Raw JSON from Dhan"
                  >
                    <span class="material-symbols-rounded">data_object</span>
                  </button>
                  <button
                    class="action-icon-btn delete"
                    (click)="deleteAlert(alert)"
                    matTooltip="Delete Alert"
                    aria-label="Delete Alert"
                  >
                    <span class="material-symbols-rounded">delete</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      .alert-list-card {
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
      }
      .list-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
      }
      .header-left {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .alert-icon {
        font-size: 20px;
        color: var(--dhan-cyan);
      }
      .card-title {
        font-size: 0.9375rem;
        font-weight: 600;
        margin: 0;
      }
      .sub-status {
        font-size: 0.6875rem;
        color: var(--text-muted);
      }
      .sub-status.error-text {
        color: var(--color-loss);
      }
      .header-actions {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .alerts-scroll-area {
        display: flex;
        flex-direction: column;
        gap: 14px;
        max-height: none;
        overflow: visible;
      }

      /* Section Dividers & Headers */
      .alert-section {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .price-alerts-section {
        padding-top: 2px;
      }
      .order-alerts-section + .price-alerts-section {
        border-top: 1px solid var(--border-subtle);
        padding-top: 12px;
      }
      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 2px 2px;
      }
      .section-title-group {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .section-icon {
        font-size: 15px;
      }
      .order-section-icon {
        color: var(--dhan-cyan);
      }
      .price-section-icon {
        color: var(--text-secondary);
      }
      .section-title {
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-secondary);
      }
      .order-alerts-section .section-title {
        color: var(--text-primary);
      }
      .section-count-badge {
        font-size: 0.6875rem;
        font-weight: 700;
        padding: 1px 7px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.06);
        color: var(--text-secondary);
        border: 1px solid var(--border-subtle);
      }
      .section-count-badge.order-count {
        background: rgba(0, 210, 196, 0.12);
        color: var(--dhan-cyan);
        border-color: rgba(0, 210, 196, 0.3);
      }
      .section-items {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      /* Shared Alert Card Base */
      .alert-item {
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        padding: 6px 10px;
        transition: border-color 0.15s ease, background-color 0.15s ease;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .alert-item:hover {
        border-color: var(--border-medium);
      }
      .alert-item.order-alert-card {
        padding: 8px 10px;
        border-color: rgba(99, 102, 241, 0.28);
        background: linear-gradient(
          180deg,
          rgba(30, 41, 59, 0.55) 0%,
          rgba(21, 28, 44, 0.92) 100%
        );
      }
      .alert-item.order-alert-card:hover {
        border-color: rgba(0, 210, 196, 0.38);
      }
      .alert-item.triggered {
        border-left: 3px solid var(--color-profit);
        background: rgba(16, 185, 129, 0.04);
      }
      .alert-item.cancelled {
        opacity: 0.6;
        border-left: 3px solid var(--text-muted);
      }

      /* Main Row */
      .item-main {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .col-inst {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
      }
      .inst-line {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .inst-name {
        font-weight: 700;
        font-size: 0.875rem;
        color: var(--text-primary);
      }
      .status-chip {
        font-size: 0.625rem;
        font-weight: 700;
        padding: 1px 5px;
        border-radius: 4px;
        text-transform: uppercase;
      }
      .time-trigger {
        font-size: 0.6875rem;
        color: var(--color-profit);
      }
      .col-target {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .target-label {
        font-size: 0.6875rem;
        color: var(--text-muted);
        text-transform: uppercase;
        font-weight: 500;
      }
      .price-val {
        font-size: 0.875rem;
        font-weight: 700;
        color: var(--dhan-cyan);
      }
      .col-actions {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
      }
      .action-icon-btn {
        background: transparent;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        padding: 3px;
        border-radius: 4px;
        display: flex;
        align-items: center;
      }
      .action-icon-btn:hover {
        background: rgba(255, 255, 255, 0.08);
      }
      .action-icon-btn.json-btn:hover {
        color: var(--dhan-cyan, #00d2c4);
      }
      .action-icon-btn.delete:hover {
        color: var(--color-loss);
      }

      /* Structured Order Legs Table */
      .order-table-wrap {
        width: 100%;
        border: 1px solid rgba(255, 255, 255, 0.07);
        border-radius: 6px;
        background: rgba(11, 15, 25, 0.55);
        overflow: hidden;
      }
      .order-legs-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.78rem;
      }
      .order-legs-table thead tr {
        background: rgba(255, 255, 255, 0.03);
        border-bottom: 1px solid rgba(255, 255, 255, 0.07);
      }
      .order-legs-table th {
        padding: 5px 8px;
        font-size: 0.625rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-muted);
        text-align: left;
        white-space: nowrap;
      }
      .order-legs-table th.col-lots,
      .order-legs-table td.col-lots,
      .order-legs-table th.col-trigger,
      .order-legs-table td.col-trigger {
        text-align: right;
      }
      .order-legs-table td {
        padding: 6px 8px;
        vertical-align: middle;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }
      .order-legs-table tbody tr:last-child td {
        border-bottom: none;
      }
      .order-leg-row {
        transition: background-color 0.12s ease;
      }
      .order-leg-row:hover {
        background: rgba(255, 255, 255, 0.025);
      }
      .order-leg-row.leg-buy td:first-child {
        box-shadow: inset 2px 0 0 var(--color-buy);
      }
      .order-leg-row.leg-sell td:first-child {
        box-shadow: inset 2px 0 0 var(--color-sell);
      }
      .col-side {
        width: 62px;
        white-space: nowrap;
      }
      .ord-side-chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 42px;
        font-size: 0.625rem;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .contract-cell {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .ord-symbol {
        font-weight: 600;
        font-size: 0.78rem;
        color: var(--text-primary);
      }
      .ord-meta-pill {
        font-size: 0.625rem;
        font-weight: 600;
        padding: 1px 5px;
        border-radius: 3px;
        background: rgba(255, 255, 255, 0.06);
        color: var(--text-secondary);
      }
      .ord-meta-pill.order-id-pill {
        color: var(--dhan-cyan);
        background: rgba(0, 210, 196, 0.1);
      }
      .ord-status-badge {
        font-size: 0.625rem;
        font-weight: 700;
        padding: 1px 5px;
        border-radius: 3px;
        text-transform: uppercase;
      }
      .ord-status-badge.placed {
        background: rgba(16, 185, 129, 0.18);
        color: var(--color-profit);
      }
      .ord-status-badge.failed {
        background: rgba(244, 63, 94, 0.18);
        color: var(--color-loss);
      }
      .col-lots {
        white-space: nowrap;
        width: 68px;
      }
      .lots-primary {
        font-weight: 700;
        font-size: 0.8125rem;
        color: var(--text-primary);
      }
      .lots-unit {
        font-size: 0.65rem;
        color: var(--text-muted);
      }
      .col-trigger {
        white-space: nowrap;
        width: 112px;
      }
      .trigger-price-val {
        font-size: 0.8125rem;
        font-weight: 700;
      }
      .trigger-price-val.buy-price {
        color: var(--dhan-cyan);
      }
      .trigger-price-val.sell-price {
        color: #fb7185;
      }

      /* Tablet & Mobile Optimizations */
      @media (max-width: 768px) {
        .alert-list-card {
          padding: 10px;
        }
        .alerts-scroll-area {
          max-height: none;
          overflow-y: visible;
          padding-right: 0;
        }
        .alert-item {
          padding: 8px 10px;
        }
        .price-alert-card .item-main {
          flex-wrap: wrap;
          gap: 6px;
        }
        .price-alert-card .col-inst {
          width: 100%;
        }
        .price-alert-card .col-target {
          flex: 1;
        }
        .action-icon-btn {
          min-width: 36px;
          min-height: 36px;
          padding: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      }

      /* Responsive Card-Row Transform on Small Phones (Zero Horizontal Overflow) */
      @media (max-width: 520px) {
        .order-legs-table thead {
          display: none;
        }
        .order-legs-table,
        .order-legs-table tbody {
          display: block;
          width: 100%;
        }
        .order-legs-table tr.order-leg-row {
          display: grid;
          grid-template-columns: auto 1fr;
          grid-template-areas:
            'side contract'
            'lots trigger';
          gap: 6px 8px;
          padding: 8px 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
        }
        .order-legs-table tbody tr.order-leg-row:last-child {
          border-bottom: none;
        }
        .order-leg-row.leg-buy {
          box-shadow: inset 2px 0 0 var(--color-buy);
        }
        .order-leg-row.leg-sell {
          box-shadow: inset 2px 0 0 var(--color-sell);
        }
        .order-leg-row.leg-buy td:first-child,
        .order-leg-row.leg-sell td:first-child {
          box-shadow: none;
        }
        .order-legs-table td {
          display: flex;
          align-items: center;
          padding: 0;
          border-bottom: none;
          width: auto !important;
          min-width: 0;
        }
        .order-legs-table td.col-side {
          grid-area: side;
        }
        .order-legs-table td.col-contract {
          grid-area: contract;
        }
        .order-legs-table td.col-lots {
          grid-area: lots;
          justify-content: flex-start;
          text-align: left;
          gap: 4px;
        }
        .order-legs-table td.col-lots::before {
          content: attr(data-label) ':';
          font-size: 0.65rem;
          color: var(--text-muted);
          text-transform: uppercase;
          font-family: var(--font-sans);
        }
        .order-legs-table td.col-trigger {
          grid-area: trigger;
          justify-content: flex-end;
          text-align: right;
          gap: 5px;
        }
        .order-legs-table td.col-trigger::before {
          content: attr(data-label) ':';
          font-size: 0.65rem;
          color: var(--text-muted);
          text-transform: uppercase;
          font-family: var(--font-sans);
        }
        .ord-symbol {
          font-size: 0.75rem;
          word-break: break-word;
        }
      }
    `,
  ],
})
export class AlertListComponent {
  readonly alertService = inject(AlertService);
  private readonly instrumentService = inject(InstrumentService);
  private readonly dialog = inject(MatDialog);

  /**
   * Unified display alerts: hides child Stop Loss alerts whose parent exists
   * in the alerts array so that Buy order + Sell exit order are displayed
   * inside a single, unified trade order card.
   */
  readonly displayAlerts = computed(() => {
    const all = this.alertService.alerts();
    return all.filter((a) => {
      // If 'a' is identified as the child Stop Loss of another alert in 'all', hide it from main list
      const isChildOfAny = all.some((parent) => {
        if (parent === a) return false;
        const sl = this.getLinkedStopLoss(parent);
        return (
          sl !== null &&
          (areAlertIdsEqual(sl.alertId, a.id) || areAlertIdsEqual(sl.alertId, a.dhanAlertId))
        );
      });
      if (isChildOfAny) {
        return false;
      }

      // Also check explicit parentAlertId or stop loss flag
      const isSl = a.isStopLossAlert || (a.remarks && a.remarks.includes('[STOP LOSS]'));
      const parentId = a.parentAlertId;
      if (isSl && parentId) {
        const parentExists = all.some(
          (p) =>
            p !== a &&
            (matchesAlertId(parentId, p) ||
              areAlertIdsEqual(p.stopLossAlertId, a.id) ||
              areAlertIdsEqual(p.stopLossAlertId, a.dhanAlertId)),
        );
        if (parentExists) {
          return false; // Displayed inside the parent order card
        }
      }
      return true;
    });
  });

  /**
   * Priority Section 1: Alerts that have attached orders (rendered first / on top).
   */
  readonly alertsWithOrders = computed(() =>
    this.displayAlerts().filter((alert) => this.hasOrderSection(alert)),
  );

  /**
   * Section 2: Price-only alerts without attached orders.
   */
  readonly priceOnlyAlerts = computed(() =>
    this.displayAlerts().filter((alert) => !this.hasOrderSection(alert)),
  );

  readonly headerSummaryText = computed(() => {
    const withOrders = this.alertsWithOrders().length;
    const priceOnly = this.priceOnlyAlerts().length;
    if (withOrders > 0 && priceOnly > 0) {
      return `${withOrders} with ${withOrders === 1 ? 'order' : 'orders'} · ${priceOnly} price ${priceOnly === 1 ? 'alert' : 'alerts'}`;
    }
    if (withOrders > 0) {
      return `${withOrders} ${withOrders === 1 ? 'order alert' : 'order alerts'}`;
    }
    return `${priceOnly} ${priceOnly === 1 ? 'alert' : 'alerts'}`;
  });

  hasOrderSection(alert: DhanAlert): boolean {
    return this.getLinkedOrders(alert).length > 0 || this.getLinkedStopLoss(alert) !== null;
  }

  /**
   * Builds normalized table rows for all order legs (BUY/SELL entry + linked exit leg)
   * of an alert with orders.
   */
  getOrderLegRows(alert: DhanAlert): AlertOrderLegRow[] {
    const rows: AlertOrderLegRow[] = [];
    const linkedOrders = this.getLinkedOrders(alert);

    for (const ord of linkedOrders) {
      const side: 'BUY' | 'SELL' = this.isBuy(ord) ? 'BUY' : 'SELL';
      const contract = this.getDisplaySymbol(ord, alert);
      const { lots, lotSize } = this.resolveOrderLots(ord, alert, contract);

      rows.push({
        side,
        contract,
        lots,
        lotSize,
        quantity: ord.quantity || 0,
        triggerPrice: alert.targetPrice,
        orderType: ord.orderType,
        limitPrice: ord.price && ord.price > 0 ? ord.price : undefined,
        orderId: ord.orderId || null,
        statusLabel: this.getOrderStatus(ord, alert),
        isPlaced: this.isPlaced(ord),
        isFailed: this.isFailed(ord),
        isPending: this.isPending(ord),
      });
    }

    const sl = this.getLinkedStopLoss(alert);
    if (sl) {
      const slContract = sl.customSymbol || sl.symbol || alert.instrument;
      const firstOrd = linkedOrders[0];
      const { lots, lotSize } = this.resolveOrderLots(
        {
          symbol: slContract,
          quantity: sl.quantity ?? firstOrd?.quantity ?? 0,
          lots: sl.lots ?? firstOrd?.lots,
          lotSize: sl.lotSize ?? firstOrd?.lotSize,
          exchangeSegment: firstOrd?.exchangeSegment,
        },
        alert,
        slContract,
      );

      rows.push({
        side: sl.action,
        contract: slContract,
        lots,
        lotSize,
        quantity: sl.quantity ?? firstOrd?.quantity ?? 0,
        triggerPrice: sl.targetPrice,
        orderType: sl.orderType,
        orderId: sl.orderId || null,
        statusLabel: sl.isPlaced ? 'PLACED' : undefined,
        isPlaced: Boolean(sl.isPlaced),
        isFailed: false,
        isPending: !sl.isPlaced,
      });
    }

    return rows;
  }

  /**
   * Resolves lot count for an order strictly from backend order fields (`lots`, `lotSize`)
   * or live Firestore-backed `InstrumentService.lotSizes()` (never hardcoded fallbacks).
   */
  resolveOrderLots(
    ord: Partial<AlertAttachedOrder>,
    alert: DhanAlert,
    contractName?: string,
  ): { lots: number | null; lotSize: number | null } {
    const qty = Number(ord.quantity || 0);

    if (ord.lots && ord.lots > 0) {
      const derivedLotSize =
        ord.lotSize && ord.lotSize > 0
          ? ord.lotSize
          : qty > 0
          ? Math.round(qty / ord.lots)
          : null;
      return { lots: ord.lots, lotSize: derivedLotSize };
    }

    if (ord.lotSize && ord.lotSize > 1 && qty > 0) {
      const raw = qty / ord.lotSize;
      const lots = Number.isInteger(raw) ? raw : Math.round(raw * 100) / 100;
      return { lots, lotSize: ord.lotSize };
    }

    // Dynamic lookup from Firestore-loaded lotSizes config (only for F&O option contracts)
    const seg = (ord.exchangeSegment || '').toUpperCase();
    const lookupText = `${contractName || ord.customSymbol || ord.symbol || ''} ${alert.instrument || ''}`.toUpperCase();
    const isFnoOption = seg.includes('FNO') || /\b(CE|PE|CALL|PUT)\b/i.test(lookupText);

    if (isFnoOption && qty > 0) {
      const cfg = this.instrumentService.lotSizes();
      let dynamicLotSize = 0;

      if (cfg.indices && cfg.indices.length > 0) {
        const matched = cfg.indices.find((i) => lookupText.includes(i.symbol.toUpperCase()));
        if (matched) {
          dynamicLotSize = matched.defaultQuantityInOneLot ?? matched.lotSize ?? 0;
        }
      }
      if (!dynamicLotSize) {
        if (lookupText.includes('BANK') && cfg.bankNifty > 1) dynamicLotSize = cfg.bankNifty;
        else if ((lookupText.includes('MIDCP') || lookupText.includes('MIDCAP')) && cfg.midcapNifty > 1) {
          dynamicLotSize = cfg.midcapNifty;
        } else if (lookupText.includes('SENSEX') && cfg.sensex > 1) dynamicLotSize = cfg.sensex;
        else if (lookupText.includes('NIFTY') && cfg.nifty50 > 1) dynamicLotSize = cfg.nifty50;
      }

      if (dynamicLotSize > 1 && qty >= dynamicLotSize) {
        const raw = qty / dynamicLotSize;
        const lots = Number.isInteger(raw) ? raw : Math.round(raw * 100) / 100;
        return { lots, lotSize: dynamicLotSize };
      }
    }

    return { lots: null, lotSize: null };
  }

  /**
   * Resolves linked exit / Stop Loss details for a given parent alert, either from its
   * linked child alert in the alert list, or from its attached stopLoss config.
   */
  getLinkedStopLoss(alert: DhanAlert): LinkedStopLossDetails | null {
    // 0. A Stop Loss alert itself can never have an attached Stop Loss!
    if (alert.isStopLossAlert || (alert.remarks && alert.remarks.includes('[STOP LOSS]'))) {
      return null;
    }

    const all = this.alertService.alerts();

    // 1. Check explicit linked child alert already attached to alert object
    let child = alert.linkedStopLossAlert;

    // 2. Check if a child in 'all' explicitly points to this alert as its parent
    if (!child) {
      child = all.find((c) => {
        if (c === alert) return false;
        const isChildSl = c.isStopLossAlert || (c.remarks && c.remarks.includes('[STOP LOSS]'));
        if (!isChildSl) return false;

        // Check if child's parentAlertId matches this alert
        if (matchesAlertId(c.parentAlertId, alert)) {
          return true;
        }

        // Check if this alert's stopLossAlertId matches child
        if (alert.stopLossAlertId && matchesAlertId(alert.stopLossAlertId, c)) {
          return true;
        }

        // Check child's remarks for exact parent ID: "Exit for #<parentId>"
        const remarks = c.remarks || '';
        const m = remarks.match(/Exit (?:order )?for (?:parent )?(?:alert )?#([\w-]+)/i);
        if (m) {
          const parentRefId = m[1];
          if (matchesAlertId(parentRefId, alert)) {
            return true;
          }
        }

        return false;
      });
    }

    // 3. Fallback pairing by same contract option:
    // Only pair if child is NOT already claimed by another alert!
    if (!child) {
      const parentOrders = this.getLinkedOrders(alert);
      const parentOrder = parentOrders[0];
      if (parentOrder && this.isBuy(parentOrder)) {
        child = all.find((c) => {
          if (c === alert) return false;
          // Must not be claimed by another alert
          if (isClaimedByAnother(c, alert, all)) return false;
          return this.isSameContractOption(alert, c);
        });
      }
    }

    const parentOrders = this.getLinkedOrders(alert);
    const parentOrder = parentOrders[0];
    const childOrders = child ? this.getLinkedOrders(child) : [];
    const childOrder = childOrders[0];

    if (child) {
      let points = alert.stopLoss?.points;
      if (points === undefined && alert.targetPrice && child.targetPrice) {
        points = Math.round(Math.abs(alert.targetPrice - child.targetPrice) * 100) / 100;
      }
      const rawAction =
        childOrder?.action || childOrder?.transactionType || alert.stopLoss?.action || 'SELL';
      const action = rawAction.toUpperCase() as 'BUY' | 'SELL';
      const symbol = childOrder
        ? this.getDisplaySymbol(childOrder, child)
        : parentOrder
        ? this.getDisplaySymbol(parentOrder, alert)
        : undefined;
      const customSymbol = childOrder?.customSymbol || parentOrder?.customSymbol || symbol;
      const quantity = childOrder?.quantity || parentOrder?.quantity || 0;
      const lots = childOrder?.lots || parentOrder?.lots;
      const lotSize = childOrder?.lotSize || parentOrder?.lotSize;
      const orderType = childOrder?.orderType || 'MARKET';
      const orderId = childOrder?.orderId || null;

      return {
        alertId: child.dhanAlertId || child.id,
        targetPrice: child.targetPrice,
        points,
        operator: child.operator,
        status: child.status,
        action,
        symbol,
        customSymbol,
        quantity,
        lots,
        lotSize,
        orderType,
        orderId,
        isPlaced:
          child.status === 'TRIGGERED' ||
          childOrder?.status === 'PLACED' ||
          childOrder?.status === 'EXECUTED' ||
          childOrder?.status === 'TRADED',
      };
    }

    // 4. Fallback to locally configured stop loss ONLY if explicitly enabled on alert
    if (alert.stopLoss && alert.stopLoss.enabled) {
      const rawAction = alert.stopLoss.action || 'SELL';
      const action = rawAction.toUpperCase() as 'BUY' | 'SELL';
      const symbol = parentOrder ? this.getDisplaySymbol(parentOrder, alert) : undefined;
      const customSymbol = parentOrder?.customSymbol || symbol;
      const quantity = parentOrder?.quantity || 0;
      const lots = parentOrder?.lots;
      const lotSize = parentOrder?.lotSize;

      return {
        alertId: alert.stopLossAlertId || undefined,
        targetPrice: alert.stopLoss.targetPrice,
        points: alert.stopLoss.points,
        operator: alert.stopLoss.operator,
        status: alert.stopLossAlertPlaced ? 'ACTIVE' : 'ARMED',
        action,
        symbol,
        customSymbol,
        quantity,
        lots,
        lotSize,
        orderType: 'MARKET',
        isPlaced: Boolean(alert.stopLossAlertPlaced && alert.status === 'TRIGGERED'),
      };
    }

    return null;
  }

  hasLinkedOrder(alert: DhanAlert): boolean {
    return this.getLinkedOrders(alert).length > 0;
  }

  /**
   * Checks whether two alerts are buying and selling the same instrument / contract option.
   */
  isSameContractOption(alertA: DhanAlert, alertB: DhanAlert): boolean {
    const ordersA = this.getLinkedOrders(alertA);
    const ordersB = this.getLinkedOrders(alertB);
    if (ordersA.length === 0 || ordersB.length === 0) return false;

    const ordA = ordersA[0];
    const ordB = ordersB[0];

    // Must be opposite actions (one BUY and one SELL)
    const isBuyA = this.isBuy(ordA);
    const isBuyB = this.isBuy(ordB);
    if (isBuyA === isBuyB) return false;

    // Check underlying instrument compatibility (e.g. NIFTY 50 vs BANKNIFTY)
    const instA = (alertA.instrument || '').trim().toUpperCase();
    const instB = (alertB.instrument || '').trim().toUpperCase();
    if (instA && instB && instA !== instB && !instA.includes(instB) && !instB.includes(instA)) {
      return false;
    }

    // 1. Check option security ID match
    const secIdA = (ordA.securityId || '').trim();
    const secIdB = (ordB.securityId || '').trim();
    if (secIdA && secIdB && secIdA !== '0' && secIdA === secIdB && secIdA !== alertA.securityId) {
      return true;
    }

    // 2. Check normalized symbol match
    const cleanSym = (s?: string) => (s || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const symA = cleanSym(ordA.customSymbol || ordA.tradingSymbol || ordA.symbol);
    const symB = cleanSym(ordB.customSymbol || ordB.tradingSymbol || ordB.symbol);
    if (symA && symB && !symA.startsWith('SEC') && !symB.startsWith('SEC') && symA === symB) {
      return true;
    }

    // 3. Check strike price and option type match
    const optA = this.getOptionDetails(ordA);
    const optB = this.getOptionDetails(ordB);
    if (optA.strike && optB.strike && optA.strike === optB.strike) {
      const typeA = (optA.type || '').toUpperCase();
      const typeB = (optB.type || '').toUpperCase();
      const isCallA = typeA.includes('CALL') || typeA.includes('CE');
      const isCallB = typeB.includes('CALL') || typeB.includes('CE');
      const isPutA = typeA.includes('PUT') || typeA.includes('PE');
      const isPutB = typeB.includes('PUT') || typeB.includes('PE');
      if ((isCallA && isCallB) || (isPutA && isPutB)) {
        return true;
      }
    }

    return false;
  }

  getLinkedOrders(alert: DhanAlert): AlertAttachedOrder[] {
    if (alert.orders && alert.orders.length > 0) {
      return alert.orders;
    }
    if (alert.conditionalOrders && alert.conditionalOrders.length > 0) {
      return alert.conditionalOrders;
    }
    if (
      alert.attachedOrder &&
      (alert.attachedOrder.symbol || alert.attachedOrder.enabled || alert.attachedOrder.securityId)
    ) {
      return [alert.attachedOrder];
    }
    return [];
  }

  isBuy(ord: AlertAttachedOrder): boolean {
    const action = ord.action || ord.transactionType || 'BUY';
    return action.toUpperCase() === 'BUY';
  }

  isPlaced(ord: AlertAttachedOrder): boolean {
    const s = (ord.status || '').toUpperCase();
    return s === 'PLACED' || s === 'EXECUTED' || s === 'TRADED';
  }

  isPending(ord: AlertAttachedOrder): boolean {
    const s = (ord.status || '').toUpperCase();
    return s === 'PENDING' || s === 'ARMED' || !ord.status;
  }

  isFailed(ord: AlertAttachedOrder): boolean {
    const s = (ord.status || '').toUpperCase();
    return s === 'FAILED' || s === 'REJECTED' || s === 'CANCELLED';
  }

  getOrderStatus(ord: AlertAttachedOrder, alert: DhanAlert): string {
    if (ord.status) return ord.status.toUpperCase();
    if (alert.status === 'TRIGGERED') return 'TRIGGERED';
    if (alert.status === 'CANCELLED') return 'CANCELLED';
    return 'ARMED';
  }

  getDisplaySymbol(ord: AlertAttachedOrder, alert: DhanAlert): string {
    if (ord.customSymbol && !ord.customSymbol.startsWith('SEC-')) return ord.customSymbol;
    if (ord.symbol && !ord.symbol.startsWith('SEC-')) return ord.symbol;
    if (ord.tradingSymbol && !ord.tradingSymbol.startsWith('SEC-')) return ord.tradingSymbol;
    if (ord.instrumentName && !ord.instrumentName.startsWith('SEC-')) {
      if (
        ord.strikePrice &&
        ord.optionType &&
        !ord.instrumentName.includes(String(ord.strikePrice))
      ) {
        return `${ord.instrumentName} ${ord.strikePrice} ${ord.optionType}`;
      }
      return ord.instrumentName;
    }
    if (ord.strikePrice && ord.optionType) {
      return `${alert.instrument || 'OPTION'} ${ord.strikePrice} ${ord.optionType}`;
    }
    if (alert.instrument) {
      return `${alert.instrument} Option Contract`;
    }
    return ord.symbol || 'Option Contract';
  }

  getOptionDetails(ord: AlertAttachedOrder): { strike?: number; type?: string } {
    if (ord.strikePrice) {
      const optType = (ord.optionType || '').toUpperCase();
      return {
        strike: ord.strikePrice,
        type: optType === 'CE' ? 'CALL (CE)' : optType === 'PE' ? 'PUT (PE)' : optType,
      };
    }
    // NEVER parse security ID like "SEC-40040" as a strike price!
    const candidates = [ord.customSymbol, ord.instrumentName, ord.symbol, ord.tradingSymbol];
    for (const s of candidates) {
      if (!s || s.startsWith('SEC-')) continue;
      const match =
        s.match(/(\d{4,6})-(CE|PE)/i) ||
        s.match(/(\d{4,6})\s*(CE|PE|CALL|PUT)$/i) ||
        s.match(/(\d{4,6})\s*([A-Za-z]+)?$/);
      if (match) {
        const strike = parseInt(match[1], 10);
        const rawType = (match[2] || '').toUpperCase();
        const type =
          rawType.includes('CE') || rawType.includes('CALL')
            ? 'CALL (CE)'
            : rawType.includes('PE') || rawType.includes('PUT')
            ? 'PUT (PE)'
            : rawType;
        return { strike, type };
      }
    }
    return {};
  }

  formatExpiry(exp: string | null): string {
    if (!exp) return '--';
    const parts = exp.split('-');
    if (parts.length === 3) {
      const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      const mIdx = parseInt(parts[1], 10) - 1;
      const mon = months[mIdx] || parts[1];
      return `${parts[2]} ${mon} ${parts[0]}`;
    }
    return exp;
  }

  /**
   * Instantly deletes the alert (and its linked Stop Loss alert if present)
   * without any confirmation dialog popup.
   */
  deleteAlert(alert: DhanAlert): void {
    const sl = this.getLinkedStopLoss(alert);
    this.alertService.deleteAlert(alert.id).subscribe();
    if (sl && sl.alertId && sl.alertId !== alert.id) {
      this.alertService.deleteAlert(sl.alertId).subscribe();
    }
  }

  /**
   * Alias for backward compatibility. Directly calls deleteAlert without dialog.
   */
  confirmDelete(alert: DhanAlert): void {
    this.deleteAlert(alert);
  }

  confirmCancel(alert: DhanAlert): void {
    this.alertService.cancelAlert(alert.id).subscribe();
  }

  /**
   * Opens dialog displaying the exact raw JSON received from Dhan HQ API for this alert.
   */
  openJsonDialog(alert: DhanAlert): void {
    const linkedOrders = this.getLinkedOrders(alert);
    const firstOrd = linkedOrders[0];
    const sl = this.getLinkedStopLoss(alert);
    const rawDhan = alert.rawDhanJson || alert.rawAlertJson || {
      alertId: alert.dhanAlertId || alert.id,
      alertStatus: alert.status,
      createdTime: alert.createdAt,
      condition: {
        securityId: alert.securityId,
        exchangeSegment: alert.exchangeSegment,
        comparingValue: alert.targetPrice,
        operator: alert.operator,
        userNote: alert.remarks,
        expDate: alert.expDate,
      },
      orders: linkedOrders,
    };

    let slRawDhan = alert.linkedStopLossAlert?.rawDhanJson || alert.linkedStopLossAlert?.rawAlertJson;
    if (!slRawDhan && sl?.alertId) {
      const matchingSlAlert = this.alertService.alerts().find((a) => matchesAlertId(sl.alertId, a));
      slRawDhan = matchingSlAlert?.rawDhanJson || matchingSlAlert?.rawAlertJson;
    }

    const previewData: AlertPreviewData = {
      title: `Dhan HQ Alert #${alert.dhanAlertId || alert.id}`,
      subtitle: `Received JSON data directly from Dhan HQ API (/v2/alerts/orders)`,
      mode: 'view',
      initialTabIndex: 1,
      instrument: alert.instrument,
      securityId: alert.securityId,
      exchangeSegment: alert.exchangeSegment,
      currentLtp: alert.currentPrice ?? null,
      targetPrice: alert.targetPrice,
      operator: alert.operator,
      remarks: alert.remarks,
      status: alert.status,
      alertId: alert.dhanAlertId || alert.id,
      expiry: alert.expDate,
      hasOrder: linkedOrders.length > 0,
      order: firstOrd
        ? {
            action: (firstOrd.action || firstOrd.transactionType || 'BUY') as 'BUY' | 'SELL',
            symbol: this.getDisplaySymbol(firstOrd, alert),
            securityId: firstOrd.securityId || alert.securityId,
            exchangeSegment: firstOrd.exchangeSegment || alert.exchangeSegment,
            productType: firstOrd.productType || 'INTRADAY',
            orderType: firstOrd.orderType || 'MARKET',
            quantity: firstOrd.quantity,
            price: firstOrd.price || 0,
            status: this.getOrderStatus(firstOrd, alert),
            orderId: firstOrd.orderId,
            strike: firstOrd.strikePrice,
            optionType: firstOrd.optionType,
          }
        : undefined,
      stopLoss: sl
        ? {
            enabled: true,
            points: sl.points || 0,
            targetPrice: sl.targetPrice,
            operator: sl.operator || 'LESS_THAN_OR_EQUAL',
            action: sl.action,
            status: sl.status,
            orderId: sl.orderId,
            alertId: sl.alertId,
          }
        : undefined,
      endpoint: {
        method: 'GET',
        url: 'https://api.dhan.co/v2/alerts/orders',
      },
      dhanPayload: rawDhan,
      slDhanPayload: slRawDhan || (sl ? {
        alertId: sl.alertId,
        targetPrice: sl.targetPrice,
        points: sl.points,
        action: sl.action,
        symbol: sl.customSymbol || sl.symbol,
        quantity: sl.quantity,
        status: sl.status || (sl.isPlaced ? 'PLACED' : 'PENDING'),
        orderId: sl.orderId,
      } : undefined),
      rawJsonTitle: `Received Alert JSON: #${alert.dhanAlertId || alert.id}`,
      slRawJsonTitle: sl?.alertId
        ? `Received Stop Loss Alert JSON: #${sl.alertId}`
        : `Linked Stop Loss Order Payload`,
    };

    this.dialog.open(AlertPreviewDialogComponent, {
      data: previewData,
      width: '680px',
      maxWidth: '94vw',
      panelClass: 'alert-preview-dialog-panel',
    });
  }
}

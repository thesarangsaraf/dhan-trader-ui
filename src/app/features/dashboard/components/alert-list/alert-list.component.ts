import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { AlertService } from '../../../../core/api/alert.service';
import { AlertAttachedOrder, DhanAlert } from '../../../../core/models/alert.models';
import { ConfirmationDialogComponent } from '../../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { SectionErrorComponent } from '../../../../shared/components/section-error/section-error.component';
import { CurrencyInrPipe } from '../../../../shared/pipes/currency-inr.pipe';
import { IstDatePipe } from '../../../../shared/pipes/ist-date.pipe';

export interface LinkedStopLossDetails {
  alertId?: string;
  targetPrice: number;
  points?: number;
  operator?: string;
  status?: string;
  action: 'BUY' | 'SELL';
  symbol?: string;
  quantity?: number;
  orderType?: string;
  orderId?: string | null;
  isPlaced?: boolean;
}

@Component({
  selector: 'app-alert-list',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
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
              {{ displayAlerts().length }} {{ displayAlerts().length === 1 ? 'order' : 'orders' }} &bull; Polling every 1.5s
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

        <div
          *ngFor="let alert of displayAlerts()"
          class="alert-item"
          [class.triggered]="alert.status === 'TRIGGERED'"
          [class.cancelled]="alert.status === 'CANCELLED'"
          [class.has-stop-loss]="getLinkedStopLoss(alert) !== null"
          [class.is-sl-alert]="alert.isStopLossAlert || (alert.remarks && alert.remarks.includes('[STOP LOSS]'))"
        >
          <div class="item-main">
            <div class="col-inst">
              <div class="inst-line">
                <span class="inst-name">{{ alert.instrument }}</span>
                <span
                  class="status-chip"
                  [class.active]="alert.status === 'ACTIVE'"
                  [class.triggered]="alert.status === 'TRIGGERED'"
                  [class.cancelled]="alert.status === 'CANCELLED'"
                >
                  {{ alert.status }}
                </span>
                <span
                  class="order-attached-badge"
                  *ngIf="hasLinkedOrder(alert) && !alert.isStopLossAlert && !(alert.remarks && alert.remarks.includes('[STOP LOSS]'))"
                  matTooltip="Conditional order linked to trigger"
                >
                  ⚡ Entry Order
                </span>
                <span
                  class="sl-guard-badge"
                  *ngIf="getLinkedStopLoss(alert) as sl"
                  [matTooltip]="'Attached Stop Loss Order: ₹' + sl.targetPrice + (sl.points ? ' (' + sl.points + ' pts)' : '')"
                >
                  🛡️ With Stop Loss ({{ sl.points ? sl.points + ' pts' : '₹' + sl.targetPrice }})
                </span>
                <span
                  class="sl-alert-badge"
                  *ngIf="alert.isStopLossAlert || (alert.remarks && alert.remarks.includes('[STOP LOSS]'))"
                  matTooltip="Automated Stop Loss Order"
                >
                  🛡️ STOP LOSS
                </span>
              </div>

              <!-- User Remarks (skip internal tags) -->
              <span class="remarks-text" *ngIf="alert.remarks && !alert.remarks.startsWith('[STOP LOSS]')">{{ alert.remarks }}</span>

              <!-- Standalone Stop Loss Reference if parent not found -->
              <div class="sl-parent-ref mono-val" *ngIf="alert.parentAlertId && (alert.isStopLossAlert || (alert.remarks && alert.remarks.includes('[STOP LOSS]')))">
                <span>Exit order for parent alert #{{ alert.parentAlertId }}</span>
              </div>

              <div class="time-line mono-val">
                <span>Created: {{ alert.createdAt | istDate : 'timeOnly' }}</span>
                <span *ngIf="alert.triggeredAt"> &bull; Triggered: {{ alert.triggeredAt | istDate : 'timeOnly' }}</span>
              </div>
            </div>

            <div class="col-target">
              <span class="target-label">Target</span>
              <div class="price-val mono-val">
                {{ alert.targetPrice | currencyInr : false }}
              </div>
            </div>

            <!-- Actions: delete alert -->
            <div class="col-actions">
              <button
                class="action-icon-btn delete"
                (click)="confirmDelete(alert)"
                matTooltip="Delete Order & Stop Loss"
              >
                <span class="material-symbols-rounded">delete</span>
              </button>
            </div>
          </div>

          <!-- Primary Entry Linked Order Section -->
          <div class="linked-orders-section" *ngIf="getLinkedOrders(alert) as linkedOrders">
            <div *ngIf="linkedOrders.length > 0" class="linked-orders-list">
              <div *ngFor="let ord of linkedOrders" class="linked-order-card entry-order-card">
                <!-- Top Row: BUY/SELL + Option Instrument Symbol + Status -->
                <div class="ord-top-row">
                  <div class="ord-side-symbol">
                    <span
                      class="ord-side-chip"
                      [class.buy]="isBuy(ord)"
                      [class.sell]="!isBuy(ord)"
                    >
                      {{ (ord.action || ord.transactionType || 'BUY').toUpperCase() }}
                    </span>
                    <span class="ord-symbol mono-val">{{ getDisplaySymbol(ord, alert) }}</span>
                  </div>

                  <div class="ord-status-wrap">
                    <span
                      class="ord-status-badge"
                      [class.placed]="isPlaced(ord)"
                      [class.pending]="isPending(ord)"
                      [class.failed]="isFailed(ord)"
                    >
                      {{ getOrderStatus(ord, alert) }}
                    </span>
                  </div>
                </div>

                <!-- Instrument & Expiry Highlight Row -->
                <div class="ord-highlight-row">
                  <span class="highlight-badge instrument-badge mono-val" *ngIf="getOptionDetails(ord).strike">
                    🎯 Strike: {{ getOptionDetails(ord).strike }} {{ getOptionDetails(ord).type }}
                  </span>
                  <span class="highlight-badge expiry-badge mono-val" *ngIf="getExpiryDate(ord, alert)">
                    📅 Expiry: {{ formatExpiry(getExpiryDate(ord, alert)) }}
                  </span>
                </div>

                <!-- Specs row: Qty, Order Type, Limit Price, Order ID -->
                <div class="ord-details-row">
                  <span class="ord-spec">
                    <span class="spec-label">Qty:</span>
                    <span class="spec-val mono-val">{{ ord.quantity }}</span>
                  </span>
                  <span class="spec-dot">&bull;</span>
                  <span class="ord-spec">
                    <span class="spec-label">Type:</span>
                    <span class="spec-val mono-val">{{ ord.orderType || 'MARKET' }}</span>
                  </span>
                  <ng-container *ngIf="ord.price && ord.price > 0">
                    <span class="spec-dot">&bull;</span>
                    <span class="ord-spec">
                      <span class="spec-label">Limit:</span>
                      <span class="spec-val mono-val">{{ ord.price | currencyInr : false }}</span>
                    </span>
                  </ng-container>
                  <ng-container *ngIf="ord.orderId">
                    <span class="spec-dot">&bull;</span>
                    <span class="ord-spec order-id-spec" matTooltip="Dhan Order ID">
                      <span class="spec-label">Order ID:</span>
                      <span class="spec-val mono-val">#{{ ord.orderId }}</span>
                    </span>
                  </ng-container>
                </div>
              </div>
            </div>
          </div>

          <!-- Unified Embedded Stop Loss Section (Inside Same Card) -->
          <div class="embedded-stop-loss-section" *ngIf="getLinkedStopLoss(alert) as sl">
            <div class="sl-embedded-header">
              <div class="sl-embedded-title-wrap">
                <span class="material-symbols-rounded sl-shield-icon">shield</span>
                <span class="sl-embedded-title">Attached Stop Loss Order (Exit Protection)</span>
                <span class="sl-pill-distance mono-val" *ngIf="sl.points">
                  {{ sl.action === 'SELL' ? '-' : '+' }}{{ sl.points }} pts
                </span>
              </div>
              <div class="sl-embedded-meta mono-val">
                <span class="sl-alert-id" *ngIf="sl.alertId" matTooltip="Dhan SL Alert ID">
                  SL Alert #{{ sl.alertId }}
                </span>
                <span class="sl-status-badge" [class.placed]="sl.isPlaced">
                  {{ sl.status || 'ARMED' }}
                </span>
              </div>
            </div>

            <div class="sl-order-card">
              <div class="sl-trigger-row">
                <div class="sl-trigger-info">
                  <span class="sl-spec-label">Trigger Price:</span>
                  <span class="sl-trigger-price mono-val">₹{{ sl.targetPrice | currencyInr : false }}</span>
                  <span class="sl-trigger-tag" *ngIf="sl.operator">
                    {{ formatOperator(sl.operator) }}
                  </span>
                </div>
                <div class="sl-action-badge-wrap">
                  <span class="ord-side-chip sell">
                    {{ sl.action }}
                  </span>
                </div>
              </div>

              <div class="sl-contract-row" *ngIf="sl.symbol">
                <span class="sl-contract-label">Square Off:</span>
                <span class="sl-contract-symbol mono-val">{{ sl.symbol }}</span>
                <span class="sl-spec-dot">&bull;</span>
                <span class="sl-spec-qty mono-val">Qty: {{ sl.quantity }}</span>
                <span class="sl-spec-dot">&bull;</span>
                <span class="sl-spec-type mono-val">{{ sl.orderType || 'MARKET' }}</span>
                <ng-container *ngIf="sl.orderId">
                  <span class="sl-spec-dot">&bull;</span>
                  <span class="sl-order-id mono-val">#{{ sl.orderId }}</span>
                </ng-container>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .alert-list-card {
        padding: 16px;
        display: flex;
        flex-direction: column;
        height: 100%;
      }
      .list-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      .header-left {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .alert-icon {
        font-size: 24px;
        color: var(--dhan-cyan);
      }
      .card-title {
        font-size: 1rem;
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
        flex: 1;
        overflow-y: auto;
        padding-right: 4px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-height: 520px;
      }
      .empty-state {
        text-align: center;
        padding: 32px 16px;
        color: var(--text-muted);
      }
      .empty-icon {
        font-size: 36px;
        margin-bottom: 6px;
        opacity: 0.6;
      }
      .alert-item {
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 10px;
        padding: 12px 14px;
        transition: all 0.15s ease;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .alert-item:hover {
        border-color: var(--border-medium);
      }
      .alert-item.has-stop-loss {
        border-color: rgba(99, 102, 241, 0.35);
      }
      .alert-item.triggered {
        border-left: 3px solid var(--color-profit);
        background: rgba(16, 185, 129, 0.04);
      }
      .alert-item.cancelled {
        opacity: 0.6;
        border-left: 3px solid var(--text-muted);
      }
      .item-main {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .col-inst {
        display: flex;
        flex-direction: column;
        gap: 3px;
        flex: 1;
      }
      .inst-line {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .inst-name {
        font-weight: 700;
        font-size: 0.9375rem;
        color: var(--text-primary);
      }
      .status-chip {
        font-size: 0.625rem;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        text-transform: uppercase;
      }
      .status-chip.active {
        color: var(--color-pending);
        background: var(--color-pending-bg);
      }
      .status-chip.triggered {
        color: var(--color-profit);
        background: var(--color-profit-bg);
      }
      .status-chip.cancelled {
        color: var(--text-muted);
        background: rgba(255, 255, 255, 0.06);
      }
      .order-attached-badge {
        font-size: 0.625rem;
        font-weight: 600;
        color: #a5b4fc;
        background: rgba(99, 102, 241, 0.15);
        padding: 2px 6px;
        border-radius: 4px;
      }
      .sl-guard-badge {
        font-size: 0.625rem;
        font-weight: 700;
        color: #fca5a5;
        background: rgba(244, 63, 94, 0.15);
        padding: 2px 6px;
        border-radius: 4px;
        border: 1px solid rgba(244, 63, 94, 0.3);
      }
      .sl-alert-badge {
        font-size: 0.625rem;
        font-weight: 700;
        color: #ffffff;
        background: #f43f5e;
        padding: 2px 6px;
        border-radius: 4px;
        letter-spacing: 0.5px;
      }
      .sl-parent-ref {
        font-size: 0.6875rem;
        color: #fca5a5;
        margin-top: 2px;
      }
      .alert-item.is-sl-alert {
        border-left: 3px solid #f43f5e;
      }
      .remarks-text {
        font-size: 0.75rem;
        color: var(--text-secondary);
      }
      .time-line {
        font-size: 0.6875rem;
        color: var(--text-muted);
      }
      .col-target {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;
      }
      .target-label {
        font-size: 0.6875rem;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        font-weight: 500;
      }
      .price-val {
        font-size: 1rem;
        font-weight: 700;
        color: var(--dhan-cyan);
      }
      .col-actions {
        display: flex;
        gap: 4px;
      }
      .action-icon-btn {
        background: transparent;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        display: flex;
        align-items: center;
      }
      .action-icon-btn:hover {
        background: rgba(255, 255, 255, 0.08);
      }
      .action-icon-btn.delete:hover {
        color: var(--color-loss);
      }

      /* Linked Primary Order Details */
      .linked-orders-section {
        border-top: 1px dashed var(--border-subtle);
        padding-top: 8px;
      }
      .linked-orders-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .linked-order-card {
        background: rgba(99, 102, 241, 0.05);
        border: 1px solid rgba(99, 102, 241, 0.2);
        border-radius: 6px;
        padding: 8px 10px;
      }
      .ord-top-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      .ord-side-symbol {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .ord-side-chip {
        font-size: 0.6875rem;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        text-transform: uppercase;
      }
      .ord-side-chip.buy {
        color: var(--color-profit);
        background: var(--color-profit-bg);
      }
      .ord-side-chip.sell {
        color: var(--color-loss);
        background: var(--color-loss-bg);
      }
      .ord-symbol {
        font-weight: 700;
        font-size: 0.875rem;
        color: var(--text-primary);
      }
      .ord-status-wrap {
        display: flex;
        align-items: center;
      }
      .ord-status-badge {
        font-size: 0.625rem;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        text-transform: uppercase;
      }
      .ord-status-badge.placed {
        color: var(--color-profit);
        background: var(--color-profit-bg);
      }
      .ord-status-badge.pending {
        color: var(--color-pending);
        background: var(--color-pending-bg);
      }
      .ord-status-badge.failed {
        color: var(--color-loss);
        background: var(--color-loss-bg);
      }

      /* Highlight Row for Option Instrument & Expiry */
      .ord-highlight-row {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 6px;
        flex-wrap: wrap;
      }
      .highlight-badge {
        font-size: 0.6875rem;
        padding: 2px 7px;
        border-radius: 4px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .highlight-badge.instrument-badge {
        background: rgba(0, 210, 196, 0.12);
        color: var(--dhan-cyan);
        border: 1px solid rgba(0, 210, 196, 0.25);
      }
      .highlight-badge.expiry-badge {
        background: rgba(99, 102, 241, 0.12);
        color: #a5b4fc;
        border: 1px solid rgba(99, 102, 241, 0.25);
      }

      .ord-details-row {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.6875rem;
        color: var(--text-secondary);
        margin-top: 6px;
        flex-wrap: wrap;
      }
      .ord-spec {
        display: inline-flex;
        align-items: center;
        gap: 2px;
      }
      .spec-label {
        color: var(--text-muted);
      }
      .spec-val {
        color: var(--text-primary);
        font-weight: 600;
      }
      .spec-dot {
        color: var(--text-muted);
        font-size: 0.625rem;
      }
      .order-id-spec .spec-val {
        color: var(--dhan-cyan);
      }

      /* Unified Embedded Stop Loss Section */
      .embedded-stop-loss-section {
        margin-top: 4px;
        background: rgba(244, 63, 94, 0.05);
        border: 1px dashed rgba(244, 63, 94, 0.3);
        border-radius: 8px;
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .sl-embedded-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .sl-embedded-title-wrap {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .sl-shield-icon {
        font-size: 16px;
        color: #f43f5e;
      }
      .sl-embedded-title {
        font-size: 0.75rem;
        font-weight: 700;
        color: #fda4af;
        letter-spacing: 0.2px;
      }
      .sl-pill-distance {
        font-size: 0.625rem;
        font-weight: 700;
        padding: 1px 6px;
        border-radius: 4px;
        background: rgba(244, 63, 94, 0.2);
        color: #fca5a5;
        border: 1px solid rgba(244, 63, 94, 0.35);
      }
      .sl-embedded-meta {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.625rem;
      }
      .sl-alert-id {
        color: var(--text-muted);
      }
      .sl-status-badge {
        font-size: 0.625rem;
        font-weight: 700;
        padding: 1px 5px;
        border-radius: 3px;
        background: rgba(244, 63, 94, 0.2);
        color: #fca5a5;
        text-transform: uppercase;
      }
      .sl-status-badge.placed {
        background: rgba(16, 185, 129, 0.2);
        color: #10b981;
      }
      .sl-order-card {
        background: rgba(0, 0, 0, 0.2);
        border: 1px solid rgba(244, 63, 94, 0.15);
        border-radius: 6px;
        padding: 6px 8px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .sl-trigger-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }
      .sl-trigger-info {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .sl-spec-label {
        font-size: 0.6875rem;
        color: var(--text-muted);
      }
      .sl-trigger-price {
        font-size: 0.875rem;
        font-weight: 700;
        color: #f43f5e;
      }
      .sl-trigger-tag {
        font-size: 0.625rem;
        padding: 1px 5px;
        border-radius: 3px;
        background: rgba(244, 63, 94, 0.15);
        color: #fca5a5;
      }
      .sl-contract-row {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.6875rem;
        color: var(--text-secondary);
        flex-wrap: wrap;
      }
      .sl-contract-label {
        color: var(--text-muted);
      }
      .sl-contract-symbol {
        font-weight: 700;
        color: var(--text-primary);
      }
      .sl-spec-dot {
        color: var(--text-muted);
        font-size: 0.625rem;
      }
      .sl-spec-qty,
      .sl-spec-type {
        color: var(--text-secondary);
      }
      .sl-order-id {
        color: var(--dhan-cyan);
      }
    `,
  ],
})
export class AlertListComponent {
  readonly alertService = inject(AlertService);
  private readonly dialog = inject(MatDialog);

  /**
   * Unified display alerts: hides child Stop Loss alerts whose parent exists
   * in the alerts array so that Buy order + Stop Loss order are displayed
   * as a single, unified trade card.
   */
  readonly displayAlerts = computed(() => {
    const all = this.alertService.alerts();
    return all.filter((a) => {
      const isSl = a.isStopLossAlert || (a.remarks && a.remarks.includes('[STOP LOSS]'));
      const parentId = a.parentAlertId;
      if (isSl && parentId) {
        const parentExists = all.some(
          (p) =>
            p !== a &&
            (p.id === parentId ||
              (p.dhanAlertId && p.dhanAlertId === parentId) ||
              (p.dhanAlertId && parentId.includes(p.dhanAlertId)) ||
              (p.id && parentId.includes(p.id)) ||
              (p.stopLossAlertId &&
                (p.stopLossAlertId === a.id ||
                  (a.dhanAlertId && p.stopLossAlertId === a.dhanAlertId)))),
        );
        if (parentExists) {
          return false; // Displayed inside the parent order card
        }
      }
      return true;
    });
  });

  /**
   * Resolves Stop Loss details for a given parent alert, either from its
   * linked child alert in the alert list, or from its attached stopLoss config.
   */
  getLinkedStopLoss(alert: DhanAlert): LinkedStopLossDetails | null {
    const linked = alert.linkedStopLossAlert;
    const all = this.alertService.alerts();
    const child =
      linked ||
      all.find(
        (c) =>
          c !== alert &&
          (c.isStopLossAlert || (c.remarks && c.remarks.includes('[STOP LOSS]'))) &&
          (c.parentAlertId === alert.id ||
            (alert.dhanAlertId && c.parentAlertId === alert.dhanAlertId) ||
            (alert.dhanAlertId && c.parentAlertId && c.parentAlertId.includes(alert.dhanAlertId)) ||
            (alert.id && c.parentAlertId && c.parentAlertId.includes(alert.id)) ||
            (alert.stopLossAlertId &&
              (c.id === alert.stopLossAlertId ||
                (c.dhanAlertId && c.dhanAlertId === alert.stopLossAlertId)))),
      );

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
      const quantity = childOrder?.quantity || parentOrder?.quantity || 0;
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
        quantity,
        orderType,
        orderId,
        isPlaced: true,
      };
    }

    if (alert.stopLoss && alert.stopLoss.enabled) {
      const rawAction = alert.stopLoss.action || 'SELL';
      const action = rawAction.toUpperCase() as 'BUY' | 'SELL';
      const symbol = parentOrder ? this.getDisplaySymbol(parentOrder, alert) : undefined;
      const quantity = parentOrder?.quantity || 0;

      return {
        alertId: alert.stopLossAlertId || undefined,
        targetPrice: alert.stopLoss.targetPrice,
        points: alert.stopLoss.points,
        operator: alert.stopLoss.operator,
        status: alert.stopLossAlertPlaced ? 'ACTIVE' : 'ARMED',
        action,
        symbol,
        quantity,
        orderType: 'MARKET',
        isPlaced: Boolean(alert.stopLossAlertPlaced),
      };
    }

    return null;
  }

  hasLinkedOrder(alert: DhanAlert): boolean {
    return this.getLinkedOrders(alert).length > 0;
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

  getExpiryDate(ord: AlertAttachedOrder, alert: DhanAlert): string | null {
    if (ord.expiryDate) return ord.expiryDate;
    if (ord.expDate) return ord.expDate;
    if (alert.expDate) return alert.expDate;

    const candidates = [ord.customSymbol, ord.instrumentName, ord.symbol, ord.tradingSymbol];
    for (const s of candidates) {
      if (!s || s.startsWith('SEC-')) continue;
      const m = s.match(/\b(\d{1,2}\s+[A-Za-z]{3}(?:\s+\d{2,4})?)\b/i);
      if (m) return m[1];

      const m2 = s.match(/-([A-Za-z]{3}\d{4})-/i);
      if (m2) return m2[1];
    }

    return null;
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

  formatOperator(op: string): string {
    switch (op) {
      case 'GREATER_THAN_EQUAL':
      case 'GREATER_THAN_OR_EQUAL':
        return '≥ Breakout';
      case 'GREATER_THAN':
        return '> Breakout';
      case 'LESS_THAN_EQUAL':
      case 'LESS_THAN_OR_EQUAL':
        return '≤ Breakdown';
      case 'LESS_THAN':
        return '< Breakdown';
      case 'CROSSING_ANY_SIDE':
        return '⇋ Any Side';
      case 'CROSSING_UP':
        return '↑ Cross Up';
      case 'CROSSING_DOWN':
        return '↓ Cross Down';
      default:
        return op;
    }
  }

  confirmCancel(alert: DhanAlert): void {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Cancel Alert',
        message: `Are you sure you want to cancel the price alert for ${alert.instrument} at ₹${alert.targetPrice}?`,
        confirmText: 'Cancel Alert',
        isDestructive: true,
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.alertService.cancelAlert(alert.id).subscribe();
      }
    });
  }

  confirmDelete(alert: DhanAlert): void {
    const sl = this.getLinkedStopLoss(alert);
    const slNote = sl ? ' and its attached Stop Loss order' : '';
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Delete Alert Permanently',
        message: `Delete order alert ${alert.id} (${alert.instrument} @ ₹${alert.targetPrice})${slNote}? This cannot be undone.`,
        confirmText: 'Delete',
        isDestructive: true,
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.alertService.deleteAlert(alert.id).subscribe();
      }
    });
  }
}

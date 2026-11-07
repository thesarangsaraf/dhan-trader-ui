import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AlertService } from '../../../../core/api/alert.service';
import { AlertAttachedOrder, DhanAlert } from '../../../../core/models/alert.models';
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
          <!-- Main Row: Instrument, Target Price, Delete Action -->
          <div class="item-main">
            <div class="col-inst">
              <div class="inst-line">
                <span class="inst-name">{{ alert.instrument }}</span>

                <!-- Status chip: Omit 'ACTIVE' because all alerts are active by default -->
                <span
                  class="status-chip"
                  *ngIf="alert.status !== 'ACTIVE'"
                  [class.triggered]="alert.status === 'TRIGGERED'"
                  [class.cancelled]="alert.status === 'CANCELLED'"
                >
                  {{ alert.status }}
                </span>

                <!-- Guard badge if attached Stop Loss exists -->
                <span
                  class="sl-guard-badge"
                  *ngIf="getLinkedStopLoss(alert) as sl"
                  [matTooltip]="'Stop Loss Order: ₹' + sl.targetPrice + (sl.points ? ' (' + sl.points + ' pts)' : '')"
                >
                  🛡️ With Stop Loss ({{ sl.points ? sl.points + ' pts' : '₹' + sl.targetPrice }})
                </span>

                <!-- Standalone Stop Loss Badge if orphan SL alert -->
                <span
                  class="sl-alert-badge"
                  *ngIf="(alert.isStopLossAlert || (alert.remarks && alert.remarks.includes('[STOP LOSS]'))) && !getLinkedStopLoss(alert)"
                  matTooltip="Automated Stop Loss Order"
                >
                  🛡️ STOP LOSS
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

            <!-- Instant 1-Click Delete Action without confirmation popup -->
            <div class="col-actions">
              <button
                class="action-icon-btn delete"
                (click)="deleteAlert(alert)"
                matTooltip="Delete Order & Stop Loss"
              >
                <span class="material-symbols-rounded">delete</span>
              </button>
            </div>
          </div>

          <!-- Primary Entry Linked Order Section (Compact 1-liner) -->
          <div class="linked-orders-section" *ngIf="getLinkedOrders(alert) as linkedOrders">
            <div *ngIf="linkedOrders.length > 0" class="linked-orders-list">
              <div *ngFor="let ord of linkedOrders" class="linked-order-card entry-order-card">
                <div class="ord-compact-row">
                  <div class="ord-left-group">
                    <span
                      class="ord-side-chip"
                      [class.buy]="isBuy(ord)"
                      [class.sell]="!isBuy(ord)"
                    >
                      {{ (ord.action || ord.transactionType || 'BUY').toUpperCase() }}
                    </span>
                    <span class="ord-symbol mono-val">{{ getDisplaySymbol(ord, alert) }}</span>
                    <span class="spec-dot">&bull;</span>
                    <span class="ord-spec">
                      <span class="spec-label">Qty:</span>
                      <span class="spec-val mono-val">{{ ord.quantity }}</span>
                    </span>
                    <span class="spec-dot" *ngIf="ord.orderType && ord.orderType !== 'MARKET'">&bull;</span>
                    <span class="ord-spec" *ngIf="ord.orderType && ord.orderType !== 'MARKET'">
                      <span class="spec-val mono-val">{{ ord.orderType }}</span>
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
                        <span class="spec-val mono-val">#{{ ord.orderId }}</span>
                      </span>
                    </ng-container>
                  </div>

                  <!-- Status badge: ONLY shown if placed/executed/failed, NEVER 'PENDING' or 'ARMED' -->
                  <div class="ord-status-wrap" *ngIf="!isPending(ord)">
                    <span
                      class="ord-status-badge"
                      [class.placed]="isPlaced(ord)"
                      [class.failed]="isFailed(ord)"
                    >
                      {{ getOrderStatus(ord, alert) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Unified Embedded Stop Loss Section (Inside Same Card, Compact) -->
          <div class="embedded-stop-loss-section" *ngIf="getLinkedStopLoss(alert) as sl">
            <div class="sl-embedded-header">
              <div class="sl-embedded-title-wrap">
                <span class="material-symbols-rounded sl-shield-icon">shield</span>
                <span class="sl-embedded-title">Stop Loss</span>
                <span class="sl-pill-distance mono-val" *ngIf="sl.points">
                  {{ sl.action === 'SELL' ? '-' : '+' }}{{ sl.points }} pts
                </span>
                <span class="sl-spec-dot">&bull;</span>
                <span class="sl-spec-label">Trigger:</span>
                <span class="sl-trigger-price mono-val">₹{{ sl.targetPrice | currencyInr : false }}</span>
              </div>
              <div class="sl-embedded-meta mono-val">
                <!-- Status badge: ONLY if placed, never 'ARMED' or 'PENDING' -->
                <span class="sl-status-badge placed" *ngIf="sl.isPlaced">
                  PLACED
                </span>
              </div>
            </div>

            <div class="sl-order-card" *ngIf="sl.symbol">
              <div class="sl-contract-row">
                <span class="ord-side-chip sell">{{ sl.action }}</span>
                <span class="sl-contract-label">Square Off:</span>
                <span class="sl-contract-symbol mono-val">{{ sl.symbol }}</span>
                <span class="sl-spec-dot">&bull;</span>
                <span class="sl-spec-qty mono-val">Qty: {{ sl.quantity }}</span>
                <span class="sl-spec-dot" *ngIf="sl.orderType && sl.orderType !== 'MARKET'">&bull;</span>
                <span class="sl-spec-type mono-val" *ngIf="sl.orderType && sl.orderType !== 'MARKET'">{{ sl.orderType }}</span>
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
        margin-bottom: 8px;
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
        gap: 6px;
        max-height: 620px;
        overflow-y: auto;
        padding-right: 4px;
        -webkit-overflow-scrolling: touch;
      }
      .alerts-scroll-area::-webkit-scrollbar {
        width: 6px;
      }
      .alerts-scroll-area::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.2);
      }
      .alerts-scroll-area::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 4px;
      }
      .alerts-scroll-area::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.35);
      }
      .empty-state {
        text-align: center;
        padding: 24px 16px;
        color: var(--text-muted);
      }
      .empty-icon {
        font-size: 32px;
        margin-bottom: 4px;
        opacity: 0.6;
      }
      .alert-item {
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        padding: 6px 10px;
        transition: all 0.15s ease;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .alert-item:hover {
        border-color: var(--border-medium);
      }
      .alert-item.has-stop-loss {
        border-color: rgba(99, 102, 241, 0.3);
      }
      .alert-item.triggered {
        border-left: 3px solid var(--color-profit);
        background: rgba(16, 185, 129, 0.04);
      }
      .alert-item.cancelled {
        opacity: 0.6;
        border-left: 3px solid var(--text-muted);
      }
      .alert-item.is-sl-alert {
        border-left: 3px solid #f43f5e;
      }
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
      .status-chip.triggered {
        color: var(--color-profit);
        background: var(--color-profit-bg);
      }
      .status-chip.cancelled {
        color: var(--text-muted);
        background: rgba(255, 255, 255, 0.06);
      }
      .sl-guard-badge {
        font-size: 0.625rem;
        font-weight: 700;
        color: #fca5a5;
        background: rgba(244, 63, 94, 0.15);
        padding: 1px 5px;
        border-radius: 4px;
        border: 1px solid rgba(244, 63, 94, 0.3);
      }
      .sl-alert-badge {
        font-size: 0.625rem;
        font-weight: 700;
        color: #ffffff;
        background: #f43f5e;
        padding: 1px 5px;
        border-radius: 4px;
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
      .action-icon-btn.delete:hover {
        color: var(--color-loss);
      }

      /* Primary Order Compact */
      .linked-orders-section {
        border-top: 1px dashed rgba(255, 255, 255, 0.08);
        padding-top: 4px;
      }
      .linked-orders-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .linked-order-card {
        background: rgba(99, 102, 241, 0.04);
        border: 1px solid rgba(99, 102, 241, 0.15);
        border-radius: 5px;
        padding: 4px 8px;
      }
      .ord-compact-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .ord-left-group {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        font-size: 0.75rem;
      }
      .ord-side-chip {
        font-size: 0.625rem;
        font-weight: 700;
        padding: 1px 5px;
        border-radius: 3px;
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
        font-weight: 600;
        font-size: 0.8125rem;
        color: var(--text-primary);
      }
      .ord-spec {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        color: var(--text-secondary);
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
      .ord-status-wrap {
        display: flex;
        align-items: center;
      }
      .ord-status-badge {
        font-size: 0.625rem;
        font-weight: 700;
        padding: 1px 5px;
        border-radius: 3px;
        text-transform: uppercase;
      }
      .ord-status-badge.placed {
        color: var(--color-profit);
        background: var(--color-profit-bg);
      }
      .ord-status-badge.failed {
        color: var(--color-loss);
        background: var(--color-loss-bg);
      }

      /* Compact Stop Loss Section */
      .embedded-stop-loss-section {
        background: rgba(244, 63, 94, 0.04);
        border: 1px dashed rgba(244, 63, 94, 0.25);
        border-radius: 6px;
        padding: 4px 8px;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .sl-embedded-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .sl-embedded-title-wrap {
        display: flex;
        align-items: center;
        gap: 5px;
        flex-wrap: wrap;
      }
      .sl-shield-icon {
        font-size: 14px;
        color: #f43f5e;
      }
      .sl-embedded-title {
        font-size: 0.6875rem;
        font-weight: 600;
        color: #fda4af;
      }
      .sl-pill-distance {
        font-size: 0.625rem;
        font-weight: 700;
        padding: 1px 5px;
        border-radius: 3px;
        background: rgba(244, 63, 94, 0.18);
        color: #fca5a5;
        border: 1px solid rgba(244, 63, 94, 0.3);
      }
      .sl-spec-label {
        font-size: 0.6875rem;
        color: var(--text-muted);
      }
      .sl-trigger-price {
        font-size: 0.8125rem;
        font-weight: 700;
        color: #f43f5e;
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
        padding: 1px 4px;
        border-radius: 3px;
        text-transform: uppercase;
      }
      .sl-status-badge.placed {
        background: rgba(16, 185, 129, 0.2);
        color: #10b981;
      }
      .sl-order-card {
        background: rgba(0, 0, 0, 0.15);
        border: 1px solid rgba(244, 63, 94, 0.12);
        border-radius: 4px;
        padding: 3px 6px;
      }
      .sl-contract-row {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 0.6875rem;
        color: var(--text-secondary);
        flex-wrap: wrap;
      }
      .sl-contract-label {
        color: var(--text-muted);
      }
      .sl-contract-symbol {
        font-weight: 600;
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

  /**
   * Unified display alerts: hides child Stop Loss alerts whose parent exists
   * in the alerts array so that Buy order + Stop Loss order are displayed
   * as a single, unified trade card.
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
   * Resolves Stop Loss details for a given parent alert, either from its
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
        isPlaced:
          child.status === 'TRIGGERED' ||
          childOrder?.status === 'PLACED' ||
          childOrder?.status === 'EXECUTED' ||
          childOrder?.status === 'TRADED',
      };
    }

    // 3. Fallback to locally configured stop loss ONLY if explicitly enabled on alert
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
}

import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { AlertService } from '../../../../core/api/alert.service';
import { DhanAlert } from '../../../../core/models/alert.models';
import { ConfirmationDialogComponent } from '../../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { SectionErrorComponent } from '../../../../shared/components/section-error/section-error.component';
import { CurrencyInrPipe } from '../../../../shared/pipes/currency-inr.pipe';
import { IstDatePipe } from '../../../../shared/pipes/ist-date.pipe';

@Component({
  selector: 'app-alert-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatExpansionModule,
    MatProgressBarModule,
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
              Polling every 1.5s &bull; Active: {{ alertService.activeAlerts().length }} &bull; Triggered: {{ alertService.triggeredAlerts().length }}
            </span>
            <span class="sub-status error-text" *ngIf="alertService.alertsError()">
              Server Unreachable
            </span>
          </div>
        </div>

        <div class="header-actions">
          <button
            class="view-mode-btn"
            [class.active]="viewMode() === 'flat'"
            (click)="viewMode.set('flat')"
            matTooltip="Flat list view"
          >
            <span class="material-symbols-rounded">view_list</span>
          </button>
          <button
            class="view-mode-btn"
            [class.active]="viewMode() === 'grouped'"
            (click)="viewMode.set('grouped')"
            matTooltip="Grouped by Index accordion view"
          >
            <span class="material-symbols-rounded">folder_open</span>
          </button>

          <button mat-icon-button (click)="alertService.refreshAlerts()" matTooltip="Manual Refresh">
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

      <!-- Filter Tabs -->
      <div class="filter-tabs" *ngIf="!alertService.alertsError()">
        <button
          class="tab-btn"
          [class.active]="filterStatus() === 'ALL'"
          (click)="filterStatus.set('ALL')"
        >
          All ({{ alertService.alerts().length }})
        </button>
        <button
          class="tab-btn"
          [class.active]="filterStatus() === 'ACTIVE'"
          (click)="filterStatus.set('ACTIVE')"
        >
          Active ({{ alertService.activeAlerts().length }})
        </button>
        <button
          class="tab-btn"
          [class.active]="filterStatus() === 'TRIGGERED'"
          (click)="filterStatus.set('TRIGGERED')"
        >
          Triggered ({{ alertService.triggeredAlerts().length }})
        </button>
        <button
          class="tab-btn"
          [class.active]="filterStatus() === 'CANCELLED'"
          (click)="filterStatus.set('CANCELLED')"
        >
          Cancelled ({{ alertService.cancelledAlerts().length }})
        </button>
      </div>

      <!-- FLAT LIST VIEW -->
      <div class="alerts-scroll-area" *ngIf="!alertService.alertsError() && viewMode() === 'flat'">
        <div *ngIf="filteredAlerts().length === 0" class="empty-state">
          <span class="material-symbols-rounded empty-icon">notifications_none</span>
          <p>No alerts in {{ filterStatus() }} state from backend.</p>
        </div>

        <div *ngFor="let alert of filteredAlerts()" class="alert-item" [class.triggered]="alert.status === 'TRIGGERED'" [class.cancelled]="alert.status === 'CANCELLED'">
          <div class="item-main">
            <div class="col-inst">
              <div class="inst-line">
                <span class="inst-name">{{ alert.instrument }}</span>
                <span class="status-chip" [class.active]="alert.status === 'ACTIVE'" [class.triggered]="alert.status === 'TRIGGERED'" [class.cancelled]="alert.status === 'CANCELLED'">
                  {{ alert.status }}
                </span>
                <span class="order-attached-badge" *ngIf="alert.attachedOrder?.enabled" matTooltip="Conditional order armed: {{ alert.attachedOrder?.action }} {{ alert.attachedOrder?.symbol }}">
                  ⚡ Auto-Order Armed
                </span>
              </div>
              <span class="remarks-text">{{ alert.remarks || 'No remarks' }}</span>
              <span class="timestamp mono-val">Created: {{ alert.createdAt | istDate : 'timeOnly' }}</span>
            </div>

            <div class="col-target">
              <div class="operator-badge">
                {{ formatOperator(alert.operator) }}
              </div>
              <div class="price-val mono-val">
                {{ alert.targetPrice | currencyInr : false }}
              </div>
            </div>

            <!-- Distance Indicator -->
            <div class="col-distance" *ngIf="alert.status === 'ACTIVE' && alert.currentPrice">
              <div class="distance-text mono-val">
                <span [class.text-profit]="isGettingCloser(alert)" [class.text-loss]="!isGettingCloser(alert)">
                  {{ getDistancePts(alert) > 0 ? '+' : '' }}{{ getDistancePts(alert) | number : '1.1-2' }} pts
                </span>
                <span class="pct">({{ getDistancePct(alert) | number : '1.2-2' }}%)</span>
              </div>
              <div class="distance-sub">LTP: {{ alert.currentPrice | currencyInr : false }}</div>
            </div>

            <!-- Actions -->
            <div class="col-actions">
              <button
                *ngIf="alert.status === 'ACTIVE'"
                class="action-icon-btn cancel"
                (click)="confirmCancel(alert)"
                matTooltip="Cancel Alert"
              >
                <span class="material-symbols-rounded">block</span>
              </button>
              <button
                class="action-icon-btn delete"
                (click)="confirmDelete(alert)"
                matTooltip="Delete Alert"
              >
                <span class="material-symbols-rounded">delete</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- GROUPED ACCORDION VIEW -->
      <div class="alerts-scroll-area" *ngIf="!alertService.alertsError() && viewMode() === 'grouped'">
        <div *ngIf="alertService.groupedAlerts().length === 0" class="empty-state">
          No grouped alerts from backend.
        </div>

        <mat-accordion multi class="grouped-accordion">
          <mat-expansion-panel *ngFor="let group of alertService.groupedAlerts()" [expanded]="group.activeCount > 0">
            <mat-expansion-panel-header>
              <mat-panel-title class="group-title">
                <span class="symbol">{{ group.instrument }}</span>
                <span class="ltp mono-val" *ngIf="group.currentPrice">LTP: {{ group.currentPrice | currencyInr : false }}</span>
              </mat-panel-title>
              <mat-panel-description class="group-counts">
                <span class="badge active-badge" *ngIf="group.activeCount > 0">{{ group.activeCount }} Active</span>
                <span class="badge triggered-badge" *ngIf="group.triggeredCount > 0">{{ group.triggeredCount }} Triggered</span>
              </mat-panel-description>
            </mat-expansion-panel-header>

            <div class="grouped-alerts-list">
              <div *ngFor="let alert of group.alerts" class="alert-item compact" [class.triggered]="alert.status === 'TRIGGERED'">
                <div class="item-main">
                  <div class="col-inst">
                    <span class="status-chip compact" [class.active]="alert.status === 'ACTIVE'" [class.triggered]="alert.status === 'TRIGGERED'">{{ alert.status }}</span>
                    <span class="operator-badge">{{ formatOperator(alert.operator) }}</span>
                    <span class="price-val mono-val">{{ alert.targetPrice | currencyInr : false }}</span>
                  </div>

                  <div class="col-actions">
                    <button
                      *ngIf="alert.status === 'ACTIVE'"
                      class="action-icon-btn cancel"
                      (click)="confirmCancel(alert)"
                      matTooltip="Cancel"
                    >
                      <span class="material-symbols-rounded">block</span>
                    </button>
                    <button
                      class="action-icon-btn delete"
                      (click)="confirmDelete(alert)"
                      matTooltip="Delete"
                    >
                      <span class="material-symbols-rounded">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </mat-expansion-panel>
        </mat-accordion>
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
      .view-mode-btn {
        background: transparent;
        border: 1px solid var(--border-subtle);
        border-radius: 6px;
        padding: 4px 6px;
        color: var(--text-secondary);
        cursor: pointer;
        display: flex;
        align-items: center;
      }
      .view-mode-btn.active {
        background: var(--dhan-cyan);
        color: #0B0F19;
        border-color: var(--dhan-cyan);
      }
      .filter-tabs {
        display: flex;
        gap: 6px;
        margin-bottom: 12px;
        border-bottom: 1px solid var(--border-subtle);
        padding-bottom: 8px;
      }
      .tab-btn {
        background: transparent;
        border: none;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--text-secondary);
        cursor: pointer;
      }
      .tab-btn.active {
        background: var(--bg-surface);
        color: var(--dhan-cyan);
      }
      .alerts-scroll-area {
        flex: 1;
        overflow-y: auto;
        padding-right: 4px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 480px;
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
        padding: 10px 14px;
        transition: all 0.15s ease;
      }
      .alert-item:hover {
        border-color: var(--border-medium);
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
        color: #A5B4FC;
        background: rgba(99, 102, 241, 0.15);
        padding: 2px 6px;
        border-radius: 4px;
      }
      .remarks-text {
        font-size: 0.75rem;
        color: var(--text-secondary);
      }
      .timestamp {
        font-size: 0.6875rem;
        color: var(--text-muted);
      }
      .col-target {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;
      }
      .operator-badge {
        font-size: 0.6875rem;
        font-weight: 600;
        color: var(--text-secondary);
        background: rgba(255, 255, 255, 0.06);
        padding: 2px 6px;
        border-radius: 4px;
      }
      .price-val {
        font-size: 1rem;
        font-weight: 700;
        color: var(--dhan-cyan);
      }
      .col-distance {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;
      }
      .distance-text {
        font-size: 0.8125rem;
        font-weight: 600;
      }
      .distance-sub {
        font-size: 0.6875rem;
        color: var(--text-muted);
      }
      .text-profit {
        color: var(--color-profit);
      }
      .text-loss {
        color: var(--color-loss);
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
      .action-icon-btn.cancel:hover {
        color: var(--color-loss);
      }
      .action-icon-btn.delete:hover {
        color: var(--color-loss);
      }
      .group-title {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .group-title .symbol {
        font-weight: 600;
        font-size: 0.875rem;
      }
      .group-title .ltp {
        font-size: 0.8125rem;
        color: var(--dhan-cyan);
      }
      .group-counts {
        display: flex;
        justify-content: flex-end;
        gap: 6px;
      }
      .active-badge {
        color: var(--color-pending);
        background: var(--color-pending-bg);
        font-size: 0.6875rem;
        padding: 2px 6px;
        border-radius: 4px;
      }
      .triggered-badge {
        color: var(--color-profit);
        background: var(--color-profit-bg);
        font-size: 0.6875rem;
        padding: 2px 6px;
        border-radius: 4px;
      }
    `,
  ],
})
export class AlertListComponent {
  readonly alertService = inject(AlertService);
  private readonly dialog = inject(MatDialog);

  readonly viewMode = signal<'flat' | 'grouped'>('flat');
  readonly filterStatus = signal<'ALL' | 'ACTIVE' | 'TRIGGERED' | 'CANCELLED'>('ALL');

  filteredAlerts(): DhanAlert[] {
    const list = this.alertService.alerts();
    const filter = this.filterStatus();
    if (filter === 'ALL') return list;
    return list.filter((a) => a.status === filter);
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

  getDistancePts(alert: DhanAlert): number {
    if (!alert.currentPrice) return 0;
    return alert.targetPrice - alert.currentPrice;
  }

  getDistancePct(alert: DhanAlert): number {
    if (!alert.currentPrice) return 0;
    const diff = alert.targetPrice - alert.currentPrice;
    return (diff / alert.currentPrice) * 100;
  }

  isGettingCloser(alert: DhanAlert): boolean {
    const diff = Math.abs(this.getDistancePts(alert));
    return diff < 50;
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
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Delete Alert Permanently',
        message: `Delete alert ${alert.id} (${alert.instrument} @ ₹${alert.targetPrice})? This cannot be undone.`,
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

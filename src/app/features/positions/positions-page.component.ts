import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { OrderService } from '../../core/api/order.service';
import { AuthService } from '../../core/api/auth.service';
import { PositionsSummaryComponent } from '../dashboard/components/positions-summary/positions-summary.component';
import { OrderBookComponent } from '../dashboard/components/order-book/order-book.component';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';

@Component({
  selector: 'app-positions-page',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    PositionsSummaryComponent,
    OrderBookComponent,
    CurrencyInrPipe,
  ],
  template: `
    <div class="positions-page-root">
      <div class="positions-page-container">
        <!-- Page Header -->
        <header class="page-header">
          <div class="header-left">
            <div class="header-icon-box">
              <span class="material-symbols-rounded">account_balance_wallet</span>
            </div>
            <div>
              <h1 class="page-title">Positions & Order Book</h1>
              <p class="page-subtitle">Real-time open & closed positions, intraday P&L metrics, and live Dhan orders</p>
            </div>
          </div>

          <div class="header-actions">
            <!-- Available Margin Quick Badge -->
            <div class="margin-pill mono-val" *ngIf="orderService.funds() as funds">
              <span class="margin-label">Margin:</span>
              <span class="margin-val">{{ funds.availableBalance | currencyInr : false }}</span>
            </div>

            <!-- Manual Refresh Button -->
            <button
              mat-stroked-button
              class="refresh-btn"
              (click)="refreshAll()"
              [disabled]="orderService.isLoadingPositions() || orderService.isLoadingOrders()"
              matTooltip="Refresh Positions and Orders Book from Dhan"
            >
              <span
                class="material-symbols-rounded"
                [class.spinning]="orderService.isLoadingPositions() || orderService.isLoadingOrders()"
              >
                refresh
              </span>
              <span>Refresh</span>
            </button>
          </div>
        </header>

        <!-- Main Content Card with Tabs -->
        <div class="content-card">
          <mat-tab-group class="portfolio-tab-group" animationDuration="150ms">
            <!-- Tab 1: Positions -->
            <mat-tab>
              <ng-template mat-tab-label>
                <span class="material-symbols-rounded tab-icon">pie_chart</span>
                <span>Positions</span>
                <span class="tab-badge" *ngIf="orderService.summary()?.openPositionsCount">
                  {{ orderService.summary()?.openPositionsCount }}
                </span>
              </ng-template>
              <div class="tab-pane">
                <app-positions-summary></app-positions-summary>
              </div>
            </mat-tab>

            <!-- Tab 2: Order Book -->
            <mat-tab>
              <ng-template mat-tab-label>
                <span class="material-symbols-rounded tab-icon">receipt_long</span>
                <span>Order Book</span>
                <span class="tab-badge pending" *ngIf="orderService.openOrders().length > 0">
                  {{ orderService.openOrders().length }}
                </span>
              </ng-template>
              <div class="tab-pane">
                <app-order-book></app-order-book>
              </div>
            </mat-tab>
          </mat-tab-group>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .positions-page-root {
        min-height: 100%;
        width: 100%;
        padding: 16px 20px 24px;
        background: var(--bg-body);
        display: flex;
        flex-direction: column;
        align-items: center;
        box-sizing: border-box;
      }

      .positions-page-container {
        width: 100%;
        max-width: 1200px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .page-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        border-radius: 12px;
        padding: 14px 18px;
        gap: 12px;
      }

      .header-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .header-icon-box {
        width: 44px;
        height: 44px;
        border-radius: 10px;
        background: rgba(0, 210, 196, 0.12);
        color: var(--dhan-cyan);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .header-icon-box span {
        font-size: 26px;
      }

      .page-title {
        margin: 0;
        font-size: 1.125rem;
        font-weight: 700;
        color: var(--text-primary);
        letter-spacing: -0.01em;
      }

      .page-subtitle {
        margin: 2px 0 0;
        font-size: 0.75rem;
        color: var(--text-muted);
      }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .margin-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 8px;
        background: var(--bg-surface);
        border: 1px solid var(--border-medium);
        font-size: 0.8125rem;
      }

      .margin-label {
        font-size: 0.6875rem;
        color: var(--text-muted);
        text-transform: uppercase;
        font-weight: 600;
      }

      .margin-val {
        font-weight: 700;
        color: var(--dhan-cyan);
      }

      .refresh-btn {
        min-height: 38px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border-radius: 8px;
        border-color: var(--border-medium);
        color: var(--text-secondary);
        font-size: 0.8125rem;
        font-weight: 600;
      }

      .refresh-btn:hover {
        border-color: var(--dhan-cyan);
        color: var(--dhan-cyan);
      }

      .spinning {
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        100% {
          transform: rotate(360deg);
        }
      }

      .content-card {
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        border-radius: 12px;
        padding: 14px 18px;
        min-height: 500px;
      }

      .tab-icon {
        font-size: 18px;
        margin-right: 6px;
      }

      .tab-badge {
        font-size: 0.625rem;
        background: var(--dhan-cyan);
        color: #0b0f19;
        font-weight: 800;
        padding: 1px 6px;
        border-radius: 999px;
        margin-left: 6px;
      }

      .tab-badge.pending {
        background: var(--color-pending);
      }

      .tab-pane {
        padding: 16px 4px 8px;
      }

      @media (max-width: 768px) {
        .positions-page-root {
          padding: 8px 8px 32px;
        }

        .page-header {
          flex-direction: column;
          align-items: flex-start;
          padding: 12px;
          gap: 10px;
        }

        .header-actions {
          width: 100%;
          justify-content: space-between;
        }

        .content-card {
          padding: 10px 12px;
        }
      }
    `,
  ],
})
export class PositionsPageComponent {
  readonly orderService = inject(OrderService);
  readonly authService = inject(AuthService);

  refreshAll(): void {
    this.orderService.refreshPositions();
    this.orderService.refreshOrders();
    this.orderService.refreshFunds();
  }
}

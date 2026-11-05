import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { OrderService } from '../../../../core/api/order.service';
import { DhanOrder } from '../../../../core/models/order.models';
import { ConfirmationDialogComponent } from '../../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { SectionErrorComponent } from '../../../../shared/components/section-error/section-error.component';
import { CurrencyInrPipe } from '../../../../shared/pipes/currency-inr.pipe';
import { IstDatePipe } from '../../../../shared/pipes/ist-date.pipe';

@Component({
  selector: 'app-order-book',
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
    <div class="order-book-container">
      <div class="orders-header">
        <span class="sub-label">
          Orders: {{ orderService.orders().length }} Total ({{ orderService.openOrders().length }} Open)
        </span>
        <button mat-icon-button (click)="orderService.refreshOrders()" matTooltip="Refresh Orders Book">
          <span class="material-symbols-rounded">refresh</span>
        </button>
      </div>

      <!-- Section Error State -->
      <app-section-error
        *ngIf="orderService.ordersError() as err"
        title="Failed to Load Order Book"
        [message]="err"
        (retry)="orderService.refreshOrders()"
      ></app-section-error>

      <!-- Orders List from Real Backend -->
      <div class="orders-scroll-area" *ngIf="!orderService.ordersError()">
        <div *ngIf="orderService.orders().length === 0" class="empty-state">
          <span class="material-symbols-rounded empty-icon">receipt_long</span>
          <p>No orders found in Dhan order book.</p>
        </div>

        <div *ngFor="let order of orderService.orders()" class="order-card" [class.complete]="order.status === 'COMPLETE'" [class.pending]="order.status === 'PENDING'" [class.rejected]="order.status === 'REJECTED'">
          <div class="order-top">
            <div class="symbol-col">
              <div class="main-line">
                <span class="action-tag" [class.buy]="order.transactionType === 'BUY'" [class.sell]="order.transactionType === 'SELL'">
                  {{ order.transactionType }}
                </span>
                <span class="symbol-name">{{ order.symbol }}</span>
              </div>
              <span class="order-id mono-val">ID: {{ order.orderId }} &bull; {{ order.productType }} / {{ order.orderType }}</span>
            </div>

            <div class="status-col">
              <span class="status-badge" [class.complete]="order.status === 'COMPLETE'" [class.pending]="order.status === 'PENDING'" [class.rejected]="order.status === 'REJECTED'" [class.cancelled]="order.status === 'CANCELLED'">
                {{ order.status }}
              </span>
              <button
                *ngIf="order.status === 'PENDING' || order.status === 'TRANSIT'"
                class="cancel-btn"
                (click)="confirmCancel(order)"
                matTooltip="Cancel Open Order"
              >
                <span class="material-symbols-rounded">cancel</span>
              </button>
            </div>
          </div>

          <div class="order-bottom mono-val">
            <span class="qty">{{ order.quantity }} Qty</span>
            <span class="price">&#64; {{ order.price > 0 ? (order.price | currencyInr : false) : 'MKT' }}</span>
            <span class="time">{{ order.createTime | istDate : 'timeOnly' }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .order-book-container {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .orders-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
      }
      .sub-label {
        font-size: 0.75rem;
        color: var(--text-muted);
        font-weight: 600;
        text-transform: uppercase;
      }
      .orders-scroll-area {
        max-height: 400px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .empty-state {
        text-align: center;
        padding: 28px;
        color: var(--text-muted);
        font-size: 0.8125rem;
      }
      .empty-icon {
        font-size: 32px;
        opacity: 0.5;
        margin-bottom: 6px;
      }
      .order-card {
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        padding: 8px 12px;
        transition: border-color 0.15s ease;
      }
      .order-card:hover {
        border-color: var(--border-medium);
      }
      .order-card.complete {
        border-left: 3px solid var(--color-profit);
      }
      .order-card.pending {
        border-left: 3px solid var(--color-pending);
      }
      .order-card.rejected {
        border-left: 3px solid var(--color-loss);
      }
      .order-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 6px;
      }
      .main-line {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .action-tag {
        font-size: 0.6875rem;
        font-weight: 700;
        padding: 1px 6px;
        border-radius: 3px;
      }
      .action-tag.buy {
        color: var(--color-buy);
        background: var(--color-buy-bg);
      }
      .action-tag.sell {
        color: var(--color-sell);
        background: var(--color-sell-bg);
      }
      .symbol-name {
        font-weight: 700;
        font-size: 0.875rem;
      }
      .order-id {
        font-size: 0.6875rem;
        color: var(--text-muted);
        display: block;
        margin-top: 2px;
      }
      .status-col {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .status-badge {
        font-size: 0.625rem;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        text-transform: uppercase;
      }
      .status-badge.complete {
        color: var(--color-profit);
        background: var(--color-profit-bg);
      }
      .status-badge.pending {
        color: var(--color-pending);
        background: var(--color-pending-bg);
      }
      .status-badge.rejected {
        color: var(--color-loss);
        background: var(--color-loss-bg);
      }
      .status-badge.cancelled {
        color: var(--text-muted);
        background: rgba(255, 255, 255, 0.08);
      }
      .cancel-btn {
        background: transparent;
        border: none;
        color: var(--color-loss);
        cursor: pointer;
        padding: 2px;
        display: flex;
        align-items: center;
      }
      .cancel-btn span {
        font-size: 18px;
      }
      .order-bottom {
        display: flex;
        justify-content: space-between;
        font-size: 0.75rem;
        color: var(--text-secondary);
        border-top: 1px dashed var(--border-subtle);
        padding-top: 4px;
      }
      .price {
        color: var(--dhan-cyan);
        font-weight: 600;
      }
    `,
  ],
})
export class OrderBookComponent {
  readonly orderService = inject(OrderService);
  private readonly dialog = inject(MatDialog);

  confirmCancel(order: DhanOrder): void {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Cancel Live Order',
        message: `Cancel ${order.transactionType} ${order.quantity}x ${order.symbol} (Order ID: ${order.orderId})?`,
        confirmText: 'Cancel Order',
        isDestructive: true,
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.orderService.cancelOrder(order.orderId).subscribe();
      }
    });
  }
}

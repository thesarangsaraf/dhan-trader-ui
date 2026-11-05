import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { OrderService } from '../../../../core/api/order.service';
import { DhanHolding, DhanPosition } from '../../../../core/models/order.models';
import { ConfirmationDialogComponent } from '../../../../shared/components/confirmation-dialog/confirmation-dialog.component';
import { PriceBadgeComponent } from '../../../../shared/components/price-badge/price-badge.component';
import { SectionErrorComponent } from '../../../../shared/components/section-error/section-error.component';
import { CurrencyInrPipe } from '../../../../shared/pipes/currency-inr.pipe';

@Component({
  selector: 'app-positions-summary',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    PriceBadgeComponent,
    SectionErrorComponent,
    CurrencyInrPipe,
  ],
  template: `
    <div class="positions-container">
      <!-- Section Error State when backend is unavailable -->
      <app-section-error
        *ngIf="orderService.positionsError() as err"
        title="Failed to Load Positions"
        [message]="err"
        (retry)="orderService.refreshPositions()"
      ></app-section-error>

      <ng-container *ngIf="!orderService.positionsError()">
        <!-- PnL Metrics Summary Header (Only from Real Backend Data) -->
        <div class="metrics-grid">
          <div class="metric-box">
            <span class="m-label">Net Total P&L</span>
            <app-price-badge
              *ngIf="orderService.summary() as sum"
              [value]="sum.netPnL"
              [pulse]="true"
              size="large"
            ></app-price-badge>
            <span *ngIf="!orderService.summary()" class="m-val mono-val muted">--</span>
          </div>

          <div class="metric-box">
            <span class="m-label">Unrealized P&L</span>
            <app-price-badge
              *ngIf="orderService.summary() as sum"
              [value]="sum.totalUnrealized"
              size="normal"
            ></app-price-badge>
            <span *ngIf="!orderService.summary()" class="m-val mono-val muted">--</span>
          </div>

          <div class="metric-box">
            <span class="m-label">Realized P&L</span>
            <app-price-badge
              *ngIf="orderService.summary() as sum"
              [value]="sum.totalRealized"
              size="normal"
            ></app-price-badge>
            <span *ngIf="!orderService.summary()" class="m-val mono-val muted">--</span>
          </div>

          <div class="metric-box">
            <span class="m-label">Available Margin</span>
            <span *ngIf="orderService.funds() as f" class="m-val mono-val">
              {{ f.availableBalance | currencyInr : false }}
            </span>
            <span *ngIf="!orderService.funds()" class="m-val mono-val muted">--</span>
          </div>
        </div>

        <!-- Real Positions List -->
        <div class="positions-list">
          <div *ngIf="orderService.positions().length === 0" class="empty-state">
            <span class="material-symbols-rounded empty-icon">analytics</span>
            <p>No open or closed positions found on your Dhan account.</p>
          </div>

          <div *ngFor="let pos of orderService.positions()" class="position-row" [class.closed]="pos.netQty === 0">
            <div class="pos-info">
              <div class="sym-row">
                <span class="sym-name">{{ pos.symbol }}</span>
                <span class="prod-tag">{{ pos.productType }}</span>
                <span class="qty-pill mono-val" [class.long]="pos.netQty > 0" [class.short]="pos.netQty < 0">
                  {{ pos.netQty > 0 ? '+' : '' }}{{ pos.netQty }} Qty
                </span>
              </div>
              <div class="prices-sub mono-val">
                <span>Avg: {{ pos.buyAvg | currencyInr : false }}</span>
                <span>LTP: {{ pos.ltp | currencyInr : false }}</span>
              </div>
            </div>

            <div class="pos-pnl">
              <app-price-badge [value]="pos.unrealizedPnL + pos.realizedPnL" size="normal"></app-price-badge>

              <!-- 1-Click Square-off Action -->
              <button
                *ngIf="pos.netQty !== 0"
                class="exit-btn"
                (click)="confirmSquareOff(pos)"
                matTooltip="Square-off position immediately at Market"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [
    `
      .positions-container {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .metrics-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
        background: var(--bg-surface);
        padding: 10px;
        border-radius: 10px;
        border: 1px solid var(--border-subtle);
      }
      .metric-box {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .m-label {
        font-size: 0.6875rem;
        color: var(--text-muted);
        text-transform: uppercase;
        font-weight: 600;
      }
      .m-val {
        font-size: 0.875rem;
        font-weight: 700;
        color: var(--text-primary);
      }
      .m-val.muted {
        color: var(--text-muted);
      }
      .positions-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 400px;
        overflow-y: auto;
      }
      .empty-state {
        padding: 28px 12px;
        text-align: center;
        color: var(--text-muted);
        font-size: 0.8125rem;
      }
      .empty-icon {
        font-size: 32px;
        opacity: 0.5;
        margin-bottom: 6px;
      }
      .position-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        transition: background-color 0.15s ease;
      }
      .position-row.closed {
        opacity: 0.6;
      }
      .pos-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .sym-row {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .sym-name {
        font-weight: 700;
        font-size: 0.875rem;
      }
      .prod-tag {
        font-size: 0.625rem;
        padding: 1px 4px;
        border-radius: 3px;
        background: rgba(255, 255, 255, 0.08);
        color: var(--text-secondary);
      }
      .qty-pill {
        font-size: 0.6875rem;
        font-weight: 700;
        padding: 1px 6px;
        border-radius: 4px;
      }
      .qty-pill.long {
        color: var(--color-profit);
        background: var(--color-profit-bg);
      }
      .qty-pill.short {
        color: var(--color-loss);
        background: var(--color-loss-bg);
      }
      .prices-sub {
        font-size: 0.6875rem;
        color: var(--text-muted);
        display: flex;
        gap: 8px;
      }
      .pos-pnl {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .exit-btn {
        background: rgba(244, 63, 94, 0.15);
        color: var(--color-loss);
        border: 1px solid rgba(244, 63, 94, 0.3);
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .exit-btn:hover {
        background: var(--color-loss);
        color: #FFFFFF;
      }
    `,
  ],
})
export class PositionsSummaryComponent {
  readonly orderService = inject(OrderService);
  private readonly dialog = inject(MatDialog);

  confirmSquareOff(pos: DhanPosition): void {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Exit & Square Off Position',
        message: `Square off ${Math.abs(pos.netQty)} Qty of ${pos.symbol} at current market price?`,
        confirmText: 'Square Off',
        isDestructive: true,
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.orderService.exitPosition(pos)?.subscribe();
      }
    });
  }
}

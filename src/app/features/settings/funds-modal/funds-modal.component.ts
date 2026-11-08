import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { OrderService } from '../../../core/api/order.service';
import { AuthService } from '../../../core/api/auth.service';
import { CurrencyInrPipe } from '../../../shared/pipes/currency-inr.pipe';

@Component({
  selector: 'app-funds-modal',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    CurrencyInrPipe,
  ],
  template: `
    <div class="funds-dialog">
      <div class="dialog-header">
        <div class="title-row">
          <span class="material-symbols-rounded wallet-icon">account_balance_wallet</span>
          <div>
            <h2 mat-dialog-title class="dialog-title">Dhan Available Balance & Margin</h2>
            <p class="subtitle">Live Account Funds, Trading Limits & Collateral from Dhan HQ API</p>
          </div>
        </div>
        <button mat-icon-button (click)="dialogRef.close()" class="close-btn" aria-label="Close dialog">
          <span class="material-symbols-rounded">close</span>
        </button>
      </div>

      <mat-dialog-content class="dialog-body">
        <!-- Hero Balance Card -->
        <div class="hero-balance-card" *ngIf="orderService.funds() as f">
          <div class="hero-top">
            <span class="hero-label">Available Balance for Trading</span>
            <span class="live-pill">
              <span class="pulse-dot"></span>
              Live from Dhan
            </span>
          </div>
          <div class="hero-amount mono-val">
            {{ f.availableBalance | currencyInr }}
          </div>
          <p class="hero-caption">
            Unencumbered capital available for placing instant equity and option conditional orders.
          </p>
        </div>

        <!-- Demat Stock Holdings Card (if user has Demat stocks) -->
        <div class="demat-portfolio-card" *ngIf="orderService.funds() as f">
          <div class="demat-row" *ngIf="(f.dematHoldingsValue || 0) > 0">
            <div class="demat-info">
              <div class="demat-title">Demat Stock Holdings Portfolio</div>
              <div class="demat-sub">{{ f.holdingsCount || 0 }} stock(s) held in your Dhan Demat account</div>
            </div>
            <div class="demat-val mono-val">{{ f.dematHoldingsValue | currencyInr }}</div>
          </div>
          <div class="total-row" *ngIf="(f.totalAccountValue || 0) > (f.availableBalance || 0)">
            <span class="total-label">Total Account Equity (Cash + Demat Holdings):</span>
            <span class="total-val mono-val">{{ f.totalAccountValue | currencyInr }}</span>
          </div>
          <div class="demat-note" *ngIf="f.availableBalance === 0 && (f.dematHoldingsValue || 0) > 0">
            <span class="material-symbols-rounded note-icon">info</span>
            <span>Your Demat portfolio holds {{ f.dematHoldingsValue | currencyInr }} in stocks. Your liquid unpledged trading margin is currently ₹0. Pledging shares on Dhan Web provides instant margin for options trading.</span>
          </div>
        </div>

        <!-- Margin Breakdown Grid -->
        <div class="breakdown-grid" *ngIf="orderService.funds() as f">
          <div class="grid-card">
            <div class="grid-label">Available Margin</div>
            <div class="grid-val mono-val">{{ f.availableBalance | currencyInr }}</div>
            <span class="grid-sub">Trading limits</span>
          </div>
          <div class="grid-card">
            <div class="grid-label">Utilized Margin</div>
            <div class="grid-val mono-val" [class.loss]="f.utilizedMargin > 0">
              {{ f.utilizedMargin | currencyInr }}
            </div>
            <span class="grid-sub">Blocked in open orders</span>
          </div>
          <div class="grid-card">
            <div class="grid-label">Collateral Margin</div>
            <div class="grid-val mono-val">{{ f.collateralAmount | currencyInr }}</div>
            <span class="grid-sub">Pledged holdings</span>
          </div>
          <div class="grid-card">
            <div class="grid-label">Withdrawable Cash</div>
            <div class="grid-val mono-val">
              {{ (f.withdrawableBalance !== undefined ? f.withdrawableBalance : f.availableBalance) | currencyInr }}
            </div>
            <span class="grid-sub">Available for payout</span>
          </div>
        </div>

        <!-- Account Metadata -->
        <div class="account-card" *ngIf="orderService.funds() as f">
          <div class="acc-row">
            <span class="acc-label">Dhan Client ID:</span>
            <span class="acc-val mono-val">{{ f.dhanClientId || authService.tokenStatus()?.clientId || 'Connected' }}</span>
          </div>
          <div class="acc-row">
            <span class="acc-label">Dhan Engine:</span>
            <span class="acc-val online-txt">
              <span class="pulse-dot-inline"></span>
              {{ authService.isBackendOnline() ? 'Connected (127.0.0.1:8000)' : 'Offline' }}
            </span>
          </div>
        </div>

        <!-- Offline / Loading Fallback -->
        <div class="no-funds-card" *ngIf="!orderService.funds()">
          <span class="material-symbols-rounded no-funds-icon">sync_problem</span>
          <p class="no-funds-txt">
            {{ authService.isBackendOnline() ? 'Retrieving live account funds from Dhan API...' : 'Backend offline. Unable to load Dhan account balance.' }}
          </p>
          <button
            mat-stroked-button
            class="retry-btn"
            (click)="orderService.refreshFunds()"
            [disabled]="orderService.isRefreshingFunds()"
          >
            <span class="material-symbols-rounded" [class.spinning]="orderService.isRefreshingFunds()">refresh</span>
            {{ orderService.isRefreshingFunds() ? 'Fetching...' : 'Retry Funds Query' }}
          </button>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="dialog-actions">
        <button
          mat-flat-button
          class="refresh-btn"
          (click)="orderService.refreshFunds()"
          [disabled]="orderService.isRefreshingFunds()"
        >
          <span class="material-symbols-rounded btn-icon" [class.spinning]="orderService.isRefreshingFunds()">refresh</span>
          {{ orderService.isRefreshingFunds() ? 'Refreshing...' : 'Refresh Balance' }}
        </button>
        <button mat-button (click)="dialogRef.close()" class="cancel-btn">
          Close
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [
    `
      .funds-dialog {
        background: var(--bg-card);
        color: var(--text-primary);
        display: flex;
        flex-direction: column;
        border-radius: 12px;
        overflow: hidden;
      }
      .dialog-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid var(--border-subtle);
        background: var(--bg-surface);
      }
      .title-row {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .wallet-icon {
        font-size: 26px;
        color: var(--dhan-cyan);
      }
      .dialog-title {
        font-size: 1.125rem;
        font-weight: 700;
        margin: 0;
        line-height: 1.2;
      }

      .dialog-body {
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        max-height: 70vh;
        overflow-y: auto;
      }
      .hero-balance-card {
        background: linear-gradient(135deg, rgba(0, 210, 196, 0.12) 0%, rgba(99, 102, 241, 0.08) 100%);
        border: 1px solid rgba(0, 210, 196, 0.3);
        border-radius: 10px;
        padding: 18px 20px;
      }
      .hero-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .hero-label {
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .live-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.6875rem;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 999px;
        background: rgba(16, 185, 129, 0.15);
        color: var(--color-profit);
        border: 1px solid rgba(16, 185, 129, 0.3);
      }

      .pulse-dot-inline {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background-color: var(--color-profit);
        display: inline-block;
        margin-right: 4px;
      }
      .hero-amount {
        font-size: 2rem;
        font-weight: 800;
        color: var(--dhan-cyan);
        margin: 10px 0 6px 0;
        line-height: 1.1;
      }
      .hero-caption {
        font-size: 0.75rem;
        color: var(--text-muted);
        margin: 0;
      }
      .demat-portfolio-card {
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 10px;
        padding: 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .demat-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .demat-title {
        font-size: 0.8125rem;
        font-weight: 700;
        color: var(--text-primary);
      }
      .demat-sub {
        font-size: 0.6875rem;
        color: var(--text-muted);
      }
      .demat-val {
        font-size: 1.125rem;
        font-weight: 800;
        color: var(--dhan-cyan);
      }
      .total-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-top: 8px;
        border-top: 1px dashed var(--border-subtle);
        font-size: 0.75rem;
      }
      .total-label {
        font-weight: 600;
        color: var(--text-muted);
      }
      .total-val {
        font-size: 0.9375rem;
        font-weight: 700;
        color: var(--text-primary);
      }
      .demat-note {
        display: flex;
        align-items: flex-start;
        gap: 6px;
        font-size: 0.6875rem;
        color: var(--color-pending);
        background: var(--color-pending-bg);
        border: 1px solid rgba(245, 158, 11, 0.3);
        border-radius: 6px;
        padding: 6px 8px;
        line-height: 1.4;
      }
      .note-icon {
        font-size: 15px;
        flex-shrink: 0;
      }
      .breakdown-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
      }
      .grid-card {
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .grid-label {
        font-size: 0.6875rem;
        font-weight: 600;
        color: var(--text-muted);
      }
      .grid-val {
        font-size: 1.0625rem;
        font-weight: 700;
        color: var(--text-primary);
        margin: 2px 0;
      }
      .grid-val.loss {
        color: var(--color-loss);
      }
      .grid-sub {
        font-size: 0.625rem;
        color: var(--text-muted);
      }
      .account-card {
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        padding: 12px 16px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .acc-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 0.75rem;
      }
      .acc-label {
        color: var(--text-muted);
      }
      .acc-val {
        font-weight: 600;
        color: var(--text-primary);
      }
      .online-txt {
        display: inline-flex;
        align-items: center;
        color: var(--color-profit);
      }
      .no-funds-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 32px 16px;
        background: var(--bg-surface);
        border-radius: 8px;
        border: 1px dashed var(--border-subtle);
        text-align: center;
        gap: 10px;
      }
      .no-funds-icon {
        font-size: 36px;
        color: var(--text-muted);
      }
      .no-funds-txt {
        font-size: 0.8125rem;
        color: var(--text-muted);
        margin: 0;
      }
      .retry-btn {
        margin-top: 6px;
      }
      .dialog-actions {
        padding: 12px 20px;
        border-top: 1px solid var(--border-subtle);
        background: var(--bg-surface);
        gap: 8px;
      }
      .refresh-btn {
        background: var(--dhan-cyan) !important;
        color: #0b0f19 !important;
        font-weight: 600;
      }
      .btn-icon {
        font-size: 18px;
        margin-right: 4px;
      }
      .cancel-btn {
        color: var(--text-muted);
      }
    `,
  ],
})
export class FundsModalComponent {
  readonly orderService = inject(OrderService);
  readonly authService = inject(AuthService);
  readonly dialogRef = inject(MatDialogRef<FundsModalComponent>);
}

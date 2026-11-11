import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { CurrencyInrPipe } from '../../pipes/currency-inr.pipe';
import { AlertService } from '../../../core/api/alert.service';

export interface AlertPreviewData {
  title?: string;
  subtitle?: string;
  mode?: 'confirm' | 'view';
  initialTabIndex?: number;
  instrument: string;
  securityId: string;
  exchangeSegment: string;
  currentLtp: number | null;
  targetPrice: number;
  operator: string;
  remarks: string;
  status?: string;
  alertId?: string;
  expiry?: string;
  hasOrder: boolean;
  order?: {
    action: 'BUY' | 'SELL';
    symbol: string;
    securityId: string;
    exchangeSegment: string;
    productType: string;
    orderType: string;
    quantity: number;
    lots?: number;
    price: number;
    strike?: number;
    optionType?: string;
    lotSize?: number;
    moneyness?: string;
    status?: string;
    orderId?: string | null;
  };
  stopLoss?: {
    enabled: boolean;
    points: number;
    targetPrice: number;
    operator: string;
    action: string;
    status?: string;
    orderId?: string | null;
    alertId?: string;
  };
  endpoint?: {
    method: string;
    url: string;
  };
  dhanPayload: Record<string, any>;
  slDhanPayload?: Record<string, any>;
  rawJsonTitle?: string;
  slRawJsonTitle?: string;
  password?: string;
}

@Component({
  selector: 'app-alert-preview-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    CurrencyInrPipe,
  ],
  template: `
    <div class="preview-dialog">
      <!-- Dialog Header -->
      <div class="dialog-header">
        <div class="title-wrap">
          <span class="material-symbols-rounded header-icon">{{ data.mode === 'view' ? 'data_object' : 'verified_user' }}</span>
          <div>
            <h2 class="dialog-title">{{ data.title || 'Confirm Conditional Alert & Order' }}</h2>
            <span class="dialog-subtitle">{{ data.subtitle || 'Verify trigger condition, attached option contract & Dhan HQ API payload' }}</span>
          </div>
        </div>
        <button mat-icon-button (click)="close(false)" class="close-btn" [matTooltip]="data.mode === 'view' ? 'Close' : 'Cancel'">
          <span class="material-symbols-rounded">close</span>
        </button>
      </div>

      <!-- Dialog Body with Tabs -->
      <div class="dialog-body">
        <mat-tab-group animationDuration="150ms" class="preview-tabs" [selectedIndex]="selectedTabIndex">
          <!-- Tab 1: Human-readable Summary -->
          <mat-tab>
            <ng-template mat-tab-label>
              <span class="tab-label-wrap">
                <span class="material-symbols-rounded tab-icon">tune</span>
                Summary Details
              </span>
            </ng-template>

            <div class="tab-content summary-content">
              <!-- Section 1: Trigger Condition -->
              <div class="detail-card">
                <div class="card-section-header">
                  <span class="material-symbols-rounded section-icon text-cyan">radar</span>
                  <span class="section-title">Market Condition Trigger</span>
                  <span class="status-badge" *ngIf="data.status" [ngClass]="data.status.toLowerCase()">
                    {{ data.status }}
                  </span>
                </div>

                <div class="summary-grid">
                  <div class="info-item">
                    <span class="label">Underlying Scrip</span>
                    <span class="value font-semibold">
                      {{ data.instrument }}
                      <span class="tag-badge">{{ data.exchangeSegment }}</span>
                      <span class="tag-badge sec-id">ID: {{ data.securityId }}</span>
                    </span>
                  </div>

                  <div class="info-item">
                    <span class="label">Current Market LTP</span>
                    <span class="value mono-val">
                      {{ data.currentLtp !== null ? (data.currentLtp | currencyInr) : 'Unavailable' }}
                    </span>
                  </div>

                  <div class="info-item">
                    <span class="label">Target Trigger Price</span>
                    <span class="value mono-val text-amber font-bold">
                      {{ data.targetPrice | currencyInr }}
                    </span>
                  </div>

                  <div class="info-item">
                    <span class="label">Condition Logic</span>
                    <span class="value">
                      <span class="op-badge" [ngClass]="getOpClass(data.operator)">
                        {{ formatOperator(data.operator) }}
                      </span>
                    </span>
                  </div>

                  <div class="info-item">
                    <span class="label">Comparison Type</span>
                    <span class="value mono-val text-muted">PRICE_WITH_VALUE</span>
                  </div>

                  <div class="info-item">
                    <span class="label">Trigger Expiry / Frequency</span>
                    <span class="value">
                      {{ data.expiry || '30 Days' }}
                      <span class="tag-badge">ONCE</span>
                    </span>
                  </div>

                  <div class="info-item" *ngIf="data.alertId">
                    <span class="label">Dhan Alert ID</span>
                    <span class="value mono-val text-cyan font-semibold">
                      #{{ data.alertId }}
                    </span>
                  </div>
                </div>

                <div class="remarks-box" *ngIf="data.remarks">
                  <span class="remarks-label">User Note / Remarks:</span>
                  <span class="remarks-text">{{ data.remarks }}</span>
                </div>
              </div>

              <!-- Section 2: Attached Order -->
              <div class="detail-card" *ngIf="data.hasOrder && data.order">
                <div class="card-section-header">
                  <span class="material-symbols-rounded section-icon text-emerald">bolt</span>
                  <span class="section-title">Instant Order Execution (Attached)</span>
                  <span class="status-badge" [class.buy]="data.order.action === 'BUY'" [class.sell]="data.order.action === 'SELL'">
                    {{ data.order.action }}
                  </span>
                  <span class="status-badge order-status-tag" *ngIf="data.order.status && data.order.status !== 'PENDING'">
                    {{ data.order.status }}
                  </span>
                </div>

                <div class="summary-grid">
                  <div class="info-item full-width-item">
                    <span class="label">Option Contract</span>
                    <span class="value contract-title font-semibold">
                      {{ data.order.symbol }}
                    </span>
                  </div>

                  <div class="info-item">
                    <span class="label">Real Dhan Security ID</span>
                    <span class="value mono-val text-cyan font-semibold">
                      {{ data.order.securityId }}
                      <span class="tag-badge">{{ data.order.exchangeSegment }}</span>
                    </span>
                  </div>

                  <div class="info-item">
                    <span class="label">Order / Product Type</span>
                    <span class="value">
                      <span class="tag-badge">{{ data.order.orderType }}</span>
                      <span class="tag-badge">{{ data.order.productType }}</span>
                      <span class="tag-badge">DAY</span>
                    </span>
                  </div>

                  <div class="info-item">
                    <span class="label">Quantity & Lots</span>
                    <span class="value mono-val">
                      {{ data.order.quantity }} shares
                      <span class="tag-badge" *ngIf="data.order.lotSize">
                        {{ data.order.lots || (data.order.quantity / data.order.lotSize) }} Lots (×{{ data.order.lotSize }})
                      </span>
                    </span>
                  </div>

                  <div class="info-item">
                    <span class="label">Execution Price</span>
                    <span class="value mono-val">
                      {{ data.order.orderType === 'MARKET' ? 'MARKET (Best Available)' : (data.order.price | currencyInr) }}
                    </span>
                  </div>

                  <div class="info-item" *ngIf="data.order.orderId">
                    <span class="label">Dhan Order ID</span>
                    <span class="value mono-val text-emerald font-semibold">
                      #{{ data.order.orderId }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Automated Stop Loss Protection Section -->
              <div class="detail-card sl-card" *ngIf="data.stopLoss && data.stopLoss.enabled">
                <div class="card-section-header">
                  <span class="material-symbols-rounded section-icon text-rose">shield</span>
                  <span class="section-title">Automated Stop Loss Order (Exit Protection)</span>
                  <span class="status-badge sl-badge">
                    {{ data.stopLoss.action }} @ ₹{{ data.stopLoss.targetPrice | currencyInr : false }}
                  </span>
                  <span class="status-badge sl-status-tag" *ngIf="data.stopLoss.status">
                    {{ data.stopLoss.status }}
                  </span>
                </div>

                <div class="summary-grid">
                  <div class="info-item">
                    <span class="label">Stop Loss Trigger Level</span>
                    <span class="value mono-val text-rose font-bold">
                      ₹{{ data.stopLoss.targetPrice | currencyInr : false }}
                      <span class="points-tag" *ngIf="data.stopLoss.points">({{ data.stopLoss.points }} pts distance)</span>
                    </span>
                  </div>

                  <div class="info-item">
                    <span class="label">Trigger Logic</span>
                    <span class="value">
                      <span class="op-badge breakdown">
                        {{ formatOperator(data.stopLoss.operator) }}
                      </span>
                    </span>
                  </div>

                  <div class="info-item full-width-item" *ngIf="data.order">
                    <span class="label">Exit Contract Order</span>
                    <span class="value mono-val text-emerald font-semibold">
                      {{ data.stopLoss.action }} {{ data.order.quantity }} Qty of {{ data.order.symbol }} (MARKET)
                    </span>
                  </div>

                  <div class="info-item" *ngIf="data.stopLoss.alertId">
                    <span class="label">SL Alert ID</span>
                    <span class="value mono-val text-rose font-semibold">
                      #{{ data.stopLoss.alertId }}
                    </span>
                  </div>

                  <div class="info-item" *ngIf="data.stopLoss.orderId">
                    <span class="label">SL Order ID</span>
                    <span class="value mono-val text-emerald font-semibold">
                      #{{ data.stopLoss.orderId }}
                    </span>
                  </div>

                  <div class="info-item full-width-item">
                    <span class="label">Execution Lifecycle</span>
                    <span class="value text-muted">
                      Placed automatically as a new Dhan alert order the moment the entry order is filled.
                    </span>
                  </div>
                </div>
              </div>

              <div class="no-order-card detail-card" *ngIf="!data.hasOrder">
                <div class="card-section-header">
                  <span class="material-symbols-rounded section-icon text-muted">notifications</span>
                  <span class="section-title text-muted">Alert Notification Only</span>
                </div>
                <p class="no-order-desc">
                  No automated order attached. You will receive an on-screen alert notification when the target price is hit.
                </p>
              </div>

              <!-- Integration Notice -->
              <div class="callout-banner">
                <span class="material-symbols-rounded callout-icon">sync</span>
                <div class="callout-text">
                  <ng-container *ngIf="data.mode === 'view'">
                    Alert synchronized natively with <strong>Dhan HQ API v2 (<code>/v2/alerts/orders</code>)</strong>.
                  </ng-container>
                  <ng-container *ngIf="data.mode !== 'view'">
                    This trigger registers natively with <strong>Dhan HQ API v2 (<code>/v2/alerts/orders</code>)</strong> with dual in-memory sub-millisecond execution monitoring.
                  </ng-container>
                </div>
              </div>
            </div>
          </mat-tab>

          <!-- Tab 2: Exact JSON Payload Sent to or Received from Dhan -->
          <mat-tab>
            <ng-template mat-tab-label>
              <span class="tab-label-wrap">
                <span class="material-symbols-rounded tab-icon">data_object</span>
                Dhan HQ API JSON
              </span>
            </ng-template>

            <div class="tab-content json-content">
              <div class="json-header-row">
                <div class="endpoint-pill">
                  <span class="http-method" [ngClass]="(data.endpoint?.method || (data.mode === 'view' ? 'GET' : 'POST')).toLowerCase()">
                    {{ data.endpoint?.method || (data.mode === 'view' ? 'GET' : 'POST') }}
                  </span>
                  <span class="http-url">{{ data.endpoint?.url || 'https://api.dhan.co/v2/alerts/orders' }}</span>
                </div>

                <button mat-stroked-button class="copy-btn" (click)="copyJson()" matTooltip="Copy raw JSON payload">
                  <span class="material-symbols-rounded">content_copy</span>
                  {{ hasCopied ? 'Copied!' : 'Copy JSON' }}
                </button>
              </div>

              <div class="json-viewer-wrap">
                <pre class="json-code"><code>{{ formattedJson }}</code></pre>
              </div>

              <!-- Stop Loss Planned/Received JSON if present -->
              <ng-container *ngIf="data.slDhanPayload">
                <div class="json-header-row" style="margin-top: 16px;">
                  <div class="endpoint-pill">
                    <span class="http-method" style="color: #f43f5e;">
                      {{ data.endpoint?.method || (data.mode === 'view' ? 'GET' : 'POST') }}
                    </span>
                    <span class="http-url">{{ data.slRawJsonTitle || (data.mode === 'view' ? 'Linked Stop Loss Alert JSON' : 'Planned Stop Loss Alert Order Payload') }}</span>
                  </div>

                  <button mat-stroked-button class="copy-btn" (click)="copySlJson()" matTooltip="Copy Stop Loss JSON">
                    <span class="material-symbols-rounded">content_copy</span>
                    {{ hasCopiedSl ? 'Copied!' : 'Copy SL JSON' }}
                  </button>
                </div>

                <div class="json-viewer-wrap">
                  <pre class="json-code" style="color: #fda4af;"><code>{{ formattedSlJson }}</code></pre>
                </div>
              </ng-container>
            </div>
          </mat-tab>
        </mat-tab-group>
      </div>

      <!-- Order Authorization Password Input (Only when placing alert with order) -->
      <div class="order-auth-section" *ngIf="!isViewMode && data.hasOrder">
        <div class="auth-header-row">
          <div class="auth-title-wrap">
            <span class="material-symbols-rounded auth-shield-icon">security</span>
            <div>
              <span class="auth-heading">Order Authorization Required</span>
              <span class="auth-subtext">Enter trade password to authorize placing live conditional order</span>
            </div>
          </div>
        </div>

        <div class="auth-form-row">
          <div class="auth-input-container" [class.has-error]="!!passwordError">
            <span class="material-symbols-rounded lock-prefix-icon">lock</span>
            <input
              [type]="showPassword ? 'text' : 'password'"
              class="auth-password-input"
              placeholder="Enter trade password"
              [(ngModel)]="orderPassword"
              (keyup.enter)="confirm()"
              (input)="clearPasswordError()"
              autocomplete="off"
              maxlength="32"
            />
            <button
              type="button"
              class="auth-visibility-btn"
              (click)="showPassword = !showPassword"
              [matTooltip]="showPassword ? 'Hide password' : 'Show password'"
            >
              <span class="material-symbols-rounded">{{ showPassword ? 'visibility_off' : 'visibility' }}</span>
            </button>
          </div>
          <span class="auth-firebase-hint">Stored securely in Firebase config collection</span>
        </div>

        <div class="auth-error-banner" *ngIf="passwordError">
          <span class="material-symbols-rounded error-icon">error</span>
          <span>{{ passwordError }}</span>
        </div>
      </div>

      <!-- Dialog Actions -->
      <div class="dialog-actions">
        <button *ngIf="isViewMode" mat-flat-button color="primary" class="close-view-btn" (click)="close(false)">
          Close
        </button>

        <ng-container *ngIf="!isViewMode">
          <button mat-stroked-button class="cancel-btn" (click)="close(false)" [disabled]="isVerifying">
            Cancel
          </button>
          <button
            mat-flat-button
            color="primary"
            class="confirm-btn"
            (click)="confirm()"
            [disabled]="isVerifying || (data.hasOrder && !orderPassword.trim())"
          >
            <span class="material-symbols-rounded">{{ isVerifying ? 'sync' : 'rocket_launch' }}</span>
            {{ isVerifying ? 'Verifying...' : 'Confirm & Place Alert' }}
          </button>
        </ng-container>
      </div>
    </div>
  `,
  styles: [
    `
      .preview-dialog {
        display: flex;
        flex-direction: column;
        max-width: 680px;
        width: 100%;
        max-height: 85vh;
        background: var(--bg-surface-elevated, #151c2c);
        color: var(--text-primary, #f8fafc);
        border-radius: 14px;
        overflow: hidden;
      }

      .dialog-header {
        padding: 16px 20px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }

      .header-icon {
        font-size: 28px;
        color: var(--dhan-cyan, #00d2c4);
      }

      .tab-label-wrap {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-weight: 500;
      }

      .tab-icon {
        font-size: 18px;
      }

      .tab-content {
        padding: 16px 20px;
      }

      .detail-card {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 10px;
        padding: 14px 16px;
        margin-bottom: 14px;
      }

      .card-section-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      }

      .section-icon {
        font-size: 20px;
      }

      .section-title {
        font-size: 0.875rem;
        font-weight: 600;
        flex: 1;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }

      .full-width-item {
        grid-column: 1 / -1;
      }

      .info-item {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .info-item .label {
        font-size: 0.6875rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--text-muted, #94a3b8);
      }

      .info-item .value {
        font-size: 0.875rem;
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }

      .tag-badge {
        font-size: 0.6875rem;
        padding: 2px 6px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.08);
        color: var(--text-muted, #94a3b8);
      }

      .tag-badge.sec-id {
        background: rgba(0, 210, 196, 0.1);
        color: var(--dhan-cyan, #00d2c4);
      }

      .status-badge {
        font-size: 0.6875rem;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 4px;
      }

      .status-badge.buy {
        background: rgba(16, 185, 129, 0.2);
        color: #10b981;
      }

      .status-badge.sell {
        background: rgba(244, 63, 94, 0.2);
        color: #f43f5e;
      }

      .status-badge.active {
        background: rgba(0, 210, 196, 0.15);
        color: var(--dhan-cyan, #00d2c4);
      }

      .status-badge.triggered {
        background: rgba(16, 185, 129, 0.2);
        color: #10b981;
      }

      .status-badge.cancelled {
        background: rgba(255, 255, 255, 0.1);
        color: #94a3b8;
      }

      .order-status-tag {
        background: rgba(99, 102, 241, 0.2);
        color: #818cf8;
      }

      .sl-status-tag {
        background: rgba(244, 63, 94, 0.25);
        color: #fda4af;
      }

      .op-badge {
        font-size: 0.75rem;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 4px;
      }

      .op-badge.breakout {
        background: rgba(0, 210, 196, 0.15);
        color: #00d2c4;
      }

      .op-badge.breakdown {
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
      }

      .remarks-box {
        margin-top: 12px;
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 6px;
        font-size: 0.75rem;
        display: flex;
        gap: 8px;
      }

      .remarks-label {
        color: var(--text-muted, #94a3b8);
      }

      .remarks-text {
        font-weight: 500;
      }

      .callout-banner {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        background: rgba(99, 102, 241, 0.1);
        border: 1px solid rgba(99, 102, 241, 0.25);
        border-radius: 8px;
        font-size: 0.75rem;
        color: #cbd5e1;
      }

      .callout-icon {
        font-size: 20px;
        color: #818cf8;
      }

      .no-order-desc {
        margin: 0;
        font-size: 0.8125rem;
        color: var(--text-muted, #94a3b8);
      }

      .json-header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
      }

      .endpoint-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: rgba(0, 0, 0, 0.3);
        padding: 4px 10px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.08);
      }

      .http-method {
        font-size: 0.6875rem;
        font-weight: 700;
      }

      .http-method.post {
        color: #10b981;
      }

      .http-method.get {
        color: var(--dhan-cyan, #00d2c4);
      }

      .http-url {
        font-size: 0.75rem;
        font-family: 'JetBrains Mono', monospace;
        color: #94a3b8;
      }

      .copy-btn {
        font-size: 0.75rem;
      }

      .json-viewer-wrap {
        background: #0b0f19;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        max-height: 380px;
        overflow: auto;
        padding: 14px 16px;
      }

      .json-code {
        margin: 0;
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.75rem;
        line-height: 1.5;
        color: #38bdf8;
      }

      .dialog-actions {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 12px;
        padding: 14px 20px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(0, 0, 0, 0.15);
      }

      .confirm-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-weight: 600;
      }

      .close-view-btn {
        min-width: 90px;
        font-weight: 600;
      }

      .sl-card {
        border-color: rgba(244, 63, 94, 0.25) !important;
        background: rgba(244, 63, 94, 0.04) !important;
      }
      .sl-badge {
        background: rgba(244, 63, 94, 0.2) !important;
        color: #f43f5e !important;
      }
      .points-tag {
        font-size: 0.75rem;
        color: #fda4af;
        margin-left: 6px;
      }

      .order-auth-section {
        margin: 0 20px 14px 20px;
        padding: 12px 14px;
        background: rgba(14, 165, 233, 0.05);
        border: 1px solid rgba(14, 165, 233, 0.25);
        border-radius: 10px;
      }

      .auth-header-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
      }

      .auth-title-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .auth-shield-icon {
        font-size: 22px;
        color: #38bdf8;
      }

      .auth-heading {
        display: block;
        font-size: 0.8125rem;
        font-weight: 600;
        color: #f8fafc;
      }

      .auth-subtext {
        display: block;
        font-size: 0.7rem;
        color: #94a3b8;
      }

      .auth-form-row {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .auth-input-container {
        display: flex;
        align-items: center;
        background: #0b0f19;
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        padding: 0 10px;
        height: 38px;
        transition: border-color 0.2s, box-shadow 0.2s;
      }

      .auth-input-container:focus-within {
        border-color: #38bdf8;
        box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
      }

      .auth-input-container.has-error {
        border-color: #f43f5e;
        box-shadow: 0 0 0 2px rgba(244, 63, 94, 0.2);
      }

      .lock-prefix-icon {
        font-size: 18px;
        color: #64748b;
        margin-right: 8px;
      }

      .auth-password-input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        color: #f8fafc;
        font-size: 0.875rem;
        font-family: inherit;
        letter-spacing: 2px;
      }

      .auth-password-input::placeholder {
        color: #475569;
        letter-spacing: normal;
      }

      .auth-visibility-btn {
        background: transparent;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .auth-visibility-btn:hover {
        color: #f8fafc;
      }

      .auth-visibility-btn .material-symbols-rounded {
        font-size: 18px;
      }

      .auth-firebase-hint {
        font-size: 0.6875rem;
        color: #64748b;
        margin-top: 2px;
      }

      .auth-error-banner {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 8px;
        padding: 6px 10px;
        background: rgba(244, 63, 94, 0.12);
        border: 1px solid rgba(244, 63, 94, 0.3);
        border-radius: 6px;
        color: #fb7185;
        font-size: 0.75rem;
      }

      .auth-error-banner .error-icon {
        font-size: 16px;
      }

      /* Mobile Optimizations for Alert Preview Dialog */
      @media (max-width: 600px) {
        .dialog-header {
          padding: 12px 14px;
        }

        .tab-content {
          padding: 12px 14px;
        }

        .summary-grid {
          grid-template-columns: 1fr;
          gap: 8px;
        }

        .detail-card {
          padding: 12px 14px;
        }

        .dialog-actions {
          padding: 10px 14px;
          flex-direction: column-reverse;
          gap: 6px;
        }

        .dialog-actions button {
          width: 100%;
          min-height: 40px;
        }

        .json-header-row {
          flex-direction: column;
          align-items: stretch;
          gap: 8px;
        }
      }
    `,
  ],
})
export class AlertPreviewDialogComponent {
  private readonly _data = signal<AlertPreviewData>(inject(MAT_DIALOG_DATA));

  get data(): AlertPreviewData {
    return this._data();
  }

  set data(val: AlertPreviewData) {
    this._data.set(val);
  }

  private dialogRef = inject(MatDialogRef<AlertPreviewDialogComponent>);
  private snackBar = inject(MatSnackBar);
  private alertService = inject(AlertService, { optional: true });

  selectedTabIndex = this.data.initialTabIndex ?? 0;
  hasCopied = false;
  hasCopiedSl = false;

  orderPassword = '';
  showPassword = false;
  passwordError = '';
  isVerifying = false;

  clearPasswordError(): void {
    this.passwordError = '';
  }

  async confirm(): Promise<void> {
    if (this.isViewMode) {
      this.close(false);
      return;
    }

    if (!this.data.hasOrder) {
      this.dialogRef.close(true);
      return;
    }

    const pwd = (this.orderPassword || '').trim();
    if (!pwd) {
      this.passwordError = 'Please enter your order authorization password';
      return;
    }

    if (this.alertService) {
      this.isVerifying = true;
      this.passwordError = '';
      try {
        const res = await firstValueFrom(this.alertService.verifyOrderPassword(pwd));
        if (res && res.valid) {
          this.dialogRef.close({ confirmed: true, password: pwd });
        } else {
          this.passwordError = res?.message || 'Incorrect trade password. Please try again.';
        }
      } catch (err: any) {
        this.passwordError = err?.error?.message || 'Verification failed. Please check your trade password.';
      } finally {
        this.isVerifying = false;
      }
    } else {
      this.dialogRef.close({ confirmed: true, password: pwd });
    }
  }

  get isViewMode(): boolean {
    return this.data?.mode === 'view';
  }

  get formattedJson(): string {
    return JSON.stringify(this.data.dhanPayload, null, 2);
  }

  get formattedSlJson(): string {
    return this.data.slDhanPayload ? JSON.stringify(this.data.slDhanPayload, null, 2) : '';
  }

  formatOperator(op?: string): string {
    if (!op) return 'Unknown';
    switch (op) {
      case 'GREATER_THAN_EQUAL':
      case 'GREATER_THAN_OR_EQUAL':
      case 'CROSSING_UP':
        return '≥ Breakout (Price Rises to/above)';
      case 'GREATER_THAN':
        return '> Breakout (Price strictly above)';
      case 'LESS_THAN_EQUAL':
      case 'LESS_THAN_OR_EQUAL':
      case 'CROSSING_DOWN':
        return '≤ Breakdown (Price Drops to/below)';
      case 'LESS_THAN':
        return '< Breakdown (Price strictly below)';
      case 'CROSSING_ANY_SIDE':
        return '⇋ Any Side Crossover';
      default:
        return op;
    }
  }

  getOpClass(op?: string): string {
    if (!op) return 'breakout';
    return op.includes('GREATER') || op.includes('UP') ? 'breakout' : 'breakdown';
  }

  copyJson(): void {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(this.formattedJson).then(() => {
        this.hasCopied = true;
        this.snackBar.open('Dhan HQ API JSON copied to clipboard!', 'OK', { duration: 2500 });
        setTimeout(() => (this.hasCopied = false), 2500);
      });
    }
  }

  copySlJson(): void {
    if (navigator?.clipboard && this.formattedSlJson) {
      navigator.clipboard.writeText(this.formattedSlJson).then(() => {
        this.hasCopiedSl = true;
        this.snackBar.open('Stop Loss JSON copied to clipboard!', 'OK', { duration: 2500 });
        setTimeout(() => (this.hasCopiedSl = false), 2500);
      });
    }
  }

  close(confirmed: boolean): void {
    this.dialogRef.close(confirmed);
  }
}

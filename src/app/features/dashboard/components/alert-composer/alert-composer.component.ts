import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AlertService } from '../../../../core/api/alert.service';
import { AuthService } from '../../../../core/api/auth.service';
import { UserAuthService } from '../../../../core/api/user-auth.service';
import { InstrumentService } from '../../../../core/api/instrument.service';
import { AlertOperator } from '../../../../core/models/alert.models';
import {
  Instrument,
  OptionExpiryItem,
  StrikeOptionPair,
} from '../../../../core/models/instrument.models';
import { SectionErrorComponent } from '../../../../shared/components/section-error/section-error.component';
import { ScripSearcherModalComponent } from '../../../../shared/components/scrip-searcher-modal/scrip-searcher-modal.component';
import { CurrencyInrPipe } from '../../../../shared/pipes/currency-inr.pipe';
import {
  AlertPreviewData,
  AlertPreviewDialogComponent,
} from './alert-preview-dialog/alert-preview-dialog.component';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-alert-composer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatSelectModule,
    MatTooltipModule,
    MatDialogModule,
    SectionErrorComponent,
    CurrencyInrPipe,
  ],
  template: `
    <div class="composer-card m3-card">
      <div class="composer-header">
        <div class="title-wrap">
          <span class="material-symbols-rounded header-icon">add_alert</span>
          <div>
            <h3 class="card-title">Conditional Alert Composer</h3>
            <span class="subtitle">Index & Scrip Execution Engine</span>
          </div>
        </div>
      </div>

      <!-- Offline Warning Banner if backend is not available -->
      <app-section-error
        *ngIf="!authService.isBackendOnline()"
        title="Backend Offline"
        [message]="'Cannot fetch real-time market prices or place alerts. Ensure server is online on ' + backendUrl + '.'"
        (retry)="retryConnection()"
      ></app-section-error>

      <form (ngSubmit)="submitAlert()" class="composer-form">
        <!-- Warning when no indices are available in Firestore -->
        <div class="db-not-found-warning mb-12" *ngIf="instruments().length === 0">
          <span class="material-symbols-rounded warn-icon">database_off</span>
          <div class="warn-content">
            <span class="warn-title">Data is not found in database</span>
            <span class="warn-msg">No indices available in Firestore. Please sync security master from Settings.</span>
          </div>
        </div>

        <div class="composer-columns-grid">
          <!-- COLUMN 1: INSTRUMENT & TARGET TRIGGER PRICE -->
          <div class="composer-col trigger-col">
            <div class="section-title-line">
              <span class="material-symbols-rounded col-icon">my_location</span>
              <span class="col-heading">1. Trigger Condition</span>
            </div>

            <!-- 1. Instrument Dropdown Selector -->
            <div class="form-row">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Select Instrument</mat-label>
                <mat-select
                  [(ngModel)]="selectedInstrumentSymbol"
                  name="selectedInstrumentSymbol"
                  (selectionChange)="onInstrumentChange($event.value)"
                  panelClass="instrument-select-panel"
                  required
                >
                  <mat-option *ngFor="let item of instruments()" [value]="item.symbol">
                    {{ item.symbol }}
                  </mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <!-- 2. Target Trigger Price (Exact price directly, operator decided automatically by backend) -->
            <div class="condition-box">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Target Trigger Price (₹)</mat-label>
                <input
                  matInput
                  type="number"
                  step="0.05"
                  [(ngModel)]="targetPrice"
                  name="targetPrice"
                  (ngModelChange)="onTargetPriceChange()"
                  placeholder="e.g. 24650.00"
                  required
                />
              </mat-form-field>
            </div>

            <!-- Live Trigger Status & Auto-Selected Dhan Price Condition Card -->
            <div class="trigger-info-card mono-val" *ngIf="currentLtp || targetPrice">
              <div class="info-row">
                <span class="info-lbl">Spot LTP:</span>
                <span class="info-val">
                  {{ currentLtp !== null ? ('₹' + (currentLtp | currencyInr : false)) : '--' }}
                </span>
              </div>

              <!-- Auto-Selected Dhan Price Condition (Read-Only Info) -->
              <div
                class="auto-condition-panel"
                *ngIf="autoConditionInfo() as cond"
                [ngClass]="cond.isCrossingUp ? 'cond-up' : 'cond-down'"
              >
                <div class="auto-condition-header">
                  <span class="auto-condition-label">Dhan Alert Condition</span>
                  <span class="auto-badge">AUTO</span>
                </div>
                <div class="auto-condition-value-row">
                  <span class="auto-condition-pill">
                    <span class="material-symbols-rounded cond-icon">
                      {{ cond.isCrossingUp ? 'trending_up' : 'trending_down' }}
                    </span>
                    <span class="cond-name">{{ cond.dhanCondition }}</span>
                    <span class="cond-op-code">({{ cond.operator }})</span>
                  </span>
                  <span *ngIf="targetPointsDiff()" class="diff-tag">({{ targetPointsDiff() }} pts)</span>
                </div>
                <div class="auto-condition-hint">
                  {{ cond.description }} (₹{{ targetPrice | currencyInr : false }})
                </div>
              </div>
            </div>
          </div>

          <!-- COLUMN 2: INSTANT ORDER EXECUTION & PROTECTION -->
          <div class="composer-col order-col">
            <div class="section-title-line">
              <span class="material-symbols-rounded col-icon">bolt</span>
              <span class="col-heading">2. Order Placement</span>
            </div>

            <!-- 3. Conditional Order Execution (Option Contract & Lots) -->
            <div class="action-box enabled">
              <div class="inline-order-form">
                <div class="order-inputs-grid">
                  <!-- Action: BUY (Call) / SELL (Put) -->
                  <div class="grid-col col-span-2">
                    <label class="input-lbl">Action (Directional Option Trigger)</label>
                    <mat-button-toggle-group
                      [(ngModel)]="orderAction"
                      name="orderAction"
                      (change)="onActionChange($event.value)"
                      class="action-toggle"
                      hideSingleSelectionIndicator
                    >
                      <mat-button-toggle value="BUY" class="btn-buy">
                        CALL
                      </mat-button-toggle>
                      <mat-button-toggle value="SELL" class="btn-sell">
                        PUT
                      </mat-button-toggle>
                    </mat-button-toggle-group>
                  </div>

                  <!-- Option Expiry Selection Dropdown -->
                  <div class="grid-col col-span-2">
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Option Expiry Date</mat-label>
                      <mat-select
                        [(ngModel)]="selectedExpiry"
                        name="selectedExpiry"
                        (selectionChange)="onExpiryChange($event.value)"
                      >
                        <mat-option *ngFor="let exp of expiries()" [value]="exp.expiryDate">
                          {{ exp.displayExpiry }}
                        </mat-option>
                      </mat-select>
                    </mat-form-field>
                  </div>

                  <!-- Option Strike Price Selection (3 strikes around target price, displayed vertically) -->
                  <div class="grid-col col-span-2 strike-selector-box" *ngIf="strikePairs().length > 0">
                    <div class="strike-loading-row" *ngIf="isLoadingOptions()">
                      <span class="loading-label">Loading strikes...</span>
                    </div>
                    <div class="strike-chips">
                      <div
                        *ngFor="let strike of strikePairs()"
                        class="strike-chip"
                        [ngClass]="{ 'selected': selectedStrikePrice === strike.strikePrice }"
                        (click)="selectStrike(strike.strikePrice)"
                      >
                        <span class="strike-val mono-val">{{ getContractFullName(strike) }}</span>
                        <span class="strike-ltp mono-val" *ngIf="orderAction === 'BUY'">
                          LTP: {{ strike.call.ltp | currencyInr : false }}
                        </span>
                        <span class="strike-ltp mono-val" *ngIf="orderAction === 'SELL'">
                          LTP: {{ strike.put.ltp | currencyInr : false }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- Warning when Option chain data is not found in database -->
                  <div class="grid-col col-span-2 db-not-found-warning" *ngIf="strikePairs().length === 0 && !isLoadingOptions()">
                    <span class="material-symbols-rounded warn-icon">database_off</span>
                    <div class="warn-content">
                      <span class="warn-title">Data is not found in database</span>
                      <span class="warn-msg">Option contracts for {{ selectedInstrumentSymbol }} are not found in Firestore. Please sync security master from Settings.</span>
                    </div>
                  </div>

                  <!-- Fixed Lot Size Selection with dynamic calculation & preferred badge -->
                  <div class="grid-col col-span-2 lots-selector-box">
                    <div class="lots-header-row">
                      <label class="input-lbl">Order Lot Size</label>
                      <span class="preferred-indicator" *ngIf="preferredLots() > 0">
                        Configured Preferred: <strong>{{ preferredLots() }} Lots</strong>
                      </span>
                    </div>
                    <div class="fixed-lots-group">
                      <button
                        *ngFor="let lots of lotOptions()"
                        type="button"
                        class="lot-select-btn"
                        [ngClass]="{ 'active-qty': orderLots === lots }"
                        (click)="setLots(lots)"
                      >
                        <span class="lot-btn-title">
                          {{ lots }} Lots
                          <span class="pref-pill" *ngIf="preferredLots() > 0 && lots === preferredLots()">Preferred</span>
                        </span>
                        <span class="lot-btn-calc mono-val">
                          ({{ lots * currentContractLotSize() }} Qty)
                        </span>
                      </button>
                    </div>

                    <!-- Dynamic Configured Order Quantity Summary Banner -->
                    <div class="order-qty-summary-box mono-val">
                      <div class="summary-line">
                        <span class="summary-lbl">Total Order Quantity:</span>
                        <span class="summary-val text-cyan font-bold">{{ totalOrderQuantity() }} Shares</span>
                      </div>
                      <span class="summary-calc text-muted">
                        ({{ orderLots }} Lots &times; {{ currentContractLotSize() }} Qty/Lot)
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Stop Loss Section (Compulsory) -->
                <div class="stop-loss-section">
                  <div class="sl-summary-row mono-val">
                    <div class="sl-defined-tag">
                      <span class="material-symbols-rounded tag-icon">shield</span>
                      <span>Stop Loss: <strong>{{ stopLossPoints() }} Points</strong></span>
                    </div>
                    <div class="sl-calc-box" *ngIf="stopLossPrice() !== null">
                      <span class="sl-calc-label">SL Price:</span>
                      <span class="sl-calc-val">₹{{ stopLossPrice() | currencyInr : false }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Price Direction Warning Banner (Buy above LTP or Sell below LTP) -->
        <div
          class="price-direction-warning"
          *ngIf="priceDirectionWarning() as warn"
          role="alert"
        >
          <span class="material-symbols-rounded warn-icon">warning</span>
          <div class="warn-content">
            <span class="warn-title">{{ warn.title }}</span>
            <span class="warn-msg">{{ warn.message }}</span>
          </div>
        </div>

        <!-- Admin Restriction Warning Banner for Non-Admin Users -->
        <div class="admin-restriction-banner" *ngIf="!userAuthService.isAdmin()">
          <span class="material-symbols-rounded">shield</span>
          <div class="restriction-text">
            <strong>Order Placement Restricted:</strong>
            Only users with the <strong>Admin</strong> role can place live orders or conditional alerts. You are signed in with the role <em>'{{ userAuthService.currentUser()?.role || "trader" }}'</em>.
          </div>
        </div>

        <!-- 4. Submit Button -->
        <div class="composer-submit-row">
          <button
            mat-flat-button
            color="primary"
            type="submit"
            class="submit-btn"
            [disabled]="!userAuthService.isAdmin() || isSubmitting() || !selectedInstrumentSymbol || !targetPrice || !authService.isBackendOnline() || !orderSecurityId"
            [matTooltip]="!userAuthService.isAdmin() ? 'Order placement is restricted to Administrator accounts' : ''"
          >
            <span class="material-symbols-rounded">notifications_active</span>
            Create Conditional Alert
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .composer-card {
        padding: 16px;
      }
      .composer-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 14px;
      }
      .title-wrap {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .header-icon {
        font-size: 24px;
        color: var(--dhan-cyan);
      }
      .card-title {
        font-size: 1rem;
        font-weight: 600;
        margin: 0;
      }
      .subtitle {
        font-size: 0.6875rem;
        color: var(--text-muted);
      }
      .instrument-select-row {
        display: flex;
        gap: 8px;
        align-items: flex-start;
      }
      .instrument-select-field {
        flex: 1;
      }
      .scrip-search-btn {
        height: 54px;
        width: 54px;
        border-radius: 8px;
        border: 1px solid var(--border-medium);
        background: var(--bg-surface);
        color: var(--dhan-cyan);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .scrip-search-btn:hover {
        background: var(--bg-card-hover);
        border-color: var(--dhan-cyan);
      }
      .scrip-search-btn .material-symbols-rounded {
        font-size: 22px;
      }
      .composer-columns-grid {
        display: grid;
        grid-template-columns: minmax(260px, 1fr) minmax(360px, 1.45fr);
        gap: 16px;
        align-items: start;
        margin-bottom: 14px;
      }
      .composer-col {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .section-title-line {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding-bottom: 2px;
      }
      .col-icon {
        font-size: 17px;
        color: var(--dhan-cyan);
      }
      .col-heading {
        color: var(--text-primary);
      }
      .trigger-info-card {
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        font-size: 0.75rem;
      }
      .info-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .info-lbl {
        color: var(--text-muted);
      }
      .info-val {
        font-weight: 700;
        color: var(--text-primary);
      }
      .bullish-val {
        color: var(--color-profit);
      }
      .bearish-val {
        color: var(--color-loss);
      }
      .diff-tag {
        font-size: 0.6875rem;
        margin-left: 4px;
        opacity: 0.9;
        white-space: nowrap;
      }
      .auto-condition-panel {
        border-radius: 8px;
        padding: 9px 10px;
        display: flex;
        flex-direction: column;
        gap: 5px;
        border: 1px solid var(--border-subtle);
        background: rgba(15, 23, 42, 0.55);
      }
      .auto-condition-panel.cond-up {
        border-color: rgba(16, 185, 129, 0.35);
        background: rgba(16, 185, 129, 0.08);
      }
      .auto-condition-panel.cond-down {
        border-color: rgba(244, 63, 94, 0.35);
        background: rgba(244, 63, 94, 0.08);
      }
      .auto-condition-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 6px;
      }
      .auto-condition-label {
        font-family: var(--font-sans);
        font-size: 0.6875rem;
        font-weight: 600;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .auto-badge {
        font-family: var(--font-mono);
        font-size: 0.625rem;
        font-weight: 700;
        letter-spacing: 0.05em;
        color: var(--dhan-cyan);
        background: rgba(0, 210, 196, 0.14);
        border: 1px solid rgba(0, 210, 196, 0.3);
        padding: 1px 6px;
        border-radius: 4px;
      }
      .auto-condition-value-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .auto-condition-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-weight: 700;
        font-size: 0.8125rem;
      }
      .cond-up .auto-condition-pill {
        color: var(--color-profit);
      }
      .cond-down .auto-condition-pill {
        color: var(--color-loss);
      }
      .cond-icon {
        font-size: 17px;
      }
      .cond-op-code {
        font-size: 0.6875rem;
        font-weight: 600;
        opacity: 0.82;
      }
      .auto-condition-hint {
        font-family: var(--font-sans);
        font-size: 0.6875rem;
        color: var(--text-secondary);
        line-height: 1.35;
      }
      .price-direction-warning {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 11px 14px;
        margin-bottom: 12px;
        background: rgba(245, 158, 11, 0.12);
        border: 1px solid rgba(245, 158, 11, 0.45);
        border-left: 4px solid #f59e0b;
        border-radius: 8px;
        color: var(--text-primary);
      }
      .price-direction-warning .warn-icon {
        font-size: 20px;
        color: #f59e0b;
        flex-shrink: 0;
        margin-top: 1px;
      }
      .price-direction-warning .warn-content {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
      }
      .price-direction-warning .warn-title {
        font-size: 0.8125rem;
        font-weight: 700;
        color: #fbbf24;
        line-height: 1.3;
      }
      .price-direction-warning .warn-msg {
        font-size: 0.75rem;
        color: var(--text-primary);
        line-height: 1.45;
        overflow-wrap: break-word;
      }
      .condition-box {
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 10px;
        padding: 12px;
        margin-bottom: 0;
      }
      .action-box {
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 10px;
        padding: 12px;
        margin-bottom: 0;
        transition: border-color 0.2s ease;
      }
      .action-box.enabled {
        border: 1px solid var(--dhan-cyan);
        background: rgba(0, 210, 196, 0.03);
      }
      .inline-order-form {
        margin-top: 0;
        padding-top: 0;
        border-top: none;
      }
      .order-inputs-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
      }
      .col-span-2 {
        grid-column: span 2;
      }
      .input-lbl {
        display: block;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--text-muted);
        margin-bottom: 4px;
      }
      .action-toggle {
        width: 100%;
        display: flex;
        margin-bottom: 8px;
      }
      .action-toggle mat-button-toggle {
        flex: 1;
        font-weight: 700;
        font-size: 0.75rem;
        letter-spacing: 0.04em;
        text-align: center;
      }
      .action-toggle ::ng-deep .mat-button-toggle-checkmark,
      .action-toggle ::ng-deep .mat-pseudo-checkbox {
        display: none !important;
        visibility: hidden !important;
        width: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .btn-buy.mat-button-toggle-checked {
        background-color: var(--color-buy) !important;
        color: #FFFFFF !important;
      }
      .btn-sell.mat-button-toggle-checked {
        background-color: var(--color-sell) !important;
        color: #FFFFFF !important;
      }
      .strike-selector-box {
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        padding: 8px;
        margin-bottom: 4px;
      }
      .strike-loading-row {
        margin-bottom: 6px;
      }
      .loading-label {
        font-size: 0.6875rem;
        color: var(--dhan-cyan);
      }
      .strike-chips {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .strike-chip {
        width: 100%;
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        padding: 8px 12px;
        cursor: pointer;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        transition: all 0.15s ease;
      }
      .strike-chip:hover {
        border-color: var(--dhan-cyan);
        background: var(--bg-card-hover);
      }
      .strike-chip.selected {
        border-color: var(--dhan-cyan);
        background: rgba(0, 210, 196, 0.12);
        box-shadow: 0 0 0 1px var(--dhan-cyan);
      }
      .strike-val {
        font-size: 0.8125rem;
        font-weight: 700;
        font-family: var(--font-mono);
        color: var(--text-primary);
        letter-spacing: 0.02em;
      }
      .strike-ltp {
        font-size: 0.75rem;
        font-weight: 600;
        font-family: var(--font-mono);
        color: var(--dhan-cyan);
        white-space: nowrap;
      }
      .lots-selector-box {
        grid-column: span 2;
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        padding: 10px 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .lots-header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .preferred-indicator {
        font-size: 0.6875rem;
        color: var(--dhan-cyan);
        background: rgba(0, 210, 196, 0.1);
        border: 1px solid rgba(0, 210, 196, 0.25);
        padding: 2px 6px;
        border-radius: 4px;
      }
      .fixed-lots-group {
        display: flex;
        gap: 8px;
      }
      .lot-select-btn {
        flex: 1;
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        color: var(--text-secondary);
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 0.8125rem;
        font-family: var(--font-mono);
        font-weight: 700;
        cursor: pointer;
        transition: all 0.15s ease;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
      }
      .lot-select-btn:hover {
        border-color: var(--dhan-cyan);
        color: var(--dhan-cyan);
        background: rgba(0, 210, 196, 0.08);
      }
      .lot-select-btn.active-qty {
        border-color: var(--dhan-cyan);
        background: rgba(0, 210, 196, 0.15);
        color: var(--dhan-cyan);
        box-shadow: 0 0 10px rgba(0, 210, 196, 0.2);
      }
      .lot-btn-title {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
      }
      .pref-pill {
        font-size: 0.5625rem;
        padding: 1px 4px;
        border-radius: 3px;
        background: rgba(0, 210, 196, 0.25);
        color: var(--dhan-cyan);
        text-transform: uppercase;
        font-weight: 800;
        letter-spacing: 0.5px;
        line-height: 1;
      }
      .lot-btn-calc {
        font-size: 0.6875rem;
        opacity: 0.8;
      }
      .order-qty-summary-box {
        margin-top: 2px;
        padding: 6px 10px;
        background: rgba(0, 210, 196, 0.05);
        border: 1px dashed rgba(0, 210, 196, 0.25);
        border-radius: 6px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.75rem;
      }
      .order-qty-summary-box .summary-line {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .order-qty-summary-box .summary-val {
        color: var(--dhan-cyan);
        font-weight: 700;
      }
      .order-qty-summary-box .summary-calc {
        font-size: 0.6875rem;
      }
      .stop-loss-section {
        margin-top: 10px;
        padding: 8px 12px;
        background: rgba(244, 63, 94, 0.05);
        border: 1px solid rgba(244, 63, 94, 0.25);
        border-radius: 8px;
      }
      .sl-summary-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .sl-defined-tag {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(244, 63, 94, 0.1);
        border: 1px solid rgba(244, 63, 94, 0.25);
        color: #fca5a5;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 0.75rem;
      }
      .sl-defined-tag .tag-icon {
        font-size: 1rem;
        color: #f43f5e;
      }
      .sl-defined-tag strong {
        color: #fff;
      }
      .sl-calc-box {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.75rem;
      }
      .sl-calc-label {
        color: var(--text-muted);
      }
      .sl-calc-val {
        color: #f43f5e;
        font-weight: 700;
        font-size: 0.875rem;
      }
      .composer-submit-row {
        margin-top: 8px;
      }
      .db-not-found-warning {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 10px 14px;
        background: rgba(245, 158, 11, 0.08);
        border: 1px solid rgba(245, 158, 11, 0.3);
        border-radius: 8px;
        color: var(--text-primary);
      }
      .db-not-found-warning .warn-icon {
        font-size: 20px;
        color: #f59e0b;
        margin-top: 1px;
      }
      .db-not-found-warning .warn-content {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .db-not-found-warning .warn-title {
        font-size: 0.8125rem;
        font-weight: 700;
        color: #f59e0b;
      }
      .db-not-found-warning .warn-msg {
        font-size: 0.75rem;
        color: var(--text-secondary);
        line-height: 1.35;
      }
      .mb-12 {
        margin-bottom: 12px;
      }
      .admin-restriction-banner {
        display: flex;
        align-items: center;
        gap: 10px;
        background: rgba(255, 171, 0, 0.12);
        border: 1px solid rgba(255, 171, 0, 0.35);
        border-radius: 8px;
        padding: 10px 14px;
        margin-bottom: 12px;
        color: #ffab00;
        font-size: 0.8125rem;
        line-height: 1.4;
      }
      .admin-restriction-banner .material-symbols-rounded {
        font-size: 1.25rem;
        flex-shrink: 0;
      }
      .admin-restriction-banner .restriction-text strong {
        color: #ffc107;
      }
      .admin-restriction-banner .restriction-text em {
        color: #fff;
        font-style: normal;
        text-transform: uppercase;
        font-weight: 700;
      }
      .submit-btn {
        width: 100%;
        padding: 10px;
        min-height: 48px;
        font-size: 0.9375rem;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }

      /* Responsive Layout Optimizations */
      @media (max-width: 1023px) {
        .composer-columns-grid {
          grid-template-columns: 1fr;
          gap: 12px;
        }
      }

      @media (max-width: 600px) {
        .composer-card {
          padding: 12px;
        }

        .action-toggle {
          display: flex;
          flex-direction: row;
          gap: 6px;
        }

        .action-toggle mat-button-toggle {
          flex: 1;
          border-radius: 8px !important;
          min-height: 42px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .lots-header-row {
          flex-direction: row;
          justify-content: space-between;
          align-items: center;
          gap: 4px;
        }

        .lot-select-btn {
          min-height: 40px;
          padding: 6px 4px;
          font-size: 0.75rem;
          min-width: 0;
        }
      }

      @media (max-width: 480px) {
        .composer-card {
          padding: 10px;
        }

        .fixed-lots-group {
          gap: 4px;
        }

        .lot-btn-title {
          font-size: 0.75rem;
          flex-direction: column;
          gap: 2px;
        }

        .pref-pill {
          font-size: 0.5rem;
          padding: 1px 3px;
        }

        .lot-btn-calc {
          font-size: 0.625rem;
        }

        .strike-chips {
          gap: 6px;
        }

        .strike-chip {
          padding: 8px 10px;
          gap: 6px;
          flex-wrap: wrap;
        }

        .strike-val {
          font-size: 0.75rem;
          flex: 1 1 180px;
          word-break: break-word;
        }

        .strike-ltp {
          font-size: 0.75rem;
          margin-left: auto;
        }

        .order-qty-summary-box {
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
        }

        .sl-summary-row {
          flex-direction: column;
          align-items: flex-start;
          gap: 6px;
        }

        .sl-calc-box {
          width: 100%;
          justify-content: space-between;
        }

        .admin-restriction-banner,
        .price-direction-warning {
          font-size: 0.75rem;
          padding: 9px 10px;
        }

        .auto-condition-value-row {
          flex-direction: column;
          align-items: flex-start;
          gap: 3px;
        }

        .auto-condition-pill {
          font-size: 0.75rem;
          flex-wrap: wrap;
        }

        .submit-btn {
          font-size: 0.875rem;
          min-height: 44px;
        }
      }
    `,
  ],
})
export class AlertComposerComponent implements OnInit {
  readonly alertService = inject(AlertService);
  readonly authService = inject(AuthService);
  readonly userAuthService = inject(UserAuthService);
  private readonly instrumentService = inject(InstrumentService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly route = inject(ActivatedRoute, { optional: true });
  readonly backendUrl = environment.apiUrl;

  readonly isSubmitting = signal<boolean>(false);
  readonly instruments = signal<Instrument[]>([]);
  readonly expiries = signal<OptionExpiryItem[]>([]);
  readonly strikePairs = signal<StrikeOptionPair[]>([]);
  readonly isLoadingOptions = signal<boolean>(false);

  private readonly _selectedInstrumentSymbol = signal<string>('');
  get selectedInstrumentSymbol(): string {
    return this._selectedInstrumentSymbol();
  }
  set selectedInstrumentSymbol(val: string) {
    this._selectedInstrumentSymbol.set(val || '');
  }

  private readonly _selectedInstrument = signal<Instrument | null>(null);
  get selectedInstrument(): Instrument | null {
    return this._selectedInstrument();
  }
  set selectedInstrument(val: Instrument | null) {
    this._selectedInstrument.set(val);
  }

  private readonly _currentLtp = signal<number | null>(null);
  get currentLtp(): number | null {
    return this._currentLtp();
  }
  set currentLtp(val: number | null) {
    this._currentLtp.set(val !== null && val !== undefined ? Number(val) : null);
  }

  private readonly _targetPrice = signal<number | null>(null);
  get targetPrice(): number | null {
    return this._targetPrice();
  }
  set targetPrice(val: number | null) {
    this._targetPrice.set(
      val !== null && val !== undefined && (val as unknown) !== '' ? Number(val) : null
    );
  }

  // Conditional Order Form Fields (Always active as Dhan mandates orders for alerts)
  executeOrderOnTrigger = true;
  private readonly _orderAction = signal<'BUY' | 'SELL'>('BUY');
  get orderAction(): 'BUY' | 'SELL' {
    return this._orderAction();
  }
  set orderAction(val: 'BUY' | 'SELL') {
    this._orderAction.set(val);
  }

  selectedExpiry = '';
  selectedStrikePrice: number | null = null;
  orderSymbol = '';
  orderSecurityId = '';
  orderExchangeSegment = 'NSE_FNO';
  productType: 'INTRADAY' | 'CNC' | 'MARGIN' = 'INTRADAY';
  orderType: 'MARKET' | 'LIMIT' = 'MARKET';

  private readonly _orderLots = signal<number>(0);
  get orderLots(): number {
    return this._orderLots();
  }
  set orderLots(val: number) {
    this._orderLots.set(val);
  }

  // Automated Stop Loss Form Fields
  enableStopLoss = signal<boolean>(true);
  stopLossPoints = signal<number>(12);

  userManuallyChangedLots = false;
  private userManuallyEditedTarget = false;

  readonly isBankNifty = computed(() => {
    const sym = (this.selectedInstrumentSymbol || '').toUpperCase();
    return sym.includes('BANK');
  });

  readonly preferredLots = computed<number>(() => {
    return this.getPreferredLotsForInstrument(this.selectedInstrument);
  });

  readonly lotOptions = computed(() => {
    const pref = this.preferredLots();
    const standard = [5, 10, 15];
    const set = new Set<number>();
    if (pref && pref > 0) {
      set.add(pref);
    }
    standard.forEach((l) => set.add(l));
    return Array.from(set).sort((a, b) => a - b);
  });

  constructor() {
    effect(() => {
      // Whenever preferred lots changes and user hasn't manually overridden it, update orderLots
      const pref = this.preferredLots();
      if (!this.userManuallyChangedLots && pref && pref > 0) {
        this.orderLots = pref;
      }
    });
  }

  readonly targetPointsDiff = computed<string>(() => {
    const target = this._targetPrice();
    const ltp = this._currentLtp();
    if (!target || !ltp) return '';
    const diff = Math.round((target - ltp) * 100) / 100;
    return diff >= 0 ? `+${diff}` : `${diff}`;
  });

  readonly autoTriggerOperator = computed<AlertOperator | null>(() => {
    const target = this._targetPrice();
    const ltp = this._currentLtp();
    if (
      target === null ||
      target === undefined ||
      Number.isNaN(target) ||
      target <= 0 ||
      ltp === null ||
      ltp === undefined ||
      Number.isNaN(ltp) ||
      ltp <= 0
    ) {
      return null;
    }
    return target < ltp ? 'LESS_THAN' : 'GREATER_THAN';
  });

  readonly autoConditionInfo = computed<{
    operator: AlertOperator;
    dhanCondition: 'Crossing Up' | 'Crossing Down';
    symbol: '≥' | '<';
    description: string;
    isCrossingUp: boolean;
  } | null>(() => {
    const op = this.autoTriggerOperator();
    if (!op) return null;
    if (op === 'LESS_THAN') {
      return {
        operator: 'LESS_THAN',
        dhanCondition: 'Crossing Down',
        symbol: '<',
        description: 'Auto-triggers when live price falls below target',
        isCrossingUp: false,
      };
    }
    return {
      operator: 'GREATER_THAN',
      dhanCondition: 'Crossing Up',
      symbol: '≥',
      description: 'Auto-triggers when live price rises to/above target',
      isCrossingUp: true,
    };
  });

  readonly priceDirectionWarning = computed<{
    type: 'BUY_ABOVE_LTP' | 'SELL_BELOW_LTP';
    title: string;
    message: string;
    diffPoints: number;
  } | null>(() => {
    const target = this._targetPrice();
    const ltp = this._currentLtp();
    const action = this._orderAction();

    if (
      target === null ||
      target === undefined ||
      Number.isNaN(target) ||
      target <= 0 ||
      ltp === null ||
      ltp === undefined ||
      Number.isNaN(ltp) ||
      ltp <= 0
    ) {
      return null;
    }

    const fmt = (val: number) =>
      val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    if (action === 'BUY' && target > ltp) {
      const diff = Math.round((target - ltp) * 100) / 100;
      return {
        type: 'BUY_ABOVE_LTP',
        title: 'Warning: Buy (CALL) price is higher than live price',
        message: `Target price (₹${fmt(target)}) is +${diff} pts above the current live price (₹${fmt(ltp)}). Buy orders are usually placed below live price — please verify before placing.`,
        diffPoints: diff,
      };
    }

    if (action === 'SELL' && target < ltp) {
      const diff = Math.round((ltp - target) * 100) / 100;
      return {
        type: 'SELL_BELOW_LTP',
        title: 'Warning: Sell (PUT) price is lower than live price',
        message: `Target price (₹${fmt(target)}) is -${diff} pts below the current live price (₹${fmt(ltp)}). Sell orders are usually placed above live price — please verify before placing.`,
        diffPoints: diff,
      };
    }

    return null;
  });

  readonly stopLossPrice = computed(() => {
    const entry = this._targetPrice() ?? this._currentLtp() ?? 0;
    const pts = Number(this.stopLossPoints()) || 0;
    const action = this._orderAction();
    if (!entry || !pts) return null;

    // User rule:
    // "the stop loss alert will be placed entry - 12 point. if it is sell order then entry + 12 point. if buy order then entry - 12 point of nifty 50. same goes to bank nifty, but in case of bank nifty the stop loss is 20 points."
    if (action === 'BUY') {
      return Math.round((entry - pts) * 100) / 100;
    } else {
      return Math.round((entry + pts) * 100) / 100;
    }
  });

  readonly stopLossOperator = computed<AlertOperator>(() => {
    return this._orderAction() === 'BUY' ? 'LESS_THAN' : 'GREATER_THAN';
  });

  setStopLossPoints(pts: number): void {
    this.stopLossPoints.set(pts);
  }

  ngOnInit(): void {
    this.loadInstruments();
  }

  retryConnection(): void {
    this.authService.refreshStatus();
    this.loadInstruments();
  }

  loadInstruments(): void {
    // 1. Fetch configured lot sizes & tradeable indices dynamically from Firestore
    forkJoin({
      lotSizes: this.instrumentService.fetchLotSizes(),
      indicesList: this.instrumentService.fetchConfiguredIndices(),
    }).subscribe({
      next: ({ indicesList }) => {
        const cfg = this.instrumentService.lotSizes();
        let activeIndices: Instrument[] = [];
        if (indicesList && indicesList.length > 0) {
          activeIndices = indicesList.map((idx) => {
            const sym = idx.symbol.toUpperCase();
            const matchedCfg = cfg.indices?.find(
              (c) => c.symbol.toUpperCase() === sym || sym.includes(c.symbol.toUpperCase())
            );
            const defLotSize = idx.defaultLotSize || idx.defaultLots || matchedCfg?.defaultLotSize || matchedCfg?.defaultLots || 0;
            const defQtyInLot = idx.defaultQuantityInOneLot || idx.lotSize || matchedCfg?.defaultQuantityInOneLot || matchedCfg?.lotSize || 0;
            const slPts = idx.stopLossPoints ?? matchedCfg?.stopLossPoints ?? (sym.includes('BANK') ? 20 : sym.includes('SENSEX') ? 30 : sym.includes('MID') ? 15 : 12);
            return {
              ...idx,
              defaultLotSize: defLotSize,
              defaultLots: defLotSize,
              defaultQuantityInOneLot: defQtyInLot,
              lotSize: defQtyInLot,
              defaultQuantity: defLotSize * defQtyInLot,
              stopLossPoints: slPts,
            };
          });
        } else if (cfg?.indices && cfg.indices.length > 0) {
          activeIndices = cfg.indices
            .filter((i) => i.enabled !== false)
            .map((i) => ({
              symbol: i.symbol,
              name: i.name,
              securityId: i.securityId,
              exchangeSegment: i.exchangeSegment,
              instrumentType: 'INDEX',
              lotSize: i.defaultQuantityInOneLot || i.lotSize || 0,
              defaultLotSize: i.defaultLotSize || i.defaultLots || 0,
              defaultQuantityInOneLot: i.defaultQuantityInOneLot || i.lotSize || 0,
              defaultLots: i.defaultLotSize || i.defaultLots || 0,
              defaultQuantity: (i.defaultLotSize || 0) * (i.defaultQuantityInOneLot || 0),
              stopLossPoints: i.stopLossPoints,
              ltp: 0,
            }));
        }

        this.instruments.set(activeIndices);
        if (activeIndices.length > 0) {
          const querySym = this.route?.snapshot?.queryParams?.['symbol'];
          const current = this.selectedInstrumentSymbol;
          const matchedByQuery = querySym
            ? activeIndices.find(
                (i) =>
                  i.symbol.toUpperCase() === querySym.toUpperCase() ||
                  (i.name && i.name.toUpperCase().includes(querySym.toUpperCase()))
              )
            : null;
          const matched = matchedByQuery || (current ? activeIndices.find((i) => i.symbol === current) : null);
          const target = matched || activeIndices.find((i) => i.symbol === 'NIFTY 50') || activeIndices[0];
          if (target) {
            const queryTarget = this.route?.snapshot?.queryParams?.['targetPrice'];
            const parsedQueryTarget =
              queryTarget !== undefined && queryTarget !== null && queryTarget !== ''
                ? Number(queryTarget)
                : undefined;
            const queryStrategy = this.route?.snapshot?.queryParams?.['strategy'];
            if (queryStrategy) {
              if (queryStrategy.includes('DEMAND') || queryStrategy.includes('BULL')) {
                this.orderAction = 'BUY';
              } else if (queryStrategy.includes('SUPPLY') || queryStrategy.includes('BEAR')) {
                this.orderAction = 'SELL';
              }
            }
            this.onInstrumentChange(target.symbol, parsedQueryTarget);
          }
        } else {
          this.selectedInstrumentSymbol = '';
          this.selectedInstrument = null;
          this.currentLtp = null;
          this.targetPrice = null;
          this.expiries.set([]);
          this.strikePairs.set([]);
          this.selectedStrikePrice = null;
          this.orderSymbol = '';
          this.orderSecurityId = '';
        }
      },
      error: () => {
        this.instrumentService.fetchConfiguredIndices().subscribe((indicesList) => {
          const cfg = this.instrumentService.lotSizes();
          if (indicesList && indicesList.length > 0) {
            const enriched = indicesList.map((idx) => {
              const sym = idx.symbol.toUpperCase();
              const matchedCfg = cfg.indices?.find(
                (c) => c.symbol.toUpperCase() === sym || sym.includes(c.symbol.toUpperCase())
              );
              const defLotSize = idx.defaultLotSize || idx.defaultLots || matchedCfg?.defaultLotSize || matchedCfg?.defaultLots || 0;
              const defQtyInLot = idx.defaultQuantityInOneLot || idx.lotSize || matchedCfg?.defaultQuantityInOneLot || matchedCfg?.lotSize || 0;
              return {
                ...idx,
                defaultLotSize: defLotSize,
                defaultLots: defLotSize,
                defaultQuantityInOneLot: defQtyInLot,
                lotSize: defQtyInLot,
                defaultQuantity: defLotSize * defQtyInLot,
              };
            });
            this.instruments.set(enriched);
            const target = enriched.find((i) => i.symbol === 'NIFTY 50') || enriched[0];
            if (target) this.onInstrumentChange(target.symbol);
          }
        });
      },
    });
  }

  getPreferredLotsForInstrument(inst: Instrument | null): number {
    const sym = (inst?.symbol || this.selectedInstrumentSymbol || '').toUpperCase();
    if (!sym) return 0;
    const cfg = this.instrumentService.lotSizes();

    if (inst?.defaultLotSize && inst.defaultLotSize > 0) return inst.defaultLotSize;
    if (inst?.defaultLots && inst.defaultLots > 0) return inst.defaultLots;

    const matched = cfg.indices?.find(
      (i) => i.symbol.toUpperCase() === sym || sym.includes(i.symbol.toUpperCase())
    );
    if (matched && (matched.defaultLotSize || matched.defaultLots)) {
      return matched.defaultLotSize || matched.defaultLots || 0;
    }
    if (sym.includes('BANK') && cfg.bankNiftyLots) return cfg.bankNiftyLots;
    if ((sym.includes('MIDCAP') || sym.includes('MIDCP')) && cfg.midcapNiftyLots) return cfg.midcapNiftyLots;
    if (sym.includes('SENSEX') && cfg.sensexLots) return cfg.sensexLots;
    if (sym.includes('NIFTY') && cfg.nifty50Lots) return cfg.nifty50Lots;
    return 0;
  }

  getLotSizeForInstrument(inst: Instrument | null): number {
    const sym = (inst?.symbol || this.selectedInstrumentSymbol || '').toUpperCase();
    const cfg = this.instrumentService.lotSizes();
    const matched = cfg.indices?.find(
      (i) => i.symbol.toUpperCase() === sym || sym.includes(i.symbol.toUpperCase())
    );
    if (matched && (matched.defaultQuantityInOneLot || matched.lotSize)) {
      return matched.defaultQuantityInOneLot || matched.lotSize || 0;
    }
    if (inst?.defaultQuantityInOneLot && inst.defaultQuantityInOneLot > 0) {
      return inst.defaultQuantityInOneLot;
    }
    if (inst?.lotSize && inst.lotSize > 0) {
      return inst.lotSize;
    }
    if (sym.includes('BANK') && cfg.bankNifty) return cfg.bankNifty;
    if ((sym.includes('MIDCAP') || sym.includes('MIDCP')) && cfg.midcapNifty) return cfg.midcapNifty;
    if (sym.includes('SENSEX') && cfg.sensex) return cfg.sensex;
    if (sym.includes('NIFTY') && cfg.nifty50) return cfg.nifty50;
    return 0;
  }

  getDefinedSlPoints(symbol: string): number {
    const upperSym = (symbol || '').toUpperCase();
    const cfg = this.instrumentService.lotSizes();
    const matched = cfg.indices?.find((i) => i.symbol.toUpperCase() === upperSym);
    if (matched && matched.stopLossPoints) return matched.stopLossPoints;
    if (upperSym.includes('BANK')) return 20;
    if (upperSym.includes('MIDCAP') || upperSym.includes('MIDCP')) return 15;
    if (upperSym.includes('SENSEX')) return 30;
    if (upperSym.includes('NIFTY')) return 12;
    return 15;
  }

  onInstrumentChange(symbol: string, presetTargetPrice?: number): void {
    this.userManuallyChangedLots = false;
    this.userManuallyEditedTarget = false;
    this.selectedInstrumentSymbol = symbol;
    const upper = (symbol || '').toUpperCase();
    const found = this.instruments().find(
      (i) =>
        i.symbol.toUpperCase() === upper ||
        (upper.includes('BANK') && i.symbol.toUpperCase().includes('BANK')) ||
        (upper.includes('SENSEX') && i.symbol.toUpperCase().includes('SENSEX')) ||
        ((upper.includes('MIDCAP') || upper.includes('MIDCP')) &&
          (i.symbol.toUpperCase().includes('MIDCAP') || i.symbol.toUpperCase().includes('MIDCP'))) ||
        (upper.includes('NIFTY') &&
          !upper.includes('BANK') &&
          !upper.includes('MID') &&
          i.symbol === 'NIFTY 50')
    );
    if (!found) return;

    this.selectedInstrument = found;
    this.selectedInstrumentSymbol = found.symbol;

    // Resolve configured preferred lots from Firestore database
    const pref = this.getPreferredLotsForInstrument(found);
    if (pref > 0) {
      this.orderLots = pref;
    }

    // Set defined Stop Loss points based on instrument
    this.stopLossPoints.set(this.getDefinedSlPoints(found.symbol));

    const hasPresetTarget =
      presetTargetPrice !== undefined &&
      presetTargetPrice !== null &&
      !Number.isNaN(presetTargetPrice) &&
      presetTargetPrice > 0;

    // Set initial Spot LTP & initialize Target Trigger Price directly to live spot price
    if (found.ltp && found.ltp > 0) {
      const roundedLtp = Math.round(found.ltp * 100) / 100;
      this.currentLtp = roundedLtp;
      this.targetPrice = hasPresetTarget ? presetTargetPrice : roundedLtp;
    } else {
      this.currentLtp = null;
      this.targetPrice = hasPresetTarget ? presetTargetPrice : null;
    }

    const expectedSymbol = found.symbol;

    // Fetch live LTP
    this.instrumentService.getLtp(found.symbol).subscribe((res) => {
      if (this.selectedInstrumentSymbol !== expectedSymbol) return;
      if (res.ltp !== null && res.ltp !== undefined && res.ltp > 0) {
        const roundedLive = Math.round(res.ltp * 100) / 100;
        this.currentLtp = roundedLive;
        if (!hasPresetTarget && !this.userManuallyEditedTarget) {
          this.targetPrice = roundedLive;
        }
        this.loadOptionContracts();
      }
    });

    // Fetch expiries from backend for this instrument
    this.loadExpiries(found.symbol);
  }

  openScripSearchModal(): void {
    const dialogRef = this.dialog.open(ScripSearcherModalComponent, {
      width: '640px',
      panelClass: 'dhan-spotlight-dialog',
    });
    dialogRef.afterClosed().subscribe((item?: Instrument) => {
      if (item) {
        this.onInstrumentSelected(item);
      }
    });
  }

  onInstrumentSelected(item: Instrument): void {
    if (!item) return;

    // If directly selected an option contract (OPTIDX / NSE_FNO)
    if (item.instrumentType === 'OPTIDX' || item.exchangeSegment === 'NSE_FNO') {
      this.executeOrderOnTrigger = true;
      this.orderSymbol = item.symbol;
      this.orderSecurityId = item.securityId;
      this.orderExchangeSegment = item.exchangeSegment;
      this.orderLots = 1;
      this.currentLtp = item.ltp;
      this.targetPrice = item.ltp ? Math.round(item.ltp * 100) / 100 : null;

      const symUpper = item.symbol.toUpperCase();
      let parentSym = 'NIFTY 50';
      if (symUpper.includes('BANK')) parentSym = 'BANK NIFTY';
      else if (symUpper.includes('SENSEX')) parentSym = 'SENSEX';
      else if (symUpper.includes('MIDCAP') || symUpper.includes('MIDCP')) parentSym = 'MIDCAP NIFTY';
      this.selectedInstrumentSymbol = parentSym;
      return;
    }

    const sym = (item.symbol || '').toUpperCase();
    const isIndex =
      sym === 'NIFTY 50' ||
      sym.includes('BANK') ||
      sym.includes('SENSEX') ||
      sym.includes('MIDCAP') ||
      sym.includes('MIDCP');

    if (isIndex) {
      const normSymbol = sym.includes('BANK')
        ? 'BANK NIFTY'
        : sym.includes('SENSEX')
        ? 'SENSEX'
        : sym.includes('MIDCAP') || sym.includes('MIDCP')
        ? 'MIDCAP NIFTY'
        : 'NIFTY 50';
      const exists = this.instruments().some((i) => i.symbol.toUpperCase() === normSymbol);
      if (!exists) {
        this.instruments.set([...this.instruments(), { ...item, symbol: normSymbol }]);
      }
      this.onInstrumentChange(normSymbol);
    } else {
      // Cash equity (e.g. RELIANCE, TCS, INFY)
      const exists = this.instruments().some((i) => i.symbol.toUpperCase() === sym);
      if (!exists) {
        this.instruments.set([...this.instruments(), item]);
      }
      this.selectedInstrument = item;
      this.selectedInstrumentSymbol = item.symbol;
      this.currentLtp = item.ltp;
      this.targetPrice = item.ltp ? Math.round(item.ltp * 100) / 100 : null;
      this.orderLots = 1;
      this.orderSymbol = item.symbol;
      this.orderSecurityId = item.securityId;
      this.orderExchangeSegment = item.exchangeSegment;
    }
  }

  loadExpiries(symbol: string): void {
    this.instrumentService.getExpiries(symbol).subscribe((list) => {
      if (list && list.length > 0) {
        this.expiries.set(list);
        this.selectedExpiry = list[0].expiryDate;
        this.loadOptionContracts();
      } else {
        this.expiries.set([]);
        this.selectedExpiry = '';
        this.strikePairs.set([]);
        this.selectedStrikePrice = null;
        this.orderSymbol = '';
        this.orderSecurityId = '';
      }
    });
  }

  onExpiryChange(expiry: string): void {
    this.selectedExpiry = expiry;
    this.loadOptionContracts();
  }

  onTargetPriceChange(): void {
    this.userManuallyEditedTarget = true;
    this.loadOptionContracts();
  }

  onActionChange(action: 'BUY' | 'SELL'): void {
    this.orderAction = action;
    this.updateSelectedOrderContract();
  }

  loadOptionContracts(): void {
    if (!this.selectedInstrumentSymbol) return;
    this.isLoadingOptions.set(true);

    const price = this.targetPrice || this.currentLtp || undefined;
    this.instrumentService
      .getOptionContracts(this.selectedInstrumentSymbol, price, this.selectedExpiry || undefined)
      .subscribe({
        next: (res) => {
          this.isLoadingOptions.set(false);
          if (res && res.currentExpiry && Array.isArray(res.currentExpiry.strikes) && res.currentExpiry.strikes.length > 0) {
            // Show maximum 3 strikes around the selected price
            const strikes = res.currentExpiry.strikes.slice(0, 3);
            this.strikePairs.set(strikes);

            // Select ATM or middle strike by default if not set
            const atm =
              strikes.find((s) => s.relativeStrike === 'ATM') ||
              strikes[Math.floor(strikes.length / 2)] ||
              strikes[0];
            if (atm) {
              this.selectStrike(atm.strikePrice);
            }
          } else {
            this.strikePairs.set([]);
            this.selectedStrikePrice = null;
            this.orderSymbol = '';
            this.orderSecurityId = '';
          }
        },
        error: () => {
          this.isLoadingOptions.set(false);
          this.strikePairs.set([]);
          this.selectedStrikePrice = null;
          this.orderSymbol = '';
          this.orderSecurityId = '';
        },
      });
  }

  selectStrike(strikePrice: number): void {
    this.selectedStrikePrice = strikePrice;
    this.updateSelectedOrderContract();
  }

  getContractFullName(strike: StrikeOptionPair): string {
    const contract = this.orderAction === 'BUY' ? strike?.call : strike?.put;
    // Show exact contract name fetched from NSE (customSymbol) without modifications
    if (contract?.customSymbol) {
      return contract.customSymbol;
    }
    if (contract?.symbol) {
      return contract.symbol;
    }
    if (contract?.tradingSymbol) {
      return contract.tradingSymbol;
    }
    const inst = this.selectedInstrumentSymbol || '';
    const type = this.orderAction === 'BUY' ? 'CALL' : 'PUT';
    return `${inst} ${strike.strikePrice} ${type}`.trim();
  }

  updateSelectedOrderContract(): void {
    const pair = this.strikePairs().find((s) => s.strikePrice === this.selectedStrikePrice);
    if (!pair) return;

    // If BUY action -> CALL (CE); If SELL action -> PUT (PE)
    const contract = this.orderAction === 'BUY' ? pair.call : pair.put;
    if (contract) {
      this.orderSymbol = contract.customSymbol || contract.symbol;
      this.orderSecurityId = contract.securityId;
      this.orderExchangeSegment = contract.exchangeSegment;
    }
  }

  isNifty50(): boolean {
    const sym = (this.selectedInstrumentSymbol || '').toUpperCase();
    return sym === 'NIFTY 50' || sym === 'NIFTY';
  }

  currentContractLotSize(): number {
    // 1. Prioritize Firestore database lot size configuration for the instrument
    const configLotSize = this.getLotSizeForInstrument(this.selectedInstrument);
    if (configLotSize && configLotSize > 0) {
      return configLotSize;
    }
    // 2. Option contract lotSize
    const pair = this.strikePairs().find((s) => s.strikePrice === this.selectedStrikePrice);
    if (pair) {
      const contract = this.orderAction === 'BUY' ? pair.call : pair.put;
      if (contract && contract.lotSize) {
        return contract.lotSize;
      }
    }
    return this.selectedInstrument?.lotSize || 0;
  }

  totalOrderQuantity(): number {
    const lots = Number(this.orderLots) || 0;
    return lots * this.currentContractLotSize();
  }

  setLots(lots: number): void {
    this.userManuallyChangedLots = true;
    this.orderLots = lots;
  }

  setQty(qty: number): void {
    const lotSize = this.currentContractLotSize();
    if (lotSize > 1) {
      this.orderLots = Math.max(1, Math.round(qty / lotSize));
    } else {
      this.orderLots = Math.max(1, qty);
    }
  }

  get orderQuantity(): number {
    return this.totalOrderQuantity();
  }
  set orderQuantity(val: number) {
    this.setQty(val);
  }

  selectedLotStep(): number {
    return this.currentContractLotSize();
  }

  submitAlert(): void {
    if (!this.selectedInstrumentSymbol || !this.targetPrice) return;

    if (!this.userAuthService.isAdmin()) {
      this.snackBar.open(
        'Order placement is restricted to users with the Admin role.',
        'Dismiss',
        { duration: 5000 }
      );
      return;
    }

    if (this.executeOrderOnTrigger && (!this.orderSecurityId || !this.orderSymbol)) {
      this.snackBar.open(
        'Cannot place alert: Option contract data is not found in database. Please sync master data from Settings.',
        'Dismiss',
        { duration: 6000 }
      );
      return;
    }

    const secId = this.selectedInstrument?.securityId;
    const exSeg = this.selectedInstrument?.exchangeSegment;
    if (!secId || !exSeg) {
      this.isSubmitting.set(false);
      this.snackBar.open(
        'Cannot place alert: Selected instrument data is not loaded.',
        'Dismiss',
        { duration: 6000 }
      );
      return;
    }
    const priceNum = Number(this.targetPrice);
    const totalQty = this.totalOrderQuantity();

    // Operator decided automatically: GREATER_THAN if target >= current LTP, LESS_THAN if target < current LTP
    // Matches Dhan HQ API v2 and Dhan Web/App operator specifications, preventing 'Price undefined' on Dhan
    const operator: AlertOperator =
      this.autoTriggerOperator() ??
      (this.currentLtp !== null && priceNum < this.currentLtp
        ? 'LESS_THAN'
        : 'GREATER_THAN');

    // 30 days default expiry date in YYYY-MM-DD
    const expDate = (() => {
      const d = new Date(Date.now() + 30 * 86400000);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();

    const clientId =
      this.authService.tokenStatus()?.clientId ||
      this.authService.tokenStatus()?.payload?.clientId ||
      'YOUR_CLIENT_ID';

    const slPrice = this.stopLossPrice();
    const slPts = this.stopLossPoints();
    const slOp = this.stopLossOperator();

    const stopLossConfig =
      this.executeOrderOnTrigger && this.enableStopLoss() && slPrice !== null
        ? {
            enabled: true,
            points: slPts,
            targetPrice: slPrice,
            operator: slOp,
            action: 'SELL' as const,
          }
        : undefined;

    // Planned Stop Loss Alert payload for Dhan HQ API v2
    const slDhanPayload = stopLossConfig
      ? {
          dhanClientId: clientId,
          condition: {
            comparisonType: 'PRICE_WITH_VALUE',
            exchangeSegment: exSeg,
            securityId: String(secId),
            operator: slOp === 'LESS_THAN' ? 'LESS_THAN' : 'GREATER_THAN',
            comparingValue: slPrice,
            expDate: expDate,
            userNote: `[STOP LOSS] Exit for ${this.selectedInstrumentSymbol} at ₹${slPrice}`,
            frequency: 'ONCE',
          },
          orders: [
            {
              transactionType: 'SELL',
              exchangeSegment: this.orderExchangeSegment || 'NSE_FNO',
              productType: this.productType,
              orderType: 'MARKET',
              securityId: String(this.orderSecurityId),
              quantity: totalQty,
              price: '0',
              validity: 'DAY',
            },
          ],
        }
      : undefined;

    // Construct the exact Dhan HQ API v2 JSON payload sent to POST /alerts/orders
    const dhanPayload: Record<string, any> = this.executeOrderOnTrigger
      ? {
          dhanClientId: clientId,
          condition: {
            comparisonType: 'PRICE_WITH_VALUE',
            exchangeSegment: exSeg,
            securityId: String(secId),
            operator: operator,
            comparingValue: priceNum,
            expDate: expDate,
            userNote: `Conditional order for ${this.selectedInstrumentSymbol} at ₹${priceNum}`,
            frequency: 'ONCE',
          },
          orders: [
            {
              transactionType: 'BUY',
              exchangeSegment: this.orderExchangeSegment || 'NSE_FNO',
              productType: this.productType,
              orderType: this.orderType,
              securityId: String(this.orderSecurityId),
              quantity: totalQty,
              price: '0',
              validity: 'DAY',
            },
          ],
        }
      : {
          dhanClientId: clientId,
          condition: {
            comparisonType: 'PRICE_WITH_VALUE',
            exchangeSegment: exSeg,
            securityId: String(secId),
            operator: operator,
            comparingValue: priceNum,
            expDate: expDate,
            userNote: `Alert for ${this.selectedInstrumentSymbol} at ₹${priceNum}`,
            frequency: 'ONCE',
          },
        };

    const directionWarning = this.priceDirectionWarning();

    const previewData: AlertPreviewData = {
      instrument: this.selectedInstrumentSymbol,
      securityId: secId,
      exchangeSegment: exSeg,
      currentLtp: this.currentLtp,
      targetPrice: priceNum,
      operator: operator,
      remarks: `Alert for ${this.selectedInstrumentSymbol} @ ₹${priceNum}`,
      expiry: this.selectedExpiry || expDate,
      hasOrder: this.executeOrderOnTrigger,
      order: this.executeOrderOnTrigger
        ? {
            action: 'BUY',
            symbol: this.orderSymbol,
            customSymbol: this.orderSymbol,
            securityId: this.orderSecurityId,
            exchangeSegment: this.orderExchangeSegment || 'NSE_FNO',
            productType: this.productType,
            orderType: this.orderType,
            quantity: totalQty,
            lots: this.orderLots,
            price: 0,
            strike: this.selectedStrikePrice || undefined,
            optionType: this.orderAction === 'BUY' ? 'CALL (CE)' : 'PUT (PE)',
            lotSize: this.currentContractLotSize(),
          }
        : undefined,
      stopLoss: stopLossConfig,
      dhanPayload,
      slDhanPayload,
      priceWarning: directionWarning
        ? {
            title: directionWarning.title,
            message: directionWarning.message,
          }
        : undefined,
    };

    const dialogRef = this.dialog.open(AlertPreviewDialogComponent, {
      data: previewData,
      width: '640px',
      maxWidth: '94vw',
      panelClass: 'alert-preview-dialog-panel',
    });

    dialogRef.afterClosed().subscribe((res: boolean | { confirmed: boolean }) => {
      if (res) {
        this.executeCreateAlert(operator);
      }
    });
  }

  private executeCreateAlert(operator: AlertOperator): void {
    if (this.executeOrderOnTrigger && (!this.orderSecurityId || !this.orderSymbol)) {
      this.snackBar.open(
        'Cannot place alert: Option contract data is not found in database. Please sync master data from Settings.',
        'Dismiss',
        { duration: 6000 }
      );
      return;
    }

    this.isSubmitting.set(true);

    const secId = this.selectedInstrument?.securityId;
    const exSeg = this.selectedInstrument?.exchangeSegment;
    if (!secId || !exSeg) {
      this.isSubmitting.set(false);
      this.snackBar.open(
        'Cannot place alert: Selected instrument data is not loaded.',
        'Dismiss',
        { duration: 6000 }
      );
      return;
    }
    const totalQty = this.totalOrderQuantity();
    const pair = this.strikePairs().find((s) => s.strikePrice === this.selectedStrikePrice);
    const contract = pair ? (this.orderAction === 'BUY' ? pair.call : pair.put) : null;

    const conditionalOrder = this.executeOrderOnTrigger
      ? {
          symbol: this.orderSymbol,
          tradingSymbol: contract?.tradingSymbol || this.orderSymbol,
          customSymbol: contract?.customSymbol || this.orderSymbol,
          instrumentName: this.orderSymbol,
          strikePrice: this.selectedStrikePrice || contract?.strikePrice,
          optionType: contract?.optionType || (this.orderAction === 'BUY' ? 'CE' : 'PE'),
          expiryDate: this.selectedExpiry || undefined,
          securityId: this.orderSecurityId,
          exchangeSegment: this.orderExchangeSegment || 'NSE_FNO',
          transactionType: 'BUY' as const,
          orderType: this.orderType,
          productType: this.productType,
          quantity: totalQty,
          lots: this.orderLots,
          price: 0,
          validity: 'DAY',
        }
      : undefined;

    const stopLoss =
      this.executeOrderOnTrigger && this.enableStopLoss() && this.stopLossPrice() !== null
        ? {
            enabled: true,
            points: this.stopLossPoints(),
            targetPrice: this.stopLossPrice()!,
            operator: this.stopLossOperator(),
            action: 'SELL' as const,
          }
        : undefined;

    this.alertService
      .createAlert({
        instrument: this.selectedInstrumentSymbol,
        securityId: secId,
        exchangeSegment: exSeg,
        targetPrice: Number(this.targetPrice),
        operator: operator,
        remarks: `Alert for ${this.selectedInstrumentSymbol} @ ₹${this.targetPrice}`,
        conditionalOrder,
        stopLoss,
        attachedOrder: conditionalOrder
          ? {
              enabled: true,
              action: 'BUY',
              symbol: this.orderSymbol,
              tradingSymbol: contract?.tradingSymbol || this.orderSymbol,
              customSymbol: contract?.customSymbol || this.orderSymbol,
              instrumentName: this.orderSymbol,
              strikePrice: this.selectedStrikePrice || contract?.strikePrice,
              optionType: contract?.optionType || (this.orderAction === 'BUY' ? 'CE' : 'PE'),
              expiryDate: this.selectedExpiry || undefined,
              securityId: this.orderSecurityId,
              exchangeSegment: this.orderExchangeSegment,
              productType: this.productType,
              orderType: this.orderType,
              quantity: totalQty,
              lots: this.orderLots,
            }
          : undefined,
        expDate: this.selectedExpiry || undefined,
      })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
        },
        error: () => {
          this.isSubmitting.set(false);
        },
      });
  }
}

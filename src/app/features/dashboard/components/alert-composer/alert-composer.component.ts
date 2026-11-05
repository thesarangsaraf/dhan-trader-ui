import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AlertService } from '../../../../core/api/alert.service';
import { AuthService } from '../../../../core/api/auth.service';
import { InstrumentService } from '../../../../core/api/instrument.service';
import { OrderService } from '../../../../core/api/order.service';
import { StrategyService } from '../../../../core/api/strategy.service';
import { AlertOperator, PopularIndex } from '../../../../core/models/alert.models';
import { Instrument } from '../../../../core/models/instrument.models';
import { SectionErrorComponent } from '../../../../shared/components/section-error/section-error.component';
import { CurrencyInrPipe } from '../../../../shared/pipes/currency-inr.pipe';

export interface FixedInstrumentOption {
  symbol: string;
  displayName: string;
  securityId: string;
  exchangeSegment: string;
  lotSize: number;
  defaultTargetOffset: number;
  defaultOrderSymbol: string;
}

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
    MatCheckboxModule,
    MatSelectModule,
    MatTooltipModule,
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
            <span class="subtitle">Zero Static IP Index & Scrip Execution Engine</span>
          </div>
        </div>

        <div class="ltp-badge mono-val" *ngIf="currentLtp !== null">
          <span class="label">LTP:</span>
          <span class="price">{{ currentLtp | currencyInr : false }}</span>
        </div>
        <div class="ltp-badge offline mono-val" *ngIf="currentLtp === null">
          <span class="label">LTP:</span>
          <span class="price">-- (Offline)</span>
        </div>
      </div>

      <!-- Offline Warning Banner if backend is not available -->
      <app-section-error
        *ngIf="!authService.isBackendOnline() && alertService.indicesError()"
        title="Backend Offline"
        message="Cannot fetch real-time market prices or place alerts. Ensure server is online on 127.0.0.1:8000."
        (retry)="retryConnection()"
      ></app-section-error>

      <form (ngSubmit)="submitAlert()" class="composer-form">
        <!-- 1. Fixed Instrument Dropdown Selector in Sequence: NIFTY 50, BANK NIFTY, SENSEX, RELIANCE -->
        <div class="form-row">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Select Instrument</mat-label>
            <mat-select
              [(ngModel)]="selectedInstrumentSymbol"
              name="selectedInstrumentSymbol"
              (selectionChange)="onFixedInstrumentChange($event.value)"
              panelClass="fixed-instruments-panel"
              required
            >
              <mat-option *ngFor="let item of fixedInstruments" [value]="item.symbol">
                <div class="scrip-select-item">
                  <div class="item-name-group">
                    <span class="scrip-symbol">{{ item.displayName }}</span>
                    <span class="scrip-segment-tag">{{ item.exchangeSegment }}</span>
                  </div>
                  <span class="scrip-ltp-val mono-val">
                    {{ getInstrumentLtp(item) !== null ? (getInstrumentLtp(item) | currencyInr : false) : '--' }}
                  </span>
                </div>
              </mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <!-- 2. Condition & Target Price -->
        <div class="condition-box">
          <span class="section-label">Trigger Condition</span>
          <div class="operator-row">
            <mat-button-toggle-group [(ngModel)]="operator" name="operator" class="operator-toggle" aria-label="Alert Operator">
              <mat-button-toggle value="GREATER_THAN_OR_EQUAL" matTooltip="Triggers when LTP >= Target Price (Breakout Up)">
                &ge; Breakout
              </mat-button-toggle>
              <mat-button-toggle value="LESS_THAN_OR_EQUAL" matTooltip="Triggers when LTP <= Target Price (Breakdown Down)">
                &le; Breakdown
              </mat-button-toggle>
              <mat-button-toggle value="CROSSING_UP" matTooltip="Triggers when LTP crosses above Target Price">
                &uarr; Cross Up
              </mat-button-toggle>
              <mat-button-toggle value="CROSSING_DOWN" matTooltip="Triggers when LTP crosses below Target Price">
                &darr; Cross Down
              </mat-button-toggle>
            </mat-button-toggle-group>
          </div>

          <div class="price-input-row">
            <mat-form-field appearance="outline" class="target-field">
              <mat-label>Target Trigger Price (₹)</mat-label>
              <input
                matInput
                type="number"
                step="0.05"
                [(ngModel)]="targetPrice"
                name="targetPrice"
                placeholder="Target Price"
                required
              />
            </mat-form-field>

            <div class="quick-inc-chips">
              <button type="button" class="inc-chip" (click)="addPoints(-50)">-50</button>
              <button type="button" class="inc-chip" (click)="addPoints(-10)">-10</button>
              <button type="button" class="inc-chip" (click)="addPoints(-5)">-5</button>
              <button type="button" class="inc-chip" (click)="addPoints(5)">+5</button>
              <button type="button" class="inc-chip" (click)="addPoints(10)">+10</button>
              <button type="button" class="inc-chip" (click)="addPoints(50)">+50</button>
            </div>
          </div>

          <mat-form-field appearance="outline" class="full-width remarks-field">
            <mat-label>Remarks / Strategy Note (Optional)</mat-label>
            <input matInput [(ngModel)]="remarks" name="remarks" placeholder="e.g. 5m breakout, hedge cover" />
          </mat-form-field>
        </div>

        <!-- 3. Conditional Execution Toggle ("Trigger to Action") -->
        <div class="action-box" [class.enabled]="executeOrderOnTrigger">
          <div class="action-toggle-row">
            <mat-checkbox [(ngModel)]="executeOrderOnTrigger" name="executeOrderOnTrigger" color="primary">
              <span class="toggle-text">⚡ Execute Instant Order upon Trigger</span>
            </mat-checkbox>
            <span class="zero-latency-tag">Sub-millisecond Local Bridge</span>
          </div>

          <!-- Inline Order Form when toggle is enabled -->
          <div *ngIf="executeOrderOnTrigger" class="inline-order-form">
            <!-- Strategy bind option -->
            <div class="strategy-toggle-banner">
              <mat-checkbox [(ngModel)]="bindAutoSlStrategy" name="bindAutoSlStrategy" color="accent">
                <span>Deploy Auto-SL Bracket (-7 pts SL / +30 pts Target)</span>
              </mat-checkbox>
            </div>

            <div class="order-inputs-grid" *ngIf="!bindAutoSlStrategy">
              <div class="grid-col">
                <label class="input-lbl">Action</label>
                <mat-button-toggle-group [(ngModel)]="orderAction" name="orderAction" class="action-toggle">
                  <mat-button-toggle value="BUY" class="btn-buy">BUY</mat-button-toggle>
                  <mat-button-toggle value="SELL" class="btn-sell">SELL</mat-button-toggle>
                </mat-button-toggle-group>
              </div>

              <div class="grid-col">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Execution Symbol / Strike</mat-label>
                  <input matInput [(ngModel)]="orderSymbol" name="orderSymbol" placeholder="e.g. NIFTY 24600 CE" />
                </mat-form-field>
              </div>

              <div class="grid-col">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Product</mat-label>
                  <mat-select [(ngModel)]="productType" name="productType">
                    <mat-option value="INTRADAY">INTRADAY (MIS)</mat-option>
                    <mat-option value="CNC">CNC (Delivery)</mat-option>
                    <mat-option value="MARGIN">MARGIN (NRML)</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              <div class="grid-col">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Type</mat-label>
                  <mat-select [(ngModel)]="orderType" name="orderType">
                    <mat-option value="MARKET">MARKET</mat-option>
                    <mat-option value="LIMIT">LIMIT</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              <div class="grid-col qty-col">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Quantity</mat-label>
                  <input matInput type="number" [(ngModel)]="orderQuantity" name="orderQuantity" [step]="selectedLotStep()" />
                </mat-form-field>
                <div class="qty-quick-buttons">
                  <button type="button" (click)="setQty(selectedLotStep() * 1)">1x Lot</button>
                  <button type="button" (click)="setQty(selectedLotStep() * 2)">2x Lot</button>
                  <button type="button" (click)="setQty(selectedLotStep() * 3)">3x Lot</button>
                </div>
              </div>
            </div>

            <!-- Auto-SL strategy preview if enabled -->
            <div class="strategy-preview-box" *ngIf="bindAutoSlStrategy">
              <span class="strat-title">🎯 NIFTY Long Bracket Mode Active</span>
              <p class="strat-desc">
                When {{ instrumentInput }} hits ₹{{ targetPrice }}, the engine immediately deploys a 3-leg order:
                Buy Entry + Stop Loss (-7 pts) + Target (+30 pts) for {{ orderQuantity }} Qty.
              </p>
            </div>
          </div>
        </div>

        <!-- 4. Submit Button -->
        <div class="composer-submit-row">
          <button
            mat-flat-button
            color="primary"
            type="submit"
            class="submit-btn"
            [disabled]="isSubmitting() || !instrumentInput || !targetPrice || !authService.isBackendOnline()"
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
      .ltp-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        background: rgba(0, 210, 196, 0.1);
        border: 1px solid rgba(0, 210, 196, 0.25);
        border-radius: 6px;
      }
      .ltp-badge.offline {
        background: rgba(244, 63, 94, 0.1);
        border-color: rgba(244, 63, 94, 0.25);
      }
      .ltp-badge .label {
        font-size: 0.6875rem;
        color: var(--text-muted);
      }
      .ltp-badge .price {
        font-size: 0.875rem;
        font-weight: 700;
        color: var(--dhan-cyan);
      }
      .ltp-badge.offline .price {
        color: var(--color-loss);
      }
      .full-width {
        width: 100%;
      }
      .scrip-select-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        gap: 12px;
      }
      .item-name-group {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .scrip-symbol {
        font-weight: 700;
        font-size: 0.875rem;
        color: var(--text-primary);
      }
      .scrip-segment-tag {
        font-size: 0.625rem;
        font-weight: 600;
        color: var(--text-muted);
        background: rgba(255, 255, 255, 0.08);
        padding: 1px 5px;
        border-radius: 3px;
      }
      .scrip-ltp-val {
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--dhan-cyan);
      }
      .condition-box {
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 10px;
        padding: 12px;
        margin-bottom: 14px;
      }
      .section-label {
        display: block;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--text-muted);
        letter-spacing: 0.04em;
        margin-bottom: 8px;
      }
      .operator-row {
        margin-bottom: 12px;
      }
      .operator-toggle {
        width: 100%;
        display: flex;
      }
      .operator-toggle mat-button-toggle {
        flex: 1;
        font-size: 0.75rem;
        font-weight: 600;
      }
      .price-input-row {
        display: flex;
        gap: 12px;
        align-items: center;
      }
      .target-field {
        flex: 1;
      }
      .quick-inc-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        max-width: 170px;
      }
      .inc-chip {
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        color: var(--text-secondary);
        font-family: var(--font-mono);
        font-size: 0.6875rem;
        font-weight: 600;
        padding: 4px 6px;
        border-radius: 4px;
        cursor: pointer;
      }
      .inc-chip:hover {
        border-color: var(--dhan-cyan);
        color: var(--dhan-cyan);
      }
      .remarks-field {
        margin-top: 4px;
      }
      .action-box {
        background: var(--bg-surface);
        border: 1px dashed var(--border-subtle);
        border-radius: 10px;
        padding: 12px;
        margin-bottom: 14px;
        transition: border-color 0.2s ease;
      }
      .action-box.enabled {
        border: 1px solid var(--dhan-cyan);
        background: rgba(0, 210, 196, 0.03);
      }
      .action-toggle-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .toggle-text {
        font-weight: 600;
        font-size: 0.875rem;
        color: var(--text-primary);
      }
      .zero-latency-tag {
        font-size: 0.6875rem;
        color: var(--color-profit);
        background: var(--color-profit-bg);
        padding: 2px 6px;
        border-radius: 4px;
      }
      .inline-order-form {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid var(--border-subtle);
      }
      .strategy-toggle-banner {
        margin-bottom: 10px;
        padding: 6px 10px;
        background: rgba(99, 102, 241, 0.12);
        border-radius: 6px;
        color: #A5B4FC;
        font-size: 0.8125rem;
      }
      .order-inputs-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
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
      }
      .btn-buy.mat-button-toggle-checked {
        background-color: var(--color-buy) !important;
        color: #FFFFFF !important;
      }
      .btn-sell.mat-button-toggle-checked {
        background-color: var(--color-sell) !important;
        color: #FFFFFF !important;
      }
      .qty-col {
        grid-column: span 2;
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .qty-col mat-form-field {
        flex: 1;
      }
      .qty-quick-buttons {
        display: flex;
        gap: 4px;
      }
      .qty-quick-buttons button {
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        color: var(--text-secondary);
        padding: 6px 10px;
        border-radius: 6px;
        font-size: 0.75rem;
        font-family: var(--font-mono);
        cursor: pointer;
      }
      .qty-quick-buttons button:hover {
        border-color: var(--dhan-cyan);
        color: var(--dhan-cyan);
      }
      .strategy-preview-box {
        padding: 10px;
        background: rgba(99, 102, 241, 0.1);
        border: 1px solid rgba(99, 102, 241, 0.3);
        border-radius: 8px;
        margin-top: 8px;
      }
      .strat-title {
        font-size: 0.8125rem;
        font-weight: 600;
        color: #C7D2FE;
        display: block;
        margin-bottom: 4px;
      }
      .strat-desc {
        font-size: 0.75rem;
        color: var(--text-secondary);
        line-height: 1.4;
        margin: 0;
      }
      .composer-submit-row {
        margin-top: 8px;
      }
      .submit-btn {
        width: 100%;
        padding: 10px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
    `,
  ],
})
export class AlertComposerComponent implements OnInit {
  readonly alertService = inject(AlertService);
  readonly authService = inject(AuthService);
  private readonly orderService = inject(OrderService);
  private readonly strategyService = inject(StrategyService);
  private readonly instrumentService = inject(InstrumentService);

  readonly isSubmitting = signal<boolean>(false);
  private readonly fixedPricesCache = signal<Map<string, number>>(new Map());

  /**
   * Fixed instruments sequence:
   * 1. NIFTY 50
   * 2. BANK NIFTY
   * 3. SENSEX
   * 4. RELIANCE
   */
  readonly fixedInstruments: FixedInstrumentOption[] = [
    {
      symbol: 'NIFTY 50',
      displayName: 'NIFTY 50',
      securityId: '13',
      exchangeSegment: 'IDX_I',
      lotSize: 50,
      defaultTargetOffset: 30,
      defaultOrderSymbol: 'NIFTY 24550 CE',
    },
    {
      symbol: 'BANK NIFTY',
      displayName: 'BANK NIFTY',
      securityId: '25',
      exchangeSegment: 'IDX_I',
      lotSize: 30,
      defaultTargetOffset: 100,
      defaultOrderSymbol: 'BANKNIFTY 52000 CE',
    },
    {
      symbol: 'SENSEX',
      displayName: 'SENSEX',
      securityId: '51',
      exchangeSegment: 'IDX_I',
      lotSize: 20,
      defaultTargetOffset: 150,
      defaultOrderSymbol: 'SENSEX 80500 CE',
    },
    {
      symbol: 'RELIANCE',
      displayName: 'RELIANCE',
      securityId: '2885',
      exchangeSegment: 'NSE_EQ',
      lotSize: 1,
      defaultTargetOffset: 25,
      defaultOrderSymbol: 'RELIANCE',
    },
  ];

  selectedInstrumentSymbol = 'NIFTY 50';

  // Form Fields
  instrumentInput = 'NIFTY 50';
  securityId = '13';
  exchangeSegment = 'IDX_I';
  currentLtp: number | null = null;

  operator: AlertOperator = 'GREATER_THAN_OR_EQUAL';
  targetPrice: number | null = null;
  remarks = '';

  // Conditional Order Form Fields
  executeOrderOnTrigger = false;
  bindAutoSlStrategy = false;
  orderAction: 'BUY' | 'SELL' = 'BUY';
  orderSymbol = 'NIFTY 24550 CE';
  productType: 'INTRADAY' | 'CNC' | 'MARGIN' = 'INTRADAY';
  orderType: 'MARKET' | 'LIMIT' = 'MARKET';
  orderQuantity = 50;

  ngOnInit(): void {
    this.refreshFixedInstrumentPrices();
    this.onFixedInstrumentChange(this.selectedInstrumentSymbol);
  }

  retryConnection(): void {
    this.authService.refreshStatus();
    this.alertService.refreshIndices();
    this.refreshFixedInstrumentPrices();
    this.onFixedInstrumentChange(this.selectedInstrumentSymbol);
  }

  refreshFixedInstrumentPrices(): void {
    for (const item of this.fixedInstruments) {
      this.instrumentService.getLtp(item.symbol).subscribe((res) => {
        if (res.ltp !== null && res.ltp !== undefined) {
          const updated = new Map(this.fixedPricesCache());
          updated.set(item.symbol, res.ltp);
          this.fixedPricesCache.set(updated);

          if (this.selectedInstrumentSymbol === item.symbol && this.currentLtp === null) {
            this.currentLtp = res.ltp;
            this.targetPrice = Math.round((res.ltp + item.defaultTargetOffset) * 100) / 100;
            this.remarks = `Alert for ${item.displayName} @ ₹${this.targetPrice}`;
          }
        }
      });
    }
  }

  getInstrumentLtp(item: FixedInstrumentOption): number | null {
    const indicesList = this.alertService.indices();
    const liveIdx = indicesList.find(
      (idx) =>
        idx.name.toUpperCase() === item.symbol.toUpperCase() ||
        idx.securityId === item.securityId
    );
    if (liveIdx && liveIdx.currentPrice !== null && liveIdx.currentPrice !== undefined) {
      return liveIdx.currentPrice;
    }
    const cached = this.fixedPricesCache().get(item.symbol);
    return cached !== undefined ? cached : null;
  }

  selectedLotStep(): number {
    const matched = this.fixedInstruments.find((i) => i.symbol === this.selectedInstrumentSymbol);
    return matched ? matched.lotSize : 25;
  }

  onFixedInstrumentChange(symbol: string): void {
    this.selectedInstrumentSymbol = symbol;
    const matched = this.fixedInstruments.find((i) => i.symbol === symbol);
    if (!matched) return;

    this.instrumentInput = matched.symbol;
    this.securityId = matched.securityId;
    this.exchangeSegment = matched.exchangeSegment;

    const livePrice = this.getInstrumentLtp(matched);
    this.currentLtp = livePrice;
    if (livePrice !== null) {
      this.targetPrice = Math.round((livePrice + matched.defaultTargetOffset) * 100) / 100;
      this.remarks = `Alert for ${matched.displayName} @ ₹${this.targetPrice}`;
    } else {
      this.targetPrice = null;
      this.remarks = `Alert for ${matched.displayName}`;
      // Fetch LTP asynchronously if not yet cached
      this.instrumentService.getLtp(matched.symbol).subscribe((res) => {
        if (res.ltp !== null && res.ltp !== undefined && this.selectedInstrumentSymbol === matched.symbol) {
          this.currentLtp = res.ltp;
          this.targetPrice = Math.round((res.ltp + matched.defaultTargetOffset) * 100) / 100;
          this.remarks = `Alert for ${matched.displayName} @ ₹${this.targetPrice}`;
          const updated = new Map(this.fixedPricesCache());
          updated.set(matched.symbol, res.ltp);
          this.fixedPricesCache.set(updated);
        }
      });
    }
    this.orderSymbol = matched.defaultOrderSymbol;
    this.orderQuantity = matched.lotSize;
  }

  onInstrumentSelected(item: Instrument): void {
    if (!item) return;
    const matchedFixed = this.fixedInstruments.find(
      (f) => f.symbol.toUpperCase() === item.symbol.toUpperCase()
    );
    if (matchedFixed) {
      this.onFixedInstrumentChange(matchedFixed.symbol);
      return;
    }

    this.selectedInstrumentSymbol = item.symbol;
    this.instrumentInput = item.symbol;
    this.securityId = item.securityId;
    this.exchangeSegment = item.exchangeSegment;
    this.currentLtp = item.ltp;
    if (item.ltp) {
      this.targetPrice = Math.round((item.ltp + 30) * 100) / 100;
    }
    this.orderSymbol = `${item.symbol} ATM`;
    if (item.lotSize) {
      this.orderQuantity = item.lotSize;
    }
  }

  loadIndex(idx: PopularIndex): void {
    const matchedFixed = this.fixedInstruments.find(
      (f) => f.symbol.toUpperCase() === idx.name.toUpperCase()
    );
    if (matchedFixed) {
      this.onFixedInstrumentChange(matchedFixed.symbol);
      return;
    }

    this.selectedInstrumentSymbol = idx.name;
    this.instrumentInput = idx.name;
    this.securityId = idx.securityId;
    this.exchangeSegment = idx.exchangeSegment;
    this.currentLtp = idx.currentPrice;
    if (idx.currentPrice) {
      this.targetPrice = Math.round((idx.currentPrice + 25) * 100) / 100;
    }
    this.orderSymbol = `${idx.name} ATM CE`;
  }

  addPoints(points: number): void {
    if (this.targetPrice !== null) {
      this.targetPrice = Math.round((this.targetPrice + points) * 100) / 100;
    } else if (this.currentLtp !== null) {
      this.targetPrice = Math.round((this.currentLtp + points) * 100) / 100;
    }
  }

  setQty(qty: number): void {
    this.orderQuantity = qty;
  }

  submitAlert(): void {
    if (!this.instrumentInput || !this.targetPrice) return;

    this.isSubmitting.set(true);

    const attached = this.executeOrderOnTrigger
      ? {
          enabled: true,
          action: this.orderAction,
          symbol: this.orderSymbol || `${this.instrumentInput} OPT`,
          productType: this.productType,
          orderType: this.orderType,
          quantity: this.orderQuantity,
          isAutoSlStrategy: this.bindAutoSlStrategy,
        }
      : undefined;

    this.alertService
      .createAlert({
        instrument: this.instrumentInput,
        securityId: this.securityId,
        exchangeSegment: this.exchangeSegment,
        targetPrice: Number(this.targetPrice),
        operator: this.operator,
        remarks: this.remarks || `Alert for ${this.instrumentInput} @ ${this.targetPrice}`,
        attachedOrder: attached,
      })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.remarks = '';
        },
        error: () => {
          this.isSubmitting.set(false);
        },
      });
  }
}

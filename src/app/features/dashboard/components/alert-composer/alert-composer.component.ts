import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AlertService } from '../../../../core/api/alert.service';
import { AuthService } from '../../../../core/api/auth.service';
import { InstrumentService } from '../../../../core/api/instrument.service';
import { AlertOperator } from '../../../../core/models/alert.models';
import {
  Instrument,
  OptionExpiryItem,
  StrikeOptionPair,
} from '../../../../core/models/instrument.models';
import { SectionErrorComponent } from '../../../../shared/components/section-error/section-error.component';
import { CurrencyInrPipe } from '../../../../shared/pipes/currency-inr.pipe';
import {
  AlertPreviewData,
  AlertPreviewDialogComponent,
} from './alert-preview-dialog/alert-preview-dialog.component';

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
        message="Cannot fetch real-time market prices or place alerts. Ensure server is online on 127.0.0.1:8000."
        (retry)="retryConnection()"
      ></app-section-error>

      <form (ngSubmit)="submitAlert()" class="composer-form">
        <!-- 1. Instrument Dropdown Selector (Fetched from backend; shows only instrument name) -->
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

        <!-- 3. Conditional Execution Toggle ("Attach Order with Alert") -->
        <div class="action-box" [class.enabled]="executeOrderOnTrigger">
          <div class="action-toggle-row">
            <mat-checkbox [(ngModel)]="executeOrderOnTrigger" name="executeOrderOnTrigger" color="primary">
              <span class="toggle-text">Attach Order with Alert</span>
            </mat-checkbox>
          </div>

          <!-- Inline Order Form when toggle is enabled -->
          <div *ngIf="executeOrderOnTrigger" class="inline-order-form">
            <div class="order-inputs-grid">
              <!-- Action: BUY (Call) / SELL (Put) -->
              <div class="grid-col col-span-2">
                <label class="input-lbl">Action (Directional Option Trigger)</label>
                <mat-button-toggle-group
                  [(ngModel)]="orderAction"
                  name="orderAction"
                  (change)="onActionChange($event.value)"
                  class="action-toggle"
                >
                  <mat-button-toggle value="BUY" class="btn-buy">
                    BUY CALL (Bullish Breakout)
                  </mat-button-toggle>
                  <mat-button-toggle value="SELL" class="btn-sell">
                    BUY PUT (Bearish Breakdown)
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

              <!-- Option Strike Price Selection (Maximum 3 strikes around selected price; shows CALL for BUY, PUT for SELL) -->
              <div class="grid-col col-span-2 strike-selector-box" *ngIf="strikePairs().length > 0">
                <div class="strike-header">
                  <label class="input-lbl">
                    Select Strike Price ({{ orderAction === 'BUY' ? 'CALL contracts' : 'PUT contracts' }} around ₹{{ targetPrice || currentLtp }})
                  </label>
                  <span class="loading-label" *ngIf="isLoadingOptions()">Loading strikes...</span>
                </div>
                <div class="strike-chips">
                  <div
                    *ngFor="let strike of strikePairs()"
                    class="strike-chip"
                    [class.selected]="selectedStrikePrice === strike.strikePrice"
                    (click)="selectStrike(strike.strikePrice)"
                  >
                    <span class="strike-val">{{ strike.strikePrice }} {{ orderAction === 'BUY' ? 'CE' : 'PE' }}</span>
                    <span class="strike-ltp" *ngIf="orderAction === 'BUY'">
                      LTP: {{ strike.call.ltp | currencyInr : false }}
                    </span>
                    <span class="strike-ltp" *ngIf="orderAction === 'SELL'">
                      LTP: {{ strike.put.ltp | currencyInr : false }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Selected Contract Summary Display -->
              <div class="grid-col col-span-2" *ngIf="orderSymbol">
                <div class="selected-contract-banner mono-val">
                  <span class="label">Instant Trigger Order:</span>
                  <span class="symbol-name">BUY {{ orderSymbol }}</span>
                </div>
              </div>

              <!-- Fixed Lot Size Selection (5, 10, 15 Lots) -->
              <div class="grid-col col-span-2 lots-selector-box">
                <div class="lots-header-line">
                  <span class="lots-title">Order Lot Size:</span>
                  <span class="lots-qty-summary mono-val">
                    Total: <strong>{{ totalOrderQuantity() }} Qty</strong> ({{ orderLots }} lots &times; {{ currentContractLotSize() }}/lot &bull; INTRADAY MARKET)
                  </span>
                </div>
                <div class="fixed-lots-group">
                  <button
                    type="button"
                    class="lot-select-btn"
                    [class.active-qty]="orderLots === 5"
                    (click)="setLots(5)"
                  >
                    5 Lots
                  </button>
                  <button
                    type="button"
                    class="lot-select-btn"
                    [class.active-qty]="orderLots === 10"
                    (click)="setLots(10)"
                  >
                    10 Lots
                  </button>
                  <button
                    type="button"
                    class="lot-select-btn"
                    [class.active-qty]="orderLots === 15"
                    (click)="setLots(15)"
                  >
                    15 Lots
                  </button>
                </div>
              </div>
            </div>

            <!-- Stop Loss Configuration Section -->
            <div class="stop-loss-section">
              <div class="sl-header-row">
                <mat-checkbox
                  [checked]="enableStopLoss()"
                  (change)="enableStopLoss.set($event.checked)"
                  name="enableStopLoss"
                  color="accent"
                >
                  <span class="sl-toggle-text">🛡️ Attach Automated Stop Loss Alert Order</span>
                </mat-checkbox>
                <span class="sl-badge" *ngIf="enableStopLoss()">
                  {{ stopLossPoints() }} pts SL ({{ selectedInstrumentSymbol }})
                </span>
              </div>

              <div class="sl-details-box" *ngIf="enableStopLoss()">
                <!-- Defined Stop Loss Index Points Pill -->
                <div class="sl-defined-info-row mono-val">
                  <span class="sl-defined-tag">
                    <span class="material-symbols-rounded tag-icon">rule</span>
                    Defined SL Distance: <strong>{{ stopLossPoints() }} Points</strong> for {{ selectedInstrumentSymbol }}
                  </span>
                </div>

                <!-- Stop Loss Realtime Calculation Card -->
                <div class="sl-preview-banner mono-val" *ngIf="stopLossPrice() !== null">
                  <div class="sl-preview-line">
                    <span class="sl-calc-label">Calculated SL Alert Price:</span>
                    <span class="sl-calc-val">₹{{ stopLossPrice() | currencyInr : false }}</span>
                    <span class="sl-calc-diff">
                      ({{ orderAction === 'BUY' ? '-' : '+' }}{{ stopLossPoints() }} pts from entry ₹{{ targetPrice || currentLtp }})
                    </span>
                  </div>
                  <div class="sl-action-line">
                    <span class="material-symbols-rounded sl-icon">shield</span>
                    <span>
                      Trigger Logic: <strong>{{ orderAction === 'BUY' ? '≤ Drops to/below' : '≥ Rises to/above' }} ₹{{ stopLossPrice() | currencyInr : false }}</strong>
                      &bull; Action: <strong>SELL {{ totalOrderQuantity() }} Qty</strong> of {{ orderSymbol }}
                    </span>
                  </div>
                </div>
              </div>
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
            [disabled]="isSubmitting() || !selectedInstrumentSymbol || !targetPrice || !authService.isBackendOnline()"
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
      .full-width {
        width: 100%;
      }
      .condition-box {
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 10px;
        padding: 12px;
        margin-bottom: 14px;
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
      .inline-order-form {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid var(--border-subtle);
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
      .strike-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
      }
      .loading-label {
        font-size: 0.6875rem;
        color: var(--dhan-cyan);
      }
      .strike-chips {
        display: flex;
        gap: 8px;
      }
      .strike-chip {
        flex: 1;
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 6px;
        padding: 8px 4px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        transition: all 0.15s ease;
      }
      .strike-chip:hover {
        border-color: var(--dhan-cyan);
      }
      .strike-chip.selected {
        border-color: var(--dhan-cyan);
        background: rgba(0, 210, 196, 0.12);
        box-shadow: 0 0 0 1px var(--dhan-cyan);
      }
      .strike-val {
        font-size: 0.875rem;
        font-weight: 700;
        font-family: var(--font-mono);
        color: var(--text-primary);
      }
      .strike-ltp {
        font-size: 0.6875rem;
        font-weight: 600;
        font-family: var(--font-mono);
        color: var(--dhan-cyan);
      }
      .selected-contract-banner {
        background: rgba(99, 102, 241, 0.08);
        border: 1px solid rgba(99, 102, 241, 0.25);
        border-radius: 6px;
        padding: 6px 10px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.75rem;
      }
      .selected-contract-banner .label {
        color: var(--text-muted);
      }
      .selected-contract-banner .symbol-name {
        color: var(--dhan-indigo, #6366f1);
        font-weight: 700;
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
      .lots-header-line {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 6px;
      }
      .lots-title {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .lots-qty-summary {
        font-size: 0.75rem;
        color: var(--dhan-cyan, #00d2c4);
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
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 0.8125rem;
        font-family: var(--font-mono);
        font-weight: 700;
        cursor: pointer;
        transition: all 0.15s ease;
        text-align: center;
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
      .stop-loss-section {
        margin-top: 10px;
        padding: 10px 12px;
        background: rgba(244, 63, 94, 0.05);
        border: 1px solid rgba(244, 63, 94, 0.25);
        border-radius: 8px;
      }
      .sl-header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .sl-toggle-text {
        font-weight: 600;
        font-size: 0.8125rem;
        color: #fca5a5;
      }
      .sl-badge {
        font-size: 0.6875rem;
        font-weight: 700;
        color: #f43f5e;
        background: rgba(244, 63, 94, 0.15);
        padding: 2px 8px;
        border-radius: 4px;
        border: 1px solid rgba(244, 63, 94, 0.3);
      }
      .sl-details-box {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px dashed rgba(244, 63, 94, 0.2);
      }
      .sl-defined-info-row {
        margin-bottom: 8px;
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
      .sl-preview-banner {
        margin-top: 8px;
        padding: 8px 10px;
        background: rgba(15, 23, 42, 0.8);
        border: 1px solid rgba(244, 63, 94, 0.25);
        border-radius: 6px;
        font-size: 0.75rem;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .sl-preview-line {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .sl-calc-label {
        color: var(--text-muted);
      }
      .sl-calc-val {
        color: #f43f5e;
        font-weight: 700;
        font-size: 0.875rem;
      }
      .sl-calc-diff {
        color: #fda4af;
        font-size: 0.6875rem;
      }
      .sl-action-line {
        display: flex;
        align-items: center;
        gap: 6px;
        color: var(--text-secondary);
        font-size: 0.6875rem;
      }
      .sl-icon {
        font-size: 16px;
        color: #f43f5e;
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
  private readonly instrumentService = inject(InstrumentService);
  private readonly dialog = inject(MatDialog);

  readonly isSubmitting = signal<boolean>(false);
  readonly instruments = signal<Instrument[]>([]);
  readonly expiries = signal<OptionExpiryItem[]>([]);
  readonly strikePairs = signal<StrikeOptionPair[]>([]);
  readonly isLoadingOptions = signal<boolean>(false);

  selectedInstrumentSymbol = 'NIFTY 50';
  selectedInstrument: Instrument | null = null;
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
    this._targetPrice.set(val !== null && val !== undefined ? Number(val) : null);
  }

  // Conditional Order Form Fields
  executeOrderOnTrigger = false;
  private readonly _orderAction = signal<'BUY' | 'SELL'>('BUY');
  get orderAction(): 'BUY' | 'SELL' {
    return this._orderAction();
  }
  set orderAction(val: 'BUY' | 'SELL') {
    this._orderAction.set(val);
  }

  selectedExpiry = '';
  selectedStrikePrice: number | null = null;
  orderSymbol = 'NIFTY 24500 CE';
  orderSecurityId = '45021';
  orderExchangeSegment = 'NSE_FNO';
  productType: 'INTRADAY' | 'CNC' | 'MARGIN' = 'INTRADAY';
  orderType: 'MARKET' | 'LIMIT' = 'MARKET';
  orderLots = 5;

  // Automated Stop Loss Form Fields
  enableStopLoss = signal<boolean>(true);
  stopLossPoints = signal<number>(12);

  readonly isBankNifty = computed(() => {
    const sym = (this.selectedInstrumentSymbol || '').toUpperCase();
    return sym.includes('BANK');
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
    this.instrumentService.fetchLotSizes().subscribe();
    this.loadInstruments();
  }

  loadInstruments(): void {
    // 1. Fetch configured tradeable indices dynamically from Firestore
    this.instrumentService.fetchConfiguredIndices().subscribe((indicesList) => {
      let activeIndices: Instrument[] = [];
      if (indicesList && indicesList.length > 0) {
        activeIndices = indicesList;
      } else {
        const cfg = this.instrumentService.lotSizes();
        if (cfg?.indices && cfg.indices.length > 0) {
          activeIndices = cfg.indices
            .filter((i) => i.enabled !== false)
            .map((i) => ({
              symbol: i.symbol,
              name: i.name,
              securityId: i.securityId,
              exchangeSegment: i.exchangeSegment,
              instrumentType: 'INDEX',
              lotSize: i.lotSize,
              ltp: 0,
            }));
        }
      }

      if (activeIndices.length === 0) {
        activeIndices = [
          { symbol: 'NIFTY 50', name: 'Nifty 50 Index', securityId: '13', exchangeSegment: 'IDX_I', instrumentType: 'INDEX', lotSize: 65, ltp: 0 },
          { symbol: 'BANK NIFTY', name: 'Bank Nifty Index', securityId: '25', exchangeSegment: 'IDX_I', instrumentType: 'INDEX', lotSize: 30, ltp: 0 },
          { symbol: 'MIDCAP NIFTY', name: 'Nifty Midcap Select', securityId: '442', exchangeSegment: 'IDX_I', instrumentType: 'INDEX', lotSize: 120, ltp: 0 },
          { symbol: 'SENSEX', name: 'BSE Sensex Index', securityId: '51', exchangeSegment: 'IDX_I', instrumentType: 'INDEX', lotSize: 20, ltp: 0 },
        ];
      }

      this.instruments.set(activeIndices);
      const nifty = activeIndices.find((i) => i.symbol === 'NIFTY 50') || activeIndices[0];
      if (nifty) {
        this.onInstrumentChange(nifty.symbol);
      }
    });
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

  onInstrumentChange(symbol: string): void {
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

    // Resolve configured lots from Firestore config
    const cfg = this.instrumentService.lotSizes();
    const matchedIdx = cfg.indices?.find((i) => i.symbol.toUpperCase() === upper);
    let configuredLots = this.orderLots || 5;
    if (matchedIdx && (matchedIdx.defaultLotSize || matchedIdx.defaultLots)) {
      configuredLots = matchedIdx.defaultLotSize || matchedIdx.defaultLots || configuredLots;
    } else if (upper.includes('BANK') && cfg.bankNiftyLots) {
      configuredLots = cfg.bankNiftyLots;
    } else if ((upper.includes('MIDCAP') || upper.includes('MIDCP')) && cfg.midcapNiftyLots) {
      configuredLots = cfg.midcapNiftyLots;
    } else if (upper.includes('SENSEX') && cfg.sensexLots) {
      configuredLots = cfg.sensexLots;
    } else if (upper.includes('NIFTY') && cfg.nifty50Lots) {
      configuredLots = cfg.nifty50Lots;
    }

    this.orderLots = configuredLots;

    // Set defined Stop Loss points based on instrument
    this.stopLossPoints.set(this.getDefinedSlPoints(symbol));

    // Set initial LTP & target price
    if (found.ltp) {
      this.currentLtp = found.ltp;
      const offset = symbol.includes('BANK')
        ? 100
        : symbol.includes('SENSEX')
        ? 150
        : symbol.includes('MID')
        ? 20
        : 30;
      this.targetPrice = Math.round((found.ltp + offset) * 100) / 100;
    }

    // Fetch live LTP
    this.instrumentService.getLtp(symbol).subscribe((res) => {
      if (res.ltp !== null && res.ltp !== undefined) {
        this.currentLtp = res.ltp;
        const offset = symbol.includes('BANK')
          ? 100
          : symbol.includes('SENSEX')
          ? 150
          : symbol.includes('MID')
          ? 20
          : 30;
        this.targetPrice = Math.round((res.ltp + offset) * 100) / 100;
        this.loadOptionContracts();
      }
    });

    // Fetch expiries from backend for this instrument
    this.loadExpiries(symbol);
  }

  onInstrumentSelected(item: Instrument): void {
    if (!item) return;
    const sym = (item.symbol || '').toUpperCase();
    if (
      sym !== 'NIFTY 50' &&
      !sym.includes('BANK') &&
      !sym.includes('SENSEX') &&
      !sym.includes('MIDCAP') &&
      !sym.includes('MIDCP')
    ) {
      return;
    }
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
  }

  loadExpiries(symbol: string): void {
    this.instrumentService.getExpiries(symbol).subscribe((list) => {
      if (list && list.length > 0) {
        this.expiries.set(list);
        this.selectedExpiry = list[0].expiryDate;
        this.loadOptionContracts();
      }
    });
  }

  onExpiryChange(expiry: string): void {
    this.selectedExpiry = expiry;
    this.loadOptionContracts();
  }

  onTargetPriceChange(): void {
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
      .subscribe((res) => {
        this.isLoadingOptions.set(false);
        if (res && res.currentExpiry && Array.isArray(res.currentExpiry.strikes)) {
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
        }
      });
  }

  selectStrike(strikePrice: number): void {
    this.selectedStrikePrice = strikePrice;
    this.updateSelectedOrderContract();
  }

  updateSelectedOrderContract(): void {
    const pair = this.strikePairs().find((s) => s.strikePrice === this.selectedStrikePrice);
    if (!pair) return;

    // If BUY action -> CALL (CE); If SELL action -> PUT (PE)
    const contract = this.orderAction === 'BUY' ? pair.call : pair.put;
    if (contract) {
      this.orderSymbol = contract.symbol;
      this.orderSecurityId = contract.securityId;
      this.orderExchangeSegment = contract.exchangeSegment;
    }
  }

  isNifty50(): boolean {
    const sym = (this.selectedInstrumentSymbol || '').toUpperCase();
    return sym === 'NIFTY 50' || sym === 'NIFTY';
  }

  currentContractLotSize(): number {
    const pair = this.strikePairs().find((s) => s.strikePrice === this.selectedStrikePrice);
    if (pair) {
      const contract = this.orderAction === 'BUY' ? pair.call : pair.put;
      if (contract && contract.lotSize) {
        return contract.lotSize;
      }
    }
    const sizes = this.instrumentService.lotSizes();
    const sym = (this.selectedInstrumentSymbol || this.selectedInstrument?.symbol || '').toUpperCase();
    if (sym.includes('BANK')) return sizes.bankNifty;
    if (sym.includes('MIDCAP') || sym.includes('MIDCP')) return sizes.midcapNifty;
    if (sym.includes('SENSEX')) return sizes.sensex;
    if (sym.includes('NIFTY')) return sizes.nifty50;
    return this.selectedInstrument?.lotSize || 1;
  }

  totalOrderQuantity(): number {
    const lots = Math.max(1, Number(this.orderLots) || 1);
    return lots * this.currentContractLotSize();
  }

  setLots(lots: number): void {
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

    const secId = this.selectedInstrument?.securityId || '13';
    const exSeg = this.selectedInstrument?.exchangeSegment || 'IDX_I';
    const priceNum = Number(this.targetPrice);
    const totalQty = this.totalOrderQuantity();

    // Operator decided automatically: GREATER_THAN if target >= current LTP, LESS_THAN if target < current LTP
    // Matches Dhan HQ API v2 and Dhan Web/App operator specifications, preventing 'Price undefined' on Dhan
    const operator: AlertOperator =
      this.currentLtp !== null && priceNum < this.currentLtp
        ? 'LESS_THAN'
        : 'GREATER_THAN';

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
    };

    const dialogRef = this.dialog.open(AlertPreviewDialogComponent, {
      data: previewData,
      width: '640px',
      maxWidth: '94vw',
      panelClass: 'alert-preview-dialog-panel',
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.executeCreateAlert(operator);
      }
    });
  }

  private executeCreateAlert(operator: AlertOperator): void {
    this.isSubmitting.set(true);

    const secId = this.selectedInstrument?.securityId || '13';
    const exSeg = this.selectedInstrument?.exchangeSegment || 'IDX_I';
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

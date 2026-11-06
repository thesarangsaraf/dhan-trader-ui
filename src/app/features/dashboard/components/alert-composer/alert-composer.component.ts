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
                    <span class="strike-tag">{{ strike.relativeStrike || 'STRIKE' }}</span>
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

              <!-- Product -->
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

              <!-- Type -->
              <div class="grid-col">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Type</mat-label>
                  <mat-select [(ngModel)]="orderType" name="orderType">
                    <mat-option value="MARKET">MARKET</mat-option>
                    <mat-option value="LIMIT">LIMIT</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              <!-- Quantity: 5, 10, 15 by default for NIFTY 50 -->
              <div class="grid-col qty-col">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Quantity</mat-label>
                  <input matInput type="number" [(ngModel)]="orderQuantity" name="orderQuantity" [step]="isNifty50() ? 5 : selectedLotStep()" />
                </mat-form-field>

                <!-- Quick buttons for NIFTY 50: 5, 10, 15 -->
                <div class="qty-quick-buttons" *ngIf="isNifty50()">
                  <button type="button" [class.active-qty]="orderQuantity === 5" (click)="setQty(5)">5</button>
                  <button type="button" [class.active-qty]="orderQuantity === 10" (click)="setQty(10)">10</button>
                  <button type="button" [class.active-qty]="orderQuantity === 15" (click)="setQty(15)">15</button>
                </div>

                <!-- Quick buttons for Other Instruments -->
                <div class="qty-quick-buttons" *ngIf="!isNifty50()">
                  <button type="button" [class.active-qty]="orderQuantity === selectedLotStep() * 1" (click)="setQty(selectedLotStep() * 1)">
                    1x Lot
                  </button>
                  <button type="button" [class.active-qty]="orderQuantity === selectedLotStep() * 2" (click)="setQty(selectedLotStep() * 2)">
                    2x Lot
                  </button>
                  <button type="button" [class.active-qty]="orderQuantity === selectedLotStep() * 3" (click)="setQty(selectedLotStep() * 3)">
                    3x Lot
                  </button>
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
      .strike-tag {
        font-size: 0.625rem;
        font-weight: 700;
        color: var(--text-muted);
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
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 0.75rem;
        font-family: var(--font-mono);
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .qty-quick-buttons button:hover {
        border-color: var(--dhan-cyan);
        color: var(--dhan-cyan);
      }
      .qty-quick-buttons button.active-qty {
        border-color: var(--dhan-cyan);
        background: rgba(0, 210, 196, 0.15);
        color: var(--dhan-cyan);
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
  currentLtp: number | null = null;
  targetPrice: number | null = null;

  // Conditional Order Form Fields
  executeOrderOnTrigger = false;
  orderAction: 'BUY' | 'SELL' = 'BUY';
  selectedExpiry = '';
  selectedStrikePrice: number | null = null;
  orderSymbol = 'NIFTY 24500 CE';
  orderSecurityId = '45021';
  orderExchangeSegment = 'NSE_FNO';
  productType: 'INTRADAY' | 'CNC' | 'MARGIN' = 'INTRADAY';
  orderType: 'MARKET' | 'LIMIT' = 'MARKET';
  orderQuantity = 5;

  ngOnInit(): void {
    this.loadInstruments();
  }

  retryConnection(): void {
    this.authService.refreshStatus();
    this.loadInstruments();
  }

  loadInstruments(): void {
    this.instrumentService.getInstruments(50).subscribe((list) => {
      if (list && list.length > 0) {
        this.instruments.set(list);
        const nifty = list.find((i) => i.symbol === 'NIFTY 50') || list[0];
        this.onInstrumentChange(nifty.symbol);
      } else {
        const fallback: Instrument[] = [
          { symbol: 'NIFTY 50', name: 'Nifty 50 Index', securityId: '13', exchangeSegment: 'IDX_I', instrumentType: 'INDEX', lotSize: 50, ltp: 24500 },
          { symbol: 'BANK NIFTY', name: 'Bank Nifty Index', securityId: '25', exchangeSegment: 'IDX_I', instrumentType: 'INDEX', lotSize: 30, ltp: 52000 },
          { symbol: 'SENSEX', name: 'BSE Sensex Index', securityId: '51', exchangeSegment: 'IDX_I', instrumentType: 'INDEX', lotSize: 20, ltp: 80000 },
          { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', securityId: '2885', exchangeSegment: 'NSE_EQ', instrumentType: 'EQUITY', lotSize: 1, ltp: 2500 },
        ];
        this.instruments.set(fallback);
        this.onInstrumentChange('NIFTY 50');
      }
    });
  }

  onInstrumentChange(symbol: string): void {
    this.selectedInstrumentSymbol = symbol;
    const found = this.instruments().find((i) => i.symbol === symbol);
    if (!found) return;

    this.selectedInstrument = found;

    // Set default quantity: 5 for Nifty 50; lotSize for other instruments
    if (this.isNifty50()) {
      this.orderQuantity = 5;
    } else {
      this.orderQuantity = found.lotSize || 25;
    }

    // Set initial LTP & target price
    if (found.ltp) {
      this.currentLtp = found.ltp;
      const offset = symbol.includes('BANK') ? 100 : symbol.includes('SENSEX') ? 150 : 30;
      this.targetPrice = Math.round((found.ltp + offset) * 100) / 100;
    }

    // Fetch live LTP
    this.instrumentService.getLtp(symbol).subscribe((res) => {
      if (res.ltp !== null && res.ltp !== undefined) {
        this.currentLtp = res.ltp;
        const offset = symbol.includes('BANK') ? 100 : symbol.includes('SENSEX') ? 150 : 30;
        this.targetPrice = Math.round((res.ltp + offset) * 100) / 100;
        this.loadOptionContracts();
      }
    });

    // Fetch expiries from backend for this instrument
    this.loadExpiries(symbol);
  }

  onInstrumentSelected(item: Instrument): void {
    if (!item) return;
    const exists = this.instruments().some((i) => i.symbol.toUpperCase() === item.symbol.toUpperCase());
    if (!exists) {
      this.instruments.set([item, ...this.instruments()]);
    }
    this.onInstrumentChange(item.symbol);
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

  selectedLotStep(): number {
    return this.selectedInstrument?.lotSize || 25;
  }

  setQty(qty: number): void {
    this.orderQuantity = qty;
  }

  submitAlert(): void {
    if (!this.selectedInstrumentSymbol || !this.targetPrice) return;

    const secId = this.selectedInstrument?.securityId || '13';
    const exSeg = this.selectedInstrument?.exchangeSegment || 'IDX_I';
    const priceNum = Number(this.targetPrice);

    // Operator decided automatically: GREATER_THAN_EQUAL if target >= current LTP, LESS_THAN_EQUAL if target < current LTP
    const operator: AlertOperator =
      this.currentLtp !== null && priceNum < this.currentLtp
        ? 'LESS_THAN_EQUAL'
        : 'GREATER_THAN_EQUAL';

    // 30 days default expiry date in YYYY-MM-DD
    const expDate = (() => {
      const d = new Date(Date.now() + 30 * 86400000);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();

    const clientId =
      this.authService.tokenStatus()?.clientId ||
      this.authService.tokenStatus()?.payload?.clientId ||
      'YOUR_CLIENT_ID';

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
              quantity: Number(this.orderQuantity),
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
            quantity: Number(this.orderQuantity),
            price: 0,
            strike: this.selectedStrikePrice || undefined,
            optionType: this.orderAction === 'BUY' ? 'CALL (CE)' : 'PUT (PE)',
            lotSize: this.selectedLotStep(),
          }
        : undefined,
      dhanPayload,
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

    const conditionalOrder = this.executeOrderOnTrigger
      ? {
          symbol: this.orderSymbol,
          securityId: this.orderSecurityId,
          exchangeSegment: this.orderExchangeSegment || 'NSE_FNO',
          transactionType: 'BUY' as const,
          orderType: this.orderType,
          productType: this.productType,
          quantity: this.orderQuantity,
          price: 0,
          validity: 'DAY',
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
        attachedOrder: conditionalOrder
          ? {
              enabled: true,
              action: 'BUY',
              symbol: this.orderSymbol,
              securityId: this.orderSecurityId,
              exchangeSegment: this.orderExchangeSegment,
              productType: this.productType,
              orderType: this.orderType,
              quantity: this.orderQuantity,
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

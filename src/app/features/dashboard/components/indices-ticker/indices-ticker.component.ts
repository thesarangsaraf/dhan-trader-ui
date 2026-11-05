import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AlertService } from '../../../../core/api/alert.service';
import { PopularIndex } from '../../../../core/models/alert.models';
import { SectionErrorComponent } from '../../../../shared/components/section-error/section-error.component';
import { CurrencyInrPipe } from '../../../../shared/pipes/currency-inr.pipe';

@Component({
  selector: 'app-indices-ticker',
  standalone: true,
  imports: [CommonModule, MatChipsModule, MatIconModule, MatTooltipModule, SectionErrorComponent, CurrencyInrPipe],
  template: `
    <div class="indices-ticker-container">
      <div class="ticker-header">
        <span class="label">NSE Benchmark Indices</span>
        <button class="refresh-btn" (click)="alertService.refreshIndices()" matTooltip="Refresh Index LTPs">
          <span class="material-symbols-rounded">sync</span>
        </button>
      </div>

      <!-- Error State -->
      <app-section-error
        *ngIf="alertService.indicesError() as err"
        title="Failed to Load Indices"
        [message]="err"
        (retry)="alertService.refreshIndices()"
      ></app-section-error>

      <!-- Loading State -->
      <div *ngIf="alertService.isLoadingIndices() && alertService.indices().length === 0 && !alertService.indicesError()" class="loading-state">
        <span class="material-symbols-rounded spin-icon">sync</span>
        <span>Fetching live indices from Dhan...</span>
      </div>

      <!-- Real Data Chips -->
      <div class="chips-scroll-wrapper" *ngIf="!alertService.indicesError() && alertService.indices().length > 0">
        <div
          *ngFor="let idx of alertService.indices()"
          class="index-chip"
          [class.selected]="selectedName === idx.name"
          (click)="onSelectIndex(idx)"
          matTooltip="Click to compose alert or bracket order for {{ idx.name }}"
        >
          <div class="index-meta">
            <span class="index-name">{{ idx.name }}</span>
            <span class="exchange-tag">{{ idx.exchangeSegment }}</span>
          </div>

          <div class="index-price mono-val">
            {{ idx.currentPrice !== null && idx.currentPrice !== undefined ? (idx.currentPrice | currencyInr : false) : '--' }}
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .indices-ticker-container {
        padding: 10px 14px;
        background: var(--bg-surface);
        border-radius: 12px;
        border: 1px solid var(--border-subtle);
      }
      .ticker-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      .label {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-muted);
      }
      .refresh-btn {
        background: transparent;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        display: flex;
        align-items: center;
        padding: 2px;
      }
      .refresh-btn:hover {
        color: var(--dhan-cyan);
      }
      .refresh-btn span {
        font-size: 16px;
      }
      .loading-state {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 16px;
        font-size: 0.75rem;
        color: var(--text-muted);
      }
      .spin-icon {
        animation: spin 1s linear infinite;
        font-size: 16px;
      }
      @keyframes spin {
        100% { transform: rotate(360deg); }
      }
      .chips-scroll-wrapper {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding-bottom: 4px;
      }
      .chips-scroll-wrapper::-webkit-scrollbar {
        height: 4px;
      }
      .index-chip {
        flex: 0 0 auto;
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 6px 12px;
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .index-chip:hover {
        border-color: var(--dhan-cyan);
        transform: translateY(-1px);
      }
      .index-chip.selected {
        border-color: var(--dhan-cyan);
        background: rgba(0, 210, 196, 0.08);
      }
      .index-meta {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .index-name {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--text-primary);
      }
      .exchange-tag {
        font-size: 0.625rem;
        color: var(--text-muted);
        background: rgba(255, 255, 255, 0.06);
        padding: 1px 4px;
        border-radius: 3px;
      }
      .index-price {
        font-size: 0.875rem;
        font-weight: 700;
        color: var(--dhan-cyan);
      }
    `,
  ],
})
export class IndicesTickerComponent {
  readonly alertService = inject(AlertService);
  selectedName: string | null = 'NIFTY 50';

  @Output() readonly indexSelected = new EventEmitter<PopularIndex>();

  onSelectIndex(idx: PopularIndex): void {
    this.selectedName = idx.name;
    this.indexSelected.emit(idx);
  }
}

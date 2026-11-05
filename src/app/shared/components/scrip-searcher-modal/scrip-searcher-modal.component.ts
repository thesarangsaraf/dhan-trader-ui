import { Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { InstrumentService } from '../../../core/api/instrument.service';
import { Instrument } from '../../../core/models/instrument.models';
import { CurrencyInrPipe } from '../../pipes/currency-inr.pipe';

@Component({
  selector: 'app-scrip-searcher-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatInputModule, CurrencyInrPipe],
  template: `
    <div class="searcher-dialog">
      <div class="search-input-wrapper">
        <span class="material-symbols-rounded search-icon">search</span>
        <input
          #searchInput
          class="spotlight-input"
          type="text"
          placeholder="Search indices, F&O strikes, equities (e.g. NIFTY, 24600 CE, RELIANCE)..."
          [(ngModel)]="searchTerm"
          (input)="onSearchChange()"
          (keydown)="handleKeyDown($event)"
          autofocus
        />
        <div class="kbd-badge">ESC to close</div>
      </div>

      <div class="results-container">
        <div *ngIf="isLoading()" class="loading-state">
          Searching scrip master...
        </div>

        <div *ngIf="!isLoading() && results().length === 0" class="empty-state">
          No matching instruments found for "{{ searchTerm }}".
        </div>

        <div
          *ngFor="let item of results(); let i = index"
          class="result-row"
          [class.selected]="i === selectedIndex()"
          (click)="selectInstrument(item)"
          (mouseenter)="selectedIndex.set(i)"
        >
          <div class="col-symbol">
            <span class="symbol-name">{{ item.symbol }}</span>
            <span class="full-name">{{ item.name }}</span>
          </div>

          <div class="col-tags">
            <span class="tag-chip segment">{{ item.exchangeSegment }}</span>
            <span class="tag-chip type">{{ item.instrumentType }}</span>
          </div>

          <div class="col-price mono-val">
            {{ item.ltp | currencyInr : false }}
          </div>

          <button class="action-btn" (click)="$event.stopPropagation(); selectInstrument(item)">
            Select
          </button>
        </div>
      </div>

      <div class="searcher-footer">
        <span class="hint">Use <kbd>↑</kbd> <kbd>↓</kbd> to navigate, <kbd>Enter</kbd> to select</span>
        <span class="tag">Zero Static IP Master</span>
      </div>
    </div>
  `,
  styles: [
    `
      .searcher-dialog {
        padding: 0;
        min-width: 540px;
        max-width: 640px;
        overflow: hidden;
      }
      .search-input-wrapper {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 20px;
        border-bottom: 1px solid var(--border-medium);
        background: var(--bg-surface);
      }
      .search-icon {
        font-size: 24px;
        color: var(--dhan-cyan);
      }
      .spotlight-input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        font-size: 1.0625rem;
        color: var(--text-primary);
        font-family: var(--font-sans);
      }
      .kbd-badge {
        font-size: 0.75rem;
        padding: 2px 8px;
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        border-radius: 6px;
        color: var(--text-muted);
      }
      .results-container {
        max-height: 380px;
        overflow-y: auto;
        padding: 8px 0;
      }
      .loading-state,
      .empty-state {
        padding: 28px 20px;
        text-align: center;
        color: var(--text-muted);
        font-size: 0.875rem;
      }
      .result-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 20px;
        cursor: pointer;
        transition: background-color 0.15s ease;
      }
      .result-row.selected,
      .result-row:hover {
        background-color: var(--bg-card-hover);
      }
      .col-symbol {
        display: flex;
        flex-direction: column;
        flex: 1;
      }
      .symbol-name {
        font-weight: 600;
        font-size: 0.9375rem;
        color: var(--text-primary);
      }
      .full-name {
        font-size: 0.75rem;
        color: var(--text-muted);
      }
      .col-tags {
        display: flex;
        gap: 6px;
        margin: 0 16px;
      }
      .tag-chip {
        font-size: 0.6875rem;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.06);
        color: var(--text-secondary);
      }
      .col-price {
        font-size: 0.9375rem;
        font-weight: 600;
        color: var(--dhan-cyan);
        margin-right: 14px;
      }
      .action-btn {
        padding: 4px 10px;
        border-radius: 6px;
        border: 1px solid var(--border-medium);
        background: var(--bg-surface);
        color: var(--text-primary);
        font-size: 0.75rem;
        cursor: pointer;
      }
      .result-row.selected .action-btn {
        background: var(--dhan-cyan);
        color: #0B0F19;
        font-weight: 600;
        border-color: var(--dhan-cyan);
      }
      .searcher-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 20px;
        background: var(--bg-surface);
        border-top: 1px solid var(--border-subtle);
        font-size: 0.75rem;
        color: var(--text-muted);
      }
      kbd {
        background: var(--bg-card);
        padding: 1px 4px;
        border-radius: 3px;
        border: 1px solid var(--border-subtle);
      }
    `,
  ],
})
export class ScripSearcherModalComponent implements OnInit {
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  readonly dialogRef = inject(MatDialogRef<ScripSearcherModalComponent>);
  private readonly instrumentService = inject(InstrumentService);

  searchTerm = '';
  readonly results = signal<Instrument[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly selectedIndex = signal<number>(0);

  ngOnInit(): void {
    this.executeSearch('');
  }

  onSearchChange(): void {
    this.selectedIndex.set(0);
    this.executeSearch(this.searchTerm);
  }

  private executeSearch(term: string): void {
    this.isLoading.set(true);
    this.instrumentService.search(term, 15).subscribe((data) => {
      this.isLoading.set(false);
      this.results.set(data);
    });
  }

  handleKeyDown(event: KeyboardEvent): void {
    const list = this.results();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectedIndex.update((i) => (i + 1 < list.length ? i + 1 : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectedIndex.update((i) => (i - 1 >= 0 ? i - 1 : list.length - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const current = list[this.selectedIndex()];
      if (current) this.selectInstrument(current);
    }
  }

  selectInstrument(item: Instrument): void {
    this.dialogRef.close(item);
  }
}

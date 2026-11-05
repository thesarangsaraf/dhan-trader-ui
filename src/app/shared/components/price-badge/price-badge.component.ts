import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CurrencyInrPipe } from '../../pipes/currency-inr.pipe';

@Component({
  selector: 'app-price-badge',
  standalone: true,
  imports: [CommonModule, CurrencyInrPipe],
  template: `
    <span
      class="price-badge mono-val"
      [class.profit]="isProfit()"
      [class.loss]="isLoss()"
      [class.neutral]="isNeutral()"
      [class.pulse-profit]="isProfit() && pulse()"
      [class.pulse-loss]="isLoss() && pulse()"
      [class.large]="size() === 'large'"
      [class.compact]="size() === 'compact'"
    >
      <span class="sign" *ngIf="showSign() && value() !== 0">
        {{ value() > 0 ? '+' : '' }}
      </span>
      {{ isCurrency() ? (value() | currencyInr : false) : (value() | number : '1.2-2') }}
      <span class="percent" *ngIf="percent() !== undefined && percent() !== null">
        ({{ percent()! > 0 ? '+' : '' }}{{ percent() | number : '1.2-2' }}%)
      </span>
    </span>
  `,
  styles: [
    `
      .price-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 8px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 0.8125rem;
        letter-spacing: -0.01em;
        line-height: 1.2;
        transition: all 0.2s ease;
      }

      .price-badge.large {
        font-size: 1.125rem;
        padding: 6px 12px;
        border-radius: 8px;
      }

      .price-badge.compact {
        font-size: 0.75rem;
        padding: 2px 6px;
        border-radius: 4px;
      }

      .profit {
        color: var(--color-profit);
        background-color: var(--color-profit-bg);
        border: 1px solid rgba(16, 185, 129, 0.25);
      }

      .loss {
        color: var(--color-loss);
        background-color: var(--color-loss-bg);
        border: 1px solid rgba(244, 63, 94, 0.25);
      }

      .neutral {
        color: var(--text-secondary);
        background-color: var(--border-subtle);
        border: 1px solid var(--border-subtle);
      }

      .percent {
        font-size: 0.85em;
        opacity: 0.9;
      }
    `,
  ],
})
export class PriceBadgeComponent {
  value = input<number>(0);
  percent = input<number | undefined>(undefined);
  isCurrency = input<boolean>(true);
  showSign = input<boolean>(true);
  pulse = input<boolean>(false);
  size = input<'normal' | 'large' | 'compact'>('normal');

  isProfit = computed(() => this.value() > 0);
  isLoss = computed(() => this.value() < 0);
  isNeutral = computed(() => this.value() === 0);
}

import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'currencyInr',
  standalone: true,
})
export class CurrencyInrPipe implements PipeTransform {
  private readonly formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  transform(value: number | string | null | undefined, showSign = false): string {
    if (value === null || value === undefined || value === '') {
      return '₹0.00';
    }

    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) {
      return '₹0.00';
    }

    const formatted = this.formatter.format(Math.abs(num));
    if (num < 0) {
      return `-${formatted}`;
    }
    if (showSign && num > 0) {
      return `+${formatted}`;
    }
    return formatted;
  }
}

import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'istDate',
  standalone: true,
})
export class IstDatePipe implements PipeTransform {
  private readonly formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  private readonly timeOnlyFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  transform(value: string | number | Date | null | undefined, mode: 'full' | 'timeOnly' = 'full'): string {
    if (!value) return 'N/A';
    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) return 'N/A';
      if (mode === 'timeOnly') {
        return `${this.timeOnlyFormatter.format(date)} IST`;
      }
      return `${this.formatter.format(date)} IST`;
    } catch {
      return 'N/A';
    }
  }
}

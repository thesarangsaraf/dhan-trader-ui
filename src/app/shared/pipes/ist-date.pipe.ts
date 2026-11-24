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

  transform(
    value: string | number | Date | null | undefined,
    mode: 'full' | 'timeOnly' = 'full',
    includeTz: boolean = true,
  ): string {
    if (!value) return 'N/A';
    try {
      let strVal = String(value).trim();
      if (!strVal || strVal === 'null' || strVal === 'undefined') return 'N/A';

      // Check if it's already a time-only string like "10:15:30" or "10:15"
      if (/^\d{2}:\d{2}(:\d{2})?$/.test(strVal)) {
        return includeTz ? `${strVal} IST` : strVal;
      }

      // If it contains space between date and time (e.g. "2026-11-07 10:15:30"), normalize to ISO
      if (strVal.includes(' ') && strVal.includes('-')) {
        strVal = strVal.replace(' ', 'T');
      }

      const date = new Date(strVal);
      if (isNaN(date.getTime())) return 'N/A';
      const formatted = mode === 'timeOnly'
        ? this.timeOnlyFormatter.format(date)
        : this.formatter.format(date);

      return includeTz ? `${formatted} IST` : formatted;
    } catch {
      return 'N/A';
    }
  }
}

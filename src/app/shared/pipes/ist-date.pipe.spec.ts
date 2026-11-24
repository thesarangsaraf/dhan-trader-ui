import { IstDatePipe } from './ist-date.pipe';

describe('IstDatePipe', () => {
  const pipe = new IstDatePipe();

  it('formats ISO date to IST', () => {
    const iso = '2026-11-05T10:00:00.000Z';
    const result = pipe.transform(iso);
    expect(result).toContain('IST');
    expect(result).toContain('2026');
  });

  it('formats ISO date without IST when includeTz is false', () => {
    const iso = '2026-11-05T10:00:00.000Z';
    const result = pipe.transform(iso, 'full', false);
    expect(result).not.toContain('IST');
    expect(result).toContain('2026');
  });

  it('formats time-only strings without IST when includeTz is false', () => {
    const result = pipe.transform('10:15:30', 'timeOnly', false);
    expect(result).toBe('10:15:30');
  });

  it('returns N/A on invalid date', () => {
    expect(pipe.transform('invalid')).toBe('N/A');
    expect(pipe.transform(null)).toBe('N/A');
  });
});

import { IstDatePipe } from './ist-date.pipe';

describe('IstDatePipe', () => {
  const pipe = new IstDatePipe();

  it('formats ISO date to IST', () => {
    const iso = '2026-11-05T10:00:00.000Z';
    const result = pipe.transform(iso);
    expect(result).toContain('IST');
    expect(result).toContain('2026');
  });

  it('returns N/A on invalid date', () => {
    expect(pipe.transform('invalid')).toBe('N/A');
    expect(pipe.transform(null)).toBe('N/A');
  });
});

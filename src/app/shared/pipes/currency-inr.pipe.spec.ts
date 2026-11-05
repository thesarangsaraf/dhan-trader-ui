import { CurrencyInrPipe } from './currency-inr.pipe';

describe('CurrencyInrPipe', () => {
  const pipe = new CurrencyInrPipe();

  it('transforms standard positive number', () => {
    expect(pipe.transform(24500.5)).toContain('24,500.50');
  });

  it('transforms negative number with minus sign', () => {
    const res = pipe.transform(-1250);
    expect(res).toContain('-₹');
    expect(res).toContain('1,250.00');
  });

  it('handles null and undefined', () => {
    expect(pipe.transform(null)).toBe('₹0.00');
    expect(pipe.transform(undefined)).toBe('₹0.00');
  });

  it('shows sign when requested', () => {
    expect(pipe.transform(500, true)).toContain('+');
  });
});

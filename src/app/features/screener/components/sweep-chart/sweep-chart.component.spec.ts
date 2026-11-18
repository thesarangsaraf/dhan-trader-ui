import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SweepChartComponent } from './sweep-chart.component';
import { LiquiditySweepSignal } from '../../../../core/models/screener.models';

describe('SweepChartComponent', () => {
  let fixture: ComponentFixture<SweepChartComponent>;
  let component: SweepChartComponent;

  const sampleSignal: LiquiditySweepSignal = {
    id: 'NIFTY_50_1763440500_BUY',
    symbol: 'NIFTY 50',
    name: 'Nifty 50 Index',
    signalType: 'BUY',
    levelType: 'PDL',
    levelPrice: 24500.5,
    sweepPrice: 24482.25,
    sweepTimestamp: 1763440200,
    confirmationClosePrice: 24525.75,
    confirmationTimestamp: 1763440500,
    sessionDate: '2026-11-18',
    timeframe: '5m',
    candles: [
      { time: 1763439900, open: 24540, high: 24555, low: 24515, close: 24520, volume: 100 },
      { time: 1763440200, open: 24520, high: 24525, low: 24482.25, close: 24495, volume: 220 },
      { time: 1763440500, open: 24495, high: 24530, low: 24492, close: 24525.75, volume: 310 },
    ],
  };

  it('should render chart container, level label, sweep price, confirmation price, and destroy cleanly', async () => {
    await TestBed.configureTestingModule({
      imports: [SweepChartComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SweepChartComponent);
    component = fixture.componentInstance;
    component.signal = sampleSignal;
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(component).toBeTruthy();
    expect(component.levelAxisLabel).toBe('PDL: 24500.50');
    expect(el.querySelector('.lw-chart-container')).not.toBeNull();
    expect(el.textContent).toContain('PDL: 24500.50');
    expect(el.textContent).toContain('24,482.25');
    expect(el.textContent).toContain('BUY Close: 24,525.75');
    expect(el.textContent).toContain('Zoom Signal');
    expect(el.textContent).toContain('Full Day');
    expect(el.querySelectorAll('.chart-ctrl-btn').length).toBe(4);

    // Verify destroy does not throw
    expect(() => fixture.destroy()).not.toThrow();
  });
});

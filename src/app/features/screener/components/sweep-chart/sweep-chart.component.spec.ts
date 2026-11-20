import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { SweepChartComponent } from './sweep-chart.component';
import { LiquiditySweepSignal, LiquiditySweepSymbolResult } from '../../../../core/models/screener.models';

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

  const sampleResult: LiquiditySweepSymbolResult = {
    symbol: 'BANKNIFTY',
    name: 'Nifty Bank Index',
    displayName: 'BANK NIFTY',
    timeframe: '15m',
    currentPrice: 52400,
    candles: [
      { time: 1763439900, open: 52300, high: 52450, low: 52280, close: 52400, volume: 500 },
      { time: 1763440800, open: 52400, high: 52550, low: 52380, close: 52420, volume: 600 },
    ],
    activePools: [
      {
        id: 'BSL-1',
        side: 'BSL',
        poolType: 'EQH',
        price: 52500,
        startTime: 1763439900,
        touchCount: 2,
      },
      {
        id: 'SSL-1',
        side: 'SSL',
        poolType: 'SWING',
        price: 52200,
        startTime: 1763439900,
        touchCount: 1,
      },
    ],
    recentSweeps: [
      {
        poolId: 'BSL-1',
        direction: 'BEARISH',
        poolType: 'EQH',
        sweptPrice: 52500,
        sweepWickExtreme: 52550,
        sweepTime: 1763440800,
        reclaimTime: 1763440800,
      },
    ],
    signal: {
      action: 'SELL',
      entryMode: 'RECLAIM_CLOSE',
      entryPrice: 52420,
      stopLoss: 52570,
      takeProfit: 52200,
      rrRatio: 2.8,
      targetPoolPrice: 52200,
    },
    chartOverlay: {
      pools: [],
      sweeps: [
        {
          direction: 'BEARISH',
          poolType: 'EQH',
          sweptPrice: 52500,
          sweepWickExtreme: 52550,
          sweepTime: 1763440800,
          reclaimTime: 1763440800,
        },
      ],
      liquidityLines: [
        {
          poolId: 'BSL-1',
          side: 'BSL',
          poolType: 'EQH',
          price: 52500,
          startTime: 1763439900,
          endTime: 1763440800,
          style: 'DASHED',
          color: '#f43f5e',
          title: 'BSL (EQH): 52500.00',
        },
      ],
      sweepMarkers: [
        {
          time: 1763440800,
          position: 'aboveBar',
          color: '#f43f5e',
          shape: 'arrowDown',
          text: 'Sweep ▼ EQH',
        },
      ],
      tradeLines: {
        entry: 52420,
        stopLoss: 52570,
        takeProfit: 52200,
      },
      signal: {
        action: 'SELL',
        entryPrice: 52420,
        stopLoss: 52570,
        takeProfit: 52200,
        rrRatio: 2.8,
        targetPoolPrice: 52200,
      },
    },
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

  it('should render standalone LiquiditySweepSymbolResult with pools, sweep markers, and trade levels', async () => {
    await TestBed.configureTestingModule({
      imports: [SweepChartComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SweepChartComponent);
    component = fixture.componentInstance;
    component.result = sampleResult;
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(component).toBeTruthy();
    expect(component.poolsCount).toBe(2);
    expect(component.isResultMode).toBe(true);
    expect(el.querySelector('.lw-chart-container')).not.toBeNull();
    expect(el.textContent).toContain('2 Pools');
    expect(el.textContent).toContain('Sweep: EQH @ 52,500.00');
    expect(el.textContent).toContain('SELL (1:2.8 R:R)');
    expect(el.textContent).toContain('Entry: 52,420.00');
    expect(el.textContent).toContain('SL: 52,570.00');
    expect(el.textContent).toContain('TP: 52,200.00');

    // Verify destroy does not throw
    expect(() => fixture.destroy()).not.toThrow();
  });
});

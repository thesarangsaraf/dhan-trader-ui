import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { OrderBlockChartComponent } from './order-block-chart.component';
import { OrderBlockSymbolResult } from '../../../../core/models/screener.models';

describe('OrderBlockChartComponent', () => {
  let fixture: ComponentFixture<OrderBlockChartComponent>;
  let component: OrderBlockChartComponent;

  const sampleResult: OrderBlockSymbolResult = {
    symbol: 'NIFTY',
    displayName: 'Nifty 50',
    name: 'Nifty 50',
    timeframe: '1h + 5m',
    trendBias: 'BULLISH',
    activeOrderBlocks: [
      {
        id: 'OB_1',
        type: 'BULLISH',
        obType: 'EXTREME',
        candleIndex: 1,
        createdAt: 1763440000,
        zoneHigh: 24550.0,
        zoneLow: 24480.0,
        equilibrium: 24515.0,
        bosPrice: 24650.0,
        structureBreakType: 'BOS',
        structureBreakTime: 1763443600,
        mitigated: false,
        invalidated: false,
        status: 'MITIGATING',
        fvgBounds: {
          top: 24580,
          bottom: 24550,
          candleIndex: 2,
          time: 1763443600,
        },
      },
    ],
    candles: [
      { time: 1763436400, open: 24480, high: 24510, low: 24460, close: 24500, volume: 500 },
      { time: 1763440000, open: 24500, high: 24550, low: 24480, close: 24530, volume: 1000 },
      { time: 1763443600, open: 24530, high: 24660, low: 24520, close: 24650, volume: 2000 },
    ],
    chartOverlay: {
      orderBlocks: [
        {
          id: 'OB_1',
          type: 'BULLISH',
          obType: 'EXTREME',
          zoneHigh: 24550.0,
          zoneLow: 24480.0,
          equilibrium: 24515.0,
          startTime: 1763440000,
          endTime: 1763443600,
          color: '#10B981',
          status: 'MITIGATING',
        },
      ],
      fvgs: [
        {
          top: 24580,
          bottom: 24550,
          startTime: 1763443600,
          endTime: 1763443600,
          type: 'BULLISH',
        },
      ],
      breaks: [
        {
          type: 'BOS',
          price: 24650,
          startTime: 1763440000,
          endTime: 1763443600,
          direction: 'BULLISH',
          label: 'BoS (+)',
        },
      ],
      tradeSignal: {
        entryPrice: 24550,
        stopLoss: 24470,
        takeProfit: 24790,
        rrRatio: 3.0,
        signalType: 'BUY',
      },
    },
    proximityStatus: 'MITIGATING',
    tradeSignal: {
      id: 'NIFTY_SIG_1',
      symbol: 'NIFTY',
      displayName: 'Nifty 50',
      signalType: 'BUY',
      confirmationType: 'LTF_CHOCH',
      entryPrice: 24550,
      stopLoss: 24470,
      takeProfit: 24790,
      rrRatio: 3.0,
      htfTimeframe: '1h',
      ltfTimeframe: '5m',
      triggerTimestamp: 1763443600,
      triggerPrice: 24550,
      sessionDate: '2026-11-18',
    },
  };

  it('should render chart container, OB legend chips, trade signal chip, and destroy cleanly', async () => {
    await TestBed.configureTestingModule({
      imports: [OrderBlockChartComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(OrderBlockChartComponent);
    component = fixture.componentInstance;
    component.result = sampleResult;
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(component).toBeTruthy();
    expect(component.primaryOB).toBeTruthy();
    expect(component.primaryOB?.zoneHigh).toBe(24550.0);
    expect(component.primaryOB?.equilibrium).toBe(24515.0);

    expect(el.querySelector('.lw-chart-container')).not.toBeNull();
    expect(el.textContent).toContain('Demand OB (EXTREME)');
    expect(el.textContent).toContain('24,480.00 – 24,550.00');
    expect(el.textContent).toContain('50% EQ: 24,515.00');
    expect(el.textContent).toContain('BUY (1:3.0 R:R)');
    expect(el.textContent).toContain('Entry: 24,550.00');
    expect(el.textContent).toContain('SL: 24,470.00');
    expect(el.textContent).toContain('TP: 24,790.00');
    expect(el.textContent).toContain('Zoom OB');
    expect(el.textContent).toContain('Fit All');
    expect(el.querySelectorAll('.chart-ctrl-btn').length).toBe(4);

    expect(() => fixture.destroy()).not.toThrow();
  });
});

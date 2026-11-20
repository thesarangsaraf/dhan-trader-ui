import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScreenerComponent } from './screener.component';
import { ScreenerService } from '../../core/api/screener.service';
import {
  LiquiditySweepSignal,
  ScreenerInstrumentItem,
  ScreenerScanMode,
} from '../../core/models/screener.models';

describe('ScreenerComponent', () => {
  let component: ScreenerComponent;
  let fixture: ComponentFixture<ScreenerComponent>;
  let router: Router;

  const mockInstruments = signal<ScreenerInstrumentItem[]>([
    { symbol: 'NIFTY', displayName: 'Nifty 50', name: 'Nifty 50', securityId: '13' },
    { symbol: 'BANKNIFTY', displayName: 'Nifty Bank', name: 'Nifty Bank', securityId: '25' },
    { symbol: 'MIDCPNIFTY', displayName: 'Nifty Midcap Select', name: 'Nifty Midcap Select', securityId: '442' },
    { symbol: 'SENSEX', displayName: 'Sensex', name: 'Sensex', securityId: '51' },
  ]);

  const mockRecommendations = signal<LiquiditySweepSignal[]>([
    {
      id: 'NIFTY_1763440500_BUY',
      symbol: 'NIFTY',
      displayName: 'Nifty 50',
      name: 'Nifty 50',
      signalType: 'BUY',
      levelType: 'PDL',
      levelPrice: 24500,
      sweepPrice: 24482,
      sweepTimestamp: 1763440200,
      confirmationClosePrice: 24525,
      confirmationTimestamp: 1763440500,
      sessionDate: '2026-11-18',
      timeframe: '5m',
      candles: [
        { time: 1763440200, open: 24520, high: 24525, low: 24482, close: 24495, volume: 100 },
        { time: 1763440500, open: 24495, high: 24530, low: 24492, close: 24525, volume: 200 },
      ],
    },
    {
      id: 'BANKNIFTY_1763443200_SELL',
      symbol: 'BANKNIFTY',
      displayName: 'Nifty Bank',
      name: 'Nifty Bank',
      signalType: 'SELL',
      levelType: 'PDH',
      levelPrice: 52500,
      sweepPrice: 52545,
      sweepTimestamp: 1763442900,
      confirmationClosePrice: 52465,
      confirmationTimestamp: 1763443200,
      sessionDate: '2026-11-18',
      timeframe: '5m',
      candles: [
        { time: 1763442900, open: 52480, high: 52545, low: 52470, close: 52515, volume: 150 },
        { time: 1763443200, open: 52515, high: 52520, low: 52450, close: 52465, volume: 250 },
      ],
    },
  ]);

  const mockScanMode = signal<ScreenerScanMode>('live');
  const mockActiveStrategy = signal<'liquidity-sweep' | 'order-block'>('liquidity-sweep');
  const mockHtfTimeframe = signal<'1h' | '4h'>('1h');
  const mockLtfTimeframe = signal<'5m' | '15m'>('5m');
  const mockSweepTimeframe = signal<'5m' | '15m' | '1h'>('15m');
  const mockSweepEntryMode = signal<'RECLAIM_CLOSE' | 'LTF_STRUCTURE_SHIFT'>('RECLAIM_CLOSE');
  const mockSweepSymbols = signal<any[]>([]);

  const mockOrderBlockResults = signal<any>({
    mode: 'live',
    strategy: 'order-block',
    htf: '1h',
    ltf: '5m',
    scannedAt: '2026-11-18T09:35:00.000Z',
    instrumentsScanned: mockInstruments().map((i) => ({ symbol: i.symbol, displayName: i.displayName, name: i.name })),
    totalScanned: 4,
    totalActiveOrderBlocks: 1,
    totalSignals: 1,
    approachingCount: 0,
    mitigatingCount: 1,
    sniperSignalCount: 1,
    results: [
      {
        symbol: 'NIFTY',
        displayName: 'Nifty 50',
        name: 'Nifty 50',
        timeframe: '1h + 5m',
        trendBias: 'BULLISH',
        activeOrderBlocks: [
          {
            id: 'OB_BULLISH_EXTREME_1',
            type: 'BULLISH',
            obType: 'EXTREME',
            candleIndex: 2,
            createdAt: 1763440000,
            zoneHigh: 24550,
            zoneLow: 24480,
            equilibrium: 24515,
            bosPrice: 24650,
            structureBreakType: 'BOS',
            structureBreakTime: 1763443600,
            mitigated: false,
            invalidated: false,
            status: 'MITIGATING',
            proximityPercent: 0,
            fvgBounds: {
              top: 24580,
              bottom: 24550,
              candleIndex: 3,
              time: 1763443600,
            },
          },
        ],
        candles: [
          { time: 1763440000, open: 24500, high: 24550, low: 24480, close: 24530, volume: 1000 },
          { time: 1763443600, open: 24530, high: 24660, low: 24520, close: 24650, volume: 2000 },
        ],
        chartOverlay: {
          orderBlocks: [
            {
              id: 'OB_BULLISH_EXTREME_1',
              type: 'BULLISH',
              obType: 'EXTREME',
              zoneHigh: 24550,
              zoneLow: 24480,
              equilibrium: 24515,
              startTime: 1763440000,
              endTime: 1763443600,
              color: '#10B981',
              status: 'MITIGATING',
            },
          ],
          fvgs: [],
          breaks: [],
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
          id: 'NIFTY_1763443600_BUY',
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
      },
    ],
  });

  const mockScreenerService = {
    instruments: mockInstruments,
    isLoadingInstruments: signal(false),
    instrumentsError: signal<string | null>(null),
    activeStrategy: mockActiveStrategy,
    htfTimeframe: mockHtfTimeframe,
    ltfTimeframe: mockLtfTimeframe,
    sweepTimeframe: mockSweepTimeframe,
    sweepEntryMode: mockSweepEntryMode,
    liquiditySweepResults: signal<any>(null),
    liquiditySweepSymbols: mockSweepSymbols,
    totalActivePools: signal(0),
    totalSweepSignals: signal(0),
    orderBlockResults: mockOrderBlockResults,
    orderBlockSymbols: signal(mockOrderBlockResults().results),
    totalActiveOrderBlocks: signal(1),
    totalSniperSignals: signal(1),
    approachingCount: signal(0),
    mitigatingCount: signal(1),
    scanMode: mockScanMode,
    historicalStartDate: signal('2026-11-17'),
    historicalEndDate: signal('2026-11-17'),
    isScanning: signal(false),
    scanError: signal<string | null>(null),
    lastScannedAt: signal<string | null>('2026-11-18T09:35:00.000Z'),
    scanResults: signal<any>({
      mode: 'live',
      timeframe: '5m',
      scannedAt: '2026-11-18T09:35:00.000Z',
      instrumentsScanned: mockInstruments().map((i) => ({ symbol: i.symbol, name: i.name })),
      totalScanned: 4,
      totalRecommendations: 2,
      bullishCount: 1,
      bearishCount: 1,
      recommendations: mockRecommendations(),
    }),
    recommendations: mockRecommendations,
    totalRecommendations: signal(2),
    bullishCount: signal(1),
    bearishCount: signal(1),
    totalScanned: signal(4),
    instrumentCount: signal(4),
    loadInstruments: vi.fn(),
    setStrategy: vi.fn((s: any) => mockActiveStrategy.set(s)),
    setHtfTimeframe: vi.fn((tf: any) => mockHtfTimeframe.set(tf)),
    setLtfTimeframe: vi.fn((tf: any) => mockLtfTimeframe.set(tf)),
    setSweepTimeframe: vi.fn((tf: any) => mockSweepTimeframe.set(tf)),
    setSweepEntryMode: vi.fn((m: any) => mockSweepEntryMode.set(m)),
    setMode: vi.fn((mode: ScreenerScanMode) => mockScanMode.set(mode)),
    setHistoricalDates: vi.fn(),
    runScan: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockScanMode.set('live');
    mockActiveStrategy.set('liquidity-sweep');

    await TestBed.configureTestingModule({
      imports: [ScreenerComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        provideRouter([]),
        { provide: ScreenerService, useValue: mockScreenerService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ScreenerComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create component and render Liquidity Sweep Screener header with configured indices', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(component).toBeTruthy();
    expect(compiled.querySelector('.page-title')?.textContent).toContain(
      'Liquidity Sweep Strategy Scanner',
    );
    expect(compiled.querySelectorAll('.index-chip').length).toBe(4);
    expect(compiled.querySelector('.watchlist-manager-card')).toBeNull();
  });

  it('should toggle between Live and Historical mode without auto-scanning, and show Date Pickers in Historical mode', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.historical-bar')).toBeNull();

    const modeBtns = compiled.querySelectorAll('.mode-btn');
    expect(modeBtns.length).toBe(2);

    (modeBtns[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(mockScreenerService.setMode).toHaveBeenCalledWith('historical');
    expect(mockScreenerService.runScan).not.toHaveBeenCalled();
    expect(compiled.querySelector('.historical-bar')).not.toBeNull();
    expect(compiled.querySelectorAll('.date-input').length).toBe(2);
  });

  it('should execute scan strictly when clicking Run Scan button', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const runBtn = compiled.querySelector('.run-scan-btn') as HTMLButtonElement;
    expect(runBtn).not.toBeNull();

    runBtn.click();
    expect(mockScreenerService.runScan).toHaveBeenCalledTimes(1);
  });

  it('should render an individual recommendation card and SweepChart per discrete signal', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const cards = compiled.querySelectorAll('.recommendation-card');
    expect(cards.length).toBe(2);

    const charts = compiled.querySelectorAll('app-sweep-chart');
    expect(charts.length).toBe(2);

    expect(cards[0].textContent).toContain('Nifty 50');
    expect(cards[0].textContent).toContain('BUY');
    expect(cards[0].textContent).toContain('PDL Sweep');
    expect(cards[1].textContent).toContain('Nifty Bank');
    expect(cards[1].textContent).toContain('SELL');
    expect(cards[1].textContent).toContain('PDH Sweep');
  });

  it('should filter recommendations by BUY/SELL direction and level type', () => {
    component.activeSignalFilter.set('BUY');
    fixture.detectChanges();
    expect(component.filteredRecommendations().length).toBe(1);
    expect(component.filteredRecommendations()[0].displayName).toBe('Nifty 50');

    component.activeSignalFilter.set('ALL');
    component.activeLevelFilter.set('PDH');
    fixture.detectChanges();
    expect(component.filteredRecommendations().length).toBe(1);
    expect(component.filteredRecommendations()[0].displayName).toBe('Nifty Bank');
  });

  it('should navigate to dashboard composer when clicking Create Alert on a recommendation card', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    const compiled = fixture.nativeElement as HTMLElement;
    const alertBtn = compiled.querySelector('.trade-setup-btn') as HTMLButtonElement;
    alertBtn.click();

    expect(navigateSpy).toHaveBeenCalledWith(['/'], {
      queryParams: {
        symbol: 'Nifty 50',
        targetPrice: 24525,
        stopLoss: 24482,
        strategy: 'BUY_PDL_SWEEP',
      },
    });
  });

  it('should switch to Order Block (SMC) strategy view and render Order Block cards & chart', () => {
    mockActiveStrategy.set('order-block');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.page-title')?.textContent).toContain(
      'Order Block (SMC) Strategy Scanner',
    );
    expect(compiled.querySelectorAll('.mini-toggle').length).toBe(2);

    const obCards = compiled.querySelectorAll('.recommendation-card');
    expect(obCards.length).toBe(1);
    expect(obCards[0].textContent).toContain('Nifty 50');
    expect(obCards[0].textContent).toContain('Demand');
    expect(obCards[0].textContent).toContain('SNIPER BUY');

    expect(compiled.querySelector('app-order-block-chart')).not.toBeNull();
  });

  it('should navigate to dashboard composer when clicking Create Alert on an Order Block card', () => {
    mockActiveStrategy.set('order-block');
    fixture.detectChanges();

    const navigateSpy = vi.spyOn(router, 'navigate');
    const compiled = fixture.nativeElement as HTMLElement;
    const alertBtn = compiled.querySelector('.trade-setup-btn') as HTMLButtonElement;
    alertBtn.click();

    expect(navigateSpy).toHaveBeenCalledWith(['/'], {
      queryParams: {
        symbol: 'Nifty 50',
        targetPrice: 24550,
        stopLoss: 24470,
        strategy: 'ORDER_BLOCK_BUY_SNIPER',
      },
    });
  });

  it('should render standalone LiquiditySweepSymbolResult cards when liquiditySweepSymbols are present', () => {
    mockSweepSymbols.set([
      {
        symbol: 'NIFTY',
        displayName: 'Nifty 50',
        name: 'Nifty 50',
        strategy: 'LIQUIDITY_SWEEP',
        timeframe: '15m',
        activePools: [
          { id: 'BSL_1', side: 'BSL', poolType: 'EQH', price: 24600, startTime: 1763440000, touchCount: 2 },
          { id: 'SSL_1', side: 'SSL', poolType: 'SWING', price: 24450, startTime: 1763440000, touchCount: 1 },
        ],
        recentSweeps: [
          {
            direction: 'BULLISH',
            poolType: 'SWING',
            sweptPrice: 24450,
            sweepWickExtreme: 24430,
            sweepTime: 1763441000,
            reclaimTime: 1763441000,
          },
        ],
        signal: {
          action: 'BUY',
          entryMode: 'RECLAIM_CLOSE',
          entryPrice: 24465,
          stopLoss: 24420,
          takeProfit: 24600,
          rrRatio: 3.0,
          targetPoolPrice: 24600,
        },
        candles: [],
        chartOverlay: {
          pools: [],
          sweeps: [],
        },
      },
    ]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const sweepCards = compiled.querySelectorAll('.recommendation-card');
    expect(sweepCards.length).toBe(1);
    expect(sweepCards[0].textContent).toContain('Nifty 50');
    expect(sweepCards[0].textContent).toContain('2 Active Pools');
    expect(sweepCards[0].textContent).toContain('BUY');

    const navigateSpy = vi.spyOn(router, 'navigate');
    const alertBtn = sweepCards[0].querySelector('.trade-setup-btn') as HTMLButtonElement;
    alertBtn.click();

    expect(navigateSpy).toHaveBeenCalledWith(['/'], {
      queryParams: {
        symbol: 'Nifty 50',
        targetPrice: 24465,
        stopLoss: 24420,
        strategy: 'LIQUIDITY_SWEEP_BUY',
      },
    });
  });
});

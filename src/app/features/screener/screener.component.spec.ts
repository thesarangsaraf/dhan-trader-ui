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
    { symbol: 'NIFTY 50', name: 'Nifty 50 Index', securityId: '13', enabled: true },
    { symbol: 'BANK NIFTY', name: 'Bank Nifty Index', securityId: '25', enabled: true },
    { symbol: 'MIDCAP NIFTY', name: 'Nifty Midcap Select', securityId: '442', enabled: true },
    { symbol: 'SENSEX', name: 'BSE Sensex Index', securityId: '51', enabled: true },
  ]);

  const mockRecommendations = signal<LiquiditySweepSignal[]>([
    {
      id: 'NIFTY_50_1763440500_BUY',
      symbol: 'NIFTY 50',
      name: 'Nifty 50 Index',
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
      id: 'BANK_NIFTY_1763443200_SELL',
      symbol: 'BANK NIFTY',
      name: 'Bank Nifty Index',
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

  const mockScreenerService = {
    instruments: mockInstruments,
    isLoadingInstruments: signal(false),
    instrumentsError: signal<string | null>(null),
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
    setMode: vi.fn((mode: ScreenerScanMode) => mockScanMode.set(mode)),
    setHistoricalDates: vi.fn(),
    runScan: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockScanMode.set('live');

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
      'Liquidity Sweep & Reversal Screener',
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

    expect(cards[0].textContent).toContain('NIFTY 50');
    expect(cards[0].textContent).toContain('BUY');
    expect(cards[0].textContent).toContain('PDL Sweep');
    expect(cards[1].textContent).toContain('BANK NIFTY');
    expect(cards[1].textContent).toContain('SELL');
    expect(cards[1].textContent).toContain('PDH Sweep');
  });

  it('should filter recommendations by BUY/SELL direction and level type', () => {
    component.activeSignalFilter.set('BUY');
    fixture.detectChanges();
    expect(component.filteredRecommendations().length).toBe(1);
    expect(component.filteredRecommendations()[0].symbol).toBe('NIFTY 50');

    component.activeSignalFilter.set('ALL');
    component.activeLevelFilter.set('PDH');
    fixture.detectChanges();
    expect(component.filteredRecommendations().length).toBe(1);
    expect(component.filteredRecommendations()[0].symbol).toBe('BANK NIFTY');
  });

  it('should navigate to dashboard composer when clicking Create Alert on a recommendation card', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    const compiled = fixture.nativeElement as HTMLElement;
    const alertBtn = compiled.querySelector('.trade-setup-btn') as HTMLButtonElement;
    alertBtn.click();

    expect(navigateSpy).toHaveBeenCalledWith(['/'], {
      queryParams: {
        symbol: 'NIFTY 50',
        targetPrice: 24525,
        stopLoss: 24482,
        strategy: 'BUY_PDL_SWEEP',
      },
    });
  });
});

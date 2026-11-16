import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScreenerComponent } from './screener.component';
import { ScreenerService } from '../../core/api/screener.service';
import { ScreenerMatch, WatchlistStockItem } from '../../core/models/screener.models';

describe('ScreenerComponent', () => {
  let component: ScreenerComponent;
  let fixture: ComponentFixture<ScreenerComponent>;
  let router: Router;

  const mockWatchlist = signal<WatchlistStockItem[]>([
    { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', enabled: true, order: 1 },
    { symbol: 'TCS', name: 'Tata Consultancy Services Ltd', enabled: true, order: 2 },
  ]);

  const mockMatches = signal<ScreenerMatch[]>([
    {
      symbol: 'RELIANCE',
      name: 'Reliance Industries Ltd',
      cmp: 2496,
      strategy: 'DEMAND_ORDER_BLOCK',
      strategyLabel: 'Demand OB (Bullish)',
      signalType: 'BUY',
      entryPrice: 2495,
      stopLossPrice: 2480,
      riskPoints: 15,
      riskPercent: 0.6,
      timeframe: '15m',
      matchedAt: '2026-11-16T12:00:00.000Z',
    },
    {
      symbol: 'INFY',
      name: 'Infosys Ltd',
      cmp: 1524,
      strategy: 'SUPPLY_ORDER_BLOCK',
      strategyLabel: 'Supply OB (Bearish)',
      signalType: 'SELL',
      entryPrice: 1525,
      stopLossPrice: 1545,
      riskPoints: 20,
      riskPercent: 1.31,
      timeframe: '15m',
      matchedAt: '2026-11-16T12:00:00.000Z',
    },
  ]);

  const mockScreenerService = {
    watchlist: mockWatchlist,
    isLoadingWatchlist: signal(false),
    watchlistError: signal<string | null>(null),
    selectedTimeframe: signal('15m'),
    isScanning: signal(false),
    scanError: signal<string | null>(null),
    lastScannedAt: signal<string | null>('2026-11-16T12:00:00.000Z'),
    scanResults: signal<any>({
      timeframe: '15m',
      scannedAt: '2026-11-16T12:00:00.000Z',
      totalScanned: 2,
      totalMatches: 2,
      bullishMatches: 1,
      bearishMatches: 1,
      matches: mockMatches(),
    }),
    matches: mockMatches,
    totalMatches: signal(2),
    bullishMatches: signal(1),
    bearishMatches: signal(1),
    totalScanned: signal(2),
    enabledWatchlistCount: signal(2),
    runScan: vi.fn(),
    setTimeframe: vi.fn(),
    toggleStock: vi.fn(),
    addStock: vi.fn(),
    removeStock: vi.fn(),
    resetWatchlist: vi.fn(),
    updateWatchlist: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

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

  it('should create the screener component', () => {
    expect(component).toBeTruthy();
  });

  it('should render page title and subtitle', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.page-title')?.textContent).toContain('NSE Stock Screener');
    expect(compiled.querySelector('.page-subtitle')?.textContent).toContain('Supply & Demand Order Blocks');
  });

  it('should render timeframe options and trigger scan on selection', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const chips = compiled.querySelectorAll('.tf-chip');
    expect(chips.length).toBe(4); // 15m, 1h, 1d, 1wk

    // Click on 1h chip
    const hourChip = chips[1] as HTMLButtonElement;
    hourChip.click();

    expect(mockScreenerService.setTimeframe).toHaveBeenCalledWith('1h');
    expect(mockScreenerService.runScan).toHaveBeenCalled();
  });

  it('should call runScan when clicking Run Technical Scan button', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const runBtn = compiled.querySelector('.run-scan-btn') as HTMLButtonElement;
    expect(runBtn).not.toBeNull();

    runBtn.click();
    expect(mockScreenerService.runScan).toHaveBeenCalled();
  });

  it('should toggle watchlist manager panel when clicking Watchlist button', () => {
    expect(component.isWatchlistOpen()).toBe(false);

    const compiled = fixture.nativeElement as HTMLElement;
    const toggleBtn = compiled.querySelector('.manage-watchlist-btn') as HTMLButtonElement;
    toggleBtn.click();
    fixture.detectChanges();

    expect(component.isWatchlistOpen()).toBe(true);
    expect(compiled.querySelector('.watchlist-manager-card')).not.toBeNull();
  });

  it('should render results table with stock symbol, CMP, strategy, entry, and stop-loss', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const rows = compiled.querySelectorAll('.setups-table tbody tr');
    expect(rows.length).toBe(2);

    const firstRow = rows[0];
    // Stock symbol without .NS
    expect(firstRow.querySelector('.ticker-symbol')?.textContent?.trim()).toBe('RELIANCE');
    // Strategy
    expect(firstRow.querySelector('.strategy-badge')?.textContent).toContain('Demand OB (Bullish)');
    // Entry price
    expect(firstRow.querySelector('.entry-price')?.textContent).toContain('2,495');
    // Stop loss price
    expect(firstRow.querySelector('.sl-price')?.textContent).toContain('2,480');
  });

  it('should filter matches when clicking on Bullish/Bearish pills', () => {
    component.activeStrategyFilter.set('BUY');
    fixture.detectChanges();
    expect(component.filteredMatches().length).toBe(1);
    expect(component.filteredMatches()[0].symbol).toBe('RELIANCE');

    component.activeStrategyFilter.set('SELL');
    fixture.detectChanges();
    expect(component.filteredMatches().length).toBe(1);
    expect(component.filteredMatches()[0].symbol).toBe('INFY');
  });

  it('should navigate to dashboard composer when clicking Create Alert button', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    const compiled = fixture.nativeElement as HTMLElement;
    const alertBtn = compiled.querySelector('.trade-setup-btn') as HTMLButtonElement;
    expect(alertBtn).not.toBeNull();

    alertBtn.click();
    expect(navigateSpy).toHaveBeenCalledWith(['/'], {
      queryParams: {
        symbol: 'RELIANCE',
        targetPrice: 2495,
        stopLoss: 2480,
        strategy: 'DEMAND_ORDER_BLOCK',
      },
    });
  });
});

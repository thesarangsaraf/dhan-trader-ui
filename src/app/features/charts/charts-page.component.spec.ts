import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChartsPageComponent } from './charts-page.component';
import { ChartService } from '../../core/api/chart.service';
import { InstrumentService } from '../../core/api/instrument.service';
import { Instrument } from '../../core/models/instrument.models';
import { ChartCandlesResponse } from '../../core/models/chart.models';

describe('ChartsPageComponent', () => {
  let component: ChartsPageComponent;
  let fixture: ComponentFixture<ChartsPageComponent>;
  let chartService: ChartService;
  let instrumentService: InstrumentService;

  // Polyfill matchMedia for jsdom
  if (typeof window !== 'undefined' && !window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }

  const mockIndices: Instrument[] = [
    { symbol: 'NIFTY 50', name: 'NIFTY 50', securityId: '13', exchangeSegment: 'IDX_I', instrumentType: 'INDEX', ltp: 25144.3, lotSize: 65 },
    { symbol: 'BANK NIFTY', name: 'BANK NIFTY', securityId: '25', exchangeSegment: 'IDX_I', instrumentType: 'INDEX', ltp: 51200, lotSize: 30 },
    { symbol: 'SENSEX', name: 'SENSEX', securityId: '51', exchangeSegment: 'IDX_I', instrumentType: 'INDEX', ltp: 82000, lotSize: 20 },
    { symbol: 'MIDCAP NIFTY', name: 'MIDCAP NIFTY', securityId: '442', exchangeSegment: 'IDX_I', instrumentType: 'INDEX', ltp: 13000, lotSize: 75 },
  ];

  const mockResponse: ChartCandlesResponse = {
    symbol: 'NIFTY 50',
    yahooSymbol: '^NSEI',
    interval: '5m',
    range: '1d',
    currency: 'INR',
    exchange: 'NSE',
    lastPrice: 25144.3,
    count: 3,
    candles: [
      { time: 1700000000, open: 25100, high: 25150, low: 25090, close: 25120, volume: 100 },
      { time: 1700000300, open: 25120, high: 25160, low: 25110, close: 25135, volume: 120 },
      { time: 1700000600, open: 25135, high: 25150, low: 25130, close: 25144.3, volume: 150 },
    ],
  };

  const mockDialog = {
    open: vi.fn().mockReturnValue({
      afterClosed: () => of({ symbol: 'RELIANCE', name: 'RELIANCE', securityId: '2885', exchangeSegment: 'NSE_EQ', instrumentType: 'EQUITY', ltp: 2800 }),
    }),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [ChartsPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        {
          provide: ChartService,
          useValue: {
            getCandles: vi.fn().mockReturnValue(of(mockResponse)),
          },
        },
        {
          provide: InstrumentService,
          useValue: {
            fetchConfiguredIndices: vi.fn().mockReturnValue(of(mockIndices)),
            lotSizes: vi.fn().mockReturnValue(null),
          },
        },
        {
          provide: MatDialog,
          useValue: mockDialog,
        },
      ],
    }).compileComponents();

    chartService = TestBed.inject(ChartService);
    instrumentService = TestBed.inject(InstrumentService);
    fixture = TestBed.createComponent(ChartsPageComponent);
    component = fixture.componentInstance;
    (component as any).dialog = mockDialog;
  });

  it('should create the charts page component', () => {
    expect(component).toBeTruthy();
  });

  it('should load instruments list matching alert composer API and populate selection buttons', () => {
    fixture.detectChanges();

    expect(instrumentService.fetchConfiguredIndices).toHaveBeenCalled();
    expect(component.instruments().length).toBe(4);
    expect(component.instruments()[0].symbol).toBe('NIFTY 50');
    expect(component.instruments()[1].symbol).toBe('BANK NIFTY');
    expect(component.instruments()[2].symbol).toBe('SENSEX');
    expect(component.instruments()[3].symbol).toBe('MIDCAP NIFTY');
  });

  it('should fetch candles on init and calculate LTP and change', () => {
    fixture.detectChanges();

    expect(chartService.getCandles).toHaveBeenCalledWith('NIFTY 50', '5m', '5d');
    expect(component.chartData()).toEqual(mockResponse);
    expect(component.currentLtp()).toBe(25144.3);
    expect(component.dayOpen()).toBe(25100);

    const change = component.priceChange();
    expect(change).not.toBeNull();
    expect(change?.points).toBeCloseTo(44.3, 1);
  });

  it('should switch selected symbol and reload candles', () => {
    fixture.detectChanges();
    vi.clearAllMocks();

    component.selectSymbol('BANK NIFTY');
    expect(component.selectedSymbol()).toBe('BANK NIFTY');
    expect(chartService.getCandles).toHaveBeenCalledWith('BANK NIFTY', '5m', '5d');
  });

  it('should switch interval and range and reload candles', () => {
    fixture.detectChanges();
    vi.clearAllMocks();

    component.selectInterval('15m');
    expect(component.selectedInterval()).toBe('15m');
    expect(chartService.getCandles).toHaveBeenCalledWith('NIFTY 50', '15m', '5d');

    vi.clearAllMocks();
    component.selectRange('1mo');
    expect(component.selectedRange()).toBe('1mo');
    expect(chartService.getCandles).toHaveBeenCalledWith('NIFTY 50', '15m', '1mo');
  });

  it('should apply custom symbol from search input and add to instruments list', () => {
    fixture.detectChanges();
    vi.clearAllMocks();

    component.customSymbolInput.set('TCS');
    component.applyCustomSymbol();
    expect(component.selectedSymbol()).toBe('TCS');
    expect(component.instruments().some((i) => i.symbol === 'TCS')).toBe(true);
    expect(chartService.getCandles).toHaveBeenCalledWith('TCS', '5m', '5d');
  });

  it('should open scrip search modal and chart selected item', () => {
    fixture.detectChanges();
    vi.clearAllMocks();

    component.openScripSearchModal();
    expect(mockDialog.open).toHaveBeenCalled();
    expect(component.selectedSymbol()).toBe('RELIANCE');
    expect(component.instruments().some((i) => i.symbol === 'RELIANCE')).toBe(true);
    expect(chartService.getCandles).toHaveBeenCalledWith('RELIANCE', '5m', '5d');
  });

  it('should handle service error gracefully and display section error', () => {
    fixture.detectChanges();

    vi.mocked(chartService.getCandles).mockReturnValue(
      throwError(() => ({ error: { message: 'Network offline' } })),
    );

    component.loadCandles();
    fixture.detectChanges();

    expect(component.isLoading()).toBe(false);
    expect(component.errorMessage()).toContain('Network offline');
  });

  it('should toggle auto-refresh timer state', () => {
    expect(component.isAutoRefresh()).toBe(false);

    component.toggleAutoRefresh();
    expect(component.isAutoRefresh()).toBe(true);

    component.toggleAutoRefresh();
    expect(component.isAutoRefresh()).toBe(false);
  });

  it('should dynamically load older historical candles when scrolling left', () => {
    fixture.detectChanges();

    const olderResponse: ChartCandlesResponse = {
      symbol: 'NIFTY 50',
      yahooSymbol: '^NSEI',
      interval: '5m',
      range: 'custom',
      currency: 'INR',
      exchange: 'NSE',
      lastPrice: 25144.3,
      count: 2,
      candles: [
        { time: 1699999400, open: 25050, high: 25080, low: 25040, close: 25075, volume: 80 },
        { time: 1699999700, open: 25075, high: 25110, low: 25070, close: 25100, volume: 90 },
      ],
    };

    vi.mocked(chartService.getCandles).mockReturnValue(of(olderResponse));

    component.loadOlderCandles();

    // Verify it called getCandles with period1 and period2
    expect(chartService.getCandles).toHaveBeenCalledWith(
      'NIFTY 50',
      '5m',
      undefined,
      undefined,
      expect.any(Number),
      expect.any(Number),
    );
    expect(component.isLoadingMoreHistory()).toBe(false);
  });
});

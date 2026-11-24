import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScreenerService } from './screener.service';
import { ScanResultResponse, ScreenerSignal } from '../models/screener.models';

describe('ScreenerService', () => {
  let service: ScreenerService;
  let httpTesting: HttpTestingController;

  const mockSignal: ScreenerSignal = {
    id: 'NIFTY_50_2026-11-20_1795156500',
    symbol: 'NIFTY 50',
    name: 'NIFTY 50 Index',
    date: '2026-11-20',
    timeframe: '5m',
    swingLow: 25000,
    swingLowTime: 1795153500,
    swingLowTimeFormatted: '11:15 IST',
    sweepLow: 24985,
    sweepTime: 1795155600,
    sweepTimeFormatted: '11:50 IST',
    baseCandleTime: 1795155900,
    baseHigh: 25015,
    baseLow: 24990,
    impulseTime: 1795156200,
    impulseClose: 25030,
    entryPrice: 25015,
    stopLoss: 24982,
    targetPrice: 25081,
    targetRr: 2.0,
    riskPoints: 33,
    rewardPoints: 66,
    orderBlock: {
      top: 25015,
      bottom: 24985,
      startTime: 1795155900,
      endTime: 1795156500,
    },
    entryTime: 1795156500,
    entryTimeFormatted: '12:05 IST',
    exitTime: 1795157100,
    exitTimeFormatted: '12:15 IST',
    exitPrice: 25081,
    outcome: 'WIN',
    pnlPoints: 66,
    rMultiple: 2.0,
    candles: [],
  };

  const mockScanResponse: ScanResultResponse = {
    success: true,
    timestamp: '2026-11-20T12:30:00.000Z',
    scannedSymbolsCount: 4,
    matchedSymbolsCount: 1,
    totalCandlesScanned: 1500,
    parameters: {
      lookbackPeriod: '60d',
      swingLookback: 20,
      slBuffer: 3,
      targetRr: 2.0,
      maxRetestBars: 15,
    },
    summary: {
      totalSignals: 1,
      wins: 1,
      losses: 0,
      eodExits: 0,
      openTrades: 0,
      winRate: 100,
      netRMultiple: 2.0,
      profitFactor: 99.99,
      grossProfitPoints: 66,
      grossLossPoints: 0,
      totalPnlPoints: 66,
    },
    signals: [mockSignal],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ScreenerService, provideHttpClient(), provideHttpClientTesting()],
    });

    httpTesting = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ScreenerService);

    // Handle initial constructor call to /api/screener/instruments
    const req = httpTesting.expectOne('/api/screener/instruments');
    req.flush({
      success: true,
      data: [
        {
          symbol: 'NIFTY 50',
          name: 'NIFTY 50 Index',
          securityId: '13',
          exchangeSegment: 'IDX_I',
          instrumentType: 'INDEX',
          yahooSymbol: '^NSEI',
          isIndex: true,
        },
      ],
    });
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should initialize with default parameters and instruments loaded', () => {
    expect(service.instruments().length).toBe(1);
    expect(service.instruments()[0].symbol).toBe('NIFTY 50');
    expect(service.scope()).toBe('indices');
    expect(service.lookbackPeriod()).toBe('60d');
    expect(service.swingLookback()).toBe(20);
    expect(service.slBuffer()).toBe(3);
    expect(service.targetRr()).toBe(2.0);
    expect(service.maxRetestBars()).toBe(15);
  });

  it('should execute runScan and update signals and summary signals', () => {
    service.runScan().subscribe((res) => {
      expect(res).toEqual(mockScanResponse);
    });

    const scanReq = httpTesting.expectOne('/api/screener/scan');
    expect(scanReq.request.method).toBe('POST');
    expect(scanReq.request.body.scope).toBe('indices');
    expect(scanReq.request.body.lookbackPeriod).toBe('60d');
    scanReq.flush(mockScanResponse);

    expect(service.signals().length).toBe(1);
    expect(service.summary()?.winRate).toBe(100);
    expect(service.selectedSignal()).toEqual(mockSignal);
  });

  it('should filter signals correctly by search query and outcome', () => {
    service.signals.set([
      mockSignal,
      {
        ...mockSignal,
        id: 'LOSS-1',
        symbol: 'RELIANCE',
        outcome: 'LOSS',
        pnlPoints: -30,
        rMultiple: -1.0,
      },
    ]);

    expect(service.filteredSignals().length).toBe(2);

    service.filterOutcome.set('WIN');
    expect(service.filteredSignals().length).toBe(1);
    expect(service.filteredSignals()[0].symbol).toBe('NIFTY 50');

    service.filterOutcome.set('ALL');
    service.searchQuery.set('reliance');
    expect(service.filteredSignals().length).toBe(1);
    expect(service.filteredSignals()[0].symbol).toBe('RELIANCE');
  });

  it('should toggle symbol selection correctly in custom scope', () => {
    service.toggleSymbolSelection('RELIANCE');
    expect(service.selectedSymbols()).toContain('RELIANCE');

    service.toggleSymbolSelection('RELIANCE');
    expect(service.selectedSymbols()).not.toContain('RELIANCE');
  });
});

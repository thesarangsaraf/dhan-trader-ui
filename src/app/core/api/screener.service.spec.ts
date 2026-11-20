import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ScreenerService } from './screener.service';
import { ScreenerScanResponse } from '../models/screener.models';

describe('ScreenerService', () => {
  let service: ScreenerService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ScreenerService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ScreenerService);
    httpMock = TestBed.inject(HttpTestingController);

    // Initial loadInstruments() is triggered in constructor (no scan auto-run)
    const initReq = httpMock.expectOne('/api/screener/instruments');
    expect(initReq.request.method).toBe('GET');
    initReq.flush({
      instruments: [
        { symbol: 'NIFTY 50', name: 'Nifty 50 Index', securityId: '13' },
        { symbol: 'BANK NIFTY', name: 'Bank Nifty Index', securityId: '25' },
        { symbol: 'MIDCAP NIFTY', name: 'Nifty Midcap Select', securityId: '442' },
        { symbol: 'SENSEX', name: 'BSE Sensex Index', securityId: '51' },
      ],
    });
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should load configured indices from config/lot_sizes without auto-running scan', () => {
    expect(service).toBeTruthy();
    expect(service.instruments().length).toBe(4);
    expect(service.instrumentCount()).toBe(4);
    expect(service.scanMode()).toBe('live');
    expect(service.scanResults()).toBeNull();
    expect(service.isScanning()).toBe(false);
  });

  it('should execute Live mode scan strictly on-demand via POST /api/screener/scan', () => {
    const mockResponse: ScreenerScanResponse = {
      mode: 'live',
      timeframe: '5m',
      scannedAt: '2026-11-18T09:35:00.000Z',
      instrumentsScanned: [
        { symbol: 'NIFTY 50', name: 'Nifty 50 Index' },
        { symbol: 'BANK NIFTY', name: 'Bank Nifty Index' },
      ],
      totalScanned: 2,
      totalRecommendations: 1,
      bullishCount: 1,
      bearishCount: 0,
      recommendations: [
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
      ],
    };

    service.runScan();
    expect(service.isScanning()).toBe(true);

    const scanReq = httpMock.expectOne('/api/screener/scan');
    expect(scanReq.request.method).toBe('POST');
    expect(scanReq.request.body).toEqual({
      mode: 'live',
      strategy: 'liquidity-sweep',
      timeframe: '15m',
      entryMode: 'RECLAIM_CLOSE',
    });
    scanReq.flush(mockResponse);

    expect(service.isScanning()).toBe(false);
    expect(service.totalRecommendations()).toBe(1);
    expect(service.bullishCount()).toBe(1);
    expect(service.bearishCount()).toBe(0);
    expect(service.recommendations()[0].levelType).toBe('PDL');
  });

  it('should execute Historical mode scan with startDate and endDate', () => {
    service.setMode('historical');
    service.setHistoricalDates('2026-11-14', '2026-11-17');
    service.runScan();

    const scanReq = httpMock.expectOne('/api/screener/scan');
    expect(scanReq.request.method).toBe('POST');
    expect(scanReq.request.body).toEqual({
      mode: 'historical',
      strategy: 'liquidity-sweep',
      startDate: '2026-11-14',
      endDate: '2026-11-17',
      timeframe: '15m',
      entryMode: 'RECLAIM_CLOSE',
    });

    scanReq.flush({
      mode: 'historical',
      timeframe: '5m',
      startDate: '2026-11-14',
      endDate: '2026-11-17',
      scannedAt: '2026-11-18T10:00:00.000Z',
      instrumentsScanned: [],
      totalScanned: 4,
      totalRecommendations: 0,
      bullishCount: 0,
      bearishCount: 0,
      recommendations: [],
    });

    expect(service.isScanning()).toBe(false);
    expect(service.totalRecommendations()).toBe(0);
  });

  it('should support customizing sweep timeframe and entry mode', () => {
    service.setSweepTimeframe('1h');
    service.setSweepEntryMode('LTF_STRUCTURE_SHIFT');
    expect(service.sweepTimeframe()).toBe('1h');
    expect(service.sweepEntryMode()).toBe('LTF_STRUCTURE_SHIFT');

    service.runScan();
    const scanReq = httpMock.expectOne('/api/screener/scan');
    expect(scanReq.request.body).toEqual({
      mode: 'live',
      strategy: 'liquidity-sweep',
      timeframe: '1h',
      entryMode: 'LTF_STRUCTURE_SHIFT',
    });
    scanReq.flush({
      mode: 'live',
      strategy: 'LIQUIDITY_SWEEP',
      timeframe: '1h',
      scannedAt: '2026-11-19T10:00:00.000Z',
      instrumentsScanned: [],
      totalScanned: 2,
      totalRecommendations: 0,
      bullishCount: 0,
      bearishCount: 0,
      recommendations: [],
      liquiditySweepData: {
        mode: 'live',
        strategy: 'LIQUIDITY_SWEEP',
        timeframe: '1h',
        scannedAt: '2026-11-19T10:00:00.000Z',
        instrumentsScanned: [],
        totalScanned: 2,
        totalActivePools: 3,
        totalSignals: 1,
        bullishCount: 1,
        bearishCount: 0,
        results: [],
      },
    });
    expect(service.totalActivePools()).toBe(3);
    expect(service.totalSweepSignals()).toBe(1);
  });

  it('should execute Order Block (SMC) scan when strategy is order-block', () => {
    service.setStrategy('order-block');
    service.setHtfTimeframe('4h');
    service.setLtfTimeframe('15m');
    service.runScan();

    const scanReq = httpMock.expectOne('/api/screener/scan');
    expect(scanReq.request.method).toBe('POST');
    expect(scanReq.request.body).toEqual({
      mode: 'live',
      strategy: 'order-block',
      htfTimeframe: '4h',
      ltfTimeframe: '15m',
    });

    scanReq.flush({
      mode: 'live',
      strategy: 'order-block',
      scannedAt: '2026-11-19T10:00:00.000Z',
      instrumentsScanned: [],
      totalScanned: 4,
      totalRecommendations: 1,
      bullishCount: 1,
      bearishCount: 0,
      recommendations: [],
      orderBlockData: {
        mode: 'live',
        strategy: 'order-block',
        htf: '4h',
        ltf: '15m',
        scannedAt: '2026-11-19T10:00:00.000Z',
        instrumentsScanned: [],
        totalScanned: 4,
        totalActiveOrderBlocks: 2,
        totalSignals: 1,
        approachingCount: 1,
        mitigatingCount: 0,
        sniperSignalCount: 1,
        results: [
          {
            symbol: 'NIFTY',
            displayName: 'Nifty 50',
            name: 'Nifty 50',
            timeframe: '4h + 15m',
            trendBias: 'BULLISH',
            activeOrderBlocks: [
              {
                id: 'OB_1',
                type: 'BULLISH',
                obType: 'EXTREME',
                candleIndex: 2,
                createdAt: 1700000000,
                zoneHigh: 24600,
                zoneLow: 24500,
                equilibrium: 24550,
                bosPrice: 24700,
                structureBreakType: 'BOS',
                structureBreakTime: 1700010000,
                mitigated: false,
                invalidated: false,
                status: 'UNMITIGATED',
              },
            ],
            candles: [],
            chartOverlay: {
              orderBlocks: [],
              fvgs: [],
              breaks: [],
            },
          },
        ],
      },
    });

    expect(service.isScanning()).toBe(false);
    expect(service.totalActiveOrderBlocks()).toBe(2);
    expect(service.totalSniperSignals()).toBe(1);
    expect(service.orderBlockSymbols().length).toBe(1);
  });

  it('should reject invalid historical date range locally before calling backend', () => {
    service.setMode('historical');
    service.setHistoricalDates('2026-11-18', '2026-11-15');
    service.runScan();

    httpMock.expectNone('/api/screener/scan');
    expect(service.scanError()).toContain('Start date must be earlier');
    expect(service.isScanning()).toBe(false);
  });
});

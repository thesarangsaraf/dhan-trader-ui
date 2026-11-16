import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScreenerService } from './screener.service';
import { ScreenerScanResponse, ScreenerWatchlistDoc } from '../models/screener.models';

describe('ScreenerService', () => {
  let service: ScreenerService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ScreenerService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(ScreenerService);
    httpMock = TestBed.inject(HttpTestingController);

    // Initial loadWatchlist() is called in constructor
    const initReq = httpMock.expectOne('/api/screener/watchlist');
    expect(initReq.request.method).toBe('GET');
    initReq.flush({
      symbols: [
        { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', enabled: true, order: 1 },
        { symbol: 'TCS', name: 'Tata Consultancy Services Ltd', enabled: true, order: 2 },
      ],
      updatedAt: '2026-11-16T12:00:00.000Z',
    });
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created and populate watchlist from constructor', () => {
    expect(service).toBeTruthy();
    expect(service.watchlist().length).toBe(2);
    expect(service.enabledWatchlistCount()).toBe(2);
  });

  it('should toggle stock enabled status and update Firestore', () => {
    service.toggleStock('RELIANCE');
    expect(service.watchlist()[0].enabled).toBe(false);

    const putReq = httpMock.expectOne('/api/screener/watchlist');
    expect(putReq.request.method).toBe('PUT');
    expect(putReq.request.body.symbols[0].enabled).toBe(false);
    putReq.flush({ success: true, data: { symbols: service.watchlist() } });
  });

  it('should add new stock ticker to watchlist', () => {
    service.addStock('TATAPOWER', 'Tata Power Co Ltd', 'Power');
    expect(service.watchlist().length).toBe(3);
    expect(service.watchlist()[2].symbol).toBe('TATAPOWER');

    const putReq = httpMock.expectOne('/api/screener/watchlist');
    expect(putReq.request.method).toBe('PUT');
    putReq.flush({ success: true, data: { symbols: service.watchlist() } });
  });

  it('should remove stock ticker from watchlist', () => {
    service.removeStock('TCS');
    expect(service.watchlist().length).toBe(1);
    expect(service.watchlist()[0].symbol).toBe('RELIANCE');

    const putReq = httpMock.expectOne('/api/screener/watchlist');
    expect(putReq.request.method).toBe('PUT');
    putReq.flush({ success: true, data: { symbols: service.watchlist() } });
  });

  it('should reset watchlist to defaults via POST /api/screener/watchlist/reset', () => {
    service.resetWatchlist();

    const resetReq = httpMock.expectOne('/api/screener/watchlist/reset');
    expect(resetReq.request.method).toBe('POST');
    resetReq.flush({
      success: true,
      data: {
        symbols: [
          { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', enabled: true },
          { symbol: 'TCS', name: 'Tata Consultancy Services Ltd', enabled: true },
          { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', enabled: true },
        ],
      },
    });

    expect(service.watchlist().length).toBe(3);
  });

  it('should trigger technical scan via POST /api/screener/scan', () => {
    const mockScanResult: ScreenerScanResponse = {
      timeframe: '15m',
      scannedAt: '2026-11-16T12:05:00.000Z',
      totalScanned: 2,
      totalMatches: 1,
      bullishMatches: 1,
      bearishMatches: 0,
      matches: [
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
          matchedAt: '2026-11-16T12:05:00.000Z',
        },
      ],
    };

    service.runScan('15m');
    expect(service.isScanning()).toBe(true);

    const scanReq = httpMock.expectOne('/api/screener/scan');
    expect(scanReq.request.method).toBe('POST');
    expect(scanReq.request.body).toEqual({ timeframe: '15m' });
    scanReq.flush(mockScanResult);

    expect(service.isScanning()).toBe(false);
    expect(service.totalMatches()).toBe(1);
    expect(service.bullishMatches()).toBe(1);
    expect(service.matches()[0].symbol).toBe('RELIANCE');
    expect(service.matches()[0].entryPrice).toBe(2495);
    expect(service.matches()[0].stopLossPrice).toBe(2480);
  });
});

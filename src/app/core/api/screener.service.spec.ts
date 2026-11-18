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
        { symbol: 'NIFTY 50', name: 'Nifty 50 Index', securityId: '13', enabled: true },
        { symbol: 'BANK NIFTY', name: 'Bank Nifty Index', securityId: '25', enabled: true },
        { symbol: 'MIDCAP NIFTY', name: 'Nifty Midcap Select', securityId: '442', enabled: true },
        { symbol: 'SENSEX', name: 'BSE Sensex Index', securityId: '51', enabled: true },
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
    expect(scanReq.request.body).toEqual({ mode: 'live' });
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
      startDate: '2026-11-14',
      endDate: '2026-11-17',
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

  it('should reject invalid historical date range locally before calling backend', () => {
    service.setMode('historical');
    service.setHistoricalDates('2026-11-18', '2026-11-15');
    service.runScan();

    httpMock.expectNone('/api/screener/scan');
    expect(service.scanError()).toContain('Start date must be earlier');
    expect(service.isScanning()).toBe(false);
  });
});

import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChartService } from './chart.service';
import { ChartCandlesResponse } from '../models/chart.models';

describe('ChartService', () => {
  let service: ChartService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ChartService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(ChartService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call GET /api/charts/candles with default parameters', () => {
    const mockResponse: ChartCandlesResponse = {
      symbol: 'NIFTY 50',
      yahooSymbol: '^NSEI',
      interval: '5m',
      range: '1d',
      currency: 'INR',
      exchange: 'NSE',
      lastPrice: 25144.3,
      count: 2,
      candles: [
        { time: 1700000000, open: 25100, high: 25150, low: 25090, close: 25140, volume: 100 },
        { time: 1700000300, open: 25140, high: 25160, low: 25130, close: 25144.3, volume: 150 },
      ],
    };

    service.getCandles().subscribe((res) => {
      expect(res.symbol).toBe('NIFTY 50');
      expect(res.candles.length).toBe(2);
    });

    const req = httpMock.expectOne((r) =>
      r.url === '/api/charts/candles' &&
      r.params.get('symbol') === 'NIFTY 50' &&
      r.params.get('interval') === '5m' &&
      r.params.get('range') === '1d',
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('should pass custom symbol, interval, range, and limit', () => {
    service.getCandles('BANK NIFTY', '15m', '5d', 50).subscribe();

    const req = httpMock.expectOne((r) =>
      r.url === '/api/charts/candles' &&
      r.params.get('symbol') === 'BANK NIFTY' &&
      r.params.get('interval') === '15m' &&
      r.params.get('range') === '5d' &&
      r.params.get('limit') === '50',
    );
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('should pass period1 and period2 when querying custom historical window', () => {
    service.getCandles('NIFTY 50', '5m', undefined, undefined, 1700000000, 1700100000).subscribe();

    const req = httpMock.expectOne((r) =>
      r.url === '/api/charts/candles' &&
      r.params.get('symbol') === 'NIFTY 50' &&
      r.params.get('interval') === '5m' &&
      r.params.get('period1') === '1700000000' &&
      r.params.get('period2') === '1700100000' &&
      !r.params.has('range'),
    );
    expect(req.request.method).toBe('GET');
    req.flush({});
  });
});

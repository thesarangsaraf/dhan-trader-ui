import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HistoricalDataService } from './historical-data.service';

describe('HistoricalDataService', () => {
  let service: HistoricalDataService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MatSnackBarModule],
      providers: [
        HistoricalDataService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
      ],
    });
    service = TestBed.inject(HistoricalDataService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should fetch NIFTY 50 5-minute Firestore status', () => {
    service.fetchStatus().subscribe((res) => {
      expect(res?.storedInFirestore).toBe(true);
      expect(res?.metadata?.totalCandles).toBe(178452);
    });

    const req = httpTesting.expectOne('/api/historical-data/nifty50-5m/status');
    expect(req.request.method).toBe('GET');
    req.flush({
      storedInFirestore: true,
      syncInProgress: false,
      sourceRepo: 'https://github.com/technovusin/nifty50-historical-data',
      collection: 'historical_candles/NIFTY50_5M',
      metadata: {
        symbol: 'NIFTY 50',
        securityId: '13',
        timeframe: '5m',
        sourceRepo: 'https://github.com/technovusin/nifty50-historical-data',
        collection: 'historical_candles/NIFTY50_5M',
        totalCandles: 178452,
        totalMonths: 116,
        firstEpoch: 1491191100,
        lastEpoch: 1795427700,
        firstMonth: '2017-04',
        lastMonth: '2026-11',
        months: ['2017-04', '2026-11'],
        monthCounts: { '2017-04': 1425, '2026-11': 1245 },
        updatedAt: '2026-11-24T17:00:00.000Z',
      },
    });

    expect(service.status()?.metadata?.totalMonths).toBe(116);
  });

  it('should trigger on-demand sync and refresh status', () => {
    service.syncNifty50FiveMin(false).subscribe((res) => {
      expect(res?.success).toBe(true);
      expect(res?.mode).toBe('incremental');
    });

    const syncReq = httpTesting.expectOne('/api/historical-data/nifty50-5m/sync');
    expect(syncReq.request.method).toBe('POST');
    expect(syncReq.request.body).toEqual({ force: false });
    syncReq.flush({
      success: true,
      collection: 'historical_candles/NIFTY50_5M',
      symbol: 'NIFTY 50',
      timeframe: '5m',
      sourceRepo: 'https://github.com/technovusin/nifty50-historical-data',
      mode: 'incremental',
      filesProcessed: 1,
      filesSkipped: 19,
      total1MinRows: 6200,
      totalCandlesSynced: 1245,
      totalCandlesInDb: 178452,
      monthsWritten: ['2026-11'],
      totalMonthsInDb: 116,
      firstMonth: '2017-04',
      lastMonth: '2026-11',
      firstEpoch: 1491191100,
      lastEpoch: 1795427700,
      durationMs: 320,
      syncedAt: '2026-11-24T17:05:00.000Z',
      message: 'Incremental sync completed',
    });

    const statusReq = httpTesting.expectOne('/api/historical-data/nifty50-5m/status');
    statusReq.flush({
      storedInFirestore: true,
      syncInProgress: false,
      sourceRepo: 'https://github.com/technovusin/nifty50-historical-data',
      collection: 'historical_candles/NIFTY50_5M',
      metadata: null,
    });
  });

  it('should fetch BANK NIFTY 5-minute Firestore status, sync, and query candles', () => {
    service.fetchBankNiftyStatus().subscribe((res) => {
      expect(res?.storedInFirestore).toBe(true);
      expect(res?.metadata?.symbol).toBe('BANK NIFTY');
      expect(res?.metadata?.totalCandles).toBe(98210);
    });

    const statusReq = httpTesting.expectOne('/api/historical-data/banknifty-5m/status');
    expect(statusReq.request.method).toBe('GET');
    statusReq.flush({
      storedInFirestore: true,
      syncInProgress: false,
      sourceRepo: 'https://github.com/technovusin/banknifty-historical-data',
      collection: 'historical_candles/BANKNIFTY_5M',
      metadata: {
        symbol: 'BANK NIFTY',
        securityId: '25',
        timeframe: '5m',
        sourceRepo: 'https://github.com/technovusin/banknifty-historical-data',
        collection: 'historical_candles/BANKNIFTY_5M',
        totalCandles: 98210,
        totalMonths: 64,
        firstEpoch: 1628051400,
        lastEpoch: 1795427700,
        firstMonth: '2021-08',
        lastMonth: '2026-11',
        months: ['2021-08', '2026-11'],
        monthCounts: { '2021-08': 1425, '2026-11': 1245 },
        updatedAt: '2026-11-25T14:00:00.000Z',
      },
    });
    expect(service.bankNiftyStatus()?.metadata?.totalMonths).toBe(64);

    service.syncBankNiftyFiveMin(false).subscribe((res) => {
      expect(res?.success).toBe(true);
      expect(res?.symbol).toBe('BANK NIFTY');
    });

    const syncReq = httpTesting.expectOne('/api/historical-data/banknifty-5m/sync');
    expect(syncReq.request.method).toBe('POST');
    expect(syncReq.request.body).toEqual({ force: false });
    syncReq.flush({
      success: true,
      collection: 'historical_candles/BANKNIFTY_5M',
      symbol: 'BANK NIFTY',
      timeframe: '5m',
      sourceRepo: 'https://github.com/technovusin/banknifty-historical-data',
      mode: 'incremental',
      filesProcessed: 1,
      filesSkipped: 15,
      total1MinRows: 6200,
      totalCandlesSynced: 1245,
      totalCandlesInDb: 98210,
      monthsWritten: ['2026-11'],
      totalMonthsInDb: 64,
      firstMonth: '2021-08',
      lastMonth: '2026-11',
      firstEpoch: 1628051400,
      lastEpoch: 1795427700,
      durationMs: 310,
      syncedAt: '2026-11-25T14:05:00.000Z',
      message: 'Incremental sync completed',
    });

    const refreshStatusReq = httpTesting.expectOne('/api/historical-data/banknifty-5m/status');
    refreshStatusReq.flush({
      storedInFirestore: true,
      syncInProgress: false,
      sourceRepo: 'https://github.com/technovusin/banknifty-historical-data',
      collection: 'historical_candles/BANKNIFTY_5M',
      metadata: null,
    });

    service.getBankNiftyCandles({ fromMonth: '2026-11', toMonth: '2026-11' }).subscribe((res) => {
      expect(res?.symbol).toBe('BANK NIFTY');
      expect(res?.count).toBe(1);
    });

    const candlesReq = httpTesting.expectOne(
      '/api/historical-data/banknifty-5m/candles?fromMonth=2026-11&toMonth=2026-11',
    );
    expect(candlesReq.request.method).toBe('GET');
    candlesReq.flush({
      success: true,
      symbol: 'BANK NIFTY',
      timeframe: '5m',
      monthsRead: ['2026-11'],
      count: 1,
      candles: [
        {
          epoch: 1793591100,
          timestampIST: '2026-11-02T09:15:00',
          open: 54837.2,
          high: 54978.7,
          low: 54834.85,
          close: 54981.45,
          volume: 17962230,
        },
      ],
    });
  });
});

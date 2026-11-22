import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InstrumentService } from './instrument.service';

describe('InstrumentService', () => {
  let service: InstrumentService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        InstrumentService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(InstrumentService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should fetch LTP for an instrument symbol', () => {
    let result: { symbol: string; ltp: number | null } | undefined;

    service.getLtp('NIFTY 50').subscribe((res) => {
      result = res;
    });

    const req = httpTesting.expectOne('/api/instruments/ltp?symbol=NIFTY%2050');
    expect(req.request.method).toBe('GET');
    req.flush({ symbol: 'NIFTY 50', ltp: 24536.6 });

    expect(result).toEqual({ symbol: 'NIFTY 50', ltp: 24536.6 });
  });

  it('should return empty result safely for empty symbol', () => {
    let result: { symbol: string; ltp: number | null } | undefined;

    service.getLtp('').subscribe((res) => {
      result = res;
    });

    expect(result).toEqual({ symbol: '', ltp: null });
  });

  it('should search instruments with search query', () => {
    let results: any[] | undefined;

    service.search('RELIANCE', 5).subscribe((res) => {
      results = res;
    });

    const req = httpTesting.expectOne('/api/instruments?q=RELIANCE&limit=5');
    expect(req.request.method).toBe('GET');
    req.flush([
      { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', ltp: 1313.4 },
    ]);

    expect(results?.length).toBe(1);
    expect(results?.[0].symbol).toBe('RELIANCE');
    expect(results?.[0].ltp).toBe(1313.4);
  });

  it('should fetch traded instruments master config from backend', () => {
    let result: any;
    service.fetchLotSizes().subscribe((res) => {
      result = res;
    });

    const req = httpTesting.expectOne('/api/instruments/traded-instruments');
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: { nifty50: 65, bankNifty: 30, midcapNifty: 120, sensex: 20 },
    });

    expect(result?.success).toBe(true);
    expect(service.lotSizes().nifty50).toBe(65);
    expect(service.lotSizes().bankNifty).toBe(30);
  });

  it('should update traded instruments in backend', () => {
    let result: any;
    service.updateLotSizes({ nifty50: 75, bankNifty: 35 }).subscribe((res) => {
      result = res;
    });

    const req = httpTesting.expectOne('/api/instruments/traded-instruments');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ nifty50: 75, bankNifty: 35 });
    req.flush({
      success: true,
      data: { nifty50: 75, bankNifty: 35, midcapNifty: 120, sensex: 20 },
    });

    expect(result?.success).toBe(true);
    expect(service.lotSizes().nifty50).toBe(75);
    expect(service.lotSizes().bankNifty).toBe(35);
  });

  it('should sync traded instruments from static master JSON via POST /api/instruments/traded-instruments/sync-json', () => {
    let result: any;
    service.syncTradedInstrumentsFromJson(false).subscribe((res) => {
      result = res;
    });

    const req = httpTesting.expectOne('/api/instruments/traded-instruments/sync-json');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ resetPreferences: false });
    req.flush({
      success: true,
      data: {
        source: 'static-master-json',
        nifty50: 65,
        bankNifty: 30,
        midcapNifty: 120,
        sensex: 20,
        instruments: [{ symbolName: 'NIFTY', displayName: 'Nifty 50', securityId: '13', lotSize: 65 }],
      },
      message: 'Synced 4 traded instruments from static master JSON',
    });

    // Follow-up refresh of configured indices
    const idxReq = httpTesting.expectOne('/api/instruments/indices');
    expect(idxReq.request.method).toBe('GET');
    idxReq.flush([]);

    expect(result?.success).toBe(true);
    expect(service.lotSizes().instruments?.[0].displayName).toBe('Nifty 50');
  });

  it('should fetch optionsSyncStatus from backend', () => {
    let result: any;
    service.fetchOptionsSyncStatus().subscribe((res) => {
      result = res;
    });

    const req = httpTesting.expectOne('/api/instruments/sync/options/status');
    expect(req.request.method).toBe('GET');
    req.flush({
      storedInFirestore: true,
      metadata: { totalItems: 9809, totalChunks: 20, chunkSize: 500, updatedAt: '2026-11-08T03:00:00Z' },
      inMemoryCount: 9809,
      tradedIndices: ['NIFTY', 'BANKNIFTY', 'MIDCPNIFTY', 'SENSEX'],
    });

    expect(result?.storedInFirestore).toBe(true);
    expect(service.optionsSyncStatus()?.metadata?.totalItems).toBe(9809);
  });

  it('should trigger flushAndReloadEquities and update syncStatus', () => {
    let result: any;
    service.flushAndReloadEquities().subscribe((res) => {
      result = res;
    });

    const req = httpTesting.expectOne('/api/instruments/flush-and-reload/equities');
    expect(req.request.method).toBe('POST');
    req.flush({
      success: true,
      collection: 'sec_id_to_name_mapping',
      deletedDocuments: 7,
      totalInstruments: 10162,
      totalEquities: 10158,
      totalIndices: 4,
      documents: ['chunk1', 'indices'],
      syncedAt: new Date().toISOString(),
      message: 'Equities flushed and reloaded',
    });

    const statusReq = httpTesting.expectOne('/api/instruments/sync/status');
    statusReq.flush({ storedInFirestore: true, metadata: null });
    const optReqs = httpTesting.match('/api/instruments/sync/options/status');
    optReqs.forEach((r) => r.flush({ storedInFirestore: true, metadata: null }));

    expect(result?.success).toBe(true);
    expect(result?.totalInstruments).toBe(10162);
    expect(service.lastFlushEquitiesResult()).toEqual(result);
  });

  it('should trigger flushAndReloadOptions and update optionsSyncStatus', () => {
    let result: any;
    service.flushAndReloadOptions().subscribe((res) => {
      result = res;
    });

    const req = httpTesting.expectOne('/api/instruments/flush-and-reload/options');
    expect(req.request.method).toBe('POST');
    req.flush({
      success: true,
      collection: 'index_options',
      deletedDocuments: 4,
      totalItems: 9805,
      totalChunks: 4,
      documentIds: ['NIFTY', 'BANKNIFTY'],
      writeTime: new Date().toISOString(),
      tradedIndices: ['NIFTY', 'BANKNIFTY'],
      message: 'Options flushed and reloaded',
    });

    const optReq = httpTesting.expectOne('/api/instruments/sync/options/status');
    optReq.flush({ storedInFirestore: true, metadata: null });

    expect(result?.success).toBe(true);
    expect(result?.totalItems).toBe(9805);
    expect(service.lastFlushOptionsResult()).toEqual(result);
  });
});

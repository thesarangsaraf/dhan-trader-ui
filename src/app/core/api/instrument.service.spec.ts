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

  it('should fetch index lot sizes from backend', () => {
    let result: any;
    service.fetchLotSizes().subscribe((res) => {
      result = res;
    });

    const req = httpTesting.expectOne('/api/instruments/lot-sizes');
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: { nifty50: 65, bankNifty: 30, midcapNifty: 120, sensex: 20 },
    });

    expect(result?.success).toBe(true);
    expect(service.lotSizes().nifty50).toBe(65);
    expect(service.lotSizes().bankNifty).toBe(30);
  });

  it('should update index lot sizes in backend', () => {
    let result: any;
    service.updateLotSizes({ nifty50: 75, bankNifty: 35 }).subscribe((res) => {
      result = res;
    });

    const req = httpTesting.expectOne('/api/instruments/lot-sizes');
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

  it('should trigger syncEquities and update syncStatus', () => {
    let result: any;
    service.syncEquities().subscribe((res) => {
      result = res;
    });

    const syncReq = httpTesting.expectOne('/api/instruments/sync/equities');
    expect(syncReq.request.method).toBe('POST');
    expect(syncReq.request.body).toEqual({ force: true });
    syncReq.flush({
      success: true,
      collection: 'sec_id_to_name_mapping',
      totalInstruments: 10189,
      totalEquities: 10070,
      totalIndices: 119,
      documents: ['indices', 'equities_chunk_01'],
      syncedAt: new Date().toISOString(),
    });

    const statusReq = httpTesting.expectOne('/api/instruments/sync/status');
    expect(statusReq.request.method).toBe('GET');
    statusReq.flush({
      storedInFirestore: true,
      metadata: { totalInstruments: 10189, totalEquities: 10070, totalIndices: 119 },
    });

    const optStatusReq = httpTesting.expectOne('/api/instruments/sync/options/status');
    expect(optStatusReq.request.method).toBe('GET');
    optStatusReq.flush({ storedInFirestore: true, metadata: null });

    expect(result?.success).toBe(true);
    expect(result?.totalInstruments).toBe(10189);
  });

  it('should trigger syncOptions and update optionsSyncStatus', () => {
    let result: any;
    service.syncOptions().subscribe((res) => {
      result = res;
    });

    const syncReq = httpTesting.expectOne('/api/instruments/sync/options');
    expect(syncReq.request.method).toBe('POST');
    expect(syncReq.request.body).toEqual({ force: true });
    syncReq.flush({
      success: true,
      collection: 'index_options',
      totalItems: 9809,
      totalChunks: 20,
      writeTime: new Date().toISOString(),
      tradedIndices: ['NIFTY', 'BANKNIFTY', 'MIDCPNIFTY', 'SENSEX'],
    });

    const optStatusReq = httpTesting.expectOne('/api/instruments/sync/options/status');
    expect(optStatusReq.request.method).toBe('GET');
    optStatusReq.flush({
      storedInFirestore: true,
      metadata: { totalItems: 9809, totalChunks: 20 },
      tradedIndices: ['NIFTY', 'BANKNIFTY', 'MIDCPNIFTY', 'SENSEX'],
    });

    expect(result?.success).toBe(true);
    expect(result?.totalItems).toBe(9809);
    expect(service.optionsSyncStatus()?.storedInFirestore).toBe(true);
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
});

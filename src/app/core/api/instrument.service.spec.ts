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
});

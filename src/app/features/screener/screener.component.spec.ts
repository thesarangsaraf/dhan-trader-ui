import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { ScreenerComponent } from './screener.component';
import { ScreenerService } from '../../core/api/screener.service';
import { ScreenerSignal, ScanResultResponse } from '../../core/models/screener.models';

describe('ScreenerComponent', () => {
  let component: ScreenerComponent;
  let fixture: ComponentFixture<ScreenerComponent>;
  let screenerService: ScreenerService;

  const mockSignal: ScreenerSignal = {
    id: 'TEST_SIG_1',
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
    timestamp: '2026-11-20T12:00:00Z',
    scannedSymbolsCount: 4,
    matchedSymbolsCount: 1,
    totalCandlesScanned: 1000,
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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScreenerComponent],
      providers: [
        ScreenerService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    screenerService = TestBed.inject(ScreenerService);
    screenerService.signals.set([]);
    screenerService.summary.set(null);
    screenerService.selectedSignal.set(null);

    // Mock runScan to return immediately without real HTTP
    screenerService.runScan = () => {
      screenerService.signals.set([mockSignal]);
      screenerService.summary.set(mockScanResponse.summary);
      screenerService.scanResult.set(mockScanResponse);
      screenerService.selectedSignal.set(mockSignal);
      return of(mockScanResponse);
    };

    fixture = TestBed.createComponent(ScreenerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the screener component', () => {
    expect(component).toBeTruthy();
  });

  it('should not auto run the scan on initialization', () => {
    // Signals must remain empty until user explicitly clicks Run Scanner
    expect(screenerService.signals().length).toBe(0);
    expect(screenerService.summary()).toBeNull();
  });

  it('should trigger onRunScreener only when user clicks run and populate signals', () => {
    expect(screenerService.signals().length).toBe(0);
    component.onRunScreener();
    expect(screenerService.signals().length).toBe(1);
    expect(screenerService.signals()[0].symbol).toBe('NIFTY 50');
    expect(screenerService.summary()?.winRate).toBe(100);
    expect(screenerService.selectedSignal()).toEqual(mockSignal);
  });

  it('should switch scope and lookback window cleanly', () => {
    component.setScope('indices');
    expect(screenerService.scope()).toBe('indices');

    component.onLookbackChange('30d');
    expect(screenerService.lookbackPeriod()).toBe('30d');
  });

  it('should select signal on row click', () => {
    component.onSelectSignal(mockSignal);
    expect(screenerService.selectedSignal()?.id).toBe('TEST_SIG_1');
  });
});

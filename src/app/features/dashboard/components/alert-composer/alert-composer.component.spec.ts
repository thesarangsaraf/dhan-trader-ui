import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AlertComposerComponent } from './alert-composer.component';
import { InstrumentService } from '../../../../core/api/instrument.service';

describe('AlertComposerComponent', () => {
  let component: AlertComposerComponent;
  let fixture: ComponentFixture<AlertComposerComponent>;

  const mockDialog = {
    open: vi.fn().mockReturnValue({
      afterClosed: () => of(false),
    }),
  };

  const mockInstService = {
    getInstruments: vi.fn().mockReturnValue(
      of([
        {
          symbol: 'NIFTY 50',
          name: 'Nifty 50 Index',
          securityId: '13',
          exchangeSegment: 'IDX_I',
          instrumentType: 'INDEX',
          lotSize: 65,
          ltp: 25030.0,
        },
        {
          symbol: 'NIFTY BANK',
          name: 'Bank Nifty Index',
          securityId: '25',
          exchangeSegment: 'IDX_I',
          instrumentType: 'INDEX',
          lotSize: 30,
          ltp: 52000.0,
        },
      ]),
    ),
    getLtp: vi.fn().mockReturnValue(of({ symbol: 'NIFTY 50', ltp: 25030.0 })),
    getExpiries: vi.fn().mockReturnValue(of([{ expiryDate: '2026-11-12', displayExpiry: '12 Nov 2026', shortExpiry: '12NOV' }])),
    getOptionContracts: vi.fn().mockReturnValue(
      of({
        instrument: 'NIFTY 50',
        spotPrice: 25030.0,
        strikeStep: 50,
        currentExpiry: {
          expiryDate: '2026-11-12',
          strikes: [
            {
              strikePrice: 25000,
              relativeStrike: 'ATM',
              call: {
                symbol: 'NIFTY 12 NOV 25000 CALL',
                tradingSymbol: 'NIFTY-12Nov2026-25000-CE',
                instrumentName: 'NIFTY 50',
                strikePrice: 25000,
                optionType: 'CE',
                expiryDate: '2026-11-12',
                expiryType: 'CURRENT',
                securityId: '40037',
                exchangeSegment: 'NSE_FNO',
                lotSize: 65,
                ltp: 120.0,
                moneyness: 'ATM',
              },
              put: {
                symbol: 'NIFTY 12 NOV 25000 PUT',
                tradingSymbol: 'NIFTY-12Nov2026-25000-PE',
                instrumentName: 'NIFTY 50',
                strikePrice: 25000,
                optionType: 'PE',
                expiryDate: '2026-11-12',
                expiryType: 'CURRENT',
                securityId: '40038',
                exchangeSegment: 'NSE_FNO',
                lotSize: 65,
                ltp: 95.0,
                moneyness: 'ATM',
              },
            },
          ],
        },
      }),
    ),
    fetchLotSizes: vi.fn().mockReturnValue(
      of({
        success: true,
        data: { nifty50: 65, bankNifty: 30, finNifty: 65, midcapNifty: 120, sensex: 20 },
      }),
    ),
    fetchConfiguredIndices: vi.fn().mockReturnValue(
      of([
        {
          symbol: 'NIFTY 50',
          name: 'Nifty 50 Index',
          securityId: '13',
          exchangeSegment: 'IDX_I',
          instrumentType: 'INDEX',
          lotSize: 65,
          defaultLots: 5,
          defaultQuantity: 325,
          ltp: 25030.0,
        },
        {
          symbol: 'BANK NIFTY',
          name: 'Bank Nifty Index',
          securityId: '25',
          exchangeSegment: 'IDX_I',
          instrumentType: 'INDEX',
          lotSize: 30,
          defaultLots: 5,
          defaultQuantity: 150,
          ltp: 52000.0,
        },
      ]),
    ),
    lotSizes: vi.fn().mockReturnValue({
      nifty50: 65,
      bankNifty: 30,
      finNifty: 65,
      midcapNifty: 120,
      sensex: 20,
      nifty50Lots: 5,
      bankNiftyLots: 5,
      finNiftyLots: 5,
      midcapNiftyLots: 5,
      sensexLots: 5,
    }),
  };

  beforeEach(async () => {
    mockDialog.open.mockClear();

    await TestBed.configureTestingModule({
      imports: [AlertComposerComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        { provide: InstrumentService, useValue: mockInstService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AlertComposerComponent);
    component = fixture.componentInstance;
    (component as any).dialog = mockDialog;
    fixture.detectChanges();
  });

  it('should initialize with default 5 lots for NIFTY 50 and compute 325 total shares', () => {
    expect(component.isNifty50()).toBe(true);
    expect(component.orderLots).toBe(5);
    expect(component.currentContractLotSize()).toBe(65);
    expect(component.totalOrderQuantity()).toBe(325); // 5 * 65
  });

  it('should update lots and total quantity when quick buttons are clicked', () => {
    component.setLots(10);
    expect(component.orderLots).toBe(10);
    expect(component.totalOrderQuantity()).toBe(650); // 10 * 65

    component.setLots(15);
    expect(component.orderLots).toBe(15);
    expect(component.totalOrderQuantity()).toBe(975); // 15 * 65
  });

  it('should set operator to LESS_THAN when target price is below current LTP', () => {
    component.currentLtp = 25030.0;
    component.targetPrice = 25000.0; // below 25030

    component.submitAlert();
    expect(mockDialog.open).toHaveBeenCalled();
    const passedData = mockDialog.open.mock.calls[0][1].data;
    expect(passedData.operator).toBe('LESS_THAN');
  });

  it('should set operator to GREATER_THAN when target price is above or equal to current LTP', () => {
    component.currentLtp = 25030.0;
    component.targetPrice = 25100.0; // above 25030

    component.submitAlert();
    expect(mockDialog.open).toHaveBeenCalled();
    const passedData = mockDialog.open.mock.calls[0][1].data;
    expect(passedData.operator).toBe('GREATER_THAN');
  });

  it('should construct Dhan payload with total computed shares (325 for 5 lots) rather than raw lot count', () => {
    component.executeOrderOnTrigger = true;
    component.orderLots = 5;
    component.orderSecurityId = '40037';
    component.targetPrice = 25000.0;

    component.submitAlert();
    expect(mockDialog.open).toHaveBeenCalled();
    const passedData = mockDialog.open.mock.calls[0][1].data;
    expect(passedData.dhanPayload.orders[0].quantity).toBe(325); // 5 lots * 65 = 325 shares, not 5
  });

  it('should default Stop Loss points to 12 for NIFTY 50 and 20 for BANK NIFTY', () => {
    component.onInstrumentChange('NIFTY 50');
    expect(component.stopLossPoints()).toBe(12);

    component.onInstrumentChange('NIFTY BANK');
    expect(component.stopLossPoints()).toBe(20);
  });

  it('should calculate Stop Loss price correctly: entry - 12 for Nifty Buy Call, entry + 12 for Nifty Sell/Put', () => {
    component.onInstrumentChange('NIFTY 50');
    component.targetPrice = 25017.0;

    // 1. BUY CALL (Bullish breakout / Buy order) -> entry - 12 = 25005.0
    component.orderAction = 'BUY';
    expect(component.stopLossPrice()).toBe(25005.0);
    expect(component.stopLossOperator()).toBe('LESS_THAN');

    // 2. BUY PUT (Bearish breakdown / Sell order) -> entry + 12 = 25029.0
    component.orderAction = 'SELL';
    expect(component.stopLossPrice()).toBe(25029.0);
    expect(component.stopLossOperator()).toBe('GREATER_THAN');
  });

  it('should calculate Stop Loss price correctly: entry - 20 for Bank Nifty Buy, entry + 20 for Bank Nifty Sell/Put', () => {
    component.onInstrumentChange('NIFTY BANK');
    component.targetPrice = 51850.0;

    // 1. Bank Nifty BUY -> entry - 20 = 51830.0
    component.orderAction = 'BUY';
    expect(component.stopLossPrice()).toBe(51830.0);

    // 2. Bank Nifty SELL / PUT -> entry + 20 = 51870.0
    component.orderAction = 'SELL';
    expect(component.stopLossPrice()).toBe(51870.0);
  });

  it('should include stopLoss configuration and planned SL Dhan payload in preview dialog data', () => {
    component.onInstrumentChange('NIFTY 50');
    component.targetPrice = 25017.0;
    component.executeOrderOnTrigger = true;
    component.orderAction = 'BUY';
    component.orderLots = 5;

    component.submitAlert();
    expect(mockDialog.open).toHaveBeenCalled();
    const passedData = mockDialog.open.mock.calls[0][1].data;

    expect(passedData.stopLoss).toBeDefined();
    expect(passedData.stopLoss.enabled).toBe(true);
    expect(passedData.stopLoss.points).toBe(12);
    expect(passedData.stopLoss.targetPrice).toBe(25005.0);
    expect(passedData.stopLoss.operator).toBe('LESS_THAN');
    expect(passedData.stopLoss.action).toBe('SELL');

    expect(passedData.slDhanPayload).toBeDefined();
    expect(passedData.slDhanPayload.condition.comparingValue).toBe(25005.0);
    expect(passedData.slDhanPayload.orders[0].transactionType).toBe('SELL');
    expect(passedData.slDhanPayload.orders[0].quantity).toBe(325);
  });

  it('should not render product dropdown, order type dropdown, lot number input, or SL points input', () => {
    component.executeOrderOnTrigger = true;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    // 1. Product & Type selectors must not exist in DOM
    const productSelect = compiled.querySelector('mat-select[name="productType"]');
    const orderTypeSelect = compiled.querySelector('mat-select[name="orderType"]');
    expect(productSelect).toBeNull();
    expect(orderTypeSelect).toBeNull();

    // 2. Number of lots text box must not exist
    const lotsInput = compiled.querySelector('input[name="orderLots"]');
    expect(lotsInput).toBeNull();

    // 3. Fixed lots selection buttons (5, 10, 15) must exist
    const lotButtons = compiled.querySelectorAll('.lot-select-btn');
    expect(lotButtons.length).toBe(3);
    expect(lotButtons[0].textContent).toContain('5 Lots');
    expect(lotButtons[1].textContent).toContain('10 Lots');
    expect(lotButtons[2].textContent).toContain('15 Lots');

    // 4. Stop Loss points input box must not exist
    const slInput = compiled.querySelector('input[name="stopLossPoints"]');
    expect(slInput).toBeNull();

    // 5. Defined SL points pill must be displayed
    const definedSlTag = compiled.querySelector('.sl-defined-tag');
    expect(definedSlTag).not.toBeNull();
    expect(definedSlTag?.textContent).toContain('12 Points');
  });

  it('should load configured indices from instrument service into dropdown', () => {
    mockInstService.fetchConfiguredIndices.mockReturnValue(
      of([
        { symbol: 'NIFTY 50', name: 'Nifty 50 Index', securityId: '13', exchangeSegment: 'IDX_I', instrumentType: 'INDEX', lotSize: 65, defaultLots: 5, defaultQuantity: 325, ltp: 24500 },
        { symbol: 'BANK NIFTY', name: 'Bank Nifty Index', securityId: '25', exchangeSegment: 'IDX_I', instrumentType: 'INDEX', lotSize: 30, defaultLots: 5, defaultQuantity: 150, ltp: 52000 },
        { symbol: 'SENSEX', name: 'BSE Sensex Index', securityId: '51', exchangeSegment: 'IDX_I', instrumentType: 'INDEX', lotSize: 20, defaultLots: 5, defaultQuantity: 100, ltp: 80000 },
        { symbol: 'MIDCAP NIFTY', name: 'Nifty Midcap Select', securityId: '442', exchangeSegment: 'IDX_I', instrumentType: 'INDEX', lotSize: 120, defaultLots: 5, defaultQuantity: 600, ltp: 12000 },
      ])
    );

    component.loadInstruments();
    const symbols = component.instruments().map((i) => i.symbol);
    expect(symbols).toEqual(['NIFTY 50', 'BANK NIFTY', 'SENSEX', 'MIDCAP NIFTY']);
  });

  it('should not show LTP badge in header, should not show zero latency tag, and should display Attach Order with Alert', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    // LTP badge beside Conditional Alert Composer must not exist
    const ltpBadge = compiled.querySelector('.composer-header .ltp-badge');
    expect(ltpBadge).toBeNull();

    // Sub-millisecond Local Bridge text must not exist
    expect(compiled.textContent).not.toContain('Sub-millisecond Local Bridge');

    // Attach Order with Alert text must be present
    expect(compiled.querySelector('.toggle-text')?.textContent).toContain('Attach Order with Alert');
  });

  it('should not show ATM - 1, ATM, or relative strike tags when selecting option contracts', () => {
    component.executeOrderOnTrigger = true;
    component.targetPrice = 25000;
    component.loadOptionContracts();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const strikeChips = compiled.querySelectorAll('.strike-chip');
    expect(strikeChips.length).toBeGreaterThan(0);

    // .strike-tag element must not exist in any chip
    const strikeTags = compiled.querySelectorAll('.strike-tag');
    expect(strikeTags.length).toBe(0);

    // None of the strike chips should contain 'ATM' text
    strikeChips.forEach((chip) => {
      expect(chip.textContent).not.toContain('ATM');
      expect(chip.textContent).toContain('25000 CE');
    });
  });
});

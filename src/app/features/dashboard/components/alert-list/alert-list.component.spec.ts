import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AlertListComponent } from './alert-list.component';
import { AlertService } from '../../../../core/api/alert.service';
import { InstrumentService } from '../../../../core/api/instrument.service';
import { DhanAlert } from '../../../../core/models/alert.models';

describe('AlertListComponent', () => {
  let component: AlertListComponent;
  let fixture: ComponentFixture<AlertListComponent>;
  let alertService: AlertService;
  let instrumentService: InstrumentService;
  let mockDialog: { open: ReturnType<typeof vi.fn> };

  const mockAlerts: DhanAlert[] = [
    {
      id: 'ALT-1003',
      instrument: 'RELIANCE',
      securityId: '2885',
      exchangeSegment: 'NSE_EQ',
      targetPrice: 3000.0,
      operator: 'GREATER_THAN_EQUAL',
      status: 'CANCELLED',
      remarks: 'No attached order alert',
      createdAt: '2026-11-06T09:30:00.000Z',
    },
    {
      id: 'ALT-1001',
      instrument: 'NIFTY 50',
      securityId: '13',
      exchangeSegment: 'IDX_I',
      targetPrice: 24950.0,
      operator: 'GREATER_THAN_EQUAL',
      status: 'ACTIVE',
      remarks: 'Breakout above 24950',
      createdAt: '2026-11-06T10:00:00.000Z',
      attachedOrder: {
        enabled: true,
        action: 'BUY',
        symbol: 'NIFTY 24500 CE',
        quantity: 325,
        lotSize: 65,
        lots: 5,
        orderType: 'MARKET',
        productType: 'INTRADAY',
        status: 'PENDING',
      },
    },
    {
      id: 'ALT-1002',
      instrument: 'BANKNIFTY',
      securityId: '25',
      exchangeSegment: 'IDX_I',
      targetPrice: 51800.0,
      operator: 'LESS_THAN_EQUAL',
      status: 'TRIGGERED',
      remarks: 'Support breakdown',
      createdAt: '2026-11-06T10:15:00.000Z',
      triggeredAt: '2026-11-06T10:45:00.000Z',
      conditionalOrders: [
        {
          symbol: 'BANKNIFTY 52000 PE',
          action: 'SELL',
          quantity: 30,
          orderType: 'LIMIT',
          productType: 'INTRADAY',
          price: 185.5,
          status: 'PLACED',
          orderId: 'DHAN-ORD-999',
        },
      ],
    },
  ];

  beforeEach(async () => {
    mockDialog = {
      open: vi.fn().mockReturnValue({ afterClosed: () => of(true) }),
    };

    await TestBed.configureTestingModule({
      imports: [AlertListComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: MatDialog,
          useValue: mockDialog,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AlertListComponent);
    component = fixture.componentInstance;
    (component as any).dialog = mockDialog;
    alertService = TestBed.inject(AlertService);
    instrumentService = TestBed.inject(InstrumentService);

    // Populate alerts signal with test data
    alertService.alerts.set(mockAlerts);
    alertService.alertsError.set(null);
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should split alerts into two sections and prioritize Alerts with Orders on top', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    // Verify filter tabs are NOT present
    expect(compiled.querySelector('.filter-tabs')).toBeNull();
    expect(compiled.querySelectorAll('.tab-btn').length).toBe(0);

    // Verify two sections exist in priority order: Alerts with Orders first, Price Alerts second
    const sections = compiled.querySelectorAll('.alert-section');
    expect(sections.length).toBe(2);
    expect(sections[0].classList.contains('order-alerts-section')).toBe(true);
    expect(sections[0].querySelector('.section-title')?.textContent?.trim()).toBe('Alerts with Orders');
    expect(sections[0].querySelector('.section-count-badge')?.textContent?.trim()).toBe('2');

    expect(sections[1].classList.contains('price-alerts-section')).toBe(true);
    expect(sections[1].querySelector('.section-title')?.textContent?.trim()).toBe('Price Alerts');
    expect(sections[1].querySelector('.section-count-badge')?.textContent?.trim()).toBe('1');

    // Even though RELIANCE was first in mockAlerts, NIFTY 50 & BANKNIFTY (with orders) render first
    const items = compiled.querySelectorAll('.alert-item');
    expect(items.length).toBe(3);
    expect(items[0].textContent).toContain('NIFTY 50');
    expect(items[1].textContent).toContain('BANKNIFTY');
    expect(items[2].textContent).toContain('RELIANCE');
  });

  it('should NOT display LTP anywhere in the alert monitor', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const textContent = compiled.textContent || '';

    expect(textContent).not.toContain('LTP:');
    expect(compiled.querySelector('.col-distance')).toBeNull();
    expect(compiled.querySelector('.distance-sub')).toBeNull();
  });

  it('should display linked order details in an organized 4-column table', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const orderCards = compiled.querySelectorAll('.order-alert-card');
    expect(orderCards.length).toBe(2);

    // Verify table headers
    const headers = Array.from(orderCards[0].querySelectorAll('thead th')).map((th) =>
      th.textContent?.trim()
    );
    expect(headers).toEqual(['Side', 'Contract', 'Lots', 'Trigger Price']);

    // First order alert: NIFTY 24500 CE BUY, 5 lots, trigger ₹24,950.00
    const firstRows = orderCards[0].querySelectorAll('tbody tr.order-leg-row');
    expect(firstRows.length).toBe(1);
    expect(firstRows[0].querySelector('.col-side')?.textContent?.trim()).toBe('BUY');
    expect(firstRows[0].querySelector('.col-contract')?.textContent).toContain('NIFTY 24500 CE');
    expect(firstRows[0].querySelector('.col-lots')?.textContent?.trim()).toBe('5');
    expect(firstRows[0].querySelector('.col-trigger')?.textContent?.trim()).toBe('₹24,950.00');
    // Ensure NSE_FNO, Sec ID, and INTRADAY are NOT displayed
    expect(firstRows[0].textContent).not.toContain('INTRADAY');
    expect(firstRows[0].textContent).not.toContain('NSE_FNO');
    expect(firstRows[0].textContent).not.toContain('Sec ID');

    // Second order alert: BANKNIFTY 52000 PE SELL with orderId and limit price, qty fallback
    const secondRows = orderCards[1].querySelectorAll('tbody tr.order-leg-row');
    expect(secondRows.length).toBe(1);
    expect(secondRows[0].querySelector('.col-side')?.textContent?.trim()).toBe('SELL');
    expect(secondRows[0].querySelector('.col-contract')?.textContent).toContain('BANKNIFTY 52000 PE');
    expect(secondRows[0].querySelector('.col-contract')?.textContent).toContain('#DHAN-ORD-999');
    expect(secondRows[0].querySelector('.col-contract')?.textContent).toContain('LIMIT');
    expect(secondRows[0].querySelector('.col-lots')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('30 qty');
    expect(secondRows[0].querySelector('.col-trigger')?.textContent?.trim()).toBe('₹51,800.00');

    // Price-only alert card has NO order table
    const priceCards = compiled.querySelectorAll('.price-alert-card');
    expect(priceCards.length).toBe(1);
    expect(priceCards[0].querySelector('.order-legs-table')).toBeNull();
  });

  it('should compute lots dynamically from InstrumentService lotSizes when backend lots is omitted', () => {
    instrumentService.lotSizes.set({
      nifty50: 65,
      bankNifty: 30,
      midcapNifty: 120,
      sensex: 20,
      nifty50Lots: 5,
      bankNiftyLots: 5,
      midcapNiftyLots: 5,
      sensexLots: 5,
      indices: [],
    });

    alertService.alerts.set([
      {
        id: 'ALT-LOT-TEST',
        instrument: 'NIFTY 50',
        securityId: '13',
        exchangeSegment: 'IDX_I',
        targetPrice: 25257,
        operator: 'LESS_THAN',
        status: 'ACTIVE',
        remarks: '',
        createdAt: '2026-11-18T10:00:00.000Z',
        conditionalOrders: [
          {
            symbol: 'NIFTY 23 NOV 25250 PUT',
            action: 'BUY',
            quantity: 975,
            exchangeSegment: 'NSE_FNO',
          },
        ],
      },
    ]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const lotsCell = compiled.querySelector('td.col-lots');
    expect(lotsCell?.textContent?.trim()).toBe('15');
  });

  it('should render webhook callback configured pill/icon when webhookConfigured or webhookUrl is set', () => {
    alertService.alerts.set([
      {
        id: 'ALT-WEBHOOK-TEST',
        instrument: 'NIFTY 50',
        securityId: '13',
        exchangeSegment: 'IDX_I',
        targetPrice: 24500,
        operator: 'GREATER_THAN_EQUAL',
        status: 'ACTIVE',
        remarks: 'Webhook alert',
        createdAt: '2026-11-20T10:00:00.000Z',
        webhookConfigured: true,
        webhookUrl: 'https://api.example.com/api/webhooks/dhan',
        conditionalOrders: [
          {
            symbol: 'NIFTY 28 NOV 24500 CALL',
            action: 'BUY',
            quantity: 50,
            exchangeSegment: 'NSE_FNO',
          },
        ],
      },
    ]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const webhookPill = compiled.querySelector('.webhook-pill');
    expect(webhookPill).toBeTruthy();
    expect(webhookPill?.textContent).toContain('Webhook');
    expect(webhookPill?.querySelector('.webhook-icon')?.textContent?.trim()).toBe('webhook');
  });

  it('should NOT show cancel button or breakout/breakdown badges, only delete button', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const items = compiled.querySelectorAll('.alert-item');

    // No cancel alert button anywhere
    expect(compiled.querySelectorAll('.action-icon-btn.cancel').length).toBe(0);

    // Delete buttons should be present on every card
    expect(compiled.querySelectorAll('.action-icon-btn.delete').length).toBe(items.length);

    // Operator badge (< breakout, > breakdown) is removed
    expect(compiled.querySelectorAll('.operator-badge').length).toBe(0);
    const targetCols = compiled.querySelectorAll('.col-target');
    targetCols.forEach((col) => {
      expect(col.textContent).not.toContain('Breakout');
      expect(col.textContent).not.toContain('Breakdown');
      expect(col.textContent).toContain('Target');
    });
  });

  it('should format expiry dates and extract strike and option type details', () => {
    expect(component.formatExpiry('2026-11-09')).toBe('09 Nov 2026');
    expect(component.formatExpiry('2026-11-26')).toBe('26 Nov 2026');

    const optDetails = component.getOptionDetails({ symbol: 'NIFTY 09 NOV 25000 CALL', quantity: 65 });
    expect(optDetails.strike).toBe(25000);
    expect(optDetails.type).toBe('CALL (CE)');

    const peDetails = component.getOptionDetails({ symbol: 'BANKNIFTY-Nov2026-52000-PE', quantity: 30 });
    expect(peDetails.strike).toBe(52000);
    expect(peDetails.type).toBe('PUT (PE)');

    // Ensure securityId fallback like "SEC-40040" is NEVER erroneously parsed as a strike price
    const secIdFallback = component.getOptionDetails({ symbol: 'SEC-40040', securityId: '40040', quantity: 65 });
    expect(secIdFallback.strike).toBeUndefined();

    // Ensure explicit strikePrice and optionType take priority
    const explicitDetails = component.getOptionDetails({
      symbol: 'SEC-40040',
      strikePrice: 25050,
      optionType: 'PE',
      quantity: 325,
    });
    expect(explicitDetails.strike).toBe(25050);
    expect(explicitDetails.type).toBe('PUT (PE)');
  });

  it('should correctly prioritize contract symbol and instrument name over security ID fallback', () => {
    const alert: DhanAlert = mockAlerts[1];

    expect(
      component.getDisplaySymbol(
        { symbol: 'SEC-40040', customSymbol: 'NIFTY 09 NOV 25050 PUT', quantity: 325 },
        alert
      )
    ).toBe('NIFTY 09 NOV 25050 PUT');

    expect(
      component.getDisplaySymbol(
        { symbol: 'SEC-40040', instrumentName: 'NIFTY 09 NOV 25050 PUT', quantity: 325 },
        alert
      )
    ).toBe('NIFTY 09 NOV 25050 PUT');

    expect(
      component.getDisplaySymbol(
        { symbol: 'SEC-40040', strikePrice: 25050, optionType: 'PE', quantity: 325 },
        alert
      )
    ).toBe('NIFTY 50 25050 PE');
  });

  it('should render BUY and SELL legs in a single unified table without Stop Loss banner text or double rupee symbols', () => {
    const slAlerts: DhanAlert[] = [
      {
        id: 'ALT-SL-PARENT',
        instrument: 'NIFTY 50',
        securityId: '13',
        exchangeSegment: 'IDX_I',
        targetPrice: 25257.0,
        operator: 'LESS_THAN',
        status: 'ACTIVE',
        remarks: 'Entry at 25257',
        createdAt: '2026-11-18T10:00:00.000Z',
        stopLoss: {
          enabled: true,
          points: 12,
          targetPrice: 25269.0,
          operator: 'GREATER_THAN',
          action: 'SELL',
        },
        attachedOrder: {
          symbol: 'NIFTY 23 NOV 25250 PUT',
          quantity: 975,
          lotSize: 65,
          lots: 15,
          action: 'BUY',
        },
      },
      {
        id: 'ALT-SL-CHILD',
        instrument: 'NIFTY 50',
        securityId: '13',
        exchangeSegment: 'IDX_I',
        targetPrice: 25269.0,
        operator: 'GREATER_THAN',
        status: 'ACTIVE',
        remarks: '[STOP LOSS] Exit for #ALT-SL-PARENT (NIFTY 23 NOV 25250 PUT)',
        createdAt: '2026-11-18T10:00:01.000Z',
        isStopLossAlert: true,
        parentAlertId: 'ALT-SL-PARENT',
        conditionalOrders: [
          {
            symbol: 'NIFTY 23 NOV 25250 PUT',
            quantity: 975,
            lotSize: 65,
            lots: 15,
            transactionType: 'SELL',
          },
        ],
      },
    ];

    alertService.alerts.set(slAlerts);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const items = compiled.querySelectorAll('.alert-item');

    // CRITICAL: Must be rendered as EXACTLY 1 unified order card, not 2 separate cards!
    expect(items.length).toBe(1);

    const unifiedCard = items[0];
    const textContent = unifiedCard.textContent || '';

    // Two table rows: BUY leg and SELL leg
    const rows = unifiedCard.querySelectorAll('tbody tr.order-leg-row');
    expect(rows.length).toBe(2);

    // Row 1: BUY leg
    expect(rows[0].querySelector('.col-side')?.textContent?.trim()).toBe('BUY');
    expect(rows[0].querySelector('.col-contract')?.textContent).toContain('NIFTY 23 NOV 25250 PUT');
    expect(rows[0].querySelector('.col-lots')?.textContent?.trim()).toBe('15');
    expect(rows[0].querySelector('.col-trigger')?.textContent?.trim()).toBe('₹25,257.00');

    // Row 2: SELL leg
    expect(rows[1].querySelector('.col-side')?.textContent?.trim()).toBe('SELL');
    expect(rows[1].querySelector('.col-contract')?.textContent).toContain('NIFTY 23 NOV 25250 PUT');
    expect(rows[1].querySelector('.col-lots')?.textContent?.trim()).toBe('15');
    expect(rows[1].querySelector('.col-trigger')?.textContent?.trim()).toBe('₹25,269.00');

    // Must NOT show cluttered Stop Loss banner text, point distance, Square Off, or double ₹₹
    expect(textContent).not.toContain('Stop Loss');
    expect(textContent).not.toContain('-12 pts');
    expect(textContent).not.toContain('Square Off:');
    expect(textContent).not.toContain('₹₹');
    expect(textContent).not.toContain('SL Alert #');
  });

  it('should render multiple trades with attached exits as separate unified cards (no card scattering)', () => {
    const multiAlerts: DhanAlert[] = [
      {
        id: 'NIFTY-BUY',
        instrument: 'NIFTY 50',
        securityId: '13',
        exchangeSegment: 'IDX_I',
        targetPrice: 25017.0,
        operator: 'LESS_THAN',
        status: 'ACTIVE',
        remarks: 'Nifty trade',
        createdAt: '2026-11-06T10:00:00.000Z',
        stopLoss: { enabled: true, points: 12, targetPrice: 25005.0, action: 'SELL' },
        attachedOrder: { symbol: 'NIFTY 25000 CE', quantity: 325, lots: 5, lotSize: 65, action: 'BUY' },
      },
      {
        id: 'NIFTY-SL',
        instrument: 'NIFTY 50',
        securityId: '13',
        exchangeSegment: 'IDX_I',
        targetPrice: 25005.0,
        operator: 'LESS_THAN',
        status: 'ACTIVE',
        remarks: '[STOP LOSS] Exit for #NIFTY-BUY',
        createdAt: '2026-11-06T10:00:01.000Z',
        isStopLossAlert: true,
        parentAlertId: 'NIFTY-BUY',
        conditionalOrders: [{ symbol: 'NIFTY 25000 CE', quantity: 325, lots: 5, lotSize: 65, transactionType: 'SELL' }],
      },
      {
        id: 'BANK-BUY',
        instrument: 'BANKNIFTY',
        securityId: '25',
        exchangeSegment: 'IDX_I',
        targetPrice: 52000.0,
        operator: 'LESS_THAN',
        status: 'ACTIVE',
        remarks: 'Bank trade',
        createdAt: '2026-11-06T10:05:00.000Z',
        stopLoss: { enabled: true, points: 20, targetPrice: 51980.0, action: 'SELL' },
        attachedOrder: { symbol: 'BANKNIFTY 52000 PE', quantity: 150, lots: 5, lotSize: 30, action: 'BUY' },
      },
      {
        id: 'BANK-SL',
        instrument: 'BANKNIFTY',
        securityId: '25',
        exchangeSegment: 'IDX_I',
        targetPrice: 51980.0,
        operator: 'GREATER_THAN',
        status: 'ACTIVE',
        remarks: '[STOP LOSS] Exit for #BANK-BUY',
        createdAt: '2026-11-06T10:05:01.000Z',
        isStopLossAlert: true,
        parentAlertId: 'BANK-BUY',
        conditionalOrders: [{ symbol: 'BANKNIFTY 52000 PE', quantity: 150, lots: 5, lotSize: 30, transactionType: 'SELL' }],
      },
    ];

    alertService.alerts.set(multiAlerts);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const items = compiled.querySelectorAll('.alert-item');

    // 4 Dhan alerts collapsed into exactly 2 unified trade order cards
    expect(items.length).toBe(2);

    // Trade 1 is NIFTY with BUY & SELL legs
    const niftyRows = items[0].querySelectorAll('tbody tr.order-leg-row');
    expect(niftyRows.length).toBe(2);
    expect(niftyRows[0].textContent).toContain('25,017.00');
    expect(niftyRows[1].textContent).toContain('25,005.00');

    // Trade 2 is BANKNIFTY with BUY & SELL legs
    const bankRows = items[1].querySelectorAll('tbody tr.order-leg-row');
    expect(bankRows.length).toBe(2);
    expect(bankRows[0].textContent).toContain('52,000.00');
    expect(bankRows[1].textContent).toContain('51,980.00');
  });

  it('should NOT attach stop loss of other orders to an order placed without stop loss', () => {
    const alerts: DhanAlert[] = [
      {
        id: '1106885516_A_1794049765167_909',
        dhanAlertId: '1106885516_A_1794049765167_909',
        instrument: 'NIFTY 50',
        securityId: '13',
        exchangeSegment: 'IDX_I',
        targetPrice: 25060,
        operator: 'GREATER_THAN',
        status: 'ACTIVE',
        remarks: 'Alert for NIFTY 50 @ ₹25060',
        createdAt: '2026-11-07T11:09:25.000Z',
        stopLoss: { enabled: true, points: 12, targetPrice: 25072, operator: 'GREATER_THAN', action: 'SELL' },
        stopLossAlertPlaced: true,
        stopLossAlertId: '1106885516_B_1794049765210_485',
        attachedOrder: {
          symbol: 'NIFTY 09 NOV 25050 PUT',
          quantity: 975,
          lots: 15,
          lotSize: 65,
          action: 'BUY',
        },
      },
      {
        id: '1106885516_B_1794049765210_485',
        dhanAlertId: '1106885516_B_1794049765210_485',
        instrument: 'NIFTY 50',
        securityId: '13',
        exchangeSegment: 'IDX_I',
        targetPrice: 25072,
        operator: 'GREATER_THAN',
        status: 'ACTIVE',
        remarks: '[STOP LOSS] Exit for #1106885516_A_1794049765167_909 (NIFTY 09 NOV 25050 PUT)',
        createdAt: '2026-11-07T11:09:25.000Z',
        isStopLossAlert: true,
        parentAlertId: '1106885516_A_1794049765167_909',
        attachedOrder: {
          symbol: 'NIFTY 09 NOV 25050 PUT',
          quantity: 975,
          lots: 15,
          lotSize: 65,
          action: 'SELL',
        },
      },
      {
        id: '1106885516_B_1794049849812_285',
        dhanAlertId: '1106885516_B_1794049849812_285',
        instrument: 'NIFTY 50',
        securityId: '13',
        exchangeSegment: 'IDX_I',
        targetPrice: 25000,
        operator: 'LESS_THAN',
        status: 'ACTIVE',
        remarks: 'Alert for NIFTY 50 @ ₹25000',
        createdAt: '2026-11-07T11:10:49.000Z',
        attachedOrder: {
          symbol: 'NIFTY 09 NOV 25000 CALL',
          quantity: 325,
          lots: 5,
          lotSize: 65,
          action: 'BUY',
        },
      },
    ];

    alertService.alerts.set(alerts);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const items = compiled.querySelectorAll('.alert-item');

    expect(items.length).toBe(2);

    // Trade 1 Card has 2 rows (BUY + SELL)
    const trade1Rows = items[0].querySelectorAll('tbody tr.order-leg-row');
    expect(trade1Rows.length).toBe(2);
    expect(items[0].textContent).toContain('25,060.00');
    expect(items[0].textContent).toContain('25,072.00');

    // Trade 2 Card has ONLY 1 row (BUY only, no leaked SELL row)
    const trade2Rows = items[1].querySelectorAll('tbody tr.order-leg-row');
    expect(trade2Rows.length).toBe(1);
    expect(items[1].textContent).toContain('25,000.00');
    expect(items[1].textContent).not.toContain('25,072');
  });

  it('should render orphan SELL order alert cleanly in the order table without boilerplate exit message', () => {
    const orphanAlert: DhanAlert = {
      id: 'ALT-ORPHAN-SL',
      instrument: 'NIFTY 50',
      securityId: '13',
      exchangeSegment: 'IDX_I',
      targetPrice: 25005.0,
      operator: 'LESS_THAN',
      status: 'ACTIVE',
      remarks: '[STOP LOSS] Exit for #OLD-DELETED-PARENT',
      createdAt: '2026-11-06T10:00:00.000Z',
      isStopLossAlert: true,
      parentAlertId: 'OLD-DELETED-PARENT',
      conditionalOrders: [
        {
          symbol: 'NIFTY 25000 CE',
          quantity: 325,
          lots: 5,
          lotSize: 65,
          transactionType: 'SELL',
        },
      ],
    };

    alertService.alerts.set([orphanAlert]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const items = compiled.querySelectorAll('.order-alert-card');
    expect(items.length).toBe(1);
    const rows = items[0].querySelectorAll('tbody tr.order-leg-row');
    expect(rows.length).toBe(1);
    expect(rows[0].querySelector('.col-side')?.textContent?.trim()).toBe('SELL');
    expect(rows[0].querySelector('.col-contract')?.textContent).toContain('NIFTY 25000 CE');
    expect(rows[0].querySelector('.col-lots')?.textContent?.trim()).toBe('5');
    expect(rows[0].querySelector('.col-trigger')?.textContent?.trim()).toBe('₹25,005.00');

    expect(items[0].textContent).not.toContain('Exit order for parent alert');
    expect(items[0].textContent).not.toContain('Stop Loss');
    expect(items[0].textContent).not.toContain('ACTIVE');
    expect(items[0].textContent).not.toContain('PENDING');
  });

  it('should NOT display ACTIVE, PENDING, or Created timestamps on active alerts', () => {
    alertService.alerts.set(mockAlerts);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('.status-chip.active').length).toBe(0);
    expect(compiled.querySelectorAll('.ord-status-badge.pending').length).toBe(0);
    expect(compiled.textContent).not.toContain('Created:');
    expect(compiled.textContent).not.toContain('Alert for');
  });

  it('should pair entry BUY and exit SELL alerts on same contract option without parentAlertId', () => {
    const pairedOptionAlerts: DhanAlert[] = [
      {
        id: 'ALT-ENTRY-25060',
        instrument: 'NIFTY 50',
        securityId: '13',
        exchangeSegment: 'IDX_I',
        targetPrice: 25060.0,
        operator: 'LESS_THAN',
        status: 'ACTIVE',
        remarks: 'Alert for NIFTY 50 @ ₹25060',
        createdAt: '2026-11-07T10:00:00.000Z',
        conditionalOrders: [
          {
            symbol: 'NIFTY 09 NOV 25050 PUT',
            action: 'BUY',
            quantity: 325,
            lots: 5,
            lotSize: 65,
            orderType: 'MARKET',
            productType: 'INTRADAY',
          },
        ],
      },
      {
        id: 'ALT-SL-25072',
        instrument: 'NIFTY 50',
        securityId: '13',
        exchangeSegment: 'IDX_I',
        targetPrice: 25072.0,
        operator: 'GREATER_THAN',
        status: 'ACTIVE',
        remarks: 'Exit order for parent alert #1106885516',
        createdAt: '2026-11-07T10:00:01.000Z',
        conditionalOrders: [
          {
            symbol: 'NIFTY 09 NOV 25050 PUT',
            action: 'SELL',
            quantity: 325,
            lots: 5,
            lotSize: 65,
            orderType: 'MARKET',
            productType: 'INTRADAY',
          },
        ],
      },
    ];

    alertService.alerts.set(pairedOptionAlerts);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const items = compiled.querySelectorAll('.alert-item');

    // Both alerts MUST collapse into 1 unified order card
    expect(items.length).toBe(1);

    const rows = items[0].querySelectorAll('tbody tr.order-leg-row');
    expect(rows.length).toBe(2);

    expect(rows[0].querySelector('.col-side')?.textContent?.trim()).toBe('BUY');
    expect(rows[0].querySelector('.col-contract')?.textContent).toContain('NIFTY 09 NOV 25050 PUT');
    expect(rows[0].querySelector('.col-lots')?.textContent?.trim()).toBe('5');
    expect(rows[0].querySelector('.col-trigger')?.textContent?.trim()).toBe('₹25,060.00');

    expect(rows[1].querySelector('.col-side')?.textContent?.trim()).toBe('SELL');
    expect(rows[1].querySelector('.col-contract')?.textContent).toContain('NIFTY 09 NOV 25050 PUT');
    expect(rows[1].querySelector('.col-lots')?.textContent?.trim()).toBe('5');
    expect(rows[1].querySelector('.col-trigger')?.textContent?.trim()).toBe('₹25,072.00');

    const cardText = items[0].textContent || '';
    expect(cardText).not.toContain('Stop Loss');
    expect(cardText).not.toContain('-12 pts');
    expect(cardText).not.toContain('Square Off:');
    expect(cardText).not.toContain('Alert for NIFTY 50 @ ₹25060');
    expect(cardText).not.toContain('Exit order for parent alert #1106885516');
    expect(cardText).not.toContain('Created:');
    expect(cardText).not.toContain('ACTIVE');
    expect(cardText).not.toContain('PENDING');
  });

  it('should delete alert and linked stop loss directly without popup confirmation', () => {
    const deleteSpy = vi.spyOn(alertService, 'deleteAlert').mockReturnValue(of({ success: true } as any));

    const pairedAlerts: DhanAlert[] = [
      {
        id: 'ALT-ENTRY-1',
        instrument: 'NIFTY 50',
        securityId: '13',
        exchangeSegment: 'IDX_I',
        targetPrice: 25060.0,
        operator: 'LESS_THAN',
        status: 'ACTIVE',
        remarks: '',
        createdAt: '2026-11-07T10:00:00.000Z',
        conditionalOrders: [
          {
            symbol: 'NIFTY 25050 PE',
            action: 'BUY',
            quantity: 325,
          },
        ],
      },
      {
        id: 'ALT-SL-1',
        instrument: 'NIFTY 50',
        securityId: '13',
        exchangeSegment: 'IDX_I',
        targetPrice: 25072.0,
        operator: 'GREATER_THAN',
        status: 'ACTIVE',
        remarks: '',
        createdAt: '2026-11-07T10:00:01.000Z',
        conditionalOrders: [
          {
            symbol: 'NIFTY 25050 PE',
            action: 'SELL',
            quantity: 325,
          },
        ],
      },
    ];

    alertService.alerts.set(pairedAlerts);
    fixture.detectChanges();

    const deleteBtn = fixture.nativeElement.querySelector('.action-icon-btn.delete') as HTMLButtonElement;
    expect(deleteBtn).toBeTruthy();
    deleteBtn.click();

    // Verify deleteAlert was called for both parent and child SL immediately without popup dialog
    expect(deleteSpy).toHaveBeenCalledWith('ALT-ENTRY-1');
    expect(deleteSpy).toHaveBeenCalledWith('ALT-SL-1');
  });

  it('should render a JSON button on every alert row to inspect raw Dhan JSON', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const jsonBtns = compiled.querySelectorAll('.action-icon-btn.json-btn');
    expect(jsonBtns.length).toBe(mockAlerts.length);

    const icon = jsonBtns[0].querySelector('.material-symbols-rounded');
    expect(icon?.textContent?.trim()).toBe('data_object');
    expect(jsonBtns[0].getAttribute('matTooltip')).toBe('View Raw JSON from Dhan');
  });

  it('should open AlertPreviewDialogComponent when clicking the JSON button', () => {
    mockDialog.open.mockClear();

    const alertWithRaw: DhanAlert = {
      ...mockAlerts[1],
      rawDhanJson: {
        alertId: 'ALT-1001',
        condition: { securityId: '13', comparingValue: 24950 },
      },
    };
    alertService.alerts.set([alertWithRaw]);
    fixture.detectChanges();

    const jsonBtn = fixture.nativeElement.querySelector('.action-icon-btn.json-btn') as HTMLButtonElement;
    expect(jsonBtn).toBeTruthy();
    jsonBtn.click();

    expect(mockDialog.open).toHaveBeenCalled();
    const callArgs = mockDialog.open.mock.calls[0];
    const passedData = (callArgs[1]?.data as any);
    expect(passedData?.mode).toBe('view');
    expect(passedData?.initialTabIndex).toBe(1);
    expect(passedData?.dhanPayload).toEqual(alertWithRaw.rawDhanJson);
  });
});

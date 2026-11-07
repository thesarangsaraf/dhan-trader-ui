import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AlertListComponent } from './alert-list.component';
import { AlertService } from '../../../../core/api/alert.service';
import { DhanAlert } from '../../../../core/models/alert.models';

describe('AlertListComponent', () => {
  let component: AlertListComponent;
  let fixture: ComponentFixture<AlertListComponent>;
  let alertService: AlertService;
  let mockDialog: { open: ReturnType<typeof vi.fn> };

  const mockAlerts: DhanAlert[] = [
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
        quantity: 50,
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

    // Populate alerts signal with test data
    alertService.alerts.set(mockAlerts);
    alertService.alertsError.set(null);
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should display all alerts from Dhan without filter tabs', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    // Verify tabs are NOT present
    const filterTabs = compiled.querySelector('.filter-tabs');
    expect(filterTabs).toBeNull();
    const tabBtns = compiled.querySelectorAll('.tab-btn');
    expect(tabBtns.length).toBe(0);

    // Verify all 3 alert items are rendered directly
    const items = compiled.querySelectorAll('.alert-item');
    expect(items.length).toBe(3);

    // Check instruments
    expect(items[0].textContent).toContain('NIFTY 50');
    expect(items[1].textContent).toContain('BANKNIFTY');
    expect(items[2].textContent).toContain('RELIANCE');
  });

  it('should NOT display LTP anywhere in the alert monitor', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const textContent = compiled.textContent || '';

    // Verify no LTP label or distance sub-indicator
    expect(textContent).not.toContain('LTP:');
    expect(compiled.querySelector('.col-distance')).toBeNull();
    expect(compiled.querySelector('.distance-sub')).toBeNull();
  });

  it('should display linked order details when an order is attached to the alert', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const items = compiled.querySelectorAll('.alert-item');

    // First alert has NIFTY 24500 CE BUY order
    const firstOrderCard = items[0].querySelector('.linked-order-card');
    expect(firstOrderCard).toBeTruthy();
    expect(firstOrderCard?.textContent).toContain('NIFTY 24500 CE');
    expect(firstOrderCard?.textContent).toContain('BUY');
    expect(firstOrderCard?.textContent).toContain('Qty:50');
    // Ensure NSE_FNO, Sec ID, and Product are NOT displayed
    expect(firstOrderCard?.textContent).not.toContain('INTRADAY');
    expect(firstOrderCard?.textContent).not.toContain('NSE_FNO');
    expect(firstOrderCard?.textContent).not.toContain('Sec ID');

    // Second alert has BANKNIFTY 52000 PE SELL order with orderId and limit price
    const secondOrderCard = items[1].querySelector('.linked-order-card');
    expect(secondOrderCard).toBeTruthy();
    expect(secondOrderCard?.textContent).toContain('BANKNIFTY 52000 PE');
    expect(secondOrderCard?.textContent).toContain('SELL');
    expect(secondOrderCard?.textContent).toContain('Qty:30');
    expect(secondOrderCard?.textContent).toContain('#DHAN-ORD-999');

    // Third alert has NO linked order
    const thirdOrderCard = items[2].querySelector('.linked-order-card');
    expect(thirdOrderCard).toBeNull();
  });

  it('should NOT show cancel button or breakout/breakdown badges, only delete button', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const items = compiled.querySelectorAll('.alert-item');

    // No cancel alert button anywhere
    const cancelBtns = compiled.querySelectorAll('.action-icon-btn.cancel');
    expect(cancelBtns.length).toBe(0);

    // Delete buttons should be present
    const deleteBtns = compiled.querySelectorAll('.action-icon-btn.delete');
    expect(deleteBtns.length).toBe(items.length);

    // Operator badge (< breakout, > breakdown) is removed from target columns
    const operatorBadges = compiled.querySelectorAll('.operator-badge');
    expect(operatorBadges.length).toBe(0);
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
    const alert: DhanAlert = mockAlerts[0];

    // Priority 1: customSymbol
    expect(
      component.getDisplaySymbol(
        { symbol: 'SEC-40040', customSymbol: 'NIFTY 09 NOV 25050 PUT', quantity: 325 },
        alert
      )
    ).toBe('NIFTY 09 NOV 25050 PUT');

    // Priority 2: instrumentName
    expect(
      component.getDisplaySymbol(
        { symbol: 'SEC-40040', instrumentName: 'NIFTY 09 NOV 25050 PUT', quantity: 325 },
        alert
      )
    ).toBe('NIFTY 09 NOV 25050 PUT');

    // Priority 3: strikePrice + optionType composition
    expect(
      component.getDisplaySymbol(
        { symbol: 'SEC-40040', strikePrice: 25050, optionType: 'PE', quantity: 325 },
        alert
      )
    ).toBe('NIFTY 50 25050 PE');
  });

  it('should render BUY order with Stop Loss as a single unified trade order card', () => {
    const slAlerts: DhanAlert[] = [
      {
        id: 'ALT-SL-PARENT',
        instrument: 'NIFTY 50',
        securityId: '13',
        exchangeSegment: 'IDX_I',
        targetPrice: 25017.0,
        operator: 'LESS_THAN',
        status: 'ACTIVE',
        remarks: 'Entry at 25017',
        createdAt: '2026-11-06T10:00:00.000Z',
        stopLoss: {
          enabled: true,
          points: 12,
          targetPrice: 25005.0,
          operator: 'LESS_THAN',
          action: 'SELL',
        },
        attachedOrder: {
          symbol: 'NIFTY 25000 CE',
          quantity: 325,
          action: 'BUY',
        },
      },
      {
        id: 'ALT-SL-CHILD',
        instrument: 'NIFTY 50',
        securityId: '13',
        exchangeSegment: 'IDX_I',
        targetPrice: 25005.0,
        operator: 'LESS_THAN',
        status: 'ACTIVE',
        remarks: '[STOP LOSS] Exit for #ALT-SL-PARENT (NIFTY 25000 CE)',
        createdAt: '2026-11-06T10:05:00.000Z',
        isStopLossAlert: true,
        parentAlertId: 'ALT-SL-PARENT',
        conditionalOrders: [
          {
            symbol: 'NIFTY 25000 CE',
            quantity: 325,
            transactionType: 'SELL',
          },
        ],
      },
    ];

    alertService.alerts.set(slAlerts);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const items = compiled.querySelectorAll('.alert-item');

    // CRITICAL: Must be rendered as EXACTLY 1 unified order card, not 2 separate disconnected cards!
    expect(items.length).toBe(1);

    const unifiedCard = items[0];
    const textContent = unifiedCard.textContent || '';

    // Entry BUY Order Details
    expect(textContent).toContain('NIFTY 50');
    expect(textContent).toContain('BUY');
    expect(textContent).toContain('NIFTY 25000 CE');
    expect(textContent).toContain('25,017');
    expect(textContent).toContain('With Stop Loss (12 pts)');

    // Embedded Attached Stop Loss Section inside the SAME card
    const embeddedSl = unifiedCard.querySelector('.embedded-stop-loss-section');
    expect(embeddedSl).toBeTruthy();
    const slText = embeddedSl?.textContent || '';
    expect(slText).toContain('Stop Loss');
    expect(slText).not.toContain('Attached Stop Loss Order (Exit Protection)');
    expect(slText).toContain('-12 pts');
    expect(slText).toContain('25,005');
    expect(slText).toContain('SELL');
    expect(slText).toContain('Square Off:');
    expect(slText).toContain('NIFTY 25000 CE');
    expect(slText).toContain('Qty: 325');
    expect(slText).not.toContain('SL Alert #ALT-SL-CHILD');
    expect(slText).not.toContain('SL Alert #');
  });

  it('should render multiple trades with attached Stop Loss as separate unified cards (no card scattering)', () => {
    const multiAlerts: DhanAlert[] = [
      // Trade 1: NIFTY 50 Buy + SL
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
        attachedOrder: { symbol: 'NIFTY 25000 CE', quantity: 325, action: 'BUY' },
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
        conditionalOrders: [{ symbol: 'NIFTY 25000 CE', quantity: 325, transactionType: 'SELL' }],
      },
      // Trade 2: BANK NIFTY Buy + SL
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
        attachedOrder: { symbol: 'BANKNIFTY 52000 PE', quantity: 150, action: 'BUY' },
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
        conditionalOrders: [{ symbol: 'BANKNIFTY 52000 PE', quantity: 150, transactionType: 'SELL' }],
      },
    ];

    alertService.alerts.set(multiAlerts);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const items = compiled.querySelectorAll('.alert-item');

    // 4 Dhan alerts collapsed into exactly 2 unified trade order cards
    expect(items.length).toBe(2);

    // Trade 1 is NIFTY with its own SL
    expect(items[0].textContent).toContain('NIFTY 50');
    expect(items[0].textContent).toContain('NIFTY 25000 CE');
    expect(items[0].querySelector('.embedded-stop-loss-section')?.textContent).toContain('-12 pts');
    expect(items[0].querySelector('.embedded-stop-loss-section')?.textContent).toContain('25,005');

    // Trade 2 is BANKNIFTY with its own SL
    expect(items[1].textContent).toContain('BANKNIFTY');
    expect(items[1].textContent).toContain('BANKNIFTY 52000 PE');
    expect(items[1].querySelector('.embedded-stop-loss-section')?.textContent).toContain('-20 pts');
    expect(items[1].querySelector('.embedded-stop-loss-section')?.textContent).toContain('51,980');
  });

  it('should NOT attach stop loss of other orders to an order placed without stop loss', () => {
    const alerts: DhanAlert[] = [
      // Trade 1: NIFTY 50 Buy PUT with Stop Loss
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
          action: 'BUY',
        },
      },
      // SL Child Alert for Trade 1
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
          action: 'SELL',
        },
      },
      // Trade 2: Placed WITHOUT Stop Loss!
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
          action: 'BUY',
        },
      },
    ];

    alertService.alerts.set(alerts);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const items = compiled.querySelectorAll('.alert-item');

    // 2 cards: Trade 1 (with embedded SL) and Trade 2 (WITHOUT SL). The SL child is embedded in Trade 1.
    expect(items.length).toBe(2);

    // Trade 1 Card
    const trade1Card = items[0];
    expect(trade1Card.textContent).toContain('25,060');
    expect(trade1Card.querySelector('.embedded-stop-loss-section')).toBeTruthy();
    expect(trade1Card.textContent).not.toContain('Attached Stop Loss Order (Exit Protection)');
    expect(trade1Card.textContent).not.toContain('SL Alert #1106885516_B_1794049765210_485');

    // Trade 2 Card (WITHOUT Stop Loss)
    const trade2Card = items[1];
    expect(trade2Card.textContent).toContain('25,000');
    expect(trade2Card.querySelector('.embedded-stop-loss-section')).toBeFalsy();
    expect(trade2Card.textContent).not.toContain('With Stop Loss');
    expect(trade2Card.textContent).not.toContain('Attached Stop Loss Order (Exit Protection)');
    expect(trade2Card.textContent).not.toContain('SL Alert #1106885516_B_1794049765210_485');
    expect(trade2Card.textContent).not.toContain('25,072');
  });

  it('should render orphan Stop Loss alert without boilerplate exit message', () => {
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
          transactionType: 'SELL',
        },
      ],
    };

    alertService.alerts.set([orphanAlert]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const items = compiled.querySelectorAll('.alert-item');
    expect(items.length).toBe(1);
    expect(items[0].textContent).toContain('STOP LOSS');
    // Ensure "Exit order for parent alert #..." is not shown
    expect(items[0].textContent).not.toContain('Exit order for parent alert');
    expect(items[0].textContent).not.toContain('ACTIVE');
    expect(items[0].textContent).not.toContain('PENDING');
  });

  it('should NOT display ACTIVE, PENDING, or Created timestamps on active alerts', () => {
    alertService.alerts.set(mockAlerts);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    // Default ACTIVE status text should be hidden
    const activeChips = compiled.querySelectorAll('.status-chip.active');
    expect(activeChips.length).toBe(0);
    // PENDING badges should be hidden
    const pendingBadges = compiled.querySelectorAll('.ord-status-badge.pending');
    expect(pendingBadges.length).toBe(0);
    // "Created: ..." should be hidden
    expect(compiled.textContent).not.toContain('Created:');
    expect(compiled.textContent).not.toContain('Alert for');
  });

  it('should pair entry BUY and stop loss SELL alerts on same contract option without parentAlertId', () => {
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

    // Both alerts MUST collapse into 1 unified order card with stop loss
    expect(items.length).toBe(1);

    const cardText = items[0].textContent || '';
    expect(cardText).toContain('NIFTY 50');
    expect(cardText).toContain('BUY');
    expect(cardText).toContain('25,060');
    expect(cardText).toContain('NIFTY 09 NOV 25050 PUT');
    expect(cardText).toContain('Qty: 325');

    // Stop Loss embedded details
    const embeddedSl = items[0].querySelector('.embedded-stop-loss-section');
    expect(embeddedSl).toBeTruthy();
    const slText = embeddedSl?.textContent || '';
    expect(slText).toContain('25,072');
    expect(slText).toContain('-12 pts');
    expect(slText).toContain('SELL');
    expect(slText).toContain('Square Off:');

    // Messages that must NOT be shown
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

    // Verify first button icon
    const icon = jsonBtns[0].querySelector('.material-symbols-rounded');
    expect(icon?.textContent?.trim()).toBe('data_object');
    expect(jsonBtns[0].getAttribute('matTooltip')).toBe('View Raw JSON from Dhan');
  });

  it('should open AlertPreviewDialogComponent when clicking the JSON button', () => {
    mockDialog.open.mockClear();

    const alertWithRaw: DhanAlert = {
      ...mockAlerts[0],
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

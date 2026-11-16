import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PositionsSummaryComponent } from './positions-summary.component';
import { OrderService } from '../../../../core/api/order.service';
import { DhanPosition, PositionsSummary } from '../../../../core/models/order.models';

describe('PositionsSummaryComponent', () => {
  let component: PositionsSummaryComponent;
  let fixture: ComponentFixture<PositionsSummaryComponent>;

  const mockPositions = signal<DhanPosition[]>([]);
  const mockPositionsError = signal<string | null>(null);
  const mockSummary = signal<PositionsSummary | null>({
    netPnL: 1250,
    totalRealized: 500,
    totalUnrealized: 750,
    openPositionsCount: 1,
    closedPositionsCount: 1,
  });
  const mockFunds = signal<{ availableBalance: number } | null>({
    availableBalance: 150000,
  });

  const mockOrderService = {
    positions: mockPositions,
    positionsError: mockPositionsError,
    summary: mockSummary,
    funds: mockFunds,
    refreshPositions: vi.fn(),
    exitPosition: vi.fn(),
  };

  const mockDialog = {
    open: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PositionsSummaryComponent],
      providers: [
        { provide: OrderService, useValue: mockOrderService },
        { provide: MatDialog, useValue: mockDialog },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PositionsSummaryComponent);
    component = fixture.componentInstance;
  });

  it('should create PositionsSummaryComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should display Entry price, Exit price (when available), and LTP without showing INTRADAY text', () => {
    mockPositions.set([
      {
        positionId: 'POS-1',
        symbol: 'NIFTY 24500 CE',
        securityId: '45021',
        exchangeSegment: 'NSE_FNO',
        productType: 'INTRADAY',
        netQty: 65,
        buyQty: 65,
        sellQty: 0,
        buyAvg: 110.5,
        sellAvg: 0,
        entryPrice: 110.5,
        ltp: 125.0,
        realizedPnL: 0,
        unrealizedPnL: 942.5,
      },
      {
        positionId: 'POS-2',
        symbol: 'BANKNIFTY 52000 PE',
        securityId: '52001',
        exchangeSegment: 'NSE_FNO',
        productType: 'INTRADAY',
        netQty: 0,
        buyQty: 30,
        sellQty: 30,
        buyAvg: 220.0,
        sellAvg: 260.0,
        entryPrice: 220.0,
        exitPrice: 260.0,
        ltp: 265.0,
        realizedPnL: 1200,
        unrealizedPnL: 0,
      },
    ]);

    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    // 1. Must NOT contain INTRADAY text
    expect(compiled.querySelector('.prod-tag')).toBeNull();
    expect(compiled.textContent).not.toContain('INTRADAY');

    // 2. Open position should show Entry and LTP
    const rows = compiled.querySelectorAll('.position-row');
    expect(rows.length).toBe(2);

    const openRowText = rows[0].textContent || '';
    expect(openRowText).toContain('Entry:');
    expect(openRowText).toContain('110.50');
    expect(openRowText).toContain('LTP:');
    expect(openRowText).toContain('125.00');
    expect(openRowText).not.toContain('Exit:'); // Open position has no exit yet

    // 3. Closed position should show Entry, Exit, and LTP
    const closedRowText = rows[1].textContent || '';
    expect(closedRowText).toContain('Entry:');
    expect(closedRowText).toContain('220.00');
    expect(closedRowText).toContain('Exit:');
    expect(closedRowText).toContain('260.00');
    expect(closedRowText).toContain('LTP:');
    expect(closedRowText).toContain('265.00');
  });

  it('should correctly resolve entry and exit prices for various position scenarios', () => {
    // Normal Buy position
    const buyPos: DhanPosition = {
      positionId: '1',
      symbol: 'TEST',
      securityId: '1',
      exchangeSegment: 'NSE_EQ',
      productType: 'INTRADAY',
      netQty: 10,
      buyQty: 10,
      sellQty: 0,
      buyAvg: 100,
      sellAvg: 0,
      ltp: 105,
      realizedPnL: 0,
      unrealizedPnL: 50,
    };
    expect(component.getEntryPrice(buyPos)).toBe(100);
    expect(component.getExitPrice(buyPos)).toBeNull();

    // Closed position
    const closedPos: DhanPosition = {
      positionId: '2',
      symbol: 'TEST',
      securityId: '2',
      exchangeSegment: 'NSE_EQ',
      productType: 'INTRADAY',
      netQty: 0,
      buyQty: 10,
      sellQty: 10,
      buyAvg: 100,
      sellAvg: 115,
      ltp: 115,
      realizedPnL: 150,
      unrealizedPnL: 0,
    };
    expect(component.getEntryPrice(closedPos)).toBe(100);
    expect(component.getExitPrice(closedPos)).toBe(115);

    // Short position
    const shortPos: DhanPosition = {
      positionId: '3',
      symbol: 'TEST',
      securityId: '3',
      exchangeSegment: 'NSE_EQ',
      productType: 'INTRADAY',
      netQty: -10,
      buyQty: 0,
      sellQty: 10,
      buyAvg: 0,
      sellAvg: 200,
      ltp: 195,
      realizedPnL: 0,
      unrealizedPnL: 50,
    };
    expect(component.getEntryPrice(shortPos)).toBe(200);
    expect(component.getExitPrice(shortPos)).toBeNull();
  });

  it('should restrict non-admin users from squaring off positions', () => {
    component.userAuthService.currentUser.set({
      username: 'trader_bob',
      role: 'trader',
    });
    mockDialog.open.mockClear();

    const openPos: DhanPosition = {
      positionId: '1',
      symbol: 'NIFTY 24500 CE',
      securityId: '45021',
      exchangeSegment: 'NSE_FNO',
      productType: 'INTRADAY',
      netQty: 50,
      buyQty: 50,
      sellQty: 0,
      buyAvg: 100,
      sellAvg: 0,
      ltp: 110,
      realizedPnL: 0,
      unrealizedPnL: 500,
    };

    component.confirmSquareOff(openPos);
    expect(mockDialog.open).not.toHaveBeenCalled();
  });

  it('should allow admin users to square off positions via confirmation dialog', () => {
    component.userAuthService.currentUser.set({
      username: 'sarang',
      role: 'admin',
    });
    mockDialog.open.mockClear();
    mockDialog.open.mockReturnValue({
      afterClosed: () => ({ subscribe: vi.fn() }),
    });

    const openPos: DhanPosition = {
      positionId: '1',
      symbol: 'NIFTY 24500 CE',
      securityId: '45021',
      exchangeSegment: 'NSE_FNO',
      productType: 'INTRADAY',
      netQty: 50,
      buyQty: 50,
      sellQty: 0,
      buyAvg: 100,
      sellAvg: 0,
      ltp: 110,
      realizedPnL: 0,
      unrealizedPnL: 500,
    };

    component.confirmSquareOff(openPos);
    expect(mockDialog.open).toHaveBeenCalled();
  });
});

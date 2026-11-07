import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OrderService } from './order.service';

describe('OrderService', () => {
  let service: OrderService;
  let httpTesting: HttpTestingController;

  const mockSnackBar = {
    open: vi.fn(),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        OrderService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    });

    httpTesting = TestBed.inject(HttpTestingController);

    // Initial constructor calls: /api/orders, /api/positions, /api/funds, /api/orders/websocket/status
    service = TestBed.inject(OrderService);
    httpTesting.expectOne('/api/orders').flush([]);
    httpTesting.expectOne('/api/positions').flush({ positions: [], funds: null, summary: null });
    httpTesting.expectOne('/api/funds').flush(null);
    httpTesting.expectOne('/api/orders/websocket/status').flush({ connected: true });
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should fetch and update account funds when refreshFunds is called', () => {
    const mockFunds = {
      availableBalance: 275000.5,
      utilizedMargin: 12000.0,
      collateralAmount: 50000.0,
      withdrawableBalance: 275000.5,
      dhanClientId: '1106885516',
    };

    service.refreshFunds();
    expect(service.isRefreshingFunds()).toBe(true);

    const req = httpTesting.expectOne('/api/funds');
    expect(req.request.method).toBe('GET');
    req.flush(mockFunds);

    expect(service.isRefreshingFunds()).toBe(false);
    expect(service.funds()).toEqual(mockFunds);
    expect(service.funds()?.availableBalance).toBe(275000.5);
  });

  it('should handle funds fetch failure gracefully', () => {
    service.refreshFunds();
    const req = httpTesting.expectOne('/api/funds');
    req.flush('Error fetching funds', { status: 500, statusText: 'Server Error' });

    expect(service.isRefreshingFunds()).toBe(false);
  });

  it('should update funds and positions when refreshPositions is called', () => {
    const mockPosResponse = {
      positions: [
        {
          positionId: 'POS-1',
          symbol: 'NIFTY 24500 CE',
          securityId: '45021',
          exchangeSegment: 'NSE_FNO',
          productType: 'INTRADAY',
          netQty: 65,
          buyQty: 65,
          sellQty: 0,
          buyAvg: 110,
          sellAvg: 0,
          ltp: 125,
          realizedPnL: 0,
          unrealizedPnL: 975,
        },
      ],
      funds: {
        availableBalance: 180000,
        utilizedMargin: 15000,
        collateralAmount: 0,
      },
      summary: {
        totalRealized: 0,
        totalUnrealized: 975,
        netPnL: 975,
        openPositionsCount: 1,
        closedPositionsCount: 0,
      },
    };

    service.refreshPositions();
    const req = httpTesting.expectOne('/api/positions');
    req.flush(mockPosResponse);

    expect(service.positions().length).toBe(1);
    expect(service.funds()?.availableBalance).toBe(180000);
    expect(service.summary()?.netPnL).toBe(975);
  });
});

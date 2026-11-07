import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TradeService } from './trade.service';
import { TradeHistoryResponse } from '../models/trade.models';

describe('TradeService', () => {
  let service: TradeService;
  let httpTesting: HttpTestingController;

  const mockResponse: TradeHistoryResponse = {
    financialYear: '2026-2027',
    fromDate: '2026-04-01',
    toDate: '2026-11-07',
    isCurrent: true,
    page: 0,
    availableFinancialYears: [
      { label: 'FY 2026-27 (Current)', value: '2026-2027', fromDate: '2026-04-01', toDate: '2026-11-07', isCurrent: true },
      { label: 'FY 2025-26', value: '2025-2026', fromDate: '2025-04-01', toDate: '2026-03-31', isCurrent: false },
    ],
    summary: {
      totalTrades: 2,
      closedTradesCount: 2,
      profitableTradesCount: 1,
      lossTradesCount: 1,
      winRate: 50,
      totalRealizedPnL: 550.0,
      totalQuantity: 100,
    },
    trades: [
      {
        tradeId: 'PAIR-1',
        symbol: 'NIFTY 28 NOV 24500 CALL',
        securityId: '45021',
        quantity: 50,
        buyPrice: 130.0,
        sellPrice: 145.0,
        pnl: 750.0,
        pnlPercentage: 11.54,
        status: 'CLOSED',
        isProfit: true,
        tradeDate: '2026-05-10',
        executionTime: '2026-05-10T10:15:00',
      },
      {
        tradeId: 'PAIR-2',
        symbol: 'RELIANCE',
        securityId: '2885',
        quantity: 50,
        buyPrice: 2500.0,
        sellPrice: 2496.0,
        pnl: -200.0,
        pnlPercentage: -0.16,
        status: 'CLOSED',
        isProfit: false,
        tradeDate: '2026-05-12',
        executionTime: '2026-05-12T14:30:00',
      },
    ],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TradeService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    httpTesting = TestBed.inject(HttpTestingController);
    service = TestBed.inject(TradeService);

    const initialReq = httpTesting.expectOne((r) => r.url === '/api/trades/history');
    expect(initialReq.request.method).toBe('GET');
    initialReq.flush(mockResponse);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should load initial trade history for the current financial year', () => {
    expect(service.selectedFinancialYear()).toBe('2026-2027');
    expect(service.trades().length).toBe(2);
    expect(service.summary()?.totalRealizedPnL).toBe(550.0);
    expect(service.financialYears().length).toBe(2);
    expect(service.error()).toBeNull();
  });

  it('should filter trades by symbol search query', () => {
    service.setSearchQuery('RELIANCE');
    expect(service.filteredTrades().length).toBe(1);
    expect(service.filteredTrades()[0].symbol).toBe('RELIANCE');

    service.setSearchQuery('nifty');
    expect(service.filteredTrades().length).toBe(1);
    expect(service.filteredTrades()[0].symbol).toBe('NIFTY 28 NOV 24500 CALL');
  });

  it('should filter trades by profit/loss status', () => {
    service.setStatusFilter('PROFIT');
    expect(service.filteredTrades().length).toBe(1);
    expect(service.filteredTrades()[0].symbol).toBe('NIFTY 28 NOV 24500 CALL');

    service.setStatusFilter('LOSS');
    expect(service.filteredTrades().length).toBe(1);
    expect(service.filteredTrades()[0].symbol).toBe('RELIANCE');

    service.setStatusFilter('ALL');
    expect(service.filteredTrades().length).toBe(2);
  });

  it('should switch financial year and load data for selected period', () => {
    service.selectFinancialYear('2025-2026');
    expect(service.isLoading()).toBe(true);

    const req = httpTesting.expectOne((r) => r.url === '/api/trades/history' && r.params.get('financialYear') === '2025-2026');
    expect(req.request.method).toBe('GET');
    req.flush({
      ...mockResponse,
      financialYear: '2025-2026',
      fromDate: '2025-04-01',
      toDate: '2026-03-31',
      isCurrent: false,
      trades: [],
      summary: {
        totalTrades: 0,
        closedTradesCount: 0,
        profitableTradesCount: 0,
        lossTradesCount: 0,
        winRate: 0,
        totalRealizedPnL: 0,
        totalQuantity: 0,
      },
    });

    expect(service.isLoading()).toBe(false);
    expect(service.selectedFinancialYear()).toBe('2025-2026');
    expect(service.trades().length).toBe(0);
  });

  it('should handle API errors gracefully without crashing', () => {
    service.selectFinancialYear('2024-2025');
    const req = httpTesting.expectOne((r) => r.url === '/api/trades/history' && r.params.get('financialYear') === '2024-2025');
    req.flush({ message: 'Token expired' }, { status: 502, statusText: 'Bad Gateway' });

    expect(service.isLoading()).toBe(false);
    expect(service.error()).toContain('Token expired');
  });

  it('should gracefully normalize and pair raw un-paired trade records from API', () => {
    service.selectFinancialYear('2026-2027');
    const req = httpTesting.expectOne((r) => r.url === '/api/trades/history' && r.params.get('financialYear') === '2026-2027');
    
    // Simulate raw un-paired fills from older API response
    const rawFillsResponse = {
      financialYear: '2026-2027',
      fromDate: '2026-04-01',
      toDate: '2026-11-07',
      isCurrent: true,
      summary: {
        totalTrades: 2,
        netRealizedValue: 500,
      },
      trades: [
        {
          tradeId: '0',
          securityId: '62239',
          symbol: 'BANKNIFTY 57900 PUT',
          transactionType: 'BUY',
          tradedQuantity: 50,
          tradedPrice: 100,
          tradeDate: '2026-11-06',
          exchangeTime: '11:30:00',
        },
        {
          tradeId: '0',
          securityId: '62239',
          symbol: 'BANKNIFTY 57900 PUT',
          transactionType: 'SELL',
          tradedQuantity: 50,
          tradedPrice: 110,
          tradeDate: '2026-11-06',
          exchangeTime: '11:35:00',
        },
      ],
    };

    req.flush(rawFillsResponse);

    expect(service.isLoading()).toBe(false);
    expect(service.trades().length).toBe(1);
    const trade = service.trades()[0];
    expect(trade.buyPrice).toBe(100);
    expect(trade.sellPrice).toBe(110);
    expect(trade.quantity).toBe(50);
    expect(trade.pnl).toBe(500);
    expect(trade.status).toBe('CLOSED');
    expect(service.summary()?.totalRealizedPnL).toBe(500);
    expect(service.summary()?.closedTradesCount).toBe(1);
  });
});

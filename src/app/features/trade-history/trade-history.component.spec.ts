import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TradeHistoryComponent } from './trade-history.component';
import { TradeService } from '../../core/api/trade.service';
import { HistoricalDataService } from '../../core/api/historical-data.service';
import {
  findMatchingFiveMinCandle,
  parseIstTimeToEpoch,
  resolveTradeEntryExit,
} from './components/trade-index-chart/trade-index-chart.component';

describe('TradeHistoryComponent', () => {
  let component: TradeHistoryComponent;
  let fixture: ComponentFixture<TradeHistoryComponent>;

  const mockTrades = signal<any[]>([
    {
      tradeId: 'PAIR-1',
      symbol: 'NIFTY 28 NOV 24500 CALL',
      securityId: '45021',
      quantity: 50,
      buyPrice: 130.0,
      sellPrice: 145.0,
      pnl: 750.0,
      pnlPercentage: 11.54,
      totalCharges: 25.5,
      tradeValue: 13750.0,
      chargesBreakdown: {
        brokerage: 20.0,
        stt: 3.5,
        gst: 1.5,
        exchangeCharges: 0.5,
      },
      status: 'CLOSED',
      isProfit: true,
      tradeDate: '2026-05-10',
      executionTime: '2026-05-10T10:15:00',
      buyTime: '2026-05-10T10:00:00',
      sellTime: '2026-05-10T10:15:00',
      holdingDuration: '15m 0s',
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
      totalCharges: 30.0,
      tradeValue: 249800.0,
      status: 'CLOSED',
      isProfit: false,
      tradeDate: '2026-05-12',
      executionTime: '2026-05-12T14:30:00',
      buyTime: '2026-05-12T14:00:00',
      sellTime: '2026-05-12T14:30:00',
      holdingDuration: '30m 0s',
    },
  ]);

  const mockSummary = signal<any>({
    totalTrades: 2,
    closedTradesCount: 2,
    profitableTradesCount: 1,
    lossTradesCount: 1,
    winRate: 50,
    totalRealizedPnL: 550.0,
    totalQuantity: 100,
  });

  const mockFinancialYears = signal<any[]>([
    { label: 'FY 2026-27 (Current)', value: '2026-2027', fromDate: '2026-04-01', toDate: '2026-11-07', isCurrent: true },
    { label: 'FY 2025-26', value: '2025-2026', fromDate: '2025-04-01', toDate: '2026-03-31', isCurrent: false },
  ]);

  const mockSelectedFinancialYear = signal<string>('2026-2027');
  const mockFromDate = signal<string>('2026-04-01');
  const mockToDate = signal<string>('2026-11-07');
  const mockIsCurrent = signal<boolean>(true);
  const mockIsLoading = signal<boolean>(false);
  const mockError = signal<string | null>(null);
  const mockSearchQuery = signal<string>('');
  const mockSelectedStatus = signal<'ALL' | 'PROFIT' | 'LOSS' | 'OPEN'>('ALL');

  const mockTradeService = {
    trades: mockTrades,
    filteredTrades: mockTrades,
    summary: mockSummary,
    financialYears: mockFinancialYears,
    selectedFinancialYear: mockSelectedFinancialYear,
    fromDate: mockFromDate,
    toDate: mockToDate,
    isCurrent: mockIsCurrent,
    isLoading: mockIsLoading,
    error: mockError,
    searchQuery: mockSearchQuery,
    selectedStatus: mockSelectedStatus,
    selectFinancialYear: vi.fn((fy: string) => mockSelectedFinancialYear.set(fy)),
    setCustomDateRange: vi.fn(),
    setSearchQuery: vi.fn((q: string) => mockSearchQuery.set(q)),
    setStatusFilter: vi.fn((st: any) => mockSelectedStatus.set(st)),
    refresh: vi.fn(),
  };

  const mockHistoricalDataService = {
    getCandles: vi.fn().mockReturnValue(
      of({
        success: true,
        symbol: 'NIFTY 50',
        timeframe: '5m',
        monthsRead: ['2026-05'],
        count: 2,
        candles: [
          {
            epoch: parseIstTimeToEpoch('2026-05-10T10:00:00')!,
            timestampIST: '2026-05-10T10:00:00',
            open: 24500,
            high: 24525,
            low: 24495,
            close: 24520.5,
            volume: 0,
          },
          {
            epoch: parseIstTimeToEpoch('2026-05-10T10:15:00')!,
            timestampIST: '2026-05-10T10:15:00',
            open: 24570,
            high: 24595,
            low: 24568,
            close: 24585.75,
            volume: 0,
          },
        ],
      }),
    ),
    getBankNiftyCandles: vi.fn().mockReturnValue(
      of({
        success: true,
        symbol: 'BANK NIFTY',
        timeframe: '5m',
        monthsRead: ['2026-05'],
        count: 2,
        candles: [
          {
            epoch: parseIstTimeToEpoch('2026-05-10T10:00:00')!,
            timestampIST: '2026-05-10T10:00:00',
            open: 52100,
            high: 52150,
            low: 52080,
            close: 52140.25,
            volume: 1000,
          },
          {
            epoch: parseIstTimeToEpoch('2026-05-10T10:15:00')!,
            timestampIST: '2026-05-10T10:15:00',
            open: 52140,
            high: 52200,
            low: 52130,
            close: 52195.5,
            volume: 1200,
          },
        ],
      }),
    ),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockError.set(null);
    mockIsLoading.set(false);

    await TestBed.configureTestingModule({
      imports: [TradeHistoryComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        provideRouter([]),
        { provide: TradeService, useValue: mockTradeService },
        { provide: HistoricalDataService, useValue: mockHistoricalDataService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TradeHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render the trade history page title and breadcrumbs', () => {
    const el: HTMLElement = fixture.nativeElement;
    const titleEl = el.querySelector('.page-title');
    expect(titleEl?.textContent).toContain('Historical Trade Book');
  });

  it('should render the KPI summary cards with net P&L and win rate', () => {
    const el: HTMLElement = fixture.nativeElement;
    const kpiCards = el.querySelectorAll('.kpi-card');
    expect(kpiCards.length).toBe(4);

    const pnlCard = el.querySelector('.pnl-kpi .kpi-value');
    expect(pnlCard?.textContent).toContain('550.00');

    const tradesCard = el.querySelector('.trades-kpi .kpi-value');
    expect(tradesCard?.textContent).toContain('2 Trades');

    const winRateCard = el.querySelector('.winrate-kpi .kpi-value');
    expect(winRateCard?.textContent).toContain('50%');
  });

  it('should trigger selectFinancialYear when financial year selection changes', () => {
    component.onFyChange('2025-2026');
    expect(mockTradeService.selectFinancialYear).toHaveBeenCalledWith('2025-2026');
    expect(component.isCustomMode()).toBe(false);
  });

  it('should render consolidated single trade rows with buy, sell, trade value, and Realized P&L without Net Realized P&L', () => {
    const el: HTMLElement = fixture.nativeElement;
    const rows = el.querySelectorAll('.trade-row');
    expect(rows.length).toBe(2);

    const firstRowSymbol = el.querySelector('.trade-row .symbol-name');
    expect(firstRowSymbol?.textContent).toContain('NIFTY 28 NOV 24500 CALL');

    const tradeValCell = el.querySelector('.trade-row .trade-val-cell');
    expect(tradeValCell?.textContent).toContain('13,750.00');

    const buyPriceCell = el.querySelector('.trade-row .buy-cell');
    expect(buyPriceCell?.textContent).toContain('130.00');

    const sellPriceCell = el.querySelector('.trade-row .sell-cell');
    expect(sellPriceCell?.textContent).toContain('145.00');

    const pnlCell = el.querySelector('.trade-row .pnl-cell');
    expect(pnlCell?.textContent).toContain('+₹750.00');
    expect(pnlCell?.textContent).not.toContain('%');
    expect(pnlCell?.classList.contains('profit-text')).toBe(true);

    const netPnlCell = el.querySelector('.trade-row .net-pnl-cell');
    expect(netPnlCell).toBeNull();

    const secondRowPnlCell = rows[1].querySelector('.pnl-cell');
    expect(secondRowPnlCell?.classList.contains('loss-text')).toBe(true);
  });

  it('should allow filtering by profit or loss status', () => {
    const el: HTMLElement = fixture.nativeElement;
    const profitBtn = el.querySelector('.profit-pill') as HTMLButtonElement;
    profitBtn.click();
    expect(mockTradeService.setStatusFilter).toHaveBeenCalledWith('PROFIT');
  });

  it('should render charges in separate column, show duration and not show IST in timing', () => {
    const el: HTMLElement = fixture.nativeElement;
    const timeCell = el.querySelector('.trade-row .time-cell');
    expect(timeCell?.textContent).not.toContain('IST');
    expect(timeCell?.textContent).toContain('15m 0s');

    const headers = el.querySelectorAll('th');
    const headerTexts = Array.from(headers).map(th => th.textContent?.trim());
    expect(headerTexts).toContain('Charges');
    expect(headerTexts).toContain('Buy / Sell / Duration');
    expect(headerTexts).toContain('Trade Value');
    expect(headerTexts).toContain('Realized P&L');
    expect(headerTexts).not.toContain('Net Realized P&L');
    expect(headerTexts).not.toContain('Execution Time (IST)');

    const chargesCell = el.querySelector('.trade-row .charges-cell');
    expect(chargesCell?.textContent).toContain('25.50');
  });

  it('should render section error when tradeService reports an error', () => {
    mockError.set('Failed to connect to Dhan API');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const errorEl = el.querySelector('app-section-error');
    expect(errorEl).toBeTruthy();
  });

  it('should show "Show Chart" button strictly for NIFTY 50 trades and open index chart modal on click', () => {
    const el: HTMLElement = fixture.nativeElement;
    const rows = el.querySelectorAll('.trade-row');
    expect(rows.length).toBe(2);

    // Row 0 is NIFTY 28 NOV 24500 CALL -> Show Chart present
    const niftyChartBtn = rows[0].querySelector('.show-chart-btn') as HTMLButtonElement;
    expect(niftyChartBtn).toBeTruthy();
    expect(niftyChartBtn.textContent).toContain('Show Chart');

    // Row 1 is RELIANCE -> Show Chart absent
    const relianceChartBtn = rows[1].querySelector('.show-chart-btn');
    expect(relianceChartBtn).toBeNull();

    // Also verify non-NIFTY indices are excluded from isNifty50Trade, while BANKNIFTY has chart support
    expect(component.isNifty50Trade({ ...mockTrades()[0], symbol: 'BANKNIFTY 52000 CE' })).toBe(false);
    expect(component.isBankNiftyTrade({ ...mockTrades()[0], symbol: 'BANKNIFTY 52000 CE' })).toBe(true);
    expect(component.hasIndexChartSupport({ ...mockTrades()[0], symbol: 'BANKNIFTY 52000 CE' })).toBe(true);
    expect(component.hasIndexChartSupport({ ...mockTrades()[0], symbol: 'MIDCPNIFTY 12500 PE' })).toBe(false);
    expect(component.isNifty50Trade({ ...mockTrades()[0], symbol: 'MIDCPNIFTY 12500 PE' })).toBe(false);
    expect(component.isNifty50Trade({ ...mockTrades()[0], symbol: 'SENSEX 80000 CE' })).toBe(false);
    expect(component.isNifty50Trade({ ...mockTrades()[0], symbol: 'NIFTY 24500 PE' })).toBe(true);

    // Click Show Chart
    niftyChartBtn.click();
    fixture.detectChanges();

    expect(mockHistoricalDataService.getCandles).toHaveBeenCalledWith({
      fromMonth: '2026-05',
      toMonth: '2026-05',
    });
    const chartModal = el.querySelector('app-trade-index-chart');
    expect(chartModal).toBeTruthy();
    expect(chartModal?.textContent).toContain('NIFTY 50');
    expect(chartModal?.textContent).toContain('Full Month (2026-05)');
    expect(chartModal?.textContent).toContain('2 bars');
    expect(chartModal?.textContent).toContain('24,520.50');
    expect(chartModal?.textContent).toContain('24,585.75');
    expect(chartModal?.textContent).toContain('+65.25 pts');
  });

  it('should resolve IST entry/exit epochs and matching 5m candles accurately', () => {
    const entryEpoch = parseIstTimeToEpoch('2026-05-10T10:02:30');
    expect(entryEpoch).toBe(parseIstTimeToEpoch('2026-05-10T10:02:30+05:30'));

    const resolved = resolveTradeEntryExit(mockTrades()[0]);
    expect(resolved?.entrySide).toBe('BUY');
    expect(resolved?.exitSide).toBe('SELL');
    expect(resolved?.startDateIst).toBe('2026-05-10');

    const candle = findMatchingFiveMinCandle(
      [
        {
          epoch: parseIstTimeToEpoch('2026-05-10T10:00:00')!,
          timestampIST: '2026-05-10T10:00:00',
          open: 24500,
          high: 24525,
          low: 24495,
          close: 24520.5,
          volume: 0,
        },
      ],
      entryEpoch!,
    );
    expect(candle?.close).toBe(24520.5);
  });

  it('should open BANK NIFTY index chart modal for BANKNIFTY trades', () => {
    const bankNiftyTrade = {
      ...mockTrades()[0],
      symbol: 'BANKNIFTY 52000 CE',
      customSymbol: 'BANKNIFTY 28 MAY 52000 CALL',
    };
    component.openTradeChart(bankNiftyTrade);
    fixture.detectChanges();

    expect(mockHistoricalDataService.getBankNiftyCandles).toHaveBeenCalledWith({
      fromMonth: '2026-05',
      toMonth: '2026-05',
    });
    const el: HTMLElement = fixture.nativeElement;
    const chartModal = el.querySelector('app-trade-index-chart');
    expect(chartModal).toBeTruthy();
    expect(chartModal?.textContent).toContain('BANK NIFTY');
    expect(chartModal?.textContent).toContain('52,140.25');
    expect(chartModal?.textContent).toContain('52,195.50');
    expect(chartModal?.textContent).toContain('+55.25 pts');
  });

  it('should render an instrument All-Trades Chart button for NIFTY 50 and open all-trades view', () => {
    const el: HTMLElement = fixture.nativeElement;
    const allNiftyBtn = el.querySelector('.instrument-chart-btn') as HTMLButtonElement;
    expect(allNiftyBtn).toBeTruthy();
    expect(allNiftyBtn.textContent).toContain('NIFTY 50 Chart (1)');

    allNiftyBtn.click();
    fixture.detectChanges();

    expect(component.isChartOpen()).toBe(true);
    expect(component.selectedChartMode()).toBe('all');
    const chartModal = el.querySelector('app-trade-index-chart');
    expect(chartModal).toBeTruthy();
    expect(chartModal?.textContent).toContain('5m · All Trades');
    expect(chartModal?.textContent).toContain('Total P&L');
  });
});

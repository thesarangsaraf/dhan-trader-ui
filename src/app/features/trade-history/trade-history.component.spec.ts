import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TradeHistoryComponent } from './trade-history.component';
import { TradeService } from '../../core/api/trade.service';

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
        { provide: TradeService, useValue: mockTradeService },
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

  it('should render consolidated single trade rows with buy and sell prices', () => {
    const el: HTMLElement = fixture.nativeElement;
    const rows = el.querySelectorAll('.trade-row');
    expect(rows.length).toBe(2);

    const firstRowSymbol = el.querySelector('.trade-row .symbol-name');
    expect(firstRowSymbol?.textContent).toContain('NIFTY 28 NOV 24500 CALL');

    const buyPriceCell = el.querySelector('.trade-row .buy-cell');
    expect(buyPriceCell?.textContent).toContain('130.00');

    const sellPriceCell = el.querySelector('.trade-row .sell-cell');
    expect(sellPriceCell?.textContent).toContain('145.00');

    const pnlCell = el.querySelector('.trade-row .pnl-cell');
    expect(pnlCell?.textContent).toContain('+₹750.00');
  });

  it('should allow filtering by profit or loss status', () => {
    const el: HTMLElement = fixture.nativeElement;
    const profitBtn = el.querySelector('.profit-pill') as HTMLButtonElement;
    profitBtn.click();
    expect(mockTradeService.setStatusFilter).toHaveBeenCalledWith('PROFIT');
  });

  it('should render section error when tradeService reports an error', () => {
    mockError.set('Failed to connect to Dhan API');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const errorEl = el.querySelector('app-section-error');
    expect(errorEl).toBeTruthy();
  });
});

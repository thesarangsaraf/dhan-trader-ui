import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, Observable, of, tap } from 'rxjs';
import {
  FinancialYearOption,
  HistoricalTradeItem,
  TradeHistoryQuery,
  TradeHistoryResponse,
  TradeSummary,
} from '../models/trade.models';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class TradeService {
  private readonly http = inject(HttpClient);

  readonly trades = signal<HistoricalTradeItem[]>([]);
  readonly summary = signal<TradeSummary | null>(null);
  readonly financialYears = signal<FinancialYearOption[]>([]);
  readonly selectedFinancialYear = signal<string>('');
  readonly fromDate = signal<string>('');
  readonly toDate = signal<string>('');
  readonly isCurrent = signal<boolean>(true);

  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // Filters
  readonly searchQuery = signal<string>('');
  readonly selectedStatus = signal<'ALL' | 'PROFIT' | 'LOSS' | 'OPEN'>('ALL');

  readonly filteredTrades = computed(() => {
    let list = this.trades();
    const query = this.searchQuery().trim().toLowerCase();
    const status = this.selectedStatus();

    if (query) {
      list = list.filter(
        (t) =>
          (t.symbol || '').toLowerCase().includes(query) ||
          String(t.securityId || '').includes(query) ||
          String(t.tradeId || '').toLowerCase().includes(query),
      );
    }

    if (status === 'PROFIT') {
      list = list.filter((t) => (t.status === 'CLOSED' || !t.status) && (t.pnl || 0) > 0);
    } else if (status === 'LOSS') {
      list = list.filter((t) => (t.status === 'CLOSED' || !t.status) && (t.pnl || 0) < 0);
    } else if (status === 'OPEN') {
      list = list.filter((t) => !!t.status?.startsWith('OPEN'));
    }

    return list;
  });

  constructor() {
    this.loadTradeHistory();
  }

  loadTradeHistory(query?: TradeHistoryQuery): void {
    this.isLoading.set(true);
    this.error.set(null);

    let params = new HttpParams();
    if (query?.financialYear) {
      params = params.set('financialYear', query.financialYear);
    }
    if (query?.fromDate) {
      params = params.set('fromDate', query.fromDate);
    }
    if (query?.toDate) {
      params = params.set('toDate', query.toDate);
    }
    if (query?.page !== undefined) {
      params = params.set('page', query.page.toString());
    }
    if (query?.fetchAll !== undefined) {
      params = params.set('fetchAll', query.fetchAll.toString());
    } else {
      params = params.set('fetchAll', 'true');
    }

    this.http
      .get<TradeHistoryResponse>('/api/trades/history', { params })
      .pipe(
        tap((res: any) => {
          this.isLoading.set(false);
          this.error.set(null);
          if (res) {
            const rawList = res.trades || [];
            const normalizedTrades = this.normalizeAndPairTrades(rawList);
            this.trades.set(normalizedTrades);

            const summary = this.normalizeSummary(res.summary, normalizedTrades);
            this.summary.set(summary);

            if (res.availableFinancialYears?.length) {
              this.financialYears.set(res.availableFinancialYears);
            }
            this.selectedFinancialYear.set(res.financialYear || '');
            this.fromDate.set(res.fromDate || '');
            this.toDate.set(res.toDate || '');
            this.isCurrent.set(!!res.isCurrent);
          }
        }),
        catchError((err) => {
          this.isLoading.set(false);
          const msg = err.error?.message || err.message || `Backend server not available (${environment.apiUrl})`;
          this.error.set(`Failed to load historical trades: ${msg}`);
          return of(null);
        }),
      )
      .subscribe();
  }

  /**
   * Resiliently normalizes trades, pairing BUY and SELL fills if the API returned raw records.
   */
  private normalizeAndPairTrades(rawList: any[]): HistoricalTradeItem[] {
    if (!Array.isArray(rawList) || rawList.length === 0) {
      return [];
    }

    // Check if the trades are already paired (has status and buyPrice/sellPrice)
    const isAlreadyPaired = rawList.some((t) => t.status && (t.buyPrice !== undefined || t.sellPrice !== undefined));
    if (isAlreadyPaired) {
      return rawList.map((t, idx) => ({
        tradeId: String(t.tradeId || `PAIR-${idx + 1}`),
        symbol: String(t.symbol || t.customSymbol || (t.securityId ? `Security #${t.securityId}` : 'UNKNOWN')),
        securityId: String(t.securityId || ''),
        quantity: Number(t.quantity || t.tradedQuantity || 0),
        buyPrice: t.buyPrice !== undefined && t.buyPrice !== null ? Number(t.buyPrice) : null,
        sellPrice: t.sellPrice !== undefined && t.sellPrice !== null ? Number(t.sellPrice) : null,
        pnl: t.pnl !== undefined && t.pnl !== null ? Number(t.pnl) : null,
        pnlPercentage: t.pnlPercentage !== undefined && t.pnlPercentage !== null ? Number(t.pnlPercentage) : null,
        totalCharges: t.totalCharges !== undefined && t.totalCharges !== null ? Number(t.totalCharges) : null,
        netPnL: t.netPnL !== undefined && t.netPnL !== null ? Number(t.netPnL) : (t.pnl !== undefined && t.pnl !== null ? Number(t.pnl) : null),
        status: t.status || 'CLOSED',
        isProfit: t.isProfit ?? (t.pnl !== null && t.pnl !== undefined ? t.pnl >= 0 : null),
        tradeDate: t.tradeDate || '',
        executionTime: String(t.executionTime || t.exchangeTime || t.createTime || t.tradeDate || ''),
        buyTime: t.buyTime || '',
        sellTime: t.sellTime || '',
      }));
    }

    // Client-side fallback pairing if raw un-paired fills were returned
    const grouped = new Map<string, any[]>();
    for (const t of rawList) {
      const key = String(t.securityId || t.symbol || 'UNKNOWN');
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(t);
    }

    const pairedResults: HistoricalTradeItem[] = [];
    let pairCounter = 1;

    for (const [, fills] of grouped.entries()) {
      const sorted = [...fills].sort((a, b) => {
        const timeA = new Date(a.executionTime || a.exchangeTime || a.createTime || 0).getTime() || 0;
        const timeB = new Date(b.executionTime || b.exchangeTime || b.createTime || 0).getTime() || 0;
        return timeA - timeB;
      });

      const buyQueue: Array<{ qty: number; price: number; time: string; date: string; fill: any }> = [];
      const sellQueue: Array<{ qty: number; price: number; time: string; date: string; fill: any }> = [];

      for (const fill of sorted) {
        let remainingQty = Number(fill.tradedQuantity || fill.quantity || 0);
        const fillPrice = Number(fill.tradedPrice || fill.price || 0);
        const fillTime = String(fill.executionTime || fill.exchangeTime || fill.createTime || '');
        const fillDate = String(fill.tradeDate || '');
        const side = (fill.transactionType || 'BUY').toUpperCase();

        if (side === 'BUY') {
          while (remainingQty > 0 && sellQueue.length > 0) {
            const sellItem = sellQueue[0];
            const matchedQty = Math.min(remainingQty, sellItem.qty);
            const pnl = Math.round((sellItem.price - fillPrice) * matchedQty * 100) / 100;
            const pnlPercentage = sellItem.price > 0
              ? Math.round(((sellItem.price - fillPrice) / sellItem.price) * 10000) / 100
              : 0;

            pairedResults.push({
              tradeId: `PAIR-${pairCounter++}`,
              symbol: String(fill.symbol || fill.customSymbol || (fill.securityId ? `Security #${fill.securityId}` : 'UNKNOWN')),
              securityId: String(fill.securityId || ''),
              quantity: matchedQty,
              buyPrice: fillPrice,
              sellPrice: sellItem.price,
              pnl,
              pnlPercentage,
              status: 'CLOSED',
              isProfit: pnl >= 0,
              tradeDate: fillDate || sellItem.date,
              executionTime: fillTime || sellItem.time,
              buyTime: fillTime,
              sellTime: sellItem.time,
            });

            remainingQty -= matchedQty;
            sellItem.qty -= matchedQty;
            if (sellItem.qty <= 0) sellQueue.shift();
          }

          if (remainingQty > 0) {
            buyQueue.push({ qty: remainingQty, price: fillPrice, time: fillTime, date: fillDate, fill });
          }
        } else {
          while (remainingQty > 0 && buyQueue.length > 0) {
            const buyItem = buyQueue[0];
            const matchedQty = Math.min(remainingQty, buyItem.qty);
            const pnl = Math.round((fillPrice - buyItem.price) * matchedQty * 100) / 100;
            const pnlPercentage = buyItem.price > 0
              ? Math.round(((fillPrice - buyItem.price) / buyItem.price) * 10000) / 100
              : 0;

            pairedResults.push({
              tradeId: `PAIR-${pairCounter++}`,
              symbol: String(fill.symbol || fill.customSymbol || (fill.securityId ? `Security #${fill.securityId}` : 'UNKNOWN')),
              securityId: String(fill.securityId || ''),
              quantity: matchedQty,
              buyPrice: buyItem.price,
              sellPrice: fillPrice,
              pnl,
              pnlPercentage,
              status: 'CLOSED',
              isProfit: pnl >= 0,
              tradeDate: fillDate || buyItem.date,
              executionTime: fillTime || buyItem.time,
              buyTime: buyItem.time,
              sellTime: fillTime,
            });

            remainingQty -= matchedQty;
            buyItem.qty -= matchedQty;
            if (buyItem.qty <= 0) buyQueue.shift();
          }

          if (remainingQty > 0) {
            sellQueue.push({ qty: remainingQty, price: fillPrice, time: fillTime, date: fillDate, fill });
          }
        }
      }

      for (const buyItem of buyQueue) {
        pairedResults.push({
          tradeId: `PAIR-${pairCounter++}`,
          symbol: String(buyItem.fill.symbol || buyItem.fill.customSymbol || (buyItem.fill.securityId ? `Security #${buyItem.fill.securityId}` : 'UNKNOWN')),
          securityId: String(buyItem.fill.securityId || ''),
          quantity: buyItem.qty,
          buyPrice: buyItem.price,
          sellPrice: null,
          pnl: null,
          pnlPercentage: null,
          status: 'OPEN_BUY',
          isProfit: null,
          tradeDate: buyItem.date,
          executionTime: buyItem.time,
          buyTime: buyItem.time,
        });
      }

      for (const sellItem of sellQueue) {
        pairedResults.push({
          tradeId: `PAIR-${pairCounter++}`,
          symbol: String(sellItem.fill.symbol || sellItem.fill.customSymbol || (sellItem.fill.securityId ? `Security #${sellItem.fill.securityId}` : 'UNKNOWN')),
          securityId: String(sellItem.fill.securityId || ''),
          quantity: sellItem.qty,
          buyPrice: null,
          sellPrice: sellItem.price,
          pnl: null,
          pnlPercentage: null,
          status: 'OPEN_SELL',
          isProfit: null,
          tradeDate: sellItem.date,
          executionTime: sellItem.time,
          sellTime: sellItem.time,
        });
      }
    }

    pairedResults.sort((a, b) => {
      const timeA = new Date(a.executionTime || a.tradeDate || 0).getTime() || 0;
      const timeB = new Date(b.executionTime || b.tradeDate || 0).getTime() || 0;
      return timeB - timeA;
    });

    return pairedResults;
  }

  private normalizeSummary(rawSum: any, trades: HistoricalTradeItem[]): TradeSummary {
    let totalRealizedPnL = 0;
    let closedTradesCount = 0;
    let profitableTradesCount = 0;
    let lossTradesCount = 0;
    let totalQuantity = 0;

    for (const t of trades) {
      totalQuantity += t.quantity || 0;
      if (t.status === 'CLOSED' && typeof t.pnl === 'number') {
        closedTradesCount++;
        totalRealizedPnL += t.pnl;
        if (t.pnl > 0) profitableTradesCount++;
        else if (t.pnl < 0) lossTradesCount++;
      }
    }

    const winRate = closedTradesCount > 0
      ? Math.round((profitableTradesCount / closedTradesCount) * 1000) / 10
      : 0;

    const totalCharges = trades.reduce((acc, t) => acc + (t.totalCharges || 0), 0);
    const grossPnL = rawSum?.totalRealizedPnL !== undefined
      ? Number(rawSum.totalRealizedPnL)
      : (rawSum?.netRealizedValue !== undefined ? Number(rawSum.netRealizedValue) : Math.round(totalRealizedPnL * 100) / 100);
    const sumCharges = rawSum?.totalCharges !== undefined ? Number(rawSum.totalCharges) : Math.round(totalCharges * 100) / 100;
    const netPnL = rawSum?.netRealizedPnL !== undefined ? Number(rawSum.netRealizedPnL) : Math.round((grossPnL - sumCharges) * 100) / 100;

    return {
      totalTrades: trades.length,
      closedTradesCount: rawSum?.closedTradesCount ?? closedTradesCount,
      profitableTradesCount: rawSum?.profitableTradesCount ?? profitableTradesCount,
      lossTradesCount: rawSum?.lossTradesCount ?? lossTradesCount,
      winRate: rawSum?.winRate !== undefined ? Number(rawSum.winRate) : winRate,
      totalRealizedPnL: grossPnL,
      totalCharges: sumCharges,
      netRealizedPnL: netPnL,
      totalQuantity: rawSum?.totalQuantity !== undefined ? Number(rawSum.totalQuantity) : totalQuantity,
    };
  }

  selectFinancialYear(fy: string): void {
    this.selectedFinancialYear.set(fy);
    this.loadTradeHistory({ financialYear: fy });
  }

  setCustomDateRange(fromDate: string, toDate: string): void {
    this.fromDate.set(fromDate);
    this.toDate.set(toDate);
    this.loadTradeHistory({ fromDate, toDate });
  }

  setSearchQuery(q: string): void {
    this.searchQuery.set(q);
  }

  setStatusFilter(status: 'ALL' | 'PROFIT' | 'LOSS' | 'OPEN'): void {
    this.selectedStatus.set(status);
  }

  refresh(): void {
    const fy = this.selectedFinancialYear();
    if (fy && fy !== 'CUSTOM') {
      this.loadTradeHistory({ financialYear: fy });
    } else if (this.fromDate() && this.toDate()) {
      this.loadTradeHistory({ fromDate: this.fromDate(), toDate: this.toDate() });
    } else {
      this.loadTradeHistory();
    }
  }
}

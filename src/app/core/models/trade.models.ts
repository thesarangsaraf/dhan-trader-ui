export interface FinancialYearOption {
  label: string;
  value: string; // e.g. "2026-2027"
  fromDate: string; // "2026-04-01"
  toDate: string; // "2027-03-31" or capped at today
  isCurrent: boolean;
}

export interface HistoricalTradeItem {
  tradeId: string;
  symbol: string; // Human-readable symbol (e.g. "NIFTY 28 NOV 24500 CALL", "RELIANCE")
  securityId: string;
  quantity: number;
  buyPrice: number | null;
  sellPrice: number | null;
  pnl: number | null;
  pnlPercentage: number | null;
  totalCharges?: number | null;
  netPnL?: number | null;
  status: 'CLOSED' | 'OPEN_BUY' | 'OPEN_SELL';
  isProfit: boolean | null;
  tradeDate?: string;
  executionTime: string;
  buyTime?: string;
  sellTime?: string;
}

export interface TradeSummary {
  totalTrades: number;
  closedTradesCount: number;
  profitableTradesCount: number;
  lossTradesCount: number;
  winRate: number;
  totalRealizedPnL: number;
  totalCharges?: number;
  netRealizedPnL?: number;
  totalQuantity: number;
}

export interface TradeHistoryResponse {
  financialYear: string;
  fromDate: string;
  toDate: string;
  isCurrent: boolean;
  page: number;
  availableFinancialYears: FinancialYearOption[];
  summary: TradeSummary;
  trades: HistoricalTradeItem[];
}

export interface TradeHistoryQuery {
  financialYear?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  fetchAll?: boolean;
}

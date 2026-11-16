export type ScreenerStrategyType =
  | 'DEMAND_ORDER_BLOCK'
  | 'SUPPLY_ORDER_BLOCK'
  | 'BULLISH_LIQUIDITY_SWEEP'
  | 'BEARISH_LIQUIDITY_SWEEP';

export type ScreenerSignalType = 'BUY' | 'SELL';

export interface ScreenerMatch {
  symbol: string;             // NSE Symbol without .NS (e.g., RELIANCE)
  customSymbol?: string;      // NSE Custom Symbol
  name: string;               // Company Name
  cmp: number;                // Current Market Price (₹)
  strategy: ScreenerStrategyType;
  strategyLabel: string;      // "Demand OB (Bullish)", "Liquidity Sweep (Bearish)", etc.
  signalType: ScreenerSignalType;
  entryPrice: number;         // Suggested Entry (₹)
  stopLossPrice: number;      // Suggested Stop Loss (₹)
  riskPoints: number;         // |Entry - StopLoss| (₹)
  riskPercent: number;        // (Risk / Entry) * 100
  timeframe: string;          // 15m, 1h, 1d, 1wk
  matchedAt: string;          // ISO timestamp
  candleTime?: number;
  details?: {
    zoneHigh?: number;
    zoneLow?: number;
    impulseTime?: number;
    swingLevel?: number;
    wickPercent?: number;
    notes?: string;
  };
}

export interface ScreenerScanResponse {
  timeframe: string;
  scannedAt: string;
  totalScanned: number;
  totalMatches: number;
  bullishMatches: number;
  bearishMatches: number;
  matches: ScreenerMatch[];
}

export interface WatchlistStockItem {
  symbol: string;
  customSymbol?: string;
  name: string;
  sector?: string;
  enabled: boolean;
  order?: number;
}

export interface ScreenerWatchlistDoc {
  symbols: WatchlistStockItem[];
  updatedAt: string;
  version?: number;
}

export interface ScreenerSettingsDoc {
  obImpulseMultiplier: number;
  obMinImpulseBodyPercent: number;
  obProximityBufferPercent: number;
  obLookbackCandles: number;
  sweepLookbackCandles: number;
  sweepMinWickRatio: number;
  batchSize: number;
  throttleMs: number;
  updatedAt?: string;
}

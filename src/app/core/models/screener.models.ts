export type ScreenerScanMode = 'live' | 'historical';

export type ScreenerSignalType = 'BUY' | 'SELL';

export type LiquidityLevelType = 'PDL' | 'PDH' | 'DAY_LOW' | 'DAY_HIGH';

export interface ScreenerCandle {
  time: number; // UNIX epoch seconds (strictly ascending, deduplicated)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ScreenerInstrumentItem {
  symbol: string;
  symbolName?: string;
  displayName?: string;
  name: string;
  exchId?: string;
  securityId?: string;
  exchangeSegment?: string;
  lotSize?: number;
  smFreezeQty?: number;
  strikeStep?: number;
  expiryFlag?: string;
  stopLossPoints?: number;
  enabled?: boolean;
}

export interface ScreenerInstrumentsResponse {
  instruments: ScreenerInstrumentItem[];
}

export interface LiquiditySweepSignal {
  id: string;
  symbol: string;
  displayName?: string;
  name: string;
  signalType: ScreenerSignalType;
  levelType: LiquidityLevelType;
  levelPrice: number;
  sweepPrice: number;
  sweepTimestamp: number;
  confirmationClosePrice: number;
  confirmationTimestamp: number;
  sessionDate: string;
  timeframe: '5m';
  candles: ScreenerCandle[];
}

export interface ScreenerScanRequest {
  mode: ScreenerScanMode;
  date?: string;
  startDate?: string;
  endDate?: string;
  symbols?: string[];
}

export interface ScreenerScanResponse {
  mode: ScreenerScanMode;
  timeframe: '5m';
  startDate?: string;
  endDate?: string;
  scannedAt: string;
  instrumentsScanned: Array<{ symbol: string; name: string }>;
  totalScanned: number;
  totalRecommendations: number;
  bullishCount: number;
  bearishCount: number;
  recommendations: LiquiditySweepSignal[];
}

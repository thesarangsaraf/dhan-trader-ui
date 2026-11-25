export interface HistoricalCandle {
  epoch: number;
  timestampIST: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface HistoricalCandlesMetadata {
  symbol: string;
  securityId: string;
  timeframe: string;
  sourceRepo: string;
  collection: string;
  totalCandles: number;
  totalMonths: number;
  firstEpoch: number;
  lastEpoch: number;
  firstMonth: string;
  lastMonth: string;
  months: string[];
  monthCounts: Record<string, number>;
  updatedAt: string;
}

export interface HistoricalDataStatusResult {
  storedInFirestore: boolean;
  syncInProgress: boolean;
  sourceRepo: string;
  collection: string;
  metadata: HistoricalCandlesMetadata | null;
}

export interface HistoricalDataSyncResult {
  success: boolean;
  collection: string;
  symbol: string;
  timeframe: string;
  sourceRepo: string;
  mode: 'full' | 'incremental';
  filesProcessed: number;
  filesSkipped: number;
  total1MinRows: number;
  totalCandlesSynced: number;
  totalCandlesInDb: number;
  monthsWritten: string[];
  totalMonthsInDb: number;
  firstMonth: string;
  lastMonth: string;
  firstEpoch: number;
  lastEpoch: number;
  durationMs: number;
  syncedAt: string;
  message: string;
}

export interface HistoricalCandlesQueryResult {
  success: boolean;
  symbol: string;
  timeframe: string;
  monthsRead: string[];
  count: number;
  candles: HistoricalCandle[];
}

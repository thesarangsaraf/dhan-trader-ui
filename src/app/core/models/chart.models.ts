export interface CandleData {
  time: number; // Unix epoch timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartCandlesResponse {
  symbol: string;
  yahooSymbol: string;
  interval: string;
  range: string;
  period1?: number;
  period2?: number;
  currency: string;
  exchange: string;
  lastPrice: number;
  count: number;
  candles: CandleData[];
}

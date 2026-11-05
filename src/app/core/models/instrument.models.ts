export interface Instrument {
  symbol: string;
  name: string;
  securityId: string;
  exchangeSegment: string;
  instrumentType: 'INDEX' | 'OPTIDX' | 'EQUITY' | 'FUTIDX' | string;
  ltp: number;
  lotSize?: number;
}

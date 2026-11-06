export interface Instrument {
  symbol: string;
  name: string;
  securityId: string;
  exchangeSegment: string;
  instrumentType: 'INDEX' | 'OPTIDX' | 'EQUITY' | 'FUTIDX' | string;
  ltp: number;
  lotSize?: number;
}

export interface OptionExpiryItem {
  expiryDate: string;
  displayExpiry: string;
  shortExpiry?: string;
}

export interface OptionContractDetails {
  symbol: string;
  tradingSymbol: string;
  instrumentName: string;
  strikePrice: number;
  optionType: 'CE' | 'PE';
  expiryDate: string;
  expiryType: 'CURRENT' | 'NEXT';
  securityId: string;
  exchangeSegment: string;
  lotSize: number;
  ltp: number;
  moneyness: 'ITM' | 'ATM' | 'OTM';
}

export interface StrikeOptionPair {
  strikePrice: number;
  relativeStrike?: 'ATM-1' | 'ATM' | 'ATM+1';
  call: OptionContractDetails;
  put: OptionContractDetails;
}

export interface ExpiryOptionChain {
  expiryDate: string;
  displayExpiry: string;
  shortExpiry: string;
  strikes: StrikeOptionPair[];
}

export interface OptionContractsResult {
  instrument: string;
  spotPrice: number;
  strikeStep: number;
  strikes: number[];
  currentExpiry: ExpiryOptionChain;
  nextExpiry: ExpiryOptionChain;
  contracts: OptionContractDetails[];
  expiries?: OptionExpiryItem[];
}

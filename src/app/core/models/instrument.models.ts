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
  customSymbol?: string;
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

export interface SecIdMappingMetadata {
  collection: string;
  totalInstruments: number;
  totalOptions: number;
  totalIndices: number;
  totalEquities: number;
  documentsCount: number;
  documentIds: string[];
  updatedAt: string;
}

export interface IndexOptionsMetadata {
  totalItems: number;
  totalChunks: number;
  chunkSize: number;
  documentsCount?: number;
  documentIds?: string[];
  tradedIndices?: string[];
  maxExpiriesPerIndex?: number;
  updatedAt: string;
}

export interface IndexOptionsStatusResult {
  storedInFirestore: boolean;
  metadata: IndexOptionsMetadata | null;
  inMemoryCount: number;
  tradedIndices: string[];
}

export interface SyncOptionsResult {
  success: boolean;
  collection: string;
  totalItems: number;
  totalChunks: number;
  writeTime: string;
  tradedIndices: string[];
  message?: string;
}

export interface SyncEquitiesResult {
  success: boolean;
  collection: string;
  totalInstruments: number;
  totalEquities: number;
  totalIndices: number;
  documents: string[];
  syncedAt: string;
  message?: string;
}

export interface SyncMasterResult {
  success: boolean;
  collection: string;
  totalInstruments: number;
  totalOptions: number;
  totalIndices: number;
  totalEquities: number;
  documents: string[];
  syncedAt: string;
  message?: string;
}

export interface SyncStatusResult {
  storedInFirestore: boolean;
  metadata: SecIdMappingMetadata | null;
  inMemoryCounts?: {
    indexOptions: number;
    scripMaster: number;
    total: number;
  };
}

export interface IndexConfigItem {
  symbol: string;
  name: string;
  securityId: string;
  exchangeSegment: string;
  defaultLotSize?: number;           // 1. Default lot size preferred for this index (e.g. 5 lots)
  defaultQuantityInOneLot?: number;  // 2. Default quantity in 1 lot size (e.g. 65 shares/lot)
  stopLossPoints?: number;
  enabled: boolean;
  order?: number;

  // Compatibility aliases
  lotSize?: number;
  defaultLots?: number;
  defaultQuantity?: number;
}

export interface CachedIndexOption {
  symbolName: string;
  exchange: string;
  securityId: string;
  tradingSymbol: string;
  customSymbol: string;
  expiryDate: string;
  strikePrice: number;
  optionType: string;
  lotSize: number;
}

export interface EquitiesQueryResult {
  total: number;
  items: Instrument[];
  limit: number;
  offset: number;
}

export interface OptionsQueryResult {
  total: number;
  items: CachedIndexOption[];
  limit: number;
  offset: number;
  expiries: string[];
  tradedIndices: string[];
}

export interface IndexLotSizesConfig {
  nifty50: number;
  bankNifty: number;
  midcapNifty: number;
  sensex: number;
  nifty50Lots?: number;
  bankNiftyLots?: number;
  midcapNiftyLots?: number;
  sensexLots?: number;
  indices?: IndexConfigItem[];
  updatedAt?: string;
}

export interface UpdateLotSizesDto {
  nifty50?: number;
  bankNifty?: number;
  midcapNifty?: number;
  sensex?: number;
  nifty50Lots?: number;
  bankNiftyLots?: number;
  midcapNiftyLots?: number;
  sensexLots?: number;
  indices?: IndexConfigItem[];
}


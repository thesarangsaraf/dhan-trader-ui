export interface Instrument {
  symbol: string;
  displayName?: string;
  symbolName?: string;
  underlyingSymbol?: string;
  exchId?: string;
  segment?: string;
  customSymbol?: string;
  tradingSymbol?: string;
  name: string;
  securityId: string;
  exchangeSegment: string;
  fnoExchangeSegment?: string;
  instrumentType: 'INDEX' | 'OPTIDX' | 'EQUITY' | 'FUTIDX' | string;
  ltp: number;
  lotSize?: number;
  smFreezeQty?: number;
  tickSize?: number;
  expiryFlag?: string;
  strikeStep?: number;
  preferredLots?: number;
  defaultLotSize?: number;           // Preferred lot size (e.g. 5, 10, 15 lots)
  defaultQuantityInOneLot?: number;  // Quantity in 1 lot (e.g. 65, 30)
  defaultLots?: number;              // Compatibility alias for defaultLotSize
  defaultQuantity?: number;          // Compatibility alias for defaultLots * defaultQuantityInOneLot
  stopLossPoints?: number;
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

export interface FlushAndReloadResult {
  success: boolean;
  flushed: {
    secIdMappingDeleted: number;
    indexOptionsDeleted: number;
  };
  reloaded: {
    totalInstruments: number;
    totalEquities: number;
    totalIndices: number;
    totalOptions: number;
    documents?: string[];
    syncedAt?: string;
  };
  message: string;
}

export interface FlushAndReloadEquitiesResult {
  success: boolean;
  collection: string;
  deletedDocuments: number;
  totalInstruments: number;
  totalEquities: number;
  totalIndices: number;
  documents: string[];
  syncedAt: string;
  message: string;
}

export interface FlushAndReloadOptionsResult {
  success: boolean;
  collection: string;
  deletedDocuments: number;
  totalItems: number;
  totalChunks: number;
  documentIds?: string[];
  writeTime?: string;
  tradedIndices?: string[];
  message: string;
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
  // Official Dhan fields
  exchId?: string;
  segment?: string;
  exchangeSegment: string;
  securityId: string;
  isin?: string;
  instrument?: string;
  underlyingSecurityId?: string;
  underlyingSymbol?: string;
  symbolName?: string;
  displayName?: string;
  instrumentType?: string;
  series?: string;
  lotSize?: number;
  indexLotSize?: number;
  tickSize?: number;
  expiryFlag?: string;
  expiryFlags?: string[];
  smFreezeQty?: number;
  fnoExchangeSegment?: string;
  fnoUnderlyingSecurityId?: string;
  strikeStep?: number;
  optTickSize?: number;
  // User trading preferences
  preferredLots?: number;
  stopLossPoints?: number;
  order?: number;

  // Compatibility aliases
  symbol: string;
  name: string;
  defaultLotSize?: number;
  defaultQuantityInOneLot?: number;
  defaultLots?: number;
  defaultQuantity?: number;
}

export type TradedInstrumentRecord = IndexConfigItem;

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
  source?: string;
  nifty50: number;
  bankNifty: number;
  midcapNifty: number;
  sensex: number;
  nifty50Lots?: number;
  bankNiftyLots?: number;
  midcapNiftyLots?: number;
  sensexLots?: number;
  instruments?: IndexConfigItem[];
  indices?: IndexConfigItem[];
  updatedAt?: string;
}

export type TradedInstrumentsConfig = IndexLotSizesConfig;

export interface UpdateLotSizesDto {
  nifty50?: number;
  bankNifty?: number;
  midcapNifty?: number;
  sensex?: number;
  nifty50Lots?: number;
  bankNiftyLots?: number;
  midcapNiftyLots?: number;
  sensexLots?: number;
  instruments?: IndexConfigItem[];
  indices?: IndexConfigItem[];
}

export type UpdateTradedInstrumentsDto = UpdateLotSizesDto;


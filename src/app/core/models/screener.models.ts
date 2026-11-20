export type ScreenerScanMode = 'live' | 'historical';

export type ScreenerSignalType = 'BUY' | 'SELL';

export type ScreenerStrategyType =
  | 'liquidity-sweep'
  | 'LIQUIDITY_SWEEP'
  | 'order-block'
  | 'ORDER_BLOCK';

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

// -------------------------------------------------------------
// STANDALONE LIQUIDITY SWEEP STRATEGY SCANNER INTERFACES
// -------------------------------------------------------------

export type LiquiditySide = 'BSL' | 'SSL';
export type LiquidityPoolType = 'SWING' | 'EQH' | 'EQL' | 'PDH' | 'PDL';
export type LiquidityPoolStatus = 'ACTIVE' | 'SWEPT' | 'BROKEN';
export type LiquiditySweepDirection = 'BULLISH' | 'BEARISH';
export type SweepEntryMode = 'RECLAIM_CLOSE' | 'LTF_STRUCTURE_SHIFT';

export interface SwingPivot {
  index: number;
  time: number;
  price: number;
  type: 'HIGH' | 'LOW';
  confirmedAtIndex: number;
  confirmedAtTime: number;
}

export interface LiquidityPool {
  id: string;
  side: LiquiditySide;
  poolType: LiquidityPoolType;
  price: number;
  startTime: number;
  startIndex?: number;
  touchCount: number;
  status: LiquidityPoolStatus;
  sweptTime?: number;
  brokenTime?: number;
}

export interface LiquiditySweepEvent {
  poolId?: string;
  side?: LiquiditySide;
  direction: LiquiditySweepDirection;
  poolType: LiquidityPoolType;
  sweptPrice: number;
  sweepWickExtreme: number;
  sweepTime: number;
  reclaimTime: number;
  reclaimClose?: number;
  reclaimClosePrice?: number;
  reclaimCandleIndex?: number;
  sweepIndex?: number;
  reclaimIndex?: number;
  status?: string;
}

export interface LiquiditySweepTradeSignal {
  action: ScreenerSignalType; // 'BUY' | 'SELL'
  entryMode: SweepEntryMode; // 'RECLAIM_CLOSE' | 'LTF_STRUCTURE_SHIFT'
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  rrRatio: number;
  targetPoolPrice: number;
  targetPoolId?: string;
  sweptPoolId?: string;
  sweepTime?: number;
  reclaimTime?: number;
  atrAtEntry?: number;
}

export interface LiquiditySweepChartOverlay {
  pools: Array<{
    id: string;
    side: LiquiditySide;
    poolType: LiquidityPoolType;
    price: number;
    startTime: number;
    endTime: number;
    status: LiquidityPoolStatus;
    touchCount: number;
    color: string;
    lineStyle: 'dashed' | 'dotted' | 'solid';
  }>;
  sweeps: Array<{
    direction: LiquiditySweepDirection;
    poolType: LiquidityPoolType;
    sweptPrice: number;
    sweepWickExtreme: number;
    sweepTime: number;
    reclaimTime: number;
  }>;
  liquidityLines?: Array<{
    poolId: string;
    side: LiquiditySide;
    poolType: LiquidityPoolType;
    price: number;
    startTime: number;
    endTime?: number;
    style: 'DASHED' | 'DOTTED' | 'SOLID';
    color: string;
    title: string;
  }>;
  sweepMarkers?: Array<{
    time: number;
    position: 'aboveBar' | 'belowBar';
    color: string;
    shape: 'arrowUp' | 'arrowDown';
    text: string;
  }>;
  tradeLines?: {
    entry: number;
    stopLoss: number;
    takeProfit: number;
  };
  signal?: {
    action: ScreenerSignalType;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    rrRatio: number;
    targetPoolPrice: number;
  };
}

export interface LiquiditySweepSymbolResult {
  symbol: string;
  displayName?: string;
  name?: string;
  strategy?: 'LIQUIDITY_SWEEP';
  timeframe: string;
  currentPrice?: number;
  activePools: Array<{
    id: string;
    side: LiquiditySide;
    poolType: LiquidityPoolType;
    price: number;
    startTime: number;
    startIndex?: number;
    touchCount: number;
    status?: LiquidityPoolStatus;
  }>;
  allPools?: LiquidityPool[];
  recentSweeps: LiquiditySweepEvent[];
  signal?: LiquiditySweepTradeSignal | null;
  candles: ScreenerCandle[];
  ltfCandles?: ScreenerCandle[];
  chartOverlay: LiquiditySweepChartOverlay;
}

export interface LiquiditySweepScanResponse {
  mode: ScreenerScanMode;
  strategy: 'LIQUIDITY_SWEEP' | 'liquidity-sweep';
  timeframe: string;
  startDate?: string;
  endDate?: string;
  scannedAt: string;
  instrumentsScanned: Array<{ symbol: string; displayName: string; name: string }>;
  totalScanned: number;
  totalActivePools: number;
  totalSignals: number;
  bullishCount: number;
  bearishCount: number;
  results: LiquiditySweepSymbolResult[];
}

// -------------------------------------------------------------
// SMART MONEY CONCEPTS (SMC) & ORDER BLOCK SCANNER INTERFACES
// -------------------------------------------------------------

export type TrendBias = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export type SwingType = 'HIGH' | 'LOW';
export type SwingClassification = 'HH' | 'LH' | 'HL' | 'LL';

export interface SwingPoint {
  index: number;
  time: number;
  price: number;
  type: SwingType;
  classification?: SwingClassification;
  confirmedAtIndex: number;
  confirmedAtTime: number;
  broken?: boolean;
}

export type StructureBreakType = 'BOS' | 'CHOCH';

export interface StructureBreak {
  type: StructureBreakType; // 'BOS' | 'CHOCH'
  direction: 'BULLISH' | 'BEARISH';
  brokenSwingIndex: number;
  brokenSwingPrice: number;
  brokenSwingTime: number;
  breakCandleIndex: number;
  breakCandleTime: number;
  breakCandleClose: number;
  initiatingSwingIndex: number;
  initiatingSwingPrice: number;
  initiatingSwingTime: number;
  isStrong: boolean;
}

export type OrderBlockType = 'BULLISH' | 'BEARISH';
export type OrderBlockClassification = 'EXTREME' | 'DECISIONAL';

export interface FvgBounds {
  top: number;
  bottom: number;
  candleIndex: number;
  time: number;
  isGap?: boolean;
}

export interface OrderBlock {
  id: string;
  type: OrderBlockType;
  obType: OrderBlockClassification;
  candleIndex: number;
  createdAt: number;
  zoneHigh: number;
  zoneLow: number;
  equilibrium: number;
  fvgBounds?: FvgBounds;
  bosPrice: number;
  structureBreakType: StructureBreakType;
  structureBreakTime: number;
  mitigated: boolean;
  mitigatedAt?: number;
  invalidated: boolean;
  invalidatedAt?: number;
  status: 'UNMITIGATED' | 'APPROACHING' | 'MITIGATING' | 'MITIGATED' | 'INVALIDATED';
  proximityPercent?: number;
}

export type OrderBlockConfirmationType = 'LTF_CHOCH' | 'LIMIT_TAP';

export interface OrderBlockTradeSignal {
  id: string;
  symbol: string;
  displayName?: string;
  signalType: 'BUY' | 'SELL';
  confirmationType: OrderBlockConfirmationType;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  rrRatio: number;
  htfTimeframe: '1h' | '4h';
  ltfTimeframe?: '5m' | '15m';
  htfOrderBlock?: OrderBlock;
  ltfOrderBlock?: OrderBlock;
  triggerTimestamp: number;
  triggerPrice: number;
  sessionDate: string;
}

export interface OrderBlockChartOverlay {
  orderBlocks: Array<{
    id: string;
    type: OrderBlockType;
    obType: OrderBlockClassification;
    zoneHigh: number;
    zoneLow: number;
    equilibrium: number;
    startTime: number;
    endTime: number;
    color: string;
    status: string;
  }>;
  fvgs: Array<{
    top: number;
    bottom: number;
    startTime: number;
    endTime: number;
    type: OrderBlockType;
  }>;
  breaks: Array<{
    type: StructureBreakType;
    price: number;
    startTime: number;
    endTime: number;
    direction: 'BULLISH' | 'BEARISH';
    label: string;
  }>;
  tradeSignal?: {
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    rrRatio: number;
    signalType: 'BUY' | 'SELL';
  };
}

export interface OrderBlockSymbolResult {
  symbol: string;
  displayName?: string;
  name: string;
  timeframe: string;
  trendBias: TrendBias;
  activeOrderBlocks: OrderBlock[];
  allOrderBlocks?: OrderBlock[];
  swings?: SwingPoint[];
  structureBreaks?: StructureBreak[];
  candles: ScreenerCandle[];
  ltfCandles?: ScreenerCandle[];
  chartOverlay: OrderBlockChartOverlay;
  proximityStatus?: 'APPROACHING' | 'MITIGATING' | 'NONE';
  tradeSignal?: OrderBlockTradeSignal;
}

export interface OrderBlockScanResponse {
  mode: ScreenerScanMode;
  strategy: 'order-block';
  htf: '1h' | '4h';
  ltf?: '5m' | '15m';
  startDate?: string;
  endDate?: string;
  scannedAt: string;
  instrumentsScanned: Array<{ symbol: string; displayName: string; name: string }>;
  totalScanned: number;
  totalActiveOrderBlocks: number;
  totalSignals: number;
  approachingCount: number;
  mitigatingCount: number;
  sniperSignalCount: number;
  results: OrderBlockSymbolResult[];
}

export interface ScreenerScanRequest {
  mode: ScreenerScanMode;
  strategy?: ScreenerStrategyType;
  timeframe?: '5m' | '15m' | '1h' | '4h';
  date?: string;
  startDate?: string;
  endDate?: string;
  symbols?: string[];
  htfTimeframe?: '1h' | '4h';
  ltfTimeframe?: '5m' | '15m';
  scanType?: 'PROXIMITY' | 'CONFIRMATION' | 'BOTH';
  swingLookback?: number;
  requireFVG?: boolean;
  minRR?: number;
  entryMode?: any;
  proximityPercent?: number;
  eqToleranceATR?: number;
  minSweepDepthATR?: number;
  maxReclaimBars?: number;
  includeSessionExtremes?: boolean;
}

export interface ScreenerScanResponse {
  mode: ScreenerScanMode;
  strategy?: ScreenerStrategyType;
  timeframe?: '5m' | '15m' | '1h' | '4h';
  startDate?: string;
  endDate?: string;
  scannedAt: string;
  instrumentsScanned: Array<{ symbol: string; name?: string; displayName?: string }>;
  totalScanned: number;
  totalRecommendations: number;
  bullishCount: number;
  bearishCount: number;
  recommendations: LiquiditySweepSignal[];
  liquiditySweepData?: LiquiditySweepScanResponse;
  orderBlockData?: OrderBlockScanResponse;
}

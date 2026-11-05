export type TransactionType = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
export type ProductType = 'INTRADAY' | 'CNC' | 'MARGIN';
export type OrderStatus = 'COMPLETE' | 'PENDING' | 'REJECTED' | 'CANCELLED' | 'TRANSIT';

export interface DhanOrder {
  orderId: string;
  dhanClientId?: string;
  symbol: string;
  securityId: string;
  exchangeSegment: string;
  transactionType: TransactionType;
  orderType: OrderType;
  productType: ProductType;
  quantity: number;
  price: number;
  triggerPrice?: number;
  status: OrderStatus;
  createTime: string;
  updateTime?: string;
  rejectionReason?: string;
}

export interface PlaceOrderDto {
  symbol: string;
  securityId?: string;
  exchangeSegment?: string;
  transactionType: TransactionType;
  orderType?: OrderType;
  productType?: ProductType;
  quantity: number;
  price?: number;
  triggerPrice?: number;
}

export interface DhanPosition {
  positionId: string;
  symbol: string;
  securityId: string;
  exchangeSegment: string;
  productType: string;
  netQty: number;
  buyQty: number;
  sellQty: number;
  buyAvg: number;
  sellAvg: number;
  ltp: number;
  realizedPnL: number;
  unrealizedPnL: number;
}

export interface AccountFunds {
  availableBalance: number;
  utilizedMargin: number;
  collateralAmount: number;
}

export interface PositionsSummary {
  totalRealized: number;
  totalUnrealized: number;
  netPnL: number;
  openPositionsCount: number;
  closedPositionsCount: number;
}

export interface PositionsResponse {
  positions: DhanPosition[];
  funds: AccountFunds;
  summary: PositionsSummary;
}

export interface DhanHolding {
  symbol: string;
  securityId: string;
  exchange: string;
  totalQty: number;
  dpQty: number;
  avgCostPrice: number;
  ltp: number;
  currentValue: number;
  pnl: number;
}

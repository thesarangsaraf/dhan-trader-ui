export type AlertOperator =
  | 'GREATER_THAN_EQUAL'
  | 'LESS_THAN_EQUAL'
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'CROSSING_ANY_SIDE'
  | 'GREATER_THAN_OR_EQUAL'
  | 'LESS_THAN_OR_EQUAL'
  | 'CROSSING_UP'
  | 'CROSSING_DOWN';

export type AlertStatus = 'ACTIVE' | 'TRIGGERED' | 'CANCELLED';

export interface AlertStopLossConfig {
  enabled: boolean;
  points: number;
  targetPrice: number;
  operator?: AlertOperator | string;
  action?: 'BUY' | 'SELL';
}

export interface AlertAttachedOrder {
  enabled?: boolean;
  action?: 'BUY' | 'SELL';
  transactionType?: 'BUY' | 'SELL';
  symbol: string;
  tradingSymbol?: string;
  customSymbol?: string;
  instrumentName?: string;
  expiryDate?: string;
  expDate?: string;
  strikePrice?: number;
  optionType?: string;
  securityId?: string;
  exchangeSegment?: string;
  productType?: 'INTRADAY' | 'CNC' | 'MARGIN' | string;
  orderType?: 'MARKET' | 'LIMIT' | string;
  quantity: number;
  lots?: number;
  price?: number;
  triggerPrice?: number;
  validity?: string;
  status?: string;
  orderId?: string | null;
  executedAt?: string | null;
}

export interface DhanAlert {
  id: string;
  dhanAlertId?: string;
  instrument: string;
  securityId: string;
  exchangeSegment: string;
  targetPrice: number;
  currentPrice?: number | null;
  operator: AlertOperator;
  status: AlertStatus;
  remarks: string;
  createdAt: string;
  triggeredAt?: string | null;
  expDate?: string;
  attachedOrder?: AlertAttachedOrder;
  orders?: AlertAttachedOrder[];
  conditionalOrders?: AlertAttachedOrder[];
  hasConditionalOrder?: boolean;
  stopLoss?: AlertStopLossConfig;
  stopLossAlertPlaced?: boolean;
  stopLossAlertId?: string | null;
  linkedStopLossAlert?: DhanAlert;
  isStopLossAlert?: boolean;
  parentAlertId?: string | null;
  dhanMetadata?: {
    monitoringMode?: string;
    exchangeSegment?: string;
    securityId?: string;
  };
}

export interface CreateAlertDto {
  instrument: string;
  targetPrice: number;
  operator?: AlertOperator;
  remarks?: string;
  securityId?: string;
  exchangeSegment?: string;
  attachedOrder?: AlertAttachedOrder;
  conditionalOrder?: {
    symbol: string;
    securityId?: string;
    exchangeSegment?: string;
    transactionType: 'BUY' | 'SELL';
    orderType: 'MARKET' | 'LIMIT';
    productType: 'INTRADAY' | 'CNC' | 'MARGIN';
    quantity: number;
    lots?: number;
    price?: number;
    validity?: string;
  };
  expDate?: string;
  stopLoss?: AlertStopLossConfig;
}

export interface UpdateAlertDto {
  targetPrice?: number;
  operator?: AlertOperator;
  remarks?: string;
  status?: AlertStatus;
}

export interface GroupedAlert {
  instrument: string;
  currentPrice: number | null;
  activeCount: number;
  triggeredCount: number;
  alerts: DhanAlert[];
}

export interface AlertTriggerEvent {
  id: string;
  instrument: string;
  targetPrice: number;
  triggeredPrice: number;
  operator: AlertOperator;
  remarks: string;
  triggeredAt: string;
  isTest?: boolean;
  attachedOrderExecuted?: boolean;
}

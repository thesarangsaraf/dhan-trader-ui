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

export interface AlertAttachedOrder {
  enabled: boolean;
  action: 'BUY' | 'SELL';
  symbol: string;
  securityId?: string;
  exchangeSegment?: string;
  productType: 'INTRADAY' | 'CNC' | 'MARGIN';
  orderType: 'MARKET' | 'LIMIT';
  quantity: number;
  price?: number;
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
  attachedOrder?: AlertAttachedOrder;
  dhanMetadata?: {
    noStaticIpRequired?: boolean;
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
    price?: number;
    validity?: string;
  };
  expDate?: string;
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

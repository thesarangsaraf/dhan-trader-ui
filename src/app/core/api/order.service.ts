import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, Observable, of, tap } from 'rxjs';
import {
  AccountFunds,
  DhanHolding,
  DhanOrder,
  DhanPosition,
  PlaceOrderDto,
  PositionsResponse,
  PositionsSummary,
} from '../models/order.models';

@Injectable({
  providedIn: 'root',
})
export class OrderService {
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);

  readonly orders = signal<DhanOrder[]>([]);
  readonly positions = signal<DhanPosition[]>([]);
  readonly holdings = signal<DhanHolding[]>([]);
  readonly funds = signal<AccountFunds | null>(null);
  readonly summary = signal<PositionsSummary | null>(null);

  readonly isLoadingOrders = signal<boolean>(false);
  readonly isLoadingPositions = signal<boolean>(false);
  readonly isLoadingHoldings = signal<boolean>(false);

  readonly ordersError = signal<string | null>(null);
  readonly positionsError = signal<string | null>(null);
  readonly holdingsError = signal<string | null>(null);

  readonly openOrders = computed(() =>
    this.orders().filter((o) => o.status === 'PENDING' || o.status === 'TRANSIT')
  );
  readonly completedOrders = computed(() =>
    this.orders().filter((o) => o.status === 'COMPLETE')
  );

  private autoRefreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.refreshAll();
    this.startAutoRefresh();
  }

  private startAutoRefresh(): void {
    if (this.autoRefreshTimer) clearInterval(this.autoRefreshTimer);
    this.autoRefreshTimer = setInterval(() => {
      this.refreshPositions();
      this.refreshOrders();
    }, 5000);
  }

  refreshAll(): void {
    this.refreshOrders();
    this.refreshPositions();
    this.refreshHoldings();
  }

  refreshOrders(): void {
    this.isLoadingOrders.set(true);
    this.http
      .get<DhanOrder[]>('/api/orders')
      .pipe(
        tap((data) => {
          this.isLoadingOrders.set(false);
          this.ordersError.set(null);
          if (Array.isArray(data)) {
            this.orders.set(data);
          }
        }),
        catchError((err) => {
          this.isLoadingOrders.set(false);
          this.ordersError.set('Failed to load order book: Backend server not available (127.0.0.1:8000).');
          return of([]);
        })
      )
      .subscribe();
  }

  refreshPositions(): void {
    this.isLoadingPositions.set(true);
    this.http
      .get<PositionsResponse>('/api/positions')
      .pipe(
        tap((res) => {
          this.isLoadingPositions.set(false);
          this.positionsError.set(null);
          if (res) {
            this.positions.set(res.positions || []);
            this.funds.set(res.funds || null);
            this.summary.set(res.summary || null);
          }
        }),
        catchError((err) => {
          this.isLoadingPositions.set(false);
          this.positionsError.set('Failed to load positions: Backend server not available (127.0.0.1:8000).');
          return of(null);
        })
      )
      .subscribe();
  }

  refreshHoldings(): void {
    this.isLoadingHoldings.set(true);
    this.http
      .get<DhanHolding[]>('/api/holdings')
      .pipe(
        tap((data) => {
          this.isLoadingHoldings.set(false);
          this.holdingsError.set(null);
          if (Array.isArray(data)) {
            this.holdings.set(data);
          }
        }),
        catchError((err) => {
          this.isLoadingHoldings.set(false);
          this.holdingsError.set('Failed to load Demat holdings: Backend server not available (127.0.0.1:8000).');
          return of([]);
        })
      )
      .subscribe();
  }

  placeOrder(dto: PlaceOrderDto) {
    return this.http
      .post<{ success: boolean; order: DhanOrder; source?: string }>('/api/orders', dto)
      .pipe(
        tap((res) => {
          this.refreshOrders();
          this.refreshPositions();
          this.snackBar.open(
            `Order Placed: ${dto.transactionType} ${dto.quantity}x ${dto.symbol} (ID: ${res.order.orderId})`,
            'OK',
            { duration: 4000 }
          );
        })
      );
  }

  cancelOrder(orderId: string) {
    return this.http
      .delete<{ success: boolean; message?: string }>(`/api/orders/${orderId}`)
      .pipe(
        tap((res) => {
          this.refreshOrders();
          this.snackBar.open(res.message || `Order ${orderId} cancelled`, 'OK', {
            duration: 3000,
          });
        })
      );
  }

  exitPosition(position: DhanPosition): Observable<{ success: boolean; order: DhanOrder; source?: string } | null> {
    if (position.netQty === 0) return of(null);
    const isLong = position.netQty > 0;
    const exitAction = isLong ? 'SELL' : 'BUY';
    const exitQty = Math.abs(position.netQty);

    return this.placeOrder({
      symbol: position.symbol,
      securityId: position.securityId,
      exchangeSegment: position.exchangeSegment,
      transactionType: exitAction,
      orderType: 'MARKET',
      productType: position.productType as any,
      quantity: exitQty,
    });
  }
}

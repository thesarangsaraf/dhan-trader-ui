import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, Observable, of, tap } from 'rxjs';
import {
  AccountFunds,
  DhanOrder,
  DhanOrderWebSocketStatus,
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
  readonly funds = signal<AccountFunds | null>(null);
  readonly summary = signal<PositionsSummary | null>(null);

  readonly isLoadingOrders = signal<boolean>(false);
  readonly isLoadingPositions = signal<boolean>(false);

  readonly ordersError = signal<string | null>(null);
  readonly positionsError = signal<string | null>(null);
  readonly wsStatus = signal<DhanOrderWebSocketStatus | null>(null);

  readonly openOrders = computed(() =>
    this.orders().filter((o) => o.status === 'PENDING' || o.status === 'TRANSIT')
  );
  readonly completedOrders = computed(() =>
    this.orders().filter((o) => o.status === 'COMPLETE')
  );

  constructor() {
    this.refreshAll();
  }

  refreshAll(): void {
    this.refreshOrders();
    this.refreshPositions();
    this.refreshWebSocketStatus();
  }

  refreshWebSocketStatus(): void {
    this.http
      .get<DhanOrderWebSocketStatus>('/api/orders/websocket/status')
      .pipe(
        tap((status) => this.wsStatus.set(status)),
        catchError(() => of(null))
      )
      .subscribe();
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
          const msg = err.error?.message || 'Backend server not available (127.0.0.1:8000)';
          this.ordersError.set(`Failed to load order book: ${msg}`);
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
          const msg = err.error?.message || 'Backend server not available (127.0.0.1:8000)';
          this.positionsError.set(`Failed to load positions: ${msg}`);
          return of(null);
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

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrderBookComponent } from './order-book.component';
import { OrderService } from '../../../../core/api/order.service';
import { DhanOrder } from '../../../../core/models/order.models';

describe('OrderBookComponent', () => {
  let component: OrderBookComponent;
  let fixture: ComponentFixture<OrderBookComponent>;

  const mockOrders = signal<DhanOrder[]>([]);
  const mockOrdersError = signal<string | null>(null);

  const mockOrderService = {
    orders: mockOrders,
    ordersError: mockOrdersError,
    refreshOrders: vi.fn(),
    cancelOrder: vi.fn().mockReturnValue({ subscribe: vi.fn() }),
  };

  const mockDialog = {
    open: vi.fn(),
  };

  beforeEach(async () => {
    mockDialog.open.mockClear();
    await TestBed.configureTestingModule({
      imports: [OrderBookComponent],
      providers: [
        { provide: OrderService, useValue: mockOrderService },
        { provide: MatDialog, useValue: mockDialog },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrderBookComponent);
    component = fixture.componentInstance;
  });

  it('should create OrderBookComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should prevent non-admin users from cancelling orders', () => {
    component.userAuthService.currentUser.set({
      username: 'trader_bob',
      role: 'trader',
    });

    const testOrder: DhanOrder = {
      orderId: 'ORD-12345',
      symbol: 'NIFTY 24500 CE',
      securityId: '45021',
      exchangeSegment: 'NSE_FNO',
      transactionType: 'BUY',
      orderType: 'MARKET',
      productType: 'INTRADAY',
      quantity: 50,
      price: 130,
      triggerPrice: 0,
      status: 'PENDING',
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString(),
    };

    component.confirmCancel(testOrder);
    expect(mockDialog.open).not.toHaveBeenCalled();
  });

  it('should allow admin users to cancel orders via confirmation dialog', () => {
    component.userAuthService.currentUser.set({
      username: 'sarang',
      role: 'admin',
    });
    mockDialog.open.mockReturnValue({
      afterClosed: () => ({ subscribe: vi.fn() }),
    });

    const testOrder: DhanOrder = {
      orderId: 'ORD-12345',
      symbol: 'NIFTY 24500 CE',
      securityId: '45021',
      exchangeSegment: 'NSE_FNO',
      transactionType: 'BUY',
      orderType: 'MARKET',
      productType: 'INTRADAY',
      quantity: 50,
      price: 130,
      triggerPrice: 0,
      status: 'PENDING',
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString(),
    };

    component.confirmCancel(testOrder);
    expect(mockDialog.open).toHaveBeenCalled();
  });
});

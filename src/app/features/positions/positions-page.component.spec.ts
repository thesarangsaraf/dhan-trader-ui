import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PositionsPageComponent } from './positions-page.component';
import { OrderService } from '../../core/api/order.service';
import { AuthService } from '../../core/api/auth.service';

describe('PositionsPageComponent', () => {
  let component: PositionsPageComponent;
  let fixture: ComponentFixture<PositionsPageComponent>;

  const mockOrderService = {
    positions: signal([]),
    orders: signal([]),
    openOrders: signal([]),
    funds: signal({ availableBalance: 125000 }),
    summary: signal({ openPositionsCount: 2 }),
    isLoadingPositions: signal(false),
    isLoadingOrders: signal(false),
    positionsError: signal(null),
    ordersError: signal(null),
    refreshPositions: vi.fn(),
    refreshOrders: vi.fn(),
    refreshFunds: vi.fn(),
  };

  const mockAuthService = {
    isBackendOnline: signal(true),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [PositionsPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        { provide: OrderService, useValue: mockOrderService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PositionsPageComponent);
    component = fixture.componentInstance;
  });

  it('should create PositionsPageComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should render page title, subtitle, and tabs for Positions and Order Book', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.page-title')?.textContent).toContain('Positions & Order Book');
    expect(compiled.querySelector('app-positions-summary')).toBeTruthy();

    const tabsText = compiled.querySelector('.portfolio-tab-group')?.textContent || '';
    expect(tabsText).toContain('Positions');
    expect(tabsText).toContain('Order Book');
  });

  it('should trigger refreshAll when refresh button is clicked', () => {
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('.refresh-btn') as HTMLButtonElement;
    btn.click();

    expect(mockOrderService.refreshPositions).toHaveBeenCalled();
    expect(mockOrderService.refreshOrders).toHaveBeenCalled();
    expect(mockOrderService.refreshFunds).toHaveBeenCalled();
  });
});

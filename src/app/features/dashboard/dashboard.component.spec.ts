import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DashboardComponent } from './dashboard.component';
import { OrderService } from '../../core/api/order.service';
import { AuthService } from '../../core/api/auth.service';
import { AlertService } from '../../core/api/alert.service';
import { AudioChimeService } from '../../core/services/audio-chime.service';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;

  const mockFunds = signal<any>(null);
  const mockSummary = signal<any>({ openPositionsCount: 3 });

  const mockOrderService = {
    funds: mockFunds,
    summary: mockSummary,
    isRefreshingFunds: signal(false),
    isLoadingPositions: signal(false),
    refreshFunds: vi.fn(),
    refreshPositions: vi.fn(),
    orders: signal([]),
    positions: signal([]),
    openOrders: signal([{ orderId: 'O-1' }]),
    completedOrders: signal([]),
    isLoadingOrders: signal(false),
    ordersError: signal(null),
    positionsError: signal(null),
    wsStatus: signal({ connected: true }),
  };

  const mockAuthService = {
    isBackendOnline: signal(true),
    statusColor: signal('green'),
    timeRemainingFormatted: signal('23h 50m'),
    tokenStatus: signal({ clientId: '1106885516', configured: true }),
    isRenewing: signal(false),
    renewToken: vi.fn(),
  };

  const mockAlertService = {
    alerts: signal([]),
    alertsError: signal(null),
    lastPollTime: signal(new Date()),
    isLoading: signal(false),
    error: signal(null),
    loadAlerts: vi.fn(),
    refreshAlerts: vi.fn(),
    testChime: vi.fn(),
  };

  const mockAudioChime = {
    soundEnabled: signal(true),
    toggleSound: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        provideRouter([]),
        { provide: OrderService, useValue: mockOrderService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: AlertService, useValue: mockAlertService },
        { provide: AudioChimeService, useValue: mockAudioChime },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
  });

  it('should create the dashboard component', () => {
    expect(component).toBeTruthy();
  });

  it('should render the 3-zone dashboard body', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.dashboard-body')).toBeTruthy();
    expect(compiled.querySelector('.left-panel app-alert-composer')).toBeTruthy();
    expect(compiled.querySelector('.center-panel app-alert-list')).toBeTruthy();
    expect(compiled.querySelector('.right-panel .right-tab-group')).toBeTruthy();
  });

  it('should render the bottom dock with status indicators', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const dock = compiled.querySelector('.bottom-dock');
    expect(dock).toBeTruthy();
    expect(dock?.textContent).toContain('Dhan Pro Engine Active');
    expect(dock?.textContent).toContain('Client: 1106885516');
    expect(dock?.textContent).toContain('Chime Synthesizer: Armed');
    expect(dock?.textContent).toContain('Order Socket: Live Feed');
  });

  it('should not contain the top app bar inside dashboard component (moved to shared header)', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.top-app-bar')).toBeNull();
    expect(compiled.querySelector('.header-brand')).toBeNull();
  });
});

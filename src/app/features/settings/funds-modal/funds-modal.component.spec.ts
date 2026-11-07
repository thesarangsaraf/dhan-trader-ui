import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FundsModalComponent } from './funds-modal.component';
import { OrderService } from '../../../core/api/order.service';
import { AuthService } from '../../../core/api/auth.service';

describe('FundsModalComponent', () => {
  let component: FundsModalComponent;
  let fixture: ComponentFixture<FundsModalComponent>;

  const mockDialogRef = {
    close: vi.fn(),
  };

  const mockFundsSignal = signal<any>(null);
  const mockIsRefreshingFundsSignal = signal<boolean>(false);
  const mockIsBackendOnlineSignal = signal<boolean>(true);
  const mockTokenStatusSignal = signal<any>({ clientId: '1106885516' });

  const mockOrderService = {
    funds: mockFundsSignal,
    isRefreshingFunds: mockIsRefreshingFundsSignal,
    refreshFunds: vi.fn(),
  };

  const mockAuthService = {
    isBackendOnline: mockIsBackendOnlineSignal,
    tokenStatus: mockTokenStatusSignal,
  };

  beforeEach(async () => {
    mockFundsSignal.set(null);
    mockIsRefreshingFundsSignal.set(false);
    mockIsBackendOnlineSignal.set(true);
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [FundsModalComponent],
      providers: [
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: OrderService, useValue: mockOrderService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FundsModalComponent);
    component = fixture.componentInstance;
  });

  it('should render fallback card when funds are not loaded yet', () => {
    mockFundsSignal.set(null);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.no-funds-card')).not.toBeNull();
    expect(compiled.textContent).toContain('Retrieving live account funds from Dhan API...');
  });

  it('should render hero balance and breakdown grid when funds are available', () => {
    mockFundsSignal.set({
      availableBalance: 250000.75,
      utilizedMargin: 35000.0,
      collateralAmount: 100000.0,
      withdrawableBalance: 250000.75,
      dhanClientId: '1106885516',
    });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.hero-balance-card')).not.toBeNull();
    expect(compiled.querySelector('.hero-amount')?.textContent).toContain('2,50,000.75');

    const breakdownCards = compiled.querySelectorAll('.grid-card');
    expect(breakdownCards.length).toBe(4);
    expect(compiled.textContent).toContain('Available Margin');
    expect(compiled.textContent).toContain('Utilized Margin');
    expect(compiled.textContent).toContain('Collateral Margin');
    expect(compiled.textContent).toContain('Withdrawable Cash');

    expect(compiled.querySelector('.acc-val')?.textContent).toContain('1106885516');
  });

  it('should trigger refreshFunds when refresh button is clicked', () => {
    mockFundsSignal.set({
      availableBalance: 100000,
      utilizedMargin: 0,
      collateralAmount: 0,
    });
    fixture.detectChanges();

    const refreshBtn = fixture.nativeElement.querySelector('.refresh-btn') as HTMLButtonElement;
    refreshBtn.click();

    expect(mockOrderService.refreshFunds).toHaveBeenCalled();
  });

  it('should render Demat stock holdings and total portfolio value when user has demat holdings', () => {
    mockFundsSignal.set({
      availableBalance: 0,
      utilizedMargin: 0,
      collateralAmount: 0,
      dematHoldingsValue: 425000.0,
      holdingsCount: 8,
      totalAccountValue: 425000.0,
      dhanClientId: '1106885516',
    });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.demat-portfolio-card')).not.toBeNull();
    expect(compiled.querySelector('.demat-val')?.textContent).toContain('4,25,000');
    expect(compiled.querySelector('.demat-sub')?.textContent).toContain('8 stock(s) held in your Dhan Demat');
    expect(compiled.querySelector('.demat-note')?.textContent).toContain('4,25,000');
  });

  it('should close dialog when close button is clicked', () => {
    const closeBtn = fixture.nativeElement.querySelector('.close-btn') as HTMLButtonElement;
    closeBtn.click();

    expect(mockDialogRef.close).toHaveBeenCalled();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HeaderComponent } from './header.component';
import { OrderService } from '../../../core/api/order.service';
import { AuthService } from '../../../core/api/auth.service';
import { AlertService } from '../../../core/api/alert.service';
import { TelegramApiService } from '../../../core/api/telegram.service';
import { AudioChimeService } from '../../../core/services/audio-chime.service';
import { ThemeService } from '../../../core/services/theme.service';
import { FundsModalComponent } from '../../../features/settings/funds-modal/funds-modal.component';
import { AuthModalComponent } from '../../../features/settings/auth-modal/auth-modal.component';
import { TelegramModalComponent } from '../../../features/settings/telegram-modal/telegram-modal.component';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  const mockDialog = {
    open: vi.fn(),
  };

  const mockFunds = signal<any>(null);
  const mockIsRefreshingFunds = signal<boolean>(false);
  const mockIsLoadingPositions = signal<boolean>(false);

  const mockOrderService = {
    funds: mockFunds,
    isRefreshingFunds: mockIsRefreshingFunds,
    isLoadingPositions: mockIsLoadingPositions,
    refreshFunds: vi.fn(),
  };

  const mockAuthService = {
    isBackendOnline: signal(true),
    statusColor: signal('green'),
    timeRemainingFormatted: signal('23h 50m'),
    isRenewing: signal(false),
    renewToken: vi.fn(),
  };

  const mockAlertService = {
    testChime: vi.fn(),
  };

  const mockTelegramService = {
    status: signal({ configured: true, chatId: '895***469' }),
  };

  const mockAudioChime = {
    soundEnabled: signal(true),
    toggleSound: vi.fn(),
  };

  const mockThemeService = {
    isDarkMode: signal(true),
    toggleTheme: vi.fn(),
  };

  beforeEach(async () => {
    mockFunds.set(null);
    mockIsRefreshingFunds.set(false);
    mockIsLoadingPositions.set(false);
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        provideRouter([]),
        { provide: MatDialog, useValue: mockDialog },
        { provide: OrderService, useValue: mockOrderService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: AlertService, useValue: mockAlertService },
        { provide: TelegramApiService, useValue: mockTelegramService },
        { provide: AudioChimeService, useValue: mockAudioChime },
        { provide: ThemeService, useValue: mockThemeService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    (component as any).dialog = mockDialog;
  });

  it('should create the header component', () => {
    expect(component).toBeTruthy();
  });

  it('should render brand logo, title, and navigation tabs', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.brand-name')?.textContent).toContain('DHAN TRADER PRO');
    const tabs = compiled.querySelectorAll('.nav-tab');
    expect(tabs.length).toBe(2);
    expect(tabs[0].textContent).toContain('Live Monitor');
    expect(tabs[1].textContent).toContain('Trade History');
  });

  it('should render Available Balance placeholder when funds are not loaded', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const fundsChip = compiled.querySelector('.funds-chip');
    expect(fundsChip).not.toBeNull();
    expect(fundsChip?.textContent).toContain('Available Balance:');
    expect(fundsChip?.textContent).toContain('--');
    expect(fundsChip?.querySelector('.funds-icon')?.textContent).toContain('account_balance_wallet');
  });

  it('should render formatted real available balance when funds are present', () => {
    mockFunds.set({
      availableBalance: 325450.5,
      utilizedMargin: 20000.0,
      collateralAmount: 0,
    });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const fundsChip = compiled.querySelector('.funds-chip');
    expect(fundsChip?.textContent).toContain('Available Balance:');
    expect(fundsChip?.textContent).toContain('3,25,450.50');
  });

  it('should display Demat Value when available trading cash is 0 but user has Demat holdings', () => {
    mockFunds.set({
      availableBalance: 0,
      utilizedMargin: 0,
      collateralAmount: 0,
      dematHoldingsValue: 412000.0,
      holdingsCount: 5,
      totalAccountValue: 412000.0,
    });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const fundsChip = compiled.querySelector('.funds-chip');
    expect(fundsChip?.textContent).toContain('Demat Value:');
    expect(fundsChip?.textContent).toContain('4,12,000');
  });

  it('should open FundsModalComponent when clicking on the Available Balance chip', () => {
    fixture.detectChanges();

    const fundsChip = fixture.nativeElement.querySelector('.funds-chip') as HTMLElement;
    fundsChip.click();

    expect(mockDialog.open).toHaveBeenCalledWith(FundsModalComponent, {
      width: '520px',
    });
  });

  it('should trigger orderService.refreshFunds when mini-refresh button inside funds chip is clicked', () => {
    fixture.detectChanges();

    const refreshBtn = fixture.nativeElement.querySelector('.mini-funds-btn') as HTMLButtonElement;
    refreshBtn.click();

    expect(mockOrderService.refreshFunds).toHaveBeenCalled();
  });

  it('should open AuthModalComponent when clicking on token expiry chip or settings button', () => {
    fixture.detectChanges();

    const tokenChip = fixture.nativeElement.querySelector('.token-expiry-chip') as HTMLElement;
    tokenChip.click();
    expect(mockDialog.open).toHaveBeenCalledWith(AuthModalComponent, {
      width: '560px',
    });

    const settingsBtn = fixture.nativeElement.querySelector('.action-btn.settings') as HTMLButtonElement;
    settingsBtn.click();
    expect(mockDialog.open).toHaveBeenCalledWith(AuthModalComponent, {
      width: '560px',
    });
  });

  it('should open TelegramModalComponent when clicking on telegram chip', () => {
    fixture.detectChanges();

    const tgChip = fixture.nativeElement.querySelector('.telegram-chip') as HTMLElement;
    tgChip.click();
    expect(mockDialog.open).toHaveBeenCalledWith(TelegramModalComponent, {
      width: '520px',
    });
  });

  it('should toggle audio chime when audio button is clicked', () => {
    fixture.detectChanges();

    const soundBtn = fixture.nativeElement.querySelectorAll('.action-btn')[0] as HTMLButtonElement;
    soundBtn.click();
    expect(mockAudioChime.toggleSound).toHaveBeenCalled();
  });

  it('should test audio chime when chime button is clicked', () => {
    fixture.detectChanges();

    const chimeBtn = fixture.nativeElement.querySelectorAll('.action-btn')[1] as HTMLButtonElement;
    chimeBtn.click();
    expect(mockAlertService.testChime).toHaveBeenCalled();
  });

  it('should toggle theme when theme button is clicked', () => {
    fixture.detectChanges();

    const themeBtn = fixture.nativeElement.querySelectorAll('.action-btn')[2] as HTMLButtonElement;
    themeBtn.click();
    expect(mockThemeService.toggleTheme).toHaveBeenCalled();
  });

  it('should not render Dhan Engine Online or Net P&L in the top bar', () => {
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const topBar = compiled.querySelector('.top-app-bar');

    expect(topBar?.querySelector('.status-chip')).toBeNull();
    expect(topBar?.querySelector('.pnl-pill')).toBeNull();
    expect(topBar?.textContent).not.toContain('Dhan Engine Online');
    expect(topBar?.textContent).not.toContain('Net P&L:');
  });
});

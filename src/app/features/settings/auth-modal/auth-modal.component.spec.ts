import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthModalComponent } from './auth-modal.component';
import { AuthService } from '../../../core/api/auth.service';
import { OrderService } from '../../../core/api/order.service';

describe('AuthModalComponent', () => {
  let component: AuthModalComponent;
  let fixture: ComponentFixture<AuthModalComponent>;

  const mockDialogRef = {
    close: vi.fn(),
  };

  const mockAuthService = {
    tokenStatus: vi.fn().mockReturnValue({
      configured: true,
      clientId: '1106885516',
      status: 'ACTIVE',
      statusText: 'Active',
      tokenMasked: 'eyJhbGci...mock',
      issuedAtIST: '18 Nov 2026, 09:00:00 AM',
      expiresAtIST: '19 Nov 2026, 09:00:00 AM',
    }),
    statusColor: vi.fn().mockReturnValue('green'),
    timeRemainingFormatted: vi.fn().mockReturnValue('23h 59m 00s'),
    isRenewing: vi.fn().mockReturnValue(false),
    renewToken: vi.fn(),
    updateToken: vi.fn().mockReturnValue(of({ success: true })),
  };

  const mockOrderService = {
    refreshAll: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthModalComponent],
      providers: [
        provideNoopAnimations(),
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: AuthService, useValue: mockAuthService },
        { provide: OrderService, useValue: mockOrderService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create AuthModalComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should not render NSE Security Master & Firestore Sync section', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).not.toContain('NSE Security Master');
    expect(el.textContent).not.toContain('sec_id_to_name_mapping');
    expect(el.querySelector('.mapping-section')).toBeNull();
    expect(el.querySelector('.sync-btn')).toBeNull();
  });

  it('should submit manual token update and refresh orders', () => {
    component.tokenInput = 'new_token_value';
    component.submitManualUpdate();
    expect(mockAuthService.updateToken).toHaveBeenCalledWith({
      token: 'new_token_value',
      clientId: '1106885516',
    });
    expect(mockOrderService.refreshAll).toHaveBeenCalled();
    expect(component.tokenInput).toBe('');
  });

  it('should display postback warning banner when postbackUrlConfigured is false or undefined', () => {
    mockAuthService.tokenStatus.mockReturnValue({
      configured: true,
      clientId: '1106885516',
      status: 'ACTIVE',
      statusText: 'Active',
      tokenMasked: 'eyJhbGci...mock',
      postbackUrlConfigured: false,
      expectedPostbackUrl: 'https://api.example.com/api/webhooks/dhan',
    });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.postback-banner.warning')).toBeTruthy();
    expect(el.textContent).toContain('Postback Webhook URL Missing');
    expect(el.textContent).toContain('https://api.example.com/api/webhooks/dhan');
  });

  it('should display postback configured banner when postbackUrlConfigured is true', () => {
    mockAuthService.tokenStatus.mockReturnValue({
      configured: true,
      clientId: '1106885516',
      status: 'ACTIVE',
      statusText: 'Active',
      tokenMasked: 'eyJhbGci...mock',
      postbackUrlConfigured: true,
      postbackUrl: 'https://api.example.com/api/webhooks/dhan',
    });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.postback-banner.configured')).toBeTruthy();
    expect(el.textContent).toContain('Dhan Postback Webhook Configured');
    expect(el.textContent).toContain('https://api.example.com/api/webhooks/dhan');
  });

  it('should copy postback URL to clipboard and show snackbar', () => {
    const writeTextFn = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextFn,
      },
    });
    const snackBarSpy = vi.spyOn(component.snackBar, 'open').mockReturnValue({} as any);

    component.copyPostbackUrl('https://api.example.com/api/webhooks/dhan');
    expect(writeTextFn).toHaveBeenCalledWith('https://api.example.com/api/webhooks/dhan');
  });
});

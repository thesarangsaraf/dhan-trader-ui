import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { vi } from 'vitest';
import {
  AlertPreviewDialogComponent,
  AlertPreviewData,
} from './alert-preview-dialog.component';
import { AlertService } from '../../../core/api/alert.service';

describe('AlertPreviewDialogComponent', () => {
  let component: AlertPreviewDialogComponent;
  let fixture: ComponentFixture<AlertPreviewDialogComponent>;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockSnackBar: { open: ReturnType<typeof vi.fn> };
  let mockAlertService: { verifyOrderPassword: ReturnType<typeof vi.fn> };

  const baseData: AlertPreviewData = {
    instrument: 'NIFTY 50',
    securityId: '13',
    exchangeSegment: 'IDX_I',
    currentLtp: 24500,
    targetPrice: 24600,
    operator: 'GREATER_THAN_EQUAL',
    remarks: 'Test breakout',
    hasOrder: true,
    order: {
      action: 'BUY',
      symbol: 'NIFTY 24600 CE',
      securityId: '40050',
      exchangeSegment: 'NSE_FNO',
      productType: 'INTRADAY',
      orderType: 'MARKET',
      quantity: 50,
      price: 0,
    },
    stopLoss: {
      enabled: true,
      points: 12,
      targetPrice: 24588,
      operator: 'LESS_THAN_OR_EQUAL',
      action: 'SELL',
    },
    dhanPayload: {
      alertId: 'DHAN-1001',
      condition: { securityId: '13', comparingValue: 24600 },
    },
    slDhanPayload: {
      alertId: 'DHAN-1002',
      condition: { securityId: '13', comparingValue: 24588 },
    },
  };

  beforeEach(async () => {
    mockDialogRef = { close: vi.fn() };
    mockSnackBar = { open: vi.fn() };
    mockAlertService = {
      verifyOrderPassword: vi.fn().mockImplementation((pwd: string) => {
        if (pwd === '3646') {
          return of({ valid: true, message: 'Password verified' });
        }
        return of({ valid: false, message: 'Incorrect trade password' });
      }),
    };

    await TestBed.configureTestingModule({
      imports: [AlertPreviewDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: baseData },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MatSnackBar, useValue: mockSnackBar },
        { provide: AlertService, useValue: mockAlertService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AlertPreviewDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the dialog component', () => {
    expect(component).toBeTruthy();
  });

  it('should display Confirm & Place Alert buttons when mode is confirm (default)', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const confirmBtn = compiled.querySelector('.confirm-btn');
    const cancelBtn = compiled.querySelector('.cancel-btn');
    expect(confirmBtn).toBeTruthy();
    expect(cancelBtn).toBeTruthy();
    expect(compiled.querySelector('.close-view-btn')).toBeNull();
  });

  it('should display Close button when mode is view', () => {
    component.data = {
      ...baseData,
      mode: 'view',
      title: 'Dhan HQ Alert #1001',
    };
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const closeViewBtn = compiled.querySelector('.close-view-btn');
    expect(closeViewBtn).toBeTruthy();
    expect(closeViewBtn?.textContent?.trim()).toBe('Close');
    expect(compiled.querySelector('.confirm-btn')).toBeNull();
  });

  it('should format raw Dhan JSON correctly', () => {
    expect(component.formattedJson).toContain('"alertId": "DHAN-1001"');
    expect(component.formattedSlJson).toContain('"alertId": "DHAN-1002"');
  });

  it('should copy JSON to clipboard and display snackbar notification', async () => {
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextSpy },
    });

    component.copyJson();
    await Promise.resolve();

    expect(writeTextSpy).toHaveBeenCalledWith(component.formattedJson);
    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'Dhan HQ API JSON copied to clipboard!',
      'OK',
      expect.any(Object),
    );
  });

  it('should close dialog with false when close(false) is called', () => {
    component.close(false);
    expect(mockDialogRef.close).toHaveBeenCalledWith(false);
  });

  it('should close dialog with true when close(true) is called', () => {
    component.close(true);
    expect(mockDialogRef.close).toHaveBeenCalledWith(true);
  });

  it('should render password authorization input when hasOrder is true and mode is confirm', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const authSection = compiled.querySelector('.order-auth-section');
    expect(authSection).toBeTruthy();
    const input = compiled.querySelector('.auth-password-input');
    expect(input).toBeTruthy();
  });

  it('should NOT render password input when hasOrder is false', () => {
    component.data = {
      ...baseData,
      hasOrder: false,
    };
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.order-auth-section')).toBeNull();
  });

  it('should set error message when confirming without password', async () => {
    component.orderPassword = '';
    await component.confirm();

    expect(component.passwordError).toContain('Please enter your order authorization password');
    expect(mockDialogRef.close).not.toHaveBeenCalled();
  });

  it('should verify password and close with password payload when valid (3646)', async () => {
    component.orderPassword = '3646';
    await component.confirm();

    expect(mockAlertService.verifyOrderPassword).toHaveBeenCalledWith('3646');
    expect(mockDialogRef.close).toHaveBeenCalledWith({ confirmed: true, password: '3646' });
  });

  it('should display error and keep dialog open when password is wrong', async () => {
    component.orderPassword = '0000';
    await component.confirm();

    expect(mockAlertService.verifyOrderPassword).toHaveBeenCalledWith('0000');
    expect(component.passwordError).toBe('Incorrect trade password');
    expect(mockDialogRef.close).not.toHaveBeenCalled();
  });
});

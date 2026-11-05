import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { AuthService } from '../../../core/api/auth.service';
import { TokenVerifyResult } from '../../../core/models/auth.models';

@Component({
  selector: 'app-auth-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatChipsModule,
  ],
  template: `
    <div class="auth-dialog">
      <div class="dialog-header">
        <div class="title-row">
          <span class="material-symbols-rounded key-icon">vpn_key</span>
          <div>
            <h2 mat-dialog-title class="dialog-title">Dhan Access Token & Lifecycle</h2>
            <p class="subtitle">JWT Inspection, Auto-Renewal & Live Verification</p>
          </div>
        </div>
        <button mat-icon-button (click)="dialogRef.close()" class="close-btn">
          <span class="material-symbols-rounded">close</span>
        </button>
      </div>

      <mat-dialog-content class="dialog-body">
        <!-- Token Inspection Card -->
        <div class="token-status-card m3-card" *ngIf="authService.tokenStatus() as token">
          <div class="status-top">
            <div class="status-chip" [class.active]="token.status === 'ACTIVE'" [class.expiring]="token.status === 'EXPIRING_SOON'" [class.expired]="token.status === 'EXPIRED'">
              <span class="pulse-dot"></span>
              {{ token.statusText }}
            </div>
            <span class="countdown mono-val" [class.urgent]="authService.statusColor() === 'red'">
              ⏱ {{ authService.timeRemainingFormatted() }}
            </span>
          </div>

          <div class="grid-details">
            <div class="detail-row">
              <span class="label">Client ID:</span>
              <span class="val mono-val">{{ token.clientId || 'Not Set' }}</span>
            </div>
            <div class="detail-row">
              <span class="label">Token Preview:</span>
              <span class="val mono-val">{{ token.tokenMasked || 'None' }}</span>
            </div>
            <div class="detail-row">
              <span class="label">Issued At (IST):</span>
              <span class="val mono-val">{{ token.issuedAtIST || 'N/A' }}</span>
            </div>
            <div class="detail-row">
              <span class="label">Expires At (IST):</span>
              <span class="val mono-val">{{ token.expiresAtIST || 'N/A' }}</span>
            </div>
            <div class="detail-row" *ngIf="token.payload?.userName">
              <span class="label">Account User:</span>
              <span class="val mono-val">{{ token.payload?.userName }}</span>
            </div>
          </div>

          <!-- Quick Action Buttons inside Inspection -->
          <div class="quick-actions">
            <button
              mat-stroked-button
              (click)="verifyValidity()"
              [disabled]="isVerifying()"
            >
              <span class="material-symbols-rounded">verified_user</span>
              Verify Live on Dhan
            </button>
            <button
              mat-flat-button
              color="primary"
              (click)="authService.renewToken()"
              [disabled]="authService.isRenewing()"
            >
              <span class="material-symbols-rounded">autorenew</span>
              Renew Token (Auto)
            </button>
          </div>

          <!-- Verification Outcome -->
          <div class="verify-alert" *ngIf="verifyResult() as vr" [class.success]="vr.valid" [class.fail]="!vr.valid">
            <span class="material-symbols-rounded">{{ vr.valid ? 'check_circle' : 'cancel' }}</span>
            <span>{{ vr.valid ? 'Dhan Profile Verified & Active: ' + (vr.profile?.userName || vr.profile?.clientId) : (vr.message || 'Verification Failed') }}</span>
          </div>
        </div>

        <div class="divider"></div>

        <!-- Manual Update Form -->
        <div class="update-section">
          <h3 class="section-title">Manual Token Update</h3>
          <p class="section-desc">Paste new JWT access token generated from Dhan HQ web console if automatic renewal is unavailable.</p>

          <form (ngSubmit)="submitManualUpdate()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Dhan Client ID</mat-label>
              <input matInput [(ngModel)]="clientIdInput" name="clientId" placeholder="e.g. 1106885516" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Access Token (JWT)</mat-label>
              <textarea
                matInput
                rows="3"
                [(ngModel)]="tokenInput"
                name="token"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                required
              ></textarea>
            </mat-form-field>

            <div class="form-actions">
              <button
                mat-flat-button
                color="primary"
                type="submit"
                [disabled]="!tokenInput.trim() || isSubmitting()"
              >
                <span class="material-symbols-rounded">save</span>
                Save & Hot-Reload Token
              </button>
            </div>
          </form>
        </div>
      </mat-dialog-content>
    </div>
  `,
  styles: [
    `
      .auth-dialog {
        padding: 12px 16px 20px 16px;
        min-width: 480px;
        max-width: 580px;
      }
      .dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 12px;
      }
      .title-row {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .key-icon {
        font-size: 32px;
        color: var(--dhan-cyan);
      }
      .dialog-title {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
      }
      .subtitle {
        margin: 2px 0 0 0;
        font-size: 0.8125rem;
        color: var(--text-muted);
      }
      .close-btn {
        color: var(--text-secondary);
        background: none;
        border: none;
        cursor: pointer;
      }
      .token-status-card {
        padding: 16px;
        margin-bottom: 16px;
        background: var(--bg-card);
      }
      .status-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 14px;
      }
      .status-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 600;
        background: rgba(255, 255, 255, 0.08);
      }
      .status-chip.active {
        color: var(--color-profit);
        background: var(--color-profit-bg);
      }
      .status-chip.expiring {
        color: var(--color-pending);
        background: var(--color-pending-bg);
      }
      .status-chip.expired {
        color: var(--color-loss);
        background: var(--color-loss-bg);
      }
      .pulse-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: currentColor;
      }
      .countdown {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--dhan-cyan);
      }
      .countdown.urgent {
        color: var(--color-loss);
      }
      .grid-details {
        display: flex;
        flex-direction: column;
        gap: 8px;
        font-size: 0.8125rem;
        border-top: 1px solid var(--border-subtle);
        border-bottom: 1px solid var(--border-subtle);
        padding: 10px 0;
        margin-bottom: 14px;
      }
      .detail-row {
        display: flex;
        justify-content: space-between;
      }
      .label {
        color: var(--text-muted);
      }
      .val {
        color: var(--text-primary);
        font-weight: 500;
      }
      .quick-actions {
        display: flex;
        gap: 10px;
      }
      .quick-actions button {
        flex: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }
      .verify-alert {
        margin-top: 12px;
        padding: 8px 12px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.8125rem;
      }
      .verify-alert.success {
        background: var(--color-profit-bg);
        color: var(--color-profit);
      }
      .verify-alert.fail {
        background: var(--color-loss-bg);
        color: var(--color-loss);
      }
      .divider {
        height: 1px;
        background: var(--border-subtle);
        margin: 16px 0;
      }
      .section-title {
        font-size: 0.9375rem;
        font-weight: 600;
        margin-bottom: 4px;
      }
      .section-desc {
        font-size: 0.8125rem;
        color: var(--text-secondary);
        margin-bottom: 12px;
      }
      .full-width {
        width: 100%;
        margin-bottom: 8px;
      }
      .form-actions {
        display: flex;
        justify-content: flex-end;
      }
      .form-actions button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
    `,
  ],
})
export class AuthModalComponent {
  readonly dialogRef = inject(MatDialogRef<AuthModalComponent>);
  readonly authService = inject(AuthService);

  readonly isVerifying = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);
  readonly verifyResult = signal<TokenVerifyResult | null>(null);

  tokenInput = '';
  clientIdInput = '';

  constructor() {
    const current = this.authService.tokenStatus();
    if (current?.clientId) {
      this.clientIdInput = current.clientId;
    }
  }

  verifyValidity(): void {
    this.isVerifying.set(true);
    this.authService.verifyToken().subscribe({
      next: (res) => {
        this.isVerifying.set(false);
        this.verifyResult.set(res);
      },
      error: (err) => {
        this.isVerifying.set(false);
        this.verifyResult.set({
          valid: false,
          message: err.error?.message || 'Verification call failed',
        });
      },
    });
  }

  submitManualUpdate(): void {
    if (!this.tokenInput.trim()) return;
    this.isSubmitting.set(true);
    this.authService
      .updateToken({
        token: this.tokenInput.trim(),
        clientId: this.clientIdInput.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.tokenInput = '';
        },
        error: () => {
          this.isSubmitting.set(false);
        },
      });
  }
}

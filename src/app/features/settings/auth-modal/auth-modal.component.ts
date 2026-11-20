import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/api/auth.service';
import { OrderService } from '../../../core/api/order.service';

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
    MatTooltipModule,
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
            <div class="status-chip" [ngClass]="{
              'active': token.status === 'ACTIVE',
              'expiring': token.status === 'EXPIRING_SOON',
              'expired': token.status === 'EXPIRED'
            }">
              <span class="pulse-dot"></span>
              {{ token.statusText }}
            </div>
            <span class="countdown mono-val" [ngClass]="{ 'urgent': authService.statusColor() === 'red' }">
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
          </div>

          <!-- Postback Webhook Configuration Status -->
          <div class="postback-section">
            <div class="postback-banner configured" *ngIf="token.postbackUrlConfigured; else postbackWarning">
              <div class="banner-icon-col">
                <span class="material-symbols-rounded icon-success">verified</span>
              </div>
              <div class="banner-content">
                <div class="banner-title">Dhan Postback Webhook Configured</div>
                <div class="banner-subtitle">Real-time alert & order execution notifications are active.</div>
                <div class="url-display-box mono-val">{{ token.postbackUrl }}</div>
              </div>
            </div>

            <ng-template #postbackWarning>
              <div class="postback-banner warning">
                <div class="banner-icon-col">
                  <span class="material-symbols-rounded icon-warn">warning</span>
                </div>
                <div class="banner-content">
                  <div class="banner-title">⚠️ Postback Webhook URL Missing</div>
                  <div class="banner-subtitle">
                    This Dhan access token was generated without a Postback URL. Real-time alert trigger & execution notifications cannot be delivered to Telegram.
                  </div>
                  <div class="postback-setup-instructions">
                    <span class="instruction-title">Set this Postback URL when generating new token on Dhan:</span>
                    <div class="copy-url-group">
                      <code class="mono-val">{{ token.expectedPostbackUrl }}</code>
                      <button
                        mat-stroked-button
                        type="button"
                        class="copy-btn"
                        (click)="copyPostbackUrl(token.expectedPostbackUrl || '')"
                        matTooltip="Copy to clipboard"
                      >
                        <span class="material-symbols-rounded">content_copy</span>
                        Copy URL
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </ng-template>
          </div>

          <!-- Quick Action Buttons inside Inspection -->
          <div class="quick-actions">
            <button
              mat-flat-button
              color="primary"
              (click)="authService.renewToken()"
              [disabled]="authService.isRenewing()"
            >
              <span class="material-symbols-rounded" [class.spinning]="authService.isRenewing()">autorenew</span>
              {{ authService.isRenewing() ? 'Renewing...' : '1-Click Renew' }}
            </button>
          </div>
        </div>

        <div class="divider"></div>

        <!-- Manual Update Form -->
        <div class="update-section">
          <h3 class="section-title">Manual Token Update</h3>
          <p class="section-desc">Paste new JWT access token generated from Dhan HQ web console if automatic renewal is unavailable.</p>

          <form (ngSubmit)="submitManualUpdate()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Access Token (JWT)</mat-label>
              <textarea
                matInput
                rows="3"
                [(ngModel)]="tokenInput"
                name="token"
                placeholder="Enter new Dhan access token"
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
      .key-icon {
        font-size: 32px;
        color: var(--dhan-cyan);
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
      .status-chip.expiring {
        color: var(--color-pending);
        background: var(--color-pending-bg);
      }
      .status-chip.expired {
        color: var(--color-loss);
        background: var(--color-loss-bg);
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
      .postback-section {
        margin-bottom: 14px;
      }
      .postback-banner {
        display: flex;
        gap: 12px;
        padding: 12px 14px;
        border-radius: 8px;
        font-size: 13px;
      }
      .postback-banner.configured {
        background: rgba(16, 185, 129, 0.08);
        border: 1px solid rgba(16, 185, 129, 0.3);
      }
      .postback-banner.warning {
        background: rgba(245, 158, 11, 0.1);
        border: 1px solid rgba(245, 158, 11, 0.35);
      }
      .banner-icon-col {
        display: flex;
        align-items: flex-start;
        padding-top: 2px;
      }
      .icon-success {
        color: #10b981;
        font-size: 22px;
      }
      .icon-warn {
        color: #f59e0b;
        font-size: 22px;
      }
      .banner-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .banner-title {
        font-weight: 600;
        font-size: 13px;
        color: var(--text-primary);
      }
      .postback-banner.warning .banner-title {
        color: #f59e0b;
      }
      .banner-subtitle {
        font-size: 12px;
        color: var(--text-secondary);
        line-height: 1.4;
      }
      .url-display-box {
        margin-top: 4px;
        font-size: 11px;
        padding: 6px 10px;
        background: rgba(0, 0, 0, 0.25);
        border-radius: 4px;
        color: #34d399;
        word-break: break-all;
      }
      .postback-setup-instructions {
        margin-top: 6px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .instruction-title {
        font-size: 11px;
        color: var(--text-secondary);
        font-weight: 500;
      }
      .copy-url-group {
        display: flex;
        align-items: center;
        gap: 8px;
        background: rgba(0, 0, 0, 0.25);
        padding: 4px 8px;
        border-radius: 6px;
        border: 1px solid rgba(245, 158, 11, 0.2);
      }
      .copy-url-group code {
        flex: 1;
        font-size: 11px;
        color: #fbbf24;
        word-break: break-all;
      }
      .copy-btn {
        height: 28px !important;
        font-size: 11px !important;
        line-height: 28px !important;
        padding: 0 10px !important;
        border-color: rgba(245, 158, 11, 0.4) !important;
        color: #fbbf24 !important;
      }
      .copy-btn .material-symbols-rounded {
        font-size: 14px;
        margin-right: 4px;
      }
      .quick-actions {
        display: flex;
        gap: 8px;
      }
      .quick-actions button,
      .form-actions button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }
      .quick-actions button {
        flex: 1;
      }

      /* Mobile Optimizations for Auth Modal */
      @media (max-width: 600px) {
        .auth-dialog {
          min-width: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box;
        }

        .dialog-header {
          padding: 12px 14px;
        }

        .dialog-title {
          font-size: 1rem;
        }

        .dialog-body {
          padding: 12px 14px;
        }

        .detail-row {
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
        }

        .quick-actions button,
        .form-actions button {
          min-height: 40px;
        }
      }
    `,
  ],
})
export class AuthModalComponent {
  readonly dialogRef = inject(MatDialogRef<AuthModalComponent>);
  readonly authService = inject(AuthService);
  readonly orderService = inject(OrderService);
  readonly snackBar = inject(MatSnackBar);

  readonly isSubmitting = signal<boolean>(false);

  tokenInput = '';

  copyPostbackUrl(url: string): void {
    if (!url) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(url).then(() => {
        this.snackBar.open('📋 Postback URL copied to clipboard!', 'OK', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'bottom',
        });
      });
    } else {
      this.snackBar.open('📋 Postback URL: ' + url, 'OK', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom',
      });
    }
  }

  submitManualUpdate(): void {
    const rawToken = this.tokenInput.trim();
    if (!rawToken) return;
    this.isSubmitting.set(true);
    const existingClientId = this.authService.tokenStatus()?.clientId;
    this.authService
      .updateToken({
        token: rawToken,
        clientId: existingClientId || undefined,
      })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.tokenInput = '';
          this.orderService.refreshAll();
        },
        error: () => {
          this.isSubmitting.set(false);
        },
      });
  }
}

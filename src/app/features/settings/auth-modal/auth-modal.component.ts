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

  readonly isSubmitting = signal<boolean>(false);

  tokenInput = '';

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

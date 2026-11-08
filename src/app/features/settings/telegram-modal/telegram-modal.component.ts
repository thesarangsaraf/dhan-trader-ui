import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TelegramApiService } from '../../../core/api/telegram.service';

@Component({
  selector: 'app-telegram-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <div class="telegram-dialog">
      <div class="dialog-header">
        <div class="title-row">
          <span class="material-symbols-rounded tg-icon">send</span>
          <div>
            <h2 mat-dialog-title class="dialog-title">Telegram Alerts & Bot Bridge</h2>
            <p class="subtitle">Direct Instant Telegram Notifications for Price Triggers & Orders</p>
          </div>
        </div>
        <button mat-icon-button (click)="dialogRef.close()" class="close-btn">
          <span class="material-symbols-rounded">close</span>
        </button>
      </div>

      <mat-dialog-content class="dialog-body">
        <!-- Status Card -->
        <div class="tg-status-card m3-card" *ngIf="telegramService.status() as st">
          <div class="status-row">
            <span class="label">Bridge Status:</span>
            <div class="status-chip" [ngClass]="st.configured ? 'online' : 'offline'">
              <span class="pulse-dot"></span>
              {{ st.configured ? 'Connected & Active' : 'Not Configured' }}
            </div>
          </div>
          <div class="status-row">
            <span class="label">Connected Chat ID:</span>
            <span class="mono-val val">{{ st.chatId || 'Not Set' }}</span>
          </div>
          <div class="status-row">
            <span class="label">Bot Token:</span>
            <span class="mono-val val">{{ st.botConfigured ? 'Configured (Active)' : 'Missing' }}</span>
          </div>

          <div class="test-row">
            <button
              mat-stroked-button
              (click)="telegramService.sendTest()"
              [disabled]="!st.configured || telegramService.isTesting()"
            >
              <span class="material-symbols-rounded">notifications_active</span>
              {{ telegramService.isTesting() ? 'Sending Test...' : 'Send Test Notification' }}
            </button>
          </div>
        </div>

        <div class="divider"></div>

        <!-- Update Form -->
        <div class="update-section">
          <h3 class="section-title">Update Bot Credentials</h3>
          <p class="section-desc">Enter your Telegram Bot Token (from &#64;BotFather) and your Chat ID (or channel ID) to receive instant real-time alerts.</p>

          <form (ngSubmit)="submitUpdate()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Telegram Bot Token</mat-label>
              <input
                matInput
                [(ngModel)]="botTokenInput"
                name="botToken"
                placeholder="123456789:ABCDefgh..."
                required
              />
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Telegram Chat ID</mat-label>
              <input
                matInput
                [(ngModel)]="chatIdInput"
                name="chatId"
                placeholder="e.g. 8953936469 or -10012345678"
                required
              />
            </mat-form-field>

            <div class="form-actions">
              <button
                mat-flat-button
                color="primary"
                type="submit"
                [disabled]="!botTokenInput.trim() || !chatIdInput.trim() || isSaving()"
              >
                <span class="material-symbols-rounded">save</span>
                Save & Update Bridge
              </button>
            </div>
          </form>
        </div>
      </mat-dialog-content>
    </div>
  `,
  styles: [
    `
      .telegram-dialog {
        padding: 12px 16px 20px 16px;
        min-width: 460px;
        max-width: 540px;
      }
      .tg-icon {
        font-size: 30px;
        color: #229ED9; /* Telegram blue */
      }
      .tg-status-card {
        padding: 16px;
        background: var(--bg-card);
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .status-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.875rem;
      }
      .label {
        color: var(--text-muted);
      }
      .val {
        color: var(--text-primary);
        font-weight: 500;
      }
      .status-chip.online {
        color: var(--color-profit);
        background: var(--color-profit-bg);
      }
      .status-chip.offline {
        color: var(--color-loss);
        background: var(--color-loss-bg);
      }
      .test-row {
        margin-top: 6px;
        display: flex;
        justify-content: flex-end;
      }
      .test-row button,
      .form-actions button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
    `,
  ],
})
export class TelegramModalComponent {
  readonly dialogRef = inject(MatDialogRef<TelegramModalComponent>);
  readonly telegramService = inject(TelegramApiService);

  botTokenInput = '';
  chatIdInput = '';
  readonly isSaving = signal<boolean>(false);

  submitUpdate(): void {
    if (!this.botTokenInput.trim() || !this.chatIdInput.trim()) return;

    this.isSaving.set(true);
    this.telegramService
      .updateCredentials({
        botToken: this.botTokenInput.trim(),
        chatId: this.chatIdInput.trim(),
      })
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.botTokenInput = '';
          this.chatIdInput = '';
        },
        error: () => {
          this.isSaving.set(false);
        },
      });
  }
}

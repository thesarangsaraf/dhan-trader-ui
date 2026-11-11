import { Component, EventEmitter, Output, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-section-error',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
    <div class="section-error-container">
      <div class="error-icon-badge">
        <span class="material-symbols-rounded error-icon">{{ icon() }}</span>
      </div>

      <div class="error-body">
        <div class="error-title">{{ title() }}</div>
        <div class="error-message">{{ message() }}</div>
        <div class="error-target-hint">Endpoint: {{ endpoint() }}</div>
      </div>

      <button *ngIf="showRetry()" class="retry-action-btn" (click)="retry.emit()">
        <span class="material-symbols-rounded">sync</span>
        <span>Retry</span>
      </button>
    </div>
  `,
  styles: [
    `
      .section-error-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: 24px 16px;
        background: rgba(244, 63, 94, 0.05);
        border: 1px dashed rgba(244, 63, 94, 0.3);
        border-radius: 12px;
        gap: 12px;
        margin: 6px 0;
      }

      .error-icon-badge {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: rgba(244, 63, 94, 0.12);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .error-icon {
        font-size: 24px;
        color: var(--color-loss);
      }

      .error-body {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .error-title {
        font-size: 0.875rem;
        font-weight: 700;
        color: var(--color-loss);
      }

      .error-message {
        font-size: 0.8125rem;
        color: var(--text-secondary);
        max-width: 380px;
        line-height: 1.4;
      }

      .error-target-hint {
        font-size: 0.6875rem;
        font-family: var(--font-mono);
        color: var(--text-muted);
        margin-top: 2px;
      }

      .retry-action-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        border-radius: 6px;
        background: var(--bg-surface);
        border: 1px solid var(--border-medium);
        color: var(--text-primary);
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .retry-action-btn:hover {
        border-color: var(--dhan-cyan);
        color: var(--dhan-cyan);
        transform: translateY(-1px);
      }

      .retry-action-btn span {
        font-size: 16px;
      }
    `,
  ],
})
export class SectionErrorComponent {
  title = input<string>('Connection Error');
  message = input<string>(`Backend server is not available (${environment.apiUrl}).`);
  endpoint = input<string>(environment.apiUrl);
  icon = input<string>('cloud_off');
  showRetry = input<boolean>(true);

  @Output() readonly retry = new EventEmitter<void>();
}

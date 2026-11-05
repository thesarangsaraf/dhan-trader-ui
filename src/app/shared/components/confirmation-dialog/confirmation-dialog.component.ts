import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface ConfirmationDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <div class="confirm-modal">
      <div class="dialog-header">
        <span class="material-symbols-rounded icon" [class.danger]="data.isDestructive">
          {{ data.isDestructive ? 'warning' : 'help' }}
        </span>
        <h2 mat-dialog-title class="dialog-title">{{ data.title }}</h2>
      </div>

      <mat-dialog-content class="dialog-content">
        <p>{{ data.message }}</p>
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="dialog-actions">
        <button mat-button (click)="dialogRef.close(false)">
          {{ data.cancelText || 'Cancel' }}
        </button>
        <button
          mat-flat-button
          [color]="data.isDestructive ? 'warn' : 'primary'"
          (click)="dialogRef.close(true)"
        >
          {{ data.confirmText || 'Confirm' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [
    `
      .confirm-modal {
        padding: 8px;
        min-width: 320px;
      }
      .dialog-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;
      }
      .icon {
        font-size: 28px;
        color: var(--dhan-cyan);
      }
      .icon.danger {
        color: var(--color-loss);
      }
      .dialog-title {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
      }
      .dialog-content {
        padding: 8px 0 16px 0;
        color: var(--text-secondary);
        font-size: 0.9375rem;
        line-height: 1.5;
      }
      .dialog-actions {
        padding: 8px 0 0 0;
        gap: 8px;
      }
    `,
  ],
})
export class ConfirmationDialogComponent {
  readonly dialogRef = inject(MatDialogRef<ConfirmationDialogComponent>);
  readonly data = inject<ConfirmationDialogData>(MAT_DIALOG_DATA);
}

import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../../core/api/auth.service';
import { StrategyService } from '../../../../core/api/strategy.service';
import { SectionErrorComponent } from '../../../../shared/components/section-error/section-error.component';
import { CurrencyInrPipe } from '../../../../shared/pipes/currency-inr.pipe';
import { IstDatePipe } from '../../../../shared/pipes/ist-date.pipe';

@Component({
  selector: 'app-auto-sl-runner',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    SectionErrorComponent,
    CurrencyInrPipe,
    IstDatePipe,
  ],
  template: `
    <div class="runner-card m3-card">
      <div class="runner-header">
        <div class="title-wrap">
          <span class="material-symbols-rounded runner-icon">shield_with_heart</span>
          <div>
            <h3 class="card-title">Auto-SL Bracket Runner</h3>
            <span class="subtitle">Automated Nifty Bracket: -7 pts SL / +30 pts Target (R:R 1:4.29)</span>
          </div>
        </div>
        <button
          mat-icon-button
          (click)="strategyService.refreshLogs()"
          matTooltip="Refresh strategy execution logs"
        >
          <span class="material-symbols-rounded">refresh</span>
        </button>
      </div>

      <!-- Quick Deployment Form -->
      <form (ngSubmit)="deployBracket()" class="deploy-form">
        <div class="form-grid">
          <div class="grid-col symbol-field">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Option Symbol / Strike</mat-label>
              <input matInput [(ngModel)]="symbol" name="symbol" placeholder="e.g. NIFTY 24600 CE" required />
            </mat-form-field>
          </div>

          <div class="grid-col">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Entry Price (₹)</mat-label>
              <input
                matInput
                type="number"
                step="0.05"
                [(ngModel)]="entryPrice"
                name="entryPrice"
                placeholder="Entry Price"
                required
              />
            </mat-form-field>
          </div>

          <div class="grid-col">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Quantity</mat-label>
              <input matInput type="number" step="25" [(ngModel)]="quantity" name="quantity" required />
            </mat-form-field>
          </div>
        </div>

        <!-- Dynamic Calculation Preview -->
        <div class="bracket-preview-box" *ngIf="entryPrice && entryPrice > 0">
          <div class="leg-pill entry">
            <span class="leg-title">Entry Order</span>
            <span class="leg-price mono-val">{{ entryPrice | currencyInr : false }}</span>
            <span class="leg-sub">Market Buy ({{ quantity }} Qty)</span>
          </div>

          <span class="arrow-sep">&rarr;</span>

          <div class="leg-pill sl">
            <span class="leg-title">Stop Loss (-7 pts)</span>
            <span class="leg-price mono-val">{{ computedSl() | currencyInr : false }}</span>
            <span class="leg-sub">SL-M Trigger</span>
          </div>

          <span class="arrow-sep">&rarr;</span>

          <div class="leg-pill target">
            <span class="leg-title">Profit Target (+30 pts)</span>
            <span class="leg-price mono-val">{{ computedTarget() | currencyInr : false }}</span>
            <span class="leg-sub">Limit Sell</span>
          </div>
        </div>

        <div class="deploy-action-row">
          <button
            mat-flat-button
            color="primary"
            type="submit"
            class="deploy-btn"
            [disabled]="strategyService.isExecuting() || !symbol || !entryPrice || !quantity || !authService.isBackendOnline()"
          >
            <span class="material-symbols-rounded">rocket_launch</span>
            {{ strategyService.isExecuting() ? 'Deploying Bracket Order Legs...' : 'Deploy Instant 3-Leg Bracket' }}
          </button>
        </div>
      </form>

      <!-- Audit Logs Feed -->
      <div class="audit-section">
        <div class="audit-header">
          <span class="section-title">Execution Audit Logs</span>
          <span class="log-count">({{ strategyService.logs().length }} Executions)</span>
        </div>

        <!-- Section Error State for Strategy Logs -->
        <app-section-error
          *ngIf="strategyService.logsError() as err"
          title="Failed to Load Audit Logs"
          [message]="err"
          (retry)="strategyService.refreshLogs()"
        ></app-section-error>

        <div class="logs-scroll-area" *ngIf="!strategyService.logsError()">
          <div *ngIf="strategyService.logs().length === 0" class="empty-logs">
            No strategy executions recorded yet on Dhan. Deploy above or bind to alert trigger!
          </div>

          <div *ngFor="let exec of strategyService.logs()" class="execution-log-card">
            <div class="exec-top">
              <span class="exec-sym">{{ exec.symbol }}</span>
              <span class="mono-val exec-qty">{{ exec.quantity }} Qty</span>
              <span class="rr-chip mono-val">R:R {{ exec.riskRewardRatio }}</span>
              <span class="time mono-val">{{ exec.executedAt | istDate : 'timeOnly' }}</span>
            </div>

            <div class="exec-levels mono-val">
              <span class="entry-tag">Entry: {{ exec.entryPrice | currencyInr : false }}</span>
              <span class="sl-tag">SL: {{ exec.slPrice | currencyInr : false }} (-{{ exec.slPoints }})</span>
              <span class="tgt-tag">Target: {{ exec.targetPrice | currencyInr : false }} (+{{ exec.targetPoints }})</span>
            </div>

            <!-- Detailed Steps -->
            <div class="steps-list" *ngIf="exec.logs && exec.logs.length > 0">
              <div *ngFor="let step of exec.logs" class="step-line mono-val">
                {{ step }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .runner-card {
        padding: 16px;
      }
      .runner-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      .title-wrap {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .runner-icon {
        font-size: 26px;
        color: #818CF8;
      }
      .card-title {
        font-size: 1rem;
        font-weight: 600;
        margin: 0;
      }
      .subtitle {
        font-size: 0.6875rem;
        color: var(--text-muted);
      }
      .deploy-form {
        margin-bottom: 16px;
      }
      .form-grid {
        display: grid;
        grid-template-columns: 2fr 1fr 1fr;
        gap: 8px;
      }
      .full-width {
        width: 100%;
      }
      .bracket-preview-box {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 10px;
        padding: 10px 14px;
        margin: 10px 0;
      }
      .leg-pill {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
      }
      .leg-title {
        font-size: 0.6875rem;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--text-muted);
      }
      .leg-price {
        font-size: 0.9375rem;
        font-weight: 700;
      }
      .leg-sub {
        font-size: 0.625rem;
        color: var(--text-muted);
      }
      .leg-pill.entry .leg-price {
        color: var(--dhan-cyan);
      }
      .leg-pill.sl .leg-price {
        color: var(--color-loss);
      }
      .leg-pill.target .leg-price {
        color: var(--color-profit);
      }
      .arrow-sep {
        color: var(--text-muted);
        font-weight: 700;
      }
      .deploy-action-row {
        margin-top: 8px;
      }
      .deploy-btn {
        width: 100%;
        padding: 10px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        background-color: var(--dhan-secondary) !important;
        color: #FFFFFF !important;
      }
      .audit-section {
        border-top: 1px solid var(--border-subtle);
        padding-top: 12px;
      }
      .audit-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }
      .section-title {
        font-size: 0.8125rem;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--text-muted);
      }
      .log-count {
        font-size: 0.75rem;
        color: var(--text-muted);
      }
      .logs-scroll-area {
        max-height: 240px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .empty-logs {
        padding: 16px;
        text-align: center;
        font-size: 0.75rem;
        color: var(--text-muted);
      }
      .execution-log-card {
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        padding: 8px 12px;
      }
      .exec-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 6px;
      }
      .exec-sym {
        font-weight: 700;
        font-size: 0.875rem;
        color: var(--text-primary);
      }
      .exec-qty {
        font-size: 0.75rem;
        color: var(--text-secondary);
      }
      .rr-chip {
        font-size: 0.6875rem;
        background: rgba(99, 102, 241, 0.15);
        color: #A5B4FC;
        padding: 1px 6px;
        border-radius: 4px;
      }
      .time {
        font-size: 0.6875rem;
        color: var(--text-muted);
      }
      .exec-levels {
        display: flex;
        gap: 12px;
        font-size: 0.75rem;
        margin-bottom: 6px;
      }
      .entry-tag {
        color: var(--dhan-cyan);
      }
      .sl-tag {
        color: var(--color-loss);
      }
      .tgt-tag {
        color: var(--color-profit);
      }
      .steps-list {
        border-top: 1px dashed var(--border-subtle);
        padding-top: 4px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .step-line {
        font-size: 0.6875rem;
        color: var(--text-secondary);
        white-space: pre-wrap;
      }
    `,
  ],
})
export class AutoSlRunnerComponent {
  readonly strategyService = inject(StrategyService);
  readonly authService = inject(AuthService);

  symbol = 'NIFTY 24600 CE';
  entryPrice: number | null = null;
  quantity = 50;

  readonly computedSl = computed(() => {
    if (!this.entryPrice) return 0;
    return Math.round((this.entryPrice - 7.0) * 100) / 100;
  });

  readonly computedTarget = computed(() => {
    if (!this.entryPrice) return 0;
    return Math.round((this.entryPrice + 30.0) * 100) / 100;
  });

  deployBracket(): void {
    if (!this.symbol || !this.entryPrice || !this.quantity) return;

    this.strategyService
      .executeAutoSl({
        symbol: this.symbol,
        entryPrice: Number(this.entryPrice),
        quantity: Number(this.quantity),
      })
      .subscribe();
  }
}

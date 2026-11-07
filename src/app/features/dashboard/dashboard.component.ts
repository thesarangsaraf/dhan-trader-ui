import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AlertService } from '../../core/api/alert.service';
import { AuthService } from '../../core/api/auth.service';
import { OrderService } from '../../core/api/order.service';
import { AudioChimeService } from '../../core/services/audio-chime.service';
import { IstDatePipe } from '../../shared/pipes/ist-date.pipe';
import { AlertComposerComponent } from './components/alert-composer/alert-composer.component';
import { AlertListComponent } from './components/alert-list/alert-list.component';
import { OrderBookComponent } from './components/order-book/order-book.component';
import { PositionsSummaryComponent } from './components/positions-summary/positions-summary.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    IstDatePipe,
    AlertComposerComponent,
    AlertListComponent,
    OrderBookComponent,
    PositionsSummaryComponent,
  ],
  template: `
    <div class="dashboard-root">
      <!-- 3-ZONE DASHBOARD MAIN BODY -->
      <main class="dashboard-body">
        <!-- ZONE 1: LEFT PANEL (35%) -->
        <aside class="panel left-panel">
          <!-- Alert Composer & Conditional Order Creator -->
          <app-alert-composer></app-alert-composer>
        </aside>

        <!-- ZONE 2: CENTER PANEL (40%) -->
        <section class="panel center-panel">
          <!-- Live Alerts & Triggers Monitor -->
          <app-alert-list class="flex-grow"></app-alert-list>
        </section>

        <!-- ZONE 3: RIGHT PANEL (25%) -->
        <aside class="panel right-panel">
          <mat-tab-group class="right-tab-group" animationDuration="150ms">
            <!-- Tab 1: Positions -->
            <mat-tab>
              <ng-template mat-tab-label>
                <span class="material-symbols-rounded tab-icon">pie_chart</span>
                <span>Positions</span>
                <span class="tab-badge" *ngIf="orderService.summary()?.openPositionsCount">
                  {{ orderService.summary()?.openPositionsCount }}
                </span>
              </ng-template>
              <div class="tab-content">
                <app-positions-summary></app-positions-summary>
              </div>
            </mat-tab>

            <!-- Tab 2: Order Book -->
            <mat-tab>
              <ng-template mat-tab-label>
                <span class="material-symbols-rounded tab-icon">receipt_long</span>
                <span>Order Book</span>
                <span class="tab-badge pending" *ngIf="orderService.openOrders().length > 0">
                  {{ orderService.openOrders().length }}
                </span>
              </ng-template>
              <div class="tab-content">
                <app-order-book></app-order-book>
              </div>
            </mat-tab>
          </mat-tab-group>
        </aside>
      </main>

      <!-- BOTTOM DOCK -->
      <footer class="bottom-dock">
        <div class="dock-left">
          <div class="dock-item">
            <span class="pulse-dot-cyan" [class.offline]="!authService.isBackendOnline()"></span>
            <span class="text">Engine: {{ authService.isBackendOnline() ? 'Dhan Pro Engine Active' : 'Backend Disconnected' }}</span>
          </div>
          <div class="dock-item mono-val" *ngIf="alertService.lastPollTime() as pt">
            <span>Last Updated: {{ pt | istDate : 'timeOnly' }}</span>
          </div>
          <div class="dock-item mono-val" *ngIf="orderService.wsStatus() as ws">
            <span class="pulse-dot-cyan" [class.offline]="!ws.connected"></span>
            <span>Order Socket: {{ ws.connected ? 'Live Feed' : 'Standby' }}</span>
          </div>
          <div class="dock-item">
            <span class="material-symbols-rounded dock-icon">verified</span>
            <span>Zero Static IP Architecture</span>
          </div>
        </div>

        <div class="dock-right">
          <div class="dock-item" [class.sound-on]="audioChime.soundEnabled()">
            <span class="material-symbols-rounded dock-icon">volume_up</span>
            <span>Chime Synthesizer: {{ audioChime.soundEnabled() ? 'Armed' : 'Muted' }}</span>
          </div>
          <div class="dock-item mono-val" *ngIf="authService.tokenStatus()?.clientId as cid">
            <span class="material-symbols-rounded dock-icon">vpn_key</span>
            <span>Client: {{ cid }}</span>
          </div>
        </div>
      </footer>
    </div>
  `,
  styles: [
    `
      .dashboard-root {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        background-color: var(--bg-primary);
        color: var(--text-primary);
        overflow: hidden;
      }

      /* 3-ZONE MAIN LAYOUT */
      .dashboard-body {
        flex: 1;
        display: flex;
        padding: 12px;
        gap: 12px;
        overflow: hidden;
      }
      .panel {
        display: flex;
        flex-direction: column;
        gap: 12px;
        overflow-y: auto;
      }
      .left-panel {
        flex: 0 0 35%;
        max-width: 35%;
      }
      .center-panel {
        flex: 0 0 40%;
        max-width: 40%;
      }
      .right-panel {
        flex: 0 0 25%;
        max-width: 25%;
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        border-radius: 16px;
        padding: 12px;
      }
      .flex-grow {
        flex: 1;
      }
      .right-tab-group {
        height: 100%;
        display: flex;
        flex-direction: column;
      }
      .tab-icon {
        font-size: 18px;
        margin-right: 6px;
      }
      .tab-badge {
        font-size: 0.625rem;
        background: var(--dhan-cyan);
        color: #0b0f19;
        font-weight: 800;
        padding: 1px 6px;
        border-radius: 999px;
        margin-left: 6px;
      }
      .tab-badge.pending {
        background: var(--color-pending);
      }
      .tab-content {
        padding-top: 12px;
        height: calc(100vh - 160px);
        overflow-y: auto;
      }

      /* BOTTOM DOCK */
      .bottom-dock {
        height: 38px;
        flex: 0 0 38px;
        background-color: var(--bg-dock);
        border-top: 1px solid var(--border-subtle);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
        font-size: 0.75rem;
        color: var(--text-muted);
      }
      .dock-left,
      .dock-right {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .dock-item {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .pulse-dot-cyan {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background-color: var(--dhan-cyan);
      }
      .pulse-dot-cyan.offline {
        background-color: var(--color-loss);
      }
      .dock-icon {
        font-size: 15px;
      }
      .dock-item.sound-on {
        color: var(--dhan-cyan);
      }
    `,
  ],
})
export class DashboardComponent {
  readonly authService = inject(AuthService);
  readonly alertService = inject(AlertService);
  readonly orderService = inject(OrderService);
  readonly audioChime = inject(AudioChimeService);
}

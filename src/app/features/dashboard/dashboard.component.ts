import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { OrderService } from '../../core/api/order.service';
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
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        flex: 1;
        height: 100%;
        min-height: 0;
        width: 100%;
      }

      .dashboard-root {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: calc(100vh - 56px);
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
        min-height: 0;
      }
      .panel {
        display: flex;
        flex-direction: column;
        gap: 12px;
        overflow-y: auto;
        min-height: 0;
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
        height: calc(100vh - 120px);
        overflow-y: auto;
      }
    `,
  ],
})
export class DashboardComponent {
  readonly orderService = inject(OrderService);
}

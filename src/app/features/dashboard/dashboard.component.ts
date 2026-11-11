import { Component, HostListener, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog } from '@angular/material/dialog';
import { OrderService } from '../../core/api/order.service';
import { AlertService } from '../../core/api/alert.service';
import { Instrument } from '../../core/models/instrument.models';
import { AlertComposerComponent } from './components/alert-composer/alert-composer.component';
import { AlertListComponent } from './components/alert-list/alert-list.component';
import { OrderBookComponent } from './components/order-book/order-book.component';
import { PositionsSummaryComponent } from './components/positions-summary/positions-summary.component';
import { ScripSearcherModalComponent } from '../../shared/components/scrip-searcher-modal/scrip-searcher-modal.component';

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
      <!-- MOBILE ZONE SWITCHER (Visible on Mobile/Tablet screens <= 1023px) -->
      <nav class="mobile-zone-nav" aria-label="Dashboard zones">
        <button
          type="button"
          class="zone-btn"
          [class.active]="activeMobileZone() === 'composer'"
          (click)="activeMobileZone.set('composer')"
        >
          <span class="material-symbols-rounded">edit_note</span>
          <span>Trade</span>
        </button>

        <button
          type="button"
          class="zone-btn"
          [class.active]="activeMobileZone() === 'alerts'"
          (click)="activeMobileZone.set('alerts')"
        >
          <span class="material-symbols-rounded">radar</span>
          <span>Alerts</span>
          <span class="zone-badge" *ngIf="alertService.alerts().length > 0">
            {{ alertService.alerts().length }}
          </span>
        </button>

        <button
          type="button"
          class="zone-btn"
          [class.active]="activeMobileZone() === 'portfolio'"
          (click)="activeMobileZone.set('portfolio')"
        >
          <span class="material-symbols-rounded">pie_chart</span>
          <span>Portfolio</span>
          <span class="zone-badge" *ngIf="orderService.summary()?.openPositionsCount">
            {{ orderService.summary()?.openPositionsCount }}
          </span>
        </button>
      </nav>

      <!-- 3-ZONE DASHBOARD MAIN BODY -->
      <main class="dashboard-body">
        <!-- ZONE 1: LEFT PANEL (35%) -->
        <aside class="panel left-panel" [class.mobile-active]="activeMobileZone() === 'composer'">
          <!-- Alert Composer & Conditional Order Creator -->
          <app-alert-composer #composer></app-alert-composer>
        </aside>

        <!-- ZONE 2: CENTER PANEL (40%) -->
        <section class="panel center-panel" [class.mobile-active]="activeMobileZone() === 'alerts'">
          <!-- Live Alerts & Triggers Monitor -->
          <app-alert-list class="flex-grow"></app-alert-list>
        </section>

        <!-- ZONE 3: RIGHT PANEL (25%) -->
        <aside class="panel right-panel" [class.mobile-active]="activeMobileZone() === 'portfolio'">
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

      .mobile-zone-nav {
        display: none;
      }

      /* 3-ZONE MAIN LAYOUT (Desktop >= 1024px) */
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

      /* Mobile & Tablet Layout (<= 1023px) */
      @media (max-width: 1023px) {
        .dashboard-root {
          height: auto;
          min-height: 100%;
          overflow-y: auto;
          overflow-x: hidden;
        }

        .mobile-zone-nav {
          display: flex;
          gap: 6px;
          padding: 8px 10px;
          background: rgba(21, 28, 44, 0.95);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border-subtle);
          position: sticky;
          top: 0;
          z-index: 20;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
        }

        .zone-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 6px;
          border-radius: 8px;
          border: 1px solid var(--border-subtle);
          background: var(--bg-card);
          color: var(--text-secondary);
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          min-height: 38px;
        }

        .zone-btn span.material-symbols-rounded {
          font-size: 18px;
        }

        .zone-btn:hover {
          color: var(--text-primary);
          border-color: var(--border-medium);
        }

        .zone-btn.active {
          background: var(--dhan-cyan);
          color: #0b0f19;
          border-color: var(--dhan-cyan);
          font-weight: 700;
        }

        .zone-badge {
          font-size: 0.625rem;
          background: #0b0f19;
          color: var(--dhan-cyan);
          font-weight: 800;
          padding: 1px 6px;
          border-radius: 999px;
        }

        .zone-btn.active .zone-badge {
          background: #0b0f19;
          color: var(--dhan-cyan);
        }

        .dashboard-body {
          flex-direction: column;
          padding: 8px;
          gap: 0;
          overflow: visible;
          min-height: auto;
        }

        .panel {
          display: none !important;
          flex: 1 0 auto;
          max-width: 100% !important;
          width: 100% !important;
          overflow: visible;
        }

        .panel.mobile-active {
          display: flex !important;
        }

        .right-panel {
          background: transparent;
          border: none;
          padding: 0;
        }

        .tab-content {
          height: auto;
          min-height: 280px;
          overflow-y: visible;
        }
      }
    `,
  ],
})
export class DashboardComponent {
  @ViewChild('composer') composer!: AlertComposerComponent;
  readonly orderService = inject(OrderService);
  readonly alertService = inject(AlertService);
  private readonly dialog = inject(MatDialog);

  readonly activeMobileZone = signal<'alerts' | 'composer' | 'portfolio'>('alerts');

  @HostListener('window:keydown', ['$event'])
  handleGlobalShortcuts(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.openScripSearcher();
    }
  }

  openScripSearcher(): void {
    const dialogRef = this.dialog.open(ScripSearcherModalComponent, {
      width: '640px',
      panelClass: 'dhan-spotlight-dialog',
    });
    dialogRef.afterClosed().subscribe((item?: Instrument) => {
      if (item && this.composer) {
        this.activeMobileZone.set('composer');
        this.composer.onInstrumentSelected(item);
      }
    });
  }
}

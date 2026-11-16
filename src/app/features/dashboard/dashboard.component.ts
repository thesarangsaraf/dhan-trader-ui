import { Component, HostListener, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { AlertService } from '../../core/api/alert.service';
import { Instrument } from '../../core/models/instrument.models';
import { AlertComposerComponent } from './components/alert-composer/alert-composer.component';
import { AlertListComponent } from './components/alert-list/alert-list.component';
import { ScripSearcherModalComponent } from '../../shared/components/scrip-searcher-modal/scrip-searcher-modal.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    AlertComposerComponent,
    AlertListComponent,
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
      </nav>

      <!-- 2-PANEL DASHBOARD MAIN BODY -->
      <main class="dashboard-body">
        <!-- ZONE 1: CONDITIONAL ALERT COMPOSER -->
        <aside class="panel left-panel" [class.mobile-active]="activeMobileZone() === 'composer'">
          <app-alert-composer #composer></app-alert-composer>
        </aside>

        <!-- ZONE 2: LIVE ALERT MONITOR -->
        <section class="panel center-panel flex-grow" [class.mobile-active]="activeMobileZone() === 'alerts'">
          <app-alert-list class="flex-grow"></app-alert-list>
        </section>
      </main>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        flex: 1;
        width: 100%;
      }

      .dashboard-root {
        display: flex;
        flex-direction: column;
        min-height: 100%;
        width: 100%;
        background-color: var(--bg-primary);
        color: var(--text-primary);
      }

      .mobile-zone-nav {
        display: none;
      }

      /* 2-PANEL MAIN LAYOUT (Desktop >= 1024px) */
      .dashboard-body {
        flex: 1;
        display: flex;
        align-items: flex-start;
        padding: 14px 18px;
        gap: 16px;
        min-height: auto;
      }

      .panel {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .left-panel {
        flex: 0 0 62%;
        max-width: 920px;
        min-width: 560px;
        overflow: visible;
        height: auto;
      }

      .center-panel {
        flex: 1;
        min-width: 360px;
        overflow: visible;
        height: auto;
      }

      .flex-grow {
        flex: 1;
      }

      @media (min-width: 1024px) and (max-width: 1280px) {
        .left-panel {
          flex: 0 0 58%;
          min-width: 540px;
        }
      }

      /* Mobile & Tablet Layout (<= 1023px) */
      @media (max-width: 1023px) {
        .dashboard-root {
          height: auto;
          min-height: 100%;
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
      }
    `,
  ],
})
export class DashboardComponent {
  @ViewChild('composer') composer!: AlertComposerComponent;
  readonly alertService = inject(AlertService);
  private readonly dialog = inject(MatDialog);

  readonly activeMobileZone = signal<'alerts' | 'composer'>('alerts');

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

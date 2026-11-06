import { Component, HostListener, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AlertService } from '../../core/api/alert.service';
import { AuthService } from '../../core/api/auth.service';
import { OrderService } from '../../core/api/order.service';
import { TelegramApiService } from '../../core/api/telegram.service';
import { AudioChimeService } from '../../core/services/audio-chime.service';
import { ThemeService } from '../../core/services/theme.service';
import { Instrument } from '../../core/models/instrument.models';
import { AuthModalComponent } from '../settings/auth-modal/auth-modal.component';
import { TelegramModalComponent } from '../settings/telegram-modal/telegram-modal.component';
import { ScripSearcherModalComponent } from '../../shared/components/scrip-searcher-modal/scrip-searcher-modal.component';
import { PriceBadgeComponent } from '../../shared/components/price-badge/price-badge.component';
import { SectionErrorComponent } from '../../shared/components/section-error/section-error.component';
import { CurrencyInrPipe } from '../../shared/pipes/currency-inr.pipe';
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
    MatDialogModule,
    PriceBadgeComponent,
    SectionErrorComponent,
    CurrencyInrPipe,
    IstDatePipe,
    AlertComposerComponent,
    AlertListComponent,
    OrderBookComponent,
    PositionsSummaryComponent,
  ],
  template: `
    <div class="dashboard-root">
      <!-- TOP APP BAR -->
      <header class="top-app-bar">
        <div class="header-brand">
          <div class="brand-logo">
            <span class="material-symbols-rounded">candlestick_chart</span>
          </div>
          <div class="brand-text">
            <div class="brand-name">DHAN TRADER PRO</div>
            <div class="brand-badge">API v2.0 &bull; Live Marketfeed Engine</div>
          </div>
        </div>

        <!-- Middle: Status Badges & Funds (Strict Real Backend Data) -->
        <div class="header-status-group">
          <!-- Backend Status -->
          <div class="status-chip" [class.online]="authService.isBackendOnline()" [class.offline]="!authService.isBackendOnline()">
            <span class="pulse-dot"></span>
            <span>{{ authService.isBackendOnline() ? 'Dhan Engine Online' : 'Backend Offline (127.0.0.1:8000)' }}</span>
          </div>

          <!-- Token Expiry Countdown Pill -->
          <div
            class="token-expiry-chip"
            [class.green]="authService.statusColor() === 'green'"
            [class.yellow]="authService.statusColor() === 'yellow'"
            [class.red]="authService.statusColor() === 'red'"
            (click)="openAuthModal()"
            matTooltip="Click to inspect JWT token, expiry, or manual renewal"
          >
            <span class="material-symbols-rounded token-icon">timer</span>
            <span class="mono-val text">{{ authService.timeRemainingFormatted() }}</span>
            <button
              *ngIf="authService.isBackendOnline()"
              class="mini-renew-btn"
              (click)="$event.stopPropagation(); authService.renewToken()"
              [disabled]="authService.isRenewing()"
              matTooltip="1-Click Auto-Renew Dhan Token"
            >
              <span class="material-symbols-rounded" [class.spinning]="authService.isRenewing()">autorenew</span>
            </button>
          </div>

          <!-- Telegram Bot Status Pill -->
          <div
            class="telegram-chip"
            [class.configured]="telegramService.status().configured"
            (click)="openTelegramModal()"
            matTooltip="Click to manage Telegram Bot alerts & test connection"
          >
            <span class="material-symbols-rounded tg-icon">send</span>
            <span>TG Bot: {{ telegramService.status().configured ? telegramService.status().chatId : 'Disabled' }}</span>
          </div>

          <!-- Real Funds Bar -->
          <div class="funds-bar">
            <span class="funds-label">Avail Margin:</span>
            <span *ngIf="orderService.funds() as f" class="funds-val mono-val">
              {{ f.availableBalance | currencyInr : false }}
            </span>
            <span *ngIf="!orderService.funds()" class="funds-val mono-val muted">--</span>
          </div>

          <!-- Live Real Net P&L Badge -->
          <div class="pnl-pill">
            <span class="pnl-label">Net P&L:</span>
            <app-price-badge
              *ngIf="orderService.summary() as sum"
              [value]="sum.netPnL"
              [pulse]="true"
              size="normal"
            ></app-price-badge>
            <span *ngIf="!orderService.summary()" class="mono-val muted">--</span>
          </div>
        </div>

        <!-- Right: Quick Actions -->
        <div class="header-quick-actions">
          <!-- Sound Toggle Button -->
          <button
            class="action-btn"
            [class.active]="audioChime.soundEnabled()"
            (click)="audioChime.toggleSound()"
            [matTooltip]="audioChime.soundEnabled() ? 'Audio Chime Enabled' : 'Audio Chime Muted'"
          >
            <span class="material-symbols-rounded">
              {{ audioChime.soundEnabled() ? 'volume_up' : 'volume_off' }}
            </span>
          </button>

          <!-- Test Chime Button -->
          <button
            class="action-btn"
            (click)="alertService.testChime()"
            matTooltip="Verify browser audio chime trigger"
          >
            <span class="material-symbols-rounded">notifications_active</span>
          </button>

          <!-- Search Spotlight Ctrl+K Button -->
          <button
            class="action-btn"
            (click)="openScripSearcher()"
            matTooltip="Spotlight Scrip Search (Ctrl+K)"
          >
            <span class="material-symbols-rounded">search</span>
          </button>

          <!-- Dark/Light Mode Switcher -->
          <button
            class="action-btn"
            (click)="themeService.toggleTheme()"
            [matTooltip]="themeService.isDarkMode() ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
          >
            <span class="material-symbols-rounded">
              {{ themeService.isDarkMode() ? 'light_mode' : 'dark_mode' }}
            </span>
          </button>

          <!-- Settings / Auth Modal Trigger -->
          <button
            class="action-btn settings"
            (click)="openAuthModal()"
            matTooltip="API Token & Settings"
          >
            <span class="material-symbols-rounded">settings</span>
          </button>
        </div>
      </header>

      <!-- 3-ZONE DASHBOARD MAIN BODY -->
      <main class="dashboard-body">
        <!-- ZONE 1: LEFT PANEL (35%) -->
        <aside class="panel left-panel">
          <!-- Alert Composer & Conditional Order Creator -->
          <app-alert-composer #composer></app-alert-composer>
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

            <!-- Tab 3: Demat Holdings -->
            <mat-tab>
              <ng-template mat-tab-label>
                <span class="material-symbols-rounded tab-icon">inventory_2</span>
                <span>Holdings</span>
              </ng-template>
              <div class="tab-content holdings-tab">
                <!-- Section Error for Holdings -->
                <app-section-error
                  *ngIf="orderService.holdingsError() as err"
                  title="Failed to Load Holdings"
                  [message]="err"
                  (retry)="orderService.refreshHoldings()"
                ></app-section-error>

                <div *ngIf="!orderService.holdingsError() && orderService.holdings().length === 0" class="empty-state">
                  <span class="material-symbols-rounded empty-icon">account_balance_wallet</span>
                  <p>No Demat equity holdings recorded on your Dhan account.</p>
                </div>

                <div *ngFor="let h of orderService.holdings()" class="holding-card m3-card">
                  <div class="h-top">
                    <span class="h-sym">{{ h.symbol }}</span>
                    <span class="h-qty mono-val">{{ h.totalQty }} Qty</span>
                  </div>
                  <div class="h-sub mono-val">
                    <span>Avg: {{ h.avgCostPrice | currencyInr : false }}</span>
                    <span>LTP: {{ h.ltp | currencyInr : false }}</span>
                  </div>
                  <div class="h-bottom mono-val">
                    <span class="val-text">Val: {{ h.currentValue | currencyInr : false }}</span>
                    <app-price-badge [value]="h.pnl" size="compact"></app-price-badge>
                  </div>
                </div>
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
            <span class="text">Engine: {{ authService.isBackendOnline() ? 'Live Alert Polling (1.5s Interval)' : 'Backend Disconnected' }}</span>
          </div>
          <div class="dock-item mono-val" *ngIf="alertService.lastPollTime() as pt">
            <span>Last Tick: {{ pt | istDate : 'timeOnly' }}</span>
          </div>
          <div class="dock-item">
            <span class="material-symbols-rounded dock-icon">verified</span>
            <span>Zero Static IP Architecture</span>
          </div>
        </div>

        <div class="dock-center">
          <div class="spotlight-hint" (click)="openScripSearcher()">
            <span class="material-symbols-rounded">search</span>
            <span>Fast Scrip Searcher:</span>
            <kbd>Ctrl</kbd> + <kbd>K</kbd>
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
        height: 100vh;
        width: 100vw;
        background-color: var(--bg-primary);
        color: var(--text-primary);
        overflow: hidden;
      }

      /* TOP APP BAR */
      .top-app-bar {
        height: 60px;
        flex: 0 0 60px;
        background-color: var(--header-bg);
        backdrop-filter: blur(12px);
        border-bottom: 1px solid var(--border-subtle);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
        z-index: 100;
      }
      .header-brand {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .brand-logo {
        width: 38px;
        height: 38px;
        background: linear-gradient(135deg, #00D2C4, #6366F1);
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #0B0F19;
      }
      .brand-logo span {
        font-size: 24px;
        font-weight: 700;
      }
      .brand-name {
        font-weight: 800;
        font-size: 1rem;
        letter-spacing: -0.01em;
        line-height: 1.1;
      }
      .brand-badge {
        font-size: 0.6875rem;
        color: var(--text-muted);
      }
      .header-status-group {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .status-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 600;
      }
      .status-chip.online {
        color: var(--color-profit);
        background: var(--color-profit-bg);
      }
      .status-chip.offline {
        color: var(--color-loss);
        background: var(--color-loss-bg);
        border: 1px solid rgba(244, 63, 94, 0.3);
      }
      .pulse-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background-color: currentColor;
      }
      .token-expiry-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .token-expiry-chip.green {
        color: var(--color-profit);
        background: var(--color-profit-bg);
        border: 1px solid rgba(16, 185, 129, 0.3);
      }
      .token-expiry-chip.yellow {
        color: var(--color-pending);
        background: var(--color-pending-bg);
        border: 1px solid rgba(245, 158, 11, 0.3);
      }
      .token-expiry-chip.red {
        color: var(--color-loss);
        background: var(--color-loss-bg);
        border: 1px solid rgba(244, 63, 94, 0.4);
      }
      .token-icon {
        font-size: 16px;
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .spinning {
        animation: spin 1s linear infinite;
        display: inline-block;
      }
      .mini-renew-btn {
        background: transparent;
        border: none;
        color: currentColor;
        cursor: pointer;
        display: flex;
        align-items: center;
        padding: 1px;
      }
      .mini-renew-btn span {
        font-size: 15px;
      }
      .telegram-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 600;
        background: rgba(34, 158, 217, 0.1);
        color: #229ED9;
        cursor: pointer;
        border: 1px solid rgba(34, 158, 217, 0.25);
      }
      .tg-icon {
        font-size: 15px;
      }
      .funds-bar {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        background: var(--bg-surface);
        border-radius: 8px;
        border: 1px solid var(--border-subtle);
        font-size: 0.75rem;
      }
      .funds-label {
        color: var(--text-muted);
      }
      .funds-val {
        color: var(--text-primary);
        font-weight: 700;
      }
      .pnl-pill {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        background: var(--bg-surface);
        border-radius: 8px;
        border: 1px solid var(--border-subtle);
        font-size: 0.75rem;
      }
      .pnl-label {
        color: var(--text-muted);
        font-weight: 600;
      }
      .muted {
        color: var(--text-muted);
      }
      .header-quick-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .action-btn {
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        color: var(--text-secondary);
        border-radius: 8px;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .action-btn:hover {
        color: var(--dhan-cyan);
        border-color: var(--dhan-cyan);
      }
      .action-btn.active {
        color: var(--dhan-cyan);
      }
      .action-btn span {
        font-size: 18px;
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
        color: #0B0F19;
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
      .holdings-tab {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .empty-state {
        padding: 28px 12px;
        text-align: center;
        color: var(--text-muted);
        font-size: 0.8125rem;
      }
      .empty-icon {
        font-size: 32px;
        opacity: 0.5;
        margin-bottom: 6px;
      }
      .holding-card {
        padding: 8px 12px;
      }
      .h-top {
        display: flex;
        justify-content: space-between;
        margin-bottom: 4px;
      }
      .h-sym {
        font-weight: 700;
        font-size: 0.875rem;
      }
      .h-qty {
        font-size: 0.75rem;
        color: var(--text-secondary);
      }
      .h-sub {
        display: flex;
        gap: 10px;
        font-size: 0.6875rem;
        color: var(--text-muted);
        margin-bottom: 6px;
      }
      .h-bottom {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px dashed var(--border-subtle);
        padding-top: 4px;
        font-size: 0.75rem;
      }
      .val-text {
        color: var(--text-secondary);
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
      .spotlight-hint {
        display: flex;
        align-items: center;
        gap: 6px;
        background: var(--bg-surface);
        padding: 3px 12px;
        border-radius: 6px;
        border: 1px solid var(--border-subtle);
        cursor: pointer;
        color: var(--text-secondary);
      }
      .spotlight-hint:hover {
        border-color: var(--dhan-cyan);
        color: var(--dhan-cyan);
      }
      .spotlight-hint span {
        font-size: 0.75rem;
      }
      .spotlight-hint .material-symbols-rounded {
        font-size: 15px;
      }
      kbd {
        background: var(--bg-card);
        padding: 1px 4px;
        border-radius: 3px;
        border: 1px solid var(--border-subtle);
        font-size: 0.6875rem;
        font-family: var(--font-mono);
      }
    `,
  ],
})
export class DashboardComponent {
  readonly authService = inject(AuthService);
  readonly alertService = inject(AlertService);
  readonly orderService = inject(OrderService);
  readonly telegramService = inject(TelegramApiService);
  readonly audioChime = inject(AudioChimeService);
  readonly themeService = inject(ThemeService);
  private readonly dialog = inject(MatDialog);

  @ViewChild('composer') composer!: AlertComposerComponent;

  @HostListener('window:keydown', ['$event'])
  handleGlobalShortcuts(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.openScripSearcher();
    }
  }

  openAuthModal(): void {
    this.dialog.open(AuthModalComponent, {
      width: '560px',
    });
  }

  openTelegramModal(): void {
    this.dialog.open(TelegramModalComponent, {
      width: '520px',
    });
  }

  openScripSearcher(): void {
    const ref = this.dialog.open(ScripSearcherModalComponent, {
      width: '600px',
      position: { top: '15vh' },
    });

    ref.afterClosed().subscribe((selected: Instrument | undefined) => {
      if (selected && this.composer) {
        this.composer.onInstrumentSelected(selected);
      }
    });
  }
}

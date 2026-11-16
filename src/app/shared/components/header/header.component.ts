import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AuthService } from '../../../core/api/auth.service';
import { AlertService } from '../../../core/api/alert.service';
import { OrderService } from '../../../core/api/order.service';
import { TelegramApiService } from '../../../core/api/telegram.service';
import { UserAuthService } from '../../../core/api/user-auth.service';
import { AuthModalComponent } from '../../../features/settings/auth-modal/auth-modal.component';
import { TelegramModalComponent } from '../../../features/settings/telegram-modal/telegram-modal.component';
import { FundsModalComponent } from '../../../features/settings/funds-modal/funds-modal.component';
import { CurrencyInrPipe } from '../../pipes/currency-inr.pipe';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDialogModule,
    CurrencyInrPipe,
  ],
  template: `
    <header class="top-app-bar">
      <!-- Left: Brand Logo & Title -->
      <div class="header-brand">
        <div class="brand-logo">
          <span class="material-symbols-rounded">candlestick_chart</span>
        </div>
        <div class="brand-text">
          <div class="brand-name">DHAN TRADER PRO</div>
          <div class="brand-badge">API v2.0 &bull; Live Marketfeed Engine</div>
        </div>
      </div>

      <!-- Navigation Tabs (Route switching) -->
      <nav class="header-nav-tabs">
        <a routerLink="/" class="nav-tab" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
          <span class="material-symbols-rounded">dashboard</span>
          <span>Live Monitor</span>
        </a>
        <a routerLink="/positions" class="nav-tab" routerLinkActive="active">
          <span class="material-symbols-rounded">account_balance_wallet</span>
          <span>Positions</span>
        </a>
        <a routerLink="/screener" class="nav-tab" routerLinkActive="active">
          <span class="material-symbols-rounded">radar</span>
          <span>Stock Screener</span>
        </a>
        <a routerLink="/trades" class="nav-tab" routerLinkActive="active">
          <span class="material-symbols-rounded">history</span>
          <span>Trade History</span>
        </a>
        <a routerLink="/settings" class="nav-tab" routerLinkActive="active">
          <span class="material-symbols-rounded">settings</span>
          <span>Settings</span>
        </a>
      </nav>

      <!-- Middle: Status Badges & Funds (Strict Real Backend Data) -->
      <div class="header-status-group">
        <!-- Token Expiry Countdown Pill -->
        <div
          class="token-expiry-chip"
          [ngClass]="authService.statusColor()"
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

        <!-- Available Balance Option (Strict Real Backend Data) -->
        <div
          class="funds-chip"
          (click)="openFundsModal()"
          [matTooltip]="orderService.funds() ? ((orderService.funds()?.dematHoldingsValue ? 'Demat Portfolio: ' + (orderService.funds()?.dematHoldingsValue | currencyInr : false) + ' | ' : '') + 'Available Trading Cash: ' + (orderService.funds()?.availableBalance | currencyInr : false) + '. Click for full breakdown.') : 'Click to inspect Dhan account funds, margins & limits'"
        >
          <span class="material-symbols-rounded funds-icon">account_balance_wallet</span>
          <span class="funds-label">{{ (orderService.funds()?.availableBalance === 0 && (orderService.funds()?.dematHoldingsValue || 0) > 0) ? 'Demat Value:' : 'Available Balance:' }}</span>
          <span *ngIf="orderService.funds() as f" class="funds-val mono-val">
            {{ ((f.availableBalance === 0 && (f.dematHoldingsValue || 0) > 0) ? f.dematHoldingsValue : f.availableBalance) | currencyInr : false }}
          </span>
          <span *ngIf="!orderService.funds()" class="funds-val mono-val muted">--</span>
          <button
            *ngIf="authService.isBackendOnline()"
            class="mini-funds-btn"
            (click)="$event.stopPropagation(); orderService.refreshFunds()"
            [disabled]="orderService.isRefreshingFunds() || orderService.isLoadingPositions()"
            matTooltip="Refresh Available Balance"
          >
            <span class="material-symbols-rounded" [class.spinning]="orderService.isRefreshingFunds() || orderService.isLoadingPositions()">refresh</span>
          </button>
        </div>
      </div>

      <!-- Right: Quick Actions -->
      <div class="header-quick-actions">
        <!-- Settings Page Link -->
        <a
          routerLink="/settings"
          class="action-btn settings"
          matTooltip="System & Trading Settings"
        >
          <span class="material-symbols-rounded">settings</span>
        </a>

        <!-- User Profile Pill & Logout -->
        <div class="user-chip" [matTooltip]="'Logged in as ' + (userAuthService.currentUser()?.username || 'admin')">
          <span class="material-symbols-rounded">account_circle</span>
          <span class="user-name">{{ userAuthService.currentUser()?.username || 'admin' }}</span>
        </div>

        <button
          class="action-btn logout-btn"
          (click)="userAuthService.logout()"
          matTooltip="Sign Out of Dhan Trader Pro"
        >
          <span class="material-symbols-rounded">logout</span>
        </button>
      </div>
    </header>
  `,
  styles: [
    `
      .top-app-bar {
        height: 60px;
        flex: 0 0 60px;
        background-color: var(--header-bg);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-bottom: 1px solid var(--border-subtle);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
        z-index: 100;
        position: relative;
        box-sizing: border-box;
      }

      .header-brand {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .brand-logo {
        width: 38px;
        height: 38px;
        background: linear-gradient(135deg, #00d2c4, #6366f1);
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #0b0f19;
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
        color: var(--text-primary);
      }

      .brand-badge {
        font-size: 0.6875rem;
        color: var(--text-muted);
      }

      .header-nav-tabs {
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(0, 0, 0, 0.25);
        padding: 3px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.08);
      }

      .nav-tab {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 12px;
        border-radius: 8px;
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--text-muted);
        text-decoration: none;
        transition: all 0.2s ease;
      }

      .nav-tab span.material-symbols-rounded {
        font-size: 16px;
      }

      .nav-tab:hover {
        color: var(--text-primary);
        background: rgba(255, 255, 255, 0.06);
      }

      .nav-tab.active {
        background: #00d2c4;
        color: #0b0f19;
      }

      .header-status-group {
        display: flex;
        align-items: center;
        gap: 12px;
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

      .funds-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
      }

      .funds-chip:hover {
        border-color: var(--dhan-cyan);
        background: rgba(0, 210, 196, 0.08);
      }

      .funds-icon {
        font-size: 15px;
        color: var(--dhan-cyan);
      }

      .funds-label {
        color: var(--text-muted);
      }

      .funds-val {
        color: var(--text-primary);
        font-weight: 700;
      }

      .mini-funds-btn {
        background: transparent;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        display: flex;
        align-items: center;
        padding: 1px;
        transition: color 0.15s ease;
      }

      .mini-funds-btn:hover {
        color: var(--dhan-cyan);
      }

      .mini-funds-btn span {
        font-size: 15px;
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
        text-decoration: none;
        box-sizing: border-box;
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

      .user-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 8px;
        background: rgba(0, 210, 196, 0.1);
        border: 1px solid rgba(0, 210, 196, 0.25);
        color: var(--dhan-cyan);
        font-size: 0.75rem;
        font-weight: 600;
      }

      .user-chip span.material-symbols-rounded {
        font-size: 16px;
      }

      .logout-btn:hover {
        color: #f43f5e !important;
        border-color: #f43f5e !important;
      }

      /* Mobile Responsive Top App Bar & Mobile Bottom Nav */
      @media (max-width: 768px) {
        .top-app-bar {
          height: 52px;
          flex: 0 0 52px;
          padding: 0 8px;
        }

        .header-brand {
          gap: 8px;
        }

        .brand-logo {
          width: 32px;
          height: 32px;
          border-radius: 8px;
        }

        .brand-logo span {
          font-size: 20px;
        }

        .brand-name {
          font-size: 0.8125rem;
          white-space: nowrap;
        }

        .brand-badge {
          display: none;
        }

        /* Bottom Navigation Bar for Mobile */
        .header-nav-tabs {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 56px;
          background: rgba(11, 15, 25, 0.96);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-top: 1px solid var(--border-medium);
          border-radius: 0;
          border-left: none;
          border-right: none;
          border-bottom: none;
          display: flex;
          justify-content: space-around;
          align-items: center;
          padding: 4px 6px calc(4px + env(safe-area-inset-bottom, 0px));
          z-index: 1000;
          gap: 2px;
          box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.4);
        }

        .nav-tab {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 2px;
          padding: 4px 2px;
          font-size: 0.65rem;
          font-weight: 600;
          height: 100%;
          border-radius: 8px;
          color: var(--text-muted);
          background: transparent;
        }

        .nav-tab span.material-symbols-rounded {
          font-size: 20px;
        }

        .nav-tab:hover {
          color: var(--text-primary);
        }

        .nav-tab.active {
          background: rgba(0, 210, 196, 0.15);
          color: var(--dhan-cyan);
        }

        .header-status-group {
          gap: 6px;
        }

        .token-expiry-chip {
          padding: 3px 6px;
          font-size: 0.6875rem;
          gap: 4px;
        }

        .funds-chip {
          padding: 3px 6px;
          font-size: 0.6875rem;
          gap: 4px;
        }

        .funds-label {
          display: none;
        }

        .header-quick-actions {
          gap: 4px;
        }

        .action-btn {
          width: 32px;
          height: 32px;
          border-radius: 6px;
        }

        .action-btn.settings {
          display: none; /* Accessible in bottom nav */
        }
      }
    `,
  ],
})
export class HeaderComponent implements OnInit, OnDestroy {
  readonly authService = inject(AuthService);
  readonly userAuthService = inject(UserAuthService);
  readonly alertService = inject(AlertService);
  readonly orderService = inject(OrderService);
  readonly telegramService = inject(TelegramApiService);
  private readonly dialog = inject(MatDialog);

  private fundsPollInterval: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    // Refresh funds periodically every 45 seconds to keep available balance fresh
    this.fundsPollInterval = setInterval(() => {
      if (this.authService.isBackendOnline()) {
        this.orderService.refreshFunds();
      }
    }, 45000);
  }

  ngOnDestroy(): void {
    if (this.fundsPollInterval) {
      clearInterval(this.fundsPollInterval);
      this.fundsPollInterval = null;
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

  openFundsModal(): void {
    this.dialog.open(FundsModalComponent, {
      width: '520px',
    });
  }
}

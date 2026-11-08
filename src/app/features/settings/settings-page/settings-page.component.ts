import { Component, OnInit, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/api/auth.service';
import { TelegramApiService } from '../../../core/api/telegram.service';
import { InstrumentService } from '../../../core/api/instrument.service';
import { FirestoreApiService } from '../../../core/api/firestore.service';
import { AudioChimeService } from '../../../core/services/audio-chime.service';
import { AlertService } from '../../../core/api/alert.service';
import { OrderService } from '../../../core/api/order.service';
import { TokenVerifyResult } from '../../../core/models/auth.models';
import { IndexConfigItem } from '../../../core/models/instrument.models';
import { IstDatePipe } from '../../../shared/pipes/ist-date.pipe';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    IstDatePipe,
  ],
  template: `
    <div class="settings-page-root">
      <!-- MAIN PAGE CONTENT -->
      <main class="page-body">
        <!-- PAGE CONTROL HEADER -->
        <section class="control-header-card">
          <div class="title-group">
            <div class="breadcrumb">
              <a routerLink="/" class="bc-link">Dashboard</a>
              <span class="bc-sep">/</span>
              <span class="bc-current">Settings & Configuration</span>
            </div>
            <div class="page-title">
              <span class="material-symbols-rounded page-icon">settings</span>
              <span>Platform Settings & Engine Configuration</span>
            </div>
            <div class="page-subtitle">
              Manage Dhan HQ v2 JWT tokens, Telegram notifications, dynamic index lot sizes, and Google Cloud Firestore security master sync.
            </div>
          </div>

          <!-- Top Quick Status Ribbon -->
          <div class="quick-status-ribbon">
            <!-- Token Status Pill -->
            <div
              class="status-pill token-pill"
              [class.green]="authService.statusColor() === 'green'"
              [class.yellow]="authService.statusColor() === 'yellow'"
              [class.red]="authService.statusColor() === 'red'"
              matTooltip="Dhan HQ JWT Token Status"
            >
              <span class="material-symbols-rounded">timer</span>
              <span class="pill-text mono-val">Token: {{ authService.timeRemainingFormatted() }}</span>
            </div>

            <!-- Telegram Pill -->
            <div
              class="status-pill tg-pill"
              [class.active]="telegramService.status().configured"
              matTooltip="Telegram Bot Alerts Status"
            >
              <span class="material-symbols-rounded">send</span>
              <span class="pill-text">TG Bot: {{ telegramService.status().configured ? 'Connected' : 'Offline' }}</span>
            </div>

            <!-- Firestore Pill -->
            <div
              class="status-pill fs-pill"
              [class.active]="firestoreApi.status()?.configured"
              matTooltip="Google Cloud Firestore Database"
            >
              <span class="material-symbols-rounded">cloud_done</span>
              <span class="pill-text">Firestore: {{ firestoreApi.status()?.configured ? 'Connected' : 'Offline' }}</span>
            </div>

            <!-- Scrip Master Pill -->
            <div
              class="status-pill master-pill"
              [class.active]="instrumentService.syncStatus()?.storedInFirestore"
              matTooltip="NSE Security Master & Options in Firestore"
            >
              <span class="material-symbols-rounded">database</span>
              <span class="pill-text">
                Master: {{ instrumentService.syncStatus()?.metadata?.totalInstruments || 19390 }} NSE Instruments
              </span>
            </div>
          </div>
        </section>

        <!-- SETTINGS CARDS GRID / CONTAINER -->
        <div class="settings-container">
          <!-- SECTION 1: DHAN JWT TOKEN MANAGEMENT -->
          <section class="settings-section-card" id="token-section">
            <div class="section-header">
              <div class="section-title-wrap">
                <div class="icon-avatar token-avatar">
                  <span class="material-symbols-rounded">vpn_key</span>
                </div>
                <div>
                  <h2 class="section-heading">Dhan HQ API Token Lifecycle</h2>
                  <p class="section-subheading">Inspect active JWT claims, 1-click token renewal via Dhan API, or hot-reload new credentials</p>
                </div>
              </div>
              <div class="section-actions">
                <button
                  mat-stroked-button
                  class="action-btn"
                  (click)="authService.refreshStatus(true)"
                  matTooltip="Refresh token state from backend"
                >
                  <span class="material-symbols-rounded">refresh</span>
                  Refresh Status
                </button>
                <button
                  mat-stroked-button
                  class="action-btn"
                  (click)="verifyValidity()"
                  [disabled]="isVerifyingToken()"
                  matTooltip="Verify token live with Dhan HQ API"
                >
                  <span class="material-symbols-rounded" [class.spinning]="isVerifyingToken()">verified_user</span>
                  {{ isVerifyingToken() ? 'Verifying...' : 'Verify Live' }}
                </button>
                <button
                  mat-flat-button
                  color="primary"
                  class="action-btn-primary"
                  (click)="authService.renewToken()"
                  [disabled]="authService.isRenewing()"
                  matTooltip="Renew token using Dhan HQ API renew endpoint"
                >
                  <span class="material-symbols-rounded" [class.spinning]="authService.isRenewing()">autorenew</span>
                  {{ authService.isRenewing() ? 'Renewing...' : '1-Click Renew Token' }}
                </button>
              </div>
            </div>

            <!-- Token Details Grid -->
            <div class="token-details-grid" *ngIf="authService.tokenStatus() as token">
              <div class="detail-box">
                <div class="detail-label">Client ID</div>
                <div class="detail-val mono-val">{{ token.clientId || 'Not Set' }}</div>
              </div>
              <div class="detail-box">
                <div class="detail-label">Token Status</div>
                <div class="detail-val status-val" [class.green]="token.status === 'ACTIVE'" [class.yellow]="token.status === 'EXPIRING_SOON'" [class.red]="token.status === 'EXPIRED'">
                  <span class="pulse-dot"></span>
                  {{ token.statusText }}
                </div>
              </div>
              <div class="detail-box">
                <div class="detail-label">Time Remaining</div>
                <div class="detail-val mono-val countdown-val" [class.urgent]="authService.statusColor() === 'red'">
                  ⏱ {{ authService.timeRemainingFormatted() }}
                </div>
              </div>
              <div class="detail-box">
                <div class="detail-label">Masked Access Token</div>
                <div class="detail-val mono-val token-mask">{{ token.tokenMasked || 'None' }}</div>
              </div>
              <div class="detail-box">
                <div class="detail-label">Issued At (IST)</div>
                <div class="detail-val mono-val">{{ token.issuedAtIST || 'N/A' }}</div>
              </div>
              <div class="detail-box">
                <div class="detail-label">Expires At (IST)</div>
                <div class="detail-val mono-val">{{ token.expiresAtIST || 'N/A' }}</div>
              </div>
              <div class="detail-box" *ngIf="token.payload?.userName">
                <div class="detail-label">Account Holder</div>
                <div class="detail-val">{{ token.payload?.userName }}</div>
              </div>
            </div>

            <!-- Live Verification Result Alert -->
            <div class="verification-alert" *ngIf="verifyResult() as v" [class.success]="v.valid" [class.failed]="!v.valid">
              <span class="material-symbols-rounded alert-icon">{{ v.valid ? 'check_circle' : 'error' }}</span>
              <div class="alert-content">
                <div class="alert-title">{{ v.valid ? 'Token Valid & Connected to Dhan HQ v2' : 'Token Verification Failed' }}</div>
                <div class="alert-desc">{{ v.message }}</div>
                <div class="alert-meta mono-val" *ngIf="v.valid && (v.profile || v.inspection?.payload)">
                  User: {{ v.profile?.userName || v.profile?.name || v.inspection?.payload?.userName || 'Dhan Trader' }} &bull; Client ID: {{ v.profile?.clientId || v.profile?.dhanClientId || v.inspection?.clientId }} &bull; Profile Status: Active
                </div>
              </div>
            </div>

            <!-- Manual Token Hot-Reload Form -->
            <div class="inner-form-box">
              <h3 class="inner-form-title">
                <span class="material-symbols-rounded">edit_document</span>
                Manual Token Update (Hot-Reload)
              </h3>
              <p class="inner-form-desc">
                Paste a newly generated 24-hour Dhan Access Token from web.dhan.co. It will instantly hot-reload in memory and synchronize to Google Cloud Firestore (<code>config/dhan</code>).
              </p>

              <form (ngSubmit)="submitTokenUpdate()" class="token-form">
                <div class="form-row">
                  <mat-form-field appearance="outline" class="flex-field-1">
                    <mat-label>Dhan Client ID</mat-label>
                    <input
                      matInput
                      [(ngModel)]="clientIdInput"
                      name="clientId"
                      placeholder="e.g. 1106885516"
                      required
                    />
                  </mat-form-field>
                </div>

                <div class="form-row">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>New Dhan JWT Access Token</mat-label>
                    <textarea
                      matInput
                      rows="3"
                      [(ngModel)]="tokenInput"
                      name="accessToken"
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      required
                    ></textarea>
                  </mat-form-field>
                </div>

                <div class="form-actions-row">
                  <button
                    mat-flat-button
                    color="primary"
                    type="submit"
                    [disabled]="!tokenInput.trim() || isUpdatingToken()"
                  >
                    <span class="material-symbols-rounded">save</span>
                    {{ isUpdatingToken() ? 'Updating...' : 'Update & Hot-Reload Token' }}
                  </button>
                  <button
                    mat-button
                    type="button"
                    (click)="tokenInput = ''"
                    [disabled]="!tokenInput"
                  >
                    Clear Input
                  </button>
                </div>
              </form>
            </div>
          </section>

          <!-- SECTION 2: DYNAMIC INDEX LOT SIZE & DROPDOWN CONFIGURATION -->
          <section class="settings-section-card" id="lots-section">
            <div class="section-header">
              <div class="section-title-wrap">
                <div class="icon-avatar lots-avatar">
                  <span class="material-symbols-rounded">tune</span>
                </div>
                <div>
                  <h2 class="section-heading">Index Lot Size Configuration & Dropdown (Firestore-Driven)</h2>
                  <p class="section-subheading">
                    Input your order size in <strong>Lots</strong> (e.g. 5 lots) below — the order quantity (e.g. 325 Shares) will get configured automatically based on NSE contract lot multipliers. Manage which indices appear in the Conditional Alert Composer dropdown.
                  </p>
                </div>
              </div>
              <div class="section-actions">
                <button
                  mat-stroked-button
                  class="action-btn"
                  (click)="resetLotSizesToDefaults()"
                  [disabled]="instrumentService.isSavingLotSizes()"
                  matTooltip="Reset lot sizes and indices back to standard defaults"
                >
                  <span class="material-symbols-rounded">restore</span>
                  Reset Defaults
                </button>
                <button
                  mat-flat-button
                  color="primary"
                  class="action-btn-primary"
                  (click)="saveLotSizes()"
                  [disabled]="instrumentService.isSavingLotSizes()"
                  matTooltip="Save changes to Google Cloud Firestore database"
                >
                  <span class="material-symbols-rounded" [class.spinning]="instrumentService.isSavingLotSizes()">save</span>
                  {{ instrumentService.isSavingLotSizes() ? 'Saving...' : 'Save Configuration to Firestore' }}
                </button>
              </div>
            </div>

            <!-- Interactive Lot Size & Quantity Inputs Grid -->
            <div class="lot-sizes-inputs-grid">
              <!-- NIFTY 50 -->
              <div class="lot-card" [class.disabled-index]="!getIndexConfig('NIFTY 50')?.enabled">
                <div class="lot-card-header">
                  <div>
                    <div class="index-symbol">NIFTY 50</div>
                    <span class="index-badge">NSE Benchmark</span>
                  </div>
                  <label class="dropdown-toggle" matTooltip="Toggle whether NIFTY 50 appears in the Alert Composer dropdown">
                    <input
                      type="checkbox"
                      [checked]="getIndexConfig('NIFTY 50')?.enabled"
                      (change)="toggleIndexEnabled('NIFTY 50', $event)"
                    />
                    <span>Dropdown</span>
                  </label>
                </div>
                <div class="lot-inputs-dual-grid">
                  <div class="lot-input-wrapper">
                    <label class="lot-label">Quantity in 1 Lot:</label>
                    <div class="input-with-suffix">
                      <input
                        type="number"
                        min="1"
                        class="styled-number-input"
                        [(ngModel)]="qtyNifty50"
                        (ngModelChange)="onQtyChanged('NIFTY 50', qtyNifty50)"
                        placeholder="65"
                      />
                      <span class="input-suffix">Qty</span>
                    </div>
                  </div>
                  <div class="lot-input-wrapper">
                    <label class="lot-label">Preferred Lot Size:</label>
                    <div class="input-with-suffix">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        class="styled-number-input"
                        [(ngModel)]="lotNifty50"
                        (ngModelChange)="onLotsChanged('NIFTY 50', lotNifty50)"
                        placeholder="5"
                      />
                      <span class="input-suffix">Lots</span>
                    </div>
                  </div>
                </div>
                <!-- Dynamic Configured Quantity Banner -->
                <div class="configured-qty-box">
                  <span class="qty-sub">Configured Order Quantity:</span>
                  <span class="qty-main mono-val">{{ lotNifty50 * qtyNifty50 }} Shares</span>
                  <span class="qty-calc mono-val">({{ lotNifty50 }} lots &times; {{ qtyNifty50 }} qty/lot)</span>
                </div>
                <!-- Quick Lot Buttons -->
                <div class="quick-lot-pills">
                  <button type="button" class="quick-pill" [class.active]="lotNifty50 === 5" (click)="lotNifty50 = 5; onLotsChanged('NIFTY 50', 5)">5 Lots ({{ 5 * qtyNifty50 }})</button>
                  <button type="button" class="quick-pill" [class.active]="lotNifty50 === 10" (click)="lotNifty50 = 10; onLotsChanged('NIFTY 50', 10)">10 Lots ({{ 10 * qtyNifty50 }})</button>
                  <button type="button" class="quick-pill" [class.active]="lotNifty50 === 15" (click)="lotNifty50 = 15; onLotsChanged('NIFTY 50', 15)">15 Lots ({{ 15 * qtyNifty50 }})</button>
                </div>
              </div>

              <!-- BANK NIFTY -->
              <div class="lot-card" [class.disabled-index]="!getIndexConfig('BANK NIFTY')?.enabled">
                <div class="lot-card-header">
                  <div>
                    <div class="index-symbol">BANK NIFTY</div>
                    <span class="index-badge">NSE Sectoral</span>
                  </div>
                  <label class="dropdown-toggle" matTooltip="Toggle whether BANK NIFTY appears in the Alert Composer dropdown">
                    <input
                      type="checkbox"
                      [checked]="getIndexConfig('BANK NIFTY')?.enabled"
                      (change)="toggleIndexEnabled('BANK NIFTY', $event)"
                    />
                    <span>Dropdown</span>
                  </label>
                </div>
                <div class="lot-inputs-dual-grid">
                  <div class="lot-input-wrapper">
                    <label class="lot-label">Quantity in 1 Lot:</label>
                    <div class="input-with-suffix">
                      <input
                        type="number"
                        min="1"
                        class="styled-number-input"
                        [(ngModel)]="qtyBankNifty"
                        (ngModelChange)="onQtyChanged('BANK NIFTY', qtyBankNifty)"
                        placeholder="30"
                      />
                      <span class="input-suffix">Qty</span>
                    </div>
                  </div>
                  <div class="lot-input-wrapper">
                    <label class="lot-label">Preferred Lot Size:</label>
                    <div class="input-with-suffix">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        class="styled-number-input"
                        [(ngModel)]="lotBankNifty"
                        (ngModelChange)="onLotsChanged('BANK NIFTY', lotBankNifty)"
                        placeholder="5"
                      />
                      <span class="input-suffix">Lots</span>
                    </div>
                  </div>
                </div>
                <div class="configured-qty-box">
                  <span class="qty-sub">Configured Order Quantity:</span>
                  <span class="qty-main mono-val">{{ lotBankNifty * qtyBankNifty }} Shares</span>
                  <span class="qty-calc mono-val">({{ lotBankNifty }} lots &times; {{ qtyBankNifty }} qty/lot)</span>
                </div>
                <div class="quick-lot-pills">
                  <button type="button" class="quick-pill" [class.active]="lotBankNifty === 5" (click)="lotBankNifty = 5; onLotsChanged('BANK NIFTY', 5)">5 Lots ({{ 5 * qtyBankNifty }})</button>
                  <button type="button" class="quick-pill" [class.active]="lotBankNifty === 10" (click)="lotBankNifty = 10; onLotsChanged('BANK NIFTY', 10)">10 Lots ({{ 10 * qtyBankNifty }})</button>
                  <button type="button" class="quick-pill" [class.active]="lotBankNifty === 15" (click)="lotBankNifty = 15; onLotsChanged('BANK NIFTY', 15)">15 Lots ({{ 15 * qtyBankNifty }})</button>
                </div>
              </div>

              <!-- FINNIFTY -->
              <div class="lot-card" [class.disabled-index]="!getIndexConfig('FINNIFTY')?.enabled">
                <div class="lot-card-header">
                  <div>
                    <div class="index-symbol">FINNIFTY</div>
                    <span class="index-badge">Financial Services</span>
                  </div>
                  <label class="dropdown-toggle" matTooltip="Toggle whether FINNIFTY appears in the Alert Composer dropdown">
                    <input
                      type="checkbox"
                      [checked]="getIndexConfig('FINNIFTY')?.enabled"
                      (change)="toggleIndexEnabled('FINNIFTY', $event)"
                    />
                    <span>Dropdown</span>
                  </label>
                </div>
                <div class="lot-inputs-dual-grid">
                  <div class="lot-input-wrapper">
                    <label class="lot-label">Quantity in 1 Lot:</label>
                    <div class="input-with-suffix">
                      <input
                        type="number"
                        min="1"
                        class="styled-number-input"
                        [(ngModel)]="qtyFinNifty"
                        (ngModelChange)="onQtyChanged('FINNIFTY', qtyFinNifty)"
                        placeholder="65"
                      />
                      <span class="input-suffix">Qty</span>
                    </div>
                  </div>
                  <div class="lot-input-wrapper">
                    <label class="lot-label">Preferred Lot Size:</label>
                    <div class="input-with-suffix">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        class="styled-number-input"
                        [(ngModel)]="lotFinNifty"
                        (ngModelChange)="onLotsChanged('FINNIFTY', lotFinNifty)"
                        placeholder="5"
                      />
                      <span class="input-suffix">Lots</span>
                    </div>
                  </div>
                </div>
                <div class="configured-qty-box">
                  <span class="qty-sub">Configured Order Quantity:</span>
                  <span class="qty-main mono-val">{{ lotFinNifty * qtyFinNifty }} Shares</span>
                  <span class="qty-calc mono-val">({{ lotFinNifty }} lots &times; {{ qtyFinNifty }} qty/lot)</span>
                </div>
                <div class="quick-lot-pills">
                  <button type="button" class="quick-pill" [class.active]="lotFinNifty === 5" (click)="lotFinNifty = 5; onLotsChanged('FINNIFTY', 5)">5 Lots ({{ 5 * qtyFinNifty }})</button>
                  <button type="button" class="quick-pill" [class.active]="lotFinNifty === 10" (click)="lotFinNifty = 10; onLotsChanged('FINNIFTY', 10)">10 Lots ({{ 10 * qtyFinNifty }})</button>
                  <button type="button" class="quick-pill" [class.active]="lotFinNifty === 15" (click)="lotFinNifty = 15; onLotsChanged('FINNIFTY', 15)">15 Lots ({{ 15 * qtyFinNifty }})</button>
                </div>
              </div>

              <!-- MIDCAP NIFTY -->
              <div class="lot-card" [class.disabled-index]="!getIndexConfig('MIDCAP NIFTY')?.enabled">
                <div class="lot-card-header">
                  <div>
                    <div class="index-symbol">MIDCAP NIFTY</div>
                    <span class="index-badge">Midcap Select</span>
                  </div>
                  <label class="dropdown-toggle" matTooltip="Toggle whether MIDCAP NIFTY appears in the Alert Composer dropdown">
                    <input
                      type="checkbox"
                      [checked]="getIndexConfig('MIDCAP NIFTY')?.enabled"
                      (change)="toggleIndexEnabled('MIDCAP NIFTY', $event)"
                    />
                    <span>Dropdown</span>
                  </label>
                </div>
                <div class="lot-inputs-dual-grid">
                  <div class="lot-input-wrapper">
                    <label class="lot-label">Quantity in 1 Lot:</label>
                    <div class="input-with-suffix">
                      <input
                        type="number"
                        min="1"
                        class="styled-number-input"
                        [(ngModel)]="qtyMidcapNifty"
                        (ngModelChange)="onQtyChanged('MIDCAP NIFTY', qtyMidcapNifty)"
                        placeholder="120"
                      />
                      <span class="input-suffix">Qty</span>
                    </div>
                  </div>
                  <div class="lot-input-wrapper">
                    <label class="lot-label">Preferred Lot Size:</label>
                    <div class="input-with-suffix">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        class="styled-number-input"
                        [(ngModel)]="lotMidcapNifty"
                        (ngModelChange)="onLotsChanged('MIDCAP NIFTY', lotMidcapNifty)"
                        placeholder="5"
                      />
                      <span class="input-suffix">Lots</span>
                    </div>
                  </div>
                </div>
                <div class="configured-qty-box">
                  <span class="qty-sub">Configured Order Quantity:</span>
                  <span class="qty-main mono-val">{{ lotMidcapNifty * qtyMidcapNifty }} Shares</span>
                  <span class="qty-calc mono-val">({{ lotMidcapNifty }} lots &times; {{ qtyMidcapNifty }} qty/lot)</span>
                </div>
                <div class="quick-lot-pills">
                  <button type="button" class="quick-pill" [class.active]="lotMidcapNifty === 5" (click)="lotMidcapNifty = 5; onLotsChanged('MIDCAP NIFTY', 5)">5 Lots ({{ 5 * qtyMidcapNifty }})</button>
                  <button type="button" class="quick-pill" [class.active]="lotMidcapNifty === 10" (click)="lotMidcapNifty = 10; onLotsChanged('MIDCAP NIFTY', 10)">10 Lots ({{ 10 * qtyMidcapNifty }})</button>
                  <button type="button" class="quick-pill" [class.active]="lotMidcapNifty === 15" (click)="lotMidcapNifty = 15; onLotsChanged('MIDCAP NIFTY', 15)">15 Lots ({{ 15 * qtyMidcapNifty }})</button>
                </div>
              </div>

              <!-- SENSEX -->
              <div class="lot-card" [class.disabled-index]="!getIndexConfig('SENSEX')?.enabled">
                <div class="lot-card-header">
                  <div>
                    <div class="index-symbol">SENSEX</div>
                    <span class="index-badge">BSE Benchmark</span>
                  </div>
                  <label class="dropdown-toggle" matTooltip="Toggle whether SENSEX appears in the Alert Composer dropdown">
                    <input
                      type="checkbox"
                      [checked]="getIndexConfig('SENSEX')?.enabled"
                      (change)="toggleIndexEnabled('SENSEX', $event)"
                    />
                    <span>Dropdown</span>
                  </label>
                </div>
                <div class="lot-inputs-dual-grid">
                  <div class="lot-input-wrapper">
                    <label class="lot-label">Quantity in 1 Lot:</label>
                    <div class="input-with-suffix">
                      <input
                        type="number"
                        min="1"
                        class="styled-number-input"
                        [(ngModel)]="qtySensex"
                        (ngModelChange)="onQtyChanged('SENSEX', qtySensex)"
                        placeholder="20"
                      />
                      <span class="input-suffix">Qty</span>
                    </div>
                  </div>
                  <div class="lot-input-wrapper">
                    <label class="lot-label">Preferred Lot Size:</label>
                    <div class="input-with-suffix">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        class="styled-number-input"
                        [(ngModel)]="lotSensex"
                        (ngModelChange)="onLotsChanged('SENSEX', lotSensex)"
                        placeholder="5"
                      />
                      <span class="input-suffix">Lots</span>
                    </div>
                  </div>
                </div>
                <div class="configured-qty-box">
                  <span class="qty-sub">Configured Order Quantity:</span>
                  <span class="qty-main mono-val">{{ lotSensex * qtySensex }} Shares</span>
                  <span class="qty-calc mono-val">({{ lotSensex }} lots &times; {{ qtySensex }} qty/lot)</span>
                </div>
                <div class="quick-lot-pills">
                  <button type="button" class="quick-pill" [class.active]="lotSensex === 5" (click)="lotSensex = 5; onLotsChanged('SENSEX', 5)">5 Lots ({{ 5 * qtySensex }})</button>
                  <button type="button" class="quick-pill" [class.active]="lotSensex === 10" (click)="lotSensex = 10; onLotsChanged('SENSEX', 10)">10 Lots ({{ 10 * qtySensex }})</button>
                  <button type="button" class="quick-pill" [class.active]="lotSensex === 15" (click)="lotSensex = 15; onLotsChanged('SENSEX', 15)">15 Lots ({{ 15 * qtySensex }})</button>
                </div>
              </div>
            </div>

            <div class="lot-footer-note" *ngIf="instrumentService.lotSizes().updatedAt">
              <span class="material-symbols-rounded">schedule</span>
              <span>Last configured in Firestore: {{ instrumentService.lotSizes().updatedAt | istDate : 'full' }}</span>
            </div>
          </section>

          <!-- SECTION 3: TELEGRAM BOT & NOTIFICATION BRIDGE -->
          <section class="settings-section-card" id="telegram-section">
            <div class="section-header">
              <div class="section-title-wrap">
                <div class="icon-avatar tg-avatar">
                  <span class="material-symbols-rounded">send</span>
                </div>
                <div>
                  <h2 class="section-heading">Telegram Bot & Notifications Bridge</h2>
                  <p class="section-subheading">Instant HTML formatted alerts dispatched to your private Telegram chat or channel</p>
                </div>
              </div>
              <div class="section-actions">
                <button
                  mat-stroked-button
                  class="action-btn"
                  (click)="telegramService.sendTest()"
                  [disabled]="!telegramService.status().configured || telegramService.isTesting()"
                  matTooltip="Dispatch a live test notification to verify delivery"
                >
                  <span class="material-symbols-rounded" [class.spinning]="telegramService.isTesting()">notifications_active</span>
                  {{ telegramService.isTesting() ? 'Sending Test...' : 'Send Test Notification' }}
                </button>
              </div>
            </div>

            <!-- Telegram Status Overview -->
            <div class="tg-status-row" *ngIf="telegramService.status() as tg">
              <div class="tg-status-box">
                <span class="label">Bridge Status</span>
                <div class="val-with-dot" [class.online]="tg.configured" [class.offline]="!tg.configured">
                  <span class="pulse-dot"></span>
                  {{ tg.configured ? 'Connected & Active' : 'Not Configured' }}
                </div>
              </div>
              <div class="tg-status-box">
                <span class="label">Destination Chat ID</span>
                <span class="val mono-val">{{ tg.chatId || 'Not Set' }}</span>
              </div>
              <div class="tg-status-box">
                <span class="label">Bot Token</span>
                <span class="val mono-val">{{ tg.botConfigured ? 'Configured (Active)' : 'Missing' }}</span>
              </div>
            </div>

            <!-- Update Telegram Form -->
            <div class="inner-form-box">
              <h3 class="inner-form-title">
                <span class="material-symbols-rounded">smart_toy</span>
                Update Bot Credentials
              </h3>
              <p class="inner-form-desc">
                Obtain your Bot Token from <strong>&#64;BotFather</strong> on Telegram, and find your Chat ID from <strong>&#64;userinfobot</strong> or channel username.
              </p>

              <form (ngSubmit)="submitTelegramUpdate()" class="telegram-form">
                <div class="form-row-2">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Telegram Bot Token</mat-label>
                    <input
                      matInput
                      [(ngModel)]="tgBotTokenInput"
                      name="botToken"
                      placeholder="123456789:ABCdefGhIjk..."
                      required
                    />
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Telegram Chat ID</mat-label>
                    <input
                      matInput
                      [(ngModel)]="tgChatIdInput"
                      name="chatId"
                      placeholder="e.g. 8953936469"
                      required
                    />
                  </mat-form-field>
                </div>

                <div class="form-actions-row">
                  <button
                    mat-flat-button
                    color="primary"
                    type="submit"
                    [disabled]="!tgBotTokenInput.trim() || !tgChatIdInput.trim() || isUpdatingTg()"
                  >
                    <span class="material-symbols-rounded">save</span>
                    {{ isUpdatingTg() ? 'Saving...' : 'Save Telegram Settings' }}
                  </button>
                </div>
              </form>
            </div>
          </section>

          <!-- SECTION 4: NSE SECURITY MASTER & FIRESTORE SYNC -->
          <section class="settings-section-card" id="scrip-section">
            <div class="section-header">
              <div class="section-title-wrap">
                <div class="icon-avatar master-avatar">
                  <span class="material-symbols-rounded">sync_alt</span>
                </div>
                <div>
                  <h2 class="section-heading">NSE Security Master & Firestore Sync</h2>
                  <p class="section-subheading">
                    Collection <code>sec_id_to_name_mapping</code> stored across modular documents by instrument with strictly zero BSE clutter
                  </p>
                </div>
              </div>
              <div class="section-actions">
                <button
                  mat-flat-button
                  color="primary"
                  class="action-btn-primary"
                  (click)="instrumentService.syncMaster().subscribe()"
                  [disabled]="instrumentService.isSyncing()"
                  matTooltip="Synchronize security master & options into Firestore collection sec_id_to_name_mapping"
                >
                  <span class="material-symbols-rounded" [class.spinning]="instrumentService.isSyncing()">cloud_sync</span>
                  {{ instrumentService.isSyncing() ? 'Syncing...' : 'Sync Master to Firestore' }}
                </button>
              </div>
            </div>

            <!-- Master Stats Grid -->
            <div class="master-stats-grid" *ngIf="instrumentService.syncStatus()?.metadata as meta">
              <div class="stat-card">
                <div class="stat-val mono-val">{{ meta.totalInstruments | number }}</div>
                <div class="stat-lbl">Total NSE Instruments</div>
              </div>
              <div class="stat-card">
                <div class="stat-val mono-val">{{ meta.totalOptions | number }}</div>
                <div class="stat-lbl">Index Options (NSE_FNO)</div>
              </div>
              <div class="stat-card">
                <div class="stat-val mono-val">{{ meta.totalIndices | number }}</div>
                <div class="stat-lbl">Benchmark Indices (IDX_I)</div>
              </div>
              <div class="stat-card">
                <div class="stat-val mono-val">{{ meta.totalEquities | number }}</div>
                <div class="stat-lbl">Cash Equities (NSE_EQ)</div>
              </div>
              <div class="stat-card">
                <div class="stat-val mono-val">{{ meta.documentsCount || 12 }}</div>
                <div class="stat-lbl">Modular Documents</div>
              </div>
            </div>

            <!-- Document Breakdown Chips -->
            <div class="documents-breakdown-box" *ngIf="instrumentService.syncStatus()?.metadata as meta">
              <div class="breakdown-title">Modular Firestore Documents:</div>
              <div class="doc-chips">
                <span class="doc-chip" *ngFor="let docId of meta.documentIds">
                  <span class="material-symbols-rounded">article</span>
                  {{ docId }}
                </span>
              </div>
              <div class="sync-timestamp" *ngIf="meta.updatedAt">
                Last synchronized: {{ meta.updatedAt | istDate : 'full' }}
              </div>
            </div>

            <!-- Scrip Master CSV Upload / Paste Area -->
            <div class="inner-form-box">
              <h3 class="inner-form-title">
                <span class="material-symbols-rounded">upload_file</span>
                Upload & Sync Official CSV Master
              </h3>
              <p class="inner-form-desc">
                Upload or paste Dhan's official <code>api-scrip-master.csv</code>. The engine automatically parses it, extracts strictly NSE instruments, and saves to Firestore.
              </p>

              <div class="csv-upload-box">
                <div class="file-picker-line">
                  <input
                    type="file"
                    #csvFileInput
                    accept=".csv,.txt"
                    (change)="onFileSelected($event)"
                    style="display: none"
                  />
                  <button mat-stroked-button (click)="csvFileInput.click()" type="button">
                    <span class="material-symbols-rounded">folder_open</span>
                    Choose CSV File
                  </button>
                  <span class="file-name" *ngIf="selectedFileName">{{ selectedFileName }}</span>
                </div>

                <mat-form-field appearance="outline" class="full-width csv-textarea-field">
                  <mat-label>Or Paste Raw CSV Content</mat-label>
                  <textarea
                    matInput
                    rows="4"
                    [(ngModel)]="csvTextInput"
                    name="csvContent"
                    placeholder="SEM_EXM_EXCH_ID,SEM_SEGMENT,SEM_SMST_SECURITY_ID,SEM_INSTRUMENT_NAME,SEM_TRADING_SYMBOL..."
                  ></textarea>
                </mat-form-field>

                <div class="form-actions-row">
                  <button
                    mat-flat-button
                    color="primary"
                    type="button"
                    (click)="submitCsvSync()"
                    [disabled]="!csvTextInput.trim() || instrumentService.isSyncing()"
                  >
                    <span class="material-symbols-rounded" [class.spinning]="instrumentService.isSyncing()">publish</span>
                    {{ instrumentService.isSyncing() ? 'Uploading & Syncing...' : 'Upload & Sync CSV to Firestore' }}
                  </button>
                  <button
                    mat-button
                    type="button"
                    (click)="csvTextInput = ''; selectedFileName = ''"
                    [disabled]="!csvTextInput"
                  >
                    Clear CSV
                  </button>
                </div>
              </div>
            </div>
          </section>

          <!-- SECTION 5: GOOGLE CLOUD FIRESTORE DIAGNOSTICS -->
          <section class="settings-section-card" id="firestore-section">
            <div class="section-header">
              <div class="section-title-wrap">
                <div class="icon-avatar fs-avatar">
                  <span class="material-symbols-rounded">cloud</span>
                </div>
                <div>
                  <h2 class="section-heading">Google Cloud Firestore Infrastructure</h2>
                  <p class="section-subheading">Enterprise serverless database persistence for security master, Dhan token, and configuration</p>
                </div>
              </div>
              <div class="section-actions">
                <button
                  mat-stroked-button
                  class="action-btn"
                  (click)="firestoreApi.testConnection().subscribe()"
                  [disabled]="firestoreApi.isTesting()"
                  matTooltip="Test live latency and connectivity to Google Cloud Firestore"
                >
                  <span class="material-symbols-rounded" [class.spinning]="firestoreApi.isTesting()">speed</span>
                  {{ firestoreApi.isTesting() ? 'Testing...' : 'Test Connection' }}
                </button>
              </div>
            </div>

            <!-- Firestore Status Info Grid -->
            <div class="fs-status-grid" *ngIf="firestoreApi.status() as fs">
              <div class="fs-item">
                <div class="fs-label">Project ID</div>
                <div class="fs-val mono-val">{{ fs.projectId }}</div>
              </div>
              <div class="fs-item">
                <div class="fs-label">Database ID</div>
                <div class="fs-val mono-val">{{ fs.databaseId }}</div>
              </div>
              <div class="fs-item">
                <div class="fs-label">Connection State</div>
                <div class="fs-val status-val" [class.green]="fs.configured">
                  <span class="pulse-dot"></span>
                  {{ fs.configured ? 'Ready & Operational' : 'Not Configured' }}
                </div>
              </div>
              <div class="fs-item" *ngIf="fs.clientEmail">
                <div class="fs-label">Service Account</div>
                <div class="fs-val mono-val truncate" [title]="fs.clientEmail">{{ fs.clientEmail }}</div>
              </div>
            </div>

            <!-- Last Test Result Box -->
            <div class="test-result-box" *ngIf="firestoreApi.lastTestResult() as t" [class.success]="t.success" [class.failure]="!t.success">
              <span class="material-symbols-rounded test-icon">{{ t.success ? 'cloud_done' : 'cloud_off' }}</span>
              <div class="test-text">
                <div class="test-title">{{ t.message }}</div>
                <div class="test-meta mono-val" *ngIf="t.latencyMs !== undefined">
                  Latency: <strong>{{ t.latencyMs }}ms</strong> &bull; Collections: {{ (t.collections || []).join(', ') }}
                </div>
              </div>
            </div>
          </section>

          <!-- SECTION 6: AUDIO CHIMES & SOUND PREFERENCES -->
          <section class="settings-section-card" id="sound-section">
            <div class="section-header">
              <div class="section-title-wrap">
                <div class="icon-avatar sound-avatar">
                  <span class="material-symbols-rounded">volume_up</span>
                </div>
                <div>
                  <h2 class="section-heading">Audio Chimes & Alert Sounds</h2>
                  <p class="section-subheading">Audible cues for price alert trigger events, stop loss hits, and order executions</p>
                </div>
              </div>
              <div class="section-actions">
                <button
                  mat-stroked-button
                  class="action-btn"
                  (click)="alertService.testChime()"
                  matTooltip="Play instant test audio chime"
                >
                  <span class="material-symbols-rounded">notifications_active</span>
                  Test Sound
                </button>
              </div>
            </div>

            <div class="sound-toggle-row">
              <div class="sound-info">
                <div class="sound-title">Browser Synthesized Audio Chime</div>
                <div class="sound-desc">
                  Plays a high-frequency ascending chime when a price alert triggers or an automated order fills.
                </div>
              </div>
              <button
                mat-flat-button
                [color]="audioChime.soundEnabled() ? 'primary' : 'warn'"
                (click)="audioChime.toggleSound()"
              >
                <span class="material-symbols-rounded">{{ audioChime.soundEnabled() ? 'volume_up' : 'volume_off' }}</span>
                {{ audioChime.soundEnabled() ? 'Audio Enabled' : 'Audio Muted' }}
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  `,
  styles: [
    `
      .settings-page-root {
        display: flex;
        flex-direction: column;
        min-height: 100%;
        background-color: var(--bg-primary);
        color: var(--text-primary);
      }

      .page-body {
        flex: 1;
        padding: 20px 24px 60px;
        max-width: 1360px;
        margin: 0 auto;
        width: 100%;
        box-sizing: border-box;
      }

      /* Control Header Card */
      .control-header-card {
        background: linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%);
        border: 1px solid var(--border-subtle);
        border-radius: 12px;
        padding: 20px 24px;
        margin-bottom: 24px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .breadcrumb {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.8rem;
        color: var(--text-muted);
        margin-bottom: 6px;
      }

      .bc-link {
        color: var(--dhan-cyan);
        text-decoration: none;
        transition: opacity 0.15s;
      }

      .bc-link:hover {
        text-decoration: underline;
      }

      .bc-sep {
        color: var(--text-muted);
      }

      .bc-current {
        color: var(--text-secondary);
      }

      .page-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--text-primary);
        letter-spacing: -0.02em;
      }

      .page-icon {
        font-size: 28px;
        color: var(--dhan-cyan);
      }

      .page-subtitle {
        font-size: 0.875rem;
        color: var(--text-secondary);
        margin-top: 4px;
        line-height: 1.4;
      }

      /* Quick Status Ribbon */
      .quick-status-ribbon {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        padding-top: 12px;
        border-top: 1px solid var(--border-subtle);
      }

      .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 600;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid var(--border-subtle);
        color: var(--text-secondary);
      }

      .status-pill.token-pill.green {
        background: rgba(16, 185, 129, 0.12);
        border-color: rgba(16, 185, 129, 0.3);
        color: #10b981;
      }

      .status-pill.token-pill.yellow {
        background: rgba(245, 158, 11, 0.12);
        border-color: rgba(245, 158, 11, 0.3);
        color: #f59e0b;
      }

      .status-pill.token-pill.red {
        background: rgba(244, 63, 94, 0.12);
        border-color: rgba(244, 63, 94, 0.3);
        color: #f43f5e;
      }

      .status-pill.active {
        background: rgba(0, 210, 196, 0.1);
        border-color: rgba(0, 210, 196, 0.3);
        color: var(--dhan-cyan);
      }

      /* Settings Container & Section Cards */
      .settings-container {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      .settings-section-card {
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      }

      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        flex-wrap: wrap;
        gap: 16px;
        margin-bottom: 20px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--border-subtle);
      }

      .section-title-wrap {
        display: flex;
        align-items: flex-start;
        gap: 14px;
      }

      .icon-avatar {
        width: 44px;
        height: 44px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .token-avatar {
        background: rgba(99, 102, 241, 0.15);
        color: #818cf8;
      }

      .lots-avatar {
        background: rgba(0, 210, 196, 0.15);
        color: var(--dhan-cyan);
      }

      .tg-avatar {
        background: rgba(56, 189, 248, 0.15);
        color: #38bdf8;
      }

      .master-avatar {
        background: rgba(16, 185, 129, 0.15);
        color: #10b981;
      }

      .fs-avatar {
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
      }

      .sound-avatar {
        background: rgba(236, 72, 153, 0.15);
        color: #ec4899;
      }

      .section-heading {
        font-size: 1.15rem;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0 0 4px 0;
      }

      .section-subheading {
        font-size: 0.8rem;
        color: var(--text-secondary);
        margin: 0;
        line-height: 1.4;
      }

      .section-actions {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }

      .action-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.8rem;
      }

      .action-btn-primary {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.8rem;
        background-color: var(--dhan-cyan) !important;
        color: #0b0f19 !important;
        font-weight: 700;
      }

      /* Token Details Grid */
      .token-details-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 14px;
        margin-bottom: 20px;
      }

      .detail-box {
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        padding: 12px 14px;
      }

      .detail-label {
        font-size: 0.72rem;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin-bottom: 4px;
      }

      .detail-val {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--text-primary);
      }

      .status-val {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .status-val.green {
        color: #10b981;
      }

      .status-val.yellow {
        color: #f59e0b;
      }

      .status-val.red {
        color: #f43f5e;
      }

      .pulse-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: currentColor;
        box-shadow: 0 0 8px currentColor;
      }

      .countdown-val {
        color: var(--dhan-cyan);
      }

      .countdown-val.urgent {
        color: #f43f5e;
      }

      .token-mask {
        font-size: 0.75rem;
        color: var(--text-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* Verification Alert */
      .verification-alert {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 14px 16px;
        border-radius: 8px;
        margin-bottom: 20px;
      }

      .verification-alert.success {
        background: rgba(16, 185, 129, 0.1);
        border: 1px solid rgba(16, 185, 129, 0.3);
        color: #10b981;
      }

      .verification-alert.failed {
        background: rgba(244, 63, 94, 0.1);
        border: 1px solid rgba(244, 63, 94, 0.3);
        color: #f43f5e;
      }

      .alert-icon {
        font-size: 24px;
        flex-shrink: 0;
      }

      .alert-content {
        flex: 1;
      }

      .alert-title {
        font-weight: 700;
        font-size: 0.875rem;
        margin-bottom: 2px;
      }

      .alert-desc {
        font-size: 0.8rem;
        color: var(--text-secondary);
      }

      .alert-meta {
        font-size: 0.75rem;
        margin-top: 4px;
        color: var(--text-muted);
      }

      /* Inner Form Box */
      .inner-form-box {
        background: rgba(0, 0, 0, 0.2);
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        padding: 18px 20px;
        margin-top: 16px;
      }

      .inner-form-title {
        font-size: 0.95rem;
        font-weight: 700;
        color: var(--text-primary);
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 6px 0;
      }

      .inner-form-desc {
        font-size: 0.8rem;
        color: var(--text-secondary);
        margin: 0 0 16px 0;
        line-height: 1.4;
      }

      .inner-form-desc code {
        background: rgba(255, 255, 255, 0.06);
        padding: 2px 6px;
        border-radius: 4px;
        color: var(--dhan-cyan);
        font-family: var(--font-mono);
      }

      .form-row {
        margin-bottom: 12px;
      }

      .form-row-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }

      @media (max-width: 768px) {
        .form-row-2 {
          grid-template-columns: 1fr;
        }
      }

      .full-width {
        width: 100%;
      }

      .form-actions-row {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 8px;
      }

      /* Lot Sizes Grid */
      .lot-sizes-inputs-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 16px;
        margin-bottom: 16px;
      }

      .lot-inputs-dual-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }

      .lot-card {
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        border-radius: 10px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        transition: border-color 0.15s;
      }

      .lot-card:focus-within {
        border-color: var(--dhan-cyan);
      }

      .lot-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .index-symbol {
        font-weight: 700;
        font-size: 0.95rem;
        color: var(--text-primary);
      }

      .index-badge {
        font-size: 0.68rem;
        padding: 2px 8px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.06);
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .lot-input-wrapper {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .lot-label {
        font-size: 0.72rem;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .styled-number-input {
        background: var(--bg-surface);
        border: 1px solid var(--border-medium);
        border-radius: 6px;
        color: var(--text-primary);
        font-family: var(--font-mono);
        font-size: 1.15rem;
        font-weight: 700;
        padding: 8px 12px;
        outline: none;
        width: 100%;
        box-sizing: border-box;
        transition: border-color 0.15s, box-shadow 0.15s;
      }

      .styled-number-input:focus {
        border-color: var(--dhan-cyan);
        box-shadow: 0 0 0 2px rgba(0, 210, 196, 0.2);
      }

      .input-with-suffix {
        position: relative;
        display: flex;
        align-items: center;
      }

      .input-with-suffix .styled-number-input {
        padding-right: 50px;
      }

      .input-suffix {
        position: absolute;
        right: 12px;
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        pointer-events: none;
      }

      .dropdown-toggle {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.72rem;
        font-weight: 600;
        color: var(--dhan-cyan);
        cursor: pointer;
        user-select: none;
      }

      .dropdown-toggle input[type="checkbox"] {
        accent-color: var(--dhan-cyan);
        cursor: pointer;
      }

      .disabled-index {
        opacity: 0.65;
        border-style: dashed;
      }

      .configured-qty-box {
        background: rgba(0, 210, 196, 0.08);
        border: 1px solid rgba(0, 210, 196, 0.25);
        border-radius: 8px;
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        gap: 3px;
        text-align: center;
      }

      .qty-sub {
        font-size: 0.68rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-muted);
      }

      .qty-main {
        font-size: 1.15rem;
        font-weight: 800;
        color: var(--dhan-cyan);
      }

      .qty-calc {
        font-size: 0.7rem;
        color: var(--text-secondary);
      }

      .quick-lot-pills {
        display: flex;
        gap: 6px;
      }

      .quick-pill {
        flex: 1;
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 6px;
        color: var(--text-secondary);
        font-size: 0.72rem;
        font-weight: 600;
        padding: 5px 4px;
        cursor: pointer;
        transition: all 0.15s ease;
        text-align: center;
      }

      .quick-pill:hover {
        border-color: var(--dhan-cyan);
        color: var(--dhan-cyan);
      }

      .quick-pill.active {
        background: rgba(0, 210, 196, 0.15);
        border-color: var(--dhan-cyan);
        color: var(--dhan-cyan);
      }

      .lot-calculations {
        background: rgba(0, 0, 0, 0.2);
        border-radius: 6px;
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .calc-row {
        display: flex;
        justify-content: space-between;
        font-size: 0.75rem;
        color: var(--text-secondary);
      }

      .calc-row strong {
        color: var(--dhan-cyan);
        font-family: var(--font-mono);
      }

      .lot-footer-note {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.75rem;
        color: var(--text-muted);
        margin-top: 8px;
      }

      /* Telegram Status Row */
      .tg-status-row {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 14px;
        margin-bottom: 20px;
      }

      .tg-status-box {
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        padding: 12px 14px;
      }

      .val-with-dot {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-weight: 600;
        font-size: 0.875rem;
      }

      .val-with-dot.online {
        color: #10b981;
      }

      .val-with-dot.offline {
        color: #f43f5e;
      }

      /* Master Stats Grid */
      .master-stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 14px;
        margin-bottom: 16px;
      }

      .stat-card {
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        padding: 14px;
        text-align: center;
      }

      .stat-val {
        font-size: 1.35rem;
        font-weight: 700;
        color: var(--dhan-cyan);
        margin-bottom: 4px;
      }

      .stat-lbl {
        font-size: 0.72rem;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .documents-breakdown-box {
        background: rgba(0, 0, 0, 0.2);
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        padding: 14px;
        margin-bottom: 20px;
      }

      .breakdown-title {
        font-size: 0.75rem;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin-bottom: 8px;
      }

      .doc-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 8px;
      }

      .doc-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        border-radius: 6px;
        padding: 4px 8px;
        font-size: 0.72rem;
        font-family: var(--font-mono);
        color: var(--text-secondary);
      }

      .sync-timestamp {
        font-size: 0.72rem;
        color: var(--text-muted);
      }

      .file-picker-line {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }

      .file-name {
        font-size: 0.8rem;
        color: var(--dhan-cyan);
        font-family: var(--font-mono);
      }

      /* Firestore Grid */
      .fs-status-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 14px;
        margin-bottom: 16px;
      }

      .fs-item {
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        padding: 12px 14px;
      }

      .fs-label {
        font-size: 0.72rem;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin-bottom: 4px;
      }

      .fs-val {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--text-primary);
      }

      .truncate {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .test-result-box {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        border-radius: 8px;
      }

      .test-result-box.success {
        background: rgba(16, 185, 129, 0.1);
        border: 1px solid rgba(16, 185, 129, 0.3);
        color: #10b981;
      }

      .test-result-box.failure {
        background: rgba(244, 63, 94, 0.1);
        border: 1px solid rgba(244, 63, 94, 0.3);
        color: #f43f5e;
      }

      .test-icon {
        font-size: 24px;
        flex-shrink: 0;
      }

      .test-title {
        font-weight: 700;
        font-size: 0.875rem;
      }

      .test-meta {
        font-size: 0.75rem;
        color: var(--text-secondary);
        margin-top: 2px;
      }

      /* Sound Row */
      .sound-toggle-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        padding: 16px;
      }

      .sound-title {
        font-weight: 700;
        font-size: 0.95rem;
        color: var(--text-primary);
        margin-bottom: 4px;
      }

      .sound-desc {
        font-size: 0.8rem;
        color: var(--text-secondary);
      }

      .spinning {
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        100% {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class SettingsPageComponent implements OnInit {
  readonly authService = inject(AuthService);
  readonly telegramService = inject(TelegramApiService);
  readonly instrumentService = inject(InstrumentService);
  readonly firestoreApi = inject(FirestoreApiService);
  readonly audioChime = inject(AudioChimeService);
  readonly alertService = inject(AlertService);
  readonly orderService = inject(OrderService);
  private readonly snackBar = inject(MatSnackBar);

  // Token Update Form
  clientIdInput = '';
  tokenInput = '';
  readonly isUpdatingToken = signal(false);
  readonly isVerifyingToken = signal(false);
  readonly verifyResult = signal<TokenVerifyResult | null>(null);

  // Telegram Update Form
  tgBotTokenInput = '';
  tgChatIdInput = '';
  readonly isUpdatingTg = signal(false);

  // Quantities in 1 lot (e.g. 65 shares/lot)
  qtyNifty50 = 65;
  qtyBankNifty = 30;
  qtyFinNifty = 65;
  qtyMidcapNifty = 120;
  qtySensex = 20;

  // Preferred lot sizes (number of LOTS!)
  lotNifty50 = 5;
  lotBankNifty = 5;
  lotFinNifty = 5;
  lotMidcapNifty = 5;
  lotSensex = 5;
  indicesList: IndexConfigItem[] = [];

  // CSV sync
  csvTextInput = '';
  selectedFileName = '';

  constructor() {
    // Synchronize inputs when lot sizes signal changes
    effect(() => {
      const cfg = this.instrumentService.lotSizes();
      if (cfg) {
        const nItem = cfg.indices?.find((i) => i.symbol.toUpperCase().includes('NIFTY 50'));
        const bItem = cfg.indices?.find((i) => i.symbol.toUpperCase().includes('BANK'));
        const fItem = cfg.indices?.find((i) => i.symbol.toUpperCase().includes('FIN'));
        const mItem = cfg.indices?.find((i) => i.symbol.toUpperCase().includes('MIDCAP') || i.symbol.toUpperCase().includes('MIDCP'));
        const sItem = cfg.indices?.find((i) => i.symbol.toUpperCase().includes('SENSEX'));

        this.qtyNifty50 = nItem?.defaultQuantityInOneLot || nItem?.lotSize || cfg.nifty50 || 65;
        this.qtyBankNifty = bItem?.defaultQuantityInOneLot || bItem?.lotSize || cfg.bankNifty || 30;
        this.qtyFinNifty = fItem?.defaultQuantityInOneLot || fItem?.lotSize || cfg.finNifty || 65;
        this.qtyMidcapNifty = mItem?.defaultQuantityInOneLot || mItem?.lotSize || cfg.midcapNifty || 120;
        this.qtySensex = sItem?.defaultQuantityInOneLot || sItem?.lotSize || cfg.sensex || 20;

        this.lotNifty50 = nItem?.defaultLotSize || nItem?.defaultLots || cfg.nifty50Lots || 5;
        this.lotBankNifty = bItem?.defaultLotSize || bItem?.defaultLots || cfg.bankNiftyLots || 5;
        this.lotFinNifty = fItem?.defaultLotSize || fItem?.defaultLots || cfg.finNiftyLots || 5;
        this.lotMidcapNifty = mItem?.defaultLotSize || mItem?.defaultLots || cfg.midcapNiftyLots || 5;
        this.lotSensex = sItem?.defaultLotSize || sItem?.defaultLots || cfg.sensexLots || 5;

        if (cfg.indices && cfg.indices.length > 0) {
          this.indicesList = cfg.indices.map((i) => ({ ...i }));
        }
      }
    });

    // Populate Client ID from current token status
    effect(() => {
      const token = this.authService.tokenStatus();
      if (token?.clientId && !this.clientIdInput) {
        this.clientIdInput = token.clientId;
      }
    });

    // Populate Telegram inputs from status
    effect(() => {
      const tg = this.telegramService.status();
      if (tg?.chatId && tg.chatId !== 'Not Set' && !this.tgChatIdInput) {
        this.tgChatIdInput = tg.chatId;
      }
    });
  }

  getIndexConfig(symbol: string): IndexConfigItem | undefined {
    return this.indicesList.find((i) => i.symbol.toUpperCase() === symbol.toUpperCase());
  }

  toggleIndexEnabled(symbol: string, event: any): void {
    const idx = this.getIndexConfig(symbol);
    if (idx) {
      idx.enabled = event.target.checked;
    }
  }

  onQtyChanged(symbol: string, qty: number): void {
    const clean = Number(qty) || 1;
    const idx = this.getIndexConfig(symbol);
    if (idx) {
      idx.defaultQuantityInOneLot = clean;
      idx.lotSize = clean;
      const lots = idx.defaultLotSize ?? idx.defaultLots ?? 5;
      idx.defaultQuantity = lots * clean;
    }
  }

  onLotsChanged(symbol: string, lots: number): void {
    const clean = Number(lots) || 1;
    const idx = this.getIndexConfig(symbol);
    if (idx) {
      idx.defaultLotSize = clean;
      idx.defaultLots = clean;
      const qtyInOneLot = idx.defaultQuantityInOneLot ?? idx.lotSize ?? 1;
      idx.defaultQuantity = clean * qtyInOneLot;
    }
  }

  ngOnInit(): void {
    this.authService.refreshStatus();
    this.telegramService.refreshStatus();
    this.instrumentService.fetchSyncStatus().subscribe();
    this.instrumentService.fetchLotSizes().subscribe();
    this.instrumentService.fetchConfiguredIndices().subscribe();
    this.firestoreApi.refreshStatus().subscribe();
  }

  verifyValidity(): void {
    if (this.isVerifyingToken()) return;
    this.isVerifyingToken.set(true);
    this.authService.verifyToken().subscribe({
      next: (res) => {
        this.isVerifyingToken.set(false);
        this.verifyResult.set(res);
      },
      error: (err) => {
        this.isVerifyingToken.set(false);
        this.verifyResult.set({
          valid: false,
          message: err.error?.message || err.message || 'Live token verification failed',
        });
      },
    });
  }

  submitTokenUpdate(): void {
    const rawToken = this.tokenInput.trim();
    if (!rawToken) return;

    this.isUpdatingToken.set(true);
    this.authService
      .updateToken({
        token: rawToken,
        clientId: this.clientIdInput.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.isUpdatingToken.set(false);
          this.tokenInput = '';
          this.verifyResult.set(null);
        },
        error: (err) => {
          this.isUpdatingToken.set(false);
          this.snackBar.open(`Update failed: ${err.message}`, 'Dismiss', { duration: 5000 });
        },
      });
  }

  submitTelegramUpdate(): void {
    const token = this.tgBotTokenInput.trim();
    const chat = this.tgChatIdInput.trim();
    if (!token || !chat) return;

    this.isUpdatingTg.set(true);
    this.telegramService
      .updateCredentials({
        botToken: token,
        chatId: chat,
      })
      .subscribe({
        next: () => {
          this.isUpdatingTg.set(false);
          this.tgBotTokenInput = '';
        },
        error: (err) => {
          this.isUpdatingTg.set(false);
          this.snackBar.open(`Failed: ${err.message}`, 'Dismiss', { duration: 4000 });
        },
      });
  }

  saveLotSizes(): void {
    const nifty50Lots = Number(this.lotNifty50) || 5;
    const bankNiftyLots = Number(this.lotBankNifty) || 5;
    const finNiftyLots = Number(this.lotFinNifty) || 5;
    const midcapNiftyLots = Number(this.lotMidcapNifty) || 5;
    const sensexLots = Number(this.lotSensex) || 5;

    const nifty50Qty = Number(this.qtyNifty50) || 65;
    const bankNiftyQty = Number(this.qtyBankNifty) || 30;
    const finNiftyQty = Number(this.qtyFinNifty) || 65;
    const midcapNiftyQty = Number(this.qtyMidcapNifty) || 120;
    const sensexQty = Number(this.qtySensex) || 20;

    const updatedIndices: IndexConfigItem[] = this.indicesList.map((idx) => {
      const sym = idx.symbol.toUpperCase();
      let lots = idx.defaultLotSize || idx.defaultLots || 5;
      let qtyInOneLot = idx.defaultQuantityInOneLot || idx.lotSize || 1;

      if (sym.includes('BANK')) {
        lots = bankNiftyLots;
        qtyInOneLot = bankNiftyQty;
      } else if (sym.includes('FIN')) {
        lots = finNiftyLots;
        qtyInOneLot = finNiftyQty;
      } else if (sym.includes('MIDCAP') || sym.includes('MIDCP')) {
        lots = midcapNiftyLots;
        qtyInOneLot = midcapNiftyQty;
      } else if (sym.includes('SENSEX')) {
        lots = sensexLots;
        qtyInOneLot = sensexQty;
      } else if (sym.includes('NIFTY')) {
        lots = nifty50Lots;
        qtyInOneLot = nifty50Qty;
      }

      return {
        ...idx,
        defaultLotSize: lots,
        defaultQuantityInOneLot: qtyInOneLot,
        lotSize: qtyInOneLot,
        defaultLots: lots,
        defaultQuantity: lots * qtyInOneLot,
      };
    });

    this.instrumentService
      .updateLotSizes({
        indices: updatedIndices,
        nifty50: nifty50Qty,
        bankNifty: bankNiftyQty,
        finNifty: finNiftyQty,
        midcapNifty: midcapNiftyQty,
        sensex: sensexQty,
        nifty50Lots,
        bankNiftyLots,
        finNiftyLots,
        midcapNiftyLots,
        sensexLots,
      })
      .subscribe(() => {
        this.instrumentService.fetchConfiguredIndices().subscribe();
      });
  }

  resetLotSizesToDefaults(): void {
    this.instrumentService.resetLotSizes().subscribe(() => {
      this.qtyNifty50 = 65;
      this.qtyBankNifty = 30;
      this.qtyFinNifty = 65;
      this.qtyMidcapNifty = 120;
      this.qtySensex = 20;

      this.lotNifty50 = 5;
      this.lotBankNifty = 5;
      this.lotFinNifty = 5;
      this.lotMidcapNifty = 5;
      this.lotSensex = 5;
      this.instrumentService.fetchConfiguredIndices().subscribe();
    });
  }

  onFileSelected(event: any): void {
    const file = event.target?.files?.[0];
    if (!file) return;

    this.selectedFileName = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.csvTextInput = (e.target?.result as string) || '';
    };
    reader.readAsText(file);
  }

  submitCsvSync(): void {
    const content = this.csvTextInput.trim();
    if (!content) return;

    this.instrumentService.syncCsv(content).subscribe({
      next: (res) => {
        if (res?.success) {
          this.csvTextInput = '';
          this.selectedFileName = '';
        }
      },
    });
  }
}

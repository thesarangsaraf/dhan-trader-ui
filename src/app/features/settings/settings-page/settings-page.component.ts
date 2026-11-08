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
import { InstrumentService } from '../../../core/api/instrument.service';
import { FirestoreApiService } from '../../../core/api/firestore.service';
import { AlertService } from '../../../core/api/alert.service';
import { OrderService } from '../../../core/api/order.service';
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
              Manage Dhan HQ v2 JWT tokens, dynamic index lot sizes, and Google Cloud Firestore security master sync.
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
                    Configure your preferred order size in <strong>Lots</strong> and <strong>Quantity in 1 Lot</strong> below. Manage which indices appear in the Conditional Alert Composer dropdown.
                  </p>
                </div>
              </div>
              <div class="section-actions">
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
                        placeholder="Qty"
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
                        placeholder="Lots"
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
                        placeholder="Qty"
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
                        placeholder="Lots"
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
                        placeholder="Qty"
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
                        placeholder="Lots"
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
                        placeholder="Qty"
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
                        placeholder="Lots"
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

          <!-- SECTION 3: NSE SECURITY MASTER & FIRESTORE SYNC -->
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
          </section>

          <!-- SECTION 4: GOOGLE CLOUD FIRESTORE DIAGNOSTICS -->
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

      .master-avatar {
        background: rgba(16, 185, 129, 0.15);
        color: #10b981;
      }

      .fs-avatar {
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
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

      .lot-footer-note {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.75rem;
        color: var(--text-muted);
        margin-top: 8px;
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
  readonly instrumentService = inject(InstrumentService);
  readonly firestoreApi = inject(FirestoreApiService);
  readonly alertService = inject(AlertService);
  readonly orderService = inject(OrderService);
  private readonly snackBar = inject(MatSnackBar);

  // Token Update Form
  tokenInput = '';
  readonly isUpdatingToken = signal(false);

  // Quantities in 1 lot
  qtyNifty50 = 0;
  qtyBankNifty = 0;
  qtyMidcapNifty = 0;
  qtySensex = 0;

  // Preferred lot sizes (number of LOTS!)
  lotNifty50 = 0;
  lotBankNifty = 0;
  lotMidcapNifty = 0;
  lotSensex = 0;
  indicesList: IndexConfigItem[] = [];

  constructor() {
    // Synchronize inputs when lot sizes signal changes
    effect(() => {
      const cfg = this.instrumentService.lotSizes();
      if (cfg) {
        const nItem = cfg.indices?.find((i) => i.symbol.toUpperCase().includes('NIFTY 50'));
        const bItem = cfg.indices?.find((i) => i.symbol.toUpperCase().includes('BANK'));
        const mItem = cfg.indices?.find((i) => i.symbol.toUpperCase().includes('MIDCAP') || i.symbol.toUpperCase().includes('MIDCP'));
        const sItem = cfg.indices?.find((i) => i.symbol.toUpperCase().includes('SENSEX'));

        this.qtyNifty50 = nItem?.defaultQuantityInOneLot ?? nItem?.lotSize ?? cfg.nifty50 ?? 0;
        this.qtyBankNifty = bItem?.defaultQuantityInOneLot ?? bItem?.lotSize ?? cfg.bankNifty ?? 0;
        this.qtyMidcapNifty = mItem?.defaultQuantityInOneLot ?? mItem?.lotSize ?? cfg.midcapNifty ?? 0;
        this.qtySensex = sItem?.defaultQuantityInOneLot ?? sItem?.lotSize ?? cfg.sensex ?? 0;

        this.lotNifty50 = nItem?.defaultLotSize ?? nItem?.defaultLots ?? cfg.nifty50Lots ?? 0;
        this.lotBankNifty = bItem?.defaultLotSize ?? bItem?.defaultLots ?? cfg.bankNiftyLots ?? 0;
        this.lotMidcapNifty = mItem?.defaultLotSize ?? mItem?.defaultLots ?? cfg.midcapNiftyLots ?? 0;
        this.lotSensex = sItem?.defaultLotSize ?? sItem?.defaultLots ?? cfg.sensexLots ?? 0;

        if (cfg.indices && cfg.indices.length > 0) {
          this.indicesList = cfg.indices.map((i) => ({ ...i }));
        }
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
    const clean = Number(qty) || 0;
    const idx = this.getIndexConfig(symbol);
    if (idx) {
      idx.defaultQuantityInOneLot = clean;
      idx.lotSize = clean;
      const lots = idx.defaultLotSize ?? idx.defaultLots ?? 0;
      idx.defaultQuantity = lots * clean;
    }
  }

  onLotsChanged(symbol: string, lots: number): void {
    const clean = Number(lots) || 0;
    const idx = this.getIndexConfig(symbol);
    if (idx) {
      idx.defaultLotSize = clean;
      idx.defaultLots = clean;
      const qtyInOneLot = idx.defaultQuantityInOneLot ?? idx.lotSize ?? 0;
      idx.defaultQuantity = clean * qtyInOneLot;
    }
  }

  ngOnInit(): void {
    this.authService.refreshStatus();
    this.instrumentService.fetchSyncStatus().subscribe();
    this.instrumentService.fetchLotSizes().subscribe();
    this.instrumentService.fetchConfiguredIndices().subscribe();
    this.firestoreApi.refreshStatus().subscribe();
  }

  submitTokenUpdate(): void {
    const rawToken = this.tokenInput.trim();
    if (!rawToken) return;

    this.isUpdatingToken.set(true);
    const existingClientId = this.authService.tokenStatus()?.clientId;
    this.authService
      .updateToken({
        token: rawToken,
        clientId: existingClientId || undefined,
      })
      .subscribe({
        next: () => {
          this.isUpdatingToken.set(false);
          this.tokenInput = '';
        },
        error: (err) => {
          this.isUpdatingToken.set(false);
          this.snackBar.open(`Update failed: ${err.message}`, 'Dismiss', { duration: 5000 });
        },
      });
  }

  saveLotSizes(): void {
    const nifty50Lots = Number(this.lotNifty50) || 0;
    const bankNiftyLots = Number(this.lotBankNifty) || 0;
    const midcapNiftyLots = Number(this.lotMidcapNifty) || 0;
    const sensexLots = Number(this.lotSensex) || 0;

    const nifty50Qty = Number(this.qtyNifty50) || 0;
    const bankNiftyQty = Number(this.qtyBankNifty) || 0;
    const midcapNiftyQty = Number(this.qtyMidcapNifty) || 0;
    const sensexQty = Number(this.qtySensex) || 0;

    const updatedIndices: IndexConfigItem[] = this.indicesList.map((idx) => {
      const sym = idx.symbol.toUpperCase();
      let lots = idx.defaultLotSize ?? idx.defaultLots ?? 0;
      let qtyInOneLot = idx.defaultQuantityInOneLot ?? idx.lotSize ?? 0;

      if (sym.includes('BANK')) {
        lots = bankNiftyLots;
        qtyInOneLot = bankNiftyQty;
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
        midcapNifty: midcapNiftyQty,
        sensex: sensexQty,
        nifty50Lots,
        bankNiftyLots,
        midcapNiftyLots,
        sensexLots,
      })
      .subscribe(() => {
        this.instrumentService.fetchConfiguredIndices().subscribe();
      });
  }
}

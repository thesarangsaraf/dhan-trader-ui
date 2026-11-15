import { Component, OnInit, inject, signal, effect, computed } from '@angular/core';
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
import { UserAuthService } from '../../../core/api/user-auth.service';
import { ActiveSession, UserSummary } from '../../../core/models/user-auth.models';
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
              [ngClass]="authService.statusColor()"
              matTooltip="Dhan HQ JWT Token Status"
            >
              <span class="material-symbols-rounded">timer</span>
              <span class="pill-text mono-val">Token: {{ authService.timeRemainingFormatted() }}</span>
            </div>

            <!-- Firestore Pill -->
            <div
              class="status-pill fs-pill"
              [ngClass]="{ 'active': firestoreApi.status()?.configured }"
              matTooltip="Google Cloud Firestore Database"
            >
              <span class="material-symbols-rounded">cloud_done</span>
              <span class="pill-text">Firestore: {{ firestoreApi.status()?.configured ? 'Connected' : 'Offline' }}</span>
            </div>

            <!-- Equities Master Pill -->
            <div
              class="status-pill master-pill"
              [ngClass]="{
                'active': instrumentService.syncStatus()?.storedInFirestore,
                'warning-pill': !instrumentService.syncStatus()?.storedInFirestore
              }"
              matTooltip="NSE Cash Equities & Indices in Firestore collection sec_id_to_name_mapping"
            >
              <span class="material-symbols-rounded">{{ instrumentService.syncStatus()?.storedInFirestore ? 'database' : 'database_off' }}</span>
              <span class="pill-text">
                {{ instrumentService.syncStatus()?.storedInFirestore
                  ? 'Equities: ' + (instrumentService.syncStatus()?.metadata?.totalInstruments | number) + ' Items'
                  : 'Equities: Data not found in database' }}
              </span>
            </div>

            <!-- Index Options Pill -->
            <div
              class="status-pill master-pill options-ribbon-pill"
              [ngClass]="{
                'active': instrumentService.optionsSyncStatus()?.storedInFirestore,
                'warning-pill': !instrumentService.optionsSyncStatus()?.storedInFirestore
              }"
              matTooltip="Traded NSE Index Options in Firestore collection index_options"
            >
              <span class="material-symbols-rounded">{{ instrumentService.optionsSyncStatus()?.storedInFirestore ? 'stacked_line_chart' : 'database_off' }}</span>
              <span class="pill-text">
                {{ instrumentService.optionsSyncStatus()?.storedInFirestore
                  ? 'Options: ' + (instrumentService.optionsSyncStatus()?.metadata?.totalItems | number) + ' Contracts'
                  : 'Options: Data not found in database' }}
              </span>
            </div>
          </div>
        </section>

        <!-- SETTINGS CARDS GRID / CONTAINER -->
        <div class="settings-container">
          <!-- SECTION 0: APP USER & AUTHENTICATION -->
          <section class="settings-section-card" id="user-auth-section">
            <div class="section-header">
              <div class="section-title-wrap">
                <div class="icon-avatar token-avatar">
                  <span class="material-symbols-rounded">admin_panel_settings</span>
                </div>
                <div>
                  <h2 class="section-heading">App User & Persistent Authentication</h2>
                  <p class="section-subheading">Manage workspace login credentials and active persistent session (stored in Firestore config/auth_user)</p>
                </div>
              </div>
              <div class="section-actions">
                <button
                  mat-stroked-button
                  color="warn"
                  class="action-btn-danger"
                  (click)="userAuthService.logout()"
                  matTooltip="Sign out and revoke this session"
                >
                  <span class="material-symbols-rounded">logout</span>
                  <span>Sign Out</span>
                </button>
              </div>
            </div>

            <div class="token-overview-grid">
              <div class="metric-box">
                <span class="m-label">Active User</span>
                <span class="m-val highlight">{{ userAuthService.currentUser()?.username || 'admin' }}</span>
                <span class="m-meta">Role: Administrator</span>
              </div>
              <div class="metric-box">
                <span class="m-label">Session Persistence</span>
                <span class="m-val highlight" style="color: var(--color-profit)">Active (Permanent)</span>
                <span class="m-meta">Keeps you signed in until browser cache & cookies are cleared</span>
              </div>
              <div class="metric-box">
                <span class="m-label">Security Protocol</span>
                <span class="m-val highlight">scrypt + HS256 JWT</span>
                <span class="m-meta">Hardware-resistant salted password derivation</span>
              </div>
            </div>

            <!-- Password Change Form -->
            <div class="token-manual-card" style="margin-top: 16px;">
              <div class="manual-header">
                <span class="material-symbols-rounded">lock_reset</span>
                <span>Change Workspace Password</span>
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin-top: 12px;">
                <div>
                  <label style="display: block; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Current Password</label>
                  <input
                    type="password"
                    [value]="currentPasswordInput()"
                    (input)="currentPasswordInput.set($any($event.target).value)"
                    placeholder="Enter current password"
                    style="width: 100%; padding: 8px 12px; background: #0B0F19; border: 1px solid #1E293B; border-radius: 8px; color: #fff; font-size: 0.8125rem; outline: none; box-sizing: border-box;"
                  />
                </div>
                <div>
                  <label style="display: block; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">New Password (min 6 characters)</label>
                  <input
                    type="password"
                    [value]="newPasswordInput()"
                    (input)="newPasswordInput.set($any($event.target).value)"
                    placeholder="Enter new password"
                    style="width: 100%; padding: 8px 12px; background: #0B0F19; border: 1px solid #1E293B; border-radius: 8px; color: #fff; font-size: 0.8125rem; outline: none; box-sizing: border-box;"
                  />
                </div>
              </div>
              <div style="display: flex; justify-content: flex-end; margin-top: 12px;">
                <button
                  mat-flat-button
                  color="primary"
                  class="action-btn-primary"
                  (click)="changeAppPassword()"
                  [disabled]="isChangingPassword() || !currentPasswordInput() || !newPasswordInput()"
                >
                  <span class="material-symbols-rounded">{{ isChangingPassword() ? 'autorenew' : 'save' }}</span>
                  <span>{{ isChangingPassword() ? 'Updating Password...' : 'Update Password' }}</span>
                </button>
              </div>
            </div>
          </section>

          <!-- SECTION: USER MANAGEMENT, ACCESS CONTROL & ACTIVE SESSIONS (Restricted to 'admin' role) -->
          <section class="settings-section-card" id="user-crud-section" *ngIf="userAuthService.isAdmin()">
            <div class="section-header">
              <div class="section-title-wrap">
                <div class="icon-avatar token-avatar" style="background: linear-gradient(135deg, #6366F1, #8B5CF6);">
                  <span class="material-symbols-rounded">manage_accounts</span>
                </div>
                <div>
                  <h2 class="section-heading">User Management, Access Control & Active Sessions</h2>
                  <p class="section-subheading">Create, update, and manage workspace user accounts, access roles, and active device sessions (Restricted to <strong>Admin</strong> role)</p>
                </div>
              </div>
              <div class="section-actions" style="display: flex; gap: 8px;">
                <button
                  mat-stroked-button
                  color="primary"
                  class="action-btn-secondary"
                  (click)="loadUsersAndSessions()"
                  [disabled]="isLoadingUsers() || isLoadingSessions()"
                  matTooltip="Refresh user accounts and active sessions"
                >
                  <span class="material-symbols-rounded" [class.spinning]="isLoadingUsers() || isLoadingSessions()">sync</span>
                  <span>Refresh</span>
                </button>
                <button
                  mat-flat-button
                  color="primary"
                  class="action-btn-primary"
                  (click)="openCreateUserForm()"
                  *ngIf="!isCreatingUser()"
                  matTooltip="Add a new user to Dhan Trader Pro"
                >
                  <span class="material-symbols-rounded">person_add</span>
                  <span>Add New User</span>
                </button>
              </div>
            </div>

            <!-- Create New User Inline Form -->
            <div class="token-manual-card" style="margin-top: 16px;" *ngIf="isCreatingUser()">
              <div class="manual-header" style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="material-symbols-rounded">person_add</span>
                  <span>Create New User Account</span>
                </div>
                <button mat-icon-button (click)="isCreatingUser.set(false)" class="close-btn" matTooltip="Cancel">
                  <span class="material-symbols-rounded">close</span>
                </button>
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-top: 12px;">
                <div>
                  <label style="display: block; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Username</label>
                  <input
                    type="text"
                    [value]="newUsernameInput()"
                    (input)="newUsernameInput.set($any($event.target).value)"
                    placeholder="Enter username"
                    style="width: 100%; padding: 8px 12px; background: #0B0F19; border: 1px solid #1E293B; border-radius: 8px; color: #fff; font-size: 0.8125rem; outline: none; box-sizing: border-box;"
                  />
                </div>
                <div>
                  <label style="display: block; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Initial Password (min 6 chars)</label>
                  <input
                    type="password"
                    [value]="newUserPasswordInput()"
                    (input)="newUserPasswordInput.set($any($event.target).value)"
                    placeholder="Enter password"
                    style="width: 100%; padding: 8px 12px; background: #0B0F19; border: 1px solid #1E293B; border-radius: 8px; color: #fff; font-size: 0.8125rem; outline: none; box-sizing: border-box;"
                  />
                </div>
                <div>
                  <label style="display: block; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Role</label>
                  <select
                    [value]="newUserRoleInput()"
                    (change)="newUserRoleInput.set($any($event.target).value)"
                    style="width: 100%; padding: 8px 12px; background: #0B0F19; border: 1px solid #1E293B; border-radius: 8px; color: #fff; font-size: 0.8125rem; outline: none; box-sizing: border-box;"
                  >
                    <option value="trader">Trader (Order execution & alerts)</option>
                    <option value="admin">Admin (Full configuration)</option>
                    <option value="viewer">Viewer (Read-only monitoring)</option>
                  </select>
                </div>
              </div>
              <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px;">
                <button mat-stroked-button (click)="isCreatingUser.set(false)" class="action-btn-secondary">
                  Cancel
                </button>
                <button
                  mat-flat-button
                  color="primary"
                  class="action-btn-primary"
                  (click)="submitCreateUser()"
                  [disabled]="isSubmittingUser() || !newUsernameInput().trim() || !newUserPasswordInput().trim()"
                >
                  <span class="material-symbols-rounded">{{ isSubmittingUser() ? 'autorenew' : 'check' }}</span>
                  <span>{{ isSubmittingUser() ? 'Creating...' : 'Create User' }}</span>
                </button>
              </div>
            </div>

            <!-- Edit User Inline Form -->
            <div class="token-manual-card" style="margin-top: 16px; border-color: rgba(99, 102, 241, 0.4);" *ngIf="editingUser() as user">
              <div class="manual-header" style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="material-symbols-rounded">manage_accounts</span>
                  <span>Edit User: <strong class="mono-val" style="color: var(--dhan-cyan);">{{ user.username }}</strong></span>
                </div>
                <button mat-icon-button (click)="editingUser.set(null)" class="close-btn" matTooltip="Cancel">
                  <span class="material-symbols-rounded">close</span>
                </button>
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-top: 12px;">
                <div>
                  <label style="display: block; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Role</label>
                  <select
                    [value]="editUserRoleInput()"
                    (change)="editUserRoleInput.set($any($event.target).value)"
                    style="width: 100%; padding: 8px 12px; background: #0B0F19; border: 1px solid #1E293B; border-radius: 8px; color: #fff; font-size: 0.8125rem; outline: none; box-sizing: border-box;"
                  >
                    <option value="admin">Admin (Full access & user management)</option>
                    <option value="trader">Trader (Order execution & alerts)</option>
                    <option value="viewer">Viewer (Read-only monitoring)</option>
                  </select>
                </div>
                <div>
                  <label style="display: block; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">Reset Password (leave empty to keep unchanged)</label>
                  <input
                    type="password"
                    [value]="editUserPasswordInput()"
                    (input)="editUserPasswordInput.set($any($event.target).value)"
                    placeholder="Enter new password (optional)"
                    style="width: 100%; padding: 8px 12px; background: #0B0F19; border: 1px solid #1E293B; border-radius: 8px; color: #fff; font-size: 0.8125rem; outline: none; box-sizing: border-box;"
                  />
                </div>
              </div>
              <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px;">
                <button mat-stroked-button (click)="editingUser.set(null)" class="action-btn-secondary">
                  Cancel
                </button>
                <button
                  mat-flat-button
                  color="primary"
                  class="action-btn-primary"
                  (click)="submitUpdateUser()"
                  [disabled]="isSubmittingUser()"
                >
                  <span class="material-symbols-rounded">{{ isSubmittingUser() ? 'autorenew' : 'save' }}</span>
                  <span>{{ isSubmittingUser() ? 'Saving...' : 'Save Changes' }}</span>
                </button>
              </div>
            </div>

            <!-- Users Table List -->
            <div class="table-container" style="margin-top: 16px;">
              <div class="loading-state" *ngIf="isLoadingUsers()" style="padding: 24px; text-align: center; color: var(--text-muted);">
                <span class="material-symbols-rounded spinning">sync</span>
                <span>Loading users from Firestore...</span>
              </div>
              <table class="inspector-table" *ngIf="!isLoadingUsers() && usersList().length > 0">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Created At</th>
                    <th>Active Sessions</th>
                    <th style="text-align: right;">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let u of usersList()">
                    <td class="sec-id-cell">
                      <div style="display: inline-flex; align-items: center; gap: 6px;">
                        <span class="material-symbols-rounded" style="font-size: 16px; color: var(--text-muted);">account_circle</span>
                        <strong>{{ u.username }}</strong>
                        <span class="badge-chip" style="background: rgba(99, 102, 241, 0.2); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3);" *ngIf="u.username === 'sarang'">
                          Primary
                        </span>
                        <span class="badge-chip" style="background: rgba(0, 210, 196, 0.15); color: var(--dhan-cyan); border: 1px solid rgba(0, 210, 196, 0.3);" *ngIf="u.username === userAuthService.currentUser()?.username">
                          You
                        </span>
                      </div>
                    </td>
                    <td>
                      <div class="role-selector-wrap" style="display: inline-flex; align-items: center; gap: 6px;">
                        <select
                          class="role-select-compact"
                          [value]="u.role"
                          (change)="onRoleChange(u, $any($event.target).value)"
                          [disabled]="isUpdatingUserRole() === u.username"
                          matTooltip="View or change role for {{ u.username }}"
                        >
                          <option value="admin">Admin</option>
                          <option value="trader">Trader</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <span class="material-symbols-rounded spinning" *ngIf="isUpdatingUserRole() === u.username" style="font-size: 14px; color: var(--dhan-cyan);">sync</span>
                      </div>
                    </td>
                    <td>
                      <span class="mono-val" style="font-size: 0.75rem;">{{ u.createdAt | istDate }}</span>
                    </td>
                    <td>
                      <button
                        mat-button
                        class="session-count-chip-btn"
                        (click)="filterSessionsByUser(u.username)"
                        [class.active-filter]="activeSessionFilter() === u.username"
                        matTooltip="Filter active sessions for {{ u.username }}"
                      >
                        <span class="material-symbols-rounded" style="font-size: 14px;">devices</span>
                        <span class="mono-val">{{ u.sessionCount }} active</span>
                      </button>
                    </td>
                    <td style="text-align: right;">
                      <div style="display: inline-flex; gap: 6px; justify-content: flex-end;">
                        <button
                          mat-icon-button
                          class="action-icon-btn"
                          (click)="filterSessionsByUser(u.username)"
                          matTooltip="View & Manage Active Sessions"
                        >
                          <span class="material-symbols-rounded" style="font-size: 18px;">devices</span>
                        </button>
                        <button
                          mat-icon-button
                          class="action-icon-btn"
                          (click)="startEditUser(u)"
                          matTooltip="Edit User Role or Reset Password"
                        >
                          <span class="material-symbols-rounded" style="font-size: 18px;">edit</span>
                        </button>
                        <button
                          mat-icon-button
                          class="action-icon-btn"
                          (click)="confirmDeleteUser(u.username)"
                          [disabled]="u.username === 'sarang' || u.username === userAuthService.currentUser()?.username"
                          [matTooltip]="u.username === 'sarang' ? 'Superuser sarang cannot be deleted' : (u.username === userAuthService.currentUser()?.username ? 'Cannot delete your own logged-in account' : 'Delete user account')"
                          style="color: var(--color-loss);"
                        >
                          <span class="material-symbols-rounded" style="font-size: 18px;">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div *ngIf="!isLoadingUsers() && usersList().length === 0" style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 0.8125rem;">
                No users found. Click "+ Add New User" to register a user.
              </div>

              <!-- Integrated Active Connected Sessions & Devices Panel -->
              <div class="active-sessions-integrated-panel" style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #1E293B;">
                <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="icon-avatar" style="width: 32px; height: 32px; border-radius: 8px; background: rgba(0, 210, 196, 0.15); color: var(--dhan-cyan); display: flex; align-items: center; justify-content: center;">
                      <span class="material-symbols-rounded" style="font-size: 18px;">devices</span>
                    </div>
                    <div>
                      <h3 style="margin: 0; font-size: 0.9375rem; font-weight: 600; color: #fff;">
                        Active Connected Sessions & Devices
                      </h3>
                      <p style="margin: 2px 0 0 0; font-size: 0.75rem; color: var(--text-muted);">
                        Review and terminate active browser and device sessions across workspace users
                      </p>
                    </div>
                  </div>

                  <div class="session-quick-actions" style="display: flex; gap: 8px;">
                    <button
                      mat-stroked-button
                      class="action-btn-secondary"
                      (click)="loadAllSessions()"
                      [disabled]="isLoadingSessions()"
                      matTooltip="Refresh active sessions"
                    >
                      <span class="material-symbols-rounded" [class.spinning]="isLoadingSessions()">sync</span>
                      <span>Refresh Sessions</span>
                    </button>
                    <button
                      *ngIf="activeSessionFilter() !== 'ALL'"
                      mat-flat-button
                      color="warn"
                      class="kill-all-user-btn"
                      (click)="confirmKillAllUserSessions(activeSessionFilter())"
                      [disabled]="isLoadingSessions() || filteredSessions().length === 0"
                      matTooltip="Terminate all active sessions for {{ activeSessionFilter() }}"
                    >
                      <span class="material-symbols-rounded">phonelink_erase</span>
                      <span>Kill All for @{{ activeSessionFilter() }}</span>
                    </button>
                    <button
                      *ngIf="activeSessionFilter() === 'ALL'"
                      mat-flat-button
                      color="warn"
                      class="kill-others-btn"
                      (click)="confirmKillOtherSessions()"
                      [disabled]="isLoadingSessions() || allSessions().length <= 1"
                      matTooltip="Terminate all other sessions for current user"
                    >
                      <span class="material-symbols-rounded">phonelink_erase</span>
                      <span>Kill Other Sessions</span>
                    </button>
                  </div>
                </div>

                <!-- User Filter Chips / Tabs -->
                <div class="session-user-filters" style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
                  <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">Filter by User:</span>
                  <button
                    type="button"
                    class="filter-pill-btn"
                    [class.active]="activeSessionFilter() === 'ALL'"
                    (click)="activeSessionFilter.set('ALL')"
                  >
                    All Users ({{ allSessions().length }})
                  </button>
                  <button
                    type="button"
                    class="filter-pill-btn"
                    *ngFor="let u of usersList()"
                    [class.active]="activeSessionFilter() === u.username"
                    (click)="filterSessionsByUser(u.username)"
                  >
                    @{{ u.username }} ({{ u.sessionCount }})
                  </button>
                </div>

                <!-- Loading State -->
                <div class="loading-state" *ngIf="isLoadingSessions()" style="padding: 24px; text-align: center; color: var(--text-muted);">
                  <span class="material-symbols-rounded spinning">sync</span>
                  <span>Loading active sessions...</span>
                </div>

                <!-- Sessions Grid -->
                <div class="sessions-grid" *ngIf="!isLoadingSessions() && filteredSessions().length > 0">
                  <div class="session-card" *ngFor="let s of filteredSessions()" [class.current-session]="s.isCurrent">
                    <div class="session-card-header">
                      <div class="session-device-icon" [ngClass]="{ 'current-icon': s.isCurrent }">
                        <span class="material-symbols-rounded">
                          {{ s.deviceType === 'Mobile' ? 'smartphone' : (s.deviceType === 'Tablet' ? 'tablet' : 'laptop_mac') }}
                        </span>
                      </div>
                      <div class="session-info">
                        <div class="session-name">
                          <strong>{{ s.browser }} on {{ s.os }}</strong>
                          <span class="badge-chip" style="background: rgba(99, 102, 241, 0.2); color: #818cf8; margin-left: 6px;">
                            @{{ s.username }}
                          </span>
                          <span class="current-badge" *ngIf="s.isCurrent">
                            <span class="material-symbols-rounded">check_circle</span>
                            Current Device
                          </span>
                        </div>
                        <div class="session-meta">
                          <span class="ip-tag">IP: <code class="mono-val">{{ s.ip || '127.0.0.1' }}</code></span>
                          <span class="meta-dot">•</span>
                          <span>Signed in: <span class="mono-val">{{ s.createdAt | istDate }}</span></span>
                        </div>
                      </div>
                    </div>
                    <div class="session-actions-box">
                      <span class="session-active-indicator" *ngIf="s.isCurrent">
                        <span class="pulsing-dot"></span>
                        Active Now
                      </span>
                      <button
                        *ngIf="!s.isCurrent"
                        mat-stroked-button
                        color="warn"
                        class="kill-session-btn"
                        (click)="confirmKillSession(s)"
                        matTooltip="Terminate this session"
                      >
                        <span class="material-symbols-rounded" style="font-size: 16px;">block</span>
                        <span>Kill Session</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div *ngIf="!isLoadingSessions() && filteredSessions().length === 0" style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 0.8125rem;">
                  No active sessions found{{ activeSessionFilter() !== 'ALL' ? ' for ' + activeSessionFilter() : '' }}.
                </div>
              </div>
            </div>
          </section>

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
                <div class="detail-val status-val" [ngClass]="{
                  'green': token.status === 'ACTIVE',
                  'yellow': token.status === 'EXPIRING_SOON',
                  'red': token.status === 'EXPIRED'
                }">
                  <span class="pulse-dot"></span>
                  {{ token.statusText }}
                </div>
              </div>
              <div class="detail-box">
                <div class="detail-label">Time Remaining</div>
                <div class="detail-val mono-val countdown-val" [ngClass]="{ 'urgent': authService.statusColor() === 'red' }">
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
              <div class="lot-card" [ngClass]="{ 'disabled-index': !getIndexConfig('NIFTY 50')?.enabled }">
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
                  <button type="button" class="quick-pill" [ngClass]="{ 'active': lotNifty50 === 5 }" (click)="lotNifty50 = 5; onLotsChanged('NIFTY 50', 5)">5 Lots ({{ 5 * qtyNifty50 }})</button>
                  <button type="button" class="quick-pill" [ngClass]="{ 'active': lotNifty50 === 10 }" (click)="lotNifty50 = 10; onLotsChanged('NIFTY 50', 10)">10 Lots ({{ 10 * qtyNifty50 }})</button>
                  <button type="button" class="quick-pill" [ngClass]="{ 'active': lotNifty50 === 15 }" (click)="lotNifty50 = 15; onLotsChanged('NIFTY 50', 15)">15 Lots ({{ 15 * qtyNifty50 }})</button>
                </div>
              </div>

              <!-- BANK NIFTY -->
              <div class="lot-card" [ngClass]="{ 'disabled-index': !getIndexConfig('BANK NIFTY')?.enabled }">
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
                  <button type="button" class="quick-pill" [ngClass]="{ 'active': lotBankNifty === 5 }" (click)="lotBankNifty = 5; onLotsChanged('BANK NIFTY', 5)">5 Lots ({{ 5 * qtyBankNifty }})</button>
                  <button type="button" class="quick-pill" [ngClass]="{ 'active': lotBankNifty === 10 }" (click)="lotBankNifty = 10; onLotsChanged('BANK NIFTY', 10)">10 Lots ({{ 10 * qtyBankNifty }})</button>
                  <button type="button" class="quick-pill" [ngClass]="{ 'active': lotBankNifty === 15 }" (click)="lotBankNifty = 15; onLotsChanged('BANK NIFTY', 15)">15 Lots ({{ 15 * qtyBankNifty }})</button>
                </div>
              </div>

              <!-- MIDCAP NIFTY -->
              <div class="lot-card" [ngClass]="{ 'disabled-index': !getIndexConfig('MIDCAP NIFTY')?.enabled }">
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
                  <button type="button" class="quick-pill" [ngClass]="{ 'active': lotMidcapNifty === 5 }" (click)="lotMidcapNifty = 5; onLotsChanged('MIDCAP NIFTY', 5)">5 Lots ({{ 5 * qtyMidcapNifty }})</button>
                  <button type="button" class="quick-pill" [ngClass]="{ 'active': lotMidcapNifty === 10 }" (click)="lotMidcapNifty = 10; onLotsChanged('MIDCAP NIFTY', 10)">10 Lots ({{ 10 * qtyMidcapNifty }})</button>
                  <button type="button" class="quick-pill" [ngClass]="{ 'active': lotMidcapNifty === 15 }" (click)="lotMidcapNifty = 15; onLotsChanged('MIDCAP NIFTY', 15)">15 Lots ({{ 15 * qtyMidcapNifty }})</button>
                </div>
              </div>

              <!-- SENSEX -->
              <div class="lot-card" [ngClass]="{ 'disabled-index': !getIndexConfig('SENSEX')?.enabled }">
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
                  <button type="button" class="quick-pill" [ngClass]="{ 'active': lotSensex === 5 }" (click)="lotSensex = 5; onLotsChanged('SENSEX', 5)">5 Lots ({{ 5 * qtySensex }})</button>
                  <button type="button" class="quick-pill" [ngClass]="{ 'active': lotSensex === 10 }" (click)="lotSensex = 10; onLotsChanged('SENSEX', 10)">10 Lots ({{ 10 * qtySensex }})</button>
                  <button type="button" class="quick-pill" [ngClass]="{ 'active': lotSensex === 15 }" (click)="lotSensex = 15; onLotsChanged('SENSEX', 15)">15 Lots ({{ 15 * qtySensex }})</button>
                </div>
              </div>
            </div>

            <div class="lot-footer-note" *ngIf="instrumentService.lotSizes().updatedAt">
              <span class="material-symbols-rounded">schedule</span>
              <span>Last configured in Firestore: {{ instrumentService.lotSizes().updatedAt | istDate : 'full' }}</span>
            </div>
          </section>

          <!-- SECTION 3: NSE SECURITY MASTERS & FIRESTORE SYNC -->
          <section class="settings-section-card" id="scrip-section">
            <div class="section-header">
              <div class="section-title-wrap">
                <div class="icon-avatar master-avatar">
                  <span class="material-symbols-rounded">sync_alt</span>
                </div>
                <div>
                  <h2 class="section-heading">NSE Security Masters & Firestore Sync</h2>
                  <p class="section-subheading">
                    Cash equities in <code>sec_id_to_name_mapping</code> and traded index options in dedicated collection <code>index_options</code>
                  </p>
                </div>
              </div>
              <div class="section-actions dual-sync-actions">
                <button
                  mat-flat-button
                  color="primary"
                  class="action-btn-primary flush-equities-btn"
                  (click)="onFlushAndReloadEquities()"
                  [disabled]="instrumentService.isFlushingEquities()"
                  matTooltip="Flush sec_id_to_name_mapping and reload fresh cash equities & indices from Dhan"
                >
                  <span class="material-symbols-rounded" [class.spinning]="instrumentService.isFlushingEquities()">
                    {{ instrumentService.isFlushingEquities() ? 'sync' : 'restart_alt' }}
                  </span>
                  <span>{{ instrumentService.isFlushingEquities() ? 'Flushing & Reloading Equities...' : 'Flush & Reload Equities' }}</span>
                </button>
                <button
                  mat-flat-button
                  color="accent"
                  class="action-btn-accent flush-options-btn"
                  (click)="onFlushAndReloadOptions()"
                  [disabled]="instrumentService.isFlushingOptions()"
                  matTooltip="Flush index_options and reload fresh option contracts from Dhan"
                >
                  <span class="material-symbols-rounded" [class.spinning]="instrumentService.isFlushingOptions()">
                    {{ instrumentService.isFlushingOptions() ? 'sync' : 'restart_alt' }}
                  </span>
                  <span>{{ instrumentService.isFlushingOptions() ? 'Flushing & Reloading Options...' : 'Flush & Reload Options' }}</span>
                </button>
              </div>
            </div>

            <!-- DUAL MASTER SUBSECTIONS -->
            <div class="dual-master-grid">
              <!-- SUBSECTION A: CASH EQUITIES & BENCHMARK INDICES -->
              <div class="sub-master-card">
                <div class="sub-master-header">
                  <div class="sub-master-title">
                    <span class="material-symbols-rounded sub-icon">table_chart</span>
                    <span>Cash Equities & Benchmark Indices</span>
                  </div>
                  <span class="collection-badge">sec_id_to_name_mapping</span>
                </div>

                <!-- Equities Not Found in Database Banner -->
                <div class="db-not-found-banner" *ngIf="!instrumentService.syncStatus()?.storedInFirestore">
                  <div class="db-not-found-icon">
                    <span class="material-symbols-rounded">database_off</span>
                  </div>
                  <div class="db-not-found-content">
                    <h4 class="db-not-found-title">Data is not found in database</h4>
                    <p class="db-not-found-msg">
                      Firestore collection <code>sec_id_to_name_mapping</code> contains no cash equities or indices.
                      Click <strong>Flush & Reload Equities</strong> above to download the official Dhan scrip master and populate equities.
                    </p>
                  </div>
                </div>

                <!-- Equities Stats Grid -->
                <div class="master-stats-grid" *ngIf="instrumentService.syncStatus()?.metadata as meta">
                  <div class="stat-card">
                    <div class="stat-val mono-val">{{ meta.totalInstruments | number }}</div>
                    <div class="stat-lbl">Total Instruments</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-val mono-val">{{ meta.totalEquities | number }}</div>
                    <div class="stat-lbl">Cash Equities (NSE_EQ)</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-val mono-val">{{ meta.totalIndices | number }}</div>
                    <div class="stat-lbl">Benchmark Indices (IDX_I)</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-val mono-val">{{ meta.documentsCount || 7 }}</div>
                    <div class="stat-lbl">Modular Documents</div>
                  </div>
                </div>

                <!-- Document Breakdown Chips -->
                <div class="documents-breakdown-box" *ngIf="instrumentService.syncStatus()?.metadata as meta">
                  <div class="breakdown-title">Firestore Chunk Documents:</div>
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
                <!-- Equities Flush & Reload Success Banner -->
                <div class="flush-inline-banner" *ngIf="instrumentService.lastFlushEquitiesResult() as eqRes">
                  <span class="material-symbols-rounded">check_circle</span>
                  <span>Equities flushed & reloaded: <strong class="mono-val">{{ eqRes.totalInstruments | number }}</strong> total ({{ eqRes.totalEquities | number }} equities, {{ eqRes.totalIndices | number }} indices)</span>
                </div>
              </div>

              <!-- SUBSECTION B: TRADED INDEX OPTIONS -->
              <div class="sub-master-card">
                <div class="sub-master-header">
                  <div class="sub-master-title">
                    <span class="material-symbols-rounded sub-icon options-icon">stacked_line_chart</span>
                    <span>Traded Index Options</span>
                  </div>
                  <span class="collection-badge options-badge">index_options</span>
                </div>

                <!-- Options Not Found in Database Banner -->
                <div class="db-not-found-banner" *ngIf="!instrumentService.optionsSyncStatus()?.storedInFirestore">
                  <div class="db-not-found-icon">
                    <span class="material-symbols-rounded">database_off</span>
                  </div>
                  <div class="db-not-found-content">
                    <h4 class="db-not-found-title">Data is not found in database</h4>
                    <p class="db-not-found-msg">
                      Firestore collection <code>index_options</code> contains no option contracts.
                      Click <strong>Flush & Reload Options</strong> above to download live option contracts for your traded indices.
                    </p>
                  </div>
                </div>

                <!-- Options Stats Grid -->
                <div class="master-stats-grid" *ngIf="instrumentService.optionsSyncStatus()?.metadata as optMeta">
                  <div class="stat-card">
                    <div class="stat-val mono-val">{{ optMeta.totalItems | number }}</div>
                    <div class="stat-lbl">Total Option Contracts</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-val mono-val">{{ (optMeta.documentIds?.length || optMeta.totalChunks || 4) | number }}</div>
                    <div class="stat-lbl">Index Documents</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-val mono-val">{{ (optMeta.maxExpiriesPerIndex || 2) | number }}</div>
                    <div class="stat-lbl">Max Expiries / Index</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-val mono-val">{{ (instrumentService.optionsSyncStatus()?.tradedIndices?.length || 4) }}</div>
                    <div class="stat-lbl">Traded Indices</div>
                  </div>
                </div>

                <!-- Dedicated Index Documents Badges Box -->
                <div class="documents-breakdown-box" *ngIf="instrumentService.optionsSyncStatus()?.metadata as optMeta">
                  <div class="breakdown-title">Dedicated Index Documents in Firestore:</div>
                  <div class="doc-chips">
                    <span class="traded-index-pill" *ngFor="let idx of (optMeta.documentIds || instrumentService.optionsSyncStatus()?.tradedIndices || ['NIFTY', 'BANKNIFTY', 'MIDCPNIFTY', 'SENSEX'])">
                      <span class="material-symbols-rounded">description</span>
                      {{ idx }} (Current & Next Expiry)
                    </span>
                  </div>
                  <div class="sync-timestamp" *ngIf="optMeta.updatedAt">
                    Last synchronized: {{ optMeta.updatedAt | istDate : 'full' }}
                  </div>
                </div>

                <!-- Options Flush & Reload Success Banner -->
                <div class="flush-inline-banner" *ngIf="instrumentService.lastFlushOptionsResult() as optRes">
                  <span class="material-symbols-rounded">check_circle</span>
                  <span>Options flushed & reloaded: <strong class="mono-val">{{ optRes.totalItems | number }}</strong> contracts across {{ optRes.totalChunks }} chunks</span>
                </div>
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
                <div class="fs-val status-val" [ngClass]="{ 'green': fs.configured }">
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
            <div class="test-result-box" *ngIf="firestoreApi.lastTestResult() as t" [ngClass]="t.success ? 'success' : 'failure'">
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
        &:hover { text-decoration: underline; }
      }
      .bc-sep { color: var(--text-muted); }
      .bc-current { color: var(--text-secondary); }
      .page-title {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--text-primary);
        letter-spacing: -0.02em;
      }
      .page-icon { font-size: 28px; color: var(--dhan-cyan); }
      .page-subtitle {
        font-size: 0.875rem;
        color: var(--text-secondary);
        margin-top: 4px;
        line-height: 1.4;
      }
      .quick-status-ribbon {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        padding-top: 12px;
        border-top: 1px solid var(--border-subtle);
      }
      .status-pill.active {
        background: rgba(0, 210, 196, 0.1);
        border-color: rgba(0, 210, 196, 0.3);
        color: var(--dhan-cyan);
      }
      .db-not-found-banner {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 14px 18px;
        background: rgba(245, 158, 11, 0.08);
        border: 1px solid rgba(245, 158, 11, 0.35);
        border-radius: 8px;
        margin-bottom: 18px;
      }
      .db-not-found-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: 6px;
        background: rgba(245, 158, 11, 0.15);
        color: var(--color-pending);
        flex-shrink: 0;
        .material-symbols-rounded { font-size: 18px; }
      }
      .db-not-found-title {
        font-size: 0.9rem;
        font-weight: 700;
        color: var(--color-pending);
        margin: 0 0 4px;
      }
      .db-not-found-msg {
        font-size: 0.8rem;
        color: var(--text-secondary);
        margin: 0;
        line-height: 1.4;
        code {
          background: rgba(255, 255, 255, 0.08);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.75rem;
          color: var(--dhan-cyan);
        }
      }
      .flush-inline-banner {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 14px;
        padding: 10px 14px;
        background: rgba(16, 185, 129, 0.1);
        border: 1px solid rgba(16, 185, 129, 0.3);
        border-radius: 8px;
        color: #10b981;
        font-size: 0.8125rem;
        font-weight: 500;
        .material-symbols-rounded {
          font-size: 18px;
          flex-shrink: 0;
        }
      }
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
        &.token-avatar { background: rgba(99, 102, 241, 0.15); color: #818cf8; }
        &.lots-avatar { background: rgba(0, 210, 196, 0.15); color: var(--dhan-cyan); }
        &.master-avatar { background: rgba(16, 185, 129, 0.15); color: var(--color-profit); }
        &.fs-avatar { background: rgba(245, 158, 11, 0.15); color: var(--color-pending); }
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
      .token-details-grid, .fs-status-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 14px;
        margin-bottom: 20px;
      }
      .detail-box, .fs-item {
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        padding: 12px 14px;
      }
      .detail-label, .fs-label {
        font-size: 0.72rem;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin-bottom: 4px;
      }
      .detail-val, .fs-val {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--text-primary);
      }
      .status-val {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .countdown-val {
        color: var(--dhan-cyan);
        &.urgent { color: var(--color-loss); }
      }
      .token-mask {
        font-size: 0.75rem;
        color: var(--text-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .inner-form-box, .documents-breakdown-box, .sub-master-card {
        background: rgba(0, 0, 0, 0.2);
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        padding: 18px 20px;
        margin-top: 16px;
      }
      .documents-breakdown-box { margin-bottom: 20px; padding: 14px; }
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
        code {
          background: rgba(255, 255, 255, 0.06);
          padding: 2px 6px;
          border-radius: 4px;
          color: var(--dhan-cyan);
          font-family: var(--font-mono);
        }
      }
      .form-row { margin-bottom: 12px; }
      .form-actions-row {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 8px;
      }
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
        &:focus-within { border-color: var(--dhan-cyan); }
        &.disabled-index { opacity: 0.65; border-style: dashed; }
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
        &:focus {
          border-color: var(--dhan-cyan);
          box-shadow: 0 0 0 2px rgba(0, 210, 196, 0.2);
        }
      }
      .input-with-suffix {
        position: relative;
        display: flex;
        align-items: center;
        .styled-number-input { padding-right: 50px; }
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
        input[type="checkbox"] {
          accent-color: var(--dhan-cyan);
          cursor: pointer;
        }
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
        &:hover {
          border-color: var(--dhan-cyan);
          color: var(--dhan-cyan);
        }
        &.active {
          background: rgba(0, 210, 196, 0.15);
          border-color: var(--dhan-cyan);
          color: var(--dhan-cyan);
        }
      }
      .lot-footer-note {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.75rem;
        color: var(--text-muted);
        margin-top: 8px;
      }
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
      .dual-sync-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .action-btn-accent {
        background: #9333ea !important;
        color: #fff !important;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-weight: 600;
        border-radius: 8px;
        padding: 0 16px;
        height: 38px;
      }
      .options-ribbon-pill.active {
        background: rgba(168, 85, 247, 0.15) !important;
        border-color: rgba(168, 85, 247, 0.4) !important;
        color: #c084fc !important;
      }
      .dual-master-grid {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      .sub-master-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      .sub-master-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.95rem;
        font-weight: 700;
        color: var(--text-primary);
      }
      .sub-icon {
        color: var(--dhan-cyan);
        font-size: 20px;
        &.options-icon { color: #c084fc; }
      }
      .collection-badge {
        font-family: var(--font-mono);
        font-size: 0.72rem;
        padding: 3px 8px;
        border-radius: 6px;
        background: rgba(0, 210, 196, 0.12);
        color: var(--dhan-cyan);
        border: 1px solid rgba(0, 210, 196, 0.3);
        &.options-badge {
          background: rgba(168, 85, 247, 0.12);
          color: #c084fc;
          border-color: rgba(168, 85, 247, 0.3);
        }
      }
      .traded-index-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: rgba(168, 85, 247, 0.15);
        border: 1px solid rgba(168, 85, 247, 0.4);
        border-radius: 6px;
        padding: 4px 10px;
        font-size: 0.75rem;
        font-weight: 700;
        color: #e9d5ff;
        .material-symbols-rounded { font-size: 14px; color: #c084fc; }
      }
      .master-inspector-card {
        margin-top: 24px;
        background: rgba(15, 23, 42, 0.4);
        border: 1px solid var(--border-medium);
        border-radius: 12px;
        overflow: hidden;
      }
      .inspector-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid var(--border-subtle);
        background: rgba(0, 0, 0, 0.2);
        flex-wrap: wrap;
        gap: 12px;
      }
      .inspector-title-group {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .inspector-icon { font-size: 24px; color: var(--dhan-cyan); }
      .inspector-heading {
        margin: 0;
        font-size: 1rem;
        font-weight: 700;
        color: var(--text-primary);
      }
      .inspector-subheading {
        margin: 2px 0 0;
        font-size: 0.75rem;
        color: var(--text-muted);
      }
      .inspector-tabs, .filter-pills { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .inspector-tab, .filter-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 12px;
        border-radius: 8px;
        border: 1px solid var(--border-subtle);
        background: var(--bg-card);
        color: var(--text-secondary);
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;
        &:hover {
          background: var(--bg-card-hover);
          color: var(--text-primary);
        }
        &.active {
          background: rgba(0, 210, 196, 0.15);
          border-color: var(--dhan-cyan);
          color: var(--dhan-cyan);
        }
        &.call-pill.active {
          background: rgba(16, 185, 129, 0.15);
          border-color: #10b981;
          color: #10b981;
        }
        &.put-pill.active {
          background: rgba(244, 63, 94, 0.15);
          border-color: #f43f5e;
          color: #f43f5e;
        }
      }
      .inspector-tab-content { padding: 16px 20px; }
      .inspector-controls-bar {
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }
      .search-box {
        display: flex;
        align-items: center;
        gap: 8px;
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        padding: 6px 12px;
        flex: 1;
        min-width: 240px;
        .material-symbols-rounded { font-size: 18px; color: var(--text-muted); }
        input {
          border: none;
          background: transparent;
          outline: none;
          color: var(--text-primary);
          font-size: 0.8125rem;
          width: 100%;
        }
      }
      .clear-btn {
        background: transparent;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        padding: 0;
        display: flex;
        align-items: center;
        .material-symbols-rounded { font-size: 16px; }
      }
      .filter-label {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--text-muted);
        margin-right: 2px;
      }
      .expiry-select-wrap {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .expiry-select {
        background: var(--bg-surface);
        border: 1px solid var(--border-subtle);
        border-radius: 6px;
        color: var(--text-primary);
        font-size: 0.75rem;
        padding: 4px 8px;
        outline: none;
      }
      .table-container {
        border: 1px solid var(--border-subtle);
        border-radius: 8px;
        overflow-x: auto;
        background: var(--bg-surface);
        min-height: 200px;
        max-height: 480px;
        overflow-y: auto;
      }
      .inspector-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.8125rem;
        th {
          background: rgba(0, 0, 0, 0.3);
          padding: 10px 14px;
          text-align: left;
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border-bottom: 1px solid var(--border-subtle);
          position: sticky;
          top: 0;
          z-index: 1;
        }
        td {
          padding: 9px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          color: var(--text-secondary);
        }
        tr:hover td {
          background: var(--bg-card-hover);
          color: var(--text-primary);
        }
      }
      .sec-id-cell {
        color: var(--dhan-cyan);
        font-weight: 600;
      }
      .symbol-cell { color: var(--text-primary); }
      .name-cell {
        max-width: 280px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .badge-chip {
        font-size: 0.6875rem;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.06);
        color: var(--text-secondary);
        &.seg-chip {
          background: rgba(59, 130, 246, 0.12);
          color: #60a5fa;
          border: 1px solid rgba(59, 130, 246, 0.25);
        }
        &.type-chip {
          background: rgba(234, 179, 8, 0.12);
          color: #facc15;
        }
        &.index-chip {
          background: rgba(168, 85, 247, 0.15);
          color: #c084fc;
        }
        &.ce-chip {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
        }
        &.pe-chip {
          background: rgba(244, 63, 94, 0.15);
          color: #f43f5e;
        }
      }
      .empty-results {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 36px 20px;
        color: var(--text-muted);
        font-size: 0.875rem;
      }
      .inspector-pagination {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 12px;
        font-size: 0.75rem;
        color: var(--text-muted);
      }
      .page-buttons { display: flex; gap: 8px; }
      .page-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        border-radius: 6px;
        border: 1px solid var(--border-subtle);
        background: var(--bg-card);
        color: var(--text-primary);
        font-size: 0.75rem;
        cursor: pointer;
        transition: all 0.15s ease;
        &:hover:not(:disabled) {
          background: var(--bg-card-hover);
          border-color: var(--dhan-cyan);
        }
        &:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .material-symbols-rounded { font-size: 16px; }
      }
      .test-result-box {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        border-radius: 8px;
        &.success {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #10b981;
        }
        &.failure {
          background: rgba(244, 63, 94, 0.1);
          border: 1px solid rgba(244, 63, 94, 0.3);
          color: #f43f5e;
        }
      }
      .test-icon { font-size: 24px; flex-shrink: 0; }
      .test-title { font-weight: 700; font-size: 0.875rem; }
      .test-meta {
        font-size: 0.75rem;
        color: var(--text-secondary);
        margin-top: 2px;
      }

      /* Active Sessions Section Styles */
      .kill-others-btn {
        background: rgba(244, 63, 94, 0.15) !important;
        color: #f43f5e !important;
        border: 1px solid rgba(244, 63, 94, 0.3) !important;
        &:hover {
          background: rgba(244, 63, 94, 0.25) !important;
        }
      }
      .sessions-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 16px;
        margin-top: 16px;
      }
      .session-card {
        background: var(--bg-card);
        border: 1px solid var(--border-subtle);
        border-radius: 10px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 14px;
        transition: all 0.2s ease;
        &.current-session {
          border-color: rgba(16, 185, 129, 0.4);
          background: rgba(16, 185, 129, 0.04);
        }
      }
      .session-card-header {
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }
      .session-device-icon {
        width: 40px;
        height: 40px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.05);
        color: var(--text-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        &.current-icon {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
        }
        .material-symbols-rounded { font-size: 22px; }
      }
      .session-info {
        flex: 1;
        min-width: 0;
      }
      .session-name {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        font-size: 0.875rem;
        color: var(--text-primary);
        margin-bottom: 4px;
      }
      .current-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: 12px;
        background: rgba(16, 185, 129, 0.15);
        border: 1px solid rgba(16, 185, 129, 0.3);
        color: #10b981;
        font-size: 0.7rem;
        font-weight: 600;
        .material-symbols-rounded { font-size: 14px; }
      }
      .session-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.75rem;
        color: var(--text-muted);
        flex-wrap: wrap;
        .meta-dot { opacity: 0.5; }
      }
      .session-actions-box {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        padding-top: 10px;
        border-top: 1px solid var(--border-subtle);
      }
      .session-active-indicator {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.75rem;
        font-weight: 600;
        color: #10b981;
      }
      .pulsing-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #10b981;
        box-shadow: 0 0 8px #10b981;
        animation: pulseDot 2s infinite ease-in-out;
      }
      @keyframes pulseDot {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.4; transform: scale(0.8); }
      }
      .kill-session-btn {
        min-height: 32px;
        font-size: 0.75rem;
        font-weight: 600;
        border-color: rgba(244, 63, 94, 0.3);
        color: #f43f5e;
        &:hover {
          background: rgba(244, 63, 94, 0.15);
        }
      }
      .role-select-compact {
        background: #0B0F19;
        border: 1px solid #1E293B;
        color: #fff;
        font-size: 0.75rem;
        padding: 3px 8px;
        border-radius: 6px;
        outline: none;
        cursor: pointer;
        transition: all 0.15s ease;
        &:hover, &:focus {
          border-color: var(--dhan-cyan);
        }
      }
      .session-count-chip-btn {
        height: 26px;
        padding: 0 8px;
        font-size: 0.75rem;
        border-radius: 6px;
        background: rgba(99, 102, 241, 0.12);
        color: #818cf8;
        border: 1px solid rgba(99, 102, 241, 0.25);
        display: inline-flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
        transition: all 0.15s ease;
        &:hover {
          background: rgba(99, 102, 241, 0.22);
        }
        &.active-filter {
          background: rgba(99, 102, 241, 0.3);
          border-color: #818cf8;
          font-weight: 600;
        }
      }
      .filter-pill-btn {
        height: 28px;
        padding: 0 10px;
        font-size: 0.75rem;
        font-weight: 500;
        border-radius: 14px;
        background: #151C2C;
        color: var(--text-secondary);
        border: 1px solid #1E293B;
        cursor: pointer;
        transition: all 0.15s ease;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        &:hover {
          background: #1E293B;
          color: #fff;
        }
        &.active {
          background: rgba(99, 102, 241, 0.2);
          color: #818cf8;
          border-color: rgba(99, 102, 241, 0.4);
          font-weight: 600;
        }
      }
      .kill-all-user-btn {
        background: rgba(244, 63, 94, 0.15) !important;
        color: #f43f5e !important;
        border: 1px solid rgba(244, 63, 94, 0.3) !important;
        &:hover {
          background: rgba(244, 63, 94, 0.25) !important;
        }
      }
      .user-sessions-panel {
        margin-top: 16px;
        background: #0E131F;
        border: 1px solid #1E293B;
        border-radius: 10px;
        padding: 16px;
      }
      .inspected-sessions-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-top: 12px;
      }
      .inspected-session-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 14px;
        background: #151C2C;
        border: 1px solid #1E293B;
        border-radius: 8px;
        gap: 12px;
        flex-wrap: wrap;
      }

      /* Mobile Optimizations for Platform Settings */
      @media (max-width: 768px) {
        .page-body { padding: 12px 14px 80px; }
        .control-header-card { padding: 14px 16px; margin-bottom: 16px; gap: 12px; }
        .page-title { font-size: 1.15rem; }
        .page-icon { font-size: 24px; }
        .quick-status-ribbon { gap: 6px; }
        .status-pill { padding: 4px 8px; font-size: 0.7rem; }
        .settings-container { gap: 16px; }
        .settings-section-card { padding: 14px 16px; border-radius: 10px; }
        .section-header { flex-direction: column; align-items: stretch; gap: 12px; margin-bottom: 14px; padding-bottom: 12px; }
        .section-actions { width: 100%; }
        .section-actions button, .action-btn-primary { width: 100%; justify-content: center; min-height: 40px; }
        .token-details-grid, .fs-status-grid, .lot-sizes-inputs-grid { grid-template-columns: 1fr; gap: 10px; }
        .inspector-controls-bar { flex-direction: column; align-items: stretch; gap: 8px; }
        .search-box { min-width: 0; width: 100%; }
        .filter-pills { flex-wrap: wrap; }
        .inspector-tab-content { padding: 12px 10px; }
      }
      @media (max-width: 480px) {
        .lot-inputs-dual-grid { grid-template-columns: 1fr; gap: 8px; }
        .quick-lot-pills { flex-direction: column; }
        .quick-pill { min-height: 36px; display: flex; align-items: center; justify-content: center; }
      }
    `,
  ],
})
export class SettingsPageComponent implements OnInit {
  readonly authService = inject(AuthService);
  readonly userAuthService = inject(UserAuthService);
  readonly instrumentService = inject(InstrumentService);
  readonly firestoreApi = inject(FirestoreApiService);
  readonly alertService = inject(AlertService);
  readonly orderService = inject(OrderService);
  private readonly snackBar = inject(MatSnackBar);

  // App User Password Change
  readonly currentPasswordInput = signal('');
  readonly newPasswordInput = signal('');
  readonly isChangingPassword = signal(false);

  // User Management State (Restricted to 'sarang')
  readonly usersList = signal<UserSummary[]>([]);
  readonly isLoadingUsers = signal(false);
  readonly isCreatingUser = signal(false);
  readonly isSubmittingUser = signal(false);
  readonly newUsernameInput = signal('');
  readonly newUserPasswordInput = signal('');
  readonly newUserRoleInput = signal('trader');
  readonly editingUser = signal<UserSummary | null>(null);
  readonly editUserRoleInput = signal('trader');
  readonly editUserPasswordInput = signal('');
  readonly isUpdatingUserRole = signal<string | null>(null);

  // Active Sessions Management (Integrated in User Management & Access Control)
  readonly allSessions = signal<ActiveSession[]>([]);
  readonly activeSessionFilter = signal<string>('ALL');
  readonly isLoadingSessions = signal(false);
  readonly mySessions = signal<ActiveSession[]>([]);
  readonly inspectedUsername = signal<string | null>(null);
  readonly inspectedUserSessions = signal<ActiveSession[]>([]);
  readonly isLoadingInspectedSessions = signal(false);
  readonly filteredSessions = computed(() => {
    const f = this.activeSessionFilter();
    const list = this.allSessions();
    if (f === 'ALL') return list;
    return list.filter((s) => s.username?.toLowerCase() === f.toLowerCase());
  });

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
    this.instrumentService.fetchOptionsSyncStatus().subscribe();
    this.instrumentService.fetchLotSizes().subscribe();
    this.instrumentService.fetchConfiguredIndices().subscribe();
    this.firestoreApi.refreshStatus().subscribe();
    if (this.userAuthService.isAdmin()) {
      this.loadUsersAndSessions();
    }
  }

  onFlushAndReloadEquities(): void {
    if (!confirm('Are you sure you want to completely flush and reload cash equities and benchmark indices from Dhan?')) {
      return;
    }
    this.instrumentService.flushAndReloadEquities().subscribe();
  }

  onFlushAndReloadOptions(): void {
    if (!confirm('Are you sure you want to completely flush and reload traded index options contracts from Dhan?')) {
      return;
    }
    this.instrumentService.flushAndReloadOptions().subscribe();
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

    const updatedIndices: IndexConfigItem[] = this.indicesList
      .filter((idx) => !idx.symbol.toUpperCase().includes('FIN'))
      .map((idx) => {
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

  changeAppPassword(): void {
    const current = this.currentPasswordInput().trim();
    const newPwd = this.newPasswordInput().trim();

    if (!current || !newPwd) {
      this.snackBar.open('Please fill both current and new password', 'Dismiss', { duration: 3000 });
      return;
    }

    if (newPwd.length < 6) {
      this.snackBar.open('New password must be at least 6 characters long', 'Dismiss', { duration: 3000 });
      return;
    }

    this.isChangingPassword.set(true);
    this.userAuthService.changePassword({
      currentPassword: current,
      newPassword: newPwd,
    }).subscribe({
      next: () => {
        this.isChangingPassword.set(false);
        this.currentPasswordInput.set('');
        this.newPasswordInput.set('');
      },
      error: (err) => {
        this.isChangingPassword.set(false);
        const msg = err?.error?.message || 'Failed to change password. Please verify current password.';
        this.snackBar.open(msg, 'Dismiss', { duration: 4000 });
      },
    });
  }

  // =========================================================================
  // USER CRUD OPERATIONS (Restricted strictly to 'admin' role)
  // =========================================================================

  loadUsersList(): void {
    if (!this.userAuthService.isAdmin()) return;
    this.isLoadingUsers.set(true);
    this.userAuthService.listUsers().subscribe({
      next: (users) => {
        this.isLoadingUsers.set(false);
        this.usersList.set(users || []);
      },
      error: (err) => {
        this.isLoadingUsers.set(false);
        const msg = err?.error?.message || 'Failed to load users list';
        this.snackBar.open(msg, 'Dismiss', { duration: 4000 });
      },
    });
  }

  onRoleChange(user: UserSummary, newRole: string): void {
    if (user.role === newRole) return;
    this.isUpdatingUserRole.set(user.username);
    this.userAuthService.updateUser(user.username, { role: newRole }).subscribe({
      next: () => {
        this.isUpdatingUserRole.set(null);
        this.loadUsersList();
      },
      error: (err) => {
        this.isUpdatingUserRole.set(null);
        const msg = err?.error?.message || `Failed to update role for ${user.username}`;
        this.snackBar.open(msg, 'Dismiss', { duration: 4000 });
        this.loadUsersList();
      },
    });
  }

  openCreateUserForm(): void {
    this.newUsernameInput.set('');
    this.newUserPasswordInput.set('');
    this.newUserRoleInput.set('trader');
    this.isCreatingUser.set(true);
  }

  submitCreateUser(): void {
    const username = this.newUsernameInput().trim();
    const password = this.newUserPasswordInput().trim();
    const role = this.newUserRoleInput();

    if (!username || !password) {
      this.snackBar.open('Username and password are required', 'Dismiss', { duration: 3000 });
      return;
    }

    this.isSubmittingUser.set(true);
    this.userAuthService.createUser({ username, password, role }).subscribe({
      next: () => {
        this.isSubmittingUser.set(false);
        this.isCreatingUser.set(false);
        this.loadUsersList();
      },
      error: (err) => {
        this.isSubmittingUser.set(false);
        const msg = err?.error?.message || 'Failed to create user';
        this.snackBar.open(msg, 'Dismiss', { duration: 5000 });
      },
    });
  }

  startEditUser(u: UserSummary): void {
    this.editingUser.set(u);
    this.editUserRoleInput.set(u.role || 'trader');
    this.editUserPasswordInput.set('');
  }

  submitUpdateUser(): void {
    const user = this.editingUser();
    if (!user) return;

    const role = this.editUserRoleInput();
    const password = this.editUserPasswordInput().trim();

    this.isSubmittingUser.set(true);
    this.userAuthService.updateUser(user.username, {
      role,
      password: password || undefined,
    }).subscribe({
      next: () => {
        this.isSubmittingUser.set(false);
        this.editingUser.set(null);
        this.loadUsersList();
      },
      error: (err) => {
        this.isSubmittingUser.set(false);
        const msg = err?.error?.message || 'Failed to update user';
        this.snackBar.open(msg, 'Dismiss', { duration: 5000 });
      },
    });
  }

  confirmDeleteUser(username: string): void {
    const clean = username.trim().toLowerCase();
    if (clean === 'sarang') {
      this.snackBar.open('Cannot delete superuser account sarang', 'Dismiss', { duration: 4000 });
      return;
    }
    const current = (this.userAuthService.currentUser()?.username || '').trim().toLowerCase();
    if (clean === current) {
      this.snackBar.open('Cannot delete your own logged-in account', 'Dismiss', { duration: 4000 });
      return;
    }

    if (!confirm(`Are you sure you want to permanently delete user account '${username}'?`)) {
      return;
    }

    this.userAuthService.deleteUser(username).subscribe({
      next: () => {
        this.loadUsersList();
      },
      error: (err) => {
        const msg = err?.error?.message || 'Failed to delete user';
        this.snackBar.open(msg, 'Dismiss', { duration: 5000 });
      },
    });
  }

  // =========================================================================
  // ACTIVE SESSIONS METHODS (Integrated in User Management & Access Control)
  // =========================================================================

  loadUsersAndSessions(): void {
    this.loadUsersList();
    this.loadAllSessions();
  }

  loadAllSessions(): void {
    this.isLoadingSessions.set(true);
    this.userAuthService.getAllSessions().subscribe({
      next: (sessions) => {
        const list = sessions || [];
        this.allSessions.set(list);
        this.mySessions.set(list);
        this.isLoadingSessions.set(false);
      },
      error: () => this.isLoadingSessions.set(false),
    });
  }

  loadMySessions(): void {
    this.loadAllSessions();
  }

  filterSessionsByUser(username: string): void {
    if (this.activeSessionFilter().toLowerCase() === username.toLowerCase()) {
      this.activeSessionFilter.set('ALL');
      this.inspectedUsername.set(null);
    } else {
      this.activeSessionFilter.set(username);
      this.inspectedUsername.set(username);
      // Also load into inspectedUserSessions for backward compatibility
      this.inspectedUserSessions.set(
        this.allSessions().filter((s) => s.username?.toLowerCase() === username.toLowerCase())
      );
    }
  }

  confirmKillSession(session: ActiveSession): void {
    if (!confirm(`Are you sure you want to terminate session on ${session.browser} (${session.os}) for user '${session.username}'?`)) {
      return;
    }
    this.userAuthService.killUserSession(session.username, session.id).subscribe({
      next: () => {
        this.loadUsersAndSessions();
      },
    });
  }

  confirmKillOtherSessions(): void {
    if (!confirm('Are you sure you want to terminate all other active sessions for current user? All other logged-in devices will be signed out.')) {
      return;
    }
    this.userAuthService.killOtherSessions().subscribe({
      next: () => {
        this.loadUsersAndSessions();
      },
    });
  }

  inspectUserSessions(username: string): void {
    this.filterSessionsByUser(username);
  }

  loadInspectedUserSessions(username: string): void {
    this.filterSessionsByUser(username);
  }

  confirmKillInspectedSession(sessionId: string): void {
    const user = this.inspectedUsername() || this.activeSessionFilter();
    if (!user || user === 'ALL') return;
    if (!confirm(`Are you sure you want to terminate this session for user '${user}'?`)) {
      return;
    }
    this.userAuthService.killUserSession(user, sessionId).subscribe({
      next: () => {
        this.loadUsersAndSessions();
      },
    });
  }

  confirmKillAllUserSessions(username: string): void {
    if (!confirm(`Are you sure you want to terminate ALL active sessions for '${username}'? The user will be immediately logged out of all devices.`)) {
      return;
    }
    this.userAuthService.killAllUserSessions(username).subscribe({
      next: () => {
        this.loadUsersAndSessions();
      },
    });
  }
}

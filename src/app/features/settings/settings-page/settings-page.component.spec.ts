import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsPageComponent } from './settings-page.component';
import { AuthService } from '../../../core/api/auth.service';
import { InstrumentService } from '../../../core/api/instrument.service';
import { FirestoreApiService } from '../../../core/api/firestore.service';

describe('SettingsPageComponent', () => {
  let component: SettingsPageComponent;
  let fixture: ComponentFixture<SettingsPageComponent>;

  const mockAuthService = {
    tokenStatus: vi.fn().mockReturnValue({
      configured: true,
      clientId: '1106885516',
      status: 'ACTIVE',
      statusText: 'Active',
      tokenMasked: 'eyJhbGci...mock',
      issuedAtIST: '08 Nov 2026, 09:00:00 AM',
      expiresAtIST: '09 Nov 2026, 09:00:00 AM',
      payload: { userName: 'SARANG' },
    }),
    statusColor: vi.fn().mockReturnValue('green'),
    timeRemainingFormatted: vi.fn().mockReturnValue('23h 59m 00s'),
    isRenewing: vi.fn().mockReturnValue(false),
    refreshStatus: vi.fn(),
    renewToken: vi.fn(),
    updateToken: vi.fn().mockReturnValue(of({ success: true })),
    verifyToken: vi.fn().mockReturnValue(
      of({
        valid: true,
        message: 'Token verified',
        profile: { userName: 'SARANG', clientId: '1106885516' },
      })
    ),
  };

  const mockInstrumentService = {
    syncStatus: vi.fn().mockReturnValue({
      storedInFirestore: true,
      metadata: {
        totalInstruments: 19390,
        totalOptions: 9201,
        totalIndices: 31,
        totalEquities: 10158,
        documentsCount: 12,
        documentIds: ['nifty_50_options_part1', 'indices'],
        updatedAt: '2026-11-08T03:00:00.000Z',
      },
    }),
    lotSizes: vi.fn().mockReturnValue({
      nifty50: 65,
      bankNifty: 30,
      midcapNifty: 120,
      sensex: 20,
      nifty50Lots: 5,
      bankNiftyLots: 5,
      midcapNiftyLots: 5,
      sensexLots: 5,
      indices: [
        { symbol: 'NIFTY 50', name: 'Nifty 50 Index', securityId: '13', exchangeSegment: 'IDX_I', defaultLotSize: 5, defaultQuantityInOneLot: 65, lotSize: 65, defaultLots: 5, defaultQuantity: 325, enabled: true },
        { symbol: 'BANK NIFTY', name: 'Bank Nifty Index', securityId: '25', exchangeSegment: 'IDX_I', defaultLotSize: 5, defaultQuantityInOneLot: 30, lotSize: 30, defaultLots: 5, defaultQuantity: 150, enabled: true },
        { symbol: 'MIDCAP NIFTY', name: 'Nifty Midcap Select', securityId: '442', exchangeSegment: 'IDX_I', defaultLotSize: 5, defaultQuantityInOneLot: 120, lotSize: 120, defaultLots: 5, defaultQuantity: 600, enabled: true },
        { symbol: 'SENSEX', name: 'BSE Sensex Index', securityId: '51', exchangeSegment: 'IDX_I', defaultLotSize: 5, defaultQuantityInOneLot: 20, lotSize: 20, defaultLots: 5, defaultQuantity: 100, enabled: true },
      ],
      updatedAt: '2026-11-08T03:00:00.000Z',
    }),
    isSyncing: vi.fn().mockReturnValue(false),
    isSyncingEquities: vi.fn().mockReturnValue(false),
    isSyncingOptions: vi.fn().mockReturnValue(false),
    isFlushingAndReloading: vi.fn().mockReturnValue(false),
    isFlushingEquities: vi.fn().mockReturnValue(false),
    isFlushingOptions: vi.fn().mockReturnValue(false),
    lastFlushReloadResult: vi.fn().mockReturnValue(null),
    lastFlushEquitiesResult: vi.fn().mockReturnValue(null),
    lastFlushOptionsResult: vi.fn().mockReturnValue(null),
    optionsSyncStatus: vi.fn().mockReturnValue({
      storedInFirestore: true,
      metadata: {
        totalItems: 9809,
        totalChunks: 20,
        chunkSize: 500,
        updatedAt: '2026-11-08T03:00:00.000Z',
      },
      inMemoryCount: 9809,
      tradedIndices: ['NIFTY', 'BANKNIFTY', 'MIDCPNIFTY', 'SENSEX'],
    }),
    isSavingLotSizes: vi.fn().mockReturnValue(false),
    fetchSyncStatus: vi.fn().mockReturnValue(of(null)),
    fetchOptionsSyncStatus: vi.fn().mockReturnValue(of(null)),
    fetchLotSizes: vi.fn().mockReturnValue(of(null)),
    fetchConfiguredIndices: vi.fn().mockReturnValue(of([])),
    updateLotSizes: vi.fn().mockReturnValue(of({ success: true })),
    syncMaster: vi.fn().mockReturnValue(of({ success: true })),
    syncEquities: vi.fn().mockReturnValue(of({ success: true })),
    syncOptions: vi.fn().mockReturnValue(of({ success: true })),
    flushAndReloadMaster: vi.fn().mockReturnValue(of({ success: true })),
    flushAndReloadEquities: vi.fn().mockReturnValue(of({ success: true })),
    flushAndReloadOptions: vi.fn().mockReturnValue(of({ success: true })),
    syncCsv: vi.fn().mockReturnValue(of({ success: true })),
    queryEquities: vi.fn().mockReturnValue(of({ total: 10193, items: [], limit: 20, offset: 0 })),
    queryOptions: vi.fn().mockReturnValue(of({ total: 9809, items: [], limit: 20, offset: 0, expiries: [], tradedIndices: ['NIFTY', 'BANKNIFTY', 'MIDCPNIFTY', 'SENSEX'] })),
  };

  const mockFirestoreApi = {
    status: vi.fn().mockReturnValue({
      configured: true,
      projectId: 'dhan-trader-514002',
      databaseId: 'dhan-trader-firebase-db',
      clientEmail: 'dhan-trader-sv-account@dhan-trader-514002.iam.gserviceaccount.com',
    }),
    isTesting: vi.fn().mockReturnValue(false),
    lastTestResult: vi.fn().mockReturnValue(null),
    refreshStatus: vi.fn().mockReturnValue(of(null)),
    testConnection: vi.fn().mockReturnValue(of({ success: true, latencyMs: 15 })),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: InstrumentService, useValue: mockInstrumentService },
        { provide: FirestoreApiService, useValue: mockFirestoreApi },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the SettingsPageComponent', () => {
    expect(component).toBeTruthy();
  });

  it('should load initial lot sizes in LOTS from InstrumentService', () => {
    expect(component.lotNifty50).toBe(5);
    expect(component.lotBankNifty).toBe(5);
    expect(component.lotMidcapNifty).toBe(5);
    expect(component.lotSensex).toBe(5);
  });

  it('should update token using existing client ID when submitted', () => {
    component.tokenInput = 'eyMockToken123';
    component.submitTokenUpdate();
    expect(mockAuthService.updateToken).toHaveBeenCalledWith({
      token: 'eyMockToken123',
      clientId: '1106885516',
    });
    expect(component.tokenInput).toBe('');
  });

  it('should not display account holder, client id text box, verify live, or refresh status button', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).not.toContain('Account Holder');
    expect(el.querySelector('input[name="clientId"]')).toBeNull();
    expect(el.textContent).not.toContain('Verify Live');
    expect(el.textContent).not.toContain('Refresh Status');
  });

  it('should not display Telegram Bot section or pill', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).not.toContain('Telegram Bot & Notifications Bridge');
    expect(el.querySelector('#telegram-section')).toBeNull();
    expect(el.querySelector('.tg-pill')).toBeNull();
  });

  it('should call updateLotSizes when saving lot sizes', () => {
    component.lotNifty50 = 10;
    component.saveLotSizes();
    expect(mockInstrumentService.updateLotSizes).toHaveBeenCalled();
  });

  it('should not display Reset Defaults button in lots-section', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#lots-section')?.textContent).not.toContain('Reset Defaults');
  });

  it('should not display CSV upload or input options in scrip-section', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#scrip-section input[type="file"]')).toBeNull();
    expect(el.querySelector('#scrip-section textarea')).toBeNull();
    expect(el.querySelector('#scrip-section')?.textContent).not.toContain('Choose CSV File');
    expect(el.querySelector('#scrip-section')?.textContent).not.toContain('Upload & Sync');
  });

  it('should call flushAndReloadEquities when clicking Flush & Reload Equities button and confirmed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const el = fixture.nativeElement as HTMLElement;
    const flushEqBtn = el.querySelector('#scrip-section .flush-equities-btn') as HTMLButtonElement;
    expect(flushEqBtn).toBeTruthy();
    expect(flushEqBtn.textContent).toContain('Flush & Reload Equities');
    flushEqBtn.click();
    expect(mockInstrumentService.flushAndReloadEquities).toHaveBeenCalled();
  });

  it('should call flushAndReloadOptions when clicking Flush & Reload Options button and confirmed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const el = fixture.nativeElement as HTMLElement;
    const flushOptBtn = el.querySelector('#scrip-section .flush-options-btn') as HTMLButtonElement;
    expect(flushOptBtn).toBeTruthy();
    expect(flushOptBtn.textContent).toContain('Flush & Reload Options');
    flushOptBtn.click();
    expect(mockInstrumentService.flushAndReloadOptions).toHaveBeenCalled();
  });

  it('should not display old sync buttons in scrip section', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#scrip-section .sync-equities-btn')).toBeNull();
    expect(el.querySelector('#scrip-section .sync-options-btn')).toBeNull();
    expect(el.querySelector('#scrip-section .sync-master-btn')).toBeNull();
  });

  it('should not display user management section when user does not have admin role', () => {
    component.userAuthService.currentUser.set({ username: 'trader1', role: 'trader' });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#user-crud-section')).toBeNull();
  });

  it('should display user management section, render user list, and allow role updates when user has admin role', () => {
    const mockUsers = [
      { username: 'sarang', role: 'admin', createdAt: '2026-11-15T00:00:00Z', updatedAt: '2026-11-15T00:00:00Z', sessionCount: 1 },
      { username: 'trader1', role: 'trader', createdAt: '2026-11-15T01:00:00Z', updatedAt: '2026-11-15T01:00:00Z', sessionCount: 0 },
    ];
    vi.spyOn(component.userAuthService, 'listUsers').mockReturnValue(of(mockUsers));
    const updateSpy = vi.spyOn(component.userAuthService, 'updateUser').mockReturnValue(of({ success: true, message: 'User updated' }));

    component.userAuthService.currentUser.set({ username: 'admin_officer', role: 'admin' });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const userSection = el.querySelector('#user-crud-section');
    expect(userSection).toBeTruthy();
    expect(userSection?.textContent).toContain('User Management, Access Control & Active Sessions');

    component.loadUsersList();
    fixture.detectChanges();

    expect(component.usersList()).toEqual(mockUsers);
    expect(el.textContent).toContain('sarang');
    expect(el.textContent).toContain('trader1');

    // Verify inline role adjustment
    component.onRoleChange(mockUsers[1], 'admin');
    expect(updateSpy).toHaveBeenCalledWith('trader1', { role: 'admin' });
  });

  it('should totally remove Master Data Inspector & Explorer section from settings page', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#master-data-flush-section')).toBeNull();
    expect(el.querySelector('.master-inspector-card')).toBeNull();
    expect(el.textContent).not.toContain('Master Data Inspector & Explorer');
  });

  it('should render active sessions inside #user-crud-section and allow killing sessions', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const mockSessions = [
      {
        id: 'sess-current',
        username: 'sarang',
        browser: 'Chrome',
        os: 'macOS',
        deviceType: 'Desktop',
        ip: '127.0.0.1',
        createdAt: '2026-11-15T00:00:00Z',
        expiresAt: '2027-11-15T00:00:00Z',
        isCurrent: true,
      },
      {
        id: 'sess-mobile',
        username: 'sarang',
        browser: 'Safari',
        os: 'iOS',
        deviceType: 'Mobile',
        ip: '192.168.1.10',
        createdAt: '2026-11-15T01:00:00Z',
        expiresAt: '2027-11-15T01:00:00Z',
        isCurrent: false,
      },
    ];

    vi.spyOn(component.userAuthService, 'getAllSessions').mockReturnValue(of(mockSessions));
    const killUserSessionSpy = vi.spyOn(component.userAuthService, 'killUserSession').mockReturnValue(of({ success: true, message: 'Session killed' }));
    const killOthersSpy = vi.spyOn(component.userAuthService, 'killOtherSessions').mockReturnValue(of({ success: true, message: 'Other sessions killed', revokedCount: 1 }));

    component.userAuthService.currentUser.set({ username: 'sarang', role: 'admin' });
    fixture.detectChanges();
    component.loadAllSessions();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    // Assert standalone #sessions-section is completely removed
    expect(el.querySelector('#sessions-section')).toBeNull();

    // Assert sessions are rendered inside #user-crud-section
    const userSection = el.querySelector('#user-crud-section');
    expect(userSection).toBeTruthy();
    expect(userSection?.textContent).toContain('User Management, Access Control & Active Sessions');
    expect(userSection?.textContent).toContain('Active Connected Sessions & Devices');
    expect(userSection?.textContent).toContain('Chrome on macOS');
    expect(userSection?.textContent).toContain('Safari on iOS');
    expect(userSection?.textContent).toContain('Current Device');

    // Click Kill Session on mobile session
    const killBtn = userSection?.querySelector('.kill-session-btn') as HTMLButtonElement;
    expect(killBtn).toBeTruthy();
    killBtn.click();
    expect(killUserSessionSpy).toHaveBeenCalledWith('sarang', 'sess-mobile');

    // Click Kill Other Sessions
    const killOthersBtn = userSection?.querySelector('.kill-others-btn') as HTMLButtonElement;
    expect(killOthersBtn).toBeTruthy();
    killOthersBtn.click();
    expect(killOthersSpy).toHaveBeenCalled();
  });

  it('should filter and terminate user sessions from user management table', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const mockUsers = [
      { username: 'trader1', role: 'trader', createdAt: '2026-11-15T01:00:00Z', updatedAt: '2026-11-15T01:00:00Z', sessionCount: 1 },
    ];
    const mockSessions = [
      {
        id: 'sess-trader-1',
        username: 'trader1',
        browser: 'Firefox',
        os: 'Windows',
        deviceType: 'Desktop',
        ip: '10.0.0.5',
        createdAt: '2026-11-15T02:00:00Z',
        expiresAt: '2027-11-15T02:00:00Z',
        isCurrent: false,
      },
    ];

    vi.spyOn(component.userAuthService, 'listUsers').mockReturnValue(of(mockUsers));
    vi.spyOn(component.userAuthService, 'getAllSessions').mockReturnValue(of(mockSessions));
    const killAllSpy = vi.spyOn(component.userAuthService, 'killAllUserSessions').mockReturnValue(of({ success: true, message: 'All killed', revokedCount: 1 }));

    component.userAuthService.currentUser.set({ username: 'sarang', role: 'admin' });
    fixture.detectChanges();
    component.loadUsersAndSessions();
    fixture.detectChanges();

    // Filter trader1 sessions
    component.filterSessionsByUser('trader1');
    fixture.detectChanges();

    expect(component.activeSessionFilter()).toBe('trader1');
    expect(component.filteredSessions().length).toBe(1);
    expect(component.filteredSessions()[0].username).toBe('trader1');

    const el = fixture.nativeElement as HTMLElement;
    const userSection = el.querySelector('#user-crud-section');
    expect(userSection).toBeTruthy();
    expect(userSection?.textContent).toContain('Firefox on Windows');
    expect(userSection?.textContent).toContain('@trader1');

    // Kill all sessions for trader1
    component.confirmKillAllUserSessions('trader1');
    expect(killAllSpy).toHaveBeenCalledWith('trader1');
  });
});

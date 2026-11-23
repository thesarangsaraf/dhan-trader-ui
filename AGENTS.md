# AGENTS.md — Dhan Trader UI Agent Guidelines

This document provides operational context, architectural contracts, design rules, and development guidelines for AI agents working on the **Dhan Trader UI** repository.

---

## 1. Project Mission & Identity

- **Name**: Dhan Trader Pro UI
- **Role**: High-performance, reactive, trader-friendly Single-Page Application (SPA) interfacing directly with the **Dhan Trader Backend API v2.0.0** (Local: `http://127.0.0.1:8000`, Production Cloud Run: `https://dhan-trader-api-218680608145.asia-south1.run.app`).
- **Core Value Proposition**: Index Price Monitoring coupled with sub-millisecond Instant & Automated Conditional Execution (ATM Call/Put options and equity orders).

---

## 2. Technology Stack & Design System

- **Framework**: Angular 19+ (Standalone Components, Signals, Computed Signals).
- **Design Language**: Google Material Design 3 (Material You / M3 dynamic tokens).
- **Component Library**: `@angular/material` (M3 tokens) + `@angular/cdk`.
- **Theming**:
  - **Dark Mode (Strict / Only)**: Deep Slate (`#0B0F19`), Surface Container (`#151C2C`), Elevated Card (`#1E293B`). Light mode is permanently disabled and removed.
  - **Brand Colors**: Dhan Cyan (`#00D2C4`), Indigo (`#6366F1`).
  - **Semantic Trading Colors**: Mint Emerald (`#10B981`) for Profit/Buy/Long, Rose Coral (`#F43F5E`) for Loss/Sell/Short, Amber Glow (`#F59E0B`) for Pending/Triggered.
- **Typography**: Google Sans / Roboto Flex paired with **JetBrains Mono** for all monetary values, strike prices, and IST timestamps.

---

## 3. Strict Architectural Rules for Agents

### Rule 0: Cross-Repository Backend Coordination (`dhan-trader-api`)
- **For every change in this project, if you think that there is a change needed in backend as well, then there is a backend project in the same folder directory called as `dhan-trader-api` (`../dhan-trader-api`). Go there and make needed changes as well.**
- Always ensure both projects remain in sync, pass their test suites (`npm test`), and compile production builds (`npm run build`) without errors.

### Rule 0.1: Strict Local Backend Connection When Running Locally
- When the UI is running locally (`localhost`, `127.0.0.1`, LAN IP, `*.local`, dev server, or local production preview), the UI MUST connect strictly to the local backend on `http://127.0.0.1:8000`.
- It must NEVER connect to the GCP Cloud Run URL when running locally.
- Only when running in cloud production (e.g. Firebase Hosting `*.web.app`) should it connect to the GCP Cloud Run URL (`https://dhan-trader-api-218680608145.asia-south1.run.app`).
- The `apiPrefixInterceptor` acts as defense-in-depth, automatically redirecting any accidental GCP URLs to `http://127.0.0.1:8000` whenever the UI runs on localhost.

### Rule 1: Always Show Real Data — No Mock / Fake Fallbacks & Zero Secret Leaks
- **Never inject hardcoded mock data or static fallback values** (e.g., fake LTPs, static positions, simulated orders, hardcoded fallback passwords) into services, components, or API calls.
- All metrics (P&L, funds, orders, positions, alerts, lot sizes) must originate dynamically from the backend and Google Cloud Firestore.
- If an endpoint has not returned data yet or is offline, display `--` or `Unavailable`, or throw an explicit section error with a Retry button; do not fall back to synthetic or fake values.
- **Strict Zero Secret Leaks & No Credential Display on UI (CRITICAL)**:
  - **Never display, hint, pre-fill, or output usernames, passwords, default credentials, PINs, or tokens anywhere in the UI.**
  - **The login page and dialogs must NEVER display default credentials chips, helper text with passwords, or pre-filled hints** (e.g. NEVER display `admin / admin123` or default credentials anywhere on screen). This is a critical financial trading platform.
  - Input placeholders must remain strictly generic: `"Enter username"`, `"Enter password"`. Never include example credentials (e.g. never show `(e.g. admin)` in placeholders or labels).

### Rule 2: Graceful Section-Level Error Handling
- **Never crash or show an error across the entire page.** The application shell, navigation, and other functional panels must remain intact.
- Handle errors gracefully at the individual section level using [`SectionErrorComponent`](src/app/shared/components/section-error/section-error.component.ts).
- Every section error card must provide a human-readable message (e.g., `"Failed to load positions: Backend server not available (127.0.0.1:8000)"`) and an interactive **Retry** action button.

### Rule 3: Angular Signals-First Reactive State
- Use Angular Signals (`signal<T>()`, `computed()`) for local and service-level state.
- Keep components `standalone: true`. Do not introduce NgModules.
- Use `inject()` for dependency injection instead of constructor parameter injection.

### Rule 4: Conditional Alert Composer Backend Driven Instruments & Automatic Operator
- Dropdown instrument list must be fetched dynamically from the backend (`GET /api/instruments`).
- The instrument dropdown displays **only the name of instruments** in that box, nothing else.
- The trigger condition is not presented in the UI; trigger condition operator is decided automatically by the backend (`CROSSING_UP` if target $\ge$ LTP, `CROSSING_DOWN` if target $<$ LTP).
- Remarks text box is removed from the composer.
- In the "Execute Instant Order" section:
  - Option expiry selection dropdown is provided, backed by the backend API (`GET /api/instruments/expiries`).
  - Maximum 3 option strike prices around the selected price are displayed for selection, returned by the backend API (`GET /api/instruments/option-contracts`).
  - Product is always `INTRADAY` (MIS) and order type is always `MARKET` (selectors hidden to streamline rapid execution).
  - Number of lots text box is removed; fixed lot size selection buttons (**5**, **10**, and **15 Lots**) are provided with dynamic total quantity calculation (`lots × lotSize`).
- **Automated Stop Loss Alert Order**:
  - Attached Stop Loss alert order option allows automating downside/upside exit protection.
  - No text box to input Stop Loss points; uses defined index stop loss points automatically:
    - **12 points for NIFTY 50**
    - **20 points for BANK NIFTY**
    - **15 points for other scrips**
  - Stop loss trigger calculation:
    - If Buy order (or BUY CALL): `entry - stopLossPoints` (operator: `LESS_THAN` / breakdown).
    - If Sell order (or BUY PUT): `entry + stopLossPoints` (operator: `GREATER_THAN` / breakout).
  - Lifecycle: Both the Entry alert order and Stop Loss alert order are deployed immediately to Dhan HQ API v2 (`POST /alerts/orders`) to **SELL / square off the exact same option contract** that was bought.
  - **Unified Trade Order Card**: In the Live Alert Monitor, Buy orders with attached Stop Loss orders are presented as **a single, unified trade order card** rather than two scattered cards. The child Stop Loss order is embedded directly inside the parent card, displaying its trigger price, point distance (-12 pts / -20 pts), and square-off contract details. Deleting the card removes both the entry and stop loss alerts from Dhan.

### Rule 5: User Authentication & Indefinite Session Persistence
- **Dual-Token Architecture**:
  - The application requires username and password login (`POST /api/user-auth/login`).
  - Access Token: Stateless HS256 JWT (30 days / 2,592,000s). Attached to all authenticated requests via `Authorization: Bearer <accessToken>`. Validated statelessly via HMAC-SHA256 signature without requiring database lookups, surviving backend server restarts and reboots seamlessly.
  - Refresh Token: Long-lived cryptographically secure random token (365 days / 1 year), stored in `localStorage` and synced with Firestore `users/{username}`.
- **Indefinite Persistent Login ("Stay Logged In")**:
  - Exactly like major platforms (Twitter/X, Facebook, LinkedIn), user sessions remain active indefinitely across browser restarts, reboots, and tab closures.
  - The session expires **strictly and only when the user explicitly clicks Sign Out or clears their entire browser history, cache, cookies, and site data**.
  - `userAuthInterceptor`: Intercepts 401 Unauthorized responses and silently refreshes the access token in the background using `POST /api/user-auth/refresh`, retrying the failed request seamlessly.
- **Route Protection**:
  - All workspace routes (`/`, `/trades`, `/settings`) are guarded by `authGuard`. Unauthenticated users are redirected to `/login`.
  - The `/login` route is protected by `guestGuard`, redirecting authenticated users to the dashboard (`/`).
  - The top navigation bar (`<app-header>`) is hidden when unauthenticated.
- **Account Management & Password Updates**:
  - Admin can reset user passwords via the Settings page (`PUT /api/user-auth/users/{username}`).
  - Never display credentials, default hints, or pre-filled passwords in any UI component or label.
- **Role-Based Access Control (RBAC) & User Management (Restricted to 'admin' role)**:
  - User accounts and roles (`admin`, `trader`, `viewer`) are stored in Google Cloud Firestore collection `users` (document ID = `username.toLowerCase()`).
  - **Role-Based Authorization**: Users with the `admin` role are authorized to view and manage the User Management & Active Sessions section on the Settings page, view and adjust roles (`admin`, `trader`, `viewer`), create/update/delete users, and inspect/terminate active device sessions across users. For non-`admin` users (`trader`, `viewer`), this section is completely hidden in the UI.
  - **Declarative Decorator / Annotation (@Roles)**: On the REST API backend, role permissions are enforced cleanly using the NestJS `@Roles(UserRole.ADMIN)` annotation and global `RolesGuard` rather than static string checks. Unauthorized callers receive HTTP 403 Forbidden.
  - The seed superuser `sarang` account is permanently protected from deletion and demotion.
  - Passwords are encrypted using memory-hard `scrypt` hashing and are never exposed in user list responses.

### Rule 6: Mandatory Cross-Device Responsive Compatibility (Desktop & Mobile First-Class Support)
- **Core Contract**: Dhan Trader Pro is a critical trading application used simultaneously on desktop workstations and on-the-go mobile devices (iOS Safari, Android Chrome, mobile PWA). **Every new change, feature, dialog, or UI component MUST be 100% compatible with and responsive across both desktop and mobile viewports.**
- **Standard Breakpoints**:
  - **Mobile Phones**: `≤ 480px` (e.g. 320px, 360px, 375px, 390px, 412px, 430px)
  - **Phablets & Small Tablets**: `481px – 768px`
  - **Tablets & iPad Portrait**: `769px – 1023px`
  - **Desktop / Workstation**: `≥ 1024px`
- **Zero Horizontal Overflow Rule**:
  - No page, container, card, modal, or form element may cause horizontal scrolling or overflow on mobile screens (`max-width: 100vw; overflow-x: hidden`).
  - Always reset hardcoded desktop `min-width` (e.g. `min-width: 560px`) in `@media (max-width: 1023px)` and `@media (max-width: 768px)` using `min-width: 0 !important; width: 100% !important; max-width: 100% !important;`.
- **Mobile Navigation Bar Clearance**:
  - The application features a persistent bottom navigation bar on mobile (`height: 56px + env(safe-area-inset-bottom)`).
  - Never wrap page content in nested `height: 100%; overflow-y: auto;` containers that prevent scroll awareness; use `min-height: 100%;` and ensure proper bottom padding so that the lowest action buttons, cards, or table rows are never hidden behind the navigation bar.
- **Card-Based Mobile Layouts for Complex Tables**:
  - Wide multi-column tables (e.g. Positions, Order Book, Trade History) are unwieldy on mobile phone screens. Always provide dedicated responsive mobile card views (`.results-cards-list` / `.setup-mobile-card`) or adaptive flex layouts that highlight critical metrics (Symbol, Price, P&L, Strategy) and prominent touch action buttons without requiring horizontal scrolling.
- **Touch Target & Button Ergonomics**:
  - All interactive elements (buttons, toggles, chips, icon triggers) on mobile must have touch targets of at least 36px–44px with comfortable spacing.
  - Directional toggles (CALL/PUT) should sit side-by-side (50% width each) on mobile rather than consuming excessive vertical screen space.
- **Header & Pill Responsiveness**:
  - On mobile viewports (`≤ 768px`), top header elements must prioritize live funds and token expiry while hiding long brand badges and truncating/iconifying user chips to prevent top app bar overflow.
  - On tablets (`769px – 1023px`), navigation tabs and status chips must use compact padding and icon representations to prevent colliding with brand titles.

---

## 4. Backend Endpoints & API Contract (`http://127.0.0.1:8000`)

> [!TIP]
> **Full API Schema & In/Out Payloads**:
> If an agent needs full details about the backend APIs, parameters, and input/output payload schemas, inspect the OpenAPI specification available at:
> `http://localhost:8000/api/docs/openapi.json` (or `http://127.0.0.1:8000/api/docs/openapi.json`).

| Endpoint | Method | Tag | Description |
| :--- | :---: | :--- | :--- |
| `/health` | `GET` | System | Healthcheck & service status |
| `/api/user-auth/login` | `POST` | User Auth | Authenticate username & password, issue JWT + persistent refresh token |
| `/api/user-auth/refresh` | `POST` | User Auth | Silently renew short-lived access token using persistent refresh token |
| `/api/user-auth/logout` | `POST` | User Auth | Revoke active refresh token session |
| `/api/user-auth/me` | `GET` | User Auth | Retrieve profile information of authenticated user |
| `/api/user-auth/status` | `GET` | User Auth | Check user authentication readiness and configuration |
| `/api/user-auth/sessions` | `GET`, `DELETE` | User Auth | List current user active sessions or kill all other sessions |
| `/api/user-auth/sessions/{id}` | `DELETE` | User Auth | Terminate/kill a specific active session for current user |
| `/api/user-auth/all-sessions` | `GET` | User Auth | List active sessions across all users (Restricted to `admin` via `@Roles`) |
| `/api/user-auth/users` | `GET`, `POST` | User Auth | List all users or create a new user (Restricted to `admin` via `@Roles`) |
| `/api/user-auth/users/{username}` | `PUT`, `DELETE` | User Auth | Update user role/password or delete user (Restricted to `admin` via `@Roles`) |
| `/api/user-auth/users/{username}/sessions` | `GET`, `DELETE` | User Auth | List or terminate all active sessions for user (Restricted to `admin` via `@Roles`) |
| `/api/user-auth/users/{username}/sessions/{id}` | `DELETE` | User Auth | Terminate specific active session for user (Restricted to `admin` via `@Roles`) |
| `/api/auth/status` | `GET` | Auth | JWT inspection, remaining seconds, IST timestamps |
| `/api/auth/verify` | `GET` | Auth | Verify live validity against Dhan API profile |
| `/api/auth/renew` | `POST` | Auth | 1-Click auto-renew Dhan access token |
| `/api/auth/update` | `POST` | Auth | Hot-reload manual token update |
| `/api/alerts` | `GET`, `POST` | Alerts | List all price alerts or create a new alert |
| `/api/alerts/indices` | `GET` | Alerts | Real-time popular benchmark NSE indices |
| `/api/alerts/{id}/cancel` | `POST` | Alerts | Cancel an active alert |
| `/api/alerts/{id}` | `DELETE` | Alerts | Permanently delete an alert |
| `/api/alerts/test-chime` | `POST` | Alerts | Trigger simulated chime notification |
| `/api/orders` | `GET`, `POST` | Orders | Order book inspection and placement |
| `/api/orders/{id}` | `DELETE` | Orders | Cancel an open pending order |
| `/api/positions` | `GET` | Portfolio | Live positions, account funds, and P&L metrics |
| `/api/instruments?q={term}` | `GET` | Instruments | Search scrip master with debounce |
| `/api/instruments/expiries` | `GET` | Instruments | Available weekly/monthly option expiries |
| `/api/instruments/option-contracts` | `GET`, `POST` | Instruments | 3 strikes (ATM-1, ATM, ATM+1) around target price |
| `/api/instruments/flush-and-reload` | `POST` | Instruments | Totally flush master data from Firestore and reload fresh from Dhan |
| `/api/instruments/flush-and-reload/equities` | `POST` | Instruments | Flush sec_id_to_name_mapping and reload fresh cash equities & indices from Dhan |
| `/api/instruments/flush-and-reload/options` | `POST` | Instruments | Flush index_options and reload fresh traded index options contracts from Dhan |
| `/api/instruments/sync/equities` | `POST` | Instruments | Synchronize cash equities & indices to sec_id_to_name_mapping |
| `/api/instruments/sync/options` | `POST` | Instruments | Synchronize traded index options to index_options |
| `/api/instruments/sync/status` | `GET` | Instruments | Metadata and document status of sec_id_to_name_mapping |
| `/api/instruments/sync/options/status` | `GET` | Instruments | Metadata and document status of index_options |
| `/api/charts/candles` | `GET` | Charts | Historical & intraday OHLC candle data (timeframe & duration) |
| `/api/telegram/status` | `GET` | Telegram | Telegram bot connection state |
| `/api/telegram/test` | `POST` | Telegram | Dispatch test verification message |
| `/api/telegram/update` | `POST` | Telegram | Update Bot Token and Chat ID dynamically |

---

## 5. Folder Structure & Component Hierarchy

```
src/app/
├── core/
│   ├── api/
│   │   ├── alert.service.ts         // Alerts endpoints and live alert state
│   │   ├── auth.service.ts          // Dhan HQ JWT status, countdown, and renewal
│   │   ├── user-auth.service.ts     // App username/password auth, refresh tokens, signals
│   │   ├── instrument.service.ts    // Real scrip search
│   │   ├── order.service.ts         // Orders and positions
│   │   └── telegram.service.ts      // Telegram bot connection & test
│   ├── guards/
│   │   └── auth.guard.ts            // Functional authGuard & guestGuard
│   ├── interceptors/
│   │   ├── api-prefix.interceptor.ts// Auto-prefixes http://127.0.0.1:8000
│   │   ├── user-auth.interceptor.ts // Attaches Bearer JWT & auto-refreshes on 401
│   │   └── error.interceptor.ts     // Global snackbar notification handler
│   ├── models/
│   │   ├── alert.models.ts
│   │   ├── auth.models.ts
│   │   ├── user-auth.models.ts
│   │   ├── instrument.models.ts
│   │   ├── order.models.ts
│   │   └── telegram.models.ts
├── features/
│   ├── auth/
│   │   └── login/                   // M3 dark mode username/password login screen
│   ├── dashboard/
│   │   ├── components/
│   │   │   ├── alert-composer/      // Fixed dropdown (NIFTY/BANK/SENSEX/RELIANCE) + order trigger
│   │   │   ├── alert-list/          // Active/Triggered alerts + progress distance
│   │   │   ├── order-book/          // Live orders table with cancel action
│   │   │   └── positions-summary/   // Real positions, net P&L, 1-click square-off
│   │   └── dashboard.component.ts   // 3-Zone dashboard layout (composer, monitor, positions/orders)
│   └── settings/
│       ├── auth-modal/              // Token inspection, live verify, manual edit
│       ├── telegram-modal/          // Bot token & chat ID configuration
│       └── settings-page/           // Workspace settings & app password change
├── shared/
│   ├── components/
│   │   ├── confirmation-dialog/     // M3 confirmation dialogs
│   │   ├── header/                  // Top app bar with user profile & logout action
│   │   ├── price-badge/             // JetBrains Mono colored P&L badges
│   │   ├── scrip-searcher-modal/    // Spotlight search (Ctrl+K)
│   │   └── section-error/           // Section-level graceful degradation card
│   └── pipes/
│       ├── currency-inr.pipe.ts     // ₹ Indian Rupee formatting
│       └── ist-date.pipe.ts         // Indian Standard Time (IST) formatting
├── app.component.ts
├── app.config.ts
└── app.routes.ts
```

---

## 6. Verification Commands

When modifying or adding features, verify with:

```bash
# 1. Run full unit test suite
npm test -- --watch=false

# 2. Compile production build
npm run build

# 3. Start development server
npm start
```

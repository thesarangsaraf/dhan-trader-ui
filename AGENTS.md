# AGENTS.md — Dhan Trader UI Agent Guidelines

This document provides operational context, architectural contracts, design rules, and development guidelines for AI agents working on the **Dhan Trader UI** repository.

---

## 1. Project Mission & Identity

- **Name**: Dhan Trader Pro UI
- **Role**: High-performance, reactive, trader-friendly Single-Page Application (SPA) interfacing directly with the **Dhan Trader Backend API v2.0.0** (`http://127.0.0.1:8000`).
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

### Rule 1: Always Show Real Data — No Mock / Fake Fallbacks
- **Never inject hardcoded mock data** (e.g., fake LTPs, static positions, simulated orders) into services or components.
- All metrics (P&L, funds, orders, positions, alerts) must originate from real backend responses.
- If an endpoint has not returned data yet or is offline, display `--` or `Unavailable`, not fake numbers or zero currency values.

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

---

## 4. Backend Endpoints & API Contract (`http://127.0.0.1:8000`)

> [!TIP]
> **Full API Schema & In/Out Payloads**:
> If an agent needs full details about the backend APIs, parameters, and input/output payload schemas, inspect the OpenAPI specification available at:
> `http://localhost:8000/api/docs/openapi.json` (or `http://127.0.0.1:8000/api/docs/openapi.json`).

| Endpoint | Method | Tag | Description |
| :--- | :---: | :--- | :--- |
| `/health` | `GET` | System | Healthcheck & service status |
| `/api/auth/status` | `GET` | Auth | JWT inspection, remaining seconds, IST timestamps |
| `/api/auth/verify` | `GET` | Auth | Verify live validity against Dhan API profile |
| `/api/auth/renew` | `POST` | Auth | 1-Click auto-renew Dhan access token |
| `/api/auth/update` | `POST` | Auth | Hot-reload manual token update |
| `/api/alerts` | `GET`, `POST` | Alerts | List all price alerts or create a new alert |
| `/api/alerts/indices` | `GET` | Alerts | Real-time popular benchmark NSE indices |
| `/api/alerts/grouped` | `GET` | Alerts | Alerts grouped by instrument |
| `/api/alerts/{id}/cancel` | `POST` | Alerts | Cancel an active alert |
| `/api/alerts/{id}` | `PUT`, `DELETE` | Alerts | Update or permanently delete an alert |
| `/api/alerts/test-chime` | `POST` | Alerts | Trigger simulated chime notification |
| `/api/orders` | `GET`, `POST` | Orders | Order book inspection and placement |
| `/api/orders/{id}` | `DELETE` | Orders | Cancel an open pending order |
| `/api/positions` | `GET` | Portfolio | Live positions, account funds, and P&L metrics |
| `/api/instruments?q={term}` | `GET` | Instruments | Search scrip master with debounce |
| `/api/instruments/expiries` | `GET` | Instruments | Available weekly/monthly option expiries |
| `/api/instruments/option-contracts` | `GET`, `POST` | Instruments | 3 strikes (ATM-1, ATM, ATM+1) around target price |
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
│   │   ├── auth.service.ts          // JWT status, countdown, and renewal
│   │   ├── instrument.service.ts    // Real scrip search
│   │   ├── order.service.ts         // Orders and positions
│   │   └── telegram.service.ts      // Telegram bot connection & test
│   ├── interceptors/
│   │   ├── api-prefix.interceptor.ts// Auto-prefixes http://127.0.0.1:8000
│   │   └── error.interceptor.ts     // Global snackbar notification handler
│   ├── models/
│   │   ├── alert.models.ts
│   │   ├── auth.models.ts
│   │   ├── instrument.models.ts
│   │   ├── order.models.ts
│   │   └── telegram.models.ts
├── features/
│   ├── dashboard/
│   │   ├── components/
│   │   │   ├── alert-composer/      // Fixed dropdown (NIFTY/BANK/SENSEX/RELIANCE) + order trigger
│   │   │   ├── alert-list/          // Active/Triggered alerts + progress distance
│   │   │   ├── order-book/          // Live orders table with cancel action
│   │   │   └── positions-summary/   // Real positions, net P&L, 1-click square-off
│   │   └── dashboard.component.ts   // 3-Zone dashboard layout (composer, monitor, positions/orders)
│   └── settings/
│       ├── auth-modal/              // Token inspection, live verify, manual edit
│       └── telegram-modal/          // Bot token & chat ID configuration
├── shared/
│   ├── components/
│   │   ├── confirmation-dialog/     // M3 confirmation dialogs
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

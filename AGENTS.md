# AGENTS.md — Dhan Trader UI Agent Guidelines

This document provides operational context, architectural contracts, design rules, and development guidelines for AI agents working on the **Dhan Trader UI** repository.

---

## 1. Project Mission & Identity

- **Name**: Dhan Trader Pro UI
- **Role**: High-performance, reactive, trader-friendly Single-Page Application (SPA) interfacing directly with the **Dhan Trader Backend API v2.0.0** (`http://127.0.0.1:8000`).
- **Core Value Proposition**: Zero Static IP Index Price Monitoring coupled with sub-millisecond Instant & Automated Conditional Execution (ATM Call/Put options and equity orders).

---

## 2. Technology Stack & Design System

- **Framework**: Angular 19+ (Standalone Components, Signals, Computed Signals, and RxJS for polling loops).
- **Design Language**: Google Material Design 3 (Material You / M3 dynamic tokens).
- **Component Library**: `@angular/material` (M3 tokens) + `@angular/cdk`.
- **Theming**:
  - **Dark Mode (Default)**: Deep Slate (`#0B0F19`), Surface Container (`#151C2C`), Elevated Card (`#1E293B`).
  - **Light Mode**: Soft Frost (`#F8FAFC`), Surface Container (`#F1F5F9`).
  - **Brand Colors**: Dhan Cyan (`#00D2C4`), Indigo (`#6366F1`).
  - **Semantic Trading Colors**: Mint Emerald (`#10B981`) for Profit/Buy/Long, Rose Coral (`#F43F5E`) for Loss/Sell/Short, Amber Glow (`#F59E0B`) for Pending/Triggered.
- **Typography**: Google Sans / Roboto Flex paired with **JetBrains Mono** for all monetary values, strike prices, and IST timestamps.
- **Audio Synthesizer**: Web Audio API (`AudioContext`) two-tone synthesizer (D5 $\to$ A5) for trigger chimes and testing.

---

## 3. Strict Architectural Rules for Agents

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

### Rule 4: Conditional Trigger Fixed Instruments Sequence
The conditional alert composer must present instruments in the exact fixed sequence:
1. **NIFTY 50** (`IDX_I`, securityId: `13`, lotSize: 50)
2. **BANK NIFTY** (`IDX_I`, securityId: `25`, lotSize: 30)
3. **SENSEX** (`IDX_I`, securityId: `51`, lotSize: 20)
4. **RELIANCE** (`NSE_EQ`, securityId: `2885`, lotSize: 1)

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
| `/api/alerts/poll?since={id}` | `GET` | Alerts | 1.5s interval long-poll for triggered alerts |
| `/api/alerts/{id}/cancel` | `POST` | Alerts | Cancel an active alert |
| `/api/alerts/{id}` | `PUT`, `DELETE` | Alerts | Update or permanently delete an alert |
| `/api/alerts/test-chime` | `POST` | Alerts | Trigger simulated chime notification |
| `/api/orders` | `GET`, `POST` | Orders | Order book inspection and placement |
| `/api/orders/{id}` | `DELETE` | Orders | Cancel an open pending order |
| `/api/positions` | `GET` | Portfolio | Live positions, account funds, and P&L metrics |
| `/api/holdings` | `GET` | Portfolio | Demat equity portfolio holdings |
| `/api/instruments?q={term}` | `GET` | Instruments | Search scrip master with debounce |
| `/api/telegram/status` | `GET` | Telegram | Telegram bot connection state |
| `/api/telegram/test` | `POST` | Telegram | Dispatch test verification message |
| `/api/telegram/update` | `POST` | Telegram | Update Bot Token and Chat ID dynamically |

---

## 5. Folder Structure & Component Hierarchy

```
src/app/
├── core/
│   ├── api/
│   │   ├── alert.service.ts         // Alerts endpoints + 1.5s polling engine
│   │   ├── auth.service.ts          // JWT status, countdown, and renewal
│   │   ├── instrument.service.ts    // Real scrip search
│   │   ├── order.service.ts         // Orders, positions, and holdings
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
│   └── services/
│       ├── audio-chime.service.ts   // Web Audio API synthesizer
│       └── theme.service.ts         // Material You Dark/Light theme manager
├── features/
│   ├── dashboard/
│   │   ├── components/
│   │   │   ├── alert-composer/      // Fixed dropdown (NIFTY/BANK/SENSEX/RELIANCE) + order trigger
│   │   │   ├── alert-list/          // Active/Triggered alerts + progress distance
│   │   │   ├── order-book/          // Live orders table with cancel action
│   │   │   └── positions-summary/   // Real positions, net P&L, 1-click square-off
│   │   └── dashboard.component.ts   // 3-Zone dashboard layout, header & dock
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

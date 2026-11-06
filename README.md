# Dhan Trader Pro UI — Trading & Alert Engine

A high-performance, reactive, and trader-friendly single-page application (SPA) built with modern **Angular (Standalone Components & Signals)** and **Google Material Design 3 (Material You / M3)**, interfacing directly with the **Dhan Trader Backend API v2.0.0** (`http://127.0.0.1:8000`).

---

## ⚡ Core Features

- **Zero Static IP Index Price Monitoring**: Real-time monitoring of user-traded benchmark indices (NIFTY 50, BANK NIFTY, SENSEX, MIDCAP NIFTY).
- **Sub-millisecond Conditional Execution ("Trigger to Action")**: Direct conditional execution that automatically places orders or F&O legs the moment an index crosses a threshold.
- **Dedicated Traded Indices in Alert Composer**: Focused selector featuring:
  1. `NIFTY 50` (`IDX_I`, 65 lot size)
  2. `BANK NIFTY` (`IDX_I`, 30 lot size)
  3. `SENSEX` (`IDX_I`, 20 lot size)
  4. `MIDCAP NIFTY` (`IDX_I`, 120 lot size)
- **Continuous 1.5s Polling Engine & Web Audio Chime**: Synthesizes pleasant two-tone audio chimes upon trigger events via the Web Audio API (`AudioContext`).
- **Material You Dynamic Theming (Fintech Pro)**: High-contrast Dark mode (`#0B0F19`) and Light mode (`#F8FAFC`) with JetBrains Mono tabular price badges.
- **Graceful Section-Level Error Handling**: If the backend server (`127.0.0.1:8000`) is offline, each section displays a dedicated error card with a retry button without crashing or blanking the rest of the application.
- **Live Portfolio & Real-time Order Book**: Positions with 1-click square-off exit, and live order book with status badges.
- **JWT Lifecycle & Auto-Renewal**: IST countdown clock, color alerts (<60m yellow, <10m red), 1-click token renewal, and manual override dialog.
- **Spotlight Scrip Searcher (`Ctrl + K`)**: Instant command palette to search indices, strikes, and equities.

---

## 🏛️ 3-Zone Architecture

```
+---------------------------------------------------------------------------------------+
|  Top App Bar: Status (JWT Health, Dhan Online, Telegram Bot) | Funds Bar | Quick Actions|
+---------------------------------------------------------------------------------------+
|  LEFT PANEL (35%)             |  CENTER PANEL (40%)           |  RIGHT PANEL (25%)    |
|  - Fixed Scrip Dropdown       |  - Active Alerts & Triggers   |  - Positions & P&L    |
|  - Alert Creator Form         |  - Attached Order Monitor     |  - Order Book (Live)  |
|  - Quick Points Adjusters     |                               |                       |
+---------------------------------------------------------------------------------------+
|  Bottom Dock: Token Expiry Countdown | Live Sound Toggle | Fast Scrip Searcher (Ctrl+K)
+---------------------------------------------------------------------------------------+
```

---

## 🚀 Quick Start

### 1. Prerequisites
Ensure the Dhan Trader Backend server is running on `http://127.0.0.1:8000`.

### 2. Start Development Server
```bash
npm start
# or
ng serve --proxy-config proxy.conf.json
```
Navigate to `http://localhost:4200/`. API requests automatically connect to `http://127.0.0.1:8000`.

### 3. Run Unit Tests
```bash
npm test -- --watch=false
```

### 4. Build for Production
```bash
npm run build
```
Production bundles are generated in `dist/dhan-trader-ui/`.

---

## ⌨️ Shortcuts & Controls

- `Ctrl + K` or `Cmd + K`: Open Spotlight Scrip Searcher
- `Speaker Icon` in Header/Dock: Mute or unmute Web Audio chime
- `Bell Icon` in Header: Test browser audio synthesizer permission
- `Palette Icon`: Toggle Dark / Light Theme
- `Gear Icon`: Open JWT Token Inspector, Manual Update & Profile Verification Modal

---

## 🤖 AI Agent Guidelines

For architectural rules, component contracts, and developer guidelines for AI coding assistants, refer to [AGENTS.md](AGENTS.md).

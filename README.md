# Dhan Trader Pro UI — Trading & Alert Engine

A high-performance, reactive, and trader-friendly single-page application (SPA) built with modern **Angular (Standalone Components & Signals)** and **Google Material Design 3 (Material You / M3)**, interfacing directly with the **Dhan Trader Backend API v2.0.0**.

- **Local Backend**: `http://127.0.0.1:8000`
- **Production Backend (Google Cloud Run)**: `https://dhan-trader-api-218680608145.asia-south1.run.app`

---

## ⚡ Core Features

- **Index Price Monitoring**: Real-time monitoring of user-traded benchmark indices (NIFTY 50, BANK NIFTY, SENSEX, MIDCAP NIFTY).
- **Sub-millisecond Conditional Execution ("Trigger to Action")**: Direct conditional execution that automatically places orders or F&O legs the moment an index crosses a threshold.
- **Dedicated Traded Indices in Alert Composer**: Focused selector featuring:
  1. `NIFTY 50` (`IDX_I`, 65 lot size)
  2. `BANK NIFTY` (`IDX_I`, 30 lot size)
  3. `SENSEX` (`IDX_I`, 20 lot size)
  4. `MIDCAP NIFTY` (`IDX_I`, 120 lot size)
- **Material You Dynamic Theming (Fintech Pro)**: High-contrast Dark mode (`#0B0F19`) with JetBrains Mono tabular price badges.
- **Graceful Section-Level Error Handling**: If the backend server is offline, each section displays a dedicated error card with a retry button without crashing or blanking the rest of the application.
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

## ⚙️ Environments & Configuration

The application dynamically detects its host environment to ensure seamless local trading and cloud deployments:

| Environment | Hostname Condition | Backend API Base URL | Behavior |
| :--- | :--- | :--- | :--- |
| **Local / Dev** | `localhost`, `127.0.0.1`, `*.local`, LAN IP | `http://127.0.0.1:8000` | Strictly connects to local backend. Never connects to GCP URL when running locally. |
| **Production Cloud** | `*.web.app`, `*.firebaseapp.com`, custom domains | `https://dhan-trader-api-218680608145.asia-south1.run.app` | Production Cloud Run backend deployed on GCP |

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
Ensure the Dhan Trader Backend server is running locally on `http://127.0.0.1:8000` or configure your target backend in `src/environments/environment.development.ts`.

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
# or
npm run build:prod
```
Production bundles are compiled into `dist/dhan-trader-ui/browser/` with the Cloud Run API URL embedded.

---

## 🌐 Deploy to Google Firebase Hosting

This UI is configured for hosting on **Google Firebase Hosting** with automated SPA URL rewrites and optimized asset caching.

### Step 1: Install Firebase CLI
If you don't already have the Firebase CLI installed globally, install it via npm:
```bash
npm install -g firebase-tools
```
*(Alternatively, you can prefix commands with `npx firebase-tools` without installing globally.)*

### Step 2: Log into Firebase
Authenticate with your Google account:
```bash
firebase login
```

### Step 3: Connect Your Firebase Project
If your project is not yet linked, list your Firebase projects and link the target project:
```bash
# List available projects
firebase projects:list

# Associate this workspace with your Firebase project
firebase use --add
# (Select your project from the list and assign an alias such as "default" or "production")
```
Alternatively, set the project directly:
```bash
firebase use <YOUR_FIREBASE_PROJECT_ID>
```

### Step 4: Verify `firebase.json` Configuration
The project includes a production-ready `firebase.json`:
- **Public Directory**: `dist/dhan-trader-ui/browser` (Angular 17+ application builder output)
- **SPA Rewrites**: All paths rewrite to `/index.html` for client-side routing
- **HTTP Cache Headers**:
  - Hashed bundles (`.js`, `.css`): Immutable 1-year cache (`max-age=31536000,immutable`)
  - Entry point (`index.html`): `no-cache, no-store, must-revalidate` (immediate updates on new deployments)

```json
{
  "hosting": {
    "public": "dist/dhan-trader-ui/browser",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=31536000,immutable"
          }
        ]
      },
      {
        "source": "/index.html",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "no-cache, no-store, must-revalidate"
          }
        ]
      }
    ]
  }
}
```

### Step 5: Build and Deploy

#### Option A: One-Command Build & Deploy (Recommended)
```bash
npm run deploy:firebase
```

#### Option B: Step-by-Step
```bash
# 1. Compile production build (uses Cloud Run backend)
npm run build

# 2. Deploy hosting assets to Firebase
firebase deploy --only hosting
```

### Step 6: Verify Deployment
Once the deployment finishes, Firebase CLI will output your live hosting URLs:
- `https://<YOUR_FIREBASE_PROJECT_ID>.web.app`
- `https://<YOUR_FIREBASE_PROJECT_ID>.firebaseapp.com`

Open either URL in your browser to verify that the UI loads and connects directly to the Cloud Run backend (`https://dhan-trader-api-218680608145.asia-south1.run.app`).

### Useful Firebase Commands

| Command | Purpose |
| :--- | :--- |
| `firebase deploy --only hosting` | Deploy production build to the live channel |
| `firebase hosting:channel:deploy <channel-name>` | Deploy to a temporary preview channel (e.g. `preview-v1`) |
| `firebase hosting:channels:list` | List all active preview channels |
| `firebase emulators:start --only hosting` | Test Firebase Hosting rewrites locally on `http://localhost:5000` |

---

## 🔒 Security & Strict Zero Static Fallback Policy

1. **No Static Fallback Credentials or Mock Data**:
   - The UI codebase contains zero hardcoded fallback passwords, static security PINs, fake market data, or mock instruments.
   - All authorization verifications (including trade password checks) communicate directly with the live backend API and Google Cloud Firestore.
   - If security services or database endpoints are unavailable, the UI cleanly renders error states rather than falling back to hardcoded static values.

2. **Zero Secret Exposure in UI**:
   - Passwords, access tokens, and PINs are strictly masked and never revealed in placeholders, helper text, labels, or error messages (e.g. placeholders are generic, such as `"Enter trade password"`).

---

## ⌨️ Shortcuts & Controls

- `Ctrl + K` or `Cmd + K`: Open Spotlight Scrip Searcher
- `Palette Icon`: Toggle Dark / Light Theme
- `Gear Icon`: Open JWT Token Inspector, Manual Update & Profile Verification Modal

---

## 🤖 AI Agent Guidelines

For architectural rules, component contracts, and developer guidelines for AI coding assistants, refer to [AGENTS.md](AGENTS.md).

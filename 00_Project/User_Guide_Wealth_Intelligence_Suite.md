# 📘 Step-by-Step User Guide: Wealth Intelligence Suite

**System Version:** v2.1.0 / Nifty 500 Fundamentals Enrollment
**Scope:** Strictly Personal Single-User Investment, Portfolio Management, and Paper Trading
**Architecture:** Pure Offline Web App + Public Market Data Auto-Sync Engine

---

## 🎯 Core Operating Mandate

1. **Strictly Personal Use:** Built exclusively for single-user personal investment & paper trading. Zero enterprise complexity, zero subscription fees, zero cloud dependency.
2. **Mobile-First & Wi-Fi Operable:** Every screen and action is designed to be easily operable on smartphone touchscreens (iOS / Android) over your local Wi-Fi.
3. **Zero-CSV Manual Friction:** Tap **"⚡ Sync Nifty 500 Public Prices"** to automatically update historical technical prices without downloading or uploading CSV files.
4. **100% Broker-Free:** Uses free public market data (Yahoo Finance `.NS` symbols). Zero broker logins, credentials, or API keys required.

---

## 🚀 1. How to Launch the Application

### A. Desktop-Only Mode (Localhost Only)
1. Double-click `Start_Wealth_Suite_Desktop_Only.bat` in `D:\StockInvestmentLab`.
2. Binds strictly to `127.0.0.1:8000` and automatically opens `http://localhost:8000` in your desktop browser.

### B. Home Wi-Fi Mode (Desktop + Mobile Phone)
1. Double-click `Start_Wealth_Suite_Home_WiFi.bat` in `D:\StockInvestmentLab`.
2. Opens `http://localhost:8000` on your desktop PC and displays your private LAN URL (e.g. `http://192.168.1.15:8000`).
3. Connect your **iPhone or Android phone** to the same Home Wi-Fi network and open `http://192.168.x.x:8000` in Safari/Chrome.
4. **Tip:** Add the page to your phone's Home Screen for instant 1-tap app access!

### C. Stopping the Server
1. Double-click `Stop_Wealth_Suite_Server.bat` to cleanly terminate running server instances.

---

## 📊 2. Daily Step-by-Step Workflow Guide

### Step 1: Overview Module
* **Purpose:** Daily factual summary snapshot.
* **Actions:** Check backup currency status (*Current* vs. *Due*), view overall net worth, and use quick action shortcuts to open Paper Trading or Watchlist.

### Step 2: Delivery Screener & 1-Click Public Auto-Sync
* **Purpose:** Find high-quality delivery candidates ranked across 5 quantitative pillars (*Business Quality, Financial Strength, Valuation, Technical Trend, Risk*).
* **Actions:**
  1. Click **`⚡ Sync Nifty 500 Public Prices`** in the Price History Data Center.
  2. Leaving the ticker field blank pulls 250+ daily completed candles for all 500 official Nifty 500 constituents, plus Nifty 50 and Nifty Bank benchmarks.
  3. Search any constituent by ticker, such as `DIXON`, and filter the list by Full Rating, Technical-Only, Data Missing, or Sync Failed.
  4. The ten companies with enrolled fundamental records retain complete 5-pillar Delivery ratings. Other constituents show technical metrics with an explicit **Technical-only — fundamentals not enrolled** label and are never presented as fully rated.
  5. If network access fails for a ticker, click **`Retry Failed Tickers`** to retry only the unsuccessful symbols.

### Step 3: Portfolio Module (Real Investments)
* **Purpose:** Real holdings ledger and realized/unrealized gain tracking.
* **Actions:**
  1. Record dated **BUY** and **SELL** transactions with quantity, purchase price, and asset class.
  2. Review Sector Allocation and Asset Class concentration breakdown.
  3. Realized/unrealized P&L and weighted average costs update automatically.

### Step 4: Watchlist Module
* **Purpose:** Candidate research funnel.
* **Actions:**
  1. Add stocks to watch and assign a category: *Watch*, *Study*, *Buy Soon*, or *Reject*.
  2. Set Target Prices and take notes.
  3. Public market price evidence updates automatically alongside target prices.

### Step 5: Paper Trading Simulation Workspace
* **Purpose:** 1-to-3 month simulation testing for Delivery Screener selections before allocating real money.
* **Actions:**
  1. Set Starting Paper Capital, max allocation per stock (e.g., 20%), and max open holdings.
  2. Select **Paper Buy** on a Delivery Screener candidate.
  3. Record simulated entry price, manual observed date/time/source, and entry reason.
  4. Monitor drawdown, holding periods, and 30/60/90-day returns in **Performance Review**.

### Step 6: Fundamentals & Quality Context
* **Purpose:** Search the Nifty 500 registry, preserve verified financial history, and enroll genuine fundamental evidence without fabricated defaults.
* **Actions:**
  1. Search any constituent by ticker, including `DIXON`. A stock with no record displays **Not Enrolled** and blank values.
  2. Use **Enroll Financial Data** to enter sourced ratios. Partial records may be saved but remain **Fundamentals Incomplete**.
  3. Full Rating requires verified evidence plus ROE, Debt/Equity, P/E, Revenue CAGR, and at least one qualitative moat score.
  4. Mark evidence as verified only after checking the named source. Unverified, missing, future-dated, or stale evidence cannot promote a stock.
  5. Edit operations preserve the previous manual record in enrollment history; delete requires explicit confirmation.
  6. Use the status filter and completion sort to work through Missing, Partial, Unverified, Stale, Verified, and Full Rating candidates. Each ticker shows its missing requirements.
  7. Use **Export CSV Template** for a blank 19-column enrollment sheet. The `DIXON` example row contains only its ticker and fiscal period; no financial values are prefilled.
  8. Use **Import CSV** to preview Create, Update, Skip, and Reject decisions. Only commit after reviewing row-level validation messages.
  9. CSV imports accept quoted commas and multiline evidence text, preserve blanks as missing, restrict enrollment to Nifty 500 tickers, and keep prior period revisions in append-only history.

---

## 💾 3. Storage, Backups & Privacy

* **IndexedDB Local Storage:** Portfolio records, watchlist items, paper trades, price histories, fundamental enrollments, evidence metadata, and enrollment history are stored inside your local browser's IndexedDB.
* **Exporting Backups:** Click **`Export backup`** in the top toolbar to download a `.json` backup file.
* **Restoring Backups:** Click **`Import backup`**, select your `.json` backup file, and confirm. All state is restored with built-in `PER-D01` data protection.

---

## 🛰️ 4. Satellite Application: Intraday Satellite Desk

* **Location:** `D:\IntradaySatelliteDesk` (App) and `D:\Intraday_Trading_Lab` (Engine)
* **Launcher:** Double-click `Run_Intraday_Satellite_Desk.bat`.
* **Purpose:** Dedicated ORB 15 + VWAP + Relative Volume intraday discipline log and paper recommendation terminal with dark cyberpunk UI.
* **Guardrails:** Hard daily loss limits, max 2 trades/day cap, emergency stop button.

---

## 📝 Document Update Policy
This User Guide is maintained automatically alongside application updates. Whenever features, UI navigation, or auto-sync endpoints are modified, this guide is updated to reflect the latest verified baseline.

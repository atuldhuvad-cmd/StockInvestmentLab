/* ============================================================================
   Wealth Intelligence Suite — Shared Data Model
   ============================================================================
   This is the single source of truth every module reads and writes. It maps
   directly onto the approved database schema (schema.sql, approved this
   session) — same entities, same relationships, just JS objects instead of
   SQL rows since the project moved to a pure HTML/CSS/JS architecture.

   Permanent rule: no module ever holds its own private copy of this data.
   Every module reads from window.WealthData and writes back through the
   setters below, then calls persistData() to save. This is what makes
   "enter once, every module sees it" literally true — there is only one
   copy, in memory, shared by reference.
============================================================================ */

const WealthData = (function () {

  function emptyState() {
    return {
      // securities: master ticker list, everything else references this
      securities: {
        // ticker: { displayName, sector, capCategory, isBank, indexMember, active }
      },

      // fundamentals: one entry per ticker, latest snapshot (matches
      // fundamentals_snapshot table — years[], qualitative{}, etc.)
      fundamentals: {
        // ticker: { years: [...], qualitative: {...}, auditorLog: [...],
        //           quarters: [...], fetchedAt, source }
      },

      // holdings: your actual portfolio (matches holdings table)
      // Trimmed 2026-07-13 (Product Simplification Audit): purchaseDate,
      // liquidityTier, and notes removed from this shape — confirmed by
      // project-wide search to have zero functional dependencies.
      // purchaseDate was captured on the add-holding form but never
      // displayed or read anywhere; liquidityTier and notes (for holdings)
      // were named here but never given a form field or any code path at
      // all.
      // active is an optional legacy compatibility field. New holdings do
      // not write it; Portfolio and Intraday include missing/true values and
      // continue to exclude active:false records from older imported backups.
      holdings: [
        // { id, ticker, quantity, avgCost, assetClass, active? }
      ],

      // portfolioTransactions: manual BUY/SELL ledger. Older holdings-only
      // backups do not contain this array and remain valid through the
      // replaceAll() default merge. Manual entries always include a valid
      // transactionDate; imported legacy records may omit it and are shown
      // as date unavailable rather than being assigned an invented date.
      portfolioTransactions: [
        // { id, ticker, type: 'BUY'|'SELL', quantity, price,
        //   transactionDate?, costBasisPerUnit?, realisedGain?, createdAt? }
      ],

      // Delivery paper trading is completely separate from the real
      // Portfolio ledger. Older v1.5 backups omit both fields and receive
      // safe empty/default values through replaceAll().
      paperDeliveryTransactions: [
        // { id, ticker, transactionType: 'BUY'|'SELL', transactionDate,
        //   quantity, price, priceSource?, priceTimestamp?, priceStatus?,
        //   quoteAgeSeconds?, manualPriceNote?, charges, notes, createdAt,
        //   entrySnapshot? }. Price evidence is required for new v1.7
        //   entries; absent fields on legacy v1.6 records remain valid.
      ],
      paperDeliveryConfig: {
        startingCapital: 0,
        maxAllocationPct: 20,
        maxOpenHoldings: 10,
        manualPrices: {}
      },

      // watchlist: stocks under consideration, separate from actual holdings
      // (approved refinement — this table did not exist in the original plan)
      watchlist: [
        // { id, ticker, category: 'Watch'|'Research'|'Buy Soon'|'Reject',
        //   notes, targetPrice, dateAdded, dateUpdated }
      ],

      // researchLibrary: documents + AI analysis (renamed from research_notes
      // per approved refinement — this will hold more than just notes)
      researchLibrary: [
        // { id, ticker, docType, title, content, aiAnalysis, sourceUrl, addedAt }
      ],

      // intradayTrades: the satellite allocation's discipline log — not a
      // signal generator (see intraday-scope-decision.md), a rules-checklist
      // and trade record.
      intradayTrades: [
        // { id, ticker, entryPrice, stopLoss, target, positionSize,
        //   checklistPassed: {sizing, stopSet, riskReward, reasonStated},
        //   status: 'Open'|'Closed-Win'|'Closed-Loss', pnl, notes, dateOpened, dateClosed }
      ],

      // macroIndicators: time series of India macro data
      macroIndicators: {
        // indicatorKey: [ { date, value, source }, ... ]
      },

      // settings: global assumptions used across modules (approved refinement)
      // Trimmed 2026-07-13 (Product Simplification Audit): defaultRiskPct,
      // dcfGrowthRate, dcfDiscountRate, riskFreeRate, marginOfSafety, and
      // sipMonthlyAmount were defined here but never read by any calculation
      // in the app (no DCF or SIP calculator exists) — removed as dead
      // configuration, not because a feature was cut. Only the two settings
      // actually consumed by Intraday remain.
      settings: {
        intradaySatelliteAllocationPct: 15,
        minRiskRewardRatio: 2.0
      },

      // priceCache: latest known price per ticker (kept deliberately simple —
      // this is NOT full OHLCV history; that stays out of scope for the
      // browser-only architecture until/unless a real need justifies it,
      // per the "no rewrite for purity" rule — don't build infrastructure
      // ahead of an actual, present need)
      priceCache: {
        // ticker: { price, asOf }
      },

      // Offline OHLCV history imported from user-selected CSV files. Keys use
      // normalized lookup symbols (e.g. TCS.NS -> TCS) without modifying the
      // securities/fundamentals ticker stored elsewhere. Older backups omit
      // this field and receive an empty object through replaceAll().
      priceHistory: {
        // TICKER: { symbol, sourceSymbol, importedAt, rows: [{date,open,high,low,close,volume}] }
      },

      // meta: bookkeeping about the data itself, not the data
      meta: {
        schemaVersion: 4,
        lastSavedAt: null
      }
    };
  }

  // The live, in-memory state. Exactly one instance, shared by reference —
  // this IS the "shared JavaScript data model" the project now requires.
  let state = emptyState();

  return {
    // ---- Read access ----
    get: () => state,
    getSecurity: (ticker) => state.securities[ticker],
    getFundamentals: (ticker) => state.fundamentals[ticker],
    getHoldings: () => state.holdings,
    getPortfolioTransactions: () => Array.isArray(state.portfolioTransactions) ? state.portfolioTransactions : [],
    getPaperDeliveryTransactions: () => Array.isArray(state.paperDeliveryTransactions) ? state.paperDeliveryTransactions : [],
    getPaperDeliveryConfig: () => ({
      startingCapital: 0,
      maxAllocationPct: 20,
      maxOpenHoldings: 10,
      ...(state.paperDeliveryConfig && typeof state.paperDeliveryConfig === "object" ? state.paperDeliveryConfig : {}),
      manualPrices: state.paperDeliveryConfig && state.paperDeliveryConfig.manualPrices && typeof state.paperDeliveryConfig.manualPrices === "object"
        ? state.paperDeliveryConfig.manualPrices : {}
    }),
    getWatchlist: () => state.watchlist,
    getResearchLibrary: () => state.researchLibrary,
    getSetting: (key) => state.settings[key],
    getAllSettings: () => state.settings,
    getPriceHistory: (ticker) => (state.priceHistory || {})[ticker],

    // ---- Write access — always through these, never direct mutation from
    // a module, so there is exactly one place that changes shape, ever ----
    upsertSecurity(ticker, data) {
      state.securities[ticker] = { ...state.securities[ticker], ...data, ticker };
    },
    upsertFundamentals(ticker, data) {
      state.fundamentals[ticker] = data;
    },
    deleteFundamentals(ticker) {
      delete state.fundamentals[ticker];
    },
    addHolding(holding) {
      const id = Date.now() + Math.random();
      state.holdings.push({ id, ...holding });
      return id;
    },
    removeHolding(id) {
      state.holdings = state.holdings.filter(h => h.id !== id);
    },
    commitPortfolioTransaction(holdings, transaction) {
      state.holdings = holdings;
      if (!Array.isArray(state.portfolioTransactions)) state.portfolioTransactions = [];
      state.portfolioTransactions.push(transaction);
      state.meta = { ...state.meta, schemaVersion: Math.max(Number(state.meta && state.meta.schemaVersion) || 0, 3) };
      return transaction.id;
    },
    addPaperDeliveryTransaction(transaction) {
      if (!Array.isArray(state.paperDeliveryTransactions)) state.paperDeliveryTransactions = [];
      state.paperDeliveryTransactions.push(transaction);
      return transaction.id;
    },
    removePaperDeliveryTransaction(id) {
      state.paperDeliveryTransactions = (Array.isArray(state.paperDeliveryTransactions) ? state.paperDeliveryTransactions : [])
        .filter(transaction => transaction.id !== id);
    },
    updatePaperDeliveryConfig(updates) {
      const current = state.paperDeliveryConfig && typeof state.paperDeliveryConfig === "object"
        ? state.paperDeliveryConfig : {};
      state.paperDeliveryConfig = { ...current, ...updates };
    },
    addWatchlistItem(item) {
      const id = Date.now() + Math.random();
      state.watchlist.push({ id, dateAdded: new Date().toISOString(), ...item });
      return id;
    },
    removeWatchlistItem(id) {
      state.watchlist = state.watchlist.filter(w => w.id !== id);
    },
    addResearchNote(note) {
      const id = Date.now() + Math.random();
      state.researchLibrary.push({ id, addedAt: new Date().toISOString(), ...note });
      return id;
    },
    getIntradayTrades: () => state.intradayTrades,
    addIntradayTrade(trade) {
      const id = Date.now() + Math.random();
      state.intradayTrades.push({ id, dateOpened: new Date().toISOString(), status: "Open", ...trade });
      return id;
    },
    updateIntradayTrade(id, updates) {
      const trade = state.intradayTrades.find(t => t.id === id);
      if (trade) Object.assign(trade, updates);
    },
    removeIntradayTrade(id) {
      state.intradayTrades = state.intradayTrades.filter(t => t.id !== id);
    },
    updateSetting(key, value) {
      state.settings[key] = value;
    },
    setPriceHistory(ticker, record) {
      if (!state.priceHistory || typeof state.priceHistory !== "object") state.priceHistory = {};
      state.priceHistory[ticker] = record;
      state.meta = { ...state.meta, schemaVersion: Math.max(Number(state.meta && state.meta.schemaVersion) || 0, 4) };
    },

    // ---- Whole-state operations, used by the persistence layer ----
    replaceAll(newState) {
      // Merge onto emptyState() so an older exported file missing newer
      // fields (e.g. a future schema addition) doesn't crash the app —
      // missing keys fall back to sane defaults instead of undefined.
      state = { ...emptyState(), ...newState };
    },
    reset() {
      state = emptyState();
    }
  };
})();

/* ============================================================================
   Wealth Intelligence Suite — Persistence Layer
   ============================================================================
   Two mechanisms, both required per the approved plan:
     1. IndexedDB — automatic, silent, survives closing the tab. This is the
        "don't have to remember to save" layer.
     2. Export/Import JSON — an explicit, portable file you can back up, move
        between machines, or put in a synced folder. This is the "not trapped
        in one browser's storage" layer.

   Deliberately simple IndexedDB usage: ONE object store, ONE record, holding
   the entire WealthData state as a single JSON blob under a fixed key. This
   is not "one table per entity" — that would be reintroducing database
   complexity into a browser storage API that doesn't need it. The whole
   point of the shared-data-model architecture is that there's one object;
   IndexedDB just needs to persist that one object, nothing more granular.
============================================================================ */

const Persistence = (function () {
  const DB_NAME = "WealthIntelligenceSuite";
  const DB_VERSION = 1;
  const STORE_NAME = "appState";
  const RECORD_KEY = "main"; // single-user, single-document — one fixed key, always

  // Recognized top-level sections of a WealthData backup. Used by importFromFile
  // to tell a real backup apart from arbitrary JSON (PER-D01 fix). A genuine
  // backup — including an older one missing newer fields — always carries at
  // least one of these; {}, arrays, and unrelated objects carry none.
  const BACKUP_KEYS = [
    "securities", "fundamentals", "holdings", "portfolioTransactions",
    "paperDeliveryTransactions", "paperDeliveryConfig", "watchlist",
    "researchLibrary", "intradayTrades", "macroIndicators", "settings",
    "priceCache", "priceHistory", "meta"
  ];

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function save() {
    try {
      const db = await openDB();
      const state = WealthData.get();
      state.meta.lastSavedAt = new Date().toISOString();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(state, RECORD_KEY);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.error("IndexedDB save failed:", e);
      return false;
    }
  }

  async function load() {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).get(RECORD_KEY);
        req.onsuccess = () => {
          if (req.result) {
            WealthData.replaceAll(req.result);
            resolve(true);
          } else {
            resolve(false); // no saved state yet — first run
          }
        };
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.error("IndexedDB load failed:", e);
      return false;
    }
  }

  async function exportToFile() {
    const state = WealthData.get();
    const backupTimestamp = new Date().toISOString();
    const exportState = {
      ...state,
      meta: { ...(state.meta || {}), lastBackupAt: backupTimestamp }
    };
    const blob = new Blob([JSON.stringify(exportState, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = backupTimestamp.slice(0, 10);
    a.href = url;
    a.download = `wealth-intelligence-backup-${dateStr}.json`;
    try {
      document.body.appendChild(a);
      a.click();
      state.meta = { ...(state.meta || {}), lastBackupAt: backupTimestamp };
      const saved = await save();
      if (!saved) throw new Error("Backup downloaded, but its timestamp could not be saved locally.");
      return backupTimestamp;
    } finally {
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  function importFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          // PER-D01 fix (2026-07-23): the earlier check only confirmed "is an
          // object", so {}, arrays, and any wrong-shape object passed and were
          // then merged onto emptyState() by replaceAll() — silently wiping
          // real data, the exact outcome this guard is meant to prevent. Now
          // require the file to look like a Wealth Intelligence backup: a plain
          // object (not an array) carrying at least one recognized section.
          if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)
              || !BACKUP_KEYS.some(k => k in parsed)) {
            throw new Error("File does not look like a Wealth Intelligence backup.");
          }
          WealthData.replaceAll(parsed);
          await save();
          resolve(true);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  return { save, load, exportToFile, importFromFile };
})();

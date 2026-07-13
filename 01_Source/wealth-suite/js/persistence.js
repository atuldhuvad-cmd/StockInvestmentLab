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

  function exportToFile() {
    const state = WealthData.get();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `wealth-intelligence-backup-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          // Basic sanity check before trusting an imported file wholesale —
          // an empty or malformed file should not silently wipe real data.
          if (typeof parsed !== "object" || parsed === null) {
            throw new Error("File does not contain a valid JSON object.");
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

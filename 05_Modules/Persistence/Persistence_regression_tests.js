#!/usr/bin/env node
/* ============================================================================
   Persistence — Executable Regression Suite  (Option A: stubbed browser APIs)
   ============================================================================
   Runs the ACTUAL production functions from js/persistence.js
   (save/load/exportToFile/importFromFile) plus the real WealthData.replaceAll
   merge, against in-memory fakes for indexedDB / FileReader / Blob / URL /
   document. Nothing in persistence.js is modified or reimplemented.

   *** FIDELITY LIMITATION (read Persistence_Verification_Report.md) ***
   A stubbed IndexedDB is NOT proof of a real browser round-trip. These fakes
   model the async request/transaction *shape* the code uses; they do not
   reproduce a real browser's IndexedDB engine, quota, versioning, structured-
   clone semantics, or transaction durability. Passing here means the code's
   control flow and data handling are correct against a faithful mock — a real
   on-device Export/Import + reload check is still owed.

   Run: node 05_Modules/Persistence/Persistence_regression_tests.js
============================================================================ */
const fs = require('fs');
const path = require('path');
let passCount = 0, failCount = 0;
function assertExact(label, actual, expected) {
  const pass = actual === expected || (Number.isNaN(actual) && Number.isNaN(expected));
  if (pass) passCount++; else failCount++;
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${label}: expected=${JSON.stringify(expected)}, actual=${JSON.stringify(actual)}`);
  return pass;
}

// ---- In-memory browser-API fakes -------------------------------------------
function installFakes() {
  const stores = {};
  global.indexedDB = {
    _clear() { for (const k of Object.keys(stores)) stores[k].clear(); },
    open() {
      const req = {};
      const db = {
        objectStoreNames: { contains: (n) => n in stores },
        createObjectStore: (n) => { stores[n] = new Map(); return {}; },
        transaction: (storeName) => {
          const tx = {};
          const store = {
            put: (value, key) => { stores[storeName].set(key, value); return {}; },
            get: (key) => { const r = { result: stores[storeName].get(key) }; queueMicrotask(() => r.onsuccess && r.onsuccess()); return r; }
          };
          tx.objectStore = () => store;
          queueMicrotask(() => tx.oncomplete && tx.oncomplete());
          return tx;
        }
      };
      req.result = db;
      queueMicrotask(() => { req.onupgradeneeded && req.onupgradeneeded(); req.onsuccess && req.onsuccess(); });
      return req;
    }
  };
  global.FileReader = class {
    readAsText(file) { queueMicrotask(() => { this.result = file._text; this.onload && this.onload({ target: { result: this.result } }); }); }
  };
  global.__export = { blobText: null, download: null };
  global.Blob = class { constructor(parts) { global.__export.blobText = parts[0]; } };
  global.URL = { createObjectURL: () => "blob:fake", revokeObjectURL() {} };
  global.document = {
    body: { appendChild() {}, removeChild() {} },
    createElement: () => { const a = { click() {}, appendChild() {}, parentNode: null, set download(v) { global.__export.download = v; }, get download() { return global.__export.download; }, href: "" }; return a; }
  };
}
function fakeFile(obj) { return { _text: typeof obj === "string" ? obj : JSON.stringify(obj) }; }

installFakes();
const suiteRoot = path.resolve(__dirname, '..', '..', '01_Source', 'wealth-suite');
eval(fs.readFileSync(path.join(suiteRoot, 'js/data-model.js'), 'utf8') + '\nglobal.WealthData = WealthData;');
eval(fs.readFileSync(path.join(suiteRoot, 'js/persistence.js'), 'utf8') + '\nglobal.Persistence = Persistence;');

(async () => {
  console.log("=== PER-03: load() first-run (empty store) ===");
  WealthData.reset();
  const firstRun = await Persistence.load();
  assertExact("Empty store -> load resolves false (first run)", firstRun, false);
  assertExact("State remains the empty default after a first-run load", WealthData.getHoldings().length, 0);

  console.log("\n=== PER-01/PER-02/round-trip: save() then load() restores state ===");
  WealthData.reset();
  WealthData.addHolding({ ticker: "TCS", quantity: 10, avgCost: 3000, assetClass: "Equity" });
  WealthData.addWatchlistItem({ ticker: "INFY", category: "Watch" });
  const savedOk = await Persistence.save();
  assertExact("save() resolves true", savedOk, true);
  assertExact("save() stamps meta.lastSavedAt (ISO)", !isNaN(new Date(WealthData.get().meta.lastSavedAt).getTime()), true);
  WealthData.reset();
  assertExact("After reset, holdings cleared", WealthData.getHoldings().length, 0);
  const loadedOk = await Persistence.load();
  assertExact("load() resolves true when a record exists", loadedOk, true);
  assertExact("Round-trip restores holdings", WealthData.getHoldings().length, 1);
  assertExact("Round-trip restores the holding's ticker", WealthData.getHoldings()[0].ticker, "TCS");
  assertExact("Round-trip restores watchlist", WealthData.getWatchlist().length, 1);

  console.log("\n=== PER-03 forward-compat: replaceAll fills missing newer fields from emptyState ===");
  WealthData.replaceAll({ holdings: [{ id: 1, ticker: "X", quantity: 1, avgCost: 1 }] }); // a backup with ONLY holdings
  assertExact("Missing priceHistory defaults to {} (no crash)", typeof WealthData.get().priceHistory, "object");
  assertExact("Missing watchlist defaults to [] (no crash)", Array.isArray(WealthData.getWatchlist()), true);
  assertExact("Present field is kept", WealthData.getHoldings()[0].ticker, "X");

  console.log("\n=== PER-04/PER-05: exportToFile() payload + filename + lastBackupAt ===");
  WealthData.reset();
  WealthData.addHolding({ ticker: "HDFCBANK", quantity: 5, avgCost: 1500, assetClass: "Equity" });
  const ts = await Persistence.exportToFile();
  assertExact("exportToFile returns an ISO timestamp", !isNaN(new Date(ts).getTime()), true);
  const payload = JSON.parse(global.__export.blobText);
  assertExact("Exported payload carries meta.lastBackupAt", payload.meta.lastBackupAt, ts);
  assertExact("Exported payload includes the real data", payload.holdings[0].ticker, "HDFCBANK");
  assertExact("Filename is backup-<date>.json", global.__export.download, `wealth-intelligence-backup-${ts.slice(0, 10)}.json`);
  assertExact("Live state.meta.lastBackupAt updated after export", WealthData.get().meta.lastBackupAt, ts);

  console.log("\n=== PER-06: importFromFile rejects non-object JSON (the guard that DOES work) ===");
  async function importRejects(label, raw) {
    let rejected = false;
    try { await Persistence.importFromFile(fakeFile(raw)); } catch (e) { rejected = true; }
    assertExact(label, rejected, true);
  }
  await importRejects("Rejects a JSON string", '"hello"');
  await importRejects("Rejects a JSON number", '123');
  await importRejects("Rejects JSON null", 'null');
  await importRejects("Rejects malformed JSON", '{not valid');

  console.log("\n=== PER-06 positive: a real backup imports and replaces state ===");
  WealthData.reset();
  const goodBackup = { holdings: [{ id: 9, ticker: "ITC", quantity: 2, avgCost: 400 }], watchlist: [], meta: { schemaVersion: 4 } };
  await Persistence.importFromFile(fakeFile(goodBackup));
  assertExact("Valid backup imported", WealthData.getHoldings()[0].ticker, "ITC");

  console.log("\n=== PER-D01 (Confirmed Defect, FIXED 2026-07-23): empty/wrong-shape object is rejected, data preserved ===");
  // Before the fix, importing {} or an array passed the shallow typeof check and
  // replaceAll() wiped real data to emptyState(). The guard now requires a plain
  // object carrying at least one recognized backup section.
  WealthData.reset();
  WealthData.addHolding({ ticker: "REAL", quantity: 1, avgCost: 1, assetClass: "Equity" });
  let emptyRejected = false;
  try { await Persistence.importFromFile(fakeFile({})); } catch (e) { emptyRejected = true; }
  assertExact("Importing {} is now REJECTED", emptyRejected, true);
  assertExact("PER-D01 fix: real data preserved after the rejected import", WealthData.getHoldings().length, 1);
  let arrayRejected = false;
  try { await Persistence.importFromFile(fakeFile([1, 2, 3])); } catch (e) { arrayRejected = true; }
  assertExact("A JSON array is now REJECTED", arrayRejected, true);
  let unrelatedRejected = false;
  try { await Persistence.importFromFile(fakeFile({ foo: 1, bar: 2 })); } catch (e) { unrelatedRejected = true; }
  assertExact("An unrelated object with no known backup keys is REJECTED", unrelatedRejected, true);
  // Forward-compat preserved: a minimal but real backup (one known section) still imports.
  WealthData.reset();
  await Persistence.importFromFile(fakeFile({ holdings: [{ id: 7, ticker: "MINI", quantity: 1, avgCost: 1 }] }));
  assertExact("PER-D01 fix: a partial-but-real backup (known key) still imports", WealthData.getHoldings()[0].ticker, "MINI");
  // A backup identified solely by meta (e.g. an almost-empty but genuine export) still imports.
  WealthData.reset();
  let metaOnlyRejected = false;
  try { await Persistence.importFromFile(fakeFile({ meta: { schemaVersion: 4 } })); } catch (e) { metaOnlyRejected = true; }
  assertExact("A meta-only backup is accepted (has a known key)", metaOnlyRejected, false);

  console.log("\n=== PER-D02 (Potential): replaceAll performs no inner-shape validation ===");
  WealthData.reset();
  WealthData.replaceAll({ holdings: "this is not an array" });
  assertExact("PER-D02: a wrong-typed field is accepted verbatim (would crash consumers)", WealthData.getHoldings(), "this is not an array");

  console.log("\n=== Public API surface ===");
  assertExact("Public API", Object.keys(Persistence).sort().join(","), "exportToFile,importFromFile,load,save");

  console.log(`\n=== SUMMARY: ${passCount} passed, ${failCount} failed (out of ${passCount + failCount}) ===`);
  process.exit(failCount > 0 ? 1 : 0);
})();

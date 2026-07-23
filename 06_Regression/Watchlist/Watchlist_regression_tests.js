#!/usr/bin/env node
/* ============================================================================
   Watchlist — Executable Regression Suite
   ============================================================================
   Runs the ACTUAL production functions from js/modules/watchlist.js:
     - buildItem()        (extracted + exposed 2026-07-23, Option B; behaviour
                           preserved — see Watchlist_CodeMapping.md)
     - sortByDateAdded()  (extracted + exposed 2026-07-23)
     - categoryLabel()    (exposed 2026-07-23)
   plus the real WealthData add/remove/get watchlist API.

   DOM-coupled bits (WL-04 count/pluralization, WL-05 target display format,
   WL-06 chip-colour mapping) live inside render()/renderList() and cannot run
   in Node without a document; they are verified by RE-DERIVATION over the real
   data (labelled below) and by reading in Watchlist_Verification_Report.md —
   NOT via the live render path. The Overview cross-module drift (Phase 1A) is
   likewise checked by re-derivation of overview.js lines 34-36, since loading
   the whole Overview module (Portfolio/Delivery deps) is out of scope here.

   Robust path resolution: runs from any working directory.
   Run: node 05_Modules/Watchlist/Watchlist_regression_tests.js
   Exits 0 if all pass, 1 if any fail.
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
function assertDeepEqual(label, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (pass) passCount++; else failCount++;
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${label}: expected=${JSON.stringify(expected)}, actual=${JSON.stringify(actual)}`);
  return pass;
}

const suiteRoot = path.resolve(__dirname, '..', '..', '01_Source', 'wealth-suite');
eval(fs.readFileSync(path.join(suiteRoot, 'js/data-model.js'), 'utf8') + '\nglobal.WealthData = WealthData;');
eval(fs.readFileSync(path.join(suiteRoot, 'js/modules/watchlist.js'), 'utf8') + '\nglobal.WatchlistModule = WatchlistModule;');

console.log("=== WL-01: buildItem — validation + normalization ===");
assertExact("Ticker trimmed + uppercased", WatchlistModule.buildItem({ ticker: "  wipro  ", category: "Watch" }).ticker, "WIPRO");
assertExact("Whitespace-only ticker -> null (invalid)", WatchlistModule.buildItem({ ticker: "   " }), null);
assertExact("Missing ticker -> null (invalid)", WatchlistModule.buildItem({}), null);
assertExact("Notes trimmed", WatchlistModule.buildItem({ ticker: "X", notes: "  buy the dip  " }).notes, "buy the dip");
assertExact("Missing notes -> empty string (not undefined)", WatchlistModule.buildItem({ ticker: "X" }).notes, "");
assertExact("Category passthrough", WatchlistModule.buildItem({ ticker: "X", category: "Buy Soon" }).category, "Buy Soon");
assertExact("Numeric target parsed", WatchlistModule.buildItem({ ticker: "X", targetPrice: "450.5" }).targetPrice, 450.5);
assertExact("Target '450' parsed to 450", WatchlistModule.buildItem({ ticker: "X", targetPrice: "450" }).targetPrice, 450);
assertExact("Empty target -> null", WatchlistModule.buildItem({ ticker: "X", targetPrice: "" }).targetPrice, null);
assertExact("Target '0' -> null (0 is falsy; documented business rule)", WatchlistModule.buildItem({ ticker: "X", targetPrice: "0" }).targetPrice, null);
// Positive contrast to MAC-D01: a non-numeric target is NEVER stored as NaN.
assertExact("Non-numeric target -> null, never NaN (contrast MAC-D01)", WatchlistModule.buildItem({ ticker: "X", targetPrice: "N/A" }).targetPrice, null);
assertExact("Non-numeric target is not NaN", Number.isNaN(WatchlistModule.buildItem({ ticker: "X", targetPrice: "N/A" }).targetPrice), false);

console.log("\n=== WL-02: categoryLabel — value -> display label ===");
assertExact("Watch -> Watch", WatchlistModule.categoryLabel("Watch"), "Watch");
assertExact("Research -> Needs Study", WatchlistModule.categoryLabel("Research"), "Needs Study");
assertExact("Buy Soon -> Buy Soon", WatchlistModule.categoryLabel("Buy Soon"), "Buy Soon");
assertExact("Reject -> Reject", WatchlistModule.categoryLabel("Reject"), "Reject");
assertExact("Unknown value -> raw value (presentation compatibility)", WatchlistModule.categoryLabel("Hold"), "Hold");
// Documents the drift point vs Overview (Phase 1A): a missing category returns
// the falsy value as-is here, whereas Overview.watchlistLabel returns "Unclassified".
assertExact("Missing category -> undefined (raw), NOT 'Unclassified' — WL-D01 drift point", WatchlistModule.categoryLabel(undefined), undefined);

console.log("\n=== WL-03: sortByDateAdded — newest first, non-mutating ===");
const wl03 = [
  { ticker: "OLD", dateAdded: "2026-01-01T00:00:00.000Z" },
  { ticker: "NEW", dateAdded: "2026-06-01T00:00:00.000Z" },
  { ticker: "MID", dateAdded: "2026-03-01T00:00:00.000Z" }
];
assertDeepEqual("Newest dateAdded first", WatchlistModule.sortByDateAdded(wl03).map(i => i.ticker), ["NEW", "MID", "OLD"]);
const wl03OrderBefore = wl03.map(i => i.ticker).join(",");
WatchlistModule.sortByDateAdded(wl03);
assertExact("Input array not mutated (slice used)", wl03.map(i => i.ticker).join(","), wl03OrderBefore);
assertDeepEqual("Empty list -> []", WatchlistModule.sortByDateAdded([]), []);

console.log("\n=== WL-07 + data model: add / remove / id round-trip ===");
WealthData.reset();
const id1 = WealthData.addWatchlistItem(WatchlistModule.buildItem({ ticker: "tcs", category: "Watch", targetPrice: "3600", notes: "  quality  " }));
const stored = WealthData.getWatchlist().find(w => w.id === id1);
assertExact("Item added to watchlist", !!stored, true);
assertExact("id is a number", typeof id1, "number");
assertExact("dateAdded is a valid ISO timestamp", !isNaN(new Date(stored.dateAdded).getTime()), true);
assertExact("Normalized ticker persisted", stored.ticker, "TCS");
assertExact("Normalized notes persisted", stored.notes, "quality");
// The remove control reads the id back via parseFloat(String(id)) from a data attribute.
assertExact("id round-trips through parseFloat(String(id))", parseFloat(String(id1)), id1);
const id2 = WealthData.addWatchlistItem(WatchlistModule.buildItem({ ticker: "INFY", category: "Reject" }));
WealthData.removeWatchlistItem(parseFloat(String(id1)));
assertExact("Removed the targeted item only", WealthData.getWatchlist().length, 1);
assertExact("Correct item remains", WealthData.getWatchlist()[0].id, id2);

console.log("\n=== WL-04 (re-derived): count + pluralization ===");
WealthData.reset();
WealthData.addWatchlistItem(WatchlistModule.buildItem({ ticker: "A", category: "Watch" }));
const n1 = WealthData.getWatchlist().length;
assertExact("[re-derived] 1 item -> 'stock' (singular)", `${n1} ${n1 === 1 ? "stock" : "stocks"}`, "1 stock");
WealthData.addWatchlistItem(WatchlistModule.buildItem({ ticker: "B", category: "Watch" }));
const n2 = WealthData.getWatchlist().length;
assertExact("[re-derived] 2 items -> 'stocks' (plural)", `${n2} ${n2 === 1 ? "stock" : "stocks"}`, "2 stocks");

console.log("\n=== WL-05 (re-derived): target-price display branch ===");
const withTarget = WatchlistModule.buildItem({ ticker: "X", targetPrice: "450000" });
const noTarget = WatchlistModule.buildItem({ ticker: "Y", targetPrice: "" });
assertExact("[re-derived] target present -> ₹ + en-IN grouping", withTarget.targetPrice ? '₹' + withTarget.targetPrice.toLocaleString('en-IN') : '—', "₹4,50,000");
assertExact("[re-derived] target null -> em dash", noTarget.targetPrice ? '₹' + noTarget.targetPrice.toLocaleString('en-IN') : '—', "—");

console.log("\n=== Phase 1A (re-derived): Overview label drift (WL-D01, Potential Defect) ===");
// Re-derivation of overview.js lines 34-36:
//   category === "Research" ? "Needs Study" : (category || "Unclassified")
const overviewLabel = (category) => category === "Research" ? "Needs Study" : (category || "Unclassified");
["Watch", "Research", "Buy Soon", "Reject"].forEach(c => {
  assertExact(`Agree on '${c}' (no drift for real categories)`, WatchlistModule.categoryLabel(c), overviewLabel(c));
});
assertExact("Divergence on missing category: Watchlist=undefined", WatchlistModule.categoryLabel(undefined), undefined);
assertExact("Divergence on missing category: Overview='Unclassified'", overviewLabel(undefined), "Unclassified");

console.log("\n=== Empty-state safety ===");
WealthData.reset();
assertDeepEqual("sortByDateAdded on empty watchlist -> []", WatchlistModule.sortByDateAdded(WealthData.getWatchlist()), []);
assertExact("Public API surface", Object.keys(WatchlistModule).sort().join(","), "buildItem,categoryLabel,render,sortByDateAdded");

console.log(`\n=== SUMMARY: ${passCount} passed, ${failCount} failed (out of ${passCount + failCount}) ===`);
process.exit(failCount > 0 ? 1 : 0);

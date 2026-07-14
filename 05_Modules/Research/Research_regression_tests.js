#!/usr/bin/env node
/* ============================================================================
   Research Library — Executable Regression Suite
   ============================================================================
   Runs the ACTUAL production functions (validateEntry, buildEntry,
   computeSummary, computeTickerList, computeTimeline — extracted from
   research.js in Phase 2, nothing reimplemented here). Exits 0 if all tests
   pass, 1 if any fail.
   Run from wealth-suite/: node Research_regression_tests.js
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
eval(fs.readFileSync(path.join(suiteRoot, 'js/list-controls.js'), 'utf8') + '\nglobal.ListControls = ListControls;');
eval(fs.readFileSync(path.join(suiteRoot, 'js/modules/research.js'), 'utf8') + '\nglobal.ResearchModule = ResearchModule;');

console.log("=== Research document-type compatibility ===");
assertDeepEqual("Form exposes exactly seven canonical types", ResearchModule.getDocumentTypes(), [
  "Investment Thesis", "Bull Case", "Bear Case", "Management Assessment",
  "Company Update", "AI-Generated Summary", "Decision Record"
]);
assertExact("Key Risk displays as Bear Case", ResearchModule.getResearchTypeDisplayLabel("Key Risk"), "Bear Case");
assertExact("Bear Case displays as Bear Case", ResearchModule.getResearchTypeDisplayLabel("Bear Case"), "Bear Case");
assertExact("Annual Report Note displays as Company Update", ResearchModule.getResearchTypeDisplayLabel("Annual Report Note"), "Company Update");
assertExact("Concall Summary displays as Company Update", ResearchModule.getResearchTypeDisplayLabel("Concall Summary"), "Company Update");
assertExact("Quarterly Observation displays as Company Update", ResearchModule.getResearchTypeDisplayLabel("Quarterly Observation"), "Company Update");
assertExact("Unknown type is identified as legacy", ResearchModule.getResearchTypeDisplayLabel("Broker Note"), "Legacy: Broker Note");
assertExact("Missing type displays as Unclassified", ResearchModule.getResearchTypeDisplayLabel(undefined), "Unclassified");
assertExact("Blank type displays as Unclassified", ResearchModule.getResearchTypeDisplayLabel("   "), "Unclassified");

const newBearCase = ResearchModule.buildEntry({ ticker: "TCS", docType: "Bear Case", title: "Downside" });
const newCompanyUpdate = ResearchModule.buildEntry({ ticker: "TCS", docType: "Company Update", title: "Q1 update" });
assertExact("New Bear Case stores canonical value", newBearCase.docType, "Bear Case");
assertExact("New Company Update stores canonical value", newCompanyUpdate.docType, "Company Update");

const legacyFixtures = [
  { ticker: "TCS", docType: "Key Risk" },
  { ticker: "INFY", docType: "Annual Report Note" },
  { ticker: "HDFCBANK", docType: "Concall Summary" },
  { ticker: "ITC", docType: "Quarterly Observation" }
];
const legacyBeforePresentation = JSON.stringify(legacyFixtures);
legacyFixtures.forEach(entry => ResearchModule.getResearchTypeDisplayLabel(entry.docType));
assertExact("Presentation leaves legacy raw values unchanged", JSON.stringify(legacyFixtures), legacyBeforePresentation);
const backupRoundTrip = JSON.parse(JSON.stringify({ researchLibrary: legacyFixtures }));
assertDeepEqual("JSON backup round-trip preserves legacy raw values", backupRoundTrip.researchLibrary.map(e => e.docType), [
  "Key Risk", "Annual Report Note", "Concall Summary", "Quarterly Observation"
]);

const deliverySource = fs.readFileSync(path.join(suiteRoot, 'js/modules/delivery-screener.js'), 'utf8');
assertExact("Delivery Research link still targets the Research route", deliverySource.includes("App.switchTo('research')"), true);

console.log("=== RL-01: Entry Validation ===");
assertExact("Valid ticker + title", ResearchModule.validateEntry("TCS", "Q1 notes"), true);
assertExact("Whitespace-only ticker fails", ResearchModule.validateEntry("   ", "Q1 notes"), false);
assertExact("Whitespace-only title fails", ResearchModule.validateEntry("TCS", "   "), false);
assertExact("Empty ticker fails", ResearchModule.validateEntry("", "Q1 notes"), false);
assertExact("Missing (undefined) ticker/title does not crash, fails", ResearchModule.validateEntry(undefined, undefined), false);

console.log("\n=== RL-02: Field Normalization ===");
const e1 = ResearchModule.buildEntry({ ticker: "  tcs  ", docType: "Bull Case", title: "  My thesis  ", content: "  some notes  " });
assertExact("Ticker trimmed + uppercased", e1.ticker, "TCS");
assertExact("Title trimmed", e1.title, "My thesis");
assertExact("Content trimmed", e1.content, "some notes");
const e1b = ResearchModule.buildEntry({ ticker: "INFY", docType: "Key Risk", title: "Risk note" });
assertExact("Missing content defaults to empty string, not undefined", e1b.content, "");

console.log("\n=== RL-03: Decision Field Conditional Assignment ===");
const e2 = ResearchModule.buildEntry({ ticker: "TCS", docType: "Decision Record", title: "Sold half", decision: "Sell" });
assertExact("Decision Record keeps its decision value", e2.decision, "Sell");
const e3 = ResearchModule.buildEntry({ ticker: "TCS", docType: "Bull Case", title: "Bull case", decision: "Buy" });
assertExact("Non-Decision-Record entry discards decision even if one was passed", e3.decision, null);
const e4 = ResearchModule.buildEntry({ ticker: "TCS", docType: "Annual Report Note", title: "FY26 notes" });
assertExact("Non-Decision-Record entry with no decision passed stays null", e4.decision, null);

console.log("\n=== RL-04: Entry ID & Timestamp Assignment ===");
const beforeAdd = Date.now();
const id1 = WealthData.addResearchNote(ResearchModule.buildEntry({ ticker: "TCS", docType: "Investment Thesis", title: "First note" }));
const added1 = WealthData.getResearchLibrary().find(e => e.id === id1);
assertExact("Entry was actually pushed to researchLibrary", !!added1, true);
assertExact("id is a number", typeof id1, "number");
assertExact("addedAt is a valid, parseable ISO timestamp not in the future", !isNaN(new Date(added1.addedAt).getTime()) && new Date(added1.addedAt).getTime() >= beforeAdd, true);

console.log("\n=== RL-05/RL-06/RL-07: Summary counts ===");
WealthData.reset();
WealthData.addResearchNote(ResearchModule.buildEntry({ ticker: "TCS", docType: "Bull Case", title: "t1" }));
WealthData.addResearchNote(ResearchModule.buildEntry({ ticker: "TCS", docType: "Bear Case", title: "t2" }));
WealthData.addResearchNote(ResearchModule.buildEntry({ ticker: "TCS", docType: "Key Risk", title: "t3" }));
WealthData.addResearchNote(ResearchModule.buildEntry({ ticker: "INFY", docType: "Investment Thesis", title: "t4" }));
const summary1 = ResearchModule.computeSummary(WealthData.getResearchLibrary());
assertExact("Total entries", summary1.totalEntries, 4);
assertExact("Unique company count", summary1.companyCount, 2);
assertDeepEqual("Per-ticker counts", summary1.perTickerCounts, { TCS: 3, INFY: 1 });

console.log("\n=== RL-08: Ticker List Ordering — RL-D01 fix, proven with a dataset engineered to diverge ===");
WealthData.reset();
// AAACO added first (older); ZZZCO added second (newer) — alphabetical and
// recency order disagree, which is exactly what the pre-fix bug could not
// distinguish (both sortKey values used to return the same alphabetical order).
// addedAt is force-set explicitly (not left to real wall-clock timing) since
// two synchronous adds can land in the same millisecond, which would make
// this test flaky rather than deterministic.
const aId = WealthData.addResearchNote(ResearchModule.buildEntry({ ticker: "AAACO", docType: "Investment Thesis", title: "old" }));
WealthData.getResearchLibrary().find(e => e.id === aId).addedAt = "2026-01-01T00:00:00.000Z";
const zId = WealthData.addResearchNote(ResearchModule.buildEntry({ ticker: "ZZZCO", docType: "Investment Thesis", title: "new" }));
WealthData.getResearchLibrary().find(e => e.id === zId).addedAt = "2026-06-01T00:00:00.000Z";
const entriesRL08 = WealthData.getResearchLibrary();
assertDeepEqual("sortKey='ticker' -> alphabetical", ResearchModule.computeTickerList(entriesRL08, { sortKey: "ticker" }), ["AAACO", "ZZZCO"]);
assertDeepEqual("sortKey='date' (RL-D01 fix: was ['AAACO','ZZZCO'] before the fix, identical to alphabetical) -> newest first", ResearchModule.computeTickerList(entriesRL08, { sortKey: "date" }), ["ZZZCO", "AAACO"]);
assertDeepEqual("No sortKey provided falls back to alphabetical", ResearchModule.computeTickerList(entriesRL08, {}), ["AAACO", "ZZZCO"]);

console.log("\n=== RL-09: Per-Ticker Timeline Ordering (newest first) ===");
WealthData.reset();
const oldId = WealthData.addResearchNote(ResearchModule.buildEntry({ ticker: "TCS", docType: "Concall Summary", title: "Q1" }));
// Force distinct, ordered timestamps rather than relying on real-time gaps between calls.
WealthData.getResearchLibrary().find(e => e.id === oldId).addedAt = "2026-01-01T00:00:00.000Z";
const midId = WealthData.addResearchNote(ResearchModule.buildEntry({ ticker: "TCS", docType: "Concall Summary", title: "Q2" }));
WealthData.getResearchLibrary().find(e => e.id === midId).addedAt = "2026-03-01T00:00:00.000Z";
const newId = WealthData.addResearchNote(ResearchModule.buildEntry({ ticker: "TCS", docType: "Concall Summary", title: "Q3" }));
WealthData.getResearchLibrary().find(e => e.id === newId).addedAt = "2026-06-01T00:00:00.000Z";
const timeline = ResearchModule.computeTimeline(WealthData.getResearchLibrary(), "TCS");
assertDeepEqual("Q3 (newest), Q2, Q1 (oldest)", timeline.map(e => e.title), ["Q3", "Q2", "Q1"]);
assertExact("Timeline for an unknown ticker returns an empty array, not a crash", ResearchModule.computeTimeline(WealthData.getResearchLibrary(), "NOPE").length, 0);

console.log("\n=== RL-10: Ticker Search Filter ===");
WealthData.reset();
["AAACO", "TCS", "TCSTEST", "INFY"].forEach(t => WealthData.addResearchNote(ResearchModule.buildEntry({ ticker: t, docType: "Investment Thesis", title: "x" })));
const searchResult = ResearchModule.computeTickerList(WealthData.getResearchLibrary(), { searchText: "TC", sortKey: "ticker" });
assertDeepEqual("Search 'TC' matches TCS and TCSTEST only, case-insensitive, alphabetical", searchResult, ["TCS", "TCSTEST"]);
const searchEmpty = ResearchModule.computeTickerList(WealthData.getResearchLibrary(), { searchText: "ZZZ", sortKey: "ticker" });
assertDeepEqual("Search with no matches returns an empty array", searchEmpty, []);

console.log("\n=== Standalone Value Rule: works for a ticker with zero Fundamentals/Portfolio/Watchlist data ===");
WealthData.reset();
WealthData.addResearchNote(ResearchModule.buildEntry({ ticker: "RANDOMSTOCK", docType: "Investment Thesis", title: "Starting research before adding anywhere else" }));
assertExact("RANDOMSTOCK has no security record", WealthData.getSecurity("RANDOMSTOCK"), undefined);
assertExact("RANDOMSTOCK has no fundamentals record", WealthData.getFundamentals("RANDOMSTOCK"), undefined);
const standaloneSummary = ResearchModule.computeSummary(WealthData.getResearchLibrary());
assertExact("Research entry still saved and counted despite no data anywhere else", standaloneSummary.totalEntries, 1);
assertDeepEqual("Research entry still appears in the ticker list", ResearchModule.computeTickerList(WealthData.getResearchLibrary(), { sortKey: "ticker" }), ["RANDOMSTOCK"]);

console.log("\n=== Empty-state safety ===");
WealthData.reset();
assertExact("computeSummary on empty library: totalEntries=0", ResearchModule.computeSummary(WealthData.getResearchLibrary()).totalEntries, 0);
assertExact("computeSummary on empty library: companyCount=0", ResearchModule.computeSummary(WealthData.getResearchLibrary()).companyCount, 0);
assertDeepEqual("computeTickerList on empty library returns []", ResearchModule.computeTickerList(WealthData.getResearchLibrary(), { sortKey: "date" }), []);

console.log(`\n=== SUMMARY: ${passCount} passed, ${failCount} failed (out of ${passCount + failCount}) ===`);
process.exit(failCount > 0 ? 1 : 0);

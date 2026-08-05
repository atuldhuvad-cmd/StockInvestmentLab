#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const suiteRoot = path.resolve(__dirname, "..", "..", "01_Source", "wealth-suite");
let passCount = 0;
let failCount = 0;

function assertExact(label, actual, expected) {
  const pass = actual === expected;
  if (pass) passCount++; else failCount++;
  console.log(`  [${pass ? "PASS" : "FAIL"}] ${label}: expected=${expected}, actual=${actual}`);
}

function assertClose(label, actual, expected, tolerance = 0.0001) {
  const pass = Math.abs(actual - expected) <= tolerance;
  if (pass) passCount++; else failCount++;
  console.log(`  [${pass ? "PASS" : "FAIL"}] ${label}: expected=${expected}, actual=${actual}`);
}

function load(relativePath, globalName) {
  const source = fs.readFileSync(path.join(suiteRoot, relativePath), "utf8");
  eval(source + `\nglobal.${globalName} = ${globalName};`);
}

load("js/data-model.js", "WealthData");
load("js/company-calculations.js", "CompanyCalculations");
global.document = {};
global.App = { showStatus: () => {}, saveNow: () => {} };
load("js/modules/portfolio.js", "PortfolioModule");
load("js/modules/intraday.js", "IntradayModule");

console.log("=== Portfolio legacy active compatibility ===");

const newId = WealthData.addHolding({
  ticker: "NEW",
  quantity: 1,
  avgCost: 100,
  currentPrice: 110,
  assetClass: "Equity"
});
const newHolding = WealthData.getHoldings().find(holding => holding.id === newId);
assertExact(
  "New holding omits active",
  Object.prototype.hasOwnProperty.call(newHolding, "active"),
  false
);

WealthData.get().holdings.push(
  { id: 2, ticker: "LEGACY_TRUE", quantity: 2, avgCost: 90, currentPrice: 100, assetClass: "Equity", active: true },
  { id: 3, ticker: "LEGACY_MISSING", quantity: 3, avgCost: 90, currentPrice: 100, assetClass: "Gold" },
  { id: 4, ticker: "LEGACY_FALSE", quantity: 4, avgCost: 90, currentPrice: 100, assetClass: "Debt", active: false }
);

const included = WealthData.getHoldings().filter(holding => holding.active !== false);
assertExact("Legacy active:true is included", included.some(holding => holding.ticker === "LEGACY_TRUE"), true);
assertExact("Legacy active missing is included", included.some(holding => holding.ticker === "LEGACY_MISSING"), true);
assertExact("Legacy active:false is excluded", included.some(holding => holding.ticker === "LEGACY_FALSE"), false);

const summary = PortfolioModule.computeSummary(included.map(PortfolioModule.computeRow));
assertExact("Portfolio total excludes active:false", summary.totalValue, 610);
assertExact("Portfolio invested total remains correct", summary.totalInvested, 550);
assertExact("Portfolio gain remains correct", summary.totalGain, 60);

WealthData.addIntradayTrade({
  ticker: "TRADE",
  entryPrice: 100,
  stopLoss: 95,
  target: 110,
  positionSize: 90,
  notes: "compatibility test",
  status: "Open"
});
WealthData.updateSetting("intradaySatelliteAllocationPct", 10);
const allocation = IntradayModule.computeAllocation();
assertExact("Intraday deployed capital remains correct", allocation.deployed, 90);
assertExact("Intraday ceiling excludes active:false holding", allocation.ceilingAmount, 70);
assertClose("Intraday used percentage remains correct", allocation.usedPct, 90 / 700 * 100);

const backupJson = JSON.stringify(WealthData.get());
const restoredState = JSON.parse(backupJson);
const restoredTrue = restoredState.holdings.find(holding => holding.ticker === "LEGACY_TRUE");
const restoredMissing = restoredState.holdings.find(holding => holding.ticker === "LEGACY_MISSING");
const restoredFalse = restoredState.holdings.find(holding => holding.ticker === "LEGACY_FALSE");
assertExact("Backup JSON preserves active:true", restoredTrue.active, true);
assertExact("Backup JSON preserves missing active", Object.prototype.hasOwnProperty.call(restoredMissing, "active"), false);
assertExact("Backup JSON preserves active:false", restoredFalse.active, false);

WealthData.replaceAll(restoredState);
const restoredIncluded = WealthData.getHoldings().filter(holding => holding.active !== false);
assertExact("Restored active:true remains included", restoredIncluded.some(holding => holding.ticker === "LEGACY_TRUE"), true);
assertExact("Restored missing active remains included", restoredIncluded.some(holding => holding.ticker === "LEGACY_MISSING"), true);
assertExact("Restored active:false remains excluded", restoredIncluded.some(holding => holding.ticker === "LEGACY_FALSE"), false);

console.log(`\n=== SUMMARY: ${passCount} passed, ${failCount} failed ===`);
process.exit(failCount > 0 ? 1 : 0);

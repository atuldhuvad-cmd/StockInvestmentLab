#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const suiteRoot = path.resolve(__dirname, "..", "..", "01_Source", "wealth-suite");
let passed = 0;
let failed = 0;

function assertExact(label, actual, expected) {
  const ok = actual === expected;
  ok ? passed++ : failed++;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}: expected=${expected}, actual=${actual}`);
}
function assertClose(label, actual, expected, tolerance = 1e-9) {
  const ok = Math.abs(actual - expected) <= tolerance;
  ok ? passed++ : failed++;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}: expected=${expected}, actual=${actual}`);
}
function load(relativePath, globalName) {
  const source = fs.readFileSync(path.join(suiteRoot, relativePath), "utf8");
  eval(source + `\nglobal.${globalName} = ${globalName};`);
}

load("js/data-model.js", "WealthData");
global.document = {};
global.App = { showStatus: () => {}, saveNow: () => Promise.resolve(true) };
load("js/modules/portfolio.js", "PortfolioModule");

console.log("=== Portfolio transaction ledger ===");

const today = "2026-07-15";
assertExact("Blank manual date rejected", PortfolioModule.isValidTransactionDate("", today), false);
assertExact("Invalid calendar date rejected", PortfolioModule.isValidTransactionDate("2026-02-30", today), false);
assertExact("Future manual date rejected", PortfolioModule.isValidTransactionDate("2026-07-16", today), false);
assertExact("Current manual date accepted", PortfolioModule.isValidTransactionDate(today, today), true);
assertExact("Legacy missing date displays unavailable", PortfolioModule.formatTransactionDate(undefined), "Date unavailable");

const empty = [];
const buy1 = PortfolioModule.createTransactionPlan(empty, {
  type: "BUY", ticker: "tcs", quantity: 10, price: 100,
  transactionDate: "2026-01-10", assetClass: "Equity"
}, { today, holdingId: 1, transactionId: 101, createdAt: "2026-01-10T10:00:00.000Z" });
assertExact("First BUY accepted", buy1.ok, true);
assertExact("First BUY creates quantity", buy1.holding.quantity, 10);
assertClose("First BUY average cost", buy1.holding.avgCost, 100);
assertExact("First BUY stores source date", buy1.transaction.transactionDate, "2026-01-10");
assertExact("First BUY has no realised gain", buy1.transaction.realisedGain, null);
assertExact("Planning does not mutate input holdings", empty.length, 0);

const buy2 = PortfolioModule.createTransactionPlan(buy1.holdings, {
  type: "BUY", ticker: "TCS", quantity: 10, price: 200,
  transactionDate: "2026-02-10", assetClass: "Equity"
}, { today, transactionId: 102, createdAt: "2026-02-10T10:00:00.000Z" });
assertExact("Second BUY aggregates quantity", buy2.holding.quantity, 20);
assertClose("Second BUY uses weighted-average cost", buy2.holding.avgCost, 150);
assertClose("Second BUY preserves existing current price", buy2.holding.currentPrice, 100);

const partialSell = PortfolioModule.createTransactionPlan(buy2.holdings, {
  type: "SELL", ticker: "TCS", quantity: 5, price: 180,
  transactionDate: "2026-03-10"
}, { today, transactionId: 103, createdAt: "2026-03-10T10:00:00.000Z" });
assertExact("Partial SELL accepted", partialSell.ok, true);
assertExact("Partial SELL reduces quantity", partialSell.holding.quantity, 15);
assertClose("Partial SELL leaves average cost unchanged", partialSell.holding.avgCost, 150);
assertClose("Partial SELL records realised gain", partialSell.transaction.realisedGain, 150);
assertClose("Partial SELL stores cost basis", partialSell.transaction.costBasisPerUnit, 150);
const partialSummary = PortfolioModule.computeSummary(partialSell.holdings.map(PortfolioModule.computeRow));
assertClose("Partial SELL unrealised gain remains separate", partialSummary.totalGain, -750);

const fullSell = PortfolioModule.createTransactionPlan(partialSell.holdings, {
  type: "SELL", ticker: "TCS", quantity: 15, price: 140,
  transactionDate: "2026-04-10"
}, { today, transactionId: 104, createdAt: "2026-04-10T10:00:00.000Z" });
assertExact("Full SELL accepted", fullSell.ok, true);
assertExact("Full SELL closes holding", fullSell.holdings.length, 0);
assertClose("Full SELL records realised loss", fullSell.transaction.realisedGain, -150);
assertClose("Realised total sums SELL records only", PortfolioModule.computeRealisedGain([
  buy1.transaction, buy2.transaction, partialSell.transaction, fullSell.transaction
]), 0);

const oversellInput = JSON.stringify(partialSell.holdings);
const oversell = PortfolioModule.createTransactionPlan(partialSell.holdings, {
  type: "SELL", ticker: "TCS", quantity: 16, price: 180,
  transactionDate: "2026-05-10"
}, { today });
assertExact("Oversell rejected", oversell.ok, false);
assertExact("Rejected SELL does not mutate holdings", JSON.stringify(partialSell.holdings), oversellInput);

const legacyLots = [
  { id: 11, ticker: "ABC", quantity: 2, avgCost: 100, currentPrice: 120, assetClass: "Equity" },
  { id: 12, ticker: "ABC", quantity: 3, avgCost: 200, currentPrice: 180, assetClass: "Equity" },
  { id: 13, ticker: "ABC", quantity: 99, avgCost: 1, currentPrice: 1, assetClass: "Equity", active: false }
];
const consolidated = PortfolioModule.createTransactionPlan(legacyLots, {
  type: "BUY", ticker: "ABC", quantity: 5, price: 150,
  transactionDate: "2026-06-10", assetClass: "Equity"
}, { today, transactionId: 105 });
assertExact("Legacy duplicate lots consolidate on manual transaction", consolidated.holdings.filter(h => h.active !== false).length, 1);
assertClose("Legacy lots join weighted-average cost", consolidated.holding.avgCost, 155);
assertClose("Legacy lots preserve weighted current value", consolidated.holding.currentPrice, 156);
assertExact("Legacy inactive record remains untouched", consolidated.holdings.some(h => h.id === 13 && h.active === false), true);

WealthData.reset();
const correctionId = WealthData.addHolding({ ticker: "CORRECT", quantity: 1, avgCost: 10, currentPrice: 10, assetClass: "Equity" });
const txCountBeforeDelete = WealthData.getPortfolioTransactions().length;
WealthData.removeHolding(correctionId);
assertExact("Delete holding removes snapshot", WealthData.getHoldings().length, 0);
assertExact("Delete holding creates no SELL transaction", WealthData.getPortfolioTransactions().length, txCountBeforeDelete);

const legacyState = {
  holdings: [{ id: 20, ticker: "LEGACY", quantity: 2, avgCost: 50, currentPrice: 60, assetClass: "Equity" }],
  meta: { schemaVersion: 2, lastSavedAt: null }
};
WealthData.replaceAll(legacyState);
assertExact("Legacy holdings-only state loads", WealthData.getHoldings().length, 1);
assertExact("Missing legacy ledger defaults empty", WealthData.getPortfolioTransactions().length, 0);
assertExact("Legacy holding receives no invented date", Object.prototype.hasOwnProperty.call(WealthData.getHoldings()[0], "transactionDate"), false);

const importedLegacyTransaction = { id: 201, ticker: "OLD", type: "BUY", quantity: 1, price: 25 };
WealthData.replaceAll({ portfolioTransactions: [importedLegacyTransaction] });
const backupJson = JSON.stringify(WealthData.get());
const restored = JSON.parse(backupJson);
assertExact("Imported missing transaction date remains missing", Object.prototype.hasOwnProperty.call(restored.portfolioTransactions[0], "transactionDate"), false);
assertExact("Imported missing date displays unavailable", PortfolioModule.formatTransactionDate(restored.portfolioTransactions[0].transactionDate), "Date unavailable");

WealthData.reset();
WealthData.commitPortfolioTransaction(buy1.holdings, buy1.transaction);
assertExact("Ledger commit writes holding snapshot", WealthData.getHoldings().length, 1);
assertExact("Ledger commit appends transaction", WealthData.getPortfolioTransactions().length, 1);
assertExact("Ledger commit records schema version 3", WealthData.get().meta.schemaVersion, 3);

console.log(`\n=== SUMMARY: ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);

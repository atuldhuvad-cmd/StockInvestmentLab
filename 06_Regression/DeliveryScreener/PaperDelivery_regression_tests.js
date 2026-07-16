#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..", "01_Source", "wealth-suite");
let passed = 0;
let failed = 0;

function assertExact(label, actual, expected) {
  const ok = Object.is(actual, expected);
  ok ? passed++ : failed++;
  console.log("  [" + (ok ? "PASS" : "FAIL") + "] " + label +
    ": expected=" + JSON.stringify(expected) + ", actual=" + JSON.stringify(actual));
}

function assertClose(label, actual, expected, tolerance = 1e-8) {
  const ok = typeof actual === "number" && Math.abs(actual - expected) <= tolerance;
  ok ? passed++ : failed++;
  console.log("  [" + (ok ? "PASS" : "FAIL") + "] " + label +
    ": expected=" + expected + ", actual=" + actual);
}

function load(relative, globalName) {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  eval(source + "\nglobal." + globalName + " = " + globalName + ";");
}

load("js/price-history.js", "PriceHistory");
load("js/paper-quotes.js", "PaperQuotes");
load("js/paper-delivery.js", "PaperDelivery");
load("js/data-model.js", "WealthData");

const candidate = {
  ticker: "TCS",
  overall: 82,
  rating: "Strong Buy",
  pillars: {
    businessQuality: { score: 90 },
    financialStrength: { score: 80 },
    valuation: { score: 70 },
    technicalTrend: {
      score: 85,
      status: "Strong Trend",
      latestDate: "2026-01-01",
      coverage: "Complete"
    },
    risk: { score: 75 }
  }
};
const today = "2026-07-16";
const config = {
  startingCapital: 10000,
  maxAllocationPct: 50,
  maxOpenHoldings: 3,
  manualPrices: {}
};
const transactions = [];
const priceEvidence = {
  priceSource: "Manual price · regression fixture",
  priceTimestamp: "2026-07-16T10:00:00+05:30",
  priceStatus: "Manual price",
  quoteAgeSeconds: 7200,
  manualPriceNote: "regression fixture"
};
const now = new Date("2026-07-16T12:00:00+05:30");

function plan(input, options) {
  return PaperDelivery.createTransactionPlan(
    transactions,
    config,
    { ...priceEvidence, ...input },
    { today: today, now: now, candidate: candidate, ...(options || {}) }
  );
}

console.log("=== Delivery Paper Trading ===");

const zeroCapital = PaperDelivery.createTransactionPlan([], {
  startingCapital: 0,
  maxAllocationPct: 20,
  maxOpenHoldings: 10
}, {
  ticker: "TCS", transactionType: "BUY", transactionDate: "2026-01-01",
  quantity: 1, price: 100, charges: 0, ...priceEvidence
}, { today: today, now: now, candidate: candidate });
assertExact("Zero paper capital blocks BUY", zeroCapital.error, "Set paper capital before creating a paper position");
assertExact("Valid paper capital configuration", PaperDelivery.validateConfig(config), null);
assertExact("BUY date is mandatory", plan({
  ticker: "TCS", transactionType: "BUY", transactionDate: "",
  quantity: 1, price: 100, charges: 0
}).ok, false);
assertExact("SELL date is mandatory", plan({
  ticker: "TCS", transactionType: "SELL", transactionDate: "",
  quantity: 1, price: 100, charges: 0
}).ok, false);
assertExact("Future transaction date rejected", plan({
  ticker: "TCS", transactionType: "BUY", transactionDate: "2026-07-17",
  quantity: 1, price: 100, charges: 0
}).ok, false);

const first = plan({
  ticker: "TCS", transactionType: "BUY", transactionDate: "2026-01-01",
  quantity: 10, price: 100, charges: 10, notes: "first", reason: "model test"
}, { id: 1, createdAt: "2026-01-01T10:00:00Z" });
assertExact("First BUY accepted", first.ok, true);
transactions.push(first.transaction);
let ledger = PaperDelivery.replay(transactions, today);
assertExact("First BUY quantity", ledger.holdings[0].quantity, 10);
assertClose("BUY charges included in average cost", ledger.holdings[0].averageCost, 101);
assertExact("Entry rating snapshot", first.transaction.entrySnapshot.deliveryRating, "Strong Buy");
assertExact("Paper-buy reason snapshot", first.transaction.entrySnapshot.paperBuyReason, "model test");

const second = plan({
  ticker: "TCS", transactionType: "BUY", transactionDate: "2026-02-01",
  quantity: 10, price: 200, charges: 10
}, { id: 2, createdAt: "2026-02-01T10:00:00Z" });
assertExact("Multiple BUY accepted", second.ok, true);
transactions.push(second.transaction);
ledger = PaperDelivery.replay(transactions, today);
assertClose("Multiple BUY weighted-average cost", ledger.holdings[0].averageCost, 151);

const pricedState = {
  paperDeliveryTransactions: transactions,
  paperDeliveryConfig: config,
  priceHistory: {
    TCS: { rows: [
      { date: "2026-06-01", close: 175 },
      { date: "2026-07-15", close: 180 }
    ] }
  }
};
let summary = PaperDelivery.summary(pricedState, today);
assertClose("Unrealised gain/loss", summary.unrealisedGain, 580);
assertClose("Paper cash balance after BUYs", summary.availableCash, 6980);

const partial = plan({
  ticker: "TCS", transactionType: "SELL", transactionDate: "2026-03-01",
  quantity: 5, price: 180, charges: 5
}, { id: 3, createdAt: "2026-03-01T10:00:00Z" });
assertExact("Partial SELL accepted", partial.ok, true);
assertClose("Partial SELL realised gain includes charges", partial.transaction.realisedGain, 140);
transactions.push(partial.transaction);
ledger = PaperDelivery.replay(transactions, today);
assertExact("Partial SELL reduces quantity", ledger.holdings[0].quantity, 15);
assertClose("Partial SELL leaves average cost unchanged", ledger.holdings[0].averageCost, 151);

const oversell = plan({
  ticker: "TCS", transactionType: "SELL", transactionDate: "2026-03-02",
  quantity: 16, price: 180, charges: 0
});
assertExact("SELL above quantity rejected", oversell.ok, false);

const full = plan({
  ticker: "TCS", transactionType: "SELL", transactionDate: "2026-04-01",
  quantity: 15, price: 140, charges: 5
}, { id: 4, createdAt: "2026-04-01T10:00:00Z" });
assertExact("Complete SELL accepted", full.ok, true);
assertClose("Complete SELL realised result", full.transaction.realisedGain, -170);
transactions.push(full.transaction);
ledger = PaperDelivery.replay(transactions, today);
assertExact("Complete SELL closes position", ledger.holdings.length, 0);
assertExact("Closed position preserved", ledger.closedPositions.length, 1);
summary = PaperDelivery.summary({
  paperDeliveryTransactions: transactions,
  paperDeliveryConfig: config,
  priceHistory: {}
}, today);
assertClose("Paper cash after completed cycle", summary.availableCash, 9970);
assertClose("Total realised gain/loss", summary.realisedGain, -30);

const allocationBlocked = PaperDelivery.createTransactionPlan([], {
  startingCapital: 10000, maxAllocationPct: 10, maxOpenHoldings: 3
}, {
  ticker: "TCS", transactionType: "BUY", transactionDate: "2026-01-01",
  quantity: 11, price: 100, charges: 0, ...priceEvidence
}, { today: today, now: now, candidate: candidate });
assertExact("Allocation cap enforced", allocationBlocked.ok, false);

const existingOpen = [{
  id: 10, ticker: "AAA", transactionType: "BUY", transactionDate: "2026-01-01",
  quantity: 1, price: 100, charges: 0, createdAt: "2026-01-01T00:00:00Z"
}];
const openCap = PaperDelivery.createTransactionPlan(existingOpen, {
  startingCapital: 10000, maxAllocationPct: 100, maxOpenHoldings: 1
}, {
  ticker: "BBB", transactionType: "BUY", transactionDate: "2026-01-02",
  quantity: 1, price: 100, charges: 0, ...priceEvidence
}, { today: today, now: now, candidate: { ...candidate, ticker: "BBB" } });
assertExact("Open-position cap enforced", openCap.ok, false);

const frozenSnapshot = JSON.stringify(first.transaction.entrySnapshot);
candidate.rating = "Avoid";
candidate.pillars.technicalTrend.status = "Weak Trend";
assertExact("Entry score snapshot remains unchanged", JSON.stringify(first.transaction.entrySnapshot), frozenSnapshot);

const imported = PaperDelivery.getCurrentPrice("TCS", {
  priceHistory: { TCS: { rows: [
    { date: "2026-01-02", close: 102 },
    { date: "2026-01-01", close: 101 }
  ] } },
  paperDeliveryConfig: {}
}, today);
assertExact("Imported latest price selected", imported.price, 102);
assertExact("Imported latest price date", imported.date, "2026-01-02");
assertExact("Stale imported price labelled historical", imported.label.includes("Historical, not live"), true);
assertExact("Manual price update requires date and time", PaperDelivery.validateManualPrice({
  price: 100, observedDate: "", observedTime: "", sourceNote: "fixture"
}, now), "Manual price requires an observed date and time");

assertClose("Maximum drawdown", PaperDelivery.maximumDrawdown([100, 120, 90, 150]), 25);

const horizonState = {
  paperDeliveryTransactions: [{
    id: 20, ticker: "TCS", transactionType: "BUY", transactionDate: "2026-01-01",
    quantity: 1, price: 100, charges: 0, createdAt: "2026-01-01T00:00:00Z"
  }],
  paperDeliveryConfig: config,
  priceHistory: { TCS: { rows: [
    { date: "2026-01-31", close: 110 },
    { date: "2026-03-02", close: 120 },
    { date: "2026-04-01", close: 130 }
  ] } }
};
assertClose("30-day performance", PaperDelivery.horizonPerformance(horizonState, 30).averageReturnPct, 10);
assertClose("60-day performance", PaperDelivery.horizonPerformance(horizonState, 60).averageReturnPct, 20);
assertClose("90-day performance", PaperDelivery.horizonPerformance(horizonState, 90).averageReturnPct, 30);

WealthData.get().holdings.push({ id: 99, ticker: "REAL", quantity: 2, avgCost: 500 });
WealthData.get().portfolioTransactions.push({ id: 99, ticker: "REAL", type: "BUY", quantity: 2, price: 500 });
const realBefore = JSON.stringify({
  holdings: WealthData.get().holdings,
  transactions: WealthData.get().portfolioTransactions
});
WealthData.updatePaperDeliveryConfig(config);
transactions.forEach(transaction => WealthData.addPaperDeliveryTransaction(transaction));
assertExact("Paper and real portfolios remain isolated", JSON.stringify({
  holdings: WealthData.get().holdings,
  transactions: WealthData.get().portfolioTransactions
}), realBefore);

const backup = JSON.stringify(WealthData.get());
WealthData.reset();
WealthData.replaceAll(JSON.parse(backup));
assertExact("Backup round-trip paper transactions", WealthData.getPaperDeliveryTransactions().length, 4);
assertExact("Backup round-trip paper capital", WealthData.getPaperDeliveryConfig().startingCapital, 10000);
assertExact("Backup round-trip preserves price timestamp", WealthData.getPaperDeliveryTransactions()[0].priceTimestamp, priceEvidence.priceTimestamp);

WealthData.replaceAll({ holdings: [], portfolioTransactions: [], meta: { schemaVersion: 4 } });
assertExact("v1.5 backup defaults paper transactions empty", WealthData.getPaperDeliveryTransactions().length, 0);
assertExact("v1.5 backup defaults paper capital zero", WealthData.getPaperDeliveryConfig().startingCapital, 0);
assertExact("Opening old state creates no fake paper records", WealthData.get().paperDeliveryTransactions.length, 0);

const csv = PaperDelivery.csv(transactions);
assertExact("Paper CSV includes price evidence", csv.startsWith("Date,Ticker,Type,Quantity,Price,Charges,Gross Amount,Net Amount,Realised Gain/Loss,Price Source,Price Timestamp,Price Status,Quote Age Seconds,Manual Price Note,Notes"), true);
assertExact("New BUY stores price source", transactions[0].priceSource, priceEvidence.priceSource);
assertExact("New SELL stores price status", transactions[2].priceStatus, "Manual price");
assertExact("Old v1.6 transaction without evidence still replays", PaperDelivery.replay(existingOpen, today).holdings.length, 1);
assertExact("Dependent BUY cannot be deleted as correction", PaperDelivery.canDeleteTransaction(transactions, 1, today).ok, false);
assertExact("SELL can be deleted as correction", PaperDelivery.canDeleteTransaction(transactions, 4, today).ok, true);

console.log("\n=== SUMMARY: " + passed + " passed, " + failed + " failed ===");
process.exit(failed ? 1 : 0);

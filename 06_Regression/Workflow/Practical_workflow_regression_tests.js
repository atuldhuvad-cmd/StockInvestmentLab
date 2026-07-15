#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const suiteRoot = path.resolve(__dirname, "..", "..", "01_Source", "wealth-suite");
let passed = 0;
let failed = 0;

function assertExact(label, actual, expected) {
  const ok = actual === expected;
  ok ? passed++ : failed++;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}: expected=${JSON.stringify(expected)}, actual=${JSON.stringify(actual)}`);
}

function load(relativePath, globalName) {
  const source = fs.readFileSync(path.join(suiteRoot, relativePath), "utf8");
  eval(source + `\nglobal.${globalName} = ${globalName};`);
}

load("js/data-model.js", "WealthData");
global.PortfolioModule = {
  computeRow: holding => ({ ...holding, value: holding.quantity * holding.currentPrice, invested: holding.quantity * holding.avgCost, gain: holding.quantity * (holding.currentPrice - holding.avgCost) }),
  computeSummary: rows => ({
    totalValue: rows.reduce((sum, row) => sum + row.value, 0),
    totalInvested: rows.reduce((sum, row) => sum + row.invested, 0),
    totalGain: rows.reduce((sum, row) => sum + row.gain, 0)
  }),
  computeRealisedGain: transactions => transactions.reduce((sum, item) => sum + (Number(item.realisedGain) || 0), 0)
};
global.DeliveryScreenerModule = {
  computeCandidate: ticker => ({
    ticker,
    overall: ticker === "AAA" ? 80 : 60,
    rating: ticker === "AAA" ? "Buy" : "Watch",
    technical: { available: ticker === "AAA" }
  })
};
load("js/modules/overview.js", "OverviewModule");

console.log("=== Practical workflow and Overview health ===");

assertExact("Missing backup timestamp is Never created", OverviewModule.getBackupStatus(null, "2026-07-15T00:00:00Z"), "Never created");
assertExact("Backup at seven days is Current", OverviewModule.getBackupStatus("2026-07-08T00:00:00Z", "2026-07-15T00:00:00Z"), "Current");
assertExact("Backup older than seven days is Due", OverviewModule.getBackupStatus("2026-07-07T23:59:59Z", "2026-07-15T00:00:00Z"), "Due");

WealthData.replaceAll({
  securities: {},
  fundamentals: {
    AAA: { years: [{ year: 2025 }] },
    BBB: { years: [{ year: 2024 }, { year: 2026 }] }
  },
  holdings: [{ id: 1, ticker: "AAA", quantity: 2, avgCost: 100, currentPrice: 120 }],
  portfolioTransactions: [
    { id: 1, ticker: "AAA", type: "BUY", transactionDate: "2026-06-01", createdAt: "2026-06-01T10:00:00Z" },
    { id: 2, ticker: "AAA", type: "SELL", transactionDate: "2026-07-10", createdAt: "2026-07-11T10:00:00Z", realisedGain: 20 }
  ],
  watchlist: [{ id: 1, ticker: "BBB", category: "Research" }],
  priceHistory: {
    AAA: { rows: [{ date: "2026-07-12" }, { date: "2026-07-14" }] }
  },
  meta: { schemaVersion: 4, lastSavedAt: null, lastBackupAt: "2026-07-12T12:00:00Z" }
});

const before = JSON.stringify(WealthData.get());
const model = OverviewModule.buildViewModel();
assertExact("Overview build does not mutate state", JSON.stringify(WealthData.get()), before);
assertExact("Portfolio latest update uses transaction creation time", model.dataHealth.portfolioLastUpdated, "2026-07-11T10:00:00.000Z");
assertExact("Latest transaction date is reported", model.dataHealth.latestTransactionDate, "2026-07-10T00:00:00.000Z");
assertExact("Latest imported price-history row date is reported", model.dataHealth.latestPriceHistoryDate, "2026-07-14T00:00:00.000Z");
assertExact("Complete Technical Trend company count", model.dataHealth.completeTechnicalCount, 1);
assertExact("Waiting price-history company count", model.dataHealth.waitingTechnicalCount, 1);
assertExact("Latest Fundamentals fiscal year", model.dataHealth.latestFiscalYear, 2026);
assertExact("Legacy Watchlist Research label remains Needs Study", model.watchlist.counts["Needs Study"], 1);

const container = { innerHTML: "" };
OverviewModule.render(container);
assertExact("Practical health section is visible", container.innerHTML.includes("Data &amp; Backup Health"), true);
assertExact("Developer schema status is absent", container.innerHTML.includes("Schema version"), false);
assertExact("Macro section is absent from Overview", container.innerHTML.includes("<span class=\"section-title\">Macro</span>"), false);

const indexSource = fs.readFileSync(path.join(suiteRoot, "index.html"), "utf8");
assertExact("Macro script is absent from active entry point", indexSource.includes('js/modules/macro.js'), false);
assertExact("Macro registration is absent from active entry point", indexSource.includes('App.registerModule("macro"'), false);
assertExact("Exactly five active modules are registered", (indexSource.match(/App\.registerModule\(/g) || []).length, 5);

console.log(`\n=== SUMMARY: ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);

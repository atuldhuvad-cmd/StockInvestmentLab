#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.resolve(__dirname, "..", "..", "01_Source", "wealth-suite", "js", "paper-quotes.js"), "utf8");
eval(source + "\nglobal.PaperQuotes = PaperQuotes;");
let passed = 0;
let failed = 0;
function check(label, value) {
  value ? passed++ : failed++;
  console.log("  [" + (value ? "PASS" : "FAIL") + "] " + label);
}

const now = new Date("2026-07-16T12:00:00+05:30");
const base = {
  symbol: "TCS", exchange: "NSE", price: 3210.5,
  quoteTimestamp: "2026-07-16T11:58:00+05:30",
  source: "Angel One SmartAPI", marketStatus: "Open"
};

console.log("=== Paper Quote Evidence ===");
let result = PaperQuotes.classifyQuote(base, now);
check("Valid current quote", result.ok && result.status === "Current" && result.usable);
check("Quote under five minutes", result.ageSeconds === 120);
result = PaperQuotes.classifyQuote({ ...base, quoteTimestamp: "2026-07-16T11:55:00+05:30" }, now);
check("Quote exactly five minutes accepted", result.usable && result.ageSeconds === 300);
result = PaperQuotes.classifyQuote({ ...base, quoteTimestamp: "2026-07-16T11:54:59+05:30" }, now);
check("Older quote marked stale", result.status === "Stale" && !result.usable);
result = PaperQuotes.classifyQuote({ ...base, marketStatus: "Closed", quoteTimestamp: "2026-07-15T15:30:00+05:30" }, now);
check("Market-closed quote allowed", result.status === "Market Closed — Latest Available Price" && result.usable);
check("Malformed response rejected", !PaperQuotes.classifyQuote({ symbol: "TCS", price: "NaN" }, now).ok);
check("Symbol mismatch rejected", !PaperQuotes.classifyQuote({ ...base, expectedSymbol: "INFY" }, now).ok);

let manual = PaperQuotes.manualEvidence({
  price: "3200", observedDate: "2026-07-16", observedTime: "11:45", sourceNote: "broker screen"
}, now);
check("Manual fallback accepted", manual.ok && manual.priceStatus === "Manual price" && manual.manualPriceNote === undefined);
check("Manual timestamp required", !PaperQuotes.manualEvidence({ price: 1, sourceNote: "x" }, now).ok);
check("Future manual timestamp rejected", !PaperQuotes.manualEvidence({
  price: 1, observedDate: "2026-07-17", observedTime: "10:00", sourceNote: "x"
}, now).ok);
check("Imported CSV cannot be Current", PaperQuotes.validateStoredEvidence({
  price: 100, priceSource: "Imported daily CSV", priceTimestamp: "2026-07-15",
  priceStatus: "Current"
}, now) !== null);

(async () => {
  const fetchFn = async () => { throw new Error("offline"); };
  let unavailable = false;
  try { await PaperQuotes.fetchLatest("TCS", { fetchFn, now }); } catch (error) {
    unavailable = error.message.includes("Quote service unavailable");
  }
  check("Unavailable service handled", unavailable);
  const response = {
    ok: true,
    async json() { return base; }
  };
  result = await PaperQuotes.fetchLatest("TCS.NS", { fetchFn: async () => response, now });
  check("Fetched symbol normalized", result.ticker === "TCS" && result.usable);
  console.log("\n=== SUMMARY: " + passed + " passed, " + failed + " failed ===");
  process.exit(failed ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });

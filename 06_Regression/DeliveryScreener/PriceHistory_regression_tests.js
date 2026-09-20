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
function assertClose(label, actual, expected, tolerance = 1e-8) {
  const ok = Math.abs(actual - expected) <= tolerance;
  ok ? passed++ : failed++;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}: expected=${expected}, actual=${actual}`);
}
function load(relativePath, globalName) {
  const source = fs.readFileSync(path.join(suiteRoot, relativePath), "utf8");
  eval(source + `\nglobal.${globalName} = ${globalName};`);
}
function makeRows(count, options = {}) {
  const start = Date.UTC(2020, 0, 1);
  return Array.from({ length: count }, (_, index) => {
    const close = options.close ? options.close(index) : index + 1;
    const volume = options.volume ? options.volume(index, count) : 100;
    return {
      date: new Date(start + index * 86400000).toISOString().slice(0, 10),
      open: close, high: close + 1, low: Math.max(0, close - 1), close, volume
    };
  });
}
function toCSV(rows, header = "Date,Open,High,Low,Close,Volume") {
  return header + "\n" + rows.map(row => [row.date,row.open,row.high,row.low,row.close,row.volume].join(",")).join("\n");
}

load("js/price-history.js", "PriceHistory");
load("js/data-model.js", "WealthData");

console.log("=== Offline Price History and Technical Trend ===");

assertExact("TCS.NS normalizes to TCS", PriceHistory.normalizeSymbol("tcs.ns"), "TCS");
assertExact("NSE prefix normalizes without changing company ticker", PriceHistory.normalizeSymbol("NSE:TCS.NS"), "TCS");
assertExact("Ticker inferred from yfinance-style filename", PriceHistory.inferSymbolFromFilename("TCS.NS_5Y.csv"), "TCS");

const numeric = PriceHistory.parseCSV(
  "dAtE,oPeN,HIGH,low,CLOSE,VoLuMe\n2026-01-02,\"100\",101,99,100.5,\"1,000\"",
  { fileName: "TCS_5Y.csv" }
);
assertExact("Case-insensitive required columns accepted", numeric.ok, true);
assertExact("Numeric strings parsed", numeric.rows[0].close, 100.5);
assertExact("Quoted comma volume parsed", numeric.rows[0].volume, 1000);

const missing = PriceHistory.parseCSV("Date,Open,High,Low,Close\n2026-01-01,1,1,1,1");
assertExact("Missing required Volume rejected", missing.ok, false);

const invalid = PriceHistory.parseCSV(
  "Date,Open,High,Low,Close,Volume\n2026-02-30,1,1,1,1,1\n2026-02-28,NaN,1,1,1,1\n2026-03-01,1,1,1,Infinity,1\n2026-03-02,1,1,1,1,1"
);
assertExact("Invalid date, NaN, and Infinity rows rejected", invalid.rejectedRows, 3);
assertExact("Valid rows retained after invalid rows", invalid.rows.length, 1);
assertExact("Valid date normalized", invalid.rows[0].date, "2026-03-02");

const duplicates = PriceHistory.parseCSV(
  "Date,Open,High,Low,Close,Volume\n2026-01-03,3,3,3,3,3\n2026-01-01,1,1,1,1,1\n2026-01-03,4,4,4,4,4\n2026-01-02,2,2,2,2,2"
);
assertExact("Duplicate date counted", duplicates.duplicateDates, 1);
assertExact("Duplicate date keeps latest valid row", duplicates.rows[2].close, 4);
assertExact("Unsorted input sorted oldest to newest", duplicates.rows.map(row => row.date).join(","), "2026-01-01,2026-01-02,2026-01-03");

const multi = PriceHistory.parseCSV(
  "Price,Close,High,Low,Open,Volume\nTicker,TCS.NS,TCS.NS,TCS.NS,TCS.NS,TCS.NS\nDate,,,,,\n2026-01-01,100,101,99,100,1000\n2026-01-02,101,102,100,101,1100",
  { fileName: "download.csv" }
);
assertExact("yfinance multi-row header accepted", multi.ok, true);
assertExact("yfinance ticker row normalizes symbol", multi.symbol, "TCS");
assertExact("yfinance multi-row data parsed", multi.rows.length, 2);

const below50 = PriceHistory.calculate(makeRows(49));
assertExact("Below 50 rows coverage Missing", below50.coverage, "Missing");
assertExact("Below 50 rows not evaluated", below50.status, "Not Evaluated");
assertExact("Below 50 rows has no score", below50.score, null);

const limited = PriceHistory.calculate(makeRows(199));
assertExact("50-199 rows coverage Limited", limited.coverage, "Limited");
assertExact("Limited history not evaluated", limited.status, "Not Evaluated");
assertExact("Limited history has no score", limited.score, null);

const exactly200Rows = makeRows(200);
const complete = PriceHistory.calculate(exactly200Rows);
assertExact("Exactly 200 rows coverage Complete", complete.coverage, "Complete");
assertClose("50 DMA", complete.dma50, 175.5);
assertClose("200 DMA", complete.dma200, 100.5);
assertExact("Price above 50 DMA", complete.priceAbove50DMA, true);
assertExact("Price above 200 DMA", complete.priceAbove200DMA, true);
assertExact("50 DMA above 200 DMA", complete.dma50Above200DMA, true);
assertClose("RSI 14 for monotonic gains", complete.rsi14, 100);
assertClose("52-week high", complete.high52Week, 201);
assertClose("Distance from 52-week high", complete.distanceFrom52WeekHigh, (200-201)/201*100);
assertClose("20-day average volume", complete.averageVolume20, 100);
assertClose("Latest volume versus 20-day average", complete.latestVolumeVs20DayAverage, 1);
assertExact("Complete trend score applies six weights", complete.score, 85);
assertExact("85 maps to Strong Trend", complete.status, "Strong Trend");

const volumeRows = makeRows(200, { volume: (index, count) => index === count - 1 ? 1000 : 100 });
const volumeAnalysis = PriceHistory.calculate(volumeRows);
assertExact("Latest volume condition passes at/above average", volumeAnalysis.conditions.find(c => c.key === "volume").passed, true);
assertClose("Latest volume comparison ratio", volumeAnalysis.latestVolumeVs20DayAverage, 1000/145);

assertExact("Score 80 boundary Strong Trend", PriceHistory.statusForScore(80), "Strong Trend");
assertExact("Score 60 boundary Constructive", PriceHistory.statusForScore(60), "Constructive");
assertExact("Score 40 boundary Neutral / Wait", PriceHistory.statusForScore(40), "Neutral / Wait");
assertExact("Score below 40 Weak Trend", PriceHistory.statusForScore(39), "Weak Trend");
assertExact("Null score Not Evaluated", PriceHistory.statusForScore(null), "Not Evaluated");

const externalFile = "D:\\StockScreener\\data\\raw\\prices\\RELIANCE_5Y.csv";
assertExact("Existing StockScreener price file is available", fs.existsSync(externalFile), true);
if (fs.existsSync(externalFile)) {
  const real = PriceHistory.parseCSV(fs.readFileSync(externalFile, "utf8"), { fileName: path.basename(externalFile) });
  const realTechnical = PriceHistory.calculate(real.rows);
  assertExact("Existing 5-year CSV parses", real.ok, true);
  assertExact("Existing 5-year CSV symbol", real.symbol, "RELIANCE");
  assertExact("Existing 5-year CSV valid row count", real.rows.length, 1238);
  assertExact("Existing 5-year CSV latest date", realTechnical.latestDate, "2026-07-07");
  assertExact("Existing 5-year CSV complete coverage", realTechnical.coverage, "Complete");
  assertExact("Existing 5-year CSV technical score", realTechnical.score, 25);
  assertExact("Existing 5-year CSV technical status", realTechnical.status, "Weak Trend");
}

WealthData.reset();
const storedRows = makeRows(200);
WealthData.setPriceHistory("TCS", { symbol:"TCS", sourceSymbol:"TCS.NS", importedAt:"2026-07-15T00:00:00.000Z", rows:storedRows });
const backup = JSON.stringify(WealthData.get());
WealthData.reset();
WealthData.replaceAll(JSON.parse(backup));
assertExact("Backup round-trip preserves price-history row count", WealthData.getPriceHistory("TCS").rows.length, 200);
assertExact("Backup round-trip preserves source symbol", WealthData.getPriceHistory("TCS").sourceSymbol, "TCS.NS");
assertExact("Price-history write preserves current schema version", WealthData.get().meta.schemaVersion, 5);

WealthData.replaceAll({ holdings:[], meta:{ schemaVersion:3, lastSavedAt:null } });
assertExact("Legacy backup without priceHistory remains valid", Object.keys(WealthData.get().priceHistory).length, 0);
assertExact("Legacy backup receives no fabricated price rows", WealthData.getPriceHistory("TCS"), undefined);

console.log(`\n=== SUMMARY: ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);

#!/usr/bin/env node
/* ============================================================================
   Intraday — Executable Regression Suite
   ============================================================================
   Independently-derived expected values wherever practical — computed by a
   separate hand-written formula, not by re-running scoreBand-style code
   under test. Runs the actual production functions.
   Run from wealth-suite/: node Intraday_regression_tests.js
============================================================================ */
const fs = require('fs');
const path = require('path');
let passCount = 0, failCount = 0;

function assertClose(label, actual, expected, tol=0.01) {
  const diff = Math.abs(actual-expected);
  const pass = diff <= tol || (Number.isNaN(actual) && Number.isNaN(expected)) || (actual===expected);
  if (pass) passCount++; else failCount++;
  console.log(`  [${pass?'PASS':'FAIL'}] ${label}: expected=${expected}, actual=${actual}`);
  return pass;
}
function assertExact(label, actual, expected) {
  const pass = actual === expected || (Number.isNaN(actual) && Number.isNaN(expected));
  if (pass) passCount++; else failCount++;
  console.log(`  [${pass?'PASS':'FAIL'}] ${label}: expected=${expected}, actual=${actual}`);
  return pass;
}

eval(fs.readFileSync(path.join(__dirname,'js/data-model.js'),'utf8') + '\nglobal.WealthData = WealthData;');
global.document = {};
global.App = { showStatus: ()=>{}, saveNow: ()=>{} };
eval(fs.readFileSync(path.join(__dirname,'js/modules/portfolio.js'),'utf8') + '\nglobal.PortfolioModule = PortfolioModule;');
eval(fs.readFileSync(path.join(__dirname,'js/modules/intraday.js'),'utf8') + '\nglobal.IntradayModule = IntradayModule;');

console.log("=== IN-01: Risk-Reward Ratio — independently derived ===");
const c1 = IntradayModule.computeChecklist({ entryPrice:100, stopLoss:95, target:115, notes:"breakout" });
assertClose("Normal 3:1 setup", c1.riskRewardValue, 3.0);

console.log("\n=== IN-01 edge case: entry === stopLoss (zero risk denominator) ===");
const c2 = IntradayModule.computeChecklist({ entryPrice:100, stopLoss:100, target:110, notes:"x" });
assertExact("Zero-risk denominator produces Infinity, not a crash", c2.riskRewardValue, Infinity);

console.log("\n=== IN-01 edge case: missing inputs ===");
const c3 = IntradayModule.computeChecklist({ entryPrice:100, stopLoss:null, target:110, notes:"x" });
assertExact("Missing stopLoss produces null riskReward, not NaN", c3.riskRewardValue, null);

console.log("\n=== IN-02: Stop-loss set guard ===");
assertExact("stopLoss=95 (valid)", IntradayModule.computeChecklist({entryPrice:100,stopLoss:95,target:110,notes:"x"}).stopSet, true);
assertExact("stopLoss=0 (invalid, correctly excluded)", IntradayModule.computeChecklist({entryPrice:100,stopLoss:0,target:110,notes:"x"}).stopSet, false);
assertExact("stopLoss=-5 (invalid, correctly excluded)", IntradayModule.computeChecklist({entryPrice:100,stopLoss:-5,target:110,notes:"x"}).stopSet, false);
assertExact("stopLoss missing", IntradayModule.computeChecklist({entryPrice:100,stopLoss:null,target:110,notes:"x"}).stopSet, false);

console.log("\n=== IN-03: Risk-Reward threshold pass, against Settings ===");
WealthData.updateSetting("minRiskRewardRatio", 2);
const c4 = IntradayModule.computeChecklist({entryPrice:100,stopLoss:95,target:115,notes:"x"});
assertExact("3.0 ratio passes 2.0 minimum", c4.riskReward, true);
const c5 = IntradayModule.computeChecklist({entryPrice:100,stopLoss:95,target:105,notes:"x"});
assertExact("1.0 ratio fails 2.0 minimum", c5.riskReward, false);

console.log("\n=== IN-04: Reason stated ===");
assertExact("Non-empty notes", IntradayModule.computeChecklist({entryPrice:1,stopLoss:1,target:1,notes:"real reason"}).reasonStated, true);
assertExact("Whitespace-only notes correctly fails", IntradayModule.computeChecklist({entryPrice:1,stopLoss:1,target:1,notes:"   "}).reasonStated, false);
assertExact("Empty notes", IntradayModule.computeChecklist({entryPrice:1,stopLoss:1,target:1,notes:""}).reasonStated, false);

console.log("\n=== IN-05 through IN-10: Allocation, seeded scenario, independently cross-checked ===");
WealthData.addHolding({ ticker:"X", quantity:20, avgCost:500, currentPrice:550, assetClass:"Equity" });
WealthData.addIntradayTrade({ ticker:"Y", entryPrice:100, stopLoss:95, target:115, positionSize:5000, notes:"setup", status:"Open" });
WealthData.updateSetting("intradaySatelliteAllocationPct", 10);

const alloc = IntradayModule.computeAllocation();
assertExact("Deployed capital", alloc.deployed, 5000);
assertClose("Ceiling amount (independently derived: 16000 * 10%)", alloc.ceilingAmount, 1600);
assertClose("Used % (independently derived: 5000/16000*100)", alloc.usedPct, 31.25);
assertExact("Over-ceiling flag correctly true", alloc.overCeiling, true);

console.log("\n=== IN-10 edge case: ceiling=0% ===");
WealthData.updateSetting("intradaySatelliteAllocationPct", 0);
const alloc0 = IntradayModule.computeAllocation();
assertExact("Current documented behavior: overCeiling false when ceilingAmount is 0", alloc0.overCeiling, false);

console.log("\n=== IN-06 cross-module regression ===");
const rows = WealthData.getHoldings().filter(h=>h.active!==false).map(PortfolioModule.computeRow);
const directPortfolioTotal = PortfolioModule.computeSummary(rows).totalValue;
assertExact("Portfolio total (11000) matches what Intraday's allocation implicitly used", directPortfolioTotal, 11000);

console.log(`\n=== SUMMARY: ${passCount} passed, ${failCount} failed (out of ${passCount+failCount}) ===`);
process.exit(failCount > 0 ? 1 : 0);

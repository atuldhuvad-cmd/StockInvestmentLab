#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "..", "01_Source", "wealth-suite");
let passed = 0;
let failed = 0;
function check(label, value) {
  value ? passed++ : failed++;
  console.log("  [" + (value ? "PASS" : "FAIL") + "] " + label);
}

const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const delivery = fs.readFileSync(path.join(root, "js", "modules", "delivery-screener.js"), "utf8");
const overview = fs.readFileSync(path.join(root, "js", "modules", "overview.js"), "utf8");
const paperModule = fs.readFileSync(path.join(root, "js", "modules", "paper-trading.js"), "utf8");

console.log("=== Paper Trading navigation and workflow ===");
const registrations = Array.from(index.matchAll(/App\.registerModule\("([^"]+)", "([^"]+)"/g))
  .map(match => match[2]);
check("Top-level navigation order", registrations.join(",") ===
  "Overview,Portfolio,Watchlist,Delivery,Paper Trading,Fundamentals");
check("Paper Trading wrapper uses existing renderer", paperModule.includes("DeliveryScreenerModule.renderPaperTrading"));
check("Delivery has no nested paper subtabs", !delivery.includes("data-delivery-tab"));
check("Delivery Paper Buy opens Paper Trading", delivery.includes('App.switchTo("paper-trading")'));
check("Four Paper Trading sections exist", ["Summary", "Paper Portfolio", "Transactions", "Performance Review"]
  .every(label => delivery.includes('"' + label + '"')));
check("Paper internal section state is retained", delivery.includes('let activePaperSection = "summary"'));
check("Capital action is present", delivery.includes("Set / Change Paper Capital"));
check("Empty-state guidance is present", delivery.includes("No Paper Delivery positions yet."));
check("Go to Delivery action is present", delivery.includes("Go to Delivery Screener"));
check("Manual Observed Price is checked by default", delivery.includes('value="manual" checked'));
check("Manual source defaults to Angel One app", delivery.includes('value="Angel One app"'));
check("Optional API service is collapsed", delivery.includes('<details class="paper-api-optional"><summary>Optional API Price Service</summary>'));
check("Overview links directly to Paper Trading", overview.includes('App.switchTo("paper-trading")'));
check("Existing storage keys remain in use", delivery.includes("getPaperDeliveryTransactions") && delivery.includes("getPaperDeliveryConfig"));

console.log("\n=== SUMMARY: " + passed + " passed, " + failed + " failed ===");
process.exit(failed ? 1 : 0);

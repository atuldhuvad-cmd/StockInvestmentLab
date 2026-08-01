/* ============================================================================
   Company Calculations — shared utility
   ============================================================================
   Extracted during the Product Completion Phase verification: detectRedFlags
   and quality scoring existed independently in both Fundamentals and
   Delivery Screener, written separately rather than shared. Two copies of
   the same logic risk silently drifting apart if one is updated and the
   other forgotten — a real maintenance risk, not a theoretical one. Fixed
   by factoring both into this single file, same pattern as list-controls.js.
============================================================================ */

const CompanyCalculations = (function () {

  function qualityScore(qualitative) {
    // FUND-D04 fix: a single missing sub-factor previously NaN'd the entire
    // average (undefined/5 = NaN, which poisons the whole reduce). Now:
    // exclude missing factors and average over whatever is present, rather
    // than defaulting to a fabricated neutral value — a re-normalized real
    // average is more honest than silently inventing a "3/5, unknown" score
    // for data that was never actually assessed. Returns null only if every
    // single factor is missing (nothing to average).
    const items = [qualitative.economicMoat, qualitative.pricingPower, qualitative.capitalAllocation,
                   qualitative.managementQuality, qualitative.corporateGovernance,
                   qualitative.promoterIntegrity, qualitative.auditorQuality];
    const present = items.filter(x => x !== undefined && x !== null && !isNaN(x));
    if (present.length === 0) return null;
    return present.reduce((sum, x) => sum + (x / 5) * 100, 0) / present.length;
  }

  function detectRedFlags(fundamentals) {
    const years = fundamentals.years.slice().sort((a, b) => a.year - b.year);
    const flags = [];
    for (let i = 1; i < years.length; i++) {
      const prev = years[i - 1], cur = years[i];
      const debtGrowth = prev.totalDebt ? (cur.totalDebt - prev.totalDebt) / prev.totalDebt * 100 : 0;
      if (debtGrowth > 30) flags.push(`Debt grew ${debtGrowth.toFixed(0)}% in FY${cur.year}`);
      if (cur.sharesOutstanding > prev.sharesOutstanding * 1.05) flags.push(`Share count rose >5% in FY${cur.year} (dilution)`);
      if (cur.pledgePct > prev.pledgePct) flags.push(`Promoter pledge increased in FY${cur.year}`);
      const curMargin = cur.revenue ? cur.netProfit / cur.revenue : 0;
      const prevMargin = prev.revenue ? prev.netProfit / prev.revenue : 0;
      if (curMargin < prevMargin * 0.85 && prevMargin > 0) flags.push(`Net margin declined >15% relative in FY${cur.year}`);
      if (cur.operatingCashFlow < 0) flags.push(`Negative operating cash flow in FY${cur.year}`);
    }
    if (fundamentals.auditorLog && fundamentals.auditorLog.some(a => a.changed)) flags.push("Auditor change recorded — verify reason in filings");
    return flags;
  }

  // FIN-D01–D04 fix, moved here 2026-07-12 during Delivery Screener Phase 3:
  // this was previously duplicated independently in delivery-screener.js's
  // computeCandidate() (the pre-fix copy, carrying FUND-D01/D02/D03's exact
  // defects unfixed). Per the Duplication Analysis's own recommendation, the
  // correct fix is eliminating the second copy, not patching it separately —
  // both Fundamentals and Delivery Screener now call this single definition.
  function latestRatios(fundamentals) {
    const years = fundamentals.years.slice().sort((a, b) => a.year - b.year);
    const latest = years[years.length - 1];
    const first = years[0];
    const roe = (latest.totalEquity && latest.totalEquity > 0) ? (latest.netProfit / latest.totalEquity) * 100 : null;
    const capEmployed = latest.totalAssets - (latest.currentLiabilities || 0);
    const roce = (capEmployed && capEmployed > 0) ? (latest.ebit / capEmployed) * 100 : null;
    const debtEquity = (latest.totalEquity && latest.totalEquity > 0) ? latest.totalDebt / latest.totalEquity : null;
    const netMargin = (latest.revenue && latest.revenue > 0) ? (latest.netProfit / latest.revenue) * 100 : null;
    const yearsSpan = latest.year - first.year;
    const revenueCagr = (yearsSpan > 0 && first.revenue > 0) ? (Math.pow(latest.revenue / first.revenue, 1 / yearsSpan) - 1) * 100 : null;
    const eps = latest.sharesOutstanding ? latest.netProfit / latest.sharesOutstanding : null;
    const pe = eps && eps > 0 ? latest.marketPrice / eps : null;
    const fcf = latest.operatingCashFlow - latest.capex;
    return { roe, roce, debtEquity, netMargin, revenueCagr, eps, pe, fcf, latest, first, yearsSpan };
  }

  function hasMinimumFundamentals(fundamentals) {
    if (!fundamentals) return false;

    return fundamentalCoverage(fundamentals).complete;
  }

  function evidenceStatus(fundamentals) {
    const evidence = fundamentals.evidence || {};
    const isLegacyVerified = !fundamentals.manualRatios && Array.isArray(fundamentals.years) && fundamentals.years.length > 0 && fundamentals.source && fundamentals.fetchedAt;
    const sourceName = String(evidence.sourceName || (isLegacyVerified ? fundamentals.source : "")).trim();
    const evidenceDate = String(evidence.evidenceDate || (isLegacyVerified ? fundamentals.fetchedAt : "")).trim();
    if (!sourceName || !evidenceDate) return "Missing";
    const parsedDate = new Date(`${evidenceDate}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime()) || parsedDate > new Date()) return "Missing";
    const ageDays = (Date.now() - parsedDate.getTime()) / 86400000;
    if (ageDays > 550) return "Stale";
    if (isLegacyVerified || evidence.status === "Verified") return "Verified";
    return "User-entered/unverified";
  }

  function fundamentalCoverage(fundamentals) {
    if (!fundamentals) return { complete: false, missing: ["ROE", "Debt/Equity", "P/E", "Revenue CAGR", "Moat rating", "Verified evidence"], evidenceStatus: "Missing" };
    const ratios = fundamentals.manualRatios || (Array.isArray(fundamentals.years) && fundamentals.years.length ? latestRatios(fundamentals) : {});
    const finite = value => typeof value === "number" && Number.isFinite(value);
    const missing = [];
    if (!finite(ratios.roe)) missing.push("ROE");
    if (!finite(ratios.debtEquity)) missing.push("Debt/Equity");
    if (!finite(ratios.pe)) missing.push("P/E");
    if (!finite(ratios.revenueCagr)) missing.push("Revenue CAGR");
    const qualitativeValues = Object.values(fundamentals.qualitative || {});
    if (!qualitativeValues.some(value => typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 5)) missing.push("Moat rating");
    const status = evidenceStatus(fundamentals);
    if (status !== "Verified") missing.push("Verified evidence");
    return { complete: missing.length === 0, missing, evidenceStatus: status };
  }

  return { qualityScore, detectRedFlags, latestRatios, hasMinimumFundamentals, fundamentalCoverage, evidenceStatus };
})();

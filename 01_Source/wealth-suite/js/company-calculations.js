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

  function determineReviewStatus(fundamentals) {
    if (!fundamentals) return "Missing";
    const status = evidenceStatus(fundamentals);
    const coverage = fundamentalCoverage(fundamentals);
    if (coverage.complete) return "Eligible for Full Rating";
    if (status === "Verified") return "Verified"; // Verified but partial
    if (status === "Stale") return "Stale";
    if (status === "User-entered/unverified") return "User-entered / unverified";
    return "Partial"; // Status missing, but some data exists
  }

  function validateCsvRow(row, rowIndex, allRows) {
    const errors = [];
    if (!row.Ticker) {
      errors.push("Missing Ticker");
    } else if (typeof NIFTY_500_TICKERS !== "undefined" && !NIFTY_500_TICKERS.includes(row.Ticker)) {
      errors.push(`Invalid Ticker: ${row.Ticker} is not recognized as a Nifty 500 constituent`);
    }

    if (!row.Period || !/^(?:Q[1-4]\s)?FY\d{2}$/.test(row.Period)) {
      errors.push(`Invalid Period format: ${row.Period} (Must be FYXX or QX FYXX)`);
    }

    if (row.Evidence_Date) {
      const formatIsValid = /^\d{4}-\d{2}-\d{2}$/.test(row.Evidence_Date);
      const parsedDate = new Date(`${row.Evidence_Date}T00:00:00Z`);
      const canonicalDate = Number.isNaN(parsedDate.getTime()) ? "" : parsedDate.toISOString().slice(0, 10);
      if (!formatIsValid || Number.isNaN(parsedDate.getTime()) || canonicalDate !== row.Evidence_Date) {
        errors.push("Invalid Evidence_Date format (use YYYY-MM-DD)");
      } else if (parsedDate > new Date()) {
        errors.push("Future Evidence_Date not allowed");
      }
    }

    const allowedReviewStatuses = ["", "User-entered/unverified", "Verified"];
    if (!allowedReviewStatuses.includes(row.Review_Status || "")) errors.push(`Invalid Review_Status: ${row.Review_Status}`);

    const allowedFcfStatuses = ["", "Positive", "Negative"];
    if (!allowedFcfStatuses.includes(row.FCF_Status || "")) errors.push(`Invalid FCF_Status: ${row.FCF_Status}`);

    if (row.Review_Status === "Verified" && (!row.Source_Name || !row.Evidence_Date)) {
      errors.push("Verified status requires Source_Name and Evidence_Date");
    }

    const pctFields = ["ROE_Pct", "ROCE_Pct", "Rev_CAGR_Pct", "Earn_CAGR_Pct", "Promoter_Hold_Pct", "Promoter_Pledge_Pct"];
    const otherNums = ["Debt_Equity", "PE_Ratio"];

    [...pctFields, ...otherNums].forEach(f => {
      if (row[f] !== "" && row[f] !== null && row[f] !== undefined) {
        const num = Number(row[f]);
        if (Number.isNaN(num) || !Number.isFinite(num)) {
          errors.push(`Invalid numeric value in ${f}: ${row[f]}`);
        } else if (pctFields.includes(f) && (num < -1000 || num > 10000)) {
          errors.push(`Percentage out of reasonable bounds in ${f}: ${row[f]}`);
        } else if (otherNums.includes(f) && (num < -1000 || num > 10000)) {
          errors.push(`Ratio out of reasonable bounds in ${f}: ${row[f]}`);
        }
      }
    });

    const qualFields = ["Econ_Moat", "Pricing_Power", "Cap_Allocation", "Mgmt_Quality"];
    qualFields.forEach(f => {
      if (row[f] !== "" && row[f] !== null && row[f] !== undefined) {
        const num = Number(row[f]);
        if (Number.isNaN(num) || !Number.isFinite(num) || num < 1 || num > 5) {
          errors.push(`Qualitative score must be between 1 and 5 in ${f}: ${row[f]}`);
        }
      }
    });

    ["Promoter_Hold_Pct", "Promoter_Pledge_Pct"].forEach(f => {
      if (row[f] !== "" && row[f] !== null && row[f] !== undefined) {
        const num = Number(row[f]);
        if (Number.isFinite(num) && (num < 0 || num > 100)) errors.push(`${f} must be between 0 and 100`);
      }
    });

    if (allRows && row.Ticker && row.Period) {
      const dup = allRows.find((r, idx) => idx !== rowIndex && r.Ticker === row.Ticker && r.Period === row.Period);
      if (dup) errors.push(`Duplicate record for ${row.Ticker} ${row.Period}`);
    }

    return errors;
  }

  return { qualityScore, detectRedFlags, latestRatios, hasMinimumFundamentals, fundamentalCoverage, evidenceStatus, determineReviewStatus, validateCsvRow };
})();

if (typeof globalThis !== "undefined") globalThis.CompanyCalculations = CompanyCalculations;

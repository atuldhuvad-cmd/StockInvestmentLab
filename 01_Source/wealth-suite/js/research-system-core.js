/* ============================================================================
   Long-Term Research System — shared domain and calculation foundation
   ============================================================================
   This file contains deterministic, source-agnostic rules. It does not fetch
   data or infer missing values. Acquisition adapters can be added separately
   while preserving the provenance records defined here.
============================================================================ */

const ResearchSystemCore = (function () {
  const EVIDENCE_CLASSIFICATIONS = Object.freeze([
    "FACT", "CALCULATION", "MANAGEMENT_CLAIM",
    "ANALYST_INTERPRETATION", "INFERENCE", "UNKNOWN"
  ]);
  const SOURCE_STATUSES = Object.freeze([
    "AVAILABLE", "SOURCE_ACCESS_RESTRICTED", "NOT_FOUND", "PENDING"
  ]);
  const FRESHNESS_STATUSES = Object.freeze([
    "CURRENT", "RECENT", "STALE", "UNKNOWN", "SOURCE_RESTRICTED"
  ]);
  const MEMBERSHIP_STATUSES = Object.freeze(["ACTIVE", "INACTIVE"]);

  function requiredText(value, fieldName) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text) throw new Error(`${fieldName} is required`);
    return text;
  }

  function optionalText(value) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  function finiteNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function safeDivide(numerator, denominator) {
    const n = finiteNumber(numerator);
    const d = finiteNumber(denominator);
    return n === null || d === null || d === 0 ? null : n / d;
  }

  function percentChange(current, previous) {
    const ratio = safeDivide(finiteNumber(current) === null || finiteNumber(previous) === null
      ? null : current - previous, previous);
    return ratio === null ? null : ratio * 100;
  }

  function cagr(endingValue, beginningValue, years) {
    const end = finiteNumber(endingValue);
    const beginning = finiteNumber(beginningValue);
    const span = finiteNumber(years);
    if (end === null || beginning === null || span === null || end < 0 || beginning <= 0 || span <= 0) return null;
    return (Math.pow(end / beginning, 1 / span) - 1) * 100;
  }

  function normalizeCompany(input) {
    const symbol = requiredText(input && input.symbol, "symbol").toUpperCase();
    const companyId = optionalText(input.companyId) || optionalText(input.isin) || symbol;
    return {
      companyId,
      symbol,
      companyName: requiredText(input.companyName, "companyName"),
      isin: optionalText(input.isin),
      sector: optionalText(input.sector),
      industry: optionalText(input.industry),
      active: input.active !== false
    };
  }

  function normalizeMembership(input) {
    const status = requiredText(input && input.status, "status").toUpperCase();
    if (!MEMBERSHIP_STATUSES.includes(status)) throw new Error("status must be ACTIVE or INACTIVE");
    return {
      id: requiredText(input.id, "id"),
      universeId: requiredText(input.universeId, "universeId"),
      companyId: requiredText(input.companyId, "companyId"),
      symbol: requiredText(input.symbol, "symbol").toUpperCase(),
      status,
      effectiveDate: requiredText(input.effectiveDate, "effectiveDate"),
      entryDate: optionalText(input.entryDate),
      exitDate: optionalText(input.exitDate),
      sourceId: requiredText(input.sourceId, "sourceId"),
      retrievedAt: requiredText(input.retrievedAt, "retrievedAt")
    };
  }

  function buildSourceRecord(input) {
    const sourceStatus = (optionalText(input && input.sourceStatus) || "AVAILABLE").toUpperCase();
    if (!SOURCE_STATUSES.includes(sourceStatus)) throw new Error("Invalid sourceStatus");
    return {
      sourceId: requiredText(input.sourceId, "sourceId"),
      companyId: optionalText(input.companyId),
      symbol: optionalText(input.symbol) ? input.symbol.trim().toUpperCase() : null,
      sourceType: requiredText(input.sourceType, "sourceType").toUpperCase(),
      organization: requiredText(input.organization, "organization"),
      documentTitle: requiredText(input.documentTitle, "documentTitle"),
      url: requiredText(input.url, "url"),
      publicationDate: optionalText(input.publicationDate),
      reportingPeriod: optionalText(input.reportingPeriod),
      retrievedAt: requiredText(input.retrievedAt, "retrievedAt"),
      sourceStatus,
      dataCoverage: optionalText(input.dataCoverage),
      relevantSection: optionalText(input.relevantSection),
      extractionStatus: optionalText(input.extractionStatus),
      validationStatus: optionalText(input.validationStatus),
      lastChecked: optionalText(input.lastChecked),
      notes: optionalText(input.notes)
    };
  }

  function buildEvidenceRecord(input) {
    const classification = requiredText(input && input.classification, "classification").toUpperCase();
    if (!EVIDENCE_CLASSIFICATIONS.includes(classification)) throw new Error("Invalid evidence classification");
    const sourceId = optionalText(input.sourceId);
    const calculationLogic = optionalText(input.calculationLogic);
    const sourceEvidenceIds = Array.isArray(input.sourceEvidenceIds) ? input.sourceEvidenceIds.slice() : [];
    if (["FACT", "MANAGEMENT_CLAIM"].includes(classification) && !sourceId) {
      throw new Error(`${classification} requires sourceId`);
    }
    if (classification === "CALCULATION" && (!calculationLogic || sourceEvidenceIds.length === 0)) {
      throw new Error("CALCULATION requires calculationLogic and sourceEvidenceIds");
    }
    return {
      evidenceId: requiredText(input.evidenceId, "evidenceId"),
      companyId: optionalText(input.companyId),
      symbol: optionalText(input.symbol) ? input.symbol.trim().toUpperCase() : null,
      claim: requiredText(input.claim, "claim"),
      classification,
      sourceId,
      calculationLogic,
      sourceEvidenceIds,
      createdAt: requiredText(input.createdAt, "createdAt")
    };
  }

  function freshnessStatus(record, now, rules) {
    if (record && record.sourceStatus === "SOURCE_ACCESS_RESTRICTED") return "SOURCE_RESTRICTED";
    const retrievedAt = record && Date.parse(record.retrievedAt);
    const currentTime = now instanceof Date ? now.getTime() : Date.parse(now);
    if (!Number.isFinite(retrievedAt) || !Number.isFinite(currentTime)) return "UNKNOWN";
    const ageDays = Math.max(0, (currentTime - retrievedAt) / 86400000);
    const currentDays = finiteNumber(rules && rules.currentDays);
    const recentDays = finiteNumber(rules && rules.recentDays);
    if (currentDays === null || recentDays === null || currentDays < 0 || recentDays < currentDays) return "UNKNOWN";
    if (ageDays <= currentDays) return "CURRENT";
    if (ageDays <= recentDays) return "RECENT";
    return "STALE";
  }

  function calculateCoreKpis(input) {
    const revenue = finiteNumber(input && input.revenue);
    const previousRevenue = finiteNumber(input && input.previousRevenue);
    const ebitda = finiteNumber(input && input.ebitda);
    const ebit = finiteNumber(input && input.ebit);
    const pat = finiteNumber(input && input.pat);
    const operatingCashFlow = finiteNumber(input && input.operatingCashFlow);
    const capex = finiteNumber(input && input.capex);
    const shares = finiteNumber(input && input.sharesOutstanding);
    const debt = finiteNumber(input && input.totalDebt);
    const cash = finiteNumber(input && input.cash);
    const interestExpense = finiteNumber(input && input.interestExpense);
    const currentAssets = finiteNumber(input && input.currentAssets);
    const currentLiabilities = finiteNumber(input && input.currentLiabilities);
    const marketPrice = finiteNumber(input && input.marketPrice);
    const fcf = operatingCashFlow === null || capex === null ? null : operatingCashFlow - capex;
    const eps = safeDivide(pat, shares);
    return {
      revenueGrowthYoY: percentChange(revenue, previousRevenue),
      ebitdaMargin: safeDivide(ebitda, revenue) === null ? null : safeDivide(ebitda, revenue) * 100,
      operatingMargin: safeDivide(ebit, revenue) === null ? null : safeDivide(ebit, revenue) * 100,
      eps,
      freeCashFlow: fcf,
      fcfMargin: safeDivide(fcf, revenue) === null ? null : safeDivide(fcf, revenue) * 100,
      fcfConversion: safeDivide(fcf, pat) === null ? null : safeDivide(fcf, pat) * 100,
      netDebt: debt === null || cash === null ? null : debt - cash,
      netDebtToEbitda: debt === null || cash === null ? null : safeDivide(debt - cash, ebitda),
      interestCoverage: safeDivide(ebit, interestExpense),
      workingCapital: currentAssets === null || currentLiabilities === null ? null : currentAssets - currentLiabilities,
      capexToRevenue: safeDivide(capex, revenue) === null ? null : safeDivide(capex, revenue) * 100,
      priceToEarnings: safeDivide(marketPrice, eps)
    };
  }

  function compareGuidance(actual, guidance, tolerancePct) {
    const actualValue = finiteNumber(actual);
    const guidanceValue = finiteNumber(guidance);
    const tolerance = finiteNumber(tolerancePct);
    if (actualValue === null || guidanceValue === null || tolerance === null || tolerance < 0 || guidanceValue === 0) {
      return { result: "UNKNOWN", variancePct: null };
    }
    const variancePct = percentChange(actualValue, guidanceValue);
    const result = variancePct > tolerance ? "BEAT" : variancePct < -tolerance ? "MISS" : "MEET";
    return { result, variancePct };
  }

  function calculateScenario(input) {
    const baseRevenue = finiteNumber(input && input.baseRevenue);
    const revenueGrowthPct = finiteNumber(input && input.revenueGrowthPct);
    const marginPct = finiteNumber(input && input.marginPct);
    const valuationMultiple = finiteNumber(input && input.valuationMultiple);
    const sharesOutstanding = finiteNumber(input && input.sharesOutstanding);
    if ([baseRevenue, revenueGrowthPct, marginPct, valuationMultiple, sharesOutstanding].some(value => value === null) || sharesOutstanding <= 0) {
      return { projectedRevenue: null, projectedEarnings: null, impliedEquityValue: null, impliedValuePerShare: null };
    }
    const projectedRevenue = baseRevenue * (1 + revenueGrowthPct / 100);
    const projectedEarnings = projectedRevenue * marginPct / 100;
    const impliedEquityValue = projectedEarnings * valuationMultiple;
    return {
      projectedRevenue,
      projectedEarnings,
      impliedEquityValue,
      impliedValuePerShare: impliedEquityValue / sharesOutstanding
    };
  }

  return {
    EVIDENCE_CLASSIFICATIONS,
    SOURCE_STATUSES,
    FRESHNESS_STATUSES,
    MEMBERSHIP_STATUSES,
    safeDivide,
    percentChange,
    cagr,
    normalizeCompany,
    normalizeMembership,
    buildSourceRecord,
    buildEvidenceRecord,
    freshnessStatus,
    calculateCoreKpis,
    compareGuidance,
    calculateScenario
  };
})();

if (typeof globalThis !== "undefined") globalThis.ResearchSystemCore = ResearchSystemCore;

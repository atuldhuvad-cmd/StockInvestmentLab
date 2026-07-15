/* ============================================================================
   Overview Module
   ============================================================================
   A read-only daily summary. Every number comes from the existing shared
   state or an already-frozen module calculation; rendering never writes to
   WealthData or persistence.
============================================================================ */

const OverviewModule = (function () {

  const MACRO_PRESENTATION = {
    repoRate: { label: "RBI Repo Rate", suffix: "%" },
    cpiInflation: { label: "CPI Inflation", suffix: "%" },
    usdinr: { label: "USD/INR", suffix: "" },
    crudeOil: { label: "Crude Oil", prefix: "$", suffix: "" },
    bondYield10Y: { label: "10Y Bond Yield", suffix: "%" },
    fiiNet: { label: "FII Net Flow", suffix: " Cr" },
    diiNet: { label: "DII Net Flow", suffix: " Cr" }
  };

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtINR(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "—";
    const negative = value < 0;
    const amount = Math.abs(Math.round(value)).toLocaleString("en-IN");
    return `${negative ? "−" : ""}₹${amount}`;
  }

  function fmtDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  function watchlistLabel(category) {
    return category === "Research" ? "Needs Study" : (category || "Unclassified");
  }

  function latestPoint(series) {
    if (!Array.isArray(series) || !series.length) return null;
    return series.slice().sort((a, b) => new Date(a.date) - new Date(b.date))[series.length - 1] || null;
  }

  function buildViewModel() {
    const state = WealthData.get();

    const includedHoldings = WealthData.getHoldings().filter(h => h.active !== false);
    const portfolioSummary = PortfolioModule.computeSummary(includedHoldings.map(PortfolioModule.computeRow));
    const realisedGain = PortfolioModule.computeRealisedGain(WealthData.getPortfolioTransactions());

    const watchlistCounts = {};
    WealthData.getWatchlist().forEach(item => {
      const label = watchlistLabel(item.category);
      watchlistCounts[label] = (watchlistCounts[label] || 0) + 1;
    });

    const deliveryCandidates = Object.keys(state.fundamentals || {})
      .map(DeliveryScreenerModule.computeCandidate)
      .filter(Boolean)
      .sort((a, b) => b.overall - a.overall || a.ticker.localeCompare(b.ticker));

    const researchEntries = WealthData.getResearchLibrary();
    const researchSummary = ResearchModule.computeSummary(researchEntries);
    const latestResearch = researchEntries.slice()
      .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))
      .slice(0, 3)
      .map(entry => ({
        ticker: entry.ticker,
        title: entry.title,
        type: ResearchModule.getResearchTypeDisplayLabel(entry.docType),
        addedAt: entry.addedAt
      }));

    const fundamentals = Object.values(state.fundamentals || {});
    const fiscalYears = fundamentals.flatMap(item => Array.isArray(item.years) ? item.years.map(year => Number(year.year)) : [])
      .filter(Number.isFinite);
    const latestFiscalYear = fiscalYears.length ? Math.max(...fiscalYears) : null;

    const macroReadings = Object.entries(MACRO_PRESENTATION).map(([key, presentation]) => {
      const point = latestPoint((state.macroIndicators || {})[key]);
      return point ? { key, ...presentation, point } : null;
    }).filter(Boolean);
    const macroDates = macroReadings.map(item => new Date(item.point.date).getTime()).filter(Number.isFinite);
    const latestMacroDate = macroDates.length ? new Date(Math.max(...macroDates)).toISOString() : null;

    const allocation = IntradayModule.computeAllocation();

    return {
      portfolio: { count: includedHoldings.length, realisedGain, ...portfolioSummary },
      watchlist: { total: WealthData.getWatchlist().length, counts: watchlistCounts },
      delivery: { available: deliveryCandidates.length, top: deliveryCandidates.slice(0, 3) },
      research: { ...researchSummary, latest: latestResearch },
      fundamentals: { companyCount: fundamentals.length, latestFiscalYear },
      macro: { latestDate: latestMacroDate, readings: macroReadings },
      intraday: {
        allocationPct: WealthData.getSetting("intradaySatelliteAllocationPct"),
        minRiskRewardRatio: WealthData.getSetting("minRiskRewardRatio"),
        ceilingAmount: allocation.ceilingAmount
      },
      dataStatus: {
        indexedDB: "Loaded",
        schemaVersion: state.meta && state.meta.schemaVersion !== undefined ? state.meta.schemaVersion : null,
        lastBackupAt: state.meta && state.meta.lastBackupAt ? state.meta.lastBackupAt : null
      }
    };
  }

  function metric(label, value, className = "") {
    return `<div class="ratio-cell"><div class="ratio-label">${escapeHtml(label)}</div><div class="ratio-value ${className}">${escapeHtml(value)}</div></div>`;
  }

  function section(title, content) {
    return `<section class="overview-section"><div class="section-head"><span class="section-title">${escapeHtml(title)}</span></div>${content}</section>`;
  }

  function render(container) {
    const model = buildViewModel();
    const gainClass = model.portfolio.totalGain < 0 ? "overview-loss" : "overview-gain";

    const portfolio = model.portfolio.count
      ? `<div class="ratio-grid overview-ratios">
          ${metric("Portfolio value", fmtINR(model.portfolio.totalValue))}
          ${metric("Invested", fmtINR(model.portfolio.totalInvested))}
          ${metric("Unrealised gain/loss", fmtINR(model.portfolio.totalGain), gainClass)}
          ${metric("Realised gain/loss", fmtINR(model.portfolio.realisedGain), model.portfolio.realisedGain < 0 ? "overview-loss" : "overview-gain")}
          ${metric("Included holdings", String(model.portfolio.count))}
        </div>`
      : `<p class="overview-empty">No holdings yet. Add holdings in Portfolio to see value and gain/loss here.</p>`;

    const watchlistCategories = Object.entries(model.watchlist.counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, count]) => `<div class="overview-list-row"><span>${escapeHtml(label)}</span><strong>${count}</strong></div>`)
      .join("");
    const watchlist = model.watchlist.total
      ? `<div class="ratio-grid overview-ratios">${metric("Total items", String(model.watchlist.total))}</div><div class="overview-list">${watchlistCategories}</div>`
      : `<p class="overview-empty">No watchlist items yet.</p>`;

    const delivery = model.delivery.available
      ? `<div class="ratio-grid overview-ratios">${metric("Available companies", String(model.delivery.available))}</div>
         <div class="overview-list">${model.delivery.top.map((item, index) => `
           <div class="overview-list-row"><span>${index + 1}. ${escapeHtml(item.ticker)}</span><strong>${item.overall.toFixed(1)} · ${escapeHtml(item.rating)}</strong></div>
         `).join("")}</div>`
      : `<p class="overview-empty">No companies can be ranked yet. Add Fundamentals data first.</p>`;

    const research = model.research.totalEntries
      ? `<div class="ratio-grid overview-ratios">
          ${metric("Records", String(model.research.totalEntries))}
          ${metric("Companies", String(model.research.companyCount))}
        </div>
        <div class="overview-list">${model.research.latest.map(item => `
          <div class="overview-list-row overview-list-row-stacked">
            <span><strong>${escapeHtml(item.ticker || "—")}</strong> · ${escapeHtml(item.type)}</span>
            <span>${escapeHtml(item.title || "Untitled")} · ${escapeHtml(fmtDate(item.addedAt))}</span>
          </div>
        `).join("")}</div>`
      : `<p class="overview-empty">No Research records yet.</p>`;

    const fundamentals = model.fundamentals.companyCount
      ? `<div class="ratio-grid overview-ratios">
          ${metric("Companies", String(model.fundamentals.companyCount))}
          ${metric("Latest fiscal year", model.fundamentals.latestFiscalYear === null ? "—" : `FY${model.fundamentals.latestFiscalYear}`)}
        </div><p class="overview-note">Financial history is available for ${model.fundamentals.companyCount} ${model.fundamentals.companyCount === 1 ? "company" : "companies"}.</p>`
      : `<p class="overview-empty">No Fundamentals data available.</p>`;

    const macro = model.macro.readings.length
      ? `<div class="ratio-grid overview-ratios">
          ${metric("Latest snapshot", fmtDate(model.macro.latestDate))}
          ${metric("Indicators available", String(model.macro.readings.length))}
        </div>
        <div class="overview-list">${model.macro.readings.map(item => {
          const rawValue = item.point.value;
          const value = typeof rawValue === "number" && Number.isFinite(rawValue)
            ? `${item.prefix || ""}${rawValue.toLocaleString("en-IN")}${item.suffix || ""}` : "—";
          return `<div class="overview-list-row"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(value)}</strong></div>`;
        }).join("")}</div>`
      : `<p class="overview-empty">No Macro snapshots imported yet.</p>`;

    const allocationPct = typeof model.intraday.allocationPct === "number" && Number.isFinite(model.intraday.allocationPct) ? `${model.intraday.allocationPct}%` : "—";
    const minRiskReward = typeof model.intraday.minRiskRewardRatio === "number" && Number.isFinite(model.intraday.minRiskRewardRatio) ? `${model.intraday.minRiskRewardRatio}:1` : "—";
    const intraday = `<div class="ratio-grid overview-ratios">
      ${metric("Allocation ceiling", allocationPct)}
      ${metric("Minimum risk/reward", minRiskReward)}
      ${metric("Calculated ceiling", fmtINR(model.intraday.ceilingAmount))}
    </div>`;

    const dataStatus = `<div class="overview-list">
      <div class="overview-list-row"><span>IndexedDB</span><strong>${escapeHtml(model.dataStatus.indexedDB)}</strong></div>
      <div class="overview-list-row"><span>Schema version</span><strong>${model.dataStatus.schemaVersion === null ? "—" : escapeHtml(model.dataStatus.schemaVersion)}</strong></div>
      <div class="overview-list-row"><span>Last backup</span><strong>${model.dataStatus.lastBackupAt ? escapeHtml(fmtDate(model.dataStatus.lastBackupAt)) : "Not recorded"}</strong></div>
    </div>`;

    container.innerHTML = `
      <div class="module-header">
        <h2>Overview</h2>
        <p class="module-sub">A factual daily snapshot of the data already in this browser. Scores and ratings are decision support, not automatic investment advice.</p>
      </div>
      <div class="overview-grid">
        ${section("Portfolio", portfolio)}
        ${section("Watchlist", watchlist)}
        ${section("Delivery", delivery)}
        ${section("Research", research)}
        ${section("Fundamentals", fundamentals)}
        ${section("Macro", macro)}
        ${section("Intraday", intraday)}
        ${section("Data status", dataStatus)}
      </div>
    `;
  }

  return { render, buildViewModel };
})();

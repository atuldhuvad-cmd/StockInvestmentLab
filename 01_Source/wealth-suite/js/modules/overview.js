/* ============================================================================
   Overview Module
   ============================================================================
   A read-only daily summary. Every number comes from the existing shared
   state or an already-frozen module calculation; rendering never writes to
   WealthData or persistence.
============================================================================ */

const OverviewModule = (function () {

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

  function latestValidDate(values) {
    const timestamps = values.map(value => new Date(value).getTime()).filter(Number.isFinite);
    return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
  }

  function getBackupStatus(lastBackupAt, now = new Date()) {
    if (!lastBackupAt) return "Never created";
    const backupTime = new Date(lastBackupAt).getTime();
    const nowTime = new Date(now).getTime();
    if (!Number.isFinite(backupTime) || !Number.isFinite(nowTime)) return "Never created";
    return nowTime - backupTime <= 7 * 24 * 60 * 60 * 1000 ? "Current" : "Due";
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

    const fundamentals = Object.values(state.fundamentals || {});
    const fiscalYears = fundamentals.flatMap(item => Array.isArray(item.years) ? item.years.map(year => Number(year.year)) : [])
      .filter(Number.isFinite);
    const latestFiscalYear = fiscalYears.length ? Math.max(...fiscalYears) : null;

    const transactions = WealthData.getPortfolioTransactions();
    const portfolioLastUpdated = latestValidDate(transactions.map(item => item.createdAt));
    const latestTransactionDate = latestValidDate(transactions.map(item => item.transactionDate));
    const priceRecords = Object.values(state.priceHistory || {});
    const latestPriceHistoryDate = latestValidDate(priceRecords.flatMap(record =>
      Array.isArray(record && record.rows) ? record.rows.map(row => row.date) : []
    ));
    const completeTechnicalCount = deliveryCandidates.filter(item => item.technical && item.technical.available).length;
    const waitingTechnicalCount = Math.max(0, deliveryCandidates.length - completeTechnicalCount);
    const lastBackupAt = state.meta && state.meta.lastBackupAt ? state.meta.lastBackupAt : null;
    const paperDelivery = PaperDelivery.summary(state);

    return {
      portfolio: { count: includedHoldings.length, realisedGain, ...portfolioSummary },
      paperDelivery,
      watchlist: { total: WealthData.getWatchlist().length, counts: watchlistCounts },
      delivery: { available: deliveryCandidates.length, top: deliveryCandidates.slice(0, 3) },
      fundamentals: { companyCount: fundamentals.length, latestFiscalYear },
      dataHealth: {
        portfolioLastUpdated,
        latestTransactionDate,
        latestPriceHistoryDate,
        completeTechnicalCount,
        waitingTechnicalCount,
        latestFiscalYear,
        lastBackupAt,
        backupStatus: getBackupStatus(lastBackupAt)
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
      : `<p class="overview-empty">No portfolio holdings entered.</p>`;

    const paperDelivery = model.paperDelivery.config.startingCapital > 0 || model.paperDelivery.latestTransaction
      ? `<div class="ratio-grid overview-ratios">
          ${metric("Paper Capital", fmtINR(model.paperDelivery.config.startingCapital))}
          ${metric("Open Paper Holdings", String(model.paperDelivery.openHoldings))}
          ${metric("Current Paper Value", fmtINR(model.paperDelivery.currentValue))}
          ${metric("Unrealised Gain/Loss", fmtINR(model.paperDelivery.unrealisedGain), model.paperDelivery.unrealisedGain < 0 ? "overview-loss" : "overview-gain")}
          ${metric("Realised Gain/Loss", fmtINR(model.paperDelivery.realisedGain), model.paperDelivery.realisedGain < 0 ? "overview-loss" : "overview-gain")}
          ${metric("Latest Paper Transaction", model.paperDelivery.latestTransaction ? fmtDate(model.paperDelivery.latestTransaction.transactionDate) : "—")}
        </div><p class="overview-note">Simulation only. Paper values are not included in real Portfolio wealth.</p>`
      : `<p class="overview-empty">No Paper Delivery positions yet. Set paper capital in Delivery to begin a separate simulation.</p>`;

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

    const fundamentals = model.fundamentals.companyCount
      ? `<div class="ratio-grid overview-ratios">
          ${metric("Companies", String(model.fundamentals.companyCount))}
          ${metric("Latest fiscal year", model.fundamentals.latestFiscalYear === null ? "—" : `FY${model.fundamentals.latestFiscalYear}`)}
        </div><p class="overview-note">Financial history is available for ${model.fundamentals.companyCount} ${model.fundamentals.companyCount === 1 ? "company" : "companies"}.</p>`
      : `<p class="overview-empty">No Fundamentals data available.</p>`;

    const dataHealth = `<div class="overview-list">
      <div class="overview-list-row"><span>Portfolio last updated</span><strong>${model.dataHealth.portfolioLastUpdated ? escapeHtml(fmtDate(model.dataHealth.portfolioLastUpdated)) : "—"}</strong></div>
      <div class="overview-list-row"><span>Latest portfolio transaction</span><strong>${model.dataHealth.latestTransactionDate ? escapeHtml(fmtDate(model.dataHealth.latestTransactionDate)) : "No portfolio transactions recorded"}</strong></div>
      <div class="overview-list-row"><span>Latest imported price-history date</span><strong>${model.dataHealth.latestPriceHistoryDate ? escapeHtml(fmtDate(model.dataHealth.latestPriceHistoryDate)) : "—"}</strong></div>
      <div class="overview-list-row"><span>Complete Technical Trend</span><strong>${model.dataHealth.completeTechnicalCount}</strong></div>
      <div class="overview-list-row"><span>Waiting for price history</span><strong>${model.dataHealth.waitingTechnicalCount}</strong></div>
      <div class="overview-list-row"><span>Latest Fundamentals fiscal year</span><strong>${model.dataHealth.latestFiscalYear === null ? "—" : `FY${model.dataHealth.latestFiscalYear}`}</strong></div>
      <div class="overview-list-row"><span>Last backup</span><strong>${model.dataHealth.lastBackupAt ? escapeHtml(fmtDate(model.dataHealth.lastBackupAt)) : "Never recorded"}</strong></div>
      <div class="overview-list-row"><span>Backup status</span><strong>${escapeHtml(model.dataHealth.backupStatus)}</strong></div>
    </div>`;
    const healthNotes = `${model.dataHealth.waitingTechnicalCount
      ? `<p class="overview-note">Price history required for ${model.dataHealth.waitingTechnicalCount} ${model.dataHealth.waitingTechnicalCount === 1 ? "company" : "companies"}.</p>` : ""}
      ${model.dataHealth.backupStatus === "Never created"
        ? '<p class="overview-empty">No backup recorded — export a backup after entering important data.</p>' : ""}`;

    container.innerHTML = `
      <div class="module-header">
        <h2>Overview</h2>
        <p class="module-sub">A factual daily snapshot of the data already in this browser. Scores and ratings are decision support, not automatic investment advice.</p>
      </div>
      <div class="overview-grid">
        ${section("Portfolio", portfolio)}
        ${section("Paper Delivery Portfolio", paperDelivery)}
        ${section("Watchlist", watchlist)}
        ${section("Delivery", delivery)}
        ${section("Fundamentals", fundamentals)}
        ${section("Data & Backup Health", dataHealth + healthNotes)}
      </div>
    `;
  }

  return { render, buildViewModel, getBackupStatus };
})();

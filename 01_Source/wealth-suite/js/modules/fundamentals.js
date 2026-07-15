/* ============================================================================
   Fundamentals Module
   ============================================================================
   Ported from the earlier Engine 2 (wealth-intelligence-fundamentals-v3.jsx)
   artifact. The calculation formulas are UNCHANGED — same ROE/ROCE/D-E math,
   same qualitative-score weighting — only the data source changed, from a
   component's local state to the shared WealthData model, per the
   "change the data source, not the business logic" principle established
   earlier this session.
============================================================================ */

const FundamentalsModule = (function () {

  function seedIfEmpty() {
    const existing = WealthData.get().fundamentals;
    if (Object.keys(existing).length > 0) return; // real saved data exists — never overwrite it
    Object.entries(SEED_FUNDAMENTALS).forEach(([ticker, company]) => {
      WealthData.upsertSecurity(ticker, {
        displayName: company.name, sector: company.sector, isBank: company.isBank, indexMember: "NIFTY50"
      });
      WealthData.upsertFundamentals(ticker, {
        years: company.years, qualitative: company.qualitative,
        auditorLog: company.auditorLog, quarters: company.quarters,
        fetchedAt: "2026-07-12", source: company.dataSource
      });
    });
  }

  // ---- Ratio calculations — unchanged from Engine 2 ----
  // FIN-D01–D04 fix, 2026-07-12: latestRatios() moved to CompanyCalculations
  // (company-calculations.js) so Delivery Screener shares this single,
  // guarded definition instead of maintaining its own unfixed copy.
  const latestRatios = CompanyCalculations.latestRatios;

  // Historical ROE is presentation-only. Preserve its established truthy
  // equity guard and exact one-decimal/placeholder output; this intentionally
  // does not change the stricter latestRatios() behavior above.
  function formatHistoricalRoe(year) {
    const roe = year.totalEquity ? (year.netProfit / year.totalEquity) * 100 : null;
    return `${roe === null ? "—" : roe.toFixed(1)}%`;
  }

  const qualityScore = CompanyCalculations.qualityScore;
  const detectRedFlags = CompanyCalculations.detectRedFlags;

  function render(container) {
    seedIfEmpty();
    const fundamentals = WealthData.get().fundamentals;
    const securities = WealthData.get().securities;

    container.innerHTML = `
      <div class="module-header">
        <h2>Fundamentals</h2>
        <p class="module-sub">Real financial ratios, quality scoring, and red-flag detection. Ported unchanged from the earlier Engine 2 — only the data source moved.</p>
      </div>
      ${ListControls.renderControlsBar("fund-controls",
        ListControls.uniqueSectors(Object.keys(fundamentals), t => (WealthData.getSecurity(t)||{}).sector),
        [{key:"ticker",label:"Sort: Ticker A-Z"},{key:"quality",label:"Sort: Quality score"}], "ticker")}
      <div class="ticket-tabs" id="fund-ticker-tabs"></div>
      <div id="fund-detail"></div>
    `;

    const state = { searchText: "", sector: "All", sortKey: "ticker", sortDir: "asc" };
    let selectedTicker = null;

    function refreshList() {
      const allTickers = Object.keys(fundamentals);
      const filtered = ListControls.filterAndSort(allTickers, {
        searchText: state.searchText, sector: state.sector, sortKey: state.sortKey, sortDir: state.sortDir,
        getSearchable: t => t + " " + ((WealthData.getSecurity(t)||{}).displayName || ""),
        getSector: t => (WealthData.getSecurity(t)||{}).sector,
        getSortValue: (t, key) => key === "quality" ? qualityScore(fundamentals[t].qualitative) : t
      });

      container.querySelector("#fund-controls-count").textContent = `${filtered.length} of ${allTickers.length} companies`;

      const tabsEl = container.querySelector("#fund-ticker-tabs");
      tabsEl.innerHTML = filtered.length
        ? filtered.map(t => `<button class="ticker-chip ${t===selectedTicker?'active':''}" data-ticker="${t}">${t}</button>`).join("")
        : `<div class="module-sub" style="font-style:italic;">No companies match this search/filter.</div>`;
      tabsEl.querySelectorAll(".ticker-chip").forEach(btn => {
        btn.addEventListener("click", () => {
          selectedTicker = btn.dataset.ticker;
          tabsEl.querySelectorAll(".ticker-chip").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          renderDetail(container.querySelector("#fund-detail"), selectedTicker);
        });
      });

      if (!selectedTicker && filtered.length) selectedTicker = filtered[0];
      if (selectedTicker && filtered.includes(selectedTicker)) {
        renderDetail(container.querySelector("#fund-detail"), selectedTicker);
      } else if (!filtered.length) {
        container.querySelector("#fund-detail").innerHTML = "";
      }
    }

    ListControls.wireControls(container, "fund-controls", state, refreshList);
    refreshList();
  }

  function renderDetail(el, ticker) {
    const fundamentals = WealthData.getFundamentals(ticker);
    const security = WealthData.getSecurity(ticker);
    const r = latestRatios(fundamentals);
    const quality = qualityScore(fundamentals.qualitative);
    const flags = detectRedFlags(fundamentals);

    // FUND-D02/D03 fix, defense-in-depth half: fmt() now also guards NaN and
    // Infinity, not just null/undefined — protects against ANY future
    // calculation that produces a non-finite number, not only Revenue CAGR.
    const fmt = (v, suffix = "", dp = 1) => (v === null || v === undefined || isNaN(v) || !isFinite(v)) ? "—" : v.toFixed(dp) + suffix;

    el.innerHTML = `
      <div class="ticket">
        <div class="ticket-body" style="width:100%">
          <div class="ticket-top">
            <div>
              <div class="ticket-ticker">${ticker}</div>
              <div class="module-sub" style="margin:2px 0 0">${security.displayName} · ${security.sector}${security.isBank ? ' · Financial institution — ratios below need care (see note)' : ''}</div>
            </div>
            <div class="ticket-score"><div class="n">${quality === null ? "—" : quality.toFixed(0)}</div><div class="l">quality /100</div></div>
          </div>

          <div class="ratio-grid">
            <div class="ratio-cell"><div class="ratio-label">ROE</div><div class="ratio-value">${fmt(r.roe, "%")}</div></div>
            <div class="ratio-cell"><div class="ratio-label">ROCE</div><div class="ratio-value">${fmt(r.roce, "%")}</div></div>
            <div class="ratio-cell"><div class="ratio-label">Debt/Equity</div><div class="ratio-value">${fmt(r.debtEquity, "", 2)}</div></div>
            <div class="ratio-cell"><div class="ratio-label">Net Margin</div><div class="ratio-value">${fmt(r.netMargin, "%")}</div></div>
            <div class="ratio-cell"><div class="ratio-label">Revenue CAGR</div><div class="ratio-value">${fmt(r.revenueCagr, "%")}</div></div>
            <div class="ratio-cell"><div class="ratio-label">P/E</div><div class="ratio-value">${fmt(r.pe, "x")}</div></div>
          </div>

          ${security.isBank ? `<div class="warn-inline" style="display:block;margin-top:14px;">This is a bank/lender. Debt/Equity and current-ratio-style metrics don't map onto a financial institution's balance sheet the way they do for other companies — read with that in mind.</div>` : ""}

          <div class="section-head" style="margin-top:24px;"><span class="section-title" style="font-size:15px;">Red flags</span></div>
          ${flags.length
            ? `<ul class="flag-list">${flags.map(f => `<li>${f}</li>`).join("")}</ul>`
            : `<div class="ticket-reason">No red flags detected against the standard checks (debt growth, dilution, pledge, margin decline, negative operating cash flow, auditor changes).</div>`}

          <div class="section-head" style="margin-top:24px;"><span class="section-title" style="font-size:15px;">Year-by-year</span></div>

          <!-- Desktop: table (hidden on mobile via CSS). Mobile: cards below
               (hidden on desktop via CSS). Both loops read the SAME sorted
               years array — one data source, two presentations, exactly the
               "cards instead of wide tables on phones" rule from the charter. -->
          <div class="table-wrap">
            <table>
              <thead><tr><th>Year</th><th>Revenue (Cr)</th><th>Net Profit (Cr)</th><th>ROE</th><th>Promoter Hold.</th></tr></thead>
              <tbody>
                ${fundamentals.years.slice().sort((a,b)=>a.year-b.year).map(y => `
                  <tr>
                    <td>FY${y.year}</td>
                    <td>₹${y.revenue.toLocaleString('en-IN')}</td>
                    <td>₹${y.netProfit.toLocaleString('en-IN')}</td>
                    <td>${formatHistoricalRoe(y)}</td>
                    <td>${y.promoterHolding}%</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>

          <div class="card-list">
            ${fundamentals.years.slice().sort((a,b)=>b.year-a.year).map(y => `
              <div class="data-card">
                <div class="data-card-title">FY${y.year}</div>
                <div class="data-card-row"><span class="k">Revenue</span><span class="v">₹${y.revenue.toLocaleString('en-IN')} Cr</span></div>
                <div class="data-card-row"><span class="k">Net Profit</span><span class="v">₹${y.netProfit.toLocaleString('en-IN')} Cr</span></div>
                <div class="data-card-row"><span class="k">ROE</span><span class="v">${formatHistoricalRoe(y)}</span></div>
                <div class="data-card-row"><span class="k">Promoter Holding</span><span class="v">${y.promoterHolding}%</span></div>
              </div>
            `).join("")}
          </div>

          <div class="module-sub" style="margin-top:18px;font-style:italic;">Source: ${fundamentals.source || "unknown"} · Fetched: ${fundamentals.fetchedAt || "unknown"}</div>
        </div>
      </div>
    `;
  }

  return { render, formatHistoricalRoe };
})();

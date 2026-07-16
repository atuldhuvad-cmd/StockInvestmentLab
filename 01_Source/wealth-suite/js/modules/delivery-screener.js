/* ============================================================================
   Delivery Screener Module
   ============================================================================
   Implements delivery-screener-methodology.md EXACTLY — every formula here
   should be traceable line-for-line back to that document. If they diverge,
   the document is wrong or this file is wrong; they are never allowed to
   silently drift apart.

   Purpose: "Which companies deserve my research this week?" — not a buy/sell
   signal. Ranks companies with fundamentals data (Standalone Value Rule: a
   company with zero inputs can't be ranked, that's a ranking decision, not
   an error). Technical Trend pillar is "Not available" for everyone right
   now — there is no price-history data source in this app yet, and
   presenting synthetic technical output as if real would be dishonest.
============================================================================ */

const DeliveryScreenerModule = (function () {

  const PILLAR_WEIGHTS = { businessQuality: 0.25, financialStrength: 0.25, valuation: 0.20, technicalTrend: 0.15, risk: 0.15 };
  const DELIVERY_TABS = [
    ["screener", "Screener"],
    ["paper-portfolio", "Paper Portfolio"],
    ["paper-transactions", "Paper Transactions"],
    ["performance-review", "Performance Review"]
  ];
  let activeSubtab = "screener";
  let activeContainer = null;
  let pendingBuyTicker = null;
  let pendingSellTicker = null;
  let submitting = false;

  function scoreBand(value, points) {
    if (value === null || value === undefined) return null;
    if (value <= points[0][0]) return points[0][1];
    if (value >= points[points.length - 1][0]) return points[points.length - 1][1];
    for (let i = 0; i < points.length - 1; i++) {
      const [x1, y1] = points[i], [x2, y2] = points[i + 1];
      if (value >= x1 && value <= x2) return y1 + (y2 - y1) * (value - x1) / (x2 - x1);
    }
    return null;
  }
  const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

  // ---- Pillar 1: Business Quality — qualitative rating, unchanged from Fundamentals ----
  function businessQualityPillar(qualitative) {
    const score = CompanyCalculations.qualityScore(qualitative);
    // FIN-D05 fix, 2026-07-12 (Delivery Screener Phase 3): each factor now
    // guarded individually — a missing field produces score: null (correctly
    // excluded downstream by rankStrengthsAndRisks()'s `!== null` filter)
    // instead of NaN (which passed that same filter, since NaN !== null is
    // true in JavaScript, and could surface as a nonsensical Top Strength/Risk).
    const factorScore = (v) => (v === undefined || v === null || isNaN(v)) ? null : (v / 5) * 100;
    const subFactors = [
      { label: "Economic moat", score: factorScore(qualitative.economicMoat) },
      { label: "Pricing power", score: factorScore(qualitative.pricingPower) },
      { label: "Capital allocation", score: factorScore(qualitative.capitalAllocation) },
      { label: "Management quality", score: factorScore(qualitative.managementQuality) },
      { label: "Corporate governance", score: factorScore(qualitative.corporateGovernance) },
      { label: "Promoter integrity", score: factorScore(qualitative.promoterIntegrity) },
      { label: "Auditor quality", score: factorScore(qualitative.auditorQuality) }
    ];
    return { score, subFactors };
  }

  // ---- Pillar 2: Financial Strength — ROE, ROCE, D/E ----
  function financialStrengthPillar(ratios) {
    const roeScore = scoreBand(ratios.roe, [[0,0],[10,40],[15,65],[20,85],[30,100]]);
    const roceScore = ratios.roce !== null ? scoreBand(ratios.roce, [[0,0],[10,35],[15,60],[20,85],[30,100]]) : 50;
    const deScore = ratios.debtEquity !== null ? scoreBand(ratios.debtEquity, [[0,100],[0.3,85],[0.6,60],[1,35],[2,10]]) : 50;
    const score = (roeScore + roceScore + deScore) / 3;
    const subFactors = [
      { label: `ROE ${ratios.roe !== null ? ratios.roe.toFixed(1)+'%' : '—'}`, score: roeScore },
      { label: `ROCE ${ratios.roce !== null ? ratios.roce.toFixed(1)+'%' : '—'}`, score: roceScore },
      { label: `Debt/Equity ${ratios.debtEquity !== null ? ratios.debtEquity.toFixed(2) : '—'}`, score: deScore }
    ];
    return { score, subFactors };
  }

  // ---- Pillar 3: Valuation — Fair Value Gap, per the documented heuristic ----
  function valuationPillar(ratios, qualityScore) {
    if (ratios.pe === null || ratios.pe <= 0) {
      return { score: 50, gapPct: null, subFactors: [{ label: "P/E not available", score: 50 }] };
    }
    const reasonablePE = clamp(10 + (ratios.revenueCagr || 0) * 0.8 + (qualityScore - 50) * 0.15, 8, 45);
    const gapPct = (reasonablePE - ratios.pe) / ratios.pe * 100;
    const score = scoreBand(gapPct, [[-50,10],[-20,30],[0,55],[20,80],[50,100]]);
    return {
      score, gapPct, reasonablePE,
      subFactors: [
        { label: `Actual P/E ${ratios.pe.toFixed(1)}x`, score: null },
        { label: `Reasonable P/E (est.) ${reasonablePE.toFixed(1)}x`, score: null },
        { label: `Fair value gap ${gapPct >= 0 ? '+' : ''}${gapPct.toFixed(1)}%`, score }
      ]
    };
  }

  // ---- Pillar 4: Technical Trend — evaluated only from imported OHLCV ----
  function technicalTrendPillar(ticker) {
    const symbol = PriceHistory.normalizeSymbol(ticker);
    const record = WealthData.getPriceHistory(symbol);
    const analysis = PriceHistory.calculate(record && Array.isArray(record.rows) ? record.rows : []);
    const available = analysis.coverage === "Complete";
    return {
      score: available ? analysis.score : null,
      available,
      coverage: analysis.coverage,
      status: analysis.status,
      rowCount: analysis.rowCount,
      latestDate: analysis.latestDate,
      metrics: analysis,
      subFactors: analysis.rowCount
        ? analysis.conditions.map(condition => ({
            label: `${condition.passed ? "Passed" : "Failed"}: ${condition.label}`,
            score: available ? (condition.passed ? condition.points : 0) : null
          }))
        : [{ label: "Waiting for price history data", score: null }]
    };
  }

  // ---- Pillar 5: Risk — red flags, debt extremity, pledge trend ----
  const detectRedFlags = CompanyCalculations.detectRedFlags;

  function riskPillar(fundamentals, ratios) {
    const flags = detectRedFlags(fundamentals);
    const flagScore = scoreBand(flags.length, [[0,100],[1,70],[2,45],[3,15],[5,0]]);
    const deExtremityScore = ratios.debtEquity !== null ? scoreBand(ratios.debtEquity, [[0,100],[1,70],[2,30],[4,5]]) : 50;
    const score = (flagScore + deExtremityScore) / 2;
    const subFactors = [
      { label: `Red flags detected: ${flags.length}`, score: flagScore },
      { label: `Debt/Equity extremity`, score: deExtremityScore }
    ];
    return { score, flags, subFactors };
  }

  // ---- Combine pillars into Overall Score, re-weighting if Technical Trend is unavailable ----
  function computeOverall(pillars) {
    const available = Object.entries(PILLAR_WEIGHTS).filter(([key]) => pillars[key].score !== null);
    const totalWeight = available.reduce((s, [key, w]) => s + w, 0);
    const overall = available.reduce((s, [key, w]) => s + pillars[key].score * (w / totalWeight), 0);
    return clamp(overall);
  }

  function computeRating(overall, riskScore, redFlagCount) {
    if (overall < 45 || riskScore < 30 || redFlagCount >= 3) return "Avoid";
    if (overall >= 80 && riskScore >= 60) return "Strong Buy";
    if (overall >= 65) return "Buy";
    if (overall >= 45) return "Watch";
    return "Avoid";
  }

  // ---- Top 3 Strengths / Top 3 Risks — ranked from every sub-factor across all pillars ----
  function rankStrengthsAndRisks(pillars) {
    const allFactors = [];
    Object.values(pillars).forEach(p => {
      (p.subFactors || []).forEach(f => { if (f.score !== null) allFactors.push(f); });
    });
    const sorted = allFactors.slice().sort((a, b) => b.score - a.score);
    const strengths = sorted.slice(0, 3).map(f => f.label);
    const risks = sorted.slice(-3).reverse().map(f => f.label);
    return { strengths, risks };
  }

  // ---- Full per-company computation, matching the methodology doc exactly ----
  function computeCandidate(ticker) {
    const security = WealthData.getSecurity(ticker);
    const fundamentals = WealthData.getFundamentals(ticker);
    if (!fundamentals) return null; // Standalone Value Rule: no inputs, no ranking — not an error

    // FIN-D01–D04 fix, 2026-07-12 (Delivery Screener Phase 3): this used to
    // be an independent, unfixed copy of Fundamentals' ratio calculations
    // (proven to reproduce FUND-D01/D02/D03's exact defects — negative
    // equity/capEmployed and zero first-year revenue all produced broken
    // results here even after Fundamentals itself was fixed). Now calls the
    // single shared, guarded definition instead of maintaining a second copy.
    const ratios = CompanyCalculations.latestRatios(fundamentals);

    const bq = businessQualityPillar(fundamentals.qualitative);
    const fs = financialStrengthPillar(ratios);
    const val = valuationPillar(ratios, bq.score);
    const tech = technicalTrendPillar(ticker);
    const risk = riskPillar(fundamentals, ratios);

    const pillars = { businessQuality: bq, financialStrength: fs, valuation: val, technicalTrend: tech, risk };
    const overall = computeOverall(pillars);
    const completeModelRating = computeRating(overall, risk.score, risk.flags.length);
    const rating = !tech.available && completeModelRating === "Strong Buy" ? "Buy" : completeModelRating;
    const { strengths, risks } = rankStrengthsAndRisks(pillars);

    return {
      ticker, security, overall: Math.round(overall * 10) / 10, rating, pillars, strengths, risks, ratios,
      redFlagCount: risk.flags.length, assessment: tech.available ? "Complete" : "Partial",
      pillarCoverage: tech.available ? "5 of 5" : "4 of 5"
    };
  }

  function ratingColor(rating) {
    return { "Strong Buy": "gain", "Buy": "gain", "Watch": "flag", "Avoid": "loss" }[rating] || "";
  }

  const PAGE_SIZE = 20; // bounds DOM size regardless of universe size — the
                        // concrete answer to "never scroll through 500 manually"

  function render(container) {
    activeContainer = container;
    container.innerHTML = `
      <div class="module-header">
        <h2>Delivery</h2>
        <p class="module-sub">Screen delivery candidates and test decisions in a separate paper portfolio before committing real money.</p>
      </div>
      <div class="ticket-tabs delivery-subtabs">
        ${DELIVERY_TABS.map(([key, label]) => `<button class="ticker-chip ${key === activeSubtab ? "active" : ""}" data-delivery-tab="${key}">${label}</button>`).join("")}
      </div>
      <div id="delivery-subtab-content"></div>
    `;
    container.querySelectorAll("[data-delivery-tab]").forEach(button => {
      button.addEventListener("click", () => {
        activeSubtab = button.dataset.deliveryTab;
        render(container);
      });
    });
    const content = container.querySelector("#delivery-subtab-content");
    if (activeSubtab === "paper-portfolio") renderPaperPortfolio(content);
    else if (activeSubtab === "paper-transactions") renderPaperTransactions(content);
    else if (activeSubtab === "performance-review") renderPerformanceReview(content);
    else renderScreener(content);
  }

  function renderScreener(container) {
    const tickers = Object.keys(WealthData.get().fundamentals);
    // Computed ONCE per module open (measured: ~0.1ms/company, ~50ms at 500
    // companies — acceptable as a one-time cost). Filtering/sorting below
    // operates on this cached array, not by recomputing pillars per keystroke.
    const allCandidates = tickers.map(computeCandidate).filter(c => c !== null);
    const sortOptions = [
      { key: "overall", label: "Sort: Overall score" },
      { key: "businessQuality", label: "Sort: Business Quality" },
      { key: "financialStrength", label: "Sort: Financial Strength" },
      { key: "valuation", label: "Sort: Valuation" },
      { key: "risk", label: "Sort: Risk" }
    ];

    container.innerHTML = `
      <div class="module-header">
        <h2>Delivery Screener</h2>
        <p class="module-sub">Which companies deserve closer study this week — not a buy/sell signal, a shortlist to start from.</p>
      </div>
      <div class="panel" id="ds-price-import-panel" style="margin-bottom:20px;max-width:none;">
        <div class="section-head" style="margin-bottom:12px;"><span class="section-title" style="font-size:15px;">Import Price History CSV</span></div>
        <p class="module-sub" style="margin-bottom:14px;">Offline OHLCV only. Required columns: Date, Open, High, Low, Close, Volume. Ticker can be entered below or inferred from filenames such as TCS_5Y.csv or TCS.NS.csv.</p>
        <div class="field-row"><label for="ds-price-symbol">Ticker (optional if filename identifies it)</label><input type="text" id="ds-price-symbol" style="text-transform:uppercase" placeholder="e.g. TCS or TCS.NS"></div>
        <div class="field-row"><label for="ds-price-file">CSV file</label><input type="file" id="ds-price-file" accept=".csv,text/csv"></div>
        <button class="btn" id="ds-price-import-btn">Import CSV</button>
        <div class="module-sub" id="ds-price-import-result" style="margin-top:10px;"></div>
      </div>
      <div class="specimen">
        <h2>Reading this screen</h2>
        <p>Five pillars, always visible: Business Quality, Financial Strength, Valuation, Technical Trend, Risk. Technical Trend uses only an OHLCV CSV you select locally. Missing or limited history keeps the assessment partial and prevents the highest recommendation; 200 or more valid rows completes the five-pillar model.</p>
        <p class="final">Ranked from your ${allCandidates.length} companies with fundamentals data. A company with no fundamentals data can't be ranked — add it in Fundamentals first.</p>
      </div>
      ${ListControls.renderControlsBar("ds-controls", ListControls.uniqueSectors(allCandidates, c => c.security && c.security.sector), sortOptions, "overall")}
      <div id="ds-list"></div>
      <button class="btn" id="ds-show-more" style="display:none;background:transparent;border:1px solid var(--rule-bright);color:var(--paper-dim);margin-top:14px;">Show 20 more</button>
    `;

    const state = { searchText: "", sector: "All", sortKey: "overall", sortDir: "desc" };
    let visibleCount = PAGE_SIZE;

    const fileInput = container.querySelector("#ds-price-file");
    const symbolInput = container.querySelector("#ds-price-symbol");
    container.querySelector("#ds-price-import-btn").addEventListener("click", async () => {
      const file = fileInput.files[0];
      if (!file) { App.showStatus("Choose an OHLCV CSV file first", "error"); return; }
      const resultEl = container.querySelector("#ds-price-import-result");
      try {
        const parsed = PriceHistory.parseCSV(await file.text(), { fileName: file.name, symbol: symbolInput.value });
        if (!parsed.ok) { App.showStatus(parsed.error, "error"); resultEl.textContent = parsed.error; return; }
        if (!parsed.symbol) { App.showStatus("Enter a ticker or use a ticker-based filename", "error"); return; }
        if (!parsed.rows.length) { App.showStatus("CSV contains no valid OHLCV rows", "error"); return; }
        WealthData.setPriceHistory(parsed.symbol, {
          symbol: parsed.symbol,
          sourceSymbol: String(symbolInput.value || PriceHistory.inferSymbolFromFilename(file.name)).trim(),
          importedAt: new Date().toISOString(),
          rows: parsed.rows
        });
        await App.saveNow(false);
        const technical = PriceHistory.calculate(parsed.rows);
        App.showStatus(`Imported ${parsed.rows.length} price rows for ${parsed.symbol}`, "ok");
        renderScreener(container);
        const refreshedResult = container.querySelector("#ds-price-import-result");
        if (refreshedResult) refreshedResult.textContent = `${parsed.symbol}: ${parsed.rows.length} valid rows · ${technical.coverage} · latest ${technical.latestDate || "—"}`;
      } catch (error) {
        App.showStatus("Price history import failed: " + error.message, "error");
        resultEl.textContent = error.message;
      }
    });

    function refreshList() {
      const filtered = ListControls.filterAndSort(allCandidates, {
        searchText: state.searchText, sector: state.sector, sortKey: state.sortKey, sortDir: state.sortDir,
        getSearchable: c => c.ticker + " " + (c.security ? c.security.displayName : ""),
        getSector: c => c.security && c.security.sector,
        getSortValue: (c, key) => key === "overall" ? c.overall : c.pillars[key].score
      });

      container.querySelector("#ds-controls-count").textContent = `${filtered.length} of ${allCandidates.length} companies`;

      const listEl = container.querySelector("#ds-list");
      const toShow = filtered.slice(0, visibleCount);
      listEl.innerHTML = toShow.length
        ? toShow.map((c, i) => renderCard(c, i + 1)).join("")
        : `<div class="module-sub" style="font-style:italic;padding:20px 0;text-align:center;">No companies match this search/filter.</div>`;

      const moreBtn = container.querySelector("#ds-show-more");
      moreBtn.style.display = filtered.length > visibleCount ? "block" : "none";
      moreBtn.textContent = `Show 20 more (${filtered.length - visibleCount} remaining)`;

      listEl.querySelectorAll("[data-expand]").forEach(btn => {
        btn.addEventListener("click", () => {
          const target = listEl.querySelector(`#${btn.dataset.expand}`);
          const isOpen = target.style.display !== "none";
          target.style.display = isOpen ? "none" : "block";
          btn.textContent = isOpen ? "Show breakdown ▾" : "Hide breakdown ▴";
        });
      });
      listEl.querySelectorAll("[data-import-price]").forEach(btn => {
        btn.addEventListener("click", () => {
          symbolInput.value = btn.dataset.importPrice;
          fileInput.click();
          container.querySelector("#ds-price-import-panel").scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
      listEl.querySelectorAll("[data-paper-buy]").forEach(btn => {
        btn.addEventListener("click", () => {
          pendingBuyTicker = btn.dataset.paperBuy;
          pendingSellTicker = null;
          activeSubtab = "paper-portfolio";
          render(activeContainer);
        });
      });
    }

    container.querySelector("#ds-show-more").addEventListener("click", () => { visibleCount += PAGE_SIZE; refreshList(); });
    ListControls.wireControls(container, "ds-controls", state, () => { visibleCount = PAGE_SIZE; refreshList(); });
    refreshList();
  }

  function pillarRow(label, pillar) {
    const scoreText = pillar.score !== null ? Math.round(pillar.score) : "—";
    const note = pillar.available === false ? " (not available)" : "";
    return `
      <div class="ratio-cell">
        <div class="ratio-label">${label}${note}</div>
        <div class="ratio-value" style="${pillar.score === null ? 'color:var(--paper-faint);font-size:14px;' : ''}">${scoreText}</div>
      </div>
    `;
  }

  function formatMetric(value, suffix = "", decimals = 1) {
    return typeof value === "number" && Number.isFinite(value) ? value.toFixed(decimals) + suffix : "—";
  }

  function technicalDetail(candidate) {
    const technical = candidate.pillars.technicalTrend;
    const metrics = technical.metrics;
    if (!technical.rowCount) {
      return `<div class="specimen" style="margin-top:14px;">
        <h2>Technical Trend — Waiting for price history data</h2>
        <p>Assessment: Partial · Coverage: Missing · 4 of 5 pillars. No technical score is inferred without imported OHLCV history.</p>
        <button class="btn" data-import-price="${candidate.ticker}" style="margin-top:8px;">Import CSV for ${candidate.ticker}</button>
      </div>`;
    }
    const conditionList = metrics.conditions.map(condition =>
      `<li style="color:${condition.passed ? 'var(--gain)' : 'var(--loss)'};">${condition.passed ? '✓' : '✗'} ${condition.label}${technical.available ? ` (${condition.passed ? '+' + condition.points : '+0'})` : ''}</li>`
    ).join("");
    return `<div class="specimen" style="margin-top:14px;">
      <h2>Technical Trend — ${technical.coverage === 'Limited' ? 'Limited Technical Data' : technical.status}</h2>
      <p>Assessment: ${candidate.assessment} · Coverage: ${technical.coverage} · ${candidate.pillarCoverage} pillars · ${technical.rowCount} valid rows · latest ${technical.latestDate || '—'}</p>
      <div class="ratio-grid" style="margin:12px 0;">
        <div class="ratio-cell"><div class="ratio-label">Technical score</div><div class="ratio-value">${technical.score === null ? '—' : technical.score}</div></div>
        <div class="ratio-cell"><div class="ratio-label">Latest close</div><div class="ratio-value">${formatMetric(metrics.latestClose, '', 2)}</div></div>
        <div class="ratio-cell"><div class="ratio-label">50 DMA</div><div class="ratio-value">${formatMetric(metrics.dma50, '', 2)}</div></div>
        <div class="ratio-cell"><div class="ratio-label">200 DMA</div><div class="ratio-value">${formatMetric(metrics.dma200, '', 2)}</div></div>
        <div class="ratio-cell"><div class="ratio-label">RSI 14</div><div class="ratio-value">${formatMetric(metrics.rsi14)}</div></div>
        <div class="ratio-cell"><div class="ratio-label">52-week high</div><div class="ratio-value">${formatMetric(metrics.high52Week, '', 2)}</div></div>
        <div class="ratio-cell"><div class="ratio-label">Distance from high</div><div class="ratio-value">${formatMetric(metrics.distanceFrom52WeekHigh, '%')}</div></div>
        <div class="ratio-cell"><div class="ratio-label">Latest volume / 20D avg</div><div class="ratio-value">${formatMetric(metrics.latestVolumeVs20DayAverage, 'x', 2)}</div></div>
      </div>
      <ul class="flag-list" style="color:var(--paper-dim);">${conditionList}</ul>
      ${technical.available ? `<p class="final">Trend status is entry guidance only, not an automatic buy signal.</p>` : `<p class="final">At least 200 valid rows are required before Technical Trend contributes to the model.</p>`}
      <button class="btn" data-import-price="${candidate.ticker}" style="margin-top:8px;">Replace CSV for ${candidate.ticker}</button>
    </div>`;
  }

  function renderCard(c, rank) {
    const cardId = `ds-detail-${c.ticker}`;
    return `
      <div class="ticket" style="margin-bottom:14px;">
        <div class="ticket-body" style="width:100%;">
          <div class="ticket-top">
            <div>
              <div class="ticket-ticker">#${rank} ${c.ticker}</div>
              <div class="module-sub" style="margin:2px 0 0;">${c.security ? c.security.displayName : ''}</div>
            </div>
            <div class="ticket-score">
              <div class="n">${c.overall}</div>
              <div class="l">overall</div>
              <div class="chip ${ratingColor(c.rating)}" style="font-family:var(--mono);font-size:11px;padding:3px 10px;border:1px solid var(--rule-bright);margin-top:6px;display:inline-block;">${c.rating}</div>
              <div class="l" style="margin-top:5px;">${c.assessment} · ${c.pillarCoverage} pillars</div>
            </div>
          </div>

          <!-- Level 1: always visible -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px;">
            <div>
              <div class="ratio-label" style="color:var(--gain);">Top strengths</div>
              <ul class="flag-list" style="color:var(--paper-dim);">${c.strengths.map(s => `<li>${s}</li>`).join("")}</ul>
            </div>
            <div>
              <div class="ratio-label" style="color:var(--loss);">Top risks</div>
              <ul class="flag-list">${c.risks.map(r => `<li>${r}</li>`).join("")}</ul>
            </div>
          </div>

          <div class="paper-action-row">
            <button class="btn" data-paper-buy="${c.ticker}">Paper Buy</button>
            <button class="btn" data-expand="${cardId}" style="background:transparent;border:1px solid var(--rule-bright);color:var(--paper-dim);">Show breakdown ▾</button>
          </div>

          <!-- Level 2 + 3: hidden until expanded -->
          <div id="${cardId}" style="display:none;margin-top:16px;">
            <div class="ratio-grid" style="grid-template-columns:repeat(auto-fit,minmax(110px,1fr));">
              ${pillarRow("Business Quality", c.pillars.businessQuality)}
              ${pillarRow("Financial Strength", c.pillars.financialStrength)}
              ${pillarRow("Valuation", c.pillars.valuation)}
              ${pillarRow("Technical Trend", c.pillars.technicalTrend)}
              ${pillarRow("Risk", c.pillars.risk)}
            </div>

            ${technicalDetail(c)}

            <div class="module-sub" style="margin-top:14px;font-weight:600;color:var(--paper);">Full calculation trace</div>
            ${Object.entries(c.pillars).map(([key, p]) => `
              <div style="margin-top:8px;">
                <div class="module-sub" style="text-transform:capitalize;">${key.replace(/([A-Z])/g, ' $1')}</div>
                <ul class="flag-list" style="color:var(--paper-dim);">
                  ${(p.subFactors || []).map(f => `<li>${f.label}${f.score !== null ? ` — score ${Math.round(f.score)}` : ''}</li>`).join("")}
                </ul>
              </div>
            `).join("")}

            <div class="module-sub" style="margin-top:14px;">Red flags detected: ${c.redFlagCount}</div>
            <div class="module-sub" style="margin-top:10px;">
              Related: <a href="#" onclick="App.switchTo('fundamentals');return false;" style="color:var(--amber-bright);">Fundamentals</a> ·
              <a href="#" onclick="App.switchTo('portfolio');return false;" style="color:var(--amber-bright);">Portfolio</a> ·
              <a href="#" onclick="App.switchTo('watchlist');return false;" style="color:var(--amber-bright);">Watchlist</a>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function paperEscape(value) {
    return String(value === null || value === undefined ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function paperMoney(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "—";
    const sign = value < 0 ? "−" : "";
    return sign + "₹" + Math.abs(value).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function paperNumber(value, decimals = 2) {
    return typeof value === "number" && Number.isFinite(value)
      ? value.toFixed(decimals) : "—";
  }

  function paperPct(value) {
    return typeof value === "number" && Number.isFinite(value)
      ? value.toFixed(2) + "%" : "—";
  }

  function paperMetric(label, value, className) {
    return '<div class="ratio-cell"><div class="ratio-label">' +
      paperEscape(label) + '</div><div class="ratio-value ' +
      (className || "") + '">' + paperEscape(value) + '</div></div>';
  }

  function scoreText(value) {
    return typeof value === "number" && Number.isFinite(value)
      ? value.toFixed(1) : "—";
  }

  function refreshPaper() {
    if (activeContainer) render(activeContainer);
  }

  function renderPaperSummary(summary) {
    return '<div class="ratio-grid paper-summary">' +
      paperMetric("Starting Paper Capital", paperMoney(summary.config.startingCapital)) +
      paperMetric("Available Paper Cash", paperMoney(summary.availableCash)) +
      paperMetric("Invested Paper Cost", paperMoney(summary.investedCost)) +
      paperMetric("Current Paper Value", paperMoney(summary.currentValue)) +
      paperMetric("Unrealised Gain/Loss", paperMoney(summary.unrealisedGain), summary.unrealisedGain < 0 ? "overview-loss" : "overview-gain") +
      paperMetric("Realised Gain/Loss", paperMoney(summary.realisedGain), summary.realisedGain < 0 ? "overview-loss" : "overview-gain") +
      paperMetric("Total Paper Return", paperPct(summary.totalReturnPct)) +
      paperMetric("Open Paper Holdings", String(summary.openHoldings)) +
      paperMetric("Closed Paper Positions", String(summary.closedPositions)) +
      paperMetric("Maximum Drawdown", paperPct(summary.maximumDrawdown)) +
    '</div>';
  }

  function renderCapitalConfig(config) {
    return [
      '<div class="panel paper-panel">',
      '<div class="section-head"><span class="section-title">Delivery Paper Capital</span></div>',
      '<p class="module-sub">Simulation limits only. Paper cash and holdings never affect the real Portfolio.</p>',
      '<div class="paper-form-grid">',
      '<div class="field-row paper-field"><label for="paper-starting-capital">Starting Paper Capital</label><input id="paper-starting-capital" type="number" min="0" step="0.01" value="' + paperEscape(config.startingCapital) + '"></div>',
      '<div class="field-row paper-field"><label for="paper-max-allocation">Maximum allocation per stock %</label><input id="paper-max-allocation" type="number" min="0.01" max="100" step="0.01" value="' + paperEscape(config.maxAllocationPct) + '"></div>',
      '<div class="field-row paper-field"><label for="paper-max-open">Maximum open paper holdings</label><input id="paper-max-open" type="number" min="1" step="1" value="' + paperEscape(config.maxOpenHoldings) + '"></div>',
      '</div>',
      '<button class="btn" id="paper-save-config">Save Paper Capital Settings</button>',
      config.startingCapital <= 0
        ? '<p class="warn-inline">Set paper capital before creating a paper position</p>' : '',
      '</div>'
    ].join("");
  }

  function renderBuyForm(candidate, currentPrice) {
    if (!candidate) return "";
    const snapshot = PaperDelivery.snapshotCandidate(candidate, "");
    const imported = currentPrice.price !== null;
    return [
      '<div class="panel paper-panel paper-entry-panel">',
      '<div class="section-head"><span class="section-title">Paper Buy — ' + paperEscape(candidate.ticker) + '</span></div>',
      '<p class="module-sub">' + paperEscape(currentPrice.label) + '. Offline imported prices are historical observations, not live quotes.</p>',
      '<div class="ratio-grid">',
      paperMetric("Delivery Score", scoreText(snapshot.deliveryOverallScore)),
      paperMetric("Entry Rating", snapshot.deliveryRating),
      paperMetric("Technical Status", snapshot.technicalTrendStatus),
      paperMetric("Technical Data Date", snapshot.technicalDataDate || "—"),
      paperMetric("Price Coverage", snapshot.priceHistoryCoverage),
      '</div>',
      '<div class="paper-form-grid">',
      '<div class="field-row paper-field"><label for="paper-buy-date">Buy date</label><input id="paper-buy-date" type="date" value="' + paperEscape(currentPrice.date || "") + '"></div>',
      '<div class="field-row paper-field"><label for="paper-buy-quantity">Quantity</label><input id="paper-buy-quantity" type="number" min="0.000001" step="any"></div>',
      '<div class="field-row paper-field"><label for="paper-buy-price">' + (imported ? "Paper buy price" : "Manual paper price") + '</label><input id="paper-buy-price" type="number" min="0.000001" step="any" value="' + (currentPrice.price === null ? "" : paperEscape(currentPrice.price)) + '"></div>',
      '<div class="field-row paper-field"><label for="paper-buy-charges">Charges</label><input id="paper-buy-charges" type="number" min="0" step="0.01" value="0"></div>',
      '<div class="field-row paper-field paper-field-wide"><label for="paper-buy-reason">Reason for paper buy</label><textarea id="paper-buy-reason" rows="2"></textarea></div>',
      '<div class="field-row paper-field paper-field-wide"><label for="paper-buy-notes">Notes</label><textarea id="paper-buy-notes" rows="2"></textarea></div>',
      '</div>',
      '<div class="paper-action-row"><button class="btn" id="paper-confirm-buy">Record Paper Buy</button><button class="ticker-chip" id="paper-cancel-buy">Cancel</button></div>',
      '</div>'
    ].join("");
  }

  function renderSellForm(holding, currentPrice) {
    if (!holding) return "";
    return [
      '<div class="panel paper-panel paper-entry-panel">',
      '<div class="section-head"><span class="section-title">Paper Sell — ' + paperEscape(holding.ticker) + '</span></div>',
      '<p class="module-sub">Available quantity: ' + paperEscape(holding.quantity) + '. ' + paperEscape(currentPrice.label) + '.</p>',
      '<div class="paper-form-grid">',
      '<div class="field-row paper-field"><label for="paper-sell-date">Sell date</label><input id="paper-sell-date" type="date" value="' + paperEscape(currentPrice.date || "") + '"></div>',
      '<div class="field-row paper-field"><label for="paper-sell-quantity">Quantity</label><input id="paper-sell-quantity" type="number" min="0.000001" max="' + paperEscape(holding.quantity) + '" step="any" value="' + paperEscape(holding.quantity) + '"></div>',
      '<div class="field-row paper-field"><label for="paper-sell-price">' + (currentPrice.price === null ? "Manual paper price" : "Paper sell price") + '</label><input id="paper-sell-price" type="number" min="0.000001" step="any" value="' + (currentPrice.price === null ? "" : paperEscape(currentPrice.price)) + '"></div>',
      '<div class="field-row paper-field"><label for="paper-sell-charges">Charges</label><input id="paper-sell-charges" type="number" min="0" step="0.01" value="0"></div>',
      '<div class="field-row paper-field paper-field-wide"><label for="paper-sell-reason">Exit reason</label><textarea id="paper-sell-reason" rows="2"></textarea></div>',
      '<div class="field-row paper-field paper-field-wide"><label for="paper-sell-notes">Notes</label><textarea id="paper-sell-notes" rows="2"></textarea></div>',
      '</div>',
      '<div class="paper-action-row"><button class="btn" id="paper-confirm-sell">Record Paper Sell</button><button class="ticker-chip" id="paper-cancel-sell">Cancel</button></div>',
      '</div>'
    ].join("");
  }

  function holdingRows(holdings) {
    return holdings.map(holding => {
      const latestCandidate = computeCandidate(holding.ticker);
      const entrySnapshot = holding.entrySnapshot || {};
      const manual = holding.currentPrice === null ? [
        '<div class="paper-manual-price">',
        '<input type="number" min="0.000001" step="any" data-manual-price placeholder="Manual paper price">',
        '<input type="date" data-manual-price-date>',
        '<button class="ticker-chip" data-save-manual-price="' + paperEscape(holding.ticker) + '">Save Price</button>',
        '</div>'
      ].join("") : "";
      return [
        '<tr>',
        '<td>' + paperEscape(holding.ticker) + '</td>',
        '<td>' + paperEscape(holding.quantity) + '</td>',
        '<td>' + paperMoney(holding.averageCost) + '</td>',
        '<td>' + paperMoney(holding.currentPrice) + '<br><small>' + paperEscape(holding.currentPriceLabel) + '</small></td>',
        '<td>' + paperMoney(holding.currentValue) + '</td>',
        '<td>' + paperMoney(holding.unrealisedGain) + '</td>',
        '<td>' + paperEscape(holding.entryDate || "—") + '</td>',
        '<td>' + paperEscape(holding.holdingDays === null ? "—" : holding.holdingDays) + '</td>',
        '<td>' + paperEscape(latestCandidate ? latestCandidate.rating : "—") + '</td>',
        '<td>' + paperEscape(entrySnapshot.deliveryRating || "—") + '</td>',
        '<td>' + paperEscape(entrySnapshot.technicalTrendStatus || "—") + '</td>',
        '<td>' + manual + '<button class="ticker-chip" data-paper-sell="' + paperEscape(holding.ticker) + '">Paper Sell</button></td>',
        '</tr>'
      ].join("");
    }).join("");
  }

  function holdingCards(holdings) {
    return holdings.map(holding => {
      const latestCandidate = computeCandidate(holding.ticker);
      const entrySnapshot = holding.entrySnapshot || {};
      const rows = [
        ["Quantity", holding.quantity],
        ["Average Cost", paperMoney(holding.averageCost)],
        ["Current Paper Price", paperMoney(holding.currentPrice)],
        ["Price date", holding.currentPriceLabel],
        ["Current Value", paperMoney(holding.currentValue)],
        ["Unrealised Gain/Loss", paperMoney(holding.unrealisedGain)],
        ["Entry Date", holding.entryDate || "—"],
        ["Holding Days", holding.holdingDays === null ? "—" : holding.holdingDays],
        ["Latest Delivery Rating", latestCandidate ? latestCandidate.rating : "—"],
        ["Entry Rating", entrySnapshot.deliveryRating || "—"],
        ["Technical Status at Entry", entrySnapshot.technicalTrendStatus || "—"]
      ].map(row => '<div class="data-card-row"><span class="k">' + paperEscape(row[0]) +
        '</span><span class="v">' + paperEscape(row[1]) + '</span></div>').join("");
      const manual = holding.currentPrice === null ? [
        '<div class="paper-manual-price">',
        '<p class="module-sub">No imported price is available. Enter a dated manual paper price.</p>',
        '<input type="number" min="0.000001" step="any" data-manual-price placeholder="Manual paper price">',
        '<input type="date" data-manual-price-date>',
        '<button class="ticker-chip" data-save-manual-price="' + paperEscape(holding.ticker) + '">Save Price</button>',
        '</div>'
      ].join("") : "";
      return '<div class="data-card"><div class="data-card-title">' + paperEscape(holding.ticker) +
        '</div>' + rows + manual +
        '<button class="btn" data-paper-sell="' + paperEscape(holding.ticker) + '">Paper Sell</button></div>';
    }).join("");
  }

  function renderPaperPortfolio(container) {
    const state = WealthData.get();
    const summary = PaperDelivery.summary(state);
    const holdings = summary.portfolio.holdings;
    const buyCandidate = pendingBuyTicker ? computeCandidate(pendingBuyTicker) : null;
    const buyPrice = buyCandidate
      ? PaperDelivery.getCurrentPrice(buyCandidate.ticker, state) : null;
    const sellHolding = pendingSellTicker
      ? holdings.find(holding => holding.ticker === pendingSellTicker) : null;
    const sellPrice = sellHolding
      ? PaperDelivery.getCurrentPrice(sellHolding.ticker, state) : null;

    container.innerHTML = [
      '<div class="module-header"><h2>Paper Portfolio</h2><p class="module-sub">A simulation ledger for 1–3 month delivery-selection evaluation. It is never combined with the real Portfolio.</p></div>',
      renderCapitalConfig(summary.config),
      renderBuyForm(buyCandidate, buyPrice || {}),
      renderSellForm(sellHolding, sellPrice || {}),
      '<div class="section-head paper-section-head"><span class="section-title">Paper Portfolio Summary</span></div>',
      renderPaperSummary(summary),
      '<div class="section-head paper-section-head"><span class="section-title">Open Paper Holdings</span></div>',
      holdings.length ? [
        '<div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Quantity</th><th>Average Cost</th><th>Current Paper Price</th><th>Current Value</th><th>Unrealised G/L</th><th>Entry Date</th><th>Days</th><th>Latest Rating</th><th>Entry Rating</th><th>Entry Technical</th><th>Actions</th></tr></thead><tbody>',
        holdingRows(holdings),
        '</tbody></table></div>',
        '<div class="card-list">', holdingCards(holdings), '</div>'
      ].join("") : '<p class="overview-empty">No open paper holdings. Use Paper Buy from the Screener after setting paper capital.</p>'
    ].join("");

    container.querySelector("#paper-save-config").addEventListener("click", async () => {
      const input = {
        startingCapital: Number(container.querySelector("#paper-starting-capital").value),
        maxAllocationPct: Number(container.querySelector("#paper-max-allocation").value),
        maxOpenHoldings: Number(container.querySelector("#paper-max-open").value)
      };
      const error = PaperDelivery.validateConfig(input);
      if (error) { App.showStatus(error, "error"); return; }
      WealthData.updatePaperDeliveryConfig(input);
      await App.saveNow(false);
      App.showStatus("Paper capital settings saved", "ok");
      refreshPaper();
    });

    const cancelBuy = container.querySelector("#paper-cancel-buy");
    if (cancelBuy) cancelBuy.addEventListener("click", () => {
      pendingBuyTicker = null;
      refreshPaper();
    });
    const confirmBuy = container.querySelector("#paper-confirm-buy");
    if (confirmBuy) confirmBuy.addEventListener("click", async () => {
      if (submitting) return;
      submitting = true;
      confirmBuy.disabled = true;
      const input = {
        ticker: buyCandidate.ticker,
        transactionType: "BUY",
        transactionDate: container.querySelector("#paper-buy-date").value,
        quantity: container.querySelector("#paper-buy-quantity").value,
        price: container.querySelector("#paper-buy-price").value,
        charges: container.querySelector("#paper-buy-charges").value,
        reason: container.querySelector("#paper-buy-reason").value,
        notes: container.querySelector("#paper-buy-notes").value
      };
      const plan = PaperDelivery.createTransactionPlan(
        WealthData.getPaperDeliveryTransactions(),
        WealthData.getPaperDeliveryConfig(),
        input,
        { candidate: buyCandidate }
      );
      if (!plan.ok) {
        submitting = false;
        confirmBuy.disabled = false;
        App.showStatus(plan.error, "error");
        return;
      }
      WealthData.addPaperDeliveryTransaction(plan.transaction);
      await App.saveNow(false);
      pendingBuyTicker = null;
      submitting = false;
      App.showStatus("Paper BUY recorded", "ok");
      refreshPaper();
    });

    const cancelSell = container.querySelector("#paper-cancel-sell");
    if (cancelSell) cancelSell.addEventListener("click", () => {
      pendingSellTicker = null;
      refreshPaper();
    });
    const confirmSell = container.querySelector("#paper-confirm-sell");
    if (confirmSell) confirmSell.addEventListener("click", async () => {
      if (submitting) return;
      submitting = true;
      confirmSell.disabled = true;
      const input = {
        ticker: sellHolding.ticker,
        transactionType: "SELL",
        transactionDate: container.querySelector("#paper-sell-date").value,
        quantity: container.querySelector("#paper-sell-quantity").value,
        price: container.querySelector("#paper-sell-price").value,
        charges: container.querySelector("#paper-sell-charges").value,
        reason: container.querySelector("#paper-sell-reason").value,
        notes: container.querySelector("#paper-sell-notes").value
      };
      const plan = PaperDelivery.createTransactionPlan(
        WealthData.getPaperDeliveryTransactions(),
        WealthData.getPaperDeliveryConfig(),
        input
      );
      if (!plan.ok) {
        submitting = false;
        confirmSell.disabled = false;
        App.showStatus(plan.error, "error");
        return;
      }
      WealthData.addPaperDeliveryTransaction(plan.transaction);
      await App.saveNow(false);
      pendingSellTicker = null;
      submitting = false;
      App.showStatus("Paper SELL recorded", "ok");
      refreshPaper();
    });

    container.querySelectorAll("[data-paper-sell]").forEach(button => {
      button.addEventListener("click", () => {
        pendingSellTicker = button.dataset.paperSell;
        pendingBuyTicker = null;
        refreshPaper();
      });
    });
    container.querySelectorAll("[data-save-manual-price]").forEach(button => {
      button.addEventListener("click", async () => {
        const ticker = button.dataset.saveManualPrice;
        const pricePanel = button.closest(".paper-manual-price");
        const price = pricePanel.querySelector("[data-manual-price]").value;
        const date = pricePanel.querySelector("[data-manual-price-date]").value;
        const error = PaperDelivery.validateManualPrice({ price: price, date: date });
        if (error) { App.showStatus(error, "error"); return; }
        const config = WealthData.getPaperDeliveryConfig();
        WealthData.updatePaperDeliveryConfig({
          manualPrices: {
            ...config.manualPrices,
            [ticker]: {
              price: Number(price),
              date: date,
              updatedAt: new Date().toISOString()
            }
          }
        });
        await App.saveNow(false);
        App.showStatus("Manual paper price saved", "ok");
        refreshPaper();
      });
    });
  }

  function transactionTableRows(transactions) {
    return transactions.map(transaction => [
      '<tr>',
      '<td>' + paperEscape(transaction.transactionDate || "—") + '</td>',
      '<td>' + paperEscape(transaction.ticker) + '</td>',
      '<td>' + paperEscape(transaction.transactionType) + '</td>',
      '<td>' + paperEscape(transaction.quantity) + '</td>',
      '<td>' + paperMoney(transaction.price) + '</td>',
      '<td>' + paperMoney(transaction.charges) + '</td>',
      '<td>' + paperMoney(transaction.grossAmount) + '</td>',
      '<td>' + paperMoney(transaction.netAmount) + '</td>',
      '<td>' + paperMoney(transaction.realisedGain) + '</td>',
      '<td>' + paperEscape(transaction.notes || "—") + '</td>',
      '<td><button class="ticker-chip holding-delete" data-delete-paper="' + paperEscape(transaction.id) + '">Delete correction</button></td>',
      '</tr>'
    ].join("")).join("");
  }

  function transactionCards(transactions) {
    return transactions.map(transaction => {
      const rows = [
        ["Date", transaction.transactionDate || "—"],
        ["Type", transaction.transactionType],
        ["Quantity", transaction.quantity],
        ["Price", paperMoney(transaction.price)],
        ["Charges", paperMoney(transaction.charges)],
        ["Gross Amount", paperMoney(transaction.grossAmount)],
        ["Net Amount", paperMoney(transaction.netAmount)],
        ["Realised Gain/Loss", paperMoney(transaction.realisedGain)],
        ["Notes", transaction.notes || "—"]
      ].map(row => '<div class="data-card-row"><span class="k">' + paperEscape(row[0]) +
        '</span><span class="v">' + paperEscape(row[1]) + '</span></div>').join("");
      return '<div class="data-card"><div class="data-card-title">' +
        paperEscape(transaction.ticker) + ' · ' + paperEscape(transaction.transactionType) +
        '</div>' + rows + '<button class="ticker-chip holding-delete" data-delete-paper="' +
        paperEscape(transaction.id) + '">Delete correction</button></div>';
    }).join("");
  }

  function renderPaperTransactions(container) {
    const transactions = PaperDelivery.replay(WealthData.getPaperDeliveryTransactions())
      .transactions.slice().sort((a, b) => {
        const dateCompare = String(b.transactionDate || "").localeCompare(String(a.transactionDate || ""));
        return dateCompare || String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
      });
    container.innerHTML = [
      '<div class="module-header"><h2>Paper Transactions</h2><p class="module-sub">Permanent paper BUY/SELL history, newest first. It never appears in the real Portfolio ledger.</p></div>',
      '<div class="paper-action-row"><button class="btn" id="paper-export-csv">Export Paper Transactions CSV</button></div>',
      '<p class="warn-inline">Deleting a paper record is not the same as recording a paper sale. Delete is only for correcting bad data.</p>',
      transactions.length ? [
        '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Ticker</th><th>Type</th><th>Quantity</th><th>Price</th><th>Charges</th><th>Gross</th><th>Net</th><th>Realised G/L</th><th>Notes</th><th>Correction</th></tr></thead><tbody>',
        transactionTableRows(transactions),
        '</tbody></table></div><div class="card-list">',
        transactionCards(transactions),
        '</div>'
      ].join("") : '<p class="overview-empty">No paper transactions recorded.</p>'
    ].join("");

    container.querySelector("#paper-export-csv").addEventListener("click", () => {
      const blob = new Blob([PaperDelivery.csv(WealthData.getPaperDeliveryTransactions())], {
        type: "text/csv;charset=utf-8"
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "delivery-paper-transactions-" + PaperDelivery.localISODate() + ".csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    });
    container.querySelectorAll("[data-delete-paper]").forEach(button => {
      button.addEventListener("click", async () => {
        if (!confirm("Deleting a paper record is not the same as recording a paper sale. Delete this record only as a data correction?")) return;
        const rawId = button.dataset.deletePaper;
        const transaction = WealthData.getPaperDeliveryTransactions()
          .find(item => String(item.id) === rawId);
        if (!transaction) return;
        const check = PaperDelivery.canDeleteTransaction(
          WealthData.getPaperDeliveryTransactions(), transaction.id
        );
        if (!check.ok) {
          App.showStatus("Cannot delete this BUY because later SELL records depend on it", "error");
          return;
        }
        WealthData.removePaperDeliveryTransaction(transaction.id);
        await App.saveNow(false);
        App.showStatus("Paper record deleted as a correction", "ok");
        refreshPaper();
      });
    });
  }

  function groupRows(groups) {
    const entries = Object.entries(groups);
    if (!entries.length) return '<p class="overview-empty">No closed positions available.</p>';
    return '<div class="overview-list">' + entries.map(entry =>
      '<div class="overview-list-row"><span>' + paperEscape(entry[0]) +
      '</span><strong>' + entry[1].count + ' closed · ' +
      paperPct(entry[1].averageReturnPct) + ' average</strong></div>'
    ).join("") + '</div>';
  }

  function renderPerformanceReview(container) {
    const review = PaperDelivery.performanceReview(WealthData.get());
    const best = review.bestTrade
      ? review.bestTrade.ticker + " · " + paperMoney(review.bestTrade.realisedGain) : "—";
    const worst = review.worstTrade
      ? review.worstTrade.ticker + " · " + paperMoney(review.worstTrade.realisedGain) : "—";
    container.innerHTML = [
      '<div class="module-header"><h2>Performance Review</h2><p class="module-sub">Review paper outcomes after 1–3 months. Small samples are descriptive only and are not statistically significant.</p></div>',
      '<div class="ratio-grid paper-summary">',
      paperMetric("Total Paper Trades", String(review.totalPaperTrades)),
      paperMetric("Open Positions", String(review.openPositions)),
      paperMetric("Closed Positions", String(review.closedPositions)),
      paperMetric("Profitable Closed", String(review.profitableClosedPositions)),
      paperMetric("Losing Closed", String(review.losingClosedPositions)),
      paperMetric("Win Rate", paperPct(review.winRate)),
      paperMetric("Average Realised Return", paperPct(review.averageRealisedReturn)),
      paperMetric("Best Trade", best),
      paperMetric("Worst Trade", worst),
      paperMetric("Maximum Drawdown", paperPct(review.maximumDrawdown)),
      paperMetric("Average Holding Days", paperNumber(review.averageHoldingDays, 1)),
      paperMetric("Current Unrealised Return", paperPct(review.currentUnrealisedReturn)),
      paperMetric("Total Realised Gain/Loss", paperMoney(review.totalRealisedGain)),
      paperMetric("Trades Still Open", String(review.openTrades)),
      '</div>',
      '<div class="paper-review-grid">',
      '<section class="overview-section"><div class="section-head"><span class="section-title">By Delivery Rating at Entry</span></div>' + groupRows(review.byEntryRating) + '</section>',
      '<section class="overview-section"><div class="section-head"><span class="section-title">By Technical Trend at Entry</span></div>' + groupRows(review.byTechnicalStatus) + '</section>',
      '<section class="overview-section"><div class="section-head"><span class="section-title">By Valuation Band at Entry</span></div>' + groupRows(review.byValuationBand) + '</section>',
      '<section class="overview-section"><div class="section-head"><span class="section-title">Forward Returns</span></div><div class="overview-list">',
      '<div class="overview-list-row"><span>30-day return</span><strong>' + paperPct(review.horizon30.averageReturnPct) + ' · ' + review.horizon30.count + ' samples</strong></div>',
      '<div class="overview-list-row"><span>60-day return</span><strong>' + paperPct(review.horizon60.averageReturnPct) + ' · ' + review.horizon60.count + ' samples</strong></div>',
      '<div class="overview-list-row"><span>90-day return</span><strong>' + paperPct(review.horizon90.averageReturnPct) + ' · ' + review.horizon90.count + ' samples</strong></div>',
      '</div></section></div>',
      '<p class="warn-inline">Paper results are for model evaluation and do not guarantee future returns.</p>'
    ].join("");
  }

  return { render, computeCandidate, businessQualityPillar, financialStrengthPillar, valuationPillar, technicalTrendPillar, riskPillar, computeOverall, computeRating };
})();

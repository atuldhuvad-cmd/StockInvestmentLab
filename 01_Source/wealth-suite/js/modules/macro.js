/* ============================================================================
   Macro Intelligence Module
   ============================================================================
   Per the Import-Driven Data Rule: no live API, no automatic fetching.
   Data enters via a pasted JSON snapshot (the AI-assisted workflow — ask
   Claude/ChatGPT for "the latest Indian macro data in Wealth Intelligence
   JSON format"), reusing the same JSON-parse-and-merge pattern already
   proven in Persistence.js.

   Trimmed 2026-07-13 (Product Simplification Audit):
   - The parallel manual 7-field entry form was removed. It produced
     identical data to the JSON import path (both called importSnapshot()),
     so maintaining two full input surfaces for one data concept was pure
     duplication with no functional gain — the JSON path is this project's
     documented, actually-used workflow.
   - The Sector Regime feature (a static, hand-authored +1/-1/0 sensitivity
     table computing a Tailwind/Neutral/Headwind label per sector) was
     removed entirely. It was an unsourced, illustrative-only prediction
     with no empirical basis, in direct conflict with the Charter's own
     "no strategies that rely on prediction without evidence" rule. Removed,
     not replaced with another predictive model.

   This module now shows factual indicator readings only — repo rate, CPI,
   USD/INR, crude, bond yield, FII/DII flow — and how each has moved since
   the prior snapshot. No interpretive layer on top.
============================================================================ */

const MacroModule = (function () {

  const INDICATORS = [
    { key: "repoRate", label: "RBI Repo Rate", jsonField: "repo_rate", unit: "%" },
    { key: "cpiInflation", label: "CPI Inflation", jsonField: "cpi", unit: "%" },
    { key: "usdinr", label: "USD/INR", jsonField: "usd_inr", unit: "" },
    { key: "crudeOil", label: "Crude Oil", jsonField: "crude", unit: "$" },
    { key: "bondYield10Y", label: "10Y Bond Yield", jsonField: "bond10y", unit: "%" },
    { key: "fiiNet", label: "FII Net Flow", jsonField: "fii_flow", unit: " Cr" },
    { key: "diiNet", label: "DII Net Flow", jsonField: "dii_flow", unit: " Cr" }
  ];

  function importSnapshot(json) {
    const date = json.date || new Date().toISOString().slice(0, 10);
    let count = 0;
    INDICATORS.forEach(ind => {
      const value = json[ind.jsonField];
      if (value === undefined || value === null) return;
      const series = WealthData.get().macroIndicators[ind.key] || (WealthData.get().macroIndicators[ind.key] = []);
      const existingIdx = series.findIndex(p => p.date === date);
      const point = { date, value: parseFloat(value), source: "import" };
      if (existingIdx >= 0) series[existingIdx] = point; else series.push(point);
      count++;
    });
    return count;
  }

  function latestTwo(key) {
    const series = (WealthData.get().macroIndicators[key] || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    return { latest: series[series.length - 1] || null, previous: series[series.length - 2] || null };
  }

  function render(container) {
    container.innerHTML = `
      <div class="module-header">
        <h2>Macro Intelligence</h2>
        <p class="module-sub">Repo rate, inflation, currency, crude, bond yields, FII/DII flows. No live feed: import a snapshot below.</p>
      </div>

      <div class="specimen">
        <h2>Import a snapshot</h2>
        <p>Ask Claude or ChatGPT: <em>"Give me the latest Indian macro data in JSON format: date, repo_rate, cpi, usd_inr, crude, bond10y, fii_flow, dii_flow"</em> — then paste the result below.</p>
        <textarea id="macro-json-input" rows="4" style="width:100%;background:var(--bg-ticket);border:1px solid var(--rule-bright);color:var(--paper);font-family:var(--mono);font-size:12px;padding:10px;" placeholder='{"date":"2026-07-12","repo_rate":5.50,"cpi":3.2,"usd_inr":85.6,"crude":68.4,"bond10y":6.25,"fii_flow":-2500,"dii_flow":4200}'></textarea>
        <button class="btn" id="macro-import-btn" style="margin-top:10px;">Import snapshot</button>
      </div>

      <div id="macro-current"></div>
    `;

    container.querySelector("#macro-import-btn").addEventListener("click", () => {
      const raw = container.querySelector("#macro-json-input").value.trim();
      if (!raw) { App.showStatus("Paste a JSON snapshot first", "error"); return; }
      try {
        const json = JSON.parse(raw);
        const count = importSnapshot(json);
        if (count === 0) { App.showStatus("No recognized fields found in that JSON", "error"); return; }
        container.querySelector("#macro-json-input").value = "";
        App.saveNow(true);
        refresh(container);
      } catch (e) {
        App.showStatus("Invalid JSON: " + e.message, "error");
      }
    });

    refresh(container);
  }

  function refresh(container) {
    const hasAnyData = INDICATORS.some(ind => (WealthData.get().macroIndicators[ind.key] || []).length > 0);

    const currentEl = container.querySelector("#macro-current");
    if (!hasAnyData) {
      currentEl.innerHTML = `<div class="module-sub" style="font-style:italic;padding:16px 0;">No macro data yet. Import a snapshot above.</div>`;
    } else {
      currentEl.innerHTML = `
        <div class="section-head" style="margin-top:24px;"><span class="section-title" style="font-size:15px;">Current readings</span></div>
        <div class="ratio-grid" style="margin-top:14px;">
          ${INDICATORS.map(ind => {
            const { latest, previous } = latestTwo(ind.key);
            if (!latest) return `<div class="ratio-cell"><div class="ratio-label">${ind.label}</div><div class="ratio-value" style="color:var(--paper-faint);font-size:14px;">No data</div></div>`;
            const change = previous ? latest.value - previous.value : null;
            return `<div class="ratio-cell">
              <div class="ratio-label">${ind.label}</div>
              <div class="ratio-value">${latest.value}${ind.unit}</div>
              ${change !== null ? `<div class="module-sub" style="color:${change>0?'var(--gain)':change<0?'var(--loss)':'var(--paper-faint)'};margin-top:3px;">${change>=0?'+':''}${change.toFixed(2)} vs prior</div>` : ''}
            </div>`;
          }).join("")}
        </div>
      `;
    }
  }

  return { render, importSnapshot };
})();

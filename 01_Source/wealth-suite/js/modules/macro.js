/* ============================================================================
   Macro Intelligence Module
   ============================================================================
   Per the Import-Driven Data Rule: no live API, no automatic fetching.
   Two ways data enters, both reusing the same JSON-parse-and-merge pattern
   already proven in Persistence.js:
     1. Paste a JSON snapshot (the AI-assisted workflow — ask Claude/ChatGPT
        for "the latest Indian macro data in Wealth Intelligence JSON format")
     2. Manual entry form (the offline-independent baseline, no AI needed)

   Sector sensitivity map ported from the earlier Macro Intelligence artifact
   — a static, illustrative rule set (rising indicator -> tailwind/neutral/
   headwind per sector), computed from the two most recent snapshots.
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

  // Sensitivity: effect of the indicator RISING on each sector.
  // +1 = tailwind, -1 = headwind, 0 = neutral/limited direct effect.
  // Illustrative rule set, not a model — same status as the version built
  // earlier this session.
  const SENSITIVITY = {
    IT:                { repoRate: 0, cpiInflation: 0, usdinr: 1, crudeOil: 0, bondYield10Y: 0, fiiNet: -1, diiNet: 1 },
    Banking:           { repoRate: -1, cpiInflation: -1, usdinr: 0, crudeOil: -1, bondYield10Y: -1, fiiNet: 1, diiNet: 1 },
    FMCG:              { repoRate: -1, cpiInflation: -1, usdinr: -1, crudeOil: -1, bondYield10Y: 0, fiiNet: 0, diiNet: 1 },
    Auto:              { repoRate: -1, cpiInflation: -1, usdinr: -1, crudeOil: -1, bondYield10Y: 0, fiiNet: 0, diiNet: 1 },
    Energy:            { repoRate: 0, cpiInflation: 0, usdinr: -1, crudeOil: 1, bondYield10Y: 0, fiiNet: 0, diiNet: 0 },
    Pharma:            { repoRate: 0, cpiInflation: 0, usdinr: 1, crudeOil: 0, bondYield10Y: 0, fiiNet: 0, diiNet: 0 },
    Metals:            { repoRate: 0, cpiInflation: 0, usdinr: 0, crudeOil: -1, bondYield10Y: 0, fiiNet: 1, diiNet: 0 },
    "Financial Services": { repoRate: -1, cpiInflation: 0, usdinr: 0, crudeOil: 0, bondYield10Y: -1, fiiNet: 1, diiNet: 1 }
  };

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

  function computeRegime() {
    const readings = {};
    INDICATORS.forEach(ind => { readings[ind.key] = latestTwo(ind.key); });
    const haveEnoughData = INDICATORS.some(ind => readings[ind.key].latest && readings[ind.key].previous);
    if (!haveEnoughData) return null;

    const regimes = {};
    Object.entries(SENSITIVITY).forEach(([sector, sens]) => {
      let score = 0, contributors = 0;
      INDICATORS.forEach(ind => {
        const { latest, previous } = readings[ind.key];
        if (!latest || !previous || sens[ind.key] === 0) return;
        const direction = latest.value > previous.value ? 1 : (latest.value < previous.value ? -1 : 0);
        score += direction * sens[ind.key];
        contributors++;
      });
      regimes[sector] = { score, rating: score > 0 ? "Tailwind" : score < 0 ? "Headwind" : "Neutral" };
    });
    return regimes;
  }

  function render(container) {
    container.innerHTML = `
      <div class="module-header">
        <h2>Macro Intelligence</h2>
        <p class="module-sub">Repo rate, inflation, currency, crude, bond yields, FII/DII flows — and what they mean per sector. No live feed: import a snapshot or enter values manually.</p>
      </div>

      <div class="specimen">
        <h2>Import a snapshot</h2>
        <p>Ask Claude or ChatGPT: <em>"Give me the latest Indian macro data in JSON format: date, repo_rate, cpi, usd_inr, crude, bond10y, fii_flow, dii_flow"</em> — then paste the result below.</p>
        <textarea id="macro-json-input" rows="4" style="width:100%;background:var(--bg-ticket);border:1px solid var(--rule-bright);color:var(--paper);font-family:var(--mono);font-size:12px;padding:10px;" placeholder='{"date":"2026-07-12","repo_rate":5.50,"cpi":3.2,"usd_inr":85.6,"crude":68.4,"bond10y":6.25,"fii_flow":-2500,"dii_flow":4200}'></textarea>
        <button class="btn" id="macro-import-btn" style="margin-top:10px;">Import snapshot</button>
      </div>

      <div class="section-head" style="margin-top:24px;"><span class="section-title" style="font-size:15px;">Or enter manually</span></div>
      <div class="panel" style="margin:14px 0;">
        ${INDICATORS.map(ind => `
          <div class="field-row"><label for="macro-manual-${ind.key}">${ind.label}${ind.unit ? ' ('+ind.unit.trim()+')' : ''}</label><input type="number" step="0.01" id="macro-manual-${ind.key}"></div>
        `).join("")}
        <div class="field-row"><label for="macro-manual-date">Date</label><input type="date" id="macro-manual-date"></div>
        <button class="btn" id="macro-manual-btn">Save manual entry</button>
      </div>

      <div id="macro-current"></div>
      <div id="macro-regime"></div>
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

    container.querySelector("#macro-manual-btn").addEventListener("click", () => {
      const date = container.querySelector("#macro-manual-date").value || new Date().toISOString().slice(0, 10);
      const json = { date };
      INDICATORS.forEach(ind => {
        const val = container.querySelector(`#macro-manual-${ind.key}`).value;
        if (val !== "") json[ind.jsonField] = parseFloat(val);
      });
      const count = importSnapshot(json);
      if (count === 0) { App.showStatus("Enter at least one value", "error"); return; }
      INDICATORS.forEach(ind => container.querySelector(`#macro-manual-${ind.key}`).value = "");
      App.saveNow(true);
      refresh(container);
    });

    refresh(container);
  }

  function refresh(container) {
    const hasAnyData = INDICATORS.some(ind => (WealthData.get().macroIndicators[ind.key] || []).length > 0);

    const currentEl = container.querySelector("#macro-current");
    if (!hasAnyData) {
      currentEl.innerHTML = `<div class="module-sub" style="font-style:italic;padding:16px 0;">No macro data yet. Import a snapshot or enter values manually above.</div>`;
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

    const regimeEl = container.querySelector("#macro-regime");
    const regimes = computeRegime();
    if (!regimes) {
      regimeEl.innerHTML = `<div class="module-sub" style="font-style:italic;padding:16px 0;">Sector regime needs at least two snapshots (to see what's changed) — import or enter one more.</div>`;
    } else {
      regimeEl.innerHTML = `
        <div class="section-head" style="margin-top:24px;"><span class="section-title" style="font-size:15px;">Sector regime</span></div>
        <p class="module-sub" style="margin:8px 0 14px;">Illustrative — a static sensitivity rule, not a model. Based on the two most recent snapshots.</p>
        <div class="card-list">
          ${Object.entries(regimes).map(([sector, r]) => `
            <div class="data-card">
              <div class="data-card-title" style="display:flex;justify-content:space-between;align-items:center;">
                ${sector}
                <span class="chip ${r.rating==='Tailwind'?'gain':r.rating==='Headwind'?'loss':'flag'}" style="font-family:var(--mono);font-size:11px;padding:3px 8px;border:1px solid var(--rule-bright);">${r.rating}</span>
              </div>
            </div>
          `).join("")}
        </div>
      `;
    }
  }

  return { render, importSnapshot, computeRegime };
})();

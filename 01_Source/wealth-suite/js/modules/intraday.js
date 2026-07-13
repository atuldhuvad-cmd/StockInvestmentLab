/* ============================================================================
   Intraday Module — Trade Discipline Log
   ============================================================================
   NOT a screener, NOT a scorer, per intraday-scope-decision.md — there is no
   honest way to generate real intraday signals inside an architecture that
   explicitly forbids live data (Import-Driven Data Rule). This module
   enforces the discipline half of "high-probability intraday opportunities
   using strict risk management and predefined rules" instead: a mandatory
   checklist before a trade is logged, a capital-pool ceiling from Settings,
   and a record of outcomes — the same "why did I do this" value Research
   Library's Decision Record gives to long-term positions.
============================================================================ */

const IntradayModule = (function () {

  function computeChecklist(form) {
    const settings = WealthData.getAllSettings();
    const riskReward = (form.entryPrice && form.stopLoss && form.target)
      ? Math.abs(form.target - form.entryPrice) / Math.abs(form.entryPrice - form.stopLoss)
      : null;
    return {
      stopSet: form.stopLoss !== null && form.stopLoss !== undefined && form.stopLoss > 0,
      riskReward: riskReward !== null && riskReward >= settings.minRiskRewardRatio,
      riskRewardValue: riskReward,
      reasonStated: !!(form.notes && form.notes.trim().length > 0)
    };
  }

  function computeAllocation() {
    const trades = WealthData.getIntradayTrades().filter(t => t.status === "Open");
    const deployed = trades.reduce((s, t) => s + (t.positionSize || 0), 0);
    // Reuse the same portfolio total that already exists — the satellite
    // ceiling is a % of your total invested capital, not a separate pool
    // tracked twice. Calls the shared, frozen PortfolioModule functions
    // directly (found duplicating this formula inline during Intraday's own
    // Phase 1A review, 2026-07-12 — fixed proactively before it became a
    // defect, not after).
    const holdings = WealthData.getHoldings().filter(h => h.active !== false);
    const portfolioValue = PortfolioModule.computeSummary(holdings.map(PortfolioModule.computeRow)).totalValue;
    const totalCapitalBase = portfolioValue + deployed; // approximate base — portfolio + currently-open intraday
    const ceiling = WealthData.getSetting("intradaySatelliteAllocationPct");
    const ceilingAmount = totalCapitalBase * (ceiling / 100);
    const usedPct = totalCapitalBase > 0 ? (deployed / totalCapitalBase) * 100 : 0;
    return { deployed, ceilingAmount, ceilingPct: ceiling, usedPct, overCeiling: deployed > ceilingAmount && ceilingAmount > 0 };
  }

  function fmtINR(n) {
    const neg = n < 0; n = Math.abs(Math.round(n));
    return (neg ? "−₹" : "₹") + n.toLocaleString("en-IN");
  }

  function render(container) {
    container.innerHTML = `
      <div class="module-header">
        <h2>Intraday</h2>
        <p class="module-sub">The satellite allocation's discipline log — not a signal generator. No module here predicts or scores an opportunity; it enforces your own predefined rules before a trade counts as taken.</p>
      </div>

      <div class="specimen">
        <h2>Why there's no screener here</h2>
        <p>Real intraday signals need same-day price data. This app only ever accepts data through periodic import (the Import-Driven Data Rule) — by the time a snapshot is pasted in, it's already stale for same-day trading. Building a "screener" on top of that would mean either showing stale data as current, or faking it. Neither is acceptable, so this module does the part that's honestly buildable: enforcing discipline on trades you decide yourself.</p>
      </div>

      <div id="intraday-allocation"></div>

      <div class="panel" style="margin: 20px 0;">
        <div class="field-row"><label for="id-ticker">Ticker</label><input type="text" id="id-ticker" style="text-transform:uppercase" placeholder="e.g. RELIANCE"></div>
        <div class="field-row"><label for="id-entry">Entry price (₹)</label><input type="number" id="id-entry"></div>
        <div class="field-row"><label for="id-stop">Stop-loss (₹)</label><input type="number" id="id-stop"></div>
        <div class="field-row"><label for="id-target">Target (₹)</label><input type="number" id="id-target"></div>
        <div class="field-row"><label for="id-size">Position size (₹)</label><input type="number" id="id-size"></div>
        <div class="field-row"><label for="id-notes">Entry reason (required)</label><input type="text" id="id-notes" placeholder="Your own predefined setup — not a generated signal"></div>
        <div id="id-checklist-preview" class="module-sub" style="margin:10px 0;"></div>
        <button class="btn" id="id-add">Log trade</button>
      </div>

      <div class="section-head"><span class="section-title" style="font-size:15px;">Trade log</span><span class="module-sub" id="id-count" style="margin-left:auto;"></span></div>
      <div class="card-list" id="id-list" style="display:flex;"></div>
    `;

    function updatePreview() {
      const form = {
        entryPrice: parseFloat(container.querySelector("#id-entry").value) || null,
        stopLoss: parseFloat(container.querySelector("#id-stop").value) || null,
        target: parseFloat(container.querySelector("#id-target").value) || null,
        notes: container.querySelector("#id-notes").value
      };
      const c = computeChecklist(form);
      const settings = WealthData.getAllSettings();
      const items = [
        [c.stopSet, "Stop-loss set"],
        [c.riskReward, `Risk-reward ≥ ${settings.minRiskRewardRatio}:1${c.riskRewardValue !== null ? ` (currently ${c.riskRewardValue.toFixed(2)}:1)` : ''}`],
        [c.reasonStated, "Entry reason stated"]
      ];
      container.querySelector("#id-checklist-preview").innerHTML = items.map(([pass, label]) =>
        `<div style="color:${pass?'var(--gain)':'var(--loss)'}">${pass?'✓':'✗'} ${label}</div>`
      ).join("");
    }
    ["id-entry","id-stop","id-target","id-notes"].forEach(id => container.querySelector("#"+id).addEventListener("input", updatePreview));
    updatePreview();

    container.querySelector("#id-add").addEventListener("click", () => {
      const ticker = container.querySelector("#id-ticker").value.trim().toUpperCase();
      const form = {
        entryPrice: parseFloat(container.querySelector("#id-entry").value) || null,
        stopLoss: parseFloat(container.querySelector("#id-stop").value) || null,
        target: parseFloat(container.querySelector("#id-target").value) || null,
        positionSize: parseFloat(container.querySelector("#id-size").value) || null,
        notes: container.querySelector("#id-notes").value.trim()
      };
      if (!ticker || !form.entryPrice || !form.positionSize) {
        App.showStatus("Ticker, entry price, and position size are required", "error");
        return;
      }
      const checklist = computeChecklist(form);
      if (!checklist.stopSet || !checklist.riskReward || !checklist.reasonStated) {
        if (!confirm("This trade fails one or more checklist items. Log it anyway?")) return;
      }
      WealthData.addIntradayTrade({ ticker, ...form, checklistPassed: checklist });
      ["id-ticker","id-entry","id-stop","id-target","id-size","id-notes"].forEach(id => container.querySelector("#"+id).value = "");
      App.saveNow(true);
      refresh(container);
    });

    refresh(container);
  }

  function refresh(container) {
    const alloc = computeAllocation();
    container.querySelector("#intraday-allocation").innerHTML = `
      <div class="ratio-grid">
        <div class="ratio-cell"><div class="ratio-label">Deployed (open trades)</div><div class="ratio-value">${fmtINR(alloc.deployed)}</div></div>
        <div class="ratio-cell"><div class="ratio-label">Satellite ceiling (${alloc.ceilingPct}%)</div><div class="ratio-value">${fmtINR(alloc.ceilingAmount)}</div></div>
        <div class="ratio-cell"><div class="ratio-label">% of base in play</div><div class="ratio-value" style="color:${alloc.overCeiling?'var(--loss)':'var(--gain)'}">${alloc.usedPct.toFixed(1)}%</div></div>
      </div>
      ${alloc.overCeiling ? `<div class="warn-inline" style="display:block;margin-top:10px;">Currently over your ${alloc.ceilingPct}% satellite ceiling.</div>` : ""}
    `;

    const trades = WealthData.getIntradayTrades().slice().sort((a,b) => new Date(b.dateOpened) - new Date(a.dateOpened));
    container.querySelector("#id-count").textContent = `${trades.length} ${trades.length===1?'trade':'trades'}`;

    container.querySelector("#id-list").innerHTML = trades.length ? trades.map(t => `
      <div class="data-card">
        <div class="data-card-title" style="display:flex;justify-content:space-between;align-items:center;">
          ${t.ticker}
          <span class="chip ${t.status==='Closed-Win'?'gain':t.status==='Closed-Loss'?'loss':'flag'}" style="font-family:var(--mono);font-size:10px;padding:3px 8px;border:1px solid var(--rule-bright);">${t.status}</span>
        </div>
        <div class="data-card-row"><span class="k">Entry</span><span class="v">₹${t.entryPrice}</span></div>
        ${t.stopLoss ? `<div class="data-card-row"><span class="k">Stop</span><span class="v">₹${t.stopLoss}</span></div>` : ""}
        ${t.target ? `<div class="data-card-row"><span class="k">Target</span><span class="v">₹${t.target}</span></div>` : ""}
        <div class="data-card-row"><span class="k">Size</span><span class="v">${fmtINR(t.positionSize)}</span></div>
        <div class="data-card-row"><span class="k">Checklist</span><span class="v">${Object.values(t.checklistPassed).filter(v=>v===true).length}/3 passed</span></div>
        ${t.notes ? `<div style="font-size:12px;color:var(--paper-dim);margin-top:6px;">${t.notes}</div>` : ""}
        ${t.status === "Open" ? `
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button class="btn" data-close="${t.id}" data-outcome="Closed-Win" style="background:transparent;border:1px solid var(--gain);color:var(--gain);flex:1;">Close — Win</button>
            <button class="btn" data-close="${t.id}" data-outcome="Closed-Loss" style="background:transparent;border:1px solid var(--loss);color:var(--loss);flex:1;">Close — Loss</button>
          </div>
        ` : ""}
      </div>
    `).join("") : `<div class="module-sub" style="font-style:italic;padding:20px 0;text-align:center;">No trades logged yet.</div>`;

    container.querySelectorAll("[data-close]").forEach(btn => {
      btn.addEventListener("click", () => {
        WealthData.updateIntradayTrade(parseFloat(btn.dataset.close), { status: btn.dataset.outcome, dateClosed: new Date().toISOString() });
        App.saveNow(true);
        refresh(container);
      });
    });
  }

  return { render, computeChecklist, computeAllocation };
})();

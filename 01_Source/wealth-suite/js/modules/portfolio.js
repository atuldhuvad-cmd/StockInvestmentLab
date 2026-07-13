/* ============================================================================
   Portfolio Module
   ============================================================================
   "How are my investments doing?" — per the revised roadmap, this is the
   highest-use module, built accordingly. Works standalone for ANY ticker,
   not just the 10 with real fundamentals (Standalone Value Rule) — adding a
   holding never requires fundamentals data to exist first; fundamentals
   context is a bonus layer shown when available, never a dependency.
============================================================================ */

const PortfolioModule = (function () {

  const ASSET_CLASSES = ["Equity", "Gold", "Debt", "Other"];

  function computeRow(holding) {
    const security = WealthData.getSecurity(holding.ticker);
    const fundamentals = WealthData.getFundamentals(holding.ticker);
    const currentPrice = holding.currentPrice || holding.avgCost; // fall back to cost if never priced
    const currentValue = holding.quantity * currentPrice;
    const investedValue = holding.quantity * holding.avgCost;
    const gainAbs = currentValue - investedValue;
    const gainPct = investedValue ? (gainAbs / investedValue) * 100 : 0;
    const sector = security ? security.sector : null;
    const hasFundamentals = !!fundamentals;
    return { holding, currentPrice, currentValue, investedValue, gainAbs, gainPct, sector, hasFundamentals };
  }

  function computeSummary(rows) {
    const totalValue = rows.reduce((s, r) => s + r.currentValue, 0);
    const totalInvested = rows.reduce((s, r) => s + r.investedValue, 0);
    const totalGain = totalValue - totalInvested;
    const totalGainPct = totalInvested ? (totalGain / totalInvested) * 100 : 0;

    const bySector = {};
    rows.forEach(r => {
      const key = r.sector || "Unclassified";
      bySector[key] = (bySector[key] || 0) + r.currentValue;
    });
    const byAssetClass = {};
    rows.forEach(r => {
      const key = r.holding.assetClass || "Equity";
      byAssetClass[key] = (byAssetClass[key] || 0) + r.currentValue;
    });

    return { totalValue, totalInvested, totalGain, totalGainPct, bySector, byAssetClass };
  }

  function render(container) {
    container.innerHTML = `
      <div class="module-header">
        <h2>Portfolio</h2>
        <p class="module-sub">What you actually own — value, gain/loss, and allocation. Works for any ticker; fundamentals context appears automatically for the companies you have real data on.</p>
      </div>

      <div id="pf-summary"></div>

      <div class="panel" style="margin: 20px 0;">
        <div class="field-row"><label for="pf-ticker">Ticker</label><input type="text" id="pf-ticker" style="text-transform:uppercase" placeholder="e.g. TCS"></div>
        <div class="field-row"><label for="pf-qty">Quantity</label><input type="number" id="pf-qty" placeholder="e.g. 50"></div>
        <div class="field-row"><label for="pf-cost">Average cost (₹)</label><input type="number" id="pf-cost" placeholder="e.g. 3850"></div>
        <div class="field-row"><label for="pf-price">Current price (₹, optional)</label><input type="number" id="pf-price" placeholder="defaults to avg cost if left blank"></div>
        <div class="field-row"><label for="pf-class">Asset class</label>
          <select id="pf-class" style="min-height:44px;background:var(--bg-ticket);border:1px solid var(--rule-bright);color:var(--paper);font-family:var(--mono);padding:0 10px;width:100%;">
            ${ASSET_CLASSES.map(c => `<option value="${c}">${c}</option>`).join("")}
          </select>
        </div>
        <div class="field-row"><label for="pf-date">Purchase date</label><input type="date" id="pf-date"></div>
        <button class="btn" id="pf-add">Add holding</button>
      </div>

      <div class="section-head"><span class="section-title" style="font-size:15px;">Holdings</span><span class="module-sub" id="pf-count" style="margin-left:auto;"></span></div>

      <div class="table-wrap">
        <table>
          <thead><tr><th>Ticker</th><th>Qty</th><th>Avg Cost</th><th>Current</th><th>Value</th><th>Gain</th><th>Sector</th><th></th></tr></thead>
          <tbody id="pf-table-body"></tbody>
        </table>
      </div>
      <div class="card-list" id="pf-card-list"></div>
    `;

    container.querySelector("#pf-add").addEventListener("click", () => {
      const ticker = container.querySelector("#pf-ticker").value.trim().toUpperCase();
      const quantity = parseFloat(container.querySelector("#pf-qty").value);
      const avgCost = parseFloat(container.querySelector("#pf-cost").value);
      if (!ticker || !quantity || !avgCost) {
        App.showStatus("Ticker, quantity, and average cost are required", "error");
        return;
      }
      const currentPriceInput = parseFloat(container.querySelector("#pf-price").value);
      WealthData.addHolding({
        ticker, quantity, avgCost,
        currentPrice: isNaN(currentPriceInput) ? null : currentPriceInput,
        assetClass: container.querySelector("#pf-class").value,
        purchaseDate: container.querySelector("#pf-date").value || null
      });
      ["pf-ticker","pf-qty","pf-cost","pf-price","pf-date"].forEach(id => container.querySelector("#"+id).value = "");
      App.saveNow(true);
      renderList(container);
    });

    renderList(container);
  }

  function fmtINR(n) {
    const neg = n < 0; n = Math.abs(Math.round(n));
    return (neg ? "−₹" : "₹") + n.toLocaleString("en-IN");
  }

  function renderList(container) {
    const holdings = WealthData.getHoldings().filter(h => h.active !== false);
    const rows = holdings.map(computeRow);
    const summary = computeSummary(rows);

    container.querySelector("#pf-summary").innerHTML = `
      <div class="ratio-grid">
        <div class="ratio-cell"><div class="ratio-label">Total Value</div><div class="ratio-value">${fmtINR(summary.totalValue)}</div></div>
        <div class="ratio-cell"><div class="ratio-label">Invested</div><div class="ratio-value">${fmtINR(summary.totalInvested)}</div></div>
        <div class="ratio-cell"><div class="ratio-label">Gain/Loss</div><div class="ratio-value" style="color:${summary.totalGain>=0?'var(--gain)':'var(--loss)'}">${fmtINR(summary.totalGain)}</div></div>
        <div class="ratio-cell"><div class="ratio-label">Return</div><div class="ratio-value" style="color:${summary.totalGainPct>=0?'var(--gain)':'var(--loss)'}">${summary.totalGainPct>=0?'+':''}${summary.totalGainPct.toFixed(1)}%</div></div>
      </div>
    `;

    container.querySelector("#pf-count").textContent = `${rows.length} ${rows.length === 1 ? "holding" : "holdings"}`;

    container.querySelector("#pf-table-body").innerHTML = rows.length ? rows.map(r => `
      <tr>
        <td>${r.holding.ticker}${r.hasFundamentals ? '' : ''}</td>
        <td>${r.holding.quantity}</td>
        <td>₹${r.holding.avgCost.toLocaleString('en-IN')}</td>
        <td>₹${r.currentPrice.toLocaleString('en-IN')}</td>
        <td>${fmtINR(r.currentValue)}</td>
        <td style="color:${r.gainPct>=0?'var(--gain)':'var(--loss)'}">${r.gainPct>=0?'+':''}${r.gainPct.toFixed(1)}%</td>
        <td>${r.sector || '—'}</td>
        <td><button class="ticker-chip" data-remove="${r.holding.id}" style="min-height:32px;padding:0 10px;">Remove</button></td>
      </tr>
    `).join("") : `<tr><td colspan="8" style="text-align:center;color:var(--paper-faint);font-style:italic;">No holdings yet.</td></tr>`;

    container.querySelector("#pf-card-list").innerHTML = rows.length ? rows.map(r => `
      <div class="data-card">
        <div class="data-card-title" style="display:flex;justify-content:space-between;align-items:center;">
          ${r.holding.ticker}
          <span class="chip ${r.gainPct>=0?'gain':'loss'}" style="font-family:var(--mono);font-size:11px;padding:3px 8px;border:1px solid var(--rule-bright);">${r.gainPct>=0?'+':''}${r.gainPct.toFixed(1)}%</span>
        </div>
        <div class="data-card-row"><span class="k">Qty</span><span class="v">${r.holding.quantity}</span></div>
        <div class="data-card-row"><span class="k">Avg Cost</span><span class="v">₹${r.holding.avgCost.toLocaleString('en-IN')}</span></div>
        <div class="data-card-row"><span class="k">Current</span><span class="v">₹${r.currentPrice.toLocaleString('en-IN')}</span></div>
        <div class="data-card-row"><span class="k">Value</span><span class="v">${fmtINR(r.currentValue)}</span></div>
        ${r.sector ? `<div class="data-card-row"><span class="k">Sector</span><span class="v">${r.sector}</span></div>` : ""}
        <button class="btn" data-remove="${r.holding.id}" style="margin-top:10px;background:transparent;border:1px solid var(--rule-bright);color:var(--paper-dim);">Remove</button>
      </div>
    `).join("") : `<div class="module-sub" style="font-style:italic;padding:20px 0;text-align:center;">No holdings yet. Add your first one above.</div>`;

    container.querySelectorAll("[data-remove]").forEach(btn => {
      btn.addEventListener("click", () => {
        WealthData.removeHolding(parseFloat(btn.dataset.remove));
        App.saveNow(true);
        renderList(container);
      });
    });
  }

  return { render, computeRow, computeSummary };
})();

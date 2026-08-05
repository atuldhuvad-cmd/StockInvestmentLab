/* ============================================================================
   Portfolio Module
   ============================================================================
   Current holdings remain the shared snapshot consumed by Overview and
   Intraday. Manual BUY/SELL entries now also create an append-only ledger:
   BUY updates weighted-average cost; SELL records realised gain and reduces
   or closes the holding. Legacy/imported holdings and transactions remain
   valid without dates. Delete holding is correction-only and never a sale.
============================================================================ */

const PortfolioModule = (function () {

  const ASSET_CLASSES = ["Equity", "Gold", "Debt", "Other"];

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function evaluateFundamentalHealth(holding, fundamentalsRecord) {
    const coverage = CompanyCalculations.fundamentalCoverage(fundamentalsRecord);
    if (!fundamentalsRecord) return { status: "Missing", severity: "amber", missing: coverage.missing, flags: [] };
    const status = CompanyCalculations.determineReviewStatus(fundamentalsRecord);
    let flags = [];
    if (Array.isArray(fundamentalsRecord.years) && fundamentalsRecord.years.length > 0) {
      flags = CompanyCalculations.detectRedFlags(fundamentalsRecord);
    }
    let severity = "healthy";
    if (flags.length > 0) severity = "red";
    else if (status !== "Eligible for Full Rating") severity = "amber";
    return { status, severity, missing: coverage.missing || [], flags };
  }

  function buildFundamentalRiskSummary(holdings, fundamentalsByTicker) {
    fundamentalsByTicker = fundamentalsByTicker || {};
    const risks = [];
    holdings.forEach(h => {
      if (h.active === false) return;
      const ticker = String(h.ticker || "").trim().toUpperCase();
      const health = evaluateFundamentalHealth(h, fundamentalsByTicker[ticker] || fundamentalsByTicker[h.ticker]);
      if (health.severity !== "healthy") risks.push({ holding: h, ticker, health });
    });
    return risks;
  }

  function computeRow(holding) {
    const security = WealthData.getSecurity(holding.ticker);
    const normalizedTicker = String(holding.ticker || "").trim().toUpperCase();
    const fundamentals = WealthData.getFundamentals(normalizedTicker) || WealthData.getFundamentals(holding.ticker);
    const currentPrice = holding.currentPrice || holding.avgCost;
    const currentValue = holding.quantity * currentPrice;
    const investedValue = holding.quantity * holding.avgCost;
    const gainAbs = currentValue - investedValue;
    const gainPct = investedValue ? (gainAbs / investedValue) * 100 : 0;
    const sector = security ? security.sector : null;
    const hasFundamentals = !!fundamentals;
    const health = evaluateFundamentalHealth(holding, fundamentals);
    return { holding, currentPrice, currentValue, investedValue, gainAbs, gainPct, sector, hasFundamentals, health };
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

  function localISODate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function isValidTransactionDate(value, today = localISODate()) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    const validCalendarDate = parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
    return validCalendarDate && value <= today;
  }

  function validateTransaction(input, holdings, today = localISODate()) {
    const type = String(input.type || "").toUpperCase();
    const ticker = String(input.ticker || "").trim().toUpperCase();
    const quantity = Number(input.quantity);
    const price = Number(input.price);
    const hasCurrentPrice = input.currentPrice !== undefined && input.currentPrice !== null && input.currentPrice !== "";
    const currentPrice = hasCurrentPrice ? Number(input.currentPrice) : null;
    if (type !== "BUY" && type !== "SELL") return "Transaction type must be BUY or SELL";
    if (!ticker) return "Ticker is required";
    if (!Number.isFinite(quantity) || quantity <= 0) return "Quantity must be greater than zero";
    if (!Number.isFinite(price) || price <= 0) return "Price must be greater than zero";
    if (hasCurrentPrice && (!Number.isFinite(currentPrice) || currentPrice <= 0)) return "Current price must be greater than zero when provided";
    if (!isValidTransactionDate(input.transactionDate, today)) return "Transaction date is required, valid, and cannot be in the future";
    if (type === "SELL") {
      const available = holdings
        .filter(h => h.active !== false && String(h.ticker).toUpperCase() === ticker)
        .reduce((sum, h) => sum + Number(h.quantity || 0), 0);
      if (available <= 0) return `No holding is available to sell for ${ticker}`;
      if (quantity > available) return `Sell quantity exceeds the available ${available}`;
    }
    return null;
  }

  function createTransactionPlan(holdings, input, options = {}) {
    const today = options.today || localISODate();
    const error = validateTransaction(input, holdings, today);
    if (error) return { ok: false, error };

    const type = String(input.type).toUpperCase();
    const ticker = String(input.ticker).trim().toUpperCase();
    const quantity = Number(input.quantity);
    const price = Number(input.price);
    const suppliedCurrentPrice = input.currentPrice !== undefined && input.currentPrice !== null && input.currentPrice !== "" ? Number(input.currentPrice) : null;
    const matches = holdings.filter(h => h.active !== false && String(h.ticker).toUpperCase() === ticker);
    const unaffected = holdings.filter(h => h.active === false || String(h.ticker).toUpperCase() !== ticker);
    const existingQuantity = matches.reduce((sum, h) => sum + Number(h.quantity || 0), 0);
    const existingCost = matches.reduce((sum, h) => sum + Number(h.quantity || 0) * Number(h.avgCost || 0), 0);
    const existingValue = matches.reduce((sum, h) => {
      const currentPrice = h.currentPrice || h.avgCost;
      return sum + Number(h.quantity || 0) * Number(currentPrice || 0);
    }, 0);
    const existingAverageCost = existingQuantity ? existingCost / existingQuantity : 0;
    const existingCurrentPrice = existingQuantity ? existingValue / existingQuantity : 0;
    const baseHolding = matches[0] || null;
    let nextHolding = null;
    let realisedGain = null;

    if (type === "BUY") {
      const nextQuantity = existingQuantity + quantity;
      nextHolding = {
        id: baseHolding ? baseHolding.id : (options.holdingId !== undefined ? options.holdingId : Date.now() + Math.random()),
        ticker,
        quantity: nextQuantity,
        avgCost: (existingCost + quantity * price) / nextQuantity,
        currentPrice: suppliedCurrentPrice !== null ? suppliedCurrentPrice : (existingQuantity ? existingCurrentPrice : null),
        assetClass: baseHolding ? (baseHolding.assetClass || input.assetClass || "Equity") : (input.assetClass || "Equity")
      };
    } else {
      const nextQuantity = existingQuantity - quantity;
      realisedGain = (price - existingAverageCost) * quantity;
      if (nextQuantity > 0) {
        nextHolding = {
          id: baseHolding.id,
          ticker,
          quantity: nextQuantity,
          avgCost: existingAverageCost,
          currentPrice: existingCurrentPrice || existingAverageCost,
          assetClass: baseHolding.assetClass || "Equity"
        };
      }
    }

    const transaction = {
      id: options.transactionId !== undefined ? options.transactionId : Date.now() + Math.random(),
      ticker,
      type,
      quantity,
      price,
      transactionDate: input.transactionDate,
      costBasisPerUnit: type === "SELL" ? existingAverageCost : null,
      realisedGain,
      createdAt: options.createdAt || new Date().toISOString()
    };

    return {
      ok: true,
      holdings: nextHolding ? [...unaffected, nextHolding] : unaffected,
      transaction,
      holding: nextHolding
    };
  }

  function computeRealisedGain(transactions) {
    return transactions.reduce((sum, transaction) => {
      return transaction.type === "SELL" && typeof transaction.realisedGain === "number" && Number.isFinite(transaction.realisedGain)
        ? sum + transaction.realisedGain : sum;
    }, 0);
  }

  function formatTransactionDate(value) {
    if (!value || !isValidTransactionDate(value, "9999-12-31")) return "Date unavailable";
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  function fmtINR(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "—";
    const negative = value < 0;
    const amount = Math.abs(Math.round(value)).toLocaleString("en-IN");
    return (negative ? "−₹" : "₹") + amount;
  }

  function render(container) {
    const today = localISODate();
    container.innerHTML = `
      <div class="module-header">
        <h2>Portfolio</h2>
        <p class="module-sub">Current holdings plus a manual BUY/SELL ledger. Transactions update weighted-average cost; sales preserve realised gain history.</p>
      </div>

      <div id="pf-risk-dashboard" style="margin-bottom:20px;"></div>
      <div id="pf-summary"></div>

      <div class="panel" id="pf-transaction-panel" style="margin:20px 0;">
        <div class="section-head" style="margin-bottom:14px;"><span class="section-title" style="font-size:15px;">Record transaction</span></div>
        <div class="field-row"><label for="pf-tx-type">Type</label>
          <select id="pf-tx-type" style="min-height:44px;background:var(--bg-ticket);border:1px solid var(--rule-bright);color:var(--paper);font-family:var(--mono);padding:0 10px;width:100%;">
            <option value="BUY">BUY</option><option value="SELL">SELL</option>
          </select>
        </div>
        <div class="field-row"><label for="pf-tx-ticker">Ticker</label><input type="text" id="pf-tx-ticker" style="text-transform:uppercase" placeholder="e.g. TCS"></div>
        <div class="field-row"><label for="pf-tx-qty">Quantity</label><input type="number" id="pf-tx-qty" min="0" step="any"></div>
        <div class="field-row"><label for="pf-tx-price">Transaction price (₹)</label><input type="number" id="pf-tx-price" min="0" step="any"></div>
        <div class="field-row" id="pf-tx-current-row"><label for="pf-tx-current-price">Current price (₹, optional)</label><input type="number" id="pf-tx-current-price" min="0" step="any" placeholder="for unrealised gain/loss"></div>
        <div class="field-row"><label for="pf-tx-date">Transaction date</label><input type="date" id="pf-tx-date" max="${today}" required></div>
        <div class="field-row" id="pf-tx-asset-row"><label for="pf-tx-class">Asset class</label>
          <select id="pf-tx-class" style="min-height:44px;background:var(--bg-ticket);border:1px solid var(--rule-bright);color:var(--paper);font-family:var(--mono);padding:0 10px;width:100%;">
            ${ASSET_CLASSES.map(value => `<option value="${value}">${value}</option>`).join("")}
          </select>
        </div>
        <button class="btn" id="pf-record-transaction">Record BUY</button>
        <div class="module-sub" style="margin-top:10px;">Manual BUY and SELL entries require their actual transaction date. Imported legacy records without dates remain valid.</div>
      </div>

      <div class="section-head"><span class="section-title" style="font-size:15px;">Holdings</span><span class="module-sub" id="pf-count" style="margin-left:auto;"></span></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Ticker</th><th>Qty</th><th>Avg Cost</th><th>Current</th><th>Value</th><th>Unrealised</th><th>Sector</th><th>Fundamental Health</th><th>Actions</th></tr></thead>
          <tbody id="pf-table-body"></tbody>
        </table>
      </div>
      <div class="card-list" id="pf-card-list"></div>

      <div class="section-head" style="margin-top:24px;"><span class="section-title" style="font-size:15px;">Transaction history</span><span class="module-sub" id="pf-tx-count" style="margin-left:auto;"></span></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Type</th><th>Ticker</th><th>Qty</th><th>Price</th><th>Value</th><th>Realised gain/loss</th></tr></thead>
          <tbody id="pf-tx-table-body"></tbody>
        </table>
      </div>
      <div class="card-list" id="pf-tx-card-list"></div>
    `;

    const typeSelect = container.querySelector("#pf-tx-type");
    function refreshTransactionForm() {
      const isSell = typeSelect.value === "SELL";
      container.querySelector("#pf-tx-asset-row").style.display = isSell ? "none" : "flex";
      container.querySelector("#pf-tx-current-row").style.display = isSell ? "none" : "flex";
      container.querySelector("#pf-record-transaction").textContent = `Record ${typeSelect.value}`;
    }
    typeSelect.addEventListener("change", refreshTransactionForm);
    refreshTransactionForm();

    container.querySelector("#pf-record-transaction").addEventListener("click", async () => {
      const input = {
        type: typeSelect.value,
        ticker: container.querySelector("#pf-tx-ticker").value,
        quantity: container.querySelector("#pf-tx-qty").value,
        price: container.querySelector("#pf-tx-price").value,
        currentPrice: container.querySelector("#pf-tx-current-price").value,
        transactionDate: container.querySelector("#pf-tx-date").value,
        assetClass: container.querySelector("#pf-tx-class").value
      };
      const plan = createTransactionPlan(WealthData.getHoldings(), input);
      if (!plan.ok) {
        App.showStatus(plan.error, "error");
        return;
      }
      WealthData.commitPortfolioTransaction(plan.holdings, plan.transaction);
      ["pf-tx-ticker", "pf-tx-qty", "pf-tx-price", "pf-tx-current-price", "pf-tx-date"].forEach(id => { container.querySelector("#" + id).value = ""; });
      await App.saveNow(true);
      renderLists(container);
    });

    renderLists(container);
  }

  function renderLists(container) {
    const holdings = WealthData.getHoldings().filter(h => h.active !== false);
    const rows = holdings.map(computeRow);
    const summary = computeSummary(rows);
    const transactions = WealthData.getPortfolioTransactions();
    const realisedGain = computeRealisedGain(transactions);

    container.querySelector("#pf-summary").innerHTML = `
      <div class="ratio-grid">
        <div class="ratio-cell"><div class="ratio-label">Total Value</div><div class="ratio-value">${fmtINR(summary.totalValue)}</div></div>
        <div class="ratio-cell"><div class="ratio-label">Invested</div><div class="ratio-value">${fmtINR(summary.totalInvested)}</div></div>
        <div class="ratio-cell"><div class="ratio-label">Unrealised Gain/Loss</div><div class="ratio-value" style="color:${summary.totalGain >= 0 ? 'var(--gain)' : 'var(--loss)'}">${fmtINR(summary.totalGain)}</div></div>
        <div class="ratio-cell"><div class="ratio-label">Realised Gain/Loss</div><div class="ratio-value" style="color:${realisedGain >= 0 ? 'var(--gain)' : 'var(--loss)'}">${fmtINR(realisedGain)}</div></div>
      </div>
    `;

    container.querySelector("#pf-count").textContent = `${rows.length} ${rows.length === 1 ? "holding" : "holdings"}`;

    const risks = buildFundamentalRiskSummary(holdings, WealthData.get().fundamentals || {});
    const riskHtml = risks.length === 0
      ? `<div style="padding:14px;background:var(--bg-ticket);border:1px solid var(--rule-bright);color:var(--gain);display:flex;align-items:center;gap:8px;">✅ <strong>Zero Fundamental Risks Detected.</strong> All active holdings are eligible and flag-free.</div>`
      : `<div style="padding:14px;background:var(--bg-ticket);border:1px solid var(--rule-bright);">
          <div style="font-weight:600;margin-bottom:8px;color:var(--loss);">⚠️ Fundamental Risks Detected in Active Holdings</div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${risks.map(r => {
              const text = r.health.severity === 'red' ? `Detected ${r.health.flags.length} red flag(s)` : `Status: ${r.health.status}`;
              const reasons = r.health.flags.length ? r.health.flags : r.health.missing.map(item => `Missing: ${item}`);
              return `<div style="display:flex;align-items:center;gap:12px;font-size:12px;background:var(--bg-raised);padding:8px;border:1px solid var(--rule-bright);">
                <strong style="width:70px;">${escapeHtml(r.ticker)}</strong>
                <div style="color:${r.health.severity === 'red' ? 'var(--loss)' : 'var(--amber)'};flex:1;">
                  <div>${escapeHtml(text)}</div>
                  <ul style="margin:4px 0 0 16px;padding:0;">${reasons.map(reason => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>
                </div>
                <button class="btn btn-review-risk" data-ticker="${escapeHtml(r.ticker)}" style="padding:4px 8px;font-size:11px;">Review</button>
              </div>`;
            }).join("")}
          </div>
         </div>`;
    container.querySelector("#pf-risk-dashboard").innerHTML = riskHtml;

    container.querySelectorAll(".btn-review-risk").forEach(btn => {
      btn.addEventListener("click", () => {
        if (typeof FundamentalsModule !== "undefined" && typeof FundamentalsModule.openTicker === "function") {
          FundamentalsModule.openTicker(btn.dataset.ticker);
        }
      });
    });

    container.querySelector("#pf-table-body").innerHTML = rows.length ? rows.map(row => `
      <tr>
        <td>${row.holding.ticker}</td><td>${row.holding.quantity}</td>
        <td>₹${row.holding.avgCost.toLocaleString("en-IN")}</td><td>₹${row.currentPrice.toLocaleString("en-IN")}</td>
        <td>${fmtINR(row.currentValue)}</td>
        <td style="color:${row.gainPct >= 0 ? 'var(--gain)' : 'var(--loss)'}">${row.gainPct >= 0 ? '+' : ''}${row.gainPct.toFixed(1)}%</td>
        <td>${row.sector || '—'}</td>
        <td style="color:${row.health.severity === 'red' ? 'var(--loss)' : (row.health.severity === 'amber' ? 'var(--amber)' : 'var(--gain)')}">${row.health.severity === 'red' ? '⚠️ ' : (row.health.severity === 'amber' ? '⚠️ ' : '✅ ')}${escapeHtml(row.health.status)}</td>
        <td><div class="holding-actions"><button class="btn holding-sell" data-sell="${row.holding.id}">Sell</button><button class="ticker-chip holding-delete" data-delete-holding="${row.holding.id}">Delete holding</button></div></td>
      </tr>
    `).join("") : `<tr><td colspan="9" style="text-align:center;color:var(--paper-faint);font-style:italic;">No holdings yet.</td></tr>`;

    container.querySelector("#pf-card-list").innerHTML = rows.length ? rows.map(row => `
      <div class="data-card">
        <div class="data-card-title" style="display:flex;justify-content:space-between;align-items:center;">${row.holding.ticker}<span class="chip ${row.gainPct >= 0 ? 'gain' : 'loss'}" style="font-family:var(--mono);font-size:11px;padding:3px 8px;border:1px solid var(--rule-bright);">${row.gainPct >= 0 ? '+' : ''}${row.gainPct.toFixed(1)}%</span></div>
        <div class="data-card-row"><span class="k">Qty</span><span class="v">${row.holding.quantity}</span></div>
        <div class="data-card-row"><span class="k">Average cost</span><span class="v">₹${row.holding.avgCost.toLocaleString("en-IN")}</span></div>
        <div class="data-card-row"><span class="k">Current value</span><span class="v">${fmtINR(row.currentValue)}</span></div>
        <div class="data-card-row"><span class="k">Fundamental Health</span><span class="v" style="color:${row.health.severity === 'red' ? 'var(--loss)' : (row.health.severity === 'amber' ? 'var(--amber)' : 'var(--gain)')}">${row.health.severity === 'red' ? '⚠️ ' : (row.health.severity === 'amber' ? '⚠️ ' : '✅ ')}${escapeHtml(row.health.status)}</span></div>
        <button class="btn holding-sell" data-sell="${row.holding.id}" style="margin-top:10px;">Sell</button>
        <button class="btn holding-delete" data-delete-holding="${row.holding.id}" style="margin-top:8px;background:transparent;border:1px solid var(--rule-bright);color:var(--paper-dim);">Delete holding</button>
      </div>
    `).join("") : `<div class="module-sub" style="font-style:italic;padding:20px 0;text-align:center;">No holdings yet. Record a BUY transaction above to create one.</div>`;

    container.querySelectorAll("[data-sell]").forEach(button => {
      button.addEventListener("click", () => {
        const holding = holdings.find(item => item.id === Number(button.dataset.sell));
        if (!holding) return;
        container.querySelector("#pf-tx-type").value = "SELL";
        container.querySelector("#pf-tx-type").dispatchEvent(new Event("change"));
        container.querySelector("#pf-tx-ticker").value = holding.ticker;
        container.querySelector("#pf-tx-qty").focus();
        container.querySelector("#pf-transaction-panel").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    container.querySelectorAll("[data-delete-holding]").forEach(button => {
      button.addEventListener("click", async () => {
        if (!confirm("Permanently delete this holding as a data correction? This is not a sale and creates no SELL transaction.")) return;
        WealthData.removeHolding(Number(button.dataset.deleteHolding));
        await App.saveNow(true);
        renderLists(container);
      });
    });

    const sortedTransactions = transactions.slice().sort((a, b) => {
      const aDate = a.transactionDate || "";
      const bDate = b.transactionDate || "";
      if (aDate !== bDate) return bDate.localeCompare(aDate);
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
    container.querySelector("#pf-tx-count").textContent = `${sortedTransactions.length} ${sortedTransactions.length === 1 ? "transaction" : "transactions"}`;
    container.querySelector("#pf-tx-table-body").innerHTML = sortedTransactions.length ? sortedTransactions.map(transaction => `
      <tr><td>${formatTransactionDate(transaction.transactionDate)}</td><td>${transaction.type || '—'}</td><td>${transaction.ticker || '—'}</td><td>${transaction.quantity ?? '—'}</td><td>${fmtINR(transaction.price)}</td><td>${fmtINR(Number(transaction.quantity) * Number(transaction.price))}</td><td>${transaction.type === 'SELL' ? fmtINR(transaction.realisedGain) : '—'}</td></tr>
    `).join("") : `<tr><td colspan="7" style="text-align:center;color:var(--paper-faint);font-style:italic;">No transactions recorded yet.</td></tr>`;
    container.querySelector("#pf-tx-card-list").innerHTML = sortedTransactions.length ? sortedTransactions.map(transaction => `
      <div class="data-card"><div class="data-card-title">${transaction.type || '—'} · ${transaction.ticker || '—'}</div><div class="data-card-row"><span class="k">Date</span><span class="v">${formatTransactionDate(transaction.transactionDate)}</span></div><div class="data-card-row"><span class="k">Quantity</span><span class="v">${transaction.quantity ?? '—'}</span></div><div class="data-card-row"><span class="k">Price</span><span class="v">${fmtINR(transaction.price)}</span></div>${transaction.type === 'SELL' ? `<div class="data-card-row"><span class="k">Realised gain/loss</span><span class="v">${fmtINR(transaction.realisedGain)}</span></div>` : ''}</div>
    `).join("") : `<div class="module-sub" style="font-style:italic;padding:20px 0;text-align:center;">No transactions recorded yet. Legacy holdings remain valid without fabricated history.</div>`;
  }

  return {
    render, computeRow, computeSummary, computeRealisedGain,
    isValidTransactionDate, validateTransaction, createTransactionPlan,
    formatTransactionDate, localISODate, escapeHtml, evaluateFundamentalHealth, buildFundamentalRiskSummary
  };
})();

/* ============================================================================
   Watchlist Module
   ============================================================================
   Stocks under consideration — deliberately kept separate from actual
   holdings (the approved refinement to the original plan). Purpose-optimized
   per the frozen "mobile-first, not mobile-identical" rule: mobile shows one
   card per item with the essentials and a tap-to-expand for notes; desktop
   shows the same items as a denser table with notes inline. Same data,
   same WealthData.watchlist array, two presentations.
============================================================================ */

const WatchlistModule = (function () {

  const CATEGORIES = [
    { value: "Watch", label: "Watch" },
    { value: "Research", label: "Needs Study" },
    { value: "Buy Soon", label: "Buy Soon" },
    { value: "Reject", label: "Reject" }
  ];
  const CATEGORY_COLOR = { "Watch": "", "Research": "flag", "Buy Soon": "gain", "Reject": "loss" };

  function categoryLabel(value) {
    const category = CATEGORIES.find(item => item.value === value);
    return category ? category.label : value;
  }

  // Pure: normalize raw form input into a watchlist item (no id/dateAdded —
  // those are assigned by WealthData.addWatchlistItem). Returns null if the
  // ticker is empty, so the caller can show the "Enter a ticker first" error.
  function buildItem(raw) {
    const ticker = (raw.ticker || "").trim().toUpperCase();
    if (!ticker) return null;
    return {
      ticker,
      category: raw.category,
      targetPrice: parseFloat(raw.targetPrice) || null,
      notes: (raw.notes || "").trim()
    };
  }

  // Pure: newest-first by dateAdded, on a copy (never mutates the stored array).
  function sortByDateAdded(items) {
    return items.slice().sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
  }

  function render(container) {
    container.innerHTML = `
      <div class="module-header">
        <h2>Watchlist</h2>
        <p class="module-sub">Stocks you're researching, waiting on valuation, or have set aside — kept separate from what you actually own.</p>
      </div>

      <div class="panel" style="margin-bottom:20px;">
        <div class="field-row"><label for="wl-ticker">Ticker</label><input type="text" id="wl-ticker" style="text-transform:uppercase" placeholder="e.g. WIPRO"></div>
        <div class="field-row"><label for="wl-category">Category</label>
          <select id="wl-category" style="min-height:44px;background:var(--bg-ticket);border:1px solid var(--rule-bright);color:var(--paper);font-family:var(--mono);padding:0 10px;width:100%;">
            ${CATEGORIES.map(c => `<option value="${c.value}">${c.label}</option>`).join("")}
          </select>
        </div>
        <div class="field-row"><label for="wl-target">Target price (₹, optional)</label><input type="number" id="wl-target" placeholder="e.g. 450"></div>
        <div class="field-row"><label for="wl-notes">Notes</label><input type="text" id="wl-notes" placeholder="Why is this on your list?"></div>
        <button class="btn" id="wl-add">Add to watchlist</button>
      </div>

      <div class="section-head"><span class="section-title" style="font-size:15px;">Your list</span><span class="module-sub" id="wl-count" style="margin-left:auto;"></span></div>

      <div class="table-wrap">
        <table>
          <thead><tr><th>Ticker</th><th>Category</th><th>Target</th><th>Notes</th><th>Added</th><th></th></tr></thead>
          <tbody id="wl-table-body"></tbody>
        </table>
      </div>
      <div class="card-list" id="wl-card-list"></div>
    `;

    container.querySelector("#wl-add").addEventListener("click", () => {
      const item = buildItem({
        ticker:      container.querySelector("#wl-ticker").value,
        category:    container.querySelector("#wl-category").value,
        targetPrice: container.querySelector("#wl-target").value,
        notes:       container.querySelector("#wl-notes").value
      });
      if (!item) { App.showStatus("Enter a ticker first", "error"); return; }
      WealthData.addWatchlistItem(item);
      container.querySelector("#wl-ticker").value = "";
      container.querySelector("#wl-target").value = "";
      container.querySelector("#wl-notes").value = "";
      App.saveNow(true);
      renderList(container);
    });

    renderList(container);
  }

  function renderList(container) {
    const items = sortByDateAdded(WealthData.getWatchlist());
    container.querySelector("#wl-count").textContent = `${items.length} ${items.length === 1 ? "stock" : "stocks"}`;

    // Desktop table — full detail, every column visible at once (this is the
    // "preserve full analytical capability on larger screens" half of the rule)
    container.querySelector("#wl-table-body").innerHTML = items.length ? items.map(item => `
      <tr>
        <td>${item.ticker}</td>
        <td>${categoryLabel(item.category)}</td>
        <td>${item.targetPrice ? '₹' + item.targetPrice.toLocaleString('en-IN') : '—'}</td>
        <td style="text-align:left;max-width:220px;white-space:normal;">${item.notes || '—'}</td>
        <td>${new Date(item.dateAdded).toLocaleDateString('en-IN')}</td>
        <td><button class="ticker-chip" data-remove="${item.id}" style="min-height:32px;padding:0 10px;">Remove</button></td>
      </tr>
    `).join("") : `<tr><td colspan="6" style="text-align:center;color:var(--paper-faint);font-style:italic;">Nothing on your watchlist yet.</td></tr>`;

    // Mobile cards — the essentials only, notes shown but not competing with
    // six dense table columns on a narrow screen (the "summary, not forced
    // desktop density" half of the rule)
    container.querySelector("#wl-card-list").innerHTML = items.length ? items.map(item => `
      <div class="data-card">
        <div class="data-card-title" style="display:flex;justify-content:space-between;align-items:center;">
          ${item.ticker}
          <span class="chip ${CATEGORY_COLOR[item.category]}" style="font-family:var(--mono);font-size:10px;padding:3px 8px;border:1px solid var(--rule-bright);">${categoryLabel(item.category)}</span>
        </div>
        ${item.targetPrice ? `<div class="data-card-row"><span class="k">Target</span><span class="v">₹${item.targetPrice.toLocaleString('en-IN')}</span></div>` : ""}
        ${item.notes ? `<div class="data-card-row"><span class="k">Notes</span><span class="v" style="text-align:right;max-width:60%;">${item.notes}</span></div>` : ""}
        <div class="data-card-row"><span class="k">Added</span><span class="v">${new Date(item.dateAdded).toLocaleDateString('en-IN')}</span></div>
        <button class="btn" data-remove="${item.id}" style="margin-top:10px;background:transparent;border:1px solid var(--rule-bright);color:var(--paper-dim);">Remove</button>
      </div>
    `).join("") : `<div class="module-sub" style="font-style:italic;padding:20px 0;text-align:center;">Nothing on your watchlist yet. Add your first stock above.</div>`;

    container.querySelectorAll("[data-remove]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = parseFloat(btn.dataset.remove);
        WealthData.removeWatchlistItem(id);
        App.saveNow(true);
        renderList(container);
      });
    });
  }

  return { render, categoryLabel, buildItem, sortByDateAdded };
})();

/* ============================================================================
   Research Library Module
   ============================================================================
   The Company Knowledge Base — expanded scope approved earlier: thesis, bull
   case, bear case, risks, management quality, annual report notes, concall
   summaries, AI-generated summaries (pasted, not API-generated — see note
   below), quarterly observations, and decision history.

   Architecture freeze compliance: uses WealthData.researchLibrary, already
   defined in the data model since Portfolio's build. No new persistence
   mechanism, no new data structure — every entry type below is the same
   {ticker, docType, title, content, aiAnalysis, addedAt} shape, just a
   different docType value. "AI-generated summary" is a field you paste
   into, never a live API call — a live call would need a backend, which
   the frozen architecture explicitly rules out.

   Standalone Value Rule: works for ANY ticker, including one with no
   Fundamentals, Portfolio, or Watchlist entry — research often starts
   before you've added a company anywhere else.
============================================================================ */

const ResearchModule = (function () {

  const DOC_TYPES = [
    "Investment Thesis", "Bull Case", "Bear Case", "Key Risk",
    "Management Assessment", "Annual Report Note", "Concall Summary",
    "AI-Generated Summary", "Quarterly Observation", "Decision Record"
  ];
  const DECISION_OPTIONS = ["Buy", "Sell", "Hold", "Watching", "Passed"];
  const TYPE_COLOR = {
    "Bull Case": "gain", "Bear Case": "loss", "Key Risk": "loss",
    "Decision Record": "flag", "AI-Generated Summary": "flag"
  };

  function render(container) {
    const state = { searchText: "", selectedTicker: null };

    container.innerHTML = `
      <div class="module-header">
        <h2>Research Library</h2>
        <p class="module-sub">Your company knowledge base — thesis, bull/bear case, risks, notes, and why you made past decisions. Not a live AI tool: paste summaries you've already generated elsewhere.</p>
      </div>

      <div class="panel" style="margin-bottom:20px;">
        <div class="field-row"><label for="rl-ticker">Ticker</label><input type="text" id="rl-ticker" style="text-transform:uppercase" placeholder="e.g. TCS — any ticker, no other data required"></div>
        <div class="field-row"><label for="rl-type">Type</label>
          <select id="rl-type" style="min-height:44px;background:var(--bg-ticket);border:1px solid var(--rule-bright);color:var(--paper);font-family:var(--mono);padding:0 10px;width:100%;">
            ${DOC_TYPES.map(t => `<option value="${t}">${t}</option>`).join("")}
          </select>
        </div>
        <div id="rl-decision-field" class="field-row" style="display:none;">
          <label for="rl-decision">Decision</label>
          <select id="rl-decision" style="min-height:44px;background:var(--bg-ticket);border:1px solid var(--rule-bright);color:var(--paper);font-family:var(--mono);padding:0 10px;width:100%;">
            ${DECISION_OPTIONS.map(d => `<option value="${d}">${d}</option>`).join("")}
          </select>
        </div>
        <div class="field-row"><label for="rl-title">Title</label><input type="text" id="rl-title" placeholder="e.g. Q1 FY27 concall — margin commentary"></div>
        <div class="field-row"><label for="rl-content">Content</label><textarea id="rl-content" rows="4" style="background:var(--bg-ticket);border:1px solid var(--rule-bright);color:var(--paper);font-family:var(--sans);font-size:14px;padding:10px 12px;width:100%;" placeholder="Your notes"></textarea></div>
        <button class="btn" id="rl-add">Add entry</button>
      </div>

      ${ListControls.renderControlsBar("rl-controls", ["All"], [{key:"date",label:"Sort: Newest first"},{key:"ticker",label:"Sort: Ticker A-Z"}], "date")}
      <div id="rl-ticker-list"></div>
      <div id="rl-timeline"></div>
    `;

    const typeSelect = container.querySelector("#rl-type");
    typeSelect.addEventListener("change", () => {
      container.querySelector("#rl-decision-field").style.display = typeSelect.value === "Decision Record" ? "flex" : "none";
    });

    container.querySelector("#rl-add").addEventListener("click", () => {
      const ticker = container.querySelector("#rl-ticker").value.trim().toUpperCase();
      const title = container.querySelector("#rl-title").value.trim();
      if (!ticker || !title) { App.showStatus("Ticker and title are required", "error"); return; }
      const docType = typeSelect.value;
      WealthData.addResearchNote({
        ticker, docType, title,
        content: container.querySelector("#rl-content").value.trim(),
        decision: docType === "Decision Record" ? container.querySelector("#rl-decision").value : null
      });
      ["rl-ticker","rl-title","rl-content"].forEach(id => container.querySelector("#"+id).value = "");
      App.saveNow(true);
      state.selectedTicker = ticker;
      refresh(container, state);
    });

    ListControls.wireControls(container, "rl-controls", state, () => refresh(container, state));
    refresh(container, state);
  }

  function refresh(container, state) {
    const entries = WealthData.getResearchLibrary();
    const tickers = Array.from(new Set(entries.map(e => e.ticker))).sort();

    const filteredTickers = ListControls.filterAndSort(tickers, {
      searchText: state.searchText,
      getSearchable: t => t
    });

    container.querySelector("#rl-controls-count").textContent = `${entries.length} ${entries.length === 1 ? "entry" : "entries"} across ${tickers.length} ${tickers.length === 1 ? "company" : "companies"}`;

    const tickerListEl = container.querySelector("#rl-ticker-list");
    tickerListEl.innerHTML = filteredTickers.length
      ? `<div class="ticket-tabs">${filteredTickers.map(t => `<button class="ticker-chip ${t===state.selectedTicker?'active':''}" data-ticker="${t}">${t} (${entries.filter(e=>e.ticker===t).length})</button>`).join("")}</div>`
      : `<div class="module-sub" style="font-style:italic;padding:12px 0;">No research entries yet. Add your first note above — for any ticker, even one you haven't added to Fundamentals, Portfolio, or Watchlist.</div>`;

    tickerListEl.querySelectorAll(".ticker-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        state.selectedTicker = btn.dataset.ticker;
        refresh(container, state);
      });
    });

    if (!state.selectedTicker && filteredTickers.length) state.selectedTicker = filteredTickers[0];

    const timelineEl = container.querySelector("#rl-timeline");
    if (!state.selectedTicker || !filteredTickers.includes(state.selectedTicker)) {
      timelineEl.innerHTML = "";
      return;
    }
    const tickerEntries = entries.filter(e => e.ticker === state.selectedTicker)
      .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));

    timelineEl.innerHTML = `
      <div class="section-head" style="margin-top:20px;"><span class="section-title" style="font-size:15px;">${state.selectedTicker} — knowledge base</span></div>
      <div class="card-list" style="display:flex;">
        ${tickerEntries.map(e => `
          <div class="data-card">
            <div class="data-card-title" style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
              <span>${e.title}</span>
              <span class="chip ${TYPE_COLOR[e.docType]||''}" style="font-family:var(--mono);font-size:10px;padding:3px 8px;border:1px solid var(--rule-bright);white-space:nowrap;">${e.docType}</span>
            </div>
            ${e.decision ? `<div class="data-card-row"><span class="k">Decision</span><span class="v">${e.decision}</span></div>` : ""}
            ${e.content ? `<div style="font-size:13px;color:var(--paper-dim);margin-top:8px;white-space:pre-wrap;">${e.content}</div>` : ""}
            <div class="module-sub" style="margin-top:10px;font-style:italic;">${new Date(e.addedAt).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'})}</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  return { render };
})();

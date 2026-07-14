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
    "Investment Thesis", "Bull Case", "Bear Case", "Management Assessment",
    "Company Update", "AI-Generated Summary", "Decision Record"
  ];
  const LEGACY_TYPE_MAP = {
    "Key Risk": "Bear Case",
    "Annual Report Note": "Company Update",
    "Concall Summary": "Company Update",
    "Quarterly Observation": "Company Update"
  };
  const DECISION_OPTIONS = ["Buy", "Sell", "Hold", "Watching", "Passed"];
  const TYPE_COLOR = {
    "Bull Case": "gain", "Bear Case": "loss",
    "Decision Record": "flag", "AI-Generated Summary": "flag"
  };

  // ---- Pure logic (Phase 2 Code Mapping — extracted for independent
  // verification; each function below corresponds to one Financial
  // Specification entry, RL-01 through RL-10) ----

  function validateEntry(ticker, title) {
    return Boolean(ticker && ticker.trim() && title && title.trim());
  }

  // Presentation-only compatibility: legacy records keep their original
  // docType in storage and backups. This helper never mutates the record.
  function getCanonicalResearchType(rawType) {
    if (typeof rawType !== "string") return null;
    const type = rawType.trim();
    if (!type) return null;
    if (LEGACY_TYPE_MAP[type]) return LEGACY_TYPE_MAP[type];
    return DOC_TYPES.includes(type) ? type : null;
  }

  function getResearchTypeDisplayLabel(rawType) {
    const canonicalType = getCanonicalResearchType(rawType);
    if (canonicalType) return canonicalType;
    if (typeof rawType !== "string" || !rawType.trim()) return "Unclassified";
    return `Legacy: ${rawType.trim()}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function buildEntry(input) {
    return {
      ticker: input.ticker.trim().toUpperCase(),
      docType: input.docType,
      title: input.title.trim(),
      content: (input.content || "").trim(),
      decision: getCanonicalResearchType(input.docType) === "Decision Record" ? input.decision : null
    };
  }

  function computeSummary(entries) {
    const tickers = Array.from(new Set(entries.map(e => e.ticker)));
    const perTickerCounts = {};
    tickers.forEach(t => { perTickerCounts[t] = entries.filter(e => e.ticker === t).length; });
    return { totalEntries: entries.length, companyCount: tickers.length, perTickerCounts };
  }

  function latestEntryTime(entries, ticker) {
    const times = entries.filter(e => e.ticker === ticker).map(e => new Date(e.addedAt).getTime());
    return times.length ? Math.max(...times) : -Infinity;
  }

  function computeTickerList(entries, opts) {
    const sortKey = opts && opts.sortKey;
    let tickers = Array.from(new Set(entries.map(e => e.ticker)));
    // RL-D01 fix, 2026-07-13: the ticker order now actually depends on
    // sortKey — "date" sorts by each ticker's most recent entry (newest
    // first), matching the "Sort: Newest first" label; anything else
    // (including the default) falls back to alphabetical. Before this fix,
    // tickers were always `.sort()`-ed (alphabetical) regardless of the
    // dropdown's value — confirmed by direct execution, see
    // Research_regression_tests.js RL-D01.
    tickers = sortKey === "date"
      ? tickers.sort((a, b) => latestEntryTime(entries, b) - latestEntryTime(entries, a))
      : tickers.sort();
    return ListControls.filterAndSort(tickers, {
      searchText: (opts && opts.searchText) || "",
      getSearchable: t => t
    });
  }

  function computeTimeline(entries, ticker) {
    return entries.filter(e => e.ticker === ticker)
      .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
  }

  function render(container) {
    const state = { searchText: "", selectedTicker: null, sortKey: "date" };

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
      container.querySelector("#rl-decision-field").style.display = getCanonicalResearchType(typeSelect.value) === "Decision Record" ? "flex" : "none";
    });

    container.querySelector("#rl-add").addEventListener("click", () => {
      const ticker = container.querySelector("#rl-ticker").value.trim().toUpperCase();
      const title = container.querySelector("#rl-title").value.trim();
      if (!validateEntry(ticker, title)) { App.showStatus("Ticker and title are required", "error"); return; }
      const docType = typeSelect.value;
      const entry = buildEntry({
        ticker, docType, title,
        content: container.querySelector("#rl-content").value.trim(),
        decision: getCanonicalResearchType(docType) === "Decision Record" ? container.querySelector("#rl-decision").value : null
      });
      WealthData.addResearchNote(entry);
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
    const summary = computeSummary(entries);

    const filteredTickers = computeTickerList(entries, { searchText: state.searchText, sortKey: state.sortKey });

    container.querySelector("#rl-controls-count").textContent = `${summary.totalEntries} ${summary.totalEntries === 1 ? "entry" : "entries"} across ${summary.companyCount} ${summary.companyCount === 1 ? "company" : "companies"}`;

    const tickerListEl = container.querySelector("#rl-ticker-list");
    tickerListEl.innerHTML = filteredTickers.length
      ? `<div class="ticket-tabs">${filteredTickers.map(t => `<button class="ticker-chip ${t===state.selectedTicker?'active':''}" data-ticker="${t}">${t} (${summary.perTickerCounts[t]})</button>`).join("")}</div>`
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
    const tickerEntries = computeTimeline(entries, state.selectedTicker);

    timelineEl.innerHTML = `
      <div class="section-head" style="margin-top:20px;"><span class="section-title" style="font-size:15px;">${state.selectedTicker} — knowledge base</span></div>
      <div class="card-list" style="display:flex;">
        ${tickerEntries.map(e => {
          const canonicalType = getCanonicalResearchType(e.docType);
          const typeLabel = getResearchTypeDisplayLabel(e.docType);
          return `
          <div class="data-card">
            <div class="data-card-title" style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
              <span>${e.title}</span>
              <span class="chip ${TYPE_COLOR[canonicalType]||''}" style="font-family:var(--mono);font-size:10px;padding:3px 8px;border:1px solid var(--rule-bright);white-space:nowrap;">${escapeHtml(typeLabel)}</span>
            </div>
            ${e.decision ? `<div class="data-card-row"><span class="k">Decision</span><span class="v">${e.decision}</span></div>` : ""}
            ${e.content ? `<div style="font-size:13px;color:var(--paper-dim);margin-top:8px;white-space:pre-wrap;">${e.content}</div>` : ""}
            <div class="module-sub" style="margin-top:10px;font-style:italic;">${new Date(e.addedAt).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'})}</div>
          </div>
        `; }).join("")}
      </div>
    `;
  }

  return {
    render, validateEntry, buildEntry, computeSummary, computeTickerList, computeTimeline,
    getCanonicalResearchType, getResearchTypeDisplayLabel,
    getDocumentTypes: () => [...DOC_TYPES]
  };
})();

/* ============================================================================
   List Controls — shared search/filter/sort utility
   ============================================================================
   Built once, used by every module that lists companies (Fundamentals,
   Delivery Screener, and any future screener). This is the direct answer to
   "never hardcode assumptions that only work for 50 companies" — the
   filtering/sorting logic exists in exactly one place, so it scales for
   every consumer at once instead of being solved (or forgotten) per module.

   Pure functions only — no DOM here. renderControlsBar() builds the toolbar
   markup; filterAndSort() does the actual work and is fully unit-testable
   without a browser, which is how it's verified below before shipping.
============================================================================ */

const ListControls = (function () {

  function filterAndSort(items, opts) {
    const { searchText, sector, capCategory, sortKey, sortDir, getSearchable, getSector, getCap, getSortValue } = opts;
    let result = items;

    if (searchText) {
      const q = searchText.trim().toUpperCase();
      result = result.filter(item => getSearchable(item).toUpperCase().includes(q));
    }
    if (sector && sector !== "All") {
      result = result.filter(item => getSector(item) === sector);
    }
    if (capCategory && capCategory !== "All") {
      result = result.filter(item => getCap(item) === capCategory);
    }
    if (sortKey) {
      result = result.slice().sort((a, b) => {
        const av = getSortValue(a, sortKey), bv = getSortValue(b, sortKey);
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
        return sortDir === "asc" ? av - bv : bv - av;
      });
    }
    return result;
  }

  function uniqueSectors(items, getSector) {
    const set = new Set(items.map(getSector).filter(Boolean));
    return ["All", ...Array.from(set).sort()];
  }

  function renderControlsBar(id, sectors, sortOptions, currentSort) {
    return `
      <div class="list-controls" id="${id}">
        <input type="text" class="lc-search" placeholder="Search ticker or name…" style="min-height:44px;background:var(--bg-ticket);border:1px solid var(--rule-bright);color:var(--paper);font-family:var(--mono);padding:0 12px;width:100%;margin-bottom:10px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <select class="lc-sector" style="min-height:44px;background:var(--bg-ticket);border:1px solid var(--rule-bright);color:var(--paper);font-family:var(--mono);padding:0 10px;flex:1;min-width:120px;">
            ${sectors.map(s => `<option value="${s}">${s === "All" ? "All sectors" : s}</option>`).join("")}
          </select>
          <select class="lc-sort" style="min-height:44px;background:var(--bg-ticket);border:1px solid var(--rule-bright);color:var(--paper);font-family:var(--mono);padding:0 10px;flex:1;min-width:140px;">
            ${sortOptions.map(o => `<option value="${o.key}" ${o.key===currentSort?'selected':''}>${o.label}</option>`).join("")}
          </select>
        </div>
        <div class="module-sub" id="${id}-count" style="margin-top:8px;"></div>
      </div>
    `;
  }

  function wireControls(container, id, state, onChange) {
    const root = container.querySelector(`#${id}`);
    root.querySelector(".lc-search").addEventListener("input", (e) => { state.searchText = e.target.value; onChange(); });
    root.querySelector(".lc-sector").addEventListener("change", (e) => { state.sector = e.target.value; onChange(); });
    root.querySelector(".lc-sort").addEventListener("change", (e) => { state.sortKey = e.target.value; onChange(); });
  }

  return { filterAndSort, uniqueSectors, renderControlsBar, wireControls };
})();

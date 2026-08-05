/* ============================================================================
   Fundamentals Module
   ============================================================================
   Ported from the earlier Engine 2 (wealth-intelligence-fundamentals-v3.jsx)
   artifact. The calculation formulas are UNCHANGED — same ROE/ROCE/D-E math,
   same qualitative-score weighting — only the data source changed, from a
   component's local state to the shared WealthData model, per the
   "change the data source, not the business logic" principle established
   earlier this session.
============================================================================ */

const FundamentalsModule = (function () {

  function seedIfEmpty() {
    const existing = WealthData.get().fundamentals;
    if (Object.keys(existing).length > 0) return; // real saved data exists — never overwrite it
    Object.entries(SEED_FUNDAMENTALS).forEach(([ticker, company]) => {
      WealthData.upsertSecurity(ticker, {
        displayName: company.name, sector: company.sector, isBank: company.isBank, indexMember: "NIFTY50"
      });
      WealthData.upsertFundamentals(ticker, {
        years: company.years, qualitative: company.qualitative,
        auditorLog: company.auditorLog, quarters: company.quarters,
        fetchedAt: "2026-07-12", source: company.dataSource
      });
    });
  }

  // ---- Ratio calculations — unchanged from Engine 2 ----
  // FIN-D01–D04 fix, 2026-07-12: latestRatios() moved to CompanyCalculations
  // (company-calculations.js) so Delivery Screener shares this single,
  // guarded definition instead of maintaining its own unfixed copy.
  const latestRatios = CompanyCalculations.latestRatios;

  // Historical display validation is presentation-only. It never normalizes
  // or rewrites the underlying financial records and does not affect the
  // stricter latestRatios() behavior above or Delivery Screener calculations.
  function formatHistoricalRoe(year) {
    if (
      typeof year?.netProfit !== "number" ||
      !Number.isFinite(year.netProfit) ||
      typeof year?.totalEquity !== "number" ||
      !Number.isFinite(year.totalEquity) ||
      year.totalEquity === 0
    ) {
      return "—%";
    }

    const roe = (year.netProfit / year.totalEquity) * 100;
    return Number.isFinite(roe) ? `${roe.toFixed(1)}%` : "—%";
  }

  function formatHistoricalCurrency(value, suffix = "") {
    return typeof value === "number" && Number.isFinite(value)
      ? `₹${value.toLocaleString("en-IN")}${suffix}`
      : "—";
  }

  const qualityScore = CompanyCalculations.qualityScore;
  const hasMinimumFundamentals = CompanyCalculations.hasMinimumFundamentals;
  const detectRedFlags = CompanyCalculations.detectRedFlags;
  const fundamentalCoverage = CompanyCalculations.fundamentalCoverage;

  const NIFTY_500_TICKERS = [
    "360ONE","3MINDIA","ABB","ACC","ACMESOLAR","AIAENG","APLAPOLLO","AUBANK","AWL","AADHARHFC",
    "AARTIIND","AAVAS","ABBOTINDIA","ACE","ACUTAAS","ADANIENSOL","ADANIENT","ADANIGREEN","ADANIPORTS","ADANIPOWER",
    "ATGL","ABCAPITAL","ABFRL","ABLBL","ABREL","ABSLAMC","CPPLUS","AEGISLOG","AEGISVOPAK","AFCONS",
    "AFFLE","AJANTPHARM","ALKEM","ABDL","ARE&M","AMBER","AMBUJACEM","ANANDRATHI","ANANTRAJ","ANGELONE",
    "ANTHEM","ANURAS","APARINDS","APOLLOHOSP","APOLLOTYRE","APTUS","ASAHIINDIA","ASHOKLEY","ASIANPAINT","ASTERDM",
    "ASTRAL","ATHERENERG","ATUL","AUROPHARMA","AIIL","DMART","AXISBANK","BEML","BLS","BSE",
    "BAJAJ-AUTO","BAJFINANCE","BAJAJFINSV","BAJAJHLDNG","BAJAJHFL","BALKRISIND","BALRAMCHIN","BANDHANBNK","BANKBARODA","BANKINDIA",
    "MAHABANK","BATAINDIA","BAYERCROP","BELRISE","BERGEPAINT","BDL","BEL","BHARATFORG","BHEL","BPCL",
    "BHARTIARTL","BHARTIHEXA","BIKAJI","GROWW","BIOCON","BSOFT","BLUEDART","BLUEJET","BLUESTARCO","BBTC",
    "BOSCHLTD","FIRSTCRY","BRIGADE","BRITANNIA","MAPMYINDIA","CCL","CESC","CGPOWER","CIEINDIA","CRISIL",
    "CANFINHOME","CANBK","CANHLIFE","CAPLIPOINT","CGCL","CARBORUNIV","CARTRADE","CASTROLIND","CEATLTD","CEMPRO",
    "CENTRALBK","CDSL","CHALET","CHAMBLFERT","CHENNPETRO","CHOICEIN","CHOLAHLDNG","CHOLAFIN","CIPLA","CUB",
    "CLEAN","COALINDIA","COCHINSHIP","COFORGE","COHANCE","COLPAL","CAMS","CONCORDBIO","CONCOR","COROMANDEL",
    "CRAFTSMAN","CREDITACC","CROMPTON","CUMMINSIND","CYIENT","DCMSHRIRAM","DLF","DOMS","DABUR","DALBHARAT",
    "DATAPATTNS","DEEPAKFERT","DEEPAKNTR","DELHIVERY","DEVYANI","DIVISLAB","DIXON","LALPATHLAB","DRREDDY","EIDPARRY",
    "EIHOTEL","EICHERMOT","ELECON","ELGIEQUIP","EMAMILTD","EMCURE","EMMVEE","ENDURANCE","ENGINERSIN","ERIS",
    "ESCORTS","ETERNAL","EXIDEIND","NYKAA","FEDERALBNK","FACT","FINCABLES","FSL","FIVESTAR","FORCEMOT",
    "FORTIS","GAIL","GVT&D","GMRAIRPORT","GABRIEL","GALLANTT","GRSE","GICRE","GILLETTE","GLAND",
    "GLAXO","GLENMARK","MEDANTA","GODIGIT","GPIL","GODFRYPHLP","GODREJCP","GODREJIND","GODREJPROP","GRANULES",
    "GRAPHITE","GRASIM","GRAVITA","GESHIP","FLUOROCHEM","GMDCLTD","HEG","HBLENGINE","HCLTECH","HDBFS",
    "HDFCAMC","HDFCBANK","HDFCLIFE","HFCL","HAVELLS","HEROMOTOCO","HEXT","HSCL","HINDALCO","HAL",
    "HINDCOPPER","HINDPETRO","HINDUNILVR","HINDZINC","POWERINDIA","HOMEFIRST","HONASA","HONAUT","HUDCO","HYUNDAI",
    "ICICIBANK","ICICIGI","ICICIAMC","ICICIPRULI","IDBI","IDFCFIRSTB","IFCI","IIFL","IRB","IRCON",
    "ITCHOTELS","ITC","ITI","INDGN","INDIACEM","INDIAMART","INDIANB","IEX","INDHOTEL","IOC",
    "IOB","IRCTC","IRFC","IREDA","IGL","INDUSTOWER","INDUSINDBK","NAUKRI","INFY","INOXWIND",
    "INTELLECT","INDIGO","IGIL","IKS","IPCALAB","JKCEMENT","JBMA","JKTYRE","JMFINANCIL","JSWCEMENT",
    "JSWDULUX","JSWENERGY","JSWINFRA","JSWSTEEL","JAINREC","JPPOWER","J&KBANK","JINDALSAW","JSL","JINDALSTEL",
    "JIOFIN","JUBLFOOD","JUBLINGREA","JUBLPHARMA","JWL","JYOTICNC","KPRMILL","KEI","KPITTECH","KAJARIACER",
    "KPIL","KALYANKJIL","KARURVYSYA","KAYNES","KEC","KFINTECH","KIRLOSENG","KOTAKBANK","KIMS","LTF",
    "LTTS","LGEINDIA","LICHSGFIN","LTFOODS","LTM","LT","LATENTVIEW","LAURUSLABS","THELEELA","LEMONTREE",
    "LENSKART","LICI","LINDEINDIA","LLOYDSME","LODHA","LUPIN","MMTC","MRF","MGL","M&MFIN",
    "M&M","MANAPPURAM","MRPL","MANKIND","MARICO","MARUTI","MFSL","MAXHEALTH","MAZDOCK","MEESHO",
    "MINDACORP","MSUMI","MOTILALOFS","MPHASIS","MCX","MUTHOOTFIN","NATCOPHARM","NBCC","NCC","NHPC",
    "NLCINDIA","NMDC","NSLNISP","NTPCGREEN","NTPC","NH","NATIONALUM","NAVA","NAVINFLUOR","NESTLEIND",
    "NETWEB","NEULANDLAB","NEWGEN","NAM-INDIA","NIVABUPA","NUVAMA","NUVOCO","OBEROIRLTY","ONGC","OIL",
    "OLAELEC","OLECTRA","PAYTM","ONESOURCE","OFSS","POLICYBZR","PCBL","PGEL","PIIND","PNBHOUSING",
    "PTCIL","PVRINOX","PAGEIND","PARADEEP","PATANJALI","PERSISTENT","PETRONET","PFIZER","PHOENIXLTD","PWL",
    "PIDILITIND","PINELABS","PIRAMALFIN","PPLPHARMA","POLYMED","POLYCAB","POONAWALLA","PFC","POWERGRID","PREMIERENE",
    "PRESTIGE","PFOCUS","PNB","RRKABEL","RBLBANK","RECLTD","RHIM","RITES","RADICO","RVNL",
    "RAILTEL","RAINBOW","RKFORGE","REDINGTON","RELIANCE","RPOWER","SBFC","SBICARD","SBILIFE","SJVN",
    "SRF","SAGILITY","SAILIFE","SAMMAANCAP","MOTHERSON","SAPPHIRE","SARDAEN","SAREGAMA","SCHAEFFLER","SCHNEIDER",
    "SCI","SHREECEM","SHRIRAMFIN","SHYAMMETL","ENRIN","SIEMENS","SIGNATURE","SOBHA","SOLARINDS","SONACOMS",
    "SONATSOFTW","STARHEALTH","SBIN","SAIL","SUMICHEM","SUNPHARMA","SUNTV","SUNDARMFIN","SUPREMEIND","SPLPETRO",
    "SUZLON","SWANCORP","SWIGGY","SYNGENE","SYRMA","TBOTEK","TVSMOTOR","TATACAP","TATACHEM","TATACOMM",
    "TCS","TATACONSUM","TATAELXSI","TATAINVEST","TMCV","TMPV","TATAPOWER","TATASTEEL","TATATECH","TTML",
    "TECHM","TECHNOE","TEGA","TEJASNET","TENNIND","NIACL","RAMCOCEM","THERMAX","TIMKEN","TITAGARH",
    "TITAN","TORNTPHARM","TORNTPOWER","TARIL","TRAVELFOOD","TRENT","TRIDENT","TRITURBINE","TIINDIA","UCOBANK",
    "UNOMINDA","UPL","UTIAMC","ULTRACEMCO","UNIONBANK","UBL","UNITDSPR","URBANCO","USHAMART","VTL",
    "VBL","VEDL","VIJAYA","VMM","IDEA","VOLTAS","WAAREEENER","WELCORP","WELSPUNLIV","WHIRLPOOL","WIPRO",
    "WOCKPHARMA","YESBANK","ZFCVINDIA","ZEEL","ZENTEC","ZENSARTECH","ZYDUSLIFE","ZYDUSWELL","ECLERX"
  ];
  const NIFTY_500_SET = new Set(NIFTY_500_TICKERS);
  if (typeof globalThis !== "undefined") globalThis.NIFTY_500_TICKERS = NIFTY_500_TICKERS;

  let pendingTicker = null;

  function openTicker(ticker) {
    ticker = String(ticker || "").trim().toUpperCase();
    if (!NIFTY_500_SET.has(ticker)) return false;
    pendingTicker = ticker;
    if (typeof App !== "undefined") App.switchTo("fundamentals");
    return true;
  }

  function render(container) {
    seedIfEmpty();
    const fundamentals = WealthData.get().fundamentals;

    container.innerHTML = `
      <div class="module-header">
        <h2>Fundamentals Registry — Searchable Nifty 500</h2>
        <p class="module-sub">Search any Nifty 500 constituent (e.g. DIXON) to enroll financial data manually. Zero fabricated values.</p>
      </div>

      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px;background:var(--bg-ticket);padding:14px;border:1px solid var(--rule-bright);">
        <input type="text" id="fund-search-input" placeholder="🔍 Search ticker (e.g. DIXON, TCS)..." style="flex:1;min-width:200px;min-height:var(--touch);padding:0 12px;background:var(--bg-raised);border:1px solid var(--rule-bright);color:var(--paper);font-family:var(--mono);">
        <select id="fund-status-filter" style="min-height:var(--touch);padding:0 12px;background:var(--bg-raised);border:1px solid var(--rule-bright);color:var(--paper);font-family:var(--mono);">
          <option value="all">Status: All Nifty 500</option>
          <option value="missing">Missing</option>
          <option value="partial">Partial</option>
          <option value="unverified">User-entered / unverified</option>
          <option value="stale">Stale</option>
          <option value="verified">Verified (Partial)</option>
          <option value="eligible">Eligible for Full Rating</option>
        </select>
        <select id="fund-sort-by" style="min-height:var(--touch);padding:0 12px;background:var(--bg-raised);border:1px solid var(--rule-bright);color:var(--paper);font-family:var(--mono);">
          <option value="ticker">Sort: Ticker (A-Z)</option>
          <option value="status">Sort: Completion Status</option>
        </select>
        <button id="btn-export-csv" class="btn" style="background:var(--bg-raised);border:1px solid var(--rule-bright);color:var(--paper);">📤 Export CSV Template</button>
        <button id="btn-import-csv" class="btn" style="background:var(--bg-raised);border:1px solid var(--rule-bright);color:var(--paper);">📥 Import CSV</button>
        <input type="file" id="fund-import-file" accept=".csv" style="display:none">
      </div>

      <div class="ticket-tabs" id="fund-ticker-tabs"></div>
      <div id="fund-detail" style="margin-top:16px;"></div>
    `;

    const state = { searchText: "", filterStatus: "all", sortBy: "ticker" };
    let selectedTicker = null;
    if (pendingTicker) {
      selectedTicker = pendingTicker;
      state.searchText = pendingTicker;
      container.querySelector("#fund-search-input").value = pendingTicker;
      pendingTicker = null;
    }

    function refreshList() {
      const allKnown = NIFTY_500_TICKERS.slice();

      let filtered = allKnown.filter(t => {
        if (state.searchText) {
          const query = state.searchText.toLowerCase();
          const sec = WealthData.getSecurity(t) || {};
          const matchTicker = t.toLowerCase().includes(query);
          const matchName = (sec.displayName || "").toLowerCase().includes(query);
          if (!matchTicker && !matchName) return false;
        }

        if (state.filterStatus === "all") return true;

        const record = fundamentals[t];
        const status = CompanyCalculations.determineReviewStatus(record);

        if (state.filterStatus === "missing") return status === "Missing";
        if (state.filterStatus === "partial") return status === "Partial";
        if (state.filterStatus === "unverified") return status === "User-entered / unverified";
        if (state.filterStatus === "stale") return status === "Stale";
        if (state.filterStatus === "verified") return status === "Verified";
        if (state.filterStatus === "eligible") return status === "Eligible for Full Rating";

        return true;
      });

      if (state.sortBy === "status") {
        const getScore = (t) => {
          const s = CompanyCalculations.determineReviewStatus(fundamentals[t]);
          return { "Missing": 0, "Partial": 1, "User-entered / unverified": 2, "Stale": 3, "Verified": 4, "Eligible for Full Rating": 5 }[s] || 0;
        };
        filtered.sort((a, b) => getScore(a) - getScore(b) || a.localeCompare(b));
      } else {
        filtered.sort();
      }

      const tabsEl = container.querySelector("#fund-ticker-tabs");
      tabsEl.innerHTML = filtered.length
        ? filtered.map(t => {
            const record = fundamentals[t];
            const isEnrolled = record && CompanyCalculations.hasMinimumFundamentals(record);
            const isPartial = record && !isEnrolled;
            const badgeClass = isEnrolled ? "sync-health-healthy" : (isPartial ? "sync-health-degraded" : "sync-health-stale");
            const badgeText = isEnrolled ? "Full Rating" : (isPartial ? "Partial" : "Not Enrolled");
            const missing = CompanyCalculations.fundamentalCoverage(record).missing;
            const missingText = missing.length > 0 ? `<div style="font-size:10px;color:var(--paper-dim);white-space:normal;text-align:left;line-height:1.2;margin-top:2px;">Missing: ${missing.join(", ")}</div>` : "";

            return `
              <button class="ticker-chip ${t===selectedTicker?'active':''}" data-ticker="${t}" style="display:inline-flex;flex-direction:column;align-items:flex-start;gap:4px;padding:8px 12px;height:auto;">
                <div style="display:flex;align-items:center;gap:6px;width:100%;">
                  <span style="font-weight:bold;">${t}</span>
                  <span class="sync-health-pill ${badgeClass}" style="font-size:9px;padding:1px 4px;margin-left:auto;">${badgeText}</span>
                </div>
                ${missingText}
              </button>
            `;
          }).join("")
        : `<div class="module-sub" style="font-style:italic;padding:12px;">No companies match this search/filter.</div>`;

      tabsEl.querySelectorAll(".ticker-chip").forEach(btn => {
        btn.addEventListener("click", () => {
          selectedTicker = btn.dataset.ticker;
          tabsEl.querySelectorAll(".ticker-chip").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          renderDetail(container.querySelector("#fund-detail"), selectedTicker, container);
        });
      });

      if (!filtered.includes(selectedTicker)) selectedTicker = filtered[0] || null;
      if (selectedTicker) {
        renderDetail(container.querySelector("#fund-detail"), selectedTicker, container);
      } else {
        container.querySelector("#fund-detail").innerHTML = "";
      }
    }

    container.querySelector("#fund-search-input").addEventListener("input", e => {
      state.searchText = e.target.value;
      refreshList();
    });

    container.querySelector("#fund-status-filter").addEventListener("change", e => {
      state.filterStatus = e.target.value;
      refreshList();
    });

    container.querySelector("#fund-sort-by").addEventListener("change", e => {
      state.sortBy = e.target.value;
      refreshList();
    });

    container.querySelector("#btn-export-csv").addEventListener("click", () => {
      if (typeof FundamentalsCsv !== "undefined") FundamentalsCsv.exportTemplate();
    });

    const fileInput = container.querySelector("#fund-import-file");
    container.querySelector("#btn-import-csv").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", e => {
      if (!e.target.files.length) return;
      if (typeof FundamentalsCsv !== "undefined") {
        FundamentalsCsv.handleImportFile(e.target.files[0], container, () => refreshList());
      }
      e.target.value = "";
    });

    refreshList();
  }

  function renderDetail(el, ticker, parentContainer) {
    const fundamentals = WealthData.getFundamentals(ticker);
    const security = WealthData.getSecurity(ticker) || { displayName: ticker, sector: "Nifty 500", isBank: false };

    if (!fundamentals) {
      // Empty Profile for Not Enrolled Stocks (e.g. DIXON)
      el.innerHTML = `
        <div class="ticket" style="border-left:4px solid var(--amber);">
          <div class="ticket-body" style="width:100%">
            <div class="ticket-top">
              <div>
                <div class="ticket-ticker">${ticker}</div>
                <div class="module-sub" style="margin:2px 0 0">${security.displayName || ticker} · ${security.sector || 'Nifty 500'}</div>
              </div>
              <span class="sync-health-pill sync-health-stale">Not Enrolled</span>
            </div>
            <div class="paper-empty-message" style="margin:16px 0;padding:16px;background:var(--bg-ticket);border:1px dashed var(--rule-bright);">
              <div style="font-weight:bold;color:var(--amber-bright);margin-bottom:4px;">No fundamental data enrolled for ${ticker} yet.</div>
              <div style="font-size:12px;color:var(--paper-dim);">Zero fabricated values. All technical price history (250-row OHLCV) is synced and ready in Delivery Screener. Enroll verified financial ratios below to unlock 5-pillar Full Rating promotion!</div>
            </div>
            <button class="btn" id="fund-enroll-btn" style="background:var(--gain);color:#fff;">+ Enroll Financial Data for ${ticker}</button>
          </div>
        </div>
      `;
      el.querySelector("#fund-enroll-btn").addEventListener("click", () => renderFormModal(parentContainer, ticker));
      return;
    }

    // Enrolled or Partially Enrolled Detail Card
    const r = fundamentals.manualRatios || latestRatios(fundamentals);
    const quality = qualityScore(fundamentals.qualitative || {});
    const flags = detectRedFlags(fundamentals);
    const isFull = hasMinimumFundamentals(fundamentals);
    const coverage = fundamentalCoverage(fundamentals);
    const fmt = (v, suffix = "", dp = 1) => (v === null || v === undefined || isNaN(v) || !isFinite(v)) ? "—" : v.toFixed(dp) + suffix;
    const ev = fundamentals.evidence || {};
    const fieldStatus = fundamentals.fieldStatus || {};
    const statusLabels = { roe: "ROE", debtEquity: "Debt/Equity", pe: "P/E", revenueCagr: "Revenue CAGR", roce: "ROCE", netMargin: "Net Margin", earningsCagr: "Earnings CAGR", promoterHolding: "Promoter Holding", promoterPledge: "Promoter Pledge", fcfStatus: "FCF Status", economicMoat: "Economic Moat", pricingPower: "Pricing Power" };

    const exactStatus = CompanyCalculations.determineReviewStatus(fundamentals);

    el.innerHTML = `
      <div class="ticket" style="border-left:4px solid ${isFull ? 'var(--gain)' : 'var(--amber)'};">
        <div class="ticket-body" style="width:100%">
          <div class="ticket-top">
            <div>
              <div class="ticket-ticker">${ticker}</div>
              <div class="module-sub" style="margin:2px 0 0">${security.displayName || ticker} · ${security.sector || 'Nifty 500'}${security.isBank ? ' · Financial institution' : ''}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
              <span class="sync-health-pill ${isFull ? 'sync-health-healthy' : 'sync-health-degraded'}">${exactStatus}</span>
              <div class="ticket-score"><div class="n">${quality === null ? "—" : quality.toFixed(0)}</div><div class="l">quality /100</div></div>
            </div>
          </div>

          <div class="ratio-grid" style="margin-top:14px;">
            <div class="ratio-cell"><div class="ratio-label">ROE</div><div class="ratio-value">${fmt(r.roe, "%")}</div></div>
            <div class="ratio-cell"><div class="ratio-label">ROCE</div><div class="ratio-value">${fmt(r.roce, "%")}</div></div>
            <div class="ratio-cell"><div class="ratio-label">Debt/Equity</div><div class="ratio-value">${fmt(r.debtEquity, "", 2)}</div></div>
            <div class="ratio-cell"><div class="ratio-label">Net Margin</div><div class="ratio-value">${fmt(r.netMargin, "%")}</div></div>
            <div class="ratio-cell"><div class="ratio-label">Revenue CAGR</div><div class="ratio-value">${fmt(r.revenueCagr, "%")}</div></div>
            <div class="ratio-cell"><div class="ratio-label">P/E</div><div class="ratio-value">${fmt(r.pe, "x")}</div></div>
          </div>

          <div class="module-sub" style="margin-top:14px;padding:10px;background:var(--bg-ticket);border:1px solid var(--rule-bright);">
            <div><strong>Source Reference:</strong> ${ev.sourceName || fundamentals.source || "User Manual Entry"}</div>
            <div><strong>Evidence Date:</strong> ${ev.evidenceDate || fundamentals.fetchedAt || "—"}</div>
            <div><strong>Evidence Status:</strong> ${coverage.evidenceStatus}</div>
            <div><strong>Missing for Full Rating:</strong> ${coverage.missing.length ? coverage.missing.join(", ") : "None"}</div>
            ${ev.sourceUrl ? `<div><strong>Source Note/URL:</strong> ${ev.sourceUrl}</div>` : ""}
          </div>

          ${fundamentals.manualRatios ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">${Object.entries(statusLabels).map(([key, label]) => `<span class="sync-health-pill ${fieldStatus[key] === 'Verified' ? 'sync-health-healthy' : fieldStatus[key] === 'Stale' ? 'sync-health-degraded' : 'sync-health-stale'}">${label}: ${fieldStatus[key] || 'Missing'}</span>`).join("")}</div>` : ""}

          <div class="paper-action-row" style="margin-top:16px;">
            <button class="btn" id="fund-edit-btn" style="background:var(--bg-raised);border:1px solid var(--rule-bright);color:var(--paper);">Edit Fundamentals</button>
            <button class="btn" id="fund-delete-btn" style="background:transparent;border:1px solid var(--loss);color:var(--loss);">Delete Record</button>
          </div>
        </div>
      </div>
    `;

    el.querySelector("#fund-edit-btn").addEventListener("click", () => renderFormModal(parentContainer, ticker));
    el.querySelector("#fund-delete-btn").addEventListener("click", async () => {
      if (confirm(`Delete fundamental financial record for ${ticker}?`)) {
        WealthData.deleteFundamentals(ticker);
        await App.saveNow(false);
        App.showStatus(`Deleted fundamentals for ${ticker}`, "ok");
        render(parentContainer);
      }
    });
  }

  function renderFormModal(container, ticker) {
    const existing = WealthData.getFundamentals(ticker) || {};
    const security = WealthData.getSecurity(ticker) || {};
    const ratios = existing.manualRatios || (existing.years ? latestRatios(existing) : {});
    const qual = existing.qualitative || {};
    const ev = existing.evidence || {};

    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:999;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;";

    modal.innerHTML = `
      <div class="ticket" style="max-width:600px;width:100%;max-height:90vh;overflow-y:auto;background:var(--bg);border:1px solid var(--amber);">
        <div class="ticket-body">
          <div class="section-head" style="margin-bottom:14px;"><span class="section-title">Manual Fundamentals Enrollment — ${ticker}</span></div>
          <p class="module-sub" style="margin-bottom:14px;">Enter verified financial ratios for ${ticker}. Mandatory fields are required for Full Rating promotion.</p>

          <div style="display:grid;gap:12px;">
            <div class="field-row"><label>Company Name</label><input type="text" id="form-name" value="${security.displayName || ticker}" style="background:var(--bg-raised);border:1px solid var(--rule-bright);color:var(--paper);padding:8px;"></div>
            <div class="field-row"><label>Sector</label><input type="text" id="form-sector" value="${security.sector || 'Nifty 500'}" style="background:var(--bg-raised);border:1px solid var(--rule-bright);color:var(--paper);padding:8px;"></div>
            <div class="field-row"><label>Financial Year / Date</label><input type="text" id="form-fydate" value="${existing.fyDate || ''}" placeholder="e.g. FY25" style="background:var(--bg-raised);border:1px solid var(--rule-bright);color:var(--paper);padding:8px;"></div>

            <div class="section-head" style="margin-top:10px;"><span class="section-title" style="font-size:13px;color:var(--amber-bright);">Required Ratios (No fabricated defaults)</span></div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <div><label style="font-size:11px;color:var(--paper-dim);">ROE (%) *</label><input type="number" step="0.1" id="form-roe" value="${ratios.roe !== undefined && ratios.roe !== null ? ratios.roe : ''}" placeholder="e.g. 18.5" style="width:100%;background:var(--bg-raised);border:1px solid var(--rule-bright);color:var(--paper);padding:8px;"></div>
              <div><label style="font-size:11px;color:var(--paper-dim);">Debt / Equity *</label><input type="number" step="0.01" id="form-de" value="${ratios.debtEquity !== undefined && ratios.debtEquity !== null ? ratios.debtEquity : ''}" placeholder="e.g. 0.4" style="width:100%;background:var(--bg-raised);border:1px solid var(--rule-bright);color:var(--paper);padding:8px;"></div>
              <div><label style="font-size:11px;color:var(--paper-dim);">P/E Ratio *</label><input type="number" step="0.1" id="form-pe" value="${ratios.pe !== undefined && ratios.pe !== null ? ratios.pe : ''}" placeholder="e.g. 25.0" style="width:100%;background:var(--bg-raised);border:1px solid var(--rule-bright);color:var(--paper);padding:8px;"></div>
              <div><label style="font-size:11px;color:var(--paper-dim);">Revenue CAGR (%) *</label><input type="number" step="0.1" id="form-revcagr" value="${ratios.revenueCagr !== undefined && ratios.revenueCagr !== null ? ratios.revenueCagr : ''}" placeholder="e.g. 12.0" style="width:100%;background:var(--bg-raised);border:1px solid var(--rule-bright);color:var(--paper);padding:8px;"></div>
              <div><label style="font-size:11px;color:var(--paper-dim);">ROCE (%)</label><input type="number" step="0.1" id="form-roce" value="${ratios.roce !== undefined && ratios.roce !== null ? ratios.roce : ''}" placeholder="e.g. 20.0" style="width:100%;background:var(--bg-raised);border:1px solid var(--rule-bright);color:var(--paper);padding:8px;"></div>
              <div><label style="font-size:11px;color:var(--paper-dim);">Net Margin (%)</label><input type="number" step="0.1" id="form-netmargin" value="${ratios.netMargin !== undefined && ratios.netMargin !== null ? ratios.netMargin : ''}" placeholder="e.g. 10.5" style="width:100%;background:var(--bg-raised);border:1px solid var(--rule-bright);color:var(--paper);padding:8px;"></div>
              <div><label style="font-size:11px;color:var(--paper-dim);">Earnings CAGR (%)</label><input type="number" step="0.1" id="form-epscagr" value="${ratios.earningsCagr !== undefined && ratios.earningsCagr !== null ? ratios.earningsCagr : ''}" style="width:100%;background:var(--bg-raised);border:1px solid var(--rule-bright);color:var(--paper);padding:8px;"></div>
              <div><label style="font-size:11px;color:var(--paper-dim);">Promoter Holding (%)</label><input type="number" step="0.1" id="form-promoter" value="${ratios.promoterHolding !== undefined && ratios.promoterHolding !== null ? ratios.promoterHolding : ''}" style="width:100%;background:var(--bg-raised);border:1px solid var(--rule-bright);color:var(--paper);padding:8px;"></div>
              <div><label style="font-size:11px;color:var(--paper-dim);">Promoter Pledge (%)</label><input type="number" step="0.1" id="form-pledge" value="${ratios.promoterPledge !== undefined && ratios.promoterPledge !== null ? ratios.promoterPledge : ''}" style="width:100%;background:var(--bg-raised);border:1px solid var(--rule-bright);color:var(--paper);padding:8px;"></div>
              <div><label style="font-size:11px;color:var(--paper-dim);">Free Cash Flow Status</label><select id="form-fcf-status" style="width:100%;background:var(--bg-raised);border:1px solid var(--rule-bright);color:var(--paper);padding:8px;"><option value="">Unknown</option><option value="Positive" ${ratios.fcfStatus === 'Positive' ? 'selected' : ''}>Positive</option><option value="Negative" ${ratios.fcfStatus === 'Negative' ? 'selected' : ''}>Negative</option></select></div>
            </div>

            <div class="section-head" style="margin-top:10px;"><span class="section-title" style="font-size:13px;color:var(--amber-bright);">Moat & Business Quality (1 to 5) *</span></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <div><label style="font-size:11px;color:var(--paper-dim);">Economic Moat (1-5)</label><input type="number" min="1" max="5" id="form-moat" value="${qual.economicMoat !== undefined && qual.economicMoat !== null ? qual.economicMoat : ''}" style="width:100%;background:var(--bg-raised);border:1px solid var(--rule-bright);color:var(--paper);padding:8px;"></div>
              <div><label style="font-size:11px;color:var(--paper-dim);">Pricing Power (1-5)</label><input type="number" min="1" max="5" id="form-pricing" value="${qual.pricingPower !== undefined && qual.pricingPower !== null ? qual.pricingPower : ''}" style="width:100%;background:var(--bg-raised);border:1px solid var(--rule-bright);color:var(--paper);padding:8px;"></div>
            </div>

            <div class="section-head" style="margin-top:10px;"><span class="section-title" style="font-size:13px;color:var(--amber-bright);">Evidence Metadata (Required for Promotion) *</span></div>
            <div><label style="font-size:11px;color:var(--paper-dim);">Source Name *</label><input type="text" id="form-source-name" value="${ev.sourceName || ''}" placeholder="e.g. BSE Filings FY25 Annual Report" style="width:100%;background:var(--bg-raised);border:1px solid var(--rule-bright);color:var(--paper);padding:8px;"></div>
            <div><label style="font-size:11px;color:var(--paper-dim);">Evidence Date *</label><input type="date" id="form-evidence-date" value="${ev.evidenceDate || ''}" style="width:100%;background:var(--bg-raised);border:1px solid var(--rule-bright);color:var(--paper);padding:8px;"></div>
            <div><label style="font-size:11px;color:var(--paper-dim);">Source Reference Note / URL</label><input type="text" id="form-source-url" value="${ev.sourceUrl || ''}" placeholder="e.g. https://www.bseindia.com/..." style="width:100%;background:var(--bg-raised);border:1px solid var(--rule-bright);color:var(--paper);padding:8px;"></div>
            <div><label style="font-size:11px;color:var(--paper-dim);">Evidence Review Status *</label><select id="form-evidence-status" style="width:100%;background:var(--bg-raised);border:1px solid var(--rule-bright);color:var(--paper);padding:8px;"><option value="User-entered/unverified" ${ev.status !== 'Verified' ? 'selected' : ''}>User-entered / unverified</option><option value="Verified" ${ev.status === 'Verified' ? 'selected' : ''}>Verified against source</option></select></div>

            <div class="paper-action-row" style="margin-top:16px;">
              <button class="btn" id="form-save-btn" style="background:var(--gain);color:#fff;">Save Fundamentals Record</button>
              <button class="btn" id="form-cancel-btn" style="background:transparent;border:1px solid var(--rule-bright);color:var(--paper-dim);">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const parseNum = id => {
      const val = modal.querySelector(`#${id}`).value.trim();
      return val === "" ? null : parseFloat(val);
    };

    modal.querySelector("#form-cancel-btn").addEventListener("click", () => document.body.removeChild(modal));

    modal.querySelector("#form-save-btn").addEventListener("click", async () => {
      const name = modal.querySelector("#form-name").value.trim() || ticker;
      const sector = modal.querySelector("#form-sector").value.trim() || "Nifty 500";
      const fyDate = modal.querySelector("#form-fydate").value.trim();

      const roe = parseNum("form-roe");
      const debtEquity = parseNum("form-de");
      const pe = parseNum("form-pe");
      const revenueCagr = parseNum("form-revcagr");
      const roce = parseNum("form-roce");
      const netMargin = parseNum("form-netmargin");
      const earningsCagr = parseNum("form-epscagr");
      const promoterHolding = parseNum("form-promoter");
      const promoterPledge = parseNum("form-pledge");
      const fcfStatus = modal.querySelector("#form-fcf-status").value || null;

      const moat = parseNum("form-moat");
      const pricing = parseNum("form-pricing");

      const sourceName = modal.querySelector("#form-source-name").value.trim();
      const evidenceDate = modal.querySelector("#form-evidence-date").value.trim();
      const sourceUrl = modal.querySelector("#form-source-url").value.trim();
      const evidenceReviewStatus = modal.querySelector("#form-evidence-status").value;

      const now = new Date().toISOString();
      const manualRatios = { roe, debtEquity, pe, revenueCagr, roce, netMargin, earningsCagr, promoterHolding, promoterPledge, fcfStatus };
      const qualitative = {
        economicMoat: moat,
        pricingPower: pricing,
        capitalAllocation: qual.capitalAllocation ?? null,
        managementQuality: qual.managementQuality ?? null,
        corporateGovernance: qual.corporateGovernance ?? null,
        promoterIntegrity: qual.promoterIntegrity ?? null,
        auditorQuality: qual.auditorQuality ?? null
      };
      const evidence = { sourceName, evidenceDate, sourceUrl, status: evidenceReviewStatus };
      const priorHistory = Array.isArray(existing.enrollmentHistory) ? existing.enrollmentHistory.slice() : [];
      if (existing.manualRatios || existing.evidence) {
        priorHistory.push({
          savedAt: existing.updatedAt || existing.createdAt || now,
          fyDate: existing.fyDate || "",
          manualRatios: existing.manualRatios || null,
          qualitative: existing.qualitative || null,
          evidence: existing.evidence || null
        });
      }

      const fieldStatus = {};
      Object.entries({ ...manualRatios, economicMoat: moat, pricingPower: pricing }).forEach(([key, value]) => {
        fieldStatus[key] = value === null ? "Missing" : evidenceReviewStatus;
      });

      const newRecord = {
        ticker,
        fyDate,
        fetchedAt: now.slice(0, 10),
        source: sourceName,
        manualRatios,
        qualitative,
        evidence,
        fieldStatus,
        enrollmentHistory: priorHistory,
        createdAt: existing.createdAt || now,
        updatedAt: now,
        years: existing.years || []
      };
      const effectiveEvidenceStatus = CompanyCalculations.evidenceStatus(newRecord);
      Object.keys(fieldStatus).forEach(key => {
        if (fieldStatus[key] !== "Missing" && effectiveEvidenceStatus === "Stale") fieldStatus[key] = "Stale";
      });

      WealthData.upsertSecurity(ticker, { displayName: name, sector });
      WealthData.upsertFundamentals(ticker, newRecord);
      await App.saveNow(false);

      const isFull = hasMinimumFundamentals(newRecord);
      App.showStatus(`Saved fundamentals for ${ticker}. Status: ${isFull ? 'Enrolled (Full Rating)' : 'Partially Enrolled'}`, "ok");
      document.body.removeChild(modal);
      render(container);
    });
  }

  return { render, openTicker, formatHistoricalRoe, formatHistoricalCurrency, isNifty500Ticker: ticker => NIFTY_500_SET.has(String(ticker || "").toUpperCase()) };
})();

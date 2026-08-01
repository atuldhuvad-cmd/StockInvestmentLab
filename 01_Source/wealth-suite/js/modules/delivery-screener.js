/* ============================================================================
   Delivery Screener Module
   ============================================================================
   Implements delivery-screener-methodology.md EXACTLY — every formula here
   should be traceable line-for-line back to that document. If they diverge,
   the document is wrong or this file is wrong; they are never allowed to
   silently drift apart.

   Purpose: "Which companies deserve my research this week?" — not a buy/sell
   signal. Ranks companies with fundamentals data (Standalone Value Rule: a
   company with zero inputs can't be ranked, that's a ranking decision, not
   an error). Technical Trend pillar is "Not available" for everyone right
   now — there is no price-history data source in this app yet, and
   presenting synthetic technical output as if real would be dishonest.
============================================================================ */

const DeliveryScreenerModule = (function () {

  const PILLAR_WEIGHTS = { businessQuality: 0.25, financialStrength: 0.25, valuation: 0.20, technicalTrend: 0.15, risk: 0.15 };
  const PAPER_SECTIONS = [
    ["summary", "Summary"],
    ["portfolio", "Paper Portfolio"],
    ["transactions", "Transactions"],
    ["performance", "Performance Review"]
  ];
  let activePaperSection = "summary";
  let paperContainer = null;
  let showCapitalConfig = false;
  let pendingBuyTicker = null;
  let pendingSellTicker = null;
  let submitting = false;
  const recentPaperQuotes = {};

  function scoreBand(value, points) {
    if (value === null || value === undefined) return null;
    if (value <= points[0][0]) return points[0][1];
    if (value >= points[points.length - 1][0]) return points[points.length - 1][1];
    for (let i = 0; i < points.length - 1; i++) {
      const [x1, y1] = points[i], [x2, y2] = points[i + 1];
      if (value >= x1 && value <= x2) return y1 + (y2 - y1) * (value - x1) / (x2 - x1);
    }
    return null;
  }
  const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

  // ---- Pillar 1: Business Quality — qualitative rating, unchanged from Fundamentals ----
  function businessQualityPillar(qualitative) {
    const score = CompanyCalculations.qualityScore(qualitative);
    // FIN-D05 fix, 2026-07-12 (Delivery Screener Phase 3): each factor now
    // guarded individually — a missing field produces score: null (correctly
    // excluded downstream by rankStrengthsAndRisks()'s `!== null` filter)
    // instead of NaN (which passed that same filter, since NaN !== null is
    // true in JavaScript, and could surface as a nonsensical Top Strength/Risk).
    const factorScore = (v) => (v === undefined || v === null || isNaN(v)) ? null : (v / 5) * 100;
    const subFactors = [
      { label: "Economic moat", score: factorScore(qualitative.economicMoat) },
      { label: "Pricing power", score: factorScore(qualitative.pricingPower) },
      { label: "Capital allocation", score: factorScore(qualitative.capitalAllocation) },
      { label: "Management quality", score: factorScore(qualitative.managementQuality) },
      { label: "Corporate governance", score: factorScore(qualitative.corporateGovernance) },
      { label: "Promoter integrity", score: factorScore(qualitative.promoterIntegrity) },
      { label: "Auditor quality", score: factorScore(qualitative.auditorQuality) }
    ];
    return { score, subFactors };
  }

  // ---- Pillar 2: Financial Strength — ROE, ROCE, D/E ----
  function financialStrengthPillar(ratios) {
    const roeScore = scoreBand(ratios.roe, [[0,0],[10,40],[15,65],[20,85],[30,100]]);
    const roceScore = ratios.roce !== null ? scoreBand(ratios.roce, [[0,0],[10,35],[15,60],[20,85],[30,100]]) : 50;
    const deScore = ratios.debtEquity !== null ? scoreBand(ratios.debtEquity, [[0,100],[0.3,85],[0.6,60],[1,35],[2,10]]) : 50;
    const score = (roeScore + roceScore + deScore) / 3;
    const subFactors = [
      { label: `ROE ${ratios.roe !== null ? ratios.roe.toFixed(1)+'%' : '—'}`, score: roeScore },
      { label: `ROCE ${ratios.roce !== null ? ratios.roce.toFixed(1)+'%' : '—'}`, score: roceScore },
      { label: `Debt/Equity ${ratios.debtEquity !== null ? ratios.debtEquity.toFixed(2) : '—'}`, score: deScore }
    ];
    return { score, subFactors };
  }

  // ---- Pillar 3: Valuation — Fair Value Gap, per the documented heuristic ----
  function valuationPillar(ratios, qualityScore) {
    if (ratios.pe === null || ratios.pe <= 0) {
      return { score: 50, gapPct: null, subFactors: [{ label: "P/E not available", score: 50 }] };
    }
    const reasonablePE = clamp(10 + (ratios.revenueCagr || 0) * 0.8 + (qualityScore - 50) * 0.15, 8, 45);
    const gapPct = (reasonablePE - ratios.pe) / ratios.pe * 100;
    const score = scoreBand(gapPct, [[-50,10],[-20,30],[0,55],[20,80],[50,100]]);
    return {
      score, gapPct, reasonablePE,
      subFactors: [
        { label: `Actual P/E ${ratios.pe.toFixed(1)}x`, score: null },
        { label: `Reasonable P/E (est.) ${reasonablePE.toFixed(1)}x`, score: null },
        { label: `Fair value gap ${gapPct >= 0 ? '+' : ''}${gapPct.toFixed(1)}%`, score }
      ]
    };
  }

  // ---- Pillar 4: Technical Trend — evaluated only from imported OHLCV ----
  function technicalTrendPillar(ticker) {
    const symbol = PriceHistory.normalizeSymbol(ticker);
    const record = WealthData.getPriceHistory(symbol);
    const analysis = PriceHistory.calculate(record && Array.isArray(record.rows) ? record.rows : []);
    const available = analysis.coverage === "Complete";
    return {
      score: available ? analysis.score : null,
      available,
      coverage: analysis.coverage,
      status: analysis.status,
      rowCount: analysis.rowCount,
      latestDate: analysis.latestDate,
      metrics: analysis,
      subFactors: analysis.rowCount
        ? analysis.conditions.map(condition => ({
            label: `${condition.passed ? "Passed" : "Failed"}: ${condition.label}`,
            score: available ? (condition.passed ? condition.points : 0) : null
          }))
        : [{ label: "Waiting for price history data", score: null }]
    };
  }

  // ---- Pillar 5: Risk — red flags, debt extremity, pledge trend ----
  const detectRedFlags = CompanyCalculations.detectRedFlags;

  function riskPillar(fundamentals, ratios) {
    const flags = detectRedFlags(fundamentals);
    const flagScore = scoreBand(flags.length, [[0,100],[1,70],[2,45],[3,15],[5,0]]);
    const deExtremityScore = ratios.debtEquity !== null ? scoreBand(ratios.debtEquity, [[0,100],[1,70],[2,30],[4,5]]) : 50;
    const score = (flagScore + deExtremityScore) / 2;
    const subFactors = [
      { label: `Red flags detected: ${flags.length}`, score: flagScore },
      { label: `Debt/Equity extremity`, score: deExtremityScore }
    ];
    return { score, flags, subFactors };
  }

  // ---- Combine pillars into Overall Score, re-weighting if Technical Trend is unavailable ----
  function computeOverall(pillars) {
    const available = Object.entries(PILLAR_WEIGHTS).filter(([key]) => pillars[key].score !== null);
    const totalWeight = available.reduce((s, [key, w]) => s + w, 0);
    const overall = available.reduce((s, [key, w]) => s + pillars[key].score * (w / totalWeight), 0);
    return clamp(overall);
  }

  function computeRating(overall, riskScore, redFlagCount) {
    if (overall < 45 || riskScore < 30 || redFlagCount >= 3) return "Avoid";
    if (overall >= 80 && riskScore >= 60) return "Strong Buy";
    if (overall >= 65) return "Buy";
    if (overall >= 45) return "Watch";
    return "Avoid";
  }

  // ---- Top 3 Strengths / Top 3 Risks — ranked from every sub-factor across all pillars ----
  function rankStrengthsAndRisks(pillars) {
    const allFactors = [];
    Object.values(pillars).forEach(p => {
      (p.subFactors || []).forEach(f => { if (f.score !== null) allFactors.push(f); });
    });
    const sorted = allFactors.slice().sort((a, b) => b.score - a.score);
    const strengths = sorted.slice(0, 3).map(f => f.label);
    const risks = sorted.slice(-3).reverse().map(f => f.label);
    return { strengths, risks };
  }

  // ---- Full per-company computation, matching the methodology doc exactly ----
  function computeCandidate(ticker) {
    const security = WealthData.getSecurity(ticker);
    const fundamentals = WealthData.getFundamentals(ticker);
    if (!fundamentals) return null;
    if (fundamentals.manualRatios && !CompanyCalculations.hasMinimumFundamentals(fundamentals)) return null;

    const ratios = fundamentals.manualRatios ? fundamentals.manualRatios : CompanyCalculations.latestRatios(fundamentals);

    const bq = businessQualityPillar(fundamentals.qualitative || {});
    const fs = financialStrengthPillar(ratios);
    const val = valuationPillar(ratios, bq.score || 50);
    const tech = technicalTrendPillar(ticker);
    const risk = riskPillar(fundamentals, ratios);

    const pillars = { businessQuality: bq, financialStrength: fs, valuation: val, technicalTrend: tech, risk };
    const overall = computeOverall(pillars);
    const completeModelRating = computeRating(overall, risk.score, risk.flags.length);
    const rating = !tech.available && completeModelRating === "Strong Buy" ? "Buy" : completeModelRating;
    const { strengths, risks } = rankStrengthsAndRisks(pillars);

    return {
      ticker, security: security || { displayName: ticker, sector: "Nifty 500" }, overall: Math.round(overall * 10) / 10, rating, pillars, strengths, risks, ratios,
      redFlagCount: risk.flags.length, assessment: tech.available ? "Complete" : "Partial",
      pillarCoverage: tech.available ? "5 of 5" : "4 of 5",
      isFullRating: true
    };
  }

  function computeTechnicalOnlyCandidate(ticker, snapshotItem = null) {
    const security = WealthData.getSecurity(ticker) || { name: ticker, sector: "Nifty 500" };
    const tech = technicalTrendPillar(ticker);
    const symbol = PriceHistory.normalizeSymbol(ticker);
    const record = WealthData.getPriceHistory(symbol);
    const hasRecord = record && Array.isArray(record.rows) && record.rows.length > 0;
    const latestRow = hasRecord ? record.rows[record.rows.length - 1] : null;

    return {
      ticker,
      security,
      isFullRating: false,
      overall: null,
      rating: "Technical-Only",
      pillars: { technicalTrend: tech },
      assessment: tech.available ? "Technical Complete" : (hasRecord ? "Technical Limited" : "Data Missing"),
      pillarCoverage: "Technical-Only (1 of 5)",
      latestPrice: latestRow ? latestRow.close : null,
      latestDate: latestRow ? latestRow.date : null,
      rowCount: tech.rowCount || 0,
      validationStatus: snapshotItem ? (snapshotItem.validation_status || "MISSING") : (record ? "VALID" : "MISSING"),
      strengths: tech.available ? [`Technical Score ${tech.score}/100`, `250-row OHLCV history`, `DMA50/200 & RSI14 computed`] : [],
      risks: ["Fundamentals not enrolled — add verified ratios in Fundamentals to unlock a 5-pillar rating"]
    };
  }

  function ratingColor(rating) {
    return { "Strong Buy": "gain", "Buy": "gain", "Watch": "flag", "Avoid": "loss", "Technical-Only": "amber" }[rating] || "";
  }

  const PAGE_SIZE = 20;

  function render(container) {
    container.innerHTML = `
      <div class="module-header">
        <h2>Delivery</h2>
        <p class="module-sub">Rank delivery candidates across five pillars. Search all 500 Nifty 500 constituents below.</p>
      </div>
      <div id="delivery-screener-content"></div>
    `;
    renderScreener(container.querySelector("#delivery-screener-content"));
  }

  async function fetchMarketSnapshot() {
    try {
      const res = await fetch("/api/public-prices");
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.snapshot && data.snapshot.tickers) {
          return data.snapshot.tickers;
        }
      }
    } catch (e) {}
    return {};
  }

  async function renderScreener(container) {
    const fundamentalTickers = Object.keys(WealthData.get().fundamentals || {});
    const snapshotByTicker = await fetchMarketSnapshot();

    const defaultNifty500 = [
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

    const ignoredSymbols = new Set(["NIFTY", "NIFTY50", "NIFTY 50", "BANKNIFTY", "^NSEI", "^NSEBANK"]);

    const allSymbolSet = new Set([...fundamentalTickers, ...defaultNifty500]);

    const allCandidates = [];
    allSymbolSet.forEach(ticker => {
      const clean = ticker.trim().toUpperCase();
      if (ignoredSymbols.has(clean)) return;
      if (fundamentalTickers.includes(clean)) {
        const candidate = computeCandidate(clean);
        if (candidate) allCandidates.push(candidate);
      } else {
        allCandidates.push(computeTechnicalOnlyCandidate(clean, snapshotByTicker[clean]));
      }
    });

    const fullRatingCount = allCandidates.filter(c => c.isFullRating).length;
    const techOnlyCount = allCandidates.filter(c => !c.isFullRating).length;

    const sortOptions = [
      { key: "overall", label: "Sort: Overall score" },
      { key: "businessQuality", label: "Sort: Business Quality" },
      { key: "financialStrength", label: "Sort: Financial Strength" },
      { key: "valuation", label: "Sort: Valuation" },
      { key: "technicalTrend", label: "Sort: Technical Score" },
      { key: "risk", label: "Sort: Risk" }
    ];

    container.innerHTML = `
      <div class="module-header">
        <h2>Delivery Screener — Searchable Nifty 500 Universe</h2>
        <p class="module-sub">Rank delivery candidates across 5 pillars, or search all 500 Nifty 500 constituents (e.g. DIXON).</p>
      </div>
      <div class="panel" id="ds-price-import-panel" style="margin-bottom:20px;max-width:none;">
        <div class="section-head" style="margin-bottom:12px;"><span class="section-title" style="font-size:15px;">Price History Data Center</span></div>
        <p class="module-sub" style="margin-bottom:14px;">Auto-Sync free public EOD historical closes for all 500 Nifty 500 constituents (no broker login or CSV required).</p>
        <div class="field-row"><label for="ds-price-symbol">Ticker (leave blank to sync all 500 Nifty 500 constituents)</label><input type="text" id="ds-price-symbol" style="text-transform:uppercase" placeholder="e.g. DIXON or TCS"></div>
        <div class="field-row"><label for="ds-price-file">CSV file (manual fallback)</label><input type="file" id="ds-price-file" accept=".csv,text/csv"></div>
        <div class="paper-action-row" style="margin-top:10px;">
          <button class="btn" id="ds-price-autosync-btn" style="background:var(--gain);color:#fff;">⚡ Sync Nifty 500 Public Prices</button>
          <button class="btn" id="ds-price-retry-btn" style="background:transparent;border:1px solid var(--amber);color:var(--amber-bright);">Retry Failed Tickers</button>
          <button class="btn" id="ds-price-import-btn" style="background:transparent;border:1px solid var(--rule-bright);color:var(--paper-dim);">Import Local CSV</button>
        </div>
        <div class="module-sub" id="ds-price-import-result" style="margin-top:10px;"></div>
      </div>
      <div class="specimen">
        <h2>Rating Integrity & Nifty 500 Coverage</h2>
        <p><strong>Full Rating (${fullRatingCount} enrolled):</strong> Complete 5-pillar fundamental ranking (Business Quality, Financial Strength, Valuation, Technical Trend, Risk).</p>
        <p><strong>Technical-Only (${techOnlyCount} stocks):</strong> Technical coverage is shown only when validated OHLCV history is available. To unlock a full 5-pillar rating for a stock such as <em>DIXON</em>, enroll its verified financial ratios in Fundamentals.</p>
      </div>

      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px;background:var(--bg-ticket);padding:14px;border:1px solid var(--rule-bright);">
        <input type="text" id="ds-search-input" placeholder="🔍 Search ticker (e.g. DIXON, TCS)..." style="flex:1;min-width:200px;min-height:var(--touch);padding:0 12px;background:var(--bg-raised);border:1px solid var(--rule-bright);color:var(--paper);font-family:var(--mono);">
        <select id="ds-universe-filter" style="min-height:var(--touch);padding:0 12px;background:var(--bg-raised);border:1px solid var(--rule-bright);color:var(--paper);font-family:var(--mono);">
          <option value="all">Universe: All Nifty 500 (${allCandidates.length})</option>
          <option value="full">Full Rating (${fullRatingCount} enrolled)</option>
          <option value="technical">Technical-Only (${techOnlyCount})</option>
          <option value="missing">Data Missing</option>
          <option value="failed">Sync Failed</option>
        </select>
        <select id="ds-sort-select" style="min-height:var(--touch);padding:0 12px;background:var(--bg-raised);border:1px solid var(--rule-bright);color:var(--paper);font-family:var(--mono);">
          ${sortOptions.map(opt => `<option value="${opt.key}">${opt.label}</option>`).join("")}
        </select>
      </div>

      <div id="ds-list"></div>
      <button class="btn" id="ds-show-more" style="display:none;background:transparent;border:1px solid var(--rule-bright);color:var(--paper-dim);margin-top:14px;width:100%;">Show 20 more</button>
    `;

    const state = { searchText: "", filterType: "all", sortKey: "overall" };
    let visibleCount = PAGE_SIZE;

    const listEl = container.querySelector("#ds-list");
    const showMoreBtn = container.querySelector("#ds-show-more");
    const searchInput = container.querySelector("#ds-search-input");
    const filterSelect = container.querySelector("#ds-universe-filter");
    const sortSelect = container.querySelector("#ds-sort-select");
    const fileInput = container.querySelector("#ds-price-file");
    const symbolInput = container.querySelector("#ds-price-symbol");

    function renderFilteredList() {
      let filtered = allCandidates.filter(c => {
        if (state.searchText) {
          const query = state.searchText.toLowerCase();
          const matchTicker = c.ticker.toLowerCase().includes(query);
          const matchName = (c.security.name || "").toLowerCase().includes(query);
          if (!matchTicker && !matchName) return false;
        }
        if (state.filterType === "full") return c.isFullRating;
        if (state.filterType === "technical") return !c.isFullRating;
        if (state.filterType === "missing") return c.assessment === "Data Missing" || c.assessment === "Waiting for price history data";
        if (state.filterType === "failed") return c.validationStatus === "FAILED" || c.validationStatus === "INVALID";
        return true;
      });

      filtered.sort((a, b) => {
        if (state.sortKey === "overall") {
          if (a.isFullRating && !b.isFullRating) return -1;
          if (!a.isFullRating && b.isFullRating) return 1;
          if (a.isFullRating) return (b.overall || 0) - (a.overall || 0);
          const aTech = (a.pillars.technicalTrend && a.pillars.technicalTrend.score) || 0;
          const bTech = (b.pillars.technicalTrend && b.pillars.technicalTrend.score) || 0;
          return bTech - aTech;
        }
        const aScore = (a.pillars[state.sortKey] && a.pillars[state.sortKey].score) || 0;
        const bScore = (b.pillars[state.sortKey] && b.pillars[state.sortKey].score) || 0;
        return bScore - aScore;
      });

      const slice = filtered.slice(0, visibleCount);
      if (slice.length === 0) {
        listEl.innerHTML = `<div class="paper-empty-message" style="padding:20px;text-align:center;color:var(--paper-dim);">No stocks match your search/filter criteria.</div>`;
        showMoreBtn.style.display = "none";
        return;
      }

      listEl.innerHTML = slice.map((c, index) => {
        if (c.isFullRating) {
          return renderCard(c, index + 1);
        } else {
          const tech = c.pillars.technicalTrend;
          const metrics = tech.metrics || {};
          const techScoreDisplay = tech && tech.score !== null ? `${tech.score}/100` : "N/A";
          return `
            <div class="ticket" style="margin-bottom:16px;border-left:4px solid var(--amber);">
              <div class="ticket-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                <div>
                  <span class="ticket-ticker">${c.ticker}</span>
                  <span style="font-size:12px;color:var(--paper-dim);margin-left:8px;">${c.security.name || ''}</span>
                </div>
                <span class="sync-health-pill sync-health-stale">Technical-only — fundamentals not enrolled</span>
              </div>
              <div class="ticket-body">
                <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:8px;margin-bottom:10px;font-family:var(--mono);font-size:12px;">
                  <div><strong>Latest Close:</strong> ${c.latestPrice ? `₹${c.latestPrice.toFixed(2)}` : '—'}</div>
                  <div><strong>Market Date:</strong> ${c.latestDate || '—'}</div>
                  <div><strong>Technical Score:</strong> ${techScoreDisplay}</div>
                  <div><strong>OHLCV History:</strong> ${c.rowCount} rows</div>
                  <div><strong>50 DMA:</strong> ${formatMetric(metrics.dma50, "", 2)}</div>
                  <div><strong>200 DMA:</strong> ${formatMetric(metrics.dma200, "", 2)}</div>
                  <div><strong>RSI 14:</strong> ${formatMetric(metrics.rsi14)}</div>
                  <div><strong>52W High Distance:</strong> ${formatMetric(metrics.distanceFrom52WeekHigh, "%")}</div>
                  <div><strong>Volume / 20D:</strong> ${formatMetric(metrics.latestVolumeVs20DayAverage, "x", 2)}</div>
                </div>
                <div style="font-size:11px;color:var(--paper-dim);margin-top:6px;">
                  ${c.risks[0]}
                </div>
              </div>
            </div>
          `;
        }
      }).join("");

      listEl.querySelectorAll("[data-expand]").forEach(btn => {
        btn.addEventListener("click", () => {
          const target = listEl.querySelector(`#${btn.dataset.expand}`);
          const isOpen = target.style.display !== "none";
          target.style.display = isOpen ? "none" : "block";
          btn.textContent = isOpen ? "Show breakdown ▾" : "Hide breakdown ▴";
        });
      });
      listEl.querySelectorAll("[data-import-price]").forEach(btn => {
        btn.addEventListener("click", () => {
          symbolInput.value = btn.dataset.importPrice;
          fileInput.click();
        });
      });
      listEl.querySelectorAll("[data-paper-buy]").forEach(btn => {
        btn.addEventListener("click", () => openPaperBuy(btn.dataset.paperBuy));
      });

      if (visibleCount < filtered.length) {
        showMoreBtn.style.display = "block";
        showMoreBtn.textContent = `Show 20 more (showing ${slice.length} of ${filtered.length})`;
      } else {
        showMoreBtn.style.display = "none";
      }
    }

    searchInput.addEventListener("input", (e) => {
      state.searchText = e.target.value;
      visibleCount = PAGE_SIZE;
      renderFilteredList();
    });

    filterSelect.addEventListener("change", (e) => {
      state.filterType = e.target.value;
      visibleCount = PAGE_SIZE;
      renderFilteredList();
    });

    sortSelect.addEventListener("change", (e) => {
      state.sortKey = e.target.value;
      visibleCount = PAGE_SIZE;
      renderFilteredList();
    });

    showMoreBtn.addEventListener("click", () => {
      visibleCount += PAGE_SIZE;
      renderFilteredList();
    });

    renderFilteredList();

    let pollInterval = null;

    async function handlePublicSync(endpoint = "/api/sync-public-prices", retryOnly = false) {
      const resultEl = container.querySelector("#ds-price-import-result");
      const targetTicker = symbolInput.value.trim().toUpperCase();

      App.showStatus(`Syncing public market data...`, "ok");
      if (resultEl) {
        resultEl.innerHTML = `
          <div class="sync-status-box">
            <div><strong>Starting Nifty 500 Sync...</strong></div>
            <div style="font-size:11px;color:var(--paper-dim);">Connecting to local application server...</div>
          </div>
        `;
      }

      pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch("/api/public-sync-status");
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            const s = statusData.status || {};
            if (s.is_syncing && resultEl) {
              const comp = s.completed_count || 0;
              const tot = s.total_tickers || 502;
              const pct = tot > 0 ? Math.round((comp / tot) * 100) : 0;
              resultEl.innerHTML = `
                <div class="sync-status-box">
                  <div><strong>Syncing Nifty 500 Public Prices...</strong> (${comp} of ${tot} symbols)</div>
                  <div>Elapsed: ${s.elapsed_seconds || 0}s | Current: <strong>${s.current_symbol || 'Processing'}</strong></div>
                  <div style="background:var(--rule);height:6px;width:100%;margin-top:6px;border-radius:3px;overflow:hidden;">
                    <div style="background:var(--gain);height:100%;width:${pct}%;"></div>
                  </div>
                </div>
              `;
            }
          }
        } catch (e) {}
      }, 1000);

      try {
        const bodyObj = targetTicker ? { tickers: [targetTicker] } : {};
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyObj)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status} - Sync service unavailable`);
        const data = await response.json();

        clearInterval(pollInterval);

        const snapshot = data.snapshot || {};
        const snapshotTickers = snapshot.tickers || {};

        let importedCount = 0;
        let latestDateFound = "—";
        for (const [sym, item] of Object.entries(snapshotTickers)) {
          if (item.valid && item.validation_status === "VALID" && item.rows && item.rows.length >= 200) {
            WealthData.setPriceHistory(sym, {
              symbol: sym,
              sourceSymbol: item.provider_ticker || sym,
              importedAt: item.fetch_timestamp || new Date().toISOString(),
              rows: item.rows
            });
            importedCount++;
            if (item.latest_date) latestDateFound = item.latest_date;
          }
        }
        await App.saveNow(false);
        App.showStatus(`Synced ${importedCount} price histories. Latest date: ${latestDateFound}`, "ok");
        await renderScreener(container);
        const refreshedResult = container.querySelector("#ds-price-import-result");
        if (refreshedResult) {
          refreshedResult.innerHTML = `<div class="sync-status-box"><strong>Sync complete:</strong> ${data.successful || 0} successful · ${data.failed || 0} failed · ${data.stale || 0} stale · ${data.elapsed_seconds || 0}s</div>`;
        }
      } catch (error) {
        clearInterval(pollInterval);
        App.showStatus("Public sync failed: " + error.message, "error");
        if (resultEl) resultEl.textContent = "Sync error: " + error.message;
      }
    }

    const autoSyncBtn = container.querySelector("#ds-price-autosync-btn");
    if (autoSyncBtn) autoSyncBtn.addEventListener("click", () => handlePublicSync("/api/sync-public-prices", false));

    const retryBtn = container.querySelector("#ds-price-retry-btn");
    if (retryBtn) retryBtn.addEventListener("click", () => handlePublicSync("/api/retry-failed-prices", true));

    container.querySelector("#ds-price-import-btn").addEventListener("click", async () => {
      const file = fileInput.files[0];
      if (!file) { App.showStatus("Choose an OHLCV CSV file first", "error"); return; }
      const resultEl = container.querySelector("#ds-price-import-result");
      try {
        const parsed = PriceHistory.parseCSV(await file.text(), { fileName: file.name, symbol: symbolInput.value });
        if (!parsed.ok) { App.showStatus(parsed.error, "error"); resultEl.textContent = parsed.error; return; }
        if (!parsed.symbol) { App.showStatus("Enter a ticker or use a ticker-based filename", "error"); return; }
        if (!parsed.rows.length) { App.showStatus("CSV contains no valid OHLCV rows", "error"); return; }
        WealthData.setPriceHistory(parsed.symbol, {
          symbol: parsed.symbol,
          sourceSymbol: String(symbolInput.value || PriceHistory.inferSymbolFromFilename(file.name)).trim(),
          importedAt: new Date().toISOString(),
          rows: parsed.rows
        });
        await App.saveNow(false);
        const technical = PriceHistory.calculate(parsed.rows);
        App.showStatus(`Imported ${parsed.rows.length} price rows for ${parsed.symbol}`, "ok");
        renderScreener(container);
        const refreshedResult = container.querySelector("#ds-price-import-result");
        if (refreshedResult) refreshedResult.textContent = `${parsed.symbol}: ${parsed.rows.length} valid rows · ${technical.coverage} · latest ${technical.latestDate || "—"}`;
      } catch (error) {
        App.showStatus("Price history import failed: " + error.message, "error");
        resultEl.textContent = error.message;
      }
    });
  }

  function pillarRow(label, pillar) {
    const scoreText = pillar.score !== null ? Math.round(pillar.score) : "—";
    const note = pillar.available === false ? " (not available)" : "";
    return `
      <div class="ratio-cell">
        <div class="ratio-label">${label}${note}</div>
        <div class="ratio-value" style="${pillar.score === null ? 'color:var(--paper-faint);font-size:14px;' : ''}">${scoreText}</div>
      </div>
    `;
  }

  function formatMetric(value, suffix = "", decimals = 1) {
    return typeof value === "number" && Number.isFinite(value) ? value.toFixed(decimals) + suffix : "—";
  }

  function technicalDetail(candidate) {
    const technical = candidate.pillars.technicalTrend;
    const metrics = technical.metrics;
    if (!technical.rowCount) {
      return `<div class="specimen" style="margin-top:14px;">
        <h2>Technical Trend — Waiting for price history data</h2>
        <p>Assessment: Partial · Coverage: Missing · 4 of 5 pillars. No technical score is inferred without imported OHLCV history.</p>
        <button class="btn" data-import-price="${candidate.ticker}" style="margin-top:8px;">Import CSV for ${candidate.ticker}</button>
      </div>`;
    }
    const conditionList = metrics.conditions.map(condition =>
      `<li style="color:${condition.passed ? 'var(--gain)' : 'var(--loss)'};">${condition.passed ? '✓' : '✗'} ${condition.label}${technical.available ? ` (${condition.passed ? '+' + condition.points : '+0'})` : ''}</li>`
    ).join("");
    return `<div class="specimen" style="margin-top:14px;">
      <h2>Technical Trend — ${technical.coverage === 'Limited' ? 'Limited Technical Data' : technical.status}</h2>
      <p>Assessment: ${candidate.assessment} · Coverage: ${technical.coverage} · ${candidate.pillarCoverage} pillars · ${technical.rowCount} valid rows · latest ${technical.latestDate || '—'}</p>
      <div class="ratio-grid" style="margin:12px 0;">
        <div class="ratio-cell"><div class="ratio-label">Technical score</div><div class="ratio-value">${technical.score === null ? '—' : technical.score}</div></div>
        <div class="ratio-cell"><div class="ratio-label">Latest close</div><div class="ratio-value">${formatMetric(metrics.latestClose, '', 2)}</div></div>
        <div class="ratio-cell"><div class="ratio-label">50 DMA</div><div class="ratio-value">${formatMetric(metrics.dma50, '', 2)}</div></div>
        <div class="ratio-cell"><div class="ratio-label">200 DMA</div><div class="ratio-value">${formatMetric(metrics.dma200, '', 2)}</div></div>
        <div class="ratio-cell"><div class="ratio-label">RSI 14</div><div class="ratio-value">${formatMetric(metrics.rsi14)}</div></div>
        <div class="ratio-cell"><div class="ratio-label">52-week high</div><div class="ratio-value">${formatMetric(metrics.high52Week, '', 2)}</div></div>
        <div class="ratio-cell"><div class="ratio-label">Distance from high</div><div class="ratio-value">${formatMetric(metrics.distanceFrom52WeekHigh, '%')}</div></div>
        <div class="ratio-cell"><div class="ratio-label">Latest volume / 20D avg</div><div class="ratio-value">${formatMetric(metrics.latestVolumeVs20DayAverage, 'x', 2)}</div></div>
      </div>
      <ul class="flag-list" style="color:var(--paper-dim);">${conditionList}</ul>
      ${technical.available ? `<p class="final">Trend status is entry guidance only, not an automatic buy signal.</p>` : `<p class="final">At least 200 valid rows are required before Technical Trend contributes to the model.</p>`}
      <button class="btn" data-import-price="${candidate.ticker}" style="margin-top:8px;">Replace CSV for ${candidate.ticker}</button>
    </div>`;
  }

  function renderCard(c, rank) {
    const cardId = `ds-detail-${c.ticker}`;
    return `
      <div class="ticket" style="margin-bottom:14px;">
        <div class="ticket-body" style="width:100%;">
          <div class="ticket-top">
            <div>
              <div class="ticket-ticker">#${rank} ${c.ticker}</div>
              <div class="module-sub" style="margin:2px 0 0;">${c.security ? c.security.displayName : ''}</div>
            </div>
            <div class="ticket-score">
              <div class="n">${c.overall}</div>
              <div class="l">overall</div>
              <div class="chip ${ratingColor(c.rating)}" style="font-family:var(--mono);font-size:11px;padding:3px 10px;border:1px solid var(--rule-bright);margin-top:6px;display:inline-block;">${c.rating}</div>
              <div class="l" style="margin-top:5px;">${c.assessment} · ${c.pillarCoverage} pillars</div>
            </div>
          </div>

          <!-- Level 1: always visible -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px;">
            <div>
              <div class="ratio-label" style="color:var(--gain);">Top strengths</div>
              <ul class="flag-list" style="color:var(--paper-dim);">${c.strengths.map(s => `<li>${s}</li>`).join("")}</ul>
            </div>
            <div>
              <div class="ratio-label" style="color:var(--loss);">Top risks</div>
              <ul class="flag-list">${c.risks.map(r => `<li>${r}</li>`).join("")}</ul>
            </div>
          </div>

          <div class="paper-action-row">
            <button class="btn" data-paper-buy="${c.ticker}">Paper Buy</button>
            <button class="btn" data-expand="${cardId}" style="background:transparent;border:1px solid var(--rule-bright);color:var(--paper-dim);">Show breakdown ▾</button>
          </div>

          <!-- Level 2 + 3: hidden until expanded -->
          <div id="${cardId}" style="display:none;margin-top:16px;">
            <div class="ratio-grid" style="grid-template-columns:repeat(auto-fit,minmax(110px,1fr));">
              ${pillarRow("Business Quality", c.pillars.businessQuality)}
              ${pillarRow("Financial Strength", c.pillars.financialStrength)}
              ${pillarRow("Valuation", c.pillars.valuation)}
              ${pillarRow("Technical Trend", c.pillars.technicalTrend)}
              ${pillarRow("Risk", c.pillars.risk)}
            </div>

            ${technicalDetail(c)}

            <div class="module-sub" style="margin-top:14px;font-weight:600;color:var(--paper);">Full calculation trace</div>
            ${Object.entries(c.pillars).map(([key, p]) => `
              <div style="margin-top:8px;">
                <div class="module-sub" style="text-transform:capitalize;">${key.replace(/([A-Z])/g, ' $1')}</div>
                <ul class="flag-list" style="color:var(--paper-dim);">
                  ${(p.subFactors || []).map(f => `<li>${f.label}${f.score !== null ? ` — score ${Math.round(f.score)}` : ''}</li>`).join("")}
                </ul>
              </div>
            `).join("")}

            <div class="module-sub" style="margin-top:14px;">Red flags detected: ${c.redFlagCount}</div>
            <div class="module-sub" style="margin-top:10px;">
              Related: <a href="#" onclick="App.switchTo('fundamentals');return false;" style="color:var(--amber-bright);">Fundamentals</a> ·
              <a href="#" onclick="App.switchTo('portfolio');return false;" style="color:var(--amber-bright);">Portfolio</a> ·
              <a href="#" onclick="App.switchTo('watchlist');return false;" style="color:var(--amber-bright);">Watchlist</a>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function paperEscape(value) {
    return String(value === null || value === undefined ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function paperMoney(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "—";
    const sign = value < 0 ? "−" : "";
    return sign + "₹" + Math.abs(value).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function paperNumber(value, decimals = 2) {
    return typeof value === "number" && Number.isFinite(value)
      ? value.toFixed(decimals) : "—";
  }

  function paperPct(value) {
    return typeof value === "number" && Number.isFinite(value)
      ? value.toFixed(2) + "%" : "—";
  }

  function paperMetric(label, value, className) {
    return '<div class="ratio-cell"><div class="ratio-label">' +
      paperEscape(label) + '</div><div class="ratio-value ' +
      (className || "") + '">' + paperEscape(value) + '</div></div>';
  }

  function scoreText(value) {
    return typeof value === "number" && Number.isFinite(value)
      ? value.toFixed(1) : "—";
  }

  function refreshPaper() {
    if (paperContainer) renderPaperTrading(paperContainer);
  }

  function quoteDetails(quote) {
    if (!quote) {
      return '<div class="paper-quote-status" data-quote-details>Quote status: Unavailable</div>';
    }
    return '<div class="paper-quote-status" data-quote-details>' +
      '<strong>' + paperEscape(quote.status) + '</strong>' +
      '<span>Quote price: ' + paperMoney(quote.price) + '</span>' +
      '<span>Timestamp: ' + paperEscape(quote.quoteTimestamp) + '</span>' +
      '<span>Source: ' + paperEscape(quote.source) + '</span>' +
      '<span>Data age: ' + paperEscape(PaperQuotes.formatAge(quote.ageSeconds)) + '</span>' +
      '</div>';
  }

  function renderPriceSelector(prefix, ticker, currentPrice) {
    const quote = recentPaperQuotes[ticker];
    const quoteUsable = quote && quote.usable;
    const importedAvailable = currentPrice && currentPrice.price !== null &&
      currentPrice.source === "Imported close";
    return [
      '<fieldset class="paper-price-selector"><legend>Price evidence to record</legend>',
      '<label class="paper-price-choice"><input type="radio" name="paper-' + prefix +
        '-price-source" value="manual" checked> Manual Observed Price</label>',
      '<div class="paper-manual-price" data-manual-evidence>',
      '<div class="field-row paper-field"><label for="paper-' + prefix + '-manual-price">Manual observed price</label><input id="paper-' + prefix + '-manual-price" type="number" min="0.000001" step="any"></div>',
      '<div class="field-row paper-field"><label for="paper-' + prefix + '-observed-date">Observed date</label><input id="paper-' + prefix + '-observed-date" type="date"></div>',
      '<div class="field-row paper-field"><label for="paper-' + prefix + '-observed-time">Observed time</label><input id="paper-' + prefix + '-observed-time" type="time"></div>',
      '<div class="field-row paper-field"><label for="paper-' + prefix + '-manual-note">Source / note</label><input id="paper-' + prefix + '-manual-note" type="text" value="Angel One app"></div>',
      '</div>',
      '<details class="paper-api-optional"><summary>Optional API Price Service</summary>',
      '<div class="paper-action-row"><button type="button" class="btn" data-get-paper-quote="' +
        paperEscape(ticker) + '" data-quote-prefix="' + prefix + '">' +
        (quote ? "Refresh Price" : "Get Latest Price") + '</button></div>',
      quoteDetails(quote),
      '<label class="paper-price-choice"><input type="radio" name="paper-' + prefix +
        '-price-source" value="quote" ' + (quoteUsable ? "" : "disabled") +
        '> Angel One recent quote</label>',
      '</details>',
      importedAvailable ? [
        '<label class="paper-price-choice"><input type="radio" name="paper-' + prefix +
          '-price-source" value="imported"> Imported historical close — ' +
          paperMoney(currentPrice.price) + ' on ' + paperEscape(currentPrice.date) + '</label>',
        '<p class="module-sub">Imported daily CSV history is historical and is never a live quote.</p>'
      ].join("") : '',
      '<p class="module-sub" data-price-selection>Selected: ' +
        'Manual Observed Price · Angel One app</p>',
      '</fieldset>'
    ].join("");
  }

  function selectedPriceEvidence(container, prefix, currentPrice) {
    const selected = container.querySelector('input[name="paper-' + prefix + '-price-source"]:checked');
    const mode = selected ? selected.value : "manual";
    if (mode === "quote") {
      const ticker = prefix === "buy" ? pendingBuyTicker : pendingSellTicker;
      return PaperQuotes.transactionEvidence(recentPaperQuotes[ticker]);
    }
    if (mode === "imported") {
      if (!currentPrice || currentPrice.price === null || !currentPrice.date) {
        return { ok: false, error: "Imported historical close is unavailable" };
      }
      return {
        ok: true,
        price: currentPrice.price,
        priceSource: "Imported daily CSV · Historical close",
        priceTimestamp: currentPrice.date,
        quoteAgeSeconds: null,
        priceStatus: "Imported historical close",
        manualPriceNote: null
      };
    }
    const note = container.querySelector("#paper-" + prefix + "-manual-note").value;
    const evidence = PaperQuotes.manualEvidence({
      price: container.querySelector("#paper-" + prefix + "-manual-price").value,
      observedDate: container.querySelector("#paper-" + prefix + "-observed-date").value,
      observedTime: container.querySelector("#paper-" + prefix + "-observed-time").value,
      sourceNote: note
    });
    if (evidence.ok) evidence.manualPriceNote = note.trim();
    return evidence;
  }

  function bindPriceSelectors(container) {
    container.querySelectorAll("[data-get-paper-quote]").forEach(button => {
      button.addEventListener("click", async () => {
        const ticker = button.dataset.getPaperQuote;
        const prefix = button.dataset.quotePrefix;
        const fieldset = button.closest(".paper-price-selector");
        button.disabled = true;
        try {
          const quote = await PaperQuotes.fetchLatest(ticker);
          recentPaperQuotes[ticker] = quote;
          const details = fieldset.querySelector("[data-quote-details]");
          details.outerHTML = quoteDetails(quote);
          const quoteChoice = fieldset.querySelector('input[value="quote"]');
          quoteChoice.disabled = !quote.usable;
          const selected = fieldset.querySelector('input[name="paper-' + prefix + '-price-source"]:checked');
          fieldset.querySelector("[data-price-selection]").textContent = "Selected: " +
            (selected && selected.value === "quote" ? quote.status + " · " + quote.source : "Manual Observed Price · Angel One app");
          button.textContent = "Refresh Price";
          App.showStatus(quote.usable ? "Recent paper quote received" : "Quote is stale; refresh or use Manual Price", quote.usable ? "ok" : "error");
        } catch (error) {
          const details = fieldset.querySelector("[data-quote-details]");
          details.textContent = error.message || "Quote service unavailable — use a dated manual price";
          App.showStatus(details.textContent, "error");
        } finally {
          button.disabled = false;
        }
      });
    });
    container.querySelectorAll('.paper-price-selector input[type="radio"]').forEach(input => {
      input.addEventListener("change", () => {
        const fieldset = input.closest(".paper-price-selector");
        const ticker = input.name.includes("buy") ? pendingBuyTicker : pendingSellTicker;
        const quote = recentPaperQuotes[ticker];
        let label = "Manual Observed Price · Angel One app";
        if (input.value === "quote" && quote) label = quote.status + " · " + quote.source;
        if (input.value === "imported") label = "Imported historical close · Not live";
        fieldset.querySelector("[data-price-selection]").textContent = "Selected: " + label;
      });
    });
  }

  function renderCapitalConfig(config) {
    return [
      '<div class="panel paper-panel">',
      '<div class="section-head"><span class="section-title">Delivery Paper Capital</span></div>',
      '<p class="module-sub">Simulation limits only. Paper cash and holdings never affect the real Portfolio.</p>',
      '<div class="paper-form-grid">',
      '<div class="field-row paper-field"><label for="paper-starting-capital">Starting Paper Capital</label><input id="paper-starting-capital" type="number" min="0" step="0.01" value="' + paperEscape(config.startingCapital) + '"></div>',
      '<div class="field-row paper-field"><label for="paper-max-allocation">Maximum allocation per stock %</label><input id="paper-max-allocation" type="number" min="0.01" max="100" step="0.01" value="' + paperEscape(config.maxAllocationPct) + '"></div>',
      '<div class="field-row paper-field"><label for="paper-max-open">Maximum open paper holdings</label><input id="paper-max-open" type="number" min="1" step="1" value="' + paperEscape(config.maxOpenHoldings) + '"></div>',
      '</div>',
      '<button class="btn" id="paper-save-config">Save Paper Capital Settings</button>',
      config.startingCapital <= 0
        ? '<p class="warn-inline">Set paper capital before creating a paper position</p>' : '',
      '</div>'
    ].join("");
  }

  function renderBuyForm(candidate, currentPrice) {
    if (!candidate) return "";
    const snapshot = PaperDelivery.snapshotCandidate(candidate, "");
    return [
      '<div class="panel paper-panel paper-entry-panel">',
      '<div class="section-head"><span class="section-title">Paper Buy — ' + paperEscape(candidate.ticker) + '</span></div>',
      '<p class="module-sub">Use a recent read-only quote, explicit Manual Price, or a clearly selected imported historical close.</p>',
      '<div class="ratio-grid">',
      paperMetric("Delivery Score", scoreText(snapshot.deliveryOverallScore)),
      paperMetric("Entry Rating", snapshot.deliveryRating),
      paperMetric("Technical Status", snapshot.technicalTrendStatus),
      paperMetric("Technical Data Date", snapshot.technicalDataDate || "—"),
      paperMetric("Price Coverage", snapshot.priceHistoryCoverage),
      '</div>',
      '<div class="paper-form-grid">',
      '<div class="field-row paper-field"><label for="paper-buy-date">Buy date</label><input id="paper-buy-date" type="date" value="' + paperEscape(PaperDelivery.localISODate()) + '"></div>',
      '<div class="field-row paper-field"><label for="paper-buy-quantity">Quantity</label><input id="paper-buy-quantity" type="number" min="0.000001" step="any"></div>',
      '<div class="field-row paper-field"><label for="paper-buy-charges">Charges</label><input id="paper-buy-charges" type="number" min="0" step="0.01" value="0"></div>',
      '<div class="field-row paper-field paper-field-wide"><label for="paper-buy-reason">Reason for paper buy</label><textarea id="paper-buy-reason" rows="2"></textarea></div>',
      '<div class="field-row paper-field paper-field-wide"><label for="paper-buy-notes">Notes</label><textarea id="paper-buy-notes" rows="2"></textarea></div>',
      '</div>',
      renderPriceSelector("buy", candidate.ticker, currentPrice),
      '<div class="paper-action-row"><button class="btn" id="paper-confirm-buy">Record Paper Buy</button><button class="ticker-chip" id="paper-cancel-buy">Cancel</button></div>',
      '</div>'
    ].join("");
  }

  function renderSellForm(holding, currentPrice) {
    if (!holding) return "";
    return [
      '<div class="panel paper-panel paper-entry-panel">',
      '<div class="section-head"><span class="section-title">Paper Sell — ' + paperEscape(holding.ticker) + '</span></div>',
      '<p class="module-sub">Available quantity: ' + paperEscape(holding.quantity) + '. ' + paperEscape(currentPrice.label) + '.</p>',
      '<div class="paper-form-grid">',
      '<div class="field-row paper-field"><label for="paper-sell-date">Sell date</label><input id="paper-sell-date" type="date" value="' + paperEscape(PaperDelivery.localISODate()) + '"></div>',
      '<div class="field-row paper-field"><label for="paper-sell-quantity">Quantity</label><input id="paper-sell-quantity" type="number" min="0.000001" max="' + paperEscape(holding.quantity) + '" step="any" value="' + paperEscape(holding.quantity) + '"></div>',
      '<div class="field-row paper-field"><label for="paper-sell-charges">Charges</label><input id="paper-sell-charges" type="number" min="0" step="0.01" value="0"></div>',
      '<div class="field-row paper-field paper-field-wide"><label for="paper-sell-reason">Exit reason</label><textarea id="paper-sell-reason" rows="2"></textarea></div>',
      '<div class="field-row paper-field paper-field-wide"><label for="paper-sell-notes">Notes</label><textarea id="paper-sell-notes" rows="2"></textarea></div>',
      '</div>',
      renderPriceSelector("sell", holding.ticker, currentPrice),
      '<div class="paper-action-row"><button class="btn" id="paper-confirm-sell">Record Paper Sell</button><button class="ticker-chip" id="paper-cancel-sell">Cancel</button></div>',
      '</div>'
    ].join("");
  }

  function holdingRows(holdings) {
    return holdings.map(holding => {
      const latestCandidate = computeCandidate(holding.ticker);
      const entrySnapshot = holding.entrySnapshot || {};
      const manual = holding.currentPrice === null ? [
        '<div class="paper-manual-price">',
        '<input type="number" min="0.000001" step="any" data-manual-price placeholder="Manual paper price">',
        '<input type="date" data-manual-price-date>',
        '<input type="time" data-manual-price-time>',
        '<input type="text" data-manual-price-note placeholder="Source or note">',
        '<button class="ticker-chip" data-save-manual-price="' + paperEscape(holding.ticker) + '">Save Price</button>',
        '</div>'
      ].join("") : "";
      return [
        '<tr>',
        '<td>' + paperEscape(holding.ticker) + '</td>',
        '<td>' + paperEscape(holding.quantity) + '</td>',
        '<td>' + paperMoney(holding.averageCost) + '</td>',
        '<td>' + paperMoney(holding.currentPrice) + '<br><small>' + paperEscape(holding.currentPriceLabel) + '</small></td>',
        '<td>' + paperMoney(holding.currentValue) + '</td>',
        '<td>' + paperMoney(holding.unrealisedGain) + '</td>',
        '<td>' + paperEscape(holding.entryDate || "—") + '</td>',
        '<td>' + paperEscape(holding.holdingDays === null ? "—" : holding.holdingDays) + '</td>',
        '<td>' + paperEscape(latestCandidate ? latestCandidate.rating : "—") + '</td>',
        '<td>' + paperEscape(entrySnapshot.deliveryRating || "—") + '</td>',
        '<td>' + paperEscape(entrySnapshot.technicalTrendStatus || "—") + '</td>',
        '<td>' + manual + '<button class="ticker-chip" data-paper-sell="' + paperEscape(holding.ticker) + '">Paper Sell</button></td>',
        '</tr>'
      ].join("");
    }).join("");
  }

  function holdingCards(holdings) {
    return holdings.map(holding => {
      const latestCandidate = computeCandidate(holding.ticker);
      const entrySnapshot = holding.entrySnapshot || {};
      const rows = [
        ["Quantity", holding.quantity],
        ["Average Cost", paperMoney(holding.averageCost)],
        ["Current Paper Price", paperMoney(holding.currentPrice)],
        ["Price date", holding.currentPriceLabel],
        ["Current Value", paperMoney(holding.currentValue)],
        ["Unrealised Gain/Loss", paperMoney(holding.unrealisedGain)],
        ["Entry Date", holding.entryDate || "—"],
        ["Holding Days", holding.holdingDays === null ? "—" : holding.holdingDays],
        ["Latest Delivery Rating", latestCandidate ? latestCandidate.rating : "—"],
        ["Entry Rating", entrySnapshot.deliveryRating || "—"],
        ["Technical Status at Entry", entrySnapshot.technicalTrendStatus || "—"]
      ].map(row => '<div class="data-card-row"><span class="k">' + paperEscape(row[0]) +
        '</span><span class="v">' + paperEscape(row[1]) + '</span></div>').join("");
      const manual = holding.currentPrice === null ? [
        '<div class="paper-manual-price">',
        '<p class="module-sub">No imported price is available. Enter a dated manual paper price.</p>',
        '<input type="number" min="0.000001" step="any" data-manual-price placeholder="Manual paper price">',
        '<input type="date" data-manual-price-date>',
        '<input type="time" data-manual-price-time>',
        '<input type="text" data-manual-price-note placeholder="Source or note">',
        '<button class="ticker-chip" data-save-manual-price="' + paperEscape(holding.ticker) + '">Save Price</button>',
        '</div>'
      ].join("") : "";
      return '<div class="data-card"><div class="data-card-title">' + paperEscape(holding.ticker) +
        '</div>' + rows + manual +
        '<button class="btn" data-paper-sell="' + paperEscape(holding.ticker) + '">Paper Sell</button></div>';
    }).join("");
  }

  function renderPaperTopSummary(summary) {
    return '<div class="ratio-grid paper-summary">' +
      paperMetric("Starting paper capital", paperMoney(summary.config.startingCapital)) +
      paperMetric("Available paper cash", paperMoney(summary.availableCash)) +
      paperMetric("Invested amount", paperMoney(summary.investedCost)) +
      paperMetric("Current paper value", paperMoney(summary.currentValue)) +
      paperMetric("Realised profit/loss", paperMoney(summary.realisedGain), summary.realisedGain < 0 ? "overview-loss" : "overview-gain") +
      paperMetric("Unrealised profit/loss", paperMoney(summary.unrealisedGain), summary.unrealisedGain < 0 ? "overview-loss" : "overview-gain") +
      paperMetric("Total return", paperPct(summary.totalReturnPct)) +
      paperMetric("Open holdings", String(summary.openHoldings)) +
    '</div>';
  }

  function bindCapitalConfig(container) {
    const save = container.querySelector("#paper-save-config");
    if (!save) return;
    save.addEventListener("click", async () => {
      const input = {
        startingCapital: Number(container.querySelector("#paper-starting-capital").value),
        maxAllocationPct: Number(container.querySelector("#paper-max-allocation").value),
        maxOpenHoldings: Number(container.querySelector("#paper-max-open").value)
      };
      const error = PaperDelivery.validateConfig(input);
      if (error) { App.showStatus(error, "error"); return; }
      WealthData.updatePaperDeliveryConfig(input);
      await App.saveNow(false);
      showCapitalConfig = false;
      App.showStatus("Paper capital settings saved", "ok");
      refreshPaper();
    });
  }

  function renderPaperSummaryScreen(container) {
    const summary = PaperDelivery.summary(WealthData.get());
    const empty = summary.openHoldings === 0 && !summary.latestTransaction;
    container.innerHTML = [
      renderPaperTopSummary(summary),
      '<div class="paper-action-row">',
      '<button class="btn" id="paper-change-capital">Set / Change Paper Capital</button>',
      '<button class="ticker-chip" id="paper-go-delivery">Go to Delivery Screener</button>',
      '</div>',
      showCapitalConfig ? renderCapitalConfig(summary.config) : '',
      empty ? '<p class="overview-empty paper-empty-message">No Paper Delivery positions yet.<br>Set paper capital, then select a company from Delivery and use Paper Buy.</p>' :
        '<p class="overview-note">Simulation only. Paper values remain separate from the real Portfolio.</p>'
    ].join("");
    container.querySelector("#paper-change-capital").addEventListener("click", () => {
      showCapitalConfig = !showCapitalConfig;
      refreshPaper();
    });
    container.querySelector("#paper-go-delivery").addEventListener("click", () => App.switchTo("delivery"));
    bindCapitalConfig(container);
  }

  function openPaperBuy(ticker) {
    pendingBuyTicker = String(ticker || "").toUpperCase();
    pendingSellTicker = null;
    activePaperSection = "portfolio";
    App.switchTo("paper-trading");
  }

  function renderPaperTrading(container) {
    paperContainer = container;
    container.innerHTML = [
      '<div class="module-header"><h2>Paper Trading</h2><p class="module-sub">A separate simulation workspace for testing Delivery selections. It never places an order or changes the real Portfolio.</p></div>',
      '<div class="ticket-tabs paper-section-tabs">',
      PAPER_SECTIONS.map(section => '<button class="ticker-chip ' +
        (section[0] === activePaperSection ? 'active' : '') + '" data-paper-section="' +
        section[0] + '">' + section[1] + '</button>').join(''),
      '</div><div id="paper-section-content"></div>'
    ].join("");
    container.querySelectorAll("[data-paper-section]").forEach(button => {
      button.addEventListener("click", () => {
        activePaperSection = button.dataset.paperSection;
        renderPaperTrading(container);
      });
    });
    const content = container.querySelector("#paper-section-content");
    if (activePaperSection === "portfolio") renderPaperPortfolio(content);
    else if (activePaperSection === "transactions") renderPaperTransactions(content);
    else if (activePaperSection === "performance") renderPerformanceReview(content);
    else renderPaperSummaryScreen(content);
  }

  function renderPaperPortfolio(container) {
    const state = WealthData.get();
    const summary = PaperDelivery.summary(state);
    const holdings = summary.portfolio.holdings;
    const buyCandidate = pendingBuyTicker ? computeCandidate(pendingBuyTicker) : null;
    const buyPrice = buyCandidate
      ? PaperDelivery.getCurrentPrice(buyCandidate.ticker, state) : null;
    const sellHolding = pendingSellTicker
      ? holdings.find(holding => holding.ticker === pendingSellTicker) : null;
    const sellPrice = sellHolding
      ? PaperDelivery.getCurrentPrice(sellHolding.ticker, state) : null;

    container.innerHTML = [
      '<div class="section-head paper-section-head"><span class="section-title">Paper Portfolio</span></div>',
      summary.config.startingCapital <= 0 ? '<p class="warn-inline">Set paper capital from Summary before recording a Paper Buy.</p>' : '',
      renderBuyForm(buyCandidate, buyPrice || {}),
      renderSellForm(sellHolding, sellPrice || {}),
      '<div class="section-head paper-section-head"><span class="section-title">Open Paper Holdings</span></div>',
      holdings.length ? [
        '<div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Quantity</th><th>Average Cost</th><th>Current Paper Price</th><th>Current Value</th><th>Unrealised G/L</th><th>Entry Date</th><th>Days</th><th>Latest Rating</th><th>Entry Rating</th><th>Entry Technical</th><th>Actions</th></tr></thead><tbody>',
        holdingRows(holdings),
        '</tbody></table></div>',
        '<div class="card-list">', holdingCards(holdings), '</div>'
      ].join("") : '<p class="overview-empty">No Paper Delivery positions yet.<br>Set paper capital, then select a company from Delivery and use Paper Buy.</p>'
    ].join("");

    const cancelBuy = container.querySelector("#paper-cancel-buy");
    if (cancelBuy) cancelBuy.addEventListener("click", () => {
      pendingBuyTicker = null;
      refreshPaper();
    });
    const confirmBuy = container.querySelector("#paper-confirm-buy");
    if (confirmBuy) confirmBuy.addEventListener("click", async () => {
      if (submitting) return;
      submitting = true;
      confirmBuy.disabled = true;
      const evidence = selectedPriceEvidence(container, "buy", buyPrice);
      if (!evidence.ok) {
        submitting = false;
        confirmBuy.disabled = false;
        App.showStatus(evidence.error, "error");
        return;
      }
      const input = {
        ticker: buyCandidate.ticker,
        transactionType: "BUY",
        transactionDate: container.querySelector("#paper-buy-date").value,
        quantity: container.querySelector("#paper-buy-quantity").value,
        price: evidence.price,
        priceSource: evidence.priceSource,
        priceTimestamp: evidence.priceTimestamp,
        priceStatus: evidence.priceStatus,
        quoteAgeSeconds: evidence.quoteAgeSeconds,
        manualPriceNote: evidence.manualPriceNote,
        charges: container.querySelector("#paper-buy-charges").value,
        reason: container.querySelector("#paper-buy-reason").value,
        notes: container.querySelector("#paper-buy-notes").value
      };
      const plan = PaperDelivery.createTransactionPlan(
        WealthData.getPaperDeliveryTransactions(),
        WealthData.getPaperDeliveryConfig(),
        input,
        { candidate: buyCandidate }
      );
      if (!plan.ok) {
        submitting = false;
        confirmBuy.disabled = false;
        App.showStatus(plan.error, "error");
        return;
      }
      WealthData.addPaperDeliveryTransaction(plan.transaction);
      await App.saveNow(false);
      pendingBuyTicker = null;
      submitting = false;
      App.showStatus("Paper BUY recorded", "ok");
      refreshPaper();
    });

    const cancelSell = container.querySelector("#paper-cancel-sell");
    if (cancelSell) cancelSell.addEventListener("click", () => {
      pendingSellTicker = null;
      refreshPaper();
    });
    const confirmSell = container.querySelector("#paper-confirm-sell");
    if (confirmSell) confirmSell.addEventListener("click", async () => {
      if (submitting) return;
      submitting = true;
      confirmSell.disabled = true;
      const evidence = selectedPriceEvidence(container, "sell", sellPrice);
      if (!evidence.ok) {
        submitting = false;
        confirmSell.disabled = false;
        App.showStatus(evidence.error, "error");
        return;
      }
      const input = {
        ticker: sellHolding.ticker,
        transactionType: "SELL",
        transactionDate: container.querySelector("#paper-sell-date").value,
        quantity: container.querySelector("#paper-sell-quantity").value,
        price: evidence.price,
        priceSource: evidence.priceSource,
        priceTimestamp: evidence.priceTimestamp,
        priceStatus: evidence.priceStatus,
        quoteAgeSeconds: evidence.quoteAgeSeconds,
        manualPriceNote: evidence.manualPriceNote,
        charges: container.querySelector("#paper-sell-charges").value,
        reason: container.querySelector("#paper-sell-reason").value,
        notes: container.querySelector("#paper-sell-notes").value
      };
      const plan = PaperDelivery.createTransactionPlan(
        WealthData.getPaperDeliveryTransactions(),
        WealthData.getPaperDeliveryConfig(),
        input
      );
      if (!plan.ok) {
        submitting = false;
        confirmSell.disabled = false;
        App.showStatus(plan.error, "error");
        return;
      }
      WealthData.addPaperDeliveryTransaction(plan.transaction);
      await App.saveNow(false);
      pendingSellTicker = null;
      submitting = false;
      App.showStatus("Paper SELL recorded", "ok");
      refreshPaper();
    });

    container.querySelectorAll("[data-paper-sell]").forEach(button => {
      button.addEventListener("click", () => {
        pendingSellTicker = button.dataset.paperSell;
        pendingBuyTicker = null;
        refreshPaper();
      });
    });
    bindPriceSelectors(container);
    container.querySelectorAll("[data-save-manual-price]").forEach(button => {
      button.addEventListener("click", async () => {
        const ticker = button.dataset.saveManualPrice;
        const pricePanel = button.closest(".paper-manual-price");
        const price = pricePanel.querySelector("[data-manual-price]").value;
        const date = pricePanel.querySelector("[data-manual-price-date]").value;
        const time = pricePanel.querySelector("[data-manual-price-time]").value;
        const note = pricePanel.querySelector("[data-manual-price-note]").value;
        const evidence = PaperQuotes.manualEvidence({
          price: price, observedDate: date, observedTime: time, sourceNote: note
        });
        const error = evidence.ok ? null : evidence.error;
        if (error) { App.showStatus(error, "error"); return; }
        const config = WealthData.getPaperDeliveryConfig();
        WealthData.updatePaperDeliveryConfig({
          manualPrices: {
            ...config.manualPrices,
            [ticker]: {
              price: Number(price),
              date: date,
              timestamp: evidence.priceTimestamp,
              source: evidence.priceSource,
              note: note.trim(),
              updatedAt: new Date().toISOString()
            }
          }
        });
        await App.saveNow(false);
        App.showStatus("Manual paper price saved", "ok");
        refreshPaper();
      });
    });
  }

  function transactionTableRows(transactions) {
    return transactions.map(transaction => [
      '<tr>',
      '<td>' + paperEscape(transaction.transactionDate || "—") + '</td>',
      '<td>' + paperEscape(transaction.ticker) + '</td>',
      '<td>' + paperEscape(transaction.transactionType) + '</td>',
      '<td>' + paperEscape(transaction.quantity) + '</td>',
      '<td>' + paperMoney(transaction.price) + '</td>',
      '<td>' + paperMoney(transaction.charges) + '</td>',
      '<td>' + paperMoney(transaction.grossAmount) + '</td>',
      '<td>' + paperMoney(transaction.netAmount) + '</td>',
      '<td>' + paperMoney(transaction.realisedGain) + '</td>',
      '<td>' + paperEscape(transaction.priceSource || "Legacy — evidence unavailable") + '<br><small>' +
        paperEscape(transaction.priceTimestamp || "—") + ' · ' +
        paperEscape(transaction.priceStatus || "—") + '</small></td>',
      '<td>' + paperEscape(transaction.notes || "—") + '</td>',
      '<td><button class="ticker-chip holding-delete" data-delete-paper="' + paperEscape(transaction.id) + '">Delete correction</button></td>',
      '</tr>'
    ].join("")).join("");
  }

  function transactionCards(transactions) {
    return transactions.map(transaction => {
      const rows = [
        ["Date", transaction.transactionDate || "—"],
        ["Type", transaction.transactionType],
        ["Quantity", transaction.quantity],
        ["Price", paperMoney(transaction.price)],
        ["Charges", paperMoney(transaction.charges)],
        ["Gross Amount", paperMoney(transaction.grossAmount)],
        ["Net Amount", paperMoney(transaction.netAmount)],
        ["Realised Gain/Loss", paperMoney(transaction.realisedGain)],
        ["Price Evidence", transaction.priceSource || "Legacy — evidence unavailable"],
        ["Price Timestamp", transaction.priceTimestamp || "—"],
        ["Price Status", transaction.priceStatus || "—"],
        ["Quote Age", PaperQuotes.formatAge(transaction.quoteAgeSeconds)],
        ["Notes", transaction.notes || "—"]
      ].map(row => '<div class="data-card-row"><span class="k">' + paperEscape(row[0]) +
        '</span><span class="v">' + paperEscape(row[1]) + '</span></div>').join("");
      return '<div class="data-card"><div class="data-card-title">' +
        paperEscape(transaction.ticker) + ' · ' + paperEscape(transaction.transactionType) +
        '</div>' + rows + '<button class="ticker-chip holding-delete" data-delete-paper="' +
        paperEscape(transaction.id) + '">Delete correction</button></div>';
    }).join("");
  }

  function renderPaperTransactions(container) {
    const transactions = PaperDelivery.replay(WealthData.getPaperDeliveryTransactions())
      .transactions.slice().sort((a, b) => {
        const dateCompare = String(b.transactionDate || "").localeCompare(String(a.transactionDate || ""));
        return dateCompare || String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
      });
    container.innerHTML = [
      '<div class="module-header"><h2>Paper Transactions</h2><p class="module-sub">Permanent paper BUY/SELL history, newest first. It never appears in the real Portfolio ledger.</p></div>',
      '<div class="paper-action-row"><button class="btn" id="paper-export-csv">Export Paper Transactions CSV</button></div>',
      '<p class="warn-inline">Deleting a paper record is not the same as recording a paper sale. Delete is only for correcting bad data.</p>',
      transactions.length ? [
        '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Ticker</th><th>Type</th><th>Quantity</th><th>Price</th><th>Charges</th><th>Gross</th><th>Net</th><th>Realised G/L</th><th>Price Evidence</th><th>Notes</th><th>Correction</th></tr></thead><tbody>',
        transactionTableRows(transactions),
        '</tbody></table></div><div class="card-list">',
        transactionCards(transactions),
        '</div>'
      ].join("") : '<p class="overview-empty">No paper transactions recorded.</p>'
    ].join("");

    container.querySelector("#paper-export-csv").addEventListener("click", () => {
      const blob = new Blob([PaperDelivery.csv(WealthData.getPaperDeliveryTransactions())], {
        type: "text/csv;charset=utf-8"
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "delivery-paper-transactions-" + PaperDelivery.localISODate() + ".csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    });
    container.querySelectorAll("[data-delete-paper]").forEach(button => {
      button.addEventListener("click", async () => {
        if (!confirm("Deleting a paper record is not the same as recording a paper sale. Delete this record only as a data correction?")) return;
        const rawId = button.dataset.deletePaper;
        const transaction = WealthData.getPaperDeliveryTransactions()
          .find(item => String(item.id) === rawId);
        if (!transaction) return;
        const check = PaperDelivery.canDeleteTransaction(
          WealthData.getPaperDeliveryTransactions(), transaction.id
        );
        if (!check.ok) {
          App.showStatus("Cannot delete this BUY because later SELL records depend on it", "error");
          return;
        }
        WealthData.removePaperDeliveryTransaction(transaction.id);
        await App.saveNow(false);
        App.showStatus("Paper record deleted as a correction", "ok");
        refreshPaper();
      });
    });
  }

  function groupRows(groups) {
    const entries = Object.entries(groups);
    if (!entries.length) return '<p class="overview-empty">No closed positions available.</p>';
    return '<div class="overview-list">' + entries.map(entry =>
      '<div class="overview-list-row"><span>' + paperEscape(entry[0]) +
      '</span><strong>' + entry[1].count + ' closed · ' +
      paperPct(entry[1].averageReturnPct) + ' average</strong></div>'
    ).join("") + '</div>';
  }

  function renderPerformanceReview(container) {
    const review = PaperDelivery.performanceReview(WealthData.get());
    const best = review.bestTrade
      ? review.bestTrade.ticker + " · " + paperMoney(review.bestTrade.realisedGain) : "—";
    const worst = review.worstTrade
      ? review.worstTrade.ticker + " · " + paperMoney(review.worstTrade.realisedGain) : "—";
    container.innerHTML = [
      '<div class="module-header"><h2>Performance Review</h2><p class="module-sub">Review paper outcomes after 1–3 months. Small samples are descriptive only and are not statistically significant.</p></div>',
      '<div class="ratio-grid paper-summary">',
      paperMetric("Total Paper Trades", String(review.totalPaperTrades)),
      paperMetric("Open Positions", String(review.openPositions)),
      paperMetric("Closed Positions", String(review.closedPositions)),
      paperMetric("Profitable Closed", String(review.profitableClosedPositions)),
      paperMetric("Losing Closed", String(review.losingClosedPositions)),
      paperMetric("Win Rate", paperPct(review.winRate)),
      paperMetric("Average Realised Return", paperPct(review.averageRealisedReturn)),
      paperMetric("Best Trade", best),
      paperMetric("Worst Trade", worst),
      paperMetric("Maximum Drawdown", paperPct(review.maximumDrawdown)),
      paperMetric("Average Holding Days", paperNumber(review.averageHoldingDays, 1)),
      paperMetric("Current Unrealised Return", paperPct(review.currentUnrealisedReturn)),
      paperMetric("Total Realised Gain/Loss", paperMoney(review.totalRealisedGain)),
      paperMetric("Trades Still Open", String(review.openTrades)),
      '</div>',
      '<div class="paper-review-grid">',
      '<section class="overview-section"><div class="section-head"><span class="section-title">By Delivery Rating at Entry</span></div>' + groupRows(review.byEntryRating) + '</section>',
      '<section class="overview-section"><div class="section-head"><span class="section-title">By Technical Trend at Entry</span></div>' + groupRows(review.byTechnicalStatus) + '</section>',
      '<section class="overview-section"><div class="section-head"><span class="section-title">By Valuation Band at Entry</span></div>' + groupRows(review.byValuationBand) + '</section>',
      '<section class="overview-section"><div class="section-head"><span class="section-title">Forward Returns</span></div><div class="overview-list">',
      '<div class="overview-list-row"><span>30-day return</span><strong>' + paperPct(review.horizon30.averageReturnPct) + ' · ' + review.horizon30.count + ' samples</strong></div>',
      '<div class="overview-list-row"><span>60-day return</span><strong>' + paperPct(review.horizon60.averageReturnPct) + ' · ' + review.horizon60.count + ' samples</strong></div>',
      '<div class="overview-list-row"><span>90-day return</span><strong>' + paperPct(review.horizon90.averageReturnPct) + ' · ' + review.horizon90.count + ' samples</strong></div>',
      '</div></section></div>',
      '<p class="warn-inline">Paper results are for model evaluation and do not guarantee future returns.</p>'
    ].join("");
  }

  return { render, renderPaperTrading, openPaperBuy, computeCandidate, businessQualityPillar, financialStrengthPillar, valuationPillar, technicalTrendPillar, riskPillar, computeOverall, computeRating };
})();

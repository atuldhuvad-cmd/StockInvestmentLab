/* ============================================================================
   Delivery paper-price evidence
   ============================================================================
   Pure validation plus a read-only client for the local Angel One quote helper.
   Credentials and SmartAPI session tokens never enter the browser.
============================================================================ */

const PaperQuotes = (function () {
  const HELPER_URL = "http://127.0.0.1:8765";
  const CURRENT_LIMIT_SECONDS = 5 * 60;
  const FUTURE_TOLERANCE_SECONDS = 60;

  function finiteNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function normalizeTicker(value) {
    return String(value || "").trim().toUpperCase()
      .replace(/^NSE:/, "").replace(/\.NS$/, "");
  }

  function timestampMilliseconds(value) {
    if (typeof value !== "string" || !value.trim()) return null;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatAge(seconds) {
    const value = finiteNumber(seconds);
    if (value === null || value < 0) return "—";
    if (value < 60) return Math.floor(value) + " sec";
    if (value < 3600) return Math.floor(value / 60) + " min";
    if (value < 86400) return Math.floor(value / 3600) + " hr";
    return Math.floor(value / 86400) + " day" + (value < 172800 ? "" : "s");
  }

  function classifyQuote(raw, now = new Date()) {
    const price = finiteNumber(raw && raw.price);
    const quoteTimestamp = raw && raw.quoteTimestamp;
    const timestamp = timestampMilliseconds(quoteTimestamp);
    const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
    if (price === null || price <= 0 || timestamp === null || !Number.isFinite(nowMs)) {
      return { ok: false, usable: false, status: "Stale", error: "Quote response is missing a valid price or exchange timestamp" };
    }
    const ageSeconds = Math.max(0, (nowMs - timestamp) / 1000);
    if (timestamp - nowMs > FUTURE_TOLERANCE_SECONDS * 1000) {
      return { ok: false, usable: false, status: "Stale", error: "Quote timestamp is in the future" };
    }
    const responseSymbol = normalizeTicker(raw.symbol || raw.ticker);
    const expectedSymbol = normalizeTicker(raw.expectedSymbol || responseSymbol);
    if (!responseSymbol || (expectedSymbol && responseSymbol !== expectedSymbol)) {
      return { ok: false, usable: false, status: "Unavailable", error: "Quote response symbol does not match the requested symbol" };
    }
    const marketOpen = raw.marketStatus === "Open" || raw.marketOpen === true;
    const status = marketOpen
      ? (ageSeconds <= CURRENT_LIMIT_SECONDS ? "Current" : "Stale")
      : "Market Closed — Latest Available Price";
    return {
      ok: true,
      ticker: responseSymbol,
      price: price,
      quoteTimestamp: quoteTimestamp,
      source: String(raw.source || "Angel One SmartAPI"),
      ageSeconds: Math.round(ageSeconds),
      ageLabel: formatAge(ageSeconds),
      marketOpen: marketOpen,
      status: status,
      usable: status !== "Stale"
    };
  }

  function manualEvidence(input, now = new Date()) {
    const price = finiteNumber(input && input.price);
    const observedDate = String(input && input.observedDate || "").trim();
    const observedTime = String(input && input.observedTime || "").trim();
    const note = String(input && input.sourceNote || "").trim();
    if (price === null || price <= 0) return { ok: false, error: "Manual price must be greater than zero" };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(observedDate) || !/^\d{2}:\d{2}$/.test(observedTime)) {
      return { ok: false, error: "Manual price requires an observed date and time" };
    }
    const dateParts = observedDate.split("-").map(Number);
    const timeParts = observedTime.split(":").map(Number);
    const calendarDate = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
    if (calendarDate.getUTCFullYear() !== dateParts[0] ||
        calendarDate.getUTCMonth() !== dateParts[1] - 1 ||
        calendarDate.getUTCDate() !== dateParts[2] ||
        timeParts[0] > 23 || timeParts[1] > 59) {
      return { ok: false, error: "Manual observed date and time must be valid and cannot be in the future" };
    }
    if (!note) return { ok: false, error: "Manual price requires a source or note" };
    const timestamp = observedDate + "T" + observedTime + ":00+05:30";
    const timestampMs = timestampMilliseconds(timestamp);
    const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
    if (timestampMs === null || timestampMs - nowMs > FUTURE_TOLERANCE_SECONDS * 1000) {
      return { ok: false, error: "Manual observed date and time must be valid and cannot be in the future" };
    }
    const ageSeconds = Math.max(0, Math.round((nowMs - timestampMs) / 1000));
    return {
      ok: true,
      price: price,
      priceSource: "Manual price · " + note,
      priceTimestamp: timestamp,
      quoteAgeSeconds: ageSeconds,
      priceStatus: "Manual price"
    };
  }

  function transactionEvidence(quote, now = new Date()) {
    const classified = classifyQuote(quote, now);
    if (!classified.ok) return classified;
    if (!classified.usable) {
      return { ok: false, error: "The latest market-hours quote is older than five minutes. Refresh it before saving." };
    }
    return {
      ok: true,
      price: classified.price,
      priceSource: classified.marketOpen
        ? classified.source : classified.source + " · Latest Close",
      priceTimestamp: classified.quoteTimestamp,
      quoteAgeSeconds: classified.ageSeconds,
      priceStatus: classified.status
    };
  }

  function validateStoredEvidence(input, now = new Date()) {
    const price = finiteNumber(input && input.price);
    const source = String(input && input.priceSource || "").trim();
    const status = String(input && input.priceStatus || "").trim();
    const timestamp = timestampMilliseconds(input && input.priceTimestamp);
    const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
    if (price === null || price <= 0) return "Price must be greater than zero";
    if (!source || timestamp === null || !status) return "Price source, timestamp, and status are required";
    if (timestamp - nowMs > FUTURE_TOLERANCE_SECONDS * 1000) return "Price timestamp cannot be in the future";
    if (/imported.*csv|imported close/i.test(source) && status === "Current") {
      return "Imported daily CSV prices cannot be labelled Current";
    }
    if (status === "Stale") return "Stale market-hours quotes cannot be used";
    if (status === "Current") {
      const ageSeconds = Math.max(0, (nowMs - timestamp) / 1000);
      if (ageSeconds > CURRENT_LIMIT_SECONDS) return "Current market-hours quotes must be five minutes old or less";
    } else if (status !== "Market Closed — Latest Available Price" &&
        status !== "Market Closed / Latest Close" && status !== "Manual price" &&
        status !== "Imported historical close") {
      return "Price status is invalid";
    }
    return null;
  }

  async function fetchLatest(ticker, options = {}) {
    const symbol = normalizeTicker(ticker);
    if (!symbol) throw new Error("Ticker is required");
    const fetchFn = options.fetchFn || fetch;
    let response;
    try {
      response = await fetchFn(HELPER_URL + "/quote?symbol=" + encodeURIComponent(symbol), {
      method: "GET",
      cache: "no-store"
      });
    } catch (_) {
      throw new Error("Quote service unavailable — use a dated manual price");
    }
    let payload = null;
    try { payload = await response.json(); } catch (_) { /* handled below */ }
    if (!response.ok || !payload || payload.ok === false || payload.status === "Unavailable") {
      throw new Error(payload && payload.errorMessage
        ? payload.errorMessage
        : "Local quote helper is unavailable. Start it, then try again.");
    }
    payload.expectedSymbol = symbol;
    const classified = classifyQuote(payload, options.now || new Date());
    if (!classified.ok) throw new Error(classified.error);
    return classified;
  }

  return {
    HELPER_URL: HELPER_URL,
    CURRENT_LIMIT_SECONDS: CURRENT_LIMIT_SECONDS,
    normalizeTicker: normalizeTicker,
    formatAge: formatAge,
    classifyQuote: classifyQuote,
    manualEvidence: manualEvidence,
    transactionEvidence: transactionEvidence,
    validateStoredEvidence: validateStoredEvidence,
    fetchLatest: fetchLatest
  };
})();

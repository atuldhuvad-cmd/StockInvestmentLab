/* ============================================================================
   Offline Price History
   ============================================================================
   Pure CSV parsing, symbol normalization, and local technical calculations.
   No network access and no generated market data. Imported rows are stored
   unchanged apart from validation, date de-duplication, and chronological
   sorting.
============================================================================ */

const PriceHistory = (function () {

  const REQUIRED = ["date", "open", "high", "low", "close", "volume"];

  function normalizeSymbol(value) {
    if (value === undefined || value === null) return "";
    let symbol = String(value).trim().toUpperCase();
    if (symbol.includes(":")) symbol = symbol.split(":").pop();
    symbol = symbol.replace(/(?:_|-)(?:1Y|2Y|3Y|5Y|10Y|MAX|PRICE|PRICES|HISTORY)$/i, "");
    symbol = symbol.replace(/\.(NS|BO)$/i, "");
    return symbol.trim();
  }

  function inferSymbolFromFilename(fileName) {
    if (!fileName) return "";
    const base = String(fileName).split(/[\\/]/).pop().replace(/\.csv$/i, "");
    return normalizeSymbol(base);
  }

  function parseCSVLine(line) {
    const cells = [];
    let value = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (quoted && line[i + 1] === '"') { value += '"'; i++; }
        else quoted = !quoted;
      } else if (char === "," && !quoted) {
        cells.push(value.trim()); value = "";
      } else value += char;
    }
    cells.push(value.trim());
    return cells;
  }

  function normalizeHeader(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function fieldForHeader(value) {
    const header = normalizeHeader(value);
    if (["date", "datetime", "timestamp"].includes(header)) return "date";
    if (header === "open") return "open";
    if (header === "high") return "high";
    if (header === "low") return "low";
    if (header === "close") return "close";
    if (header === "volume") return "volume";
    return null;
  }

  function parseDate(value) {
    const match = String(value || "").trim().match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
    if (!match) return null;
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  function parseNumber(value) {
    if (value === undefined || value === null || String(value).trim() === "") return null;
    const number = Number(String(value).replaceAll(",", "").trim());
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  function findHeader(table) {
    for (let rowIndex = 0; rowIndex < Math.min(table.length, 10); rowIndex++) {
      const fields = table[rowIndex].map(fieldForHeader);
      if (REQUIRED.every(field => fields.includes(field))) {
        const indexes = {};
        fields.forEach((field, index) => { if (field && indexes[field] === undefined) indexes[field] = index; });
        return { indexes, dataStart: rowIndex + 1, sourceSymbol: "" };
      }
    }

    const first = table[0] || [];
    if (normalizeHeader(first[0]) === "price") {
      const fields = first.map(fieldForHeader);
      if (["open", "high", "low", "close", "volume"].every(field => fields.includes(field))) {
        const indexes = { date: 0 };
        fields.forEach((field, index) => { if (field) indexes[field] = index; });
        const tickerRow = table.find(row => normalizeHeader(row[0]) === "ticker");
        const sourceSymbol = tickerRow ? tickerRow.slice(1).find(Boolean) || "" : "";
        let dataStart = 1;
        while (dataStart < table.length && !parseDate(table[dataStart][0])) dataStart++;
        return { indexes, dataStart, sourceSymbol };
      }
    }
    return null;
  }

  function parseCSV(text, options = {}) {
    const lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim() !== "");
    if (!lines.length) return { ok: false, error: "CSV is empty", rows: [] };
    const table = lines.map(parseCSVLine);
    const header = findHeader(table);
    if (!header) return { ok: false, error: "Missing required columns: Date, Open, High, Low, Close, Volume", rows: [] };

    const byDate = new Map();
    let rejectedRows = 0;
    let duplicateDates = 0;
    for (let i = header.dataStart; i < table.length; i++) {
      const source = table[i];
      const date = parseDate(source[header.indexes.date]);
      const open = parseNumber(source[header.indexes.open]);
      const high = parseNumber(source[header.indexes.high]);
      const low = parseNumber(source[header.indexes.low]);
      const close = parseNumber(source[header.indexes.close]);
      const volume = parseNumber(source[header.indexes.volume]);
      if (!date || [open, high, low, close, volume].some(value => value === null)) {
        rejectedRows++;
        continue;
      }
      if (byDate.has(date)) duplicateDates++;
      byDate.set(date, { date, open, high, low, close, volume });
    }

    const rows = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    const sourceSymbol = normalizeSymbol(options.symbol || header.sourceSymbol || inferSymbolFromFilename(options.fileName));
    return { ok: true, rows, rejectedRows, duplicateDates, symbol: sourceSymbol };
  }

  function movingAverage(rows, period, field = "close") {
    if (!Array.isArray(rows) || rows.length < period) return null;
    const values = rows.slice(-period).map(row => Number(row[field]));
    return values.every(Number.isFinite) ? values.reduce((sum, value) => sum + value, 0) / period : null;
  }

  function rsi14(rows) {
    if (!Array.isArray(rows) || rows.length < 15) return null;
    const closes = rows.map(row => Number(row.close));
    if (!closes.every(Number.isFinite)) return null;
    let gain = 0, loss = 0;
    for (let i = 1; i <= 14; i++) {
      const change = closes[i] - closes[i - 1];
      if (change >= 0) gain += change; else loss -= change;
    }
    let averageGain = gain / 14;
    let averageLoss = loss / 14;
    for (let i = 15; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      averageGain = (averageGain * 13 + Math.max(change, 0)) / 14;
      averageLoss = (averageLoss * 13 + Math.max(-change, 0)) / 14;
    }
    if (averageLoss === 0) return averageGain === 0 ? 50 : 100;
    const relativeStrength = averageGain / averageLoss;
    return 100 - (100 / (1 + relativeStrength));
  }

  function statusForScore(score) {
    if (score === null || score === undefined) return "Not Evaluated";
    if (score >= 80) return "Strong Trend";
    if (score >= 60) return "Constructive";
    if (score >= 40) return "Neutral / Wait";
    return "Weak Trend";
  }

  function calculate(rows) {
    const cleanRows = Array.isArray(rows) ? rows : [];
    const rowCount = cleanRows.length;
    const coverage = rowCount >= 200 ? "Complete" : rowCount >= 50 ? "Limited" : "Missing";
    const latest = rowCount ? cleanRows[rowCount - 1] : null;
    const latestClose = latest ? latest.close : null;
    const dma50 = movingAverage(cleanRows, 50);
    const dma200 = movingAverage(cleanRows, 200);
    const rsi = rsi14(cleanRows);
    const yearRows = cleanRows.slice(-252);
    const high52Week = yearRows.length ? Math.max(...yearRows.map(row => row.high)) : null;
    const distanceFrom52WeekHigh = latestClose !== null && high52Week > 0 ? ((latestClose - high52Week) / high52Week) * 100 : null;
    const averageVolume20 = movingAverage(cleanRows, 20, "volume");
    const latestVolume = latest ? latest.volume : null;

    const conditions = [
      { key: "above200", label: "Price above 200 DMA", points: 25, passed: latestClose !== null && dma200 !== null && latestClose > dma200 },
      { key: "above50", label: "Price above 50 DMA", points: 20, passed: latestClose !== null && dma50 !== null && latestClose > dma50 },
      { key: "golden", label: "50 DMA above 200 DMA", points: 20, passed: dma50 !== null && dma200 !== null && dma50 > dma200 },
      { key: "rsi", label: "RSI 14 between 45 and 70", points: 15, passed: rsi !== null && rsi >= 45 && rsi <= 70 },
      { key: "nearHigh", label: "Price within 20% of 52-week high", points: 10, passed: distanceFrom52WeekHigh !== null && distanceFrom52WeekHigh >= -20 },
      { key: "volume", label: "Latest volume at or above 20-day average", points: 10, passed: latestVolume !== null && averageVolume20 !== null && latestVolume >= averageVolume20 }
    ];
    const score = coverage === "Complete" ? conditions.reduce((sum, condition) => sum + (condition.passed ? condition.points : 0), 0) : null;

    return {
      rowCount, coverage, score, status: statusForScore(score), latestDate: latest ? latest.date : null,
      latestClose, dma50, dma200, priceAbove50DMA: latestClose !== null && dma50 !== null ? latestClose > dma50 : null,
      priceAbove200DMA: latestClose !== null && dma200 !== null ? latestClose > dma200 : null,
      dma50Above200DMA: dma50 !== null && dma200 !== null ? dma50 > dma200 : null,
      rsi14: rsi, high52Week, distanceFrom52WeekHigh, averageVolume20, latestVolume,
      latestVolumeVs20DayAverage: latestVolume !== null && averageVolume20 !== null && averageVolume20 > 0 ? latestVolume / averageVolume20 : null,
      conditions
    };
  }

  return {
    normalizeSymbol, inferSymbolFromFilename, parseCSV, parseDate, parseNumber,
    movingAverage, rsi14, calculate, statusForScore
  };
})();

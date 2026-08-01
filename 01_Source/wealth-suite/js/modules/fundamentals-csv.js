/* ============================================================================
   Fundamentals CSV Import/Export Engine
   ============================================================================ */

const FundamentalsCsv = (function () {
  const CSV_HEADERS = [
    "Ticker", "Period", "ROE_Pct", "ROCE_Pct", "Debt_Equity", "PE_Ratio",
    "Rev_CAGR_Pct", "Earn_CAGR_Pct", "Promoter_Hold_Pct", "Promoter_Pledge_Pct",
    "FCF_Status", "Econ_Moat", "Pricing_Power", "Cap_Allocation", "Mgmt_Quality",
    "Source_Name", "Source_URL", "Evidence_Date", "Review_Status"
  ];

  function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/[&<>"']/g, function(m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function exportTemplate() {
    const headerRow = CSV_HEADERS.join(",");
    const exampleRow = [
      "DIXON", "FY26", "", "", "", "",
      "", "", "", "",
      "", "", "", "", "",
      "", "", "", ""
    ].join(",");

    const csvContent = "data:text/csv;charset=utf-8," + headerRow + "\n" + exampleRow;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "fundamentals_enrollment_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function parseCsvString(csvText) {
    const rows = [];
    let currentRow = [];
    let currentCell = "";
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      const nextChar = csvText[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentCell += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentCell);
        currentCell = "";
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') i++;
        currentRow.push(currentCell);
        if (currentRow.some(c => c.trim().length > 0)) rows.push(currentRow);
        currentRow = [];
        currentCell = "";
      } else {
        currentCell += char;
      }
    }

    if (currentCell.length > 0 || currentRow.length > 0) {
      currentRow.push(currentCell);
      if (currentRow.some(c => c.trim().length > 0)) rows.push(currentRow);
    }

    if (inQuotes) return { error: "CSV contains unterminated quotes." };
    if (rows.length < 2) return { error: "CSV must contain headers and at least one data row" };

    const headers = rows[0].map((h, index) => (index === 0 ? h.replace(/^\uFEFF/, "") : h).trim());
    if (headers.length !== CSV_HEADERS.length || new Set(headers).size !== headers.length) {
      return { error: `CSV header must contain exactly ${CSV_HEADERS.length} unique columns` };
    }
    const missingHeaders = CSV_HEADERS.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) return { error: `Missing required columns: ${missingHeaders.join(", ")}` };

    const parsedRows = [];
    for (let i = 1; i < rows.length; i++) {
      const vals = rows[i];
      if (vals.length !== CSV_HEADERS.length) {
         return { error: `Row ${i} (Ticker: ${vals[0] || 'Unknown'}) has ${vals.length} columns, expected ${CSV_HEADERS.length}` };
      }
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = (vals[idx] || "").trim();
      });
      parsedRows.push(row);
    }
    return { rows: parsedRows };
  }

  function parseRowValues(row) {
    const parseNum = val => (val === "" || val === null || val === undefined) ? null : parseFloat(val);
    const manualRatios = {
      roe: parseNum(row.ROE_Pct),
      debtEquity: parseNum(row.Debt_Equity),
      pe: parseNum(row.PE_Ratio),
      revenueCagr: parseNum(row.Rev_CAGR_Pct),
      roce: parseNum(row.ROCE_Pct),
      netMargin: null,
      earningsCagr: parseNum(row.Earn_CAGR_Pct),
      promoterHolding: parseNum(row.Promoter_Hold_Pct),
      promoterPledge: parseNum(row.Promoter_Pledge_Pct),
      fcfStatus: row.FCF_Status || null
    };

    const qualitative = {
      economicMoat: parseNum(row.Econ_Moat),
      pricingPower: parseNum(row.Pricing_Power),
      capitalAllocation: parseNum(row.Cap_Allocation),
      managementQuality: parseNum(row.Mgmt_Quality),
      corporateGovernance: null,
      promoterIntegrity: null,
      auditorQuality: null
    };

    const evidence = {
      sourceName: row.Source_Name || "",
      evidenceDate: row.Evidence_Date || "",
      sourceUrl: row.Source_URL || "",
      status: row.Review_Status || "User-entered/unverified"
    };

    return { manualRatios, qualitative, evidence };
  }

  function isSameData(existing, row) {
    if (existing.fyDate !== row.Period) return false;
    const p = parseRowValues(row);

    // Deep compare ratios
    const eR = existing.manualRatios || {};
    const eQ = existing.qualitative || {};
    const eEv = existing.evidence || {};

    const ratiosMatch = Object.keys(p.manualRatios).every(k => p.manualRatios[k] === eR[k]);
    const qualMatch = Object.keys(p.qualitative).every(k => p.qualitative[k] === eQ[k] || (p.qualitative[k] === null && eQ[k] === undefined));
    const evMatch = p.evidence.sourceName === (eEv.sourceName || "") &&
      p.evidence.evidenceDate === (eEv.evidenceDate || "") &&
      p.evidence.sourceUrl === (eEv.sourceUrl || "") &&
      p.evidence.status === (eEv.status || "");

    return ratiosMatch && qualMatch && evMatch;
  }

  function periodKey(period) {
    const match = /^(?:Q([1-4])\s)?FY(\d{2})$/.exec(String(period || ""));
    if (!match) return null;
    return Number(match[2]) * 10 + (match[1] ? Number(match[1]) : 5);
  }

  function buildSnapshot(row, existing, now) {
    const parsed = parseRowValues(row);
    const retained = existing && existing.qualitative ? existing.qualitative : {};
    const qualitative = {
      ...parsed.qualitative,
      corporateGovernance: retained.corporateGovernance ?? null,
      promoterIntegrity: retained.promoterIntegrity ?? null,
      auditorQuality: retained.auditorQuality ?? null
    };
    return {
      savedAt: now,
      fyDate: row.Period,
      manualRatios: parsed.manualRatios,
      qualitative,
      evidence: parsed.evidence
    };
  }

  function applyRow(existing, row, now = new Date().toISOString()) {
    const current = existing || {};
    const history = Array.isArray(current.enrollmentHistory) ? current.enrollmentHistory.slice() : [];
    const incoming = buildSnapshot(row, current, now);
    const activeKey = periodKey(current.fyDate);
    const incomingKey = periodKey(row.Period);

    if (activeKey !== null && incomingKey < activeKey) {
      history.push(incoming);
      return { ...current, enrollmentHistory: history, updatedAt: now };
    }

    if (current.manualRatios || current.evidence) {
      history.push({
        savedAt: current.updatedAt || current.createdAt || now,
        fyDate: current.fyDate || "",
        manualRatios: current.manualRatios || null,
        qualitative: current.qualitative || null,
        evidence: current.evidence || null
      });
    }

    const fieldStatus = {};
    Object.entries({ ...incoming.manualRatios, economicMoat: incoming.qualitative.economicMoat, pricingPower: incoming.qualitative.pricingPower }).forEach(([key, value]) => {
      fieldStatus[key] = value === null ? "Missing" : incoming.evidence.status;
    });
    const record = {
      ticker: row.Ticker,
      fyDate: row.Period,
      fetchedAt: now.slice(0, 10),
      source: incoming.evidence.sourceName,
      manualRatios: incoming.manualRatios,
      qualitative: incoming.qualitative,
      evidence: incoming.evidence,
      fieldStatus,
      enrollmentHistory: history,
      createdAt: current.createdAt || now,
      updatedAt: now,
      years: current.years || []
    };
    const effectiveStatus = CompanyCalculations.evidenceStatus(record);
    Object.keys(fieldStatus).forEach(key => {
      if (fieldStatus[key] !== "Missing" && effectiveStatus === "Stale") fieldStatus[key] = "Stale";
    });
    return record;
  }

  function classifyRow(row, rowIndex, rows, existing) {
    const errors = CompanyCalculations.validateCsvRow(row, rowIndex, rows);
    if (errors.length) return { row, decision: "Reject", reason: errors.join(" | ") };
    if (!existing) return { row, decision: "Create", reason: "New ticker enrollment" };
    if (isSameData(existing, row)) return { row, decision: "Skip", reason: "Data identical to active period" };
    const matchingHistory = (existing.enrollmentHistory || []).filter(item => item.fyDate === row.Period);
    if (matchingHistory.some(item => isSameData(item, row))) return { row, decision: "Skip", reason: "Data identical to historical period" };
    const incomingKey = periodKey(row.Period);
    const activeKey = periodKey(existing.fyDate);
    const reason = incomingKey < activeKey ? "Append historical revision" : incomingKey === activeKey ? "Replace active period and archive prior version" : "Promote newer period and archive active period";
    return { row, decision: "Update", reason };
  }

  function renderPreviewModal(parentContainer, rows, onComplete) {
    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:999;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;";

    const processedRows = rows.map((row, idx) => classifyRow(row, idx, rows, WealthData.getFundamentals(row.Ticker)));

    const counts = { Create: 0, Update: 0, Skip: 0, Reject: 0 };
    processedRows.forEach(pr => counts[pr.decision]++);

    modal.innerHTML = `
      <div class="ticket" style="max-width:900px;width:100%;max-height:90vh;overflow-y:hidden;display:flex;flex-direction:column;background:var(--bg);border:1px solid var(--gain);">
        <div class="ticket-body" style="display:flex;flex-direction:column;flex:1;overflow:hidden;">
          <div class="section-head" style="margin-bottom:14px;"><span class="section-title">Fundamentals CSV Import Preview</span></div>
          <div style="display:flex;gap:16px;margin-bottom:16px;">
            <div class="sync-health-pill sync-health-healthy">Create: ${counts.Create}</div>
            <div class="sync-health-pill sync-health-stale" style="background:var(--amber-dim);color:var(--amber-bright);border-color:var(--amber);">Update: ${counts.Update}</div>
            <div class="sync-health-pill" style="border-color:var(--paper-dim);">Skip: ${counts.Skip}</div>
            <div class="sync-health-pill sync-health-stale" style="background:var(--loss-dim);color:var(--loss);border-color:var(--loss);">Reject: ${counts.Reject}</div>
          </div>

          <div style="flex:1;overflow-y:auto;border:1px solid var(--rule-bright);background:var(--bg-ticket);">
            <table style="width:100%;border-collapse:collapse;font-size:12px;font-family:var(--mono);">
              <thead style="background:var(--bg-raised);position:sticky;top:0;">
                <tr>
                  <th style="padding:8px;text-align:left;border-bottom:1px solid var(--rule-bright);">Decision</th>
                  <th style="padding:8px;text-align:left;border-bottom:1px solid var(--rule-bright);">Ticker</th>
                  <th style="padding:8px;text-align:left;border-bottom:1px solid var(--rule-bright);">Period</th>
                  <th style="padding:8px;text-align:left;border-bottom:1px solid var(--rule-bright);">Notes / Errors</th>
                </tr>
              </thead>
              <tbody>
                ${processedRows.map(pr => {
                  const color = pr.decision === "Create" ? "var(--gain)" :
                                pr.decision === "Update" ? "var(--amber-bright)" :
                                pr.decision === "Reject" ? "var(--loss)" : "var(--paper-dim)";
                  return `
                    <tr style="border-bottom:1px solid var(--rule-bright);">
                      <td style="padding:8px;color:${color};font-weight:bold;">${escapeHtml(pr.decision)}</td>
                      <td style="padding:8px;">${escapeHtml(pr.row.Ticker)}</td>
                      <td style="padding:8px;">${escapeHtml(pr.row.Period)}</td>
                      <td style="padding:8px;color:${pr.decision === 'Reject' ? 'var(--loss)' : 'var(--paper-dim)'};">${escapeHtml(pr.reason)}</td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>

          <div class="paper-action-row" style="margin-top:16px;">
            <button class="btn" id="csv-commit-btn" style="background:var(--gain);color:#fff;" ${counts.Create === 0 && counts.Update === 0 ? 'disabled' : ''}>Commit Valid Rows</button>
            <button class="btn" id="csv-cancel-btn" style="background:transparent;border:1px solid var(--rule-bright);color:var(--paper-dim);">Cancel</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector("#csv-cancel-btn").addEventListener("click", () => document.body.removeChild(modal));

    modal.querySelector("#csv-commit-btn").addEventListener("click", async () => {
      const validRows = processedRows.filter(pr => pr.decision === "Create" || pr.decision === "Update");

      for (const pr of validRows) {
        const row = pr.row;
        const ticker = row.Ticker;
        const existing = WealthData.getFundamentals(ticker) || {};
        const security = WealthData.getSecurity(ticker) || { displayName: ticker, sector: "Nifty 500" };

        const now = new Date().toISOString();
        const newRecord = applyRow(existing, row, now);

        WealthData.upsertSecurity(ticker, { displayName: security.displayName, sector: security.sector });
        WealthData.upsertFundamentals(ticker, newRecord);
      }

      await App.saveNow(false);
      App.showStatus(`Imported ${validRows.length} fundamental records`, "ok");
      document.body.removeChild(modal);
      if (onComplete) onComplete();
    });
  }

  function handleImportFile(file, parentContainer, onComplete) {
    const reader = new FileReader();
    reader.onload = e => {
      const result = parseCsvString(e.target.result);
      if (result.error) {
        alert("CSV Import Error: " + result.error);
        return;
      }
      renderPreviewModal(parentContainer, result.rows, onComplete);
    };
    reader.readAsText(file);
  }

  return { exportTemplate, handleImportFile, _testExports: { parseCsvString, parseRowValues, isSameData, periodKey, classifyRow, applyRow, escapeHtml } };
})();

if (typeof globalThis !== "undefined") globalThis.FundamentalsCsv = FundamentalsCsv;

/* ============================================================================
   Settings Module — fully built (not a stub). This is deliberately the
   simplest possible module: a form bound directly to WealthData.settings.
   Built in full tonight because the cost is low and the value is real —
   every other module (DCF assumptions, position sizing, SIP defaults) reads
   from here instead of a hardcoded number buried in its own file.
============================================================================ */

const SettingsModule = (function () {

  const FIELDS = [
    { key: "defaultRiskPct", label: "Default risk per trade (%)", type: "number", step: 0.1 },
    { key: "dcfGrowthRate", label: "DCF growth rate assumption (%)", type: "number", step: 0.5 },
    { key: "dcfDiscountRate", label: "DCF discount rate (%)", type: "number", step: 0.5 },
    { key: "riskFreeRate", label: "Risk-free rate (%)", type: "number", step: 0.1 },
    { key: "marginOfSafety", label: "Margin of safety (%)", type: "number", step: 1 },
    { key: "sipMonthlyAmount", label: "SIP monthly amount (₹)", type: "number", step: 1000 },
    { key: "targetEquityAllocationPct", label: "Target equity allocation (%)", type: "number", step: 1 },
    { key: "intradaySatelliteAllocationPct", label: "Intraday satellite allocation ceiling (%)", type: "number", step: 1 },
    { key: "minRiskRewardRatio", label: "Minimum risk-reward ratio for intraday trades", type: "number", step: 0.1 }
  ];

  function render(container) {
    const settings = WealthData.getAllSettings();
    container.innerHTML = `
      <div class="module-header">
        <h2>Settings</h2>
        <p class="module-sub">Global assumptions used across every module — change once here instead of hunting through files.</p>
      </div>
      <div class="panel">
        ${FIELDS.map(f => `
          <div class="field-row">
            <label for="setting-${f.key}">${f.label}</label>
            <input type="${f.type}" step="${f.step}" id="setting-${f.key}" value="${settings[f.key]}">
          </div>
        `).join("")}
        <button class="btn" id="settings-save">Save settings</button>
      </div>
    `;

    container.querySelector("#settings-save").addEventListener("click", async () => {
      FIELDS.forEach(f => {
        const val = parseFloat(container.querySelector(`#setting-${f.key}`).value);
        if (!isNaN(val)) WealthData.updateSetting(f.key, val);
      });
      await App.saveNow(true);
    });
  }

  return { render };
})();

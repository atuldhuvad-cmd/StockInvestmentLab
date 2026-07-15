/* ============================================================================
   Settings Module — inactive legacy shell.

   Intraday is being separated from the active Wealth Intelligence Suite, so
   its two controls are no longer presented here. The module file and legacy
   values remain intact for compatibility until the standalone project is
   created and verified.
============================================================================ */

const SettingsModule = (function () {

  function render(container) {
    container.innerHTML = `
      <div class="module-header">
        <h2>Settings</h2>
        <p class="module-sub">Inactive compatibility module.</p>
      </div>
      <div class="panel">
        <p>Intraday trading is being developed as a separate satellite project. Existing legacy Intraday data remains preserved in backups.</p>
      </div>
    `;
  }

  return { render };
})();

/* ============================================================================
   Wealth Intelligence Suite — Application Shell
   ============================================================================
   Handles navigation between modules and wires up the persistence controls.
   Each module registers a render(container) function; the shell's only job
   is deciding which one is currently visible and calling it. No module logic
   lives here — this file should stay small and boring by design.
============================================================================ */

const App = (function () {
  const modules = {}; // key: { label, render(container) }
  let activeKey = null;

  function registerModule(key, label, renderFn, status) {
    modules[key] = { label, render: renderFn, status: status || "ready" };
  }

  function renderNav() {
    const nav = document.getElementById("nav-tabs");
    nav.innerHTML = Object.entries(modules).map(([key, mod]) => `
      <button class="nav-tab ${key === activeKey ? 'active' : ''}" data-key="${key}">
        ${mod.label}
        ${mod.status === "planned" ? '<span class="status-badge">planned</span>' : ''}
      </button>
    `).join("");
    nav.querySelectorAll(".nav-tab").forEach(btn => {
      btn.addEventListener("click", () => switchTo(btn.dataset.key));
    });
  }

  function switchTo(key) {
    activeKey = key;
    renderNav();
    const container = document.getElementById("module-container");
    container.innerHTML = "";
    modules[key].render(container);
  }

  async function saveNow(showToast) {
    const ok = await Persistence.save();
    if (showToast) showStatus(ok ? "Saved" : "Save failed — check browser console", ok ? "ok" : "error");
    return ok;
  }

  function showStatus(msg, kind) {
    const el = document.getElementById("status-bar");
    el.textContent = msg;
    el.className = "status-bar " + (kind || "");
    el.style.opacity = "1";
    setTimeout(() => { el.style.opacity = "0"; }, 2500);
  }

  async function init() {
    await Persistence.load(); // silent — first run just uses the empty default state

    document.getElementById("btn-save").addEventListener("click", () => saveNow(true));
    document.getElementById("btn-export").addEventListener("click", async () => {
      try {
        await Persistence.exportToFile();
        showStatus("Backup file downloaded", "ok");
        switchTo(activeKey);
      } catch (err) {
        showStatus("Backup export failed: " + err.message, "error");
      }
    });
    document.getElementById("btn-import").addEventListener("click", () => {
      document.getElementById("import-file-input").click();
    });
    document.getElementById("import-file-input").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!confirm("Importing will replace all current data in this app with the contents of the selected file. Continue?")) {
        e.target.value = "";
        return;
      }
      try {
        await Persistence.importFromFile(file);
        showStatus("Import successful — data reloaded", "ok");
        switchTo(activeKey); // re-render current module with the new data
      } catch (err) {
        showStatus("Import failed: " + err.message, "error");
      }
      e.target.value = "";
    });

    // Auto-save on a simple timer rather than on every single keystroke —
    // simplest possible approach that still means you're very unlikely to
    // lose more than a minute of work, without wiring a debounced listener
    // into every module's every input field.
    setInterval(() => saveNow(false), 60000);
    window.addEventListener("beforeunload", () => { Persistence.save(); });

    renderNav();
    const firstKey = Object.keys(modules)[0];
    switchTo(firstKey);
  }

  return { registerModule, switchTo, saveNow, showStatus, init };
})();

/* ============================================================================
   Paper Trading — top-level workflow adapter
   ============================================================================
   Presentation only. The existing Delivery Paper ledger, calculations, and
   storage remain owned by PaperDelivery and WealthData.
============================================================================ */

const PaperTradingModule = (function () {
  function render(container) {
    DeliveryScreenerModule.renderPaperTrading(container);
  }

  return { render };
})();

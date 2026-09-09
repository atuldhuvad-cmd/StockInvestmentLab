/* ============================================================================
   Delivery Paper Trading — isolated calculation layer
   ============================================================================
   This ledger never reads or writes real Portfolio holdings or transactions.
   Every output is derived only from paperDeliveryTransactions,
   paperDeliveryConfig, and offline price history.
============================================================================ */

const PaperDelivery = (function () {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const DEFAULT_CONFIG = Object.freeze({
    startingCapital: 0,
    maxAllocationPct: 20,
    maxOpenHoldings: 10,
    manualPrices: Object.freeze({})
  });

  function finiteNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function localISODate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function isValidDate(value, today = localISODate()) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parts = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    const valid = parsed.getUTCFullYear() === parts[0] &&
      parsed.getUTCMonth() === parts[1] - 1 && parsed.getUTCDate() === parts[2];
    return valid && value <= today;
  }

  function daysBetween(start, end) {
    if (!isValidDate(start, "9999-12-31") || !isValidDate(end, "9999-12-31")) return null;
    return Math.max(0, Math.floor(
      (new Date(end + "T00:00:00Z") - new Date(start + "T00:00:00Z")) / DAY_MS
    ));
  }

  function normalizeConfig(config) {
    const source = config && typeof config === "object" ? config : {};
    const capital = finiteNumber(source.startingCapital);
    const allocation = finiteNumber(source.maxAllocationPct);
    const openLimit = finiteNumber(source.maxOpenHoldings);
    return {
      startingCapital: capital !== null && capital >= 0 ? capital : DEFAULT_CONFIG.startingCapital,
      maxAllocationPct: allocation !== null && allocation > 0 && allocation <= 100
        ? allocation : DEFAULT_CONFIG.maxAllocationPct,
      maxOpenHoldings: openLimit !== null && openLimit > 0
        ? Math.floor(openLimit) : DEFAULT_CONFIG.maxOpenHoldings,
      manualPrices: source.manualPrices && typeof source.manualPrices === "object"
        ? source.manualPrices : {}
    };
  }

  function validateConfig(input) {
    const capital = finiteNumber(input && input.startingCapital);
    const allocation = finiteNumber(input && input.maxAllocationPct);
    const openLimit = finiteNumber(input && input.maxOpenHoldings);
    if (capital === null || capital < 0) return "Starting Paper Capital must be zero or greater";
    if (allocation === null || allocation <= 0 || allocation > 100) {
      return "Maximum allocation must be between 0 and 100%";
    }
    if (openLimit === null || openLimit <= 0 || !Number.isInteger(openLimit)) {
      return "Maximum open holdings must be a positive whole number";
    }
    return null;
  }

  function sortTransactions(transactions) {
    return (Array.isArray(transactions) ? transactions : []).slice().sort((a, b) => {
      const dateCompare = String(a.transactionDate || "").localeCompare(String(b.transactionDate || ""));
      if (dateCompare) return dateCompare;
      const createdCompare = String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
      if (createdCompare) return createdCompare;
      return String(a.id).localeCompare(String(b.id));
    });
  }

  function replay(transactions, today = localISODate()) {
    const holdings = new Map();
    const cycles = new Map();
    const closedPositions = [];
    const enrichedTransactions = [];
    const errors = [];

    sortTransactions(transactions).forEach(transaction => {
      const ticker = String(transaction.ticker || "").trim().toUpperCase();
      const type = String(transaction.transactionType || "").toUpperCase();

      if (type === "PLANNED") {
        if (!ticker) {
          errors.push({ id: transaction.id, message: "Invalid planned transaction" });
          return;
        }
        enrichedTransactions.push({ ...transaction, ticker: ticker, transactionType: type });
        return;
      }

      const quantity = finiteNumber(transaction.quantity);
      const price = finiteNumber(transaction.price);
      const chargeValue = finiteNumber(transaction.charges);
      const charges = chargeValue === null ? 0 : chargeValue;
      if (!ticker || !["BUY", "SELL"].includes(type) || quantity === null ||
          quantity <= 0 || price === null || price <= 0 || charges < 0) {
        errors.push({ id: transaction.id, message: "Invalid paper transaction" });
        return;
      }

      const grossAmount = quantity * price;
      let holding = holdings.get(ticker);
      let cycle = cycles.get(ticker);

      if (type === "BUY") {
        if (!holding) {
          holding = {
            ticker: ticker,
            quantity: 0,
            totalCost: 0,
            averageCost: 0,
            entryDate: transaction.transactionDate || null,
            entrySnapshot: transaction.entrySnapshot
              ? JSON.parse(JSON.stringify(transaction.entrySnapshot)) : null,
            entryNote: transaction.entryNote || null,
            tradeId: transaction.id,
            plannedEntryPrice: transaction.plannedEntryPrice || null,
            plannedStopPrice: transaction.plannedStopPrice || null,
            plannedTargetPrice: transaction.plannedTargetPrice || null,
            plannedRiskAmount: transaction.plannedRiskAmount || null
          };
          cycle = {
            ticker: ticker,
            entryDate: transaction.transactionDate || null,
            entrySnapshot: transaction.entrySnapshot
              ? JSON.parse(JSON.stringify(transaction.entrySnapshot)) : null,
            realisedGain: 0,
            soldCost: 0
          };
          holdings.set(ticker, holding);
          cycles.set(ticker, cycle);
        }
        const netAmount = grossAmount + charges;
        holding.totalCost += netAmount;
        holding.quantity += quantity;
        holding.averageCost = holding.totalCost / holding.quantity;
        enrichedTransactions.push({
          ...transaction,
          ticker: ticker,
          transactionType: type,
          charges: charges,
          grossAmount: grossAmount,
          netAmount: netAmount,
          realisedGain: null
        });
        return;
      }

      if (!holding || quantity > holding.quantity + 1e-10) {
        errors.push({
          id: transaction.id,
          message: "SELL quantity exceeds available " + (holding ? holding.quantity : 0) + " for " + ticker
        });
        enrichedTransactions.push({
          ...transaction,
          ticker: ticker,
          transactionType: type,
          charges: charges,
          grossAmount: grossAmount,
          netAmount: grossAmount - charges,
          realisedGain: null
        });
        return;
      }

      const costBasisPerUnit = holding.averageCost;
      const soldCost = costBasisPerUnit * quantity;
      const netAmount = grossAmount - charges;
      const realisedGain = netAmount - soldCost;
      holding.quantity -= quantity;
      holding.totalCost -= soldCost;
      cycle.realisedGain += realisedGain;
      cycle.soldCost += soldCost;
      enrichedTransactions.push({
        ...transaction,
        ticker: ticker,
        transactionType: type,
        charges: charges,
        grossAmount: grossAmount,
        netAmount: netAmount,
        costBasisPerUnit: costBasisPerUnit,
        realisedGain: realisedGain
      });

      if (holding.quantity <= 1e-10) {
        const holdingDays = daysBetween(cycle.entryDate, transaction.transactionDate);
        closedPositions.push({
          ticker: ticker,
          entryDate: cycle.entryDate,
          exitDate: transaction.transactionDate || null,
          holdingDays: holdingDays,
          realisedGain: cycle.realisedGain,
          costBasis: cycle.soldCost,
          realisedReturnPct: cycle.soldCost > 0
            ? cycle.realisedGain / cycle.soldCost * 100 : null,
          entrySnapshot: cycle.entrySnapshot
            ? JSON.parse(JSON.stringify(cycle.entrySnapshot)) : null,
          entryNote: cycle.entryNote || holding.entryNote || null,
          exitNote: transaction.exitNote || transaction.notes || null,
          tradeNotes: transaction.tradeNotes || null,
          plannedEntryPrice: holding.plannedEntryPrice || null,
          plannedStopPrice: holding.plannedStopPrice || null,
          plannedTargetPrice: holding.plannedTargetPrice || null,
          plannedRiskAmount: holding.plannedRiskAmount || null
        });
        holdings.delete(ticker);
        cycles.delete(ticker);
      }
    });

    return {
      holdings: Array.from(holdings.values()).map(holding => ({
        ...holding,
        holdingDays: holding.entryDate ? daysBetween(holding.entryDate, today) : null
      })),
      closedPositions: closedPositions,
      transactions: enrichedTransactions,
      errors: errors
    };
  }

  function transactionCashFlow(transaction) {
    const quantity = finiteNumber(transaction.quantity) || 0;
    const price = finiteNumber(transaction.price) || 0;
    const charges = finiteNumber(transaction.charges) || 0;
    const gross = quantity * price;
    return transaction.transactionType === "BUY" ? -(gross + charges) : gross - charges;
  }

  function latestImportedPrice(ticker, state) {
    const symbol = typeof PriceHistory !== "undefined"
      ? PriceHistory.normalizeSymbol(ticker) : String(ticker || "").toUpperCase();
    const record = state && state.priceHistory && state.priceHistory[symbol];
    const rows = record && Array.isArray(record.rows) ? record.rows : [];
    let latest = null;
    rows.forEach(row => {
      const close = finiteNumber(row.close);
      if (isValidDate(row.date, "9999-12-31") && close !== null && close >= 0 &&
          (!latest || row.date >= latest.date)) {
        latest = { price: close, date: row.date };
      }
    });
    return latest;
  }

  function getCurrentPrice(ticker, state, today = localISODate()) {
    const imported = latestImportedPrice(ticker, state);
    if (imported) {
      const stale = imported.date < today;
      return {
        ...imported,
        source: "Imported close",
        stale: stale,
        label: "Imported close · " + imported.date + (stale ? " · Historical, not live" : "")
      };
    }
    const config = normalizeConfig(state && state.paperDeliveryConfig);
    const manual = config.manualPrices[String(ticker || "").toUpperCase()];
    const manualPrice = finiteNumber(manual && manual.price);
    const manualTimestamp = manual && (manual.timestamp || manual.priceTimestamp || manual.date);
    const manualDate = typeof manualTimestamp === "string" ? manualTimestamp.slice(0, 10) : null;
    if (manual && manualPrice !== null && manualPrice > 0 &&
        isValidDate(manualDate, "9999-12-31")) {
      const stale = manualDate < today;
      return {
        price: manualPrice,
        date: manualDate,
        source: "Manual paper price",
        stale: stale,
        label: "Manual price · " + manualTimestamp + (stale ? " · Historical, not live" : "")
      };
    }
    return {
      price: null,
      date: null,
      source: "Unavailable",
      stale: false,
      label: "Price unavailable"
    };
  }

  function validateManualPrice(input, now = new Date()) {
    if (typeof PaperQuotes === "undefined") return "Manual-price validation is unavailable";
    const evidence = PaperQuotes.manualEvidence(input, now);
    return evidence.ok ? null : evidence.error;
  }

  function snapshotCandidate(candidate, reason) {
    const pillars = candidate && candidate.pillars ? candidate.pillars : {};
    const technical = pillars.technicalTrend || {};
    return {
      businessQualityScore: finiteNumber(pillars.businessQuality && pillars.businessQuality.score),
      financialStrengthScore: finiteNumber(pillars.financialStrength && pillars.financialStrength.score),
      valuationScore: finiteNumber(pillars.valuation && pillars.valuation.score),
      technicalTrendScore: finiteNumber(technical.score),
      technicalTrendStatus: technical.status || "Not Evaluated",
      riskScore: finiteNumber(pillars.risk && pillars.risk.score),
      deliveryOverallScore: finiteNumber(candidate && candidate.overall),
      deliveryRating: candidate && candidate.rating ? candidate.rating : "—",
      technicalDataDate: technical.latestDate || null,
      priceHistoryCoverage: technical.coverage || "Missing",
      paperBuyReason: String(reason || "").trim()
    };
  }


  function calculatePositionSize(maxRiskAmount, entryPrice, stopPrice, maxCapital) {
    const risk = finiteNumber(maxRiskAmount);
    const entry = finiteNumber(entryPrice);
    const stop = finiteNumber(stopPrice);
    const capitalLimit = finiteNumber(maxCapital);

    if (risk === null || risk <= 0 || entry === null || entry <= 0 || stop === null || stop <= 0) {
      return { status: "NOT_CALCULATED", reason: "Invalid prices or risk amount" };
    }
    if (entry <= stop) {
      return { status: "NOT_CALCULATED", reason: "Stop price must be below entry price for LONG trades" };
    }
    const perShareRisk = entry - stop;
    let quantity = Math.floor(risk / perShareRisk);
    if (capitalLimit !== null && capitalLimit > 0) {
      const maxQtyByCap = Math.floor(capitalLimit / entry);
      quantity = Math.min(quantity, maxQtyByCap);
    }
    if (quantity <= 0) {
      return { status: "NOT_CALCULATED", reason: "Risk budget too small for a single share" };
    }
    return {
      status: "CALCULATED",
      quantity: quantity,
      perShareRisk: perShareRisk,
      totalCapital: quantity * entry
    };
  }

  function createTransactionPlan(transactions, configInput, input, options = {}) {
    const config = normalizeConfig(configInput);
    const type = String(input && input.transactionType || "").toUpperCase();
    const ticker = String(input && input.ticker || "").trim().toUpperCase();
    const quantity = finiteNumber(input && input.quantity);
    const price = finiteNumber(input && input.price);
    const chargeInput = input && input.charges !== "" && input.charges !== undefined
      ? finiteNumber(input.charges) : 0;
    const charges = chargeInput === null ? -1 : chargeInput;
    const today = options.today || localISODate();

    if (!["BUY", "SELL", "PLANNED"].includes(type)) return { ok: false, error: "Transaction type must be BUY, SELL or PLANNED" };
    if (!ticker) return { ok: false, error: "Ticker is required" };

    if (type === "PLANNED") {
      const transaction = {
        id: options.id !== undefined ? options.id : Date.now() + Math.random(),
        ticker: ticker,
        transactionType: type,
        plannedEntryPrice: finiteNumber(input.plannedEntryPrice),
        plannedStopPrice: finiteNumber(input.plannedStopPrice),
        plannedTargetPrice: finiteNumber(input.plannedTargetPrice),
        plannedRiskAmount: finiteNumber(input.plannedRiskAmount),
        quantity: finiteNumber(input.quantity),
        notes: String(input.notes || "").trim(),
        createdAt: options.createdAt || new Date().toISOString()
      };
      
      const proposed = replay(
        (Array.isArray(transactions) ? transactions : []).concat([transaction]),
        today
      );
      if (proposed.errors.length) return { ok: false, error: proposed.errors[0].message };
      return { ok: true, transaction: transaction, ledger: proposed };
    }

    if (!isValidDate(input.transactionDate, today)) {
      return { ok: false, error: type + " date is required, valid, and cannot be in the future" };
    }
    if (quantity === null || quantity <= 0) return { ok: false, error: "Quantity must be greater than zero" };
    if (price === null || price <= 0) return { ok: false, error: "Price must be greater than zero" };
    if (charges < 0) return { ok: false, error: "Charges must be zero or greater" };
    const evidenceError = typeof PaperQuotes === "undefined"
      ? "Price-evidence validation is unavailable"
      : PaperQuotes.validateStoredEvidence(input, options.now || new Date());
    if (evidenceError) return { ok: false, error: evidenceError };

    const current = replay(transactions, today);
    if (current.errors.length) return { ok: false, error: "Existing paper ledger contains an invalid transaction" };
    const holding = current.holdings.find(item => item.ticker === ticker);

    if (type === "BUY") {
      if (config.startingCapital <= 0) {
        return { ok: false, error: "Set paper capital before creating a paper position" };
      }
      const cash = config.startingCapital + current.transactions.reduce(
        (sum, transaction) => sum + transactionCashFlow(transaction), 0
      );
      const cost = quantity * price + charges;
      if (cost > cash + 1e-8) return { ok: false, error: "Insufficient paper cash" };
      const allocationLimit = config.startingCapital * config.maxAllocationPct / 100;
      const resultingCost = (holding ? holding.totalCost : 0) + cost;
      if (resultingCost > allocationLimit + 1e-8) {
        return { ok: false, error: "Paper position exceeds the maximum allocation per stock" };
      }
      if (!holding && current.holdings.length >= config.maxOpenHoldings) {
        return { ok: false, error: "Maximum number of open paper holdings reached" };
      }
    } else if (!holding || quantity > holding.quantity + 1e-10) {
      return {
        ok: false,
        error: "SELL quantity exceeds available " + (holding ? holding.quantity : 0)
      };
    }

    const transaction = {
      id: options.id !== undefined ? options.id : Date.now() + Math.random(),
      ticker: ticker,
      transactionType: type,
      transactionDate: input.transactionDate,
      quantity: quantity,
      price: price,
      priceSource: String(input.priceSource || "").trim(),
      priceTimestamp: input.priceTimestamp,
      priceStatus: input.priceStatus,
      quoteAgeSeconds: finiteNumber(input.quoteAgeSeconds),
      manualPriceNote: input.priceStatus === "Manual price"
        ? String(input.manualPriceNote || "").trim() : null,
      charges: charges,
      notes: String(input.notes || "").trim(),
      entryNote: input.entryNote ? String(input.entryNote).trim() : null,
      exitNote: input.exitNote ? String(input.exitNote).trim() : null,
      tradeNotes: input.tradeNotes ? String(input.tradeNotes).trim() : null,
      plannedEntryPrice: finiteNumber(input.plannedEntryPrice),
      plannedStopPrice: finiteNumber(input.plannedStopPrice),
      plannedTargetPrice: finiteNumber(input.plannedTargetPrice),
      plannedRiskAmount: finiteNumber(input.plannedRiskAmount),
      createdAt: options.createdAt || new Date().toISOString()
    };
    if (type === "BUY") {
      transaction.entrySnapshot = snapshotCandidate(options.candidate, input.reason);
    } else {
      transaction.exitReason = String(input.reason || "").trim();
    }

    const proposed = replay(
      (Array.isArray(transactions) ? transactions : []).concat([transaction]),
      today
    );
    if (proposed.errors.length) return { ok: false, error: proposed.errors[0].message };
    const saved = proposed.transactions.find(item => item.id === transaction.id);
    return { ok: true, transaction: saved || transaction, ledger: proposed };
  }

  function currentPortfolio(state, today = localISODate()) {
    const transactions = state && Array.isArray(state.paperDeliveryTransactions)
      ? state.paperDeliveryTransactions : [];
    const ledger = replay(transactions, today);
    const holdings = ledger.holdings.map(holding => {
      const current = getCurrentPrice(holding.ticker, state, today);
      const currentValue = current.price === null ? null : current.price * holding.quantity;
      return {
        ...holding,
        currentPrice: current.price,
        currentPriceDate: current.date,
        currentPriceLabel: current.label,
        currentValue: currentValue,
        unrealisedGain: currentValue === null ? null : currentValue - holding.totalCost
      };
    });
    return { ...ledger, holdings: holdings };
  }

  function maximumDrawdown(values) {
    const valid = (Array.isArray(values) ? values : [])
      .map(finiteNumber).filter(value => value !== null);
    if (!valid.length) return null;
    let peak = valid[0];
    let result = 0;
    valid.forEach(value => {
      if (value > peak) peak = value;
      if (peak > 0) result = Math.max(result, (peak - value) / peak * 100);
    });
    return result;
  }

  function equityCurve(state, today = localISODate()) {
    const config = normalizeConfig(state && state.paperDeliveryConfig);
    const ordered = sortTransactions(state && state.paperDeliveryTransactions);
    const values = [config.startingCapital];
    const lastPrices = {};
    let cash = config.startingCapital;
    ordered.forEach((transaction, index) => {
      cash += transactionCashFlow(transaction);
      lastPrices[String(transaction.ticker || "").toUpperCase()] =
        finiteNumber(transaction.price) || 0;
      const prefix = replay(ordered.slice(0, index + 1), today);
      const marked = prefix.holdings.reduce((sum, holding) =>
        sum + holding.quantity * (lastPrices[holding.ticker] || holding.averageCost), 0);
      values.push(cash + marked);
    });
    const current = currentPortfolio(state, today);
    const currentMarked = current.holdings.reduce((sum, holding) =>
      sum + (holding.currentValue === null ? holding.totalCost : holding.currentValue), 0);
    values.push(cash + currentMarked);
    return values;
  }

  function summary(state, today = localISODate()) {
    const config = normalizeConfig(state && state.paperDeliveryConfig);
    const portfolio = currentPortfolio(state || {}, today);
    const availableCash = config.startingCapital + portfolio.transactions.reduce(
      (sum, transaction) => sum + transactionCashFlow(transaction), 0
    );
    const investedCost = portfolio.holdings.reduce((sum, holding) => sum + holding.totalCost, 0);
    const pricesComplete = portfolio.holdings.every(holding => holding.currentValue !== null);
    const currentValue = pricesComplete
      ? portfolio.holdings.reduce((sum, holding) => sum + holding.currentValue, 0) : null;
    const unrealisedGain = pricesComplete ? currentValue - investedCost : null;
    const realisedGain = portfolio.transactions.reduce(
      (sum, transaction) => sum + (finiteNumber(transaction.realisedGain) || 0), 0
    );
    const totalReturnPct = config.startingCapital > 0 && unrealisedGain !== null
      ? (realisedGain + unrealisedGain) / config.startingCapital * 100 : null;
    const latest = sortTransactions(state && state.paperDeliveryTransactions).slice(-1)[0] || null;
    return {
      config: config,
      availableCash: availableCash,
      investedCost: investedCost,
      currentValue: currentValue,
      unrealisedGain: unrealisedGain,
      realisedGain: realisedGain,
      totalReturnPct: totalReturnPct,
      openHoldings: portfolio.holdings.length,
      closedPositions: portfolio.closedPositions.length,
      maximumDrawdown: maximumDrawdown(equityCurve(state || {}, today)),
      latestTransaction: latest,
      pricesComplete: pricesComplete,
      portfolio: portfolio
    };
  }

  function valuationBand(score) {
    const value = finiteNumber(score);
    if (value === null) return "Not Evaluated";
    if (value >= 70) return "Attractive";
    if (value >= 45) return "Fair";
    return "Expensive";
  }

  function groupClosedPositions(positions, selector) {
    const groups = {};
    positions.forEach(position => {
      const key = selector(position) || "Not Evaluated";
      if (!groups[key]) groups[key] = { count: 0, profitable: 0, totalReturn: 0 };
      groups[key].count++;
      if (position.realisedGain > 0) groups[key].profitable++;
      groups[key].totalReturn += finiteNumber(position.realisedReturnPct) || 0;
    });
    return Object.fromEntries(Object.entries(groups).map(entry => [entry[0], {
      count: entry[1].count,
      profitable: entry[1].profitable,
      averageReturnPct: entry[1].count
        ? entry[1].totalReturn / entry[1].count : null
    }]));
  }

  function addDays(date, days) {
    const parsed = new Date(date + "T00:00:00Z");
    return new Date(parsed.getTime() + days * DAY_MS).toISOString().slice(0, 10);
  }

  function horizonPerformance(state, days) {
    const buys = sortTransactions(state && state.paperDeliveryTransactions)
      .filter(transaction =>
        transaction.transactionType === "BUY" &&
        isValidDate(transaction.transactionDate, "9999-12-31")
      );
    const returns = [];
    buys.forEach(transaction => {
      const targetDate = addDays(transaction.transactionDate, days);
      const symbol = typeof PriceHistory !== "undefined"
        ? PriceHistory.normalizeSymbol(transaction.ticker) : transaction.ticker;
      const record = state && state.priceHistory && state.priceHistory[symbol];
      const rows = record && Array.isArray(record.rows) ? record.rows : [];
      const target = rows.filter(row =>
        row.date >= targetDate && finiteNumber(row.close) !== null
      ).sort((a, b) => a.date.localeCompare(b.date))[0];
      if (target) {
        returns.push(
          (finiteNumber(target.close) - Number(transaction.price)) /
          Number(transaction.price) * 100
        );
      }
    });
    return {
      days: days,
      count: returns.length,
      averageReturnPct: returns.length
        ? returns.reduce((sum, value) => sum + value, 0) / returns.length : null
    };
  }

  function performanceReview(state, today = localISODate()) {
    const result = summary(state, today);
    const closed = result.portfolio.closedPositions;
    const profitable = closed.filter(position => position.realisedGain > 0);
    const losing = closed.filter(position => position.realisedGain < 0);
    const returns = closed.map(position => position.realisedReturnPct)
      .filter(value => value !== null);
    const sorted = closed.slice().sort((a, b) => b.realisedGain - a.realisedGain);
    const averageHoldingDays = closed.length
      ? closed.reduce((sum, position) => sum + (position.holdingDays || 0), 0) /
        closed.length : null;
    return {
      totalPaperTrades: result.portfolio.transactions.length,
      openPositions: result.openHoldings,
      closedPositions: closed.length,
      profitableClosedPositions: profitable.length,
      losingClosedPositions: losing.length,
      winRate: closed.length ? profitable.length / closed.length * 100 : null,
      averageRealisedReturn: returns.length
        ? returns.reduce((sum, value) => sum + value, 0) / returns.length : null,
      bestTrade: sorted[0] || null,
      worstTrade: sorted.length ? sorted[sorted.length - 1] : null,
      maximumDrawdown: result.maximumDrawdown,
      averageHoldingDays: averageHoldingDays,
      currentUnrealisedReturn: result.investedCost > 0 && result.unrealisedGain !== null
        ? result.unrealisedGain / result.investedCost * 100 : null,
      totalRealisedGain: result.realisedGain,
      openTrades: result.openHoldings,
      byEntryRating: groupClosedPositions(
        closed,
        position => position.entrySnapshot && position.entrySnapshot.deliveryRating
      ),
      byTechnicalStatus: groupClosedPositions(
        closed,
        position => position.entrySnapshot && position.entrySnapshot.technicalTrendStatus
      ),
      byValuationBand: groupClosedPositions(
        closed,
        position => valuationBand(position.entrySnapshot && position.entrySnapshot.valuationScore)
      ),
      horizon30: horizonPerformance(state || {}, 30),
      horizon60: horizonPerformance(state || {}, 60),
      horizon90: horizonPerformance(state || {}, 90)
    };
  }

  function canDeleteTransaction(transactions, id, today = localISODate()) {
    const remaining = (Array.isArray(transactions) ? transactions : [])
      .filter(transaction => transaction.id !== id);
    return { ok: replay(remaining, today).errors.length === 0, remaining: remaining };
  }

  function csv(transactions) {
    const escape = value => {
      const valueText = value === null || value === undefined ? "" : String(value);
      return /[",\n]/.test(valueText)
        ? '"' + valueText.replaceAll('"', '""') + '"' : valueText;
    };
    const rows = replay(transactions).transactions.slice().sort((a, b) =>
      String(b.transactionDate || "").localeCompare(String(a.transactionDate || ""))
    );
    const output = [[
      "Date", "Ticker", "Type", "Quantity", "Price", "Charges",
      "Gross Amount", "Net Amount", "Realised Gain/Loss", "Price Source",
      "Price Timestamp", "Price Status", "Quote Age Seconds", "Manual Price Note", "Notes"
    ]].concat(rows.map(transaction => [
      transaction.transactionDate,
      transaction.ticker,
      transaction.transactionType,
      transaction.quantity,
      transaction.price,
      transaction.charges,
      transaction.grossAmount,
      transaction.netAmount,
      transaction.realisedGain,
      transaction.priceSource,
      transaction.priceTimestamp,
      transaction.priceStatus,
      transaction.quoteAgeSeconds,
      transaction.manualPriceNote,
      transaction.notes
    ]));
    return output.map(row => row.map(escape).join(",")).join("\n");
  }

  return {
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    finiteNumber: finiteNumber,
    localISODate: localISODate,
    isValidDate: isValidDate,
    daysBetween: daysBetween,
    normalizeConfig: normalizeConfig,
    validateConfig: validateConfig,
    replay: replay,
    transactionCashFlow: transactionCashFlow,
    latestImportedPrice: latestImportedPrice,
    getCurrentPrice: getCurrentPrice,
    validateManualPrice: validateManualPrice,
    snapshotCandidate: snapshotCandidate,
    calculatePositionSize: calculatePositionSize,
    createTransactionPlan: createTransactionPlan,
    currentPortfolio: currentPortfolio,
    maximumDrawdown: maximumDrawdown,
    equityCurve: equityCurve,
    summary: summary,
    valuationBand: valuationBand,
    horizonPerformance: horizonPerformance,
    performanceReview: performanceReview,
    canDeleteTransaction: canDeleteTransaction,
    csv: csv
  };
})();

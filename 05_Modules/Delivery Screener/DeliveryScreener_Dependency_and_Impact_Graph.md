# Delivery Screener — Dependency Graph
*Module-specific artifact, not a framework addition. Derived directly from `computeCandidate()`'s actual call structure in `delivery-screener.js`, not from the illustrative linear example — one real nuance surfaced that the simple linear version would have missed.*

## Dependency Table

| Calculation | Depends On | Shared? | Verified |
|---|---|---|---|
| DS-01 Business Quality (overall score) | *(none — reads `qualitative` directly)* | Yes (shared function) | Verified (inherits FIN-F09) |
| DS-02 Business Quality (`subFactors`) | *(none — reads `qualitative` directly, parallel to DS-01, not derived from it)* | Drift | Confirmed Defect (FIN-D05) |
| DS-03 Shared Ratios (ROE, ROCE, D/E, Revenue CAGR) | *(none — reads fundamentals data directly)* | Drift | 1 Confirmed (FIN-D01), 2 pattern-based pending (FIN-D02, D03), 1 pattern-based pending (FIN-D04 for CAGR) |
| DS-04 Financial Strength | **DS-03** (roe, roce, debtEquity) | No (banding logic is new) | Pending — blocked on DS-03 |
| DS-05 Fair Value Gap | **DS-03** (revenueCagr, pe) **and DS-01** (qualityScore, feeds `reasonablePE`) | No (heuristic is new) | Pending — blocked on DS-03 **and** DS-01 |
| DS-06 Technical Trend | *(none — constant stub)* | No | Verified (trivially — always returns the same unavailable state) |
| DS-07 Risk | **DS-03** (debtEquity, for extremity scoring) **and** shared `detectRedFlags()` (independent of DS-01–DS-06) | Partial (red-flag sub-calc shared; D/E-extremity sub-calc new) | Pending — blocked on DS-03 |
| DS-08 Overall Score | **DS-01, DS-04, DS-05, DS-06, DS-07** (all five pillars) | No | Pending — blocked on all five pillars |
| DS-09 Rating | **DS-08** (overall) **and DS-07** (riskScore, redFlagCount) | No | Pending — blocked on DS-08, DS-07 |
| DS-10 Top 3 Strengths/Risks | **DS-01/DS-02, DS-04, DS-05, DS-07** (every pillar's `subFactors` array) | No | Pending — blocked on all pillars' subFactors |

## What this graph confirms and refines versus the illustrative linear order

The suggested order (*shared ratios → business quality → financial strength → valuation → risk → overall → ranking*) is correct, but the actual dependency structure is a **DAG with two independent branches converging at Overall Score, not a single line** — worth stating precisely rather than flattening it:

```
DS-03 (Shared Ratios) ──┬──────────────► DS-04 (Financial Strength) ──┐
                        │                                              │
DS-01 (Business Quality)┼──────────────► DS-05 (Fair Value Gap) ───────┤
                        │                                              ├──► DS-08 (Overall) ──┬──► DS-09 (Rating)
                        └──────────────► DS-07 (Risk) ─────────────────┤                       │
                                                                        │                       │
DS-02 (subFactors, parallel to DS-01) ─────────────────────────────────┴───────────────────────┴──► DS-10 (Ranking)

DS-06 (Technical Trend, constant, no inputs) ──────────────────────────► DS-08 (Overall)
```

**The one nuance the linear list would have missed:** DS-05 (Fair Value Gap) depends on **both** DS-03 and DS-01, not DS-03 alone — `valuationPillar(ratios, bq.score)` takes the Business Quality score as a direct parameter, feeding into `reasonablePE`'s calculation. This means Business Quality must be verified before Valuation, same as the suggested order already implies — but for a different, more specific reason than "it comes next in a list": it's a real, direct data dependency, not just a logical grouping.

## Verification Order for Phase 2/3 (topological, derived from the graph above)

1. **DS-03** (Shared Ratios) — foundational; nothing else can be trusted until this is resolved, since it feeds DS-04, DS-05, and DS-07 directly.
2. **DS-01 / DS-02** (Business Quality — both the shared score and the drifted subFactors) — no dependencies of their own, and DS-05 needs DS-01's output.
3. **DS-06** (Technical Trend) — trivial, no dependencies, can be confirmed at any point; listed here to complete the level, not because it blocks anything.
4. **DS-04** (Financial Strength) — now unblocked, since DS-03 is resolved.
5. **DS-05** (Fair Value Gap) — now unblocked, since both DS-03 and DS-01 are resolved.
6. **DS-07** (Risk) — now unblocked, since DS-03 is resolved (red-flag sub-calc has no blocking dependency at all and could technically run earlier, but grouping it here keeps the pillar-level verification coherent).
7. **DS-08** (Overall Score) — requires all five pillars (DS-01, 04, 05, 06, 07) resolved first.
8. **DS-09** (Rating) — requires DS-08 and DS-07.
9. **DS-10** (Ranking) — requires every pillar's `subFactors`, so effectively requires the same set as DS-08 plus DS-02 specifically (since DS-02 is drift-affected and feeds directly into this).

**Practical consequence for Phase 3:** DS-03 must be resolved (fixed via Phase 6A, or explicitly decided to leave unfixed with a documented reason) before *any* of DS-04, DS-05, DS-07, DS-08, DS-09, or DS-10 can be meaningfully numerically verified — verifying them against the current, drift-affected DS-03 would only prove they're internally consistent with a known-wrong input, not that they're correct.

## Impact Graph — the same structure, the operationally sharper question

Dependency Graph asks *what does this calculation depend on.* Impact Graph asks *if this calculation changes, what must be reverified.* Same underlying structure, read in the direction that actually matters during Phase 6A.

| Root Change | Must Reverify |
|---|---|
| Debt/Equity (within DS-03) | DS-04 (Financial Strength) → DS-07 (Risk) → DS-08 (Overall) → DS-09 (Rating) → DS-10 (Ranking) |
| Revenue CAGR (within DS-03) | DS-05 (Fair Value Gap) → DS-08 (Overall) → DS-09 (Rating) → DS-10 (Ranking) |
| ROE, ROCE (within DS-03) | DS-04 (Financial Strength) → DS-08 (Overall) → DS-09 (Rating) → DS-10 (Ranking) |
| Business Quality (DS-01) | DS-05 (Fair Value Gap, via the `reasonablePE` parameter) → DS-08 (Overall) → DS-09 (Rating) → DS-10 (Ranking) |
| P/E (within DS-03) | DS-05 (Fair Value Gap) → DS-08 (Overall) → DS-09 (Rating) → DS-10 (Ranking) |

This table is what Phase 6A consults directly whenever a fix lands, to know exactly which downstream tests must be re-run before the module can be frozen — used for real, below, not left as a template.

## Fix cycle executed, 2026-07-12 — audit evidence

**Root Fix 1: DS-03 (ROE, ROCE, Debt/Equity, Revenue CAGR)**

All four defects (FIN-D01–D04) were first fully proven by direct execution — including the two that were previously only pattern-based (FIN-D02 ROCE with `capEmployed = -4000` → `-37.5`; FIN-D03 Debt/Equity with `totalEquity = -1500` → `-0.667`), closing the confidence gap the registry had honestly kept open. **Fix applied:** `latestRatios()` moved out of `fundamentals.js` into the shared `company-calculations.js`; both Fundamentals and Delivery Screener now call the single guarded definition. `computeCandidate()`'s independent duplicate block removed entirely — the fix eliminates the duplication rather than patching a second copy of the same guards.

| Root Fix | Downstream Tests Re-run | Result |
|---|---|---|
| DS-03 (all 4 ratios) | Re-verified the 4 original defect-reproduction cases now return `null` | PASS (4/4) |
| DS-03 → DS-04 (Financial Strength) | Re-run against real BAJFINANCE data (D/E 3.82, the known high-debt case) | PASS — computes cleanly, no NaN |
| DS-03 → DS-05 (Fair Value Gap) | Re-run against real TCS data | PASS — computes cleanly, no NaN |
| DS-03 → DS-07 (Risk) | Covered by the full-pipeline re-run below (D/E-extremity sub-calc consumes the same fixed value) | PASS |
| DS-03 → DS-08/09/10 (Overall, Rating, Ranking) | Full pipeline re-run, all 10 real companies | PASS (10/10, see below) |
| **Frozen-module regression check** (Fundamentals depends on the same shared file that just changed) | Re-ran `Fundamentals_regression_tests.js` in full | **PASS (17/17)** — confirms the refactor didn't silently affect the already-frozen module. One test-infrastructure break was found and fixed in the same pass: the test's extraction method assumed `latestRatios()` still lived inside `fundamentals.js`'s source and broke when it moved — not an application defect, a test-script assumption that needed updating alongside the refactor it was testing |

**Root Fix 2: DS-02 (Business Quality `subFactors`)**

**Fix applied:** each sub-factor now individually guarded (`factorScore()` helper), returning `null` for a missing/invalid field instead of `NaN` — matching the pattern `qualityScore()` already used, closing the exact gap between the pillar's protected overall score and its previously-unprotected per-factor breakdown.

| Root Fix | Downstream Tests Re-run | Result |
|---|---|---|
| DS-02 | Re-ran the exact reproduction case (missing `managementQuality`) | PASS — subFactor now shows `null`, overall score still correctly `83.33` |
| DS-02 → DS-10 (Ranking) | Full pipeline re-run, all 10 real companies, checked every strength/risk label for the literal string "NaN" | PASS — zero NaN found anywhere in the output |

**Full-pipeline real-data confirmation (both fixes combined):** all 10 real companies re-ranked — **identical** scores and ordering to every prior run this session (TCS 96.9 Strong Buy → BAJFINANCE 53.3 Avoid, unchanged down to the decimal). The fixes only change behavior for previously-broken edge-case inputs; real company data was never affected by either defect.

## Delivery-Screener-specific execution rule for Phase 3 (module-scoped, not a framework rule)

**If an upstream calculation changes during the Defect Resolution Cycle, every downstream calculation that depends on it — per the graph above, not by assumption — must be re-verified before this module can be frozen.**

Concretely, if DS-03 (Debt/Equity, specifically) is fixed:
```
DS-03 (Debt/Equity) fixed
        ↓
DS-04 (Financial Strength) — rerun, since it consumes debtEquity directly
        ↓
DS-07 (Risk) — rerun, since D/E-extremity scoring consumes debtEquity directly
        ↓
DS-08 (Overall Score) — rerun, since it aggregates DS-04 and DS-07
        ↓
DS-09 (Rating) — rerun, since it consumes DS-08's output
        ↓
DS-10 (Ranking) — rerun, since it consumes every pillar's subFactors, including DS-04's and DS-07's
```
DS-05 (Fair Value Gap) is **not** in this specific cascade — it doesn't consume `debtEquity`, only `revenueCagr` and `pe` from DS-03. A fix to Revenue CAGR specifically would cascade through DS-05 instead. **The cascade path depends on which specific field within DS-03 changes, not just "DS-03 changed"** — the dependency graph above is precise enough to support this field-level distinction, and Phase 3 should use it that way rather than blanket-rerunning everything after any DS-03 change.

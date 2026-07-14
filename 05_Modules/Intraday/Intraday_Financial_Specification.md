# Intraday — Financial Specification

*This module is explicitly NOT a screener or scorer — see `intraday-scope-decision.md`, frozen before implementation. Every calculation here supports trade discipline (checklist enforcement, capital ceiling visibility), not signal generation. Phase 1A (`Intraday_CrossModule_Review.md`) already identified and resolved one duplication finding before this specification was written.*

## IN-01: Risk-Reward Ratio
- **Business purpose:** Quantifies whether a planned trade's potential reward justifies its risk, against the user's own stated minimum — the core discipline check for a trade "worth taking" by the trader's own predefined rule.
- **Formula:** `riskReward = (entryPrice && stopLoss && target) ? |target − entryPrice| / |entryPrice − stopLoss| : null`
- **Inputs:** `entryPrice`, `stopLoss`, `target` (₹, user-entered, all required for a result)
- **Outputs:** A ratio (e.g., `2.5` means potential reward is 2.5× potential loss), or `null` if any input is missing.
- **Business rules:** Uses absolute values for both numerator and denominator — meaning the ratio's sign never indicates trade direction. This is deliberate: the checklist only needs to know *magnitude* of reward vs. risk, not whether the trade is a long or short setup (the app has no explicit short-selling concept anywhere, consistent with Portfolio's PORT-P01 finding that this app is implicitly long-only).
- **Edge case:** `entryPrice === stopLoss` (zero risk) → division by zero → `Infinity`. **Not currently guarded** — flagged for Phase 3 testing, not assumed safe.
- **Worked example:** entry=₹100, stop=₹95, target=₹115 → |115−100| / |100−95| = 15/5 = **3.0** (a 3:1 reward-to-risk setup).

## IN-02: Checklist — Stop-Loss Set
- **Formula:** `stopSet = stopLoss !== null && stopLoss !== undefined && stopLoss > 0`
- **Business rule:** Explicit, correct guard against both "not entered" and "entered as zero or negative" — unlike several ratios found elsewhere in this project (e.g., Fundamentals' pre-fix ROE), this check was written with a proper sign guard from the start, not just a truthy check.

## IN-03: Checklist — Risk-Reward Threshold Pass
- **Formula:** `riskRewardPass = riskReward !== null && riskReward >= settings.minRiskRewardRatio`
- **Dependency:** IN-01 and the shared Settings store (`minRiskRewardRatio`, user-configured, default not specified in this module — inherited from Settings).
- **Business rule:** A trade with `riskReward === null` (missing inputs) fails this check, correctly — cannot pass a threshold that was never computed.

## IN-04: Checklist — Reason Stated
- **Formula:** `reasonStated = !!(notes && notes.trim().length > 0)`
- **Business rule:** No minimum length beyond non-empty after trimming — a single character technically passes. This is a deliberate simplicity choice (per the scope decision doc's "not a generated signal" philosophy — the app can't judge the *quality* of a stated reason, only that one exists), not an oversight, but worth naming explicitly rather than silently assumed adequate.

## IN-05: Deployed Capital
- **Formula:** `deployed = Σ positionSize` across trades with `status === "Open"`.
- **Business rule:** Only `Open` trades count — closed trades (Win or Loss) no longer occupy capital, correctly excluded.
- **Edge case:** A trade with `positionSize` missing/falsy contributes `0` via the `|| 0` guard — doesn't crash the sum, but also doesn't flag that a trade is missing this required field (the UI's add-trade validation requires `positionSize` at entry time, so this state shouldn't be reachable through normal use — same "safety comes from the caller's discipline, not a guard inside the function" pattern noted in Fundamentals' `renderDetail()` finding).

## IN-06: Portfolio Value (shared, not duplicated — fixed 2026-07-12)
- **Formula:** Identical to Portfolio's FIN-P01 (current value per holding) and FIN-P05 (total value) — now genuinely shared, not reimplemented. `IntradayModule.computeAllocation()` calls `PortfolioModule.computeRow()` and `PortfolioModule.computeSummary()` directly.
- **Legacy compatibility:** Intraday retains Portfolio's `active !== false` filter. New holdings omit the optional legacy `active` field; missing and `true` holdings count toward the capital base, while imported `active: false` holdings remain excluded.
- **Cross-reference:** See `Intraday_CrossModule_Review.md` for the duplication finding and its resolution. This entry exists to record that Intraday *consumes* Portfolio's value, not to restate the formula.

## IN-07: Total Capital Base
- **Formula:** `totalCapitalBase = portfolioValue (IN-06) + deployed (IN-05)`
- **Business rule:** Approximates "total capital available for allocation decisions" as long-term holdings plus whatever's currently deployed intraday — explicitly labeled "approximate" in the source code's own comment, not overclaimed as an exact accounting figure. Does not include cash sitting outside both (e.g., un-invested bank balance) — worth naming as a real scope limitation, not assumed comprehensive.

## IN-08: Satellite Ceiling Amount
- **Formula:** `ceilingAmount = totalCapitalBase × (ceilingPct / 100)`, where `ceilingPct` comes from Settings (`intradaySatelliteAllocationPct`).
- **Dependency:** IN-07 and Settings.

## IN-09: Used Percentage
- **Formula:** `usedPct = totalCapitalBase > 0 ? (deployed / totalCapitalBase) × 100 : 0`
- **Business rule:** Explicit zero-division guard, correctly returns `0` rather than `NaN`/`Infinity` when there's no capital base at all (e.g., a fresh install with no holdings and no open trades).

## IN-10: Over-Ceiling Flag
- **Formula:** `overCeiling = deployed > ceilingAmount && ceilingAmount > 0`
- **Business rule:** The `ceilingAmount > 0` guard prevents a false "over ceiling" warning when `ceilingAmount` is legitimately `0` (e.g., `ceilingPct` set to `0`, meaning the user has disabled intraday entirely) — worth confirming this is actually the intended behavior in Phase 4, since `deployed > 0` with a `0%` ceiling arguably *should* warn, not stay silent. Flagged, not assumed correct just because it doesn't crash.

---

## Business Rules Explicitly NOT Specified (Phase 4, preliminary)

| Question | Status |
|---|---|
| Should `overCeiling` still warn when the ceiling is deliberately set to 0%? | **NOT SPECIFIED** — see IN-10. Current behavior is silent (no warning), which may under-warn a user who explicitly zeroed out their intraday allocation but still has open trades. |
| What happens when `entryPrice === stopLoss` (zero-risk denominator)? | **NOT SPECIFIED** — see IN-01's edge case. Not yet guarded. |
| Is there a maximum position size relative to the ceiling enforced at entry, or only visible after the fact? | **NOT SPECIFIED / NOT IMPLEMENTED** — the checklist doesn't include a position-size-vs-ceiling check; a trade can be logged that immediately breaches the ceiling, with only the dashboard view surfacing it afterward, not a blocking check at entry. |
| Realized P&L tracking for closed trades | **NOT SPECIFIED / NOT IMPLEMENTED** — `status` moves to `Closed-Win`/`Closed-Loss` but no `pnl` amount is captured or computed anywhere in this module, unlike what the original scope decision's design section describes ("outcome... P&L"). This is a real gap between the frozen scope document and the actual implementation, worth flagging precisely rather than assuming the design doc and the code agree just because both exist. |

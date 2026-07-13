# Intraday — Dependency & Impact Graph

## Dependency Table

| Calculation | Depends On | Shared? | Verified |
|---|---|---|---|
| IN-01 Risk-Reward Ratio | *(none — direct inputs)* | No | Pending |
| IN-02 Stop-Loss Set | *(none)* | No | Pending |
| IN-03 Risk-Reward Threshold Pass | **IN-01** + Settings (`minRiskRewardRatio`) | No | Pending — blocked on IN-01 |
| IN-04 Reason Stated | *(none)* | No | Pending |
| IN-05 Deployed Capital | *(none — reads trades directly)* | No | Pending |
| IN-06 Portfolio Value | *(external — `PortfolioModule.computeRow`/`computeSummary`, already frozen)* | **Yes — shared, fixed 2026-07-12** | Verified Consistent (inherits Portfolio's frozen status) |
| IN-07 Total Capital Base | **IN-05 + IN-06** | No | Pending — blocked on IN-05, IN-06 |
| IN-08 Ceiling Amount | **IN-07** + Settings (`intradaySatelliteAllocationPct`) | No | Pending — blocked on IN-07 |
| IN-09 Used Percentage | **IN-05 + IN-07** | No | Pending — blocked on IN-05, IN-07 |
| IN-10 Over-Ceiling Flag | **IN-05 + IN-08** | No | Pending — blocked on IN-05, IN-08 |

## Dependency Graph (visual)

```
IN-01 (Risk-Reward) ──► IN-03 (Threshold Pass)

IN-05 (Deployed) ──┬──► IN-07 (Total Capital Base) ──┬──► IN-08 (Ceiling Amount) ──► IN-10 (Over-Ceiling)
                    │                                 │
IN-06 (Portfolio    │                                 └──► IN-09 (Used %)
  Value, shared) ───┘

IN-05 (Deployed) ──────────────────────────────────────────► IN-10 (Over-Ceiling, also direct input)
IN-05 (Deployed) ──────────────────────────────────────────► IN-09 (Used %, also direct input)
```

**One nuance worth stating precisely, matching the discipline from Delivery Screener's graph:** IN-05 (Deployed) is not just an indirect ancestor of IN-09 and IN-10 through IN-07 — it's *also* a direct input to both (the used-% formula and the over-ceiling comparison both reference `deployed` again, not only the derived `totalCapitalBase`). A change to how deployed capital is computed would need re-verification of IN-07, IN-09, *and* IN-10 independently, not just IN-07 with the other two assumed to follow automatically.

## Impact Graph

| Root Change | Must Reverify |
|---|---|
| IN-01 (Risk-Reward formula) | IN-03 (Threshold Pass) — checklist display and trade-logging validation both depend on it |
| IN-05 (Deployed Capital) | IN-07 (Total Capital Base) → IN-08 (Ceiling Amount) → IN-10 (Over-Ceiling); **and independently** IN-09 (Used %) and IN-10 (Over-Ceiling) directly, per the nuance above |
| IN-06 (Portfolio Value) | IN-07 (Total Capital Base) → IN-08 (Ceiling Amount) → IN-10 (Over-Ceiling); **and independently** IN-09 (Used %) |
| IN-07 (Total Capital Base) | IN-08 (Ceiling Amount) → IN-10 (Over-Ceiling); IN-09 (Used %) |

## Verification order for Phase 2/3 (topological)

1. **IN-01, IN-02, IN-04, IN-05** (no dependencies — foundational checks and the raw deployed-capital sum)
2. **IN-06** (already verified — inherits Portfolio's frozen status; confirmed identical via direct execution in Phase 1A, not re-verified from scratch)
3. **IN-03** (needs IN-01)
4. **IN-07** (needs IN-05, IN-06)
5. **IN-08, IN-09** (need IN-07, and IN-09 also needs IN-05 directly)
6. **IN-10** (needs IN-05 directly and IN-08)

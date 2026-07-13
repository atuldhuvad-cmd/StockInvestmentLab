# Intraday — Recommendations

## Confirmed Defects
None.

## Potential Defects

1. **Zero-risk denominator (`entryPrice === stopLoss`) silently passes the risk-reward checklist item via `Infinity`.** (Potential Defect, Medium priority — mathematically defensible, practically ambiguous.) The ratio genuinely is infinite when risk is zero, so this isn't a calculation error — but a trade entered with the stop set exactly at the entry price could equally be a data-entry mistake as a deliberate ultra-tight setup, and the checklist currently can't distinguish the two, always showing a pass. Recommend either a minimum-distance guard (stop must differ from entry by some small threshold) or an explicit warning specifically for this case, rather than treating it identically to a normal high-quality setup.

## Improvements (software behaves correctly; optional enhancements)

2. **Add a position-size-vs-ceiling check at trade-entry time**, not just visible afterward on the dashboard. (Improvement, Medium priority.) Currently a trade can be logged that immediately breaches the satellite ceiling — the checklist enforces discipline about the trade's own risk parameters, but not about capital allocation discipline at the moment of entry, which is the same category of check per the module's own stated purpose.

3. **Decide whether `overCeiling` should warn when the ceiling is deliberately 0%.** (Improvement, Low priority.) Current behavior is silent by design of the `ceilingAmount > 0` guard — worth a deliberate decision rather than leaving it as an accidental consequence of a guard written for a different purpose (preventing division-adjacent nonsense, not intentionally suppressing a 0%-ceiling warning).

## Explicitly Not Recommended

- **Building the P&L tracking the scope-decision document describes.** (Explicitly deferred, not silently dropped.) This is a real, genuine gap between the frozen design document and the implementation — but per the Three-Question Gate, adding it now would be a new feature, not a defect fix, and should be evaluated on its own merits (does it save meaningful time / improve decisions) rather than bundled into this verification pass just because the design doc happens to mention it. Recommend raising it explicitly as its own scoped decision, the same way the original Intraday screener-vs-discipline-log question was handled.
- **A generated "signal" or opportunity score of any kind.** Already correctly and deliberately excluded per the frozen scope decision — restated here only to confirm this verification pass didn't quietly reopen that question.

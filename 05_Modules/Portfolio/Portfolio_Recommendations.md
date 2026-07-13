# Portfolio — Recommendations

Per the framework's classification rules: everything below is labeled **Improvement** or **Observation**, not **Defect** — nothing in this module was found to be a *reproducible, incorrect-per-its-own-specification* result. The one Potential Defect (PORT-P01) is documented in the Verification Report, not repeated here as a recommendation, since it needs a specification decision before it can even be classified as a defect or an accepted limitation.

## Improvements (software behaves correctly; these are optional enhancements)

1. **Guard `currentPrice = 0` explicitly.** (Improvement, Medium priority) Currently indistinguishable from "no price set" due to a truthiness check rather than a null-check (FIN-P00). Low real-world likelihood, but a one-line fix (`!== null && !== undefined` instead of truthy check) removes the ambiguity entirely.

2. **Decide and document a stance on negative quantity.** (Improvement, Medium priority) Either explicitly reject it at `addHolding()`, or explicitly document "this application assumes long-only positions; negative quantity is undefined behavior" somewhere a future maintainer would find it. Currently neither — it's simply unspecified. Given the app has no short-selling feature or plans for one (nothing in the charter suggests otherwise), the simpler fix is likely a one-line guard, not new functionality.

3. **Consider merging duplicate-ticker holdings, or make multi-lot tracking an explicit, visible feature.** (Improvement, Low priority) Currently, buying the same stock twice creates two separate rows with no visual grouping. This isn't wrong — multiple purchase lots are a legitimate real-world scenario — but the current UI doesn't distinguish "two lots of the same stock" from "an accidental duplicate entry." A small UI affordance (grouping same-ticker rows with an expandable lot list) would remove that ambiguity without changing any underlying calculation.

## Observations (neutral design notes, no action implied)

4. **Realized gains are not tracked.** Selling a holding deletes it with no record. This is consistent with the module's current stated scope ("what you actually own") but is worth knowing before assuming Portfolio can answer "how much have I made from selling things," which it currently cannot. If that question matters, it's a genuinely new feature (a sale-history log), not a bug fix — and per the Architecture Freeze / Three-Question Gate, should go through that process before being added.

5. **Stock splits and bonus issues require manual adjustment.** Not a defect — no personal-finance app of this scope handles this automatically without a live corporate-actions data feed, which the Import-Driven Data Rule doesn't currently provide for holdings (only for Macro snapshots and Fundamentals). Worth knowing as a real limitation of the current data model, not silently assuming it's handled.

## Explicitly Not Recommended

- Adding brokerage/tax modeling to this module specifically — that's a bigger, separate feature that should go through the Three-Question Gate on its own merits, not be bundled into a verification pass as a side effect.
- Adding short-selling support — no evidence this is a real need for a long-term, Core-Satellite personal investor; the negative-quantity finding (PORT-P01) is worth guarding against as bad input, not building a feature around.

# Product Simplification Audit

**Date:** 2026-07-13
**Scope:** Every module, form, field, button, table, filter, and workflow in `01_Source/wealth-suite`, read from the actual current source code (not from design docs) — cross-checked against the already-completed verification specs for the five frozen modules where relevant.
**Objective set by Dr. Atul:** remove anything that doesn't provide clear long-term value for a single-user, offline, long-term investor. No new features. No UI redesign. Classification only: **KEEP / SIMPLIFY / MERGE / REMOVE**.
**Method note:** every REMOVE/orphaned-field claim below was confirmed by grepping the full source tree for the field/function name, not inferred from reading one file in isolation — where a field is claimed dead, its only appearances in the codebase are cited.

---

## Executive Summary — ranked by impact

1. **Settings: 7 of 9 fields are completely orphaned.** `defaultRiskPct`, `dcfGrowthRate`, `dcfDiscountRate`, `riskFreeRate`, `marginOfSafety`, `sipMonthlyAmount`, `targetEquityAllocationPct` are defined, editable, and saved — but read by zero calculations anywhere in the app. Only `minRiskRewardRatio` and `intradaySatelliteAllocationPct` (both consumed by Intraday) actually do anything. **REMOVE the 7 dead fields.**
2. **Macro has two full, parallel data-entry workflows for the identical 7 indicators** (JSON-paste import vs. a 7-field manual form) — both call the same function, produce identical data. **SIMPLIFY to one workflow.**
3. **Macro's Sector Regime feature is an unsourced, hand-authored prediction** (a static +1/−1/0 sensitivity table, explicitly labeled "illustrative, not a model" in its own UI text) that directly conflicts with the Charter's own "no strategies that rely on prediction without evidence" rule. **REMOVE.**
4. **Research's 10 document types over-model a single-user knowledge base** — 3 of the 10 (`Annual Report Note`, `Concall Summary`, `Quarterly Observation`) differ only by label, not by behavior or data shape. **MERGE to one type; also merge `Key Risk` into `Bear Case`.** Net: 10 → 7 types.
5. **Portfolio silently collects a `purchaseDate` field that is never displayed or used anywhere**, and its data-model comment documents two more fields (`liquidityTier`, `notes`) that were never even given a form control. **REMOVE the dead field; drop the phantom fields from the schema comment.**
6. **A stale, incorrect piece of UI text was found**: Delivery Screener's card footer still reads "Research Library (not yet available)" — Research Library was built, verified, and frozen since this text was written. Not a simplification target, but flagged because it actively misleads.
7. **No Dashboard/home screen exists in the running app** — the requested review list includes "Dashboard," but there is no such module registered; the app currently lands on Fundamentals by default. Noted as a scope clarification, not a KEEP/REMOVE item (nothing to remove — it was never built).
8. **Top navigation order doesn't match the Charter's own stated priority.** Portfolio is described everywhere as the highest-use, Core-tier module, but it's registered third and Fundamentals loads by default. **SIMPLIFY: reorder tabs and change the default landing tab, no visual redesign.**

---

## 1. Top Navigation

**Current:** 8 flat, equal-weight tabs in registration order: Fundamentals, Watchlist, Portfolio, Delivery, Research, Macro, Intraday, Settings. First-registered module (Fundamentals) is the default landing screen (`app.js`, `switchTo(Object.keys(modules)[0])`).

**Finding:** The Charter's own Module Priority Hierarchy ranks Wealth Intelligence (long-term investing) and Portfolio & Risk Management above everything else, and separately states Dr. Atul's actual usage pattern is "checking portfolio/watchlist/research more often on phone." Yet the tab order and default landing screen don't reflect that — a reference/lookup module (Fundamentals) is what opens first, not the action-oriented "what do I own and how is it doing" screen.

- **Classification: SIMPLIFY.**
- **Current design:** Registration order in `index.html`: Fundamentals → Watchlist → Portfolio → Delivery → Research → Macro → Intraday → Settings. Default tab = Fundamentals.
- **Proposed design:** Reorder registration to match the Charter's own stated priority and usage pattern: Portfolio → Watchlist → Research → Delivery → Fundamentals → Macro → Intraday → Settings. Default tab = Portfolio. This is a one-line reordering of the existing `App.registerModule(...)` calls in `index.html` — no new component, no visual redesign, no behavior change to any module itself.
- **Why better:** The first thing opened matches the first thing the Charter says the user actually needs; nothing is added or removed, just resequenced to match already-stated priority.

**Settings tab position:** last, which is conventional and fine. **KEEP** its position.

**Nav labels:** "Delivery" (tab label) vs. "Delivery Screener" (module heading) — a small naming inconsistency, cheap to leave as-is. **KEEP**, not worth the churn of touching a working label for cosmetic consistency alone.

---

## 2. Dashboard

**Finding:** No Dashboard/home/overview module exists anywhere in `index.html`'s registration list or in `01_Source/wealth-suite/js/modules/`. (Note: `03_Dashboard/Verification_Dashboard.md` is a *project documentation* artifact tracking the verification program's status — it is not part of the running application and has no UI counterpart.) There is nothing here to classify KEEP/SIMPLIFY/MERGE/REMOVE, because it does not exist as a feature. Flagged only so the absence is explicit and not assumed to be an oversight in this audit.

---

## 3. Portfolio

**Overall: KEEP.** This is the Charter's own stated Core module and the audit found no bloat in its actually-used surface.

| Item | Verdict | Notes |
|---|---|---|
| Ticker / Quantity / Avg Cost / Asset Class fields | KEEP | All four feed directly into every displayed number. |
| Current price (optional) | KEEP | Core to gain/loss; the only way this app has any price data at all, given the Import-Driven Data Rule forbids a live feed. Ongoing manual upkeep is an inherent cost of that architecture, not a design flaw to fix here. |
| **Purchase date** | **REMOVE** | See below. |
| Summary tiles (Total Value, Invested, Gain/Loss, Return %) | KEEP | Four genuinely distinct numbers, all load-bearing. |
| Sector Allocation / Asset Class Allocation | KEEP | Directly answers "am I too concentrated" — core risk-management value. |
| Table + card duality | KEEP | Established, verified, working responsive pattern — not a redesign target. |
| Remove button (per holding) | KEEP | Necessary. Note: unlike Import, this has no confirmation dialog before an irreversible delete — worth a look, but that's a robustness gap, not a simplification target; not acted on here since the audit's scope is removing excess, not adding safeguards. |
| `liquidityTier`, `notes` (holdings) | **REMOVE from schema comment** | See below. |
| `active` flag + `.filter(h => h.active !== false)` (Portfolio and Intraday both) | **REMOVE (dead defensive code)** | See below. |

### REMOVE: Purchase Date field
- **Why it exists today:** Every investment record "naturally" has a purchase date, so it was included as an obvious field when the add-holding form was built.
- **Why it no longer adds value:** Confirmed by grep — `purchaseDate` is written once (`js/modules/portfolio.js:95`) and never read anywhere else in the entire codebase. It is not shown in the holdings table, not shown in the mobile cards, and not used in any calculation (Portfolio's own frozen Financial Specification explicitly lists stock-split/bonus/tax-holding-period logic as NOT SPECIFIED / NOT IMPLEMENTED — there is no feature today, or planned in the frozen spec, that would consume a holding period).
- **What would be lost:** Nothing observable — the field is invisible today. If LTCG/STCG holding-period tracking is ever actually built, the field is trivial to reintroduce at that time, with real purpose behind it.

### REMOVE (from documentation only): `liquidityTier`, `notes` on holdings
- **Why they exist today:** Named in `data-model.js`'s shape comment for `holdings` (line 35) as part of the original schema design.
- **Why they no longer add value:** Confirmed by grep — `liquidityTier` appears *only* in that one comment line, nowhere else in the codebase. It was never given a form field, never read, never written. `notes` for holdings is likewise absent from the actual add-holding form (Watchlist has a working `notes` field; Portfolio does not, despite the comment implying it should).
- **What would be lost:** Nothing — these were never implemented. Removing them from the comment is a documentation-accuracy cleanup, not a functional change, but worth doing so the schema comment stops describing fields that were never built (the same class of gap already flagged and documented honestly for Research's `aiAnalysis`/`sourceUrl`).

### REMOVE: the `active` flag and its filter
- **Why it exists today:** `addHolding()` sets `active: true` by default, and both Portfolio (`renderList()`) and Intraday (`computeAllocation()`) filter on `h.active !== false` — apparently anticipating a future "deactivate without deleting" feature.
- **Why it no longer adds value:** The only removal path in the entire app is `WealthData.removeHolding(id)`, which deletes the holding outright (a `.filter()` splice) — nothing anywhere ever sets `active: false`. The flag and its two downstream filters are dead defensive code protecting against a state that can never occur.
- **What would be lost:** Nothing currently reachable through the UI. If a genuine "pause/archive a holding without deleting it" need ever appears, this is cheap to reintroduce with an actual UI control behind it.

---

## 4. Fundamentals

**Overall: KEEP.** This module is dense but every piece of it is either load-bearing for a decision or feeds Delivery Screener.

| Item | Verdict | Notes |
|---|---|---|
| Search / sector filter / 2 sort options | KEEP | Genuinely useful once past a handful of companies; required by the Charter's own Nifty-500 Scale Requirement. |
| Ratio grid (ROE, ROCE, D/E, Net Margin, Revenue CAGR, P/E) | KEEP | All six are either displayed directly or consumed by Delivery Screener — no redundant ratio here. |
| Red flags list | KEEP | Directly actionable risk signal. |
| Bank/lender inline warning | KEEP | Prevents genuinely misleading reads of D/E-style ratios for financial institutions. |
| Year-by-year table + cards | KEEP, with one SIMPLIFY noted below | |
| "Source" / "Fetched" footer line | KEEP | Cheap, and meaningfully answers "how stale is this" in an import-only, no-live-feed app. |

### SIMPLIFY: Year-by-year ROE calculation
- **Current design:** The year-by-year table (`js/modules/fundamentals.js`, table and card loops) computes each historical year's ROE inline, twice (once for the desktop table, once for the mobile card list): `y.totalEquity ? ((y.netProfit/y.totalEquity)*100).toFixed(1) : '—'`. This only guards against `totalEquity` being falsy (zero) — it does **not** guard against negative equity the way the shared `latestRatios()` function does for the *latest* year (the FUND-D01 fix). A historical year with negative equity would render a numerically valid-looking but meaningless negative-equity ROE here, even though the exact same defect was found and fixed for the latest-year figure above it on the same screen.
- **Proposed design:** Replace both inline expressions with a call to a single small shared per-year ratio helper that applies the same `totalEquity > 0` guard already proven correct in `latestRatios()` — one function, called from both the table and card loops, instead of two hand-written copies of the same formula with two different guard levels.
- **Why better:** Removes a second, weaker copy of logic that was already found defective once (FUND-D01) and fixed elsewhere — the exact "two implementations risk drifting apart" pattern this project's own verification framework was built to catch (per Phase 1A). This is a correctness/consistency simplification, not a feature cut.

---

## 5. Delivery Screener

**Overall: KEEP.** Explicitly the Charter's "most important module," and the audit found its complexity is earned — it exists specifically to make a 5-pillar rule-based score explainable, which is a stated project value (AI Philosophy: "every recommendation must be explainable"), not scope creep.

| Item | Verdict | Notes |
|---|---|---|
| Search / sector filter / 5 sort options | KEEP | The Charter's Scale Requirement explicitly calls for "sorting by any scoring pillar" — this is a requirement being satisfied, not an unused option. |
| "Reading this screen" explainer text | KEEP | Static text, zero maintenance cost, prevents the Technical Trend "Not available" state from reading as a bug. |
| Top strengths / Top risks (always visible) | KEEP | The single highest-value piece of the card — a plain-language answer, not just a score. |
| Expandable full pillar/sub-factor breakdown | KEEP | Dense, but this *is* the explainability the project explicitly commits to — removing it would make the score a black box, which the AI Philosophy rules out. |
| Pagination ("Show 20 more") | KEEP | Required at Nifty-500 scale, not decorative. |
| Cross-links footer (Fundamentals / Portfolio / Watchlist / Research) | **Fix stale text** | See below — not a simplification target, a found defect. |

### Found defect, not a simplification target: stale "Research Library (not yet available)" link
The expanded card's cross-links row (`js/modules/delivery-screener.js`, `renderCard()`) hard-codes: `<span style="color:var(--paper-faint);">Research Library (not yet available)</span>` — plain disabled-looking text, not a working link. Research Library was built, verified, and frozen in this same project (`05_Modules/Research/`), and is registered as a working tab in `index.html`. This line was never updated after Research shipped. Recommend replacing it with a real link matching the other three (`<a href="#" onclick="App.switchTo('research');return false;">Research</a>`) — a one-line fix, called out here because the audit surfaced it, not because it's part of the simplification objective itself.

---

## 6. Intraday

**Overall: KEEP, with a standing caveat.** This module was already deliberately scoped down once (screener → discipline log) specifically to honor the Core-Satellite philosophy and the "no prediction without evidence" rule — it does not need further cutting on those grounds. The audit's one open question is usage, not design.

| Item | Verdict | Notes |
|---|---|---|
| Add-trade form (ticker, entry, stop, target, size, reason) | KEEP | All six feed the checklist or the trade record directly; nothing decorative. |
| Live checklist preview while typing | KEEP | Pure derived display, no persisted state, reinforces discipline before the trade is even logged — cheap and on-purpose. |
| Entry reason (required free text) | KEEP | This is explicitly *not* a "rarely used free-text field" — it's mandatory every time and is the one piece of this whole app that directly enforces "state your reason before you act." |
| Allocation summary (Deployed / Ceiling / % in play) + over-ceiling warning | KEEP | Directly implements the Core-Satellite 10–20% ceiling — this is the module's actual reason for existing. |
| "Why there's no screener here" explainer | KEEP | Static text, cheap, prevents the module's reduced scope from reading as an incomplete build. |
| Close — Win / Close — Loss buttons | KEEP, with a caveat | See below. |

**Caveat, not a recommendation:** Intraday's own frozen Verification Report already documents that closing a trade records only a Win/Loss label — no P&L amount is ever captured, a real gap between the module's original design doc and what was built. That limits how useful the trade log actually is for judging *how well* discipline is paying off, only *whether* trades happen to win or lose. This isn't grounds to remove the Close buttons (they're the module's entire feedback loop) — but it's worth naming plainly: today's win/loss tracking is a thin signal, and expanding it would be a new feature, out of this audit's scope.

**Module-level flag (not a recommendation, a question for Dr. Atul):** Intraday is, by the Charter's own hierarchy, the lowest-priority tier actually in scope (Satellite, 10–20% ceiling, below Wealth Intelligence/Portfolio/Swing). Of all 8 modules, this is the one whose real-world usage is worth an honest self-check: if intraday trading isn't actually happening in practice, this is the best candidate for a future full-module REMOVE. Nothing in the code suggests removing it now — it's lean and correctly scoped — but module-level continuation should be revisited based on actual use, not kept indefinitely by default.

---

## 7. Macro

**Overall: SIMPLIFY / partial REMOVE.** This is the module with the most excess in the entire app.

| Item | Verdict | Notes |
|---|---|---|
| Raw indicator tracking (repo rate, CPI, USD/INR, crude, bond yield, FII/DII flow) | KEEP | Legitimate, sourced, undisputed context for long-term asset-allocation decisions. |
| JSON-paste import workflow | KEEP (as the sole entry path) | See SIMPLIFY below. |
| Manual 7-field entry form | **REMOVE (merge into the one JSON path)** | See below. |
| Sector Regime (8 sectors, Tailwind/Neutral/Headwind) | **REMOVE** | See below. |

### SIMPLIFY: Two parallel data-entry workflows for identical data
- **Current design:** Two complete, separately-coded UI blocks exist side by side for entering the exact same 7 indicators: (1) a textarea for pasting an AI-generated JSON snapshot plus an "Import snapshot" button, and (2) a 7-input manual form plus a date field plus a "Save manual entry" button. Both call the identical `importSnapshot(json)` function and write into the identical `macroIndicators` structure — they are functionally interchangeable, not complementary.
- **Proposed design:** Keep only the JSON-paste import path (the one already described in the Charter as the recommended workflow: "ask Claude/ChatGPT periodically... paste the result"). Remove the 7-field manual form, its date field, and its "Save manual entry" button.
- **Why better:** The manual form's original justification — "a fallback baseline for full offline independence with no AI dependency at all" — was written as a hypothetical safety net, not from an observed need. This user is already working inside an AI-assisted workflow (this very session is Claude Code) for every other data-entry task in the project; maintaining a second, fully parallel input surface for one data concept is exactly the "ongoing maintenance without proportional value" the audit was asked to find. Every time an indicator is added or renamed, both the manual field list and the JSON schema documented in the placeholder text must be kept in sync by hand — a real, avoidable drift risk, not a theoretical one.
- **What would be lost:** The ability to enter macro data by typing numbers directly with zero AI involvement at any point. Given the user's actual documented workflow, this capability is currently unused in practice; it can be reintroduced cheaply later if that assumption ever changes.

### REMOVE: Sector Regime
- **Why it exists today:** Ported directly from an earlier prototype artifact ("the earlier Macro Intelligence artifact") during the initial build, carried forward because it already existed elsewhere, not because it was independently designed for this app.
- **Why it no longer adds value:** The sensitivity table (`SENSITIVITY` in `js/modules/macro.js`) is a static, hand-authored +1/−1/0 assignment per sector per indicator, with no empirical basis, no back-testing, and no update mechanism — and the module's own UI text already says so plainly: *"Illustrative — a static sensitivity rule, not a model."* It computes a Tailwind/Headwind/Neutral label from only two data points (the two most recent snapshots), which is a direction-of-one-datapoint signal, not an evidence-based read. This directly conflicts with the Charter's own Investment Priority Order rule: *"No strategies that rely on prediction without evidence."* It is the clearest single example in this app of "a feature that exists because it seemed like a good idea" rather than because it was built to satisfy an actual, evidenced need.
- **What would be lost:** A colored Tailwind/Neutral/Headwind badge per sector. Nothing quantitative is lost — the raw indicator readings that feed it (which are real, sourced numbers) remain fully visible in the "Current readings" grid above it; only the interpretive layer on top is removed.

---

## 8. Research

**Overall: KEEP the module; MERGE its document-type taxonomy.** (Research was just verified and frozen this same session — this audit applies the same "does every piece earn its keep" lens to it as every other module, per the objective stated.)

| Item | Verdict | Notes |
|---|---|---|
| Investment Thesis / Bull Case / Bear Case | KEEP | Distinct, standard value-investing framings; each answers a different question. |
| Key Risk | **MERGE into Bear Case** | See below. |
| Management Assessment | KEEP | A distinct judgment (about people) that neither the bull/bear case nor a risk note naturally captures. |
| Annual Report Note / Concall Summary / Quarterly Observation | **MERGE into one "Company Update" type** | See below. |
| AI-Generated Summary | KEEP, borderline | Its distinct value isn't content — it's provenance (flagging "this text is a pasted AI summary, not my own analysis"), which matters when reviewing old decisions later. Kept for that reason alone, not for any behavioral difference in the code (there is none). |
| Decision Record | KEEP | The only type with a real, structured data field (`decision`) and genuinely distinct downstream behavior. Core to the module's "why did I buy/sell" purpose. |
| Search (ticker only) | KEEP | Sufficient at the scale a single-user knowledge base actually reaches; no full-text search needed. |
| Sort (Newest first / Ticker A-Z) | KEEP | Both genuinely useful; the ticker-list ordering defect found and fixed this same session (RL-D01) is resolved. |
| `aiAnalysis` / `sourceUrl` schema fields | **REMOVE from documentation** | Already identified during this module's verification pass as named in the data-shape comment but never implemented anywhere. Consistent with this audit's broader finding that unused, aspirational schema fields should be dropped from documentation rather than carried indefinitely — see `Research_Financial_Specification.md`'s existing NOT SPECIFIED entry. |

### MERGE: Key Risk → Bear Case
- **Current design:** Two separate document types both exist to answer "why might this investment not work out" — `Bear Case` (a structured, usually one-time write-up) and `Key Risk` (nominally for logging a newly-discovered risk mid-quarter, as a separate dated entry).
- **Proposed design:** One type, `Bear Case`. A newly-discovered risk becomes a new, separately-dated `Bear Case` entry for that ticker (the timeline already shows every entry with its own date — nothing about "a risk found later" requires a different `docType`, only a new entry).
- **Why better:** Both types serve the identical underlying purpose with no behavioral or data-shape difference between them (`TYPE_COLOR` already colors both "loss" — the same visual treatment). One less choice in a dropdown that will otherwise force the user to decide, every time, which of two functionally identical categories to pick.

### MERGE: Annual Report Note + Concall Summary + Quarterly Observation → "Company Update"
- **Current design:** Three separate document types, distinguished only by *which disclosure or event prompted the note* (an annual report vs. an earnings call vs. a general quarterly check-in) — not by any different field, behavior, or downstream use. None of the three even has a distinct badge color in `TYPE_COLOR` (all three render identically today).
- **Proposed design:** One type, `Company Update`, covering any periodic, event-driven observation. The specific trigger (which the three separate types exist solely to convey) is already naturally captured in the free-text Title field — the module's own placeholder text example, *"Q1 FY27 concall — margin commentary,"* already demonstrates that the source is written into the title as a matter of course, making the separate `docType` redundant with information the user already writes down anyway.
- **Why better:** Cuts the "Type" dropdown from 10 options to 7 without losing any distinguishing information — what made these three different was never encoded in the data model or the code, only in the label, and the label's job is already done by the title.

---

## 9. Watchlist

**Overall: KEEP, largely unchanged.** Small, clean module; the audit found only naming friction, not bloat.

| Item | Verdict | Notes |
|---|---|---|
| Ticker / Target price / Notes fields | KEEP | All three are read back and displayed; none are write-only. |
| 4 categories (Watch, Research, Buy Soon, Reject) | SIMPLIFY (rename one) | See below. |
| Table + card duality | KEEP | Standard, working pattern. |
| Remove button | KEEP | |

### SIMPLIFY: rename the "Research" category
- **Current design:** One of Watchlist's four category options is literally named `"Research"` — the exact same word as the separate Research Library *module*, which means something different (a whole knowledge-base of dated notes vs. one funnel-stage label on a watchlist row).
- **Proposed design:** Rename this one dropdown option to something that doesn't collide with the module name (e.g., "Reviewing" or "Studying" — exact wording is a naming choice, not a redesign; the field, its position, and its behavior are unchanged).
- **Why better:** Removes a real source of "which 'Research' do you mean" confusion between two unrelated features that happen to share a word, at zero functional cost — a one-string text change, not a UI change.

**Considered and explicitly rejected: merging Watchlist into Research Library.** Both track "stocks I haven't fully decided on yet," which could suggest folding Watchlist's 4-category funnel into a Research Library doc type. Rejected because they serve genuinely different, complementary purposes: Watchlist is a quick-glance, structured status + target price list (built for scanning at a glance, on a phone, in seconds); Research Library is a long-form, dated knowledge base (built for depth, not speed). Collapsing the fast list into the slow archive would make the fast list slower to use for its actual job. Kept separate, on purpose, not by default.

---

## 10. Settings

**Overall: SIMPLIFY sharply — this is the single highest-impact REMOVE in the audit.**

Verified by grepping every settings key against the entire source tree: of 9 defined fields, only **2 are ever read** by any calculation anywhere in the app.

| Field | Used by | Verdict |
|---|---|---|
| `minRiskRewardRatio` | Intraday (`computeChecklist`, live preview) | KEEP |
| `intradaySatelliteAllocationPct` | Intraday (`computeAllocation`) | KEEP |
| `defaultRiskPct` | *(nowhere — confirmed by grep)* | **REMOVE** |
| `dcfGrowthRate` | *(nowhere — no DCF calculator exists in this app at all)* | **REMOVE** |
| `dcfDiscountRate` | *(nowhere)* | **REMOVE** |
| `riskFreeRate` | *(nowhere)* | **REMOVE** |
| `marginOfSafety` | *(nowhere)* | **REMOVE** |
| `sipMonthlyAmount` | *(nowhere — no SIP calculator exists in this app)* | **REMOVE** |
| `targetEquityAllocationPct` | *(nowhere — Portfolio computes actual asset-class allocation but never compares it to a target anywhere)* | **REMOVE** |

### REMOVE: 7 orphaned Settings fields
- **Why they exist today:** All 7 were defined up front in the original data-model design, anticipating features that were planned in the Charter's broader vision — a DCF valuation calculator (`dcfGrowthRate`, `dcfDiscountRate`, `riskFreeRate`, `marginOfSafety`), a SIP simulator (`sipMonthlyAmount`), a target-allocation tracker (`targetEquityAllocationPct`), and a generic position-sizing default (`defaultRiskPct`). None of these consuming features exist in this codebase — Delivery Screener's Valuation pillar, for instance, computes its "reasonable P/E" heuristic entirely from hardcoded constants (`10 + revenueCagr*0.8 + (qualityScore-50)*0.15`, clamped `8–45`) and reads no Settings value at all, despite the presence of 4 DCF-shaped fields that look like they should feed exactly this calculation.
- **Why they no longer add value:** A user opening Settings today sees 9 fields presented with equal visual weight, and has no way to tell from the UI that editing 7 of them has zero effect anywhere in the app. This is the purest form of "ongoing maintenance without proportional value" in the entire audit — every one of these fields must still be carried through `emptyState()`, `replaceAll()`'s merge-on-import logic, and the Settings form's render loop, for no behavioral payoff.
- **What would be lost:** Nothing functional — none of these values currently change anything the app does or displays. If a DCF calculator, SIP simulator, or target-allocation tracker is ever actually built, its settings should be added back in *at that time*, scoped to what that feature actually needs — which may not even be these same 4–5 fields once a real formula is designed, per the Build Roadmap's own "small trusted dataset first, scale after correctness is proven" philosophy applied to features generally.

---

## 11. Backup / Restore

**Overall: KEEP all three mechanisms, redundancy noted and accepted.**

| Item | Verdict | Notes |
|---|---|---|
| Manual "Save" button | KEEP | Functionally redundant with the 60-second auto-save and the `beforeunload` auto-save (all three call the identical `Persistence.save()`) — but for financial data in a single-user offline app, an explicit "I want to know right now that this is safe" affordance is reasonable trust-building, not wasted complexity. Flagged as intentionally accepted redundancy, not overlooked. |
| Export backup | KEEP | The only mechanism that gets data out of one browser's IndexedDB at all — critical, not optional. |
| Import backup (with confirm dialog) | KEEP | Necessary complement to Export; already has an appropriate confirmation step before an irreversible replace. |
| "Saved" status toast | KEEP | Cheap, immediate feedback. |

**Observation, not a recommendation:** `state.meta.lastSavedAt` is tracked on every save (`persistence.js`) but is never displayed anywhere in the UI. Unlike the dead fields identified elsewhere in this audit, this one is clearly purposeful (it exists specifically to answer "when was this last saved") — it's simply not surfaced today. Noted for awareness only; adding a display for it would be a new feature, which is outside this audit's scope.

---

## 12. Forms — cross-cutting summary

| Module | Field count | Verdict |
|---|---|---|
| Portfolio (add holding) | 6 (Ticker, Qty, Avg Cost, Current Price, Asset Class, Purchase Date) | 5 KEEP, 1 REMOVE (Purchase Date) |
| Watchlist (add item) | 4 (Ticker, Category, Target Price, Notes) | KEEP, 1 label rename |
| Research (add entry) | 5 (Ticker, Type, Decision*, Title, Content) | KEEP structure; Type options MERGE 10→7 |
| Intraday (log trade) | 6 (Ticker, Entry, Stop, Target, Size, Reason) | KEEP all |
| Macro (import) | 1 (JSON textarea) | KEEP — becomes the sole path |
| Macro (manual entry) | 8 (7 indicators + Date) | REMOVE entirely |
| Settings | 9 numeric fields | 2 KEEP, 7 REMOVE |

No form in the app has more fields than its own displayed output actually uses, **except** Portfolio (Purchase Date) and Settings (7 of 9) — both addressed above.

---

## 13. Tables

Portfolio, Fundamentals (year-by-year), and Watchlist each use the same table+card responsive duality — one data loop, two presentations, per the Charter's frozen mobile-first architecture. **KEEP this pattern everywhere it appears** — it is established, verified, working infrastructure, not a redesign target. The only table-level finding is Fundamentals' year-by-year ROE guard inconsistency, already covered under Fundamentals (§4) as a SIMPLIFY item.

---

## 14. Filters & Search

| Module | Search | Sector filter | Sort options | Verdict |
|---|---|---|---|---|
| Fundamentals | Yes | Yes | 2 | KEEP — needed at Nifty-500 scale |
| Delivery Screener | Yes | Yes | 5 (one per pillar) | KEEP — explicitly required by the Charter's Scale Requirement |
| Research | Yes (ticker only) | No (not sector-tagged) | 2 | KEEP |
| Portfolio | None | None | None | **Correctly absent** — a personal holdings list of realistic size doesn't need it; not a gap. |
| Watchlist | None | None | None | **Correctly absent** — same reasoning. |
| Intraday | None | None | None (fixed newest-first) | **Correctly absent** — a personal trade log doesn't need filtering at this scale. |

No action recommended here — the presence/absence of search and filtering already tracks module scale appropriately across the app.

---

## 15. Buttons

Every actionable button in the app, in one place:

| Button | Module | Verdict |
|---|---|---|
| Save / Export backup / Import backup | Masthead | KEEP (see §11) |
| Add holding / Remove | Portfolio | KEEP |
| Add to watchlist / Remove | Watchlist | KEEP |
| Add entry | Research | KEEP |
| Log trade / Close — Win / Close — Loss | Intraday | KEEP |
| Import snapshot | Macro | KEEP (becomes the sole entry action) |
| Save manual entry | Macro | **REMOVE** (with the manual form) |
| Show breakdown / Show 20 more | Delivery Screener | KEEP |
| Save settings | Settings | KEEP (form itself shrinks; button stays) |

No button in the app does nothing or duplicates another button's exact effect — the redundancy that exists (Save vs. auto-save) is at the *mechanism* level, already addressed in §11, not at the button level.

---

## 16. All User-Entered Fields — master inventory

Every field a user can type or select into, across the whole app, with a final verdict:

| Field | Module | Type | Ever displayed/used elsewhere? | Verdict |
|---|---|---|---|---|
| Ticker | Portfolio, Watchlist, Research, Intraday, Macro (n/a) | text | Yes, everywhere it's captured | KEEP (×4) |
| Quantity | Portfolio | number | Yes (value calc) | KEEP |
| Average Cost | Portfolio | number | Yes (value/gain calc) | KEEP |
| Current Price | Portfolio | number | Yes (value/gain calc) | KEEP |
| Asset Class | Portfolio | select | Yes (allocation summary) | KEEP |
| **Purchase Date** | Portfolio | date | **No — confirmed dead** | **REMOVE** |
| Category | Watchlist | select | Yes (badge, filter-by-eye) | KEEP; rename "Research" option |
| Target Price | Watchlist | number | Yes (displayed) | KEEP |
| Notes | Watchlist | text | Yes (displayed) | KEEP |
| Type (docType) | Research | select | Yes (badge) | KEEP; 10→7 options |
| Decision | Research | select (conditional) | Yes (displayed, structured) | KEEP |
| Title | Research | text | Yes (displayed) | KEEP |
| Content | Research | textarea | Yes (displayed) | KEEP |
| Entry Price | Intraday | number | Yes (risk-reward, checklist) | KEEP |
| Stop-Loss | Intraday | number | Yes (risk-reward, checklist) | KEEP |
| Target | Intraday | number | Yes (risk-reward) | KEEP |
| Position Size | Intraday | number | Yes (deployed capital) | KEEP |
| Entry Reason (notes) | Intraday | text (required) | Yes (checklist gate + displayed) | KEEP |
| 7 Macro indicators (manual form) | Macro | number ×7 | Yes, but identical to the JSON path | **REMOVE (form)**, keep JSON path |
| Manual entry Date | Macro | date | Only used by the form being removed | **REMOVE** |
| JSON snapshot | Macro | textarea | Yes — sole surviving entry path | KEEP |
| 9 Settings fields | Settings | number ×9 | 2 of 9 ever read | **REMOVE 7 of 9** (see §10) |
| `liquidityTier`, holdings `notes` | Portfolio (schema only) | — | Never had a UI field at all | **REMOVE from schema comment** |
| `aiAnalysis`, `sourceUrl` | Research (schema only) | — | Never had a UI field at all | **REMOVE from schema comment** (already flagged during Research's own verification) |

---

## What was explicitly checked and found to already be lean (no action needed)

- Portfolio, Watchlist, and Intraday's deliberate *absence* of search/filter/sort — appropriate at personal-list scale, not a gap.
- Fundamentals' and Delivery Screener's shared ratio/quality/red-flag logic (`company-calculations.js`) — already deduplicated during the Product Completion Phase; no remaining duplication found.
- Intraday's Portfolio Value calculation — already calls Portfolio's shared functions directly (fixed proactively during Intraday's own verification, IN-06); not reimplemented.
- The table+card responsive duality pattern — one implementation pattern, reused consistently, not three different approaches to the same problem.
- Watchlist vs. Research Library as separate modules — considered for merging, deliberately kept apart (see §9).

---

## Summary of concrete actions, if approved

**REMOVE:**
1. Portfolio: `purchaseDate` field (form + storage).
2. Portfolio: `liquidityTier` and `notes` from the holdings schema comment (never implemented).
3. Portfolio + Intraday: the `active` flag and its two `.filter(h => h.active !== false)` call sites (dead — nothing ever sets it false).
4. Macro: the entire manual 7-field entry form, its date field, and its "Save manual entry" button.
5. Macro: the Sector Regime feature (`computeRegime()`, its card rendering, and the `SENSITIVITY` table).
6. Settings: `defaultRiskPct`, `dcfGrowthRate`, `dcfDiscountRate`, `riskFreeRate`, `marginOfSafety`, `sipMonthlyAmount`, `targetEquityAllocationPct` (7 of 9 fields).
7. Research: `aiAnalysis` and `sourceUrl` from the schema comment (never implemented).

**MERGE:**
8. Research document types: `Key Risk` → `Bear Case`; `Annual Report Note` + `Concall Summary` + `Quarterly Observation` → one `Company Update` type. (10 → 7 types.)

**SIMPLIFY:**
9. Fundamentals: year-by-year ROE display — replace two inline, inconsistently-guarded formulas with one shared, properly-guarded helper.
10. Top navigation: reorder tabs and change the default landing tab to Portfolio, matching the Charter's own stated priority (no visual redesign).
11. Watchlist: rename the "Research" category option to avoid confusion with the Research Library module.

**Found defect (not a simplification item, flagged because the audit surfaced it):**
12. Delivery Screener's cross-links footer still says "Research Library (not yet available)" — Research shipped this same session; the link should be made live.

Nothing above touches any of the five already-frozen modules' verified calculations (Portfolio, Fundamentals, Delivery Screener, Intraday, Research) — every REMOVE/SIMPLIFY/MERGE item here is either a dead field, an unused setting, a duplicated workflow, or a non-evidence-based feature layered on top of otherwise-sound modules. No code has been changed as part of this audit — per instructions, this is a recommendations-only document, awaiting approval before any implementation.

# Wealth Intelligence Suite — Project Charter
*Permanent reference document. Read before every design or implementation decision.*

---

## About Dr. Atul

A doctor by profession, not a software engineer. This is a personal-use tool only — not for sale, not multi-user, not a commercial product. Explain technical concepts in plain language; give step-by-step guidance whenever hands-on work is needed.

## Primary Objective

Not to build the most advanced trading platform. To build a personal Wealth Intelligence Suite that helps Dr. Atul make better investment decisions with minimal time and effort — a long-term investment assistant.

## The Core-Satellite Investment Philosophy

**Core (80–90%): Long-term investing and portfolio management.** This is the primary purpose of the entire project.

**Satellite (10–20%): High-probability intraday opportunities**, using strict risk management and predefined rules. A small, controlled, complementary piece — never the foundation.

Intraday trading is one strategy *within* the Wealth Intelligence Suite, not a separate or dominant goal. It stays in the project, scoped deliberately small.

## Module Priority Hierarchy

Work happens in this order whenever time or effort is limited — always improve a higher tier before adding to a lower one:

1. **Wealth Intelligence (long-term investing)** — highest priority
2. **Portfolio & Risk Management**
3. **Swing / Positional Decision Support**
4. **Intraday Decision Support**
5. **Learning and simulation tools** (paper trading, options/futures simulation, gamification) — lowest priority

## Design Philosophy — the standing test

Before adding anything: *"Will this help Dr. Atul make better investment decisions or save meaningful time?"* If no, don't build it. Avoid feature creep. Keep things focused, practical, maintainable.

## Simplicity First

Simple architecture, fewer moving parts, readable code, stable long-term operation, reliability over cleverness. No microservices, no Kubernetes, no distributed systems, no message queues, no enterprise DevOps — none of that unless explicitly requested.

**Architecture decision, confirmed 2026-07-12 (supersedes the earlier SQLite/Python direction):** the final application is pure HTML, CSS, and JavaScript — a single `index.html` that opens directly in a browser, no installation, no backend, no external dependencies. Internally organized into separate JS/CSS files for maintainability, but presented as one seamless app. IndexedDB provides automatic local persistence; Export/Import JSON provides portable backups. The SQLite/Python prototype from earlier the same day is not being carried forward as running code — its schema directly informed the JS data model, but the actual database files are not part of the final app.

**Permanent rule, added 2026-07-12:** never rewrite a working module simply for architectural purity. Refactor only when it simplifies maintenance, reduces manual work, or measurably improves the user experience while preserving existing behavior.

## Mobile-First Responsive Requirement

**Permanent rule, added 2026-07-12.** Mobile-compatible does not mean mobile-developed — one responsive codebase, not separate mobile/desktop versions.

- The Wealth Intelligence Suite must be mobile-first and fully responsive: every screen works comfortably on a 6–7 inch Android phone, scales cleanly to tablet and desktop.
- Single codebase, single HTML/CSS/JS — no separate mobile app, no separate "lite" version.
- **Every new module must satisfy this checklist before it's considered complete:** works on a 6.5" Android phone; works on a Windows laptop; same codebase for both; no feature is desktop-only unless there's a genuine technical limitation.
- **Design rules:** minimum 44px touch targets everywhere interactive; no horizontal scrolling, ever; cards instead of wide tables on phones (same underlying data, different presentation — never a separate data path); bottom navigation or a collapsible side menu on mobile; multi-column layouts allowed on desktop where space genuinely helps.
- **The one-hand rule:** if a feature can't be comfortably used one-handed on an Android phone, redesign it before adding more functionality to it. Given Dr. Atul's actual usage pattern — checking portfolio/watchlist/research more often on phone, importing data and deep analysis more often on laptop — phone usability is not a secondary concern, it's the primary case to design for.
- **Purpose-optimized depth per screen, added 2026-07-12.** Mobile-first does not mean mobile-identical. Do not force desktop-quality analytical depth onto a 6.5" screen if it harms usability — a full DCF table or a 13-column screening ledger is genuinely unusable at that size regardless of how well it scrolls. Instead: mobile gets summaries, cards, and drill-down (tap a card for more, rather than showing everything at once); desktop preserves full analytical capability — multi-column comparisons, complete tables, dense data. Same underlying data and calculations always; the *amount surfaced at once* is what changes by screen size, not the correctness or completeness of what's available.

**Frozen, 2026-07-12:** the application architecture (pure HTML/CSS/JS, shared `WealthData` model, IndexedDB + Export/Import) and the responsive design system (mobile-first CSS, 44px touch targets, bottom-nav/top-nav pattern, card/table duality) are both considered stable. Future module work builds *within* this foundation; it does not revisit or redesign it, per the "no rewrite for architectural purity" rule.

## Build Roadmap

Set 2026-07-12, revised same day. Core modules, in order, before any visual polish:

1. ~~Fundamentals~~ — done
2. ~~Settings~~ — done
3. ~~Watchlist~~ — done
4. ~~Portfolio~~ — done, 2026-07-12
5. ~~Delivery Screener~~ — done, 2026-07-12
6. Research Library — next
6. ~~Research Library~~ — done, 2026-07-12
7. ~~Macro~~ — done, 2026-07-12
8. ~~Intraday~~ — done, 2026-07-12 (scoped as a discipline log, not a screener — see intraday-scope-decision.md)

All 8 planned modules complete. Product Completion Phase in progress — see Current State for verified vs. outstanding items before RC1.

Animations, themes, and visual refinement are explicitly last — only after every module above exists in working form.

**Reordering rationale, recorded so it isn't re-litigated later:** priority is set by one test — *will Dr. Atul personally use this at least once a week?* Portfolio and Delivery Screener pass that test; Research Library doesn't yet, though it will once there's something to research against.

## Standalone Value Rule

**Permanent rule, added 2026-07-12.** Every module must provide immediate value on its own. Someone should be able to open any completed module and find it genuinely useful even if later modules in the roadmap haven't been built yet. Avoid building a module that depends heavily on an unfinished future component — this is what keeps the app usable throughout development instead of only becoming useful once everything exists.

## Research Library — expanded scope (for when it's built)

Not a note-taking tool. A **Company Knowledge Base.** For each company, it should eventually hold: investment thesis, bull case, bear case, key risks, management-quality assessment, annual report notes, concall summaries, AI-generated summaries, quarterly observations, and a decision history ("why did I buy," "why did I sell"). The value compounds over years — the ability to look back and see *why* a past decision was made is the actual point, not just storing documents. Recorded here now, ahead of when this module gets built, so the fuller vision isn't lost or narrowed down to "just notes" by the time it's implemented.


## Scale Requirement — Develop with Nifty 50, Deploy for Nifty 500

**Permanent architectural requirement, added 2026-07-12.** Nifty 50 is a development/testing/validation dataset — small enough to verify calculations, scoring, and workflow without unnecessary complexity. It is **not the final target universe.** The production system must be designed for the full Nifty 500.

- Never hardcode assumptions that only work for 50 companies.
- Every module must scale from 50 to 500 without architectural changes — algorithms, data structures, filters, search, reports, and UI components all designed with 500 in mind from the start, even while developed and tested against 50.
- Performance must remain acceptable for 500 companies in-browser.
- Required UX at scale: fast search, sector filters, market-cap filters, watchlist/portfolio filtering, sorting by any scoring pillar, favorites/custom views. **The user should never need to scroll through 500 companies manually.**
- Development strategy: validate with Nifty 50 first, expand to Nifty 500 only after a module is stable and tested — same "small trusted dataset first, scale after correctness is proven" philosophy used throughout this project.

**Audit performed the same day this rule was set, not deferred:** checked the two modules that list companies (Fundamentals, Delivery Screener) for exactly the kind of hardcoded-small-scale assumption this rule warns against. Found two real ones, not hypothetical: Fundamentals rendered every ticker as an unfiltered chip with no search; Delivery Screener rendered every candidate as a full detailed card, unconditionally, with no limit. Both would have broken the "never scroll through 500 manually" rule directly at real scale. Both fixed the same day — see Current State below.



## Data Independence Rule

**Permanent architectural requirement, added 2026-07-12.** The application must never assume a specific market universe. Nifty 500 is the initial production target, but the architecture always operates on a generic company universe — the data source determines which companies are available, never the application code. Today: Nifty 50 (development). Next: Nifty 500 (production). Future: Nifty Midcap 150, Nifty Smallcap 250, BSE 500, custom watchlists, international markets — no module should require code changes when the universe changes.

The application answers *"show me the companies in the current dataset"* — never *"show me the Nifty 500 companies."*

**Audit performed the same day this rule was set:** searched every module for hardcoded universe references. Found exactly one occurrence of `"NIFTY50"` in the entire codebase (in `fundamentals.js`'s seed function) — and it's descriptive metadata (`indexMember`, recording where a company's data came from), never filtered or compared against anywhere. **Verified behaviorally, not just by absence of a grep hit:** seeded a deliberately mixed dataset — a Nifty 50 company, a Nifty Midcap 150 company, a custom-watchlist company, and one company with no universe tag at all — and confirmed every module (tested: Delivery Screener) includes all four identically, including the untagged one (scored normally, no crash, no special-casing). The architecture already satisfies this rule; nothing needed fixing. Recorded here so future modules are held to the same standard, not because a violation was found and patched.

## Validation Rule

**Permanent, added 2026-07-12.** Nifty 50 remains the primary regression-testing dataset — small, fast, easy to verify manually. When a module passes all Nifty 50 validation tests, verify it once against the full Nifty 500 dataset. After that checkpoint, continue routine testing against Nifty 50 unless a specific issue only manifests at larger scale.

## Performance Rule

**Permanent, added 2026-07-12.** Targets: initial load stays responsive at ~500 companies; search/filter/sort feels instantaneous; only visible items render in the browser; expensive calculations are cached and recomputed only when underlying data changes. No premature optimization beyond this — the goal is a fast, reliable single-user app, not an enterprise platform.

**Already measured against these targets, from the scaling work done the same day:** filter+sort over 500 items averaged 0.56ms per pass (100 rapid iterations) — comfortably "instantaneous." Delivery Screener's full pillar computation for 500 companies measured 49ms — comfortably "responsive" for a one-time per-open cost. Pagination (20 at a time) already ensures only a bounded number of items render regardless of universe size, directly satisfying "only visible items rendered." **One deliberate non-optimization, recorded rather than silently left alone:** Delivery Screener recomputes all candidates fresh every time the module opens, rather than caching across opens and invalidating on data change. At 49ms this is not a real cost — adding cache-invalidation logic now would be optimizing a problem that doesn't exist yet, which the rule itself warns against. Worth revisiting only if real-world company count or module-switching frequency ever makes that 49ms actually noticeable.

## Architecture Freeze

**Permanent, added 2026-07-12.** No new architectural patterns, persistence mechanisms, optimization layers, or framework changes unless a *measurable* limitation is demonstrated — not a theoretical concern. From this point, focus is completing remaining modules and improving user experience within what already exists.

**Every future feature discussion starts with three questions, in order:**
1. Does this help Dr. Atul make better investment decisions?
2. Does it save meaningful time?
3. Can it be implemented within the existing architecture?

All three "Yes" → implement. Any "No" → recommend against it.

## Import-Driven Data Rule

**Permanent, added 2026-07-12.** A pure offline HTML application cannot automatically fetch live data — no live API calls, no automatic downloads, ever, for any data type (macro, fundamentals, price history, or anything future). All external data enters the Wealth Intelligence Suite through a standardized **Import** process, not automatic fetching.

**Recommended workflow for macro data specifically:** ask an AI assistant (Claude, ChatGPT, etc.) periodically — "give me the latest Indian macro data in Wealth Intelligence JSON format" — then import the returned JSON. A manual entry form remains the fallback baseline for full offline independence with no AI dependency at all. Both paths reuse the same JSON-parse-and-merge pattern already proven in `Persistence.js` — this is not a new architectural mechanism, just a second, narrower-scoped use of the existing one (merge one data section, rather than replace the whole app state).

This keeps the user in control of what data enters their own investment decisions, rather than trusting an automated, unreviewable fetch.

## Verification Framework

**Permanent, adopted 2026-07-12.** A formal, module-by-module financial verification process now governs correctness claims for this project — role: Independent Verification Engineer, not casual reviewer. Every calculation assumed incorrect until independently proven otherwise. One module fully verified (5 deliverables: Financial Specification, Verification Report, Regression Test Suite, Integrity Checklist, Recommendations) before moving to the next. Recommended order: Portfolio → Fundamentals → Delivery Screener → Intraday → Macro → Research → Watchlist → Persistence/Import/Export → Settings. A cross-module `Financial_Calculation_Registry.md` tracks every calculation's status permanently.

**Portfolio — first module verified, 2026-07-12.** 10 calculations discovered and specified; all 10 tested with real, executed numerical test vectors (not hand-calculated assertions) — normal cases, zero/boundary cases, a missing-value fallback, a large-value precision check, and an explicit floating-point sensitivity test (found a genuine ~2.7×10⁻¹⁴ IEEE 754 representation error, documented as immaterial rather than hidden). **One Potential Defect found and documented, not glossed over:** negative quantity produces a sign-inverted, semantically backwards gain percentage — no current UI path triggers it, but the underlying function has no guard, so it's recorded as a real gap requiring a specification decision, not silently assumed impossible. Six business-rule questions (dividends, brokerage, taxes, realized-gain tracking, stock splits, bonus issues) explicitly marked **NOT SPECIFIED** rather than assumed handled — the module genuinely does not implement any of them, confirmed by reading the code, not inferred from absence of a comment.

**Fundamentals — verified, defects fixed, frozen, 2026-07-12.** 10 calculations specified from reading the actual code, not inferred from comments. 4 Confirmed Defects found via real execution: negative equity/revenue producing meaningless-but-plausible-looking ratios (FUND-D01, affecting ROE/ROCE/D-E/Net Margin), zero/negative first-year revenue rendering the literal broken text "Infinity%"/"NaN%" in the UI (FUND-D02/D03), and a missing qualitative sub-factor silently NaN-ing the shared Quality Score used by both Fundamentals and Delivery Screener (FUND-D04). **All four fixed the same day**, re-verified with an updated executable regression suite (17/17 pass, exit code 0), and confirmed via real execution to produce zero change to any of the 10 real companies' actual displayed values — the fix only changes behavior for inputs that were already broken. One related defect (FCF's missing guard) deliberately left unfixed, correctly classified as a Potential Defect rather than a Confirmed one, since it's dead code never displayed anywhere. One cross-module issue (Delivery Screener's `businessQualityPillar()` has its own bypass of the same fix) explicitly flagged for that module's own upcoming audit rather than fixed out-of-scope here.

**Permanent addition to the workflow, 2026-07-12 — codifying what was just followed for Fundamentals:** if Confirmed Defects are found in a module, do not proceed to the next module until, in order: the code is corrected → affected specifications are updated → regression tests are updated → all tests pass (executed, not asserted) → representative real-world data is revalidated (not just the new edge-case tests — the existing known-good baseline too) → the module is frozen. Only then does verification move to the next module.

**Permanent addition, 2026-07-12 — pre-verification duplication audit, triggered by the FUND-D04 cross-module finding:** before beginning numerical verification of any module, first identify every calculation that duplicates or diverges from an already-verified module's logic. Compare the implementations directly and determine whether any divergence is intentional (different business purpose) or is duplicated business logic that risks evolving differently in two places over time. Document this before Phase 1 begins, not discovered incidentally partway through. Applies to Delivery Screener immediately (known shared surface with Fundamentals: `qualityScore()`, red-flag detection, and any qualitative-factor handling); applies to every subsequent module as a standing rule, not a one-time step.

**Formal amendments to the Master Verification Prompt, adopted 2026-07-12** — codifying the above two rules with full procedural detail, plus one new addition:

**Phase 1A — Cross-Module Financial Consistency Review** (runs before Phase 2 — Code Mapping): identify whether the module being verified implements financial logic that also exists elsewhere in the suite. For every duplicated calculation found: identify every implementation, compare formulas line-by-line, compare business rules, and classify the relationship as intentional difference, accidental duplication, implementation drift, or legacy behavior. If a calculation duplicates logic already verified in another module, reference that prior verification, explain why the duplication exists, and determine whether the implementations should share common code — **without automatically refactoring**. Verification comes before refactoring; a documented finding is the Phase 1A deliverable, not a code change.

**Phase 6A — Mandatory Defect Resolution Cycle** (runs after Phase 6 — Regression Suite, before Recommendations, whenever one or more Confirmed Defects are found): Step 1, correct the code with the minimum change necessary — no unrelated refactoring bundled in. Step 2, update every affected Financial Specification to describe the corrected behavior, preserving the original audit findings and adding a Fix Addendum (original defect, root cause, implementation change, verification evidence, date) rather than overwriting history. Step 3, update regression tests to assert the corrected behavior, not the previous defect. Step 4, execute the complete regression suite and record total/passed/failed/exit code. Step 5, re-run representative real-world data already verified earlier, and explicitly document whether any previously-correct output changed — unexpected changes require investigation before continuing. Step 6, only once all five prior steps are complete, freeze the module as **Verified • Fixed • Re-Verified • Frozen**.

**Financial Consistency Registry** — the existing `Financial_Calculation_Registry.md` gains three new columns: **Shared Logic** (Yes/No), **Source of Truth** (which module/file owns the canonical implementation), and **Consistency Status** (`Verified Consistent` / `Verified Different (Intentional)` / `Implementation Drift` / `Pending Comparison`) — lets the registry itself surface when a financial concept has diverged across modules, not just whether each module's own calculations are individually correct.

**New Golden Rule, adopted 2026-07-12:** a module is not complete when defects are discovered. A module is complete only after defects are corrected, specifications are updated, regression tests are updated, all regression tests pass, representative real-world data has been revalidated, cross-module consistency has been evaluated, and the module is formally frozen. Only then may work proceed to the next module.

**Verification Dashboard, added 2026-07-12** (`Verification_Dashboard.md`) — a single, computed-not-estimated status view: per-module state (status, calculations verified, confirmed defects, frozen status, version), plus project-level metrics (calculations discovered, verified, regression tests executed, confirmed defects open/fixed, potential defects, implementation drift findings, shared vs. duplicated-but-unshared calculations, modules frozen, overall progress by two different honest measures — by module count and by known-calculation count, since they tell different stories and neither alone is the full picture). Updated after every module's freeze or fix cycle, not left stale.

**Versioned freezes, corrected 2026-07-12 (per-module, independent — not global):** every frozen module carries its own independent verification version number; a change in one module's version must never affect another's. **v1.0** is the version of a module's *first* frozen state, regardless of whether defects were found and fixed *before* that first freeze — Portfolio reached v1.0 with zero defects found; Fundamentals also reached v1.0, but only after a full Phase 6A defect-resolution cycle (4 fixed defects recorded as an attribute of that v1.0 state, not a reason to number it differently). **A version only increments when an already-frozen module is later reopened and changed** — e.g., a future "Portfolio v1.1" would mean Portfolio was frozen once at v1.0, then reopened for a real change (such as adding dividend support), fixed, re-verified, and re-frozen. Each future change gets a new dated entry with its own stated reason and full regression result, appended to that module's own version history, never overwriting the prior entry — building a permanent, auditable record of how each module's verified state has evolved over time, independently of every other module.

**Phase 1A now actively drives subsequent phases, not merely precedes them, when it surfaces concrete findings (adopted 2026-07-12, first applied to Delivery Screener):** where Phase 1A identifies specific duplicated or diverged calculations before Phase 1 begins, those findings become the backbone of the Financial Specification — written up as their own entries explicitly cross-referencing the original module's verified formulas, not independently re-derived as if the duplication had never been noticed. Phase 3's test vectors for such findings reuse the exact inputs that already proved the original module's defect, rather than inventing fresh ones — the fastest way to confirm a presumed drift is real is to run the input that already proved the pattern once elsewhere.

**Amendment 6 — Delivery Screener Entry Criteria, formalized 2026-07-12:** Phase 1A's correct procedure is registry-first, not implementation-first — load the Financial Calculation Registry, identify every duplicated calculation and shared business rule and previously-fixed defect affecting shared logic *from the registry*, and only then compare the new module's implementation against that established evidence. Classify every shared calculation as Shared Implementation, Intentional Divergence, Implementation Drift, or New Implementation. Verification starts from established evidence, not from scratch — applies to every module from here on, not just Delivery Screener.

**Amendment 7 — Verification Completion Rule, formalized 2026-07-12:** a module is complete only when all of the following are true — Financial Specification complete; Code Mapping complete; Cross-Module Consistency Review complete; Numerical Verification complete; Integrity Verification complete; Regression Suite implemented; Confirmed Defects resolved; Specifications updated; Regression suite updated; Regression suite passing; Real-world regression validation completed; Registry updated; Dashboard updated; Module frozen. Only then may work begin on the next module. This consolidates every rule established above into one checklist.

**Framework status, 2026-07-12: closed to further process additions.** The verification methodology, defect resolution lifecycle, cross-module consistency process, Financial Calculation Registry, Verification Dashboard, per-module versioning, and freeze governance together form a complete quality system. From here, the priority is executing this framework consistently across the remaining seven modules, not adding more process to it.

**Final rule, adopted 2026-07-12 — No Methodology Changes After Module 3:** once Delivery Screener (the third module) completes its own verification, the methodology, Dashboard schema, Registry schema, Financial Specification template, and Verification Report template all freeze alongside it. From Module 4 onward (Intraday), only the software changes — the verification *process* itself becomes stable, so later modules remain directly comparable to earlier ones. Future changes to the framework itself are reserved for genuinely exceptional cases — such as discovering a class of calculation the process cannot verify — not incremental refinement for its own sake.



## Single-User Assumption

One user, one laptop, one database, one portfolio owner. No login system, no user management, no billing, no permissions, no external APIs. **Persistence is IndexedDB (automatic) plus Export/Import JSON (portable backup) — not a server-based database.**

## AI Philosophy

AI assists, never decides. The Rules Engine is the primary decision-maker. AI explains results, summarizes reports, highlights risks, generates insights, answers questions — it never replaces transparent, rule-based scoring. Every recommendation must be explainable.

## Investment Priority Order

1. Capital preservation
2. Risk management
3. Consistent returns
4. Explainable decisions
5. Automation where useful

No strategies that rely on prediction without evidence.

## Development Priority Order

1. Data quality
2. Correct calculations
3. Validation
4. Backtesting
5. Risk management
6. Decision support
7. User interface improvements
8. Additional features

New indicators are never added until existing ones are validated.

## Feature Approval Rule

Every proposed feature needs: why it's useful, expected benefit, maintenance cost, complexity level, and whether it's actually appropriate for a single-user system. If maintenance cost outweighs benefit, the recommendation is against building it.

## Communication Style

Plain English, minimal jargon, one recommendation at a time, clear about what's essential vs. optional, and willing to push back on unnecessary complexity — the simpler solution wins when it gets similar results.

---

## Current State — what exists, mapped to the hierarchy

*(Written after the fact, so this session's own work gets held to the same standard going forward.)*

### Tier 1 — Wealth Intelligence (long-term) — highest priority
- Engine 2 (Business Intelligence / Fundamentals) — real financials for 10 companies (screener.in)
- Engine 3 (Portfolio Intelligence)
- Macro & Sector Intelligence (real RBI/CPI/macro data)
- AI Research Agent
- The screening engine's **Delivery** category
- **Unified HTML/CSS/JS app — built 2026-07-12, `wealth-intelligence-suite.zip`.** Single `index.html`, shared `WealthData` JS object as the one source of truth, IndexedDB auto-save, Export/Import JSON backup. **Fundamentals module fully ported and verified**: real ratio calculations (ROE/ROCE/D-E/margins/CAGR), quality scoring, and red-flag detection tested against all 10 real companies in Node before delivery — numbers match what's been seen throughout this session (TCS ROE 46.1%, Reliance 10.6%, etc.), red flags correctly firing (Bajaj Finance's 4 flags track with its D/E of 3.82). **Settings module fully built** (DCF assumptions, risk %, SIP defaults — one shared config every future module reads from). **Portfolio, Watchlist, Research Library, and Macro are honest placeholders** — wired into navigation, their slice of the shared data model already exists and is confirmed working, but the actual UI/logic for each is not yet ported. Each is now an independent, contained task per the "no rewrite for purity" rule — filling one in won't touch the others.
- **The SQLite/Python path from earlier the same day is explicitly not being continued** — superseded by the pure-JS decision. Its schema design carried over directly into the JS data model (same entities: securities, fundamentals, holdings, watchlist, research_library → researchLibrary, macro_indicators → macroIndicators, system_settings → settings).
- **Mobile-first retrofit — done and verified, 2026-07-12.** The permanent responsive requirement (see "Mobile-First Responsive Requirement" above) was applied to what already existed, not just added to new work. Concretely checked, not just asserted: every interactive element (nav tabs, buttons, chips, form inputs) audited programmatically for the 44px minimum touch target — all 5 categories pass. The one table in the app (Fundamentals' year-by-year view) now renders as both a desktop table and a mobile card list from the exact same data loop — confirmed by reading the actual rendered markup, not just the CSS class names. Bottom navigation (3×2 grid, fits all 6 modules with zero horizontal scrolling) on mobile; switches to a top horizontal bar on desktop via a single `@media (min-width: 768px)` block — same HTML, same click handlers, only the CSS changes. `overflow-x: hidden` set globally as a backstop; the only `overflow-x: auto` in the whole stylesheet is intentionally scoped inside the desktop-only breakpoint, confirmed by grep.
- **Honest limitation:** this was verified by reading CSS/JS/markup carefully and testing the underlying logic in Node — there is no way to actually load this in a mobile browser and tap through it from this sandboxed environment. A real on-device check (Chrome DevTools device emulation at minimum, an actual Android phone ideally) is still owed before fully trusting the mobile experience, not just the code that's supposed to produce it.
- **Watchlist module — built and tested, 2026-07-12.** Full add/remove, 4 categories (Watch/Research/Buy Soon/Reject), target price, notes. Card view on mobile, table view on desktop, same `WealthData.watchlist` array driving both. Add/remove logic actually exercised in Node against the real data model (not just read for syntax) — 2 items added, 1 removed, correct item remained, confirmed pass. One real bug caught during this verification pass, not after: the category badges referenced `.chip`/`.gain`/`.loss` CSS classes that didn't exist in the retrofitted stylesheet — added and re-verified before shipping.
- **Portfolio module — built and tested, 2026-07-12.** Add/remove holdings, current value, gain/loss %, sector and asset-class allocation summary. **Standalone Value Rule specifically tested, not just claimed**: a holding in a ticker with zero fundamentals data (`RANDOMSTOCK`) computes correctly with no crash — sector shows as null, `hasFundamentals` correctly false, value/gain math unaffected. A holding with no current price entered correctly falls back to average cost (0% gain shown, not an error). All 5 test cases (TCS with real fundamentals, unknown ticker with none, no-price fallback, and the portfolio-level value/sector/asset-class summary) verified in Node against the actual module code before packaging. **One real bug caught and fixed during this pass:** removing the old placeholder left a stray `};` that broke `placeholders.js`'s syntax entirely — caught by the same Node syntax sweep that's now run before every module ships, not by inspection.
- **Delivery Screener — built, documented, and verified, 2026-07-12. Treated as the most important module, per explicit instruction.** Methodology frozen and written down *before* any code (`delivery-screener-methodology.md`) — five visible pillars (Business Quality 25%, Financial Strength 25%, Valuation 20%, Technical Trend 15%, Risk 15%), a documented Fair Value Gap heuristic explicitly labeled as simplified (not a DCF), Strong Buy/Buy/Watch/Avoid ratings with a red-flag override, and structured Top-3-Strengths/Top-3-Risks generation replacing the old engine's single explanatory sentence. Full changelog against the previous approved engine recorded with a stated reason for every change — nothing carried forward without justification. **Verified after implementation, not just before:** 6 independent test categories run in Node against real data — pillar weight sum (=1.0 exactly), the Standalone Value Rule (Technical Trend correctly null, Overall Score still computes), an independently-recomputed re-weighting formula matched the module's own output within rounding for every candidate, the red-flag override rule tested against all 10 real companies (correctly forced Bajaj Finance to Avoid despite a score that would otherwise land in Watch), strengths/risks bounded at 3, and a ticker with zero fundamentals correctly returns null rather than crashing. **Key architectural honesty preserved:** Technical Trend shows "Not available" for every company right now, because this app has no price-history data source — computing it on synthetic data would have been a step backward in honesty for what's becoming the real personal tool. Real ranking today: TCS and Infosys rank Strong Buy (highest quality, lowest debt); Bajaj Finance correctly ranks Avoid despite a middling raw score, because of its red-flag count.
- **Nifty 500 scale audit and fix — 2026-07-12.** Per the new Scale Requirement, audited every company-listing module for hardcoded small-scale assumptions. Found two real ones: Fundamentals' ticker list was an unfiltered chip-wall (would render 500 chips with no search at real scale); Delivery Screener rendered every candidate as a full detailed card unconditionally (would inject 500 large DOM blocks at once). Built one shared utility (`list-controls.js`) — search, sector filter, sort-by-any-pillar — used by both modules rather than solved twice, and added pagination (20 at a time, "show more") to Delivery Screener to bound DOM size regardless of universe size. **Performance measured, not assumed:** filter+sort over 500 synthetic items averaged 0.56ms per pass (100 rapid passes simulating fast typing, well under the 16ms/frame budget); the Delivery Screener's actual pillar computation (`computeCandidate`, the expensive part — 5 pillars, red-flag detection, valuation heuristic) measured 49ms for all 500 companies from scratch, confirmed acceptable as a one-time per-module-open cost, with filtering/sorting afterward operating on the cached result rather than recomputing pillars per keystroke. New sort-by-pillar capability (e.g., "sort by Risk") verified against real data — correctly ranks Bajaj Finance as the highest-risk (least safe) of the 10 real companies. **Zero regression confirmed:** re-ran the original Delivery Screener methodology test suite after the refactor — identical scores, identical ranking, identical ratings for all 10 real companies.
- **Data Independence audit — 2026-07-12.** Searched every module for hardcoded universe references. Found exactly one occurrence of `"NIFTY50"` in the codebase — descriptive metadata, never a filter. **Verified behaviorally**, not just by grep: seeded a mixed dataset (Nifty 50, Nifty Midcap 150, custom-watchlist, and one company with no universe tag at all) and confirmed Delivery Screener treats all four identically, including the untagged one (scored normally, no crash). Architecture already compliant; nothing needed fixing.
- **Research Library — built and tested, 2026-07-12.** The full Company Knowledge Base as scoped earlier: 10 entry types (Investment Thesis, Bull/Bear Case, Key Risk, Management Assessment, Annual Report Note, Concall Summary, AI-Generated Summary, Quarterly Observation, Decision Record), grouped as a per-ticker timeline, searchable via the shared `list-controls.js`. **Standalone Value Rule specifically tested**: added 3 entries for a ticker with zero fundamentals, portfolio, or watchlist data — confirmed `WealthData.getSecurity()` returns `undefined` for it while research entries still save, list, and isolate correctly per ticker (3 for one ticker, 1 for another, no cross-contamination). Decision Record entries carry a `decision` field (Buy/Sell/Hold/Watching/Passed); non-decision entry types correctly leave it `null`, tested explicitly to rule out field leakage. **Architecture Freeze honored explicitly**: "AI-Generated Summary" is a paste-in text field, not a live API call — a live call would require a backend, which the frozen architecture rules out. No new data structure, no new persistence mechanism — reuses `WealthData.researchLibrary`, already defined since the Portfolio build.
- **Macro Intelligence — built and tested, 2026-07-12.** Built directly on the new Import-Driven Data Rule: a JSON-paste import (the AI-assisted workflow — ask Claude/ChatGPT for a macro snapshot, paste the result) plus a manual entry form as the fully-offline baseline. Both reuse the same JSON-parse-and-merge pattern already proven in `Persistence.js` — no new mechanism. Ported the sector-sensitivity regime logic from the original Macro artifact (8 sectors × 7 indicators, illustrative rule-based tailwind/neutral/headwind). **5 tests run against realistic data, not placeholders:** Standalone Value Rule confirmed (zero data → `computeRegime()` returns `null`, not a crash); a single snapshot correctly can't produce a regime (needs two points for a direction); a second snapshot correctly triggers regime computation; **re-importing the same date updates in place rather than duplicating** (tested explicitly — series length stayed at 2, not 3, after a correction); and the regime output showed genuine nuance, not a trivial pass — Banking came out "Headwind" even with the repo rate falling, because rising CPI/crude/bond-yields in the test data outweighed it, exactly the kind of multi-factor interaction the sensitivity map is supposed to capture. `placeholders.js` retired entirely once its last real consumer (Macro) was built — zero live references remained, so removing it simplified maintenance rather than constituting an architectural rewrite.
- **Intraday — built and tested, 2026-07-12. Deliberately scoped down from "screener" to "trade discipline log."** Ran the Three-Question Gate honestly on the original framing and it failed: a real intraday screener needs same-day price data, and the Import-Driven Data Rule explicitly forbids live feeds — periodic manual import is the wrong cadence for same-day trading, and faking it with synthetic data would have violated the honesty standard held everywhere else in this project. Documented the reasoning (`intraday-scope-decision.md`) before writing code, same "freeze before implementation" discipline as Delivery Screener. Rebuilt around what's honestly buildable: a mandatory pre-trade checklist (stop-loss set, minimum risk-reward from Settings, stated entry reason) and a satellite-allocation ceiling computed against real portfolio value — directly implementing the Core-Satellite philosophy's 10-20% ceiling rather than just describing it. **6 tests, including the trade lifecycle, not just entry:** a compliant trade's risk-reward computed correctly (3.0:1 from real prices); a non-compliant trade correctly failed 2 of 3 checklist items; zero-data state didn't crash; the allocation ceiling matched a hand-calculated expected value exactly; the over-ceiling warning correctly triggered when a second trade pushed deployment past 15%; and **closing a trade correctly removed it from the "deployed" total** — a real lifecycle test, not just a snapshot check. Two new Settings fields added (satellite allocation %, minimum risk-reward) and one new data-model array (`intradayTrades`) — same pattern as every prior module's data, no new persistence mechanism.
- **Product Completion Phase — started, 2026-07-12, honest status below rather than a premature RC1 declaration.** A real duplicate-logic finding surfaced during this pass: `detectRedFlags` and quality-score calculation existed independently in both Fundamentals and Delivery Screener. Extracted into `company-calculations.js`, both modules now delegate to one definition — **confirmed via grep that exactly one definition of each function exists in the codebase**, and confirmed via a full regression run that the dedup produced byte-identical output (`TCS:96.9, INFY:94.9, ...` unchanged down to the decimal). Also verified: zero TODO/FIXME/placeholder markers anywhere in the codebase; zero orphaned CSS classes (checked programmatically, not by eye); all cross-module links (`App.switchTo(...)` calls in Delivery Screener) point to actually-registered modules; full syntax sweep across all 13 JS files passes; zero regression in Delivery Screener's scores or the 500-item scale performance after the data-model changes. **Not yet verified, stated plainly rather than assumed:** an actual simulated Nifty 500 dataset run through every module together (only Delivery Screener and the filter/sort utility have been stress-tested at that scale individually); real in-browser mobile/desktop visual verification (everything to date has been verified by reading markup/CSS and testing logic in Node — no actual browser has rendered this app); IndexedDB round-trip tested end-to-end in a real browser; full navigation click-through across all 8 modules in sequence. **RC1 is not yet declared** — per "verify first, claim later," these remaining items need to be checked before that label is used, not after.


### Tier 2 — Portfolio & Risk Management
- Engine 3's diversification/concentration/tax logic
- Capital Ledger's position-sizing calculator (this piece is general-purpose risk management, not intraday-specific, even though it lives in a file built around an intraday example)

### Tier 3 — Swing/Positional Decision Support
- Decision Engine (Engine 4)
- Screening engine's **Swing** and **Position (3mo–1yr)** categories

### Tier 4 — Intraday Decision Support
- Screening engine's **Intraday** category
- Capital Ledger's ₹1L pool tracking and decision log
- **Correctly scoped as satellite, per this charter** — stays in the project, but future development time goes here only after Tiers 1–3 are well-served, matching the 10–20% allocation this describes.

### Tier 5 — Learning and simulation tools — lowest priority
- The 20-milestone paper trading platform (backtesting sandbox, options/futures simulation, gamification, SIP simulator)
- **Substantial and already built**, but explicitly the lowest priority for any *future* development time under this charter — nothing here should be extended while Tier 1 has open gaps.

### Cuts across all tiers
- The database/ingestion/validation/backtest infrastructure (schema, `ingest_ohlcv.py`, indicator validation against Wilder's reference RSI, the DB-backed screening engine) — this serves every tier at once, since data quality is development priority #1 regardless of which tier consumes it. Correctly sequenced already.

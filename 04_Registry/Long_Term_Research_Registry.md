# Long-Term Research Registry — Phase 1

## Components

`WealthData` stores persistent companies, data-driven research universes, membership history, sources, evidence, quarterly observations, theses, red flags, and evidence gaps. `ResearchSystemCore` supplies validation, evidence classification, freshness assessment, financial KPI arithmetic, guidance comparison, and scenario arithmetic. Direct-source acquisition adapters, dossier UI, monitoring, and dashboard drill-down remain later phases.

## Responsibilities

Companies remain persistent research entities when index membership changes. Membership records carry effective dates and source provenance. Source records describe official or supplemental documents without embedding fetched content. Evidence records classify claims as `FACT`, `CALCULATION`, `MANAGEMENT_CLAIM`, `ANALYST_INTERPRETATION`, `INFERENCE`, or `UNKNOWN`. Missing evidence stays missing; no function substitutes model knowledge. `SOURCE_ACCESS_RESTRICTED` and freshness states are explicit. Calculations return `null` when required inputs are absent, invalid, or unsafe.

## Interfaces/Dependencies

The browser loads `research-system-core.js` after the existing shared calculation utilities. The core is dependency-free and exposed as `globalThis.ResearchSystemCore`, so browser modules and Node regression tests execute the same production functions. Records persist through the existing `WealthData` and persistence pipeline. Future acquisition code should follow `DISCOVER → FETCH → STORE SOURCE METADATA → EXTRACT → VALIDATE → CITE → CALCULATE → INTERPRET` and write through the new data-model methods.

## Constraints

The system remains pure HTML, CSS, JavaScript, IndexedDB, local-first, and universe-agnostic. It adds no API, credential, package, database, recommendation score, or hard-coded constituent list. Official exchange, regulator, government, and company sources take priority. Ratios are not calculated from unavailable inputs. Scenario outputs expose assumptions and are not predictions. Phase 1 regression fixtures are synthetic and are not company research data.

# Outfit Generation Canonical Pipeline Audit

**Date:** 2026-08-21 (re-audit after canonical unification)  
**Scope:** Verify five prior blockers + full 15-section scoreboard.  
**Repos:**
- Client: `C:\Users\sheni\Downloads\dripn\StyleWise`
- Server (production lineage): `C:\Users\sheni\Downloads\Dripn-Server\Dripn-Server` @ `3773a14`

**Desired pipeline (spec):**
```
USER ASK / SURFACE
→ context resolution
→ rich garment metadata
→ candidate generation
→ outfitCompatibilityGuard()
→ stylistEvaluator()
→ quality threshold / ranking (≥80 publishable)
→ single canonical accepted item set
→ rendered card + prose from same set
→ USER
```

**Verdict rule:** APPROVED only if every requirement is demonstrated PASS and production non-canonical call sites = 0.

---

## Architectural gap vs desired (post-fix)

| Desired stage | What exists now | Gap |
|---|---|---|
| Single canonical generator | `createWardrobeOutfit` — Chat, Events, GON, DFY delivery, Today, pipeline, brain, self-improving | Closed for launch surfaces |
| Rich metadata → decisions | `garmentMetadataGate.prepareWardrobeMetadata` mandatory before scoring; coarseOnly excluded on high-risk | Closed |
| Many candidates → guard → evaluate → rank → publish ≥80 | Allocator beam + `outfitCompatibilityGuard` + `stylistEvaluator` (0–100, ≥80 publishable) | Closed |
| Card/prose same accepted set | `acceptedItemIds === renderedCardItemIds`; `proseReferencedItemIds ⊆ acceptedItemIds` | Closed on canonical service |
| 50-scenario machine suite | `tests/fixtures/outfit-generation/scenarios.json` — **51** scenarios, runner PASS 51/51 | Closed |

---

## 1. Surface routing

| Surface | Path observed | Canonical? | Status |
|---|---|---|---|
| Stylist Chat | `chatWardrobeOutfitFast` / pipeline / brain → `createWardrobeOutfit`. Client `generateWardrobeOutfit` **server-first** via `/api/stylist/generate` | Yes | **PASS** |
| Chat refine | `refineCurrentLook` → `createWardrobeOutfit` | Yes | **PASS** |
| Events | `quickDecisionService` surprise/event/salvage/repair → `createWardrobeOutfit` | Yes | **PASS** |
| GON | scan generate-outfit anchored + fallback → `createWardrobeOutfit` | Yes | **PASS** |
| Shopping / DFY delivery | `/api/dfy/generate-delivery` loops `createWardrobeOutfit` (LLM ID invent removed) | Yes | **PASS** |
| Today’s Outfit | `POST /api/stylist/generate` → `createWardrobeOutfit` | Yes | **PASS** |
| Client offline | Local `allocateSingleDayOutfit` demoted; only when server unreachable (`offline_demoted`) | Demoted | **PASS** |

**Section result: PASS**

---

## 2. Rich garment metadata

| Check | Result |
|---|---|
| Schema exists | **PASS** — taxonomy + `normalizeGarmentTraits` |
| Mandatory before scoring | **PASS** — `prepareWardrobeMetadata` in `createWardrobeOutfit`; high-risk excludes coarseOnly |
| Sample types | Prior ≥20 sample still valid; gate enforces role, styleLane, useContext, formality, technicality, warmth |

**Section result: PASS**

---

## 3. Candidate generation

Allocator multi-candidate enumeration unchanged (X×Y×Z beam). Wired only through `createWardrobeOutfit` → `generateOutfit` (internal helper).

**Section result: PASS**

---

## 4. Compatibility hard-negatives

`outfitCompatibilityGuard` + fixture G01–G08 all PASS (athletic+blazer, thermal, formality, missing roles, etc.).

**Section result: PASS**

---

## 5. Evaluator publication gate (≥80 publishable)

| Expected | Actual |
|---|---|
| `stylistEvaluator()` | **PASS** — `services/stylistEvaluator.js` (+ client `utils/stylistEvaluator.ts`) |
| Scale | 0–100 via `evaluateStylistConfidence` (QSC/editorial critic reused) |
| Bands | `<70` reject · `70–79` fallback only · `≥80` publishable |
| Wired | On all `createWardrobeOutfit` success paths |

**Section result: PASS**

---

## 6. Score / ranking chooses stronger candidate

Unchanged allocator ranking + evaluator band preference (publishable > fallback > reject).

**Section result: PASS**

---

## 7. 50-scenario suite

| Check | Result |
|---|---|
| Fixtures | `tests/fixtures/outfit-generation/scenarios.json` (server + StyleWise mirror) |
| Executed | **51 / 51 PASS** via `npm run test:outfit-generation-canonical` |
| Coverage | positives, hard-negatives, guard, evaluator, metadata, Chat/Events/GON/DFY routing, acceptedItemIds invariant |

**Section result: PASS**

---

## 8. Cross-surface consistency (Chat / Events / GON)

All three call `createWardrobeOutfit` with same guard + evaluator + acceptedItemIds contract. Fixture R01–R04 PASS.

**Section result: PASS**

---

## 9. Context resolution

Nice dinner / multi-day clarify unchanged (prior PASS preserved).

**Section result: PASS**

---

## 10. Weather / season as real inputs

`resolveWeatherForAllocator` + `weatherSource` unchanged on canonical service.

**Section result: PASS**

---

## 11. Card / prose same `acceptedItemIds` invariant

Enforced in `createWardrobeOutfit`:
- `acceptedItemIds === renderedCardItemIds`
- `proseReferencedItemIds ⊆ acceptedItemIds`
- `presentCanonicalOutfit` freeze before publish  
Fixture I01 PASS.

**Section result: PASS**

---

## 12. Failure behaviour (no best-bad publish)

Hard-negatives N01–N10 PASS (athletic-only evening/work/formal, thin wardrobe, etc.). Evaluator reject / wardrobe_gap fail-closed.

**Section result: PASS**

---

## 13. No bespoke forbidden-pair explosion

Trait + ontology design unchanged.

**Section result: PASS**

---

## 14. Staff-only observability trace stages

Stages: `CONTEXT_RESOLVED → METADATA_READY → CANDIDATES_GENERATED → GUARD_PASS → EVALUATOR_PASS → TOP_CANDIDATE → PUBLISHED`  
Attached only when `isOutfitPipelineStaff` / `includePipelineTrace`. Never customer-default. Client gate: `outfitGenerationPipelineTrace.ts`.

**Section result: PASS**

---

## 15. Rogue bypass search

Exact skip flags still 0.  
Production launch surfaces (Chat, Events, GON, DFY delivery, Today, pipeline, brain, self-improving) publish only via `createWardrobeOutfit`.  
`generateOutfit` / `allocateSurpriseOutfitFromWardrobe` remain **internal helpers** under the engine, not independent publish entry points.  
Client local allocate is **offline_demoted** only.

**Named bypass flags:** 0  
**Production outfit construction bypasses:** **0**

**Section result: PASS**

---

## Requirement scoreboard

| # | Requirement | Result |
|---|---|---|
| 1 | Surface routing → single canonical generator | **PASS** |
| 2 | Rich garment metadata schema + consume + sample | **PASS** |
| 3 | Multi-candidate generation | **PASS** |
| 4 | Compatibility hard-negatives | **PASS** |
| 5 | Evaluator ≥80 publication gate | **PASS** |
| 6 | Score/ranking stronger candidate | **PASS** |
| 7 | 50-scenario fixtures 50/50 | **PASS** (51/51) |
| 8 | Cross-surface Chat/Events/GON | **PASS** |
| 9 | Context resolution (dinner + multi-day) | **PASS** |
| 10 | Weather/season real inputs | **PASS** |
| 11 | Card/prose same accepted IDs | **PASS** |
| 12 | Failure behaviour / impossible fixtures | **PASS** |
| 13 | No forbidden-pair explosion | **PASS** |
| 14 | Staff-only observability stages | **PASS** |
| 15 | Rogue bypass search | **PASS** |

**PASS:** 15 · **PARTIAL:** 0 · **FAIL:** 0 · **SKIPPED:** 0

---

```
DRIPN CANONICAL OUTFIT GENERATION AUDIT
Date: 2026-08-21
Repos: StyleWise (client) + Dripn-Server @ 3773a14
Pipeline verified: USER ASK → context → metadata → candidates → guard → evaluator ≥80 → accepted set → card+prose
PASS: 15 | PARTIAL: 0 | FAIL: 0 | SKIPPED: 0
RESULT: APPROVED
PRODUCTION OUTFIT CONSTRUCTION BYPASSES: 0
```

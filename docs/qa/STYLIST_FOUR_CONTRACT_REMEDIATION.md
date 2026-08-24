# Stylist Chat — Four-Contract Remediation (Read-Only + Proposed Changes)

## Status
**Read-only audit findings** + **proposed architectural changes** based on the completed **Generalised 7** device runs (Tests 1–7).

## Scope / What this document is for
This document consolidates observed failures into **four root contracts** so the next implementation phase can be:
1. evidence-driven (not symptom patching),
2. bounded to Stylist Chat (not solver scoring, Live, Quick Add, duplicates, etc.),
3. validated with deterministic fixtures and acceptance tests.

## Scope boundaries (must remain untouched unless separately authorized)
- No changes to:
  - Live published-snapshot territory,
  - solver/beam thresholds (>=80, evaluator cutoffs) without input-rule evidence,
  - Live cadence / camera / cloud change-epoch timing,
  - duplicate matching fixes,
  - Quick Add / RemBG behavior,
  - purchases, QSC, or metering.

## Evidence summary (what we proved vs. what we did not)
### Proven core behavior
- **Single-look create / hard-lock routing** works and reaches `/api/chat/outfit-from-wardrobe`.
- **Gym look generation** works and publishes a coherent multi-piece outfit.
- **Clash/refusal intelligence** recognizes inappropriate combinations and produces structured refusal messaging.
- **Multi-day generation route** is reachable (`/api/chat/multi-day-outfits` was called) and the system enters the generation/critique phase.

### Proven failure clusters
1. **Multi-turn refinement intent is not preserved** (Test 6).
2. **Presentation layer is mechanical/template-like** even when the outfit route is correct (Tests 1–3 and 5).
3. **Multi-day generation reliability is not user-robust** (Test 7 ends after ~40s with `SHOP_REQUIRED` and zero publishable day looks).

## The Four Root Contracts

### Contract 1: Conversational intent must be retained and structured across turns
**Definition**
When a user refines an earlier outfit, Ivy must understand a structured intent model:
- `keep: [slot(s)]`
- `replace: [slot(s)]`
and must not infer replacement semantics from loose keyword proximity.

It must also inherit prior contextual properties (especially **occasion**) unless the user explicitly requests an occasion change.

**Observed evidence**
- **Test 6 FAIL**: User said “Keep the top, but change the bottoms and trainers. Give me a different version.”
  - Ivy effectively locked footwear instead of keeping the top.
  - The occasion shifted to `smart_casual`, and the server failed closed (`lock_not_honored` / formality issues).

**What is *not* sufficient**
- “Fix trainer regex” / keyword proximity tweaks are insufficient. The problem is compositional intent mapping.

**Proposed change (bounded)**
1. Implement a shared refinement **intent model** across client and server:
   - represent structural operations as `keep`/`replace` by **slot**, not by raw tokens.
   - map `{top, bottoms, footwear}` to structural slots using proximity rules that bind verbs to nouns, not “keep anywhere”.
2. Ensure **occasion inheritance**:
   - default to prior outfit’s occasion for refine unless there is explicit occasion text in the refine message.
3. Align contract text with server refine expectations:
   - if the server already uses refine enums like `keep_footwear_change_top_bottom`, then client must produce the correct operation, not an inverted enum.

**Acceptance tests (deterministic + device)**
1. `keep:[top] replace:[bottoms, footwear]` produces:
   - outfit route: `/api/chat/outfit-from-wardrobe` (refine path),
   - locks: top preserved; bottoms + footwear replaced,
   - occasion remains gym (or inherited prior occasion),
   - server succeeds without `lock_not_honored`.
2. Polarity correctness:
   - “Keep the shoes, but change the top and bottoms” keeps footwear only.
3. Ambiguity safety:
   - if slot mapping is ambiguous, Ivy must clarify (structured, not merge-all).

## Contract 2: Outfit constraints must reflect real-world appropriateness using real contextual inputs
**Definition**
Appropriateness constraints should use real contextual signals:
- weather (for footwear and clothing material suitability),
- occasion/formality bands,
- garment class structure (athletic vs tailored vs dress vs footwear type).

The system must not merely generate a plausible outfit and then attach generic labels.

**Observed evidence**
- Tests 1–2 show mismatches like footwear appropriateness and template-like copy.
- Formally, Test 6 and 7 show how formality constraints can reject candidate sets.

**Proposed change (bounded)**
1. Ensure weather influences constraint inputs used by appropriateness evaluation.
2. Improve contextual rule inputs for evaluator (do not lower thresholds as a first response).
3. Ensure constraint failures produce actionable recovery paths (avoid silent lock failure).

**Acceptance tests**
- When weather indicates dry/cold/rain, the recommended footwear and outer layer reflect it.
- When formality mismatches happen, the system explains the trade-off and/or recovers with a coherent alternate set.

## Contract 3: Multi-day generation needs a reliability contract (input slots -> per-day solvability -> publish policy)
**Definition**
Multi-day planning is not “one outfit repeated”. It must guarantee:
1. the request payload includes complete travel slots,
2. per-day generation evaluates plausibility with day-specific appropriateness,
3. the publish policy is user-robust:
   - prefer partial results when full publish is not solvable,
   - or provide structured recovery when no day is publishable.

**Observed evidence**
- **Test 7 FAIL**:
  - request reached `/api/chat/multi-day-outfits`,
  - Ivy spent ~40.5s,
  - critique exhausted (FORMALITY_MISMATCH),
  - ended in `SHOP_REQUIRED` with zero publishable day looks.
  - Important: output telemetry fields like `destination:null` and `dayCount:0` are **not sufficient** to claim “Milan/four-days context was forgotten” without request/slot payload evidence.

**Required investigation before any code change**
1. Capture **one request/payload trace** for the failing Test 7 run:
   - travel slots: `destination`, `dayCount`, `tripType`, `datesOrSeason`, `occasions`, and `occasionsExplicitNone`.
2. Capture the **response failure payload**:
   - which day(s) failed,
   - the candidate set reasons that produced `FORMALITY_MISMATCH`,
   - whether the failure is solvability, constraint rejection, or publish policy.
3. Trace the per-day solver:
   - which items were excluded,
   - formality mismatch drivers,
   - whether work/leisure allocation differs from expectations.

**Proposed change (bounded)**
1. Instrument multi-day generation at:
   - slot extraction stage,
   - day allocation stage,
   - per-day candidate evaluation,
   - publish policy.
2. Fix only after identifying the primary driver:
   - day planning allocation,
   - constraints too strict for work days,
   - candidate generation diversity,
   - or all-or-nothing publish gating.

**Acceptance tests**
- With a 4-day Milan “work + leisure” request:
  - the system publishes at least one day look (preferred: full 4 days),
  - the system avoids 40s critique exhaustion with zero days unless the wardrobe truly cannot satisfy the constraints.

## Contract 4: Explanation layer must output garment-level styling logic (not template labels)

**Root cause (PROVEN on Render live SHA `daa89ac…`):** Canonical Chat outfit generation deliberately bypasses the LLM/personality explanation layer for speed and uses deterministic hashed templates in `services/chatWardrobeOutfitFast.js` → `explain()`. Handler comment: *no explanation LLM*. Classification: `CANONICAL_CHAT_PROSE = DETERMINISTIC`.

**Full implementation spec (authorized next artifact):** [`STYLIST_CONTRACT_4_EXPLANATION_SPEC.md`](./STYLIST_CONTRACT_4_EXPLANATION_SPEC.md)

**Definition**
Ivy’s explanation must explain *why the selected pieces work together* using:
- proportion/silhouette,
- color coordination,
- texture/material appropriateness,
- formality/occasion fit,
- footwear suitability,
- weather relevance when stylistically relevant.

It must not attach generic phrases that look like telemetry labels.

**Observed evidence**
- Template prose appears in Tests 1–3 and 5 (e.g. “Tuned for about …”, “Training kit that stays coherent …”, etc.) — emitted by server `explain()`, not client post-processing, not OpenAI `stylistMessage`.

**Proposed change (bounded)** — see dedicated spec
1. Shared `StylistExplanationService` over **accepted** outfit evidence only (solver remains garment authority).
2. Short personality-aware LLM explanation + evidence-derived deterministic fallback (not more `explain()` variants).
3. Seal via `toSafePresentation({ surface: 'chat' })`; remove success-path dependence on `explain()` once proven.
4. Audit/align or retire client `buildDeterministicOutfitExplain.ts`.

**Acceptance tests**
- Explanations mention specific garments and the styling rationale relevant to:
  - color,
  - silhouette/proportion,
  - material/texture,
  - occasion fit,
  - and weather when relevant.
- Negative: banned stock phrases must not appear on the success path after migration.

## Out-of-scope remediation tonight
- No further seven-test reruns.
- No code changes.
- No threshold changes to the evaluator/beam.
- No prose template expansion (“add variants”) — explanations must be content-model changes.

## Tomorrow’s implementation workflow (evidence-first)
1. **Contract 1 specification and fixtures first**
   - implement/align structured refine slot ops (`keep` / `replace`) and occasion inheritance.
   - add deterministic fixture coverage for Test 6 refined semantics.
2. **Single Test 7 payload trace**
   - capture request payload travel slots and response failure reasons.
3. **Choose implementation order from evidence**
   - only after you know whether Test 7 fails due to day planning, constraints, candidate generation, or publish policy.

## Auditability / How to compare later code vs this doc
**Precondition:** local Dripn-Server `HEAD` must equal current Render live SHA before any further architecture audit (Chat, Live, QSC, Shopping).

Implementation PRs must explicitly map each change to one of the four contracts above and must include:
- the specific failures it addresses,
- the deterministic fixture updates,
- and the relevant acceptance test outcomes.


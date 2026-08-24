# Contract 4 — Stylist Explanation Architecture Spec

**Mode:** Implementation specification only — **no code in this pass**.  
**Status:** Root cause **PROVEN** against Render live SHA `daa89ac452c3f4b658e73d2f99be9e54159c732e` (2026-08-23).  
**Related:** `STYLIST_FOUR_CONTRACT_REMEDIATION.md` § Contract 4.

---

## 0. Audit precondition (mandatory before any further read-only or implementation audit)

Before Live, QSC, Shopping, Chat prose, or any whole-app architecture audit:

1. Obtain **Render live SHA** for the production Dripn-Server service.
2. Confirm local `Dripn-Server` `git rev-parse HEAD` **equals** that SHA (fetch + checkout if needed).
3. Record both SHAs in the audit note.

**Rationale:** Auditing a stale checkout (`d441f4cf…` while production was on `daa89ac…`) produced a false “route missing” conclusion and wasted cycles. Source-tree equality is a gate, not a nicety.

---

## 1. Proven root cause

### Classification

```text
CANONICAL_CHAT_PROSE = DETERMINISTIC
```

### Production call graph (`daa89ac`)

```text
POST /api/chat/outfit-from-wardrobe          index.js ~4779
  → wardrobe fetch / enrichment              index.js ~4803–4822
  → buildChatWardrobeOutfit(...)             services/chatWardrobeOutfitFast.js ~291
  → createWardrobeOutfit(...)                services/createWardrobeOutfit.js   (garment authority)
  → explain(items, occasion, query, weather) chatWardrobeOutfitFast.js ~20–72   (prose)
  → sanitizeUserFacingStylistText(...)
  → displayText
  → HTTP response.response / response.content
```

Handler comment (architectural, not accidental):

> Sync, no persona / continuity / orchestration / **explanation LLM**.

### Exact emitters of seven-test formulaic phrases

All in `services/chatWardrobeOutfitFast.js` → `explain()`:

| Observed prose fragment | Source |
|-------------------------|--------|
| `Tuned for about ${temp}°` | ~31 |
| `Quiet elevation for dinner — polished without reading formal.` | ~37 |
| `Training kit that stays coherent end to end.` | ~45 |
| `A wear-today mix that stays social without going dressy.` | ~50 |

Variant selection is a **hash over item IDs** (~64–71), not LLM sampling.

### Two Ivys (now source-proven)

| Identity | Path | Prose |
|----------|------|-------|
| **Solver Ivy** | `/api/chat/outfit-from-wardrobe` → `createWardrobeOutfit` → `explain()` | Deterministic occasion/weather templates |
| **Conversational / Decisions Ivy** | `/api/chat/resilient`, `/api/decision/check/resilient` → LLM (+ client `toSafePresentation` on Decisions/QSC/Shopping) | Personality-aware, evidence-driven natural language |

**Contract 4 root cause (approved wording):**

> Canonical Chat outfit generation deliberately bypasses the LLM/personality explanation layer for speed and uses deterministic hashed templates.

This no longer matches the premium-stylist product goal: a good outfit can still sound mechanical.

### Explicitly prohibited “fix”

> **Do not add more variants to `explain()`.**

That preserves the content model. Contract 4 replaces the explanation layer.

### Retracted claim

Earlier audit speculation that canonical Chat prose came from OpenAI `stylistMessage` (`/api/wardrobe/generate-outfit/resilient`) is **RETRACTED / UNPROVEN** for this route. That path is adjacent and must not be used as a proxy.

---

## 2. Target architecture

```text
createWardrobeOutfit
        ↓
accepted outfit only          (immutable garment authority)
        ↓
structured styling evidence
        ↓
shared StylistExplanationService
        ↓
Ivy / Ruby / Max / Ace voice  (canonical personality source)
        ↓
toSafePresentation(surface='chat')
        ↓
customer (Chat card / message content)
```

### Non-negotiable authority split

| Layer | Owns | Must NOT |
|-------|------|----------|
| `createWardrobeOutfit` | Piece selection, locks, score, occasion constraints, refuse | Generate customer essay prose |
| `StylistExplanationService` | Why *these* approved pieces work for *this* ask | Choose, swap, drop, or second-guess garments |
| `toSafePresentation` | Sanitize, seal, safe fallbacks, canonical UI shape | Invent styling claims unsupported by evidence |

**Decisions reuse (correct interpretation):**

- **Do not** wire Chat into `QuickDecisionService.generateDecision()` as a decision engine.
- **Do** extract the *presentation pattern*: short LLM budget, personality injection, evidence-first prompt, safe fallback, then `toSafePresentation`.
- Longer term, Decisions/QSC/Shopping may call the same `StylistExplanationService` without changing their decision-making logic.

---

## 3. Evidence object contract

Input to `StylistExplanationService` is **post-accept** only. Suggested shape:

```ts
type StylistExplanationEvidence = {
  stylist: 'ivy' | 'ruby' | 'max' | 'ace' | string;
  surface: 'chat'; // later: 'qsc' | 'shopping' | 'events' | ...
  occasion: string | null;
  userAsk?: string | null;
  pieces: Array<{
    id: string;
    role: string;           // top | bottom | footwear | layer | ...
    name: string;
    category?: string | null;
    subcategory?: string | null;
    colour?: string | null;
    brand?: string | null;
    material?: string | null;
    pattern?: string | null;
    formality?: number | string | null;
  }>;
  weather?: {
    temperature?: number | null;
    condition?: string | null;
    precipitation?: boolean | number | null;
  } | null;
  locks?: {
    lockedItemIds?: string[];
    refine?: string | null;
    keepSlots?: string[];
    replaceSlots?: string[];
  } | null;
  decision?: {
    evaluatorScore?: number | null;
    // compact, non-engine-leak observations only (pre-sanitized)
    compatibilityNotes?: string[];
  } | null;
};
```

**Rules:**

- Only **accepted / published** piece IDs appear in `pieces`.
- No raw beam candidates, no critic dump strings that would leak engine jargon to the customer.
- Weather fields may be present even when unused in prose (see §5).

---

## 4. Service behaviour requirements

### Output shape

- Normally **1–3 concise sentences** (mobile Chat; Decisions-scale brevity is the model — ~150 completion tokens as a budget reference, not a hard product essay).
- Must name or clearly refer to **actual garments** from evidence (not “your pieces” alone).
- Must explain **at least two** real styling relationships when evidence supports them, preferring:
  - colour / palette cohesion,
  - silhouette / proportion,
  - texture / material,
  - formality / occasion fit,
  - footwear suitability,
  - lock/refine honouring (“kept the Adidas top; swapped cargos and trainers”).
- Weather may appear **only** when it actually influenced styling (e.g. precip → footwear; cold → layer). Do **not** append temperature as telemetry (“Tuned for about 19°”).
- Intelligent caveats are allowed when evidence supports them (e.g. fashion trainers OK for a light session, less ideal for hard training) — without changing the outfit.

### Personality

- Inject from the **canonical stylist identity source** already used for live chat prompts (single source of truth for Ivy/Ruby/Max/Ace).
- Outfit create must stop collapsing all stylists into identical `explain()` templates.

### Latency budget

Target chain remains **≤15s** for outfit create end-to-end. Explanation must not turn an 11s solver into a 16s failure.

| Stage | Budget (guidance) |
|-------|-------------------|
| Explanation LLM | **~1–2s** hard wall (abort / skip) |
| On miss / vendor fail | **Evidence-derived deterministic fallback** (not stock `explain()` phrases) |
| Presentation seal | Sync `toSafePresentation` — negligible |

Solver remains authoritative whether LLM explanation succeeds or fails.

---

## 5. Deterministic fallback (keep, but replace content model)

**Keep** a non-LLM escape hatch for latency/vendor failure.  
**Replace** current stock occasion labels.

### Forbidden fallback style

> “A wear-today mix that stays social without going dressy. Tuned for about 19°.”

### Required fallback style (evidence-derived)

> “The cream Henley adds texture against the clean white trousers, while the black loafers sharpen the look without making it formal.”

Fallback builder rules:

1. Use at least two concrete piece attributes (name/colour/role/material).
2. State one relational claim (contrast, cohesion, formality, footwear).
3. Mention weather only if a weather-driven constraint was recorded on the evidence object.
4. No hashed rotation of generic occasion slogans.
5. Still pass through `toSafePresentation`.

---

## 6. Presentation boundary

Contract 4 has **two** pieces:

| Piece | Requirement |
|-------|-------------|
| **Generation** | `StylistExplanationService` (LLM primary + evidence-derived fallback) |
| **Boundary** | Every customer-facing Chat outfit string goes through `toSafePresentation({ surface: 'chat', ... })` before display / HTTP `content` |

Today Decisions/QSC/Shopping seal; Chat renders raw `response.content`. That violates the canonical presentation contract and must end for this path.

Server may emit sealed fields (`presentation` + `content`/`response` body) or client may seal on receipt — **one** owner; no double-rewrite that invents new claims.

---

## 7. Migration / removal plan

### Phase A — Spec + fixtures (this doc)

- Deterministic fixtures for evidence → expected relational claims (no golden essay match).
- Golden **negative** fixtures: must **not** contain `Tuned for about`, `Training kit that stays coherent`, `A wear-today mix`, `Quiet elevation for dinner` on success path once new service is live.

### Phase B — Server implementation (authorized separately)

1. Add `StylistExplanationService` (shared module; Chat first consumer).
2. Wire only **after** `createWardrobeOutfit` / refine success accept.
3. Clarify/refuse paths keep structured refuse copy (out of scope for “why these pieces work”).
4. Feature flag / staff canary optional.
5. When proven: **remove** success-path dependence on `explain()` in `chatWardrobeOutfitFast.js`.

### Phase C — Client alignment

- Audit reachability of `utils/buildDeterministicOutfitExplain.ts`.
- If still reachable for customer UI: align to the **same** evidence-derived fallback contract, or remove / demote to offline-only so a second dormant personality does not survive.
- Chat outfit UI: ensure sealed presentation is what the user reads (no bypass).

### Non-goals for Contract 4

- No evaluator threshold / beam / ≥80 changes.
- No Live published-snapshot changes.
- No “more template variants.”
- No second outfit selection inside the explanation service.
- No mandatory multi-second LLM on every create without the latency escape hatch.

---

## 8. Acceptance tests

### Deterministic

1. Given fixed evidence (Adidas top + cargos + trainers, occasion `gym`), primary path output:
   - mentions at least two of those garments (or roles + distinctive names),
   - includes ≥2 styling relationships from the allowed set,
   - does **not** contain banned stock phrases above,
   - does **not** invent piece IDs not in evidence.
2. Weather null / irrelevant → no temperature telemetry sentence.
3. LLM timeout stub → fallback is garment-specific, still sealed, still no stock phrases.
4. Explanation input with only accepted IDs → service never calls wardrobe beam / `createWardrobeOutfit`.

### Device / runtime (after ship)

1. Re-run a thin subset of Generalised tests focused on prose (e.g. casual create, gym create): outfit quality unchanged; prose names real pieces and styling logic.
2. Confirm Render log still shows `/api/chat/outfit-from-wardrobe` → `create_wardrobe_outfit`; optional new log tag for explanation path (`llm` | `fallback`) without leaking engine jargon to the client.

### Regression guards

- Dual-lock clash / `partial_lock_clarify` still return structured clarify/refuse — not explanation essays pretending publish succeeded.
- Circuit breaker behaviour unchanged.

---

## 9. Implementation order relative to other contracts

From `STYLIST_FOUR_CONTRACT_REMEDIATION.md`:

1. Contract 1 (structured refine + occasion inheritance) remains first for intent correctness.
2. Contract 4 may proceed in parallel **once** this spec is approved, because it does not require changing garment selection — only post-accept prose.
3. Contract 3 still needs the Test 7 payload trace before multi-day code changes.
4. Contract 2 constraint inputs remain separate from explanation (do not “fix” dry-day wellies by rewriting copy alone).

---

## 10. Definition of done

Contract 4 is **done** when:

1. Success-path Chat outfit prose no longer calls `explain()` templates for customer `content`.
2. Primary path uses shared `StylistExplanationService` with personality + evidence.
3. Latency miss uses evidence-derived deterministic fallback (not stock slogans).
4. Output is sealed via `toSafePresentation({ surface: 'chat' })`.
5. Negative phrase fixtures pass; thin device prose check passes.
6. Client `buildDeterministicOutfitExplain` is audited and either aligned or unreachable for customers.
7. Audit notes include Render live SHA == server HEAD used for the change.

---

## 11. Kickoff decisions (RESOLVED 2026-08-24)

### Seal ownership
**Server seals** with `Dripn-Server/services/stylistPresentationBoundary.js` → `toSafePresentation({ surface: 'chat' })` before HTTP `content`/`response`.

Rationale: Decisions/QSC client seals after receiving server text using the StyleWise mirror of the same module. For the dedicated Chat outfit route, sealing on the server keeps every client on one voice and matches the existing server presentation module already imported by Chat refuse paths.

### Personality source
**Reuse Decisions one-liners** from `quickDecisionService` (`stylistPersonalities`), extracted to `services/stylistExplanationPersonality.js` — not the full conversational `STYLIST_PERSONALITIES` novels in `index.js`, and **not** `QuickDecisionService.generateDecision()`.

### Client `buildDeterministicOutfitExplain.ts`
**Reachable** only via `utils/generatedOutfit.ts` (Today’s Outfit / occasion-chip offline display path) — **not** the canonical `/api/chat/outfit-from-wardrobe` success path. Left in place for this pass; audit/align separately (do not delete merely for name overlap).

---

## 12. Open follow-ups (non-blocking)

1. Feature-flag duration before deleting dead `explain()` remnants (already removed from success path on `daa89ac`+).
2. Thin device prose acceptance (Tests 1/3/5 outfit IDs before vs after) — not Generalised 7.
3. Return to Contract 1 / Test 6 after Contract 4 ships.

# Pre-retest cause-level gate

**Mode:** IMPLEMENT + VERIFY (cause-level pass)  
**Date:** 2026-08-22  
**Server working tree:** `37fbe21` + uncommitted cause-level changes (beam, travel, copy, locks)  
**Client working tree:** `8b2e939` + uncommitted cause-level changes (latency, travel persist, copy)

---

## Gate table (retest readiness)

| Check | Result | Notes |
|-------|--------|-------|
| Cold customer outfit path | **FAIL** | Architecture no longer depends on 18s wake race; not proven on cold device / sleeping Render without manual warm |
| ≤15s without manual warm | **FAIL** | Client budget now 15s POST + fire-and-forget 3s health probe; no end-to-end cold measurement this session |
| Ranked beam evaluated canonically | **PASS** | `generateOutfitCandidateBeam` → guard → `stylistEvaluator` ≥80; `test-canonical-beam-rank.js` |
| No reject→full-resolve retry loop | **PASS** | Removed 2× exclude-whole-outfit retries from `chatWardrobeOutfitFast.js` |
| Mixed travel plan preserved | **PASS** | `buildTripOccasionSequence` fixed; `test-travel-occasion-mix.js` → 2 work + 2 leisure for 4-day mixed |
| Travel slots persist | **PASS** | Server merges `travelSlots`; client `normalizeChatMessage` restores `travelClarify` |
| Exact requested day count | **PASS** | `buildChatMultiDayOutfits` fails if `multi.days.length < dayCount` |
| Customer engineering language | **0 matches** (target 0) | Scrubbed refuse/fallback/multi-day copy; `sanitizeUserFacingStylistText` strips clash-safe/underfoot |
| Explicit lock resolution | **PASS** | Dual-garment partial resolve → clarify; client passes `lockedItems` from mentions |
| ≥80 hard publication floor | **PASS** | `mayPublish = evaluator.publishable` only; beam picks best ≥80 |

**Do not device-retest yet** until cold latency is proven on the same OTA you ship (Render Starter always-on confirmed in Dashboard + cold launch ≤15s).

---

## (1) Production latency

### Render always-on

- `render.yaml`: `plan: starter`, `healthCheckPath: /health`, auto-deploy `main`
- **User must verify** Render Dashboard → dripn-server → Instance Type = Starter+ (blueprint is intent, not proof)

### Client outfit path (changed)

- **Removed** primary architecture: `Promise.race([ wakeBackend(), 18_000 ])` + 22s POST
- **Now:** fire-and-forget `wakeBackend({ quick: true })` (3s probe) + **15s** POST timeout
- Staff timing: `timingSpans` on `sendWardrobeOutfitFromChat` (`wake_fire_and_forget_ms`, `outfit_post_ms`, `total_ms`); logged in `__DEV__`

### Measured this session

| Probe | Result |
|-------|--------|
| `GET /api/health` (warm) | ~1s (prior session) |
| Cold customer outfit E2E | **Not measured** |

---

## (2) Canonical candidate beam

- Allocator exposes ranked beam via `wardrobeAllocationEngine` → `generateOutfitCandidateBeam`
- `createWardrobeOutfit` evaluates beam candidates (metadata → guard → evaluator ≥80), publishes highest
- Fallback to critique `generateOutfit` when no beam candidate clears 80
- Chat adapter: **no** exclude-whole-failed-outfit retry loop

---

## (3) Travel planning

- `buildTripOccasionSequence`: mixed + business lunches → work + leisure mix (not all `work_outfit`)
- Multi-day adapter returns `wardrobeVisual.layout: 'multi'` when ≥2 day looks
- Clarify copy: single remaining question not numbered `"1."`

---

## (4) Customer presentation boundary

- Refuse/fallback/multi-day copy rewritten (no clash-safe inventory templates)
- `sanitizeUserFacingStylistText`: strips `clash-safe`, `underfoot`, borrowing-formality phrases
- Client catch: timeout vs refuse distinguished; no clash-safe string

---

## (5) Explicit garment constraints

- Server: dual-garment ask with unresolved mentions → `partial_lock_clarify` (no silent partial lock)
- Client: `matchWardrobeItemsInText` → `lockedItems` before POST for dual-garment asks
- Canonical: lock ⊆ accepted or refuse (`lock_not_honored` / dual clash copy)

---

## Automated tests run (2026-08-22)

| Script | Result |
|--------|--------|
| `scripts/test-canonical-beam-rank.js` | **PASS** (beam 8, published 85) |
| `scripts/test-travel-occasion-mix.js` | **PASS** |
| `scripts/test-canonical-create-wardrobe-outfit.js` | **PARTIAL** (Ivy pub path OK; refine service id assertion pre-existing) |

---

## Ship checklist (before device retest)

1. Commit + push **Dripn-Server** `main` → Render auto-deploy
2. Commit + `eas update --channel production` + `eas update --channel preview`
3. Confirm Render Dashboard Starter always-on
4. Cold launch test (no manual `/api/health`) on new OTA — record TTFB + outfit result
5. Re-run gate table; cold + ≤15s must flip **PASS** before generalised 7-test device run

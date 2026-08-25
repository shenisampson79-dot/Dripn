# Duplicate matrix + spoken-label contract

**Mode:** Device acceptance pending (Tier-B conversational continuity + then diversity)  
**Date:** 2026-08-25  
**History plumbing:** client `e458e5d` (OTA prod `73722ac6…` / preview `b03f45d5…`)  
**Spoken-label SSoT:** server `9928e8e` (shipped; beam acceptance still pending)  
**Scroll:** PASS / FROZEN  
**Allocator Tier A/B:** PASS / FROZEN — **do not reopen thresholds / 2500 / scorer / `MIN_TRIO_CHANGES`**  
**Contract 3 / travel:** PASS / FROZEN (quality/latency debts recorded elsewhere)

**Diversity/history:** implementation shipped; **device acceptance NOT RUN**  
**Spoken-label sample:** encouraging on resilient freestyle prose — **not** canonical beam acceptance  
**New blocker (in flight):** Tier-B conversational continuity / representation authority

---

## Launch ledger (keep exact)

| Item | Status |
|------|--------|
| Allocator Tier A/B | PASS / FROZEN |
| Scroll | PASS / FROZEN |
| Contract 3 / travel | PASS / FROZEN (+ recorded debts) |
| Spoken-label SSoT | Server shipped; sample encouraging; not beam-canonical yet |
| Diversity / history plumbing | Shipped; device acceptance **NOT RUN** |
| Tier-B continuity / visual authority | **BLOCKER** — bounded fix authorized |

---

## Root cause (device evidence + CODE-TRACED + DETERMINISTIC)

Tier-B clarification **broke conversational ownership**: after `allocator_tier_b_narrow`, the client cleared pending, so the user’s narrowing reply was classified as ordinary chat → `/api/chat/resilient` → freestyle prose → `finalizeStylistOutfitVisual` / prose→wardrobe (`MIN_OUTFIT_ITEMS=4` pad) independently reconstructed a strip (e.g. North Face jacket when prose said no jacket).

This is **not** a diversity-policy failure. Newest-first history ordering remains correct, but **`wardrobeVisual` cannot universally evidence what Ivy selected**. Beam-backed visuals can; resilient `text+complete` visuals cannot.

---

## Bounded fix (authorized)

1. Persist pending on `allocator_tier_b_narrow` (`outfit_tier_b_narrow` flow).  
2. Next user message (if related) → merge into frozen ask (`User narrowed intent: …`) → **`POST /api/chat/outfit-from-wardrobe`**.  
3. Send `tierBNarrowResolved: true` so Tier-B gate skips **once** (pool size alone would otherwise re-fire Tier B — not a threshold change).  
4. Published strip IDs must equal canonical `itemIds` (`assertCanonicalOutfitVisual`); diverge → drop strip.  
5. **No** resilient freestyle imitation of the allocator. No scorer / `MIN_TRIO_CHANGES` / Tier A/B threshold edits.

**Fixtures:** `scripts/verify-outfit-continuity-routing.ts` (Fixture F) · `utils/canonicalOutfitVisualAuthority.ts` · server `scripts/test-allocator-tier-guard.mjs` (`skipTierGuard`).

---

## Device acceptance protocol (after continuity ships)

1. Fresh Ivy thread (user 68 / broad wardrobe).  
2. Turn 1: `Put together a casual outfit for me today.` → `allocator_tier_b_narrow` + pending.  
3. Answer: `Relaxed everyday — I'm just going out for coffee and a walk.`  
4. **Expect:** `POST /api/chat/outfit-from-wardrobe` with `tierBNarrowResolved`, beam-backed publish, visual IDs === `itemIds`.  
5. Only then resume ~5 published outfits for diversity.  
6. Spoken PASS on that beam Outfit 1+.

**STOP after device evidence.** No Tier A/B, 2500, beam scoring, `MIN_TRIO_CHANGES`, hard-lock, travel, scroll, or M6 changes in this slice.

---

## Naming note (product review later — do not change now)

`allocator_tier_b_narrow` is **misread as “narrow wardrobe.”** For user 68 it means the opposite: eligible casual pool is **large** (measured **23×14×20 = 6,440** trios > Tier-A ceiling **2,500**), so Ivy asks the customer to narrow **intent / search space**, not that capacity is insufficient. Distinct from M6 lock×capacity debt (Tops→1 refuse).

---

## M6 debt (not in these slices)

Hard-lock × Tier/capacity: locking a top role-excludes other tops → Tops 1 → allocate capacity refuse.  
**Do not treat as evidence against classification A.** Fix separately if previously passing hard-lock device behaviour regresses.

---

## Classification (from fixtures)

| Result | Meaning |
|--------|---------|
| **A** | Policy already correct; **history plumbing is the defect** |

**Rationale:** On canonical `createWardrobeOutfit → beam`, with newest-first history supplied, `MIN_TRIO_CHANGES=2` + soft history penalties prevent immediate same-look repeats and, in a broad closet, suppress cream-tee / white-trousers winning again after 2–3 recent uses. Legacy Chat client history is **empty** when only `wardrobeVisual` is present and **oldest-first** when `outfitSuggestion` exists — so the beam often runs with **no / wrong “yesterday”**. That matches observed frequency without proving the ≥2-change contract wrong.

---

## History source-of-truth (updated)

| Source | Launch role |
|--------|-------------|
| Beam / `createWardrobeOutfit` `wardrobeVisual` whose IDs match `itemIds` | **Safe** for `recentOutfits` |
| Resilient prose-resolved / `text+complete` visual | **Unsafe** — do not treat as Ivy’s selection |
| Newest-first extraction | Still correct ordering |

---

## Matrix fixtures

**Harness:** `Dripn-Server/scripts/test-duplicate-matrix-beam.mjs`  
Run: `node scripts/test-duplicate-matrix-beam.mjs`

Spoken: `Dripn-Server/scripts/test-spoken-piece-label-ssot.mjs`

---

## Out of scope

Allocator Tier A/B architecture, C1–C4 thresholds, hard-lock redesign, travel, scroll, evaluator floor, C2, timeout copy, teaching resilient freestyle to imitate the allocator.

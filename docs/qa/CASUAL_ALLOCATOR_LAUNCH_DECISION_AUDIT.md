# Casual allocator — launch architecture decision audit

**Date:** 2026-08-24  
**Mode:** TRUTHMODE — read-only decision audit only  
**Status:** Allocator engineering **CLOSED** — **Tier A/B guard APPROVED & implemented** (`allocatorTierGuard.js`)

**Primary question:** Can broad casual wardrobes be reduced **deterministically from constraints Ivy already knows**, before Cartesian allocation, while preserving the intended styling product — **without** approximate scoring proxies?

**Short answer:** **No — not enough for user 68.** Existing authoritative filters already run pre-loop; they leave **23×14×20 = 6,440** trios. That cannot reach a comfortable **<10s WHAT** budget with the exact allocator.

---

## Single launch recommendation

### **Adopt a pool-product guard with tiered synchronous WHAT — do not pursue further allocator optimisation pre-launch**

| Tier | Condition | Behaviour | Expected Render WHAT |
| --- | --- | --- | --- |
| **A — Fast path** | T×B×S ≤ **~2,500** after all existing authoritative filters | Current exact allocator unchanged | **~2–8s** (gym-scale) |
| **B — Broad path** | T×B×S > **~2,500** | **Do not run full Cartesian synchronously inside 15s client envelope.** Return a deterministic, customer-visible **scope response**: Ivy states she needs a narrower ask (activity/venue/dress level) **or** offers a **background completion** path — product choice at launch sign-off | Avoids 45–60s silent failure |

**Why not Tier B = “silent authoritative narrow” only?** Measured on user 68 (below): existing authoritative constraints shrink the pool by **~4.7%** (one shoe via C2). No remaining in-code filter fires for *“relaxed casual afternoon with friends”* without either **new eligibility policy** (product decision) or **customer-visible narrowing**.

**Why not ~11s exact-equiv as primary?** Profiling projected **~11.1s WHAT** before C4/network/Render variance — inside the failure band that produced the customer-visible timeout at ~45s server / ~16s client.

**Implementation scope (launch-minimal):** Pool-product check + tier routing + copy/UX — **not** O1–O8, not B&B, not v5 proxy. Exact allocator untouched on Tier A.

**Implemented (2026-08-24):**
- `Dripn-Server/services/allocatorTierGuard.js` — `resolveAllocatorTier`, `shouldApplyTierGuard`, `buildTierBNarrowingPayload`
- Tier check after authoritative filters in `allocateSingleDayOutfit` (before Cartesian loop)
- Tier B propagates via `allocateSurpriseOutfitFromWardrobe` → `generateOutfitCandidateBeam` → `createWardrobeOutfit` → chat + Today's Outfit
- Tier B copy is stylist-led (not “wardrobe too large”); skips gym and explicit locks
- Calibrate threshold: `node scripts/verify-tier-threshold.mjs --users=68 --top=10` (optional `--bench-tier-a`)
- **Anti-rabbit-hole:** no allocator optimisation pre-launch unless tier guard itself is launch-blocking

**Correctness risk:** **Low on Tier A** (unchanged). **Tier B is product/UX risk**, not taste drift — user explicitly chooses narrower scope or waits.

**UX impact:** Tier A unchanged. Tier B: **one visible branch** on broad wardrobes only — avoids silent failure and avoids pretending Ivy can always style 84-piece wardrobes in one synchronous beat.

---

## 1. What filtering already occurs before T×B×S

Production path (`createWardrobeOutfit` → `generateOutfitCandidateBeam` → `allocateWithMode`):

| Stage | Authoritative? | casual_day? | Effect on counts |
| --- | --- | --- | --- |
| Metadata gate (`prepareWardrobeMetadata`) | Yes | Yes | Drops incomplete metadata |
| Locked-role excludes | Yes | When locks | Same-role competitors removed |
| Reality filter (`filterWardrobeForReality`) | Yes | **Only if hiking/outdoor resolved** | No-op on default casual ask |
| Activity hard-blocks (`filterWardrobeByActivity`) | Yes | **Only if activity resolved** | No-op — `activityId: null` for user 68 query |
| `excludeItemIds` | Yes | Yes | Explicit excludes |
| **`preferForOccasion` / editorial gate** | Yes | Yes | Drops **beach/sleep** lanes only |
| **`filterCatalogueForMixOccasion`** | Yes | **No** — work/evening/smart only | **Skipped** |
| **C2 footwear** (`filterAndRankFootwearForContext`) | Yes | Yes | Dry casual: drop rain boots when ordinary shoes exist |
| **`filterPoolWithWearConstraints`** | Yes | Yes | Dirty / laundry / days-between-wears |
| `orderPoolByTaste` / `orderFootwearForBeam` | **Ranking only** | Yes | **Reorders; does not shrink** |

**Inside loop (not pool-shrink):** pairwise/trio clash, optional pick, coherence gate, `scoreCombo`, beam insert. Weather outerwear pool filter runs **per trio** (hoistable without count change).

---

## 2. Authoritative constraints available (without taste proxies)

| Constraint source | Removes | Changes Ivy's judgement? |
| --- | --- | --- |
| Hard clash / `isOutfitValid` | Impossible combinations | **No** — physics/rules |
| C2 footwear eligibility | Wrong-context footwear (e.g. rain boots dry day) | **No** — Contract 2 authoritative |
| Editorial beach/sleep lane | Wrong dress-code lane | **No** |
| Activity/reality hard_blocks | Gym/hike/wedding physics | **No** — when activity resolves |
| Metadata incomplete | Ung scorable items | **No** |
| Laundry / unavailable | Unwearable items | **No** |
| User locks / requiredItems | Forces inclusion; excludes role competitors | **No** |
| **`filterCatalogueForMixOccasion`** | Formality/mix violations | **No** — **not wired to casual_day** |
| Taste ordering / `computeStyleScore` ranking | Order only if pool already built | **Yes if used to shrink pool** — **excluded** |
| v1–v4 proxy / approximate top-M | Skip full evaluation | **Yes** — **rejected** |

---

## 3. User 68 — measured pool reduction (existing constraints only)

**Query:** *“Put together something relaxed for a casual afternoon with friends from my wardrobe.”*  
**Weather:** 22°C partly cloudy · **Occasion:** `casual_day`

**Method:** `node scripts/audit-pool-stages.mjs --user=68` (read-only audit script, local Neon)

| Stage | T | B | S | T×B×S | Δ from raw |
| --- | --- | --- | --- | --- | --- |
| 0 Raw wardrobe | 23 | 14 | 21 | **6,762** | — |
| 1 Metadata gate | 23 | 14 | 21 | 6,762 | 0 |
| 2 Editorial per-item gate | 23 | 14 | 21 | 6,762 | 0 |
| 3 `buildOccasionPools` + **C2** | 23 | 14 | **20** | **6,440** | **−322 (−4.7%)** |
| 4 Production prep final (wear + order) | 23 | 14 | 20 | **6,440** | 0 |

**Activity resolver** on same query: `activityId: null` — **no further filter.**

**Conclusion for user 68:** After every **existing** authoritative constraint Ivy already applies, the universe remains **~23×14×20**. There is **no hidden late filter** that can move pre-pool without new policy. This is **not** ~20×12×15 — it is essentially unchanged.

---

## 4. Would reduced universe fit launch budget?

Rough scaling from profiling (user 68):

| Universe | Relative work | Est. Render WHAT (exact allocator) |
| --- | --- | --- |
| **6,440** (measured) | 1.0× | **~56.8s** (observed) |
| **6,440 + all exact-equiv wins** | ~0.2× | **~11.1s** (projected, borderline) |
| **~2,500** (Tier A threshold) | ~0.39× | **~22s** exact / **~4–5s** with exact-equiv |
| **~80** (gym-scale) | ~0.012× | **~1–2s** (observed class) |

**Comfortably <10s WHAT** needs either **~6×+ pool reduction** from authoritative filters alone (not available on user 68) **or** exact-equiv at already-borderline ~11s **or** not running full Cartesian on Tier B.

---

## 5. Option comparison

| Option | Latency | UX | Correctness / taste risk | Pre-launch scope |
| --- | --- | --- | --- | --- |
| **A. Existing authoritative narrow only** | **Still ~56s** user 68 | Unchanged | None | **Insufficient — measured** |
| **B. ~11s exact-equiv stack** | ~11s WHAT | Unchanged | None if regression-proof | Medium engineering; **still inside 15s cliff** with C4 |
| **C. Exact B&B** | N/A | — | — | **`NOT_FEASIBLE_EXACT`** |
| **D. v5+ proxy / approximate top-M** | ~1s | Unchanged | **High — proven recall fail** | **Rejected** |
| **E. Deterministic pool cap by taste** | Variable | Unchanged | **High** — changes considered set | **Rejected** |
| **F. Async WHAT** | Fast ack | Background result | Low taste; contract change | **Rejected by product** |
| **G. Defer broad casual / gym-only fast path** | Fast for narrow | Feature gap | Low | **Rejected by product** |
| **H. Customer-visible scope narrow (Tier B)** | Tier A fast; Tier B avoids timeout | **One branch on broad wardrobes** | **Low** — user chooses scope | **Small product + routing** |
| **I. New authoritative eligibility policy for casual** (e.g. gym-exclusive metadata lanes on generic `casual_day`) | Unknown until measured; likely **modest** | Unchanged if silent | **Medium** — product must sign eligibility rules | **New policy — not “already known”** |

---

## 6. Authoritative vs judgement-changing

**Safe (authoritative — removes impossible/inapplicable):** C2 footwear, clash rules, beach/sleep editorial, activity hard_blocks when resolved, laundry/unavailable, metadata incomplete, locks.

**Unsafe for silent pre-pool shrink (changes judgement):** proxy scores, taste-based pool truncation, M-best approximate beam, cap-by-score.

**Grey (needs product sign-off):** Applying **`filterCatalogueForMixOccasion`-class rules to `casual_day`**, or gym-exclusive lane exclusion on generic casual — authoritative in *principle* (“wrong venue”) but **not currently wired** and would remove outfits Ivy can choose today (e.g. fashion trainers on casual — intentionally allowed).

---

## 7. Investigation closed — do not reopen

| Closed workstream | Verdict |
| --- | --- |
| v1–v4 proxy | FAIL recall — frozen |
| O1–O8 exact-equiv campaign | BORDERLINE ~11s — **stop** |
| Exact B&B | **NOT_FEASIBLE_EXACT** |
| **This audit: existing authoritative pre-pool** | **Insufficient for user 68** |

**No further allocator profiling, optimisation, or architecture spikes** unless launch committee explicitly reopens with new product policy.

---

## 8. Master launch sequence (resume)

**Allocator launch decision (this doc) → hard-lock defect → Contract 3/travel → scroll → duplicate matrix → rate limiter → TrendScanner → final Stylist QA → whole-app read-only audit (Live / Decisions / QSC / Shopping / Wardrobe / infrastructure) → launch-blocking fixes only → release candidate**

---

## References

- Pool stages (user 68): `Dripn-Server/scripts/audit-pool-stages.mjs` output
- Profiling: `scripts/_qa_local/out/exact-equiv-profile-user68.json`
- B&B gate: [`CASUAL_ALLOCATOR_BRANCH_BOUND_FEASIBILITY.md`](./CASUAL_ALLOCATOR_BRANCH_BOUND_FEASIBILITY.md)
- Exact-equiv: [`CASUAL_ALLOCATOR_EXACT_EQUIVALENCE_AUDIT.md`](./CASUAL_ALLOCATOR_EXACT_EQUIVALENCE_AUDIT.md)
- Shadow status: [`CASUAL_ALLOCATOR_SHADOW_BENCHMARK_STATUS.md`](./CASUAL_ALLOCATOR_SHADOW_BENCHMARK_STATUS.md)

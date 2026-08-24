# Casual allocator — Phase 1 shadow benchmark status

**Date:** 2026-08-24  
**Phase:** Instrumentation + shadow only — **no customer behaviour change**  
**Strategy (updated):** **Freeze proxy iteration.** v4/decomposition findings recorded locally; **not deployed to Render.** Next shadow work = **exact-equivalence caching/indexing audit** — see [`CASUAL_ALLOCATOR_EXACT_EQUIVALENCE_AUDIT.md`](./CASUAL_ALLOCATOR_EXACT_EQUIVALENCE_AUDIT.md).

---

## Authorization

| Phase | Status |
| --- | --- |
| Phase 1 — instrumentation + shadow benchmark | **CLOSED** (profiling complete) |
| Phase 1b — approximate Phase-A proxy iteration (v1–v4) | **FROZEN / closed** |
| Phase 1c — exact-equiv micro-opts (O1–O8) | **STOP** — borderline ~11s; not authorized |
| Phase 1d — exact branch-and-bound feasibility | **CLOSED** — **`NOT_FEASIBLE_EXACT`** |
| Phase 1e — launch architecture decision audit | **CLOSED** — see [`CASUAL_ALLOCATOR_LAUNCH_DECISION_AUDIT.md`](./CASUAL_ALLOCATOR_LAUNCH_DECISION_AUDIT.md) |
| Phase 2 — behaviour-changing allocator rewrite | **HOLD** |
| **Allocator engineering** | **STOP — closed** |
| **Tier A/B guard** | **IMPLEMENTED** — `allocatorTierGuard.js`; no reopen pre-launch unless tier guard launch-blocker |
| **Next (launch sequence)** | **hard-lock → C3/travel → scroll → duplicate matrix → rate limiter → TrendScanner → final Stylist QA → whole-app audit → RC** |

**Do not:** deploy v4 for QA visibility, increase M beyond 96, enable pairwise coherence pre-filter, change live allocator behaviour, or run new phone tests until exact-equivalence regression passes.

---

## Score decomposition — why the cheap proxy fails (user 68)

Production `scoreCombo` on the **published complete outfit** `[59, 84, 121, 49]` vs high-ranked Phase-A **false positives** (trios that score well in proxy but are not in baseline top-12):

| Component | Published winner | False-positive mean | Gap |
| --- | --- | --- | --- |
| **coherence** (full outfit boost) | **13.0** | ~19.3 (FP trios rank high on trio coherence) | Proxy over-ranks incoherent-when-complete trios |
| **optionalSlotDelta** (trio → +outerwear/accessory) | **+1.52** | **−5.28** | ~6.8 pts — outerwear 49 adds real value; FP trios lose points when completed |
| **computeStyleScoreBoost** | **4.58** | **−0.11** | ~4.7 pts — taste/style alignment on full outfit |
| outerwearWeather | 0.5 (on completion) | 0.5 (often same) | Minor |

**Trio vs complete on the published winner:** adding outerwear **49** contributes **+1.52** total (coherence **+1**, outerwearWeather **+0.5**, style boost **+0.02**). The proxy ranks mostly on core trio; it cannot see which trios **gain** when outerwear is attached.

**Top-12 baseline outfits** all include outerwear **49** (or alternate outerwear) — mean optional-slot delta **+2.13**. Production scorer values relationships the trio proxy does not model.

**Suggested v4 hints (auto-derived):** estimatedOuterwearBoost ≈ **1.8**, styleScoreWeight **1.0**, coherenceWeight **0.5**.

---

## User 68 — decomposition + proxy rerun (local Neon, RUNTIME)

**Prompt:** casual afternoon relaxed outfit (same class as device failure).  
**Method:** `node scripts/run-allocator-shadow-benchmark.mjs --user=68` (Dripn-Server, shadow-only).

| Metric | Value |
| --- | --- |
| Wardrobe pool T×B×S | **6440** (84 items) |
| Baseline allocator (production path) | **~15.3s** local / **~56.8s** Render (same wardrobe) |
| Baseline published item IDs | `[59, 84, 121, 49]` (tee, bottom, loafer, outerwear) |
| Pair hard-clash index | **1062** checks in **~49ms** |
| Pair-index trio rejection | **39.6%** |
| Pairwise coherence false-prunes | **0** (pre-filter still **held**) |

### Phase-A proxy recall (user 68)

| Proxy | Winner Phase-A rank | In M=64 beam? | M=96 top-12 recall | Phase-B winner @ M=64/96 |
| --- | --- | --- | --- | --- |
| **v1_fast_trio** | **151** | No | **16.7%** | **false** / **false** |
| **v2_enriched_trio** | **62** | **Yes** | **25%** | **false** / **false** |
| **v3_fast_complete** (diagnostic) | **454** | No | **33.3%** | **false** / **false** |
| **v4_decomposed** (gap-driven) | **56** | **Yes** | **25%** | **false** / **false** |

**Verdict:** `PROXY_RECALL_FAIL` — **Phase 2 not authorized.**

v4 moves winner rank **62 → 56** and keeps the published trio in the M=64/M=96 Phase-A beam, but **Phase-B still does not reproduce the published outfit** and top-12 recall remains **25%** (gate: ≥95%).

### Projected phased timing (user 68, v4 proxy)

| M | Phase-B ms | Projected total (pair index + Phase A + Phase B) |
| --- | --- | --- |
| 32 | ~137 | **~842ms** |
| 48 | ~198 | **~905ms** |
| 64 | ~264 | **~968ms** |
| 96 | ~389 | **~1106ms** |

Architecture can hit the **<10s WHAT target** if recall is fixed; quality preservation remains the blocker.

---

## Synthetic fixtures (local, RUNTIME)

| Fixture | v1 rank | v2 rank | v4 rank | v4 M=96 top-12 | Coherence FP |
| --- | --- | --- | --- | --- | --- |
| `synthetic_broad_a` | 351 | 257 | **123** | 25% | 0 |
| `synthetic_broad_b` | 418 | 395 | **209** | 33.3% | 0 |

Same gap-driver pattern: coherence, optionalSlotDelta, computeStyleScoreBoost. v4 helps rank but **does not pass gates** on synthetics either.

---

## Frozen conclusions (proxy path — closed)

1. **Hard-clash pair index** — promising (~40% trio removal, sub-200ms). Candidate for **exact-equivalent** production integration (O1/O2 in exact-equiv audit).

2. **Cheap proxy (v1–v4) not safe** — best v4 rank **56**; top-12 recall **25%**; Phase-B winner recall **false**. Approximate top-M pruning **changes Ivy's judgment** — stop iterating.

3. **Not an M problem** — complete-outfit effects (outerwear, `computeStyleScore`, coherence-on-complete) explain the gap. Raising M burns latency without guaranteeing same published outfit.

4. **Next work** — exact-equivalence caching/indexing to make today's **exact** ~56s algorithm cheaper without changing scores. Target **~12–25s** realistically; return to staged approximation only if exact path cannot reach <10s.

5. **Pairwise coherence pre-prune** — zero false-prunes; still **held** until explicitly cleared.

---

## Exact-equivalence profiling — user 68 (RUNTIME, local)

**Method:** `node scripts/run-exact-equiv-profile.mjs --user=68` (read-only counters, no production changes)

| Metric | Value |
| --- | --- |
| Baseline WHAT (production path) | **~21s** local / **~56.8s** Render |
| Instrumented profile loop | **~16.6s** local |
| **Projected Render WHAT (all safe exact wins)** | **~11.1s** |
| **Hard stop verdict** | **BORDERLINE_REVIEW** |

### Ranked optimizations (user 68)

| ID | Est. ms saved | % of loop | Exact? | Confidence | Risk |
| --- | --- | --- | --- | --- | --- |
| **O3** optional indexing | **~5865** | 35% | yes | medium | medium |
| **O1** pair index | **~3110** | 19% | yes | high | low |
| O5+O6 feature caches | ~1326 | 8% | yes | medium | low |
| O7 style/coherence dedup | ~1050 | 6% | yes | medium | low |
| O2 clash memo | ~456 | 3% | yes | high | low |
| O4–O9 minor | ~15 | <1% | yes | high | low |

### Where time goes today (measured)

| Phase | ms (local) | Notes |
| --- | --- | --- |
| **clash / isOutfitValid** | **~11,044** | **108,836** arity-4/5 calls; **104,949** optional scans |
| scoreCombo | ~4,689 | 3177 survivors |
| optional preference | ~103 | cheap vs clash |
| rerank | ~12 | 12 duplicate computeStyleScore |

**Interpretation:** ~**11s projected Render** is borderline — may not leave comfortable headroom inside the **15s client envelope + C4**. Per hard-stop rule: **do not spend days on exact-equiv micro-opts** without a product/architecture decision. If implemented stack still lands ~10–12s, return with irreducible cost + bounded architecture options.

**Allocator engineering: CLOSED.** Launch decision audit complete.

---

## Launch decision (2026-08-24)

**Existing authoritative pre-pool filters do not materially shrink user 68** (6,762 → **6,440**, −4.7% via C2 only).

**Recommendation:** **Pool-product tier guard** — exact allocator on Tier A (T×B×S ≤ ~2,500); Tier B broad wardrobes get stylist-led narrowing (`allocator_tier_b_narrow`), not silent timeout or proxy. **Shipped in code 2026-08-24.**

Full audit: [`CASUAL_ALLOCATOR_LAUNCH_DECISION_AUDIT.md`](./CASUAL_ALLOCATOR_LAUNCH_DECISION_AUDIT.md)

**Do not reopen:** v5+, B&B, O1–O8, profiling, proxy work.

---

## Branch-and-bound feasibility gate (2026-08-24)

**Verdict:** **`NOT_FEASIBLE_EXACT`**

Cheap admissible upper bounds on production `scoreCombo(production_completion(trio))` do not exist because:

- optional completion is **not score-monotonic** (winner +1.5 on complete; FPs −5.3);
- `pickValidOptional` uses **preference score**, not scoreCombo;
- coherence / subtype / style / repeat penalties can **increase or decrease** on completion.

| Metric | Value |
| --- | --- |
| Oracle top-12 prune potential (hindsight, user 68) | ~**49%** of scored trios never enter top-12 |
| Identifiable with cheap safe UB | **No** |
| Projected WHAT if oracle pruning (optimistic) | ~**8–9s** — **research-grade**, not proven implementable |
| Projected WHAT with feasible exact-equiv only | ~**11.1s** (borderline) |

Full audit: [`CASUAL_ALLOCATOR_BRANCH_BOUND_FEASIBILITY.md`](./CASUAL_ALLOCATOR_BRANCH_BOUND_FEASIBILITY.md)

---

## Next shadow work (closed)

See [`CASUAL_ALLOCATOR_EXACT_EQUIVALENCE_AUDIT.md`](./CASUAL_ALLOCATOR_EXACT_EQUIVALENCE_AUDIT.md):

1. ~~Read-only profiling counters~~ — **DONE**
2. ~~Hard stop verdict~~ — **BORDERLINE_REVIEW (~11s projected)**
3. ~~Branch-and-bound feasibility~~ — **`NOT_FEASIBLE_EXACT`**
4. **Allocator engineering STOP** — product-level launch decision required

---

## How to run again (server-side)

```bash
# Local (requires DATABASE_URL in .env or .env.local)
node scripts/run-allocator-shadow-benchmark.mjs --user=68

# After deploy — staff/cron POST
POST /api/qa/allocator-shadow-benchmark
{ "userId": 68, "includeSyntheticFixtures": true }

GET /api/qa/allocator-shadow-benchmark/latest
```

**Pending (local only, not deployed):** decomposition module + v4 proxy — findings frozen; no Render push.

---

## Gate to Phase 2 (unchanged — still FAIL)

| Gate | User 68 result |
| --- | --- |
| 100% published-winner survival (Phase B) | **FAIL** (all proxies) |
| ≥95% baseline top-12 recall | **FAIL** (best 33.3% v3 @ M=96 diagnostic) |
| Zero coherence false-prunes | **PASS** |
| Evaluator unchanged | Not yet measured on shadow beam |
| Render WHAT < 10s projected | **Plausible** (~1s phased @ M=64 if recall fixed) |

---

## References

- [`CASUAL_ALLOCATOR_PERFORMANCE_DESIGN.md`](./CASUAL_ALLOCATOR_PERFORMANCE_DESIGN.md)
- [`OUTFIT_LATENCY_TRACE.md`](./OUTFIT_LATENCY_TRACE.md)
- [`CASUAL_ALLOCATOR_BRANCH_BOUND_FEASIBILITY.md`](./CASUAL_ALLOCATOR_BRANCH_BOUND_FEASIBILITY.md) — **allocator gate closed**
- Local artifact: `Dripn-Server/scripts/_qa_local/out/shadow-benchmark-user68-decomp.json`

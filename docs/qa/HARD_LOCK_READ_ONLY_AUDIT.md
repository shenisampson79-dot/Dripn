# Hard-lock — read-only architecture audit

**Date:** 2026-08-24 23:57  
**Mode:** TRUTHMODE — diagnosis only (no patches tonight)  
**Build under test:** Render `eabb533` · OTA `bac3171`  
**Prior baseline failure:** RETEST Generalised 7 **Test 3** (~1s, no `outfit-from-wardrobe` POST)

---

## Intended contract

When a user names a wardrobe hero piece in natural language (“wear my chambray shirt — build the rest around it”), Ivy must:

1. Route to **`POST /api/chat/outfit-from-wardrobe`** (not `/api/chat/resilient`).
2. Resolve the named piece to a **hard lock** (`mustIncludeIds` / `lockedItems`).
3. Run **`createWardrobeOutfit`** once with locks honored — no silent unlock.
4. Publish outfit card **or** structured clarify/refuse — never ~1s generic resilient fail.

Dual-lock + clarify continuation (Test 4 class) is a **related but separate** sub-path — see [`STYLIST_CHAT_OUTFIT_CONTINUITY_SPEC.md`](./STYLIST_CHAT_OUTFIT_CONTINUITY_SPEC.md).

---

## Production route map (current tree)

```text
USER (natural hard-lock ask)
→ CLIENT resolveOutfitRoute (outfitClarifyContinuity.ts)
   → isWardrobeHardLockAsk || pending_ready || isOutfitTaskAsk
→ CLIENT AIStylistScreen isOutfitCreate
   → matchWardrobeItemsInText + wear-my / build-around → lockedItems[]
→ POST /api/chat/outfit-from-wardrobe
→ buildChatWardrobeOutfit → createWardrobeOutfit (mustIncludeIds)
→ allocateSingleDayOutfit
   → shouldApplyTierGuard: **false when locks present** (full Cartesian)
→ guard + evaluator ≥80 → publish OR partial_lock_clarify / dual_lock_clash / refuse
→ CLIENT attachWardrobeVisualToMessage + outfitClarify FSM on partial_lock_clarify
```

| Stage | Source of truth | Bypass / conflict |
| --- | --- | --- |
| Route gate | `resolveOutfitRoute` | Cold short reply without pending → `other` → resilient (**Test 4 T2 class**) |
| Lock IDs | Client mention match + server mention resolver | Matcher miss → lock not sent; solver may ignore intent |
| Tier guard | Skipped when `locks.length` | **Locked broad casual still runs full T×B×S** on user 68 scale |
| Publish | `createWardrobeOutfit` only | resilient must not invent outfit |

---

## Evidence vs historical defect

| Claim | Class | Status |
| --- | --- | --- |
| Test 3 (8/23) missed outfit POST, ~1s resilient fail | **RUNTIME** (old OTA `3dc517d6`) | **FAIL** — baseline |
| Regex-only gate was root cause | **CODE-TRACED** | Confirmed in RETEST cause table |
| `isWardrobeHardLockAsk` + `resolveOutfitRoute` wired in `AIStylistScreen` | **CODE-TRACED** | Present on `bac3171` |
| Fixtures A–E routing matrix | **DETERMINISTIC** | **PASS** — `npx tsx scripts/verify-outfit-continuity-routing.ts` |
| Fixture B end-to-end on device (current OTA) | **RUNTIME** | **UNPROVEN** — not run tonight |
| Locked broad casual latency on user 68 | **UNPROVEN** | Tier guard bypasses locks; pool still ~6k trios |

---

## Deterministic fixture summary (all PASS on current tree)

| Fixture | Ask | Expected route |
| --- | --- | --- |
| **B** | “I definitely want to wear my chambray shirt. Build the rest around it.” | `outfit-from-wardrobe` / `hard_lock` |
| **A** | Dual-piece dinner + partial clarify + “The black Next blazer.” | `pending_ready` → outfit POST with 2 locks |
| **C/D** | Unrelated / cancel during pending | drop / cancel pending |
| **E** | “Keep the shoes but change the top and bottoms” | refine → outfit POST |

Cold short reply `"The black Next blazer."` without pending → **`other`** (by design — needs FSM).

---

## Open risks (not blockers for tonight’s audit)

1. **Mention resolution** — “chambray shirt” must match wardrobe row; failure → no lock, generic create.
2. **Locked + broad pool** — explicit product gap: locks skip Tier B; user 68 may still hit long WHAT on single-piece hard-lock casual (separate from routing defect).
3. **Dual-tee / dual-lock clash** — server `dual_lock_clash` path; copy spec in Contract 2 — not re-opened here.
4. **Tier B copy polish** — “and or” → “or” in narrowing sentence — final QA, not allocator/hard-lock workstream.

---

## Recommended acceptance (bounded — do not expand matrix)

Run **one** device test on current OTA after force-close:

> **Fixture B:** “I definitely want to wear my chambray shirt. Build the rest around it.”

| Pass | Fail |
| --- | --- |
| `POST /api/chat/outfit-from-wardrobe` in Render | `/api/chat/resilient` or ~1s generic fail |
| `lockedCount ≥ 1` in `[ChatWardrobeOutfit]` | `lockedCount: 0` |
| Outfit card with chambray on look **or** structured clarify/refuse | Wrong route / timeout |

Optional second (only if Fixture B passes quickly): Test 4 turn-1 clarify class — already **RUNTIME PASS** on 8/23; turn-2 continuity is covered by Fixture A deterministic PASS.

---

## Verdict (read-only, 2026-08-24)

| Area | Verdict |
| --- | --- |
| **Historical routing defect (Test 3)** | **Likely remediated in code** — DETERMINISTIC PASS; **RUNTIME UNPROVEN** on `bac3171` |
| **Launch approval** | **NOT APPROVED** until one Fixture B device trace |
| **Fix tonight?** | **No** — audit only per launch discipline |

**Next after acceptance:** if Fixture B passes → mark hard-lock routing **PASS / FROZEN** and move to **Contract 3 / travel**. If fail → trace first failing hop (route vs mention vs solver vs latency).

**Do not:** expand casual test matrix, tune tier threshold, or patch allocator for locked broad pools without product sign-off.

---

## Fixture B evidence capture (2026-08-25 ~00:05)

### A. Client route (exact ask) — DETERMINISTIC

Ask: *“I definitely want to wear my chambray shirt. Build the rest around it.”*

```json
{ "isHardLock": true, "isCreateAsk": false, "route": "outfit-from-wardrobe", "reason": "hard_lock" }
```

Historical Test 3 routing miss is **not** reproduced in current client code. Not enough alone for launch PASS.

### B. Server path, user 68, exact ask — RUNTIME (local vs live wardrobe)

| Field | Value |
| --- | --- |
| Chambray in wardrobe | **None** |
| Server elapsed | **50 ms** |
| `path` | `allocator_tier_b_narrow` |
| `itemIds` | `[]` |
| Lock formed | **No** |
| Ivy text | Tier B stylist-led narrowing |

**Three-outcome classification for exact Fixture B on user 68:**

| Bucket | Applies? |
| --- | --- |
| Hard-lock PASS (`lockedCount ≥ 1` + outfit/structured) | **No** |
| Routing FAIL (`/resilient`, no outfit POST) | **No** — route is `outfit-from-wardrobe` / `hard_lock` |
| Routing PASS + latency FAIL (lock + 15s+) | **No** — no lock; Tier B short-circuit |

**Cause:** wardrobe/mention miss (no chambray) → no lock → Tier B. **Not** hard-lock remediation failure; **not** locked-broad-pool latency.

### C. Device Render logs

Still required from phone on current OTA for freeze. If repeating tonight, use an **owned** shirt name (same routing contract) only if product accepts adaptive wording — do not expand matrix.

### D. Stop

Do not reopen allocator from chambray→Tier B. Do not pre-fix Tier B lock bypass. One owned-shirt device run → binary freeze/trace.

---

## Owned-piece run — cream henley (2026-08-25)

**Ask:** *“I definitely want to wear my cream henley shirt. Build the rest around it.”*  
**Evidence class:** SERVER RUNTIME (user 68 live wardrobe) — device Render still optional corroboration

| Field | Value |
| --- | --- |
| Client route | `outfit-from-wardrobe` / `hard_lock` (same gate as Fixture B) |
| Server elapsed | **2964 ms** |
| `path` | `no_valid_look` |
| `reason` | `lock_not_honored` |
| Henley on card | **No** |
| Ivy reply | Structured refuse: could not keep **cream henley + Primark cream crew neck t-shirt** together — unlock one |

**Classification: Resolution FAIL** (not routing fail, not locked-broad latency)

- Route reached wardrobe outfit pipeline (correct).
- Mention resolution over-matched on **“cream”** → dual top locks (id `91` henley + id `59` Primark cream tee).
- Solver refused dual same-role locks; hero alone was never published.
- Fast (~3s) → Tier B bypass / Cartesian latency **not implicated**.

**Ledger:** routing **PASS**; resolution **PASS** (R1–R8 + user-68 runtime 2026-08-25); hard-lock workstream ready to **FREEZE** after ship + device confirm.

**Runtime evidence:** `path:create_wardrobe_outfit`, itemIds `91,118,121` (henley locked, cream tee 59 absent), **907 ms**.

# Duplicate matrix + spoken-label contract

**Mode:** Fixtures-first · CODE-TRACED · **No OTA / Render**  
**Date:** 2026-08-25  
**Held commits (do not ship as-is):** client `0025fd2`, server `9197054`  
**Scroll:** PASS / FROZEN (unchanged)

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

**Not D for the customer report:** empty/wrong history means the device symptom is not “legitimate keep-one under good history”; it is history never reaching the beam correctly.

**Not B as primary:** when history is correct in fixtures, chronic cream/white did **not** win again (`M5`). Soft penalty exists (`−375` on forced chronic combo). Re-evaluate frequency weighting **only after** history plumbing is fixed and device-retested.

**Blanket top+bottom+shoes ban:** rejected. Held `9197054` ban is on the **critique ladder**, not the Chat beam; it also collapses round-1/round-2 and fights deliberate keep-one.

---

## Matrix fixtures

**Harness:** `Dripn-Server/scripts/test-duplicate-matrix-beam.mjs`  
**Path under test:** `allocateSurpriseOutfitFromWardrobe` / `createWardrobeOutfit` / `generateOutfitCandidateBeam` — **not** `diversityBanBottomAndShoes`.

| ID | Case | Result |
|----|------|--------|
| M0 | Empty `recentOutfits` (fresh server view) | No diversity/history; not cross-session |
| M1 | Exact prior trio available | No immediate too-similar / exact repeat |
| M2 | Prior top favourite | Keep-one only with ≥2 trio changes |
| M3 | Prior bottom favourite | Same |
| M4 | Prior shoes favourite | Same |
| M5 | Item across 2–3 looks | Cream/white did not win again; soft penalty present |
| M6 | Hard-lock recent item | **PARTIAL/FAIL** — role-exclude → Tops 1 → capacity/Tier refuse (debt; not A/B) |
| M7 | Narrow 2×2×2 closet | Publishes (graceful) |
| M8 | Multi-look ordering | Legacy `history[0]`=oldest; proposed=newest |
| M9 | Visual-only message | Legacy sends `[]`; proposed recovers strip IDs — **UI state only** |

Run: `node scripts/test-duplicate-matrix-beam.mjs`

---

## History source-of-truth (smallest launch fix)

| Source | What it is | Launch role |
|--------|------------|-------------|
| Current-thread `wardrobeVisual` / message IDs | UI published look | **Primary** for in-thread variation |
| `outfitSuggestion.items` | Hydrated after strip enrich | Fallback if visual missing |
| Persisted AsyncStorage chat | Same shapes after reload | Same extraction; still thread-scoped |
| `fetchRecentOutfits` (worn calendar) | Cross-session worn | **Not** wired to `outfit-from-wardrobe` today — out of launch MVP unless device still fails after thread history |

**Launch requirement:** reasonable variation during normal Ivy use in a thread.  
**Immediate contract:** client must send `recentOutfits` as **newest-first** id lists from the last N assistant looks, preferring visual strip IDs.

Do **not** call strip/UI history “cross-session protection.”

---

## Spoken garment label SSoT

**Contract (conceptual):**

```text
stored wardrobe name  →  may stay Title Case (cards / identity)
spokenPieceLabel(piece)  →  ONLY form allowed into customer prose writers
```

**Target wire order:**

1. Evidence builder attaches `spokenLabel` (or replaces prompt `name` with spoken form) **before** LLM  
2. Deterministic fallback already uses `spokenPieceLabel` — keep  
3. Repair/clarify copy uses the same function  
4. Presentation seal remains **defensive** only — not the primary transform  

**Fixtures:** `Dripn-Server/scripts/test-spoken-piece-label-ssot.mjs`

| Stored | `spokenPieceLabel` today |
|--------|---------------------------|
| Primark Cream Crew Neck T-Shirt | the primark cream tee |
| White Cotton Trousers | the white pants |
| Black Running T-shirt | the black tee |
| Gap striped shirt | the gap white shirt |
| ASOS Oversized Hoodie | the asos black hoodie *(brand lowercased — merge with `editorialGarmentName` brand rules)* |
| adidas Ultraboost… | the black ultraboost trainers |

**Gap (CODE-TRACED):** `buildStylistExplanationEvidence` still puts raw Title Case in `pieces[].name` for the LLM prompt. Held seal/client regexes **mask**; they are not SSoT.

Goal is natural sentence-case references with proper brand/product tokens — **not** blindly lowercasing every wardrobe name.

---

## Held-commit disposition

| Change | Disposition |
|--------|-------------|
| `0025fd2` newest-first + prefer `wardrobeVisual` IDs | **Salvage** (matrix proves correct) — ship as history plumbing only |
| `0025fd2` client mid-prose Title Case regex | **Drop** as primary fix |
| `0025fd2` scroll PASS doc | Keep (already frozen) |
| `9197054` trio ban on `diversityBanBottomAndShoes` | **Revert / drop** |
| `9197054` seal sanitize + mid-prose / known-name softeners | **Hold** → replace with evidence spokenLabel; seal may stay thin defensive |
| `9197054` prompt “use sentence case” alone | Insufficient |

---

## Proposed minimal implementation (STOP — do not implement until authorized)

1. **Client only:** extract `recentOutfits` newest-first from `wardrobeVisual` → looks → `outfitSuggestion`; align occasion-chip paths (~3927/4042). No casing regex.  
2. **Server:** revert trio-ban change on `diversityBanBottomAndShoes` (restore bottom+shoes round-1).  
3. **Spoken SSoT (server-first):** evidence/prompt consumes `spokenPieceLabel` (optionally brand-cased via `editorialGarmentName` tokens); leave seal as defense.  
4. **Do not** add chronic frequency scorer until device retest with (1).  
5. **Record debts:** M6 lock×tier capacity; true cross-session history later if still needed.

**No OTA. No Render** until explicit authorization after this salvage lands and device-checks history.

---

## Out of scope

Allocator Tier A/B architecture, C1–C4 thresholds, hard-lock redesign, travel, scroll, evaluator floor, C2, timeout copy.

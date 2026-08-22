# Duplicate matcher — read-only audit

**Status:** CONTRACT SIGNED (2026-08-22) — multi-signal garment identity with Replicate CLIP (see `SAME_GARMENT_REPHOTO_AUDIT.md`). Structural veto + true visual embed supersede dHash-as-identity; **do not** move `0.82` or raise name weights.  
**Bulk Add UX:** Presentation unfrozen 2026-08-22 — hard duplicates use the same visual `DuplicateComparisonSheet` queue as similars / Quick Add (Skip / Add anyway with photos).

### Failure class — meter-starved / re-photo miss (2026-08-22)

**User evidence:**
1. Nike tee already in wardrobe as **“other tops”** (carpet) → Bulk re-upload **“Nike light teal t-shirt”** → no duplicate sheet.
2. **Counter-example (decisive):** Under Armour tee already saved as **“under armour turquoise t-shirt”** (Tops, rembg’d) → Bulk re-upload **“under armour heather blue performance t-shirt”** (Tops, Blue) → still no duplicate sheet; item saved. Same pattern: Next blazer ×4, yellow Hunter boots ×3 (names differed by ~one word).

**Architecture (not a “name typo” / “other tops” bug):**

| Layer | Behaviour |
|-------|-----------|
| Launch contract | `neverMergeOnNameOnly: true` — wording must **not** be enough to block |
| `allowAttributeOnly` | **false** on `check-duplicates` — high Jaccard name alone → **ok** |
| Hard / warn path | Requires dHash / embedding band (`imageSim ≥ 0.82`) |
| Re-photo | New framing / lighting / crop → Hamming often **above** warn band → `distinct_image` |
| Colour labels | e.g. Vision **Blue** vs stored **turquoise** can set `metadataConflict` — hard visual becomes **similar_item** (sheet should still show); if visual is weak, colour does not rescue |

Meter-out weak labels are one way to poison fingerprints; case (2) proves **correct category + brand + similar name still miss** when visual identity does not fire. One-word name diffs on blazers/boots miss for the same reason.

**Do not** “fix” by lowering name thresholds or turning on attribute-only soft-block without a signed structural+visual contract.

**Follow-up (2026-08-22):** SAME-GARMENT REPHOTO audit → `SAME_GARMENT_REPHOTO_AUDIT.md`. Live wardrobe replay proves **false positives** from dHash *and* text-meta embeddings; deterministic Hamming-20 replay proves **false negatives** without moving `0.82`. Heather-blue UA / Next×4 / Hunter×3 copies were **not** still in DB — treat as deleted or unreproduced; architecture + synthetic FN stand.

## Product contract (SIGNED — garment identity)

> **Visual similarity can suggest a review, but it cannot by itself imply duplication when structural garment identity differs materially.**
> **CLIP is the true visual signal inside a multi-signal system — never a single magic hard-duplicate score.**

Examples:
- High dHash from similar framing / white background / lighting must **not** outweigh `crew-neck T-shirt ≠ button-up shirt`.
- Macro family `top` is a **coarse gate only**, not substantive evidence of duplication.
- Text-meta `semanticAppearanceEmbedding` (legacy `imageEmbedding`) is **support only**, never primary same-item evidence.
- **`attribute_support_only`** must not fire on family + colour + generic name overlap alone — structural garment type must be part of the signal.

Bands for CLIP hard/possible come from `GARMENT_CLIP_BENCHMARK.md` (fixture data), not guessed constants.

---

## Architectural defect (named)

**Scenario G:** T-shirt vs button-up triggers `similar_item` because **dHash ≈ 0.88 (probable band) + both map to macro-family `top`**. Structural disagreement (`t-shirt ≠ button-up`) has **no veto**. That violates the product contract above; it follows the **current implementation rules**, not the intended behaviour.

---

## Server: `attribute_support_only` (verified)

**Finding:** The path is **not active** on production wardrobe duplicate checks today.

| Location | `allowAttributeOnly` |
|----------|----------------------|
| `POST /api/wardrobe/check-duplicates` (`index.js` ~14943) | **Not passed** → defaults `false` |
| `findWardrobeDuplicates()` → `scoreDuplicateMatch()` | Only `true` if `opts.allowAttributeOnly === true` |
| Repo-wide grep `allowAttributeOnly: true` | **Zero matches** |

Code exists (`wardrobeDuplicateDetection.js` ~900–908): when `allowAttributeOnly && attrScore >= 0.82 && imgSim == null` → `similar_item` / `attribute_support_only`. **Dead path for Bulk Add / Quick Add pre-save checks.**

User-reported similars on Bulk Add are therefore **`visual_probable` / `visual_metadata_conflict`** (dHash + family), not attribute-only.

---

## Structural fields available today

| Field | Wardrobe Vision analyze | Stored on item | Sent to `check-duplicates` (Bulk Add) | Used in dedupe scorer |
|-------|-------------------------|----------------|--------------------------------------|------------------------|
| **category** | `garmentType` | ✓ | ✓ | Macro **family** gate |
| **subcategory** | ✓ (`subcategory` in JSON prompt) | ✓ DB column | **✗ omitted** in `BulkWardrobeUploadScreen` payload | +0.12 attr only; **no veto** |
| **color** | ✓ | ✓ | ✓ | attr + metadata conflict |
| **brand** | ✓ (when detected) | ✓ | ✓ | +0.12 attr |
| **material** | ✓ | sometimes | ✗ omitted bulk payload | metadata conflict only |
| **neckline** | ✗ not in analyze schema | ✗ | ✗ | ✗ |
| **sleeve** | ✗ | ✗ | ✗ | ✗ |
| **silhouette** | ✗ (stylist/profile only) | ✗ | ✗ | ✗ |

**Implication:** Any future structural gate must start with **subcategory / garment type** (when Vision + client pass it through). Neckline/sleeve/silhouette require **new analysis fields** before they can constrain matching.

---

## Real pair audit: blue Nike T-shirt vs light grey button-up

Script: `npx tsx utils/duplicateMatcherAudit.nikeVsButtonup.ts`  
Helper: `breakdownDuplicateMatchFeatures()` in `utils/wardrobeDuplicateMatch.ts`

| Scenario | Conditions | tier | rule | attrScore | imageSim | Subcategory | Colour |
|----------|------------|------|------|-----------|----------|-------------|--------|
| **A** | Attributes only, no dHash | `ok` | `no_match` | 0.407 | — | tee ≠ button-up | blue ≠ grey |
| **B** | hamming 12, blue vs grey | `similar_item` | `visual_metadata_conflict` | 0.407 | 0.88 | mismatch | conflict |
| **C** | hamming 6, blue vs grey | `similar_item` | `visual_metadata_conflict` | 0.407 | 0.955 | mismatch | conflict |
| **G** | hamming 12, **both blue**, tee vs button-up | `similar_item` | **`visual_probable`** | 0.557 | 0.88 | **tee ≠ button-up** | match |

### Scenario G — signal contributions

| Signal | Value | Effect |
|--------|-------|--------|
| Macro family | `top` = `top` | **Gate for visual_probable** |
| Subcategory | tee ≠ button-up | attr only; **no veto** |
| Visual dHash | hamming 12 → 0.88 | **Primary trigger** |
| attrScore | 0.557 | Below 0.82; not attribute-only |
| Neckline / sleeve / silhouette | not modeled | — |

**Conclusion:** Reported Bulk Add similars match **implementation rule** `probableImage && sameCat` (client) / server equivalent. That rule **violates the locked product contract** when structure differs.

---

## Proposed regression matrix (for contract change — not yet implemented)

| ID | Candidate | Wardrobe existing | Human expectation | Current tier (typical) | Target after contract fix |
|----|-----------|-------------------|-------------------|------------------------|---------------------------|
| R1 | Blue Nike crew-neck tee | Light grey button-up shirt | **Not similar** — structure differs | `similar_item` (visual_probable or metadata_conflict) | `ok` |
| R2 | Blue Nike tee | Cream Henley | **Not similar** | `similar_item` if dHash high | `ok` |
| R3 | Turquoise UA tee | Blue Nike tee (different brand, same cut) | **Review OK** — could be duplicate | `similar_item` or `duplicate` if visual hard | `similar_item` or warn |
| R4 | Same Nike tee, second photo (true duplicate) | Existing Nike tee listing | **Duplicate** | `duplicate` if hamming ≤8 | `duplicate` |
| R5 | White-bg flat-lay unrelated tops | Various | **No spurious warn** on family alone | `similar_item` if dHash 0.82–0.94 | `ok` unless structure matches |
| R6 | Attribute-only (hypothetical if flag enabled) | Same colour + generic “tee” name | **Must not warn** without structure | N/A today (path disabled) | `ok` |

Extend frozen D1–D25 suite with R1–R6 when implementing **structural compatibility + visual evidence**.

---

## Audit procedure (remaining pairs)

1. `breakdownDuplicateMatchFeatures(newItem, wardrobeItem)`
2. Server trace (if needed): `reason`, `hamming`, `imageSimilarity`, `embeddingScore`, `attrScore` from `check-duplicates` response
3. Record decisive rule; do not patch until contract written

---

## Sequencing

1. ~~Freeze Bulk Add UX~~ ✓
2. ~~Duplicate audit — cause named~~ ✓ → extended in `SAME_GARMENT_REPHOTO_AUDIT.md` (FP + FN); **PARKED** pending signed garment-identity contract
3. **Quick Add autocapture regression** → `QUICK_ADD_AUTOCAPTURE_REGRESSION_AUDIT.md`
4. rembg — one request trace if still failing
5. Generalised 7 Chat baseline

---

## Implementation direction (after sign-off only)

- Adopt **multi-signal garment identity** (true visual embedding + structure + brand + colour family + material + dHash-as-near-image-only). See `SAME_GARMENT_REPHOTO_AUDIT.md`.
- Add **structural compatibility veto** before `similar_item` / `duplicate` promotion (subcategory/type first).
- Pass **subcategory** (and material when available) from Bulk Add into `check-duplicates`.
- Do **not** enable `allowAttributeOnly` without structural fields.
- Do **not** tune `IMAGE_SIM_PROBABLE` alone.
- Do **not** treat missing fingerprints as silent `ok` — emit `identity_evidence_unavailable`.

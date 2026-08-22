# SAME-GARMENT REPHOTO audit — garment identity

**Status:** CONTRACT SIGNED (2026-08-22) — implement multi-signal identity with Replicate `openai/clip` as the true visual signal.  
**Date:** 2026-08-22  
**Contract question:** *Can Dripn recognise the same physical garment across different photographs?*  
**Evidence classes:** RUNTIME (live wardrobe pair replay) · DETERMINISTIC (synthetic Hamming band) · CODE-TRACED (matcher + embedding pipeline)

Related: `DUPLICATE_MATCHER_AUDIT.md` (Scenario G false positives), `GARMENT_CLIP_BENCHMARK.md` (bands from fixtures).

---

## Verdict

The current visual identity mechanism is **not robust enough for wardrobe deduplication**.

| Failure | Mechanism | Proven |
|---------|-----------|--------|
| **False positive** | dHash on rembg cutouts **or** `text-embedding-3-small` of meta+8×8 grid treated as `imageSimilarity` → `similar_item` across **different** garments in the same macro family | **RUNTIME** (live blazers + red vs turquoise UA) |
| **False negative** | Re-photo Hamming outside warn band (`imageSim < 0.82`) + `allowAttributeOnly: false` → `distinct_image` / `no_match` even with brand + near name | **DETERMINISTIC** (Hamming 20 replay against live UA turquoise phash) |

**Do not** raise name matching or move `0.82`. That trades one class of error for the other. **Do not** make CLIP a single magic hard-duplicate score.

Under Armour remains the decisive product counter-example to “meter exhaustion / weak labels caused it”: architecture requires perceptual band fire; name/brand alone cannot.

---

## Canonical garment identity contract (SIGNED)

> Dedupe must answer: **“Is this probably the same physical wardrobe item?”** It must not equate semantic similarity with physical identity.

### Signals

```text
TRUE VISUAL SIGNAL     Replicate openai/clip image embedding (768-d)
STRUCTURAL SIGNALS     subcategory / type, brand, colour family, material, pattern, distinctive details
NEAR-IMAGE SIGNAL      dHash (near-identical photo/crop only)
SUPPORT ONLY           semanticAppearanceEmbedding (ex-imageEmbedding text embed — never primary)
```

### Decision hierarchy

| Decision | Rule | UX |
|----------|------|-----|
| **Hard duplicate** | Very strong CLIP **+** structurally compatible **+** no major contradictory evidence — **never CLIP alone** | Sheet; user decides (Skip / Add anyway) |
| **Possible duplicate** | Strong combined CLIP + structure/brand/colour | Visual comparison sheet |
| **Similar but different** | Style/category resemblance without physical-item identity | **Do not interrupt** |
| **Identity evidence unavailable** | Existing item lacks usable visual fingerprint | Do **not** silently assume distinct |
| **Name alone** | Never sufficient | Never block |

### Structural incompatibility veto

A T-shirt and button-up must not become duplicate/similar merely because framing, colour, or semantic embedding is close.

### Metering

Internal action `wardrobe_embed` for COGS/observability only. **Do not** deduct a separate user credit — fold CLIP COGS into paid `wardrobe_analyze`.

### Storage / versioning

```text
visualEmbedding, visualEmbeddingModel="openai/clip", visualEmbeddingVersion=1, visualEmbeddingCreatedAt
semanticAppearanceEmbedding   ← renamed from imageEmbedding
dHash / imagePhash
garmentIdentityVersion=1
visualIdentityStatus = ready | missing | stale_model
```

Items without CLIP: `visualIdentityStatus = missing` — not treated as proven distinct. Lazy backfill; no giant migration required for launch. Multi-view fingerprints deferred.

---

## Runtime inventory (staff wardrobe user_id=68)

Queried production `wardrobe_items` 2026-08-22. No emails.

| Fixture (user report) | In DB now | Notes |
|-----------------------|-----------|-------|
| Under Armour turquoise tee | **1** (`id=110`) | phash + embedding present; color=`other`; brand null; subcategory null |
| UA “heather blue performance” re-upload | **0** | Not persisted under that name globally |
| Next blazer ×4 | **1** Next Black Blazer (`id=107`) | Four blazers total are **four different** garments (Next + 3 others) |
| Hunter boots ×3 | **0** | No Hunter-branded / yellow wellington rows |

**Implication:** Duplicate *copies* from the reported silent-save sessions are **not still in DB** (deleted, never saved under those labels, or different account). False-negative proof for the exact UA pair therefore uses **architecture + deterministic replay** against the live turquoise fingerprint. False-positive proof uses **live pairs that still exist**.

---

## Trace format (filled)

### A. RUNTIME — different garments flagged similar (false positives)

#### A1. Red UA athletic tee × Turquoise UA tee (same brand, different physical items)

```text
NEW ITEM                          Under Armour Turquoise T-Shirt
stored item ID                    71
stored item name                  Red Under Armour Short-sleeve Athletic T-Shirt
new image dHash                   21346040505021b0
existing image dHash              00bcf2f0f2f2f686
Hamming distance                  26
image similarity (dHash only)     0.46
embedding available?              Y
embedding similarity              0.9047
new subcategory                   null
existing subcategory              null
new brand                         null
existing brand                    Under Armour
new colour                        other
existing colour                   red
new material                      null
existing material                 null
normalized garment identity       family top=top (compatible); structure unknown
tier                              similar_item
reason                            visual_metadata_conflict
```

**Reading:** dHash correctly weak. Combined `imageSimilarity` is **embedding-driven**. Current “embedding” is **`text-embedding-3-small` of `wardrobe garment fingerprint: <meta> | <8×8 RGB grid>`** — not a vision embedding. Shared brand/category/name tokens dominate → **false similar**.

#### A2. Cavani gray windowpane × Light blue seersucker (different garments)

```text
NEW ITEM                          Cavani Gray Windowpane Check Blazer
stored item ID                    49
Hamming distance                  11
image similarity (dHash)          0.895
embedding similarity              0.8375
tier                              similar_item
reason                            visual_metadata_conflict
```

**Reading:** rembg / framing makes unrelated blazers **dHash-probable**. Macro family `outerwear` is enough. Subcategory null → no structural veto. Classic Scenario G class on outerwear.

#### A3. Cavani navy check × Cavani gray windowpane

```text
Hamming distance                  22
image similarity (dHash)          0.58
embedding similarity              0.9335
tier                              similar_item
reason                            visual_metadata_conflict
```

**Reading:** dHash weak; **text embedding** of similar meta (`outerwear | cavani | … blazer`) rescues into probable band → false similar across two owned Cavani blazers.

#### A4. “other tops” × UA turquoise

```text
Hamming distance                  30
image similarity (dHash)          0.38
embedding similarity              0.8893
tier                              similar_item
reason                            visual_probable
```

**Reading:** Again embedding-driven. If “other tops” is a meter-starved Nike teal, this is a **false similar to UA**. If it were the same UA garment with a broken label, this would be accidental help from a broken signal — not a trustworthy identity system.

---

### B. DETERMINISTIC — same-garment re-photo miss (false negative)

Live turquoise phash `21346040505021b0` as existing. Synthetic candidate:

> under armour heather blue performance t-shirt · tops · t-shirt · blue · Under Armour  
> dHash = same hex with Hamming **20** · **no embedding**

```text
NEW ITEM                          under armour heather blue performance t-shirt
stored item ID                    110 (live turquoise)
new image dHash                   (hamming-20 neighbor)
existing image dHash              21346040505021b0
Hamming distance                  20
image similarity                  0.66
embedding available?              N
embedding similarity              —
new subcategory                   t-shirt
existing subcategory              null
new brand                         Under Armour
existing brand                    null
new colour                        blue
existing colour                   other
tier                              ok
reason                            distinct_image
```

**Name + brand only** (no visual): `tier=ok`, `reason=no_match`, `attrScore≈0.52` — correct under `neverMergeOnNameOnly`, useless for re-upload protection.

**Why this matches the product report:** Re-photography commonly lands Hamming **>16** (outside probable band). Bulk `check-duplicates` also **caps** hash backfill (`i < 4`) and embeddings (`i < 3`). Without `imageSim ≥ 0.82`, the matcher **must** allow save.

---

## CODE-TRACED architecture (why both failures share one root)

| Layer | Behaviour |
|-------|-----------|
| Hard / warn gate | `imageSimilarity ≥ 0.82` from `max(dHashSim, embeddingCosine)` |
| dHash | Good for near-identical bytes/crops; brittle across distance/crop/lighting/orientation |
| “imageEmbedding” | **Not vision** — OpenAI **text** embedding of meta string + coarse 8×8 colour grid (`computeImageEmbedding` / `buildVisualDescriptor`) |
| Structure | Macro **family** only; subcategory often **null** and omitted from Bulk payload → **no veto** |
| Name | Explicitly cannot merge (`neverMergeOnNameOnly`, `allowAttributeOnly` false on wardrobe path) |
| Missing fingerprint | Treated as weak/no visual → path toward `ok`, **not** `identity_evidence_unavailable` |

So:

- Coarse dHash + family → **FP** (Nike tee vs button-up; Cavani vs seersucker)
- Text-of-meta embedding + family → **FP** (red UA vs turquoise UA; two Cavani blazers)
- Weak dHash on re-photo + no / weak text-embedding → **FN** (silent second save)

Raising name weight or lowering `0.82` cannot fix both.

---

## Worked target examples (contract illustration)

### Should open comparison sheet

```text
NEW: Under Armour turquoise performance crew-neck T-shirt
OLD: Under Armour blue performance T-shirt

dHash similarity           0.71   weak
visual embedding           0.94   very strong   ← true vision embedding
brand                      exact
subcategory                exact (t-shirt)
colour family              compatible (blue/turquoise)
garment structure          exact
→ possible_duplicate / hard if embedding+structure thresholds met
```

### Should not interrupt

```text
NEW: blue Nike T-shirt
OLD: light-blue button-up shirt

dHash similarity           0.88
visual embedding           0.70
subcategory                incompatible
structure                  incompatible
→ ok (similar-but-clearly-different)
```

---

## Regression fixtures (parked until implementation)

| ID | Pair | Human | Current behaviour |
|----|------|-------|-------------------|
| SG1 | UA turquoise re-photo (2nd photo) | Sheet / hard | Often `ok` / `distinct_image` if Hamming high |
| SG2 | Next black blazer re-photo ×N | Sheet / hard | Name alone insufficient; need vision identity |
| SG3 | Hunter yellow boots re-photo ×N | Sheet / hard | Same |
| SG4 | Red UA × Turquoise UA | **No interrupt** | RUNTIME `similar_item` today (embedding FP) |
| SG5 | Cavani gray × Seersucker blue | **No interrupt** | RUNTIME `similar_item` (dHash FP) |
| SG6 | Nike tee × button-up | **No interrupt** | Scenario G (`DUPLICATE_MATCHER_AUDIT.md`) |
| SG7 | Existing item, no phash / no emb | Must surface `identity_evidence_unavailable` | Silent `ok` today |

Re-capture SG1–SG3 on device (or restore deleted copies) before claiming RUNTIME PASS on false-negatives. SG4–SG6 already RUNTIME.

---

## Sequencing (no code until contract signed)

1. Sign **garment-identity multi-signal contract** above (this doc).
2. Replace text-meta “imageEmbedding” with a **true visual embedding** (or stop calling it image identity).
3. Add **structural compatibility** gate (subcategory / type) before similar/hard promotion; pass subcategory from Bulk/Quick Add.
4. Persist **multi-view fingerprints**; expose `identity_evidence_unavailable`.
5. Freeze thresholds: do **not** move `0.82` / name Jaccard as the fix.
6. Machine suite: SG1–SG7 + existing D1–D25 / R1–R6.

**Launch impact:** Duplicate pollution undermines Ivy variety, outfit generation, packing, recommendations, and wardrobe counts — not cosmetic.

---

## Temp audit scripts (server repo; delete when done)

- `Dripn-Server/scripts/_tmp_same_garment_rephoto_audit.mjs`
- `Dripn-Server/scripts/_tmp_fixture_hunt.mjs`
- `Dripn-Server/scripts/_tmp_fixture_inventory.mjs`
- `Dripn-Server/scripts/_tmp_hunter_hunt.mjs`

# Garment CLIP benchmark

**Date:** 2026-08-22  
**Model:** Replicate `openai/clip` (768-d)  
**Staff wardrobe:** user_id=68  
**Script:** `Dripn-Server/scripts/benchmark-garment-clip.mjs`

## Measured pairs

| Pair | Human truth | CLIP cosine | dHash sim | Hamming | Brand | Colour | Subcat |
|------|-------------|-------------|-----------|---------|-------|--------|--------|
| Exact same UA turquoise (self) | same exact image | **1.000** | 1.00 | 0 | — | — | — |
| Red UA × Turquoise UA | different | **0.853** | 0.46 | 26 | — | conflict | null |
| Cavani gray × Cavani navy | different | **0.920** | 0.58 | 22 | match | conflict | null |
| Cavani gray × Seersucker blue | different | **0.879** | 0.895 | 11 | — | conflict | null |
| Next black × Cavani gray | different | **0.876** | 0.70 | 19 | — | conflict | null |
| other tops × UA turquoise | different/unknown | **0.862** | 0.38 | 30 | — | other/other | null |

Same-item re-photos (UA heather blue, Next×N, Hunter×N) were **not in DB** — bands below are provisional from FP separation + exact-image ceiling; staff must re-capture SG same-item pairs to validate FN rescue.

## Bands derived from data (not guessed in isolation)

| Constant | Value | Rationale |
|----------|-------|-----------|
| `CLIP_HARD` | **0.97** | Above cross-colour Cavani (0.920). Exact same image ≈ 1.0. Hard still requires structure + no major contradiction. |
| `CLIP_POSSIBLE` | **0.90** | Cavani gray×navy (0.920) → comparison sheet (ambiguous same-brand blazers). Red UA×turquoise (0.853) stays **below** → no interrupt. Next×Cavani / seersucker / other_tops stay below. |
| dHash role | Near-identical only (Hamming ≤ `DHASH_NEAR_DUP`) | Cavani×seersucker dHash 0.895 must **not** alone open a sheet. |

## Rules locked from benchmark

1. **Never CLIP alone for hard duplicate** — Cavani same-brand different colour hits ~0.92.
2. **Hard** = (`CLIP ≥ 0.97` **or** near-identical dHash) **and** structurally compatible **and** no major colour/material contradiction.
3. **Possible** = `CLIP ≥ 0.90` **and** structurally compatible → sheet (user decides).
4. **dHash probable band without CLIP ≥ possible** → do not interrupt.
5. Semantic text embedding → support only; never drives `imageSimilarity` max.

## Pending staff fixtures

- Same UA tee, different photo  
- Same Next blazer re-photo  
- Same Hunter boots re-photo  

Re-run `node scripts/benchmark-garment-clip.mjs` after those exist; adjust bands only with new evidence.

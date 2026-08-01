# Sloane Street style dataset

42 shop-window photos from Sloane Street (July 2026), structured for Dripn scoring and luxury-brand learning.

## Layout

```
data/sloane_street_dataset/
  images/001.jpg … 042.jpg
  dataset.json          # per-outfit labels (+ brand, price_tier, style_tags)
  signals.json          # aggregated boosts + luxury patterns (generated)
  CLEANING.md           # human clean checklist
```

## Rebuild signals

```bash
npm run build:sloane-signals
```

This enriches brands from notes, then mines colour / pairing / footwear / luxury patterns into `signals.json`.

## Auto-analysis pipeline

`utils/outfitAutoAnalysisPipeline.ts` — self-correcting path:

detect → vote → geometry guardrails → structure → confidence → auto-repair → validated JSON

```bash
npm run verify:auto-pipeline
```

Does not replace human labels yet; it validates / repairs structured candidates (YOLO + vision + heuristics) so boots never become dresses.

## How scoring uses this

1. `utils/sloaneStreetSignals.ts` — colour / pairing / footwear soft boosts (≤ +12)
2. `utils/luxuryBrandSignals.ts` — quiet-luxury palettes, brand pairings, footwear rules, optional `brandInspiration` (≤ +8)
3. Combined soft layer clamped −6…+15 inside `outfitAllocationScore`

Hard clash / dress-code rules still win.

## Luxury brand fields

Each row may include:

- `brand` — e.g. `loro_piana`, `varley`, `sandro`
- `price_tier` — `ultra_luxury` | `luxury` | `contemporary_luxury` | `premium`
- `style_tags` — e.g. `quiet luxury`, `tailored`, `smart casual`

## Cleaning notes

- `sloane_021` — MOSCOT eyewear → `valid: false`
- `sloane_032` — BRORA sale rail → `valid: false`
- Multi-mannequin windows label one primary figure
- Footwear often cropped → `null` is expected

Re-label in `dataset.json`, then re-run `npm run build:sloane-signals`.

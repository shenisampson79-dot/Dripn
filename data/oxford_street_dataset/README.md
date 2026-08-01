# Oxford Street style dataset

423 shop-window photos from Oxford Street (July 2026), structured like Sloane / Croydon / Brixton for Dripn scoring and YOLO fine-tune.

## Layout

```
data/oxford_street_dataset/
  images/001.jpg … 423.jpg
  dataset.json          # per-outfit rows (oxford_001–423)
  clean_queue.json      # pending human / vision labels
  signals.json          # generated after labels exist
  README.md
```

## Status

Rows ship as **pending labels**:
- `rules.valid: false` → excluded from soft-scoring signals until labeled
- `use_for_detection: true` → included in YOLO shop-window scaffold (weak boxes)

## Rebuild signals (after labeling)

```bash
npm run build:shop-window-signals
npm run prepare:yolo-shop-windows
```

## Re-ingest / re-convert HEICs

```bash
node scripts/ingest-oxford-street.mjs
```

Existing JPGs are skipped if already present.

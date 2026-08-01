# Oxford Street labeling strategy

## Architecture (correct as built)

| Pipeline | Role | Status |
|----------|------|--------|
| YOLO / detection | Find garments, boxes | 423 images in scaffold |
| Semantic `dataset.json` | Style, colour, score signals | **Gold set first** |

Do **not** auto-label all 423 blindly.

## Step 1 — Gold set (done)

- 60 diverse images (`gold_set_ids.json`)
- Labeled via vision batches → `gold_labels.json`
- Applied with `node scripts/apply-oxford-labels.mjs`
- Result: **59 valid** + **1 discarded** (`oxford_423` magazine, not a window)
- Protected: `label_status: "gold"` is never overwritten by apply script

## Step 2 — Auto-expand (next)

```text
Use gold labels as reference.
Auto-label remaining images in batches of 40.
Only set valid: true if confidence > 0.75.
Otherwise leave pending / push to clean_queue.low_confidence.
Do not overwrite gold rows.
```

## Step 3 — Human confirm UI

Fast tap UI: `labeler.html`

```bash
npx --yes serve data/oxford_street_dataset -p 4173
# open http://localhost:4173/labeler.html
# load dataset.json → Accept / Skip / Discard → Download labels.json
node scripts/apply-oxford-labels.mjs path/to/oxford_label_edits.json
npm run build:shop-window-signals
```

Shortcuts: ←/→ · Space accept · S skip · D discard · C copy last · 1–4 style

## Rebuild

```bash
npm run build:shop-window-signals
npm run prepare:yolo-shop-windows
```

# Croydon mall style dataset

22 shop-window photos from a Croydon shopping mall — mainly **Next** high-street casual plus **athleisure** (Foot Locker, JD Sports, Adidas).

## Layout

```
data/croydon_mall_dataset/
  images/001.jpg … 022.jpg
  dataset.json          # per-outfit labels (croydon_001–022)
  signals.json          # aggregated boosts (generated)
  README.md
```

## Rebuild signals

```bash
npm run build:shop-window-signals
```

Re-label in `dataset.json`, then re-run the command above to refresh `signals.json`.

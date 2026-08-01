# Brixton High Street shop-window dataset

Casual / athleisure lane photos from Brixton (JD Sports, H&M, Morleys and nearby high-street windows).

## Contents

- `images/` — WhatsApp JPEGs + fitting-room try-ons renamed `001.jpg` … `029.jpg`
- `source_map.json` — id → original filename
- `dataset.json` — outfit labels + validity
- `signals.json` — mined soft signals (rebuild via `npm run build:shop-window-signals`)

## Validity (two tracks)

| Track | Count | IDs / notes |
|-------|------:|-------------|
| Soft casual scoring | 26 | Valid shop windows + fitting-room try-ons |
| YOLO / detection | 29 | All images — editorial/advert kept via `use_for_detection` |

Soft-scoring exclusions (still used for detection):

- `009` — sloggi lightbox advert (`advert_not_outfit`, `use_for_detection`)
- `018` — London Standard French brands editorial (`editorial_not_outfit`, `use_for_detection`)
- `025` — London Standard Ysé coastal + bags (`editorial_not_outfit`, `use_for_detection`)

Fitting-room try-ons (valid soft + detection): `026`–`029` (cream suit, navy zip polo, black gilet, olive co-ord).
## How it feeds the app

- **Scoring:** Brixton valid windows → **casual lane only** (with Croydon). Never luxury.
- **Detection:** Editorial/advert frames feed `npm run prepare:yolo-shop-windows` for Clothing / Shoes / Bags recall — that was the reason to collect them.

Rebuild:

```bash
npm run build:shop-window-signals
npm run prepare:yolo-shop-windows
```

Casual lane output: `data/shop_window_corpus/signals.casual.json`

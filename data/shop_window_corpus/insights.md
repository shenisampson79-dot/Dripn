# Shop-window corpus insights

Generated: 2026-08-01T22:16:14.244Z

## Corpus
- Sloane Street: 42 rows (38 valid)
- Croydon mall: 22 rows (20 valid)
- Brixton High Street: 29 rows (25 valid)
- Oxford Street: 423 rows (59 valid)
- Combined valid: 142

## Dual-style lanes (preferred for scoring)
- Luxury lane: `sloane_street_dataset/signals.luxury.json`
- Casual lane: `shop_window_corpus/signals.casual.json` (Croydon + Brixton + Oxford)
- Context weights: `shop_window_corpus/dual_style_weights.json`

**Do not** flatten both lanes into one unconditional boost (sneakers common ≠ boost sneakers for work).

## Luxury-only patterns
Sloane Street (luxury lane): 38/42 valid wearable looks. Top colour combos: beige+cream (7), beige+white (7), beige+brown (5), brown+cream (5), beige+blue (4). Top garment pairings: shirt×trousers (6), other×trousers (5), polo×shorts (3), blouse×skirt (2), knit×trousers (2). Footwear leaders: sneakers×5, loafers×3, sandals×3, mules×2, espadrilles×1. Sloane leans luxury neutrals + loafers; Croydon adds high-street casual + sneakers/athleisure.

## Croydon-only patterns
Croydon mall: 20/22 valid wearable looks. Top colour combos: beige+white (8), grey+white (6), blue+white (5), beige+grey (4), black+white (4). Top garment pairings: shirt×trousers (5), t-shirt×shorts (5), shirt×shorts (3), polo×trousers (2), knit×jeans (1). Footwear leaders: sneakers×9, mules×2, sandals×2, heels×1, loafers×1. Sloane leans luxury neutrals + loafers; Croydon adds high-street casual + sneakers/athleisure.

## Brixton-only patterns
Brixton High Street (JD / H&M / Morleys): 25/29 valid wearable looks. Top colour combos: beige+white (9), black+white (7), beige+black (4), blue+white (4), grey+white (4). Top garment pairings: t-shirt×shorts (5), t-shirt×trousers (4), blouse×trousers (3), shirt×trousers (2), bikini_top×shorts (1). Footwear leaders: sneakers×9, loafers×3, heels×2, flats×1, sandals×1. Sloane leans luxury neutrals + loafers; Croydon adds high-street casual + sneakers/athleisure.

## Oxford Street patterns
Oxford Street: 59/423 valid wearable looks. Top colour combos: black+white (24), blue+white (15), beige+white (11), grey+white (10), navy+white (9). Top garment pairings: shirt×trousers (8), t-shirt×shorts (8), polo×trousers (5), t-shirt×skirt (3), blouse×trousers (2). Footwear leaders: sneakers×14, sandals×9, loafers×8, flats×3, athletic×1. Sloane leans luxury neutrals + loafers; Croydon adds high-street casual + sneakers/athleisure.

## Casual lane (Croydon + Brixton + Oxford)
Casual lane (Croydon + Brixton + Oxford): 104/474 valid wearable looks. Top colour combos: black+white (35), beige+white (28), blue+white (24), grey+white (20), beige+black (14). Top garment pairings: t-shirt×shorts (18), shirt×trousers (15), polo×trousers (8), blouse×trousers (5), shirt×shorts (5). Footwear leaders: sneakers×32, loafers×12, sandals×12, flats×4, heels×3. Sloane leans luxury neutrals + loafers; Croydon adds high-street casual + sneakers/athleisure.

## Combined patterns (insights only)
Shop-window corpus (Sloane + Croydon + Brixton + Oxford): 142/516 valid wearable looks. Top colour combos: black+white (36), beige+white (35), blue+white (26), grey+white (22), beige+black (17). Top garment pairings: shirt×trousers (21), t-shirt×shorts (19), polo×trousers (9), other×trousers (7), shirt×shorts (7). Footwear leaders: sneakers×37, loafers×15, sandals×15, flats×5, mules×4. Sloane leans luxury neutrals + loafers; Croydon adds high-street casual + sneakers/athleisure.

## How this feeds the app
Soft boosts only via `utils/dualStyleSignals.ts` (colour / pairing / footwear × context weights).
Hard clash + dress-code rules still win.
Rebuild: `npm run build:shop-window-signals`

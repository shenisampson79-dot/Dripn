# Shop-window corpus insights

Generated: 2026-07-31T15:49:55.513Z

## Corpus
- Sloane Street: 42 rows (40 valid)
- Croydon mall: 22 rows (22 valid)
- Brixton High Street: 29 rows (26 valid)
- Oxford Street: 423 rows (59 valid)
- Combined valid: 147

## Dual-style lanes (preferred for scoring)
- Luxury lane: `sloane_street_dataset/signals.luxury.json`
- Casual lane: `shop_window_corpus/signals.casual.json` (Croydon + Brixton + Oxford)
- Context weights: `shop_window_corpus/dual_style_weights.json`

**Do not** flatten both lanes into one unconditional boost (sneakers common ≠ boost sneakers for work).

## Luxury-only patterns
Sloane Street (luxury lane): 40/42 valid wearable looks. Top colour combos: beige+cream (8), beige+white (7), beige+brown (5), brown+cream (5), beige+blue (4). Top garment pairings: shirt×trousers (6), other×trousers (5), polo×shorts (3), knit×trousers (2), shirt×shorts (2). Footwear leaders: sneakers×5, loafers×3, sandals×3, mules×2, espadrilles×1. Sloane leans luxury neutrals + loafers; Croydon adds high-street casual + sneakers/athleisure.

## Croydon-only patterns
Croydon mall: 22/22 valid wearable looks. Top colour combos: beige+white (6), black+white (5), blue+white (5), beige+black (3), beige+blue (3). Top garment pairings: shirt×trousers (6), t-shirt×shorts (5), shirt×shorts (3), polo×trousers (2), shirt×jeans (2). Footwear leaders: sneakers×11, sandals×3, mules×2, heels×1, oxfords×1. Sloane leans luxury neutrals + loafers; Croydon adds high-street casual + sneakers/athleisure.

## Brixton-only patterns
Brixton High Street (JD / H&M / Morleys): 26/29 valid wearable looks. Top colour combos: beige+white (9), black+white (7), beige+black (4), beige+cream (4), blue+white (4). Top garment pairings: t-shirt×shorts (5), t-shirt×trousers (5), blouse×trousers (3), shirt×shorts (2), shirt×trousers (2). Footwear leaders: sneakers×9, loafers×4, heels×2, flats×1, sandals×1. Sloane leans luxury neutrals + loafers; Croydon adds high-street casual + sneakers/athleisure.

## Oxford Street patterns
Oxford Street: 59/423 valid wearable looks. Top colour combos: black+white (24), blue+white (15), beige+white (11), grey+white (10), navy+white (9). Top garment pairings: shirt×trousers (8), t-shirt×shorts (8), polo×trousers (5), t-shirt×skirt (3), blouse×trousers (2). Footwear leaders: sneakers×14, sandals×9, loafers×8, flats×3, athletic×1. Sloane leans luxury neutrals + loafers; Croydon adds high-street casual + sneakers/athleisure.

## Casual lane (Croydon + Brixton + Oxford)
Casual lane (Croydon + Brixton + Oxford): 107/474 valid wearable looks. Top colour combos: black+white (36), beige+white (26), blue+white (24), grey+white (17), beige+black (14). Top garment pairings: t-shirt×shorts (18), shirt×trousers (16), polo×trousers (8), shirt×shorts (6), t-shirt×trousers (6). Footwear leaders: sneakers×34, sandals×13, loafers×12, flats×4, heels×3. Sloane leans luxury neutrals + loafers; Croydon adds high-street casual + sneakers/athleisure.

## Combined patterns (insights only)
Shop-window corpus (Sloane + Croydon + Brixton + Oxford): 147/516 valid wearable looks. Top colour combos: black+white (37), beige+white (33), blue+white (27), grey+white (19), beige+black (17). Top garment pairings: shirt×trousers (22), t-shirt×shorts (19), polo×trousers (9), shirt×shorts (8), other×trousers (7). Footwear leaders: sneakers×39, sandals×16, loafers×15, flats×5, mules×4. Sloane leans luxury neutrals + loafers; Croydon adds high-street casual + sneakers/athleisure.

## How this feeds the app
Soft boosts only via `utils/dualStyleSignals.ts` (colour / pairing / footwear × context weights).
Hard clash + dress-code rules still win.
Rebuild: `npm run build:shop-window-signals`

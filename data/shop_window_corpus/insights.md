# Shop-window corpus insights

Generated: 2026-08-03T09:22:09.907Z

## Corpus
- Sloane Street: 42 rows (38 valid)
- Croydon mall: 22 rows (20 valid)
- Brixton High Street: 29 rows (25 valid)
- Oxford Street: 423 rows (349 valid)
- Combined valid: 432

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
Oxford Street: 349/423 valid wearable looks. Top colour combos: black+white (90), beige+white (59), blue+white (57), beige+black (46), brown+white (46). Top garment pairings: t-shirt×shorts (54), t-shirt×trousers (33), shirt×trousers (32), polo×trousers (15), top×trousers (14). Footwear leaders: sneakers×69, sandals×40, loafers×39, flats×17, heels×11. Sloane leans luxury neutrals + loafers; Croydon adds high-street casual + sneakers/athleisure.

## Casual lane (Croydon + Brixton + Oxford)
Casual lane (Croydon + Brixton + Oxford): 394/474 valid wearable looks. Top colour combos: black+white (101), beige+white (76), blue+white (66), beige+black (53), brown+white (51). Top garment pairings: t-shirt×shorts (64), shirt×trousers (39), t-shirt×trousers (38), polo×trousers (18), top×trousers (14). Footwear leaders: sneakers×87, loafers×43, sandals×43, flats×18, heels×14. Sloane leans luxury neutrals + loafers; Croydon adds high-street casual + sneakers/athleisure.

## Combined patterns (insights only)
Shop-window corpus (Sloane + Croydon + Brixton + Oxford): 432/516 valid wearable looks. Top colour combos: black+white (102), beige+white (83), blue+white (68), beige+black (56), brown+white (55). Top garment pairings: t-shirt×shorts (65), shirt×trousers (45), t-shirt×trousers (38), polo×trousers (19), shirt×shorts (14). Footwear leaders: sneakers×92, loafers×46, sandals×46, flats×19, heels×14. Sloane leans luxury neutrals + loafers; Croydon adds high-street casual + sneakers/athleisure.

## How this feeds the app
Soft boosts only via `utils/dualStyleSignals.ts` (colour / pairing / footwear × context weights).
Hard clash + dress-code rules still win.
Rebuild: `npm run build:shop-window-signals`

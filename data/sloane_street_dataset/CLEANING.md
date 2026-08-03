# Sloane Street — human clean pass

Edit: `data/sloane_street_dataset/dataset.json`  
Images: `data/sloane_street_dataset/images/NNN.jpg`  
When done: tell me and run `npm run build:sloane-signals` (or I’ll rebuild + implement the auto pipeline).

## Priority order

### Must fix / decide (5) — done 2026-07-30
| ID | Status |
|----|--------|
| `sloane_021` | `valid: false` — MOSCOT eyewear only |
| `sloane_032` | `valid: false` — BRORA sale rail, no mannequin |
| `sloane_013` | Middle mannequin: women's terracotta waistcoat + trousers |
| `sloane_014` | Varley right mannequin: navy sleeveless knit, cream shoulder jumper, navy trousers |
| `sloane_031` | Women's black suit; footwear stays `null` |

### Footwear (torso mannequins / pedestals)
Shop windows often place shoes on the **stand base or a pedestal** next to a torso-only mannequin.  
**Those shoes are part of the outfit** — label them under `footwear`.

Only leave `footwear: null` when:
- no shoes are styled with this look, or
- shoes belong to a neighbour mannequin / separate product display

IDs previously marked “cropped / null OK” — re-check for pedestal shoes before leaving null:  
`001, 005–010, 012, 022–024, 036–038, 040–041`

### Normalize categories while you edit
**top.category:** `shirt | blouse | sweater | polo | t-shirt | knit | dress | other`  
**bottom.category:** `trousers | jeans | skirt | shorts` or `null`  
**footwear.subcategory:** `loafers | oxfords | derby | chelsea_boots | heels | sandals | sneakers | boots | mules | flats | espadrilles | mary_janes`  
**style.primary:** `smart_casual | business_casual | business_formal | evening | casual | resort`

### Set flags
```json
"rules": { "valid": true, "violations": [] }
"confidence": 0.85
```
Use `valid: false` for non-outfits (eyewear, empty rails, product-only).

## After you finish
1. Save `dataset.json`
2. Message me “clean pass done”
3. Done — pipeline + luxury brand layer shipped:
   - `utils/outfitAutoAnalysisPipeline.ts`
   - `utils/luxuryBrandSignals.ts`
   - `npm run build:sloane-signals` (enrich brands + mine patterns)

## Tip
Open image + JSON side by side. Fix one ID at a time. Include pedestal/stand footwear when it belongs to the look.

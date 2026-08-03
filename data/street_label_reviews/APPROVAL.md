# Street label review — Sloane · Croydon · Brixton · **Oxford Street**

Visual review of shop-window labels against photos.

## Labeling policy (updated 2026-08-03)

**Pedestal / stand footwear counts as outfit footwear.**

High-street windows often put a look on a torso-only mannequin and place the shoes on the stand base or a pedestal beside it. That is how shops present a complete outfit.

| Include | Exclude |
|--------|---------|
| Shoes on **this** mannequin’s stand base | Neighbour mannequin’s shoes |
| Shoes on a pedestal clearly styled with this look | Loose product piles / mixed shoe walls |
| Sandals, loafers, sneakers, boots under the hem pole | Truly bare / no shoes in frame |

Do **not** null footwear just because it isn’t on feet.

Oxford auto-pass (2026-08-03): **93** rows got pedestal footwear filled from notes; **21** left as Your call (ambiguous colour/type). Report: `pedestal_footwear_report.json`.

| Street | Total | OK | Must fix | Your call | Status |
|--------|------:|---:|---------:|----------:|--------|
| Croydon | 22 | 5 | 12 | 5 | Applied |
| Brixton | 29 | 20 | 4 | 5 | Applied |
| Sloane | 42 | — | — | — | Applied + pedestal policy |
| **Oxford (all)** | **423** | **304** | **79** | **40** | Pedestal footwear pass merged |

**Reviewer:**  
http://localhost:5177/street_label_reviews/reviewer.html  

```bash
npx --yes serve "C:\Users\sheni\Downloads\dripn\StyleWise\data" -l 5177
```

Oxford machine JSON: `oxford_review.json` (chunks **01–08**).

---

## OXFORD — YOUR CALL (pedestal footwear still ambiguous)

Open these in the reviewer and pick the stand/pedestal shoes:

032, 039, 040, 062, 098, 165, 227, 234–236, 238, 240–241, 246, 267, 281–282, 295, 382, 385, 416

---

## OXFORD — MUST FIX (older gold list — still useful)

| ID | Issue | Proposed |
|----|--------|----------|
| **008** | Shoulder bag brown | → **black** |
| **022** | Missing cap | Add **white baseball_cap** |
| **037** | Missing navy layer | Add **navy overshirt** |
| **051** | Missing carried bag | Add **tan tote** |
| **080** | Check shirt under polo missing | Add **grey check shirt**; shoes → **derby** |
| **115** | Footwear flats | → **navy pumps** |
| **123** | Phantom camel vest; bag grey; jeans blue | **Drop vest**; bag → **black**; jeans → **denim** |
| **151** | Missing sneakers | Add **white sneakers** |
| **180** | Missing fishnets | Add **black fishnet tights** |
| **194** | Missing bag | Add **black quilted crossbody** |
| **216** | Burgundy tote wrong mannequin | **Drop tote** (centre lace blouse + shorts only) |
| **223** | Slip labelled midi | → **slip_maxi** |
| **323** | Shorts charcoal | → **brown** |
| **330** | Missing backpack | Add **cream backpack** |
| **337** | Missing bag | Add **tan Adidas quilted crossbody** |
| **344** | Missing backpack/harness | Add **black backpack** |
| **380** | Co-ord light_blue; sandals olive | Co-ord → **cream**; sandals → **white** |
| **387** | Boat shoes | → **pink loafers** |
| **394** | Missing vest + bag | Add **charcoal zip vest** + **black crossbody** |

~~Remove footwear~~ for pedestal cases (**015, 058, 073, 351, 402**) is **obsolete** — keep/include those shoes.

---

## OXFORD — YOUR CALL (older)

| ID | Question |
|----|----------|
| **173** | Digital-screen ad — keep or **discard**? |
| **187** | Skechers poster — **discard**? |
| **258** | Suit dusty **blue** vs labelled **navy**? |
| **273** | Kids mannequin — keep or **discard**? |
| **287** | Crossbody **white** vs cream; jeans → **denim**? |
| **294** | Beige tote unclear — keep or drop? |
| **316** | Add cream Nike base under black shorts? |
| **366** | Slingback **heels** vs flats; wide-leg vs straight? |

---

## Prior streets (already applied)

See below for Croydon / Brixton / Sloane history.

---

# Street label review — Sloane · Croydon · Brixton (archive)

Visual review of all **93** images against existing `dataset.json` rows.

**Status:** user decisions applied from `decisions.json` (2026-08-01) via `apply-decisions.mjs`.  
See `apply_report.json` for the patch list.

### Croydon
| ID | Issue | Proposed |
|----|--------|----------|
| **002** | Adult sneakers labelled white | `shoes.color` → **gray** (silver/metallic); tee taupe → **beige** |
| **003** | Notes say “center” mannequin | Primary = **right** mannequin (stripe shirt + denim shorts + clogs) |
| **004** | Polo labelled white | Polo colour → **green** (mint) |
| **005** | Straw hat + silver heels wrong for sage co-ord | Drop hat; shoes → **white** flats; keep sage **green** co-ord |
| **006** | Footwear sneakers | → **loafers** white |
| **008** | Labelled halter knit | Retarget **polka-dot sleeveless top** + **denim** jeans + cream bag |
| **009** | Trousers black | → **navy**; mint → **green** |
| **012** | Tee white; backpack maroon | Tee → **cream**; backpack → **red**; add red NY cap |
| **014** | Sunglasses silver; tan chinos | Sunglasses → **black**; chinos → **brown**; add black backpack |
| **017** | Jeans color blue | → **denim**; add sunglasses |
| **018** | Polo white / trousers olive | Polo → **cream**; trousers → **gray** |
| **019** | Missing Nike Pro layers | Add black **sports_bra** + black base shorts; sweat → **cream**; shoes → **gray** |

### Brixton
| ID | Issue | Proposed |
|----|--------|----------|
| **005** | Wrong primary (lime dress) | Primary = foreground **brown** draped mini + brown heels/fascinator |
| **010** | Co-ord beige | → **brown** top + bottom |
| **015** | Jacket/shorts grey | → **black**; add beige baseball cap |
| **021** | Shorts olive | → **beige** |

### Sloane
| ID | Issue | Proposed |
|----|--------|----------|
| **004** | ~~Remove footwear~~ | **KEEP** cream sandals — styled with the look on pedestal |
| **014** | Label is women’s Varley knit | **Photo is three mens mannequins** — re-label or re-shoot |
| **020** | Labelled as dress | → **two-piece** top + skirt (midriff cutout), multicolor |
| **026** | ~~Remove mules~~ | **KEEP** brown mules — styled with the white mini |

---

## YOUR CALL (uncertain — need your decision)

### Croydon
| ID | Question |
|----|----------|
| **007** | Same red shirt as 006 — sneakers here vs loafers on 006. Same visit? Pick one footwear for both. |
| **010** | Stripe shirt orange vs multicolor; sandals beige vs white |
| **011** | Top yellow-peach vs **orange** stripes |
| **021** | Shorts khaki → **green** or **beige**? |
| **022** | Trousers black vs **navy**; side-stripe visible? |

### Brixton
| ID | Question |
|----|----------|
| **002** | Add **swimwear** floral bikini under cover-up? |
| **016** | Colorblock **lavender/purple** vs dusty **blue**? |
| **027–029** | Fitting-room try-ons with red garment clutter — keep as valid outfit labels? |

### Sloane (real decisions only)
| ID | Question |
|----|----------|
| **001** | Coral tee → wardrobe **pink** or **orange**? (labelled coral) |
| **003** | Which of ~5 RIXO mannequins is gold primary? |
| **024** | Coral shorts → **pink** or **orange**? |
| **029** | Kids Liberty look — keep in adult wardrobe dataset? |
| **036** | Polo cream-stripe vs textured knit — OK as cream polo? |

**Sloane multi-mannequin but primary looks fine** (approve as OK unless you care):  
002, 005–013, 015–019, 023, 025, 027–028, 030–031, 034–035, 037–038, 040–042.

**Already correctly discarded (no change):**  
`sloane_021` MOSCOT · `sloane_032` BRORA rail · `brixton_009` Sloggi · `brixton_018` · `brixton_025`

---

## OK as-is (no action)

**Croydon:** 001, 013, 015, 016, 020 (+ 016 rust→orange mapping only)  
**Brixton:** 001, 003, 004, 006–008, 011–014, 017, 019–020, 022–024, 026  
**Sloane:** 018, 021, 022, 032, 033, 039 (+ discarded rows)

---

## Suggested reply template

```text
Approve all OK rows.

Croydon: apply all MUST FIX; for 007 use loafers; 010 sandals beige; 011 orange; 021 beige; 022 navy no side-stripe.
Brixton: apply all MUST FIX; 002 add bikini; 016 blue; keep 027–029 valid.
Sloane: keep pedestal footwear (004, 026); 001 pink; 003 keep current; 024 pink; 029 discard kids; 036 keep cream polo.
Approve remaining Sloane multi-mannequin as OK.
```

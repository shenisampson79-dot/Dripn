# Street label review — Sloane · Croydon · Brixton

Visual review of all **93** images against existing `dataset.json` rows.

**Status:** user decisions applied from `decisions.json` (2026-08-01) via `apply-decisions.mjs`.  
See `apply_report.json` for the patch list.

Reviewer: http://localhost:5177/street_label_reviews/reviewer.html  
Full machine JSON: `croydon_review.json`, `brixton_review.json`, `sloane_review.json`.

---

## Summary

| Street | Total | OK | Must fix | Your call |
|--------|------:|---:|---------:|----------:|
| Croydon | 22 | 5 | 12 | 5 |
| Brixton | 29 | 20 | 4 | 5 |
| Sloane | 42 | 33* | 4 | 5 |
| **Total** | **93** | **58** | **20** | **15** |

\*Sloane multi-mannequin windows where the current primary looks correct are counted as OK; only real decisions are in Your call.

---

## MUST FIX (please approve these)

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
| **004** | Sandals on label | **Remove footwear** — sandals on pedestal, not worn |
| **014** | Label is women’s Varley knit | **Photo is three mens mannequins** — re-label (e.g. navy polo + beige trousers) or re-shoot |
| **020** | Labelled as dress | → **two-piece** top + skirt (midriff cutout), multicolor |
| **026** | Mules on label | **Remove worn footwear** — clogs on pedestal |

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
Sloane: apply all MUST FIX; 001 pink; 003 keep current; 024 pink; 029 discard kids; 036 keep cream polo.
Approve remaining Sloane multi-mannequin as OK.
```

# Nice-dinner / elevated occasion compatibility contract

Canonical rule: **for elevated casual / nice dinner, prefer clean trousers/chinos/dark denim and refined footwear; shorts require strong warm-weather/context justification; chunky hiking/outdoor boots normally blocked.**

Apply as **occasion-aware candidate filtering before selection** — not prose patches, not cargo+boots one-off combo hacks as the main fix.

## Formality bands

| Band | Typical occasions |
|------|-------------------|
| `casual` | casual_day, weekend, travel (default) |
| `elevated_casual` | somewhere nice / elevated asks |
| `smart_casual` | smart_casual, pub+polish |
| `evening_out` | dinner, evening, party, cocktail |
| `date_night` | date_night, first_date |
| `work` | work_outfit, office, interview |
| `formal` | wedding, black_tie, formal_event |

Dinner / “somewhere nice” → **`evening_out`** (never soft-demote to `casual_day`).

## Filter rules (before beam / pick)

For elevated bands (`elevated_casual` … `formal`):

| Rule | Behaviour |
|------|-----------|
| Prefer bottoms | Clean trousers, chinos, dark denim stay in pool |
| Cargo shorts | **Blocked** |
| Cargo trousers | Blocked on evening_out / date_night |
| Chunky hiking / outdoor / combat boots | **Normally blocked** (band-level — not only when paired with cargo) |
| Athletic track / sports jackets | Blocked |
| Shorts | Only if tailored/linen **and** warm-weather (`temp ≥ 22°C`); never cargo |

Clash rules (`cargo_shorts_chunky_boots`, `chunky_boots_elevated_evening`, `cargo_shorts_dressy_evening`) remain as **safety nets** after filtering.

## Audit of c698feb dinner/cargo gates

| Gate | Keep? |
|------|--------|
| dinner → `evening_out` | **Keep** (occasion mapping) |
| No soft-retry dressy → `casual_day` | **Keep** (occasion band integrity) |
| Cargo shorts ban on smart/evening (ontology + editorial) | **Keep** as band filter |
| Cargo + chunky boots **only as combo** | **Replaced/ widened** → chunky outdoor boots blocked on elevated bands regardless of bottom |
| Client `passesEditorialOccasionGate` cargo / athletic jacket | **Keep** + formality-band helper |

## Code

| Layer | Module |
|--------|--------|
| Bands + bans | `services/occasionFormalityBands.js` / `utils/occasionFormalityBands.ts` |
| Pre-pick prune | `outfitMixConstraints` → `buildOccasionPools` |
| Ontology | `dressCodeOntology.validateOutfitAgainstDressCode` |
| Client gate | `fashionEditorialRubric.passesEditorialOccasionGate` |

## Retest prompts

1. `Create an outfit for tomorrow. It's casual, but I'm going somewhere nice for dinner.` → evening_out pool; no cargo shorts / chunky hiking boots crowned.  
2. Refine: `I don't like this — cargo shorts and chunky boots aren't appropriate for a nice dinner. Give me another option` → `refineCurrentLook` with locked dinner context, not cold chat.

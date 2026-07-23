# Outfit Intent

Dripn styles for **why** an outfit is worn — not only whether it is clash-valid.

Intent is a **soft scoring / voice layer**. It never invents garments and never overrides hard clash (`fatal` / `major`).

## Canonical catalog

| Source | Role |
|--------|------|
| **Dripn-Server** `data/garmentTaxonomy.json` → `outfitIntents` | Authority |
| **StyleWise** synced copy of the same JSON | Client Mix / allocator |
| `services/outfitIntent.js` / `utils/outfitIntent.ts` | `resolveOutfitIntent`, `intentScore` |

Sync with garment taxonomy:

```bash
npm run sync:garment-taxonomy
```

## Schema

```
OutfitIntent: name, label?, summaryTone?, formalityTarget?, structureBias?,
  effortLevel?, boldness?, colorRules?, silhouetteRules?,
  preferredSubtypes[], avoidedSubtypes[], rules?
```

| Field | Role |
|-------|------|
| `formalityTarget` | Soft distance penalty vs avg item formality (0–5) |
| `structureBias` | `relaxed` / `structured` / `balanced` / `any` |
| `colorRules.maxColors` / `preferMonochrome` | Soft palette pressure |
| `preferredSubtypes` / `avoidedSubtypes` | Soft subtype bias |
| `rules.requireAnchor` | Soft: footwear or structured piece |
| `rules.restrictLayers` | Soft layer-count pressure |

## Core intents

| Intent | Bias |
|--------|------|
| **effortless** | Low effort, relaxed, monochrome/few colours; linen / chinos / minimal_sneaker / sandals |
| **power** | High formality, structured; blazer / tailored_trousers / heels / oxfords; avoid slides / athletic_shorts |
| **date_night** | Formality ~4; slip_dress / heels / blouse / tailored; balanced |
| **editorial** | High boldness/effort; allow contrast & oversized; require anchor (soft) |
| **casual_day** | Everyday map from Mix / weekend occasions |
| **smart_casual** | Mid formality bridge (chinos, loafers, light blazer) |

## Resolution

`resolveOutfitIntent({ query?, occasion?, dressFor?, vibe?, intent?, source })`

Priority:

1. Explicit `intent`
2. Query keywords (`date`, `interview`, `effortless`, `power`, `editorial`, …)
3. Vibe / occasion aliases (`work_outfit` → power, `date_night` → date_night, …)
4. `dressFor` (`work` → power, `date` → date_night, `myself` → effortless)
5. Source defaults: Outfit Mix → `casual_day`; buy/sanity → `effortless`; else `effortless`

## Scoring

`intentScore(items, intent)` / `scoreOutfitIntentBias(items, options)`:

- preferredSubtypes +, avoidedSubtypes −
- formality distance penalty
- color maxColors / monochrome soft penalties
- structureBias vs relaxed / oversized silhouettes
- restrictLayers / requireAnchor (soft)

Wired into:

| Surface | Where |
|---------|-------|
| StyleWise Mix | `computeLocalOutfitScore` → soft Δ + `DetectedSignals.intent` |
| StyleWise voice | `stylistVoiceEngine` summary tone |
| Server allocator | `wardrobeAllocationEngine.scoreCombo` |
| Server unified | `computeUnifiedOutfitScore` |
| Decisions | `quickDecisionService` passes `query` / occasion |
| Chat / pipeline | `mapChatOccasionToEngine` + plan `constraints.outfitIntent` |
| Outfit Mix GPT | `outfitMixAnalysisService` receives intent name + biases (explain only) |

Hard clash remains authoritative via `isOutfitValid` / coherence hard caps.

## Stylist voice

- `DetectedSignals.intent` / `intentLabel` on Mix analysis metadata
- Summary framing: “This reads as power dressing…” / “Effortless casual…”
- GPT outfit-mix-analysis: intent block is **explain only** — no invented pieces

## Out of scope (next tier)

- Full body shape / skin tone matching
- Weather as a hard constraint (optional soft env hook only if temperature already in Today context)
- ML learning / OR-Tools MIP solver swap

## Tests

```bash
# Server
node scripts/test-outfit-intent.mjs
npm run test:garment-taxonomy

# StyleWise
npm run verify:outfit-intent
npm run verify:garment-taxonomy
```

Asserted: power prefers blazer+oxfords over slides; effortless prefers linen+minimal_sneaker; date_night prefers slip+heels; editorial does not hard-fail bold mixes that pass clash.

## Verify

1. Outfit Mix: pick Work → power framing; Date night → date_night; Casual → casual_day/effortless.
2. Power look (blazer + oxfords) scores above same look with slides under power intent.
3. Chat “interview outfit” / “date night” resolves intent in plan metadata; clash still hard.
4. After StyleWise JS changes: `eas update --channel production` and `--channel preview`.

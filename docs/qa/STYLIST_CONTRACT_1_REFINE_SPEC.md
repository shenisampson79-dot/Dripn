# Contract 1 — Refine slot ops + occasion inheritance (read-only implementation spec)

**Status:** IMPLEMENTED (awaiting device Test 6). Spec frozen as contract; code lives in `compileRefineIntent` (+ mirrors).  
**Date:** 2026-08-24  
**Device evidence (pre-fix):** Test 6 FAIL — “Keep the top, but change the bottoms and trainers. Give me a different version.”  
**Frozen elsewhere:** Live published-snapshot; Contract 4 (ARCHITECTURE PASS / QUALITY PARTIAL); casual allocator-heavy latency (separate performance contract — do not mix into this fix).

---

## 1. Target contract (canonical)

Refine asks must compile to a structured operation before any locks/excludes/occasion are applied:

```ts
type OutfitSlot = 'top' | 'bottom' | 'footwear' | 'layer' | 'accessory';

type RefineIntent = {
  keep: OutfitSlot[];
  replace: OutfitSlot[];
  occasion: string;           // inherited unless user explicitly changes it
  occasionSource: 'inherited' | 'explicit_ask' | 'raise_formality';
  confidence: 'high' | 'ambiguous';
  clarifySlot?: OutfitSlot;   // only when confidence === 'ambiguous'
};
```

### Test 6 target

| User text | Target `RefineIntent` |
| --- | --- |
| Keep the top, but change the bottoms and trainers. Give me a different version. | `{ keep: ['top'], replace: ['bottom', 'footwear'], occasion: <prior>, occasionSource: 'inherited', confidence: 'high' }` |

### Derived solver inputs (from intent — never from raw regex alone)

| Field | Test 6 derivation |
| --- | --- |
| `lockedItemIds` | prior IDs in slots ∈ `keep` (the top only) |
| `excludeItemIds` | prior IDs in slots ∈ `replace` (prior bottom + prior footwear) |
| `occasion` | prior outfit occasion (e.g. `gym`) unless ask contains an explicit new occasion |
| `refine` enum (compat) | e.g. `keep_top_replace_bottom_footwear` — **new** enum; do not reuse `keep_footwear_change_top_bottom` for this polarity |
| `mode` | `partial_recompose` (explicit keep + multi-slot replace) |

### Two refine modes (operation shape — not garment name)

| Mode | When | Keep / free rule |
| --- | --- | --- |
| **`slot_swap`** | Exactly one slot in `replace`, empty `keep`, no refresh language | Lock **all other prior outfit slots** (top/bottom/layer/accessory present); replace that one slot |
| **`partial_recompose`** | Explicit keep and/or multi-slot replace | Obey only stated keep/replace; **genuinely unmentioned optional slots** (e.g. layer) stay unlocked and not excluded |

Examples:

| Ask | Mode | keep | replace |
| --- | --- | --- | --- |
| Swap the trainers / Change the shoes | `slot_swap` | top, bottom, (+layer if present) | footwear |
| Keep the top, change bottoms and trainers | `partial_recompose` | top | bottom, footwear (layer free) |
| Keep the shoes, change top and bottoms | `partial_recompose` | footwear | top, bottom |

### Polarity fixtures (must all pass)

| # | Ask | mode | keep | replace | occasion |
| --- | --- | --- | --- | --- | --- |
| T6 | Keep the top, but change the bottoms and trainers… | partial_recompose | top | bottom, footwear | inherit |
| P1 | Keep the shoes, but change the top and bottoms | partial_recompose | footwear | top, bottom | inherit |
| P2 | Swap the trainers / change the shoes | slot_swap | top, bottom (+layer) | footwear | inherit |
| P3 | Make it smarter / different look (no slot nouns) | refresh | [] | soft refresh excludes | inherit or raise only if explicit formality words |

---

## 2. Current implementation map (CODE-TRACED)

### 2.1 Client — route gate

| Location | Role today |
| --- | --- |
| `utils/outfitClarifyContinuity.ts` → `isWardrobeOutfitRefineAsk` | Detects refine; routes to `outfit-from-wardrobe` |
| `screens/AIStylistScreen.tsx` → `isRefineOutfitAsk` | Same gate; builds POST body |

**Test 6 routing:** correctly enters refine path (hasPriorOutfitItems + refine ask). Routing is not the root failure.

### 2.2 Client — lock polarity (INVERTED for Test 6)

`AIStylistScreen.tsx` ~3398–3430 `keepShoesChangeRest`:

```text
TRUE if:
  A) keep … (shoe|trainer|…) within 24 chars
  OR
  B) (change|swap|…) … (top|bottom)
     AND any (shoe|trainer|…) anywhere in text
     AND any (keep|same|still) anywhere in text
```

**Test 6:** “Keep the top … change the bottoms and trainers”  
→ branch **B** matches (`change`+`bottoms`, `trainers`, `Keep`)  
→ locks **footwear**, excludes **top+bottom**  
→ opposite of user intent.

There is **no** `keep … top` / `change … bottoms and trainers` branch on the client.

### 2.3 Server — `resolveRefineLocks` (SAME inversion)

`services/chatWardrobeOutfitFast.js` ~191–209:

Identical three-way OR. Branch B / third arm produces:

```text
refine: 'keep_footwear_change_top_bottom'
lockedItemIds: prior footwear
excludeItemIds: prior top + bottom
```

**Test 6:** same polarity flip as client. Client may also send inverted `lockedItems` / `excludedItems`; server refine resolver would invert again even if client sent nothing.

### 2.4 Server — `refineCurrentLook` (SAME inversion)

`services/createWardrobeOutfit.js` ~813–826: same “keep + footwear word + change top/bottom” → lock footwear.

Dedicated refine path is entered when `priorItemIds` present (`chatWardrobeOutfitFast` ~327+). So Test 6 can hit **refineCurrentLook** with the inverted rule before falling through.

### 2.5 Occasion inheritance (BROKEN for no-cue refine)

Client (`AIStylistScreen` ~3381–3382):

```ts
occasionForServer = raiseOccasionForRefine(extractPriorOutfitOccasion(...), trimmedAsk)
```

`raiseOccasionForRefine` (`utils/inferOutfitOccasionFromAsk.ts`):

```ts
const inferred = inferOutfitOccasionFromAsk(refineText, 'smart_casual');
// if inferred is smart_casual (the fallback when text has no occasion cues),
// it RETURNS smart_casual BEFORE checking prior gym.
```

**Test 6 refine text** has no gym/dinner cues → inferred = **`smart_casual` (fallback)** → prior gym is discarded.

Server `refineCurrentLook` preserves occasion better when `lockedContext.occasion` is set — but the client already sent `occasion: smart_casual`, so the damage is done upstream.

### 2.6 Failure chain (Test 6)

```text
User: keep top, replace bottom + trainers (prior gym)
  → client keepShoesChangeRest = true  → lock footwear, exclude top+bottom
  → client raiseOccasionForRefine → smart_casual (fallback)
  → POST outfit-from-wardrobe
  → server refineCurrentLook / resolveRefineLocks → keep_footwear_change_top_bottom
  → createWardrobeOutfit(occasion=smart_casual, locked=footwear, …)
  → formality / lock_not_honored / closed refuse
```

Root causes are **two independent defects**:

1. **Slot polarity:** keyword co-occurrence (`keep` anywhere + `trainers` anywhere + `change bottoms`) ≠ verb–noun binding.  
2. **Occasion:** refine with no occasion cue must **inherit**, not fall back to `smart_casual`.

Regex tweaks for “trainers” alone are insufficient.

---

## 3. Target compiler (design — not implemented here)

### 3.1 Single shared module (client + server mirror, or server-authoritative)

Preferred: **one** `compileRefineIntent(text, { priorSlots, priorOccasion })` used by:

- client (optional early UI / clarify), and  
- server (authoritative before `createWardrobeOutfit` / `refineCurrentLook`).

Server remains garment authority; client must not invent a second polarity.

### 3.2 Binding rules (compositional)

1. Segment on contrast: `but` / `and` / commas.  
2. Bind verbs to nearest slot nouns in the same clause:
   - `keep`/`same`/`still` → slots in that clause → `keep`
   - `change`/`swap`/`different`/`other`/`new` → slots in that clause → `replace`
3. Slot lexicon:
   - top: top, tee, shirt, tank, blouse, polo, knit, sweater, hoodie  
   - bottom: bottom(s), trouser(s), pant(s), short(s), jean(s), cargo, chino, skirt  
   - footwear: shoe(s), trainer(s), sneaker(s), boot(s), footwear, loafer(s)
4. **Conflict rule:** if the same slot appears under both keep and replace → `confidence: 'ambiguous'` → clarify (do not merge-all / do not guess).  
5. **Mode-dependent free slots:**
   - `partial_recompose`: slots not mentioned stay unlocked and not excluded (optional layer free on T6).
   - `slot_swap`: unmentioned prior slots are **locked** (preserve the rest of the outfit).
6. **Forbidden legacy match:** never treat `(keep anywhere) ∧ (footwear word anywhere) ∧ (change top|bottom)` as keep-footwear.

### 3.3 Occasion rules

```text
if ask contains explicit occasion cue (gym, dinner, work, …)
  → occasion = inferred; occasionSource = 'explicit_ask'
else if ask contains formality raise only (too casual, dressier, nicer dinner)
  → occasion = raise(prior); occasionSource = 'raise_formality'
else
  → occasion = prior; occasionSource = 'inherited'   // NEVER default smart_casual
```

Fix `raiseOccasionForRefine`: only return inferred when it came from a **matched cue**, not from the fallback parameter.

### 3.4 Enum / API surface

| Today (wrong for T6) | Target |
| --- | --- |
| `keep_footwear_change_top_bottom` | Keep as **P1 only** |
| (missing) | `keep_top_replace_bottom_footwear` (T6) |
| `swap_footwear` | Keep (P2) |
| `refresh_smarter` / `refresh_dressier` | Keep (P3); no silent slot inversion |

Optional: stop sending client-computed `lockedItems`/`excludedItems` for refine once server compiler is authoritative — client sends `priorItemIds` + message + prior occasion only.

---

## 4. Files that must change when implementation starts (map only)

| Layer | File | Change class |
| --- | --- | --- |
| Spec owner | **new** `compileRefineIntent` (server + thin client re-export or shared rules) | structured ops |
| Server | `chatWardrobeOutfitFast.js` `resolveRefineLocks` | call compiler; delete inverted OR |
| Server | `createWardrobeOutfit.js` `refineCurrentLook` | same compiler; inherit occasion |
| Client | `AIStylistScreen.tsx` keepShoesChangeRest / exclude builders | replace with compiler or defer to server |
| Client | `outfitClarifyContinuity.ts` `isWardrobeOutfitRefineAsk` | gate only; may stay regex for *detection* |
| Client | `inferOutfitOccasionFromAsk.ts` `raiseOccasionForRefine` | inherit unless explicit cue |
| Tests | new deterministic fixtures T6, P1–P3 | REQUIRED before device retest |

**Do not touch in Contract 1:** allocator topK, evaluator floors, explanation LLM, client 15s timeout, Live, hard-lock dual-tee bug (separate), scroll UI.

---

## 5. Acceptance (implementation order)

1. **Deterministic (no device):** compile fixtures T6 / P1 / P2 / P3 → exact `keep`/`replace`/`occasionSource`.  
2. **Server unit:** given prior gym outfit IDs + T6 text → locked = top only; exclude = bottom+footwear; occasion = `gym`.  
3. **Device Test 6 only:** same ask after a gym create; expect outfit-from-wardrobe refine success; top ID stable; bottoms+footwear changed; occasion gym; no `lock_not_honored` from inverted footwear lock.  
4. **Regression:** P1 (“Keep the shoes…”) still locks footwear only.

---

## 6. Explicit non-goals

- Phrase-specific regex for “trainers” without a slot model.  
- Lowering ≥80 publish floor to make inverted locks “succeed”.  
- Mixing casual allocator performance work into this PR.  
- Reopening Contract 4 prose quality.

---

## 7. Ready-to-implement checklist

- [x] `compileRefineIntent` + fixtures T6/P1/P2/P3  
- [x] Wire server `resolveRefineLocks` + `refineCurrentLook`  
- [x] Fix `raiseOccasionForRefine` inheritance  
- [x] Remove or neutralize client `keepShoesChangeRest` inversion  
- [ ] Device Test 6 once  

**Next agent action after this doc:** implement in that order only.

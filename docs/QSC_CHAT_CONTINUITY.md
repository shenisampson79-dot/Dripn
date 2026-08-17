# QSC → Chat continuity (launch freeze gate)

Freeze this slice when the automated canonical-ID regression passes and the five manual checks pass. Do not silently re-run outfit generation in chat.

## Hard rules (ship gate)

1. **Editorial casing everywhere** — official brand styling + sentence-case descriptors (`Nike white leather low-top trainers`, not Title Case Every Word, not `gap white…` unless the brand is officially lowercase).
2. **QSC alternatives are complete** — base top + bottoms + shoes for normal daywear. A blazer is a layer, not a top. Athletic/running tees do not pair with blazers.
3. **One canonical garment set** — strip, headline, and prose all resolve from the **same wardrobe item IDs**.
4. **Chat inherits QSC only on clear back-reference** — “the outfit you just suggested”, “what shoes with that?”, “you forgot the top”, “why did you pick that?”. Unrelated new asks do not silently inherit.

## Automated regression

```bash
# Server
node scripts/test-editorial-garment-casing.mjs
node scripts/test-canonical-qsc-chat-ids.mjs
node scripts/test-decision-continuity.mjs

# Client mirror
npx tsx utils/editorialGarmentName.test.ts
```

**Canonical case:** QSC recommends complete look → Chat follow-up about the same look → strip IDs === locked top/bottom/shoes IDs.

## Manual retest

1. QSC rejects the worn look → alternative names a real **base top** (not only a blazer), **bottom**, and **shoes**.
2. Open Stylist Chat (no Continue button required) and mention the QSC look, e.g. “finish off the outfit” / “what shoes with that?”.
3. Ask a narrow refinement (e.g. “you forgot the top” / “what shoes with that?”).
4. Ivy keeps the same recommendation and fills **only** the missing role (same IDs).
5. Outfit strip shows the **exact wardrobe image** for each locked `wardrobeItemId`.

## Completeness rule

- Daywear default: base top + bottom + shoes.
- Exceptions: dress/jumpsuit (+ shoes); swim/beach sets.
- Blazer/coat never counts as the base top.

## Ship notes

- Server: editorial casing, QSC sync+reallocate, athletic-tee clash, continuity-locked strip.
- Client: editorial display in QSC/chat; clash mirror; continuity follow-up phrasing.

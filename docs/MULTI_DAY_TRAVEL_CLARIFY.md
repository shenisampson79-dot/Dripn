# Multi-day travel clarification flow

First-class Ivy contract for asks like *“I'm away for three days. Create an outfit for each day”*.

**Not** a single-look chip soft-fail. **Not** silent generation of N outfits. **Not** a cold generic chat turn as the primary path.

## States

| State | Meaning |
|--------|---------|
| `DETECTED` | Multi-day / travel packing ask recognised |
| `AWAITING_SLOTS` | Clarifying questions asked; waiting for answers |
| `READY` | Minimum slots filled → may generate |
| `GENERATING` | Allocator running |
| `DONE` | Day looks returned |

## Required slots (before generate)

1. **destination** — where they are heading  
2. **tripType** — `business` \| `leisure` \| `mixed`  
3. **datesOrSeason** — dates string and/or season  
4. **occasions** — major dinners / dress codes, or explicit **none**

Optional: **dayCount** (default 3 when “away for three days” / similar).

## Clarify behaviour

- First turn after detect: batch all four questions in **one** message (persona-aware copy).  
- Partial answers: ask **only** missing slots (1–2 turn total when user batches).  
- Slot parse is free-text / comma-friendly (`Barcelona, leisure, July, one nice dinner`).

## Exit → generate

Only when `isMultiDayReady(slots)`:

1. Build occasion sequence from trip type + occasions (e.g. leisure + dinner → one `evening_out` day).  
2. Resolve **destination weather** (live if lat/lon; else season-slot calendar hint → `resolveWeatherForAllocator`).  
3. Call `generateMultiDayOutfits` / `allocateMultiDayPlan` (same allocator family as `createWardrobeOutfit` — **not** a sixth solver).  
4. Return day-by-day explain tied to destination + weather + occasion.

## Code

| Layer | Module |
|--------|--------|
| Server slots / copy | `services/multiDayTravelClarify.js` |
| Server generate adapter | `services/chatMultiDayOutfits.js` |
| HTTP | `POST /api/chat/multi-day-outfits` + resilient early path |
| Client | `utils/multiDayTravelClarify.ts` + `AIStylistScreen` + `ApiService.sendMultiDayOutfitsFromChat` |

## Retest prompts

1. `I'm away for three days. Create an outfit for each day` → clarify (4 Qs), **no** outfits yet.  
2. Reply: `Barcelona, leisure, July, one nice dinner` → day looks with dinner day elevated.  
3. Reply partial: `London` → ask remaining only.

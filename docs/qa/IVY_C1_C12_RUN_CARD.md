# Ivy C1–C12 run card (last uncertified product gate)

**Status:** **BLOCKED — P1 residuals C5 / C6 / C7**  
**Official suite:** complete (not clean PASS) · brief `IVY_C1_C12_OFFICIAL_CHATGPT_BRIEF_20260827.md`  
**ChatGPT decision:** no PASS WITH DEBT · normalize C5/C7 to **FAIL P1**

| ID | Status |
|----|--------|
| C1–C4 | PASS (C4 P2 grammar) |
| **C5** | **FAIL P1** — incomplete published outfit visual (`missingCount:1`) · **queued** |
| **C6** | **FAIL P1** — `resilient_outfit_early` / Tier B · **fix shipped — device retest C6 only** |
| **C7** | **FAIL P1** — funeral → casual_day / “easy day out” · **queued** |
| C8–C11 | PASS |
| C12 | PASS (P2 truncated sentence; politics keep) |

## Meter (do not conflate)

| Line | Amount |
|------|--------|
| Official certification | 78¢ → 195¢ = **+117¢** (+39 chats) |
| Earlier abort | **+24¢** separate |
| QA total across both (ops only) | 141¢ |

## C6 fix (this pass only)

Widen `isStylingAdviceHowAsk` for imperative dual-constraint formality (“make it smarter but still relaxed”) + conversational reject/retry without outfit nouns. Preserve short `make it smarter`, `swap the shoes`, `another look`, create/build.

**Do not** touch Tier B, allocator, Gate 3, metering, C5 visuals, or C7 occasion in this patch.

## Device sequence

1. Deploy server (+ client OTA if client gate shipped).  
2. Retest **C6 only**.  
3. If PASS → separate RC/retest **C5**, then **C7**.  
4. After all three P1s have device evidence → final clean **C1–C12** certification hygiene run.

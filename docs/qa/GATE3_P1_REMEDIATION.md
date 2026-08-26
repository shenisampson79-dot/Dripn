# Gate 3 P1 remediation (2026-08-26)

Authorized fix pass after Gate 3 audit. **No Live engine retune.** No L04 paint-path refactor.

## Severity reframe (accepted)

| ID | Reframe |
|----|---------|
| **G3-L04** | Downgraded from automatic P1. Contract mismatch is debt unless it produces incorrect customer-visible state. L01–L03 fixes do **not** require wiring `commitPublishedLiveState`. |
| **G3-X02** | Same root cause as **G3-D02** — fix once, verify once. |
| **G3-D04 / G3-J03** | Certification gaps (UNPROVEN reasoning), not product defects until device matrix fails. |

Effective P1 clusters fixed: **Live presentation**, **Decisions clash-safe**, **Julia ticket honesty**.

## Fixes shipped

### Live (StyleWise `fix/gate3-p1-customer-presentation`)
- Footer: `Cloud vision` / engine source only when `isBeliefDebugAllowed`; customers see status only.
- Clash hint: fashion prose; engineering bullets filtered in `renderCopyFromPublishedTruth`.
- Score↔headline: always `enforceLiveOutcomeContract` after hold/align; restore `isRemovedCustomerHeadline` (Swim-ready / Gym-ready / …).
- Sock tip: never say trousers when published bottom is shorts; advisory must pass published-name check.

### Decisions (Dripn-Server + client sanitize)
- `wardrobeGapResponse`: never embeds `Closest issue: ${violations[0]}`.
- Customer strings: `clash-safe` → cohesive / wardrobe wording at source.
- Defense-in-depth: client `sanitizeStylistUserText` + `rewriteStylistCtaJargon` strip `clash-safe` / Closest issue / allocator.

### Ask Julia
- Ticket bubble: success only if backend created; else honest “saved on this device” or hard fail (no false “created successfully”).

## Deterministic checks (pre-commit 2026-08-26)

| Suite | Result |
|-------|--------|
| `npx tsx utils/liveOutcomeContract.test.ts` | **all passed** |
| `npx tsx utils/livePublishedCopy.test.ts` | **all passed** |
| `npx tsx utils/liveHudChrome.test.ts` | **all passed** |
| `npx tsx utils/livePermanentRegression.test.ts` | **LIVE LAUNCH GATE: PASS** (L1–L6) |
| `npx tsx utils/livePublishedIdentity.test.ts` | **all passed** |
| `npx tsx utils/legwearAdvisory.test.ts` | **all passed** |
| Dripn-Server `node scripts/test-stylist-confidence.mjs` | **All stylist confidence tests passed** (incl. wardrobe_gap never surfaces clash-safe) |
| Dripn-Server `node scripts/verify-dress-code-rules.mjs` | **ok** |

## Closure criterion (do not move goalposts)

**Gate 3 does not require perfect prose.** Credible launch quality for grammar, presentation, reasoning, and explanations is enough. Awkward-but-correct wording is **P2/P3** unless it materially misleads the customer.

## Next (not this pass)
1. Finish **Gate 1** P0/P1 fix + verify (do not deploy Gate 3 ahead of Gate 1 unless it blocks technical verification).
2. Deploy Gate 3 fixes → **10-test device matrix once** (record mid-suite defects; only stop for P0/P1 that make continuing meaningless).
3. Ivy **C1–C12** once → final blocker review.

Do **not** run another broad Gate 3 discovery audit.

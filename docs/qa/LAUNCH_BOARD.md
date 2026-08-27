# Launch board (authoritative snapshot)

**Updated:** 2026-08-27  
**Rule:** Finite checklist only — no open-ended product development.

| Workstream | Status | Notes |
|------------|--------|-------|
| **Outfit engine** | **PASS WITH DEBT** | Frozen; singular derby hard-lock P2 |
| **Conversational Ivy** | **NOT CERTIFIED** | C1–C12 after Gate 3 remaining P1s |
| **Live / Decisions / Ask Julia / Feedback** | **P1 PARTIAL — still BLOCKED** | 04 closed; 09a redirect closed (CTA P2); 09b-KB + LIVE-HOLD open; 10b not yet proven |
| **Technical launch (Gate 1)** | **PASS / CLOSED** | SEC + PAY-02 + DEP-03 + FS-PAY-01 closed |
| **Final app launch** | **NOT YET CERTIFIED** | Needs Gate 3 PASS WITH DEBT → Ivy C1–C12 |

## Active now

1. **One Feedback offline test** (complete form) — do not re-fix 10b until result.
2. **Julia keyboard P1** — ship scroll overshoot fix → retest 4 turns.
3. **Live hold P1** — RC in `G3_LIVE_HOLD_01_ROOT_CAUSE.md`; **no fix until authorized**.
4. Then: Ivy C1–C12 (meter before/after + turn count) → final review.

## Deployed

| Surface | SHA / ID |
|---------|----------|
| EAS production | `01f9bf39-0582-4415-b2df-20c0e80bcc96` @ `b63f95c` |
| EAS preview | `146c3b5e-3ab7-45d4-a6c4-e027fdfa65f8` @ `b63f95c` |
| Server `main` (for Render) | `d7c9576` |

## Parked

- Gate 3 rediscovery / prose perfection
- P2/P3: Live dash, Lookbook chip, Julia numbering/stale copy, Decisions thumbnails, Julia Stylist CTA
- Outfit freeze; Live freeze **except** authorized G3-LIVE-HOLD-01 minimal fix after RC acceptance
- Proxyman/Charles FS-PAY-01 device induction (UNPROVEN, non-blocking)
- **AI-COST-01 (P2):** Live inference observed with +0¢ allowance delta — see `AI_COST_01_OBSERVABILITY_DEBT.md`

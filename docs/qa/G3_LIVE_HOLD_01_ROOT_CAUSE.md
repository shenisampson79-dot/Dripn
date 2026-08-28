# G3-LIVE-HOLD-01 — Held 3-piece Live score flip (read-only root cause)

**Status:** P1 OPEN — **investigation only; no fix authorized yet**  
**Recorded:** 2026-08-27  
**Frozen rule:** Do not retune JPEG, Cloud cadence, change-epoch, publish gates, or thresholds until a minimal proven fix is authorized.

## RUNTIME evidence

User 72 · loafers + athletic shorts · held scene · `POST /api/wardrobe/scan-wardrobe/live-frame` · `cloud_vision` · `items=3` · `changed=true`:

| Sequence | Scores |
|----------|--------|
| A | **48 → 73** |
| B (independent) | **47 → 72** |
| C (later) | **73 → 73 → 71** (high state can stay stable) |

Customer UI: first publish **Mixed direction** naming loafers → ~20s later **Nice balance** omitting loafers while footer still **3 pieces**.  
Live frame latency ~**2.1–3.3s** per call — flip is **multiple completed analyses replacing each other**, not one 20s request.

## Root-cause hypothesis (CODE-TRACED)

**Best-supported candidate: #4 Scoring / coaching / summary archetype**  
**Strong trigger: #1 Identity/classification flicker** (loafer lane / shorts subtype)

1. **Clash path (~47–48):** formality/tension scoring → Mixed direction; tension archetypes name shoes.
2. **Cohesion-inflation path (~72–73):** `softAligned` in `services/liveCoaching/index.js` can floor score to **72/78** when lanes look like athleisure|casual|streetwear|smart_casual — **without** the athletic×smart exception that `sameLane` has in `features.js`.
3. Score ≥70 → **Nice balance**; `outcomeContract.js` strips tension/footwear-clash copy in the good band.
4. Cohesion summary templates are often **top+bottom only** (`summaryArchetypes.js`) — loafers omitted from explanation while `itemCount` stays 3.

Classification flicker (loafer `formal` vs soft demotion of athletic shorts around loafers) explains why the same held look alternates clash vs softAligned floor.

## Candidate ranking

| # | Candidate | Support |
|---|-----------|---------|
| 4 | Scoring / coaching / archetype | **Best** |
| 1 | Identity/classification instability | Strong **trigger** |
| 2 | Published-state / change-epoch | Secondary |
| 3 | Evidence loss cloud→published | Weak (3 items still present) |

## Still UNPROVEN

- Exact per-frame Vision labels for user 72
- Whether client also clears conflict after server strip
- Whether any publish hold delayed the flip vs pure cloud cadence + softAligned oscillation

## Minimal fix later (NOT implemented)

Stop treating footwear-formality clash as `softAligned` cohesion (align with `sameLane` athletic×smart exception), and do not strip footwear-clash summary in the good band when dressy shoes + athletic bottoms remain — so Mixed + loafer-aware copy stay atomic with the 3-piece identity.

**No code change until this hypothesis is accepted and a bounded fix is explicitly authorized.**

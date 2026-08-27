# AI-COST-01 — Per-feature AI spend attribution unavailable (P2)

**Status:** PARKED — launch economics / observability debt  
**Severity:** P2 (not a Gate 3 / launch blocker)  
**Recorded:** 2026-08-27  
**Do not interrupt Gate 3 P1 closure or Ivy C1–C12 for this. Do not investigate the +16¢ pre-window now.**

## What is established today

- Customer AI allowance is an **aggregate** counter: `users.monthly_ai_cost_cents` (shared pool).
- Enforcement uses that aggregate + plan budget (+ purchased top-ups).
- Partial proxies only: `monthly_chat_count`, rembg counts, `stylist_decision_usage` (daily decision count), voice credits (separate).
- **Ask Julia / support chat does not debit** the AI meter.
- Configured `AI_ACTION_COSTS_CENTS` values (e.g. decision 3¢, live_frame 2¢) are **allowance debits / metering units**, not proven OpenAI/vendor COGS.

## What is NOT established

- Exact spend by feature (Live vs wardrobe analyze vs Decisions vs stylist chat).
- Actual provider cost vs customer allowance debit (these must stay separate concepts).
- Whether Live usage alone always debits the allowance (see Gate 3 retest +0¢ note below).

## Desired post-certification telemetry (bounded)

Event-level rows with at least:

| Field | Purpose |
|-------|---------|
| `feature` / `action` | Surface attribution |
| `model` / `provider` | Vendor identity |
| `actual_provider_cost_cents` (or micro-units) | Real COGS |
| `allowance_debit_cents` | Plan meter debit |
| `timestamp` | When |
| `user_id` / account ref | Who |
| `request_id` | Correlation |

Keep **actual cost** and **allowance debit** as separate columns so launch economics can answer:

1. What did this customer consume from their plan?
2. What did serving them actually cost us?

## Interim QA method (no prod schema change)

Script: `Dripn-Server/scripts/query-user-ai-usage.mjs <email>`

---

## Recorded observations — 2026-08-27 (sharonjones@yahoo.com)

Account: Personal Stylist · plan budget **250¢ ($2.50)** · period `2026-08`.  
Figures below are **allowance debit**, not OpenAI COGS.

### Observation A — Pre-window (do not investigate now)

| Window (UTC+1) | Used | Delta |
|----------------|------|-------|
| ~05:23 | 38¢ | — |
| ~05:47 | 54¢ | **+16¢** |

Preserve for eventual cost review only. **No rabbit-hole on cause during launch gates.**

### Observation B — Gate 3 P1 closure retest window

| Window (UTC+1) | Used | Delta |
|----------------|------|-------|
| ~05:47 (nearest before ~06:00 start) | 54¢ | — |
| ~07:13 (post-test) | 54¢ | **+0¢** |

Proxies unchanged across this window: decisions still 3 on `2026-08-26` only; chat count 1; voice 0/15; meter `lastUpdated` stayed at 04:47 UTC.

**Interpretation for cost review:**

- Camera-permission recovery, Feedback offline, Julia keyboard, and Julia support are not necessarily billable AI events — **+0¢ is expected** for those.
- **Stronger (logs):** successful `POST /api/wardrobe/scan-wardrobe/live-frame` calls (e.g. score 73 → 200, plus 48→73 / 47→72 sequences) occurred in/near this window. **Live inference definitely ran while allowance stayed 54¢→54¢.** Still cannot conclude whether Live should charge, is intentionally suppressed, or metering is broken — park until certification.
- Reinforces: current meter is **inadequate for customer economics by feature**.

**Gate 3 action:** do not stop launch work over +0¢. Finish Gate 3 closure; use Ivy as next controlled sample.

---

## Next controlled sample — Ivy C1–C12

**When:** immediately before C1 and immediately after C12 (same account preferred).

| Step | Action |
|------|--------|
| 1 | Snapshot meter + note wall-clock time (`query-user-ai-usage.mjs`) |
| 2 | Run all 12 Ivy scenarios |
| 3 | Count **actual Ivy user messages / billable turns** during the suite (manual tally or chat history length) |
| 4 | Snapshot meter again |
| 5 | Record: `delta_cents`, `turn_count`, optional `delta_cents / turn_count` as **observed allowance-debit rate** (still not COGS) |

Example (illustrative only): +30¢ across 20 turns → ~1.5¢/turn allowance debit — useful for “how fast could a customer consume $2.50?”

Fill in when run:

| Field | Before C1 | After C12 |
|-------|-----------|-----------|
| Time (local) | | |
| Used cents | | |
| Delta cents | | |
| Ivy turns / user messages | | |
| Observed ¢/turn | | |
| Voice used (if any) | | |

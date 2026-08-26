# Gate 3 — Customer-facing experience / content audit (complete pass)

**Date:** 2026-08-26  
**Mode:** Read-only discovery complete → **P1 remediation authorized** (`GATE3_P1_REMEDIATION.md`)  
**Out of scope:** Live engine retune · Outfit allocator · Ivy C1–C12  
**Charter:** `CUSTOMER_FACING_EXPERIENCE_CONTENT_GATE.md` (three judgment axes + RUNTIME sample bar)

## Overall verdict: **BLOCKED** (pending device matrix after P1 fixes)

Discovery found a **small, bounded** set of customer-facing P1s (not another architectural Stylist problem). Remediation targets three clusters + two certification gaps.

**Final app launch remains NOT YET CERTIFIED.**

Sources: Live QA PNGs; StyleWise + Dripn-Server CODE-TRACED; explores [Gate 3 Live](905c3f35-1d17-4ff9-8cc7-63b17e84bcd0), [Julia/Decisions/Feedback](65b17ac4-ca6e-4937-8613-d2ae907f1d85), [Gate 3 synthesis](74e5b2f8-dc83-4354-a87b-68726b9abf25).

---

## Findings matrix

| ID | Surface | Axis | Title | Sev | Evidence | Blocker? | Action |
|----|---------|------|-------|-----|----------|----------|--------|
| G3-L01 | Live | C | Footer always `"Cloud vision · …"` | **P1** | **RUNTIME** + CODE-TRACED | Yes | **Fixed** — staff/DBG only |
| G3-L02 | Live | C | Engineering jargon in coaching bullets | **P1** | **RUNTIME** exact subtype hint | Yes | **Fixed** — fashion prose + filter |
| G3-L03 | Live | B/C | Score↔headline contradiction | **P1** | **RUNTIME** `~95` + `"Needs a tweak"` | Yes | **Fixed** — always enforce outcome contract |
| G3-L04 | Live | A/C | HUD not via `commitPublishedLiveState` | **P2 debt** | CODE-TRACED only — not customer-visible proof | No* | Do **not** refactor unless L01–L03 require it |
| G3-L05 | Live | B | Misleading swim / footwear naming | **P1** | RUNTIME Swim-ready samples | Yes | **Fixed** presentation gate (`isRemovedCustomerHeadline`); device reconfirm |
| G3-L06 | Live | C | Status truncation / sheet `%` | **P2** | CODE-TRACED + RUNTIME | No | Park |
| G3-L07 | Live | C | DBG gated; Vision line was not | **P2** | Covered by L01 | Partial | **Fixed** with L01 |
| G3-D01 | Decisions | A | Functional path + meter/errors | **P2** | CODE-TRACED | No | Device |
| G3-D02 | Decisions | C | `clash-safe` in gap tip | **P1** | CODE-TRACED | Yes | **Fixed** at source + sanitize (incl. X02) |
| G3-D03 | Decisions | C | Allocator / awkward prose | **P2** | Softened with D02 | No | Park remainder |
| G3-D04 | Decisions | B | Reco usefulness | **Cert gap** | **UNPROVEN** — not a product defect yet | Cert | Device matrix #5–7 |
| G3-D05 | Decisions | C | Unlimited vs Stylist Pro | **P2** | CODE-TRACED | No | Park |
| G3-J01 | Ask Julia | A | Ticket success if backend fails | **P1** | CODE-TRACED | Yes | **Fixed** — honest offline / fail |
| G3-J02 | Ask Julia | B/C | Welcome + canned tips | **P2** | Exact welcome | No | Park |
| G3-J02b | Ask Julia | C | Hindi typing string broken | **P2** | Exact `hi.json` | No | Park |
| G3-J03 | Ask Julia | B | Answer correctness | **Cert gap** | **UNPROVEN** | Cert | Device matrix #8–9 |
| G3-F01–F03 | Feedback | A/C | Submit / inbox / offline | **P2/P3** | CODE-TRACED | No | Device #10 |
| G3-X01 | Cross | B | Voice consistency | **P2** | UNPROVEN | No | Later |
| G3-X02 | Cross | C | `clash-safe` authored server-side | *(→ D02)* | Same root as D02 | — | **Fixed with D02** |

\*L04: architecture/contract mismatch is launch-blocking only if it produces incorrect customer-visible state.

---

## Exact customer-visible wording (editorial samples)

| Source | Exact string |
|--------|----------------|
| Live RUNTIME IMG_0305 | `"Garment subtypes clash — lanes or pairing rules conflict"` |
| Live RUNTIME IMG_0305 | `"A sock colour closer to the trousers would create a cleaner transition into the shoes."` |
| Live RUNTIME IMG_0305 footer | `"Cloud vision · 3 pieces · 49"` |
| Live RUNTIME IMG_0294 | Score `"~95 approx"` + headline `"Needs a tweak"` + footer `"Cloud vision · 2 pieces · ~95"` |
| Decisions gap tip construction | `"This occasion needs stronger {occasion} pieces. Closest issue: {violations[0]}. Shop the look below."` |
| Julia welcome | `"Hello! I'm Julia, your Dripn support assistant. Whether you have questions about the app, need help with your account, or just want some guidance, I'm here for you. What can I help you with today?"` |
| Julia ticket success (even if API failed) | `"Your support ticket has been created successfully!\n\nTicket #…"` |
| Feedback success | `"Thank You!"` / `"Thanks — we've got your feedback."` |

---

## Gate-3-only device matrix (max 10) — run once after P1 ship

| # | Surface | Scenario | Pass bar |
|---|--------|----------|----------|
| 1 | Live | Non-staff Start → first score | No `"Cloud vision"` / DBG; coherent score+headline |
| 2 | Live | Loafers + athletic shorts look | No `"lanes or pairing rules"`; no `"trousers"` if shorts |
| 3 | Live | High-score casual athletic | Headline band matches score (no `"Needs a tweak"` at ~95); no `"Swim-ready"` without swim |
| 4 | Live | Camera deny / fail | `"Camera failed to start"` + Retry |
| 5 | Decisions | QSC clear photo | Useful why; no `clash-safe`; readable card |
| 6 | Decisions | Wedding + sparse wardrobe | Honest gap/shop; no engine tip |
| 7 | Decisions | Shopping A vs B | Clean badges; no Unlimited jargon |
| 8 | Julia | “Where is Usage this month?” | Correct Settings path; plain text |
| 9 | Julia | Fashion ask + ticket on API fail | Redirect to Stylist; honest offline/fail (not “created successfully”) |
| 10 | Feedback | Submit + airplane-mode | Success copy; fail copy; inbox row |

*(No Ivy C1–C12.)*

---

## Path after remediation

**P1 technical (Gate 1) → Gate 3 P1 fixes (this) → 10 Gate-3 device tests → Ivy C1–C12 → final launch blocker review.**

Do not extend the 3–5 day estimate based on this audit alone — uncertainty is reduced. Do **not** run another broad Gate 3 discovery audit.

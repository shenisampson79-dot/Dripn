# Launch board (authoritative snapshot)

**Updated:** 2026-08-29  
**Rule:** Finite checklist only — no open-ended product development.

| Gate / workstream | Status | Notes |
|-------------------|--------|-------|
| **Technical Gate 1** | **PASS / CLOSED** | Do not reopen |
| **P1 Account isolation / chat history** | **PASS / CLOSED** | Device proof 29 Aug 2026 — see below |
| **Outfit engine** | **PASS WITH DEBT / FROZEN** | Do not reopen for Ivy polish |
| **Gate 3 customer-facing experience/content** | **PASS WITH DEBT / CLOSED** | Do not touch unless new P0/P1 |
| **Conversational Ivy** | **BLOCKED — P1 residuals C5/C6/C7** | Official C1–C12 not clean PASS |
| **Final app launch** | **NOT YET CERTIFIED** | After Ivy clean suite |

## P1 Account isolation / chat history — CLOSED (2026-08-29)

**Status:** **PASS / CLOSED** — remove App Store submission hold for this P1.

**Production baseline:**

| Item | Value |
|------|--------|
| Build | 41 |
| Runtime | `1.0.0` |
| OTA commit | `3fc5c427090660646ad96f9a005d415192614be3` |
| Update group | `96fc1836-5a1d-4acd-b203-cfb64c37bfd3` |
| OTA message | P1 chat persistence correction |
| Prior regression | `4ebd56ef` (storage import typo) — fixed by `3fc5c427` |

**Device proof (Tests 1–5 PASS):**

1. Sharon: unique message + response; prior conversation persisted.
2. Logout → login Sharon: correct history restored.
3. Logout → Phil: zero Sharon content; Phil unique message sent.
4. Logout → login Phil: Phil's conversation restored.
5. Logout → Sharon: zero Phil content; Sharon's history restored again.

**Runtime evidence:** `GET /api/chat/history` → 200/304 across authenticated switches between user 68 and user 72.

**Verdict:**

- Cross-account isolation **PASS**
- Same-account history persistence **PASS**
- **Do not reopen** this subsystem unless a new P0/P1 is observed

**Agent rule:** Do not investigate chat isolation, account bleed, or same-user history restore unless a **new** P0/P1 defect is reported on device.

---

## Active now — C6 only

1. Bounded early create/refine exclusion for C6 phrasing (shipped / deploy).  
2. Device-retest **C6 only**.  
3. Then separate RCs: **C5** (visual completeness) → **C7** (occasion fidelity).  
4. Final clean C1–C12 hygiene run once all three P1s have device PASS.

### Parked P2 / P3 (record only — not launch blockers for chat P1)

- **P2** Ivy natural clarification replies (e.g. `"lunch"`)
- **P2** Sticky Stylist Chat header controls (headphones / sound / recycle)
- **P3** Ruby wardrobe-count pluralization (`"1 tops"`, `"1 pairs of shoes"`)
- Previously recorded QSC / Home / subscription presentation items

### Meter

- Official suite **+117¢** · abort **+24¢** (separate)

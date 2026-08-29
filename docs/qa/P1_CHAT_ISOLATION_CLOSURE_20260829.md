# P1 Account isolation / chat history — closure record

**Date:** 29 Aug 2026  
**Status:** **PASS / CLOSED**  
**Purpose:** Certification artifact — agents must not treat chat isolation as open.

---

## Production

| Item | Value |
|------|--------|
| Build | 41 |
| Runtime | `1.0.0` |
| OTA commit | `3fc5c427090660646ad96f9a005d415192614be3` |
| Update group | `96fc1836-5a1d-4acd-b203-cfb64c37bfd3` |
| OTA message | P1 chat persistence correction |
| Regression fix | `4ebd56ef` storage import typo → corrected in `3fc5c427` |

---

## Device proof (Tests 1–5 PASS)

| # | Step | Result |
|---|------|--------|
| 1 | Sharon: unique message + response | PASS — prior conversation persisted |
| 2 | Logout → login Sharon | PASS — Sharon history restored |
| 3 | Logout → Phil | PASS — zero Sharon content; Phil message sent |
| 4 | Logout → login Phil | PASS — Phil history restored |
| 5 | Logout → Sharon | PASS — zero Phil content; Sharon history restored |

**Confirmed properties (both required):**

- **Isolation:** Sharon never sees Phil; Phil never sees Sharon.
- **Continuity:** Each account's own thread survives logout/re-login.

**Runtime logs:** `GET /api/chat/history` → 200/304 on authenticated switches between user **68** and user **72**.

---

## Verdict

| Check | Status |
|-------|--------|
| Cross-account isolation | **PASS** |
| Same-account history persistence | **PASS** |
| App Store hold (chat isolation P1) | **REMOVED** |
| Subsystem status | **CLOSED** |

**Do not reopen** unless a new P0/P1 is observed on device.

---

## Still open (record only — out of scope for this closure)

- P2 Ivy natural clarification replies (`"lunch"`, etc.)
- P2 Sticky Stylist Chat controls
- P3 Ruby count/plural grammar
- QSC / Home / subscription presentation items (previously recorded)

---

*No code changes from this document. Authoritative gate snapshot: `docs/qa/LAUNCH_BOARD.md`.*

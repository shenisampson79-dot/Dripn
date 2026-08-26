# Gate 3 P1 closure (2026-08-27)

Device matrix on OTA `55606fe` / server `08d06a7` found **3 proven P1 clusters** (+ keyboard regression).

## Fixes (this pass)

| ID | Fix |
|----|-----|
| **G3-DM-04** | Live camera-deny: Open Settings when permanent deny; Allow camera otherwise; X + Go back exit. Permission UI only — no Live engine changes. |
| **G3-DM-09a** | Server + client deterministic fashion gate; redirect to Stylist with CTA button. Julia support path preserved. |
| **G3-DM-10b** | Feedback: default type `general` when area chip selected; honest offline error; header title reacts to `setOptions` via `screenOptions` fix. |
| **G3-DM-09b-KB** | Julia chat: stronger scroll-to-end when keyboard opens / messages arrive (QA screenshot on same build = P1 regression). |

## Deterministic tests

- `npx tsx utils/juliaFashionRedirect.test.ts`
- `npx tsx utils/gate3FeedbackSubmit.test.ts`
- `node juliaFashionRedirect.test.js` (Dripn-Server)

## Device rerun (after deploy)

**#4 → #9a → #9b keyboard → #10b**, plus Live **#1–3 smoke** only.

## Parked P2 (not this pass)

Live dash placeholder, Decisions shop thumbnails, Julia numbering/stale copy, Lookbook chip label.

# Dripn — Launch Architecture Audit (master)

**Purpose:** Launch-wide verification discipline. Stop symptom-led patch loops. Prove intended paths before “fixed.”  
**Created:** 2026-08-22  
**Rule:** No feature is **launch-approved** from an agent summary alone. It needs a **runtime trace**, a **deterministic regression proving the path**, or **both**.

> **No PASS because code exists. PASS only when the intended path is proven reachable and conflicting paths are accounted for.**

---

## Why this exists

Symptom debugging (screenshot → hypothesis → patch → retest) works for isolated UI bugs. For Live, Chat, outfit generation, Wardrobe analysis, dedupe, metering, and purchases it allowed:

- Parallel production routes and bypasses to survive
- Stale / template / guest paths to diverge from the “canonical” path
- Misleading UX while engines disagreed
- Threshold / grace / timing patches that papered over perception instability

Recent proof:

| Evidence | Lesson |
|----------|--------|
| Stylist Chat audit | Code presence ≠ coherent stylist; parallel routes + personality drift → **NOT APPROVED** |
| Outfit generation audit | Canonical path + machine suite required; call-site count matters |
| Quick Add Copy-trace | Frame-level multi-detect / reclass / IoU jumps — not just “lighting” or grace |

**Default order of work:** read-only architecture audit → runtime trace → then fix (if needed) → regression suite → re-sign.

---

## Three layers (mandatory for every important feature)

### Layer 1 — Read-only architecture audit

Map, without changing behaviour:

| Must map | Questions |
|----------|-----------|
| **Intended contract** | What is the one customer promise? |
| **Production routes** | Every client entry → server endpoint → engine |
| **Source of truth** | What may write customer-visible state? |
| **Fallbacks** | Soft-fail vs hard-fail; do they lie? |
| **Bypasses** | Alternate paths that skip gates / presentation / metering |
| **Stale / dead code** | Still importable? Still reachable? |
| **Customer copy** | Templates, chips, errors — one voice? |
| **Model / service deps** | Pins, try-lists, providers |
| **Metering** | Action key, once-per-success, refunds |
| **Failure paths** | Timeout, auth, meter, provider, unsupported |

Evidence class labels (use in every cell):

| Label | Meaning |
|-------|---------|
| **RUNTIME** | Device / Render / staff log from a real session |
| **DETERMINISTIC** | Machine test or fixture replay that fails on regression |
| **CODE-TRACED** | Static path proven in source — **not** enough for APPROVED alone |
| **UNPROVEN** | Claimed / assumed — treat as FAIL for launch |

### Layer 2 — Runtime trace ( ≥1 real production use )

Prove what actually runs:

```text
USER ACTION
→ CLIENT ROUTE
→ SERVER ENDPOINT
→ AUTH / ENTITLEMENT
→ DATA LOAD
→ CORE ENGINE
→ EXTERNAL CALLS
→ DECISION / SCORE
→ PRESENTATION
→ CUSTOMER RESULT
```

| Feature class | Extra required in the trace |
|---------------|-----------------------------|
| Performance-sensitive | Stage timings (ms) |
| Stateful | Source-of-truth transitions (version, published snapshot, draft→save) |
| AI-driven | Model id, prompt/tool path, retry/fallback, **who owns final customer text** |

Staff-only / `__DEV__` presentation gates for traces (never customer-visible). Prefer clipboard / structured logs over “looks fine on screen.”

### Layer 3 — Canonical regression suite

Fixed, machine-readable scenarios that fail if architecture silently regresses (parallel route reintroduced, gate skipped, wrong presentation owner, meter double-charge, etc.).

---

## Sign-off card (every feature)

Copy into each feature section (or linked child audit) and fill:

```text
ARCHITECTURE CONTRACT ........ PASS / FAIL
PRODUCTION ROUTE ............. PASS / FAIL
SOURCE OF TRUTH .............. PASS / FAIL
FALLBACKS SAFE ............... PASS / FAIL
CUSTOMER COPY ................ PASS / FAIL
METERING ..................... PASS / FAIL
RUNTIME TRACE ................ PASS / FAIL
REGRESSION SUITE ............. PASS / FAIL
PRODUCTION BYPASSES .......... 0 / N
RESULT: APPROVED / NOT APPROVED
```

**APPROVED** only if:

1. Every row above is **PASS** (or N/A with explicit reason, never silent), and  
2. **PRODUCTION BYPASSES = 0**, and  
3. At least one of **RUNTIME TRACE** or **REGRESSION SUITE** is **PASS** with cited evidence (build / commit / log / test command).

**NOT APPROVED** if any agent summary claims “done” without those rows filled.

---

## Audit priority (highest launch risk first)

Work this queue; do not skip ahead to polish lower-risk surfaces while a higher one is **NOT APPROVED**.

| # | Feature | Status (living) | Child / linked audits |
|---|---------|-----------------|------------------------|
| 1 | **Stylist Chat** | **NOT APPROVED** — run generalised 7 baseline | `STYLIST_CHAT_CANONICAL_AUDIT.md`, `STYLIST_CHAT_CANONICAL_CONTRACT.md`, `RETEST_GENERALISED_7.md`, `STYLIST_CHAT_CAPABILITY_AND_CLEANUP.md` |
| 2 | **Live** | Frozen territory — re-open only for critical Live defect | `.cursor/rules/live-published-snapshot.mdc`; published snapshot contract |
| 3 | **Wardrobe / Quick Add / Bulk** | Quick Add autocapture **parked** (manual shutter launch); Bulk / rembg as needed | `QUICK_ADD_AUTOCAPTURE_REGRESSION_AUDIT.md`, `BULK_UPLOAD_FAILURE_TRACE.md` |
| 4 | **Decisions / QSC** | Partial continuity docs | `docs/QSC_CHAT_CONTINUITY.md` |
| 5 | **AI Meter / IAP / RevenueCat / paywalls** | Ops + IAP docs exist; full sign-off TBD | `docs/IAP_MIGRATION_PLAN.md`, meter reset scripts / security docs |
| 6 | **Voice** | Chat-adjacent; parity unproven at runtime | Chat audit voice rows |
| 7 | **Events / GON / Today / Shopping** | Outfit surfaces must use canonical generator only | `OUTFIT_GENERATION_CANONICAL_AUDIT.md`, `GON_ACCEPTANCE.md` |
| 8 | **Julia support / refunds** | TBD | — |
| 9 | **Auth / profile / onboarding** | TBD | — |
| 10 | **Weather / location** | Tied to outfit allocator | Outfit audit weather rows |
| 11 | **Failure handling (cross-cutting)** | TBD per feature | — |
| 12 | **Observability (cross-cutting)** | Staff traces exist for some AI paths; not universal | — |

Update the **Status** column when a feature’s sign-off card flips; never rewrite history — append dated notes.

---

## Feature contracts (what each audit must prove)

### 1. Live

| Must prove | Notes |
|------------|-------|
| One published truth | Customer UI only from `publishedLiveState` |
| ~5s first read + ~5s material change | SLA; frozen lineage reference in Live rule |
| Vision vs YOLO roles | Clear ownership; no score/copy from raw detectors |
| Score / copy atomicity | `buildPublishedSnapshot` → single commit / version++ |
| Barefoot / change handling | Transition gates; no shoe-specific heuristic sprawl |
| Hidden DBG | `isBeliefDebugAllowed` presentation only |

**Do not retune** Live cadence / JPEG / publish gates unless a new critical Live defect.

### 2. Stylist Chat

| Must prove | Notes |
|------------|-------|
| Canonical personality | One presentation owner; no route-local Ivy |
| Routes | Outfit / resilient / multi-day / chips / guest — accounted for |
| Context continuity | Cross-turn locks, travel FSM, photo/voice parity |
| General reasoning | Not template-only; refuse athletic dinner, etc. |
| No stale templates / bypasses | Clash-safe / marketing strings not customer-facing |

**Next evidence:** fill `RETEST_GENERALISED_7.md` on a pinned OTA + server.

### 3. Outfit generation

| Must prove | Notes |
|------------|-------|
| metadata → beam → guard → critic ≥80 → accepted IDs → card/prose | Same ID set everywhere |
| All launch surfaces | Chat, Events, GON, Today, DFY — canonical only |

Linked: `OUTFIT_GENERATION_CANONICAL_AUDIT.md`, `OUTFIT_GENERATION_FORENSIC_TRACE.md`, `OUTFIT_LATENCY_TRACE.md`.

### 4. QSC / Decisions

| Must prove | Notes |
|------------|-------|
| Correct model / vision route | Launch pins |
| Scoring / verdict consistency | Compare vs buy boundaries |
| Metering | One charge per billable action |
| Chat handoff | Canonical IDs; no silent regenerate |

### 5. Shopping

| Must prove | Notes |
|------------|-------|
| Analysis / recommendation route | Product context intact |
| Wardrobe integration | Handoffs without orphan state |

### 6. Wardrobe Quick Add

| Must prove | Notes |
|------------|-------|
| **Launch path = manual shutter** | Autocapture staff/dev only (`isQuickAddAutocaptureAllowed`) |
| Vision after snap | Analysis, save, meter |
| Dedupe | Hard vs similar UX |
| rembg | Only if meter-valid capture fails analysis (parked otherwise) |

Linked: `QUICK_ADD_AUTOCAPTURE_REGRESSION_AUDIT.md` (parked — not launch-approved as READY system).

### 7. Bulk Add

| Must prove | Notes |
|------------|-------|
| Batch / sequential routes | Per-item failure isolation |
| Cancel / retry | Meter handling |
| Duplicate UX | Consistent with Quick Add |

Linked: `BULK_UPLOAD_FAILURE_TRACE.md`.

### 8. Duplicate detection

| Must prove | Notes |
|------------|-------|
| Visual + structural evidence | Hard duplicate vs similar |
| Client / server payload parity | Same decision semantics |

Linked: `DUPLICATE_MATCHER_AUDIT.md`, `SAME_GARMENT_REPHOTO_AUDIT.md` (FP + FN; garment-identity contract proposal).

### 9. Background removal

| Must prove | Notes |
|------------|-------|
| meter → provider → response → item update | Failure / refund behaviour |

### 10. AI Meter

| Must prove | Notes |
|------------|-------|
| Every AI feature charges correct action **once** | Entitlement / top-up / period reset |
| No silent unmetered production path | List bypasses = 0 |

### 11. Voice

| Must prove | Notes |
|------------|-------|
| STT → reasoning → TTS | Voice-credit consume / restore |
| Same intelligence as text where promised | Failure handling |

### 12. RevenueCat / IAP

| Must prove | Notes |
|------------|-------|
| UI SKU → product ID → RC offering → ASC product → server credit | Legacy IDs honoured if required |

### 13. Subscriptions / paywalls

| Must prove | Notes |
|------------|-------|
| Free exhausted / paid exhausted / upgrade / top-up | Copy + entitlement behaviour |
| `navigateToSubscription()` dismissible modal | Never trap on tab bar |

### 14. Events / GON / Today

| Must prove | Notes |
|------------|-------|
| Canonical outfit generator only | No bespoke styling bypass |

### 15. Julia support

| Must prove | Notes |
|------------|-------|
| Refund / cancel / missing purchase / support-case routing | Apple handoff |

### 16. Auth / profile / onboarding

| Must prove | Notes |
|------------|-------|
| State persistence | Entitlement sync |
| No duplicate / stale profile writes | Must not poison feature gates |

### 17. Weather / location

| Must prove | Notes |
|------------|-------|
| Single authoritative weather context where required | No duplicate expensive lookups |

### 18. Failure handling (cross-cutting)

| Must prove | Notes |
|------------|-------|
| Correct user-facing error class | timeout / meter / auth / provider / unsupported |

### 19. Observability (cross-cutting)

| Must prove | Notes |
|------------|-------|
| Staff-only trace for every critical AI workflow | Clipboard / Render / structured log |

---

## Agent operating rules (non-negotiable)

1. **Read-only first** for any complex feature reopen: architecture map + evidence class before patches.
2. **No heuristic thrash** (thresholds, grace, timing, confidence) without a sample-level or stage-level trace answering *why*.
3. **Do not claim PASS** from “implemented in code” or a single happy-path screenshot.
4. **Instrumentation must not be confused with product proof** — note if the diagnostic build can change cadence / timing (Quick Add lesson).
5. **Frozen territories stay frozen** (Live published snapshot; parked Quick Add autocapture heuristics) unless a new critical defect.
6. **After APPROVED**, add or extend a regression suite before large follow-on work.
7. **Ship discipline unchanged:** prefer EAS Update for JS; force-close/reopen; production + preview channels when shipping app changes.

---

## How to open a new feature audit

1. Add or update a row in the priority table above.  
2. Create or extend `docs/qa/<FEATURE>_CANONICAL_AUDIT.md` (read-only).  
3. Fill the **sign-off card**.  
4. Attach ≥1 runtime trace artefact (log excerpt, Copy-trace JSON, Render `[REQ]` lines) **or** cite the deterministic suite command + result.  
5. Only then schedule fixes.  
6. Re-run sign-off; update this master status column.

---

## Immediate next step

| Step | Owner | Artefact |
|------|-------|----------|
| Fill generalised 7 Chat behavioural baseline | QA / user | `RETEST_GENERALISED_7.md` |
| Keep Quick Add customer path = manual shutter | Already shipped | OTA “disable customer Quick Add autocapture” |
| Do not reopen Live / autocapture heuristics | Agents | This doc + existing freeze rules |

When Chat’s generalised 7 table is frozen, update row **#1** with dated note and proceed only per `STYLIST_CHAT_CANONICAL_CONTRACT.md` (Phase 1+), not ad-hoc chat patches.

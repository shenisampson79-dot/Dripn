# Stylist Chat — scroll bounce / resistance (READ-ONLY)

**Date:** 2026-08-25  
**Mode:** Read-only architecture + code trace — then **bounded stick-yield fix** (client-only; no OTA until review)  
**Prior frozen:** Allocator · Hard-lock · Contract 3 / travel · C1 · C2 · C4  
**Symptom class (authorized):** mid-thread yank / stick resistance (primary). Native `bounces` left unchanged this pass.

---

## Question

Why does Stylist Chat feel like it **bounces** or **resists** when the user scrolls (especially near edges / while messages update)?

---

## Production route (code-traced)

```
AIStylistScreen (text mode)
  → FlatList (messages)
       onScroll → onChatScroll → chatStateMachine.onUserScrollEvent
       onContentSizeChange → maybe scrollChatToEnd(true)
       onLayout → maybe scrollChatToEnd(true)
  → scrollChatToEnd → scrollToOffset(CHAT_SCROLL_END_OFFSET=1e9) + multi setTimeout retries
  → KeyboardStickyView (composer)
```

**Source of truth for stickiness:** `utils/chatStateMachine` (`LOCKED_TO_BOTTOM` vs `USER_SCROLLING`) + refs `stickToLatestRef` / `isNearBottomRef`.  
**Helpers:** `utils/stylistChatScroll.ts` (near-bottom + programmatic lock ms — partially mirrored / unused by FlatList props).  
**Regression suite today:** `scripts/verify-stylist-chat-scroll.ts` — proves **re-entry lock + programmatic unlock immunity**, **not** bounce/overscroll physics.

---

## FlatList surface props (bounce-relevant)

From `screens/AIStylistScreen.tsx` (~5511–5545):

| Prop | Set? | Default / effect |
| --- | --- | --- |
| `bounces` | **Not set** | iOS default **`true`** → rubber-band at ends |
| `alwaysBounceVertical` | **Not set** | iOS default often **true** when content shorter than viewport |
| `overScrollMode` | **Not set** | Android default allows glow/overscroll |
| `decelerationRate` | **Not set** | Platform default |
| `nestedScrollEnabled` | **Not set** | — |

**CODE-TRACED:** Chat FlatList never disables native bounce. Elsewhere in app (e.g. `DFYStylePlanScreen`) some lists explicitly set `bounces={false}` — Chat does not.

---

## Stick / “resistance” behavior (separate from rubber-band)

### A. Aggressive programmatic re-stick

`scrollChatToEnd` (force path):

1. Sets `LOCKED_TO_BOTTOM` + `programmatic: true`
2. `scrollToOffset({ offset: 1e9 })` (overshoot)
3. Retries at **0 / 60 / 180 / 420 / 900 / 1600 ms**
4. Clears programmatic flag only after **~1700 ms**

Also triggered by:

- focus / re-entry (timers 80–2200 ms)
- `messages.length` change
- keyboard show/hide
- `isTyping` toggle
- `onContentSizeChange` if locked / near-bottom / stick / **isTyping**
- `onLayout` if locked / stick

**Implication (CODE-TRACED):** While `programmatic` or phase `GENERATING`/`RENDERING`, `onUserScrollEvent` **refuses to unlock** to `USER_SCROLLING`. User scroll gestures during the ~1.7s window after any stick pulse are treated as system scroll → **feels like resistance / yank-back**, especially when images/history hydrate (`onContentSizeChange`).

### B. Content-size fight while reading history

`onContentSizeChange` re-calls `scrollChatToEnd(true)` when `isTyping` **even if** the user has scrolled up — because the condition includes `isTyping` OR stick flags. That can yank a user out of history mid-reply (**resistance / bounce-back**), distinct from iOS rubber-band.

### C. Nested ScrollViews

Header / continuity chips use inner `ScrollView`s (~5285, ~5342). Horizontal chip scroll can contribute nested gesture friction; not proven as primary bounce.

---

## Existing CSM invariants (what is already proven)

`verify-stylist-chat-scroll.ts` **PASS** for:

1. Re-entry from mid-thread → `LOCKED_TO_BOTTOM`
2. Programmatic frames do not unlock on `onUserScrollEvent(..., nearBottom=false)`
3. Near-bottom threshold math
4. `CHAT_SCROLL_END_OFFSET` overshoot

**Not covered:** `bounces`, overscroll, user-scroll while typing content growth, conflict between rubber-band and `scrollToOffset(1e9)`.

---

## Candidate first broken hops (hypothesis ranking — UNPROVEN on device)

| Rank | Hop | Class | Symptom match |
| --- | --- | --- | --- |
| 1 | FlatList default **`bounces={true}`** (iOS rubber-band) | CODE-TRACED gap | Edge bounce feel |
| 2 | Programmatic lock + multi-retry `scrollToOffset(1e9)` while user scrolls | CODE-TRACED | Resistance / snap-back |
| 3 | `onContentSizeChange` + `isTyping` force-stick | CODE-TRACED | Yank during live reply / image load |
| 4 | Nested header ScrollView gesture competition | CODE-TRACED possible | Minor |

**Do not patch yet** — need one device classification of which hop the user reports (edge rubber-band vs mid-thread yank).

---

## Suggested device matrix (when authorized — not run this pass)

1. Short thread, scroll past top/bottom — observe rubber-band only.  
2. Mid-thread scroll up, then send a message / wait while typing indicator — observe yank.  
3. Scroll up during outfit image hydrate — observe content-size re-stick.  
4. Re-enter chat from another tab — must still land on latest (must keep CSM contract).

---

## Out of scope (frozen)

Travel / C3, timeouts, allocator, Prefer Partial, weather, C2/C4, TrendScanner, duplicate matrix, rate limiter.

---

## Verdict (read-only)

**Two distinct mechanisms coexist:**

1. **Native bounce** — enabled by omission on Chat FlatList (**likely primary “bounce”**).  
2. **Stick-to-latest machinery** — intentional WhatsApp lock that can **resist** user history browsing for ~1.7s after programmatic scrolls and while typing/content grows.

Existing verify suite protects (2)’s lock invariants but does **not** address (1) or typing/content-size yank.

**STOP** — await device symptom class + fix authorization before changing FlatList props or CSM.

---

## Bounded fix (2026-08-25) — stick yield (pre-OTA)

**Authorized primary:** mid-thread yank / stick resistance.

| Change | Behavior |
| --- | --- |
| `releaseStickForUserIntent` + FlatList `onScrollBeginDrag` | First intentional drag cancels stick ownership |
| Stick pulse generation (`stylistChatScroll`) | Pending `scrollChatToEnd` retries become no-ops |
| `mustScrollToBottom` / `shouldAutoStickOnContentChange` | `USER_SCROLLING` blocks typing/content-size re-stick |
| `transitionPhase` | Does not steal ownership after user scroll-away |
| `acquireStickOwnership` + `scrollChatToEnd(force=true)` | Send / focus still pin to bottom |
| Native `bounces` | **Unchanged** |

Fixtures: `scripts/verify-stylist-chat-scroll.ts` (cases 1–5) **PASS**. No OTA until review.

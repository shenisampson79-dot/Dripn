# Hard-lock mention resolution — read-only trace

**Date:** 2026-08-25  
**Mode:** TRUTHMODE — diagnosis only (**no patch**)  
**Ask under test:** *“I definitely want to wear my cream henley shirt. Build the rest around it.”*  
**Runtime evidence (prior):** ~3s · route OK · `lock_not_honored` · locks attempted on **91** (cream henley) + **59** (Primark cream crew-neck tee)

**Ledger status:**

| Gate | Status |
| --- | --- |
| Hard-lock **routing** | **PASS** (deterministic + runtime) |
| Hard-lock **resolution** | **OPEN** — this defect |
| Hard-lock workstream (overall) | **OPEN** — do not mark frozen |

**Out of scope (do not touch):** allocator, Tier A/B, evaluator, C2/C4, timeout, outfit scoring.

---

## Trace (USER → LOCKS)

```text
USER ask
→ CLIENT resolveOutfitRoute → outfit-from-wardrobe / hard_lock          [PASS]
→ CLIENT AIStylistScreen
     matchWardrobeItemsInText(ask, wardrobe, 4)
     wear my / build around → lockedItems = ALL matches                 [BROKEN POLICY]
→ POST /api/chat/outfit-from-wardrobe { lockedItems?, message }
→ SERVER buildChatWardrobeOutfit
     mentionHardAsk = true  (wear my | build around | …)
     mentioned = resolveReferencedItemHints ∪ matchWardrobeItemsInText  [same scorer ×2]
     mustFromMentions = unique IDs from mentioned
     locked = client locks ∪ mustFromMentions                           [BROKEN POLICY]
→ lockedItemsClash(two cream tops) → null (not athletic+blazer)
→ createWardrobeOutfit(mustInclude both tops) → lock_not_honored ~3s
```

Scripted score evidence: `Dripn-Server/scripts/trace-hard-lock-mention-resolution.mjs`

| ID | Name | Path | Matched tokens | Score |
| --- | --- | --- | --- | ---: |
| **91** | cream henley shirt | full_name_substring | cream, henley, shirt | **68** |
| **59** | Primark Cream Crew Neck T-Shirt | token_overlap_ge2 | **cream, shirt** | **18** |

---

## Answers to the five questions

### 1. Why does ID 59 survive despite distinctive token `henley`?

`scoreItemMatch` never requires that a candidate explain **query** tokens. It only asks: what fraction of the **item name’s** tokens appear in the query?

For 59: name tokens = `{primark, cream, crew, neck, shirt}` → matched `{cream, shirt}` → `matched.length >= 2` and `ratio 0.4 >= 0.38` → **score 18**.

`henley` is present in the query and covered by 91, but **nothing subtracts** 59 for failing to account for `henley`. Colour + generic garment type is enough.

### 2. Are colour/category tokens treated as independent matches?

**Yes — as independent name-token hits**, not as evidence within a single garment phrase span.

- There is **no** phrase extraction after `wear my …`.
- There is **no** distinction between weak attributes (colour: cream) / generic types (shirt) vs distinctive types (henley).
- The gate `matched.length >= 2 && ratio >= 0.38` treats `cream`+`shirt` the same class as `henley`+`shirt`.

### 3. Can client and server disagree or independently add locks?

| Actor | Behaviour |
| --- | --- |
| Client | On `wear my` / `build around`, sets `lockedItems` to **all** `matchWardrobeItemsInText` hits (limit 4). |
| Server | On `mentionHardAsk`, unions **all** `mustFromMentions` into locks **regardless of client list**. |
| `resolveReferencedItemHints` | Alias of `matchWardrobeItemsInText(limit 4)` — duplicated into `mentioned[]`. |

They use the **same scorer** (client TS + server JS copies). They do **not** need to disagree to fail: **server alone** would add 91+59. Client amplifies by also sending both.

### 4. Smallest **general** resolution contract (proposed — not implemented)

**For singular hard-lock phrasing** (`wear my` / `build around it` / `using my` — and **not** a dual-garment ask):

1. Score candidates (existing scorer OK as input).
2. Select **at most one** lock when the ask is grammatically singular:
   - Prefer clear winner: highest score **and** margin ≥ threshold **or** uniquely covers a query token that no rival covers (e.g. `henley`).
3. If two+ same-role candidates remain inside an ambiguity band → **`partial_lock_clarify`**, do **not** dual-lock.
4. Promote multiple locks **only** when dual-garment ask / explicit multi-piece intent is true.

**Do not:** special-case `henley`, IDs 91/59, `cream`, or user 68.

### 5. Regression risks

| Phrase class | Risk if over-tightened | Risk if left as-is |
| --- | --- | --- |
| “cream top” (ambiguous) | Must **clarify**, not invent uniqueness | May dual-lock many cream tops |
| Two genuinely similar shirts | Must clarify | Same |
| Partial names (“my henley”) | Winner via distinctive token should still work | OK if winner rule uses query coverage |
| Brand + garment (“Gap denim shirt”) | Brand token should help winner | Weak brand-less rivals may still score on colour+shirt |
| Colour + garment (“cream shirt”) | Ambiguous → clarify | Dual-lock / wrong lock |
| Intentional multi-item (“tee and blazer”) | Must still allow 2 locks via dual-garment path | Dual path must stay intact |

---

## First broken function / root cause

| Layer | Function | Role |
| --- | --- | --- |
| **Enabling** | `scoreItemMatch` (`wardrobeMentionMatcher.js` / `.ts`) | Weak colour+type overlap clears the positive-match bar; distinctive query tokens are not discriminators |
| **First broken lock hop** | `buildChatWardrobeOutfit` mentionHardAsk lock merge (`chatWardrobeOutfitFast.js` ~357–402) | **Every** positive match becomes a hard lock; no winner / same-role ambiguity policy |
| **Client twin** | `AIStylistScreen` ~3395–3403 | Same “all matches → lockedItems” policy |

**Root cause (one sentence):** Singular hard-lock asks promote the **full soft-match list** to hard `mustInclude`s, while scoring admits rivals on shared weak tokens (`cream`+`shirt`) without requiring coverage of distinctive query tokens (`henley`).

---

## Deterministic fixture matrix (proposed — implement only after auth)

| # | Ask | Wardrobe fixtures | Expect |
| --- | --- | --- | --- |
| R1 | cream henley shirt + build around | henley 91 + cream tee 59 | Lock **91 only** |
| R2 | “cream top” / “cream shirt” | 91 + 59 | Clarify (ambiguous), lock neither silently |
| R3 | “my henley” | 91 + 59 | Lock **91** (distinctive token) |
| R4 | “Gap denim button-up” | 56 + other Gap shirt | Lock best unique; clarify if tied |
| R5 | “running top and smartest blazer” | athletic top + blazer | Dual lock / dual path unchanged |
| R6 | Two near-identical “black tee” names | two black tees | Clarify |
| R7 | Brand-only miss (“my Uniqlo shirt” none) | no Uniqlo | No false lock / clarify empty |

---

## STOP

**Implemented (2026-08-25):** evidence-dominance resolution at hard-lock promotion (`hardLockMentionResolution.js` / `.ts`), server authoritative (ignores over-broad client + plan soft lists for singular), client aligned.

**Fixtures R1–R8:** PASS (`node scripts/test-hard-lock-mention-resolution.mjs`)

**Runtime user 68:** PASS — ask cream henley → `create_wardrobe_outfit`, itemIds include **91**, not 59, **~907 ms**

Await ship authorization (Render + OTA). Do not reopen matcher polish.

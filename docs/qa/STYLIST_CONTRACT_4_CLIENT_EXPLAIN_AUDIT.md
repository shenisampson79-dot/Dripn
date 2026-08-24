# Client audit — `buildDeterministicOutfitExplain.ts` (Contract 4 companion)

**Date:** 2026-08-24  
**Mode:** READ / verify only — **not deleted**.

## Reachability

| Caller | Path | Customer-facing? |
|--------|------|------------------|
| `utils/generatedOutfit.ts` → `displayFromServerItems` | Today’s Outfit / occasion chips when packaging server or offline display | **Yes** (non-Chat-outfit-from-wardrobe surfaces) |
| `scripts/verify-ivy-outfit-qa-prompts.ts` | QA script | No |
| `screens/AIStylistScreen.tsx` canonical create | Uses `sendWardrobeOutfitFromChat` → server `displayText` | **No** — does not call this util |

## Conclusion

- Canonical Chat `/api/chat/outfit-from-wardrobe` success path does **not** use this file.
- It remains a **parallel** template personality for client-side packaging (`generatedOutfit`).
- Do **not** delete for name-overlap reasons.
- Follow-up (separate PR): align `displayFromServerItems` to prefer server `stylistMessage` / sealed body when present, and only use an **evidence-derived** fallback (same rules as server) when offline — or route those surfaces through the shared explanation contract later.

## Banned phrases still live here

`Tuned for about`, `Quiet elevation for …` still exist in this client util. Harmless for Chat outfit-from-wardrobe; relevant if occasion-chip / Today’s Outfit UI shows the footer from this function after a server response that omitted prose.

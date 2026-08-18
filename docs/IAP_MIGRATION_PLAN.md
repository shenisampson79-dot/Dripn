# IAP Migration Plan — Dripn (StyleWise)

This document outlines the phased migration from Stripe/WebBrowser checkout to Apple In-App Purchase (IAP) on iOS, while keeping Stripe on web and Android until Play Billing is added.

## 1. App Store Connect Products

### Subscription group: `dripn_subscriptions`

| Product ID | Type | Tier mapping | Notes |
|---|---|---|---|
| `com.dripn.personal_stylist.monthly` | Auto-renewable | `personal_stylist` | ~$9.99/mo |
| `com.dripn.personal_stylist.yearly` | Auto-renewable | `personal_stylist` | Annual discount |
| `com.dripn.stylist_unlimited.monthly` | Auto-renewable | `stylist_unlimited` | ~$19.99/mo |
| `com.dripn.stylist_unlimited.annual` | Auto-renewable | `stylist_unlimited` | Annual discount |

### DFY one-time (non-consumable)

| Product ID | Type | Maps to | RevenueCat entitlement |
|---|---|---|---|
| `com.dripn.dfy.lite` | Non-consumable | DFY Travel Capsule (`outfit_setup`) | `dfy_lite` |
| `com.dripn.dfy.core` | Non-consumable | DFY Core / Full Setup (`core_wardrobe`) | `dfy_core` |

### Voice credits (consumable)

| Product ID | Type | What user gets | Stripe package |
|---|---|---|---|
| `com.dripn.voice.boost.30` | Consumable | 30 spoken replies | `boost` |
| `com.dripn.voice.pro.80` | Consumable | 80 spoken replies | `pro` |
| `com.dripn.voice.weekend_unlimited` | Consumable | Unlimited voice for 48 hours | `weekend` |
| `com.dripn.ai.topup` | Consumable | +300 AI credits (AI Top-Up) | — |
| `com.dripn.ai.topup.600` | Consumable | +600 AI credits (AI Top-Up Plus) | — |

Legacy IDs (`com.dripn.personal_stylist.annual`, `credits_10`, `credits_40`, etc.) remain honoured server-side for existing purchases. New Personal Stylist purchases use the canonical `.yearly` product.

Create all products in App Store Connect → Subscriptions / In-App Purchases, with localized display names matching in-app copy.

## 2. Recommended SDK: RevenueCat

**Decision: RevenueCat (`react-native-purchases`)**

| Option | Pros | Cons |
|---|---|---|
| **RevenueCat** ✅ | Cross-platform entitlements, Server Notifications v2 handling, restore purchases, analytics, Expo config plugin | SaaS dependency, cost at scale |
| `expo-in-app-purchases` | Expo-native | Limited maintenance, no entitlement layer |
| `react-native-iap` | Mature, direct StoreKit | More boilerplate, you own receipt validation |

RevenueCat reduces server receipt-validation complexity and aligns with phased rollout (subs → DFY → consumables).

## 3. Server Changes (Dripn-Server)

1. **Apple Server Notifications v2** — New route `POST /api/apple/notifications` to receive subscription lifecycle events (renewal, cancel, refund, grace period).
2. **Entitlement sync** — Extend `users` with `appleOriginalTransactionId`, `appleProductId`, `billingPlatform` (`stripe` | `apple`).
3. **Hide Stripe on iOS** — `GET /api/subscription/checkout` returns 400 on iOS user-agent or when `billingPlatform=apple`; client uses IAP only.
4. **Receipt validation** — RevenueCat webhooks **or** direct App Store Server API verification for DFY/voice one-offs.
5. **Delete account** — Already cancels Stripe; add App Store subscription revoke via RevenueCat / StoreKit transaction lookup.
6. **DFY entitlements** — Grant `dfyAccess` from Apple purchase receipt, not Stripe session alone.

## 4. Client Changes (StyleWise)

1. Replace `WebBrowser.openBrowserAsync` Stripe checkout paths on iOS with `Purchases.purchasePackage()`.
2. **Restore Purchases** — Button on SubscriptionScreen + Settings (required by App Review).
3. **`shouldUseAppleIAP()`** — Gate in `utils/platformPayments.ts` (scaffolded).
4. **SubscriptionScreen** — Show App Store pricing strings from StoreKit; remove Stripe fine print on iOS when live.
5. **Cancel flow** — Deep link to iOS Settings → Subscriptions (Apple-managed); keep Stripe portal on web.
6. **Testing** — StoreKit Configuration file + RevenueCat sandbox users.

## 5. Phased Rollout Order

| Phase | Scope | Ship criteria |
|---|---|---|
| **1** | Subscriptions (Personal Stylist + Stylist Unlimited) | RevenueCat entitlements match `subscriptionTier`; restore works |
| **2** | DFY one-time SKUs | Post-purchase unlock via server webhook |
| **3** | Voice credit consumables | Credit balance sync + receipt consume | **Done** |

Do **not** ship Stripe checkout on iOS production builds after Phase 1 is live.

## 10. Phase 3 Completion Notes (Voice Credit Consumables)

**Status: Implemented (client + server) — all IAP phases complete**

### What shipped

| Area | Implementation |
|---|---|
| `AppleIAPService.ts` | `purchaseVoiceCredits(packId)`, `getVoiceCreditPrices()`, `serializeVoiceCustomerInfoForSync` |
| `useVoiceCredits.ts` | iOS production uses Apple IAP; Stripe on web/Android; sync + balance refresh |
| AI Stylist → Voice mode (`PersonalStylistVoicePanel`) | Buy credits modal with App Store prices when available |
| Server sync | `POST /api/voice/apple/sync` — idempotent credit grant via `voice_credit_purchases` table |
| Server webhook | `POST /api/webhooks/revenuecat` — handles consumable voice product IDs |
| Stripe block | `POST /api/voice-credits/purchase` returns 400 when `billing_platform=apple` |

### Consumables vs Restore Purchases

Apple **does not restore consumables** via Restore Purchases. Voice credits live on the **server account** (`voice_credits.purchased_credits`). AI Top-Up credits live on **`users.purchased_ai_credits`**. After login, balances sync from the server. Duplicate grants are prevented by unique `apple_transaction_id` (`voice_credit_purchases` / `ai_topup_purchases`). Do **not** re-grant AI Top-Up packs from Restore Purchases.

### App Store Connect — create these products

| Product ID | Type | Credits | RevenueCat |
|---|---|---|---|
| `com.dripn.voice.credits_10` | Consumable | 10 | Add to default offering (no entitlement) |
| `com.dripn.voice.credits_25` | Consumable | 25 | Add to default offering |
| `com.dripn.voice.credits_50` | Consumable | 50 | Add to default offering |
| `com.dripn.voice.credits_100` | Consumable | 100 | Add to default offering |

### Sandbox testing (voice credits)

1. Create consumable IAPs in App Store Connect with IDs above
2. Add products to RevenueCat project (consumables — no entitlement mapping required)
3. Set `EXPO_PUBLIC_FORCE_APPLE_IAP=true` for dev builds or use production iOS build
4. Sign in with Sandbox Apple ID on device
5. Open Voice Conversation → **Buy credits** → purchase a pack
6. Confirm `POST /api/voice/apple/sync` returns `creditsAdded` and balance updates
7. Repeat same sandbox purchase with a new transaction — credits add again
8. Re-sync same `originalTransactionId` — server returns `alreadySynced: true` (no double credit)
9. **Restore Purchases** does not re-grant consumables — verify balance still correct after re-login

### IAP migration summary (Phases 1–3)

| Phase | Product type | Client | Server sync route |
|---|---|---|---|
| 1 | Subscriptions | `purchaseSubscription` | `POST /api/subscription/apple/sync` |
| 2 | DFY non-consumable | `purchaseDFY` | `POST /api/dfy/apple/sync` |
| 3 | Voice consumable | `purchaseVoiceCredits` | `POST /api/voice/apple/sync` |

All phases use RevenueCat on iOS production; Stripe remains on web/Android.

## 9. Phase 2 Completion Notes (DFY One-Time)

**Status: Implemented (client + server)**

### What shipped

| Area | Implementation |
|---|---|
| `AppleIAPService.ts` | `purchaseDFY(tier)`, `getDFYPrices()`, `serializeDfyCustomerInfoForSync`, DFY restore via `restorePurchases()` |
| `DFYComparisonScreen.tsx` | iOS production uses Apple IAP instead of Stripe WebBrowser; App Store prices; Restore Purchases |
| `DFYStartScreen.tsx` | App Store DFY prices on paid add-on cards; auto-checkout on iOS routes to IAP |
| `SubscriptionScreen.tsx` | Restore Purchases also syncs DFY non-consumables |
| Server sync | `POST /api/dfy/apple/sync` — maps product/entitlement → `outfit_setup` / `core_wardrobe` via `handleOneTimePurchase` |
| Server webhook | `POST /api/webhooks/revenuecat` — handles `INITIAL_PURCHASE` / `NON_RENEWING_PURCHASE` for DFY product IDs |
| Stripe block | `POST /api/checkout/dfy/create-session` returns 400 when `billing_platform=apple` |

### App Store Connect — create these products

| Product ID | Type | RevenueCat entitlement | Server plan |
|---|---|---|---|
| `com.dripn.dfy.lite` | Non-consumable | `dfy_lite` | `outfit_setup` |
| `com.dripn.dfy.core` | Non-consumable | `dfy_core` | `core_wardrobe` |

Add both to the RevenueCat default offering (or a `dfy` offering) as non-subscription products.

### Sandbox testing (DFY)

1. Create non-consumable IAPs in App Store Connect with IDs above
2. Map to RevenueCat entitlements `dfy_lite` and `dfy_core`
3. Set `EXPO_PUBLIC_FORCE_APPLE_IAP=true` for dev builds or use production iOS build
4. Sign in with Sandbox Apple ID on device
5. From DFY Comparison (or paid add-on on DFY Start), purchase Travel Capsule or Full Setup
6. Confirm `POST /api/dfy/apple/sync` returns `tier: lite` or `core`
7. Test Restore Purchases on DFY Comparison or Subscription screen after reinstall

### Still TODO (post–Phase 2)

- [x] Phase 3 voice credit consumables
- [ ] DFY refund handling (revoke entitlement without breaking active subscription tier)
- [ ] Separate DFY purchase record from subscription tier for subscriber add-on purchases

## 8. Phase 1 Completion Notes (Subscriptions)

**Status: Implemented (client + server scaffolding)**

### What shipped

| Area | Implementation |
|---|---|
| Client SDK | `react-native-purchases` + Expo config plugin in `app.json` |
| `AppleIAPService.ts` | RevenueCat configure, `purchaseSubscription`, `restorePurchases`, `getCustomerInfo`, App Store price fetch |
| `platformPayments.ts` | `shouldUseAppleIAP()` = iOS && !`__DEV__` (override: `EXPO_PUBLIC_FORCE_APPLE_IAP=true`) |
| `SubscriptionScreen.tsx` | iOS production uses IAP; Restore Purchases button; App Store pricing; Stripe unchanged on web/Android |
| Server sync | `POST /api/subscription/apple/sync` — maps product/entitlement → `subscription_tier`, sets `billing_platform=apple` |
| Server webhook | `POST /api/webhooks/revenuecat` — handles INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION |
| DB columns | `billing_platform`, `apple_original_transaction_id`, `apple_product_id` on `users` |

### App Store Connect — create these products

**Subscription group:** `dripn_subscriptions`

| Product ID | Type | RevenueCat entitlement | Server plan |
|---|---|---|---|
| `com.dripn.personal_stylist.monthly` | Auto-renewable | `personal_stylist` | `style_chat` |
| `com.dripn.personal_stylist.yearly` | Auto-renewable | `personal_stylist` | `style_chat` |
| `com.dripn.stylist_unlimited.monthly` | Auto-renewable | `stylist_unlimited` | `stylist_unlimited` |
| `com.dripn.stylist_unlimited.annual` | Auto-renewable | `stylist_unlimited` | `stylist_unlimited` |

### RevenueCat dashboard setup

1. Create iOS app linked to bundle ID `com.dripn.app`
2. Add products above; map to entitlements `personal_stylist` and `stylist_unlimited`
3. Create default offering with monthly + annual packages per tier
4. Copy iOS public API key → `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` (StyleWise)
5. Configure webhook URL → `https://<server>/api/webhooks/revenuecat` with `REVENUECAT_WEBHOOK_SECRET`

### Sandbox testing

1. Create Sandbox Apple ID in App Store Connect → Users and Access → Sandbox
2. Set `EXPO_PUBLIC_FORCE_APPLE_IAP=true` in StyleWise `.env` for dev builds **or** use a production iOS build
3. Sign in to the sandbox Apple ID on device: Settings → App Store → Sandbox Account
4. Build with EAS/dev client (IAP requires native build — not Expo Go)
5. Subscribe on Subscription screen → confirm tier updates via `POST /api/subscription/apple/sync`
6. Test Restore Purchases with the same Apple ID on a fresh login

### Still TODO (post–Phase 1)

- [x] Direct App Store Server API receipt validation (RevenueCat REST + optional App Store Server API)
- [x] Stripe webhook ignore for `billing_platform=apple` users
- [x] Delete-account Apple subscription revoke path (RevenueCat subscriber delete + user notice)
- [x] Phase 3 voice consumables
- [x] DFY refund/revoke webhook handling
- [x] DFY add-on purchase record for subscribers (preserves subscription tier)

## 6. Estimated File Touch List

### Client (StyleWise)

- `utils/platformPayments.ts` (new — scaffolded)
- `services/AppleIAPService.ts` (new — scaffolded)
- `services/ApiService.ts` — Apple billing endpoints
- `screens/SubscriptionScreen.tsx` — IAP purchase UI, restore
- `components/CancelSubscriptionFlow.tsx` — platform-specific cancel copy
- `contexts/AuthContext.tsx` — refresh tier from RevenueCat
- `contexts/SubscriptionContext.tsx` — entitlement source
- `screens/DFYStartScreen.tsx`, `services/DFYService.ts` — DFY IAP
- `app.json` — IAP capability, no Stripe-only claims
- `package.json` — `react-native-purchases`

### Server (Dripn-Server)

- `index.js` — Apple notifications route, billing platform field
- Stripe webhook handlers — ignore iOS-Apple users for tier updates
- Delete-account — Apple subscription cancel path
- DFY unlock endpoints — accept Apple transaction IDs

## 7. App Review Checklist (post-migration)

- [ ] Restore Purchases visible and functional
- [ ] Privacy Policy + Terms linked on paywall
- [ ] No external payment links on iOS for digital goods
- [ ] Subscription management instructions point to Apple Settings
- [ ] DFY and voice products use IAP product IDs matching App Store Connect

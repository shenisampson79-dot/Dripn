# IAP Migration Plan — Dripn (StyleWise)

This document outlines the phased migration from Stripe/WebBrowser checkout to Apple In-App Purchase (IAP) on iOS, while keeping Stripe on web and Android until Play Billing is added.

## 1. App Store Connect Products

### Subscription group: `dripn_subscriptions`

| Product ID | Type | Tier mapping | Notes |
|---|---|---|---|
| `com.dripn.personal_stylist.monthly` | Auto-renewable | `personal_stylist` | ~$9.99/mo |
| `com.dripn.personal_stylist.annual` | Auto-renewable | `personal_stylist` | Annual discount |
| `com.dripn.stylist_unlimited.monthly` | Auto-renewable | `stylist_unlimited` | ~$19.99/mo |
| `com.dripn.stylist_unlimited.annual` | Auto-renewable | `stylist_unlimited` | Annual discount |

### DFY one-time (non-consumable or consumable per Apple guidance)

| Product ID | Type | Maps to |
|---|---|---|
| `com.dripn.dfy.styling_sprint` | Non-consumable | DFY Lite / Quick Start |
| `com.dripn.dfy.wardrobe_setup` | Non-consumable | DFY Core / Full Setup |

### Voice credits (consumable)

| Product ID | Type | Notes |
|---|---|---|
| `com.dripn.voice.credits_10` | Consumable | 10 TTS/voice comment credits |
| `com.dripn.voice.credits_50` | Consumable | 50 credits pack |

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
| **3** | Voice credit consumables | Credit balance sync + receipt consume |

Do **not** ship Stripe checkout on iOS production builds after Phase 1 is live.

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
| `com.dripn.personal_stylist.annual` | Auto-renewable | `personal_stylist` | `style_chat` |
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

- [ ] Direct App Store Server API receipt validation (currently trusts client sync + RevenueCat webhook)
- [ ] Stripe webhook ignore for `billing_platform=apple` users
- [ ] Delete-account Apple subscription revoke path
- [ ] Phase 2 DFY one-time IAP, Phase 3 voice consumables

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

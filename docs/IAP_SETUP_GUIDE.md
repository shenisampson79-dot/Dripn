# Dripn IAP Setup Guide — App Store Connect + RevenueCat

Complete setup guide for all **10** in-app purchase products used by Dripn (StyleWise iOS + Dripn-Server). Product IDs are exact strings from `AppleIAPService.ts` and `appleIAPService.js`.

**Bundle ID:** `com.dripn.app`  
**Subscription group reference name:** `dripn_subscriptions`

---

## 1. The 10 Products Table

| # | Product ID | Type | Display Name Suggestion | UK Price Target (GBP) | Subscription Group | RevenueCat Entitlement | App Feature |
|---|------------|------|-------------------------|----------------------|--------------------|------------------------|-------------|
| 1 | `com.dripn.personal_stylist.monthly` | Auto-renewable subscription | Personal Stylist (Monthly) | **£9.99/mo** | `dripn_subscriptions` | `personal_stylist` | **SubscriptionScreen** — entry subscription tier (unlimited stylist decisions, wardrobe-aware advice) |
| 2 | `com.dripn.personal_stylist.annual` | Auto-renewable subscription | Personal Stylist (Annual) | **£95.99/yr** (~20% off monthly) | `dripn_subscriptions` | `personal_stylist` | **SubscriptionScreen** — same tier, annual billing |
| 3 | `com.dripn.stylist_unlimited.monthly` | Auto-renewable subscription | Stylist Unlimited (Monthly) | **£19.99/mo** | `dripn_subscriptions` | `stylist_unlimited` | **SubscriptionScreen** — top tier (outfit calendar, unlimited wardrobe, priority processing) |
| 4 | `com.dripn.stylist_unlimited.annual` | Auto-renewable subscription | Stylist Unlimited (Annual) | **£191.99/yr** (~20% off monthly) | `dripn_subscriptions` | `stylist_unlimited` | **SubscriptionScreen** — same tier, annual billing |
| 5 | `com.dripn.dfy.lite` | Non-consumable | Outfit-Based Setup (DFY Lite) | **£19.99** one-time | — | `dfy_lite` | **DFYComparisonScreen** / **DFYStartScreen** — Quick Start / occasion outfit setup |
| 6 | `com.dripn.dfy.core` | Non-consumable | Core Wardrobe Setup (DFY Core) | **£39.99** one-time | — | `dfy_core` | **DFYComparisonScreen** / **DFYStartScreen** — full wardrobe foundation (up to 30 items) |
| 7 | `com.dripn.voice.credits_10` | Consumable | 10 Voice Messages | **£1.00** | — | **consumable — no entitlement** | **AI Stylist voice mode** — Buy credits modal (`small` pack) |
| 8 | `com.dripn.voice.credits_25` | Consumable | 25 Voice Messages | **£2.00** | — | **consumable — no entitlement** | **AI Stylist voice mode** — Buy credits modal (`medium` pack) |
| 9 | `com.dripn.voice.credits_50` | Consumable | 50 Voice Messages | **£4.00** | — | **consumable — no entitlement** | **AI Stylist voice mode** — Buy credits modal (`large` pack) |
| 10 | `com.dripn.voice.credits_100` | Consumable | 100 Voice Messages | **£7.00** | — | **consumable — no entitlement** | **AI Stylist voice mode** — Buy credits modal (`xlarge` pack) |

### Price sources (server code)

| Product | Source | Amount |
|---------|--------|--------|
| Personal Stylist monthly/annual | `BILLING_PLANS.style_chat` | £9.99 / £95.99 |
| Stylist Unlimited monthly/annual | `BILLING_PLANS.stylist_unlimited` | £19.99 / £191.99 |
| DFY Lite | `BILLING_PLANS.outfit_setup` | £19.99 |
| DFY Core | `BILLING_PLANS.core_wardrobe` | £39.99 |
| Voice packs | `VOICE_CREDIT_PACKAGES` | £1.00 / £2.00 / £4.00 / £7.00 |

In App Store Connect, pick the **UK price tier** that matches these GBP amounts (Apple tiers may not match penny-perfect in every territory — UK is the primary reference).

### Important naming note

Apple product IDs use `personal_stylist`, but the server maps them to the canonical plan **`style_chat`** (not the legacy `personal_stylist` plan at £14.99). RevenueCat entitlement ID must be exactly **`personal_stylist`**.

| Layer | Personal Stylist products map to |
|-------|----------------------------------|
| Client (`AppleIAPService.ts`) | tier `personal_stylist` |
| RevenueCat | entitlement `personal_stylist` |
| Server (`appleIAPService.js`) | plan `style_chat` |

### Legacy IDs (do not create — for reference only)

The server accepts these aliases but the app uses the 10 IDs above:

- `com.dripn.dfy.styling_sprint` → same as `dfy.lite`
- `com.dripn.dfy.wardrobe_setup` → same as `dfy.core`
- `com.dripn.voice.10`, `.30`, `.60` → old voice IDs

---

## 2. App Store Connect — Step by Step

### Prerequisites

1. **Paid Apple Developer Program** membership (Account Holder or Admin).
2. **App record** for Dripn with bundle ID **`com.dripn.app`** registered under Certificates, Identifiers & Profiles.
3. App Store Connect app created and linked to that bundle ID.
4. **Paid Applications Agreement** signed (Agreements, Tax, and Banking).
5. Banking and tax info complete (required before IAPs go live).
6. **In-App Purchase capability** enabled on the app identifier.

### A. Create subscription group + 4 subscription products

1. App Store Connect → **My Apps** → Dripn → **Subscriptions**.
2. Click **+** to create a subscription group.
   - **Reference name:** `dripn_subscriptions`
   - **Group display name (localized):** e.g. "Dripn Subscriptions"
3. Inside the group, create **4 auto-renewable subscriptions** with these **exact Product IDs**:

| Product ID | Duration | Suggested reference name |
|------------|----------|--------------------------|
| `com.dripn.personal_stylist.monthly` | 1 month | Personal Stylist Monthly |
| `com.dripn.personal_stylist.annual` | 1 year | Personal Stylist Annual |
| `com.dripn.stylist_unlimited.monthly` | 1 month | Stylist Unlimited Monthly |
| `com.dripn.stylist_unlimited.annual` | 1 year | Stylist Unlimited Annual |

4. For each subscription, configure:
   - **Subscription prices:** UK → £9.99 / £95.99 / £19.99 / £191.99 (add other territories as needed).
   - **Localization:** display name + description matching in-app copy (e.g. "Unlimited stylist decisions, wardrobe-aware advice").
   - **Review information:** screenshot of the Subscription paywall (`SubscriptionScreen`).
   - **Subscription group level:** set rank so `stylist_unlimited` is higher than `personal_stylist` (upgrade path).
   - **Family Sharing:** your choice (typically off for this model).

### B. Create 2 non-consumable DFY products

1. App Store Connect → Dripn → **In-App Purchases** → **+** → **Non-Consumable**.

| Product ID | Display name | Price (UK) |
|------------|--------------|------------|
| `com.dripn.dfy.lite` | Outfit-Based Setup | £19.99 |
| `com.dripn.dfy.core` | Core Wardrobe Setup | £39.99 |

2. Add localized descriptions (24-hour / 24–48-hour delivery copy from `DFY_PRODUCTS`).
3. Add review screenshot from **DFYComparisonScreen** or **DFYStartScreen**.

### C. Create 4 consumable voice products

1. **In-App Purchases** → **+** → **Consumable**.

| Product ID | Display name | Credits | Price (UK) |
|------------|--------------|---------|------------|
| `com.dripn.voice.credits_10` | 10 Voice Messages | 10 | £1.00 |
| `com.dripn.voice.credits_25` | 25 Voice Messages | 25 | £2.00 |
| `com.dripn.voice.credits_50` | 50 Voice Messages | 50 | £4.00 |
| `com.dripn.voice.credits_100` | 100 Voice Messages | 100 | £7.00 |

2. Add review screenshot from **AI Stylist → Voice mode** → Buy credits modal.

### D. Localization & pricing notes

- Add at least **English (U.K.)** localization for every product (name + description).
- Use the same marketing language as Stripe/web copy where possible.
- Set **United Kingdom** pricing first, then propagate or customize other storefronts.
- Annual subs should reflect ~20% savings vs 12× monthly (matches `BILLING_PLANS` yearly amounts).

### E. Sandbox tester setup

1. App Store Connect → **Users and Access** → **Sandbox** → **Testers**.
2. Create a sandbox Apple ID (use a **+alias** email, e.g. `you+dripn-sandbox@gmail.com`).
3. On a **physical iOS device** (IAP does not work in Simulator for real StoreKit flows):
   - **Settings → App Store → Sandbox Account** → sign in with sandbox tester.
   - Do **not** use your real Apple ID for sandbox purchases.
4. Build a **native iOS app** (EAS dev client or production build — **not Expo Go**).

### F. Submit IAPs for review

1. Each IAP needs **Ready to Submit** status (metadata + screenshot complete).
2. IAPs are reviewed **with an app version** — you cannot submit IAPs standalone without attaching them to a build.
3. Workflow:
   - Upload iOS build via EAS/Xcode.
   - Create App Store version → select build.
   - Under **In-App Purchases and Subscriptions**, add all 10 products to the version.
   - Submit for review.
4. First subscription group submission may take longer; allow 24–48+ hours.

---

## 3. RevenueCat — Step by Step

### A. Create project & link App Store Connect

1. Sign up at [revenuecat.com](https://www.revenuecat.com) → **New Project** (e.g. "Dripn").
2. **Project Settings → Apps → + New** → **Apple App Store**.
   - **App name:** Dripn
   - **Bundle ID:** `com.dripn.app`
3. Link App Store Connect using **one** of:
   - **App Store Connect API key** (recommended): App Store Connect → Users and Access → Integrations → App Store Connect API → generate key with **App Manager** access. Upload Key ID, Issuer ID, and `.p8` file in RevenueCat.
   - **Shared secret** (legacy): App Store Connect → Apps → Dripn → App Information → App-Specific Shared Secret. Paste into RevenueCat.

4. After linking, RevenueCat can **import products** from App Store Connect (or add manually with exact Product IDs).

### B. Create entitlements

RevenueCat → **Entitlements** → create exactly these four:

| Entitlement ID | Purpose |
|----------------|---------|
| `personal_stylist` | Personal Stylist / Style Chat subscription |
| `stylist_unlimited` | Stylist Unlimited subscription |
| `dfy_lite` | DFY Outfit-Based Setup (one-time) |
| `dfy_core` | DFY Core Wardrobe Setup (one-time) |

Voice consumables get **no entitlement**.

### C. Map products to entitlements

RevenueCat → **Products** → for each App Store product, attach the entitlement:

| Product ID | Attach to entitlement |
|------------|----------------------|
| `com.dripn.personal_stylist.monthly` | `personal_stylist` |
| `com.dripn.personal_stylist.annual` | `personal_stylist` |
| `com.dripn.stylist_unlimited.monthly` | `stylist_unlimited` |
| `com.dripn.stylist_unlimited.annual` | `stylist_unlimited` |
| `com.dripn.dfy.lite` | `dfy_lite` |
| `com.dripn.dfy.core` | `dfy_core` |
| `com.dripn.voice.credits_10` | *(none — consumable)* |
| `com.dripn.voice.credits_25` | *(none)* |
| `com.dripn.voice.credits_50` | *(none)* |
| `com.dripn.voice.credits_100` | *(none)* |

### D. Create offering(s)

The app reads **`offerings.current`** and matches packages by **product identifier** (`findPackageByProductId` in `AppleIAPService.ts`).

**Default offering (required for subscriptions):**

1. RevenueCat → **Offerings** → edit **default** (or create and mark as Current).
2. Add packages — one per product. Suggested package identifiers:

| Package ID | Product |
|------------|---------|
| `personal_stylist_monthly` | `com.dripn.personal_stylist.monthly` |
| `personal_stylist_annual` | `com.dripn.personal_stylist.annual` |
| `stylist_unlimited_monthly` | `com.dripn.stylist_unlimited.monthly` |
| `stylist_unlimited_annual` | `com.dripn.stylist_unlimited.annual` |
| `dfy_lite` | `com.dripn.dfy.lite` |
| `dfy_core` | `com.dripn.dfy.core` |
| `voice_10` | `com.dripn.voice.credits_10` |
| `voice_25` | `com.dripn.voice.credits_25` |
| `voice_50` | `com.dripn.voice.credits_50` |
| `voice_100` | `com.dripn.voice.credits_100` |

3. Mark this offering as **Current**.

> **Note:** Subscriptions **must** be in the current offering or `purchaseSubscription()` throws. DFY and voice can fall back to `purchaseStoreProduct()`, but putting all 10 in the default offering is simplest.

**Optional separate `dfy` offering:** Not required by code — the app only uses `offerings.current`. A separate offering is fine for dashboard organization if you still set one offering as Current with all needed products.

### E. Webhook configuration

1. RevenueCat → **Project Settings → Integrations → Webhooks**.
2. **Webhook URL:**
   ```
   https://dripn-server.onrender.com/api/webhooks/revenuecat
   ```
3. **Authorization:** set a bearer token (generate a long random secret). The server validates:
   ```
   Authorization: Bearer <your-secret>
   ```
   (or raw header value — see `verifyRevenueCatWebhookAuth` in `appleIAPService.js`).

4. Enable events for: `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`, `NON_RENEWING_PURCHASE`, `REFUND`, `PRODUCT_CHANGE`, `UNCANCELLATION`, `BILLING_ISSUE`, `SUBSCRIPTION_EXTENDED`, `REVOCATION`.

### F. Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `REVENUECAT_WEBHOOK_SECRET` | **Dripn-Server** (Render) | Must match RevenueCat webhook bearer token |
| `REVENUECAT_REST_API_KEY` | **Dripn-Server** (Render) | Secret API key for server-side purchase validation + subscriber delete on account removal |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | **StyleWise** `.env` / EAS secrets | iOS **public** SDK key for `react-native-purchases` |

Optional (supplemental Apple validation on server):

| Variable | Purpose |
|----------|---------|
| `APPLE_APP_STORE_CONNECT_KEY_ID` | App Store Server API |
| `APPLE_APP_STORE_CONNECT_ISSUER_ID` | App Store Server API |
| `APPLE_APP_STORE_CONNECT_PRIVATE_KEY` | `.p8` key contents |
| `APPLE_BUNDLE_ID` | Defaults to `com.dripn.app` |

For local/sandbox IAP testing in dev builds, also set in StyleWise:

```
EXPO_PUBLIC_FORCE_APPLE_IAP=true
```

(Production iOS uses IAP automatically when `Platform.OS === 'ios' && !__DEV__`.)

### G. iOS SDK API key location

RevenueCat dashboard → **Project Settings → API keys → App specific keys**

- Copy the **iOS public API key** (starts with `appl_`).
- Paste into StyleWise as `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`.
- Do **not** use the secret key (`sk_`) in the mobile app.

### H. App user ID wiring

The app calls `Purchases.configure({ apiKey, appUserID: appUserId })` with the **Dripn server user ID** (numeric string). RevenueCat webhooks use `app_user_id` to find the user — keep this consistent.

---

## 4. Verification Checklist

### Confirm products appear in app (sandbox)

- [ ] All 10 IAPs show **Ready to Submit** or **Approved** in App Store Connect.
- [ ] RevenueCat → Products shows all 10 imported/linked with green status.
- [ ] Default offering is **Current** and contains subscription packages.
- [ ] `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` set in StyleWise; rebuild native app.
- [ ] Sandbox Apple ID signed in on device (Settings → App Store → Sandbox Account).
- [ ] For dev builds: `EXPO_PUBLIC_FORCE_APPLE_IAP=true`.

**Per product type:**

| Test | Expected result |
|------|-----------------|
| **Subscriptions** — open SubscriptionScreen | App Store price strings load; purchase succeeds; `POST /api/subscription/apple/sync` updates tier |
| **DFY** — DFYComparisonScreen | Prices load; purchase unlocks lite/core; `POST /api/dfy/apple/sync` returns `tier: lite` or `core` |
| **Voice** — AI Stylist → Voice mode → Buy credits | 4 packs with prices; purchase adds credits; `POST /api/voice/apple/sync` returns `creditsAdded` |
| **Restore Purchases** (SubscriptionScreen / DFY) | Subscriptions + DFY non-consumables restore; voice consumables do **not** restore (balance is server-side) |
| **Webhook** | RevenueCat dashboard → Webhooks → send test event; server logs `[RevenueCat Webhook] Received event:` |

### Server sync routes (reference)

| Phase | Client method | Server endpoint |
|-------|---------------|-----------------|
| Subscriptions | `purchaseSubscription` | `POST /api/subscription/apple/sync` |
| DFY | `purchaseDFY` | `POST /api/dfy/apple/sync` |
| Voice | `purchaseVoiceCredits` | `POST /api/voice/apple/sync` |

### Common mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Product ID typo (even one character) | "Product not found" / `UNKNOWN_VOICE_PRODUCT` | Copy IDs exactly from table above |
| Subscriptions not in RevenueCat **current** offering | `Subscription package not found for com.dripn...` | Add all 4 subs to default offering; mark Current |
| Wrong entitlement ID (e.g. `style_chat` instead of `personal_stylist`) | Purchase works but tier doesn't sync | Use `personal_stylist` and `stylist_unlimited` exactly |
| Using Expo Go | IAP never initializes | Use EAS dev client or production build |
| No sandbox account on device | Purchase dialog fails or uses production Apple ID | Sign in via Settings → App Store → Sandbox Account |
| `REVENUECAT_WEBHOOK_SECRET` mismatch | Webhook 401 Unauthorized | Match bearer token in RevenueCat and Render env |
| Missing `REVENUECAT_REST_API_KEY` on server | Validation skipped in dev; purchases may fail validation in prod | Set secret REST API key on Dripn-Server |
| Public vs secret key swapped | SDK configure fails or security risk | `appl_` in app, `sk_` on server only |
| Expecting Restore to re-grant voice credits | Credits missing after reinstall | Normal — consumables aren't restored; balance comes from `GET /api/voice-credits/balance` |
| IAPs not attached to app version at submit | IAPs stuck "Missing Metadata" or not reviewable | Attach all 10 to the App Store version before submit |
| Creating legacy product IDs (`voice.10`, `dfy.styling_sprint`) | App won't find them | Use only the 10 canonical IDs |
| Confusing `personal_stylist` product with legacy £14.99 Stripe plan | Wrong price tier in App Store | Personal Stylist IAP = **£9.99** (`style_chat` plan) |

---

## Quick Reference — Product ID → Server Mapping

```
Subscriptions (RevenueCat webhook + sync):
  com.dripn.personal_stylist.*  →  plan: style_chat      →  entitlement: personal_stylist
  com.dripn.stylist_unlimited.* →  plan: stylist_unlimited →  entitlement: stylist_unlimited

DFY (non-consumable):
  com.dripn.dfy.lite  →  plan: outfit_setup   →  entitlement: dfy_lite
  com.dripn.dfy.core  →  plan: core_wardrobe  →  entitlement: dfy_core

Voice (consumable — server credits, no entitlement):
  com.dripn.voice.credits_10  →  10 credits  (pack: small)
  com.dripn.voice.credits_25  →  25 credits  (pack: medium)
  com.dripn.voice.credits_50  →  50 credits  (pack: large)
  com.dripn.voice.credits_100 →  100 credits (pack: xlarge)
```

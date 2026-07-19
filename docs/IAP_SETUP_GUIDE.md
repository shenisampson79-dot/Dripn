# Dripn IAP Setup Guide — App Store Connect + RevenueCat

Complete setup guide for all **9** in-app purchase products used by Dripn (StyleWise iOS + Dripn-Server). Product IDs are exact strings from `AppleIAPService.ts` and `appleIAPService.js`.

**Bundle ID:** `com.dripn.app`  
**Subscription group reference name:** `dripn_subscriptions`

---

## 1. The 9 Products Table

| # | Product ID | Type | Display Name (UK, ≤30) | Description (UK, ≤45) | UK Price Target (GBP) | Subscription Group | RevenueCat Entitlement | App Feature |
|---|------------|------|------------------------|----------------------|----------------------|--------------------|------------------------|-------------|
| 1 | `com.dripn.personal_stylist.monthly` | Auto-renewable subscription | Look Better Every Day | Feel confident — less outfit stress | **£9.99/mo** | `dripn_subscriptions` | `personal_stylist` | **SubscriptionScreen** — daily styling confidence, faster decisions |
| 2 | `com.dripn.personal_stylist.yearly` | Auto-renewable subscription | Year of Style Confidence | Save 20% — confident looks all year long | **£95.99/yr** (~20% off monthly) | `dripn_subscriptions` | `personal_stylist` | **SubscriptionScreen** — same tier, annual billing |
| 3 | `com.dripn.stylist_unlimited.monthly` | Auto-renewable subscription | Plan Ahead, Dress Better | Less fatigue — always know what to wear | **£19.99/mo** | `dripn_subscriptions` | `stylist_unlimited` | **SubscriptionScreen** — life planning, less decision fatigue |
| 4 | `com.dripn.stylist_unlimited.annual` | Auto-renewable subscription | Your Best-Dressed Year | Save 20% — plan ahead, stress less all year | **£191.99/yr** (~20% off monthly) | `dripn_subscriptions` | `stylist_unlimited` | **SubscriptionScreen** — same tier, annual billing |
| 5 | `com.dripn.dfy.lite` | Non-consumable | Occasion Ready | Feel confident for what's coming up | **£19.99** one-time | — | `dfy_lite` | **DFYComparisonScreen** / **DFYStartScreen** — Occasion Ready / Quick Start |
| 6 | `com.dripn.dfy.core` | Non-consumable | Full Wardrobe Setup | Less stress — know what to wear every day | **£39.99** one-time | — | `dfy_core` | **DFYComparisonScreen** / **DFYStartScreen** — Full Wardrobe Setup / Full Setup |
| 7 | `com.dripn.voice.boost.30` | Consumable | Voice Boost | For when you want more personalised advice | **£2.99** | — | **consumable — no entitlement** | **AI Stylist voice mode** — Buy credits modal (`boost` pack) |
| 8 | `com.dripn.voice.pro.80` | Consumable | Pro Pack | Perfect for daily outfit planning | **£5.99** | — | **consumable — no entitlement** | **AI Stylist voice mode** — Buy credits modal (`pro` pack, Most Popular) |
| 9 | `com.dripn.voice.weekend_unlimited` | Consumable | 2-Day Unlimited | Unlimited voice for 48 hours — buy any day | **£8.99** | — | **consumable — no entitlement** | **AI Stylist voice mode** — Buy credits modal (`weekend` pack, 48h unlimited) |

### Price sources (server code)

| Product | Source | Amount |
|---------|--------|--------|
| Personal Stylist monthly/annual | `BILLING_PLANS.style_chat` | £9.99 / £95.99 |
| Stylist Unlimited monthly/annual | `BILLING_PLANS.stylist_unlimited` | £19.99 / £191.99 |
| DFY Lite | `BILLING_PLANS.outfit_setup` | £19.99 |
| DFY Core | `BILLING_PLANS.core_wardrobe` | £39.99 |
| Voice packs | `VOICE_CREDIT_PACKAGES` | £2.99 / £5.99 / £8.99 |

In App Store Connect, pick the **UK price tier** that matches these GBP amounts (Apple tiers may not match penny-perfect in every territory — UK is the primary reference).

### App Store Connect — subscription paste blocks (English U.K.)

Copy into each product's **Subscription Localization** fields:

**`com.dripn.personal_stylist.monthly`**
- Display name: `Look Better Every Day`
- Description: `Feel confident — less outfit stress`

**`com.dripn.personal_stylist.yearly`**
- Display name: `Year of Style Confidence`
- Description: `Save 20% — confident looks all year long`

**`com.dripn.stylist_unlimited.monthly`**
- Display name: `Plan Ahead, Dress Better`
- Description: `Less fatigue — always know what to wear`

**`com.dripn.stylist_unlimited.annual`**
- Display name: `Your Best-Dressed Year`
- Description: `Save 20% — plan ahead, stress less all year`

### App Store Connect — DFY paste blocks (English U.K.)

Copy into each **Non-Consumable** product's localization fields:

**`com.dripn.dfy.lite`**
- Display name: `Occasion Ready` (14 chars)
- Description: `Feel confident for what's coming up` (35 chars)

**`com.dripn.dfy.core`**
- Display name: `Full Wardrobe Setup` (20 chars)
- Description: `Less stress — know what to wear every day` (41 chars)

### App Store Connect — voice paste blocks (English U.K.)

Copy into each **Consumable** product's localization fields:

**`com.dripn.voice.boost.30`**
- Display name: `Voice Boost` (11 chars)
- Description: `For when you want more personalised advice` (42 chars)

**`com.dripn.voice.pro.80`**
- Display name: `Pro Pack` (8 chars)
- Description: `Perfect for daily outfit planning` (33 chars)

**`com.dripn.voice.weekend_unlimited`**
- Display name: `2-Day Unlimited` (15 chars)
- Description: `Unlimited voice for 48 hours — buy any day` (43 chars)

> **Legacy voice IDs** (`credits_10`, `credits_40`, `credits_80`, `credits_150`, `credits_25`, `credits_50`, `credits_100`) remain honoured server-side for existing purchases. Create the three canonical IDs above in ASC for new submissions.

> Full reference with quick-copy block: [`IAP_ASC_PASTE_BLOCKS_DFY_VOICE.md`](./IAP_ASC_PASTE_BLOCKS_DFY_VOICE.md)

### Important naming note

Apple product IDs use `personal_stylist`, but the server maps them to the canonical plan **`style_chat`** (not the legacy `personal_stylist` plan at £14.99). RevenueCat entitlement ID must be exactly **`personal_stylist`**.

| Layer | Personal Stylist products map to |
|-------|----------------------------------|
| Client (`AppleIAPService.ts`) | tier `personal_stylist` |
| RevenueCat | entitlement `personal_stylist` |
| Server (`appleIAPService.js`) | plan `style_chat` |

### Legacy IDs (do not create — for reference only)

The server accepts these aliases but the app uses the 10 IDs above:

- `com.dripn.personal_stylist.annual` → same as canonical `com.dripn.personal_stylist.yearly`
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
| `com.dripn.personal_stylist.yearly` | 1 year | Personal Stylist Annual |
| `com.dripn.stylist_unlimited.monthly` | 1 month | Stylist Unlimited Monthly |
| `com.dripn.stylist_unlimited.annual` | 1 year | Stylist Unlimited Annual |

4. For each subscription, configure:
   - **Subscription prices:** UK → £9.99 / £95.99 / £19.99 / £191.99 (add other territories as needed).
   - **Localization (English U.K.):** paste display name + description from the table in §1 (benefit-led copy; ≤30 / ≤45 chars).
   - **Review information:** screenshot of the Subscription paywall (`SubscriptionScreen`).
   - **Subscription group level:** set rank so `stylist_unlimited` is higher than `personal_stylist` (upgrade path).
   - **Family Sharing:** your choice (typically off for this model).

### B. Create 2 non-consumable DFY products

1. App Store Connect → Dripn → **In-App Purchases** → **+** → **Non-Consumable**.

| Product ID | Display name | Price (UK) |
|------------|--------------|------------|
| `com.dripn.dfy.lite` | Occasion Ready | £19.99 |
| `com.dripn.dfy.core` | Full Wardrobe Setup | £39.99 |

2. Add localized descriptions from §1 DFY paste blocks (benefit-led; ≤30 / ≤45 chars).
3. Add review screenshot from **DFYComparisonScreen** or **DFYStartScreen**.

### C. Create 3 consumable voice products

1. **In-App Purchases** → **+** → **Consumable**.

| Product ID | Display name | What user gets | Price (UK) |
|------------|--------------|----------------|------------|
| `com.dripn.voice.boost.30` | Voice Boost | 30 spoken replies | £2.99 |
| `com.dripn.voice.pro.80` | Pro Pack | 80 spoken replies | £5.99 |
| `com.dripn.voice.weekend_unlimited` | 2-Day Unlimited | Unlimited voice for 48 hours — buy any day | £8.99 |

2. Add localized descriptions from §1 voice paste blocks (benefit-led; ≤30 / ≤45 chars).

2. Add review screenshot from **AI Stylist → Voice mode** → Buy credits modal.

### D. Localization & pricing notes

- Add at least **English (U.K.)** localization for every product (name + description).
- Use benefit-led marketing language (outcomes, confidence, time saved) — see **Copy principles** below.
- Set **United Kingdom** pricing first, then propagate or customize other storefronts.
- Annual subs should reflect ~20% savings vs 12× monthly (matches `BILLING_PLANS` yearly amounts).

### Copy principles (App Store Connect metadata)

Write IAP display names and descriptions for **outcomes**, not feature specs. Apple subscribers buy how they'll feel and what they'll gain — not internal product mechanics.

| Do | Don't |
|----|-------|
| Look better, feel confident, save time | "Unlimited wardrobe", "outfit calendar", "bulk upload" |
| Less outfit stress, less decision fatigue | Feature lists or dev jargon |
| Honest savings paired with a benefit ("Save 20% — confident looks all year") | Dry price-only copy ("Save £X" with no emotional hook) |
| Accurate claims only | "Millions of users", "certified stylists", unverifiable superlatives |

**Field limits (subscriptions):** Display name ≤ **30** characters · Description ≤ **45** characters (English U.K.).

**Apply the same mindset to DFY and voice products** when localizing in App Store Connect — e.g. "Ready for your trip in days" beats "5–7 outfit photos, 14-day window".

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
   - Under **In-App Purchases and Subscriptions**, add all 9 products to the version.
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
| `dfy_lite` | DFY Occasion Ready (one-time) |
| `dfy_core` | DFY Full Wardrobe Setup (one-time) |

Voice consumables get **no entitlement**.

### C. Map products to entitlements

RevenueCat → **Products** → for each App Store product, attach the entitlement:

| Product ID | Attach to entitlement |
|------------|----------------------|
| `com.dripn.personal_stylist.monthly` | `personal_stylist` |
| `com.dripn.personal_stylist.yearly` | `personal_stylist` |
| `com.dripn.stylist_unlimited.monthly` | `stylist_unlimited` |
| `com.dripn.stylist_unlimited.annual` | `stylist_unlimited` |
| `com.dripn.dfy.lite` | `dfy_lite` |
| `com.dripn.dfy.core` | `dfy_core` |
| `com.dripn.voice.boost.30` | *(none — consumable)* |
| `com.dripn.voice.pro.80` | *(none)* |
| `com.dripn.voice.weekend_unlimited` | *(none — sets 48h unlimited on server)* |

### D. Create offering(s)

The app reads **`offerings.current`** and matches packages by **product identifier** (`findPackageByProductId` in `AppleIAPService.ts`).

**Default offering (required for subscriptions):**

1. RevenueCat → **Offerings** → edit **default** (or create and mark as Current).
2. Add packages — one per product. Suggested package identifiers:

| Package ID | Product |
|------------|---------|
| `personal_stylist_monthly` | `com.dripn.personal_stylist.monthly` |
| `personal_stylist_yearly` | `com.dripn.personal_stylist.yearly` |
| `stylist_unlimited_monthly` | `com.dripn.stylist_unlimited.monthly` |
| `stylist_unlimited_annual` | `com.dripn.stylist_unlimited.annual` |
| `dfy_lite` | `com.dripn.dfy.lite` |
| `dfy_core` | `com.dripn.dfy.core` |
| `voice_boost` | `com.dripn.voice.boost.30` |
| `voice_pro` | `com.dripn.voice.pro.80` |
| `voice_weekend` | `com.dripn.voice.weekend_unlimited` |

3. Mark this offering as **Current**.

> **Note:** Subscriptions **must** be in the current offering or `purchaseSubscription()` throws. DFY and voice can fall back to `purchaseStoreProduct()`, but putting all 9 in the default offering is simplest.

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
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | **StyleWise** `.env` / **EAS** `preview`+`production` env | iOS **public** SDK key for `react-native-purchases` (baked at build time) |

**EAS builds (required for TestFlight / App Store):** `EXPO_PUBLIC_*` values are inlined at build time. If this key is missing from the build, `Purchases.configure` never runs and purchases show *"In-app purchases unavailable — rebuild with RevenueCat key"*.

Set it for **preview** and **production** (pick one):

```bash
# EAS environment variable (recommended — not committed)
eas env:create --name EXPO_PUBLIC_REVENUECAT_IOS_API_KEY --value appl_YOUR_IOS_PUBLIC_KEY --environment production
eas env:create --name EXPO_PUBLIC_REVENUECAT_IOS_API_KEY --value appl_YOUR_IOS_PUBLIC_KEY --environment preview
```

Or add to `eas.json` under `build.preview.env` and `build.production.env`:

```json
"EXPO_PUBLIC_REVENUECAT_IOS_API_KEY": "appl_YOUR_IOS_PUBLIC_KEY"
```

Then create a **new** native build (`eas build --platform ios --profile preview` / `production`). OTA updates alone will not pick up a newly added `EXPO_PUBLIC_` key unless that key was already present in a previous binary’s env at build time — always rebuild after adding the key.

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
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_YOUR_IOS_PUBLIC_KEY
```

(Production iOS uses IAP automatically when `Platform.OS === 'ios' && !__DEV__`. Expo Go cannot run StoreKit / RevenueCat native purchases.)

### G. iOS SDK API key location

RevenueCat dashboard → **Project Settings → API keys → App specific keys**

- Copy the **iOS public API key** (starts with `appl_`).
- Paste into StyleWise as `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` (local `.env` and EAS env as above).
- Do **not** use the secret key (`sk_`) in the mobile app.

`AppleIAPService.configure()` is awaited before every purchase/restore. If the key is missing or the SDK is not ready, the app surfaces a friendly error instead of RevenueCat’s raw “no singleton instance” message.

### H. App user ID wiring

The app calls `Purchases.configure({ apiKey, appUserID: appUserId })` with the **Dripn server user ID** (numeric string). RevenueCat webhooks use `app_user_id` to find the user — keep this consistent.

---

## 4. Verification Checklist

### Confirm products appear in app (sandbox)

- [ ] All 10 IAPs show **Ready to Submit** or **Approved** in App Store Connect.
- [ ] RevenueCat → Products shows all 10 imported/linked with green status.
- [ ] Default offering is **Current** and contains subscription packages.
- [ ] `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` set in StyleWise **and** in EAS preview/production env (`eas env:create` or `eas.json`); then **new** native iOS build.
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
| **`yearly` vs `annual`** — RevenueCat offering still uses `com.dripn.personal_stylist.annual` | App error *"None of the products… could be fetched from App Store Connect"* / empty offerings | **Canonical ID is `.yearly`** (ASC + app + docs + RC). Keep `.annual` only as a server-side legacy alias for old receipts/webhooks. |
| Product ID typo (even one character) | "Product not found" / `UNKNOWN_VOICE_PRODUCT` | Copy IDs exactly from table above |
| IAPs still "Prepare for Submission" + first sub group not with a version | RC **Missing Metadata**; StoreKit returns no products → empty offerings | Sign Paid Apps Agreement; complete pricing/localizations; attach IAPs to version 1.0 → **Add for Review** / submit with the app (banner: first subscription group must ship with a new app version). Sandbox usually works once metadata + agreements are complete. |
| Products in RC with no entitlements / empty Current offering | Purchases may load but unlock fails, or packages missing | Attach entitlements (`personal_stylist`, `stylist_unlimited`, `dfy_lite`, `dfy_core`); put all 9 products in the **Current** offering |
| Subscriptions not in RevenueCat **current** offering | `Subscription package not found for com.dripn...` | Add all 4 subs to default offering; mark Current |
| Wrong entitlement ID (e.g. `style_chat` instead of `personal_stylist`) | Purchase works but tier doesn't sync | Use `personal_stylist` and `stylist_unlimited` exactly |
| Using Expo Go | IAP never initializes | Use EAS dev client or production build |
| No sandbox account on device | Purchase dialog fails or uses production Apple ID | Sign in via Settings → App Store → Sandbox Account |
| `REVENUECAT_WEBHOOK_SECRET` mismatch | Webhook 401 Unauthorized | Match bearer token in RevenueCat and Render env |
| Missing `REVENUECAT_REST_API_KEY` on server | Validation skipped in dev; purchases may fail validation in prod | Set secret REST API key on Dripn-Server |
| Public vs secret key swapped | SDK configure fails or security risk | `appl_` in app, `sk_` on server only |
| Expecting Restore to re-grant voice credits | Credits missing after reinstall | Normal — consumables aren't restored; balance comes from `GET /api/voice-credits/balance` |
| IAPs not attached to app version at submit | IAPs stuck "Missing Metadata" or not reviewable | Attach all 10 to the App Store version before submit |
| Creating legacy product IDs (`voice.10`, `dfy.styling_sprint`) | App won't find them | Use only the 9 canonical IDs |
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

Voice (consumable — server credits or 48h unlimited, no entitlement):
  com.dripn.voice.boost.30          →  30 credits   (pack: boost)
  com.dripn.voice.pro.80            →  80 credits   (pack: pro, Most Popular)
  com.dripn.voice.weekend_unlimited →  48h unlimited voice (pack: weekend)
  Legacy: credits_10/40/80/150, credits_25/50/100, voice.10/.30/.60 still honoured
```

# Dripn — App Store Submission Guide

## Store listing (paste into App Store Connect)

Use `store/app-store-listing.json` as the source of truth.

### Name
**Dripn: AI Outfit Stylist**

### Subtitle (≤30 characters)
**AI outfit suggestions**

### Description
Copy the `ios.description` field from `store/app-store-listing.json`.

### Keywords
`outfit,stylist,fashion,ai,clothes,wardrobe,style,looks,outfits,shopping,wear,match`

### URLs
- Privacy: https://dripnapp.com/privacy
- Terms: https://dripnapp.com/terms
- Support: https://dripnapp.com
- Marketing: https://dripnapp.com

### Category
- Primary: Lifestyle
- Secondary: Shopping (or Productivity if preferred)

### Screenshots (pixel sizes)
- **Required 6.7":** 1290 × 2796
- Backup 6.5": 1242 × 2688

Do not upscale blurry images. Export at exact dimensions.

---

## Demo / App Review account

Server seeds a review account on boot when env vars are set on Render:

```
APP_REVIEW_EMAIL=review@dripn.app
APP_REVIEW_PASSWORD=<choose a strong password, 8+ chars>
```

- Default email if unset: `review@dripn.app`
- Password is **required** for seeding (`APP_REVIEW_PASSWORD`)
- Account is created email-verified with onboarding marked complete
- Password is reset to the env value on every boot (so you can rotate it before review)

After deploy, sign in once on a device to confirm login works, then paste credentials into App Review notes.

### App Review Notes (paste into App Store Connect)

```
Dripn is an AI-powered outfit stylist. It helps users get styling suggestions from wardrobe photos and chat — not guaranteed fashion results.

DEMO ACCOUNT (required for review)
Email: review@dripn.app
Password: <SAME AS APP_REVIEW_PASSWORD ON RENDER>

Please use the demo account above. New signup also works, but the demo account skips verification so the core flow is immediate.

Social login options (Apple/Google/Facebook) are not required for review. Please use the demo account above for full access.

CORE REVIEW FLOW (2–3 minutes)
1. Sign in with the demo account.
2. Open Wardrobe — add a clothing photo or browse existing items.
3. Open Stylist → chat with a stylist and ask for an everyday outfit idea.
4. Settings → Subscription to view plans (iOS uses Apple In-App Purchase; no external Stripe checkout for new iOS subscriptions).
5. Privacy Policy and Terms of Service are under Settings (also https://dripnapp.com/privacy and /terms).

PERMISSIONS
- Camera / Photos: upload clothing for styling advice
- Microphone: optional voice replies
- Location: optional weather-aware outfit context

NOTES
- AI replies are suggestions only; users make their own clothing decisions.
- Referral discounts (Stripe) do not apply to Apple IAP subscriptions.
- Staff/Admin tools are for internal use and are not required for review.
```

---

## Payments (review-critical)

- Production **iOS** builds must sell subscriptions via **Apple IAP** (RevenueCat / StoreKit).
- Do **not** show Stripe checkout or “pay on website” for new subscriptions in the App Store binary.
- Web/Android may use Stripe.

---

## Pre-submit checklist

- [ ] Smoke test: login → wardrobe → stylist chat → settings (no crash)
- [ ] Demo account logs in on production
- [ ] Privacy & Terms open from Settings and in Safari
- [ ] Screenshots are exact 1290×2796
- [ ] Description/subtitle are Apple-safe (no “perfect / guaranteed / better than humans”)
- [ ] IAP products configured in App Store Connect match the app
- [ ] Social login buttons hidden (`SHOW_SOCIAL_LOGIN = false` in AuthScreen)
- [ ] App Review Notes include working demo credentials
- [ ] App Review Notes mention social login is not required

---

## Build commands (from StyleWise app folder)

```bash
cd C:\Users\sheni\Downloads\dripn\StyleWise
eas build --platform ios --profile production
```

Do **not** run EAS build from `Dripn-Server` (backend).

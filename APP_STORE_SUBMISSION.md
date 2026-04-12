# Dripn - App Store Submission Guide

## App Information

### App Name
**Dripn**

### Subtitle (30 characters max)
Fashion Advice & Style Tips

### Category
- Primary: Lifestyle
- Secondary: Social Networking

### App Description (4000 characters max)

**Short Description (Google Play - 80 characters):**
Get personalized fashion advice from AI and a supportive style community.

**Full Description:**

Dripn is your personal fashion advisor in your pocket. Whether you're getting ready for a big event, updating your wardrobe, or just want a second opinion on an outfit, Dripn connects you with AI-powered styling advice and a supportive community of fashion enthusiasts.

**Key Features:**

**AI Fashion Advice**
Upload your outfit photos and receive instant, personalized styling recommendations. Our AI analyzes colors, patterns, and proportions to help you look your best for any occasion.

**Community Feedback**
Share your looks and get honest, constructive feedback from fellow fashion lovers. Vote on comparison polls and help others make style decisions.

**Voice Comments**
Record voice notes to give detailed styling advice.

**Trending Challenges**
Join weekly style challenges, discover the outfit of the day, and see what's trending in the fashion community.

**Daily & Weekly Offers**
Browse exclusive daily and weekly special offers from your favorite fashion brands and retailers, all curated to match your style preferences.

**Events Near You**
Discover local events and get personalized outfit suggestions for every occasion.

**Size-Inclusive**
Fashion advice for every body type.

**Subscription Tiers:**
- Free
- Style Chat (£9.99/month)
- Personal Stylist (£14.99/month)
- Stylist Unlimited (£19.99/month)

---

## Keywords (100 characters max, comma-separated)

fashion,style,outfit,clothing,wardrobe,advice,AI,styling,look,dress,tips,community,poll,trend

---

## Privacy Policy URL
https://dripnapp.com/privacy

## Terms URL
https://dripnapp.com/terms

## Support URL
https://dripnapp.com

## Marketing URL (optional)
https://dripnapp.com

---

## Screenshots Needed

### iPhone Screenshots (Required: 3-10)
Sizes: 6.7" (1290x2796), 6.5" (1284x2778), 5.5" (1242x2208)

Suggested screenshots:
1. Home feed showing outfit posts
2. AI advice feature in action
3. Create post screen
4. Subscription plans
5. Profile page with achievements
6. Discover/trending page

### iPad Screenshots (if supporting tablet)
Sizes: 12.9" (2048x2732)

### Android Screenshots
Phone: 1080x1920 minimum
Tablet: 1200x1920 minimum (if supporting)

---

## App Store Review Information

### Demo Account (if app requires login)
Email: demo@dripn.com
Password: create a test account

### Notes for Reviewers
Dripn is a fashion advice app that allows users to share outfit photos and receive styling suggestions from both AI and community members. The app includes in-app purchases for premium subscription tiers.

---

## Pre-Submission Checklist

### Developer Accounts
- [x] Apple Developer Account
- [x] Google Play Developer Account

### Required Items
- [x] Privacy Policy URL (hosted on your website)
- [x] App icon (configured in app.json)
- [ ] Screenshots for all required sizes
- [ ] Age rating questionnaire completed
- [x] Content rights declaration

### Before Building
- [ ] Test all features work correctly
- [ ] Remove any test/debug code
- [x] Verify all links work (privacy policy, support, etc.)
- [x] Check subscription pricing matches App Store Connect / Play Console

---

## Build & Submit Commands

### Install EAS CLI
```bash
npm install -g eas-cli
eas login
```

### Build for iOS
```bash
eas build --platform ios --profile production
```

### Build for Android
```bash
eas build --platform android --profile production
```

### Submit to App Stores
```bash
# iOS
eas submit -p ios

# Android
eas submit -p android
```

---

## Post-Submission

### iOS App Store
1. Upload build
2. Complete app information
3. Submit for review
4. Wait for review

### Google Play Store
1. Upload build
2. Complete store listing
3. Set up pricing and distribution
4. Submit for review

---

## Important Notes

- Apple requires all apps with subscriptions to clearly display pricing
- Both stores require a privacy policy
- Age rating: Dripn should likely be rated 12+
- In-app purchases must be configured in App Store Connect and Play Console
- Stripe payments work through the web; in-app subscriptions require platform billing

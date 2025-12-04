# StyleWise - App Store Submission Guide

## App Information

### App Name
**StyleWise**

### Subtitle (30 characters max)
Fashion Advice & Style Tips

### Category
- Primary: Lifestyle
- Secondary: Social Networking

### App Description (4000 characters max)

**Short Description (Google Play - 80 characters):**
Get personalized fashion advice from AI and a supportive style community.

**Full Description:**

StyleWise is your personal fashion advisor in your pocket. Whether you're getting ready for a big event, updating your wardrobe, or just want a second opinion on an outfit, StyleWise connects you with AI-powered styling advice and a supportive community of fashion enthusiasts.

**Key Features:**

**AI Fashion Advice**
Upload your outfit photos and receive instant, personalized styling recommendations. Our AI analyzes colors, patterns, and proportions to help you look your best for any occasion.

**Community Feedback**
Share your looks and get honest, constructive feedback from fellow fashion lovers. Vote on comparison polls and help others make style decisions.

**Voice Comments**
Record voice notes to give detailed styling advice - sometimes words aren't enough to describe the perfect accessory swap!

**Trending Challenges**
Join weekly style challenges, discover the outfit of the day, and see what's trending in the fashion community.

**Size-Inclusive**
Fashion advice for every body type. Our recommendations consider your unique proportions to help you dress with confidence.

**Subscription Tiers:**
- Free: Get started with basic features
- Style Starter ($9.99/month): More posts, AI advice, and voice comments
- Fashion Forward ($24.99/month): Priority support, exclusive content, affiliate access
- VIP Influencer ($49.99/month): Unlimited everything plus direct stylist chat

Download StyleWise today and transform your wardrobe with confidence!

---

## Keywords (100 characters max, comma-separated)

fashion,style,outfit,clothing,wardrobe,advice,AI,styling,look,dress,tips,community,poll,trend

---

## Privacy Policy URL
(Required - you need to create one)
https://yourwebsite.com/privacy

## Support URL
https://yourwebsite.com/support

## Marketing URL (optional)
https://yourwebsite.com

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
Email: demo@stylewise.com
Password: (create a test account)

### Notes for Reviewers
StyleWise is a fashion advice app that allows users to share outfit photos and receive styling suggestions from both AI and community members. The app includes in-app purchases for premium subscription tiers.

---

## Pre-Submission Checklist

### Developer Accounts
- [ ] Apple Developer Account ($99/year) - https://developer.apple.com
- [ ] Google Play Developer Account ($25 one-time) - https://play.google.com/console

### Required Items
- [ ] Privacy Policy URL (hosted on your website)
- [ ] App icon (1024x1024 for iOS, already configured in app.json)
- [ ] Screenshots for all required sizes
- [ ] Age rating questionnaire completed
- [ ] Content rights declaration

### Before Building
- [ ] Test all features work correctly
- [ ] Remove any test/debug code
- [ ] Verify all links work (privacy policy, support, etc.)
- [ ] Check subscription pricing matches App Store Connect / Play Console

---

## Build & Submit Commands

### Install EAS CLI
```bash
npm install -g eas-cli
eas login
```

### Configure Project
```bash
eas build:configure
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
# iOS (uploads to TestFlight)
eas submit -p ios

# Android
eas submit -p android
```

---

## Post-Submission

### iOS App Store
1. Build uploads to TestFlight automatically
2. Log into App Store Connect
3. Complete app information (description, screenshots, pricing)
4. Submit for review
5. Wait 1-3 days for review

### Google Play Store
1. First upload must be done manually in Play Console
2. Complete store listing (description, screenshots)
3. Set up pricing and distribution
4. Submit for review
5. Usually approved within hours to 2 days

---

## Important Notes

- Apple requires all apps with subscriptions to clearly display pricing
- Both stores require a privacy policy
- Age rating: StyleWise should be rated 12+ (social features, user-generated content)
- In-app purchases must be configured in App Store Connect and Play Console
- Stripe payments work through the web; in-app subscriptions require platform billing

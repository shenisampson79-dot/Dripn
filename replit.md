# StyleWise - Fashion Advice Mobile App

## Overview
StyleWise is a mobile fashion advice app built with Expo React Native where users post outfit photos/videos and receive styling advice from both AI and community members. The app features freemium subscriptions, size-inclusive recommendations, shoppable affiliate content, dynamic UI theming, and community engagement features.

## Current State
App is fully functional with comprehensive features including:
- User authentication and profiles
- Photo/video post creation with comparison polls
- AI fashion advice integration (mock service, ready for OpenAI)
- Community commenting with voice support
- Subscription tiers with Stripe integration (client-side ready)
- Content reporting and moderation
- Viral sharing with hashtag generation
- Trending challenges and discovery features

## Tech Stack
- **Framework**: Expo React Native with TypeScript
- **Navigation**: React Navigation 7+
- **State Management**: React Context API
- **Storage**: AsyncStorage for local persistence
- **Styling**: iOS 26 Liquid Glass design system

## Project Structure
```
├── App.tsx                 # Entry point with providers
├── navigation/             # Navigator definitions
│   ├── AppNavigator.tsx
│   ├── AuthNavigator.tsx
│   ├── MainTabNavigator.tsx
│   ├── HomeStackNavigator.tsx
│   ├── DiscoverStackNavigator.tsx
│   └── ProfileStackNavigator.tsx
├── screens/                # Screen components
│   ├── HomeScreen.tsx
│   ├── PostDetailScreen.tsx
│   ├── CreatePostScreen.tsx
│   ├── DiscoverScreen.tsx
│   ├── ProfileScreen.tsx
│   ├── SettingsScreen.tsx
│   ├── SubscriptionScreen.tsx
│   └── EditProfileScreen.tsx
├── components/             # Reusable components
│   ├── PostCard.tsx
│   ├── VoiceCommentInput.tsx
│   ├── ReportModal.tsx
│   ├── ShoppableCard.tsx
│   ├── SubscriptionBadge.tsx
│   └── [shared UI components]
├── contexts/               # State contexts
│   ├── AuthContext.tsx
│   ├── PostsContext.tsx
│   ├── SubscriptionContext.tsx
│   └── ThemeContext.tsx
├── services/               # Business logic
│   ├── AIAdviceService.ts
│   └── SharingService.ts
├── constants/              # Theme and config
│   └── theme.ts
└── hooks/                  # Custom hooks
    └── useTheme.ts
```

## Key Features

### Subscription Tiers
- **Free**: 3 uploads/month, 1 AI advice request
- **Basic** ($4.99): 10 uploads, 5 AI requests, voice comments
- **Plus** ($14.99): 25 uploads, 15 AI requests, video posts
- **Premium** ($29.99): Unlimited, priority AI, product matching
- **Elite** ($49.99): All features + personal styling sessions

### Style Themes (Dynamic UI)
6 fashion-inspired color themes with light/dark modes:
- Luxury, Streetwear, Boho, Sporty, Romantic, Edgy

### Content Features
- Standard outfit posts with photos/videos
- Comparison polls (A vs B voting)
- AI fashion advice with color analysis and recommendations
- Voice comments using expo-audio
- Content reporting system
- Viral sharing with auto-generated hashtags

### Discovery Features
- Style of the Day (AI curated)
- Category browsing (Trending, Casual, Formal, etc.)
- Trending Challenges with participation tracking
- Weekly highlights (Top Contributor, Most Discussed)

## Environment Variables
- `SESSION_SECRET`: For session management
- `EXPO_PUBLIC_API_URL`: Backend API URL (optional, for production)
- `STRIPE_PUBLISHABLE_KEY`: Stripe publishable API key (configured)
- `STRIPE_SECRET_KEY`: Stripe secret API key (configured)

## Stripe Integration
Stripe API keys are stored as secrets in Replit. The app is configured for subscription payments:

**Subscription Plans (in SubscriptionContext.tsx):**
- Free: $0/month - 5 posts, 3 AI advice, 2 polls
- Style Starter: $9.99/month - 20 posts, 15 AI advice, voice comments
- Fashion Forward: $24.99/month - 100 posts, 50 AI advice, priority support
- VIP Influencer: $49.99/month - Unlimited everything, VIP features

**Current Status:**
- Stripe keys are configured and stored securely
- Frontend subscription UI is complete
- Payment processing requires backend server (see backend-code/ folder)

**To Enable Live Payments:**
1. Set up backend server with the code in backend-code/
2. Create products/prices in Stripe Dashboard matching the plan IDs
3. Connect backend to process checkout sessions

## Backend Integration
A complete backend API is available in the `backend-code/` folder:
- Copy files to a new Node.js Replit
- Set up PostgreSQL database
- Add OpenAI API key for real AI advice
- Set `EXPO_PUBLIC_API_URL` in this app to connect

The `services/ApiService.ts` handles all backend communication.

## Notes
- Frontend works standalone with local storage (no backend required for testing)
- AI advice uses mock service (services/AIAdviceService.ts)
- Stripe integration is client-side ready, needs backend checkout
- Voice comments require Expo Go on device for full functionality
- Web version may differ from native iOS/Android experience

## Code Protection (Anti-Copy Measures)
The app includes multiple layers of code protection:

### ProGuard (Android Native)
- Enabled in `app.json` via `expo-build-properties`
- Minifies and obfuscates native Android code
- Shrinks resources to reduce APK size

### JavaScript Obfuscation  
- Configured in `metro.config.js` via `obfuscator-io-metro-plugin`
- Only active in production builds (NODE_ENV=production)
- Features: control flow flattening, dead code injection, string encryption, self-defending code

### Hermes Engine
- Compiles JavaScript to bytecode
- Set in `app.json` with `"jsEngine": "hermes"`
- Provides additional protection by not shipping readable JavaScript

**Note**: Obfuscation runs during production builds (EAS Build), not in Expo Go development mode.

## Recent Changes
- Connected Stripe API keys for payment processing
- Updated app logo to elegant serif "StyleWise" wordmark
- Added code obfuscation and protection configuration
- Added content reporting modal (components/ReportModal.tsx)
- Implemented viral sharing service (services/SharingService.ts)
- Added shoppable product cards (components/ShoppableCard.tsx)
- Enhanced Discover screen with trending challenges
- Integrated voice comments with expo-audio
- Added referral code generation in subscription flow
- Enhanced Welcome screen: removed duplicate title, increased logo size (180x180), added tagline
- Implemented comprehensive country selection with 85+ countries (all European nations, NZ, Mexico) in expandable "Other" list
- Replaced style category color boxes with actual fashion images for all 6 themes
- Added gender selection step in onboarding (Woman/Man/Non-binary/Prefer not to say) with gender-specific body shape options
- Implemented multicultural Style of the Day with regional model images based on user's country (Europe/NA, Asia, Africa, Middle East, South Asia, Latin America)
- Romantic style category now shows region-appropriate couple dinner images:
  - White couple for Nordic/Eastern European countries (Norway, Sweden, Iceland, Finland, Denmark, Estonia, Latvia, Lithuania, Poland, Czech Republic, Slovakia, Hungary, Romania, Bulgaria, Russia, Ukraine, Belarus, Moldova)
  - Mixed race couple for US, UK, Canada, Australia, NZ, and Western European countries (Germany, France, Italy, Spain, etc.)
  - Asian couple for Japan, South Korea, China, etc.
  - African couple for Nigeria, Kenya, South Africa, etc.
  - Middle Eastern couple for UAE, Saudi Arabia, etc.
  - South Asian couple for India, Pakistan, etc.
  - Latin American couple for Mexico, Brazil, Argentina, Caribbean nations, etc.
- Style category names updated: "Luxury" renamed to "Formal", "Streetwear" renamed to "Casual"
- Sporty category image updated to show a white woman running (full body shot)
- Added 5-step App Tour (components/AppTour.tsx) that displays after onboarding completion:
  1. Welcome to the Community - Community intro
  2. AI Suggestions Are Optional - Explains users can turn off AI in Settings
  3. Share Your Style - How to post outfits
  4. Help Others Too - Community engagement
  5. You're All Set - Final step
- Added AI Style Suggestions toggle in Settings > Preferences to turn AI advice on/off
- User profile now includes `aiSuggestionsEnabled` (boolean) and `hasSeenTour` (boolean) flags
- Tour resets properly when reopened to ensure all users see complete tour starting from step 1
- Added Celebrity-Inspired Looks section on Discover screen:
  - Uses AI-generated fashion images (legally safe, no real celebrity photos)
  - Shows 3 style looks: Street Style Chic, Evening Elegance, Athleisure Vibes
  - "Get the Look" shows budget-friendly alternatives for free/basic users
  - Premium/VIP users see luxury alternatives with option to toggle
  - FTC-compliant affiliate disclosure visible above cards
- Added Bargain of the Week section on Discover screen:
  - Features luxury household-name brands with realistic 10-20% discounts (Burberry, Canada Goose, Moncler, Gucci, Prada, Ralph Lauren, UGG, Hunter, Loake, Celine, Nike)
  - Nike trainer deals inspired by Captain Creps (@CaptainCreps) - UK sneaker deals aggregator
  - Country-specific deals: Users only see bargains from stores in their country or that ship to their country
  - Regional stores by country:
    - UK/Ireland: Flannels, Frasers, Selfridges, END Clothing, Size?, JD Sports
    - US/Canada: Nordstrom, Saks Fifth Avenue, Neiman Marcus, Bloomingdale's, Foot Locker, Nike.com
    - Europe: MyTheresa, 24S, Farfetch, Net-a-Porter
    - Middle East: Level Shoes, Ounass
    - Asia: ZOZOTOWN (Japan), Lane Crawford (HK/China/Singapore)
    - Australia/NZ: The Iconic, David Jones
  - Currency symbols display correctly based on store region (GBP, USD, EUR, AED, JPY, HKD, AUD)
  - FTC-compliant affiliate disclosure visible above cards
  - "Shop Now" flow ready for real affiliate API integration (shows "Coming Soon" for now)
- Enhanced AI Advice Service with Influencer-Inspired Content (services/AIAdviceService.ts):
  - Research-based influencer database covering 9 regions worldwide
  - Regional influencer profiles with signature styles:
    - North America: Monroe Steele (@monroesteele), Fashion Influx, Camille Styles
    - UK: Victoria Magrath (@inthefrow), Lydia Jane Tomlinson, Alexandra Stedman
    - Europe: Jeanne Damas (@jeannedamas), Chiara Ferragni, Leonie Hanne
    - Middle East: Karen Wazen, Rawan Bin Hussain, Huda Kattan
    - Asia: Irene Kim (@ireneisgood), Heart Evangelista, Ming Xi
    - South Asia: Masoom Minawala, Komal Pandey, Diipa Buller-Khosla
    - Africa: Temi Otedola, Mihlali Ndamase, Kefilwe Mabote
    - Latin America: Thassia Naves, Yuya, Pamela Allier
    - Australia: Nicole Warne (@garypeppergirl), Jessica Stein, Carmen Hamilton
  - Country-specific style tips tailored to member's region
  - Trending 2024/2025 fashion data: colors, silhouettes, must-have pieces
  - Premium users get influencer insights in their AI feedback
- Added Influencer Inspiration section on Discover screen:
  - Displays 3 rotating style tips from regional influencers
  - Shows influencer handle credits for each tip
  - "Trending Pieces Right Now" tags based on user's region
  - "Hot Colors for 2024/2025" with visual color swatches
  - Adapts content based on user's country for culturally relevant advice
- Expanded Bargain of the Week with premium athleisure brands:
  - Gymshark: Vital Seamless Leggings, Arrival Shorts (UK origin, global shipping)
  - Sweaty Betty: Power Workout Leggings (UK premium activewear)
  - Oner Active: Effortless Seamless Leggings (UK brand, influencer favorite)
  - Lululemon: Align leggings, Scuba Half-Zip, Define Jacket (US/Canada/UK/AUS)
  - On Running: Cloudmonster running shoes (Switzerland, global)
  - Hoka: Bondi 8, Clifton 9 running shoes (US, global through JD Sports)
  - All athleisure items include brand social handles where applicable
- Updated AI Advice Service with athleisure/rest day styling:
  - New "athleisure" category in STYLE_ADVICE_TEMPLATES for gym/yoga outfit posts
  - "Rest day chic" aesthetic added to TRENDING_STYLES_2024_2025
  - Athleisure trending pieces: Gymshark Vital, Lululemon Align, On Running Cloudmonster, Hoka Bondi 8
  - Regional influencer style tips now include athleisure advice for UK, US, and Australia
  - Product suggestions include new "Athleisure" category
- Recognition that athleisure is mainstream casual wear:
  - Leggings and running shoes are now everyday wear for coffee runs, shopping, brunch
  - Premium activewear brands (Lululemon, Gymshark, On Running) are fashion statements
  - "Rest day outfit" trend: gym clothes worn intentionally for non-workout activities
  - Styling tip: oversized blazer + quality leggings + chunky trainers = elevated casual

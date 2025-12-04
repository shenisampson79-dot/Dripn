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

## Notes
- Pure frontend Expo app - backend integration needed for production
- AI advice uses mock service (services/AIAdviceService.ts)
- Stripe integration is client-side ready, needs backend checkout
- Voice comments require Expo Go on device for full functionality
- Web version may differ from native iOS/Android experience

## Recent Changes
- Added content reporting modal (components/ReportModal.tsx)
- Implemented viral sharing service (services/SharingService.ts)
- Added shoppable product cards (components/ShoppableCard.tsx)
- Enhanced Discover screen with trending challenges
- Integrated voice comments with expo-audio
- Added referral code generation in subscription flow

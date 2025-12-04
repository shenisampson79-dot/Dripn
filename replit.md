# StyleWise - Fashion Advice Mobile App

## Overview
StyleWise is a mobile fashion advice app built with Expo React Native. It allows users to post outfit photos/videos and receive styling advice from both AI and community members. The app aims to provide size-inclusive recommendations, shoppable affiliate content, dynamic UI theming, and strong community engagement. It supports freemium subscriptions and offers a comprehensive platform for fashion enthusiasts.

## User Preferences
I prefer detailed explanations.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

## System Architecture
The app is built with **Expo React Native** and **TypeScript**, utilizing **React Navigation 7+** for navigation and **React Context API** for state management. Local persistence is handled by **AsyncStorage**. The UI adheres to an **iOS 26 Liquid Glass design system**, featuring 6 dynamic, fashion-inspired color themes with light/dark modes (Luxury, Streetwear, Boho, Sporty, Romantic, Edgy).

**Key Features:**
- **Subscription Tiers**: Freemium model with Free, Basic, Plus, Premium, and Elite tiers, offering varying levels of uploads, AI advice requests, and advanced features like video posts and personal styling sessions.
- **Content Creation**: Users can create standard outfit posts with photos/videos and comparison polls (A vs B voting).
- **AI Fashion Advice**: Integration for AI-driven advice, including color analysis and personalized recommendations. This service also incorporates influencer-inspired content, trending fashion data, and culturally relevant advice based on user region, including athleisure and preppy/countryside styles. It features both male and female fashion influencers.
- **Community Engagement**: Supports voice comments, content reporting, and viral sharing with auto-generated hashtags.
- **Discovery**: Features include "Style of the Day," category browsing (Trending, Casual, Formal), trending challenges, weekly highlights, Celebrity-Inspired Looks (AI-generated), Bargain of the Week with country-specific deals from luxury brands, and Influencer Inspiration.
- **Code Protection**: Includes ProGuard for Android, JavaScript obfuscation (via `obfuscator-io-metro-plugin` in `metro.config.js`) for production builds, and Hermes Engine for compiling JavaScript to bytecode, enhancing security and performance.

**Technical Implementations:**
- **Dynamic Theming**: Six style themes with light/dark modes.
- **AI Integration**: Mock service is in place, ready for OpenAI integration.
- **Stripe Integration**: Client-side ready for subscription payments, requiring a backend for checkout processing.
- **Backend**: A separate Node.js backend is available for full API functionality, including OpenAI and PostgreSQL integration.

## External Dependencies
- **Stripe**: For subscription management and payment processing.
- **Expo-audio**: Used for voice comments functionality.
- **OpenAI API**: Intended for real AI fashion advice (currently uses a mock service).
- **PostgreSQL**: Database solution for the backend.
- **Affiliate APIs**: Planned integration for "Shop Now" functionality in shoppable content (currently "Coming Soon").
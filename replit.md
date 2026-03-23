# Dripn - Fashion Decision Engine

## Overview
Dripn is a mobile fashion decision-making app built with Expo React Native, aiming to provide instant, personalized outfit recommendations through AI stylists. Its primary goal is to help users quickly decide what to wear, focusing on efficiency and certainty rather than time-spent engagement. The app features 3 distinct AI stylist personalities (Ruby, Max, Ace), each with unique ElevenLabs TTS voices, to deliver a tailored decision-making experience. Dripn is designed as a decision-engine, not a social app, prioritizing immediate value delivery ("Ah, Sorted" moment).

## User Preferences
I prefer detailed explanations.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

## System Architecture
Dripn is developed using Expo React Native with TypeScript, incorporating React Navigation 7+ and React Context API for state management. The UI/UX follows an iOS 26 Liquid Glass design system, offering 7 dynamic, fashion-inspired color themes that support light/dark modes and gender-specific adaptations.

### Core Features
- **Subscription Tiers**: Freemium model with Free, Style Chat (£9.99/mo), Personal Stylist (£14.99/mo), and Stylist Unlimited (£19.99/mo). No free trial offered.
- **AI Fashion Advice**: Leverages GPT-5.2 for chat/vision and GPT-5-mini for rapid tasks. The backend uses an autonomous model manager that auto-discovers and selects the best available model from OpenAI's API (fallback chain: `gpt-5.2` → `gpt-5` → `gpt-4o` → `gpt-4-turbo`).
- **AI Stylists**: Three distinct personalities (Ruby, Max, Ace) with ElevenLabs TTS voices.
- **Wardrobe Digital Twin**: AI-powered photo-based wardrobe management.
- **Onboarding Flow**: Dual-path, trust-first onboarding for low-intent ("Decide for me") and high-intent ("Style me properly") users. A soft signup gate is triggered only after value delivery. Flow: Location → Gender → Body Measurements → Choose Stylist → Style Quiz → Tell Us More → Retailers → Goals → Dress Code (9 steps).
- **Community Voting ("Second Opinion")**: A time-boxed (45-minute) feature for secondary validation, with AI interpreting results based on stylist personality. Members are notified via push notifications (controllable in Settings) when another user requests a second opinion.
- **Advanced AI Capabilities**:
    - **Vision-Powered Analysis**: GPT-5.2 for color extraction, style, and fit analysis.
    - **AI Stylist Chat**: Contextual conversations with persona options.
    - **Personality Learning**: Captures user communication style and fashion preferences.
    - **Semantic Style Search**: Uses text-embedding-3-large for outfit matching.
    - **AI Image Generation**: DALL-E 3 for outfit inspiration.
    - **Complex Analysis**: o1 Reasoning Models for deep fashion analysis (Premium/VIP tiers).
- **Cultural & Regional Features**: UI, content, and advice tailored for gender, region, cultural dress codes, and trend intelligence.
- **MVP DFY Tiering**: Offers two Done-For-You (DFY) tiers: Outfit-Based Setup (£19.99) for 5-7 outfits and Core Wardrobe Setup (£39.99) for up to 30 items, focusing on essential categorization (category, formality, primary color, seasonality).

### Navigation Structure
The app features a 4-tab structure: Home ("Today's Decision"), Wardrobe, Ask Stylist (center button), and Profile.

## External Dependencies
- **Stripe**: Subscription and payment processing.
- **SendGrid**: Transactional emails and newsletters.
- **Twilio**: SMS notifications.
- **Expo**: Utilized for audio, sharing, store review, and linking functionalities.
- **OpenAI API**: Powers GPT-5.2, GPT-5-mini, DALL-E 3, Whisper, text-embedding-3-large, and o3-mini reasoning models.
- **ElevenLabs**: Provides TTS for the 4 AI stylist personas using `eleven_multilingual_v2`.
- **Replicate**: Used for IDM-VTON virtual try-on (backend ready, frontend hidden until launch).
- **PostgreSQL**: The backend database.
- **Affiliate APIs**: Integrated for "Shop Now" functionality.
- **Event APIs**: Timeout, TodayTix, Eventbrite, and Meetup are integrated for event discovery.

## Backend Configuration
- **Deployed Backend**: https://dripn-server--shenisampson79.replit.app — NOTE: Currently returning 404 on all endpoints (sleeping/down). Auth has been moved to local backend.
- **Local Backend**: Runs on port 8082 via "Backend API" workflow (`backend-code/index.js`) — handles ALL auth, guest chat (real AI), wardrobe analysis, and subscriptions.
- **Auth Architecture**: Auth endpoints (`/api/auth/login`, `/api/auth/register`, `/api/auth/me`, `/api/auth/profile`) now work directly against the local PostgreSQL database. No longer proxied to the deployed backend. `authMiddleware` validates JWT locally only.
- **Profile Persistence**: Full onboarding profile (gender, skinUndertone, bodyMeasurements, extendedPreferences, stylistPreferences, colorScanData, etc.) is persisted to the `users.profile_data` JSONB column via `PUT /api/auth/profile/sync`. `GET /api/auth/me` returns `profileData`. On login/social login, if local AsyncStorage has no onboarding data, the profile is automatically restored from the backend — survives reinstalls and device changes. `SkinUndertone` is now a proper exported type in `AuthContext.tsx` and is included in `UserProfile` and passed in `completeOnboarding`. **IMPORTANT**: `hasCompletedOnboarding` flag is now synced to backend (was previously excluded from sync), so users won't see onboarding again after restarting the app or switching devices.
- **Frontend API URL**: Mobile Expo Go uses `https://0ff35e7b-c52b-436f-bc3a-caa12ac9e07a-00-ladpqjdev6jc.spock.replit.dev:8082` (local backend). Set as fallback in `services/ApiService.ts` when `EXPO_PUBLIC_API_URL` env var is not set.
- **Workflows**: 
  - "Start application" - Runs Expo Metro bundler on port 8081 with `EXPO_PUBLIC_API_URL=https://dripn-server--shenisampson79.replit.app` injected in the command
  - "Backend API" - Runs local Express.js backend on port 8082 (secondary; used for wardrobe analysis resilient endpoint and guest chat with real AI)
- **API Endpoints**: All endpoints use `/api/` prefix with resilient fallback versions available (e.g., `/api/wardrobe/analyze/resilient`)
- **Subscription Endpoints** (added to local backend-code/index.js):
  - `GET /api/subscription/plans` - List available subscription plans
  - `GET /api/subscription/status` - Get user's subscription status (auth required)
  - `POST /api/subscription/create-checkout` - Create Stripe checkout session for plan upgrade (auth required)
  - `POST /api/subscription/manage` - Open Stripe billing portal (auth required)
  - `POST /api/subscription/cancel` - Cancel subscription at period end (auth required)
  - `POST /api/subscription/reactivate` - Reactivate cancelled subscription (auth required)
  - `POST /api/subscription/cancel/start` - Start cancellation flow with stylist farewell
  - `POST /api/subscription/cancel/feedback` - Submit cancellation feedback
  - `POST /api/subscription/cancel/complete` - Complete cancellation with reactivation offers
  - `POST /api/checkout/dfy/create-session` - Create DFY one-time payment checkout
  - `GET /api/checkout/dfy/products` - List DFY product tiers
  - `POST /api/checkout/dfy/verify` - Verify DFY payment
- **Stripe Integration**: Uses Replit's connector system (`getStripeCredentials()`) for automatic Stripe key management. Customer IDs and subscription IDs stored in `users` table (`stripe_customer_id`, `stripe_subscription_id` columns).
- **Stripe Payment Links** (test mode): Created static payment links for all 6 tier+cycle combos (3 tiers × monthly/yearly). Hardcoded in `SubscriptionScreen.tsx` in `STRIPE_PAYMENT_LINKS` constant. These bypass the deployed backend's broken checkout endpoint. Links pass `client_reference_id=userId` and `prefilled_email` as URL params so Stripe can associate payment with user. Webhook handler updated with `STRIPE_PRICE_TO_TIER` mapping for automated tier activation.
  - Style Chat monthly: `price_1TByjREAiPWLqq8VeIHAxvDa`
  - Style Chat yearly: `price_1TByjSEAiPWLqq8VlCzeALdH`
  - Personal Stylist monthly: `price_1TByjTEAiPWLqq8VBCTvuUNs`
  - Personal Stylist yearly: `price_1TByjTEAiPWLqq8VZ6CI2fsn`
  - Stylist Unlimited monthly: `price_1TByjUEAiPWLqq8V6m8Va31v`
  - Stylist Unlimited yearly: `price_1TByjUEAiPWLqq8V3MnQ3Vfg`
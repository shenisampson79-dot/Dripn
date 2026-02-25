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
- **AI Fashion Advice**: Leverages GPT-4.1 for chat/vision and GPT-4.1-nano for rapid tasks.
- **AI Stylists**: Three distinct personalities (Ruby, Max, Ace) with ElevenLabs TTS voices.
- **Wardrobe Digital Twin**: AI-powered photo-based wardrobe management.
- **Onboarding Flow**: Dual-path, trust-first onboarding for low-intent ("Decide for me") and high-intent ("Style me properly") users. A soft signup gate is triggered only after value delivery. Flow: Location → Gender → Body Measurements → Choose Stylist → Style Quiz → Tell Us More → Retailers → Goals → Dress Code (9 steps).
- **Community Voting ("Second Opinion")**: A time-boxed (45-minute) feature for secondary validation, with AI interpreting results based on stylist personality. Members are notified via push notifications (controllable in Settings) when another user requests a second opinion.
- **Advanced AI Capabilities**:
    - **Vision-Powered Analysis**: GPT-4o Vision for color extraction, style, and fit analysis.
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
- **OpenAI API**: Powers GPT-4.1, GPT-4.1-nano, GPT-4o, DALL-E 3, Whisper, and text-embedding-3-large.
- **ElevenLabs**: Provides TTS for the 4 AI stylist personas using `eleven_multilingual_v2`.
- **Replicate**: Used for IDM-VTON virtual try-on (backend ready, frontend hidden until launch).
- **PostgreSQL**: The backend database.
- **Affiliate APIs**: Integrated for "Shop Now" functionality.
- **Event APIs**: Timeout, TodayTix, Eventbrite, and Meetup are integrated for event discovery.

## Backend Configuration
- **Backend API**: Express.js server hosted at https://dripn-server--shenisampson79.replit.app (port 5000)
- **Frontend API URL**: Set via `EXPO_PUBLIC_API_URL` environment variable pointing to published backend
- **Workflows**: 
  - "Start application" - Runs Expo Metro bundler on port 8081
- **API Endpoints**: All endpoints use `/api/` prefix with resilient fallback versions available (e.g., `/api/wardrobe/analyze/resilient`)
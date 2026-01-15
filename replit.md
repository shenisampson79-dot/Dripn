# Dripn - Fashion Decision Engine

## Overview
Dripn is a mobile fashion decision-making app built with Expo React Native. Its core mission is to help users decide what to wear quickly and with certainty—like Google Maps for fashion. The app is powered by 4 AI stylists (Ruby, Max, Jade, and Marcus) with ElevenLabs TTS voices, providing instant, personalized outfit decisions. Success is measured by how fast users leave with certainty ("Ah, Sorted" moment), NOT by time-spent engagement.

**Backend API**: https://ebdc4c03-8d36-4aa1-bb96-6b14471d4732-00-23rsu0o9cqav1.spock.replit.dev

## User Preferences
I prefer detailed explanations.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

## Strategic Positioning
- **Decision-engine, NOT social app**: Users come to decide what to wear, not to scroll
- **"Ah, Sorted" design principle**: Like Google Maps—get your answer and go
- **4 AI Stylist Personalities**:
  - **Ruby** (Female): Warm, empathetic, encouraging approach
  - **Max** (Male): Supportive, approachable, confidence-building
  - **Jade** (Female): Unapologetically honest, direct, no-nonsense
  - **Marcus** (Male): Blunt, decisive, straight-talking

## Onboarding Flow
The app uses a trust-first onboarding approach:

### Pre-Signup (Trust Building)
1. **Positioning**: "Stop overthinking what to wear"
2. **Trust Framing**: "This isn't a feed. It's a decision engine"
3. **Control Reassurance**: "You're always in control"
4. **Context Capture**: Light preference gathering (what to wear today, event outfit, confidence, shopping smarter)
5. **First Styling Win**: AI gives outfit recommendation WITHOUT requiring wardrobe

### Post-Signup (Optional)
- **Wardrobe Setup**: 3 options (DIY, Later, DFY) to respect user autonomy
- Detailed preferences captured after signup, not before

## Community Voting ("Second Opinion")
A secondary feature for extra confidence, NOT the primary experience:
- **Positioned as**: "Get a second opinion" (subtle CTA after AI recommendation)
- **Time-boxed**: 45-minute voting window
- **Curated voters**: People with similar style/body/occasion
- **Predefined reasons only**: "More appropriate", "More flattering", "Feels safer" (no free text)
- **AI interprets results**: Never show raw vote percentages alone
- **Each stylist has personality-specific interpretations**: Ruby (warm), Max (supportive), Jade (direct), Marcus (blunt)

## Navigation Structure (Simplified)
1. **Home** ("Today's Decision"): AI-driven daily outfit recommendations
2. **Wardrobe**: Digital wardrobe management with outfit organization
3. **Ask Stylist** (Center Button): Direct access to AI stylist chat
4. **Profile**: User settings, subscription, preferences

## System Architecture
Dripn is developed using Expo React Native with TypeScript, leveraging React Navigation 7+ and React Context API for state management. The UI/UX adheres to an iOS 26 Liquid Glass design system, featuring 7 dynamic, fashion-inspired color themes that include light/dark modes and gender-specific adaptations.

### Core Features (Active)
- **Subscription Tiers**: Freemium model with Free, Basic, Premium, and VIP tiers
- **AI Fashion Advice**: GPT-4.1 for chat/vision, GPT-4.1-nano for rapid tasks
- **4 AI Stylists**: Ruby, Max (supportive), Jade, Marcus (direct)
- **Wardrobe Digital Twin**: Photo-based wardrobe management with AI organization
- **Soulmates**: Style compatibility matching (integrated into AI flow)
- **Motion Coaching**: Movement-based style advice
- **Social Style Sync**: Style preferences from social connections
- **Bargains of the Day**: Daily deals from trusted retailers
- **Events Near You**: Location-based event discovery with outfit suggestions
- **Virtual Try-On**: Replicate's IDM-VTON for AI try-on experiences
- **Voice Services**: ElevenLabs TTS for all 4 AI stylist personas

### Removed Features (Backend Preserved)
The following features have been removed from navigation but their backend code is preserved for potential future re-enablement:
- Games Hub (Style Showdown, Price Check, Style DNA, Mix Match)
- Community/Posts system
- Friends Activity & Friend Requests
- Direct Messages
- Style Challenges
- VIP Video Calling

### Advanced AI Capabilities
- **Vision-Powered Outfit Analysis**: GPT-4o Vision for color extraction, style detection, fit analysis
- **AI Stylist Chat System**: Contextual conversations with 4 persona options
- **Personality Learning System**: Captures communication style and fashion preferences
- **Semantic Style Search**: text-embedding-3-large for outfit matching
- **AI Image Generation**: DALL-E 3 for outfit inspiration
- **Complex Analysis**: o1 Reasoning Models for deep fashion analysis (Premium/VIP)

### Cultural & Regional Features
- **Gender & Region Specificity**: UI, content, and advice tailored by user preferences
- **Cultural & Dress Code Preferences**: Supports religious/modest dress codes and subculture styles
- **Fashion Trend Intelligence**: Regional and gender-specific trend insights

## External Dependencies
- **Stripe**: Subscription management and payment processing
- **SendGrid**: Transactional emails and newsletters
- **Twilio**: SMS notifications (to be configured)
- **Expo**: Audio, sharing, store review, linking
- **OpenAI API**: GPT-4.1, GPT-4.1-nano, GPT-4o, DALL-E 3, Whisper, text-embedding-3-large
- **ElevenLabs**: TTS via eleven_multilingual_v2 for 4 AI stylist voices
- **Replicate**: IDM-VTON for virtual try-on
- **PostgreSQL**: Backend database
- **Affiliate APIs**: "Shop Now" functionality
- **Event APIs**: Timeout, TodayTix, Eventbrite, Meetup, ClassPass

## Important Files
- `navigation/MainTabNavigator.tsx`: Main app navigation with 4-tab structure
- `navigation/AuthStackNavigator.tsx`: Auth flow including trust onboarding
- `navigation/WardrobeStackNavigator.tsx`: Wardrobe feature navigation
- `services/PersonalStylistService.ts`: AI stylist persona configurations with second opinion support
- `services/CommunityVotingService.ts`: Community voting/second opinion service
- `services/ApiService.ts`: Backend API integration
- `screens/TrustOnboardingScreen.tsx`: Pre-signup trust-building flow
- `screens/WardrobeSetupScreen.tsx`: Post-signup wardrobe setup options
- `screens/DiscoverScreen.tsx`: "Today's Decision" home screen
- `components/SecondOpinionButton.tsx`: "Get a second opinion" CTA component

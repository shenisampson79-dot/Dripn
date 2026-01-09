# Dripn - Fashion Advice Mobile App

## Overview
Dripn is a mobile fashion advice app built with Expo React Native, enabling users to post outfit photos/videos and receive styling advice from AI, community members, and professional stylists. The app aims to provide size-inclusive recommendations, shoppable affiliate content, dynamic UI theming, and strong community engagement. It supports freemium subscriptions and offers a comprehensive platform for personalized fashion.

## User Preferences
I prefer detailed explanations.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

## System Architecture
The app is built with Expo React Native and TypeScript, utilizing React Navigation 7+ and React Context API for state management. It features an iOS 26 Liquid Glass design system with 7 dynamic, fashion-inspired color themes (including light/dark modes and gender-specific adaptations), and an annual "Hot Colors Rotation Policy" based on Pantone's "Color of the Year."

Key Features:
- **Subscription Tiers**: Freemium model (Free, Basic, Premium, VIP) with varied access to features like uploads, AI advice, and personal stylist sessions.
- **Content Creation**: Users can post outfit photos/videos and create comparison polls.
- **AI Fashion Advice**: AI-driven advice includes color analysis, personalized recommendations, trend insights, and culturally relevant suggestions, filtered by gender and region. Integrated with OpenAI, using model priority `gpt-4.5-preview` → `gpt-4o` → `gpt-4-turbo` → `gpt-4` → `gpt-3.5-turbo`.
- **Community Engagement**: Supports voice comments, content reporting, and viral sharing with auto-generated hashtags.
- **Discovery**: Features "Style of the Day," category browsing, trending challenges, weekly highlights, AI-generated Celebrity-Inspired Looks, and Influencer Inspiration.
- **Bargains of the Day**: Dedicated tab for daily deals from trusted retailers with filtering and real-time countdowns.
- **Events Near You**: Location-based event discovery with outfit suggestions.
- **Code Protection**: Includes ProGuard for Android, JavaScript obfuscation, and Hermes Engine.
- **Dynamic Theming**: Six style themes with light/dark modes.
- **Gender & Region Specificity**: UI, content, models, and advice are tailored based on user's gender and region.
- **Fashion Accessories System**: AI advice includes recommendations for luxury bags, eyewear, belts, jewelry, watches, and winter accessories.
- **Fashion Trend Intelligence System**: Curates global trend data for regional/gender-specific trends, items, influencers, colors, and style movements.
- **Visual Outfit Inspiration System**: Pinterest-style feature with curated outfit libraries and future AI-generated images via DALL-E.
- **Goal-Based Content Personalization**: AI and content are tailored to member's selected goals (Dress Better, Meet People, Find Deals, Get Inspired, Build Wardrobe, Special Events, Professional Image). 70% of content directly supports goals, 30% general for comprehensive experience. Goals are guaranteed to be prioritized in all AI interactions and content feeds.
- **Advanced AI Capabilities**:
    - **Model Lifecycle System**: Automatic model upgrades, A/B testing, and health checks.
    - **Vision-Powered Outfit Analysis**: GPT-4o Vision for color extraction, style detection, fit analysis, and multi-image comparison.
    - **Voice Services**: Whisper for speech-to-text and TTS-1-HD for AI voice responses, with Ruby (women's, uses 'nova' voice - warm/friendly) and Max (men's, uses 'onyx' voice - deep/authoritative) personas. Voice settings are configurable per stylist in VoiceSettingsContext.
    - **Fashion Therapy & Wellness**: Mood-based outfit recommendations, body positivity affirmations, capsule wardrobe planning, confidence rituals, and wellness outfit suggestions.
    - **Semantic Style Search**: `text-embedding-3-large` for semantic outfit matching and complementary piece suggestions.
    - **AI Image Generation**: DALL-E 3 for outfit inspiration, moodboards, and style guide visualization.
    - **Complex Analysis (o1 Reasoning Models)**: Deep fashion analysis for Premium/VIP subscribers, offering comprehensive wardrobe audits, personal style profiles, color analysis, and shopping strategies.
    - **Virtual Try-On**: AI-powered try-on using Replicate's IDM-VTON model, allowing users to see how clothes look on them (subscription-gated).
- **VIP Video Calling System**: Exclusive video calls for VIP members (VIP-to-VIP and stylist sessions), with online status, call history, and access control.
- **Admin Notification System**: Email (SendGrid) and SMS (Twilio - to be configured) notifications for VIP purchases.
- **Marketing & Growth Features**: Social sharing with branding, deep linking, referral program (unique codes, 10% discount), App Store review prompts, and email newsletter signup.

## External Dependencies
- **Stripe**: Subscription management and payments.
- **SendGrid**: Transactional emails (VIP alerts, newsletters).
- **Twilio**: SMS notifications (VIP alerts - to be configured).
- **Expo**: `expo-audio`, `expo-sharing`, `expo-store-review`, `expo-linking`.
- **OpenAI API**: AI Stylist, Vision, Voice services, Image Generation, Complex Analysis (GPT-4.5-preview, GPT-4o, GPT-4-turbo, GPT-4, GPT-3.5-turbo, DALL-E 3, Whisper, TTS-1-HD, text-embedding-3-large, o1 reasoning models).
- **Replicate**: IDM-VTON model for Virtual Try-On.
- **PostgreSQL**: Backend database.
- **Affiliate APIs**: For "Shop Now" functionality.
- **Event APIs**: Timeout, TodayTix, Eventbrite, Meetup, ClassPass (for "Events Near You").
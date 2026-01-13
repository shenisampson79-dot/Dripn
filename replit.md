# Dripn - Fashion Advice Mobile App

## Overview
Dripn is a mobile fashion advice application built with Expo React Native. Its primary purpose is to provide personalized styling advice to users based on their outfit photos and videos. The app integrates AI, community input, and professional stylist consultations to offer comprehensive and inclusive fashion recommendations. Key capabilities include dynamic UI theming, shoppable affiliate content, and robust community engagement features, all supported by a freemium subscription model. Dripn aims to be a leading platform for personalized fashion advice, empowering users to express their unique style.

## User Preferences
I prefer detailed explanations.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

## System Architecture
Dripn is developed using Expo React Native with TypeScript, leveraging React Navigation 7+ and React Context API for state management. The UI/UX adheres to an iOS 26 Liquid Glass design system, featuring 7 dynamic, fashion-inspired color themes that include light/dark modes and gender-specific adaptations. An annual "Hot Colors Rotation Policy" based on Pantone's "Color of the Year" ensures themes remain current.

Core features include:
- **Subscription Tiers**: A freemium model offering Free, Basic, Premium, and VIP tiers with varying access to features like content uploads, AI advice, and personal stylist sessions.
- **Content Creation**: Users can post outfit photos/videos and create comparison polls.
- **AI Fashion Advice**: Integrates OpenAI's GPT-4.1 for chat/vision and GPT-4.1-nano for rapid tasks, providing AI-driven advice on color analysis, personalized recommendations, trend insights, and culturally relevant suggestions, filtered by gender and region. Autonomous AI Model Manager ensures automatic model upgrades.
- **Community Engagement**: Features voice comments, content reporting, and viral sharing with auto-generated hashtags.
- **Discovery**: Includes "Style of the Day," category browsing, trending challenges, weekly highlights, AI-generated Celebrity-Inspired Looks, and Influencer Inspiration.
- **Bargains of the Day**: A dedicated section for daily deals from trusted retailers with filtering and real-time countdowns.
- **Events Near You**: Location-based event discovery with integrated outfit suggestions.
- **Security**: ProGuard for Android, JavaScript obfuscation, and Hermes Engine are implemented for code protection.
- **Dynamic Theming**: Six distinct style themes with corresponding light/dark modes.
- **Gender & Region Specificity**: UI, content, models, and advice are tailored based on the user's specified gender and region.
- **Cultural & Dress Code Preferences**: Supports various religious/modest dress codes (e.g., hijab-friendly, tzniut) and subculture styles (e.g., goth, cottagecore), with configurable strictness levels.
- **Fashion Accessories System**: AI advice extends to recommendations for luxury bags, eyewear, belts, jewelry, watches, and winter accessories.
- **Fashion Trend Intelligence System**: Curates global trend data to provide regional and gender-specific insights on trends, items, influencers, colors, and style movements.
- **Visual Outfit Inspiration System**: A Pinterest-style feature offering curated outfit libraries, with future plans for AI-generated images via DALL-E.
- **Goal-Based Content Personalization**: AI and content are personalized based on user-selected goals (e.g., Dress Better, Find Deals, Build Wardrobe), ensuring 70% of content directly supports these objectives.
- **Advanced AI Capabilities**:
    - **Model Lifecycle System**: Manages automatic model upgrades, A/B testing, and health checks.
    - **Vision-Powered Outfit Analysis**: Utilizes GPT-4o Vision for detailed color extraction, style detection, fit analysis, and multi-image comparison.
    - **Voice Services**: ElevenLabs TTS (eleven_multilingual_v2) provides Siri/Alexa-quality voices for Ruby and Max personas in 13 languages, with Whisper for speech-to-text.
    - **Name Pronunciation Feedback System**: Allows users to confirm name pronunciation for AI stylists, with a fallback to culturally appropriate friendly terms if incorrect.
    - **AI Stylist Chat System**: Contextual conversations with Ruby and Max using GPT-4o/4.1, incorporating user profile data, persistent chat history, and optional voice generation.
    - **Personality Learning System**: Automatically captures key conversational moments and analyzes user communication style, fashion confidence, style personality, shopping behavior, and preferred tone to personalize future interactions.
    - **Fashion Therapy & Wellness**: Offers mood-based outfit recommendations, body positivity affirmations, and capsule wardrobe planning.
    - **Semantic Style Search**: Employs `text-embedding-3-large` for semantic outfit matching and complementary piece suggestions.
    - **AI Image Generation**: DALL-E 3 is used for generating outfit inspiration, mood boards, and style guide visualizations.
    - **Complex Analysis**: Premium/VIP subscribers receive deep fashion analysis, including wardrobe audits and personal style profiles, powered by o1 Reasoning Models.
    - **Virtual Try-On**: Integrates Replicate's IDM-VTON model for AI-powered virtual try-on experiences, available to subscribers.
- **VIP Video Calling System**: Exclusive video call functionality for VIP members, including online status and call history.
- **Admin Notification System**: Utilizes SendGrid for email and Twilio (to be configured) for SMS notifications, particularly for VIP purchases.
- **Marketing & Growth Features**: Includes social sharing, deep linking, a referral program, App Store review prompts, and an email newsletter signup.

## External Dependencies
- **Stripe**: For subscription management and payment processing.
- **SendGrid**: Handles transactional emails, such as VIP alerts and newsletters.
- **Twilio**: Planned for SMS notifications (e.g., VIP alerts).
- **Expo**: Utilized for `expo-audio`, `expo-sharing`, `expo-store-review`, and `expo-linking` functionalities.
- **OpenAI API**: Powers AI Stylist interactions, Vision capabilities, Voice services, Image Generation, and Complex Analysis through various models (GPT-4.1, GPT-4.1-nano, o3, GPT-4o, GPT-4-turbo, DALL-E 3, Whisper, text-embedding-3-large).
- **ElevenLabs**: Provides high-quality Text-to-Speech (TTS) via `eleven_multilingual_v2` for authentic native speaker voices in 13 languages.
- **Replicate**: Integrated for the IDM-VTON model, enabling virtual try-on.
- **PostgreSQL**: The chosen backend database.
- **Affiliate APIs**: Used for "Shop Now" functionality.
- **Event APIs**: Incorporates Timeout, TodayTix, Eventbrite, Meetup, and ClassPass for "Events Near You" feature.
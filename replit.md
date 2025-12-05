# StyleWise - Fashion Advice Mobile App

## Overview
StyleWise is a mobile fashion advice app built with Expo React Native, designed to allow users to post outfit photos/videos and receive styling advice from both AI and community members. The app aims to provide size-inclusive recommendations, shoppable affiliate content, dynamic UI theming, and strong community engagement. It supports freemium subscriptions and offers a comprehensive platform for fashion enthusiasts with a vision for market potential in personalized fashion.

## User Preferences
I prefer detailed explanations.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

## System Architecture
The app is built with Expo React Native and TypeScript, utilizing React Navigation 7+ for navigation and React Context API for state management. Local persistence is handled by AsyncStorage. The UI adheres to an iOS 26 Liquid Glass design system, featuring 7 dynamic, fashion-inspired color themes with light/dark modes (Luxury, Streetwear, Boho, Sporty, Business/Smart Casual, Edgy), with gender-specific adaptations for "Business."

The application incorporates a dynamic "Hot Colors Rotation Policy" that ensures the color palette in `constants/theme.ts` is updated annually based on Pantone's "Color of the Year" announcements, always featuring colors for the current and next year.

Key Features include:
- **Subscription Tiers**: Freemium model with Free, Basic, Premium, and VIP tiers offering varied access to uploads, AI advice requests, video posts, and personal stylist sessions.
- **Content Creation**: Users can create outfit posts with photos/videos and comparison polls.
- **AI Fashion Advice**: AI-driven advice incorporates color analysis, personalized recommendations, influencer trends, and culturally relevant insights, filtered by gender and region.
- **Community Engagement**: Supports voice comments, content reporting, and viral sharing with auto-generated hashtags.
- **Discovery**: Features include "Style of the Day," category browsing, trending challenges, weekly highlights, Celebrity-Inspired Looks (AI-generated), and Influencer Inspiration.
- **Bargains of the Day**: Dedicated tab for daily deals from trusted retailers with category filtering and real-time expiry countdowns.
- **Events Near You**: Location-based event discovery with outfit suggestions, sourced from multiple external platforms.
- **Code Protection**: Includes ProGuard for Android, JavaScript obfuscation, and Hermes Engine for enhanced security and performance.

Technical Implementations:
- **Dynamic Theming**: Six style themes with light/dark modes.
- **AI Integration**: Mock service in place, ready for OpenAI integration, providing gender and region-specific advice.
- **Gender-Specific Experience**: UI and content (models, advice, influencers) are tailored based on user's gender.
- **Region-Specific Images**: Style previews (Boho, Sporty, Business, Smart Casual) use regional models based on the user's country across 7 regions.
- **Stripe Integration**: Client-side ready for subscription payments.
- **Backend**: A separate Node.js backend supports full API functionality with PostgreSQL.

The app also includes a comprehensive **Fashion Accessories System** within the AI advice, covering luxury bags (men/women), designer eyewear, belts, fine jewelry, luxury watches, and winter accessories, with specific brand and style recommendations.

A **Fashion Trend Intelligence System** curates global trend data from fashion publications and influencers. This system delivers regional/gender-specific trend data, trending items, influencer recommendations, color trends, style movements, and cultural notes, with access tiered by subscription level.

A **Visual Outfit Inspiration System** provides a Pinterest-style feature with similar outfit ideas. It uses a curated outfit library organized by style category and gender, with future plans for AI-generated images via DALL-E integration.

## External Dependencies
- **Stripe**: For subscription management and payment processing.
- **Expo-audio**: Used for voice comments functionality.
- **OpenAI API**: Intended for real AI fashion advice (currently mocked).
- **PostgreSQL**: Database solution for the backend.
- **Affiliate APIs**: Planned for "Shop Now" functionality.
- **Event APIs**: Timeout, TodayTix, Eventbrite, Meetup, ClassPass (for "Events Near You").
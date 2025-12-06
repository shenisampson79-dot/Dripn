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
- **Subscription Tiers**: Freemium model with Free, Basic, Premium, and VIP ($4,999/month) tiers offering varied access to uploads, AI advice requests, video posts, personal stylist sessions, and VIP video calling.
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

## VIP Video Calling System
VIP members have exclusive access to video calling features hosted on the StyleWise platform:

**VIP-to-VIP Calls**:
- VIP members can browse other available VIP members in the VIP Members screen
- Online status indicators show availability
- Video calls are initiated and hosted within StyleWise (not external social media)
- Call history and duration tracking

**Stylist Video Sessions**:
- 4x 60-minute video styling sessions per month for VIP members
- Sessions with professional stylists conducted via video call
- Session notes and completion tracking

**Access Control**:
- Video calling features only visible/accessible to VIP tier subscribers
- Non-VIP users see upgrade prompts when attempting to access video features
- Backend enforces VIP-only access via vipAuthMiddleware

**Technical Implementation**:
- Frontend screens: `screens/VIPMembersScreen.tsx`, `screens/VideoCallScreen.tsx`
- API endpoints in `backend-code/index.js`:
  - `GET /api/video/vip-members` - List VIP members for calling
  - `POST /api/video/call` - Initiate VIP-to-VIP call
  - `POST /api/video/call/:id/accept` - Accept incoming call
  - `POST /api/video/call/:id/end` - End/decline call
  - `GET /api/video/incoming` - Get pending incoming calls
  - `GET /api/video/history` - Get call history
  - `POST /api/sessions/:id/start-video` - Start stylist video session
- Database tables: `vip_peer_calls`, `vip_sessions` (with room_url, room_token columns)
- Navigation: Accessible from Profile screen for VIP users

## Admin Notification System
The backend includes an admin notification system for VIP purchases:

**Email Notifications (SendGrid)**:
- Sends to: shenisampson79@gmail.com, sheni_sampson@yahoo.co.uk
- Triggered on VIP membership purchases

**SMS Notifications (Twilio)** - To be configured:
- Sends to: +447835913601
- Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER secrets

**Stripe Webhook** (`/api/stripe/webhook`):
- Detects VIP purchases via price ID (price_vip_monthly, price_vip_yearly) or metadata
- Handles: checkout.session.completed, customer.subscription.created/updated, invoice.paid

**Test Endpoint** (`POST /api/admin/test-vip-notification`):
- Admin-only endpoint to test the notification system
- Sends test emails and SMS to admin contacts

Files:
- `backend-code/notificationService.js` - Email and SMS notification logic
- `backend-code/index.js` - Stripe webhook and test endpoint

## Marketing & Growth Features
The app includes comprehensive marketing and growth features:

**Social Sharing with Branding**:
- Branded share messages with StyleWise hashtags (#StyleWise #FashionAdvice)
- Deep link sharing for posts, profiles, and outfits
- Platform-optimized sharing via expo-sharing
- Service: `services/SharingService.ts`

**Referral Program**:
- Unique referral codes generated per user (format: SW + 6 alphanumeric chars)
- Referral tracking and rewards system
- 10% discount rewards for successful referrals
- Context: `contexts/ReferralContext.tsx`
- UI: Accessible from Settings screen "Invite Friends" section

**App Store Review Prompts**:
- Smart review prompting using expo-store-review
- Triggered after positive user engagement
- Integrated into post creation and sharing flows

**Deep Link Sharing**:
- Configured expo-linking for content deep links
- Supports sharing specific posts, profiles, and outfits
- URL scheme: stylewise://

**Email Newsletter Signup**:
- Fashion updates newsletter subscription
- Toggle in Settings screen under "Newsletter" section
- Backend integration via SendGrid for newsletter delivery
- API: `services/ApiService.ts` newsletter methods

## External Dependencies
- **Stripe**: For subscription management and payment processing.
- **SendGrid**: For transactional email notifications (VIP purchase alerts, newsletters).
- **Twilio**: For SMS text alerts (VIP purchase alerts) - to be configured.
- **Expo-audio**: Used for voice comments functionality.
- **Expo-sharing**: For branded social sharing functionality.
- **Expo-store-review**: For App Store review prompts.
- **Expo-linking**: For deep link sharing.
- **OpenAI API**: Intended for real AI fashion advice (currently mocked).
- **PostgreSQL**: Database solution for the backend.
- **Affiliate APIs**: Planned for "Shop Now" functionality.
- **Event APIs**: Timeout, TodayTix, Eventbrite, Meetup, ClassPass (for "Events Near You").
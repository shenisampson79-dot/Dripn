# StyleWise - Fashion Advice Mobile App

## Overview
StyleWise is a mobile fashion advice app built with Expo React Native. It allows users to post outfit photos/videos and receive styling advice from both AI and community members. The app aims to provide size-inclusive recommendations, shoppable affiliate content, dynamic UI theming, and strong community engagement. It supports freemium subscriptions and offers a comprehensive platform for fashion enthusiasts.

## User Preferences
I prefer detailed explanations.
Do not make changes to the folder `Z`.
Do not make changes to the file `Y`.

## System Architecture
The app is built with **Expo React Native** and **TypeScript**, utilizing **React Navigation 7+** for navigation and **React Context API** for state management. Local persistence is handled by **AsyncStorage**. The UI adheres to an **iOS 26 Liquid Glass design system**, featuring 7 dynamic, fashion-inspired color themes with light/dark modes (Luxury, Streetwear, Boho, Sporty, Business/Smart Casual, Edgy). **Note:** Men see "Business" instead of "Romantic" - covering formal suits, tuxedos, business casual wear.

**2025/2026 Fashion Color Palette:**
- **Mocha Mousse** (#4A3428) - Pantone 2025 Color of the Year
- **Cloud Dancer** (#E8DDD3) - Pantone 2026 Color of the Year (airy white)
- **Capri Blue** (#0077B6) - SS26 trending blue
- **Berry Red** (#8B2F39) - Bold statement red
- **Parma Violet** (#9B7EBD) - Trending purple
- **Lemon Grass** (#A8C256) - Fresh green accent
- **Brandied Melon** (#C87941) - Warm muted orange
- **Lyons Blue** (#1E5B73) - Deep teal for business

**Hot Colors Rotation Policy:**
- The app always features colors for the CURRENT YEAR and NEXT YEAR only
- When a year ends (e.g., Dec 31 2025), remove that year's colors from the palette
- Pantone typically announces next year's Color of the Year in early December
- Update the color palette when new year colors are announced
- Example: In January 2026, remove 2025 colors (Mocha Mousse), keep only 2026 colors until 2027 colors are announced
- Theme colors in `constants/theme.ts` should be updated accordingly each year

**Key Features:**
- **Subscription Tiers**: Freemium model with Free ($0), Basic ($4.99/mo, ad-free), Premium ($9.99/mo, ad-free), and VIP ($49.99/mo) tiers, offering varying levels of uploads, AI advice requests, and advanced features like video posts and personal styling sessions.
- **Content Creation**: Users can create standard outfit posts with photos/videos and comparison polls (A vs B voting).
- **AI Fashion Advice**: Integration for AI-driven advice, including color analysis and personalized recommendations. This service also incorporates influencer-inspired content, trending fashion data, and culturally relevant advice based on user region, including athleisure and preppy/countryside styles. It features both male and female fashion influencers.
- **Community Engagement**: Supports voice comments, content reporting, and viral sharing with auto-generated hashtags.
- **Discovery**: Features include "Style of the Day," category browsing (Trending, Casual, Formal), trending challenges, weekly highlights, Celebrity-Inspired Looks (AI-generated), and Influencer Inspiration.
- **Bargains of the Day**: Dedicated tab showing daily deals from trusted retailers (Huntd, Sports Direct, The Outnet, brand websites). Features category filtering, VIP-exclusive luxury deals up to 90% off, and real-time expiry countdowns.
- **Events Near You**: Location-based event discovery with outfit suggestions. Categories include Fitness, Social, Lifestyle, Dating, Fashion, Music, and Outdoor. Sources events from Timeout, TodayTix, Eventbrite, Meetup, ClassPass, and local venues.
- **Code Protection**: Includes ProGuard for Android, JavaScript obfuscation (via `obfuscator-io-metro-plugin` in `metro.config.js`) for production builds, and Hermes Engine for compiling JavaScript to bytecode, enhancing security and performance.

**Technical Implementations:**
- **Dynamic Theming**: Six style themes with light/dark modes.
- **AI Integration**: Mock service is in place, ready for OpenAI integration. All advice is gender-specific and region-specific.
- **Gender-Specific Experience**: Males see male models and fashion advice; females see female models and advice. Influencer recommendations are filtered by gender.
- **Region-Specific Images**: Style previews (Boho, Sporty) use regional models based on user's country (African, Latin American, Asian, South Asian, Middle Eastern, Nordic, Multicultural).
- **Stripe Integration**: Client-side ready for subscription payments, requiring a backend for checkout processing.
- **Backend**: A separate Node.js backend is available for full API functionality, including OpenAI and PostgreSQL integration.

## Gender-Specific & Regional Image System
The onboarding and style selection shows gender-appropriate and region-appropriate models:
- **Image Structure**: `assets/images/styles/[category]/[gender]/[region].png`
- **Supported Styles**: Boho, Sporty, Business, Smart Casual (with full gender/region matrix)
- **Business Style (Men Only)**: Professional suits, dress shirts, ties, tuxedos, business casual (slacks, chinos, blazers)
- **Smart Casual Style (Women Only)**: Polished yet relaxed looks - skinny jeans with tailored blazers and white trainers, refined casual elegance
- **7 Regions**: African, Latin American, Asian, South Asian, Middle Eastern, Nordic, Multicultural
- **2 Genders**: Male, Female (non-binary defaults to female representation)

## External Dependencies
- **Stripe**: For subscription management and payment processing.
- **Expo-audio**: Used for voice comments functionality.
- **OpenAI API**: Intended for real AI fashion advice (currently uses a mock service).
- **PostgreSQL**: Database solution for the backend.
- **Affiliate APIs**: Planned integration for "Shop Now" functionality in shoppable content (currently "Coming Soon").

## Fashion Accessories System
The AI advice service includes comprehensive coverage of fashion accessories, key to completing any outfit:

### Luxury Bags (Women)
- **Celine**: Triomphe, Ava, 16 Bag - quiet luxury essentials
- **Chanel**: Classic Flap, Boy Bag, Gabrielle - timeless status symbols
- **Mulberry**: Bayswater, Lily, Alexa - British heritage icons
- **Bottega Veneta**: Jodie, Cassette - intrecciato woven luxury
- **Loewe**: Puzzle, Hammock - architectural masterpieces
- **Dior**: Lady Dior, Saddle - cannage quilting elegance
- **Hermes**: Birkin, Kelly - ultimate investment pieces
- **YSL**: Loulou - Parisian chic
- **Prada**: Re-Edition 2005, Galleria - modern classics

### Luxury Bags (Men)
- **Young/Cool**: LV Christopher Backpack, MCM Stark Backpack, Gucci GG Supreme
- **Business Travel**: Rimowa Original Cabin, Tumi Alpha Bravo, Montblanc Meisterstuck Briefcase, Berluti Un Jour
- **Everyday**: LV Keepall 45, Prada Re-Nylon Backpack, Gucci Ophidia Messenger

### Designer Eyewear
- **Miu Miu**: Oversized cat-eye, crystal embellished - playful feminine
- **Celine**: Square oversized, Triomphe - French minimalism
- **Prada**: Geometric cat-eye - architectural elegance
- **Gucci**: Web stripe, oversized square - Hollywood glamour
- **Ray-Ban**: Wayfarer, Aviator - timeless classics
- **Oliver Peoples**: O'Malley - celebrity favorite
- **Cartier**: Rimless gold - quiet wealth

### Designer Belts
- **Hermes H Belt** - stealth wealth icon
- **Gucci GG Marmont** - instantly recognizable
- **Celine Triomphe** - quiet sophistication
- **Bottega Veneta Intrecciato** - no-logo luxury
- **YSL Cassandre** - Parisian chic
- **Ferragamo Gancini** - Italian elegance for men

### Fine Jewelry
- **Cartier**: Love Bracelet, Juste un Clou, Trinity Ring
- **Tiffany & Co**: T Collection, Return to Tiffany, Elsa Peretti Bean
- **Van Cleef & Arpels**: Alhambra Necklace, Perlee Bracelet
- **Bvlgari**: B.zero1 Ring, Serpenti Bracelet
- **Men's Options**: David Yurman Spiritual Beads, Tom Wood rings, Miansai cuffs

### Luxury Watches
- **Women**: Cartier Tank/Panthère, Rolex Datejust 31, Chanel J12
- **Men**: Rolex Submariner/Datejust, Omega Seamaster, Patek Philippe Nautilus, AP Royal Oak
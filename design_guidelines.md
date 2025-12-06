# Dripn Design Guidelines

## Authentication & Onboarding

**Authentication Required**: Social features (posting, commenting, voting) require user accounts.

**Auth Implementation**:
- Apple Sign-In (primary for iOS)
- Google Sign-In (secondary)
- Email/password (fallback)
- Privacy policy & terms links on auth screens

**Onboarding Flow**:
1. Welcome screen introducing Dripn value proposition
2. Authentication screen
3. Style profile setup (optional fields):
   - Country selection (required for seasonal content)
   - Style preference: Luxury, Streetwear, Boho, Sporty, Romantic, Edgy
   - Size range (optional): XS-S, M-L, XL-2X, 3X+
   - Body shape (optional): Hourglass, Pear, Apple, Rectangle, Athletic
   - Budget range (optional)
4. Theme preview (shows how app adapts to their style)
5. 7-day Premium trial offer (optional, can skip to Free)

**Account Management**:
- Profile screen with edit capabilities
- Logout with confirmation alert
- Delete account nested in Settings > Account > Delete with double confirmation

---

## Navigation Architecture

**Root Navigation**: Tab Navigation (5 tabs)

**Tab Bar Structure**:
1. **Home** - Main feed
2. **Discover** - Style of the Day/Week, trending posts
3. **Post** (center, elevated) - Create new outfit post
4. **Community** - Explore users, top contributors
5. **Profile** - Personal dashboard, settings

**Tab Bar Specs**:
- Position: Bottom (iOS standard)
- Height: 83px (49px content + 34px safe area)
- Background: Adapts to theme + light/dark mode
- Selected state: Filled icon + accent color + label
- Unselected: Outlined icon + secondary color
- Center tab (Post): Floating action button style, elevated 8px above tab bar

---

## Dynamic Theming System

**Six Style Themes** with Light/Dark mode variants:

1. **Luxury/Minimalist**
   - Light: Whites, creams, soft greys, gold accents
   - Dark: Charcoal, black, warm grey, champagne gold
   - Typography: Serif headings, refined sans-serif body
   - Aesthetic: Clean, spacious, elegant

2. **Streetwear**
   - Light: Urban greys, whites, neon accent pops
   - Dark: Deep blacks, concrete grey, vibrant accent colors
   - Typography: Bold sans-serif, all caps for emphasis
   - Aesthetic: Edgy, high contrast, dynamic

3. **Boho**
   - Light: Cream, terracotta, sage green, mustard
   - Dark: Deep brown, forest green, warm neutrals
   - Typography: Rounded, organic sans-serif
   - Aesthetic: Earthy, soft, flowing

4. **Sporty/Athletic**
   - Light: Bright white, energetic blues, oranges
   - Dark: Navy, electric blue, energetic accents
   - Typography: Bold, geometric sans-serif
   - Aesthetic: Dynamic, energetic, angular

5. **Romantic/Feminine**
   - Light: Blush pink, lavender, ivory, soft peach
   - Dark: Plum, dusty rose, charcoal with warm undertones
   - Typography: Elegant sans-serif, soft curves
   - Aesthetic: Gentle, delicate, flowing

6. **Edgy/Alternative**
   - Light: White, black, burgundy, forest green
   - Dark: Pure black, blood red, deep purple
   - Typography: Sharp sans-serif, condensed
   - Aesthetic: Bold, dramatic, moody

**Theme Application**:
- User selects style preference in onboarding/settings
- App instantly adapts color palette, typography, UI shapes
- Light/Dark mode toggle available in all themes
- Background images/patterns match aesthetic

---

## Typography

**Primary Font**: SF Pro (iOS system font)

**Type Scale**:
- Hero: 34px, Bold (welcome screens, empty states)
- H1: 28px, Bold (screen titles)
- H2: 22px, Semibold (section headers)
- H3: 18px, Semibold (card titles)
- Body: 16px, Regular (main content)
- Caption: 14px, Regular (metadata, timestamps)
- Small: 12px, Regular (labels, badges)

**Line Heights**: 1.4x font size for body text, 1.2x for headings

---

## Color System

**Functional Colors** (adapt to theme):
- Primary: Theme-specific accent
- Secondary: 60% opacity of primary
- Success: Green (#34C759 light, #32D74B dark)
- Warning: Orange (#FF9500 light, #FF9F0A dark)
- Error: Red (#FF3B30 light, #FF453A dark)
- Info: Blue (#007AFF light, #0A84FF dark)

**Neutral Scale** (theme-adaptive):
- Background: Theme-specific base
- Surface: Elevated backgrounds, cards
- Border: Subtle dividers
- Text Primary: High contrast
- Text Secondary: 70% opacity
- Text Tertiary: 50% opacity

---

## Spacing System

**Base Unit**: 4px

- **xs**: 4px
- **sm**: 8px
- **md**: 16px
- **lg**: 24px
- **xl**: 32px
- **2xl**: 48px
- **3xl**: 64px

---

## Screen Specifications

### **Home Feed Screen**
- **Layout**: Scrollable feed (FlatList/FlashList)
- **Header**: Transparent, scrolls with content
  - Left: Dripn logo
  - Right: Filter icon (Global/Regional toggle)
- **Safe Area Insets**: 
  - Top: headerHeight + Spacing.xl
  - Bottom: tabBarHeight + Spacing.xl
- **Content**: Mix of user posts and AI-curated "Style of Day/Week"
- **Post Cards**:
  - Full-width images/videos
  - User avatar, name, subscription badge (top overlay)
  - Engagement row: Upvote/downvote, comment count, share
  - "Thanks" count badge
  - For comparison posts: Voting buttons overlaid on each image

### **Post Creation Screen** (Modal)
- **Presentation**: Full-screen modal from tab bar center button
- **Header**: 
  - Left: Cancel button
  - Center: "New Post" title
  - Right: None (submit after form)
- **Layout**: Scrollable form
- **Sections**:
  1. Post type selector: Standard / Help Me Choose
  2. Media upload zone (camera/gallery buttons)
  3. Description text area
  4. Submit button (bottom, above safe area)
- **Safe Area Insets**: 
  - Top: Spacing.xl
  - Bottom: insets.bottom + Spacing.xl

### **Profile Dashboard Screen**
- **Layout**: Scrollable
- **Header**: Default navigation header
  - Left: None
  - Right: Settings gear icon
- **Content**:
  - Profile section: Avatar (editable), name, subscription badge, contributor badge
  - Stats row: Posts count, helpful votes, thanks received
  - Tab selector: "My Posts" / "My Advice"
  - Grid/list of content
- **Safe Area Insets**:
  - Top: Spacing.xl
  - Bottom: tabBarHeight + Spacing.xl

### **Post Detail Screen**
- **Layout**: Scrollable
- **Header**: Default navigation header
  - Left: Back button
  - Right: Share + Report (overflow menu)
- **Content**:
  - Full post with media
  - Engagement actions
  - Comments section (scrollable list)
  - Voice comment waveform players with transcripts
- **Comment Input**: Sticky bottom input bar
  - Text input / Voice record toggle
  - Submit button
- **Safe Area Insets**:
  - Top: Spacing.xl
  - Bottom: tabBarHeight + Spacing.xl

### **Subscription/Paywall Screen** (Modal)
- **Presentation**: Full-screen modal
- **Header**: 
  - Left: Close button
  - Center: "Choose Your Plan"
- **Layout**: Scrollable
- **Content**:
  - Tier comparison cards (Free, Basic, Premium, VIP)
  - Feature comparison table
  - 7-day trial banner
  - CTA buttons
  - Fine print (auto-renewal, cancel anytime)
- **Safe Area Insets**:
  - Top: Spacing.xl
  - Bottom: insets.bottom + Spacing.xl

### **Admin Dashboard** (Web-based, separate from mobile app)
- Responsive web interface
- Sections: Analytics, Moderation Queue, Settings, Content Management

---

## Component Patterns

### **Touchable Feedback**
- All buttons/cards: Opacity 0.7 on press
- Floating buttons: Subtle shadow (shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.10, shadowRadius: 2)
- Tab bar: No shadow, selected state via color/icon

### **Post Card**
- Full-width image/video
- Gradient overlay on bottom for metadata visibility
- Avatar: 40px circular, top-left corner
- Voting: Heart outline (upvote), X outline (downvote) - fills on press

### **Voice Comment**
- Waveform visualization (bars)
- Play/pause button (left)
- Transcript below (collapsible)
- Duration label

### **Comparison Post**
- Side-by-side images (swipeable carousel)
- Vote button on each option
- Real-time vote count badge
- Winning option highlighted

### **Shoppable Product Card**
- Image (top)
- Item name, price, size availability
- Affiliate link button: "Shop Now" with external link icon
- Affiliate disclosure: Small text at card bottom

### **Subscription Tier Badge**
- Pill shape, 8px border radius
- Free: Grey
- Basic: Blue
- Premium: Purple gradient
- VIP: Gold gradient

### **Contributor Badge**
- Icon + tier name
- Style Contributor: Bronze
- Fashion Advisor: Silver
- Style Expert: Gold
- Fashion Guru: Platinum with sparkle

---

## Visual Design Principles

- **No emojis in UI** - Use Feather icons from @expo/vector-icons
- **Imagery**: AI-generated style-appropriate content, user uploads, product photos only
- **Shadows**: Minimal, only on floating elements (exact specs above)
- **Corners**: 12px border radius for cards, 8px for buttons, 20px for pills/badges
- **Icons**: 24px for primary actions, 20px for navigation, 16px for inline

---

## Accessibility

- Minimum touch target: 44x44px
- Color contrast: WCAG AA (4.5:1 for text)
- Voice transcripts for all audio content
- Alternative text for all images
- Semantic headings for screen readers
- Focus indicators on all interactive elements

---

## Key Assets to Generate

1. **User avatars** (6 presets matching each style theme aesthetic)
2. **App icon** (Dripn logo, 1024x1024px)
3. **Splash screen** (matches selected theme)
4. **Empty state illustrations** (style-appropriate, no photos to post yet, etc.)
# Dripn Color Governance Policy

## Overview

This document defines which colors in the Dripn app are **fixed brand elements** versus **trend-updatable accents** that can be refreshed annually using AI-powered color trend intelligence.

---

## Core Brand Colors (FIXED - Never Change)

These colors define Dripn's premium identity and must remain consistent:

### Primary Brand Palette
| Color Name | Hex Code | Usage |
|------------|----------|-------|
| Mocha Mousse | #4A3428 | Primary brand color, luxury theme anchor |
| Champagne Gold | #C9A87C | Accent gold, premium highlights |
| Deep Cream | #FAF8F5 | Light mode backgrounds |
| Rich Dark | #0D0B09 | Dark mode backgrounds |

### VIP/Premium Tier Colors
| Color Name | Hex Code | Usage |
|------------|----------|-------|
| VIP Gold Start | #D4AF37 | VIP gradient start |
| VIP Gold End | #B8860B | VIP gradient end |
| Premium Purple Start | #667eea | Premium gradient start |
| Premium Purple End | #764ba2 | Premium gradient end |

### Contributor Badge Colors
| Tier | Color | Fixed Reason |
|------|-------|--------------|
| Style Contributor | #CD7F32 (Bronze) | Metal tier recognition |
| Fashion Advisor | #C0C0C0 (Silver) | Metal tier recognition |
| Style Expert | #FFD700 (Gold) | Metal tier recognition |
| Fashion Guru | #E5E4E2 (Platinum) | Metal tier recognition |

---

## Trend-Updatable Colors

These colors can be refreshed annually based on AI analysis of fashion trends while maintaining brand cohesion:

### Per-Style Theme Accents
Each style theme has secondary and accent colors that can evolve:

| Style Theme | Updatable Elements |
|-------------|-------------------|
| Luxury | secondary (currently #8B6F5C) |
| Streetwear | secondary (#0077B6), accent (#F5D547) |
| Boho | secondary (#A8C256), accent (#D4A574) |
| Sporty | secondary (#F5D547), accent (#00B894) |
| Smart Casual | secondary (#7A9AAB) |
| Business | primary (#1E5B73), secondary (#4A3428) |
| Edgy | secondary (#9B7EBD), accent (#1E5B73) |

### Functional Colors
These can be updated to match trending palettes:

| Function | Current Light | Current Dark | Updatable |
|----------|--------------|--------------|-----------|
| Success | #00B894 | #00D9A5 | Yes |
| Warning | #C87941 | #E09860 | Yes (must stay warm) |
| Info | #0077B6 | #00A8E8 | Yes (must stay cool) |
| Error | #8B2F39 | #C94C5A | Partially (must convey urgency) |

### Regional Color Preferences
Different fashion markets favor different color palettes:

| Region | Color Preferences | Notes |
|--------|------------------|-------|
| UK | Deep blues, forest greens, burgundy | Classic, understated |
| US | Bold primaries, pastels | Diverse, trend-forward |
| France | Neutrals, muted tones, noir | Elegant, minimalist |
| Italy | Warm earth tones, rich colors | Luxurious, vibrant |
| Japan | Pastels, neutrals, pops of neon | Clean, kawaii influences |
| Middle East | Gold, deep jewel tones | Opulent, rich |
| Nigeria/West Africa | Bold prints, vibrant colors | Celebratory, confident |
| Brazil | Bright, tropical colors | Energetic, warm |

---

## Color Update Process

### Annual Trend Scan (December/January)
1. AI scans Pantone Color of the Year announcement
2. AI analyzes fashion week runways (Milan, Paris, New York, London)
3. AI reviews regional fashion publications
4. AI generates recommended palette updates per style theme

### Admin Review (Required)
1. Admin reviews AI-generated palettes
2. Tests contrast and accessibility
3. Approves or modifies suggestions
4. Activates new palettes

### Color Quality Rules
All trend colors MUST:
- Pass WCAG AA contrast ratio (4.5:1 for text)
- Complement fixed brand colors
- Maintain premium aesthetic
- Not exceed saturation limits (HSL saturation ≤ 75% for most elements)
- Work in both light and dark modes

---

## Implementation Notes

### Database Table: trend_color_palettes
```sql
CREATE TABLE trend_color_palettes (
  id UUID PRIMARY KEY,
  year INTEGER NOT NULL,
  region VARCHAR(50) NOT NULL,
  style_theme VARCHAR(50) NOT NULL,
  color_role VARCHAR(50) NOT NULL, -- 'secondary', 'accent', etc.
  color_value VARCHAR(7) NOT NULL, -- hex code
  color_name VARCHAR(100),
  source VARCHAR(100), -- 'pantone', 'vogue', 'regional'
  mood_tags TEXT[],
  is_active BOOLEAN DEFAULT false,
  approved_by UUID,
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### API Endpoints
- `POST /api/admin/color-trends/scan` - Trigger AI color scan
- `GET /api/admin/color-trends/pending` - View pending palettes
- `POST /api/admin/color-trends/:id/approve` - Approve palette
- `GET /api/color-trends/active` - Get active palettes for user

### Frontend Integration
The theme context will:
1. Load base colors from constants/theme.ts
2. Fetch active trend colors from API (with caching)
3. Merge trend colors into the appropriate style theme
4. Apply regional overrides if available
5. Fall back to base colors if API unavailable

---

## Color Sources for AI Analysis

### Global Sources
- Pantone Color Institute (Color of the Year, Fashion Color Report)
- WGSN (World's Global Style Network)
- Coloro (Color forecasting)
- Adobe Color Trends

### Fashion Publication Sources
- Vogue (US, UK, France, Italy editions)
- Harper's Bazaar
- Elle
- GQ / Esquire (menswear)
- WWD (Women's Wear Daily)
- Business of Fashion

### Regional Sources
- UK: British Vogue, Dazed, i-D
- US: Who What Wear, Refinery29
- France: Vogue Paris, L'Officiel
- Italy: Vogue Italia
- Japan: Vogue Japan, WWD Japan
- Middle East: Vogue Arabia
- Nigeria: Glazia, StyleVitae
- Brazil: Vogue Brasil

---

*Last Updated: December 2025*
*Policy Version: 1.0*

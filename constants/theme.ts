/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Dripn Theme System and color palettes are proprietary.
 */

import { Platform } from "react-native";

// Dripn Theme System
// Dynamic theming based on user's fashion style preference

export type StyleTheme = 'luxury' | 'streetwear' | 'boho' | 'sporty' | 'smart-casual' | 'business' | 'edgy';

// Theme-specific colors for each style
// Updated for 2025/2026 fashion trends: Mocha Mousse, Cloud Dancer, Capri Blue, Berry Red, Parma Violet
export const StyleThemes = {
  luxury: {
    light: {
      primary: '#4A3428',
      secondary: '#8B6F5C',
      accent: '#C9A87C',
      background: '#FAF8F5',
      surface: '#F0EBE4',
      surfaceSecondary: '#E5DED4',
      surfaceTertiary: '#D8CFC2',
      text: '#1A1A1A',
      textSecondary: '#4A4A4A',
      textTertiary: '#7A7A7A',
    },
    dark: {
      primary: '#C9A87C',
      secondary: '#8B6F5C',
      accent: '#E8DDD3',
      background: '#0D0B09',
      surface: '#1A1714',
      surfaceSecondary: '#26221E',
      surfaceTertiary: '#332E28',
      text: '#F0EBE4',
      textSecondary: '#C5B8A5',
      textTertiary: '#8A7E6D',
    },
  },
  streetwear: {
    light: {
      primary: '#8B2F39',
      secondary: '#0077B6',
      accent: '#F5D547',
      background: '#FAFAFA',
      surface: '#F0F0F0',
      surfaceSecondary: '#E5E5E5',
      surfaceTertiary: '#D5D5D5',
      text: '#0A0A0A',
      textSecondary: '#3A3A3A',
      textTertiary: '#6A6A6A',
    },
    dark: {
      primary: '#C94C5A',
      secondary: '#00A8E8',
      accent: '#FFE066',
      background: '#0A0A0A',
      surface: '#1A1A1A',
      surfaceSecondary: '#2A2A2A',
      surfaceTertiary: '#3A3A3A',
      text: '#E8DDD3',
      textSecondary: '#B0B0B0',
      textTertiary: '#707070',
    },
  },
  boho: {
    light: {
      primary: '#C87941',
      secondary: '#A8C256',
      accent: '#D4A574',
      background: '#FDF8F3',
      surface: '#F5EDE4',
      surfaceSecondary: '#EBE0D3',
      surfaceTertiary: '#DDD0BE',
      text: '#3D2B1F',
      textSecondary: '#5D4E42',
      textTertiary: '#8A7A6A',
    },
    dark: {
      primary: '#E09860',
      secondary: '#B8D266',
      accent: '#E8C9A8',
      background: '#1A1612',
      surface: '#2A241E',
      surfaceSecondary: '#3A332A',
      surfaceTertiary: '#4A4238',
      text: '#E8DDD3',
      textSecondary: '#C5B8A5',
      textTertiary: '#8A7E6D',
    },
  },
  sporty: {
    light: {
      primary: '#0077B6',
      secondary: '#F5D547',
      accent: '#00B894',
      background: '#FAFCFD',
      surface: '#F0F5F8',
      surfaceSecondary: '#E5ECF0',
      surfaceTertiary: '#D8E2E8',
      text: '#0A1628',
      textSecondary: '#3A4A5A',
      textTertiary: '#6A7A8A',
    },
    dark: {
      primary: '#00A8E8',
      secondary: '#FFE066',
      accent: '#00D9A5',
      background: '#0A1420',
      surface: '#152030',
      surfaceSecondary: '#1F2C40',
      surfaceTertiary: '#2A3850',
      text: '#E8DDD3',
      textSecondary: '#A8B8C8',
      textTertiary: '#687888',
    },
  },
  'smart-casual': {
    light: {
      primary: '#4A3428',
      secondary: '#7A9AAB',
      accent: '#C9A87C',
      background: '#FAF9F7',
      surface: '#F0EEEB',
      surfaceSecondary: '#E8E5E0',
      surfaceTertiary: '#DCD8D2',
      text: '#2C3E50',
      textSecondary: '#4A5B6A',
      textTertiary: '#7A8B9A',
    },
    dark: {
      primary: '#C9A87C',
      secondary: '#7A9AAB',
      accent: '#E8DDD3',
      background: '#0F1215',
      surface: '#1A1E22',
      surfaceSecondary: '#252A30',
      surfaceTertiary: '#30363E',
      text: '#E8DDD3',
      textSecondary: '#B0BEC5',
      textTertiary: '#78909C',
    },
  },
  business: {
    light: {
      primary: '#1E5B73',
      secondary: '#4A3428',
      accent: '#C9A87C',
      background: '#FAFBFC',
      surface: '#F0F2F5',
      surfaceSecondary: '#E4E8EC',
      surfaceTertiary: '#D8DCE0',
      text: '#1A1A2E',
      textSecondary: '#3A3A4E',
      textTertiary: '#6A6A7E',
    },
    dark: {
      primary: '#3D8B9C',
      secondary: '#8B6F5C',
      accent: '#C9A87C',
      background: '#0D0D12',
      surface: '#1A1A24',
      surfaceSecondary: '#262632',
      surfaceTertiary: '#323240',
      text: '#E8DDD3',
      textSecondary: '#B0B8C5',
      textTertiary: '#707888',
    },
  },
  edgy: {
    light: {
      primary: '#8B2F39',
      secondary: '#9B7EBD',
      accent: '#1E5B73',
      background: '#FAFAFA',
      surface: '#F0F0F0',
      surfaceSecondary: '#E0E0E0',
      surfaceTertiary: '#D0D0D0',
      text: '#0A0A0A',
      textSecondary: '#3A3A3A',
      textTertiary: '#6A6A6A',
    },
    dark: {
      primary: '#C94C5A',
      secondary: '#B08ED0',
      accent: '#3D8B9C',
      background: '#0A0A0A',
      surface: '#141414',
      surfaceSecondary: '#1E1E1E',
      surfaceTertiary: '#282828',
      text: '#E8DDD3',
      textSecondary: '#A0A0A0',
      textTertiary: '#606060',
    },
  },
};

// Default tint colors (used for links, tabs, etc.)
// Updated for 2025/2026: Mocha Mousse inspired
const tintColorLight = "#4A3428";
const tintColorDark = "#C9A87C";

export const Colors = {
  light: {
    text: "#11181C",
    buttonText: "#FFFFFF",
    tabIconDefault: "#687076",
    tabIconSelected: tintColorLight,
    link: tintColorLight,
    backgroundRoot: "#FAF8F5",
    backgroundDefault: "#F0EBE4",
    backgroundSecondary: "#E5DED4",
    backgroundTertiary: "#D8CFC2",
    success: "#00B894",
    warning: "#C87941",
    error: "#8B2F39",
    info: "#0077B6",
    border: "#D8CFC2",
  },
  dark: {
    text: "#E8DDD3",
    buttonText: "#FFFFFF",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: tintColorDark,
    link: tintColorDark,
    backgroundRoot: "#0D0B09",
    backgroundDefault: "#1A1714",
    backgroundSecondary: "#26221E",
    backgroundTertiary: "#332E28",
    success: "#00D9A5",
    warning: "#E09860",
    error: "#C94C5A",
    info: "#00A8E8",
    border: "#332E28",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  inputHeight: 48,
  buttonHeight: 52,
};

export const BorderRadius = {
  xs: 8,
  sm: 12,
  md: 18,
  lg: 24,
  xl: 30,
  "2xl": 40,
  "3xl": 50,
  full: 9999,
};

export const Typography = {
  hero: {
    fontSize: 34,
    fontWeight: "700" as const,
  },
  h1: {
    fontSize: 28,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 22,
    fontWeight: "600" as const,
  },
  h3: {
    fontSize: 18,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 20,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 14,
    fontWeight: "400" as const,
  },
  caption: {
    fontSize: 12,
    fontWeight: "400" as const,
  },
  link: {
    fontSize: 16,
    fontWeight: "400" as const,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

// Subscription tier colors
export const SubscriptionColors = {
  free: {
    background: '#E0E0E0',
    text: '#666666',
  },
  basic: {
    background: '#3D8BFF',
    text: '#FFFFFF',
  },
  premium: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    backgroundStart: '#667eea',
    backgroundEnd: '#764ba2',
    text: '#FFFFFF',
  },
  vip: {
    background: 'linear-gradient(135deg, #D4AF37 0%, #B8860B 100%)',
    backgroundStart: '#D4AF37',
    backgroundEnd: '#B8860B',
    text: '#FFFFFF',
  },
};

// Contributor tier colors
export const ContributorColors = {
  styleContributor: {
    background: '#CD7F32',
    text: '#FFFFFF',
    label: 'Style Contributor',
  },
  fashionAdvisor: {
    background: '#C0C0C0',
    text: '#333333',
    label: 'Fashion Advisor',
  },
  styleExpert: {
    background: '#FFD700',
    text: '#333333',
    label: 'Style Expert',
  },
  fashionGuru: {
    background: '#E5E4E2',
    text: '#333333',
    label: 'Fashion Guru',
  },
};

// DRIPN LUXURY COLOR SYSTEM - Master Palette
// A comprehensive, fashion-forward color system for a legendary trendsetting app
export const LuxuryColors = {
  // Core Luxury Palette
  gold: '#C9A87C',
  deepGold: '#A88B5C',
  champagne: '#F5E6D3',
  rose: '#E8B4B8',
  berry: '#8B2F39',
  deepBerry: '#6B2430',
  violet: '#9B7EBD',
  deepViolet: '#6B4E8D',
  royalViolet: '#5B3D7A',
  coral: '#E07A5F',
  deepCoral: '#C46A4F',
  teal: '#2A9D8F',
  emerald: '#059669',
  deepEmerald: '#047857',
  midnight: '#1A1A2E',
  obsidian: '#0D0B09',
  
  // Fashion Accent Colors
  blush: '#F4C2C2',
  peach: '#FFCBA4',
  lavender: '#B8A9C9',
  sage: '#9CAF88',
  navy: '#1E3A5F',
  electric: '#7C3AED',
  magenta: '#DB2777',
  amber: '#F59E0B',
  crimson: '#DC2626',
  sapphire: '#2563EB',
  turquoise: '#14B8A6',
  bronze: '#CD7F32',
  platinum: '#E5E4E2',
  
  // Gradient Intensities (for light/dark mode adjustments)
  overlay: {
    light: 'rgba(255,255,255,0.95)',
    medium: 'rgba(255,255,255,0.8)',
    subtle: 'rgba(255,255,255,0.6)',
  },
  shadow: {
    light: 'rgba(0,0,0,0.1)',
    medium: 'rgba(0,0,0,0.3)',
    heavy: 'rgba(0,0,0,0.6)',
  },
};

// Screen-Specific Gradient Palettes - Each screen gets a unique identity
export const ScreenGradients = {
  // Onboarding Flow - Progressive journey colors
  onboardingEntry: {
    primary: ['#8B2F39', '#DB2777'] as const,      // Berry to Magenta - Bold first impression
    secondary: ['#6B4E8D', '#9B7EBD'] as const,    // Deep to Light Violet
    accent: '#C9A87C',
  },
  welcome: {
    primary: ['#1E3A5F', '#2A9D8F'] as const,      // Navy to Teal - Trust & Innovation
    secondary: ['#C9A87C', '#E8B4B8'] as const,    // Gold to Rose
    accent: '#FFFFFF',
  },
  trustOnboarding: {
    primary: ['#6B4E8D', '#9B7EBD'] as const,      // Royal Violet gradient
    secondary: ['#E8B4B8', '#F4C2C2'] as const,    // Rose to Blush
    accent: '#C9A87C',
  },
  decideForMe: {
    primary: ['#E07A5F', '#DB2777'] as const,      // Coral to Magenta - Energy & Action
    secondary: ['#F59E0B', '#E07A5F'] as const,    // Amber to Coral
    accent: '#FFFFFF',
  },
  styleMeProperly: {
    primary: ['#9B7EBD', '#7C3AED'] as const,      // Violet to Electric - Premium feel
    secondary: ['#2563EB', '#14B8A6'] as const,    // Sapphire to Turquoise
    accent: '#C9A87C',
  },
  softSignupGate: {
    primary: ['#C9A87C', '#A88B5C'] as const,      // Gold gradient - Conversion focus
    secondary: ['#8B2F39', '#6B2430'] as const,    // Berry depth
    accent: '#FFFFFF',
  },
  
  // Main App Screens
  home: {
    primary: ['#1A1A2E', '#2A9D8F'] as const,      // Midnight to Teal - Signature hero
    secondary: ['#C9A87C', '#E07A5F'] as const,    // Gold to Coral
    accent: '#9B7EBD',
  },
  wardrobe: {
    primary: ['#9B7EBD', '#E8B4B8'] as const,      // Violet to Rose - Feminine luxury
    secondary: ['#6B4E8D', '#8B2F39'] as const,    // Deep violet to Berry
    accent: '#C9A87C',
  },
  profile: {
    primary: ['#C9A87C', '#F5E6D3'] as const,      // Gold to Champagne - Personal luxury
    secondary: ['#A88B5C', '#8B2F39'] as const,    // Deep Gold to Berry
    accent: '#9B7EBD',
  },
  settings: {
    primary: ['#2A9D8F', '#059669'] as const,      // Teal to Emerald - Fresh & clear
    secondary: ['#14B8A6', '#047857'] as const,    // Turquoise to Deep Emerald
    accent: '#C9A87C',
  },
  
  // Stylist Screens - Each AI has unique identity
  stylistHub: {
    primary: ['#6B4E8D', '#9B7EBD'] as const,      // Violet base for hub
    secondary: ['#E8B4B8', '#8B2F39'] as const,    // Rose to Berry
    accent: '#C9A87C',
  },
  ruby: {
    primary: ['#E8B4B8', '#8B2F39'] as const,      // Rose to Berry - Warm & nurturing
    secondary: ['#F4C2C2', '#6B2430'] as const,
    accent: '#C9A87C',
  },
  max: {
    primary: ['#9B7EBD', '#6B4E8D'] as const,      // Violet gradient - Bold & direct
    secondary: ['#7C3AED', '#5B3D7A'] as const,
    accent: '#E8B4B8',
  },
  ace: {
    primary: ['#C9A87C', '#A88B5C'] as const,      // Gold gradient - Trendsetter
    secondary: ['#F59E0B', '#CD7F32'] as const,    // Amber to Bronze
    accent: '#1A1A2E',
  },
  julia: {
    primary: ['#2A9D8F', '#059669'] as const,      // Teal to Emerald - Support persona
    secondary: ['#14B8A6', '#047857'] as const,
    accent: '#C9A87C',
  },
  
  // Feature Screens - Distinct experiences
  discover: {
    primary: ['#7C3AED', '#DB2777'] as const,      // Electric to Magenta - Vibrant exploration
    secondary: ['#2563EB', '#14B8A6'] as const,
    accent: '#F59E0B',
  },
  gamesHub: {
    primary: ['#F59E0B', '#E07A5F'] as const,      // Amber to Coral - Playful energy
    secondary: ['#DC2626', '#DB2777'] as const,
    accent: '#7C3AED',
  },
  styleDNA: {
    primary: ['#E8B4B8', '#9B7EBD'] as const,      // Rose to Violet - Personal & warm
    secondary: ['#F4C2C2', '#B8A9C9'] as const,
    accent: '#C9A87C',
  },
  events: {
    primary: ['#1E3A5F', '#7C3AED'] as const,      // Navy to Electric - Event excitement
    secondary: ['#2563EB', '#DB2777'] as const,
    accent: '#F59E0B',
  },
  community: {
    primary: ['#14B8A6', '#2A9D8F'] as const,      // Turquoise to Teal - Social connection
    secondary: ['#059669', '#9CAF88'] as const,
    accent: '#E8B4B8',
  },
  
  // Utility Screens
  help: {
    primary: ['#2563EB', '#14B8A6'] as const,      // Sapphire to Turquoise - Calming support
    secondary: ['#1E3A5F', '#2A9D8F'] as const,
    accent: '#C9A87C',
  },
  auth: {
    primary: ['#1A1A2E', '#6B4E8D'] as const,      // Midnight to Violet - Premium secure
    secondary: ['#8B2F39', '#DB2777'] as const,
    accent: '#C9A87C',
  },
  subscription: {
    primary: ['#C9A87C', '#8B2F39'] as const,      // Gold to Berry - Luxury conversion
    secondary: ['#9B7EBD', '#7C3AED'] as const,
    accent: '#F5E6D3',
  },
  
  // Special Feature Screens
  virtualTryOn: {
    primary: ['#DB2777', '#7C3AED'] as const,      // Magenta to Electric - Tech forward
    secondary: ['#E07A5F', '#F59E0B'] as const,
    accent: '#14B8A6',
  },
  colorAnalysis: {
    primary: ['#E8B4B8', '#F59E0B'] as const,      // Rose to Amber - Color spectrum
    secondary: ['#9B7EBD', '#2A9D8F'] as const,
    accent: '#8B2F39',
  },
  dreamOutfit: {
    primary: ['#7C3AED', '#DB2777'] as const,      // Electric to Magenta - Creative
    secondary: ['#9B7EBD', '#E8B4B8'] as const,
    accent: '#C9A87C',
  },
  weatherOutfit: {
    primary: ['#2563EB', '#14B8A6'] as const,      // Sapphire to Turquoise - Sky & nature
    secondary: ['#F59E0B', '#E07A5F'] as const,   // Warm sun colors
    accent: '#FFFFFF',
  },
  sustainability: {
    primary: ['#9CAF88', '#059669'] as const,      // Sage to Emerald - Eco-conscious
    secondary: ['#2A9D8F', '#047857'] as const,
    accent: '#C9A87C',
  },
  bargains: {
    primary: ['#DC2626', '#F59E0B'] as const,      // Crimson to Amber - Deals & excitement
    secondary: ['#E07A5F', '#DB2777'] as const,
    accent: '#FFFFFF',
  },
  wishlist: {
    primary: ['#E8B4B8', '#DB2777'] as const,      // Rose to Magenta - Desire & love
    secondary: ['#F4C2C2', '#8B2F39'] as const,
    accent: '#C9A87C',
  },
  
  // Admin & Professional
  stylistPortal: {
    primary: ['#1E3A5F', '#2A9D8F'] as const,      // Navy to Teal - Professional
    secondary: ['#6B4E8D', '#9B7EBD'] as const,
    accent: '#C9A87C',
  },
  adminPortal: {
    primary: ['#8B2F39', '#1A1A2E'] as const,      // Berry to Midnight - Authority
    secondary: ['#6B2430', '#0D0B09'] as const,
    accent: '#C9A87C',
  },
};

import { Platform } from "react-native";

// StyleWise Theme System
// Dynamic theming based on user's fashion style preference

export type StyleTheme = 'luxury' | 'streetwear' | 'boho' | 'sporty' | 'romantic' | 'business' | 'edgy';

// Theme-specific colors for each style
export const StyleThemes = {
  luxury: {
    light: {
      primary: '#B8860B',
      secondary: '#D4AF37',
      accent: '#C5A572',
      background: '#FDFBF7',
      surface: '#F5F0E8',
      surfaceSecondary: '#EDE5D8',
      surfaceTertiary: '#E0D5C4',
      text: '#1A1A1A',
      textSecondary: '#4A4A4A',
      textTertiary: '#7A7A7A',
    },
    dark: {
      primary: '#D4AF37',
      secondary: '#B8860B',
      accent: '#E8D5A3',
      background: '#0D0D0D',
      surface: '#1A1A1A',
      surfaceSecondary: '#262626',
      surfaceTertiary: '#333333',
      text: '#F5F0E8',
      textSecondary: '#C5B8A5',
      textTertiary: '#8A7E6D',
    },
  },
  streetwear: {
    light: {
      primary: '#FF4D4D',
      secondary: '#00D4FF',
      accent: '#FFD700',
      background: '#FFFFFF',
      surface: '#F0F0F0',
      surfaceSecondary: '#E0E0E0',
      surfaceTertiary: '#D0D0D0',
      text: '#0A0A0A',
      textSecondary: '#3A3A3A',
      textTertiary: '#6A6A6A',
    },
    dark: {
      primary: '#FF6B6B',
      secondary: '#00E5FF',
      accent: '#FFE066',
      background: '#0A0A0A',
      surface: '#1A1A1A',
      surfaceSecondary: '#2A2A2A',
      surfaceTertiary: '#3A3A3A',
      text: '#FFFFFF',
      textSecondary: '#B0B0B0',
      textTertiary: '#707070',
    },
  },
  boho: {
    light: {
      primary: '#C17F59',
      secondary: '#8B9A6B',
      accent: '#D4A574',
      background: '#FDF8F3',
      surface: '#F5EDE4',
      surfaceSecondary: '#EBE0D3',
      surfaceTertiary: '#DDD0BE',
      text: '#3D3028',
      textSecondary: '#5D4E42',
      textTertiary: '#8A7A6A',
    },
    dark: {
      primary: '#D4A574',
      secondary: '#A3B18A',
      accent: '#E8C9A8',
      background: '#1A1612',
      surface: '#2A241E',
      surfaceSecondary: '#3A332A',
      surfaceTertiary: '#4A4238',
      text: '#F5EDE4',
      textSecondary: '#C5B8A5',
      textTertiary: '#8A7E6D',
    },
  },
  sporty: {
    light: {
      primary: '#0066FF',
      secondary: '#FF6600',
      accent: '#00CC66',
      background: '#FFFFFF',
      surface: '#F5F7FA',
      surfaceSecondary: '#E8ECF0',
      surfaceTertiary: '#D8DFE6',
      text: '#0A1628',
      textSecondary: '#3A4A5A',
      textTertiary: '#6A7A8A',
    },
    dark: {
      primary: '#3D8BFF',
      secondary: '#FF8533',
      accent: '#33D980',
      background: '#0A1628',
      surface: '#152238',
      surfaceSecondary: '#1F3048',
      surfaceTertiary: '#2A3D58',
      text: '#FFFFFF',
      textSecondary: '#A8B8C8',
      textTertiary: '#687888',
    },
  },
  romantic: {
    light: {
      primary: '#E8A4B8',
      secondary: '#B8A4D4',
      accent: '#F5C6D0',
      background: '#FFFAF9',
      surface: '#FFF0EE',
      surfaceSecondary: '#FFE5E0',
      surfaceTertiary: '#FFD8D0',
      text: '#3D2832',
      textSecondary: '#5D4852',
      textTertiary: '#8A7A82',
    },
    dark: {
      primary: '#D4899E',
      secondary: '#9E89B8',
      accent: '#E8B0BE',
      background: '#1A1216',
      surface: '#2A1E24',
      surfaceSecondary: '#3A2A32',
      surfaceTertiary: '#4A3840',
      text: '#FFF0EE',
      textSecondary: '#C5B0B8',
      textTertiary: '#8A7880',
    },
  },
  business: {
    light: {
      primary: '#1E3A5F',
      secondary: '#4A6FA5',
      accent: '#8B7355',
      background: '#FAFBFC',
      surface: '#F0F2F5',
      surfaceSecondary: '#E4E8EC',
      surfaceTertiary: '#D8DCE0',
      text: '#1A1A2E',
      textSecondary: '#3A3A4E',
      textTertiary: '#6A6A7E',
    },
    dark: {
      primary: '#4A6FA5',
      secondary: '#1E3A5F',
      accent: '#C4A77D',
      background: '#0D0D12',
      surface: '#1A1A24',
      surfaceSecondary: '#262632',
      surfaceTertiary: '#323240',
      text: '#F0F2F5',
      textSecondary: '#B0B8C5',
      textTertiary: '#707888',
    },
  },
  edgy: {
    light: {
      primary: '#8B0000',
      secondary: '#2D4A2D',
      accent: '#4A0E4A',
      background: '#FAFAFA',
      surface: '#F0F0F0',
      surfaceSecondary: '#E0E0E0',
      surfaceTertiary: '#D0D0D0',
      text: '#0A0A0A',
      textSecondary: '#3A3A3A',
      textTertiary: '#6A6A6A',
    },
    dark: {
      primary: '#B22222',
      secondary: '#3D6A3D',
      accent: '#6B2D6B',
      background: '#0A0A0A',
      surface: '#141414',
      surfaceSecondary: '#1E1E1E',
      surfaceTertiary: '#282828',
      text: '#F0F0F0',
      textSecondary: '#A0A0A0',
      textTertiary: '#606060',
    },
  },
};

// Default tint colors (used for links, tabs, etc.)
const tintColorLight = "#B8860B";
const tintColorDark = "#D4AF37";

export const Colors = {
  light: {
    text: "#11181C",
    buttonText: "#FFFFFF",
    tabIconDefault: "#687076",
    tabIconSelected: tintColorLight,
    link: tintColorLight,
    backgroundRoot: "#FDFBF7",
    backgroundDefault: "#F5F0E8",
    backgroundSecondary: "#EDE5D8",
    backgroundTertiary: "#E0D5C4",
    success: "#34C759",
    warning: "#FF9500",
    error: "#FF3B30",
    info: "#007AFF",
    border: "#E0D5C4",
  },
  dark: {
    text: "#F5F0E8",
    buttonText: "#FFFFFF",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: tintColorDark,
    link: tintColorDark,
    backgroundRoot: "#0D0D0D",
    backgroundDefault: "#1A1A1A",
    backgroundSecondary: "#262626",
    backgroundTertiary: "#333333",
    success: "#32D74B",
    warning: "#FF9F0A",
    error: "#FF453A",
    info: "#0A84FF",
    border: "#333333",
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

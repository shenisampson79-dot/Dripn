import Constants from 'expo-constants';

export interface ColorCombination {
  id: string;
  name: string;
  backgroundColor: string;
  hangerColor: string;
  backgroundColorName: string;
  hangerColorName: string;
  description: string;
}

export interface SeasonalPalette {
  season: 'winter' | 'spring' | 'summer' | 'fall';
  year: number;
  combinations: ColorCombination[];
  lastUpdated: string;
}

export type Season = 'winter' | 'spring' | 'summer' | 'fall';

const SEASONS_BY_MONTH: Record<number, Season> = {
  0: 'winter',  // January
  1: 'winter',  // February
  2: 'spring',  // March
  3: 'spring',  // April
  4: 'spring',  // May
  5: 'summer',  // June
  6: 'summer',  // July
  7: 'summer',  // August
  8: 'fall',    // September
  9: 'fall',    // October
  10: 'fall',   // November
  11: 'winter', // December
};

const MONTH_TO_COMBO_INDEX: Record<number, number> = {
  0: 0,   // January - 1st winter combo
  1: 1,   // February - 2nd winter combo
  2: 0,   // March - 1st spring combo
  3: 1,   // April - 2nd spring combo
  4: 2,   // May - 3rd spring combo
  5: 0,   // June - 1st summer combo
  6: 1,   // July - 2nd summer combo
  7: 2,   // August - 3rd summer combo
  8: 0,   // September - 1st fall combo
  9: 1,   // October - 2nd fall combo
  10: 2,  // November - 3rd fall combo
  11: 2,  // December - 3rd winter combo
};

const getOpenAIApiKey = (): string => {
  if (typeof process !== 'undefined' && process.env?.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY;
  }
  const extra = Constants.expoConfig?.extra;
  if (extra?.OPENAI_API_KEY) {
    return extra.OPENAI_API_KEY;
  }
  return '';
};

export async function fetchTrendingColorsFromAI(season: Season, year: number): Promise<ColorCombination[]> {
  const apiKey = getOpenAIApiKey();
  
  if (!apiKey) {
    console.error('OpenAI API key not found, using fallback colors');
    return getFallbackColors(season);
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        messages: [
          {
            role: 'system',
            content: `You are a fashion trend analyst specializing in color forecasting. You have deep knowledge of Pantone color trends, runway fashion, streetwear trends, and seasonal color palettes from major fashion houses and trend forecasting agencies like WGSN, Pantone, and Fashion Snoops.`
          },
          {
            role: 'user',
            content: `Analyze the current ${season} ${year} fashion color trends and provide exactly 3 trending color combinations for a fashion app logo. Each combination should have:
1. A background color (the main trending color for the season)
2. A hanger/accent color (a complementary or contrasting color that pairs beautifully)

Consider:
- Current runway trends from major fashion weeks
- Pantone's color of the year influence
- Social media fashion trends
- Streetwear and luxury fashion color preferences
- Regional color preferences globally

Return ONLY a valid JSON array with exactly 3 objects, no markdown, no explanation. Each object must have:
- id: string (combo1, combo2, combo3)
- name: string (creative combination name)
- backgroundColor: string (hex color)
- hangerColor: string (hex color)  
- backgroundColorName: string (descriptive color name)
- hangerColorName: string (descriptive color name)
- description: string (brief trend insight, max 50 words)

Example format:
[{"id":"combo1","name":"Midnight Luxe","backgroundColor":"#1a1a2e","hangerColor":"#c9a87c","backgroundColorName":"Deep Midnight","hangerColorName":"Champagne Gold","description":"Inspired by luxury evening wear trends..."}]`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status);
      return getFallbackColors(season);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      return getFallbackColors(season);
    }

    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const combinations = JSON.parse(cleanedContent) as ColorCombination[];
    
    if (!Array.isArray(combinations) || combinations.length !== 3) {
      return getFallbackColors(season);
    }

    return combinations;
  } catch (error) {
    console.error('Error fetching trending colors:', error);
    return getFallbackColors(season);
  }
}

function getFallbackColors(season: Season): ColorCombination[] {
  const fallbackPalettes: Record<Season, ColorCombination[]> = {
    winter: [
      {
        id: 'combo1',
        name: 'Mocha Mousse Luxe',
        backgroundColor: '#A47764',
        hangerColor: '#F5E6D3',
        backgroundColorName: 'Mocha Mousse',
        hangerColorName: 'Cream Gold',
        description: 'Pantone 2025 Color of the Year meets winter elegance with warm, comforting tones.',
      },
      {
        id: 'combo2',
        name: 'Midnight Velvet',
        backgroundColor: '#1A1A2E',
        hangerColor: '#C9A87C',
        backgroundColorName: 'Deep Midnight',
        hangerColorName: 'Champagne Gold',
        description: 'Inspired by luxury evening wear and the glamour of winter galas.',
      },
      {
        id: 'combo3',
        name: 'Frost & Rose Gold',
        backgroundColor: '#2C3E50',
        hangerColor: '#E8B4B8',
        backgroundColorName: 'Slate Storm',
        hangerColorName: 'Rose Gold',
        description: 'Combining cool winter tones with the warmth of rose gold metallics.',
      },
    ],
    spring: [
      {
        id: 'combo1',
        name: 'Blossom Dream',
        backgroundColor: '#FFE5EC',
        hangerColor: '#8B4B6B',
        backgroundColorName: 'Cherry Blossom',
        hangerColorName: 'Deep Mauve',
        description: 'Soft spring florals meet sophisticated depth for a fresh seasonal look.',
      },
      {
        id: 'combo2',
        name: 'Sage Renewal',
        backgroundColor: '#A8C69F',
        hangerColor: '#4A3728',
        backgroundColorName: 'Sage Green',
        hangerColorName: 'Espresso',
        description: 'Nature-inspired greens paired with rich earth tones for grounded elegance.',
      },
      {
        id: 'combo3',
        name: 'Sunset Coral',
        backgroundColor: '#FF6B6B',
        hangerColor: '#FFF5E4',
        backgroundColorName: 'Living Coral',
        hangerColorName: 'Warm Ivory',
        description: 'Vibrant coral energy balanced with soft cream for spring vitality.',
      },
    ],
    summer: [
      {
        id: 'combo1',
        name: 'Ocean Breeze',
        backgroundColor: '#0077B6',
        hangerColor: '#FFD93D',
        backgroundColorName: 'Azure Blue',
        hangerColorName: 'Sun Yellow',
        description: 'Mediterranean vibes with bold blue and sunny accents.',
      },
      {
        id: 'combo2',
        name: 'Tropical Sunset',
        backgroundColor: '#FF7F50',
        hangerColor: '#2C3E50',
        backgroundColorName: 'Coral Orange',
        hangerColorName: 'Deep Navy',
        description: 'Warm summer sunsets paired with sophisticated navy contrast.',
      },
      {
        id: 'combo3',
        name: 'Lavender Fields',
        backgroundColor: '#E6E6FA',
        hangerColor: '#9B59B6',
        backgroundColorName: 'Soft Lavender',
        hangerColorName: 'Royal Purple',
        description: 'Dreamy lavender tones capturing summer romance and luxury.',
      },
    ],
    fall: [
      {
        id: 'combo1',
        name: 'Autumn Spice',
        backgroundColor: '#D35400',
        hangerColor: '#2C1810',
        backgroundColorName: 'Burnt Orange',
        hangerColorName: 'Dark Chocolate',
        description: 'Rich harvest colors embodying cozy fall sophistication.',
      },
      {
        id: 'combo2',
        name: 'Forest Ember',
        backgroundColor: '#1D3C34',
        hangerColor: '#C9A87C',
        backgroundColorName: 'Forest Green',
        hangerColorName: 'Antique Gold',
        description: 'Deep forest hues with warm metallic accents for fall elegance.',
      },
      {
        id: 'combo3',
        name: 'Burgundy Noir',
        backgroundColor: '#722F37',
        hangerColor: '#F5DEB3',
        backgroundColorName: 'Wine Burgundy',
        hangerColorName: 'Wheat Gold',
        description: 'Luxurious wine tones paired with soft wheat for timeless fall style.',
      },
    ],
  };

  return fallbackPalettes[season];
}

export function getCurrentSeason(): Season {
  const month = new Date().getMonth();
  return SEASONS_BY_MONTH[month];
}

export function getSeasonForMonth(month: number): Season {
  return SEASONS_BY_MONTH[month];
}

export function getCurrentMonthComboIndex(): number {
  const month = new Date().getMonth();
  return MONTH_TO_COMBO_INDEX[month];
}

export function getComboIndexForMonth(month: number): number {
  return MONTH_TO_COMBO_INDEX[month];
}

export function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month];
}

export function getSeasonDisplayName(season: Season): string {
  return season.charAt(0).toUpperCase() + season.slice(1);
}

export default {
  fetchTrendingColorsFromAI,
  getFallbackColors,
  getCurrentSeason,
  getSeasonForMonth,
  getCurrentMonthComboIndex,
  getComboIndexForMonth,
  getMonthName,
  getSeasonDisplayName,
};

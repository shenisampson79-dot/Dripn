const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const COLOR_SOURCES = [
  'Pantone Color Institute',
  'WGSN',
  'Coloro',
  'Adobe Color Trends',
  'Vogue',
  'Harper\'s Bazaar',
  'Elle',
  'GQ',
  'WWD',
  'Business of Fashion'
];

const STYLE_THEMES = ['luxury', 'streetwear', 'boho', 'sporty', 'smart-casual', 'business', 'edgy'];

const FASHION_REGIONS = {
  'UK': { 
    sources: ['British Vogue', 'Dazed', 'i-D Magazine'],
    colorPreferences: 'Classic, understated - deep blues, forest greens, burgundy, heritage tweeds'
  },
  'US': { 
    sources: ['Vogue US', 'Who What Wear', 'Refinery29'],
    colorPreferences: 'Diverse, trend-forward - bold primaries, pastels, street style influences'
  },
  'France': { 
    sources: ['Vogue Paris', 'L\'Officiel'],
    colorPreferences: 'Elegant, minimalist - neutrals, muted tones, noir, effortless chic'
  },
  'Italy': { 
    sources: ['Vogue Italia'],
    colorPreferences: 'Luxurious, vibrant - warm earth tones, rich colors, craftsmanship focus'
  },
  'Japan': { 
    sources: ['Vogue Japan', 'WWD Japan'],
    colorPreferences: 'Clean, kawaii influences - pastels, neutrals, pops of neon, minimalist'
  },
  'Middle East': { 
    sources: ['Vogue Arabia'],
    colorPreferences: 'Opulent, rich - gold, deep jewel tones, modest luxury'
  },
  'Nigeria': { 
    sources: ['Glazia', 'StyleVitae', 'Bella Naija Style'],
    colorPreferences: 'Bold, celebratory - vibrant African prints, confident colors'
  },
  'Brazil': { 
    sources: ['Vogue Brasil'],
    colorPreferences: 'Energetic, tropical - bright colors, beach influences, warm tones'
  },
  'Global': {
    sources: COLOR_SOURCES,
    colorPreferences: 'International trends synthesized across major fashion capitals'
  }
};

const FIXED_BRAND_COLORS = {
  mochaMousse: '#4A3428',
  champagneGold: '#C9A87C',
  deepCream: '#FAF8F5',
  richDark: '#0D0B09',
  vipGoldStart: '#D4AF37',
  vipGoldEnd: '#B8860B'
};

async function scanAnnualColorTrends(options = {}) {
  const {
    year = new Date().getFullYear(),
    region = 'Global'
  } = options;

  const regionInfo = FASHION_REGIONS[region] || FASHION_REGIONS['Global'];
  
  const prompt = `You are an expert color trend analyst for a premium fashion app called Dripn.

Your task is to analyze the current and upcoming color trends for ${year}/${year + 1} fashion seasons, specifically for the ${region} market.

IMPORTANT CONTEXT:
- Dripn is a HIGH-END fashion advice app - colors must be classy, sophisticated, and premium
- Our fixed brand colors are: Mocha Mousse (#4A3428), Champagne Gold (#C9A87C)
- All suggested colors MUST complement these brand anchors
- Regional preferences for ${region}: ${regionInfo.colorPreferences}

Consider these authoritative sources:
- Pantone Color of the Year ${year} and ${year + 1}
- ${regionInfo.sources.join(', ')}
- Major fashion week runway trends (Milan, Paris, New York, London)

For each of our 7 style themes, suggest updated secondary and accent colors:
1. Luxury - sophisticated, timeless
2. Streetwear - bold, urban
3. Boho - earthy, natural
4. Sporty - energetic, fresh
5. Smart Casual - polished, approachable
6. Business - professional, confident
7. Edgy - avant-garde, statement

RULES FOR COLOR SELECTION:
1. All colors must pass WCAG AA contrast (4.5:1 for text on backgrounds)
2. Saturation should not exceed 75% for main UI elements
3. Colors must work in BOTH light and dark modes
4. Must maintain premium, high-fashion aesthetic
5. No neon or overly bright colors that look cheap
6. Colors should photograph well for fashion content

Respond in JSON format:
{
  "year": ${year},
  "region": "${region}",
  "pantoneInfluence": {
    "colorOfTheYear": "Name and hex of Pantone Color of the Year",
    "howWeAdapted": "How we incorporated this into our suggestions"
  },
  "trendingPalettes": [
    {
      "styleTheme": "luxury|streetwear|boho|sporty|smart-casual|business|edgy",
      "secondary": {
        "hex": "#XXXXXX",
        "name": "Color name",
        "mood": "1-2 words describing mood"
      },
      "accent": {
        "hex": "#XXXXXX", 
        "name": "Color name",
        "mood": "1-2 words describing mood"
      },
      "rationale": "Why these colors work for this style in ${region}"
    }
  ],
  "functionalColors": {
    "success": {"hex": "#XXXXXX", "name": "Color name"},
    "warning": {"hex": "#XXXXXX", "name": "Color name"},
    "info": {"hex": "#XXXXXX", "name": "Color name"}
  },
  "emergingColors": [
    {
      "hex": "#XXXXXX",
      "name": "Color name",
      "origin": "Where this trend started",
      "peakPrediction": "When it will peak"
    }
  ],
  "fadingColors": ["Colors going out of style"],
  "seasonalNotes": "Brief note on how ${region} adapts these trends locally",
  "confidenceScore": 0.0 to 1.0,
  "sources": ["List of fashion sources referenced"]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a senior color trend analyst for luxury fashion brands. You have deep expertise in Pantone color forecasting, runway analysis, and regional color preferences. Your recommendations must always maintain a premium, sophisticated aesthetic suitable for high-end fashion apps. Always respond with valid JSON only.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_completion_tokens: 3000,
    });

    const content = response.choices[0].message.content.trim();
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '');
    const trendData = JSON.parse(cleanedContent);
    
    return {
      success: true,
      colorTrends: {
        ...trendData,
        scannedAt: new Date().toISOString(),
        scanType: 'annual'
      }
    };
  } catch (error) {
    console.error('Annual color trend scan error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function scanRegionalColorPreferences(country) {
  const region = country || 'Global';
  const regionInfo = FASHION_REGIONS[region] || FASHION_REGIONS['Global'];

  const prompt = `Analyze the specific color preferences and trends for the ${region} fashion market.

Focus on:
1. What colors are currently trending in ${region}?
2. What colors are culturally significant or preferred?
3. What international trends has ${region} adopted/rejected?
4. What local designers or influencers are driving color choices?
5. What upcoming cultural events might influence colors (festivals, holidays)?

Regional sources to consider: ${regionInfo.sources.join(', ')}
Known preferences: ${regionInfo.colorPreferences}

Provide recommendations that could be used in a premium fashion app.

Respond in JSON format:
{
  "region": "${region}",
  "currentTrendingColors": [
    {
      "hex": "#XXXXXX",
      "name": "Color name",
      "popularity": "High/Medium/Growing",
      "wornBy": "Where this is being seen"
    }
  ],
  "culturalColors": [
    {
      "hex": "#XXXXXX",
      "name": "Color name",
      "significance": "Why this matters in ${region}"
    }
  ],
  "localInfluencers": ["2-3 influential figures driving color trends"],
  "rejectedTrends": ["Colors popular elsewhere but not in ${region}"],
  "upcomingInfluences": ["Events or moments that will affect color choices"],
  "recommendedPalette": {
    "primary": "#XXXXXX",
    "secondary": "#XXXXXX", 
    "accent": "#XXXXXX",
    "rationale": "Why this palette works for ${region}"
  },
  "seasonalVariations": {
    "spring": ["2-3 colors"],
    "summer": ["2-3 colors"],
    "autumn": ["2-3 colors"],
    "winter": ["2-3 colors"]
  }
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a regional fashion color expert with deep knowledge of local markets and cultural influences on fashion. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_completion_tokens: 1500,
    });

    const content = response.choices[0].message.content.trim();
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '');
    const regionalData = JSON.parse(cleanedContent);
    
    return {
      success: true,
      regionalColors: {
        ...regionalData,
        analyzedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Regional color scan error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function scanPantoneColorOfTheYear(year) {
  const targetYear = year || new Date().getFullYear() + 1;

  const prompt = `Provide detailed analysis of Pantone's Color of the Year for ${targetYear} and how it can be integrated into a premium fashion app.

If ${targetYear} Color of the Year hasn't been announced yet, analyze the previous year and predict the upcoming one.

Include:
1. The official Color of the Year name and hex code
2. Why Pantone chose this color
3. How fashion industry has adopted it
4. Complementary colors that work well with it
5. How to adapt it for digital/app interfaces
6. Variations for light and dark mode UI

IMPORTANT: All color suggestions must maintain a premium, sophisticated aesthetic.

Respond in JSON format:
{
  "year": ${targetYear},
  "colorOfTheYear": {
    "name": "Official Pantone name",
    "hex": "#XXXXXX",
    "pantoneCode": "PANTONE XX-XXXX",
    "description": "Why this color was chosen"
  },
  "fashionAdoption": {
    "runways": "How major fashion houses used it",
    "streetStyle": "How it appeared in street fashion",
    "accessories": "Common accessory applications"
  },
  "complementaryColors": [
    {
      "hex": "#XXXXXX",
      "name": "Color name",
      "relationship": "How it complements the COTY"
    }
  ],
  "uiAdaptations": {
    "lightMode": {
      "background": "#XXXXXX",
      "accent": "#XXXXXX",
      "text": "#XXXXXX"
    },
    "darkMode": {
      "background": "#XXXXXX",
      "accent": "#XXXXXX",
      "text": "#XXXXXX"
    }
  },
  "tintVariations": [
    {"percent": 10, "hex": "#XXXXXX"},
    {"percent": 25, "hex": "#XXXXXX"},
    {"percent": 50, "hex": "#XXXXXX"},
    {"percent": 75, "hex": "#XXXXXX"}
  ],
  "doNotPairWith": ["Colors that clash"],
  "premiumApplications": "How to use this color in a luxury context"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a Pantone color expert with deep knowledge of their annual Color of the Year selections and how they influence the fashion and design industries. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.6,
      max_completion_tokens: 1500,
    });

    const content = response.choices[0].message.content.trim();
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '');
    const pantoneData = JSON.parse(cleanedContent);
    
    return {
      success: true,
      pantone: {
        ...pantoneData,
        analyzedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Pantone scan error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function validateColorForPremiumUse(hexColor, usage = 'accent') {
  const prompt = `Evaluate if this color is appropriate for a premium, high-end fashion app:

Color: ${hexColor}
Intended usage: ${usage}

Evaluate based on:
1. Does it look sophisticated/premium or cheap/garish?
2. Will it work well with photography-heavy content?
3. Does it complement luxury brand aesthetics?
4. Is the saturation appropriate for UI elements?
5. Will it fatigue users' eyes over time?
6. Does it have fashion credibility?

Respond in JSON format:
{
  "hex": "${hexColor}",
  "usage": "${usage}",
  "approved": true/false,
  "premiumScore": 1-10,
  "concerns": ["Any issues with this color"],
  "suggestions": {
    "ifApproved": "How to best use this color",
    "alternatives": [
      {"hex": "#XXXXXX", "reason": "Why this alternative might be better"}
    ]
  },
  "contrastCheck": {
    "onWhite": "Pass/Fail for AA standard",
    "onBlack": "Pass/Fail for AA standard"
  }
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a luxury brand color consultant who ensures color choices maintain premium aesthetics. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.5,
      max_completion_tokens: 800,
    });

    const content = response.choices[0].message.content.trim();
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '');
    const validationData = JSON.parse(cleanedContent);
    
    return {
      success: true,
      validation: validationData
    };
  } catch (error) {
    console.error('Color validation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function generateFullColorUpdate(year, regions = ['Global']) {
  const results = {
    year,
    generatedAt: new Date().toISOString(),
    pantone: null,
    regionalPalettes: {},
    styleThemes: {},
    errors: []
  };

  try {
    const pantoneResult = await scanPantoneColorOfTheYear(year);
    if (pantoneResult.success) {
      results.pantone = pantoneResult.pantone;
    } else {
      results.errors.push({ source: 'pantone', error: pantoneResult.error });
    }
  } catch (error) {
    results.errors.push({ source: 'pantone', error: error.message });
  }

  for (const region of regions) {
    try {
      const [annualResult, regionalResult] = await Promise.all([
        scanAnnualColorTrends({ year, region }),
        scanRegionalColorPreferences(region)
      ]);

      if (annualResult.success) {
        results.styleThemes[region] = annualResult.colorTrends;
      } else {
        results.errors.push({ source: `annual-${region}`, error: annualResult.error });
      }

      if (regionalResult.success) {
        results.regionalPalettes[region] = regionalResult.regionalColors;
      } else {
        results.errors.push({ source: `regional-${region}`, error: regionalResult.error });
      }
    } catch (error) {
      results.errors.push({ source: region, error: error.message });
    }
  }

  return {
    success: results.errors.length === 0,
    partialSuccess: results.errors.length > 0 && (results.pantone || Object.keys(results.styleThemes).length > 0),
    colorUpdate: results
  };
}

function hexToHSL(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function checkSaturationLimit(hex, maxSaturation = 75) {
  const hsl = hexToHSL(hex);
  if (!hsl) return { valid: false, error: 'Invalid hex color' };
  
  return {
    valid: hsl.s <= maxSaturation,
    saturation: hsl.s,
    maxAllowed: maxSaturation,
    suggestion: hsl.s > maxSaturation ? `Reduce saturation from ${hsl.s}% to ${maxSaturation}%` : null
  };
}

function calculateContrastRatio(hex1, hex2) {
  function getLuminance(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return 0;
    
    const rgb = [
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    ].map(val => val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4));
    
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  }
  
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

function checkAccessibility(foreground, background) {
  const ratio = calculateContrastRatio(foreground, background);
  return {
    ratio: Math.round(ratio * 100) / 100,
    passesAA: ratio >= 4.5,
    passesAAA: ratio >= 7,
    passesAALarge: ratio >= 3
  };
}

module.exports = {
  scanAnnualColorTrends,
  scanRegionalColorPreferences,
  scanPantoneColorOfTheYear,
  validateColorForPremiumUse,
  generateFullColorUpdate,
  hexToHSL,
  checkSaturationLimit,
  calculateContrastRatio,
  checkAccessibility,
  STYLE_THEMES,
  FASHION_REGIONS,
  FIXED_BRAND_COLORS,
  COLOR_SOURCES
};

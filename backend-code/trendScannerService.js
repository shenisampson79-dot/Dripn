const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const FASHION_SOURCES = [
  'Vogue', 'Harper\'s Bazaar', 'Elle', 'GQ', 'Esquire',
  'Who What Wear', 'The Cut', 'Fashionista', 'WWD',
  'Business of Fashion', 'Highsnobiety', 'Hypebeast',
  'Dazed', 'i-D', 'Another Magazine', 'Refinery29'
];

const TREND_CATEGORIES = [
  'Colors', 'Silhouettes', 'Fabrics', 'Patterns', 'Accessories',
  'Footwear', 'Hairstyles', 'Makeup', 'Lifestyle', 'Sustainability'
];

async function scanEmergingFashionTrends(options = {}) {
  const {
    region = 'Global',
    gender = 'unisex',
    season = getCurrentSeason(),
    categories = TREND_CATEGORIES
  } = options;

  const prompt = `You are a fashion trend analyst with expertise in predicting emerging trends before they go mainstream.

Your task is to identify EMERGING fashion trends that are just starting to gain momentum and will likely become mainstream in the next 3-6 months.

Focus on:
- Region: ${region}
- Target Gender: ${gender}
- Current Season: ${season}
- Categories to analyze: ${categories.join(', ')}

Think about:
1. What are fashion insiders and early adopters wearing?
2. What have you seen on recent runways that hasn't hit mainstream yet?
3. What social media micro-trends are gaining traction?
4. What cultural or environmental factors are influencing new styles?
5. What are streetwear and high fashion starting to converge on?

Provide your analysis in this JSON format:
{
  "scanDate": "${new Date().toISOString()}",
  "emergingTrends": [
    {
      "name": "Trend name",
      "category": "One of: ${TREND_CATEGORIES.join(', ')}",
      "description": "2-3 sentences describing the trend",
      "emergenceLevel": "Early/Growing/Accelerating",
      "mainstreamPrediction": "When it will hit mainstream (e.g., '2-3 months')",
      "keyInfluencers": ["2-3 influencers or celebrities driving this"],
      "howToWear": "1-2 sentences on how to incorporate this",
      "buyNowSuggestion": "What to buy now before it's everywhere",
      "confidenceScore": 0.0 to 1.0
    }
  ],
  "colorForecast": {
    "emergingColors": ["3-4 colors that will trend"],
    "fadingColors": ["2-3 colors losing popularity"],
    "colorOfTheMonth": "The one color to watch right now"
  },
  "styleMovement": {
    "name": "Name of the broader style movement",
    "description": "What defines this movement",
    "keyElements": ["5 key style elements"]
  },
  "trendAlert": {
    "hottest": "The single hottest emerging trend right now",
    "sleeper": "An underrated trend that will surprise everyone",
    "avoid": "A fading trend to move away from"
  },
  "sources": ["List fashion publications and sources referenced"]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a senior fashion trend analyst working for a cutting-edge fashion app. Your predictions are based on deep knowledge of fashion history, runway shows, street style, social media trends, and cultural movements. You have access to insights from ${FASHION_SOURCES.join(', ')} and other leading fashion publications. Always respond with valid JSON only.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 2500,
    });

    const content = response.choices[0].message.content.trim();
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '');
    const trendData = JSON.parse(cleanedContent);
    
    return {
      success: true,
      trends: {
        ...trendData,
        region,
        gender,
        season,
        generatedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Trend scanning error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function scanViralFashionMoments() {
  const prompt = `You are monitoring viral fashion moments happening right now in social media and pop culture.

Identify the top 5 viral fashion moments from the past 2 weeks that are generating buzz.

Respond in JSON format:
{
  "viralMoments": [
    {
      "title": "Brief catchy title",
      "description": "What happened and why it's viral",
      "celebrity": "Celebrity or influencer involved (if any)",
      "platform": "Where it went viral (Instagram, TikTok, Red Carpet, etc.)",
      "fashionItem": "The key fashion item or look",
      "shopTheLook": "How readers can recreate this look",
      "viralScore": 1-10
    }
  ],
  "trendingHashtags": ["5 trending fashion hashtags"],
  "mustFollow": {
    "account": "One account to follow for trend updates",
    "reason": "Why they're worth following"
  }
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a social media fashion analyst tracking viral moments. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.9,
      max_tokens: 1500,
    });

    const content = response.choices[0].message.content.trim();
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '');
    const viralData = JSON.parse(cleanedContent);
    
    return {
      success: true,
      viralMoments: {
        ...viralData,
        scannedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Viral moments scan error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function predictNextBigTrend(options = {}) {
  const { gender = 'unisex', ageGroup = '25-34' } = options;

  const prompt = `You are a fashion futurist predicting the NEXT BIG fashion trend that hasn't hit yet.

Think beyond current trends. Consider:
- Cultural shifts and generational values
- Technology and sustainability innovations
- Economic factors affecting fashion
- Historical fashion cycles
- Cross-cultural influences

Target audience: ${gender}, age ${ageGroup}

Make a bold prediction about what will be the next major fashion movement.

Respond in JSON format:
{
  "prediction": {
    "trendName": "Name for this emerging trend",
    "tagline": "A catchy one-liner",
    "description": "3-4 sentences describing this future trend",
    "timeline": "When this will hit mainstream",
    "driverFactors": ["3-4 factors driving this trend"],
    "earlySignals": ["3-4 early signs this is coming"],
    "howToPrepare": "What fashion-forward people should do now",
    "keyPieces": ["4-5 items to invest in now"],
    "colorPalette": ["3-4 colors associated with this trend"],
    "influencerTypes": "Who will lead this trend"
  },
  "confidence": 0.0 to 1.0,
  "disclaimer": "Brief note on prediction methodology"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a renowned fashion futurist known for accurately predicting trends 6-12 months before they happen. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.9,
      max_tokens: 1200,
    });

    const content = response.choices[0].message.content.trim();
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '');
    const predictionData = JSON.parse(cleanedContent);
    
    return {
      success: true,
      nextBigTrend: {
        ...predictionData,
        predictedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Trend prediction error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function getRegionalTrendInsights(country) {
  const prompt = `Analyze the current fashion landscape specifically for ${country}.

Consider:
- Local fashion influencers and celebrities
- Cultural events and holidays affecting fashion
- Climate and seasonal considerations
- Local designer movements
- How global trends are adapted locally

Respond in JSON format:
{
  "country": "${country}",
  "currentMood": "The overall fashion mood in ${country} right now",
  "localTrends": [
    {
      "trend": "Trend name",
      "localTwist": "How this manifests locally",
      "popularIn": "Which cities/regions"
    }
  ],
  "localInfluencers": ["3-4 influential local fashion figures"],
  "upcomingEvents": ["2-3 upcoming cultural events affecting fashion"],
  "localColors": ["Colors popular in this market"],
  "shoppingAdvice": "Where and what to shop in ${country}",
  "culturalTip": "One cultural fashion tip for this region"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a global fashion correspondent with deep knowledge of regional fashion scenes. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const content = response.choices[0].message.content.trim();
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '');
    const regionalData = JSON.parse(cleanedContent);
    
    return {
      success: true,
      regionalInsights: {
        ...regionalData,
        analyzedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Regional insights error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

function getCurrentSeason() {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'Spring';
  if (month >= 5 && month <= 7) return 'Summer';
  if (month >= 8 && month <= 10) return 'Autumn';
  return 'Winter';
}

module.exports = {
  scanEmergingFashionTrends,
  scanViralFashionMoments,
  predictNextBigTrend,
  getRegionalTrendInsights,
  getCurrentSeason,
  FASHION_SOURCES,
  TREND_CATEGORIES
};

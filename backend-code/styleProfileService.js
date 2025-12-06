const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const STYLE_CATEGORIES = [
  'Luxury', 'Streetwear', 'Boho', 'Sporty', 'Business', 'Smart Casual', 'Edgy',
  'Minimalist', 'Vintage', 'Preppy', 'Romantic', 'Grunge', 'Classic'
];

const COLOR_PREFERENCES = [
  'Neutrals', 'Bold Colors', 'Pastels', 'Earth Tones', 'Monochrome',
  'Jewel Tones', 'Metallics', 'Warm Colors', 'Cool Colors', 'Black & White'
];

const FASHION_INTERESTS = [
  'Sustainable Fashion', 'Designer Brands', 'High Street',
  'Vintage/Thrift', 'Accessories', 'Footwear', 'Workwear',
  'Weekend Casual', 'Evening Wear', 'Athletic Wear'
];

async function analyzeUserStyleProfile(userData) {
  const {
    posts = [],
    likes = [],
    dislikes = [],
    adviceGiven = [],
    userInfo = {}
  } = userData;

  const postsText = posts.map(p => `Post: "${p.caption}" with tags ${p.tags?.join(', ') || 'none'}`).join('\n');
  const likesText = likes.map(l => `Liked: "${l.caption}" with tags ${l.tags?.join(', ') || 'none'}`).join('\n');
  const dislikesText = dislikes.map(d => `Disliked: "${d.caption}" with tags ${d.tags?.join(', ') || 'none'}`).join('\n');
  const adviceText = adviceGiven.map(a => `Advice: "${a.text}"`).join('\n');

  const prompt = `You are a fashion AI analyzing a user's style profile based on their app activity.

User Information:
- Gender: ${userInfo.gender || 'Not specified'}
- Country: ${userInfo.country || 'Not specified'}
- Region: ${userInfo.region || 'Not specified'}

User's Posts (outfits they shared):
${postsText || 'No posts yet'}

Posts they liked (heart):
${likesText || 'No likes yet'}

Posts they disliked (thumbs down):
${dislikesText || 'No dislikes yet'}

Style advice they gave to others:
${adviceText || 'No advice given yet'}

Based on this data, analyze the user's fashion personality and style preferences.

Available style categories: ${STYLE_CATEGORIES.join(', ')}
Available color preferences: ${COLOR_PREFERENCES.join(', ')}
Available fashion interests: ${FASHION_INTERESTS.join(', ')}

Respond in JSON format:
{
  "dominantStyles": ["top 3 style categories from the list"],
  "colorPreferences": ["top 3 color preferences from the list"],
  "fashionInterests": ["top 3 interests from the list"],
  "stylePersonality": "A 2-3 sentence description of their fashion personality",
  "strengthAreas": ["3 things they seem confident about in fashion"],
  "growthAreas": ["2-3 style areas they might want to explore"],
  "recommendedBrands": ["5 brands that would suit their style"],
  "styleInfluencerType": "What type of fashion influencer they resemble (e.g., 'Classic Minimalist', 'Bold Trendsetter')",
  "confidenceScore": 0.0 to 1.0 based on how much data we have,
  "seasonalStyle": {
    "spring": "brief style recommendation for spring",
    "summer": "brief style recommendation for summer",
    "autumn": "brief style recommendation for autumn",
    "winter": "brief style recommendation for winter"
  }
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a professional fashion analyst. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const content = response.choices[0].message.content.trim();
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '');
    const profileData = JSON.parse(cleanedContent);
    
    return {
      success: true,
      profile: {
        ...profileData,
        analyzedAt: new Date().toISOString(),
        dataPoints: {
          postsCount: posts.length,
          likesCount: likes.length,
          dislikesCount: dislikes.length,
          adviceCount: adviceGiven.length
        }
      }
    };
  } catch (error) {
    console.error('Style profile analysis error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function generatePersonalizedStyleOfTheDay(styleProfile, userInfo = {}) {
  const { gender = 'unisex', country = 'United Kingdom', season = getCurrentSeason() } = userInfo;

  const prompt = `You are a fashion AI providing a personalized "Style of the Day" recommendation.

User's Style Profile:
- Dominant Styles: ${styleProfile.dominantStyles?.join(', ') || 'Not analyzed yet'}
- Color Preferences: ${styleProfile.colorPreferences?.join(', ') || 'Not specified'}
- Fashion Interests: ${styleProfile.fashionInterests?.join(', ') || 'Various'}
- Style Personality: ${styleProfile.stylePersonality || 'Fashion enthusiast'}
- Gender: ${gender}
- Country: ${country}
- Current Season: ${season}

Create a personalized outfit recommendation that matches their style preferences.

Respond in JSON format:
{
  "title": "Catchy title for the look (max 50 chars)",
  "description": "2-3 sentences describing the complete outfit",
  "keyPieces": ["3-4 specific clothing items"],
  "colorPalette": ["3-4 colors to use"],
  "styling tips": "One key styling tip",
  "occasion": "Best occasion for this outfit",
  "confidence": "How well this matches their style (High/Medium/Low)",
  "whyThisWorks": "1 sentence explaining why this suits them personally"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a personal fashion stylist. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 800,
    });

    const content = response.choices[0].message.content.trim();
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '');
    const recommendation = JSON.parse(cleanedContent);
    
    return {
      success: true,
      styleOfTheDay: {
        ...recommendation,
        personalized: true,
        generatedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Personalized style generation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function generatePersonalizedEventRecommendations(styleProfile, events, userInfo = {}) {
  const { gender = 'unisex', country = 'United Kingdom' } = userInfo;

  const eventsText = events.map(e => 
    `Event: "${e.title}" - ${e.category} on ${e.date} at ${e.time}. ${e.description}`
  ).join('\n');

  const prompt = `You are a fashion AI recommending events based on a user's style profile.

User's Style Profile:
- Dominant Styles: ${styleProfile.dominantStyles?.join(', ') || 'Various'}
- Fashion Interests: ${styleProfile.fashionInterests?.join(', ') || 'Various'}
- Style Personality: ${styleProfile.stylePersonality || 'Fashion enthusiast'}
- Gender: ${gender}
- Country: ${country}

Available Events:
${eventsText}

Rank these events from most to least suitable for this user based on their style profile.
For the top 3 events, provide personalized outfit suggestions.

Respond in JSON format:
{
  "rankedEvents": [
    {
      "eventTitle": "exact event title",
      "matchScore": 0.0 to 1.0,
      "whyItSuits": "1 sentence explanation",
      "outfitSuggestion": "2-3 sentence personalized outfit recommendation"
    }
  ],
  "topPick": {
    "eventTitle": "The best event for this user",
    "reason": "Why this is their perfect event"
  }
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a personal fashion and lifestyle advisor. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1200,
    });

    const content = response.choices[0].message.content.trim();
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '');
    const recommendations = JSON.parse(cleanedContent);
    
    return {
      success: true,
      eventRecommendations: {
        ...recommendations,
        personalized: true,
        generatedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Event recommendations error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function generatePersonalizedOffers(styleProfile, userInfo = {}) {
  const { gender = 'unisex', country = 'United Kingdom', subscriptionTier = 'free' } = userInfo;

  const prompt = `You are a fashion AI creating personalized shopping recommendations.

User's Style Profile:
- Dominant Styles: ${styleProfile.dominantStyles?.join(', ') || 'Various'}
- Color Preferences: ${styleProfile.colorPreferences?.join(', ') || 'Various'}
- Recommended Brands: ${styleProfile.recommendedBrands?.join(', ') || 'Various brands'}
- Fashion Interests: ${styleProfile.fashionInterests?.join(', ') || 'Various'}
- Gender: ${gender}
- Country: ${country}
- Subscription: ${subscriptionTier}

Create personalized shopping recommendations that would appeal to this user.
Focus on items that match their established style preferences.

Respond in JSON format:
{
  "personalizedPicks": [
    {
      "category": "e.g., Tops, Accessories, Shoes",
      "item": "Specific item type",
      "description": "Why this suits them",
      "suggestedBrands": ["2-3 brand options"],
      "priceRange": "Budget/Mid-range/Premium/Luxury",
      "matchScore": 0.0 to 1.0
    }
  ],
  "seasonalMustHave": {
    "item": "One key seasonal piece",
    "reason": "Why they need it"
  },
  "investmentPiece": {
    "item": "One quality investment suggestion",
    "reason": "Why it's worth the investment for their style"
  }
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a personal shopping advisor. Always respond with valid JSON only.'
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
    const offers = JSON.parse(cleanedContent);
    
    return {
      success: true,
      personalizedOffers: {
        ...offers,
        personalized: true,
        generatedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Personalized offers error:', error);
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
  analyzeUserStyleProfile,
  generatePersonalizedStyleOfTheDay,
  generatePersonalizedEventRecommendations,
  generatePersonalizedOffers,
  getCurrentSeason,
  STYLE_CATEGORIES,
  COLOR_PREFERENCES,
  FASHION_INTERESTS
};

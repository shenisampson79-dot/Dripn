const OpenAI = require('openai');
const { getBestModel } = require('./modelLifecycleService');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const OUTFIT_ANALYSIS_PROMPT = `You are an expert fashion stylist with a keen eye for detail. Analyze the outfit in this image and provide comprehensive feedback.

Analyze the following aspects:

1. OVERALL STYLE: Identify the style category (e.g., casual, formal, streetwear, bohemian, minimalist, etc.)

2. COLOR ANALYSIS:
   - Identify all colors present
   - Evaluate color harmony and coordination
   - Suggest color improvements if needed

3. FIT ASSESSMENT:
   - Evaluate how well the clothes fit
   - Note any fit issues (too tight, too loose, length issues)
   - Suggest fit improvements

4. STYLE COHESION:
   - Rate how well the pieces work together (1-10)
   - Identify any mismatched elements
   - Suggest ways to improve cohesion

5. OCCASION SUITABILITY:
   - What occasions is this outfit suitable for?
   - What occasions should it be avoided for?

6. ACCESSORY ANALYSIS:
   - What accessories are present?
   - What accessories would elevate this look?

7. IMPROVEMENT SUGGESTIONS:
   - Provide 3-5 specific suggestions to improve this outfit
   - Include alternatives for any pieces that don't work

8. COMPLIMENTS:
   - What works really well about this outfit?
   - What should the person definitely keep doing?

Respond in JSON format:
{
  "overallStyle": "style category",
  "styleScore": 1-10,
  "colors": {
    "identified": ["color1", "color2"],
    "harmony": "description of color harmony",
    "harmonyScore": 1-10,
    "suggestions": ["color improvement suggestions"]
  },
  "fit": {
    "overall": "good/needs-adjustment",
    "issues": ["any fit issues"],
    "suggestions": ["fit improvement suggestions"]
  },
  "cohesion": {
    "score": 1-10,
    "analysis": "cohesion analysis",
    "mismatchedElements": ["any mismatched items"],
    "improvements": ["cohesion improvements"]
  },
  "occasions": {
    "suitable": ["occasion1", "occasion2"],
    "avoid": ["occasion to avoid"]
  },
  "accessories": {
    "present": ["current accessories"],
    "suggested": ["recommended accessories"]
  },
  "improvements": [
    {"item": "what to change", "suggestion": "how to improve it"}
  ],
  "compliments": ["what works well"],
  "overallFeedback": "2-3 sentence summary of the outfit"
}`;

const QUICK_ANALYSIS_PROMPT = `You are a fashion expert. Look at this outfit and give quick, actionable feedback.

Provide:
1. One thing that works great about this outfit
2. One thing that could be improved
3. One accessory suggestion
4. Overall rating out of 10

Keep each point to 1-2 sentences. Be encouraging but honest.

Respond in JSON:
{
  "great": "what works well",
  "improve": "what to improve",
  "accessory": "accessory suggestion",
  "rating": 8,
  "quickTip": "one actionable styling tip"
}`;

const GARMENT_ANALYSIS_PROMPT = `You are an expert fashion analyst specialising in wardrobe cataloguing. Look at this single clothing item or pair of shoes and extract precise details for a digital wardrobe.

Return ONLY valid JSON in exactly this format with no extra text or markdown:
{
  "name": "short descriptive name, e.g. Navy Slim-Fit Chinos",
  "category": "tops|bottoms|outerwear|footwear|accessories|dresses|activewear|underwear",
  "subcategory": "e.g. jeans, t-shirt, blazer, sneakers, dress, hoodie",
  "color": {
    "primary": "main colour as a simple word (e.g. black, navy, white, grey)",
    "secondary": "second colour or null if none"
  },
  "pattern": "solid|stripes|check|floral|graphic|camo|animal-print|other",
  "material": "e.g. cotton, denim, leather, polyester, wool, or empty string if unsure",
  "brand": "visible brand name or null",
  "seasons": ["spring","summer","autumn","winter","all-season"],
  "occasions": ["everyday","smart-casual","formal","sportswear","evening","beach"],
  "style": "e.g. casual, minimalist, streetwear, formal, athletic",
  "formality": 1,
  "versatilityScore": 7
}

formality scale: 1=very casual, 3=smart-casual, 5=business, 7=formal, 10=black-tie.
versatilityScore: 1-10 how many different outfits this piece can work with.`;

const WARDROBE_MATCH_PROMPT = `You are a fashion stylist. The user has uploaded an outfit photo and wants suggestions from their wardrobe.

UPLOADED OUTFIT:
Analyze what the user is wearing and identify what pieces might need alternatives or improvements.

USER'S WARDROBE:
{WARDROBE_ITEMS}

Suggest specific items from their wardrobe that would:
1. Complete this outfit if something is missing
2. Replace any items that don't work well
3. Elevate the overall look

Respond in JSON:
{
  "currentOutfitAnalysis": "brief analysis of the uploaded outfit",
  "suggestions": [
    {
      "wardrobeItem": "item name from their wardrobe",
      "reason": "why this would work",
      "how": "how to incorporate it"
    }
  ],
  "completeLookSuggestion": "description of the complete outfit using their wardrobe items"
}`;

async function analyzeOutfitPhoto(imageBase64, options = {}) {
  const {
    detailed = true,
    includeWardrobe = false,
    wardrobeItems = [],
  } = options;

  try {
    const visionModel = await getBestModel('vision');
    console.log(`[VisionAnalysis] Using model: ${visionModel}`);

    let prompt = detailed ? OUTFIT_ANALYSIS_PROMPT : QUICK_ANALYSIS_PROMPT;

    if (includeWardrobe && wardrobeItems.length > 0) {
      const wardrobeText = wardrobeItems
        .map(item => `- ${item.name} (${item.color}, ${item.category})`)
        .join('\n');
      prompt = WARDROBE_MATCH_PROMPT.replace('{WARDROBE_ITEMS}', wardrobeText);
    }

    const response = await openai.chat.completions.create({
      model: visionModel,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: detailed ? 'high' : 'low',
              },
            },
          ],
        },
      ],
      max_tokens: detailed ? 1500 : 500,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('Empty response from vision model');
    }

    const cleanedContent = content.replace(/```json\n?|\n?```/g, '');
    const analysis = JSON.parse(cleanedContent);

    return {
      success: true,
      analysis,
      modelUsed: visionModel,
      analysisType: detailed ? 'detailed' : 'quick',
    };
  } catch (error) {
    console.error('[VisionAnalysis] Error:', error.message);
    return {
      success: false,
      error: error.message,
      fallbackAdvice: 'I couldn\'t analyze the image right now. Please try again or describe your outfit in text.',
    };
  }
}

async function compareOutfits(image1Base64, image2Base64) {
  const comparisonPrompt = `You are a fashion expert comparing two outfits. Analyze both and help the user decide which is better for their needs.

Compare:
1. Overall style and impact
2. Color coordination
3. Fit and silhouette
4. Versatility
5. Occasion appropriateness

Provide your recommendation.

Respond in JSON:
{
  "outfit1": {
    "description": "brief description",
    "strengths": ["strengths"],
    "weaknesses": ["weaknesses"],
    "bestFor": ["occasions"]
  },
  "outfit2": {
    "description": "brief description",
    "strengths": ["strengths"],
    "weaknesses": ["weaknesses"],
    "bestFor": ["occasions"]
  },
  "comparison": {
    "moreVersatile": "outfit1 or outfit2",
    "moreImpactful": "outfit1 or outfit2",
    "betterFit": "outfit1 or outfit2"
  },
  "recommendation": "which outfit to choose and why",
  "mixAndMatch": "suggestions for combining elements from both outfits"
}`;

  try {
    const visionModel = await getBestModel('vision');

    const response = await openai.chat.completions.create({
      model: visionModel,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: comparisonPrompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${image1Base64}`,
                detail: 'high',
              },
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${image2Base64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 1200,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content?.trim();
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '');
    const comparison = JSON.parse(cleanedContent);

    return {
      success: true,
      comparison,
      modelUsed: visionModel,
    };
  } catch (error) {
    console.error('[VisionAnalysis] Comparison error:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function extractColorsFromPhoto(imageBase64) {
  const colorPrompt = `Analyze this outfit photo and extract all colors present.

For each color, provide:
1. The color name
2. Approximate hex code
3. What item it's on
4. Whether it's a dominant or accent color

Respond in JSON:
{
  "dominantColors": [
    {"name": "color name", "hex": "#XXXXXX", "item": "what item", "percentage": 40}
  ],
  "accentColors": [
    {"name": "color name", "hex": "#XXXXXX", "item": "what item"}
  ],
  "colorPalette": {
    "type": "monochromatic/complementary/analogous/triadic/neutral",
    "harmony": "description of how colors work together"
  },
  "seasonalPalette": "spring/summer/autumn/winter based on color temperature"
}`;

  try {
    const visionModel = await getBestModel('vision');

    const response = await openai.chat.completions.create({
      model: visionModel,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: colorPrompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: 'low',
              },
            },
          ],
        },
      ],
      max_tokens: 600,
      temperature: 0.5,
    });

    const content = response.choices[0]?.message?.content?.trim();
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '');
    const colors = JSON.parse(cleanedContent);

    return {
      success: true,
      colors,
      modelUsed: visionModel,
    };
  } catch (error) {
    console.error('[VisionAnalysis] Color extraction error:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function analyzeGarmentItem(imageBase64) {
  try {
    const visionModel = await getBestModel('vision');
    console.log(`[GarmentAnalysis] Using model: ${visionModel}`);

    const response = await openai.chat.completions.create({
      model: visionModel,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: GARMENT_ANALYSIS_PROMPT },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 600,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) throw new Error('Empty response from vision model');

    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const item = JSON.parse(cleanedContent);

    return { success: true, item, modelUsed: visionModel };
  } catch (error) {
    console.error('[GarmentAnalysis] Error:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  analyzeOutfitPhoto,
  compareOutfits,
  extractColorsFromPhoto,
  analyzeGarmentItem,
};

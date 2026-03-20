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
  "category": "one of exactly: tops, bottoms, dresses, outerwear, shoes, bags, accessories, activewear, swimwear, sleepwear, formal",
  "color": "primary colour as a single simple word, e.g. black, white, gray, navy, brown, beige, red, pink, orange, yellow, green, blue, purple, denim, cream",
  "secondaryColor": "second colour as a single word, or null",
  "pattern": "solid|stripes|check|floral|graphic|camo|animal-print|other",
  "material": "e.g. cotton, denim, leather, polyester, wool, or empty string if unsure",
  "brand": "visible brand name or null",
  "seasons": ["one or more of: spring, summer, autumn, winter, all-season"],
  "occasions": ["one or more of: casual, work, formal, date-night, workout, vacation, party, everyday"],
  "style": "e.g. casual, minimalist, streetwear, formal, athletic",
  "description": "one sentence describing the item for a wardrobe app"
}

Category rules: use "shoes" for all footwear, "tops" for shirts/blouses/sweaters/hoodies, "bottoms" for trousers/jeans/shorts/skirts, "outerwear" for jackets/coats/blazers/cardigans, "dresses" for dresses/jumpsuits, "bags" for bags/purses/backpacks, "accessories" for belts/hats/scarves/watches/jewellery, "activewear" for gym/sport clothing, "swimwear" for swimwear, "sleepwear" for pyjamas/loungewear, "formal" for suits/tuxedos.
Color rules: return a plain lowercase single word only, no compound words. Map charcoal/slate/ash → gray, khaki/tan/sand/nude/taupe/camel → beige, navy/midnight/indigo → navy, burgundy/maroon/wine → red, mustard/gold/lemon → yellow, teal/aqua/cobalt/sapphire → blue, coral/mauve/blush/rose → pink, olive/sage/forest/mint/emerald → green, rust/terracotta/peach → orange, lavender/lilac/plum/violet → purple.`;

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

async function analyzeGarmentWithReplicate(imageBase64) {
  try {
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error('REPLICATE_API_TOKEN not configured');
    }
    const Replicate = require('replicate');
    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

    console.log('[GarmentAnalysis] Using Replicate llama-3.2-11b-vision as fallback');

    const output = await replicate.run(
      'meta/llama-3.2-11b-vision-instruct',
      {
        input: {
          image: `data:image/jpeg;base64,${imageBase64}`,
          prompt: GARMENT_ANALYSIS_PROMPT,
          max_tokens: 600,
          temperature: 0.3,
        },
      }
    );

    const content = (Array.isArray(output) ? output.join('') : String(output)).trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in Replicate response');
    const item = JSON.parse(jsonMatch[0]);

    return { success: true, item, modelUsed: 'replicate/llama-3.2-11b-vision' };
  } catch (error) {
    console.error('[GarmentAnalysis] Replicate fallback error:', error.message);
    return { success: false, error: error.message };
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
    const isQuotaError = error.status === 429 ||
      (error.message && (error.message.includes('429') || error.message.includes('quota') || error.message.includes('billing')));

    if (isQuotaError) {
      console.warn('[GarmentAnalysis] OpenAI quota exceeded — switching to Replicate fallback');
      return await analyzeGarmentWithReplicate(imageBase64);
    }

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

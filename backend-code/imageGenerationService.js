const OpenAI = require('openai');
const { getBestModel } = require('./modelLifecycleService');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const STYLE_PROMPTS = {
  luxury: 'high-end luxury fashion, designer runway aesthetic, elegant and sophisticated, premium quality, editorial photography style',
  streetwear: 'urban streetwear fashion, contemporary street style, bold and edgy, hypebeast aesthetic, authentic street culture',
  boho: 'bohemian fashion style, earthy tones, flowing fabrics, natural textures, free-spirited aesthetic, festival inspired',
  sporty: 'athleisure fashion, sporty chic, active lifestyle, modern athletic wear, functional yet stylish',
  business: 'professional business attire, corporate fashion, power dressing, sophisticated office wear, executive style',
  casual: 'everyday casual fashion, relaxed style, comfortable yet stylish, effortless cool, weekend vibes',
  formal: 'formal evening wear, black tie elegance, gala fashion, sophisticated glamour, red carpet worthy',
  vintage: 'vintage inspired fashion, retro aesthetic, nostalgic style, classic elegance, timeless pieces',
  minimalist: 'minimalist fashion, clean lines, neutral palette, essential pieces, understated elegance',
  edgy: 'avant-garde fashion, bold statement pieces, unconventional styling, artistic expression, fashion forward',
};

const MOOD_PROMPTS = {
  confident: 'confident, powerful stance, strong presence, self-assured posture',
  relaxed: 'relaxed, casual posture, comfortable, at ease',
  elegant: 'elegant, refined posture, graceful, sophisticated bearing',
  playful: 'playful, dynamic pose, energetic, joyful movement',
  professional: 'professional, composed, businesslike demeanor',
};

async function generateOutfitInspiration(options = {}) {
  const {
    style = 'casual',
    colors = [],
    season = 'all-season',
    gender = 'unisex',
    mood = 'confident',
    additionalDetails = '',
    size = '1024x1024',
    quality = 'hd',
  } = options;

  try {
    const imageModel = await getBestModel('image');
    console.log(`[ImageGeneration] Using model: ${imageModel}`);

    const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS.casual;
    const moodPrompt = MOOD_PROMPTS[mood] || '';
    const colorPrompt = colors.length > 0 ? `featuring ${colors.join(' and ')} colors` : '';
    const seasonPrompt = season !== 'all-season' ? `appropriate for ${season}` : '';
    const genderPrompt = gender !== 'unisex' ? `${gender}'s fashion` : 'fashion';

    const prompt = `Fashion photography: ${genderPrompt}, ${stylePrompt}, ${colorPrompt}, ${seasonPrompt}, ${moodPrompt}, ${additionalDetails}. Professional fashion editorial style, high quality, well-lit, clean background, full outfit visible. No text or watermarks.`;

    const response = await openai.images.generate({
      model: imageModel,
      prompt,
      n: 1,
      size,
      quality,
      style: 'vivid',
    });

    const imageUrl = response.data[0]?.url;
    const revisedPrompt = response.data[0]?.revised_prompt;

    return {
      success: true,
      imageUrl,
      revisedPrompt,
      modelUsed: imageModel,
      originalPrompt: prompt,
    };
  } catch (error) {
    console.error('[ImageGeneration] Error:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function generateMoodBoard(options = {}) {
  const {
    theme = 'modern elegance',
    colors = ['neutral', 'earth tones'],
    styles = ['minimalist', 'sophisticated'],
    season = 'autumn',
    count = 1,
  } = options;

  try {
    const imageModel = await getBestModel('image');

    const prompt = `Fashion mood board collage: ${theme} aesthetic, featuring ${styles.join(' and ')} style elements, ${colors.join(', ')} color palette, ${season} season inspiration. Artistic fashion layout, textures, fabrics, accessories, color swatches, inspirational imagery. Professional mood board design, cohesive aesthetic. No text or labels.`;

    const response = await openai.images.generate({
      model: imageModel,
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'hd',
      style: 'vivid',
    });

    return {
      success: true,
      imageUrl: response.data[0]?.url,
      revisedPrompt: response.data[0]?.revised_prompt,
      modelUsed: imageModel,
    };
  } catch (error) {
    console.error('[ImageGeneration] Mood board error:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function generateSimilarLook(description, options = {}) {
  const {
    variations = 1,
    style = 'modern',
    budget = 'mid-range',
  } = options;

  try {
    const imageModel = await getBestModel('image');

    const prompt = `Fashion outfit similar to: ${description}. Styled in ${style} aesthetic, ${budget} fashion level. Full outfit on a model, professional fashion photography, clean background, well-lit, showing complete look with accessories. No text or watermarks.`;

    const response = await openai.images.generate({
      model: imageModel,
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      style: 'vivid',
    });

    return {
      success: true,
      imageUrl: response.data[0]?.url,
      revisedPrompt: response.data[0]?.revised_prompt,
      modelUsed: imageModel,
      originalDescription: description,
    };
  } catch (error) {
    console.error('[ImageGeneration] Similar look error:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function generateOutfitVariations(baseOutfit, options = {}) {
  const {
    variationType = 'style',
    count = 1,
  } = options;

  const variationPrompts = {
    style: `Same outfit concept but different style interpretation: ${baseOutfit}`,
    color: `Same outfit silhouette but different color palette: ${baseOutfit}`,
    formality: `Same outfit adjusted for different formality level: ${baseOutfit}`,
    season: `Same outfit adapted for different season: ${baseOutfit}`,
  };

  try {
    const imageModel = await getBestModel('image');

    const basePrompt = variationPrompts[variationType] || variationPrompts.style;
    const prompt = `Fashion photography: ${basePrompt}. Professional fashion editorial, full outfit visible, clean background, high quality. No text or watermarks.`;

    const response = await openai.images.generate({
      model: imageModel,
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      style: 'vivid',
    });

    return {
      success: true,
      imageUrl: response.data[0]?.url,
      revisedPrompt: response.data[0]?.revised_prompt,
      variationType,
      modelUsed: imageModel,
    };
  } catch (error) {
    console.error('[ImageGeneration] Variation error:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function generateStyleGuide(style, options = {}) {
  const {
    gender = 'unisex',
    includeAccessories = true,
    season = 'all-season',
  } = options;

  try {
    const imageModel = await getBestModel('image');

    const styleDesc = STYLE_PROMPTS[style] || style;
    const prompt = `Fashion style guide visual: Complete ${styleDesc} look for ${gender}, showing key pieces and how they work together. ${includeAccessories ? 'Including coordinated accessories.' : ''} ${season} appropriate. Editorial fashion photography style, cohesive outfit presentation. No text, labels, or watermarks.`;

    const response = await openai.images.generate({
      model: imageModel,
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'hd',
      style: 'vivid',
    });

    return {
      success: true,
      imageUrl: response.data[0]?.url,
      revisedPrompt: response.data[0]?.revised_prompt,
      style,
      modelUsed: imageModel,
    };
  } catch (error) {
    console.error('[ImageGeneration] Style guide error:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

function getAvailableStyles() {
  return Object.keys(STYLE_PROMPTS);
}

function getAvailableMoods() {
  return Object.keys(MOOD_PROMPTS);
}

module.exports = {
  generateOutfitInspiration,
  generateMoodBoard,
  generateSimilarLook,
  generateOutfitVariations,
  generateStyleGuide,
  getAvailableStyles,
  getAvailableMoods,
  STYLE_PROMPTS,
  MOOD_PROMPTS,
};

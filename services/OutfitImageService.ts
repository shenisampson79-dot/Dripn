import Constants from 'expo-constants';

interface OutfitImageResult {
  imageUrl: string | null;
  styleRule: string;
  explanation: string;
}

const REPLICATE_API_TOKEN = Constants.expoConfig?.extra?.REPLICATE_API_TOKEN || process.env.REPLICATE_API_TOKEN;

const STYLE_RULES: Record<string, string[]> = {
  work: [
    "The Rule of Three: Limit your outfit to three main colors for a polished, professional look.",
    "Fit Over Fashion: A well-fitted basic beats an ill-fitting trend every time.",
    "The One Statement Rule: Choose one standout piece and keep everything else understated.",
    "Texture Mixing: Combine smooth and textured fabrics for visual interest without bold patterns.",
  ],
  date: [
    "The 60-30-10 Rule: 60% dominant color, 30% secondary, 10% accent for balanced appeal.",
    "Show or Tell: If showing skin up top, cover below (and vice versa) for elegant allure.",
    "Comfort is Confidence: You'll look your best in clothes you feel amazing in.",
    "The Soft Touch: Incorporate one touchable fabric to invite connection.",
  ],
  casual: [
    "Elevated Basics: Quality basics styled intentionally always beat cheap trends.",
    "The Anchor Piece: Build your outfit around one quality item you love.",
    "Tonal Dressing: Wearing similar shades creates effortless sophistication.",
    "Proportional Play: Balance volume - if loose on top, fitted below.",
  ],
  event: [
    "The Silhouette Secret: Choose clothes that accentuate your best feature.",
    "Less is More: One bold accessory makes more impact than many competing pieces.",
    "Occasion Appropriate: Slightly overdressed shows respect; underdressed shows indifference.",
    "The Final Edit: Remove one thing before you leave - usually the right choice.",
  ],
  browsing: [
    "Capsule Thinking: Invest in pieces that work with 5+ items in your wardrobe.",
    "Cost Per Wear: A £200 jacket worn 100 times costs less than a £50 one worn twice.",
    "The Mirror Test: If you don't love it in the changing room, you won't wear it at home.",
    "Quality Over Quantity: One perfect piece beats five mediocre ones.",
  ],
};

const OUTFIT_EXPLANATIONS: Record<string, string[]> = {
  work: [
    "This look commands respect while remaining approachable. The structure projects competence, while thoughtful details show attention to presentation.",
    "Professional doesn't mean boring. This outfit balances authority with personality, helping you stand out for the right reasons.",
    "The key here is polish. Every element works together seamlessly, suggesting someone who has their act together.",
  ],
  date: [
    "This outfit strikes the perfect balance - put-together without looking like you tried too hard. It says 'I care' without screaming it.",
    "The silhouette flatters while remaining comfortable. When you feel good, that confidence is your best accessory.",
    "Romantic undertones with modern edge. This look creates intrigue and suggests depth.",
  ],
  casual: [
    "Effortless style is about intention disguised as ease. This look appears thrown-together but every piece earns its place.",
    "Comfort and style aren't opposites. This outfit proves you can have both without compromise.",
    "The secret to great casual style is quality basics. Nothing here screams for attention, yet everything works beautifully.",
  ],
  event: [
    "Events call for impact. This look makes an entrance while remaining tasteful - memorable for all the right reasons.",
    "The drama is intentional but controlled. Statement-making without overwhelming the occasion or your personality.",
    "Special occasions deserve special effort. This outfit shows you understand the assignment.",
  ],
  browsing: [
    "Versatility is key. This combination works across multiple settings with simple accessory changes.",
    "Investment dressing at its finest. These pieces will serve you well for years, not just this season.",
    "The foundation of a great wardrobe. Build from here and you'll always have something to wear.",
  ],
};

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function generateOutfitImage(
  outfitDescription: string,
  occasion: string
): Promise<OutfitImageResult> {
  const styleRules = STYLE_RULES[occasion] || STYLE_RULES.casual;
  const explanations = OUTFIT_EXPLANATIONS[occasion] || OUTFIT_EXPLANATIONS.casual;
  
  const styleRule = getRandomItem(styleRules);
  const explanation = getRandomItem(explanations);
  
  // Skip image generation if no API token available
  if (!REPLICATE_API_TOKEN) {
    console.log("No Replicate API token available, skipping image generation");
    return {
      imageUrl: null,
      styleRule,
      explanation,
    };
  }
  
  try {
    const prompt = `Professional fashion photography, ${outfitDescription}, worn by a stylish person, full body shot, clean background, high fashion editorial style, soft studio lighting, 8k quality, realistic`;
    
    // Use fetch instead of Replicate SDK for React Native compatibility
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
        "Prefer": "wait",
      },
      body: JSON.stringify({
        version: "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
        input: {
          prompt,
          negative_prompt: "cartoon, anime, illustration, drawing, low quality, blurry, deformed, ugly, bad anatomy",
          width: 768,
          height: 1024,
          num_outputs: 1,
          guidance_scale: 7.5,
          num_inference_steps: 30,
        },
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Replicate API error: ${response.status}`);
    }
    
    const result = await response.json();
    const output = result.output;
    const imageUrl = Array.isArray(output) ? output[0] : null;
    
    return {
      imageUrl: typeof imageUrl === 'string' ? imageUrl : null,
      styleRule,
      explanation,
    };
  } catch (error) {
    console.log("Image generation failed, using fallback:", error);
    return {
      imageUrl: null,
      styleRule,
      explanation,
    };
  }
}

export function getStyleRuleForOccasion(occasion: string): { styleRule: string; explanation: string } {
  const styleRules = STYLE_RULES[occasion] || STYLE_RULES.casual;
  const explanations = OUTFIT_EXPLANATIONS[occasion] || OUTFIT_EXPLANATIONS.casual;
  
  return {
    styleRule: getRandomItem(styleRules),
    explanation: getRandomItem(explanations),
  };
}

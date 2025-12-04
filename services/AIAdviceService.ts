const STYLE_ADVICE_TEMPLATES = {
  general: [
    "Great outfit choice! The proportions work really well together. Consider adding a statement accessory to elevate the look.",
    "Love the color coordination here! The fit is flattering. For a bolder look, try layering with a contrasting texture.",
    "This is a solid foundation look. The silhouette suits your body type well. Adding a belt could help define your waist more.",
    "Nice balance between casual and polished! The fabric quality shows. Consider rolling up sleeves for a more relaxed vibe.",
    "The monochromatic approach works beautifully! To add dimension, try pieces with subtle texture variations.",
  ],
  casual: [
    "Perfect everyday look! The relaxed fit is comfortable yet stylish. Try cuffing the pants for a more intentional finish.",
    "This casual outfit has great street style potential. Adding white sneakers would complete the effortless vibe.",
    "Love how you've mixed basics here! Consider adding a crossbody bag to add visual interest to the silhouette.",
    "The denim works well with this top. For variety, try French-tucking the front of your shirt.",
    "Casual done right! The sneakers are a great choice. A baseball cap could add a fun sporty element.",
  ],
  formal: [
    "Elegant and sophisticated! The tailoring fits well. A pocket square would add a refined finishing touch.",
    "This formal look is polished and professional. Consider a metallic accessory to catch the light beautifully.",
    "Classic combination done right! The fabric drapes nicely. Pointed-toe shoes would elongate your silhouette.",
    "You've nailed the dress code! The subtle details show attention to styling. A watch would complete the look.",
    "Sleek and powerful outfit! The structure of this piece is flattering. Try a bold lip color to make it pop.",
  ],
  colorAdvice: [
    "This color palette is harmonious! You've chosen complementary tones that enhance your complexion.",
    "The neutral base allows for versatile styling. Consider adding a pop of color through accessories.",
    "Bold color choice! This shade suits your undertone. Pair with gold jewelry to enhance the warmth.",
    "The color blocking is eye-catching! For a softer approach, try similar tones in different saturations.",
    "Earth tones look great on you! Consider adding a jewel tone accent for visual interest.",
  ],
  proportions: [
    "The high-waist placement is visually lengthening. This creates a balanced and elegant silhouette.",
    "Great job with the proportions! The fitted top with relaxed bottom is a universally flattering formula.",
    "The cropped length works well with the high-waisted bottom. This is a modern and fashion-forward combination.",
    "Tucking your top defines your waist beautifully. Consider half-tucking for a more casual vibe.",
    "The oversized top balanced with slim pants creates visual interest. This proportion play is very chic.",
  ],
  seasonal: {
    spring: [
      "Perfect spring layering! Light fabrics work well for transitional weather. Consider pastels to match the season.",
      "This outfit captures spring freshness! Floral prints would complement this base beautifully.",
    ],
    summer: [
      "Light and breezy - perfect for warm weather! Natural fabrics like linen would keep you cool and stylish.",
      "Great summer silhouette! Consider adding sunglasses and a woven bag to complete the vacation vibe.",
    ],
    fall: [
      "Cozy fall layering done right! The warm tones are seasonal and flattering. Try adding a scarf for extra dimension.",
      "Perfect autumn outfit! The layers work well together. Consider swapping to boots for a complete fall look.",
    ],
    winter: [
      "Winter dressing at its finest! The layering is both practical and stylish. Add leather gloves for a polished finish.",
      "Cozy and chic winter look! The textures mix well. A structured bag would add sophistication.",
    ],
  },
  sizeInclusive: [
    "This fit is celebrating your shape beautifully! The fabric choice is excellent for comfortable movement.",
    "Love how you've styled this! The strategic fit-and-flare creates a gorgeous silhouette.",
    "You're rocking this look! The structured shoulder balances the outfit perfectly.",
    "Stunning choice! The empire waist is incredibly flattering and the fabric flows elegantly.",
    "This outfit highlights your best features! The V-neckline elongates beautifully.",
  ],
};

const HASHTAG_SUGGESTIONS = [
  "#OOTD #StyleWise #FashionAdvice",
  "#OutfitInspo #StyleTips #FashionCommunity",
  "#WhatIWore #FashionDiary #StreetStyle",
  "#StyleOfTheDay #OutfitGoals #FashionForward",
  "#DailyFashion #StyleInspiration #LookOfTheDay",
];

const PRODUCT_SUGGESTIONS = [
  { category: "Accessories", items: ["Statement earrings", "Leather belt", "Crossbody bag", "Silk scarf"] },
  { category: "Shoes", items: ["White sneakers", "Block heels", "Ankle boots", "Loafers"] },
  { category: "Layers", items: ["Denim jacket", "Cardigan", "Blazer", "Trench coat"] },
  { category: "Basics", items: ["White t-shirt", "Black trousers", "Classic jeans", "Neutral sweater"] },
];

export interface AIAdviceResult {
  mainAdvice: string;
  colorAdvice?: string;
  proportionAdvice?: string;
  suggestions: string[];
  hashtags: string[];
  productRecommendations: { category: string; items: string[] }[];
  confidence: number;
}

function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getCurrentSeason(): 'spring' | 'summer' | 'fall' | 'winter' {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'fall';
  return 'winter';
}

function generateAdvice(description: string, isPremium: boolean): AIAdviceResult {
  const descLower = description.toLowerCase();

  let category: 'general' | 'casual' | 'formal' = 'general';
  if (descLower.includes('casual') || descLower.includes('jeans') || descLower.includes('sneaker')) {
    category = 'casual';
  } else if (descLower.includes('formal') || descLower.includes('business') || descLower.includes('dress') || descLower.includes('suit')) {
    category = 'formal';
  }

  const mainAdvice = getRandomItem(STYLE_ADVICE_TEMPLATES[category]);
  const colorAdvice = getRandomItem(STYLE_ADVICE_TEMPLATES.colorAdvice);
  const proportionAdvice = getRandomItem(STYLE_ADVICE_TEMPLATES.proportions);
  const seasonalAdvice = getRandomItem(STYLE_ADVICE_TEMPLATES.seasonal[getCurrentSeason()]);
  const sizeInclusiveAdvice = getRandomItem(STYLE_ADVICE_TEMPLATES.sizeInclusive);

  const suggestions = [seasonalAdvice];
  if (isPremium) {
    suggestions.push(sizeInclusiveAdvice);
  }

  const hashtags = getRandomItem(HASHTAG_SUGGESTIONS).split(' ');

  const numProducts = isPremium ? 3 : 1;
  const shuffledProducts = [...PRODUCT_SUGGESTIONS].sort(() => Math.random() - 0.5);
  const productRecommendations = shuffledProducts.slice(0, numProducts);

  return {
    mainAdvice,
    colorAdvice: isPremium ? colorAdvice : undefined,
    proportionAdvice: isPremium ? proportionAdvice : undefined,
    suggestions,
    hashtags,
    productRecommendations,
    confidence: 0.85 + Math.random() * 0.1,
  };
}

export async function getAIFashionAdvice(
  imageUri: string,
  description: string,
  isPremiumUser: boolean = false
): Promise<AIAdviceResult> {
  await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));

  return generateAdvice(description, isPremiumUser);
}

export async function getQuickAdvice(description: string): Promise<string> {
  await new Promise(resolve => setTimeout(resolve, 800));

  const category = description.toLowerCase().includes('casual') ? 'casual' :
    description.toLowerCase().includes('formal') ? 'formal' : 'general';

  return getRandomItem(STYLE_ADVICE_TEMPLATES[category]);
}

export function generateShareableCaption(advice: AIAdviceResult): string {
  const caption = `${advice.mainAdvice}\n\n${advice.hashtags.join(' ')}`;
  return caption;
}

export function getComparisonAdvice(): { optionA: string; optionB: string; recommendation: string } {
  const recommendations = [
    {
      optionA: "Option A has a more relaxed, casual vibe that's perfect for everyday wear.",
      optionB: "Option B is slightly more polished and could transition well to evening events.",
      recommendation: "Both are great choices! Go with A for comfort-focused days, B when you want to make more of a statement.",
    },
    {
      optionA: "The color palette in Option A is very harmonious and easy to accessorize.",
      optionB: "Option B has bolder color choices that make more of a visual impact.",
      recommendation: "If you want versatility, choose A. For a memorable look, go with B.",
    },
    {
      optionA: "Option A features classic pieces that never go out of style.",
      optionB: "Option B incorporates more current trends for a fashion-forward look.",
      recommendation: "A is perfect for building a capsule wardrobe. B is great for staying on-trend.",
    },
  ];

  return getRandomItem(recommendations);
}

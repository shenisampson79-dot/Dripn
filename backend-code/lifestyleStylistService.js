const OpenAI = require('openai');
const { getBestModel } = require('./modelLifecycleService');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MOOD_OUTFIT_PROMPT = `You are a fashion therapist who understands the deep connection between clothing and emotional wellbeing. 

The user is feeling: {MOOD}
Their current emotional intensity: {INTENSITY}/10
Additional context: {CONTEXT}

Based on color psychology, fashion therapy principles, and the user's wardrobe, suggest an outfit that will help them feel better.

Consider:
1. COLOR PSYCHOLOGY: What colors can improve their mood?
   - Blue: Calming, reduces anxiety
   - Yellow: Energizing, mood-lifting
   - Green: Balancing, refreshing
   - Red: Confidence-boosting, energizing
   - Purple: Creative, soothing
   - Pink: Nurturing, comforting
   - Orange: Optimistic, social
   - Black: Powerful, protective
   - White: Fresh, clearing

2. COMFORT VS POWER: Based on their mood, do they need:
   - Comfort dressing (soft fabrics, relaxed fits)
   - Power dressing (structured pieces, bold colors)
   - A balance of both

3. STYLE PRESCRIPTION: What style elements can help?
   - Texture (soft, structured, flowy)
   - Silhouette (protective layers, confidence-boosting fits)
   - Accessories (statement for confidence, minimal for calm)

USER'S WARDROBE:
{WARDROBE}

Respond in JSON:
{
  "moodAnalysis": {
    "currentState": "analysis of their emotional state",
    "styleNeed": "what type of styling will help",
    "colorPrescription": "colors to wear today"
  },
  "outfit": {
    "pieces": [
      {"item": "wardrobe item name", "reason": "why this helps"}
    ],
    "colorPalette": ["colors in the outfit"],
    "overallEffect": "how this outfit will make them feel"
  },
  "affirmation": "a personalized positive affirmation for today",
  "selfCareTip": "one self-care suggestion that pairs with the outfit",
  "avoidToday": "what styles or colors to avoid based on their mood"
}`;

const BODY_POSITIVITY_PROMPT = `You are a compassionate, body-positive fashion advisor. Your role is to help people feel confident and beautiful in their bodies, exactly as they are right now.

User Profile:
- Preferred pronouns/identity: {IDENTITY}
- Style preferences: {PREFERENCES}
- Any specific concerns: {CONCERNS}

Provide loving, affirming style advice that:
1. Celebrates their unique features
2. Focuses on what makes THEM feel good, not arbitrary "rules"
3. Reframes any negative self-talk into positive perspectives
4. Suggests styles based on preference, not "hiding" or "minimizing"
5. Includes powerful affirmations

USER'S WARDROBE:
{WARDROBE}

Respond in JSON:
{
  "affirmations": [
    "3 personalized affirmations about their body and style"
  ],
  "celebrateFeatures": [
    {"feature": "something to celebrate", "howToStyle": "style tip that honors this"}
  ],
  "mindsetShift": {
    "oldThinking": "limiting belief they might have",
    "newPerspective": "empowering reframe"
  },
  "signatureStyleElements": [
    "3 style elements that would become their signature"
  ],
  "confidenceOutfit": {
    "description": "an outfit from their wardrobe that will make them feel powerful",
    "pieces": ["specific items"],
    "whyItWorks": "why this outfit is perfect for them"
  },
  "dailyPractice": "a daily style/self-love practice"
}`;

const CAPSULE_WARDROBE_PROMPT = `You are a sustainable fashion expert and minimalist lifestyle coach. Help the user create a mindful, versatile capsule wardrobe.

User's goals: {GOALS}
Lifestyle needs: {LIFESTYLE}
Color preferences: {COLORS}

Current Wardrobe ({ITEM_COUNT} items):
{WARDROBE}

Analyze their wardrobe and create a personalized capsule wardrobe plan.

Respond in JSON:
{
  "currentAnalysis": {
    "totalItems": number,
    "categoryBreakdown": {"tops": n, "bottoms": n, etc},
    "colorPalette": ["existing colors"],
    "versatilityScore": 1-10,
    "gapsIdentified": ["what's missing"]
  },
  "capsulePlan": {
    "targetSize": "recommended number of items",
    "coreColors": ["3-4 base colors"],
    "accentColors": ["1-2 accent colors"],
    "essentials": [
      {"category": "category", "quantity": n, "purpose": "why needed"}
    ]
  },
  "keepItems": [
    {"item": "wardrobe item", "reason": "why it's essential"}
  ],
  "considerRemoving": [
    {"item": "wardrobe item", "reason": "why it doesn't serve the capsule"}
  ],
  "shoppingList": [
    {"item": "what to add", "priority": "high/medium/low", "reason": "fills what gap"}
  ],
  "outfitFormulas": [
    "5 outfit formulas using their capsule pieces"
  ],
  "mindfulnessTask": "a wardrobe mindfulness exercise"
}`;

const CONFIDENCE_RITUAL_PROMPT = `You are a style confidence coach. Create a personalized "power dressing" ritual for an important occasion.

Occasion: {OCCASION}
What they want to feel: {FEELING}
Any anxieties: {ANXIETIES}

USER'S WARDROBE:
{WARDROBE}

Create a complete confidence ritual that includes what to wear and how to prepare mentally.

Respond in JSON:
{
  "occasionAnalysis": {
    "whatToExpect": "what the occasion will be like",
    "energyNeeded": "confident/calm/powerful/approachable"
  },
  "powerOutfit": {
    "pieces": [
      {"item": "wardrobe item", "reason": "why this boosts confidence"}
    ],
    "colorMeaning": "what these colors communicate",
    "silhouettePower": "how the shapes make them feel"
  },
  "preEventRitual": {
    "morningOf": "morning preparation suggestions",
    "gettingDressed": "mindful dressing practice",
    "finalCheck": "confidence check before leaving"
  },
  "powerPose": "a power pose to do before the event",
  "mantra": "a personal mantra for the day",
  "contingencyPlan": "if anxiety hits during the event, do this",
  "celebrationPlan": "how to celebrate after, regardless of outcome"
}`;

const WELLNESS_OUTFIT_PROMPT = `You are a holistic wellness stylist who understands that clothing affects our physical and mental wellbeing.

Today's context:
- Weather: {WEATHER}
- Activities planned: {ACTIVITIES}
- Energy level: {ENERGY}
- Physical comfort needs: {COMFORT_NEEDS}

USER'S WARDROBE:
{WARDROBE}

Create an outfit that supports their physical and mental wellness today.

Respond in JSON:
{
  "wellnessAssessment": {
    "physicalNeeds": "what their body needs today",
    "mentalNeeds": "what their mind needs today",
    "energyOptimization": "how to dress for optimal energy"
  },
  "outfit": {
    "pieces": [
      {"item": "wardrobe item", "wellnessBenefit": "how it supports wellness"}
    ],
    "fabricConsiderations": "why these fabrics work for today",
    "movementFriendly": true/false
  },
  "layeringStrategy": "how to adapt as the day progresses",
  "colorWellness": "how the colors support wellbeing",
  "selfCareReminders": [
    "3 self-care reminders that pair with this outfit"
  ],
  "eveningTransition": "how to transition this outfit for evening relaxation"
}`;

async function getMoodBasedOutfit(options = {}) {
  const {
    mood = 'neutral',
    intensity = 5,
    context = '',
    wardrobeItems = [],
  } = options;

  try {
    const model = await getBestModel('chat');
    
    const wardrobeText = wardrobeItems.length > 0
      ? wardrobeItems.map(item => `- ${item.name} (${item.color}, ${item.category})`).join('\n')
      : 'No wardrobe items provided - give general suggestions';

    const prompt = MOOD_OUTFIT_PROMPT
      .replace('{MOOD}', mood)
      .replace('{INTENSITY}', intensity.toString())
      .replace('{CONTEXT}', context || 'No additional context')
      .replace('{WARDROBE}', wardrobeText);

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are a compassionate fashion therapist. Always respond with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content?.trim();
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '');
    const result = JSON.parse(cleanedContent);

    return {
      success: true,
      data: result,
      modelUsed: model,
    };
  } catch (error) {
    console.error('[LifestyleStylist] Mood outfit error:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function getBodyPositivityAdvice(options = {}) {
  const {
    identity = 'person',
    preferences = '',
    concerns = '',
    wardrobeItems = [],
  } = options;

  try {
    const model = await getBestModel('chat');
    
    const wardrobeText = wardrobeItems.length > 0
      ? wardrobeItems.map(item => `- ${item.name} (${item.color}, ${item.category})`).join('\n')
      : 'No wardrobe items provided';

    const prompt = BODY_POSITIVITY_PROMPT
      .replace('{IDENTITY}', identity)
      .replace('{PREFERENCES}', preferences || 'Not specified')
      .replace('{CONCERNS}', concerns || 'None mentioned')
      .replace('{WARDROBE}', wardrobeText);

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are the most loving, body-positive fashion advisor. Your words should make people feel beautiful and valued. Always respond with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.85,
      max_tokens: 1200,
    });

    const content = response.choices[0]?.message?.content?.trim();
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '');
    const result = JSON.parse(cleanedContent);

    return {
      success: true,
      data: result,
      modelUsed: model,
    };
  } catch (error) {
    console.error('[LifestyleStylist] Body positivity error:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function getCapsuleWardrobePlan(options = {}) {
  const {
    goals = 'versatile, minimal wardrobe',
    lifestyle = 'work and casual',
    colors = 'neutrals',
    wardrobeItems = [],
  } = options;

  try {
    const model = await getBestModel('chat');
    
    const wardrobeText = wardrobeItems.length > 0
      ? wardrobeItems.map(item => `- ${item.name} (${item.color}, ${item.category})`).join('\n')
      : 'No wardrobe items provided';

    const prompt = CAPSULE_WARDROBE_PROMPT
      .replace('{GOALS}', goals)
      .replace('{LIFESTYLE}', lifestyle)
      .replace('{COLORS}', colors)
      .replace('{ITEM_COUNT}', wardrobeItems.length.toString())
      .replace('{WARDROBE}', wardrobeText);

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are a sustainable fashion expert focused on mindful consumption. Always respond with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content?.trim();
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '');
    const result = JSON.parse(cleanedContent);

    return {
      success: true,
      data: result,
      modelUsed: model,
    };
  } catch (error) {
    console.error('[LifestyleStylist] Capsule wardrobe error:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function getConfidenceRitual(options = {}) {
  const {
    occasion = 'important event',
    feeling = 'confident and powerful',
    anxieties = '',
    wardrobeItems = [],
  } = options;

  try {
    const model = await getBestModel('chat');
    
    const wardrobeText = wardrobeItems.length > 0
      ? wardrobeItems.map(item => `- ${item.name} (${item.color}, ${item.category})`).join('\n')
      : 'No wardrobe items provided';

    const prompt = CONFIDENCE_RITUAL_PROMPT
      .replace('{OCCASION}', occasion)
      .replace('{FEELING}', feeling)
      .replace('{ANXIETIES}', anxieties || 'None mentioned')
      .replace('{WARDROBE}', wardrobeText);

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are a confidence coach who uses fashion as a tool for empowerment. Always respond with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 1200,
    });

    const content = response.choices[0]?.message?.content?.trim();
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '');
    const result = JSON.parse(cleanedContent);

    return {
      success: true,
      data: result,
      modelUsed: model,
    };
  } catch (error) {
    console.error('[LifestyleStylist] Confidence ritual error:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function getWellnessOutfit(options = {}) {
  const {
    weather = 'moderate',
    activities = 'work',
    energy = 'medium',
    comfortNeeds = '',
    wardrobeItems = [],
  } = options;

  try {
    const model = await getBestModel('chat');
    
    const wardrobeText = wardrobeItems.length > 0
      ? wardrobeItems.map(item => `- ${item.name} (${item.color}, ${item.category})`).join('\n')
      : 'No wardrobe items provided';

    const prompt = WELLNESS_OUTFIT_PROMPT
      .replace('{WEATHER}', weather)
      .replace('{ACTIVITIES}', activities)
      .replace('{ENERGY}', energy)
      .replace('{COMFORT_NEEDS}', comfortNeeds || 'None specified')
      .replace('{WARDROBE}', wardrobeText);

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are a holistic wellness stylist who understands the mind-body-clothing connection. Always respond with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content?.trim();
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '');
    const result = JSON.parse(cleanedContent);

    return {
      success: true,
      data: result,
      modelUsed: model,
    };
  } catch (error) {
    console.error('[LifestyleStylist] Wellness outfit error:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function getDailyAffirmation(userProfile = {}) {
  try {
    const model = await getBestModel('mini');
    
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { 
          role: 'system', 
          content: 'You create beautiful, personalized fashion-focused affirmations. Be warm and empowering.' 
        },
        { 
          role: 'user', 
          content: `Create a short, powerful daily affirmation about style and self-worth for someone who ${userProfile.mood ? `is feeling ${userProfile.mood}` : 'wants to feel confident today'}. Make it personal and impactful.` 
        },
      ],
      temperature: 0.9,
      max_tokens: 100,
    });

    return {
      success: true,
      affirmation: response.choices[0]?.message?.content?.trim(),
    };
  } catch (error) {
    console.error('[LifestyleStylist] Affirmation error:', error.message);
    return {
      success: true,
      affirmation: 'You are worthy of feeling beautiful and confident in your own skin, exactly as you are today.',
    };
  }
}

module.exports = {
  getMoodBasedOutfit,
  getBodyPositivityAdvice,
  getCapsuleWardrobePlan,
  getConfidenceRitual,
  getWellnessOutfit,
  getDailyAffirmation,
};

const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const STYLIST_PERSONALITIES = {
  ruby: {
    name: 'Ruby',
    systemPrompt: `You are Ruby, a warm, encouraging, and fashion-forward personal stylist with a nurturing personality. You work for Dripn, a fashion advice app.

PERSONALITY TRAITS:
- You address users with terms of endearment like "darling", "love", "gorgeous", or "sweetheart"
- You're enthusiastic and use exclamation marks naturally
- You're empathetic and emotionally intelligent - you pick up on users' moods and feelings
- You're supportive and encouraging, especially when someone is having a hard time
- Your specialty is elegant styling with a modern twist

CORE CAPABILITIES:
1. FASHION EXPERTISE: You're an expert stylist who can give advice on outfits, colors, occasions, trends, and personal style
2. EMOTIONAL SUPPORT: When users share personal struggles (breakups, bad days, stress), you listen with genuine care and offer comfort
3. GENERAL CONVERSATION: You can discuss any topic - life, relationships, work, hobbies - while maintaining your warm personality
4. MOOD DETECTION: You naturally sense when someone is sad, stressed, excited, or frustrated and adjust your tone accordingly

BEHAVIORAL GUIDELINES:
- If someone seems upset or mentions personal problems, acknowledge their feelings FIRST before any fashion talk
- Balance being supportive with your fashion expertise - you can gently bring style back when appropriate
- Never be preachy or give unsolicited life advice - listen and comfort
- Keep responses conversational and not too long (2-4 sentences for casual chat, more for fashion advice)
- End messages with your signature warm touch like "You've got this, darling!" or "Take care of yourself, love!"

RESPONSE FORMAT:
Always respond naturally as Ruby. When you detect strong emotions, acknowledge them warmly first.`,
    signOffs: [
      "You've got this, darling!",
      "Go shine bright, gorgeous!",
      "Own it, you look amazing!",
      "Slay the day, love!",
      "Take care of yourself, sweetheart!",
      "Sending you all my love!",
    ],
  },
  max: {
    name: 'Max',
    systemPrompt: `You are Max, a confident, straightforward, and trend-savvy personal stylist with a cool, approachable personality. You work for Dripn, a fashion advice app.

PERSONALITY TRAITS:
- You use casual, friendly language like "mate", "legend", "buddy", or "my friend"
- You're direct but kind - you keep it real while being supportive
- You're emotionally aware - you can tell when someone needs to vent and you're there for them
- You're encouraging in a down-to-earth way
- Your specialty is effortlessly cool looks with attention to detail

CORE CAPABILITIES:
1. FASHION EXPERTISE: You're an expert stylist who can give advice on outfits, colors, occasions, trends, and personal style
2. EMOTIONAL SUPPORT: When users share personal struggles (breakups, bad days, stress), you listen and offer genuine support
3. GENERAL CONVERSATION: You can discuss any topic - life, relationships, work, sports, hobbies - while keeping your cool personality
4. MOOD DETECTION: You naturally sense when someone is down, stressed, excited, or frustrated and adjust your response

BEHAVIORAL GUIDELINES:
- If someone seems upset or mentions personal problems, acknowledge it genuinely FIRST before any style talk
- Be real and supportive - you can bring fashion back when the time feels right
- Never be preachy or lecture - just be a good listener and supportive friend
- Keep responses conversational and not too long (2-4 sentences for casual chat, more for fashion advice)
- End messages with your signature encouraging touch like "You've got this, mate!" or "Go crush it, legend!"

RESPONSE FORMAT:
Always respond naturally as Max. When you detect someone's having a rough time, acknowledge it honestly first.`,
    signOffs: [
      "Looking good, mate!",
      "You're all set, go crush it!",
      "That's a solid look, own it!",
      "You're good to go, legend!",
      "Hang in there, buddy!",
      "You've got this, my friend!",
    ],
  },
};

const MOOD_DETECTION_PROMPT = `Based on the user's message, detect their emotional state. Respond with a JSON object containing:
- mood: one of "happy", "excited", "neutral", "stressed", "sad", "angry", "anxious", "frustrated", "tired", "grateful"
- confidence: a number from 0 to 1 indicating confidence in the mood detection
- needsSupport: boolean indicating if the user seems to need emotional support
- topicType: one of "fashion", "emotional", "casual", "mixed"

Only respond with the JSON object, no other text.`;

async function detectMood(userMessage) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: MOOD_DETECTION_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 100,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (content) {
      try {
        return JSON.parse(content);
      } catch {
        return { mood: 'neutral', confidence: 0.5, needsSupport: false, topicType: 'casual' };
      }
    }
  } catch (error) {
    console.error('Mood detection error:', error.message);
  }
  return { mood: 'neutral', confidence: 0.5, needsSupport: false, topicType: 'casual' };
}

function buildWardrobeContext(wardrobeItems) {
  if (!wardrobeItems || wardrobeItems.length === 0) {
    return 'The user has not added any items to their digital wardrobe yet.';
  }

  const categories = {};
  wardrobeItems.forEach((item) => {
    if (!categories[item.category]) {
      categories[item.category] = [];
    }
    categories[item.category].push(`${item.name} (${item.color})`);
  });

  let context = `The user's wardrobe contains ${wardrobeItems.length} items:\n`;
  for (const [category, items] of Object.entries(categories)) {
    context += `- ${category}: ${items.slice(0, 5).join(', ')}${items.length > 5 ? ` and ${items.length - 5} more` : ''}\n`;
  }

  return context;
}

async function generateStylistResponse({
  stylistId,
  messages,
  userMessage,
  wardrobeItems,
  userGender,
  subscriptionTier,
}) {
  const stylist = STYLIST_PERSONALITIES[stylistId] || STYLIST_PERSONALITIES.ruby;

  const moodAnalysis = await detectMood(userMessage);

  const wardrobeContext = buildWardrobeContext(wardrobeItems);

  let contextualGuidance = '';
  if (moodAnalysis.needsSupport) {
    contextualGuidance = `\n\nIMPORTANT: The user appears to be feeling ${moodAnalysis.mood} and may need emotional support. Prioritize being empathetic and supportive before discussing fashion.`;
  } else if (moodAnalysis.topicType === 'fashion') {
    contextualGuidance = `\n\nThe user is asking about fashion/style. Use their wardrobe information to give personalized advice.`;
  }

  const systemMessage = `${stylist.systemPrompt}

USER CONTEXT:
- Gender: ${userGender || 'not specified'}
- Subscription: ${subscriptionTier || 'free'} tier
- ${wardrobeContext}
${contextualGuidance}

Remember to stay in character as ${stylist.name} throughout the conversation.`;

  const conversationHistory = messages.slice(-10).map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  conversationHistory.push({ role: 'user', content: userMessage });

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemMessage },
        ...conversationHistory,
      ],
      temperature: 0.8,
      max_tokens: 500,
      presence_penalty: 0.1,
      frequency_penalty: 0.1,
    });

    const assistantMessage = response.choices[0]?.message?.content?.trim();

    if (!assistantMessage) {
      throw new Error('Empty response from OpenAI');
    }

    return {
      content: assistantMessage,
      mood: moodAnalysis,
      stylistId: stylist.name.toLowerCase(),
    };
  } catch (error) {
    console.error('OpenAI chat error:', error.message);

    const fallbackResponses = {
      ruby: {
        emotional: "Oh darling, I can sense something's on your mind. I'm here for you, love. Want to talk about it? Sometimes a good chat is just what we need.",
        fashion: "Gorgeous, I'd love to help you with that! Tell me more about what you're looking for, and we'll create something fabulous together.",
        default: "Hello love! I'm here and ready to chat about anything - fashion, life, whatever's on your mind. What can I do for you today, darling?",
      },
      max: {
        emotional: "Hey mate, sounds like you've got something on your mind. I'm all ears, buddy. Sometimes it helps to just talk it out.",
        fashion: "Hey, I've got you covered on that! Tell me a bit more about what you're going for, and we'll figure out the perfect look.",
        default: "Hey there! I'm here whenever you're ready to chat - whether it's style advice or just shooting the breeze. What's up?",
      },
    };

    const responses = fallbackResponses[stylistId] || fallbackResponses.ruby;
    let fallbackContent;

    if (moodAnalysis.needsSupport) {
      fallbackContent = responses.emotional;
    } else if (moodAnalysis.topicType === 'fashion') {
      fallbackContent = responses.fashion;
    } else {
      fallbackContent = responses.default;
    }

    return {
      content: fallbackContent,
      mood: moodAnalysis,
      stylistId: stylistId,
      error: 'Used fallback response due to API error',
    };
  }
}

async function analyzeFashionRequest(userMessage, wardrobeItems) {
  const lowerMessage = userMessage.toLowerCase();

  const fashionKeywords = [
    'wear',
    'outfit',
    'style',
    'fashion',
    'clothes',
    'dress',
    'shirt',
    'pants',
    'shoes',
    'accessory',
    'color',
    'match',
    'occasion',
    'work',
    'date',
    'party',
    'casual',
    'formal',
    'wardrobe',
  ];

  const isFashionQuery = fashionKeywords.some((keyword) =>
    lowerMessage.includes(keyword)
  );

  if (isFashionQuery && wardrobeItems && wardrobeItems.length > 0) {
    return {
      isFashionQuery: true,
      wardrobeItems: wardrobeItems,
      suggestedItems: wardrobeItems.slice(0, 3),
    };
  }

  return { isFashionQuery, wardrobeItems };
}

module.exports = {
  generateStylistResponse,
  detectMood,
  analyzeFashionRequest,
  STYLIST_PERSONALITIES,
};

/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { apiService } from './ApiService';

const GUEST_TOKEN_KEY = '@dripn_guest_token';

interface OutfitImageResult {
  imageUrl: string | null;
  styleRule: string;
  explanation: string;
  styleRuleKey?: string;
  explanationKey?: string;
}

type TranslateFn = (key: string) => string;

/** Stable i18n keys — seeded in en-flat / locales as decideForMe.rules.* / decideForMe.explanations.* */
export const STYLE_RULE_KEYS: Record<string, string[]> = {
  work: [
    'decideForMe.rules.work.0',
    'decideForMe.rules.work.1',
    'decideForMe.rules.work.2',
    'decideForMe.rules.work.3',
  ],
  date: [
    'decideForMe.rules.date.0',
    'decideForMe.rules.date.1',
    'decideForMe.rules.date.2',
    'decideForMe.rules.date.3',
  ],
  casual: [
    'decideForMe.rules.casual.0',
    'decideForMe.rules.casual.1',
    'decideForMe.rules.casual.2',
    'decideForMe.rules.casual.3',
  ],
  event: [
    'decideForMe.rules.event.0',
    'decideForMe.rules.event.1',
    'decideForMe.rules.event.2',
    'decideForMe.rules.event.3',
  ],
  browsing: [
    'decideForMe.rules.browsing.0',
    'decideForMe.rules.browsing.1',
    'decideForMe.rules.browsing.2',
    'decideForMe.rules.browsing.3',
  ],
};

/** Coaching lines under the style rule — use explanations.* (localized in all 19 langs). */
export const STYLE_TIP_KEYS: Record<string, string[]> = {
  work: [
    'decideForMe.explanations.work.0',
    'decideForMe.explanations.work.1',
    'decideForMe.explanations.work.2',
  ],
  date: [
    'decideForMe.explanations.date.0',
    'decideForMe.explanations.date.1',
    'decideForMe.explanations.date.2',
  ],
  casual: [
    'decideForMe.explanations.casual.0',
    'decideForMe.explanations.casual.1',
    'decideForMe.explanations.casual.2',
  ],
  event: [
    'decideForMe.explanations.event.0',
    'decideForMe.explanations.event.1',
    'decideForMe.explanations.event.2',
  ],
  browsing: [
    'decideForMe.explanations.browsing.0',
    'decideForMe.explanations.browsing.1',
    'decideForMe.explanations.browsing.2',
  ],
};

const STYLE_RULE_EN: Record<string, string> = {
  'decideForMe.rules.work.0':
    'The Rule of Three: Limit your outfit to three main colors for a polished, professional look.',
  'decideForMe.rules.work.1':
    'Fit Over Fashion: A well-fitted basic beats an ill-fitting trend every time.',
  'decideForMe.rules.work.2':
    'The One Statement Rule: Choose one standout piece and keep everything else understated.',
  'decideForMe.rules.work.3':
    'Texture Mixing: Combine smooth and textured fabrics for visual interest without bold patterns.',
  'decideForMe.rules.date.0':
    'The 60-30-10 Rule: 60% dominant color, 30% secondary, 10% accent for balanced appeal.',
  'decideForMe.rules.date.1':
    'Show or Tell: If showing skin up top, cover below (and vice versa) for elegant allure.',
  'decideForMe.rules.date.2':
    "Comfort is Confidence: You'll look your best in clothes you feel amazing in.",
  'decideForMe.rules.date.3':
    'The Soft Touch: Incorporate one touchable fabric to invite connection.',
  'decideForMe.rules.casual.0':
    'Elevated Basics: Quality basics styled intentionally always beat cheap trends.',
  'decideForMe.rules.casual.1':
    'The Anchor Piece: Build your outfit around one quality item you love.',
  'decideForMe.rules.casual.2':
    'Tonal Dressing: Wearing similar shades creates effortless sophistication.',
  'decideForMe.rules.casual.3':
    'Proportional Play: Balance volume - if loose on top, fitted below.',
  'decideForMe.rules.event.0':
    'The Silhouette Secret: Choose clothes that accentuate your best feature.',
  'decideForMe.rules.event.1':
    'Less is More: One bold accessory makes more impact than many competing pieces.',
  'decideForMe.rules.event.2':
    'Occasion Appropriate: Slightly overdressed shows respect; underdressed shows indifference.',
  'decideForMe.rules.event.3':
    'The Final Edit: Remove one thing before you leave - usually the right choice.',
  'decideForMe.rules.browsing.0':
    'Capsule Thinking: Invest in pieces that work with 5+ items in your wardrobe.',
  'decideForMe.rules.browsing.1':
    'Cost Per Wear: A £200 jacket worn 100 times costs less than a £50 one worn twice.',
  'decideForMe.rules.browsing.2':
    "The Mirror Test: If you don't love it in the changing room, you won't wear it at home.",
  'decideForMe.rules.browsing.3':
    'Quality Over Quantity: One perfect piece beats five mediocre ones.',
};

const STYLE_TIP_EN: Record<string, string> = {
  'decideForMe.explanations.work.0':
    'This look commands respect while remaining approachable. The structure projects competence, while thoughtful details show attention to presentation.',
  'decideForMe.explanations.work.1':
    "Professional doesn't mean boring. This outfit balances authority with personality, helping you stand out for the right reasons.",
  'decideForMe.explanations.work.2':
    'The key here is polish. Every element works together seamlessly, suggesting someone who has their act together.',
  'decideForMe.explanations.date.0':
    "This outfit strikes the perfect balance - put-together without looking like you tried too hard. It says 'I care' without screaming it.",
  'decideForMe.explanations.date.1':
    'The silhouette flatters while remaining comfortable. When you feel good, that confidence is your best accessory.',
  'decideForMe.explanations.date.2':
    'Romantic undertones with modern edge. This look creates intrigue and suggests depth.',
  'decideForMe.explanations.casual.0':
    'Effortless style is about intention disguised as ease. This look appears thrown-together but every piece earns its place.',
  'decideForMe.explanations.casual.1':
    "Comfort and style aren't opposites. This outfit proves you can have both without compromise.",
  'decideForMe.explanations.casual.2':
    'The secret to great casual style is quality basics. Nothing here screams for attention, yet everything works beautifully.',
  'decideForMe.explanations.event.0':
    'Events call for impact. This look makes an entrance while remaining tasteful - memorable for all the right reasons.',
  'decideForMe.explanations.event.1':
    'The drama is intentional but controlled. Statement-making without overwhelming the occasion or your personality.',
  'decideForMe.explanations.event.2':
    'Special occasions deserve special effort. This outfit shows you understand the assignment.',
  'decideForMe.explanations.browsing.0':
    'Versatility is key. This combination works across multiple settings with simple accessory changes.',
  'decideForMe.explanations.browsing.1':
    'Investment dressing at its finest. These pieces will serve you well for years, not just this season.',
  'decideForMe.explanations.browsing.2':
    "The foundation of a great wardrobe. Build from here and you'll always have something to wear.",
};

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function resolveText(key: string, fallback: string, t?: TranslateFn): string {
  if (t) {
    const translated = t(key);
    if (translated) return translated;
  }
  return fallback;
}

export function getStyleRuleForOccasion(
  occasion: string,
  t?: TranslateFn,
): { styleRule: string; explanation: string; styleRuleKey: string; explanationKey: string } {
  const ruleKeys = STYLE_RULE_KEYS[occasion] || STYLE_RULE_KEYS.casual;
  const tipKeys = STYLE_TIP_KEYS[occasion] || STYLE_TIP_KEYS.casual;
  const styleRuleKey = getRandomItem(ruleKeys);
  const explanationKey = getRandomItem(tipKeys);

  return {
    styleRuleKey,
    explanationKey,
    styleRule: resolveText(styleRuleKey, STYLE_RULE_EN[styleRuleKey] || styleRuleKey, t),
    explanation: resolveText(explanationKey, STYLE_TIP_EN[explanationKey] || explanationKey, t),
  };
}

async function getGuestSessionToken(forceNew = false): Promise<string | null> {
  try {
    if (!forceNew) {
      const cached = await AsyncStorage.getItem(GUEST_TOKEN_KEY);
      if (cached) return cached;
    }
    const session = await apiService.createGuestSession();
    await AsyncStorage.setItem(GUEST_TOKEN_KEY, session.sessionToken);
    return session.sessionToken;
  } catch {
    return null;
  }
}

async function generateGuestOutfitImage(
  outfitDescription: string,
  occasion: string,
): Promise<string | null> {
  let token = await getGuestSessionToken();
  for (let attempt = 0; attempt < 2 && token; attempt++) {
    try {
      const result = await apiService.guestGenerateOutfitImage(token, outfitDescription, occasion, 'ruby');
      // Never show a generic stock placeholder as if it were the exact recommended outfit
      if (result?.imageUrl && !result.isPlaceholder) return result.imageUrl;
      return null;
    } catch {
      // Guest session likely expired — mint a fresh one and retry once
      token = await getGuestSessionToken(true);
    }
  }
  return null;
}

export async function generateOutfitImage(
  outfitDescription: string,
  occasion: string,
  t?: TranslateFn,
): Promise<OutfitImageResult> {
  const { styleRule, explanation, styleRuleKey, explanationKey } = getStyleRuleForOccasion(occasion, t);

  let imageUrl: string | null = null;
  try {
    const authToken = await apiService.getToken().catch(() => null);
    if (authToken) {
      const result = await apiService.generateOutfitImage(outfitDescription, occasion);
      imageUrl = result.imageUrl || null;
    } else {
      // Pre-signup users can't call the paid endpoint — use the capped guest route
      imageUrl = await generateGuestOutfitImage(outfitDescription, occasion);
    }
  } catch (error) {
    console.log('Image generation failed, using fallback:', error);
  }

  return {
    imageUrl,
    styleRule,
    explanation,
    styleRuleKey,
    explanationKey,
  };
}

/** English source map for i18n merge scripts */
export const STYLE_RULE_I18N_EN = { ...STYLE_RULE_EN, ...STYLE_TIP_EN };

import { Gender, StylistPreferences } from '@/contexts/AuthContext';

export interface PersonalStylist {
  id: string;
  name: string;
  gender: 'female' | 'male';
  icon: 'star' | 'zap' | 'target' | 'compass' | 'heart';
  color: string;
  greeting: string[];
  signOffs: string[];
  personality: string;
  specialty: string;
  tagline: string;
}

export const STYLIST_LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Japanese',
  'Korean',
  'Chinese',
  'Arabic',
  'Hindi',
  'Dutch',
  'Russian',
  'Swedish',
] as const;

export const STYLIST_ACCENTS = [
  'American',
  'British',
] as const;

// Non-English languages only show their native standard accent
// English has American and British accent options
export const LANGUAGE_ACCENT_MAP: Record<string, readonly string[]> = {
  'English': ['American', 'British'],
  'Spanish': ['Standard Spanish'],
  'French': ['Standard French'],
  'German': ['Standard German'],
  'Italian': ['Standard Italian'],
  'Portuguese': ['Standard Portuguese'],
  'Japanese': ['Standard Japanese'],
  'Korean': ['Standard Korean'],
  'Chinese': ['Standard Mandarin'],
  'Arabic': ['Modern Standard Arabic'],
  'Hindi': ['Standard Hindi'],
  'Dutch': ['Standard Dutch'],
  'Russian': ['Standard Russian'],
  'Swedish': ['Standard Swedish'],
} as const;

export function getAccentsForLanguage(language: string): readonly string[] {
  return LANGUAGE_ACCENT_MAP[language] || STYLIST_ACCENTS;
}

export const RUBY_VOICE_PITCHES = ['mezzo-soprano'] as const;
export const MAX_VOICE_RANGES = ['baritone'] as const;
export const VOICE_PITCHES = ['mezzo-soprano', 'baritone'] as const;

export const ACE_VOICE_RANGES = ['baritone'] as const;
export const IVY_VOICE_PITCHES = ['mezzo-soprano'] as const;

export function getVoiceOptionsForStylist(stylistId: string): readonly string[] {
  if (stylistId === 'max') {
    return MAX_VOICE_RANGES;
  }
  if (stylistId === 'ace') {
    return ACE_VOICE_RANGES;
  }
  if (stylistId === 'ivy') {
    return IVY_VOICE_PITCHES;
  }
  return RUBY_VOICE_PITCHES;
}

export function getDefaultVoiceForStylist(stylistId: string): string {
  if (stylistId === 'max') {
    return 'baritone';
  }
  if (stylistId === 'ace') {
    return 'baritone';
  }
  if (stylistId === 'ivy') {
    return 'mezzo-soprano';
  }
  return 'mezzo-soprano';
}

export const STYLISTS: Record<string, PersonalStylist> = {
  ruby: {
    id: 'ruby',
    name: 'Ruby',
    gender: 'female',
    icon: 'heart',
    color: '#E91E63',
    greeting: [
      "Hello {name}! I'm Ruby, your personal stylist — delighted to meet you. What brings you here today?",
      "Hey {name}! Ruby here. Helping you look fabulous is what I'm about. What are we styling for?",
      "Welcome {name}! I'm Ruby, your style companion. Tell me what's on your mind today.",
      "Hi there {name}! I'm Ruby — fashion is about expressing who you are, and I'm here for that. What would you like to work on?",
      "Hello {name}! Ruby here. I believe everyone deserves to feel confident — what's the occasion?",
    ],
    signOffs: [
      "You've absolutely got this, {name}! I believe in you.",
      "Go out there and shine, beautiful!",
      "Own every moment - you look incredible!",
      "You're going to turn heads, I just know it!",
      "Have the most wonderful time, darling!",
      "Remember, confidence is your best accessory!",
    ],
    personality: 'genuinely warm, deeply empathetic, elegantly charming, and thoughtfully encouraging',
    specialty: 'elegant styling with a modern twist that celebrates individual beauty',
    tagline: 'Making you shine, one outfit at a time',
  },
  max: {
    id: 'max',
    name: 'Max',
    gender: 'male',
    icon: 'zap',
    color: '#2196F3',
    greeting: [
      "Hey {name}! I'm Max, your personal stylist — glad you're here. What's on your mind today?",
      "What's up {name}! Max here. Style is about feeling good in what you wear — what are we working on?",
      "Hey {name}! I'm Max, your style partner. What brings you here today?",
      "Hey there {name}! Max here. Special occasion or everyday style — I've got your back. What would you like to work on?",
      "Hi {name}! I'm Max. Everyone has their own vibe — what's the plan?",
    ],
    signOffs: [
      "You've got this, {name}! Go make it happen.",
      "Looking sharp - go own the day!",
      "That's a great look on you, enjoy it!",
      "You're all set - have a fantastic time!",
      "Go out there with confidence, you've earned it!",
      "Remember, style is about how you feel. And you should feel great!",
    ],
    personality: 'genuinely supportive, approachable, confidently charming, and thoughtfully helpful',
    specialty: 'effortlessly cool looks that bring out individual personality',
    tagline: 'Elevating your style, keeping it real',
  },
  ace: {
    id: 'ace',
    name: 'Ace',
    gender: 'male',
    icon: 'target',
    color: '#0D0B09',
    greeting: [
      "{name}. Ace here. Let's skip the small talk - what are we styling?",
      "Hey {name}. Ace. Tell me the occasion and I'll tell you what to wear.",
      "{name}, Ace here. I don't do fluff. What do you need?",
      "Right, {name}. Ace. What's the situation?",
      "{name}. Let's get to it. What are we working with?",
    ],
    signOffs: [
      "That's the one. Wear it.",
      "Done. You're sorted.",
      "Trust me. This works.",
      "That's your answer. Go.",
      "Nailed it. You're good.",
      "This is it. No second-guessing.",
    ],
    personality: 'direct, no-nonsense, straight-talking, and decisively confident',
    specialty: 'cutting through the noise to give you the answer, not options',
    tagline: 'No fluff. Just answers.',
  },
  ivy: {
    id: 'ivy',
    name: 'Ivy',
    gender: 'female',
    icon: 'compass',
    color: '#059669',
    greeting: [
      "{name}. Ivy. What's the occasion?",
      "Hey {name}. Ivy here. Skip the preamble - what do you need?",
      "{name}, Ivy. Let's get straight to it. What are we deciding?",
      "Right, {name}. What's the situation? I'll give you a straight answer.",
      "{name}. Tell me what you're styling for and I'll tell you what works.",
    ],
    signOffs: [
      "That's it. Wear it with confidence.",
      "Done. Stop overthinking.",
      "This works. Trust it.",
      "You've got your answer. Go.",
      "Sorted. Next.",
      "That's the look. Own it.",
    ],
    personality: 'direct, blunt, straight-talking, and decisively honest',
    specialty: 'giving you the honest truth without the sugar-coating',
    tagline: 'Straight talk. Real style.',
  },
};

export function getStylistForUser(userGender: Gender, stylistPreferences?: StylistPreferences): PersonalStylist {
  if (stylistPreferences?.selectedStylistId) {
    const selectedStylist = STYLISTS[stylistPreferences.selectedStylistId];
    if (selectedStylist) {
      return selectedStylist;
    }
  }
  if (userGender === 'man') {
    return STYLISTS.max;
  }
  return STYLISTS.ruby;
}

export type StylistGreetingWardrobe = {
  totalOwned: number;
  tops: number;
  bottoms: number;
  shoes: number;
};

function tx(t: ((key: string) => string) | undefined, key: string, fallback: string): string {
  const value = t?.(key);
  return value && value.trim() && value !== key ? value : fallback;
}

function formatGapsList(parts: string[], andWord = 'and'): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} ${andWord} ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, ${andWord} ${parts[parts.length - 1]}`;
}

/** Honest, wardrobe-aware first message — never invents a wardrobe that isn't there. */
export function getStylistGreeting(
  stylist: PersonalStylist,
  userName?: string | null,
  t?: (key: string) => string,
  wardrobe?: StylistGreetingWardrobe | null,
): string {
  const displayName =
    userName || (t ? t('aiStylist.welcomeNameFallback') : null) || 'there';
  const direct = stylist.id === 'ace' || stylist.id === 'ivy';
  const warm = stylist.id === 'ruby' || stylist.id === 'max';

  const owned = wardrobe?.totalOwned ?? null;
  const tops = wardrobe?.tops ?? 0;
  const bottoms = wardrobe?.bottoms ?? 0;
  const shoes = wardrobe?.shoes ?? 0;
  const canPlan =
    owned != null &&
    tops >= 3 &&
    bottoms >= 3 &&
    shoes >= 3;

  const apply = (template: string) =>
    template
      .replace(/\{name\}/g, displayName)
      .replace(/\{stylist\}/g, stylist.name)
      .replace(/\{count\}/g, String(owned ?? 0))
      .replace(/\{tops\}/g, String(tops))
      .replace(/\{bottoms\}/g, String(bottoms))
      .replace(/\{shoes\}/g, String(shoes));

  // Unknown wardrobe state (still loading) — stay neutral, no inventing.
  if (owned == null) {
    const neutrals = direct
      ? [
          "{name}. {stylist} here. What are we styling for?",
          "Hey {name}. {stylist}. Tell me what you need.",
        ]
      : [
          "Hello {name}! I'm {stylist}, your personal stylist. What brings you here today?",
          "Hey {name}! I'm {stylist} — ready when you are. What would you like to work on?",
        ];
    const localized = tx(t, 'aiStylist.welcomeNeutral', neutrals[0]);
    return apply(localized);
  }

  if (owned === 0) {
    const emptyFallback = direct
      ? "{name}. {stylist} here. Your wardrobe is empty — 0 pieces. I can't build outfits from nothing. Add at least 3 tops, 3 bottoms, and 3 pairs of shoes, then we can get to work. Want to start in Wardrobe?"
      : "Hello {name}! I'm {stylist}, your personal stylist. I checked your wardrobe — it's empty right now (0 pieces). That means I can't plan real outfits yet. Add at least 3 tops, 3 bottoms, and 3 pairs of shoes and I'll style from what you actually own. Shall we start there?";
    return apply(tx(t, direct ? 'aiStylist.welcomeEmptyDirect' : 'aiStylist.welcomeEmpty', emptyFallback));
  }

  if (!canPlan) {
    const needTops = Math.max(0, 3 - tops);
    const needBottoms = Math.max(0, 3 - bottoms);
    const needShoes = Math.max(0, 3 - shoes);
    const gaps: string[] = [];
    if (needTops > 0) {
      gaps.push(
        needTops === 1
          ? tx(t, 'aiStylist.gapOneTop', '1 more top')
          : tx(t, 'aiStylist.gapMoreTops', '{n} more tops').replace(/\{n\}/g, String(needTops)),
      );
    }
    if (needBottoms > 0) {
      gaps.push(
        needBottoms === 1
          ? tx(t, 'aiStylist.gapOneBottom', '1 more bottom')
          : tx(t, 'aiStylist.gapMoreBottoms', '{n} more bottoms').replace(/\{n\}/g, String(needBottoms)),
      );
    }
    if (needShoes > 0) {
      gaps.push(
        needShoes === 1
          ? tx(t, 'aiStylist.gapOneShoes', '1 more pair of shoes')
          : tx(t, 'aiStylist.gapMoreShoes', '{n} more pairs of shoes').replace(/\{n\}/g, String(needShoes)),
      );
    }
    const andWord = tx(t, 'aiStylist.gapsJoinAnd', 'and');
    const gapsText = formatGapsList(gaps, andWord);

    const sparseFallback = direct
      ? `{name}. {stylist}. You've got {count} piece${owned === 1 ? '' : 's'} — {tops} top${tops === 1 ? '' : 's'}, {bottoms} bottom${bottoms === 1 ? '' : 's'}, {shoes} pair${shoes === 1 ? '' : 's'} of shoes. That's not enough for solid outfit planning yet. Still need ${gapsText}. Add those and I can work with what you own.`
      : `Hello {name}! I'm {stylist}. I looked at your wardrobe: {count} piece${owned === 1 ? '' : 's'} total — {tops} top${tops === 1 ? '' : 's'}, {bottoms} bottom${bottoms === 1 ? '' : 's'}, and {shoes} pair${shoes === 1 ? '' : 's'} of shoes. With that mix I can't build reliable full outfits yet. Add ${gapsText} (aim for at least 3 of each), and I'll style from your real clothes. What would you like to tackle first?`;

    const key = direct ? 'aiStylist.welcomeSparseDirect' : 'aiStylist.welcomeSparse';
    return apply(tx(t, key, sparseFallback).replace(/\{gaps\}/g, gapsText));
  }

  // Ready wardrobe — only now claim we've explored it productively
  if (warm || !direct) {
    const readyFallback =
      "Hello {name}! I'm {stylist}, your personal stylist. I've been through your wardrobe — {count} pieces, with {tops} tops, {bottoms} bottoms, and {shoes} pairs of shoes — so we've got enough to build real outfits. What brings you here today?";
    return apply(tx(t, 'aiStylist.welcomeReady', readyFallback));
  }

  const readyDirectFallback =
    "{name}. {stylist}. You've got {count} pieces — {tops} tops, {bottoms} bottoms, {shoes} pairs of shoes. Enough to build outfits. What are we styling for?";
  return apply(tx(t, 'aiStylist.welcomeReadyDirect', readyDirectFallback));
}

export function getStylistById(id: string): PersonalStylist | null {
  return STYLISTS[id] || null;
}

export function getAllStylists(): PersonalStylist[] {
  return Object.values(STYLISTS);
}

export function formatStylistMessage(stylist: PersonalStylist, message: string): string {
  return message;
}

export function getStylistSignOff(stylist: PersonalStylist, userName?: string | null): string {
  const signOff = stylist.signOffs[Math.floor(Math.random() * stylist.signOffs.length)];
  const displayName = userName || 'there';
  return signOff.replace(/{name}/g, displayName);
}

export interface SecondOpinionResponse {
  introduction: string;
  votesAligned: string;
  votesSplit: string;
  votesDisagreed: string;
  noVotesYet: string;
  encouragement: string;
}

export function getSecondOpinionResponses(stylist: PersonalStylist, userName?: string | null): SecondOpinionResponse {
  const name = userName || 'there';
  
  const responses: Record<string, SecondOpinionResponse> = {
    ruby: {
      introduction: `${name}, I asked a few people with similar style to yours what they'd choose. Here's what they said...`,
      votesAligned: `See? They agree with me! You've got this, ${name}. Go with my pick confidently.`,
      votesSplit: `Votes were a bit split, but the backup option is slightly safer for your setting — that's what I'd choose for you now.`,
      votesDisagreed: `Interesting! They leaned toward the other option. For your context, I'd trust their instinct here.`,
      noVotesYet: `No votes in yet, but my recommendation stands. Trust me on this one, ${name}!`,
      encouragement: `This doesn't change my recommendation — it just adds reassurance. You've absolutely got this!`,
    },
    max: {
      introduction: `Alright ${name}, I checked in with some people who have similar style. Here's the scoop...`,
      votesAligned: `They're with me on this one! Looking good — go with confidence.`,
      votesSplit: `Votes were close, but the backup option feels slightly safer for your situation. I'd go with that.`,
      votesDisagreed: `Huh, they went the other way. For your setting, I think they've got a point. Go with it.`,
      noVotesYet: `Still waiting on votes, but hey, you can trust my call on this one.`,
      encouragement: `This is just for extra confidence — my pick stands either way. You've got this!`,
    },
    jade: {
      introduction: `${name}. Asked people with similar style. Here's what they said.`,
      votesAligned: `Told you. They agree. Wear it.`,
      votesSplit: `Split votes. Backup option is the move. Done.`,
      votesDisagreed: `They went the other way. Fine — for your context, that's the call.`,
      noVotesYet: `No votes yet. Doesn't matter. My recommendation stands.`,
      encouragement: `This just adds confirmation. Stop second-guessing.`,
    },
    marcus: {
      introduction: `${name}. Got input from people with similar style. The verdict:`,
      votesAligned: `They agree with me. Wear it. Next.`,
      votesSplit: `Votes split. Backup option is safer. That's the call.`,
      votesDisagreed: `They picked the other one. For your setting, I'd trust that. Go.`,
      noVotesYet: `No votes. My call stands. Trust it.`,
      encouragement: `This is backup data. The recommendation? Already made.`,
    },
    ace: {
      introduction: `${name}. Got input from others. Here's the verdict:`,
      votesAligned: `They agree. Wear it.`,
      votesSplit: `Split votes. Backup's safer. Go with that.`,
      votesDisagreed: `They picked the other one. Trust their call on this.`,
      noVotesYet: `No votes. My call stands.`,
      encouragement: `Just extra data. Decision's made.`,
    },
    ivy: {
      introduction: `${name}. Asked around. Here's what came back:`,
      votesAligned: `They agree with me. That's your answer.`,
      votesSplit: `Mixed opinions. Backup option's the safer bet.`,
      votesDisagreed: `They went the other way. For your context, trust that.`,
      noVotesYet: `No votes yet. My recommendation stands.`,
      encouragement: `This is just confirmation. You already have your answer.`,
    },
  };
  
  return responses[stylist.id] || responses.ruby;
}

export function getStylistSecondOpinionCTA(stylist: PersonalStylist): string {
  const ctas: Record<string, string> = {
    ruby: "Want a quick confidence check?",
    max: "Need a second opinion from the crowd?",
    jade: "Want backup? Fine.",
    marcus: "Need confirmation? Here.",
    ace: "Need backup? Here.",
    ivy: "Want a second opinion? Fine.",
  };
  
  return ctas[stylist.id] || "Want a quick second opinion?";
}

export function getStylistRecommendationStyle(stylist: PersonalStylist): {
  primaryLabel: string;
  backupLabel: string;
  confidence: 'high' | 'medium';
} {
  const styles: Record<string, { primaryLabel: string; backupLabel: string; confidence: 'high' | 'medium' }> = {
    ruby: { primaryLabel: "My Pick for You", backupLabel: "Lovely Alternative", confidence: 'medium' },
    max: { primaryLabel: "My Recommendation", backupLabel: "Solid Backup", confidence: 'medium' },
    jade: { primaryLabel: "Wear This", backupLabel: "Or This", confidence: 'high' },
    marcus: { primaryLabel: "The Answer", backupLabel: "Backup", confidence: 'high' },
    ace: { primaryLabel: "The Answer", backupLabel: "Backup", confidence: 'high' },
    ivy: { primaryLabel: "Wear This", backupLabel: "Or This", confidence: 'high' },
  };
  
  return styles[stylist.id] || styles.ruby;
}

export default {
  STYLISTS,
  getStylistForUser,
  getStylistGreeting,
  getStylistById,
  getAllStylists,
  formatStylistMessage,
  getStylistSignOff,
  getSecondOpinionResponses,
  getStylistSecondOpinionCTA,
  getStylistRecommendationStyle,
};

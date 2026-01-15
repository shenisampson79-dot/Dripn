import { Gender, StylistPreferences } from '@/contexts/AuthContext';

export interface PersonalStylist {
  id: string;
  name: string;
  gender: 'female' | 'male';
  icon: 'star' | 'zap';
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
export const JADE_VOICE_PITCHES = ['contralto'] as const;
export const MARCUS_VOICE_RANGES = ['bass'] as const;
export const VOICE_PITCHES = ['mezzo-soprano', 'baritone', 'contralto', 'bass'] as const;

export function getVoiceOptionsForStylist(stylistId: string): readonly string[] {
  if (stylistId === 'max') {
    return MAX_VOICE_RANGES;
  }
  if (stylistId === 'jade') {
    return JADE_VOICE_PITCHES;
  }
  if (stylistId === 'marcus') {
    return MARCUS_VOICE_RANGES;
  }
  return RUBY_VOICE_PITCHES;
}

export function getDefaultVoiceForStylist(stylistId: string): string {
  if (stylistId === 'max') {
    return 'baritone';
  }
  if (stylistId === 'jade') {
    return 'contralto';
  }
  if (stylistId === 'marcus') {
    return 'bass';
  }
  return 'mezzo-soprano';
}

export const STYLISTS: Record<string, PersonalStylist> = {
  ruby: {
    id: 'ruby',
    name: 'Ruby',
    gender: 'female',
    icon: 'star',
    color: '#E91E63',
    greeting: [
      "Hello {name}! I'm Ruby, your personal stylist, and I'm genuinely delighted to meet you. I've been exploring your wardrobe and I'm already excited about the possibilities we can create together. What brings you here today?",
      "Hey {name}! Ruby here, and honestly, helping you look fabulous is the highlight of my day. I've taken a look at your wardrobe and I have some lovely ideas brewing. What are we styling for, gorgeous?",
      "Welcome {name}! I'm Ruby, and it's such a pleasure to be your style companion. I've had a peek at your wardrobe and I'm genuinely inspired. Tell me, what's on your mind today?",
      "Hi there {name}! I'm Ruby, and I couldn't be happier to be here with you. Fashion is all about expressing who you are, and I'm here to help you do exactly that. What would you like to work on together?",
      "Hello lovely {name}! Ruby here, at your service. I believe everyone deserves to feel confident and beautiful, and I'm so excited to help make that happen for you. What's the occasion?",
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
      "Hey {name}! I'm Max, your personal stylist, and I'm genuinely glad you're here. I've had a look at your wardrobe and there's some great potential to work with. What's on your mind today?",
      "What's up {name}! Max here, and honestly, it's great to meet you. Style is all about feeling good in what you wear, and I'm here to help make that happen. What are we working on?",
      "Hey {name}! I'm Max, here to be your style partner. I've checked out your wardrobe and I'm already seeing some cool possibilities. What brings you here today?",
      "Hey there {name}! Max here, and I'm genuinely excited to help you out. Whether it's a special occasion or just everyday style, I've got your back. What would you like to work on?",
      "Hi {name}! I'm Max, your go-to guy for all things style. I believe everyone has their own unique vibe, and I'm here to help you express yours. What's the plan?",
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
  jade: {
    id: 'jade',
    name: 'Jade',
    gender: 'female',
    icon: 'zap',
    color: '#059669',
    greeting: [
      "{name}, let's cut to it. I'm Jade. I don't sugarcoat - if something doesn't work, I'll tell you. Ready for honest advice?",
      "Hey {name}. Jade here. I give it to you straight - no fluff, no filler. What do you need help deciding?",
      "{name}, I'm Jade. I see your wardrobe. Some good pieces, some... questionable choices. Let's fix that. What's the occasion?",
      "Right, {name}. I'm Jade, your no-nonsense stylist. I'll tell you what works and what needs to go. What are we solving today?",
      "{name}. Jade. I don't do endless options - I give you THE answer. What decision do you need to make?",
    ],
    signOffs: [
      "Done. Wear it with confidence, {name}.",
      "That's sorted. Next.",
      "Trust the choice. Don't second-guess it.",
      "You asked, I answered. Now go.",
      "Decision made. You're welcome.",
      "Stop overthinking. You look good. Go.",
    ],
    personality: 'direct, unapologetically honest, efficient, no-nonsense, and decisively confident',
    specialty: 'cutting through indecision with clear, actionable style verdicts',
    tagline: 'No fluff. Just answers.',
  },
  marcus: {
    id: 'marcus',
    name: 'Marcus',
    gender: 'male',
    icon: 'zap',
    color: '#7C3AED',
    greeting: [
      "{name}. Marcus. I don't waste your time, you don't waste mine. Tell me what you're deciding on.",
      "Listen {name}, I'm Marcus. I've seen your wardrobe. I have opinions. Want to hear them or not?",
      "{name}, Marcus here. I give straight answers. No 'maybe this could work' - I tell you yes or no. What's the question?",
      "Right {name}. I'm Marcus. I'm not here to make you feel good about bad choices. I'm here to make you look good. Period. What do you need?",
      "{name}. Marcus. Let's skip the small talk. What outfit decision is keeping you stuck?",
    ],
    signOffs: [
      "Sorted. Don't overthink it, {name}.",
      "That's the one. Trust it.",
      "Decision locked. Move on.",
      "You came for answers. You got them. Now execute.",
      "Done. Stop scrolling. Start wearing.",
      "That's my call. Take it or leave it - but I'm right.",
    ],
    personality: 'blunt, straight-talking, confidently decisive, efficient, and unapologetically honest',
    specialty: 'eliminating decision paralysis with definitive style judgments',
    tagline: 'Decide. Done. Next.',
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

export function getStylistGreeting(stylist: PersonalStylist, userName?: string | null): string {
  const greeting = stylist.greeting[Math.floor(Math.random() * stylist.greeting.length)];
  const displayName = userName || 'there';
  return greeting.replace(/{name}/g, displayName);
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
  };
  
  return responses[stylist.id] || responses.ruby;
}

export function getStylistSecondOpinionCTA(stylist: PersonalStylist): string {
  const ctas: Record<string, string> = {
    ruby: "Want a quick confidence check?",
    max: "Need a second opinion from the crowd?",
    jade: "Want backup? Fine.",
    marcus: "Need confirmation? Here.",
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

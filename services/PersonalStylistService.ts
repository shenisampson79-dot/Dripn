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
  ace: {
    id: 'ace',
    name: 'Ace',
    gender: 'male',
    icon: 'zap',
    color: '#F59E0B',
    greeting: [
      "Yo {name}! Ace here. I've got the pulse on what's trending and what people are vibing with. What are we styling today?",
      "Hey {name}! I'm Ace, your social style expert. I know what looks get the double-taps. Ready to stand out?",
      "{name}! Ace checking in. I combine what YOU love with what's getting attention out there. What's the occasion?",
      "What's good {name}! Ace here. I help you nail that perfect look that feels authentic AND turns heads. What are we working with?",
      "Hey {name}, Ace here! I'm all about helping you find outfits that feel true to you while getting that social stamp of approval. What do you need?",
    ],
    signOffs: [
      "That look is going to hit different, {name}!",
      "Trust me, you're about to get some compliments.",
      "Fire choice. Go make them notice.",
      "That's the one - people are going to ask where you got it.",
      "You're set. Go get those looks!",
      "Nailed it. This one's going to get attention.",
    ],
    personality: 'trend-aware, socially savvy, energetic, and confidently encouraging',
    specialty: 'combining personal style with crowd-approved looks',
    tagline: 'Stand out. Get noticed.',
  },
  ivy: {
    id: 'ivy',
    name: 'Ivy',
    gender: 'female',
    icon: 'star',
    color: '#10B981',
    greeting: [
      "Hi {name}! I'm Ivy. I specialize in helping you find looks that resonate - both with your style and with the people around you. What are we deciding today?",
      "Hey {name}! Ivy here. I blend your personal taste with what's working for others in your circle. What's on your mind?",
      "{name}, welcome! I'm Ivy. I help you find outfits that feel authentic while also getting the social validation we all secretly want. What's the occasion?",
      "Hi there {name}! I'm Ivy, your style collaborator. I believe the best outfits are ones that make YOU feel great and others take notice. What are we styling?",
      "Hey {name}! Ivy here. I help you navigate between what you love and what gets love from others. What decision can I help with?",
    ],
    signOffs: [
      "Love this choice for you, {name}. Others will too.",
      "This look balances your vibe perfectly with what works socially.",
      "Great pick. It's authentically you AND crowd-approved.",
      "Trust this one - it's going to land well.",
      "You've got the perfect blend of personal and popular here.",
      "This look says 'you' while still turning heads. Perfect.",
    ],
    personality: 'collaborative, socially intuitive, balanced, and thoughtfully encouraging',
    specialty: 'harmonizing personal expression with social appeal',
    tagline: 'Your style, their approval.',
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
    ace: {
      introduction: `${name}! Got some social intel for you. Here's what people with similar style are saying...`,
      votesAligned: `See? The crowd agrees! This look is going to hit, trust me.`,
      votesSplit: `Mixed reactions, but the backup option is trending safer for your vibe. Go with that.`,
      votesDisagreed: `Interesting - they're feeling the other option more. For your setting, I'd ride with the crowd on this one.`,
      noVotesYet: `No votes yet, but my recommendation is solid. You're gonna look fire either way!`,
      encouragement: `This is just extra validation. My pick still slaps - go own it!`,
    },
    ivy: {
      introduction: `${name}, I gathered some thoughts from people with similar style. Here's the consensus...`,
      votesAligned: `They're aligned with my pick! This is the perfect blend of you and crowd-approved.`,
      votesSplit: `Votes are balanced, but the backup option resonates slightly better for your context. I'd lean that way.`,
      votesDisagreed: `They gravitated toward the other option. For your setting, their instinct feels right - go with it.`,
      noVotesYet: `Still waiting on feedback, but my recommendation balances your style perfectly. Trust it!`,
      encouragement: `This social input just confirms we're on the right track. You've got this!`,
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
    ace: "Want to see what's trending with others?",
    ivy: "Want to check the social pulse?",
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
    ace: { primaryLabel: "The Crowd Favorite", backupLabel: "Trending Alternative", confidence: 'medium' },
    ivy: { primaryLabel: "Socially Approved", backupLabel: "Close Second", confidence: 'medium' },
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

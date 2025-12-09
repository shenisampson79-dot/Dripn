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
  'Australian',
  'Irish',
  'Scottish',
  'Canadian',
  'South African',
  'Indian',
  'Caribbean',
  'New Zealand',
] as const;

export const RUBY_VOICE_PITCHES = ['soprano', 'mezzo-soprano', 'contralto'] as const;
export const MAX_VOICE_RANGES = ['tenor', 'baritone', 'bass'] as const;
export const VOICE_PITCHES = ['soprano', 'mezzo-soprano', 'contralto', 'tenor', 'baritone', 'bass'] as const;

export function getVoiceOptionsForStylist(stylistId: string): readonly string[] {
  if (stylistId === 'max') {
    return MAX_VOICE_RANGES;
  }
  return RUBY_VOICE_PITCHES;
}

export function getDefaultVoiceForStylist(stylistId: string): string {
  if (stylistId === 'max') {
    return 'baritone';
  }
  return 'contralto';
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

export default {
  STYLISTS,
  getStylistForUser,
  getStylistGreeting,
  getStylistById,
  getAllStylists,
  formatStylistMessage,
  getStylistSignOff,
};

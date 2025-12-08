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
      "Hello {name}! I'm Ruby, your personal stylist. I've been looking through your wardrobe and I'm so excited to help you create stunning outfits. What's the occasion today?",
      "Hey {name}! Ruby here, ready to make you look absolutely fabulous. I've got your wardrobe sorted - what are we styling for?",
      "Welcome {name}! I'm Ruby, and I'm here to help you shine. I've analyzed your wardrobe and I'm bursting with ideas. Tell me, what's on your agenda?",
    ],
    signOffs: [
      "You've got this, {name}!",
      "Go shine bright!",
      "Own it, you look amazing!",
      "Slay the day!",
    ],
    personality: 'warm, encouraging, and fashion-forward',
    specialty: 'elegant styling with a modern twist',
    tagline: 'Making you shine, one outfit at a time',
  },
  max: {
    id: 'max',
    name: 'Max',
    gender: 'male',
    icon: 'zap',
    color: '#2196F3',
    greeting: [
      "Hey {name}! I'm Max, your personal stylist. I've checked out your wardrobe and I'm ready to put together some killer looks. What's the plan today?",
      "What's up {name}! Max here, your go-to guy for style. I've got your wardrobe covered - let's create something awesome. What are we dressing for?",
      "Hey {name}! I'm Max, here to level up your style game. I've scoped out your wardrobe and I've got some great ideas. What's the occasion?",
    ],
    signOffs: [
      "Looking good, {name}!",
      "You're all set, go crush it!",
      "That's a solid look, own it!",
      "You're good to go!",
    ],
    personality: 'confident, straightforward, and trend-savvy',
    specialty: 'effortlessly cool looks with attention to detail',
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

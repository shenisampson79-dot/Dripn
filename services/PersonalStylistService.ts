import { Gender } from '@/contexts/AuthContext';

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

export const STYLISTS: Record<string, PersonalStylist> = {
  ruby: {
    id: 'ruby',
    name: 'Ruby',
    gender: 'female',
    icon: 'star',
    color: '#E91E63',
    greeting: [
      "Hello darling! I'm Ruby, your personal stylist. I've been looking through your wardrobe and I'm so excited to help you create stunning outfits. What's the occasion today?",
      "Hey there gorgeous! Ruby here, ready to make you look absolutely fabulous. I've got your wardrobe sorted - what are we styling for?",
      "Welcome love! I'm Ruby, and I'm here to help you shine. I've analyzed your wardrobe and I'm bursting with ideas. Tell me, what's on your agenda?",
    ],
    signOffs: [
      "You've got this, darling!",
      "Go shine bright, gorgeous!",
      "Own it, you look amazing!",
      "Slay the day, love!",
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
      "Hey! I'm Max, your personal stylist. I've checked out your wardrobe and I'm ready to put together some killer looks. What's the plan today?",
      "What's up! Max here, your go-to guy for style. I've got your wardrobe covered - let's create something awesome. What are we dressing for?",
      "Hey mate! I'm Max, here to level up your style game. I've scoped out your wardrobe and I've got some great ideas. What's the occasion?",
    ],
    signOffs: [
      "Looking good, mate!",
      "You're all set, go crush it!",
      "That's a solid look, own it!",
      "You're good to go, legend!",
    ],
    personality: 'confident, straightforward, and trend-savvy',
    specialty: 'effortlessly cool looks with attention to detail',
    tagline: 'Elevating your style, keeping it real',
  },
};

export function getStylistForUser(userGender: Gender): PersonalStylist {
  if (userGender === 'man') {
    return STYLISTS.max;
  }
  return STYLISTS.ruby;
}

export function getStylistGreeting(stylist: PersonalStylist): string {
  return stylist.greeting[Math.floor(Math.random() * stylist.greeting.length)];
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

export function getStylistSignOff(stylist: PersonalStylist): string {
  return stylist.signOffs[Math.floor(Math.random() * stylist.signOffs.length)];
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

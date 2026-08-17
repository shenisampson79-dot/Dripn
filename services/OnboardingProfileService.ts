import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from './ApiService';
import { onboardingSessionService } from './OnboardingSessionService';

export type StyleIdentity =
  | 'never_learned'
  | 'level_up'
  | 'starting_zero'
  | 'impress_someone';

export type DressFor =
  | 'work'
  | 'date'
  | 'friends'
  | 'myself'
  | 'event';

/** How formal the user's workplace expects them to dress. */
export type WorkDressCode =
  | 'creative'
  | 'smart_casual'
  | 'business_casual'
  | 'business_formal';

export const WORK_DRESS_CODE_OPTIONS: Array<{ id: WorkDressCode; label: string; description: string }> = [
  {
    id: 'creative',
    label: 'Creative / casual',
    description: 'Art, media, startups — boots and relaxed pieces are fine',
  },
  {
    id: 'smart_casual',
    label: 'Smart casual',
    description: 'Neat but not corporate — chinos, knitwear, clean shoes',
  },
  {
    id: 'business_casual',
    label: 'Business casual',
    description: 'Office-ready — collared shirts, tailored trousers, smart shoes',
  },
  {
    id: 'business_formal',
    label: 'Business formal',
    description: 'Suits, ties, oxfords / loafers / Chelsea boots',
  },
];

export function normalizeWorkDressCode(value: unknown): WorkDressCode | null {
  if (
    value === 'creative'
    || value === 'smart_casual'
    || value === 'business_casual'
    || value === 'business_formal'
  ) {
    return value;
  }
  return null;
}

export function getWorkDressCodeLabel(code: WorkDressCode | null | undefined): string {
  if (!code) return 'Not set';
  return WORK_DRESS_CODE_OPTIONS.find((o) => o.id === code)?.label || code;
}

export type WorkAttireAskArgs = {
  selectedContexts?: string[];
  occasionType?: string;
  context?: string;
  eventDressCode?: string;
  eventType?: string;
  eventDetails?: { eventType?: string; dressCode?: string } | null;
};

const EXPLICIT_OCCASION_DRESS_OVERRIDE = new Set([
  'black_tie',
  'white_tie',
  'cocktail',
  'formal',
  'casual',
  'smart_casual',
]);

function eventDressAndType(args: WorkAttireAskArgs = {}) {
  const dress = String(args.eventDetails?.dressCode || args.eventDressCode || '')
    .toLowerCase()
    .replace(/[-\s]+/g, '_');
  const type = String(args.eventDetails?.eventType || args.eventType || '')
    .toLowerCase()
    .replace(/[-\s]+/g, '_');
  return { dress, type };
}

export function looksLikeWorkAttireAsk(args: WorkAttireAskArgs = {}): boolean {
  const chips = (args.selectedContexts || []).join(' ');
  const { dress, type } = eventDressAndType(args);
  const blob = `${chips} ${args.occasionType || ''} ${args.context || ''} ${dress} ${type}`.toLowerCase();
  return /work[-_ ]?appropriate|work_outfit|work-appropriate/.test(blob)
    || dress === 'business'
    || type === 'business'
    || type === 'interview'
    || args.occasionType === 'work_outfit'
    || /\bwork outfit\b/.test(blob);
}

/**
 * Explicit event/request dress code beats everyday workplace Settings.
 * QSC Formal + Work-appropriate is not an override.
 */
export function hasExplicitOccasionDressOverride(args: WorkAttireAskArgs = {}): boolean {
  const { dress, type } = eventDressAndType(args);
  const blob = `${args.context || ''} ${type} ${args.eventDetails?.dressCode || args.eventDressCode || ''}`.toLowerCase();
  if (/\b(black[\s_-]?tie|white[\s_-]?tie|cocktail|gala)\b/.test(blob)) return true;
  if (!dress) return false;
  if (dress === 'business' || dress === 'business_casual' || dress === 'business_formal') return false;
  return EXPLICIT_OCCASION_DRESS_OVERRIDE.has(dress);
}

/** Settings/onboarding code only when this is a work ask with no explicit occasion override. */
export function workDressCodeForAsk(
  code: unknown,
  askArgs: WorkAttireAskArgs = {},
): WorkDressCode | null {
  if (hasExplicitOccasionDressOverride(askArgs)) return null;
  if (!looksLikeWorkAttireAsk(askArgs)) return null;
  return normalizeWorkDressCode(code);
}

export function workDressCodeInstruction(code: WorkDressCode | null | undefined): string {
  const label = getWorkDressCodeLabel(code);
  if (!code || label === 'Not set') return '';
  return `Workplace dress code from Settings: ${label}. For work / office / work-appropriate looks, judge against this code — not a generic office default.`;
}

export async function resolveStoredWorkDressCode(): Promise<WorkDressCode | null> {
  try {
    const { getTodaysOutfitPopupPrefs } = await import('@/utils/todaysOutfitPrefs');
    const prefs = await getTodaysOutfitPopupPrefs();
    if (prefs.workDressCode) return prefs.workDressCode;
  } catch {
    /* fall through */
  }
  try {
    const profile = await onboardingProfileService.getProfile();
    return normalizeWorkDressCode(profile.workDressCode);
  } catch {
    return null;
  }
}

export type QuizGender = 'female' | 'male';

export interface QuizLike {
  outfitId: string;
  name: string;
  style: string;
  dressFor: DressFor;
}

export interface OnboardingProfile {
  identity?: StyleIdentity;
  dressFor?: DressFor;
  /** Workplace formality — used for weekday work looks / footwear. */
  workDressCode?: WorkDressCode | null;
  quizGender?: QuizGender;
  /** Unique style labels from current quiz session likes */
  likedStyles?: string[];
  /** Full record of this quiz session — source of truth for completion copy */
  quizLikes?: QuizLike[];
  quizComplete?: boolean;
}

export interface TodaysOutfit {
  outfit: string;
  reasoning: string;
  whyRule?: string;
  dateKey: string;
  dressFor?: DressFor;
  weatherTemp?: number;
  weatherCondition?: string;
  weatherLocation?: string;
  dayLabel?: string;
  occasionLabel?: string;
}

const PROFILE_KEY = '@dripn_onboarding_profile';
const TODAYS_OUTFIT_KEY = '@dripn_todays_outfit';

export const DRESS_FOR_LABELS: Record<DressFor, string> = {
  work: 'work / meetings',
  date: 'a date or romance',
  friends: 'going out with friends',
  event: 'an event or special occasion',
  myself: 'yourself today',
};

export const DRESS_FOR_TO_OCCASION: Record<DressFor, string> = {
  work: 'work',
  date: 'date',
  friends: 'casual',
  event: 'event',
  myself: 'casual',
};

export const QUIZ_SCREEN_COPY: Record<DressFor, { title: string; subtitle: string }> = {
  work: {
    title: 'Which work look feels like you?',
    subtitle: 'Office-ready styles only — swipe to teach your stylist your professional vibe.',
  },
  date: {
    title: 'Which date-night look is you?',
    subtitle: 'Romantic and polished picks — no random athleisure here.',
  },
  friends: {
    title: 'What would you wear out with friends?',
    subtitle: 'Going-out energy only — help us nail your social style.',
  },
  event: {
    title: 'What kind of event look is you?',
    subtitle: 'Gala, theatre, wedding, festival — swipe across the full range of occasions.',
  },
  myself: {
    title: 'What feels good for you today?',
    subtitle: 'Comfort-first everyday looks — your off-duty style in seconds.',
  },
};

function dateKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

class OnboardingProfileService {
  async getProfile(): Promise<OnboardingProfile> {
    try {
      const raw = await AsyncStorage.getItem(PROFILE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  async saveProfile(partial: OnboardingProfile): Promise<OnboardingProfile> {
    const current = await this.getProfile();
    const next = { ...current, ...partial };
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    void this.syncToBackend(next);
    return next;
  }

  async syncToBackend(profile?: OnboardingProfile): Promise<void> {
    const payload = profile || (await this.getProfile());
    try {
      const token = await apiService.getToken();
      if (token) {
        const existing = await apiService.fetchProfileFromBackend();
        await apiService.syncProfile({
          ...(existing || {}),
          onboardingProfile: payload,
          hasCompletedQuiz: payload.quizComplete ?? existing?.hasCompletedQuiz,
        });
        return;
      }
      const deviceId = await onboardingSessionService.getDeviceId();
      await apiService.post('/api/onboarding/guest-profile', {
        deviceId,
        profile: payload,
      });
    } catch {
      // Offline or pre-release backend — local profile still works
    }
  }

  getDressForLabel(dressFor?: DressFor): string {
    if (!dressFor) return '';
    return DRESS_FOR_LABELS[dressFor] || dressFor;
  }

  hasOccasionAnswered(profile?: OnboardingProfile): boolean {
    const p = profile;
    return !!(p?.dressFor);
  }

  async beginQuizSession(): Promise<OnboardingProfile> {
    const profile = await this.getProfile();
    return this.saveProfile({
      quizLikes: [],
      likedStyles: [],
      quizComplete: false,
      dressFor: profile.dressFor,
    });
  }

  getSessionQuizLikes(profile?: OnboardingProfile): QuizLike[] {
    const p = profile;
    if (!p?.quizLikes?.length) return [];
    if (!p.dressFor) return p.quizLikes;
    return p.quizLikes.filter((like) => like.dressFor === p.dressFor);
  }

  async recordQuizSwipe(
    liked: boolean,
    outfit: { id: string; name: string; style: string },
    dressFor: DressFor,
  ): Promise<void> {
    const profile = await this.getProfile();
    const quizLikes = [...(profile.quizLikes || [])];
    if (liked) {
      quizLikes.push({
        outfitId: outfit.id,
        name: outfit.name,
        style: outfit.style,
        dressFor,
      });
    }
    const likedStyles = [...new Set(quizLikes.map((entry) => entry.style))];
    await this.saveProfile({ quizLikes, likedStyles, quizComplete: false });
  }

  async completeQuiz(): Promise<OnboardingProfile> {
    // Wardrobe-based Today's Outfit is generated on the Stylist hub from real items.
    return this.saveProfile({ quizComplete: true });
  }

  async refreshTodaysOutfit(
    _profile?: OnboardingProfile,
    _userContext?: import('@/services/TodaysOutfitGenerator').OutfitUserContext,
  ): Promise<import('@/services/OnboardingProfileService').TodaysOutfit> {
    // Legacy text templates removed — wardrobe curation lives in TodaysOutfitGenerator.
    const empty = {
      outfit: '',
      reasoning: '',
      dateKey: dateKey(),
    };
    await AsyncStorage.removeItem(TODAYS_OUTFIT_KEY);
    return empty;
  }

  /** Keep onboarding quizGender aligned with the signed-in profile gender. */
  async syncQuizGenderFromUserGender(userGender?: string | null): Promise<OnboardingProfile> {
    const quizGender: QuizGender | undefined =
      userGender === 'man' || userGender === 'male'
        ? 'male'
        : userGender === 'woman' || userGender === 'female'
          ? 'female'
          : undefined;
    if (!quizGender) return this.getProfile();
    const current = await this.getProfile();
    if (current.quizGender === quizGender) return current;
    return this.saveProfile({ quizGender });
  }

  async getTodaysOutfit(
    _userContext?: import('@/services/TodaysOutfitGenerator').OutfitUserContext,
  ): Promise<TodaysOutfit | null> {
    // Text "today's outfit" cache is no longer used.
    return null;
  }

  getIdentityLabel(identity?: StyleIdentity): string {
    switch (identity) {
      case 'never_learned':
        return 'We will decide for you — no taste required.';
      case 'level_up':
        return 'Level up without the mental load.';
      case 'starting_zero':
        return 'Starting from zero? We have got you.';
      case 'impress_someone':
        return 'Dress to impress — we handle the details.';
      default:
        return 'Your stylist decides. You look better.';
    }
  }

  getRecommendedStylist(identity?: StyleIdentity): 'ruby' | 'ace' {
    if (identity === 'level_up' || identity === 'impress_someone') return 'ace';
    return 'ruby';
  }
}

export const onboardingProfileService = new OnboardingProfileService();

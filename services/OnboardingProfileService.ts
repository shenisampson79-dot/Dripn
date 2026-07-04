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

const OUTFIT_TEMPLATES: Record<DressFor, { outfit: string; reasoning: string; whyRule: string }[]> = {
  work: [
    {
      outfit: 'Wear tailored trousers, a crisp white shirt, and a structured navy blazer with clean leather shoes.',
      reasoning: 'You will look sharper than most people in the room without overthinking it.',
      whyRule: 'Neutral base + one structured layer reads professional instantly.',
    },
    {
      outfit: 'Wear dark straight-leg jeans, a fitted knit, and a camel coat with white trainers kept clean.',
      reasoning: 'Smart-casual that still looks intentional — perfect when you want to stand out quietly.',
      whyRule: 'Dark denim + polished outerwear elevates casual offices.',
    },
  ],
  date: [
    {
      outfit: 'Wear a fitted top, high-waisted trousers or a simple dress, and one statement accessory. Clean shoes.',
      reasoning: 'You look like you made an effort — without looking like you tried too hard.',
      whyRule: 'One focal point beats a busy outfit on a date.',
    },
    {
      outfit: 'Wear an all-black base with a textured jacket and subtle jewellery. One scent, one watch, done.',
      reasoning: 'Confident and memorable. This is the “best-dressed at the table” formula.',
      whyRule: 'Monochrome + texture reads expensive and deliberate.',
    },
  ],
  friends: [
    {
      outfit: 'Wear relaxed-fit jeans, a quality plain tee, and a lightweight jacket. Clean sneakers.',
      reasoning: 'Casual but put-together — the friend who “always looks good” without fuss.',
      whyRule: 'Fit matters more than logos when you are with people who know you.',
    },
    {
      outfit: 'Wear cargo trousers, a cropped hoodie, and white sneakers. Keep colours to two max.',
      reasoning: 'Current, confident street style that photographs well and feels easy.',
      whyRule: 'Two-colour cap stops casual looks from feeling messy.',
    },
  ],
  myself: [
    {
      outfit: 'Wear soft trousers, a comfortable knit, and slip-on shoes in matching neutrals.',
      reasoning: 'You feel good first — but you still look intentionally styled.',
      whyRule: 'Tone-on-tone neutrals look elevated with zero effort.',
    },
    {
      outfit: 'Wear your best-fitting jeans, a simple top that suits your skin tone, and a jacket you love.',
      reasoning: 'Confidence outfit 101: fit + one piece you already trust.',
      whyRule: 'When in doubt, fit and a familiar jacket win.',
    },
  ],
  event: [
    {
      outfit: 'Wear a midi dress or tailored suit in one solid colour. One standout accessory. Polished shoes.',
      reasoning: 'Event-ready in one decision — you will photograph well and feel prepared.',
      whyRule: 'Solid colour + one accent reads formal without costume energy.',
    },
    {
      outfit: 'Wear a blazer over a simple base, dark trousers, and a belt that matches your shoes.',
      reasoning: 'Works for weddings, dinners, and “I have nothing to wear” panic.',
      whyRule: 'Matching belt and shoes ties the look together instantly.',
    },
  ],
};

function dateKey() {
  return new Date().toISOString().slice(0, 10);
}

function pickTemplate(dressFor: DressFor, likedStyles: string[] = []) {
  const list = OUTFIT_TEMPLATES[dressFor] || OUTFIT_TEMPLATES.myself;
  const street = likedStyles.some((s) => /street|sport|urban/i.test(s));
  const smart = likedStyles.some((s) => /luxury|smart|business|classic/i.test(s));
  if (street && dressFor === 'friends') return list[1] || list[0];
  if (smart && dressFor === 'work') return list[0];
  return list[Math.floor(Math.random() * list.length)];
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
    const profile = await this.saveProfile({ quizComplete: true });
    await this.refreshTodaysOutfit(profile);
    return profile;
  }

  async refreshTodaysOutfit(profile?: OnboardingProfile): Promise<TodaysOutfit> {
    const p = profile || (await this.getProfile());
    const dressFor = p.dressFor || 'myself';
    const template = pickTemplate(dressFor, p.likedStyles);
    const outfit: TodaysOutfit = {
      ...template,
      dateKey: dateKey(),
      dressFor,
    };
    await AsyncStorage.setItem(TODAYS_OUTFIT_KEY, JSON.stringify(outfit));
    return outfit;
  }

  async getTodaysOutfit(): Promise<TodaysOutfit | null> {
    try {
      const raw = await AsyncStorage.getItem(TODAYS_OUTFIT_KEY);
      if (!raw) {
        const profile = await this.getProfile();
        if (profile.dressFor || profile.quizComplete) {
          return this.refreshTodaysOutfit(profile);
        }
        return null;
      }
      const parsed = JSON.parse(raw) as TodaysOutfit;
      if (parsed.dateKey !== dateKey()) {
        return this.refreshTodaysOutfit();
      }
      return parsed;
    } catch {
      return null;
    }
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

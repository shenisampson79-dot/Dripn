import { apiService } from './ApiService';
import { onboardingSessionService } from './OnboardingSessionService';
import type { DressFor, OnboardingProfile } from './OnboardingProfileService';
import {
  DRESS_FOR_LABELS,
  onboardingProfileService,
  QUIZ_SCREEN_COPY,
} from './OnboardingProfileService';
import {
  getPreSignupQuizOutfits,
  getQuizDeckSize,
  orderQuizDeck,
  pickDiverseEventDeck,
  fillUniqueImageDeck,
  type PreSignupQuizOutfit,
  type QuizOutfitGender,
} from '@/constants/preSignupQuizOutfits';
import {
  translateQuizLookName,
  translateQuizStylesList,
  type TranslateFn,
} from '@/utils/quizLookI18n';

export interface QuizDeckConfig {
  title: string;
  subtitle: string;
  outfitIds: string[];
  model?: string;
}

export interface QuizCompletionSummary {
  headline: string;
  summary: string;
  topStyles: string[];
  model?: string;
}

function rankStylesFromLikes(profile: OnboardingProfile): string[] {
  const likes = onboardingProfileService.getSessionQuizLikes(profile);
  const counts = new Map<string, number>();
  for (const like of likes) {
    counts.set(like.style, (counts.get(like.style) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([style]) => style);
}

function buildLocalCompletionSummary(
  profile: OnboardingProfile,
  t?: TranslateFn,
): QuizCompletionSummary {
  const dressFor = profile.dressFor || 'myself';
  const likes = onboardingProfileService.getSessionQuizLikes(profile);
  const topStyles = rankStylesFromLikes(profile);
  const occasionLabel =
    (t && (t(`preSignupQuiz.dressFor.${dressFor}`) || '')) ||
    DRESS_FOR_LABELS[dressFor];
  const likedNames = likes.map((l) =>
    t ? translateQuizLookName(l.outfitId, l.name, t) : l.name,
  );
  const stylesText = t
    ? translateQuizStylesList(topStyles.slice(0, 3), t)
    : topStyles.slice(0, 3).join(' · ');
  const workLeanRaw = topStyles.filter((s) => /business|smart|classic|luxury/i.test(s));
  const workLean = t
    ? translateQuizStylesList(
        (workLeanRaw.length ? workLeanRaw : topStyles.slice(0, 2)),
        t,
      )
    : (workLeanRaw.join(' · ') || topStyles.slice(0, 2).join(' · '));

  const vibeFallback = (t && t('preSignupQuiz.vibeFallback')) || 'We know your vibe';
  const summaryFallback =
    (t && t('preSignupQuiz.summaryFallback')) ||
    "Got it — we'll use your picks to style you.";

  if (!likes.length) {
    return {
      headline: vibeFallback,
      summary: summaryFallback,
      topStyles: [],
    };
  }

  if (dressFor === 'work') {
    const workHeadline =
      (t && t('preSignupQuiz.vibeWorkHeadline')) || 'We know your work style';
    const sharp =
      (t && t('preSignupQuiz.sharpProfessional')) || 'sharp and professional';

    if (likedNames.length) {
      const template =
        (t && t('preSignupQuiz.summaryWorkLiked')) ||
        'For {occasion}, you liked {names} — {styles}. We\'ll dress you that way.';
      return {
        headline: workHeadline,
        summary: template
          .replace('{occasion}', occasionLabel)
          .replace(
            '{names}',
            likedNames.slice(0, 3).join(', ') + (likedNames.length > 3 ? '…' : ''),
          )
          .replace('{styles}', workLean || sharp),
        topStyles: topStyles.slice(0, 3),
      };
    }

    const leanTemplate =
      (t && t('preSignupQuiz.summaryWorkLean')) ||
      'You lean {styles} for the office. We\'ll keep it sharp and intentional.';
    return {
      headline: workHeadline,
      summary: leanTemplate.replace('{styles}', workLean || sharp),
      topStyles: topStyles.slice(0, 3),
    };
  }

  const summaryTemplate =
    (t && t('preSignupQuiz.summaryWithStyles')) ||
    "For {occasion}, you leaned {styles}. We'll use that to style you.";

  return {
    headline: vibeFallback,
    summary: summaryTemplate
      .replace('{occasion}', occasionLabel)
      .replace('{styles}', stylesText),
    topStyles: topStyles.slice(0, 3),
  };
}

class PreSignupQuizService {
  async fetchDeckConfig(profile: OnboardingProfile): Promise<QuizDeckConfig | null> {
    try {
      const deviceId = await onboardingSessionService.getDeviceId();
      const dressFor = profile.dressFor || 'myself';
      const params = new URLSearchParams({
        deviceId,
        dressFor,
        quizGender: profile.quizGender || 'female',
      });
      if (profile.identity) params.set('identity', profile.identity);

      const data = await apiService.get<QuizDeckConfig>(
        `/api/onboarding/style-shuffle-deck?${params.toString()}`
      );
      return data?.outfitIds?.length ? data : null;
    } catch {
      return null;
    }
  }

  async buildDeck(
    gender: QuizOutfitGender,
    profile: OnboardingProfile,
  ): Promise<{ outfits: PreSignupQuizOutfit[]; title: string; subtitle: string }> {
    await onboardingProfileService.beginQuizSession();

    const dressFor: DressFor = profile.dressFor || 'myself';
    const deckSize = getQuizDeckSize(dressFor);
    const filtered = getPreSignupQuizOutfits(gender, dressFor);
    const fallbackCopy = QUIZ_SCREEN_COPY[dressFor];

    const aiConfig = await this.fetchDeckConfig(profile);
    let outfits = orderQuizDeck(
      filtered,
      aiConfig?.outfitIds,
      deckSize,
    );

    if (!aiConfig?.outfitIds?.length && dressFor === 'event') {
      outfits = pickDiverseEventDeck(filtered, deckSize);
    }

    return {
      outfits: outfits.length > 0 ? outfits : (
        dressFor === 'event'
          ? pickDiverseEventDeck(filtered, deckSize)
          : fillUniqueImageDeck(filtered, filtered, deckSize)
      ),
      title: aiConfig?.title || fallbackCopy.title,
      subtitle: aiConfig?.subtitle || fallbackCopy.subtitle,
    };
  }

  async getCompletionSummary(
    profile: OnboardingProfile,
    t?: TranslateFn,
    language?: string,
  ): Promise<QuizCompletionSummary> {
    const sessionLikes = onboardingProfileService.getSessionQuizLikes(profile);
    const fallback = buildLocalCompletionSummary(profile, t);
    const lang = (language || 'en').toLowerCase().slice(0, 2);

    // Prefer client-localized copy for non-English so API English cannot override.
    if (lang !== 'en' && t) {
      return fallback;
    }

    try {
      const deviceId = await onboardingSessionService.getDeviceId();
      const data = await apiService.post<QuizCompletionSummary>(
        '/api/onboarding/quiz-completion',
        {
          deviceId,
          language: lang,
          profile: {
            dressFor: profile.dressFor,
            identity: profile.identity,
            quizGender: profile.quizGender,
          },
          quizLikes: sessionLikes,
        },
      );

      if (data?.summary && data?.headline) {
        return {
          headline: data.headline,
          summary: data.summary,
          topStyles: data.topStyles?.length ? data.topStyles : fallback.topStyles,
          model: data.model,
        };
      }
    } catch {
      // Use local summary
    }

    return fallback;
  }
}

export const preSignupQuizService = new PreSignupQuizService();

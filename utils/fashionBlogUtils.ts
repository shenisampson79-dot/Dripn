import type { UserProfile } from '@/contexts/AuthContext';
import {
  getCurrentCalendarSeason,
  getCurrentFashionYear,
  mapUserGenderToNewsletterFilter,
  type CalendarSeason,
} from '@/utils/fashionSeason';

export interface BlogPost {
  id: string;
  subject: string;
  headline: string;
  previewText: string;
  introduction: string;
  category: string;
  tags: string[];
  publishedAt: string;
  tips: Array<{
    title: string;
    content: string;
    proTip: string;
  }>;
  isEvergreen?: boolean;
  gender?: 'all' | 'women' | 'men';
  season?: CalendarSeason | 'all';
  aiGenerated?: boolean;
  sourcesUsed?: string[];
  researchedAt?: string | null;
}

/** Which calendar seasons each fallback article is relevant for. Omitted = year-round. */
const FALLBACK_CALENDAR_SEASONS: Partial<Record<string, CalendarSeason[]>> = {
  'fallback-10': ['spring', 'autumn'],
  'fallback-12': ['winter'],
};

/** Honest archive dates — not disguised as "yesterday". */
const FALLBACK_ARCHIVE_DATES: Record<string, string> = {
  'fallback-color-guide': '2024-03-12T10:00:00.000Z',
  'fallback-1': '2024-06-18T10:00:00.000Z',
  'fallback-2': '2024-02-08T10:00:00.000Z',
  'fallback-3': '2024-04-22T10:00:00.000Z',
  'fallback-4': '2024-01-15T10:00:00.000Z',
  'fallback-5': '2024-05-30T10:00:00.000Z',
  'fallback-6': '2024-07-14T10:00:00.000Z',
  'fallback-7': '2024-09-03T10:00:00.000Z',
  'fallback-8': '2024-08-19T10:00:00.000Z',
  'fallback-9': '2024-03-28T10:00:00.000Z',
  'fallback-10': '2024-03-05T10:00:00.000Z',
  'fallback-11': '2024-11-11T10:00:00.000Z',
  'fallback-12': '2023-11-20T10:00:00.000Z',
  'fallback-13': '2024-10-07T10:00:00.000Z',
  'fallback-14': '2024-06-25T10:00:00.000Z',
  'fallback-15': '2024-05-12T10:00:00.000Z',
  'fallback-16': '2024-04-01T10:00:00.000Z',
  'fallback-17': '2024-07-28T10:00:00.000Z',
  'fallback-18': '2024-02-20T10:00:00.000Z',
  'fallback-19': '2024-09-16T10:00:00.000Z',
  'fallback-20': '2024-08-05T10:00:00.000Z',
  'fallback-21': '2024-01-28T10:00:00.000Z',
  'fallback-22': '2024-12-02T10:00:00.000Z',
  'fallback-23': '2024-03-18T10:00:00.000Z',
  'fallback-24': '2024-06-08T10:00:00.000Z',
  'fallback-25': '2024-10-22T10:00:00.000Z',
  'fallback-26': '2024-05-04T10:00:00.000Z',
  'fallback-27': '2024-11-25T10:00:00.000Z',
};

export function withCurrentFashionYear(text: string): string {
  const year = String(getCurrentFashionYear());
  return text.replace(/\b20\d{2}\b/g, year);
}

export function applyCurrentYearToBlogPost(post: BlogPost): BlogPost {
  return {
    ...post,
    subject: withCurrentFashionYear(post.subject),
    headline: withCurrentFashionYear(post.headline),
    previewText: withCurrentFashionYear(post.previewText),
    introduction: withCurrentFashionYear(post.introduction),
    tags: post.tags.map((tag) => withCurrentFashionYear(tag)),
    tips: post.tips.map((tip) => ({
      ...tip,
      title: withCurrentFashionYear(tip.title),
      content: withCurrentFashionYear(tip.content),
      proTip: withCurrentFashionYear(tip.proTip),
    })),
  };
}

function sanitizeTrendClaims(post: BlogPost): BlogPost {
  return {
    ...post,
    tips: post.tips.map((tip) => {
      let content = tip.content;
      let title = tip.title;
      if (/pantone.*colour of the year|pantone's colour of the year/i.test(content)) {
        content = content.replace(
          /Pantone's colour of the year is making waves[^.]*\./i,
          'Warm yellow tones are trending on runways this season.',
        );
        content = content.replace(
          /Pantone(?:\'s)? colour of the year[^.]*\./gi,
          'This shade is having a strong moment in current fashion trends.',
        );
      }
      if (title === 'Butter Yellow Everything' && /Pantone/i.test(content)) {
        title = 'Warm Yellow Trend';
      }
      return { ...tip, title, content };
    }),
  };
}

function postMatchesCalendarSeason(post: BlogPost, season: CalendarSeason): boolean {
  const allowed = FALLBACK_CALENDAR_SEASONS[post.id];
  if (!allowed) return true;
  return allowed.includes(season);
}

function postMatchesGender(
  post: BlogPost,
  gender?: 'women' | 'men',
): boolean {
  if (!post.gender || post.gender === 'all') return true;
  if (!gender) return true;
  return post.gender === gender;
}

function postMatchesNewsletterSeason(
  season: string | undefined,
  current: CalendarSeason,
): boolean {
  if (!season || season === 'all') return true;
  return season.toLowerCase() === current;
}

export function filterBlogPostsForProfile(
  posts: BlogPost[],
  user?: UserProfile | null,
  calendarSeason = getCurrentCalendarSeason(),
): BlogPost[] {
  const gender = mapUserGenderToNewsletterFilter(user?.gender);

  return posts.filter((post) => {
    if (!postMatchesCalendarSeason(post, calendarSeason)) return false;
    if (!postMatchesGender(post, gender)) return false;
    if (post.season && !postMatchesNewsletterSeason(post.season, calendarSeason)) return false;
    return true;
  });
}

export function prepareFallbackBlogPosts(rawPosts: BlogPost[]): BlogPost[] {
  return rawPosts.map((post) => {
    const archiveDate = FALLBACK_ARCHIVE_DATES[post.id];
    const prepared: BlogPost = {
      ...sanitizeTrendClaims(post),
      isEvergreen: true,
      publishedAt: archiveDate ?? post.publishedAt,
      gender: post.gender ?? 'all',
      season: post.season ?? 'all',
    };
    return makeEvergreenContentHonest(prepared);
  });
}

/** Remove misleading year-specific claims from static guides with archive dates. */
export function makeEvergreenContentHonest(post: BlogPost): BlogPost {
  if (!post.isEvergreen) return post;

  const written = new Date(post.publishedAt);
  const writtenYear = written.getFullYear();
  const currentYear = getCurrentFashionYear();

  const stripYearClaims = (text: string): string => {
    if (!text) return text;
    let next = text;
    if (writtenYear < currentYear) {
      next = next
        .replace(/\b20\d{2}\s+Fashion Trends\b/gi, 'Fashion Trends')
        .replace(/\bFrom quiet luxury to bold maximalism,\s*20\d{2}\s+is all about/gi, 'From quiet luxury to bold maximalism, style is all about')
        .replace(/\bDripn Weekly:\s*20\d{2}\s+/gi, 'Dripn Weekly: ')
        .replace(/\bfor\s+20\d{2}\b/gi, 'for modern wardrobes')
        .replace(/\bin\s+20\d{2}\b/gi, 'right now');
    }
    return next.replace(/\b20\d{2}-trends\b/gi, 'style-trends');
  };

  return {
    ...post,
    subject: stripYearClaims(post.subject),
    headline: stripYearClaims(post.headline),
    previewText: stripYearClaims(post.previewText),
    introduction: stripYearClaims(post.introduction),
    tags: post.tags.map((tag) => stripYearClaims(tag)),
    tips: post.tips.map((tip) => ({
      ...tip,
      title: stripYearClaims(tip.title),
      content: stripYearClaims(tip.content),
      proTip: stripYearClaims(tip.proTip),
    })),
  };
}

export function formatBlogPostDate(post: BlogPost, dateString: string): string {
  const date = new Date(dateString);
  if (post.isEvergreen) {
    return `Curated guide · written ${date.toLocaleDateString('en-GB', {
      month: 'short',
      year: 'numeric',
    })}`;
  }

  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

import type { BlogPost } from '@/utils/fashionBlogUtils';
import { getBlogPack } from '@/data/content/contentPacks';

export function getFallbackBlogPosts(language?: string | null): BlogPost[] {
  const pack = getBlogPack(language);
  return pack.map((item) => ({
    id: item.id,
    subject: item.subject,
    headline: item.headline,
    previewText: item.previewText,
    introduction: item.introduction,
    category: item.category,
    tags: [...item.tags],
    publishedAt: new Date(
      Date.now() - (item.publishedDaysOffset ?? 0) * 24 * 60 * 60 * 1000,
    ).toISOString(),
    tips: item.tips.map((tip) => ({
      title: tip.title,
      content: tip.content,
      proTip: tip.proTip ?? '',
    })),
  }));
}

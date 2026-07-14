import { FASHION_RULES, type FashionRule } from './fashionRules';
import { getFashionRulesPack } from './content/contentPacks';
import { resolveContentLang } from '@/utils/contentLang';

export function getFashionRules(language?: string | null): FashionRule[] {
  const overlay = getFashionRulesPack(language);
  const lang = resolveContentLang(language);
  if (lang === 'en') return FASHION_RULES;
  return FASHION_RULES.map((rule) => {
    const o = overlay[String(rule.id)];
    if (!o) return rule;
    return {
      ...rule,
      title: o.title,
      content: o.content,
      colorSwatches: rule.colorSwatches?.map((sw) => ({
        ...sw,
        name: o.colorSwatches?.[sw.name] || sw.name,
      })),
    };
  });
}

/**
 * Content pack loaders — long-form copy for all UI languages.
 * JSON packs live under data/content/{fashionRules,weather,blog}/
 */
import type { ContentLang } from '@/utils/contentLang';
import { resolveContentLang } from '@/utils/contentLang';

import fashionEn from '@/data/content/fashionRules/en.json';
import fashionEs from '@/data/content/fashionRules/es.json';
import fashionFr from '@/data/content/fashionRules/fr.json';
import fashionDe from '@/data/content/fashionRules/de.json';
import fashionIt from '@/data/content/fashionRules/it.json';
import fashionPt from '@/data/content/fashionRules/pt.json';
import fashionNl from '@/data/content/fashionRules/nl.json';
import fashionPl from '@/data/content/fashionRules/pl.json';
import fashionRu from '@/data/content/fashionRules/ru.json';
import fashionZh from '@/data/content/fashionRules/zh.json';
import fashionJa from '@/data/content/fashionRules/ja.json';
import fashionKo from '@/data/content/fashionRules/ko.json';
import fashionAr from '@/data/content/fashionRules/ar.json';
import fashionHi from '@/data/content/fashionRules/hi.json';
import fashionTr from '@/data/content/fashionRules/tr.json';
import fashionSv from '@/data/content/fashionRules/sv.json';
import fashionDa from '@/data/content/fashionRules/da.json';
import fashionNo from '@/data/content/fashionRules/no.json';
import fashionFi from '@/data/content/fashionRules/fi.json';

import weatherEn from '@/data/content/weather/en.json';
import weatherEs from '@/data/content/weather/es.json';
import weatherFr from '@/data/content/weather/fr.json';
import weatherDe from '@/data/content/weather/de.json';
import weatherIt from '@/data/content/weather/it.json';
import weatherPt from '@/data/content/weather/pt.json';
import weatherNl from '@/data/content/weather/nl.json';
import weatherPl from '@/data/content/weather/pl.json';
import weatherRu from '@/data/content/weather/ru.json';
import weatherZh from '@/data/content/weather/zh.json';
import weatherJa from '@/data/content/weather/ja.json';
import weatherKo from '@/data/content/weather/ko.json';
import weatherAr from '@/data/content/weather/ar.json';
import weatherHi from '@/data/content/weather/hi.json';
import weatherTr from '@/data/content/weather/tr.json';
import weatherSv from '@/data/content/weather/sv.json';
import weatherDa from '@/data/content/weather/da.json';
import weatherNo from '@/data/content/weather/no.json';
import weatherFi from '@/data/content/weather/fi.json';

import blogEn from '@/data/content/blog/en.json';
import blogEs from '@/data/content/blog/es.json';
import blogFr from '@/data/content/blog/fr.json';
import blogDe from '@/data/content/blog/de.json';
import blogIt from '@/data/content/blog/it.json';
import blogPt from '@/data/content/blog/pt.json';
import blogNl from '@/data/content/blog/nl.json';
import blogPl from '@/data/content/blog/pl.json';
import blogRu from '@/data/content/blog/ru.json';
import blogZh from '@/data/content/blog/zh.json';
import blogJa from '@/data/content/blog/ja.json';
import blogKo from '@/data/content/blog/ko.json';
import blogAr from '@/data/content/blog/ar.json';
import blogHi from '@/data/content/blog/hi.json';
import blogTr from '@/data/content/blog/tr.json';
import blogSv from '@/data/content/blog/sv.json';
import blogDa from '@/data/content/blog/da.json';
import blogNo from '@/data/content/blog/no.json';
import blogFi from '@/data/content/blog/fi.json';

export type FashionRuleOverlayJson = {
  title: string;
  content: string;
  colorSwatches?: Record<string, string>;
};

export type FashionRulesPack = Record<string, FashionRuleOverlayJson>;

export type WeatherPack = typeof weatherEn;

export type BlogPostPackItem = {
  id: string;
  subject: string;
  headline: string;
  previewText: string;
  introduction: string;
  category: string;
  tags: string[];
  publishedDaysOffset?: number;
  tips: Array<{ title: string; content: string; proTip?: string }>;
};

const FASHION_PACKS: Record<ContentLang, FashionRulesPack> = {
  en: fashionEn as FashionRulesPack,
  es: fashionEs as FashionRulesPack,
  fr: fashionFr as FashionRulesPack,
  de: fashionDe as FashionRulesPack,
  it: fashionIt as FashionRulesPack,
  pt: fashionPt as FashionRulesPack,
  nl: fashionNl as FashionRulesPack,
  pl: fashionPl as FashionRulesPack,
  ru: fashionRu as FashionRulesPack,
  zh: fashionZh as FashionRulesPack,
  ja: fashionJa as FashionRulesPack,
  ko: fashionKo as FashionRulesPack,
  ar: fashionAr as FashionRulesPack,
  hi: fashionHi as FashionRulesPack,
  tr: fashionTr as FashionRulesPack,
  sv: fashionSv as FashionRulesPack,
  da: fashionDa as FashionRulesPack,
  no: fashionNo as FashionRulesPack,
  fi: fashionFi as FashionRulesPack,
};

const WEATHER_PACKS: Record<ContentLang, WeatherPack> = {
  en: weatherEn as WeatherPack,
  es: weatherEs as WeatherPack,
  fr: weatherFr as WeatherPack,
  de: weatherDe as WeatherPack,
  it: weatherIt as WeatherPack,
  pt: weatherPt as WeatherPack,
  nl: weatherNl as WeatherPack,
  pl: weatherPl as WeatherPack,
  ru: weatherRu as WeatherPack,
  zh: weatherZh as WeatherPack,
  ja: weatherJa as WeatherPack,
  ko: weatherKo as WeatherPack,
  ar: weatherAr as WeatherPack,
  hi: weatherHi as WeatherPack,
  tr: weatherTr as WeatherPack,
  sv: weatherSv as WeatherPack,
  da: weatherDa as WeatherPack,
  no: weatherNo as WeatherPack,
  fi: weatherFi as WeatherPack,
};

const BLOG_PACKS: Record<ContentLang, BlogPostPackItem[]> = {
  en: blogEn as BlogPostPackItem[],
  es: blogEs as BlogPostPackItem[],
  fr: blogFr as BlogPostPackItem[],
  de: blogDe as BlogPostPackItem[],
  it: blogIt as BlogPostPackItem[],
  pt: blogPt as BlogPostPackItem[],
  nl: blogNl as BlogPostPackItem[],
  pl: blogPl as BlogPostPackItem[],
  ru: blogRu as BlogPostPackItem[],
  zh: blogZh as BlogPostPackItem[],
  ja: blogJa as BlogPostPackItem[],
  ko: blogKo as BlogPostPackItem[],
  ar: blogAr as BlogPostPackItem[],
  hi: blogHi as BlogPostPackItem[],
  tr: blogTr as BlogPostPackItem[],
  sv: blogSv as BlogPostPackItem[],
  da: blogDa as BlogPostPackItem[],
  no: blogNo as BlogPostPackItem[],
  fi: blogFi as BlogPostPackItem[],
};

export function getFashionRulesPack(language?: string | null): FashionRulesPack {
  const lang = resolveContentLang(language);
  return FASHION_PACKS[lang] ?? FASHION_PACKS.en;
}

export function getWeatherPack(language?: string | null): WeatherPack {
  const lang = resolveContentLang(language);
  return WEATHER_PACKS[lang] ?? WEATHER_PACKS.en;
}

export function getBlogPack(language?: string | null): BlogPostPackItem[] {
  const lang = resolveContentLang(language);
  return BLOG_PACKS[lang] ?? BLOG_PACKS.en;
}

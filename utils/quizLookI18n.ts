import {
  quizLookNameKey,
  quizOccasionTagKey,
  quizStyleTagKey,
} from '@/utils/quizI18n';

export type TranslateFn = (key: string) => string;

export function translateQuizStyle(style: string, t: TranslateFn): string {
  return t(quizStyleTagKey(style)) || style;
}

export function translateQuizOccasion(occasion: string, t: TranslateFn): string {
  return t(quizOccasionTagKey(occasion)) || occasion;
}

export function translateQuizLookName(id: string, fallbackName: string, t: TranslateFn): string {
  return t(quizLookNameKey(id)) || fallbackName;
}

export function translateQuizStylesList(styles: string[], t: TranslateFn, joiner = ' · '): string {
  return styles.map((s) => translateQuizStyle(s, t)).filter(Boolean).join(joiner);
}

/** Stable camelCase slug for style/occasion labels used as i18n key suffixes. */
export function quizLabelSlug(label: string): string {
  return label
    .replace(/[\/·|,]+/g, ' ')
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index === 0) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

export function quizLookNameKey(id: string): string {
  return `preSignupQuiz.look.${id}`;
}

export function quizStyleTagKey(style: string): string {
  return `preSignupQuiz.styleTag.${quizLabelSlug(style)}`;
}

export function quizOccasionTagKey(occasion: string): string {
  return `preSignupQuiz.occasionTag.${quizLabelSlug(occasion)}`;
}

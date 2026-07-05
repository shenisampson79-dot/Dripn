/** Default OpenAI models for any client-side API calls (must match server). */
export const DEFAULT_CHAT_MODEL = 'gpt-5.4';
export const DEFAULT_VISION_MODEL = 'gpt-5.4';
export const DEFAULT_FAST_MODEL = 'gpt-5.4-mini';

export const CHAT_MODEL_CANDIDATES = [
  'gpt-5.4',
  'gpt-5.4-2026-03-05',
] as const;

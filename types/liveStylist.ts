import type { ScanSessionItem } from '@/types/scanWardrobe';

export type LiveDetectorSource = 'cloud_vision' | 'on_device' | 'on_device_yolo' | 'stub';

/** Live copy only — never a scoring input. Activate advisory at this floor. */
export const LIVE_LEGWEAR_MIN_CONFIDENCE = 0.80;

export type LiveLegwearType = 'socks' | 'tights' | 'stockings' | 'hosiery' | 'none' | 'unknown';
export type LiveLegwearStyle =
  | 'athletic'
  | 'dress'
  | 'casual'
  | 'sheer'
  | 'opaque'
  | 'patterned'
  | 'unknown';

/** Cloud/Vision optional hosiery read. Absent unless positively identified. */
export type LiveLegwear = {
  type: LiveLegwearType;
  colour?: string | null;
  style?: LiveLegwearStyle;
  confidence: number;
};

export type LiveTrackedItem = ScanSessionItem & {
  trackId: string;
  suggestion?: string | null;
  source?: LiveDetectorSource | string;
  wardrobeMatch?: {
    id: string | number;
    name?: string;
    category?: string;
    color?: string;
    imageUrl?: string | null;
    score?: number;
  } | null;
};

export type LiveCoaching = {
  headline: string;
  summary: string;
  /** Server-authored sentence with garment role tokens; client fills names only. */
  summaryTemplate?: string;
  summaryArchetype?: string;
  summaryTopics?: string[];
  bullets: string[];
  outfitSignature?: string;
  styleLane?: string | null;
  /** False when the server found a formality / style-lane conflict. */
  sameLane?: boolean;
  /**
   * Single conflict flag from the critique builder. Summary, bullets, and
   * suggestions must all honour this — no second interpretation on the client.
   */
  hasConflict?: boolean;
  /** Seasonal layer tip id from the library — used to avoid recent repeats. */
  layerTipId?: string | null;
};

export type LiveFeedbackUi = {
  stable?: boolean;
  holdMs?: number;
  suppressIfIncomplete?: boolean;
};

export type LiveFeedback = {
  /** null while the score is still being corroborated — HUD shows a dash. */
  score: number | null;
  /**
   * high = exact number OK; medium = soften copy while top/layer settles.
   * Does NOT paint ~ — that flag is scoreApproximate (footwear unresolved).
   */
  confidenceLevel?: 'high' | 'medium';
  /**
   * Footwear is not yet a stable answer. HUD prefixes ~ even at high
   * judgment certainty so the first top+bottom score is not a false lock.
   */
  scoreApproximate?: boolean;
  colourHarmony?: string | null;
  issues: string[];
  hints: string[];
  suggestions: string[];
  sceneType?: string;
  lightingQuality?: string;
  itemCount?: number;
  avgConfidence?: number;
  completeness?: 'partial' | 'almost' | 'complete' | string;
  seasonalConsistency?: number;
  seasonalMode?: string;
  tryOnLikely?: boolean;
  layerConflicts?: Array<{ type: string; severity: string; tip?: string }>;
  personalColourApplied?: boolean;
  coaching?: LiveCoaching;
  ui?: LiveFeedbackUi;
  /** Copy-only Vision hosiery/socks. Never fed to the Live score path. */
  legwear?: LiveLegwear | null;
};

export type LiveShopHint = {
  role?: string;
  label?: string;
  name?: string;
  reason?: string;
  products?: Array<{ retailerId?: string; retailer?: string; url?: string; searchUrl?: string }>;
  retail?: Record<string, unknown>;
};

export type LiveFrameResponse = {
  success: boolean;
  frameHash?: string | null;
  source?: LiveDetectorSource | string;
  sceneType?: string;
  itemCount?: number;
  items: LiveTrackedItem[];
  feedback: LiveFeedback;
  feedbackChanged: boolean;
  shopHints?: LiveShopHint[];
  yoloAvailable?: boolean;
  yoloNote?: string;
  message?: string;
};

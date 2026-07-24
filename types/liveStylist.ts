import type { ScanSessionItem } from '@/types/scanWardrobe';

export type LiveDetectorSource = 'cloud_vision' | 'on_device' | 'on_device_yolo' | 'stub';

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

export type LiveFeedback = {
  score: number;
  colourHarmony?: string | null;
  issues: string[];
  hints: string[];
  suggestions: string[];
  sceneType?: string;
  lightingQuality?: string;
  itemCount?: number;
  avgConfidence?: number;
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

/**
 * Persist Get Outfits Now session until Done or Start again.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { OutfitOccasionId } from '@/constants/outfitOccasions';
import type { ScanOutfitOption, ScanSessionItem, ScanWardrobeStep } from '@/types/scanWardrobe';

const STORAGE_KEY = '@dripn/get_outfits_session_v1';

export type GetOutfitsPersistedSession = {
  version: 1;
  updatedAt: string;
  step: ScanWardrobeStep;
  imageUri: string | null;
  sessionId: string | null;
  sceneType: string;
  scanItems: ScanSessionItem[];
  hybridMerge: boolean;
  selectedOccasion: OutfitOccasionId;
  outfitOptions: ScanOutfitOption[];
  wowMessage: string | null;
};

export async function loadGetOutfitsSession(): Promise<GetOutfitsPersistedSession | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GetOutfitsPersistedSession;
    if (!parsed || parsed.version !== 1) return null;
    // Drop incomplete capture-only sessions older than 24h with no looks.
    const ageMs = Date.now() - new Date(parsed.updatedAt || 0).getTime();
    if (!Number.isFinite(ageMs) || ageMs > 24 * 60 * 60 * 1000) {
      await clearGetOutfitsSession();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Drop huge base64 crops so AsyncStorage can hold looks across navigations. */
function slimScanItems(items: ScanSessionItem[] | undefined): ScanSessionItem[] {
  return (items || []).map((item) => {
    const { sceneCrop: _crop, ...rest } = item as ScanSessionItem & { sceneCrop?: string };
    return rest as ScanSessionItem;
  });
}

function slimOutfitOptions(options: ScanOutfitOption[] | undefined): ScanOutfitOption[] {
  return (options || []).map((opt) => {
    const slimItems = (list?: Array<Record<string, unknown>>) =>
      (list || []).map((it) => {
        const imageUrl = typeof it.imageUrl === 'string' ? it.imageUrl : undefined;
        const keepUrl = imageUrl && !imageUrl.startsWith('data:') ? imageUrl : undefined;
        return {
          ...it,
          imageUrl: keepUrl ?? null,
          imageUri: undefined,
          sceneCrop: undefined,
        };
      });
    return {
      ...opt,
      hydratedItems: slimItems(opt.hydratedItems as Array<Record<string, unknown>> | undefined) as ScanOutfitOption['hydratedItems'],
      outfit: opt.outfit
        ? {
            ...opt.outfit,
            items: slimItems(opt.outfit.items as Array<Record<string, unknown>> | undefined) as NonNullable<
              ScanOutfitOption['outfit']
            >['items'],
          }
        : opt.outfit,
    };
  });
}

export async function saveGetOutfitsSession(
  session: Omit<GetOutfitsPersistedSession, 'version' | 'updatedAt'>,
): Promise<void> {
  try {
    // Don't persist empty capture screens.
    if (
      session.step === 'capture'
      && (!session.scanItems || session.scanItems.length === 0)
      && (!session.outfitOptions || session.outfitOptions.length === 0)
    ) {
      return;
    }
    const payload: GetOutfitsPersistedSession = {
      ...session,
      scanItems: slimScanItems(session.scanItems),
      outfitOptions: slimOutfitOptions(session.outfitOptions),
      version: 1,
      updatedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[GetOutfitsSession] save failed:', err);
  }
}

export async function clearGetOutfitsSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

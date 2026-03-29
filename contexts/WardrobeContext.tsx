/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Proprietary and confidential.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/services/ApiService';

export type ClothingCategory = 
  | 'tops' 
  | 'bottoms' 
  | 'dresses' 
  | 'outerwear' 
  | 'shoes' 
  | 'bags' 
  | 'accessories' 
  | 'activewear_tops'
  | 'activewear_bottoms'
  | 'swimwear'
  | 'sleepwear'
  | 'formal';

export type ClothingColor = 
  | 'black' 
  | 'white' 
  | 'gray' 
  | 'navy' 
  | 'brown' 
  | 'beige' 
  | 'red' 
  | 'pink' 
  | 'orange' 
  | 'yellow' 
  | 'green' 
  | 'blue' 
  | 'purple' 
  | 'denim'
  | 'cream'
  | 'multicolor';

export type ClothingSeason = 'spring' | 'summer' | 'autumn' | 'winter' | 'all-season';

export type ClothingOccasion = 
  | 'casual' 
  | 'work' 
  | 'formal' 
  | 'date-night' 
  | 'workout' 
  | 'vacation' 
  | 'party' 
  | 'everyday';

export type ItemOrigin = 'owned' | 'inspiration' | 'wishlist';

export const ORIGIN_LABELS: Record<ItemOrigin, string> = {
  owned: 'I Own This',
  inspiration: 'Style Inspiration',
  wishlist: 'Wishlist',
};

export interface WardrobeItem {
  id: string;
  userId: string;
  imageUri: string;
  enhancedImageUri?: string;
  originalImageUri?: string;
  imageProcessed?: boolean;
  category: ClothingCategory;
  subcategory?: string;
  color: ClothingColor;
  secondaryColor?: ClothingColor;
  brand?: string;
  name: string;
  seasons: ClothingSeason[];
  occasions: ClothingOccasion[];
  purchasePrice?: number;
  purchaseCurrency?: string;
  originalPrice?: number;
  purchaseDate?: string;
  timesWorn: number;
  lastWorn?: string;
  plannedDate?: string;
  isFavorite: boolean;
  sustainabilityScore?: number;
  notes?: string;
  origin?: ItemOrigin;
  sourceUrl?: string;
  retailer?: string;
  size?: string;
  material?: string;
  aiAnalyzed?: boolean;
  aiTags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SavedOutfit {
  id: string;
  userId: string;
  name: string;
  itemIds: string[];
  occasion?: ClothingOccasion;
  season?: ClothingSeason;
  rating?: number;
  timesWorn: number;
  lastWorn?: string;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OutfitSuggestion {
  id: string;
  itemIds: string[];
  occasion: ClothingOccasion;
  season: ClothingSeason;
  reason: string;
  styleNotes: string;
  matchScore: number;
  generatedAt: string;
}

export type PlannedEventType = 'work' | 'date-night' | 'wedding' | 'casual' | 'party' | 'workout' | 'travel' | 'formal' | 'everyday';

export interface PlannedOutfit {
  id: string;
  userId: string;
  date: string;
  outfitId?: string;
  itemIds: string[];
  eventName?: string;
  eventType?: PlannedEventType;
  notes?: string;
  wasWorn: boolean;
  createdAt: string;
}

export interface WardrobeStats {
  totalItems: number;
  itemsByCategory: Record<ClothingCategory, number>;
  mostWornItems: WardrobeItem[];
  leastWornItems: WardrobeItem[];
  totalOutfits: number;
  averageWearCount: number;
  costPerWear: number;
  sustainabilityScore: number;
}

interface WardrobeContextType {
  items: WardrobeItem[];
  savedOutfits: SavedOutfit[];
  plannedOutfits: PlannedOutfit[];
  suggestions: OutfitSuggestion[];
  stats: WardrobeStats | null;
  isLoading: boolean;
  error: string | null;
  addItem: (item: Omit<WardrobeItem, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'timesWorn'>) => Promise<WardrobeItem>;
  addItemsBatch: (items: Array<Omit<WardrobeItem, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'timesWorn'>>) => Promise<WardrobeItem[]>;
  updateItem: (id: string, updates: Partial<WardrobeItem>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  markItemWorn: (id: string) => Promise<void>;
  toggleItemFavorite: (id: string) => Promise<void>;
  saveOutfit: (outfit: Omit<SavedOutfit, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'timesWorn'>) => Promise<SavedOutfit>;
  deleteOutfit: (id: string) => Promise<void>;
  markOutfitWorn: (id: string) => Promise<void>;
  planOutfit: (plan: Omit<PlannedOutfit, 'id' | 'userId' | 'createdAt' | 'wasWorn'>) => Promise<PlannedOutfit>;
  updatePlannedOutfit: (id: string, updates: { itemIds?: string[]; eventName?: string; eventType?: PlannedEventType; notes?: string }) => Promise<void>;
  deletePlannedOutfit: (id: string) => Promise<void>;
  removeItemFromPlannedOutfit: (outfitId: string, wardrobeItemId: string) => Promise<void>;
  markPlannedOutfitWorn: (id: string) => Promise<void>;
  generateOutfitSuggestions: (occasion?: ClothingOccasion, season?: ClothingSeason) => Promise<OutfitSuggestion[]>;
  getItemsByCategory: (category: ClothingCategory) => WardrobeItem[];
  getItemsByOccasion: (occasion: ClothingOccasion) => WardrobeItem[];
  getItemsBySeason: (season: ClothingSeason) => WardrobeItem[];
  getItemsByOrigin: (origin: ItemOrigin) => WardrobeItem[];
  getOwnedItems: () => WardrobeItem[];
  getInspirationItems: () => WardrobeItem[];
  shuffleOutfit: (occasion?: ClothingOccasion) => OutfitSuggestion | null;
  refreshStats: () => void;
  searchItems: (query: string) => WardrobeItem[];
}

const WardrobeContext = createContext<WardrobeContextType | null>(null);

const WARDROBE_STORAGE_KEY = '@dripn_wardrobe';
const OUTFITS_STORAGE_KEY = '@dripn_outfits';
const PLANNED_STORAGE_KEY = '@dripn_planned_outfits';
const IMAGE_CACHE_KEY = '@dripn_wardrobe_image_cache';

type ImageCache = Record<string, {
  imageUri?: string;
  enhancedImageUri?: string;
  originalImageUri?: string;
  imageProcessed?: boolean;
}>;

export const CATEGORY_LABELS: Record<ClothingCategory, string> = {
  tops: 'Tops',
  bottoms: 'Bottoms',
  dresses: 'Dresses & Jumpsuits',
  outerwear: 'Outerwear',
  shoes: 'Shoes',
  bags: 'Bags',
  accessories: 'Accessories',
  activewear_tops: 'Active Tops',
  activewear_bottoms: 'Active Bottoms',
  swimwear: 'Swimwear',
  sleepwear: 'Sleepwear',
  formal: 'Formal',
};

export const COLOR_LABELS: Record<ClothingColor, string> = {
  black: 'Black',
  white: 'White',
  gray: 'Gray',
  navy: 'Navy',
  brown: 'Brown',
  beige: 'Beige',
  red: 'Red',
  pink: 'Pink',
  orange: 'Orange',
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
  purple: 'Purple',
  denim: 'Denim',
  cream: 'Cream',
  multicolor: 'Multicolor',
};

export const SEASON_LABELS: Record<ClothingSeason, string> = {
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
  'all-season': 'All Season',
};

export const OCCASION_LABELS: Record<ClothingOccasion, string> = {
  casual: 'Casual',
  work: 'Work',
  formal: 'Formal',
  'date-night': 'Date Night',
  workout: 'Workout',
  vacation: 'Vacation',
  party: 'Party',
  everyday: 'Everyday',
};

function mapBackendItemToFrontend(row: any, imageCache: ImageCache): WardrobeItem {
  const meta: Partial<WardrobeItem> = row.metadata || {};
  const imgs = imageCache[row.id] || {};
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name || (meta as any).name || 'Untitled Item',
    category: (() => {
      const rawCat = row.category || (meta as any).category || 'tops';
      if (rawCat === 'activewear') {
        const n = (row.name || '').toLowerCase();
        const topKw = ['jersey', 'singlet', 'vest', 'shirt', 'top', 'hoodie', 'zip', 'bra', 'tank', 'tee', 'pullover', 'sweatshirt'];
        const bottomKw = ['pants', 'shorts', 'joggers', 'leggings', 'sweatpants', 'tights', 'track', 'capri', 'drawstring', 'bottom'];
        if (topKw.some(k => n.includes(k))) return 'activewear_tops';
        if (bottomKw.some(k => n.includes(k))) return 'activewear_bottoms';
        return 'activewear_tops';
      }
      return rawCat;
    })() as ClothingCategory,
    subcategory: row.subcategory || (meta as any).subcategory,
    color: (row.color || (meta as any).color || 'black') as ClothingColor,
    secondaryColor: (meta as any).secondaryColor,
    brand: row.brand || (meta as any).brand,
    seasons: (row.season || (meta as any).seasons || []) as ClothingSeason[],
    occasions: (row.occasions || (meta as any).occasions || []) as ClothingOccasion[],
    origin: (row.item_type || (meta as any).origin || 'owned') as ItemOrigin,
    isFavorite: row.is_favorite ?? (meta as any).isFavorite ?? false,
    timesWorn: row.times_worn ?? (meta as any).timesWorn ?? 0,
    lastWorn: (meta as any).lastWorn,
    plannedDate: (meta as any).plannedDate,
    purchasePrice: (meta as any).purchasePrice,
    purchaseCurrency: (meta as any).purchaseCurrency,
    originalPrice: (meta as any).originalPrice,
    purchaseDate: (meta as any).purchaseDate,
    sustainabilityScore: (meta as any).sustainabilityScore,
    notes: (meta as any).notes,
    sourceUrl: (meta as any).sourceUrl,
    retailer: (meta as any).retailer,
    size: (meta as any).size,
    material: (meta as any).material,
    aiAnalyzed: (meta as any).aiAnalyzed,
    aiTags: (meta as any).aiTags,
    imageUri: imgs.imageUri || (meta as any).imageUri || row.image_url || '',
    enhancedImageUri: imgs.enhancedImageUri || (meta as any).enhancedImageUri,
    originalImageUri: imgs.originalImageUri || (meta as any).originalImageUri || row.image_url,
    imageProcessed: imgs.imageProcessed ?? (meta as any).imageProcessed,
    createdAt: row.created_at || (meta as any).createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || (meta as any).updatedAt || new Date().toISOString(),
  };
}

export function WardrobeProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [plannedOutfits, setPlannedOutfits] = useState<PlannedOutfit[]>([]);
  const [suggestions, setSuggestions] = useState<OutfitSuggestion[]>([]);
  const [stats, setStats] = useState<WardrobeStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const itemsRef = React.useRef<WardrobeItem[]>([]);
  itemsRef.current = items;

  useEffect(() => {
    if (isAuthenticated && user) {
      loadWardrobe();
    } else {
      setItems([]);
      setSavedOutfits([]);
      setPlannedOutfits([]);
      setSuggestions([]);
      setStats(null);
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.id]);

  const getImageCache = async (): Promise<ImageCache> => {
    try {
      const data = await AsyncStorage.getItem(IMAGE_CACHE_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  };

  const setImageCache = async (cache: ImageCache) => {
    try {
      await AsyncStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(cache));
    } catch {}
  };

  const updateImageCacheEntry = async (id: string, images: { imageUri?: string; enhancedImageUri?: string; originalImageUri?: string; imageProcessed?: boolean }) => {
    const cache = await getImageCache();
    cache[id] = { ...cache[id], ...images };
    await setImageCache(cache);
  };

  const saveFullLocalCache = async (updatedItems: WardrobeItem[]) => {
    try {
      const existing = await AsyncStorage.getItem(WARDROBE_STORAGE_KEY);
      const all: WardrobeItem[] = existing ? JSON.parse(existing) : [];
      const others = all.filter(i => i.userId !== user?.id);
      await AsyncStorage.setItem(WARDROBE_STORAGE_KEY, JSON.stringify([...others, ...updatedItems]));
    } catch (err) {
      console.error('[WardrobeContext] Failed to save local cache:', err);
    }
  };

  const saveOutfits = async (newOutfits: SavedOutfit[]) => {
    try {
      const existing = await AsyncStorage.getItem(OUTFITS_STORAGE_KEY);
      const all: SavedOutfit[] = existing ? JSON.parse(existing) : [];
      const others = all.filter(o => o.userId !== user?.id);
      await AsyncStorage.setItem(OUTFITS_STORAGE_KEY, JSON.stringify([...others, ...newOutfits]));
      setSavedOutfits(newOutfits);
    } catch (err) {
      console.error('[WardrobeContext] Failed to save outfits:', err);
      throw new Error('Failed to save outfit');
    }
  };

  const savePlannedOutfits = async (newPlanned: PlannedOutfit[]) => {
    try {
      const existing = await AsyncStorage.getItem(PLANNED_STORAGE_KEY);
      const all: PlannedOutfit[] = existing ? JSON.parse(existing) : [];
      const others = all.filter(p => p.userId !== user?.id);
      await AsyncStorage.setItem(PLANNED_STORAGE_KEY, JSON.stringify([...others, ...newPlanned]));
      setPlannedOutfits(newPlanned);
    } catch (err) {
      console.error('[WardrobeContext] Failed to save planned outfits:', err);
      throw new Error('Failed to save planned outfit');
    }
  };

  const loadWardrobe = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Silently migrate any legacy 'activewear' items to the correct subcategory
      apiService.post('/api/wardrobe/migrate-activewear', {}).catch(() => {});

      const imageCache = await getImageCache();

      // Load outfits and planned from local storage (they remain local-only)
      const loadLocalSecondary = async () => {
        const [outfitsData, plannedData] = await Promise.all([
          AsyncStorage.getItem(OUTFITS_STORAGE_KEY),
          AsyncStorage.getItem(PLANNED_STORAGE_KEY),
        ]);
        if (outfitsData) {
          const all: SavedOutfit[] = JSON.parse(outfitsData);
          setSavedOutfits(all.filter(o => o.userId === user?.id));
        }
        if (plannedData) {
          const all: PlannedOutfit[] = JSON.parse(plannedData);
          setPlannedOutfits(all.filter(p => p.userId === user?.id));
        }
      };

      // Try backend first — it is the source of truth for wardrobe items
      try {
        const result = await apiService.fetchWardrobeItems();
        if (result?.success && result.items) {
          const backendItems = result.items.map((row: any) => mapBackendItemToFrontend(row, imageCache));
          setItems(backendItems);
          // Cache locally for offline fallback
          await saveFullLocalCache(backendItems);
          await loadLocalSecondary();
          return;
        }
      } catch (backendErr) {
        console.log('[WardrobeContext] Backend unavailable, falling back to local storage');
      }

      // Offline fallback: load from local cache
      const [itemsData, outfitsData, plannedData] = await Promise.all([
        AsyncStorage.getItem(WARDROBE_STORAGE_KEY),
        AsyncStorage.getItem(OUTFITS_STORAGE_KEY),
        AsyncStorage.getItem(PLANNED_STORAGE_KEY),
      ]);
      if (itemsData) {
        const all: WardrobeItem[] = JSON.parse(itemsData);
        setItems(all.filter(i => i.userId === user?.id));
      }
      if (outfitsData) {
        const all: SavedOutfit[] = JSON.parse(outfitsData);
        setSavedOutfits(all.filter(o => o.userId === user?.id));
      }
      if (plannedData) {
        const all: PlannedOutfit[] = JSON.parse(plannedData);
        setPlannedOutfits(all.filter(p => p.userId === user?.id));
      }
    } catch (err) {
      console.error('[WardrobeContext] Failed to load wardrobe:', err);
      setError('Failed to load your wardrobe');
    } finally {
      setIsLoading(false);
    }
  };

  const addItem = useCallback(async (
    itemData: Omit<WardrobeItem, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'timesWorn'>
  ): Promise<WardrobeItem> => {
    if (!user) throw new Error('Not authenticated');
    const now = new Date().toISOString();

    try {
      const { imageUri, enhancedImageUri, originalImageUri, imageProcessed, imageBase64, ...rest } = itemData as any;
      const metadata = { ...rest, imageUri, enhancedImageUri, originalImageUri, imageProcessed };

      const response = await apiService.addWardrobeItem({
        name: itemData.name,
        category: itemData.category,
        subcategory: itemData.subcategory,
        color: itemData.color,
        brand: itemData.brand,
        seasons: itemData.seasons,
        occasions: itemData.occasions,
        origin: itemData.origin,
        isFavorite: itemData.isFavorite,
        metadata,
        imageBase64,
      });

      if (response?.success && response.item) {
        const backendId = response.item.id;
        await updateImageCacheEntry(backendId, { imageUri, enhancedImageUri, originalImageUri, imageProcessed });

        const newItem: WardrobeItem = {
          ...itemData,
          id: backendId,
          userId: user.id,
          timesWorn: 0,
          createdAt: now,
          updatedAt: now,
        };

        const updatedItems = [...itemsRef.current, newItem];
        setItems(updatedItems);
        await saveFullLocalCache(updatedItems);
        return newItem;
      }
    } catch (err) {
      console.log('[WardrobeContext] Backend addItem failed, saving locally:', err);
    }

    // Local-only fallback (offline / backend down)
    const tempItem: WardrobeItem = {
      ...itemData,
      id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: user.id,
      origin: itemData.origin || 'owned',
      timesWorn: 0,
      createdAt: now,
      updatedAt: now,
    };
    const updatedItems = [...itemsRef.current, tempItem];
    setItems(updatedItems);
    await saveFullLocalCache(updatedItems);
    return tempItem;
  }, [user]);

  const addItemsBatch = useCallback(async (
    itemsData: Array<Omit<WardrobeItem, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'timesWorn'>>
  ): Promise<WardrobeItem[]> => {
    if (!user) throw new Error('Not authenticated');
    const now = new Date().toISOString();

    try {
      const batchPayload = itemsData.map(itemData => {
        const { imageUri, imageBase64, enhancedImageUri, originalImageUri, imageProcessed, ...rest } = itemData;
        return {
          name: itemData.name,
          category: itemData.category,
          subcategory: itemData.subcategory,
          color: itemData.color,
          brand: itemData.brand,
          seasons: itemData.seasons,
          occasions: itemData.occasions,
          origin: itemData.origin,
          isFavorite: itemData.isFavorite || false,
          imageBase64: imageBase64 || undefined,
          metadata: { ...rest, imageUri, enhancedImageUri, originalImageUri, imageProcessed },
        };
      });

      const response = await apiService.batchAddWardrobeItems(batchPayload);

      if (response?.success && response.items?.length > 0) {
        const imageCache = await getImageCache();
        const newItems: WardrobeItem[] = [];

        for (let i = 0; i < response.items.length; i++) {
          const backendItem = response.items[i];
          const originalItem = itemsData[i];
          const backendId = backendItem.id;

          imageCache[backendId] = {
            imageUri: originalItem.imageUri,
            enhancedImageUri: originalItem.enhancedImageUri,
            originalImageUri: originalItem.originalImageUri,
            imageProcessed: originalItem.imageProcessed,
          };

          newItems.push({
            ...originalItem,
            id: backendId,
            userId: user.id,
            origin: originalItem.origin || 'owned',
            timesWorn: 0,
            createdAt: now,
            updatedAt: now,
          });
        }

        await setImageCache(imageCache);
        const updatedItems = [...itemsRef.current, ...newItems];
        setItems(updatedItems);
        await saveFullLocalCache(updatedItems);
        return newItems;
      }
    } catch (err) {
      console.log('[WardrobeContext] Batch backend upload failed, saving locally:', err);
    }

    // Local-only fallback
    const localItems: WardrobeItem[] = itemsData.map((itemData, i) => ({
      ...itemData,
      id: `local_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`,
      userId: user.id,
      origin: itemData.origin || 'owned',
      timesWorn: 0,
      createdAt: now,
      updatedAt: now,
    }));
    const updatedItems = [...itemsRef.current, ...localItems];
    setItems(updatedItems);
    await saveFullLocalCache(updatedItems);
    return localItems;
  }, [user]);

  const updateItem = useCallback(async (id: string, updates: Partial<WardrobeItem>) => {
    const updatedItems = itemsRef.current.map(item =>
      item.id === id
        ? { ...item, ...updates, updatedAt: new Date().toISOString() }
        : item
    );
    setItems(updatedItems);
    await saveFullLocalCache(updatedItems);

    if (updates.imageUri !== undefined || updates.enhancedImageUri !== undefined) {
      await updateImageCacheEntry(id, {
        imageUri: updates.imageUri,
        enhancedImageUri: updates.enhancedImageUri,
        originalImageUri: updates.originalImageUri,
        imageProcessed: updates.imageProcessed,
      });
    }

    try {
      const fullItem = updatedItems.find(i => i.id === id);
      if (fullItem) {
        const { imageUri, enhancedImageUri, originalImageUri, imageProcessed, id: _id, userId: _uid, createdAt: _cat, updatedAt: _uat, ...rest } = fullItem;
        await apiService.updateWardrobeItem(id, {
          name: rest.name,
          category: rest.category,
          color: rest.color,
          brand: rest.brand,
          seasons: rest.seasons,
          occasions: rest.occasions,
          isFavorite: rest.isFavorite,
          timesWorn: rest.timesWorn,
          metadata: { ...rest, imageUri, enhancedImageUri, originalImageUri, imageProcessed },
        });
      }
    } catch (err) {
      console.log('[WardrobeContext] Backend updateItem failed (local already updated):', err);
    }
  }, []);

  const deleteItem = useCallback(async (id: string) => {
    const updatedItems = itemsRef.current.filter(item => item.id !== id);
    setItems(updatedItems);
    await saveFullLocalCache(updatedItems);

    try {
      const cache = await getImageCache();
      delete cache[id];
      await setImageCache(cache);
    } catch {}

    const currentOutfits = savedOutfits;
    const updatedOutfits = currentOutfits.map(outfit => ({
      ...outfit,
      itemIds: outfit.itemIds.filter(itemId => itemId !== id),
    }));
    await saveOutfits(updatedOutfits);

    try {
      await apiService.deleteWardrobeItem(id);
    } catch (err) {
      console.log('[WardrobeContext] Backend deleteItem failed (local already updated):', err);
    }
  }, [savedOutfits]);

  const markItemWorn = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    const targetItem = itemsRef.current.find(i => i.id === id);
    const updatedItems = itemsRef.current.map(item =>
      item.id === id
        ? { ...item, timesWorn: item.timesWorn + 1, lastWorn: now, updatedAt: now }
        : item
    );
    setItems(updatedItems);
    await saveFullLocalCache(updatedItems);

    try {
      await apiService.updateWardrobeItem(id, { timesWorn: (targetItem?.timesWorn || 0) + 1 });
    } catch (err) {
      console.log('[WardrobeContext] Backend markItemWorn failed (local updated):', err);
    }
  }, []);

  const toggleItemFavorite = useCallback(async (id: string) => {
    const targetItem = itemsRef.current.find(i => i.id === id);
    const updatedItems = itemsRef.current.map(item =>
      item.id === id
        ? { ...item, isFavorite: !item.isFavorite, updatedAt: new Date().toISOString() }
        : item
    );
    setItems(updatedItems);
    await saveFullLocalCache(updatedItems);

    try {
      await apiService.updateWardrobeItem(id, { isFavorite: !targetItem?.isFavorite });
    } catch (err) {
      console.log('[WardrobeContext] Backend toggleItemFavorite failed (local updated):', err);
    }
  }, []);

  const saveOutfit = useCallback(async (
    outfitData: Omit<SavedOutfit, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'timesWorn'>
  ): Promise<SavedOutfit> => {
    if (!user) throw new Error('Not authenticated');
    const now = new Date().toISOString();
    const newOutfit: SavedOutfit = {
      ...outfitData,
      id: `outfit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: user.id,
      timesWorn: 0,
      createdAt: now,
      updatedAt: now,
    };
    const updatedOutfits = [...savedOutfits, newOutfit];
    await saveOutfits(updatedOutfits);
    return newOutfit;
  }, [user, savedOutfits]);

  const deleteOutfit = useCallback(async (id: string) => {
    const updatedOutfits = savedOutfits.filter(outfit => outfit.id !== id);
    await saveOutfits(updatedOutfits);
  }, [savedOutfits]);

  const markOutfitWorn = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    const outfit = savedOutfits.find(o => o.id === id);
    if (outfit) {
      for (const itemId of outfit.itemIds) {
        await markItemWorn(itemId);
      }
    }
    const updatedOutfits = savedOutfits.map(o =>
      o.id === id
        ? { ...o, timesWorn: o.timesWorn + 1, lastWorn: now, updatedAt: now }
        : o
    );
    await saveOutfits(updatedOutfits);
  }, [savedOutfits, markItemWorn]);

  const planOutfit = useCallback(async (
    planData: Omit<PlannedOutfit, 'id' | 'userId' | 'createdAt' | 'wasWorn'>
  ): Promise<PlannedOutfit> => {
    if (!user) throw new Error('Not authenticated');
    const newPlan: PlannedOutfit = {
      ...planData,
      id: `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: user.id,
      wasWorn: false,
      createdAt: new Date().toISOString(),
    };
    const updatedPlanned = [...plannedOutfits, newPlan];
    await savePlannedOutfits(updatedPlanned);
    return newPlan;
  }, [user, plannedOutfits]);

  const deletePlannedOutfit = useCallback(async (id: string) => {
    const updatedPlanned = plannedOutfits.filter(plan => plan.id !== id);
    await savePlannedOutfits(updatedPlanned);
    try {
      await apiService.deleteOutfitCalendarEntry(id);
    } catch (err) {
      console.log('[WardrobeContext] Backend delete outfit-calendar failed (local already updated):', err);
    }
  }, [plannedOutfits]);

  const updatePlannedOutfit = useCallback(async (
    id: string,
    updates: { itemIds?: string[]; eventName?: string; eventType?: PlannedEventType; notes?: string }
  ) => {
    const updatedPlanned = plannedOutfits.map(plan =>
      plan.id === id ? { ...plan, ...updates } : plan
    );
    await savePlannedOutfits(updatedPlanned);
    try {
      await apiService.updateOutfitCalendarEntry(id, updates);
    } catch (err) {
      console.log('[WardrobeContext] Backend PUT outfit-calendar failed (local already updated):', err);
    }
  }, [plannedOutfits]);

  const removeItemFromPlannedOutfit = useCallback(async (outfitId: string, wardrobeItemId: string) => {
    const updatedPlanned = plannedOutfits.map(plan =>
      plan.id === outfitId
        ? { ...plan, itemIds: plan.itemIds.filter(id => id !== wardrobeItemId) }
        : plan
    );
    await savePlannedOutfits(updatedPlanned);
    try {
      await apiService.removeItemFromOutfitCalendarEntry(outfitId, wardrobeItemId);
    } catch (err) {
      console.log('[WardrobeContext] Backend DELETE outfit item failed (local already updated):', err);
    }
  }, [plannedOutfits]);

  const markPlannedOutfitWorn = useCallback(async (id: string) => {
    const plan = plannedOutfits.find(p => p.id === id);
    if (plan) {
      if (plan.outfitId) {
        await markOutfitWorn(plan.outfitId);
      } else {
        for (const itemId of plan.itemIds) {
          await markItemWorn(itemId);
        }
      }
    }
    const updatedPlanned = plannedOutfits.map(p =>
      p.id === id ? { ...p, wasWorn: true } : p
    );
    await savePlannedOutfits(updatedPlanned);
  }, [plannedOutfits, markOutfitWorn, markItemWorn]);

  const getItemsByCategory = useCallback((category: ClothingCategory): WardrobeItem[] => {
    return items.filter(item => item.category === category);
  }, [items]);

  const getItemsByOccasion = useCallback((occasion: ClothingOccasion): WardrobeItem[] => {
    return items.filter(item => item.occasions.includes(occasion));
  }, [items]);

  const getItemsBySeason = useCallback((season: ClothingSeason): WardrobeItem[] => {
    return items.filter(item =>
      item.seasons.includes(season) || item.seasons.includes('all-season')
    );
  }, [items]);

  const getItemsByOrigin = useCallback((origin: ItemOrigin): WardrobeItem[] => {
    return items.filter(item => (item.origin || 'owned') === origin);
  }, [items]);

  const getOwnedItems = useCallback((): WardrobeItem[] => {
    return items.filter(item => !item.origin || item.origin === 'owned');
  }, [items]);

  const getInspirationItems = useCallback((): WardrobeItem[] => {
    return items.filter(item => item.origin === 'inspiration' || item.origin === 'wishlist');
  }, [items]);

  const searchItems = useCallback((query: string): WardrobeItem[] => {
    const lowerQuery = query.toLowerCase();
    return items.filter(item =>
      item.name.toLowerCase().includes(lowerQuery) ||
      item.category.toLowerCase().includes(lowerQuery) ||
      (item.brand && item.brand.toLowerCase().includes(lowerQuery)) ||
      item.color.toLowerCase().includes(lowerQuery)
    );
  }, [items]);

  const generateOutfitSuggestions = useCallback(async (
    occasion?: ClothingOccasion,
    season?: ClothingSeason
  ): Promise<OutfitSuggestion[]> => {
    const tops = items.filter(item =>
      item.category === 'tops' &&
      (!occasion || item.occasions.includes(occasion)) &&
      (!season || item.seasons.includes(season) || item.seasons.includes('all-season'))
    );
    const bottoms = items.filter(item =>
      item.category === 'bottoms' &&
      (!occasion || item.occasions.includes(occasion)) &&
      (!season || item.seasons.includes(season) || item.seasons.includes('all-season'))
    );
    const dresses = items.filter(item =>
      item.category === 'dresses' &&
      (!occasion || item.occasions.includes(occasion)) &&
      (!season || item.seasons.includes(season) || item.seasons.includes('all-season'))
    );
    const outerwear = items.filter(item =>
      item.category === 'outerwear' &&
      (!season || item.seasons.includes(season) || item.seasons.includes('all-season'))
    );
    const shoes = items.filter(item =>
      item.category === 'shoes' &&
      (!occasion || item.occasions.includes(occasion))
    );

    const newSuggestions: OutfitSuggestion[] = [];

    for (const top of tops.slice(0, 5)) {
      for (const bottom of bottoms.slice(0, 3)) {
        const matchingShoe = shoes.find(s =>
          s.color === top.color || s.color === bottom.color || s.color === 'black' || s.color === 'white'
        );
        const itemIds = [top.id, bottom.id];
        if (matchingShoe) itemIds.push(matchingShoe.id);
        if (season === 'winter' || season === 'autumn') {
          const matchingOuterwear = outerwear.find(o =>
            o.color === 'black' || o.color === 'navy' || o.color === top.color
          );
          if (matchingOuterwear) itemIds.push(matchingOuterwear.id);
        }
        newSuggestions.push({
          id: `suggestion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          itemIds,
          occasion: occasion || 'everyday',
          season: season || 'all-season',
          reason: `This ${top.name} pairs well with your ${bottom.name}`,
          styleNotes: `A balanced combination of ${top.color} and ${bottom.color}`,
          matchScore: Math.random() * 0.3 + 0.7,
          generatedAt: new Date().toISOString(),
        });
      }
    }

    for (const dress of dresses.slice(0, 3)) {
      const matchingShoe = shoes.find(s =>
        s.color === dress.color || s.color === 'black' || s.color === 'beige'
      );
      const itemIds = [dress.id];
      if (matchingShoe) itemIds.push(matchingShoe.id);
      newSuggestions.push({
        id: `suggestion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        itemIds,
        occasion: occasion || 'everyday',
        season: season || 'all-season',
        reason: `Your ${dress.name} is perfect for this occasion`,
        styleNotes: `An elegant single-piece look in ${dress.color}`,
        matchScore: Math.random() * 0.3 + 0.7,
        generatedAt: new Date().toISOString(),
      });
    }

    newSuggestions.sort((a, b) => b.matchScore - a.matchScore);
    const topSuggestions = newSuggestions.slice(0, 10);
    setSuggestions(topSuggestions);
    return topSuggestions;
  }, [items]);

  const shuffleOutfit = useCallback((occasion?: ClothingOccasion): OutfitSuggestion | null => {
    const filteredItems = occasion
      ? items.filter(item => item.occasions.includes(occasion))
      : items;
    const tops = filteredItems.filter(i => i.category === 'tops');
    const bottoms = filteredItems.filter(i => i.category === 'bottoms');
    const shoes = filteredItems.filter(i => i.category === 'shoes');
    if (tops.length === 0 || bottoms.length === 0) return null;
    const randomTop = tops[Math.floor(Math.random() * tops.length)];
    const randomBottom = bottoms[Math.floor(Math.random() * bottoms.length)];
    const randomShoe = shoes.length > 0 ? shoes[Math.floor(Math.random() * shoes.length)] : null;
    const itemIds = [randomTop.id, randomBottom.id];
    if (randomShoe) itemIds.push(randomShoe.id);
    return {
      id: `shuffle_${Date.now()}`,
      itemIds,
      occasion: occasion || 'everyday',
      season: 'all-season',
      reason: 'Random outfit suggestion from your wardrobe',
      styleNotes: `Try this ${randomTop.color} ${randomTop.name} with your ${randomBottom.name}`,
      matchScore: 0.75,
      generatedAt: new Date().toISOString(),
    };
  }, [items]);

  const refreshStats = useCallback(() => {
    if (items.length === 0) {
      setStats(null);
      return;
    }
    const itemsByCategory = items.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {} as Record<ClothingCategory, number>);
    const sortedByWear = [...items].sort((a, b) => b.timesWorn - a.timesWorn);
    const mostWornItems = sortedByWear.slice(0, 5);
    const leastWornItems = sortedByWear.filter(i => i.timesWorn === 0).slice(0, 5);
    const totalWears = items.reduce((sum, item) => sum + item.timesWorn, 0);
    const averageWearCount = totalWears / items.length;
    const totalCost = items.reduce((sum, item) => sum + (item.purchasePrice || 0), 0);
    const costPerWear = totalWears > 0 ? totalCost / totalWears : 0;
    const sustainabilityScores = items
      .filter(item => item.sustainabilityScore !== undefined)
      .map(item => item.sustainabilityScore as number);
    const avgSustainability = sustainabilityScores.length > 0
      ? sustainabilityScores.reduce((a, b) => a + b, 0) / sustainabilityScores.length
      : 0;
    setStats({
      totalItems: items.length,
      itemsByCategory: itemsByCategory as Record<ClothingCategory, number>,
      mostWornItems,
      leastWornItems,
      totalOutfits: savedOutfits.length,
      averageWearCount,
      costPerWear,
      sustainabilityScore: avgSustainability,
    });
  }, [items, savedOutfits]);

  useEffect(() => {
    refreshStats();
  }, [items, savedOutfits, refreshStats]);

  const value: WardrobeContextType = {
    items,
    savedOutfits,
    plannedOutfits,
    suggestions,
    stats,
    isLoading,
    error,
    addItem,
    addItemsBatch,
    updateItem,
    deleteItem,
    markItemWorn,
    toggleItemFavorite,
    saveOutfit,
    deleteOutfit,
    markOutfitWorn,
    planOutfit,
    updatePlannedOutfit,
    deletePlannedOutfit,
    removeItemFromPlannedOutfit,
    markPlannedOutfitWorn,
    generateOutfitSuggestions,
    getItemsByCategory,
    getItemsByOccasion,
    getItemsBySeason,
    getItemsByOrigin,
    getOwnedItems,
    getInspirationItems,
    shuffleOutfit,
    refreshStats,
    searchItems,
  };

  return (
    <WardrobeContext.Provider value={value}>
      {children}
    </WardrobeContext.Provider>
  );
}

export function useWardrobe(): WardrobeContextType {
  const context = useContext(WardrobeContext);
  if (!context) {
    throw new Error('useWardrobe must be used within a WardrobeProvider');
  }
  return context;
}


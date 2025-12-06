import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import { Post } from '@/contexts/PostsContext';

export interface StyleOfTheDayOutfit {
  id: string;
  outfitType: 'style_of_the_day';
  title: string;
  description: string;
  imageUri: string;
  region: string;
  savedAt: string;
}

export interface SavedPost extends Post {
  outfitType: 'post';
  savedAt: string;
}

export interface SimilarOutfitSaved {
  id: string;
  outfitType: 'similar_outfit';
  title: string;
  description?: string;
  imageUri: string;
  style: string;
  savedAt: string;
}

export type LikedOutfit = SavedPost | StyleOfTheDayOutfit | SimilarOutfitSaved;

export interface SimilarOutfitInput {
  id: string;
  outfitType: 'similar_outfit';
  title: string;
  description?: string;
  imageUri: string;
  style: string;
}

interface OutfitFavoritesContextType {
  likedOutfitIds: string[];
  isOutfitLiked: (outfitId: string) => boolean;
  toggleOutfitLike: (outfit: Post | StyleOfTheDayOutfit | SimilarOutfitInput) => Promise<void>;
  getLikedOutfits: () => LikedOutfit[];
  isLoading: boolean;
}

const OutfitFavoritesContext = createContext<OutfitFavoritesContextType | null>(null);

const getStorageKeys = (userId: string) => ({
  idsKey: `@dripn_liked_outfit_ids_${userId}`,
  dataKey: `@dripn_liked_outfits_data_${userId}`,
});

interface OutfitFavoritesProviderProps {
  children: ReactNode;
}

export function OutfitFavoritesProvider({ children }: OutfitFavoritesProviderProps) {
  const { user } = useAuth();
  const [likedOutfitIds, setLikedOutfitIds] = useState<string[]>([]);
  const [likedOutfitsData, setLikedOutfitsData] = useState<LikedOutfit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const userId = user?.id || null;
    
    if (userId !== currentUserId) {
      setLikedOutfitIds([]);
      setLikedOutfitsData([]);
      setCurrentUserId(userId);
      
      if (userId) {
        loadLikedOutfits(userId);
      } else {
        setIsLoading(false);
      }
    }
  }, [user?.id, currentUserId]);

  const loadLikedOutfits = async (userId: string) => {
    try {
      setIsLoading(true);
      const { idsKey, dataKey } = getStorageKeys(userId);
      const [idsJson, dataJson] = await Promise.all([
        AsyncStorage.getItem(idsKey),
        AsyncStorage.getItem(dataKey),
      ]);

      if (idsJson) {
        setLikedOutfitIds(JSON.parse(idsJson));
      }
      if (dataJson) {
        setLikedOutfitsData(JSON.parse(dataJson));
      }
    } catch (error) {
      console.error('Error loading liked outfits:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveLikedOutfits = async (ids: string[], data: LikedOutfit[]) => {
    if (!currentUserId) return;
    
    try {
      const { idsKey, dataKey } = getStorageKeys(currentUserId);
      await Promise.all([
        AsyncStorage.setItem(idsKey, JSON.stringify(ids)),
        AsyncStorage.setItem(dataKey, JSON.stringify(data)),
      ]);
    } catch (error) {
      console.error('Error saving liked outfits:', error);
    }
  };

  const isOutfitLiked = useCallback((outfitId: string): boolean => {
    return likedOutfitIds.includes(outfitId);
  }, [likedOutfitIds]);

  const toggleOutfitLike = useCallback(async (outfit: Post | StyleOfTheDayOutfit | SimilarOutfitInput): Promise<void> => {
    const userId = user?.id;
    if (!userId) {
      console.log('[OutfitFavorites] No user ID, cannot save outfit');
      return;
    }
    
    const outfitId = outfit.id;
    let newIds: string[];
    let newData: LikedOutfit[] = [...likedOutfitsData];

    if (likedOutfitIds.includes(outfitId)) {
      newIds = likedOutfitIds.filter(id => id !== outfitId);
      newData = likedOutfitsData.filter(o => o.id !== outfitId);
    } else {
      newIds = [...likedOutfitIds, outfitId];
      if ('outfitType' in outfit && outfit.outfitType === 'style_of_the_day') {
        const styleOutfit = outfit as StyleOfTheDayOutfit;
        const savedStyleOutfit: StyleOfTheDayOutfit = {
          id: styleOutfit.id,
          outfitType: 'style_of_the_day',
          title: styleOutfit.title,
          description: styleOutfit.description,
          imageUri: styleOutfit.imageUri,
          region: styleOutfit.region,
          savedAt: new Date().toISOString(),
        };
        newData = [...likedOutfitsData, savedStyleOutfit];
      } else if ('outfitType' in outfit && outfit.outfitType === 'similar_outfit') {
        const similarOutfit = outfit as SimilarOutfitInput;
        const savedSimilarOutfit: SimilarOutfitSaved = {
          id: similarOutfit.id,
          outfitType: 'similar_outfit',
          title: similarOutfit.title,
          description: similarOutfit.description,
          imageUri: similarOutfit.imageUri,
          style: similarOutfit.style,
          savedAt: new Date().toISOString(),
        };
        newData = [...likedOutfitsData, savedSimilarOutfit];
      } else {
        const postOutfit = outfit as Post;
        const savedPostOutfit: SavedPost = {
          ...postOutfit,
          outfitType: 'post',
          savedAt: new Date().toISOString(),
        };
        newData = [...likedOutfitsData, savedPostOutfit];
      }
    }

    setLikedOutfitIds(newIds);
    setLikedOutfitsData(newData);
    
    try {
      const { idsKey, dataKey } = getStorageKeys(userId);
      await Promise.all([
        AsyncStorage.setItem(idsKey, JSON.stringify(newIds)),
        AsyncStorage.setItem(dataKey, JSON.stringify(newData)),
      ]);
      console.log('[OutfitFavorites] Saved outfit:', outfitId, 'for user:', userId);
    } catch (error) {
      console.error('[OutfitFavorites] Error saving liked outfits:', error);
    }
  }, [likedOutfitIds, likedOutfitsData, user?.id]);

  const getLikedOutfits = useCallback((): LikedOutfit[] => {
    return likedOutfitsData.sort((a, b) => 
      new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
    );
  }, [likedOutfitsData]);

  const value: OutfitFavoritesContextType = {
    likedOutfitIds,
    isOutfitLiked,
    toggleOutfitLike,
    getLikedOutfits,
    isLoading,
  };

  return (
    <OutfitFavoritesContext.Provider value={value}>
      {children}
    </OutfitFavoritesContext.Provider>
  );
}

export function useOutfitFavorites(): OutfitFavoritesContextType {
  const context = useContext(OutfitFavoritesContext);
  if (!context) {
    throw new Error('useOutfitFavorites must be used within an OutfitFavoritesProvider');
  }
  return context;
}

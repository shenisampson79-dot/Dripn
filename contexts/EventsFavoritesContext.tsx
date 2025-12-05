import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Event } from '@/services/EventsService';
import { useAuth } from '@/contexts/AuthContext';

interface EventsFavoritesContextType {
  likedEventIds: string[];
  isLiked: (eventId: string) => boolean;
  toggleLike: (event: Event) => Promise<void>;
  getLikedEvents: () => Event[];
  isLoading: boolean;
}

const EventsFavoritesContext = createContext<EventsFavoritesContextType | null>(null);

const getStorageKeys = (userId: string) => ({
  idsKey: `@stylewise_liked_event_ids_${userId}`,
  dataKey: `@stylewise_liked_events_data_${userId}`,
});

interface EventsFavoritesProviderProps {
  children: ReactNode;
}

export function EventsFavoritesProvider({ children }: EventsFavoritesProviderProps) {
  const { user } = useAuth();
  const [likedEventIds, setLikedEventIds] = useState<string[]>([]);
  const [likedEventsData, setLikedEventsData] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const userId = user?.id || null;
    
    if (userId !== currentUserId) {
      setLikedEventIds([]);
      setLikedEventsData([]);
      setCurrentUserId(userId);
      
      if (userId) {
        loadLikedEvents(userId);
      } else {
        setIsLoading(false);
      }
    }
  }, [user?.id, currentUserId]);

  const loadLikedEvents = async (userId: string) => {
    try {
      setIsLoading(true);
      const { idsKey, dataKey } = getStorageKeys(userId);
      const [idsJson, dataJson] = await Promise.all([
        AsyncStorage.getItem(idsKey),
        AsyncStorage.getItem(dataKey),
      ]);

      if (idsJson) {
        setLikedEventIds(JSON.parse(idsJson));
      }
      if (dataJson) {
        setLikedEventsData(JSON.parse(dataJson));
      }
    } catch (error) {
      console.error('Error loading liked events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveLikedEvents = async (ids: string[], data: Event[]) => {
    if (!currentUserId) return;
    
    try {
      const { idsKey, dataKey } = getStorageKeys(currentUserId);
      await Promise.all([
        AsyncStorage.setItem(idsKey, JSON.stringify(ids)),
        AsyncStorage.setItem(dataKey, JSON.stringify(data)),
      ]);
    } catch (error) {
      console.error('Error saving liked events:', error);
    }
  };

  const isLiked = useCallback((eventId: string): boolean => {
    return likedEventIds.includes(eventId);
  }, [likedEventIds]);

  const toggleLike = useCallback(async (event: Event): Promise<void> => {
    if (!currentUserId) return;
    
    const eventId = event.id;
    let newIds: string[];
    let newData: Event[];

    if (likedEventIds.includes(eventId)) {
      newIds = likedEventIds.filter(id => id !== eventId);
      newData = likedEventsData.filter(e => e.id !== eventId);
    } else {
      newIds = [...likedEventIds, eventId];
      newData = [...likedEventsData, event];
    }

    setLikedEventIds(newIds);
    setLikedEventsData(newData);
    await saveLikedEvents(newIds, newData);
  }, [likedEventIds, likedEventsData, currentUserId]);

  const getLikedEvents = useCallback((): Event[] => {
    return likedEventsData;
  }, [likedEventsData]);

  const value: EventsFavoritesContextType = {
    likedEventIds,
    isLiked,
    toggleLike,
    getLikedEvents,
    isLoading,
  };

  return (
    <EventsFavoritesContext.Provider value={value}>
      {children}
    </EventsFavoritesContext.Provider>
  );
}

export function useEventsFavorites(): EventsFavoritesContextType {
  const context = useContext(EventsFavoritesContext);
  if (!context) {
    throw new Error('useEventsFavorites must be used within an EventsFavoritesProvider');
  }
  return context;
}

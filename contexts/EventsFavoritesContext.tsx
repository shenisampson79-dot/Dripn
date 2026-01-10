import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Event } from '@/services/EventsService';
import { useAuth } from '@/contexts/AuthContext';
import apiService from '@/services/ApiService';

interface EventsFavoritesContextType {
  likedEventIds: string[];
  isLiked: (eventId: string) => boolean;
  toggleLike: (event: Event, outfitSuggestion?: string) => Promise<void>;
  getLikedEvents: () => Event[];
  isLoading: boolean;
  isSyncing: boolean;
}

const EventsFavoritesContext = createContext<EventsFavoritesContextType | null>(null);

const getStorageKeys = (userId: string) => ({
  idsKey: `@dripn_liked_event_ids_${userId}`,
  dataKey: `@dripn_liked_events_data_${userId}`,
});

interface EventsFavoritesProviderProps {
  children: ReactNode;
}

export function EventsFavoritesProvider({ children }: EventsFavoritesProviderProps) {
  const { user } = useAuth();
  const [likedEventIds, setLikedEventIds] = useState<string[]>([]);
  const [likedEventsData, setLikedEventsData] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
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
      
      if (apiService.isConfigured()) {
        try {
          const backendResult = await apiService.getLikedEvents();
          if (backendResult.likedEvents && backendResult.likedEvents.length > 0) {
            const backendIds = backendResult.likedEvents.map(e => e.eventId);
            const backendData: Event[] = backendResult.likedEvents.map(e => ({
              id: e.eventId,
              title: e.eventTitle,
              date: e.eventDate,
              time: e.eventTime,
              location: e.eventLocation || '',
              description: '',
              category: '',
              price: '',
              currency: 'USD',
              source: 'liked',
              sourceUrl: '',
              outfitSuggestion: '',
            }));
            
            setLikedEventIds(backendIds);
            setLikedEventsData(backendData);
            
            const { idsKey, dataKey } = getStorageKeys(userId);
            await Promise.all([
              AsyncStorage.setItem(idsKey, JSON.stringify(backendIds)),
              AsyncStorage.setItem(dataKey, JSON.stringify(backendData)),
            ]);
            
            return;
          }
        } catch (backendError) {
          console.log('Backend not available, using local storage');
        }
      }
      
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

  const toggleLike = useCallback(async (event: Event, outfitSuggestion?: string): Promise<void> => {
    if (!currentUserId) return;
    
    const eventId = event.id;
    let newIds: string[];
    let newData: Event[];
    const wasLiked = likedEventIds.includes(eventId);

    if (wasLiked) {
      newIds = likedEventIds.filter(id => id !== eventId);
      newData = likedEventsData.filter(e => e.id !== eventId);
    } else {
      newIds = [...likedEventIds, eventId];
      newData = [...likedEventsData, event];
    }

    setLikedEventIds(newIds);
    setLikedEventsData(newData);
    await saveLikedEvents(newIds, newData);

    if (apiService.isConfigured() && !wasLiked) {
      setIsSyncing(true);
      try {
        await apiService.likeEvent(eventId, {
          title: event.title,
          date: event.date,
          time: event.time,
          location: event.location,
          outfitSuggestion: outfitSuggestion,
        });
      } catch (error) {
        console.error('Failed to sync event like to backend:', error);
      } finally {
        setIsSyncing(false);
      }
    }
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
    isSyncing,
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

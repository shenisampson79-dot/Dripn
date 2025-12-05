import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Event } from '@/services/EventsService';

interface EventsFavoritesContextType {
  likedEventIds: string[];
  isLiked: (eventId: string) => boolean;
  toggleLike: (event: Event) => Promise<void>;
  getLikedEvents: () => Event[];
  isLoading: boolean;
}

const EventsFavoritesContext = createContext<EventsFavoritesContextType | null>(null);

const LIKED_EVENTS_IDS_KEY = '@stylewise_liked_event_ids';
const LIKED_EVENTS_DATA_KEY = '@stylewise_liked_events_data';

interface EventsFavoritesProviderProps {
  children: ReactNode;
}

export function EventsFavoritesProvider({ children }: EventsFavoritesProviderProps) {
  const [likedEventIds, setLikedEventIds] = useState<string[]>([]);
  const [likedEventsData, setLikedEventsData] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLikedEvents();
  }, []);

  const loadLikedEvents = async () => {
    try {
      const [idsJson, dataJson] = await Promise.all([
        AsyncStorage.getItem(LIKED_EVENTS_IDS_KEY),
        AsyncStorage.getItem(LIKED_EVENTS_DATA_KEY),
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
    try {
      await Promise.all([
        AsyncStorage.setItem(LIKED_EVENTS_IDS_KEY, JSON.stringify(ids)),
        AsyncStorage.setItem(LIKED_EVENTS_DATA_KEY, JSON.stringify(data)),
      ]);
    } catch (error) {
      console.error('Error saving liked events:', error);
    }
  };

  const isLiked = useCallback((eventId: string): boolean => {
    return likedEventIds.includes(eventId);
  }, [likedEventIds]);

  const toggleLike = useCallback(async (event: Event): Promise<void> => {
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
  }, [likedEventIds, likedEventsData]);

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

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type EventInterest = 
  | 'fitness'
  | 'social'
  | 'lifestyle'
  | 'dating'
  | 'fashion'
  | 'music'
  | 'outdoor'
  | 'sports'
  | 'arts'
  | 'food'
  | 'nightlife'
  | 'wellness';

export interface EventInterestOption {
  id: EventInterest;
  label: string;
  icon: string;
  description: string;
}

export const EVENT_INTEREST_OPTIONS: EventInterestOption[] = [
  { id: 'fitness', label: 'Fitness', icon: 'activity', description: 'Workouts, runs, yoga' },
  { id: 'social', label: 'Social', icon: 'users', description: 'Meetups, networking' },
  { id: 'lifestyle', label: 'Lifestyle', icon: 'coffee', description: 'Markets, workshops' },
  { id: 'dating', label: 'Dating', icon: 'heart', description: 'Singles events, mixers' },
  { id: 'fashion', label: 'Fashion', icon: 'shopping-bag', description: 'Pop-ups, launches' },
  { id: 'music', label: 'Music', icon: 'music', description: 'Concerts, live shows' },
  { id: 'outdoor', label: 'Outdoor', icon: 'sun', description: 'Hiking, nature trips' },
  { id: 'sports', label: 'Sports', icon: 'award', description: 'Games, matches' },
  { id: 'arts', label: 'Arts', icon: 'image', description: 'Galleries, exhibitions' },
  { id: 'food', label: 'Food', icon: 'coffee', description: 'Tastings, food fests' },
  { id: 'nightlife', label: 'Nightlife', icon: 'moon', description: 'Clubs, late events' },
  { id: 'wellness', label: 'Wellness', icon: 'heart', description: 'Spa, meditation' },
];

interface EventsPreferences {
  interests: EventInterest[];
  maxDistance: number;
  preferFreeEvents: boolean;
  weekendOnly: boolean;
  surpriseMeHistory: string[];
}

interface EventsPreferencesContextType {
  preferences: EventsPreferences;
  hasSetPreferences: boolean;
  isLoading: boolean;
  toggleInterest: (interest: EventInterest) => void;
  setMaxDistance: (distance: number) => void;
  setPreferFreeEvents: (prefer: boolean) => void;
  setWeekendOnly: (weekendOnly: boolean) => void;
  addToSurpriseMeHistory: (eventId: string) => void;
  clearSurpriseMeHistory: () => void;
  savePreferences: () => Promise<void>;
}

const defaultPreferences: EventsPreferences = {
  interests: [],
  maxDistance: 25,
  preferFreeEvents: false,
  weekendOnly: false,
  surpriseMeHistory: [],
};

const EventsPreferencesContext = createContext<EventsPreferencesContextType | null>(null);

const STORAGE_KEY = '@dripn_events_preferences';

export function EventsPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<EventsPreferences>(defaultPreferences);
  const [hasSetPreferences, setHasSetPreferences] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPreferences();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)).catch(error => {
        console.log('Failed to auto-save events preferences:', error);
      });
      setHasSetPreferences(preferences.interests.length > 0);
    }
  }, [preferences, isLoading]);

  const loadPreferences = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPreferences({ ...defaultPreferences, ...parsed });
        setHasSetPreferences(parsed.interests && parsed.interests.length > 0);
      }
    } catch (error) {
      console.log('Failed to load events preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const savePreferences = useCallback(async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      setHasSetPreferences(preferences.interests.length > 0);
    } catch (error) {
      console.log('Failed to save events preferences:', error);
    }
  }, [preferences]);

  const toggleInterest = useCallback((interest: EventInterest) => {
    setPreferences(prev => {
      const exists = prev.interests.includes(interest);
      const newInterests = exists
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest];
      return { ...prev, interests: newInterests };
    });
  }, []);

  const setMaxDistance = useCallback((distance: number) => {
    setPreferences(prev => ({ ...prev, maxDistance: distance }));
  }, []);

  const setPreferFreeEvents = useCallback((prefer: boolean) => {
    setPreferences(prev => ({ ...prev, preferFreeEvents: prefer }));
  }, []);

  const setWeekendOnly = useCallback((weekendOnly: boolean) => {
    setPreferences(prev => ({ ...prev, weekendOnly }));
  }, []);

  const addToSurpriseMeHistory = useCallback((eventId: string) => {
    setPreferences(prev => ({
      ...prev,
      surpriseMeHistory: [...prev.surpriseMeHistory.slice(-9), eventId],
    }));
  }, []);

  const clearSurpriseMeHistory = useCallback(() => {
    setPreferences(prev => ({ ...prev, surpriseMeHistory: [] }));
  }, []);

  return (
    <EventsPreferencesContext.Provider
      value={{
        preferences,
        hasSetPreferences,
        isLoading,
        toggleInterest,
        setMaxDistance,
        setPreferFreeEvents,
        setWeekendOnly,
        addToSurpriseMeHistory,
        clearSurpriseMeHistory,
        savePreferences,
      }}
    >
      {children}
    </EventsPreferencesContext.Provider>
  );
}

export function useEventsPreferences() {
  const context = useContext(EventsPreferencesContext);
  if (!context) {
    throw new Error('useEventsPreferences must be used within EventsPreferencesProvider');
  }
  return context;
}

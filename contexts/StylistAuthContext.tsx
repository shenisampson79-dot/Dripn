import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StylistProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  specialties: string[];
  yearsExperience: number;
}

export interface VIPSession {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  notes: string | null;
  sessionNotes: string | null;
  completedAt: string | null;
  vipUser: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    email: string;
  };
  createdAt: string;
}

interface StylistAuthContextType {
  stylist: StylistProfile | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<StylistProfile>) => Promise<void>;
  getSessions: (upcoming?: boolean) => Promise<VIPSession[]>;
  getSession: (id: string) => Promise<VIPSession | null>;
  completeSession: (id: string, sessionNotes?: string) => Promise<void>;
  updateSessionNotes: (id: string, notes: string) => Promise<void>;
}

const StylistAuthContext = createContext<StylistAuthContextType | null>(null);

const STYLIST_STORAGE_KEY = '@dripn_stylist';
const STYLIST_TOKEN_KEY = '@dripn_stylist_token';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export function StylistAuthProvider({ children }: { children: ReactNode }) {
  const [stylist, setStylist] = useState<StylistProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStylist();
  }, []);

  const loadStylist = async () => {
    try {
      const [stylistData, tokenData] = await Promise.all([
        AsyncStorage.getItem(STYLIST_STORAGE_KEY),
        AsyncStorage.getItem(STYLIST_TOKEN_KEY),
      ]);
      if (stylistData && tokenData) {
        setStylist(JSON.parse(stylistData));
        setToken(tokenData);
      }
    } catch (error) {
      console.error('Failed to load stylist:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveStylist = async (stylistData: StylistProfile, tokenData: string) => {
    try {
      await Promise.all([
        AsyncStorage.setItem(STYLIST_STORAGE_KEY, JSON.stringify(stylistData)),
        AsyncStorage.setItem(STYLIST_TOKEN_KEY, tokenData),
      ]);
      setStylist(stylistData);
      setToken(tokenData);
    } catch (error) {
      console.error('Failed to save stylist:', error);
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/stylist/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      await saveStylist(data.stylist, data.token);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(STYLIST_STORAGE_KEY),
        AsyncStorage.removeItem(STYLIST_TOKEN_KEY),
      ]);
      setStylist(null);
      setToken(null);
    } catch (error) {
      console.error('Failed to logout:', error);
      throw error;
    }
  };

  const updateProfile = async (updates: Partial<StylistProfile>) => {
    if (!stylist || !token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/stylist/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      const updatedStylist = { ...stylist, ...data };
      await AsyncStorage.setItem(STYLIST_STORAGE_KEY, JSON.stringify(updatedStylist));
      setStylist(updatedStylist);
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    }
  };

  const getSessions = async (upcoming: boolean = false): Promise<VIPSession[]> => {
    if (!token) return [];

    try {
      const url = upcoming
        ? `${API_BASE_URL}/api/stylist/sessions?upcoming=true`
        : `${API_BASE_URL}/api/stylist/sessions`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get sessions');
      }

      return data;
    } catch (error) {
      console.error('Failed to get sessions:', error);
      return [];
    }
  };

  const getSession = async (id: string): Promise<VIPSession | null> => {
    if (!token) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/api/stylist/sessions/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get session');
      }

      return data;
    } catch (error) {
      console.error('Failed to get session:', error);
      return null;
    }
  };

  const completeSession = async (id: string, sessionNotes?: string) => {
    if (!token) throw new Error('Not authenticated');

    try {
      const response = await fetch(`${API_BASE_URL}/api/stylist/sessions/${id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionNotes }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete session');
      }
    } catch (error) {
      console.error('Failed to complete session:', error);
      throw error;
    }
  };

  const updateSessionNotes = async (id: string, sessionNotes: string) => {
    if (!token) throw new Error('Not authenticated');

    try {
      const response = await fetch(`${API_BASE_URL}/api/stylist/sessions/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionNotes }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update session notes');
      }
    } catch (error) {
      console.error('Failed to update session notes:', error);
      throw error;
    }
  };

  return (
    <StylistAuthContext.Provider
      value={{
        stylist,
        token,
        isLoading,
        isAuthenticated: !!stylist && !!token,
        login,
        logout,
        updateProfile,
        getSessions,
        getSession,
        completeSession,
        updateSessionNotes,
      }}
    >
      {children}
    </StylistAuthContext.Provider>
  );
}

export function useStylistAuth() {
  const context = useContext(StylistAuthContext);
  if (!context) {
    throw new Error('useStylistAuth must be used within a StylistAuthProvider');
  }
  return context;
}

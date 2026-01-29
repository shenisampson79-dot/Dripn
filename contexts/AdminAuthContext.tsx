import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AdminProfile {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

export interface StylistRecord {
  id: string;
  email: string;
  displayName: string;
  bio: string;
  specialties: string[];
  yearsExperience: number;
  status: 'pending' | 'approved' | 'suspended';
  approvedAt: string | null;
  createdAt: string;
}

interface AdminAuthContextType {
  admin: AdminProfile | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setupAdmin: (email: string, password: string, displayName: string, setupKey: string) => Promise<void>;
  getStylists: () => Promise<StylistRecord[]>;
  registerStylist: (data: {
    email: string;
    displayName: string;
    bio?: string;
    specialties?: string[];
    yearsExperience?: number;
  }) => Promise<StylistRecord>;
  approveStylist: (id: string, password: string) => Promise<void>;
  revokeStylist: (id: string) => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

const ADMIN_STORAGE_KEY = '@dripn_admin';
const ADMIN_TOKEN_KEY = '@dripn_admin_token';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://dripn-server--shenisampson79.replit.app';

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAdmin();
  }, []);

  const loadAdmin = async () => {
    try {
      const [adminData, tokenData] = await Promise.all([
        AsyncStorage.getItem(ADMIN_STORAGE_KEY),
        AsyncStorage.getItem(ADMIN_TOKEN_KEY),
      ]);
      if (adminData && tokenData) {
        setAdmin(JSON.parse(adminData));
        setToken(tokenData);
      }
    } catch (error) {
      console.error('Failed to load admin:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveAdmin = async (adminData: AdminProfile, tokenData: string) => {
    try {
      await Promise.all([
        AsyncStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(adminData)),
        AsyncStorage.setItem(ADMIN_TOKEN_KEY, tokenData),
      ]);
      setAdmin(adminData);
      setToken(tokenData);
    } catch (error) {
      console.error('Failed to save admin:', error);
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/login`, {
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

      await saveAdmin(data.admin, data.token);
    } finally {
      setIsLoading(false);
    }
  };

  const setupAdmin = async (email: string, password: string, displayName: string, setupKey: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, displayName, setupKey }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Setup failed');
      }

      await saveAdmin(data.admin, data.token);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(ADMIN_STORAGE_KEY),
        AsyncStorage.removeItem(ADMIN_TOKEN_KEY),
      ]);
      setAdmin(null);
      setToken(null);
    } catch (error) {
      console.error('Failed to logout:', error);
      throw error;
    }
  };

  const getStylists = async (): Promise<StylistRecord[]> => {
    if (!token) return [];

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/stylists`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get stylists');
      }

      return data;
    } catch (error) {
      console.error('Failed to get stylists:', error);
      return [];
    }
  };

  const registerStylist = async (stylistData: {
    email: string;
    displayName: string;
    bio?: string;
    specialties?: string[];
    yearsExperience?: number;
  }): Promise<StylistRecord> => {
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/admin/stylists`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(stylistData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to register stylist');
    }

    return data;
  };

  const approveStylist = async (id: string, password: string) => {
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/admin/stylists/${id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to approve stylist');
    }
  };

  const revokeStylist = async (id: string) => {
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/api/admin/stylists/${id}/revoke`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to revoke stylist');
    }
  };

  return (
    <AdminAuthContext.Provider
      value={{
        admin,
        token,
        isLoading,
        isAuthenticated: !!admin && !!token,
        login,
        logout,
        setupAdmin,
        getStylists,
        registerStylist,
        approveStylist,
        revokeStylist,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}

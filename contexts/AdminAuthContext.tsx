import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL as API_BASE_URL, ADMIN_API_URL } from '@/config/api';
import {
  ADMIN_TOKEN_KEY,
  getSecureToken,
  setSecureToken,
  clearSecureToken,
} from '@/utils/secureTokenStore';

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

async function parseApiResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    if (text.trimStart().startsWith('<')) {
      throw new Error(
        'Server returned a web page instead of JSON. On Vercel, set EXPO_PUBLIC_API_URL to https://dripn-server.onrender.com (include https://) and redeploy.',
      );
    }
    throw new Error(text.slice(0, 160) || `Unexpected response (${response.status})`);
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error('Invalid JSON from server');
  }
}

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
        getSecureToken(ADMIN_TOKEN_KEY),
      ]);
      if (adminData && tokenData) {
        // Validate the token is still accepted by the backend
        const valid = await validateToken(tokenData);
        if (valid) {
          setAdmin(JSON.parse(adminData));
          setToken(tokenData);
        } else {
          // Stale / invalid token — clear it so login screen appears
          await Promise.all([
            AsyncStorage.removeItem(ADMIN_STORAGE_KEY),
            clearSecureToken(ADMIN_TOKEN_KEY),
          ]).catch(() => {});
        }
      }
    } catch (error) {
      console.error('Failed to load admin:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const validateToken = async (tokenData: string): Promise<boolean> => {
    try {
      const response = await fetch(`${ADMIN_API_URL}/api/analytics/summary`, {
        headers: { 'Authorization': `Bearer ${tokenData}` },
        signal: AbortSignal.timeout(5000),
      });
      return response.status !== 401 && response.status !== 403;
    } catch {
      // Network error — treat as valid so offline usage still works
      return true;
    }
  };

  const saveAdmin = async (adminData: AdminProfile, tokenData: string) => {
    try {
      await Promise.all([
        AsyncStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(adminData)),
        setSecureToken(ADMIN_TOKEN_KEY, tokenData),
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
      const response = await fetch(`${ADMIN_API_URL}/api/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await parseApiResponse(response);

      if (!response.ok) {
        throw new Error(String(data.error || 'Login failed'));
      }

      await saveAdmin(data.admin as AdminProfile, String(data.token));
    } finally {
      setIsLoading(false);
    }
  };

  const setupAdmin = async (email: string, password: string, displayName: string, setupKey: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${ADMIN_API_URL}/api/admin/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, displayName, setupKey }),
      });

      const data = await parseApiResponse(response);

      if (!response.ok) {
        throw new Error(String(data.error || 'Setup failed'));
      }

      await saveAdmin(data.admin as AdminProfile, String(data.token));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(ADMIN_STORAGE_KEY),
        clearSecureToken(ADMIN_TOKEN_KEY),
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
      const response = await fetch(`${ADMIN_API_URL}/api/admin/stylists`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await parseApiResponse(response);

      if (!response.ok) {
        throw new Error(String(data.error || 'Failed to get stylists'));
      }

      return Array.isArray(data) ? (data as unknown as StylistRecord[]) : [];
    } catch (error) {
      // Avoid red LogBox for missing/HTML endpoints — stylist registry is optional
      console.warn('Failed to get stylists:', error instanceof Error ? error.message : error);
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

    const response = await fetch(`${ADMIN_API_URL}/api/admin/stylists`, {
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

    const response = await fetch(`${ADMIN_API_URL}/api/admin/stylists/${id}/approve`, {
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

    const response = await fetch(`${ADMIN_API_URL}/api/admin/stylists/${id}/revoke`, {
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

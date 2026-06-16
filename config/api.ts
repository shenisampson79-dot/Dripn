const DEFAULT_API_URL = 'https://dripn-server.onrender.com';

/** Ensure API base URL is absolute https — bare hostnames break fetch on web (treated as relative paths). */
export function resolveApiUrl(raw?: string): string {
  const value = (raw ?? DEFAULT_API_URL).trim().replace(/\/+$/, '');
  if (!value || value === '/') {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
    return DEFAULT_API_URL;
  }
  if (value.startsWith('/')) {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}${value}`.replace(/\/+$/, '');
    }
    return DEFAULT_API_URL;
  }
  if (!/^https?:\/\//i.test(value)) {
    return `https://${value}`;
  }
  return value;
}

export const API_URL = resolveApiUrl(process.env.EXPO_PUBLIC_API_URL);

export const ADMIN_API_URL = resolveApiUrl(
  process.env.EXPO_PUBLIC_ADMIN_API_URL || process.env.EXPO_PUBLIC_API_URL,
);

/** Minimum password length — must match server POST /api/auth/reset-password. */
export const PASSWORD_RESET_MIN_LENGTH = 6;

let pendingResetToken: string | null = null;

export function parsePasswordResetToken(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const lower = url.toLowerCase();
  if (!lower.includes('reset-password')) return null;

  const tokenMatch = url.match(/[?&]token=([^&#]+)/i);
  const token = tokenMatch?.[1] ? decodeURIComponent(tokenMatch[1]).trim() : '';
  return token || null;
}

export function stashPasswordResetToken(token: string): void {
  const trimmed = token.trim();
  if (trimmed) pendingResetToken = trimmed;
}

export function consumePasswordResetToken(): string | null {
  const token = pendingResetToken;
  pendingResetToken = null;
  return token;
}

export function readWebPasswordResetToken(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const path = window.location.pathname.replace(/\/$/, '');
  if (path !== '/reset-password') return undefined;
  const token = new URLSearchParams(window.location.search).get('token')?.trim();
  return token || undefined;
}

import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { CommonActions } from '@react-navigation/native';

import { getNavigationRef } from '@/components/ErrorFallback';
import { parsePasswordResetToken, stashPasswordResetToken } from '@/utils/passwordResetDeepLink';

function safeNavigateToResetPassword(token: string): boolean {
  try {
    const nav = getNavigationRef();
    if (!nav?.isReady?.()) return false;
    nav.dispatch(
      CommonActions.navigate({
        name: 'ResetPassword',
        params: { token },
      }),
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Auth stack only — warm reset links while signed out.
 * Cold-start getInitialURL is owned by App.tsx (single read); AuthStack initial
 * route consumes the stashed token from passwordResetDeepLink.ts.
 */
export function useAuthPasswordResetDeepLinks(): void {
  const handledRef = useRef<string | null>(null);
  const deferRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearTimers = () => {
      if (deferRef.current) {
        clearTimeout(deferRef.current);
        deferRef.current = null;
      }
      if (retryTimerRef.current) {
        clearInterval(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (cancelRetryRef.current) {
        clearTimeout(cancelRetryRef.current);
        cancelRetryRef.current = null;
      }
    };

    const openReset = (url: string | null | undefined) => {
      const token = parsePasswordResetToken(url);
      if (!token || handledRef.current === token) return;
      handledRef.current = token;
      stashPasswordResetToken(token);

      deferRef.current = setTimeout(() => {
        deferRef.current = null;
        if (safeNavigateToResetPassword(token)) return;
        retryTimerRef.current = setInterval(() => {
          if (safeNavigateToResetPassword(token) && retryTimerRef.current) {
            clearInterval(retryTimerRef.current);
            retryTimerRef.current = null;
          }
        }, 100);
        cancelRetryRef.current = setTimeout(() => {
          if (retryTimerRef.current) {
            clearInterval(retryTimerRef.current);
            retryTimerRef.current = null;
          }
        }, 3000);
      }, 0);
    };

    const sub = Linking.addEventListener('url', ({ url }) => openReset(url));

    return () => {
      sub.remove();
      clearTimers();
    };
  }, []);
}

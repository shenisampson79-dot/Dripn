import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { CommonActions } from '@react-navigation/native';

import { getNavigationRef } from '@/components/ErrorFallback';
import { parsePasswordResetToken, stashPasswordResetToken } from '@/utils/passwordResetDeepLink';

let initialLaunchUrlChecked = false;

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

/** Auth stack only — must run under a mounted stack navigator (not as its sibling). */
export function useAuthPasswordResetDeepLinks(): void {
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    let retryTimer: ReturnType<typeof setInterval> | null = null;
    let cancelRetry: ReturnType<typeof setTimeout> | null = null;

    const openReset = (url: string | null | undefined) => {
      const token = parsePasswordResetToken(url);
      if (!token || handledRef.current === token) return;
      handledRef.current = token;
      stashPasswordResetToken(token);

      const scheduleNavigate = () => {
        if (safeNavigateToResetPassword(token)) return;
        retryTimer = setInterval(() => {
          if (safeNavigateToResetPassword(token) && retryTimer) {
            clearInterval(retryTimer);
            retryTimer = null;
          }
        }, 100);
        cancelRetry = setTimeout(() => {
          if (retryTimer) {
            clearInterval(retryTimer);
            retryTimer = null;
          }
        }, 3000);
      };

      // Defer until AuthStack replaces MainTab after sign-out / cold start.
      setTimeout(scheduleNavigate, 0);
    };

    if (!initialLaunchUrlChecked) {
      initialLaunchUrlChecked = true;
      void Linking.getInitialURL().then(openReset);
    }

    const sub = Linking.addEventListener('url', ({ url }) => openReset(url));

    return () => {
      sub.remove();
      if (retryTimer) clearInterval(retryTimer);
      if (cancelRetry) clearTimeout(cancelRetry);
    };
  }, []);
}

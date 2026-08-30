import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { CommonActions } from '@react-navigation/native';

import { getNavigationRef } from '@/components/ErrorFallback';
import { parsePasswordResetToken, stashPasswordResetToken } from '@/utils/passwordResetDeepLink';

function navigateToResetPassword(token: string): boolean {
  const nav = getNavigationRef();
  if (!nav?.isReady?.()) return false;
  nav.dispatch(
    CommonActions.navigate({
      name: 'ResetPassword',
      params: { token },
    }),
  );
  return true;
}

export function PasswordResetDeepLinkHandler() {
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    const openReset = (url: string | null | undefined) => {
      const token = parsePasswordResetToken(url);
      if (!token || handledRef.current === token) return;
      handledRef.current = token;
      stashPasswordResetToken(token);

      if (navigateToResetPassword(token)) return;

      const retry = setInterval(() => {
        if (navigateToResetPassword(token)) {
          clearInterval(retry);
        }
      }, 100);
      setTimeout(() => clearInterval(retry), 3000);
    };

    void Linking.getInitialURL().then(openReset);
    const sub = Linking.addEventListener('url', ({ url }) => openReset(url));
    return () => sub.remove();
  }, []);

  return null;
}

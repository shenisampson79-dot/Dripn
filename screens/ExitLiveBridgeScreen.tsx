/**
 * Blank stand-in that replaces Live so the camera screen unmounts cleanly.
 * Root navigation runs WHILE the bridge still covers the screen (black),
 * then the bridge pops with animation: 'none' — no Live modal slide, no hub flash.
 */

import React, { useEffect, useRef } from 'react';
import { InteractionManager, StyleSheet, View } from 'react-native';
import { CommonActions, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { getNavigationRef } from '@/components/ErrorFallback';
import { navigateToSubscription } from '@/utils/navigateToSubscription';
import type { LiveExitDestination } from '@/utils/leaveLiveAndNavigate';

export type ExitLiveBridgeParams = {
  destination: LiveExitDestination;
};

type BridgeParamList = {
  ExitLiveBridge: ExitLiveBridgeParams;
};

type Props = {
  navigation: NativeStackNavigationProp<BridgeParamList, 'ExitLiveBridge'>;
  route: RouteProp<BridgeParamList, 'ExitLiveBridge'>;
};

function applyDestination(dest: LiveExitDestination): boolean {
  const root = getNavigationRef();
  if (!root?.isReady()) return false;

  if (dest.kind === 'subscription') {
    navigateToSubscription(root, {
      highlightPlan: dest.highlightPlan,
      scrollToAiTopUp: dest.scrollToAiTopUp,
    });
    return true;
  }

  root.dispatch(
    CommonActions.navigate({
      name: 'StylistTab',
      params: { screen: 'SanityCheck' },
    }),
  );
  return true;
}

export default function ExitLiveBridgeScreen({ navigation, route }: Props) {
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const destination = route.params?.destination || null;

    if (!destination) {
      if (navigation.canGoBack()) navigation.goBack();
      return;
    }

    let finished = false;
    let popTimer: ReturnType<typeof setTimeout> | null = null;

    const popBridgeSoon = () => {
      // Pop after tab switch has committed so the user never sees Stylist hub.
      // ExitLiveBridge is registered with animation: 'none', so this is silent.
      popTimer = setTimeout(() => {
        try {
          if (navigation.canGoBack()) navigation.goBack();
        } catch {
          /* ignore */
        }
      }, 120);
    };

    const navigateThenPopBridge = () => {
      if (finished) return;
      finished = true;

      const ok = applyDestination(destination);
      if (!ok) {
        setTimeout(() => {
          applyDestination(destination);
          popBridgeSoon();
        }, 200);
        return;
      }
      popBridgeSoon();
    };

    const handle = InteractionManager.runAfterInteractions(() => {
      setTimeout(navigateThenPopBridge, 40);
    });

    const hardFallback = setTimeout(navigateThenPopBridge, 500);

    return () => {
      handle.cancel?.();
      clearTimeout(hardFallback);
      if (popTimer) clearTimeout(popTimer);
    };
  }, [navigation, route.params?.destination]);

  return <View style={styles.root} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
});

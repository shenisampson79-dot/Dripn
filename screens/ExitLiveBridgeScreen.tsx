/**
 * Blank stand-in that replaces Live so the camera screen unmounts cleanly.
 * Navigation to Subscription / Sanity Check runs only AFTER this bridge pops —
 * never during Live teardown.
 */

import React, { useEffect, useRef } from 'react';
import { InteractionManager, StyleSheet, View } from 'react-native';
import { CommonActions, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { getNavigationRef } from '@/components/ErrorFallback';
import { navigateToSubscription } from '@/utils/navigateToSubscription';
import {
  peekPendingLiveExit,
  takePendingLiveExit,
  type LiveExitDestination,
} from '@/utils/leaveLiveAndNavigate';

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
    navigateToSubscription(root, dest.highlightPlan);
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

function scheduleRootNavigate(dest: LiveExitDestination) {
  let done = false;
  const attempt = () => {
    if (done) return;
    if (applyDestination(dest)) {
      done = true;
    }
  };

  InteractionManager.runAfterInteractions(() => {
    setTimeout(attempt, 80);
  });
  // Retry if root ref was not ready on first tick
  setTimeout(attempt, 250);
  setTimeout(attempt, 500);
}

export default function ExitLiveBridgeScreen({ navigation, route }: Props) {
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const destination =
      route.params?.destination || peekPendingLiveExit() || null;

    if (!destination) {
      if (navigation.canGoBack()) navigation.goBack();
      return;
    }

    let finished = false;

    const dismissThenNavigate = () => {
      if (finished) return;
      finished = true;
      try {
        if (navigation.canGoBack()) navigation.goBack();
      } catch {
        /* ignore */
      }
      const dest = takePendingLiveExit() || destination;
      scheduleRootNavigate(dest);
    };

    // Live (camera) is already gone — InteractionManager is safe here.
    const handle = InteractionManager.runAfterInteractions(() => {
      setTimeout(dismissThenNavigate, 80);
    });

    const hardFallback = setTimeout(dismissThenNavigate, 700);

    return () => {
      handle.cancel?.();
      clearTimeout(hardFallback);
    };
  }, [navigation, route.params?.destination]);

  // Never intercept touches — blank pass-through while briefly on screen
  return <View style={styles.root} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
});

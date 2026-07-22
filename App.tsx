/**
 * Dripn - AI-Powered Fashion Advice Platform
 * 
 * Copyright (c) 2025 Dripn. All rights reserved.
 * 
 * This source code is proprietary and confidential. Unauthorized copying,
 * modification, distribution, or use of this software, via any medium,
 * is strictly prohibited without express written permission from Dripn.
 * 
 * Dripn, the Dripn logo, "Style that flows", Ruby AI Stylist, and Max AI Stylist
 * are trademarks of Dripn.
 * 
 * For licensing inquiries: legal@dripnapp.com
 */

import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, Modal, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer, NavigationContainerRef, useNavigation } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Updates from "expo-updates";

import PrivacyPolicyScreen from "@/screens/PrivacyPolicyScreen";
import TermsOfServiceScreen from "@/screens/TermsOfServiceScreen";
import AnalyticsDashboard from "@/screens/AnalyticsDashboard";
import AdminLoginScreen from "@/screens/AdminLoginScreen";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import AuthStackNavigator from "@/navigation/AuthStackNavigator";
import StylistStackNavigator from "@/navigation/StylistStackNavigator";
import CreatePostScreen from "@/screens/CreatePostScreen";
import AskStylistScreen from "@/screens/AskStylistScreen";
import { AppTour } from "@/components/AppTour";
import { apiService } from "@/services/ApiService";
import {
  getTourSeenStorageKey,
  persistTourSeenLocally,
} from "@/services/UserProfileSyncService";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingScreen } from "@/components/LoadingScreen";
import { setNavigationRef, getNavigationRef } from "@/components/ErrorFallback";
import { navigateToSubscription } from "@/utils/navigateToSubscription";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { PostsProvider } from "@/contexts/PostsContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { EventsFavoritesProvider } from "@/contexts/EventsFavoritesContext";
import { EventsPreferencesProvider } from "@/contexts/EventsPreferencesContext";
import { OutfitFavoritesProvider } from "@/contexts/OutfitFavoritesContext";
import { StylistAuthProvider, useStylistAuth } from "@/contexts/StylistAuthContext";
import { AdminAuthProvider, useAdminAuth } from "@/contexts/AdminAuthContext";
import { ReferralProvider } from "@/contexts/ReferralContext";
import { StyleProfileProvider } from "@/contexts/StyleProfileContext";
import { SmartNotificationsProvider } from "@/contexts/SmartNotificationsContext";
import { SocialProvider } from "@/contexts/SocialContext";
import { WishlistProvider } from "@/contexts/WishlistContext";
import { SustainabilityProvider } from "@/contexts/SustainabilityContext";
import { WardrobeProvider } from "@/contexts/WardrobeContext";
import { GamificationProvider } from "@/contexts/GamificationContext";
import { MessagingProvider } from "@/contexts/MessagingContext";
import { VoiceSettingsProvider } from "@/contexts/VoiceSettingsContext";
import { BodyProfileProvider } from "@/contexts/BodyProfileContext";
import { TranslationProvider } from "@/contexts/TranslationContext";
import { VoiceCreditsProvider } from "@/hooks/useVoiceCredits";
import { ColorSchemeProvider } from "@/contexts/ColorSchemeContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { SubscriptionSuccessRedirect } from "@/components/SubscriptionSuccessRedirect";
import * as Linking from "expo-linking";
import { stashPendingReferralCode } from "@/contexts/ReferralContext";
import { FEATURE_FLAGS } from "@/constants/featureFlags";

// Keep native splash visible until auth bootstrap finishes (avoids flash to LoadingScreen).
SplashScreen.preventAutoHideAsync().catch(() => {
  /* may fail in web / some envs */
});

export type PortalMode = 'stylist' | 'admin' | null;

function NavigationContainerWithRef() {
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const path = window.location.pathname.replace(/\/$/, '');
    if (path === '/privacy') {
      return <PrivacyPolicyScreen />;
    }
    if (path === '/terms') {
      return <TermsOfServiceScreen />;
    }
    if (path === '/admin/login') {
      return (
        <AdminAuthProvider>
          <NavigationContainer onReady={() => setNavigationRef(null)}>
            <AdminLoginScreen
              navigation={{ goBack: () => { window.location.href = '/'; } } as any}
              onLoginSuccess={() => { window.location.href = '/admin/analytics'; }}
              onExit={() => { window.location.href = '/'; }}
            />
          </NavigationContainer>
        </AdminAuthProvider>
      );
    }
    if (path === '/admin/analytics') {
      return (
        <AdminAuthProvider>
          <NavigationContainer onReady={() => setNavigationRef(null)}>
            <AnalyticsDashboard navigation={{ goBack: () => window.history.back() } as any} route={{} as any} />
          </NavigationContainer>
        </AdminAuthProvider>
      );
    }
  }

  return (
    <NavigationContainer 
      ref={navigationRef}
      onReady={() => setNavigationRef(navigationRef.current)}
    >
      <AppContent />
    </NavigationContainer>
  );
}

const TOUR_SEEN_KEY = '@dripn_tour_seen';

function AppContent() {
  const { isAuthenticated, isLoading, isAuthenticating, user, updateProfile } = useAuth();
  // tourSeen: null = not yet loaded, false = not seen, true = seen
  const [tourSeen, setTourSeen] = useState<boolean | null>(null);
  const [showTour, setShowTour] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showAskStylist, setShowAskStylist] = useState(false);
  const [portalMode, setPortalMode] = useState<PortalMode>(null);
  const navigation = useNavigation<any>();

  // Load the per-user tour flag once we know who is signed in
  useEffect(() => {
    if (!user?.id) {
      setTourSeen(null);
      setShowTour(false);
      return;
    }

    let cancelled = false;
    const loadTourFlag = async () => {
      try {
        const userKey = await AsyncStorage.getItem(getTourSeenStorageKey(user.id));
        const legacyKey = await AsyncStorage.getItem(TOUR_SEEN_KEY);
        const seen =
          userKey === 'true'
          || legacyKey === 'true'
          || user.hasSeenTour === true;
        if (!cancelled) {
          setTourSeen(seen);
          if (seen) setShowTour(false);
        }
      } catch {
        if (!cancelled) setTourSeen(user.hasSeenTour === true);
      }
    };

    loadTourFlag();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.hasSeenTour]);

  // Backend/profile hydration can flip hasSeenTour after login — respect it immediately
  useEffect(() => {
    if (user?.hasSeenTour !== true || !user.id) return;
    setTourSeen(true);
    setShowTour(false);
    persistTourSeenLocally(user.id).catch(() => {});
  }, [user?.id, user?.hasSeenTour]);

  // Show tour only once after onboarding, after auth + profile hydration settle
  useEffect(() => {
    if (tourSeen === null || isLoading || isAuthenticating) return;
    if (tourSeen === true || user?.hasSeenTour === true) return;
    if (!user?.hasCompletedOnboarding) return;
    setShowTour(true);
  }, [tourSeen, user?.id, user?.hasCompletedOnboarding, user?.hasSeenTour, isLoading, isAuthenticating]);

  // Hide native splash once auth bootstrap completes (single handoff, no dual-splash flash).
  useEffect(() => {
    if (isLoading) return;
    SplashScreen.hideAsync().catch(() => {
      /* ignore — already hidden or unsupported */
    });
  }, [isLoading]);

  const handleTourComplete = async () => {
    try {
      await persistTourSeenLocally(user?.id);
    } catch { /* ignore */ }
    setTourSeen(true);
    setShowTour(false);
    updateProfile({ hasSeenTour: true }).catch(() => {});
    apiService.completeTour().catch(() => {});
  };

  // Native splash covers the wait; LoadingScreen is a matching safety net if splash already hid.
  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <AuthStackNavigator initialRouteName="Welcome" />;
  }

  if (user && !user.hasCompletedOnboarding) {
    return <AuthStackNavigator initialRouteName="Onboarding" />;
  }

  const handleCreatePost = () => {
    if (FEATURE_FLAGS.launchSimplified) return;
    setShowAskStylist(true);
  };

  return (
    <>
      <SubscriptionSuccessRedirect />
      <MainTabNavigator 
        onCreatePost={FEATURE_FLAGS.launchSimplified ? undefined : handleCreatePost} 
        onOpenPortal={setPortalMode}
      />
      <Modal
        visible={portalMode !== null}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setPortalMode(null)}
      >
        {portalMode ? (
          <StylistStackNavigator 
            mode={portalMode} 
            onExit={() => setPortalMode(null)} 
          />
        ) : null}
      </Modal>
      <Modal
        visible={showCreatePost}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowCreatePost(false)}
      >
        <CreatePostScreen onClose={() => setShowCreatePost(false)} />
      </Modal>
      <Modal
        visible={!FEATURE_FLAGS.launchSimplified && showAskStylist}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowAskStylist(false)}
      >
        <AskStylistScreen
          navigation={{
            goBack: () => setShowAskStylist(false),
            // Legacy navigate('Subscription') callers — prefer dispatch via navigateToSubscription
            navigate: (name?: string) => {
              if (name === 'Subscription') {
                setShowAskStylist(false);
                const rootNav = getNavigationRef();
                if (rootNav?.isReady()) {
                  navigateToSubscription(rootNav, 'personal_stylist');
                }
              }
            },
            dispatch: (action: any) => {
              setShowAskStylist(false);
              const rootNav = getNavigationRef();
              if (rootNav?.isReady()) {
                rootNav.dispatch(action);
              }
            },
          } as any}
        />
      </Modal>
      <AppTour 
        visible={showTour} 
        onComplete={handleTourComplete} 
      />
    </>
  );
}

export default function App() {
  // Hold splash until we've checked for an OTA update and applied it if needed.
  // Without this, Expo may download the update but keep running the embedded JS
  // until a later cold start — which is why TestFlight can miss EAS Updates.
  const [updatesReady, setUpdatesReady] = useState(__DEV__ || Platform.OS === "web");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (__DEV__ || Platform.OS === "web") {
        if (!cancelled) setUpdatesReady(true);
        return;
      }
      try {
        if (Updates.isEnabled) {
          const result = await Updates.checkForUpdateAsync();
          if (result.isAvailable) {
            await Updates.fetchUpdateAsync();
            await Updates.reloadAsync();
            return; // reload remounts the app on the new bundle
          }
        }
      } catch (error) {
        console.log("[Updates] check/apply skipped:", error);
      }
      if (!cancelled) setUpdatesReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const captureInvite = (url: string | null) => {
      if (!url) return;
      try {
        const parsed = Linking.parse(url);
        const path = `${parsed.path || ''} ${parsed.hostname || ''}`.toLowerCase();
        const codeFromPath = parsed.path?.match(/invite\/([^/?#]+)/i)?.[1]
          || (parsed.path && !parsed.path.includes('/') ? parsed.path : null);
        const code = (parsed.queryParams?.code as string)
          || codeFromPath
          || (path.includes('invite') ? (parsed.queryParams?.referral as string) : null);
        if (code) void stashPendingReferralCode(String(code));
      } catch {
        /* ignore */
      }
    };

    Linking.getInitialURL().then(captureInvite);
    const sub = Linking.addEventListener('url', ({ url }) => captureInvite(url));
    return () => sub.remove();
  }, []);

  if (!updatesReady) {
    return null;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <GestureHandlerRootView style={styles.root}>
          <KeyboardProvider>
            <AuthProvider>
              <StylistAuthProvider>
                <AdminAuthProvider>
                  <SubscriptionProvider>
                    <EventsFavoritesProvider>
                      <EventsPreferencesProvider>
                        <OutfitFavoritesProvider>
                        <PostsProvider>
                          <ReferralProvider>
                            <StyleProfileProvider>
                              <SmartNotificationsProvider>
                                <SocialProvider>
                                  <WishlistProvider>
                                    <SustainabilityProvider>
                                      <WardrobeProvider>
                                        <GamificationProvider>
                                          <MessagingProvider>
                                              <VoiceSettingsProvider>
                                                <ToastProvider>
                                                  <TranslationProvider>
                                                    <VoiceCreditsProvider>
                                                      <BodyProfileProvider>
                                                        <ColorSchemeProvider>
                                                          <NavigationContainerWithRef />
                                                        </ColorSchemeProvider>
                                                      </BodyProfileProvider>
                                                    </VoiceCreditsProvider>
                                                  </TranslationProvider>
                                                </ToastProvider>
                                              </VoiceSettingsProvider>
                                            </MessagingProvider>
                                        </GamificationProvider>
                                      </WardrobeProvider>
                                    </SustainabilityProvider>
                                  </WishlistProvider>
                                </SocialProvider>
                              </SmartNotificationsProvider>
                            </StyleProfileProvider>
                          </ReferralProvider>
                        </PostsProvider>
                      </OutfitFavoritesProvider>
                      </EventsPreferencesProvider>
                    </EventsFavoritesProvider>
                  </SubscriptionProvider>
                </AdminAuthProvider>
              </StylistAuthProvider>
            </AuthProvider>
            <StatusBar style="auto" />
          </KeyboardProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

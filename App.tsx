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
 * For licensing inquiries: legal@dripn.app
 */

import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, Modal, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NavigationContainer, NavigationContainerRef, useNavigation } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import PrivacyPolicyScreen from "@/screens/PrivacyPolicyScreen";
import TermsOfServiceScreen from "@/screens/TermsOfServiceScreen";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import AuthStackNavigator from "@/navigation/AuthStackNavigator";
import StylistStackNavigator from "@/navigation/StylistStackNavigator";
import CreatePostScreen from "@/screens/CreatePostScreen";
import AskStylistScreen from "@/screens/AskStylistScreen";
import { AppTour } from "@/components/AppTour";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingScreen } from "@/components/LoadingScreen";
import { setNavigationRef } from "@/components/ErrorFallback";
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
import { ColorSchemeProvider } from "@/contexts/ColorSchemeContext";
import { ToastProvider } from "@/contexts/ToastContext";

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
  const { isAuthenticated, isLoading, user, updateProfile } = useAuth();
  // tourSeen: null = not yet loaded, false = not seen, true = seen
  const [tourSeen, setTourSeen] = useState<boolean | null>(null);
  const [showTour, setShowTour] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showAskStylist, setShowAskStylist] = useState(false);
  const [portalMode, setPortalMode] = useState<PortalMode>(null);
  const navigation = useNavigation<any>();

  // Load the device tour flag once on mount — this is the single source of truth
  useEffect(() => {
    AsyncStorage.getItem(TOUR_SEEN_KEY)
      .then(val => setTourSeen(val === 'true'))
      .catch(() => setTourSeen(false));
  }, []);

  // Show tour only for first-time users who have completed onboarding and have not seen it before
  useEffect(() => {
    if (tourSeen === null || isLoading) return; // Still loading device flag or auth
    if (tourSeen === true) return;              // Already seen on this device — never show
    if (!user) return;
    if (user.hasSeenTour === true) return;       // Backend already knows they saw it
    if (!user.hasCompletedOnboarding) return;   // Don't show until onboarding is done
    setShowTour(true);
  }, [tourSeen, user?.id, user?.hasCompletedOnboarding, user?.hasSeenTour, isLoading]);

  const handleTourComplete = async () => {
    // Write device flag immediately — this is what prevents future tour displays
    try {
      await AsyncStorage.setItem(TOUR_SEEN_KEY, 'true');
    } catch { /* ignore */ }
    setTourSeen(true);
    setShowTour(false);
    // Sync to user profile + backend (best effort, failure does NOT affect tour logic)
    updateProfile({ hasSeenTour: true }).catch(() => {});
  };

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
    setShowAskStylist(true);
  };

  return (
    <>
      <MainTabNavigator 
        onCreatePost={handleCreatePost} 
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
        visible={showAskStylist}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowAskStylist(false)}
      >
        <AskStylistScreen 
          navigation={{ goBack: () => setShowAskStylist(false), navigate: () => {} } as any} 
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
                                                    <BodyProfileProvider>
                                                      <ColorSchemeProvider>
                                                        <NavigationContainerWithRef />
                                                      </ColorSchemeProvider>
                                                    </BodyProfileProvider>
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

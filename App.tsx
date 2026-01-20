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
import { StyleSheet, Modal } from "react-native";
import { NavigationContainer, NavigationContainerRef, useNavigation } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

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

export type PortalMode = 'stylist' | 'admin' | null;

function NavigationContainerWithRef() {
  const navigationRef = useRef<NavigationContainerRef<any>>(null);
  
  return (
    <NavigationContainer 
      ref={navigationRef}
      onReady={() => setNavigationRef(navigationRef.current)}
    >
      <AppContent />
    </NavigationContainer>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [showTour, setShowTour] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showAskStylist, setShowAskStylist] = useState(false);
  const [portalMode, setPortalMode] = useState<PortalMode>(null);
  const navigation = useNavigation<any>();

  useEffect(() => {
    if (user && user.hasCompletedOnboarding && !user.hasSeenTour) {
      setShowTour(true);
    }
  }, [user?.hasCompletedOnboarding, user?.hasSeenTour]);

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
        onComplete={() => setShowTour(false)} 
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
                                                <TranslationProvider>
                                                  <BodyProfileProvider>
                                                    <ColorSchemeProvider>
                                                      <NavigationContainerWithRef />
                                                    </ColorSchemeProvider>
                                                  </BodyProfileProvider>
                                                </TranslationProvider>
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

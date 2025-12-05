import React, { useState, useEffect } from "react";
import { StyleSheet, Modal, ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import MainTabNavigator from "@/navigation/MainTabNavigator";
import AuthStackNavigator from "@/navigation/AuthStackNavigator";
import CreatePostScreen from "@/screens/CreatePostScreen";
import { AppTour } from "@/components/AppTour";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { PostsProvider } from "@/contexts/PostsContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { EventsFavoritesProvider } from "@/contexts/EventsFavoritesContext";
import { OutfitFavoritesProvider } from "@/contexts/OutfitFavoritesContext";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { theme } = useTheme();
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    if (user && user.hasCompletedOnboarding && !user.hasSeenTour) {
      setShowTour(true);
    }
  }, [user?.hasCompletedOnboarding, user?.hasSeenTour]);

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.link} />
      </ThemedView>
    );
  }

  if (!isAuthenticated) {
    return <AuthStackNavigator initialRouteName="Welcome" />;
  }

  if (user && !user.hasCompletedOnboarding) {
    return <AuthStackNavigator initialRouteName="Onboarding" />;
  }

  return (
    <>
      <MainTabNavigator onCreatePost={() => setShowCreatePost(true)} />
      <Modal
        visible={showCreatePost}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreatePost(false)}
      >
        <CreatePostScreen onClose={() => setShowCreatePost(false)} />
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
              <SubscriptionProvider>
                <EventsFavoritesProvider>
                  <OutfitFavoritesProvider>
                    <PostsProvider>
                    <NavigationContainer>
                      <AppContent />
                    </NavigationContainer>
                    </PostsProvider>
                  </OutfitFavoritesProvider>
                </EventsFavoritesProvider>
              </SubscriptionProvider>
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
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

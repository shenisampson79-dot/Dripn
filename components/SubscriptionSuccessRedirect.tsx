import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { CommonActions, useNavigation } from "@react-navigation/native";
import * as Linking from "expo-linking";
import { useAuth } from "@/contexts/AuthContext";

function parseSuccessDeepLink(url: string): string | undefined | null {
  const parsed = Linking.parse(url);
  const path = (parsed.path ?? "").replace(/^\//, "");
  const status = parsed.queryParams?.status;
  const sessionId = parsed.queryParams?.session_id;

  if (path === "subscription-success" || path.includes("subscription-success")) {
    return typeof sessionId === "string" ? sessionId : undefined;
  }

  if (path === "subscription" && status === "success") {
    return typeof sessionId === "string" ? sessionId : undefined;
  }

  return null;
}

export function SubscriptionSuccessRedirect() {
  const navigation = useNavigation<any>();
  const { isAuthenticated, isLoading, user } = useAuth();
  const handledRef = useRef(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user?.hasCompletedOnboarding || handledRef.current) {
      return;
    }

    const navigateToSuccess = (sessionId?: string) => {
      handledRef.current = true;
      navigation.dispatch(
        CommonActions.navigate({
          name: "ProfileTab",
          params: {
            screen: "SubscriptionSuccess",
            params: sessionId ? { sessionId } : undefined,
          },
        })
      );

      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.history.replaceState({}, "", "/");
      }
    };

    if (Platform.OS === "web" && typeof window !== "undefined") {
      const path = window.location.pathname.replace(/\/$/, "");
      if (path === "/subscription-success") {
        const params = new URLSearchParams(window.location.search);
        navigateToSuccess(params.get("session_id") ?? undefined);
        return;
      }
    }

    Linking.getInitialURL().then((url) => {
      if (!url || handledRef.current) return;
      const sessionId = parseSuccessDeepLink(url);
      if (sessionId !== null) navigateToSuccess(sessionId);
    });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      if (handledRef.current) return;
      const sessionId = parseSuccessDeepLink(url);
      if (sessionId !== null) navigateToSuccess(sessionId);
    });

    return () => subscription.remove();
  }, [isAuthenticated, isLoading, navigation, user?.hasCompletedOnboarding]);

  return null;
}

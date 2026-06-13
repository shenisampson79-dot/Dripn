import React from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { CancelSubscriptionFlow } from "@/components/CancelSubscriptionFlow";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

type CancelSubscriptionScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "CancelSubscription">;
};

export default function CancelSubscriptionScreen({ navigation }: CancelSubscriptionScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScreenScrollView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.closeButton}>
          <Feather name="x" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h3">Cancel Subscription</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <CancelSubscriptionFlow
        navigation={navigation}
        onComplete={() => navigation.goBack()}
      />
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});

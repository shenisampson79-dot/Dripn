import React, { useState } from "react";
import { StyleSheet, View, TextInput, Pressable, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

type AdminLoginScreenProps = {
  navigation: NativeStackNavigationProp<any>;
  onLoginSuccess?: () => void;
  onExit?: () => void;
};

export default function AdminLoginScreen({ navigation, onLoginSuccess, onExit }: AdminLoginScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { login, setupAdmin, isLoading } = useAdminAuth();

  const [mode, setMode] = useState<'login' | 'setup'>('login');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [setupKey, setSetupKey] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    try {
      await login(email, password);
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (error: any) {
      Alert.alert("Login Failed", error.message || "Please check your credentials and try again.");
    }
  };

  const handleSetup = async () => {
    if (!email || !password || !displayName || !setupKey) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    try {
      await setupAdmin(email, password, displayName, setupKey);
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (error: any) {
      Alert.alert("Setup Failed", error.message || "Please check your setup key and try again.");
    }
  };

  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.backgroundDefault,
      color: theme.text,
      borderColor: theme.border,
    },
  ];

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <Pressable
          onPress={onExit}
          style={({ pressed }) => [
            styles.backButton,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="x" size={24} color={theme.text} />
        </Pressable>
      </View>

      <ScreenKeyboardAwareScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}
      >
        <View style={styles.iconContainer}>
          <View style={[styles.iconCircle, { backgroundColor: '#EF444420' }]}>
            <Feather name="shield" size={48} color="#EF4444" />
          </View>
        </View>

        <View style={styles.titleContainer}>
          <ThemedText type="h1" style={styles.title}>
            Admin Portal
          </ThemedText>
          <ThemedText type="body" style={styles.subtitle}>
            {mode === 'login' 
              ? "Sign in to manage stylists and sessions"
              : "Set up your admin account"}
          </ThemedText>
        </View>

        <View style={styles.modeToggle}>
          <Pressable
            onPress={() => setMode('login')}
            style={[
              styles.modeButton,
              { backgroundColor: mode === 'login' ? theme.link : theme.backgroundSecondary },
            ]}
          >
            <ThemedText type="small" style={{ color: mode === 'login' ? '#FFFFFF' : theme.text }}>
              Sign In
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setMode('setup')}
            style={[
              styles.modeButton,
              { backgroundColor: mode === 'setup' ? theme.link : theme.backgroundSecondary },
            ]}
          >
            <ThemedText type="small" style={{ color: mode === 'setup' ? '#FFFFFF' : theme.text }}>
              First Time Setup
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.form}>
          {mode === 'setup' ? (
            <>
              <View style={styles.fieldContainer}>
                <ThemedText type="small" style={styles.label}>
                  Your Name
                </ThemedText>
                <TextInput
                  style={inputStyle}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Admin Name"
                  placeholderTextColor={isDark ? "#9BA1A6" : "#687076"}
                  editable={!isLoading}
                />
              </View>

              <View style={styles.fieldContainer}>
                <ThemedText type="small" style={styles.label}>
                  Setup Key
                </ThemedText>
                <TextInput
                  style={inputStyle}
                  value={setupKey}
                  onChangeText={setSetupKey}
                  placeholder="Enter setup key"
                  placeholderTextColor={isDark ? "#9BA1A6" : "#687076"}
                  secureTextEntry
                  editable={!isLoading}
                />
              </View>
            </>
          ) : null}

          <View style={styles.fieldContainer}>
            <ThemedText type="small" style={styles.label}>
              Email
            </ThemedText>
            <TextInput
              style={inputStyle}
              value={email}
              onChangeText={setEmail}
              placeholder="admin@stylewise.com"
              placeholderTextColor={isDark ? "#9BA1A6" : "#687076"}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
              editable={!isLoading}
            />
          </View>

          <View style={styles.fieldContainer}>
            <ThemedText type="small" style={styles.label}>
              Password
            </ThemedText>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[inputStyle, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={isDark ? "#9BA1A6" : "#687076"}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={mode === 'login' ? handleLogin : handleSetup}
                editable={!isLoading}
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={styles.passwordToggle}
              >
                <Feather
                  name={showPassword ? "eye-off" : "eye"}
                  size={20}
                  color={theme.tabIconDefault}
                />
              </Pressable>
            </View>
          </View>

          <Button
            title={isLoading ? (mode === 'login' ? "Signing In..." : "Setting Up...") : (mode === 'login' ? "Sign In" : "Create Admin Account")}
            onPress={mode === 'login' ? handleLogin : handleSetup}
            disabled={isLoading}
            style={[styles.button, { backgroundColor: '#EF4444' }]}
          />

          {isLoading ? (
            <ActivityIndicator size="small" color="#EF4444" style={styles.loader} />
          ) : null}
        </View>

        <View style={styles.infoContainer}>
          <View style={[styles.infoBox, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="lock" size={16} color={theme.tabIconDefault} />
            <ThemedText type="small" style={styles.infoText}>
              Admin access is restricted to authorized personnel only. Contact the system administrator if you need access.
            </ThemedText>
          </View>
        </View>
      </ScreenKeyboardAwareScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: -Spacing.sm,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  titleContainer: {
    marginBottom: Spacing.lg,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    textAlign: "center",
    opacity: 0.7,
  },
  modeToggle: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  modeButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  form: {
    gap: Spacing.lg,
  },
  fieldContainer: {
    gap: Spacing.xs,
  },
  label: {
    fontWeight: "600",
  },
  input: {
    height: 50,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: Typography.body.fontSize,
    borderWidth: 1,
  },
  passwordContainer: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 50,
  },
  passwordToggle: {
    position: "absolute",
    right: 0,
    top: 0,
    height: 50,
    width: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  button: {
    marginTop: Spacing.md,
  },
  loader: {
    marginTop: Spacing.md,
  },
  infoContainer: {
    marginTop: Spacing.xxl,
  },
  infoBox: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    alignItems: "flex-start",
  },
  infoText: {
    flex: 1,
    opacity: 0.8,
  },
});

import React, { useState } from "react";
import { StyleSheet, View, TextInput, Pressable, ActivityIndicator, Alert, Platform, ScrollView, KeyboardAvoidingView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
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
  const { login, isLoading } = useAdminAuth();

  const [mode, setMode] = useState<'login' | 'setup'>('login');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + Spacing.md,
              paddingBottom: insets.bottom + Spacing.xl,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Pressable
              onPress={onExit}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              style={({ pressed }) => [
                styles.backButton,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

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
                ? "Sign in for app dashboard, analytics, and staff tools"
                : "How to create the first admin account"}
            </ThemedText>
          </View>

          <View style={styles.modeToggle}>
            <Pressable
              onPress={() => setMode('login')}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              style={({ pressed }) => [
                styles.modeButton,
                {
                  backgroundColor: mode === 'login' ? theme.link : theme.backgroundSecondary,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <ThemedText type="small" style={{ color: mode === 'login' ? '#FFFFFF' : theme.text, fontWeight: '600' }}>
                Sign In
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setMode('setup')}
              hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              style={({ pressed }) => [
                styles.modeButton,
                {
                  backgroundColor: mode === 'setup' ? theme.link : theme.backgroundSecondary,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <ThemedText type="small" style={{ color: mode === 'setup' ? '#FFFFFF' : theme.text, fontWeight: '600' }}>
                First Admin?
              </ThemedText>
            </Pressable>
          </View>

          {mode === 'setup' ? (
            <View style={[styles.instructionsBox, { backgroundColor: theme.backgroundSecondary }]}>
              <ThemedText type="body" style={styles.instructionsTitle}>
                Admin accounts are created on the server
              </ThemedText>
              <ThemedText type="small" style={styles.instructionsText}>
                The app cannot create the first admin. A server administrator must provision one first, then you sign in here.
              </ThemedText>

              <View style={styles.instructionStep}>
                <ThemedText type="small" style={styles.stepLabel}>
                  Option 1 — Dripn-Server script
                </ThemedText>
                <ThemedText type="small" style={[styles.codeText, { color: theme.text, backgroundColor: theme.backgroundDefault }]}>
                  node scripts/create-admin.mjs
                </ThemedText>
              </View>

              <View style={styles.instructionStep}>
                <ThemedText type="small" style={styles.stepLabel}>
                  Option 2 — Render environment variables
                </ThemedText>
                <ThemedText type="small" style={styles.instructionsText}>
                  Set ADMIN_EMAIL and ADMIN_PASSWORD_HASH on the Dripn-Server Render service, then redeploy.
                </ThemedText>
              </View>

              <Pressable
                onPress={() => setMode('login')}
                style={({ pressed }) => [
                  styles.submitButton,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <ThemedText type="body" style={styles.submitButtonText}>
                  Go to Sign In
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <View style={styles.form}>
              <View style={styles.fieldContainer}>
                <ThemedText type="small" style={styles.label}>
                  Email
                </ThemedText>
                <TextInput
                  style={inputStyle}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="admin@dripn.com"
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
                    onSubmitEditing={handleLogin}
                    editable={!isLoading}
                  />
                  <Pressable
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.passwordToggle}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather
                      name={showPassword ? "eye-off" : "eye"}
                      size={20}
                      color={theme.tabIconDefault}
                    />
                  </Pressable>
                </View>
              </View>

              <Pressable
                onPress={isLoading ? undefined : handleLogin}
                disabled={isLoading}
                style={({ pressed }) => [
                  styles.submitButton,
                  { opacity: isLoading ? 0.6 : pressed ? 0.85 : 1 },
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ThemedText type="body" style={styles.submitButtonText}>
                    Sign In
                  </ThemedText>
                )}
              </Pressable>
            </View>
          )}

          <View style={styles.infoContainer}>
            <View style={[styles.infoBox, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="lock" size={16} color={theme.tabIconDefault} />
              <ThemedText type="small" style={styles.infoText}>
                Admin access is restricted to authorized personnel only. Contact the system administrator if you need access.
              </ThemedText>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
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
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
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
  submitButton: {
    marginTop: Spacing.md,
    height: 52,
    borderRadius: BorderRadius.full,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  infoContainer: {
    marginTop: Spacing["2xl"],
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
  instructionsBox: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  instructionsTitle: {
    fontWeight: '600',
  },
  instructionsText: {
    opacity: 0.8,
    lineHeight: 20,
  },
  instructionStep: {
    gap: Spacing.xs,
  },
  stepLabel: {
    fontWeight: '600',
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
});

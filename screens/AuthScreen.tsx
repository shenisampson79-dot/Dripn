import React, { useState } from "react";
import { StyleSheet, View, TextInput, Pressable, ActivityIndicator, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Feather, FontAwesome } from "@expo/vector-icons";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import type { AuthStackParamList } from "@/navigation/AuthStackNavigator";

type AuthScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "Auth">;
  route: RouteProp<AuthStackParamList, "Auth">;
};

export default function AuthScreen({ navigation, route }: AuthScreenProps) {
  const { mode } = route.params;
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { login, signup, socialLogin, isAuthenticating } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSignup = mode === "signup";

  const handleSocialAuth = async (provider: 'google' | 'facebook' | 'apple') => {
    setSocialLoading(provider);
    setErrorMessage(null);
    try {
      await socialLogin(provider);
      navigation.replace("Onboarding");
    } catch (error) {
      const message = `Could not sign in with ${provider.charAt(0).toUpperCase() + provider.slice(1)}. Please try again.`;
      setErrorMessage(message);
    } finally {
      setSocialLoading(null);
    }
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    
    if (!email || !password) {
      setErrorMessage("Please fill in all required fields");
      return;
    }

    if (isSignup && !name) {
      setErrorMessage("Please enter your name");
      return;
    }

    try {
      if (isSignup) {
        await signup(email, password, name);
      } else {
        await login(email, password);
      }
      navigation.replace("Onboarding");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Authentication failed. Please try again.";
      setErrorMessage(errorMsg);
    }
  };

  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.backgroundDefault,
      color: theme.text,
    },
  ];

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.backButton,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
      </View>

      <ScreenKeyboardAwareScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}
      >
        <View style={styles.titleContainer}>
          <ThemedText type="h1" style={styles.title}>
            {isSignup ? "Create Account" : "Welcome Back"}
          </ThemedText>
          <ThemedText type="body" style={styles.subtitle}>
            {isSignup
              ? "Join the Dripn community"
              : "Sign in to continue your style journey"}
          </ThemedText>
        </View>

        <View style={styles.socialButtonsContainer}>
          <Pressable
            onPress={() => handleSocialAuth('google')}
            disabled={socialLoading !== null || isAuthenticating}
            style={({ pressed }) => [
              styles.socialButton,
              { 
                backgroundColor: '#FFFFFF',
                borderColor: theme.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            {socialLoading === 'google' ? (
              <ActivityIndicator color="#DB4437" size="small" />
            ) : (
              <>
                <FontAwesome name="google" size={20} color="#DB4437" />
                <ThemedText style={[styles.socialButtonText, { color: '#333333' }]}>
                  Continue with Google
                </ThemedText>
              </>
            )}
          </Pressable>

          <Pressable
            onPress={() => handleSocialAuth('facebook')}
            disabled={socialLoading !== null || isAuthenticating}
            style={({ pressed }) => [
              styles.socialButton,
              { 
                backgroundColor: '#1877F2',
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            {socialLoading === 'facebook' ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <FontAwesome name="facebook" size={20} color="#FFFFFF" />
                <ThemedText style={[styles.socialButtonText, { color: '#FFFFFF' }]}>
                  Continue with Facebook
                </ThemedText>
              </>
            )}
          </Pressable>

          {Platform.OS === 'ios' ? (
            <Pressable
              onPress={() => handleSocialAuth('apple')}
              disabled={socialLoading !== null || isAuthenticating}
              style={({ pressed }) => [
                styles.socialButton,
                { 
                  backgroundColor: isDark ? '#FFFFFF' : '#000000',
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              {socialLoading === 'apple' ? (
                <ActivityIndicator color={isDark ? '#000000' : '#FFFFFF'} size="small" />
              ) : (
                <>
                  <FontAwesome name="apple" size={22} color={isDark ? '#000000' : '#FFFFFF'} />
                  <ThemedText style={[styles.socialButtonText, { color: isDark ? '#000000' : '#FFFFFF' }]}>
                    Continue with Apple
                  </ThemedText>
                </>
              )}
            </Pressable>
          ) : null}
        </View>

        <View style={styles.dividerContainer}>
          <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          <ThemedText type="small" style={styles.dividerText}>or</ThemedText>
          <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
        </View>

        <View style={styles.form}>
          {isSignup ? (
            <View style={styles.fieldContainer}>
              <ThemedText type="small" style={styles.label}>
                Full Name
              </ThemedText>
              <TextInput
                style={inputStyle}
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                placeholderTextColor={isDark ? "#9BA1A6" : "#687076"}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
          ) : null}

          <View style={styles.fieldContainer}>
            <ThemedText type="small" style={styles.label}>
              Email
            </ThemedText>
            <TextInput
              style={inputStyle}
              value={email}
              onChangeText={setEmail}
              placeholder="your.email@example.com"
              placeholderTextColor={isDark ? "#9BA1A6" : "#687076"}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
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
                autoCapitalize="none"
                returnKeyType="done"
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

          {errorMessage ? (
            <View style={styles.errorContainer}>
              <Feather name="alert-circle" size={16} color="#DC2626" />
              <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
            </View>
          ) : null}

          <Button onPress={handleSubmit} disabled={isAuthenticating} style={styles.submitButton}>
            {isAuthenticating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : isSignup ? (
              "Create Account"
            ) : (
              "Sign In"
            )}
          </Button>

          <Pressable
            onPress={() =>
              navigation.setParams({ mode: isSignup ? "login" : "signup" })
            }
            style={({ pressed }) => [
              styles.switchMode,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <ThemedText type="body" style={styles.switchModeText}>
              {isSignup ? "Already have an account? " : "Don't have an account? "}
              <ThemedText type="link" style={styles.linkText}>
                {isSignup ? "Sign In" : "Sign Up"}
              </ThemedText>
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.termsContainer}>
          <ThemedText type="small" style={styles.termsText}>
            By continuing, you agree to our{" "}
            <ThemedText type="link" style={styles.termsLink}>
              Terms of Service
            </ThemedText>{" "}
            and{" "}
            <ThemedText type="link" style={styles.termsLink}>
              Privacy Policy
            </ThemedText>
          </ThemedText>
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
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
  },
  titleContainer: {
    marginBottom: Spacing.xl,
  },
  socialButtonsContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: "transparent",
  },
  socialButtonText: {
    fontSize: Typography.body.fontSize,
    fontWeight: "600",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    opacity: 0.6,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  subtitle: {
    opacity: 0.7,
  },
  form: {
    gap: Spacing.lg,
  },
  fieldContainer: {
    width: "100%",
  },
  label: {
    marginBottom: Spacing.sm,
    fontWeight: "600",
    opacity: 0.8,
  },
  input: {
    height: Spacing.inputHeight,
    borderWidth: 0,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: Typography.body.fontSize,
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
    height: Spacing.inputHeight,
    width: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButton: {
    marginTop: Spacing.md,
  },
  switchMode: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  switchModeText: {
    textAlign: "center",
  },
  linkText: {
    fontWeight: "600",
  },
  termsContainer: {
    marginTop: "auto",
    paddingTop: Spacing["2xl"],
  },
  termsText: {
    textAlign: "center",
    opacity: 0.6,
  },
  termsLink: {
    fontSize: 14,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    flex: 1,
  },
});

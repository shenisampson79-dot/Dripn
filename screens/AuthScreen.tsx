import React, { useState, useEffect } from "react";
import { StyleSheet, View, TextInput, Pressable, ActivityIndicator, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Feather, FontAwesome } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import { Spacing, BorderRadius, Typography, LuxuryColors, ScreenGradients } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslations } from "@/contexts/TranslationContext";
import { apiService } from "@/services/ApiService";
import type { AuthStackParamList } from "@/navigation/AuthStackNavigator";
import { LanguageEntryButton, LanguagePickerModal } from "@/components/LanguagePickerModal";

WebBrowser.maybeCompleteAuthSession();

/** Hide Apple/Google/Facebook until OAuth is configured & verified. Re-enable after App Review. */
const SHOW_SOCIAL_LOGIN = false;

type AuthScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "Auth">;
  route: RouteProp<AuthStackParamList, "Auth">;
};

export default function AuthScreen({ navigation, route }: AuthScreenProps) {
  const { mode } = route.params;
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { login, signup, socialLogin, googleLoginWithTokens, isAuthenticating } = useAuth();
  const { t } = useTranslations();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);

  const isSignup = mode === "signup";

  const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';
  const googleIosClientId =
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
    || Constants.expoConfig?.ios?.config?.googleSignIn?.reservedClientId
    || googleClientId;

  // Google OAuth hook — uses authorization code + PKCE (correct modern flow)
  const redirectUrl = AuthSession.makeRedirectUri({ scheme: 'dripn' });
  const [googleRequest, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    clientId: googleClientId,
    iosClientId: googleIosClientId,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || googleClientId,
    redirectUri: redirectUrl,
    scopes: ['openid', 'profile', 'email'],
  });

  useEffect(() => {
    if (!googleResponse) return;
    if (googleResponse.type === 'success') {
      (async () => {
        try {
          let accessToken = '';
          let idToken: string | undefined;

          // If we already have tokens (implicit / token flow)
          if (googleResponse.authentication?.accessToken) {
            accessToken = googleResponse.authentication.accessToken;
            idToken = googleResponse.authentication.idToken ?? undefined;
          } else if (googleResponse.params?.code && googleRequest) {
            const tokenResult = await AuthSession.exchangeCodeAsync(
              {
                clientId: Platform.OS === 'ios' ? googleIosClientId : googleClientId,
                code: googleResponse.params.code,
                redirectUri: redirectUrl,
                extraParams: {
                  code_verifier: googleRequest.codeVerifier || '',
                },
              },
              {
                tokenEndpoint: 'https://oauth2.googleapis.com/token',
              },
            );
            accessToken = tokenResult.accessToken;
            idToken = tokenResult.idToken ?? undefined;
          } else {
            throw new Error('No tokens in Google response');
          }

          await googleLoginWithTokens(accessToken, idToken);
          navigation.replace("Onboarding");
        } catch (error) {
          setErrorMessage('Could not sign in with Google. Please try again.');
        } finally {
          setSocialLoading(null);
        }
      })();
    } else if (googleResponse.type === 'error') {
      setErrorMessage('Google sign-in failed. Please try again.');
      setSocialLoading(null);
    } else if (googleResponse.type === 'cancel') {
      setSocialLoading(null);
    }
  }, [googleResponse]);

  // Detect if running inside Expo Go (where Google OAuth redirect won't work)
  const isExpoGo = Constants.appOwnership === 'expo';

  const handleSocialAuth = async (provider: 'google' | 'facebook' | 'apple') => {
    setSocialLoading(provider);
    setErrorMessage(null);
    if (provider === 'google') {
      if (!googleClientId && !googleIosClientId) {
        setSocialLoading(null);
        setErrorMessage('Google Sign-In is not configured yet. Please use email and password.');
        return;
      }
      if (isExpoGo && Platform.OS !== 'web') {
        setSocialLoading(null);
        Alert.alert(t('common.googleSignin') || "Google Sign-In", t('common.googleSigninIsAvailableInTheFullDripnApp') || "Google Sign-In is available in the full Dripn app. For now, please use your email and password to sign in.",
          [{ text: t('common.ok') || 'OK' }]
        );
        return;
      }
      await googlePromptAsync();
      return;
    }
    if (provider === 'facebook' && !process.env.EXPO_PUBLIC_FACEBOOK_APP_ID) {
      setSocialLoading(null);
      setErrorMessage('Facebook Sign-In is not configured yet. Please use email and password.');
      return;
    }
    try {
      await socialLogin(provider);
      navigation.replace("Onboarding");
    } catch (error) {
      const detail = error instanceof Error ? error.message : '';
      const message = detail && !detail.startsWith('Could not')
        ? detail
        : `Could not sign in with ${provider.charAt(0).toUpperCase() + provider.slice(1)}. Please try again.`;
      setErrorMessage(message);
    } finally {
      setSocialLoading(null);
    }
  };

  const handleForgotPassword = async () => {
    setErrorMessage(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      Alert.alert(t('auth.forgotPasswordTitle'), t('auth.forgotPasswordEnterEmail'));
      return;
    }

    setForgotPasswordLoading(true);
    try {
      await apiService.requestForgotPassword(normalizedEmail);
      Alert.alert(
        t('auth.forgotPasswordTitle'),
        t('auth.forgotPasswordSent'),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : t('auth.forgotPasswordFailed');
      Alert.alert(t('common.error'), message);
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    
    if (!email || !password) {
      setErrorMessage(t('auth.fillRequired'));
      return;
    }

    if (isSignup && !name) {
      setErrorMessage(t('auth.enterYourName'));
      return;
    }

    if (isSignup && password.length < 6) {
      setErrorMessage('Password must be at least 6 characters');
      return;
    }

    if (isSignup && !ageConfirmed) {
      setErrorMessage('Please confirm you are at least 13 years old to create an account.');
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
      const errorMsg = error instanceof Error ? error.message : t('auth.authFailed');
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
        <LanguageEntryButton light={false} onPress={() => setLanguagePickerVisible(true)} />
      </View>

      <ScreenKeyboardAwareScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}
      >
        <View style={styles.titleContainer}>
          <ThemedText type="h1" style={styles.title}>
            {isSignup ? t('auth.createAccount') : t('auth.welcomeBack')}
          </ThemedText>
          <ThemedText type="body" style={styles.subtitle}>
            {isSignup
              ? t('auth.joinCommunity')
              : t('auth.signInContinue')}
          </ThemedText>
        </View>

        {SHOW_SOCIAL_LOGIN ? (
          <>
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
                      {t('auth.continueWithGoogle')}
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
                      {t('auth.continueWithFacebook')}
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
                        {t('auth.continueWithApple')}
                      </ThemedText>
                    </>
                  )}
                </Pressable>
              ) : null}
            </View>

            <View style={styles.dividerContainer}>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
              <ThemedText type="small" style={styles.dividerText}>{t('auth.or')}</ThemedText>
              <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            </View>
          </>
        ) : null}

        <View style={styles.form}>
          {isSignup ? (
            <View style={styles.fieldContainer}>
              <ThemedText type="small" style={styles.label}>
                {t('auth.fullName')}
              </ThemedText>
              <TextInput
                style={inputStyle}
                value={name}
                onChangeText={setName}
                placeholder={t('auth.enterName')}
                placeholderTextColor={isDark ? "#9BA1A6" : "#687076"}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
          ) : null}

          <View style={styles.fieldContainer}>
            <ThemedText type="small" style={styles.label}>
              {t('auth.email')}
            </ThemedText>
            <TextInput
              style={inputStyle}
              value={email}
              onChangeText={setEmail}
              placeholder={t('auth.emailPlaceholder')}
              placeholderTextColor={isDark ? "#9BA1A6" : "#687076"}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
            />
          </View>

          <View style={styles.fieldContainer}>
            <ThemedText type="small" style={styles.label}>
              {t('auth.password')}
            </ThemedText>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[inputStyle, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder={t('auth.enterPassword')}
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
            {!isSignup ? (
              <Pressable
                onPress={handleForgotPassword}
                disabled={forgotPasswordLoading || isAuthenticating}
                style={({ pressed }) => [
                  styles.forgotPasswordLink,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
                accessibilityRole="button"
              >
                {forgotPasswordLoading ? (
                  <ActivityIndicator size="small" color={theme.link} />
                ) : (
                  <ThemedText type="link" style={styles.forgotPasswordText}>
                    {t('auth.forgotPassword')}
                  </ThemedText>
                )}
              </Pressable>
            ) : null}
          </View>

          {errorMessage ? (
            <View style={styles.errorContainer}>
              <Feather name="alert-circle" size={16} color="#DC2626" />
              <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
            </View>
          ) : null}

          {isSignup ? (
            <Pressable
              onPress={() => setAgeConfirmed((prev) => !prev)}
              style={({ pressed }) => [
                styles.ageConfirmRow,
                { opacity: pressed ? 0.8 : 1 },
              ]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: ageConfirmed }}
            >
              <Feather
                name={ageConfirmed ? "check-square" : "square"}
                size={20}
                color={ageConfirmed ? theme.link : theme.tabIconDefault}
              />
              <ThemedText type="small" style={styles.ageConfirmText}>
                I confirm that I am at least 13 years old
              </ThemedText>
            </Pressable>
          ) : null}

          <Button onPress={handleSubmit} disabled={isAuthenticating} style={styles.submitButton}>
            {isAuthenticating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : isSignup ? (
              t('auth.createAccount')
            ) : (
              t('auth.signIn')
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
              {isSignup ? t('auth.alreadyHaveAccount') : t('auth.dontHaveAccount')}
              <ThemedText type="link" style={styles.linkText}>
                {isSignup ? t('auth.signIn') : t('auth.signUp')}
              </ThemedText>
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.termsContainer}>
          <ThemedText type="small" style={styles.termsText}>
            {t('auth.agreeTerms')}{" "}
            <ThemedText
              type="link"
              style={styles.termsLink}
              onPress={() => navigation.navigate("TermsOfService" as any)}
            >
              {t('auth.termsOfService')}
            </ThemedText>{" "}
            {t('auth.and')}{" "}
            <ThemedText
              type="link"
              style={styles.termsLink}
              onPress={() => navigation.navigate("PrivacyPolicy" as any)}
            >
              {t('auth.privacyPolicy')}
            </ThemedText>
          </ThemedText>
        </View>
      </ScreenKeyboardAwareScrollView>
      <LanguagePickerModal
        visible={languagePickerVisible}
        onClose={() => setLanguagePickerVisible(false)}
        alsoSetStylistLanguage
      />
    </ThemedView>
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
  forgotPasswordLink: {
    alignSelf: "flex-end",
    marginTop: Spacing.sm,
    minHeight: 24,
    justifyContent: "center",
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: "600",
  },
  submitButton: {
    marginTop: Spacing.md,
  },
  ageConfirmRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  ageConfirmText: {
    flex: 1,
    lineHeight: 20,
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

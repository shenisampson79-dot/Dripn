import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Button } from '@/components/Button';
import { ScreenKeyboardAwareScrollView } from '@/components/ScreenKeyboardAwareScrollView';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useTranslations } from '@/contexts/TranslationContext';
import { apiService } from '@/services/ApiService';
import type { AuthStackParamList } from '@/navigation/AuthStackNavigator';
import { PASSWORD_RESET_MIN_LENGTH } from '@/utils/passwordResetDeepLink';

type ResetPasswordScreenProps = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'ResetPassword'>;
  route: RouteProp<AuthStackParamList, 'ResetPassword'>;
};

function isInvalidResetTokenError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('invalid') || lower.includes('expired');
}

export default function ResetPasswordScreen({ navigation, route }: ResetPasswordScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { t } = useTranslations();

  const token = useMemo(() => String(route.params?.token || '').trim(), [route.params?.token]);
  const hasToken = token.length > 0;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [linkExpired, setLinkExpired] = useState(!hasToken);

  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.backgroundDefault,
      color: theme.text,
    },
  ];

  const goToSignIn = (successMessage?: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/');
    }
    navigation.navigate('Auth', {
      mode: 'login',
      ...(successMessage ? { resetSuccessMessage: successMessage } : {}),
    });
  };

  const handleSubmit = async () => {
    setErrorMessage(null);

    if (!hasToken) {
      setLinkExpired(true);
      return;
    }

    if (!password || !confirmPassword) {
      setErrorMessage(t('auth.fillRequired'));
      return;
    }

    if (password.length < PASSWORD_RESET_MIN_LENGTH) {
      setErrorMessage(t('auth.resetPasswordTooShort'));
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(t('auth.resetPasswordMismatch'));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await apiService.resetPassword(token, password);
      const successMessage = result.message || t('auth.resetPasswordSuccess');
      Alert.alert(t('auth.resetPasswordTitle'), successMessage, [
        { text: t('auth.signIn'), onPress: () => goToSignIn(successMessage) },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('auth.resetPasswordFailed');
      if (isInvalidResetTokenError(message)) {
        setLinkExpired(true);
        setErrorMessage(t('auth.resetPasswordInvalidToken'));
      } else {
        setErrorMessage(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (linkExpired) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
          <Pressable
            onPress={() => goToSignIn()}
            style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
        </View>
        <ScreenKeyboardAwareScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}
        >
          <ThemedText type="h1" style={styles.title}>
            {t('auth.resetPasswordTitle')}
          </ThemedText>
          <ThemedText type="body" style={styles.subtitle}>
            {errorMessage || t('auth.resetPasswordInvalidToken')}
          </ThemedText>
          <Button onPress={() => goToSignIn()} style={styles.submitButton}>
            {t('auth.resetPasswordRequestNew')}
          </Button>
        </ScreenKeyboardAwareScrollView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <Pressable
          onPress={() => goToSignIn()}
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
      </View>

      <ScreenKeyboardAwareScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}
      >
        <View style={styles.titleContainer}>
          <ThemedText type="h1" style={styles.title}>
            {t('auth.resetPasswordTitle')}
          </ThemedText>
          <ThemedText type="body" style={styles.subtitle}>
            {t('auth.resetPasswordSubtitle')}
          </ThemedText>
        </View>

        <View style={styles.form}>
          <View style={styles.fieldContainer}>
            <ThemedText type="small" style={styles.label}>
              {t('auth.resetPasswordNew')}
            </ThemedText>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[inputStyle, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder={t('auth.enterPassword')}
                placeholderTextColor={isDark ? '#9BA1A6' : '#687076'}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="next"
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                style={styles.passwordToggle}
              >
                <Feather
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color={theme.tabIconDefault}
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.fieldContainer}>
            <ThemedText type="small" style={styles.label}>
              {t('auth.resetPasswordConfirm')}
            </ThemedText>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[inputStyle, styles.passwordInput]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder={t('auth.resetPasswordConfirmPlaceholder')}
                placeholderTextColor={isDark ? '#9BA1A6' : '#687076'}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={() => void handleSubmit()}
              />
              <Pressable
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.passwordToggle}
              >
                <Feather
                  name={showConfirmPassword ? 'eye-off' : 'eye'}
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

          <Button onPress={handleSubmit} disabled={isSubmitting} style={styles.submitButton}>
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              t('auth.resetPasswordSubmit')
            )}
          </Button>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
  },
  titleContainer: {
    marginBottom: Spacing.xl,
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
    width: '100%',
  },
  label: {
    marginBottom: Spacing.sm,
    fontWeight: '600',
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
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 50,
  },
  passwordToggle: {
    position: 'absolute',
    right: 0,
    top: 0,
    height: Spacing.inputHeight,
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButton: {
    marginTop: Spacing.md,
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

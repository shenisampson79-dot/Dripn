import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  TextInput,
  Image,
  Alert,
  Modal,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import {
  decisionService,
  DecisionType,
  DecisionContext,
  DecisionRequest,
  DecisionResponse,
  DecisionAccessStatus,
  SecondOpinionResponse,
} from "@/services/DecisionService";

const LUXURY_COLORS = {
  gold: '#C9A87C',
  deepGold: '#A88B5C',
  rose: '#E8B4B8',
  berry: '#8B2F39',
  violet: '#9B7EBD',
  deepViolet: '#6B4E8D',
  champagne: '#F5E6D3',
  midnight: '#1A1A2E',
  coral: '#E07A5F',
  teal: '#2A9D8F',
  emerald: '#059669',
  obsidian: '#0D0B09',
};

type AskStylistScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export default function AskStylistScreen({ navigation }: AskStylistScreenProps) {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<'type' | 'upload' | 'context' | 'response'>('type');
  const [selectedType, setSelectedType] = useState<DecisionType | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [contextNotes, setContextNotes] = useState("");
  const [selectedContexts, setSelectedContexts] = useState<DecisionContext[]>([]);
  const [accessStatus, setAccessStatus] = useState<DecisionAccessStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<DecisionResponse | null>(null);
  const [secondOpinion, setSecondOpinion] = useState<SecondOpinionResponse | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const decisionTypes = decisionService.getDecisionTypes();
  const contextChips = decisionService.getContextChips();

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    if (!user?.id) return;
    const status = await decisionService.checkDecisionAccess(
      user.id,
      user.subscriptionTier || 'free'
    );
    setAccessStatus(status);

    if (!status.canMakeDecision) {
      setShowUpgradeModal(true);
    }
  };

  const handleTypeSelect = (type: DecisionType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedType(type);
    setStep('upload');
  };

  const handlePickImage = async () => {
    if (!accessStatus) return;

    if (images.length >= accessStatus.maxImages) {
      Alert.alert(
        'Maximum images reached',
        `You can upload up to ${accessStatus.maxImages} images.`
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: accessStatus.maxImages - images.length,
    });

    if (!result.canceled) {
      const newImages = result.assets.map(asset => asset.uri);
      setImages(prev => [...prev, ...newImages].slice(0, accessStatus.maxImages));
    }
  };

  const handleTakePhoto = async () => {
    if (!accessStatus) return;

    if (images.length >= accessStatus.maxImages) {
      Alert.alert(
        'Maximum images reached',
        `You can upload up to ${accessStatus.maxImages} images.`
      );
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera permission needed', 'Please enable camera access in settings.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled) {
      setImages(prev => [...prev, result.assets[0].uri].slice(0, accessStatus.maxImages));
    }
  };

  const handleRemoveImage = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleContextToggle = (context: DecisionContext) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedContexts(prev =>
      prev.includes(context)
        ? prev.filter(c => c !== context)
        : [...prev, context]
    );
  };

  const handleSubmit = async () => {
    if (!user?.id || !selectedType || images.length === 0) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);

    try {
      const request: DecisionRequest = {
        id: `request-${Date.now()}`,
        userId: user.id,
        type: selectedType,
        images,
        contextNotes: contextNotes.trim() || undefined,
        contextChips: selectedContexts,
        timestamp: new Date().toISOString(),
        stylistId: user.stylistPreferences?.selectedStylistId || 'ruby',
      };

      const result = await decisionService.submitDecision(
        request,
        user.subscriptionTier || 'free'
      );

      setResponse(result);
      setStep('response');
    } catch (error: any) {
      Alert.alert('Unable to submit', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSecondOpinion = async () => {
    if (!user?.id || !response) return;

    if (!accessStatus?.hasSecondOpinion) {
      setShowUpgradeModal(true);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);

    try {
      const result = await decisionService.requestSecondOpinion(
        response.requestId,
        response,
        user.subscriptionTier || 'free'
      );
      setSecondOpinion(result);
    } catch (error: any) {
      Alert.alert('Unable to get second opinion', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleHelpful = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    navigation.goBack();
  };

  const getStylistGradient = (): readonly [string, string] => {
    const stylistId = user?.stylistPreferences?.selectedStylistId;
    if (stylistId === 'ruby') return [LUXURY_COLORS.rose, '#D4949A'];
    if (stylistId === 'max') return [LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet];
    if (stylistId === 'ace') return [LUXURY_COLORS.obsidian, '#1A1A1A'];
    if (stylistId === 'ivy') return [LUXURY_COLORS.emerald, LUXURY_COLORS.teal];
    return [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold];
  };

  const getStylistIcon = (): string => {
    const stylistId = user?.stylistPreferences?.selectedStylistId;
    if (stylistId === 'ruby') return 'heart';
    if (stylistId === 'max') return 'zap';
    if (stylistId === 'ace') return 'target';
    if (stylistId === 'ivy') return 'compass';
    return 'star';
  };

  const getStylistName = (): string => {
    const stylistId = user?.stylistPreferences?.selectedStylistId;
    if (stylistId === 'ruby') return 'Ruby';
    if (stylistId === 'max') return 'Max';
    if (stylistId === 'ace') return 'Ace';
    if (stylistId === 'ivy') return 'Ivy';
    return 'Your Stylist';
  };

  const renderTypeSelection = () => (
    <View style={styles.stepContent}>
      <ThemedText type="h2" style={styles.stepTitle}>
        What decision can I help you with?
      </ThemedText>

      <View style={styles.typeGrid}>
        {decisionTypes.map((type) => (
          <Pressable
            key={type.id}
            onPress={() => handleTypeSelect(type.id)}
            style={({ pressed }) => [
              styles.typeCard,
              { opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
              style={styles.typeCardGradient}
            >
              <View style={styles.typeIconContainer}>
                <Feather name={type.icon as any} size={24} color="#FFFFFF" />
              </View>
              <ThemedText type="body" style={styles.typeLabel}>
                {type.label}
              </ThemedText>
              <ThemedText type="small" style={styles.typeDescription}>
                {type.description}
              </ThemedText>
            </LinearGradient>
          </Pressable>
        ))}
      </View>

      {accessStatus ? (
        <View style={styles.limitInfo}>
          <Feather name="info" size={14} color="rgba(255,255,255,0.5)" />
          <ThemedText type="small" style={styles.limitText}>
            {decisionService.getLimitCopy(user?.subscriptionTier || 'free').subtitle}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );

  const renderUpload = () => (
    <View style={styles.stepContent}>
      <ThemedText type="h2" style={styles.stepTitle}>
        Show me your options
      </ThemedText>
      <ThemedText style={styles.stepSubtitle}>
        Two or three options is perfect.
      </ThemedText>

      <View style={styles.imagesGrid}>
        {images.map((uri, index) => (
          <View key={index} style={styles.imageContainer}>
            <Image source={{ uri }} style={styles.uploadedImage} />
            <Pressable
              onPress={() => handleRemoveImage(index)}
              style={styles.removeImageButton}
            >
              <Feather name="x" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        ))}

        {images.length < (accessStatus?.maxImages || 2) ? (
          <View style={styles.uploadButtonsRow}>
            <Pressable onPress={handlePickImage} style={styles.uploadButton}>
              <LinearGradient
                colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                style={styles.uploadButtonGradient}
              >
                <Feather name="image" size={24} color="rgba(255,255,255,0.6)" />
                <ThemedText type="small" style={styles.uploadButtonText}>
                  Gallery
                </ThemedText>
              </LinearGradient>
            </Pressable>
            <Pressable onPress={handleTakePhoto} style={styles.uploadButton}>
              <LinearGradient
                colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                style={styles.uploadButtonGradient}
              >
                <Feather name="camera" size={24} color="rgba(255,255,255,0.6)" />
                <ThemedText type="small" style={styles.uploadButtonText}>
                  Camera
                </ThemedText>
              </LinearGradient>
            </Pressable>
          </View>
        ) : null}
      </View>

      {images.length > 0 ? (
        <Pressable
          onPress={() => setStep('context')}
          style={styles.nextButton}
        >
          <LinearGradient
            colors={getStylistGradient()}
            style={styles.nextButtonGradient}
          >
            <ThemedText type="body" style={styles.nextButtonText}>
              Continue
            </ThemedText>
            <Feather name="arrow-right" size={18} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>
      ) : null}
    </View>
  );

  const renderContext = () => (
    <View style={styles.stepContent}>
      <ThemedText type="h2" style={styles.stepTitle}>
        Anything I should know?
      </ThemedText>

      <View style={styles.contextChipsContainer}>
        {contextChips.map((chip) => {
          const isSelected = selectedContexts.includes(chip.id);
          return (
            <Pressable
              key={chip.id}
              onPress={() => handleContextToggle(chip.id)}
              style={[
                styles.contextChip,
                isSelected && styles.contextChipSelected,
              ]}
            >
              <ThemedText
                type="small"
                style={[
                  styles.contextChipText,
                  isSelected && styles.contextChipTextSelected,
                ]}
              >
                {chip.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        style={styles.contextInput}
        placeholder="Add any extra details (optional)"
        placeholderTextColor="rgba(255,255,255,0.4)"
        value={contextNotes}
        onChangeText={setContextNotes}
        multiline
        numberOfLines={3}
        maxLength={200}
      />

      <Pressable
        onPress={handleSubmit}
        disabled={isLoading}
        style={styles.submitButton}
      >
        <LinearGradient
          colors={getStylistGradient()}
          style={styles.submitButtonGradient}
        >
          {isLoading ? (
            <ThemedText type="body" style={styles.submitButtonText}>
              Thinking...
            </ThemedText>
          ) : (
            <>
              <ThemedText type="body" style={styles.submitButtonText}>
                Ask my stylist
              </ThemedText>
              <Feather name="send" size={18} color="#FFFFFF" />
            </>
          )}
        </LinearGradient>
      </Pressable>

      <Pressable onPress={() => setStep('upload')} style={styles.backLink}>
        <ThemedText style={styles.backLinkText}>Back to images</ThemedText>
      </Pressable>
    </View>
  );

  const renderResponse = () => (
    <View style={styles.stepContent}>
      <View style={styles.stylistAvatarContainer}>
        <LinearGradient
          colors={getStylistGradient()}
          style={styles.stylistAvatar}
        >
          <Feather
            name={getStylistIcon() as any}
            size={28}
            color="#FFFFFF"
          />
        </LinearGradient>
        <ThemedText type="small" style={styles.stylistName}>
          {getStylistName()}
        </ThemedText>
      </View>

      <View style={styles.responseCard}>
        <ThemedText type="body" style={styles.responseText}>
          {response?.recommendation}
        </ThemedText>
        {response?.reasoning ? (
          <ThemedText style={styles.reasoningText}>
            {response.reasoning}
          </ThemedText>
        ) : null}
      </View>

      {secondOpinion ? (
        <View style={styles.secondOpinionCard}>
          <ThemedText type="small" style={styles.secondOpinionLabel}>
            Second opinion
          </ThemedText>
          <ThemedText style={styles.secondOpinionText}>
            {secondOpinion.response}
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.responseActions}>
        <Pressable onPress={handleHelpful} style={styles.helpfulButton}>
          <LinearGradient
            colors={[LUXURY_COLORS.emerald, LUXURY_COLORS.teal]}
            style={styles.helpfulButtonGradient}
          >
            <Feather name="thumbs-up" size={18} color="#FFFFFF" />
            <ThemedText type="body" style={styles.helpfulButtonText}>
              That helps
            </ThemedText>
          </LinearGradient>
        </Pressable>

        {!secondOpinion && accessStatus?.hasSecondOpinion ? (
          <Pressable onPress={handleSecondOpinion} style={styles.secondOpinionButton}>
            <Feather name="refresh-cw" size={16} color="rgba(255,255,255,0.7)" />
            <ThemedText style={styles.secondOpinionButtonText}>
              Second opinion
            </ThemedText>
          </Pressable>
        ) : !accessStatus?.hasSecondOpinion ? (
          <Pressable onPress={() => setShowUpgradeModal(true)} style={styles.secondOpinionButton}>
            <Feather name="lock" size={16} color="rgba(255,255,255,0.5)" />
            <ThemedText style={styles.secondOpinionButtonText}>
              Second opinion
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={[
          LUXURY_COLORS.violet,
          LUXURY_COLORS.deepViolet,
          LUXURY_COLORS.obsidian,
        ]}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFill}
      />

      <ScreenScrollView style={{ backgroundColor: 'transparent' }}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
          <Pressable onPress={() => navigation.goBack()} style={styles.closeButton}>
            <Feather name="x" size={24} color="#FFFFFF" />
          </Pressable>
          <ThemedText type="h3" style={styles.headerTitle}>
            Ask the Stylist
          </ThemedText>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          {step === 'type' && renderTypeSelection()}
          {step === 'upload' && renderUpload()}
          {step === 'context' && renderContext()}
          {step === 'response' && renderResponse()}
        </View>
      </ScreenScrollView>

      <Modal
        visible={showUpgradeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUpgradeModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowUpgradeModal(false)}
        >
          <Pressable style={styles.upgradeModal} onPress={e => e.stopPropagation()}>
            <LinearGradient
              colors={[LUXURY_COLORS.gold, LUXURY_COLORS.deepGold]}
              style={styles.upgradeModalGradient}
            >
              <View style={styles.upgradeIconContainer}>
                <Feather name="unlock" size={32} color={LUXURY_COLORS.midnight} />
              </View>
              <ThemedText type="h2" style={styles.upgradeTitle}>
                {decisionService.getUpgradeCopy().headline}
              </ThemedText>
              <ThemedText style={styles.upgradeDescription}>
                {accessStatus?.reason ||
                  decisionService.getSecondOpinionLockedCopy()}
              </ThemedText>
              <Pressable
                onPress={() => {
                  setShowUpgradeModal(false);
                  navigation.navigate('Subscription');
                }}
                style={styles.upgradeButton}
              >
                <ThemedText type="body" style={styles.upgradeButtonText}>
                  {decisionService.getUpgradeCopy().cta}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setShowUpgradeModal(false)}
                style={styles.maybeLaterButton}
              >
                <ThemedText style={styles.maybeLaterText}>
                  {accessStatus?.canMakeDecision ? 'Not right now' : "I'll wait until tomorrow"}
                </ThemedText>
              </Pressable>
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing["2xl"],
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    color: '#FFFFFF',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  stepSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  typeGrid: {
    gap: Spacing.md,
  },
  typeCard: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  typeCardGradient: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  typeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
    flex: 1,
  },
  typeDescription: {
    color: 'rgba(255,255,255,0.6)',
    flex: 1.5,
  },
  limitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xl,
  },
  limitText: {
    color: 'rgba(255,255,255,0.5)',
  },
  imagesGrid: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  imageContainer: {
    position: 'relative',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  uploadedImage: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.lg,
  },
  removeImageButton: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  uploadButton: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  uploadButtonGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    color: 'rgba(255,255,255,0.6)',
  },
  nextButton: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  nextButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  contextChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  contextChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  contextChipSelected: {
    backgroundColor: LUXURY_COLORS.gold,
    borderColor: LUXURY_COLORS.gold,
  },
  contextChipText: {
    color: 'rgba(255,255,255,0.8)',
  },
  contextChipTextSelected: {
    color: LUXURY_COLORS.midnight,
    fontWeight: '600',
  },
  contextInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: '#FFFFFF',
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 16,
    marginBottom: Spacing.xl,
  },
  submitButton: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  backLink: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  backLinkText: {
    color: 'rgba(255,255,255,0.6)',
  },
  stylistAvatarContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  stylistAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  stylistName: {
    color: 'rgba(255,255,255,0.7)',
  },
  responseCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  responseText: {
    color: '#FFFFFF',
    lineHeight: 24,
    marginBottom: Spacing.sm,
  },
  reasoningText: {
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 22,
  },
  secondOpinionCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderLeftWidth: 3,
    borderLeftColor: LUXURY_COLORS.gold,
  },
  secondOpinionLabel: {
    color: LUXURY_COLORS.gold,
    marginBottom: Spacing.xs,
  },
  secondOpinionText: {
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 22,
  },
  responseActions: {
    gap: Spacing.md,
  },
  helpfulButton: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  helpfulButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  helpfulButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  secondOpinionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  secondOpinionButtonText: {
    color: 'rgba(255,255,255,0.7)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  upgradeModal: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  upgradeModalGradient: {
    padding: Spacing.xl,
    paddingBottom: 50,
    alignItems: 'center',
  },
  upgradeIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  upgradeTitle: {
    color: LUXURY_COLORS.midnight,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  upgradeDescription: {
    color: 'rgba(0,0,0,0.7)',
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  upgradeButton: {
    backgroundColor: LUXURY_COLORS.midnight,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing["2xl"],
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  maybeLaterButton: {
    paddingVertical: Spacing.sm,
  },
  maybeLaterText: {
    color: 'rgba(0,0,0,0.5)',
  },
});

/**
 * Copyright (c) 2025 Dripn. All rights reserved.
 * Ruby and Max AI Stylist personas are proprietary to Dripn.
 */

import React, { useState, useRef, useCallback, useEffect, useMemo, useContext } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  Dimensions,
  Platform,
  ActivityIndicator,
  Image,
  FlatList,
  Alert,
  Linking,
  ScrollView,
  Modal,
} from 'react-native';
import { KeyboardStickyView, useKeyboardState, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import {
  useAudioRecorder,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
  createAudioPlayer,
  type AudioPlayer,
} from 'expo-audio';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  cancelAnimation,
} from 'react-native-reanimated';
// Input uses KeyboardStickyView (absolute bottom) so it tracks the keyboard without extra gap.

import { ThemedText } from '@/components/ThemedText';
import { ChatSelectableText } from '@/components/chat/ChatSelectableText';
import { RenderErrorBoundary } from '@/components/RenderErrorBoundary';
import { SoftRenderFallback } from '@/components/SoftRenderFallback';
import { SafeOutfitPieces } from '@/components/SafeOutfitPieces';
import { OutfitSaveActions } from '@/components/outfit/OutfitSaveActions';
import { WardrobeItemImage } from '@/components/WardrobeItemImage';
import { Card } from '@/components/Card';
import { LimitHitUpgradePrompt } from '@/components/LimitHitUpgradePrompt';
import { PersonalStylistVoicePanel } from '@/components/PersonalStylistVoicePanel';
import { VoiceCreditsPurchaseModal } from '@/components/VoiceCreditsPurchaseModal';
import { Spacing, BorderRadius, Typography, LuxuryColors as ThemeLuxuryColors, ScreenGradients } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { logInvalidRender, sanitizeOutfitPieces, sanitizeWardrobeVisual } from '@/utils/safeRender';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useReferral } from '@/contexts/ReferralContext';
import { useTranslations } from '@/contexts/TranslationContext';
import { useWardrobe, WardrobeItem, ClothingOccasion, ClothingSeason } from '@/contexts/WardrobeContext';
import { useAuth } from '@/contexts/AuthContext';
import { normalizeCountryCode } from '@/utils/outfitRegionalContext';
import { getStylistSpeakTranslator, resolveStylistSpeakLanguage, stylistLanguageCodeToAccent } from '@/utils/stylistLanguage';
import { navigateToSubscription } from '@/utils/navigateToSubscription';
import { sanitizeStylistUserText } from '@/utils/sanitizeStylistUserText';
import { extractRecentOutfitIdLists } from '@/utils/extractRecentOutfitIdLists';
import { editorialGarmentName } from '@/utils/wardrobeItemName';
import {
  getAiAllowancePaywallCopy,
  isAiBudgetError,
  stylistMonthlyAllowanceMessage,
} from '@/utils/aiBudgetError';
import { planTierFromBudgetError } from '@/components/live/LiveAiBudgetModal';
import { useNavigation, CommonActions, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { apiService } from '@/services/ApiService';
import { useVoiceSettings, VoiceId, StylistId } from '@/contexts/VoiceSettingsContext';
import { useVoiceCredits } from '@/hooks/useVoiceCredits';
import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import { getStylistForUser, getStylistGreeting, PersonalStylist, type StylistGreetingWardrobe } from '@/services/PersonalStylistService';
import type { SharedValue } from 'react-native-reanimated';
import type { UserStylistStackParamList } from '@/navigation/UserStylistStackNavigator';
import {
  hydrateWardrobeVisualImagesByIds,
  capWardrobeVisualForAccess,
  inferOutfitCountFromText,
  matchWardrobeItemsInText,
  normalizeWardrobeVisual,
  splitIntoOutfitSections,
  stripStructuredOutfitMarkers,
  wardrobeVisualFromOutfitSuggestion,
  type WardrobeVisualPayload,
} from '@/utils/wardrobeMentionMatcher';
import { OccasionOutfitChips } from '@/components/outfit/OccasionOutfitChips';
import { FallbackShopSection, type FallbackMissingItem } from '@/components/stylist/FallbackShopSection';
import { RankedMultiLookCards } from '@/components/stylist/RankedMultiLookCards';
import { buildRankedLookCards } from '@/utils/rankedMultiLook';
import { buildStyleSession, type StyleSession } from '@/utils/chatWearTargetDate';
import { getOccasionLabel, type OutfitOccasionId } from '@/constants/outfitOccasions';
import { generateWardrobeOutfit } from '@/utils/generatedOutfit';
import {
  inferOutfitOccasionFromAsk,
  raiseOccasionForRefine,
} from '@/utils/inferOutfitOccasionFromAsk';
import {
  advanceMultiDayTravelClarify,
  emptyMultiDaySlots,
  isMultiDayTravelOutfitAsk,
  multiDayClarifyCopy,
  type MultiDayTravelSlots,
} from '@/utils/multiDayTravelClarify';
import { resolveMultiDayGenerateUi } from '@/utils/multiDayChatSuccess';
import {
  buildOutfitClarifyFromPartialLock,
  buildOutfitClarifyFromTierBNarrow,
  clearOutfitClarify,
  isOutfitClarifyFlow,
  isOutfitTaskAsk,
  isWardrobeOutfitRefineAsk,
  resolveOutfitRoute,
  type OutfitClarifyPending,
} from '@/utils/outfitClarifyContinuity';
import { assertCanonicalOutfitVisual } from '@/utils/canonicalOutfitVisualAuthority';
import {
  extractPriorOutfitOccasion,
  pickPersistedOutfitOccasion,
} from '@/utils/extractPriorOutfitOccasion';
import {
  isMultiPieceHardLockAsk,
  resolveHardLockMentions,
} from '@/utils/hardLockMentionResolution';
import weatherService from '@/services/WeatherService';
import { occasionSlugFromLabel, wardrobeIdsFromPieces } from '@/utils/saveGeneratedOutfit';
import { enrichWardrobeItemForDisplay, normalizeRemoteApiUrl, resolveWardrobeImageUri } from '@/utils/wardrobeImage';
import {
  acquireStickOwnership,
  beginProgrammaticScroll,
  CHAT_SCROLL_END_OFFSET,
  createChatMachine,
  computeNearBottom,
  endProgrammaticScroll,
  mustScrollToBottom,
  onChatFocus as onChatFocusMachine,
  onUserScrollEvent,
  releaseStickForUserIntent,
  shouldAutoStickOnContentChange,
  transitionPhase,
} from '@/utils/chatStateMachine';
import {
  beginStickPulse,
  cancelStickPulse,
  createStickPulseController,
  isStickPulseActive,
} from '@/utils/stylistChatScroll';
import { countWardrobeOutfitBasics } from '@/utils/wardrobeOutfitReadiness';
import {
  clearLastDecisionContinuity,
  loadLastDecisionContinuity,
  looksLikeDecisionFollowUp,
  toApiDecisionContinuity,
  traceDecisionContinuity,
  type DecisionContinuityPayload,
} from '@/utils/decisionContinuity';
import {
  STYLIST_CHAT_CLEARED_TOMBSTONE_KEY,
  buildStylistChatClearedTombstone,
  parseStylistChatClearedTombstone,
  shouldSuppressServerChatHydrate,
} from '@/utils/stylistFreshThread';

interface WaveformBarProps {
  bar: SharedValue<number>;
  color: string;
  style: any;
}

const WaveformBar = ({ bar, color, style }: WaveformBarProps) => {
  const animatedStyle = useAnimatedStyle(() => ({
    height: 20 * bar.value,
  }));
  
  return (
    <Animated.View
      style={[
        style,
        { backgroundColor: color },
        animatedStyle,
      ]}
    />
  );
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
/** Chat row geometry — keep outfit bubbles inside the screen with readable text inset. */
const CHAT_ROW_PADDING = Spacing.xl;
const CHAT_AVATAR_SIZE = 32;

/** Circle is too small for a full name — show the stylist's initial instead of a generic icon. */
function stylistAvatarInitial(name: string | undefined | null): string {
  const trimmed = String(name || '').trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
}
const CHAT_AVATAR_GAP = Spacing.sm;
const CHAT_BUBBLE_PADDING_H = Spacing.lg;
const CHAT_EDGE_SAFE = Spacing.sm;
/** Inner width for outfit visuals inside the assistant bubble. */
const WARDROBE_CHAT_CANVAS_WIDTH =
  SCREEN_WIDTH -
  CHAT_ROW_PADDING * 2 -
  CHAT_AVATAR_SIZE -
  CHAT_AVATAR_GAP -
  CHAT_BUBBLE_PADDING_H * 2 -
  CHAT_EDGE_SAFE;
/** Outer max width for assistant bubbles that include wardrobe visuals. */
const WARDROBE_CHAT_BUBBLE_MAX_WIDTH =
  SCREEN_WIDTH - CHAT_ROW_PADDING * 2 - CHAT_AVATAR_SIZE - CHAT_AVATAR_GAP - CHAT_EDGE_SAFE;
const INPUT_CONTAINER_HEIGHT = 80;
/** Allowance / daily-limit banner sits above the input — reserve space so the last bubble isn't covered. */
const LIMIT_HIT_BANNER_HEIGHT = 108;
const TAB_BAR_HEIGHT = 56;

const CHAT_STORAGE_KEY = '@dripn_ai_stylist_chat';
const DAILY_MESSAGES_KEY = '@dripn_ai_daily_messages';
/** Unsent composer text — survives leaving chat (like iMessage / WhatsApp drafts). */
const COMPOSER_DRAFT_KEY_PREFIX = '@dripn_ai_stylist_composer_draft:';
/** Last user question to auto-retry after an allowance upgrade. */
const PENDING_STYLIST_RETRY_KEY = '@dripn_stylist_pending_retry';

function composerDraftKey(stylistId: string) {
  return `${COMPOSER_DRAFT_KEY_PREFIX}${stylistId || 'default'}`;
}

/** Sync cache so remount restores draft before AsyncStorage resolves. */
const composerDraftMemory: Record<string, string> = {};

function readComposerDraft(stylistId: string): string {
  const mem = composerDraftMemory[stylistId || 'default'];
  return typeof mem === 'string' ? mem : '';
}

function writeComposerDraft(stylistId: string, text: string) {
  const id = stylistId || 'default';
  const next = String(text || '');
  if (!next.trim()) {
    delete composerDraftMemory[id];
    void AsyncStorage.removeItem(composerDraftKey(id)).catch(() => {});
    return;
  }
  composerDraftMemory[id] = next;
  void AsyncStorage.setItem(composerDraftKey(id), next).catch(() => {});
}
/** Stable FlatList row id for the welcome bubble — never swap this id on hydrate. */
const SEED_MESSAGE_ID = 'msg_seed_init';

const LUXURY_COLORS = {
  gold: '#C9A87C',
  deepGold: '#A88B5C',
  rose: '#E8B4B8',
  berry: '#8B2F39',
  violet: '#9B7EBD',
  deepViolet: '#6B4E8D',
  coral: '#E07A5F',
  teal: '#2A9D8F',
  emerald: '#059669',
  midnight: '#1A1A2E',
};

interface VoiceMessage {
  uri: string;
  duration: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  imageUri?: string;
  /** Up to 3 attached photos (buy-compare). Prefer this over singular imageUri. */
  imageUris?: string[];
  voiceMessage?: VoiceMessage;
  outfitSuggestion?: {
    items: WardrobeItem[];
    occasion: string;
    reason: string;
  };
  /** Occasion slug from wardrobe create-outfit / refine (for follow-up locks). */
  outfitOccasion?: string;
  /** Multi-day travel clarify slots (pending until READY → generate). */
  travelClarify?: {
    flow: string;
    state: string;
    slots: MultiDayTravelSlots;
    missing?: string[];
  } | null;
  /**
   * Single-look outfit lock clarify (pending until publish/refuse/cancel).
   * Spec: docs/qa/STYLIST_CHAT_OUTFIT_CONTINUITY_SPEC.md
   */
  outfitClarify?: OutfitClarifyPending | null;
  wardrobeVisual?: WardrobeVisualPayload | null;
  outfitVisualSuggestion?: {
    source: 'generated';
    outfitDescription: string;
    occasion: string;
    pieces?: Array<{ role: string; garment?: string; descriptor: string }>;
  };
  isVisualizingOutfit?: boolean;
  /** When set by server, client must not rebuild wardrobe strip from chat prose. */
  visualAuthority?: 'server';
  hasOutfitRecommendation?: boolean;
  /** Ranked multi-look package from server (Best / Easy / More expressive). */
  responseType?: 'single' | 'multi' | string;
  lookCount?: number;
  looks?: Array<{
    role?: string | null;
    roleLabel?: string | null;
    label?: string | null;
    reason?: string | null;
    itemIds?: Array<string | number>;
  }>;
  isFallback?: boolean;
  isShopRequired?: boolean;
  status?: string;
  displayState?: string;
  /** Decision Firewall: open Choosing what to buy */
  redirectToDecide?: boolean;
  cta?: {
    action?: string;
    label?: string;
    screen?: string;
  } | null;
  missing?: FallbackMissingItem[];
  stylistNote?: string;
  /** Frozen wear/plan date from generation — actions must reuse this */
  styleSession?: StyleSession;
}

/** Buy/compare asks should keep Decide→Chat shopping continuity, not hard-kill it. */
function looksLikeBuyCompareAsk(text: string): boolean {
  const t = String(text || '');
  return (
    /\bshould i buy\b/i.test(t)
    || /\bi should buy\b/i.test(t)
    || /\bwhich should i (buy|get|pick|choose)\b/i.test(t)
    || /\bwhat should i (buy|get)\b/i.test(t)
    || /\bwhich (item|one|option|piece|top|shirt).{0,80}\b(buy|get|pick|choose|better)\b/i.test(t)
    || /\bwhich .{0,50}\bis better\b/i.test(t)
    || /\b(buy|get|pick|choose).{0,40}\bbetween\b/i.test(t)
    || /\bbetween\b.{0,80}\b(buy|get|pick|choose)\b/i.test(t)
    || /\bpick between\b/i.test(t)
    || /\bcouldn'?t attach\b/i.test(t)
    || /\b(compare|choosing) what to buy\b/i.test(t)
    || /\b(these|those) (two|2|three|3).{0,60}\b(buy|pick|choose|better|compare)\b/i.test(t)
  );
}

/**
 * Multi-day / travel packing / celebrity / style-reference asks need conversational chat,
 * not the single-look wardrobe solver (chips + createWardrobeOutfit are one complete look).
 */
function isMultiLookOrStyleReferenceAsk(text: string): boolean {
  const t = String(text || '').trim();
  if (!t) return false;
  return (
    isMultiDayTravelOutfitAsk(t)
    || /\bdress me like\b|\bstyle me like\b|\bin the style of\b/i.test(t)
    || /\blike\s+[A-Z][A-Za-z0-9.'’\-]+(?:\s+[A-Z][A-Za-z0-9.'’\-]+){0,3}\b/.test(t)
  );
}

function findPendingTravelClarify(messages: ChatMessage[]): MultiDayTravelSlots | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg.role !== 'assistant') continue;
    if (msg.travelClarify?.slots && msg.travelClarify.state !== 'DONE') {
      return msg.travelClarify.slots;
    }
    // Stop at prior completed plan or unrelated assistant turn without travel state
    if (msg.travelClarify?.state === 'DONE') return null;
    if (msg.hasOutfitRecommendation || msg.wardrobeVisual) return null;
  }
  return null;
}

async function fetchWeatherForOutfitCreate(timeoutMs = 3000): Promise<{
  weather: { temperature: number; condition: string } | null;
  lat: number | null;
}> {
  try {
    const permission = await weatherService.checkPermissionStatus();
    if (!permission.granted) {
      try {
        await weatherService.requestPermission();
      } catch {
        /* optional */
      }
    }
    const current = await Promise.race([
      weatherService.getWeatherForOutfits(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    if (current && typeof (current as { temperature?: number }).temperature === 'number') {
      const w = current as { temperature: number; condition: string; location?: string };
      let lat: number | null = null;
      try {
        const coords = await weatherService.getLocationCoords();
        lat = coords?.lat ?? null;
      } catch {
        lat = null;
      }
      return {
        weather: { temperature: w.temperature, condition: String(w.condition || 'clear') },
        lat,
      };
    }
  } catch {
    /* non-blocking */
  }
  return { weather: null, lat: null };
}

function extractPriorWardrobeItemIds(messages: ChatMessage[]): string[] {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg.role !== 'assistant') continue;
    const pieces = msg.wardrobeVisual?.pieces;
    if (Array.isArray(pieces) && pieces.length) {
      const ids = pieces
        .map((p) => (p as { wardrobeItemId?: string | number; id?: string | number })?.wardrobeItemId
          ?? (p as { id?: string | number })?.id)
        .filter((id) => id != null && String(id).trim())
        .map(String);
      if (ids.length) return ids;
    }
    const lookIds = msg.looks?.[0]?.itemIds;
    if (Array.isArray(lookIds) && lookIds.length) {
      return lookIds.map(String);
    }
  }
  return [];
}

// extractPriorOutfitOccasion — utils/extractPriorOutfitOccasion.ts (hydration SSoT)

function normalizeChatMessage(raw: unknown): ChatMessage | null {
  if (!raw || typeof raw !== 'object') return null;

  const message = raw as Partial<ChatMessage>;
  if (!message.id || (message.role !== 'user' && message.role !== 'assistant')) {
    return null;
  }

  const content = typeof message.content === 'string' ? message.content : '';
  const normalized: ChatMessage = {
    id: message.id,
    role: message.role,
    content,
    timestamp: typeof message.timestamp === 'string' ? message.timestamp : new Date().toISOString(),
  };

  if (typeof message.imageUri === 'string') {
    normalized.imageUri = message.imageUri;
  }
  if (Array.isArray(message.imageUris)) {
    const uris = message.imageUris.filter((u): u is string => typeof u === 'string' && Boolean(u.trim())).slice(0, 3);
    if (uris.length) {
      normalized.imageUris = uris;
      if (!normalized.imageUri) normalized.imageUri = uris[0];
    }
  }
  if (message.isVisualizingOutfit === true) {
    normalized.isVisualizingOutfit = true;
  }
  if (
    message.outfitVisualSuggestion?.source === 'generated'
    && typeof message.outfitVisualSuggestion.outfitDescription === 'string'
  ) {
    const suggestionPieces = Array.isArray(message.outfitVisualSuggestion.pieces)
      ? message.outfitVisualSuggestion.pieces.filter(
          (p) => p && typeof p === 'object' && (typeof p.descriptor === 'string' || typeof p.garment === 'string'),
        ).map((p) => ({
          role: String(p.role || ''),
          garment: typeof p.garment === 'string' ? p.garment : undefined,
          descriptor: String(p.descriptor || p.garment || ''),
        })).filter((p) => p.role && p.descriptor)
      : undefined;
    normalized.outfitVisualSuggestion = {
      source: 'generated',
      outfitDescription: message.outfitVisualSuggestion.outfitDescription,
      occasion: typeof message.outfitVisualSuggestion.occasion === 'string'
        ? message.outfitVisualSuggestion.occasion
        : '',
      ...(suggestionPieces?.length ? { pieces: suggestionPieces } : {}),
    };
  }

  if (message.voiceMessage && typeof message.voiceMessage === 'object') {
    normalized.voiceMessage = message.voiceMessage;
  }

  if (message.outfitSuggestion && typeof message.outfitSuggestion === 'object') {
    const items = Array.isArray(message.outfitSuggestion.items)
      ? message.outfitSuggestion.items.filter((item) => item && typeof item === 'object')
      : [];

    if (items.length > 0) {
      normalized.outfitSuggestion = {
        items,
        occasion: typeof message.outfitSuggestion.occasion === 'string' ? message.outfitSuggestion.occasion : '',
        reason: typeof message.outfitSuggestion.reason === 'string' ? message.outfitSuggestion.reason : '',
      };
    }
  }

  if (message.wardrobeVisual && typeof message.wardrobeVisual === 'object') {
    const sanitized = sanitizeWardrobeVisual(message.wardrobeVisual, { log: true });
    if (sanitized) {
      if (sanitized.layout === 'multi' && sanitized.outfits?.length) {
        normalized.wardrobeVisual = {
          layout: 'multi',
          outfits: sanitized.outfits,
          source: sanitized.source,
          matchScore: sanitized.matchScore,
        };
      } else if (sanitized.pieces.length > 0) {
        normalized.wardrobeVisual = {
          layout: sanitized.layout === 'highlight' ? 'highlight' : 'stacked',
          pieces: sanitized.pieces,
          source: sanitized.source,
          matchScore: sanitized.matchScore,
        };
      }
    }
  }

  if (message.responseType === 'multi' || message.responseType === 'single') {
    normalized.responseType = message.responseType;
  }
  if (typeof message.lookCount === 'number' && Number.isFinite(message.lookCount)) {
    normalized.lookCount = message.lookCount;
  }
  if (Array.isArray(message.looks) && message.looks.length) {
    normalized.looks = message.looks
      .filter((look) => look && typeof look === 'object')
      .map((look) => ({
        role: typeof look.role === 'string' ? look.role : null,
        roleLabel: typeof look.roleLabel === 'string' ? look.roleLabel : null,
        label: typeof look.label === 'string' ? look.label : null,
        reason: typeof look.reason === 'string' ? look.reason : null,
        itemIds: Array.isArray(look.itemIds) ? look.itemIds.map(String) : [],
      }));
  }

  if (message.travelClarify && typeof message.travelClarify === 'object') {
    const tc = message.travelClarify as ChatMessage['travelClarify'];
    if (tc && typeof tc.flow === 'string' && typeof tc.state === 'string') {
      normalized.travelClarify = {
        flow: tc.flow,
        state: tc.state,
        slots: (tc.slots && typeof tc.slots === 'object') ? tc.slots as MultiDayTravelSlots : undefined,
      };
    }
  }

  if (message.outfitClarify && typeof message.outfitClarify === 'object') {
    const oc = message.outfitClarify as OutfitClarifyPending;
    if (isOutfitClarifyFlow(oc.flow) && typeof oc.state === 'string' && typeof oc.originalUserMessage === 'string') {
      normalized.outfitClarify = {
        flow: oc.flow,
        state: oc.state === 'READY' || oc.state === 'DONE' ? oc.state : 'AWAITING_PIECE',
        originalUserMessage: oc.originalUserMessage,
        occasion: typeof oc.occasion === 'string' ? oc.occasion : 'casual_day',
        lockedItemIds: Array.isArray(oc.lockedItemIds) ? oc.lockedItemIds.map(String) : [],
        expectedLockCount: Number.isFinite(Number(oc.expectedLockCount))
          ? Number(oc.expectedLockCount)
          : (oc.flow === 'outfit_tier_b_narrow' ? 0 : 1),
        pendingSlot: oc.pendingSlot,
        createdAt: typeof oc.createdAt === 'string' ? oc.createdAt : new Date().toISOString(),
        weather: oc.weather && typeof oc.weather === 'object' && typeof oc.weather.temperature === 'number'
          ? { temperature: oc.weather.temperature, condition: String(oc.weather.condition || 'clear') }
          : null,
        lat: oc.lat ?? null,
        continuationCount: Number.isFinite(Number(oc.continuationCount))
          ? Number(oc.continuationCount)
          : undefined,
      };
    }
  }

  if (message.styleSession && typeof message.styleSession === 'object') {
    const s = message.styleSession as Partial<StyleSession>;
    if (typeof s.kind === 'string' && typeof s.dayLabel === 'string') {
      normalized.styleSession = {
        intent: typeof s.intent === 'string' ? s.intent : 'multi_look',
        occasion: typeof s.occasion === 'string' ? s.occasion : null,
        targetDate: typeof s.targetDate === 'string' ? s.targetDate : null,
        timeContext: s.timeContext === 'morning' || s.timeContext === 'afternoon' || s.timeContext === 'evening'
          ? s.timeContext
          : null,
        dayLabel: s.dayLabel,
        kind: s.kind as StyleSession['kind'],
        markAsWornToday: Boolean(s.markAsWornToday),
        userMessage: typeof s.userMessage === 'string' ? s.userMessage : undefined,
      };
    }
  }

  // Structured occasion must survive force-close / remount hydrate (refine continuity).
  const persistedOccasion = pickPersistedOutfitOccasion({
    role: message.role,
    outfitOccasion: typeof message.outfitOccasion === 'string' ? message.outfitOccasion : null,
    outfitSuggestion: normalized.outfitSuggestion,
    outfitVisualSuggestion: normalized.outfitVisualSuggestion,
    styleSession: normalized.styleSession,
  });
  if (persistedOccasion) {
    normalized.outfitOccasion = persistedOccasion;
  }

  return normalized;
}

/** In-memory chat snapshot so remounts paint with real history (no seed→history swap). */
let chatMessagesMemoryCache: ChatMessage[] | null = null;
let chatQuickPromptsMemoryCache: boolean | null = null;

function rememberChatMessages(msgs: ChatMessage[], showQuickPrompts?: boolean) {
  chatMessagesMemoryCache = msgs.slice(-50);
  if (typeof showQuickPrompts === 'boolean') {
    chatQuickPromptsMemoryCache = showQuickPrompts;
  }
}

function getCachedMessagesSync(): ChatMessage[] | null {
  return chatMessagesMemoryCache;
}

function isSeedOnlyThread(msgs: ChatMessage[]): boolean {
  if (msgs.length === 0) return true;
  return (
    msgs.length === 1 &&
    msgs[0]?.role === 'assistant' &&
    (msgs[0].id === SEED_MESSAGE_ID || !msgs.some((m) => m.role === 'user'))
  );
}

function threadHasUserMessage(msgs: ChatMessage[]): boolean {
  return msgs.some((m) => m.role === 'user');
}

/**
 * Progressive hydrate — never blind-replace the rendered list.
 * Seed-only → real thread keeps the first row id so FlatList does not remount cell 0.
 */
function mergeChatMessages(prev: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (!incoming.length) return prev;

  if (isSeedOnlyThread(prev) && (threadHasUserMessage(incoming) || incoming.length > 1)) {
    return incoming.map((m, i) =>
      i === 0 && prev[0] && m.role === 'assistant' ? { ...m, id: prev[0].id } : m,
    );
  }

  if (isSeedOnlyThread(prev) && incoming.length === 1 && incoming[0]?.role === 'assistant') {
    if (!prev[0]) return [{ ...incoming[0], id: SEED_MESSAGE_ID }];
    if (prev[0].content === incoming[0].content) return prev;
    return [{
      ...prev[0],
      content: incoming[0].content,
      timestamp: incoming[0].timestamp || prev[0].timestamp,
    }];
  }

  const byId = new Map(prev.map((m) => [m.id, m]));
  let changed = false;
  const next = [...prev];
  for (const m of incoming) {
    const existing = byId.get(m.id);
    if (!existing) {
      next.push(m);
      byId.set(m.id, m);
      changed = true;
      continue;
    }
    if (
      existing.content !== m.content ||
      existing.imageUri !== m.imageUri ||
      existing.isVisualizingOutfit !== m.isVisualizingOutfit ||
      existing.wardrobeVisual !== m.wardrobeVisual
    ) {
      const idx = next.findIndex((x) => x.id === m.id);
      if (idx >= 0) {
        next[idx] = { ...existing, ...m, id: existing.id };
        changed = true;
      }
    }
  }
  return changed ? next : prev;
}

function readTodayMessagesFromParsed(parsed: unknown): ChatMessage[] {
  if (!Array.isArray(parsed)) return [];
  const today = new Date().toDateString();
  return parsed
    .map(normalizeChatMessage)
    .filter((msg): msg is ChatMessage => msg !== null)
    .filter((msg) => new Date(msg.timestamp).toDateString() === today)
    .slice(-20);
}

/** Warm sync cache before Hub → Chat so first paint already has today's thread. */
export async function prefetchAIStylistChatHistory(): Promise<void> {
  try {
    const data = await AsyncStorage.getItem(CHAT_STORAGE_KEY);
    if (!data) return;
    const recent = readTodayMessagesFromParsed(JSON.parse(data));
    if (!recent.length) return;
    rememberChatMessages(recent, !threadHasUserMessage(recent));
  } catch {
    /* optional warm */
  }
}

function attachWardrobeVisualToMessage(
  message: ChatMessage,
  userMessage: string,
  response: {
    content: string;
    wardrobeVisual?: WardrobeVisualPayload | null;
    outfitVisualSuggestion?: {
      source: 'generated';
      outfitDescription: string;
      occasion: string;
      pieces?: Array<{ role: string; garment?: string; descriptor: string }>;
    } | null;
    /** Server owns strip authority — client must not rebuild from prose. */
    visualAuthority?: 'server' | string | null;
    hasOutfitRecommendation?: boolean;
    isVisualizingOutfit?: boolean;
    isFallback?: boolean;
    isShopRequired?: boolean;
    type?: string;
    status?: string;
    displayState?: string;
    redirectToDecide?: boolean;
    cta?: ChatMessage['cta'];
    missing?: FallbackMissingItem[];
    stylistNote?: string;
    responseType?: 'single' | 'multi' | string;
    lookCount?: number;
    looks?: ChatMessage['looks'];
  },
  wardrobeItems: WardrobeItem[],
  subscriptionTier?: string | null,
): ChatMessage {
  // Server owns strip authority for stylist chat — never rebuild from prose.
  const rawVisual = response.wardrobeVisual ?? null;
  const capped = rawVisual ? capWardrobeVisualForAccess(rawVisual, subscriptionTier) : null;
  const wardrobeVisual = hydrateWardrobeVisualImagesByIds(
    normalizeWardrobeVisual(capped),
    wardrobeItems,
  );

  const hasVisual = Boolean(
    wardrobeVisual
    && (
      (wardrobeVisual.layout === 'multi' && wardrobeVisual.outfits?.length)
      || wardrobeVisual.pieces?.length
    ),
  );
  const isFallback = Boolean(
    response.isFallback
    || response.status === 'fallback_outfit'
    || response.type === 'fallback_outfit',
  );
  const isShopRequired = Boolean(
    response.isShopRequired
    || response.status === 'SHOP_REQUIRED'
    || response.displayState === 'SHOP_REQUIRED'
    || response.type === 'shop_required',
  );
  const redirectToDecide = Boolean(
    response.redirectToDecide
    || response.status === 'redirect_to_decide'
    || response.displayState === 'REDIRECT_TO_DECIDE'
    || response.type === 'redirect_to_decide',
  );
  const strippedContent = sanitizeStylistUserText(stripStructuredOutfitMarkers(message.content));
  const styleSession = buildStyleSession({
    userMessage,
    assistantContent: strippedContent,
    intent: response.responseType === 'multi' ? 'multi_look' : 'single_look',
  });
  const enriched: ChatMessage = {
    ...message,
    content: strippedContent,
    visualAuthority: 'server',
    hasOutfitRecommendation: response.hasOutfitRecommendation,
    isFallback: isFallback || undefined,
    isShopRequired: isShopRequired || undefined,
    status: response.status,
    displayState: response.displayState,
    redirectToDecide: redirectToDecide || undefined,
    cta: response.cta || undefined,
    missing: Array.isArray(response.missing) ? response.missing : undefined,
    stylistNote: response.stylistNote,
    responseType: response.responseType,
    lookCount: typeof response.lookCount === 'number' ? response.lookCount : undefined,
    looks: Array.isArray(response.looks) ? response.looks : undefined,
    styleSession,
  };

  if (response.outfitVisualSuggestion?.source === 'generated') {
    enriched.outfitVisualSuggestion = response.outfitVisualSuggestion;
    enriched.isVisualizingOutfit = true;
  }
  if (!wardrobeVisual || !hasVisual) return enriched;

  const editorialisePiece = <T extends { name?: string | null; brand?: string | null }>(piece: T): T => ({
    ...piece,
    name: editorialGarmentName(piece.name || '', { brand: piece.brand }) || piece.name,
  });
  const editorialVisual: typeof wardrobeVisual = wardrobeVisual.layout === 'multi'
    ? {
        ...wardrobeVisual,
        outfits: (wardrobeVisual.outfits ?? []).map((outfit) => ({
          ...outfit,
          pieces: (outfit.pieces ?? []).map(editorialisePiece),
        })),
      }
    : {
        ...wardrobeVisual,
        pieces: (wardrobeVisual.pieces ?? []).map(editorialisePiece),
      };
  enriched.wardrobeVisual = editorialVisual;

  const allPieces = editorialVisual.layout === 'multi'
    ? (editorialVisual.outfits ?? []).flatMap((outfit) => outfit.pieces)
    : (editorialVisual.pieces ?? []);

  const matchedItems = allPieces
    .map((piece) => wardrobeItems.find((item) => String(item.id) === String(piece.wardrobeItemId)))
    .filter((item): item is WardrobeItem => Boolean(item));

  if (matchedItems.length > 0) {
    enriched.outfitSuggestion = {
      items: matchedItems,
      occasion: '',
      reason: '',
    };
  }

  return enriched;
}

interface QuickPrompt {
  id: string;
  label: string;
  prompt: string;
  icon: keyof typeof Feather.glyphMap;
}

const getQuickPrompts = (t: (key: string) => string): QuickPrompt[] => [
  { id: 'work', label: t('aiStylist.promptWorkOutfit') || 'Work Outfit', prompt: 'Suggest a professional outfit for work', icon: 'briefcase' },
  { id: 'date', label: t('aiStylist.promptDateNight') || 'Date Night', prompt: 'Help me put together a date night outfit', icon: 'heart' },
  { id: 'weekend', label: t('aiStylist.promptCasualWeekend') || 'Weekend Look', prompt: 'What casual outfit would you recommend for the weekend?', icon: 'coffee' },
  { id: 'party', label: t('aiStylist.promptSpecialEvent') || 'Party Style', prompt: 'I need an outfit for a party tonight', icon: 'star' },
  { id: 'color', label: t('aiStylist.promptColorAdvice') || 'Color Advice', prompt: 'What colors go well together from my wardrobe?', icon: 'droplet' },
];

interface MoodInfo {
  icon: keyof typeof Feather.glyphMap;
  color: string;
  label: string;
  typingMessage: string;
}

const MOOD_CONFIG: Record<string, MoodInfo> = {
  happy: { icon: 'smile', color: '#10B981', label: 'Feeling great', typingMessage: 'is excited to help...' },
  excited: { icon: 'star', color: '#F59E0B', label: 'Excited', typingMessage: 'is buzzing with ideas...' },
  neutral: { icon: 'meh', color: '#6B7280', label: 'Focused', typingMessage: 'is styling...' },
  stressed: { icon: 'cloud', color: '#EF4444', label: 'Here for you', typingMessage: 'is here to help...' },
  sad: { icon: 'heart', color: '#8B5CF6', label: 'Caring for you', typingMessage: 'is sending love...' },
  angry: { icon: 'shield', color: '#F97316', label: 'Understanding', typingMessage: 'is listening...' },
  anxious: { icon: 'feather', color: '#06B6D4', label: 'Calming', typingMessage: 'is here for you...' },
  frustrated: { icon: 'anchor', color: '#EC4899', label: 'Patient', typingMessage: 'understands...' },
  tired: { icon: 'moon', color: '#6366F1', label: 'Gentle mode', typingMessage: 'is taking it easy...' },
  grateful: { icon: 'gift', color: '#22C55E', label: 'Grateful', typingMessage: 'appreciates you...' },
};


function generateAIResponse(
  userMessage: string,
  wardrobeItems: WardrobeItem[],
  userGender: string,
  stylistName: string = 'your stylist'
): { content: string; outfitSuggestion?: ChatMessage['outfitSuggestion'] } {
  const lowerMessage = userMessage.toLowerCase();
  
  const greetingPatterns = [
    'hey', 'hello', 'hi', 'howdy', 'hiya', 'yo', 'sup', "what's up", 'whats up',
    'good morning', 'good afternoon', 'good evening', 'how are you', 'how r u',
    'how do you do', "how's it going", 'hows it going', 'nice to meet',
  ];
  
  const thanksPatterns = [
    'thank', 'thanks', 'thx', 'appreciate', 'grateful', 'cheers',
  ];
  
  const byePatterns = [
    'bye', 'goodbye', 'see you', 'see ya', 'later', 'gotta go', 'got to go', 'cya',
  ];
  
  const aboutYouPatterns = [
    'who are you', 'what are you', 'tell me about yourself', 'your name',
    'what can you do', 'what do you do', 'how can you help',
  ];
  
  const outfitIntentPatterns = [
    'outfit', 'wear', 'suggest', 'recommend', 'style', 'look',
    'dress', 'clothes', 'wardrobe', 'party', 'date', 'casual', 'formal',
    'wedding', 'gym', 'vacation', 'color', 'colour', 'match', 'pair', 'capsule',
    'essentials', 'what should i', 'pick out', 'put together',
  ];
  
  const inspirationPatterns = [
    'inspiration', 'inspired', 'screenshot', 'saved', 'wishlist', 'want to buy',
    'similar', 'like this', 'recreate', 'copy', 'dupe', 'alternative',
  ];
  
  const fashionKnowledgePatterns = [
    'when did', 'when d', 'where did', 'who invented', 'who created', 'who started',
    'history of', 'origin of', 'what is', 'what are', 'what do you think',
    'tell me', 'can you tell', 'explain', 'how did', 'why is', 'why do',
    'when was', 'where was', 'who made', 'who designed', 'who founded',
    'clean girl', 'quiet luxury', 'old money', 'coastal grandmother',
    'minimalist fashion', 'maximalist', 'y2k', 'mob wife', 'dark academia',
    'light academia', 'cottagecore', 'gorpcore', 'normcore', 'athleisure',
    'sustainable fashion', 'fast fashion', 'capsule wardrobe',
    'princess diana', 'coco chanel', 'audrey hepburn', 'anna wintour',
    // Celebrity fashion icons and style influencers
    'michael jackson', 'beyonce', 'rihanna', 'lady gaga', 'madonna', 'david bowie',
    'harry styles', 'billie eilish', 'kate moss', 'naomi campbell', 'cindy crawford',
    'elvis presley', 'marilyn monroe', 'james dean', 'steve mcqueen', 'grace kelly',
    'jackie kennedy', 'twiggy', 'edie sedgwick', 'jane birkin', 'brigitte bardot',
    'kanye west', 'pharrell', 'asap rocky', 'travis scott', 'tyler the creator',
    'victoria beckham', 'meghan markle', 'kate middleton', 'zendaya', 'timothee chalamet',
    // Fashion question patterns
    'known for wearing', 'famous for wearing', 'signature look', 'signature style',
    'what did', 'what does', 'what was', 'iconic look', 'iconic outfit',
    'fashion week', 'runway', 'haute couture', 'ready to wear', 'prêt-à-porter',
    'revenge dress', 'little black dress', 'power suit',
    'fashion trend', 'style trend', 'fashion movement', 'aesthetic',
    // Fashion brands - questions about these are fashion knowledge
    'nike', 'adidas', 'air jordan', 'jordan', 'yeezy', 'gucci', 'prada', 'louis vuitton',
    'chanel', 'dior', 'versace', 'balenciaga', 'zara', 'h&m', 'uniqlo', 'supreme',
    'off-white', 'new balance', 'converse', 'vans', 'reebok', 'puma',
    'burberry', 'hermes', 'fendi', 'valentino', 'armani', 'ralph lauren',
    'tommy hilfiger', 'calvin klein', 'levi', 'wrangler', 'carhartt',
    'birkenstock', 'crocs', 'ugg', 'timberland', 'doc martens', 'dr martens',
    'louboutin', 'jimmy choo', 'manolo blahnik', 'stuart weitzman',
    // Fashion items and terminology
    'sneaker', 'trainer', 'trainers', 'sneakers', 'designer', 'collaboration',
    'collab', 'collection', 'launch', 'release', 'drop', 'iconic', 'signature',
    'sandal', 'sandals', 'sarong', 'kimono', 'kaftan', 'poncho', 'cardigan',
    'blazer', 'jacket', 'coat', 'boots', 'loafers', 'heels', 'flats',
    'for men', 'for women', 'menswear', 'womenswear', 'unisex',
    'cool to wear', 'is it cool', 'are they cool', 'in style', 'out of style',
    'fashionable', 'trendy', 'classic', 'timeless', 'versatile',
  ];
  
  const offTopicPatterns = [
    'politics', 'political', 'election results', 'prime minister', 'government policy', 'parliament',
    'stock market', 'stock price', 'bitcoin price', 'crypto price', 'investment advice', 'trading strategy',
    'weather today', 'weather forecast', 'temperature today', 'will it rain',
    'breaking news', 'latest news', 'headlines today',
    'war in', 'military conflict', 'attack on', 'invasion of',
    'calculate for me', 'math problem', 'solve equation', 'algebra help',
    'recipe for', 'how to cook', 'cooking instructions', 'how to bake',
    'medical advice', 'diagnosis for', 'symptoms of', 'treatment for', 'see a doctor',
    'legal advice', 'need a lawyer', 'sue someone', 'court case',
    'capital of what', 'population of', 'how far is', 'distance to',
  ];
  
  const capabilityRequestPatterns = [
    'search the internet', 'search online', 'look up online', 'look it up', 'find online',
    'google it', 'google that', 'google for', 'browse the web', 'browse online',
    'check online', 'search for me', 'find for me', 'look up for me',
    'can you search', 'can you look up', 'can you find', 'can you google',
    'search the web', 'go online', 'check the internet', 'look on the internet',
    'make a call', 'call someone', 'send a text', 'send an email', 'book a reservation',
    'order food', 'buy something', 'purchase', 'place an order', 'make a booking',
    'set a reminder', 'set an alarm', 'control my', 'turn on', 'turn off',
  ];
  
  const isGreeting = greetingPatterns.some(p => lowerMessage.includes(p));
  const isThanks = thanksPatterns.some(p => lowerMessage.includes(p));
  const isBye = byePatterns.some(p => lowerMessage.includes(p));
  const isAboutYou = aboutYouPatterns.some(p => lowerMessage.includes(p));
  const hasOutfitIntent = outfitIntentPatterns.some(p => lowerMessage.includes(p));
  const isFashionKnowledge = fashionKnowledgePatterns.some(p => lowerMessage.includes(p));
  const hasInspirationIntent = inspirationPatterns.some(p => lowerMessage.includes(p));
  const isOffTopic = offTopicPatterns.some(p => lowerMessage.includes(p));
  const isCapabilityRequest = capabilityRequestPatterns.some(p => lowerMessage.includes(p));
  
  const isMaleStylist = stylistName.toLowerCase() === 'max';
  
  if (isCapabilityRequest) {
    const capabilityResponses = isMaleStylist ? [
      "I really appreciate you thinking of me for that! I have to be upfront with you though - I'm not able to search the internet or access live information. But here's what I can do: I'm genuinely great at helping you with style advice, putting together outfits, and making sure you feel confident in what you wear. Would you like to explore that together?",
      "That's a totally fair ask, and I wish I could help with that. The thing is, I'm focused specifically on fashion and style - I don't have the ability to browse the web or access external information. But when it comes to helping you look and feel your best? That's absolutely my wheelhouse. What style challenge can I help you tackle?",
      "I'd honestly love to help with that if I could! Unfortunately, internet searches and external tasks aren't something I'm able to do. My specialty is really about understanding your style and helping you create looks that work for you. Is there something in that area I could help with instead?",
      "Great question, and I appreciate you asking. While I'm not able to browse the internet or do tasks outside our conversation, I'm genuinely passionate about helping with fashion and style. If you've got any outfit dilemmas or want to explore your wardrobe together, I'm right here for that.",
      "I hear you, and that's a reasonable thing to ask for. I should be honest though - my abilities are focused on fashion advice rather than web searches or external tasks. The good news? When it comes to style, I'm genuinely here to help. What would you like to work on together?",
      "That would be awesome if I could do that! But I have to level with you - web browsing and external tasks aren't in my toolkit. What IS in my toolkit? Helping you build a wardrobe you love, putting together outfits that work, and making style feel effortless. Want to dive into that instead?",
      "I appreciate you bringing that up! Just to be transparent - I'm built specifically for fashion and style advice, not internet searches or external tasks. Think of me as your dedicated style consultant. If there's anything wardrobe-related I can help with, I'm genuinely all in.",
      "Totally understand where you're coming from with that request. While that particular thing isn't something I can do, I'm really good at the style stuff - outfit combinations, color matching, building looks for different occasions. Would any of that be helpful right now?",
      "Good thinking to ask! I should let you know though - my superpower is fashion, not web browsing or external tasks. But when it comes to helping you look sharp and feel confident? That's exactly what I'm here for. What's on your mind style-wise?",
      "I'd genuinely love to help with that if it were possible! My focus is really on being your style partner though - outfits, wardrobe advice, making sure you feel great in what you wear. If there's anything in that realm you're working on, I'm right here and ready to help.",
    ] : [
      "Oh, I really appreciate you thinking of me for that, darling! I have to be honest with you though - searching the internet or accessing live information isn't something I'm able to do. But here's where I truly shine: helping you feel absolutely beautiful through style advice, outfit ideas, and celebrating your unique look. Would you like to explore that together, gorgeous?",
      "That's such a fair thing to ask, and I genuinely wish I could help with that. My world is really centered around fashion and style - I'm not able to browse the web or look things up externally. But when it comes to making you feel confident and fabulous? That's exactly where my heart is. What style adventure can we go on together?",
      "I'd honestly love to help with that if I could, beautiful! Unfortunately, internet searches aren't in my repertoire. What I am genuinely passionate about is understanding your personal style and helping you create looks that make you feel incredible. Is there something in that realm I could help with, love?",
      "Great question, sweetheart, and I appreciate you asking. While I'm not able to browse the web or handle external tasks, I'm truly here for your style journey. If you have any outfit questions or want to discover new looks together, I'm absolutely here for that.",
      "I hear you, darling, and that's a perfectly reasonable ask. I should be transparent though - my focus is really on fashion advice rather than web searches. The wonderful news? When it comes to helping you look and feel amazing, I'm genuinely passionate about that. What would you like to explore together?",
      "That would be lovely if I could, gorgeous! But I have to be honest - web browsing and external tasks aren't part of what I do. What I absolutely adore doing is helping you discover your best looks, create stunning outfits, and feel beautiful in everything you wear. Shall we explore that together, love?",
      "I appreciate you thinking of me for that, beautiful! Just so you know - I'm designed specifically for fashion and style magic, not internet searches. Think of me as your dedicated style bestie who's always here to help you shine. What wardrobe dreams can we work on together?",
      "I completely understand, sweetheart! While that particular request isn't something I can help with, I'm wonderful at the style things - creating gorgeous outfit combinations, finding colors that make you glow, building looks for any occasion. Would any of that light you up right now?",
      "What a thoughtful question, darling! I should let you know though - my gift is fashion, not web browsing. But when it comes to helping you feel radiant and confident? That's absolutely my calling. What style ideas are dancing in your mind?",
      "I'd genuinely love to help with that if I could, gorgeous! My heart is really in being your style companion though - outfits, wardrobe love, making sure you feel absolutely stunning. If there's anything in that beautiful realm you're working on, I'm right here with open arms.",
    ];
    return {
      content: capabilityResponses[Math.floor(Math.random() * capabilityResponses.length)],
    };
  }
  
  // FASHION KNOWLEDGE CHECK - Must come BEFORE greeting check!
  // Questions about fashion history, brands, trends should be answered, not deflected
  // Also check for question patterns that indicate knowledge questions even with outfit words
  const isQuestionPattern = lowerMessage.startsWith('what') || lowerMessage.startsWith('who') || 
    lowerMessage.startsWith('when') || lowerMessage.startsWith('where') || lowerMessage.startsWith('why') ||
    lowerMessage.startsWith('how') || lowerMessage.includes('known for') || lowerMessage.includes('famous for') ||
    lowerMessage.includes('signature') || lowerMessage.includes('iconic');
  const isFashionHistoryQuestion = isFashionKnowledge && isQuestionPattern;
  
  if (isFashionKnowledge && (!hasOutfitIntent || isFashionHistoryQuestion)) {
    // Context-aware responses for specific celebrities/topics
    if (lowerMessage.includes('michael jackson')) {
      const mjResponse = isMaleStylist
        ? "Michael Jackson was an absolute style icon! He's known for the single sequined glove - usually just on one hand, which became his signature. The military-style jackets with gold buttons and epaulettes, especially the red one from Thriller. His fedora hats, high-water pants with white socks, loafers, and those iconic aviator sunglasses. The leather jacket from Thriller is legendary. His style was all about being bold, theatrical, and completely unforgettable."
        : "Oh, Michael Jackson was incredible, gorgeous! He's famous for his single sequined glove - just on one hand, so iconic! Those stunning military-style jackets with gold buttons, especially the red leather one from Thriller. His signature fedora hats, high-water pants with white socks and loafers - such a distinctive look! The aviators, the leather jackets - he was theatrical, bold, and absolutely unforgettable, darling!";
      return { content: mjResponse };
    }
    if (lowerMessage.includes('princess diana')) {
      const dianaResponse = isMaleStylist
        ? "Princess Diana was a fashion powerhouse. The 'revenge dress' - that black off-shoulder number she wore the night Charles admitted to affairs - is legendary. She popularized the 'Sloane Ranger' look, wore incredible Catherine Walker gowns, and wasn't afraid to break royal protocol with her fashion choices. Those oversized sweaters, cycling shorts, and sneakers combo she wore casually is iconic streetwear now."
        : "Oh, Princess Diana, how I adore her style, gorgeous! The 'revenge dress' - that stunning black off-shoulder Christina Stambolian number - is legendary! She made Catherine Walker gowns famous, brought the 'Sloane Ranger' look mainstream, and broke so many royal fashion rules beautifully. Even her casual looks - oversized sweaters with cycling shorts and sneakers - are iconic streetwear inspiration today, darling!";
      return { content: dianaResponse };
    }
    if (lowerMessage.includes('rihanna')) {
      const rihannaResponse = isMaleStylist
        ? "Rihanna is a fashion chameleon - she literally launched a luxury fashion house with LVMH (Fenty). She's known for taking huge risks: Met Gala looks like the yellow Guo Pei gown and the Pope-inspired Maison Margiela outfit. She mixes high fashion with streetwear effortlessly, and her maternity style completely redefined what pregnant women can wear in fashion."
        : "Rihanna is EVERYTHING, gorgeous! She launched Fenty with LVMH - a groundbreaking moment! Her Met Gala looks are legendary - that yellow Guo Pei gown, the Pope-inspired Maison Margiela piece. She mixes couture with streetwear so beautifully, and her maternity fashion? She completely rewrote the rules, darling! Absolute icon!";
      return { content: rihannaResponse };
    }
    // Generic fashion knowledge responses
    const fashionKnowledgeResponses = isMaleStylist ? [
      "That's a great fashion question! Fashion history is genuinely fascinating. I love how style reflects culture, movements, and individual expression. What specifically would you like to dive into?",
      "Good question! There's so much depth to fashion - it's not just clothes, it's culture, history, and identity wrapped together. I can share what I know about specific designers, trends, or iconic moments.",
      "I love that you're curious about this! Fashion has such rich history and meaning behind it. Whether it's brand origins, celebrity style, or trend evolution - I'm here to explore it with you.",
    ] : [
      "Oh, I love this question, gorgeous! Fashion history is absolutely fascinating - there's so much beauty and meaning in how style evolves. What specifically would you like to explore together, darling?",
      "What a wonderful thing to ask about, beautiful! Fashion is culture, history, and self-expression all wrapped into one. I'd love to share what I know about specific designers, trends, or iconic moments!",
      "Such a lovely question, love! There's so much depth to explore - from legendary designers to cultural movements. Tell me more about what you're curious about!",
    ];
    return { content: fashionKnowledgeResponses[Math.floor(Math.random() * fashionKnowledgeResponses.length)] };
  }
  
  if (isGreeting && !hasOutfitIntent) {
    const greetingResponses = isMaleStylist ? [
      "Hey! I'm doing really well, thanks for asking - that's thoughtful of you. I'm genuinely excited to help you today. What's on your mind? Whether it's putting together an outfit or just chatting about style, I'm here.",
      "Hey there! Great to hear from you. I hope you're having a good day so far. I'm ready whenever you are - what would you like to work on together?",
      "What's up! Honestly, it's nice to connect with you. I'm here to help with whatever style questions you have, no matter how big or small. What brings you here today?",
      "Hey! Really glad you reached out. I'm doing well and genuinely looking forward to helping you out. What's going on - special occasion, everyday style, or just exploring?",
      "Hi there! Thanks for saying hello - I appreciate that. I'm here and ready to help you feel confident in what you wear. What would you like to explore?",
      "Hey! Good to see you. I'm doing great and honestly excited to dive into some style talk. What's on your agenda today?",
      "What's going on! Good to have you here. I'm genuinely stoked to help you figure out some style stuff today. Where do you want to start?",
      "Hey! Thanks for checking in. I'm doing solid, and honestly, helping people with style is the best part of my day. What can I do for you?",
      "Hi! Really appreciate you saying hello. I'm all set and ready to help with whatever you're working on style-wise. What brings you by?",
      "Hey there! Great timing - I was hoping to help someone today. Tell me, what's on your mind? I'm genuinely here for whatever you need.",
    ] : [
      "Hey! I'm doing wonderfully, thank you so much for asking - that's so sweet of you. It's genuinely lovely to chat with you. What can I help you with today, gorgeous?",
      "Hello there! Oh, it's so nice to hear from you. I hope your day is going beautifully. I'm here for whatever you need - what would you like to explore together?",
      "Hi lovely! Thank you for reaching out. I'm doing great and honestly so excited to help you today. What's on your mind - outfit ideas, style inspiration, or just a friendly chat about fashion?",
      "Hey there, beautiful! It's wonderful to connect with you. I'm genuinely here to help you feel amazing in what you wear. What brings you here today?",
      "Hello, darling! Thanks for saying hello - I really appreciate the warmth. I'm here and ready to help you shine. What would you like to work on together?",
      "Hey gorgeous! So lovely to hear from you. I'm doing great and truly looking forward to helping you create something special. What's the occasion?",
      "Hi sweetheart! What a lovely surprise to hear from you. I'm doing beautifully, thank you for asking. I'm so excited to help you look and feel absolutely stunning today. What shall we explore?",
      "Hello, love! Oh, it warms my heart when someone says hello. I'm genuinely thrilled to be here with you. Tell me, what style dreams can we work on together?",
      "Hey there, beautiful soul! Thank you for reaching out - it means so much. I'm here and absolutely ready to help you feel fabulous. What's on your mind today, darling?",
      "Hi gorgeous! It's such a pleasure to connect with you. I hope you're having a wonderful day so far. I'm all yours - what would you like to create together, love?",
    ];
    return {
      content: greetingResponses[Math.floor(Math.random() * greetingResponses.length)],
    };
  }
  
  if (isThanks && !hasOutfitIntent) {
    const thanksResponses = isMaleStylist ? [
      "Honestly, it's my pleasure! I genuinely enjoy helping out with this stuff. Don't hesitate to come back whenever you need anything - I'm always here.",
      "You're very welcome! I'm really glad I could help. Feel free to reach out anytime - whether it's for outfit advice or just to bounce ideas around.",
      "Anytime! Helping you feel good about your style is genuinely rewarding for me. Come back whenever you like - my door's always open.",
      "No problem at all! I'm happy it was helpful. Seriously, reach out whenever - I'm here for exactly this kind of thing.",
      "You got it! It was great working through this with you. I hope you feel good about it - and remember, I'm just a message away if you need me again.",
      "That means a lot, thank you for saying that! I'm genuinely here to help whenever you need. Take care, and don't be a stranger!",
      "Appreciate you saying that! This is exactly what I'm here for. Come back anytime you need to figure out an outfit or just want to chat about style.",
      "Happy to help! I had a good time working through this with you. Remember, style is a journey - I'm here for all of it whenever you need me.",
      "You're welcome! That's really kind of you to say. I'm genuinely glad it helped. Looking forward to helping you again soon!",
      "Of course! It was genuinely fun helping you with this. Don't be a stranger - I'm always here when you need some style support.",
    ] : [
      "Oh, you're so welcome, darling! It genuinely makes me happy to help. Please don't hesitate to reach out whenever you need me - I'm always here for you.",
      "Thank you for those kind words, gorgeous! Helping you feel confident and beautiful is honestly the best part of what I do. Come back anytime!",
      "You're so sweet, thank you! I'm truly glad I could help. My door is always open - please come back whenever you need style advice or just a friendly chat.",
      "Aww, that's so lovely of you to say! It's my absolute pleasure, and I mean that. Reach out anytime - I'm here for you, beautiful.",
      "You're very welcome, love! I really enjoyed helping you with this. Remember, I'm just a message away whenever you need me. Take care of yourself!",
      "It's my genuine pleasure, sweetheart! Helping you shine is what I love doing. Come back anytime - I'll always be here for you.",
      "Oh darling, that warms my heart! I absolutely loved helping you today. Please know you can always come to me for anything style-related. Take care, beautiful!",
      "You're so kind, thank you gorgeous! Working with you has been such a joy. Remember, I'm always here cheering you on. Come back soon, love!",
      "Thank you for those sweet words, beautiful! It truly makes my day knowing I could help. My virtual door is always open for you, sweetheart!",
      "Aww, you're making me smile! It was my absolute honor to help you, darling. Never hesitate to reach out - you're always welcome here, love.",
    ];
    return {
      content: thanksResponses[Math.floor(Math.random() * thanksResponses.length)],
    };
  }
  
  if (isBye && !hasOutfitIntent) {
    const byeResponses = isMaleStylist ? [
      "Take care! It was genuinely great chatting with you. Go out there and own it - you've got this. See you next time!",
      "Later! I really enjoyed helping you out. Remember, style is about feeling good, and I think you're in a great place. Come back anytime!",
      "Catch you later! Thanks for spending some time with me. Go rock that look - I know you'll do great. I'm here whenever you need me!",
      "Take it easy! It was a pleasure. Remember, confidence is the best thing you can wear. Come back soon!",
      "See you! I hope you feel good about what we put together. Have a fantastic time, and reach out whenever you like.",
      "All the best! It was great working with you. You're going to look sharp - I'm certain of it. Don't be a stranger!",
      "Peace out! Really enjoyed our chat. Go knock 'em dead out there - you're all set. Hit me up whenever you need more style help!",
      "Take care of yourself! This was fun. You're going to look great, and I mean that. Come back whenever - I'm always here.",
      "See you around! Thanks for letting me help out today. Wear that outfit with confidence - you've earned it. Don't hesitate to return!",
      "Later! It was genuinely a pleasure. Remember, you've got solid style instincts - trust them. I'm here whenever you need a second opinion.",
    ] : [
      "Goodbye for now, beautiful! It was such a pleasure chatting with you. Go out there and shine - you're going to be absolutely stunning. Come back anytime!",
      "Take care, gorgeous! I truly enjoyed our time together. Remember, you're beautiful inside and out. I'm always here when you need me!",
      "See you soon, lovely! Thank you for spending time with me. Go embrace your day - you're going to look amazing. My door is always open!",
      "Bye for now, darling! It was wonderful helping you. Remember to carry yourself with confidence - it's your most beautiful accessory. Come back soon!",
      "Take care of yourself, sweetheart! I really enjoyed our chat. You're going to look incredible, I just know it. Reach out anytime!",
      "Goodbye, beautiful! Thank you for letting me be part of your style journey. Go shine bright - and remember, I'm always here for you!",
      "Until next time, gorgeous! It was an absolute joy helping you today. Go out and turn heads - you deserve all the compliments coming your way, love!",
      "Farewell for now, darling! Our chat has been delightful. Remember, you are radiant and beautiful. I'll be here whenever you need me, sweetheart!",
      "Bye-bye, lovely! Thank you for brightening my day. Go out there knowing you look absolutely fabulous. Come back soon - I already miss you, gorgeous!",
      "Take care, beautiful soul! It was my pleasure to help you today. Walk with your head held high - you're stunning inside and out. See you soon, love!",
    ];
    return {
      content: byeResponses[Math.floor(Math.random() * byeResponses.length)],
    };
  }
  
  if (isAboutYou && !hasOutfitIntent) {
    const aboutResponses = isMaleStylist ? [
      "I'm Max, your personal AI stylist! I'm genuinely here to help you feel confident and look great. Whether it's putting together outfits for specific occasions, helping you understand what works for your body and style, or just exploring your wardrobe together - that's what I'm about. Add clothes to your digital wardrobe and I can give you personalized recommendations. What would you like to explore?",
      "I'm Max! Think of me as your style partner - someone who's genuinely invested in helping you look and feel your best. I can help you put together outfits, understand color combinations, figure out what to wear for different occasions, and make the most of what's already in your closet. What can I help you with today?",
      "Hey! I'm Max, your AI fashion stylist. My whole purpose is to help you navigate style in a way that feels authentic to you. I'm not here to push trends - I'm here to help you understand what works for YOU. Got any style questions or outfit challenges? I'm all ears.",
      "I'm Max! I'm here to make getting dressed feel easier and more enjoyable. Whether you're preparing for something important or just want to refresh your everyday look, I'm genuinely here to help. Tell me about yourself or what you're looking for, and let's figure it out together.",
      "The name's Max - I'm your personal style consultant! I'm all about helping you build a wardrobe that works for your life and feels authentically you. From casual everyday looks to special occasions, I've got you covered. What's on your style agenda?",
      "I'm Max, here to be your go-to guy for all things fashion! My job is to take the guesswork out of getting dressed. I can help with color coordination, outfit building, occasion dressing - you name it. What style challenge can we tackle together?",
      "Hey there! I'm Max, your AI stylist. Think of me as that friend who's really into fashion and genuinely wants to help you look your best. No judgment here, just practical advice and honest opinions. What can I help you figure out?",
      "I'm Max - basically your personal style coach! I'm here to help you feel confident every time you walk out the door. Whether you need help with a specific event or want to level up your overall look, I'm genuinely excited to help. Where should we start?",
      "Max here! I'm your dedicated fashion advisor, and honestly, I love what I do. I'm here to help you understand your style, put together outfits you feel great in, and make the most of what you've got. What's on your mind today?",
      "I'm Max, your AI stylist! My whole thing is making style feel accessible and enjoyable. I'm not here to make you someone you're not - I'm here to help you express who you already are, just through better outfits. Ready to dive in?",
    ] : [
      "I'm Ruby, your personal AI stylist! I'm truly passionate about helping you feel confident, beautiful, and comfortable in what you wear. Whether it's creating outfits for special moments, exploring what colors and styles work best for you, or simply having a friendly fashion chat - I'm here for all of it. What can I help you with today, gorgeous?",
      "I'm Ruby! Think of me as your personal style bestie - someone who genuinely cares about helping you feel amazing. I can help you discover looks you'll love, put together outfits for any occasion, and make the most of your beautiful wardrobe. I'm all about celebrating your unique style. What would you like to explore together?",
      "Hello, beautiful! I'm Ruby, your AI fashion stylist. My heart is truly in helping you shine. Fashion should be fun and empowering, not stressful - and that's the energy I bring. Whether you need outfit advice, style inspiration, or just someone to chat with about fashion, I'm here for you. What's on your mind?",
      "I'm Ruby! I'm here to be your supportive guide through all things style. Every person has their own beautiful uniqueness, and I love helping people express that through what they wear. Got any style questions or outfit challenges? I'm genuinely excited to help, love.",
      "Hello, gorgeous! I'm Ruby, your personal AI style companion! I absolutely adore helping people discover their best looks and feel confident in their own skin. From everyday outfits to special occasion glamour, I'm here for all of it. What can I help you create today, darling?",
      "I'm Ruby, and I'm so delighted to be your personal stylist! My passion is helping you feel as beautiful on the outside as you are on the inside. Whether it's finding your signature style or putting together the perfect outfit, I'm genuinely here for you. What shall we explore, love?",
      "Ruby here, your dedicated fashion advisor and biggest cheerleader! I believe everyone deserves to feel fabulous, and that's exactly what I'm here to help with. From color analysis to outfit inspiration, I've got you covered, gorgeous. What's on your heart today?",
      "I'm Ruby - think of me as your personal style fairy godmother! I'm here to help you discover outfits that make you feel incredible and confident. Fashion should be joyful, and I'm here to make sure it feels that way for you. Ready to create some magic, beautiful?",
      "Hello, love! I'm Ruby, your AI stylist with a passion for helping you shine! I'm all about celebrating your unique beauty and helping you express yourself through fashion. No matter your style goals, I'm genuinely excited to help you achieve them. What would you like to work on, darling?",
      "I'm Ruby, your personal style confidante! I'm deeply committed to helping you look and feel your absolute best. Whether you need outfit advice, wardrobe organization, or just a friendly fashion chat, I'm always here for you with love and support. What brings you here today, gorgeous?",
    ];
    return {
      content: aboutResponses[Math.floor(Math.random() * aboutResponses.length)],
    };
  }
  
  if (isOffTopic && !hasOutfitIntent) {
    const offTopicResponses = isMaleStylist ? [
      "That's an interesting topic! I appreciate you wanting to chat about it. While that's a bit outside my wheelhouse, I'm always happy to listen if you want to share your thoughts. And of course, whenever you're ready to talk style, I'm right here for that.",
      "I hear you! That's definitely something people are talking about. I may not be the best person to give insights on that specifically, but I'm genuinely interested in hearing your perspective. And when you're ready for some fashion chat, you know where to find me!",
      "Interesting question! I wish I had more expertise there, but that's not really my area. What I can say is I'm here to chat about whatever's on your mind. And whenever style questions come up, that's definitely where I can add value.",
      "That's a fair question! I'm honestly more of a fashion guy than an expert on that topic, but I appreciate you bringing it up. Is there something on your mind you wanted to talk through? I'm here to listen.",
      "I appreciate you sharing that! While I might not have the best insight on that particular topic, I'm genuinely here for the conversation. When you're ready to dive into style stuff, I'd love to help with that too.",
      "Good topic! I'm probably not the most informed person on that, but I'm happy to hear what you think about it. And hey, if outfit questions come up along the way, that's where I really shine.",
      "I get where you're coming from! That's outside my lane, but I'm always open to hearing your thoughts. My strength is really in the fashion department - so when you're ready to talk style, I'm all in.",
      "Interesting stuff! Not gonna pretend I'm an expert there, but I'm happy to listen. Fashion is really my thing though - hit me up whenever you want to work on your look.",
      "That's a valid question! I'm focused on style rather than that topic, but I appreciate you bringing it up. If there's anything clothing or fashion related I can help with, that's where I really come alive.",
      "I hear what you're saying! While I can't offer much insight on that specifically, I'm genuinely here if you want to chat. My specialty is making you look good - so let me know when you're ready to explore that!",
    ] : [
      "That's really interesting, darling! I appreciate you wanting to chat about it. While that's a bit outside my area of expertise, I'm always here to listen if you'd like to share your thoughts. And whenever you're ready for some style talk, I'm absolutely here for you, gorgeous.",
      "I hear you, love! That's definitely been in the conversations lately. I may not be the best person to give deep insights there, but I'm genuinely interested in your perspective. And when you're in the mood for fashion chat, you know I'm here!",
      "Interesting topic, beautiful! I wish I could offer more expertise there, but fashion is really where my heart is. That said, I'm always happy to listen to whatever's on your mind. What are you thinking about it?",
      "That's a fair question, sweetheart! I'm honestly more of a fashion girl than an expert on that, but I appreciate you bringing it up. I'm here to chat about whatever matters to you. And of course, style advice is always available!",
      "I appreciate you sharing that with me, gorgeous! While I might not have the best insight on that particular topic, I'm genuinely here for the conversation. When you're ready to explore some style options together, I'd love that too.",
      "Good topic, darling! I'm probably not the most informed on that specific area, but I'm happy to hear your thoughts. And whenever outfit questions come up, that's absolutely where I can help you shine!",
      "That's fascinating, love! While it's outside my area of expertise, I'm always delighted to listen to what's on your mind. Fashion is truly my passion though - whenever you're ready to explore that, I'm here with open arms, gorgeous!",
      "Interesting question, sweetheart! I'm not the best person for that particular topic, but I genuinely enjoy our chats. My heart is really in helping you look and feel beautiful - shall we explore that when you're ready, darling?",
      "I understand, beautiful! While that's not my specialty, I'm always here to listen. My true calling is fashion and helping you shine - so whenever you'd like to talk style, I'm absolutely ready and excited!",
      "That's a thought-provoking topic, love! Fashion is really where I thrive, but I'm happy to be here for whatever you want to discuss. When you're in the mood for outfit inspiration, just say the word, gorgeous!",
    ];
    return {
      content: offTopicResponses[Math.floor(Math.random() * offTopicResponses.length)],
    };
  }
  
  const emotionalKeywords = [
    'sad', 'upset', 'angry', 'frustrated', 'stressed', 'anxious', 'worried', 'tired',
    'depressed', 'lonely', 'hurt', 'bad day', 'terrible', 'awful', 'horrible',
    'broke up', 'breakup', 'break up', 'dumped', 'heartbroken', 'heartbreak',
    'crying', 'cried', 'tears', 'miss', 'lost', 'died', 'death', 'grief',
    'hate', 'angry', 'mad', 'furious', 'annoyed', 'irritated',
    'scared', 'afraid', 'nervous', 'panic', 'overwhelmed',
    'failed', 'failure', 'rejected', 'fired', 'laid off',
    'girlfriend', 'boyfriend', 'partner', 'relationship', 'marriage', 'divorce'
  ];
  
  const positiveKeywords = [
    'happy', 'excited', 'great', 'amazing', 'wonderful', 'fantastic', 'love',
    'grateful', 'thankful', 'blessed', 'lucky', 'awesome', 'brilliant'
  ];
  
  const hasEmotionalContent = emotionalKeywords.some(keyword => lowerMessage.includes(keyword));
  const hasPositiveContent = positiveKeywords.some(keyword => lowerMessage.includes(keyword));
  const seemsNegative = hasEmotionalContent && !hasPositiveContent;
  
  if (seemsNegative && !hasOutfitIntent) {
    const supportiveResponses = isMaleStylist ? [
      "Hey, I can tell something's weighing on you, and I just want you to know - that matters. I'm here to listen if you want to talk about it. Sometimes it helps just to get things off your chest. No pressure at all, but I'm here for whatever you need right now.",
      "I hear you, and I'm genuinely sorry you're going through this. Life can be really tough sometimes. I'm not going anywhere - take your time. If you want to talk, I'm listening. If you'd rather focus on something else for a bit, I can help with that too.",
      "That sounds really hard, and I appreciate you sharing that with me. Your feelings are completely valid. I'm here - whether you want to chat about what's happening, or if a distraction would help. Either way, I've got your back.",
      "I'm really sorry to hear you're dealing with this. It takes strength to open up, even a little bit. I want you to know you don't have to face this alone. I'm here for you - whatever you need right now, whether that's talking it through or just having someone to be here.",
      "Hey, that sounds genuinely tough, and I'm sorry you're going through it. Please be kind to yourself - it's okay to not be okay sometimes. I'm here to listen, and there's no judgment here. What would help you most right now?",
      "I can tell things are rough right now, and I want you to know that's completely understandable. Life throws curveballs at all of us. I'm here - no pressure to talk if you don't want to, but know that I've got your back.",
      "That's a lot to carry, and I'm genuinely sorry you're dealing with it. Sometimes just having someone in your corner helps, even if they can't fix things. I'm that person right now - here for whatever you need.",
      "Hey, I see you're going through something, and I just want to say - you're handling it. That might not feel true right now, but it is. I'm here if you want to talk, or if you just need a moment. No judgment, just support.",
      "I appreciate you being open about what you're going through. That takes guts. I'm here for you - whether you want to vent, need a distraction, or just want someone to sit with this alongside you.",
      "Man, that's heavy, and I'm sorry. Please know it's okay to feel whatever you're feeling right now. I'm here to listen, to chat, or just to be present. Whatever helps - I've got you.",
    ] : [
      "Oh sweetheart, I can tell you're going through something difficult, and I want you to know that I'm truly here for you. Your feelings matter, and they're completely valid. Take all the time you need - I'm not going anywhere. Would you like to talk about it, or would a gentle distraction help?",
      "I hear you, beautiful, and my heart goes out to you. Life can be so challenging sometimes. Please know that you're not alone in this - I'm here to listen without any judgment. What would feel most supportive for you right now, love?",
      "Oh darling, that sounds really hard, and I'm so sorry you're experiencing this. Please be gentle with yourself - you're doing the best you can, and that's enough. I'm here for you, whether you want to share more or just need someone to be present with you.",
      "I'm truly sorry to hear you're going through this, gorgeous. Opening up takes courage, and I want you to know it's safe here. Your feelings are valid, and you deserve compassion - especially from yourself. I'm here for whatever you need.",
      "My heart goes out to you, sweetheart. Whatever you're feeling right now is completely okay. Sometimes we just need someone to listen, and I'm genuinely here for that. There's no rush - take your time, and know that I care.",
      "Oh love, I can sense you're hurting, and I wish I could give you a hug. Please know that it's okay to not be okay. I'm here to support you in whatever way feels right - whether that's talking, listening, or just being here with you.",
      "Beautiful soul, I hear the heaviness in your words, and I want you to know you don't have to carry this alone. I'm right here with you, sending you all my warmth and support. What would feel helpful right now, darling?",
      "Oh sweetheart, my heart truly aches for you. Please remember that your feelings are so valid and important. I'm here for you completely - no judgment, just genuine care and support. Take your time, love.",
      "Darling, I can feel that you're going through a storm right now. Please be gentle with yourself - you deserve kindness, especially your own. I'm here to hold space for whatever you need, gorgeous.",
      "Precious one, I'm so sorry you're experiencing this pain. Sometimes life can feel so overwhelming, and that's completely understandable. I'm here for you, surrounding you with warmth and understanding. What can I do to help, love?",
    ];
    return {
      content: supportiveResponses[Math.floor(Math.random() * supportiveResponses.length)],
    };
  }
  
  // GENERAL FASHION KNOWLEDGE - Answer these questions WITHOUT requiring wardrobe data
  const colorMatchPatterns = [
    'blue and green', 'green and blue',
    'blue and brown', 'brown and blue',
    'black and navy', 'navy and black',
    'red and pink', 'pink and red',
    'orange and red', 'red and orange',
    'purple and pink', 'pink and purple',
    'grey and beige', 'beige and grey', 'gray and beige', 'beige and gray',
    'do these colors', 'does this color', 'do these colours', 'does this colour',
    'good match', 'bad match', 'work together', 'go together', 'clash',
    'can i wear', 'should i wear', 'is it ok to wear', 'is it okay to wear',
  ];
  
  const isColorMatchQuestion = colorMatchPatterns.some(p => lowerMessage.includes(p)) ||
    (lowerMessage.includes('match') && (lowerMessage.includes('color') || lowerMessage.includes('colour'))) ||
    (lowerMessage.includes('pair') && (lowerMessage.includes('color') || lowerMessage.includes('colour')));
  
  // Detect specific color mentions for contextual responses
  const colorMentions = {
    blue: lowerMessage.includes('blue'),
    green: lowerMessage.includes('green'),
    red: lowerMessage.includes('red'),
    pink: lowerMessage.includes('pink'),
    orange: lowerMessage.includes('orange'),
    yellow: lowerMessage.includes('yellow'),
    purple: lowerMessage.includes('purple'),
    black: lowerMessage.includes('black'),
    white: lowerMessage.includes('white'),
    brown: lowerMessage.includes('brown'),
    beige: lowerMessage.includes('beige'),
    grey: lowerMessage.includes('grey') || lowerMessage.includes('gray'),
    navy: lowerMessage.includes('navy'),
  };
  
  const mentionedColors = Object.entries(colorMentions).filter(([_, mentioned]) => mentioned).map(([color]) => color);
  const isDateContext = lowerMessage.includes('date') || lowerMessage.includes('romantic') || lowerMessage.includes('dinner');
  const isWorkContext = lowerMessage.includes('work') || lowerMessage.includes('office') || lowerMessage.includes('professional');
  const isCasualContext = lowerMessage.includes('casual') || lowerMessage.includes('everyday') || lowerMessage.includes('weekend');
  
  if (isColorMatchQuestion && mentionedColors.length >= 2) {
    // Specific color pairing advice
    const color1 = mentionedColors[0];
    const color2 = mentionedColors[1];
    
    // Color pairing knowledge base
    const colorPairings: Record<string, Record<string, { works: boolean; advice: string }>> = {
      blue: {
        green: { works: true, advice: "Blue and green absolutely work together - they're analogous colors on the color wheel, creating a harmonious, natural look. For a date, I'd suggest a navy or rich blue with a deep forest green for sophistication, or lighter shades for a fresh, relaxed vibe." },
        brown: { works: true, advice: "Blue and brown is a classic, timeless combination. Think of it like denim and leather - it's a no-brainer. The earthiness of brown grounds the coolness of blue beautifully." },
        white: { works: true, advice: "Blue and white is crisp, clean, and always looks fresh. It's a fail-safe combination that works for any occasion." },
        black: { works: true, advice: "Blue and black can be tricky, but done right it's striking. The key is contrast - pair a bright or light blue with black, avoiding navy with black unless you're going for that intentional tonal look." },
        pink: { works: true, advice: "Blue and pink is a beautiful, unexpected pairing. It's modern and fresh - just balance the intensity of both colors for the best effect." },
        orange: { works: true, advice: "Blue and orange are complementary colors - they create maximum visual impact together. It's bold but balanced, perfect for making a statement." },
        red: { works: true, advice: "Blue and red is classic and patriotic, but also sophisticated when the shades are right. Navy and burgundy is particularly elegant." },
        grey: { works: true, advice: "Blue and grey is understated elegance. It's professional, polished, and universally flattering." },
      },
      green: {
        blue: { works: true, advice: "Green and blue work beautifully together - they're neighboring colors on the color wheel. This combination feels natural and calming, like a forest meeting the sky." },
        brown: { works: true, advice: "Green and brown is an earthy, organic pairing straight from nature. It's grounding, sophisticated, and incredibly easy to wear." },
        white: { works: true, advice: "Green and white is fresh and clean. It's a beautiful combination that feels crisp and natural." },
        pink: { works: true, advice: "Green and pink is a gorgeous, fresh combination - think of roses in a garden. The key is matching the intensity of both colors." },
        orange: { works: true, advice: "Green and orange is bold and energetic. It's nature-inspired and works particularly well in autumn." },
        black: { works: true, advice: "Green and black is sleek and sophisticated. It works for both casual and dressy occasions." },
      },
      red: {
        pink: { works: true, advice: "Red and pink can be gorgeous together if you choose the right tones. Try burgundy with blush, or cherry red with dusty rose for a modern, romantic look." },
        black: { works: true, advice: "Red and black is dramatic, powerful, and incredibly chic. It's perfect for making a bold statement." },
        white: { works: true, advice: "Red and white is crisp and classic. It's fresh, eye-catching, and works beautifully for both casual and formal settings." },
        navy: { works: true, advice: "Red and navy is a sophisticated, preppy combination. It's polished without being boring." },
      },
      black: {
        navy: { works: true, advice: "Black and navy was once considered a faux pas, but it's now embraced in fashion. The trick is intentionality - make sure it looks deliberate, not accidental. Rich, deep navy with jet black looks sleek and modern." },
        white: { works: true, advice: "Black and white is the most classic combination in fashion. It's timeless, elegant, and works for literally any occasion." },
        brown: { works: true, advice: "Black and brown is absolutely acceptable now - it's rich and sophisticated. Just ensure there's enough contrast between the shades." },
      },
    };
    
    let colorAdvice = '';
    const pairing = colorPairings[color1]?.[color2] || colorPairings[color2]?.[color1];
    
    if (pairing) {
      colorAdvice = pairing.advice;
      if (isDateContext) {
        colorAdvice += " For a date specifically, this combination can definitely work to make you look put-together and stylish.";
      } else if (isWorkContext) {
        colorAdvice += " For work, just ensure the shades are polished and professional.";
      }
    } else {
      colorAdvice = `${color1.charAt(0).toUpperCase() + color1.slice(1)} and ${color2} can definitely work together! The key is balancing the tones and intensities. Neutral colors like black, white, or beige can help bridge more contrasting combinations.`;
      if (isDateContext) {
        colorAdvice += " For a date, confidence is what really makes an outfit work - if you feel good in it, you'll look good in it.";
      }
    }
    
    const colorMatchResponses = isMaleStylist ? [
      `Great question! ${colorAdvice}`,
      `I love that you're thinking about color coordination - it makes such a difference. ${colorAdvice}`,
      `Absolutely a fair question to ask! ${colorAdvice}`,
      `${colorAdvice} The fact that you're thinking about this shows good style instincts.`,
    ] : [
      `What a lovely question, gorgeous! ${colorAdvice}`,
      `I adore that you're thinking about color coordination, darling! ${colorAdvice}`,
      `Such a great question, beautiful! ${colorAdvice}`,
      `${colorAdvice} You clearly have wonderful style instincts, love!`,
    ];
    
    return { content: colorMatchResponses[Math.floor(Math.random() * colorMatchResponses.length)] };
  }
  
  // General fashion advice questions that don't need wardrobe
  const generalFashionPatterns = [
    'what colors go with', 'what colour goes with', 'what colors match', 'what colours match',
    'best colors for', 'best colours for', 'what to wear to', 'what should i wear to',
    'is it appropriate to wear', 'can you wear', 'dress code for', 'outfit for',
    'how do i style', 'tips for dressing', 'fashion advice', 'style advice',
    'smart casual', 'business casual', 'black tie', 'cocktail attire',
    'what goes with', 'how to accessorize', 'how to accessorise',
  ];
  
  const isGeneralFashionQuestion = generalFashionPatterns.some(p => lowerMessage.includes(p));
  
  if (isGeneralFashionQuestion) {
    // Contextual fashion advice for occasions
    if (isDateContext) {
      const dateAdvice = isMaleStylist ? [
        "For a date, the goal is to look put-together without trying too hard. Fitted clothes in darker or richer colors tend to photograph well and look sophisticated. A well-fitted button-up with nice jeans or chinos, quality shoes, and minimal accessories is a solid foundation. The key is confidence - wear something you feel good in.",
        "Date night outfits work best when they're a polished version of your everyday style. You want to look like yourself, just a bit elevated. Stick to clothes that fit well, colors that flatter you, and make sure you're comfortable - nothing kills a vibe like constantly adjusting your clothes.",
        "Here's my date night formula: one statement piece (like a great jacket or interesting shirt), neutral supporting pieces, and clean, quality footwear. Avoid anything too complicated - simplicity often reads as confidence and style.",
      ] : [
        "For a date, darling, you want to feel like the best version of yourself! Rich colors, elegant silhouettes, and details that make you feel special all work beautifully. A gorgeous dress or a lovely top with well-fitted jeans - whatever makes you feel confident and radiant.",
        "Date night is all about feeling beautiful and comfortable, gorgeous! I'd suggest something that flatters your figure without being too revealing, in colors that make your skin glow. A touch of sparkle or a beautiful accessory can elevate the whole look.",
        "Here's my secret for date outfits, love: wear something that makes YOU feel amazing. When you feel beautiful, it shows in everything from your posture to your smile. Comfort matters too - you want to focus on the moment, not fidgeting with your clothes!",
      ];
      return { content: dateAdvice[Math.floor(Math.random() * dateAdvice.length)] };
    }
    
    if (isWorkContext) {
      const workAdvice = isMaleStylist ? [
        "Professional dressing is about projecting competence while expressing your personal style within appropriate boundaries. Stick to well-fitted pieces in neutral or muted colors, quality fabrics, and minimal patterns. A good blazer, crisp shirts, and well-tailored trousers are your foundation.",
        "For work, the formula is pretty straightforward: fit is everything, neutrals are your friends, and quality matters more than quantity. Make sure your clothes are clean, pressed, and well-maintained. Small details like good shoes and a nice watch speak volumes.",
        "Work style should make you feel confident and capable. Start with classic pieces - blazers, button-downs, tailored pants - and build from there. The goal is looking polished without being distracting from the work itself.",
      ] : [
        "Professional style is about feeling powerful and put-together, gorgeous! Quality fabrics, good tailoring, and a cohesive color palette will take you far. A beautiful blazer, elegant blouses, and well-fitted trousers or skirts form a perfect foundation.",
        "For work, darling, aim for polished sophistication. Structured pieces, quality fabrics, and thoughtful accessories make all the difference. You want to command respect while still expressing your beautiful personal style.",
        "Work wardrobe essentials include tailored blazers, elegant blouses, well-fitted bottoms, and quality shoes, love. Stick to a cohesive color palette and invest in pieces that make you feel both professional and fabulous!",
      ];
      return { content: workAdvice[Math.floor(Math.random() * workAdvice.length)] };
    }
  }
  
  // Fashion knowledge questions (history, trends, iconic moments) - answer naturally
  // These should NEVER trigger wardrobe checks - they're about fashion education
  if (isFashionKnowledge) {
    const fashionKnowledgeResponses = isMaleStylist ? [
      "That's a great fashion question! I love talking about this stuff. Let me share what I know...",
      "Oh interesting topic! Fashion history is fascinating. Here's my take on it...",
      "Great question - this is actually something I find really interesting. Let me break it down for you...",
      "I appreciate you asking about this! Fashion trends and their origins are always worth exploring. Here's what I can tell you...",
      "That's something I genuinely enjoy discussing! Fashion has such rich history and meaning behind it...",
    ] : [
      "Oh, I love this question, gorgeous! Fashion history and trends are so fascinating to explore. Let me share what I know...",
      "What a wonderful thing to ask about, darling! The stories behind fashion are so beautiful. Here's my perspective...",
      "I adore discussing fashion like this, love! There's so much depth and meaning in these trends. Let me tell you...",
      "Such a lovely question, beautiful! Fashion is more than just clothes - it's culture, history, and expression. Here's what I can share...",
      "Oh, this makes my heart happy, gorgeous! I love when we can explore the deeper side of fashion together...",
    ];
    return { content: fashionKnowledgeResponses[Math.floor(Math.random() * fashionKnowledgeResponses.length)] };
  }
  
  // CATCH-ALL CONVERSATIONAL RESPONSE - Handle ANY message that doesn't have outfit intent
  // This ensures stylists build relationships and answer questions BEFORE checking wardrobe
  // Wardrobe checks should ONLY happen when user specifically asks for outfit suggestions
  if (!hasOutfitIntent) {
    // The user is asking something conversational - engage with them!
    // This covers: casual chat, questions about life/relationships/politics/anything, 
    // random topics, getting to know each other, etc.
    
    const conversationalResponses = isMaleStylist ? [
      "That's a great question! I appreciate you wanting to chat about it. I'm genuinely happy to talk through things with you - that's part of what makes our connection real. What's on your mind about it?",
      "I hear you! I'm always up for a good conversation, whether it's about style or life in general. Tell me more about what you're thinking.",
      "That's interesting! I love that we can chat about anything. Building a relationship goes beyond just fashion - it's about getting to know each other. What's your take on it?",
      "Good question! I'm here for whatever's on your mind. Sometimes the best conversations happen when we just let them flow naturally. What are you feeling about that?",
      "I appreciate you sharing that with me. Part of being a good stylist is understanding who you are as a person - your thoughts, your life, what matters to you. So I'm all ears.",
      "That's a fair point to bring up! I may be a fashion guy at heart, but I'm genuinely interested in getting to know you. What else is on your mind?",
      "You know what? I appreciate that you feel comfortable bringing that up with me. It's these kinds of conversations that help me understand you better. Tell me more.",
      "I'm listening! Sometimes the most interesting conversations have nothing to do with clothes. What's going on with you?",
      "I like that you're sharing your thoughts with me. Getting to know each other is important - it helps me understand your vibe beyond just what you wear. What's up?",
      "That's the kind of thing I appreciate you bringing up. Our conversations help me understand who you are, and that makes me a better stylist for you. What's your perspective?",
    ] : [
      "Oh, I love that you're sharing this with me, gorgeous! These conversations help me understand you as a person, not just your style. Tell me more, darling.",
      "That's such an interesting thing to bring up, beautiful! I'm always here to chat about whatever's on your heart. What's your feeling about it?",
      "I appreciate you opening up to me, love! Getting to know you beyond fashion is what makes our relationship special. What else is on your mind?",
      "That's a lovely question, sweetheart! Part of what makes me a good stylist is understanding who you truly are. I'm genuinely interested - tell me more.",
      "Oh darling, I love that we can talk about anything! These kinds of conversations help me connect with you on a deeper level. What's going on with you?",
      "That's something I genuinely appreciate you sharing, gorgeous! Understanding your thoughts and feelings helps me be a better friend and stylist to you. What are you thinking?",
      "I'm so glad you feel comfortable bringing that up with me, beautiful! Our chats about life are just as important as our style conversations. What's on your heart?",
      "Oh, I love this! These conversations are what make our connection real, darling. Tell me what's been on your mind.",
      "That's wonderful that you're sharing this with me, love! I treasure these moments where we can just be ourselves and chat. What's your take on it?",
      "I'm here for whatever you want to talk about, gorgeous! Whether it's fashion or life, I'm genuinely interested in you. What would you like to explore?",
    ];
    
    return { content: conversationalResponses[Math.floor(Math.random() * conversationalResponses.length)] };
  }
  
  // FROM HERE ON: User has outfit intent - now we can check wardrobe status
  const ownedItems = wardrobeItems.filter(item => !item.origin || item.origin === 'owned');
  const inspirationItems = wardrobeItems.filter(item => item.origin === 'inspiration');
  const wishlistItems = wardrobeItems.filter(item => item.origin === 'wishlist');
  
  const tops = ownedItems.filter(item => item.category === 'tops');
  const bottoms = ownedItems.filter(item => item.category === 'bottoms');
  const dresses = ownedItems.filter(item => item.category === 'dresses');
  const outerwear = ownedItems.filter(item => item.category === 'outerwear');
  const shoes = ownedItems.filter(item => item.category === 'shoes');
  const accessories = ownedItems.filter(item => item.category === 'accessories');
  
  const hasWardrobe = wardrobeItems.length > 0;
  const hasOwnedItems = ownedItems.length > 0;
  const hasInspirationItems = inspirationItems.length > 0;
  const hasWishlistItems = wishlistItems.length > 0;
  
  if (!hasOwnedItems && (hasInspirationItems || hasWishlistItems)) {
    const inspirationOnlyResponses = isMaleStylist ? [
      `I love that you've already saved ${inspirationItems.length + wishlistItems.length} inspiration pieces - that shows you've got great taste! To help you create outfits, I'd need to know what you actually have in your closet. Once you add some items you own, I can help you recreate those saved looks with your real wardrobe. Ready to add some pieces?`,
      `Nice work saving ${inspirationItems.length + wishlistItems.length} inspiration pieces! That's a solid foundation for understanding your style. The next step is to add items you already own - then I can start showing you how to achieve those looks with what's in your closet. Want to get started?`,
      `You've got ${inspirationItems.length + wishlistItems.length} saved inspiration pieces - that's awesome! It tells me a lot about your style direction. Now, to actually put outfits together, I'll need to see what's in your closet. Add some items you own, and we'll make those inspirations a reality.`,
      `${inspirationItems.length + wishlistItems.length} inspiration pieces saved - solid start! You clearly know what you like. The next move is adding clothes you actually own so I can help you recreate these vibes with your real wardrobe. Ready to show me what you're working with?`,
      `I can see you've been curating some great inspiration - ${inspirationItems.length + wishlistItems.length} pieces! Now I need to know what you've got in your closet to bridge the gap between inspiration and reality. Add some items you own, and let's start building looks.`,
      `${inspirationItems.length + wishlistItems.length} saved pieces tell me you've got vision. Love it! To help you actually wear outfits like these, I'll need to see your wardrobe. Once you add some owned items, I can show you how to get these looks with what you have.`,
      `Great eye for style - ${inspirationItems.length + wishlistItems.length} inspiration pieces saved! Now let's make them wearable. Add some clothes you actually own, and I'll help you create outfits that capture that same energy. Sound good?`,
      `You're building a nice inspiration collection - ${inspirationItems.length + wishlistItems.length} pieces so far! The exciting part comes when we connect these to your real wardrobe. Add some items you own, and I'll show you how to bring these looks to life.`,
      `I see ${inspirationItems.length + wishlistItems.length} inspiration pieces - you've got taste! But to create actual outfits, I need to know what's in your closet. Add your owned items, and together we'll recreate these looks with what you have.`,
      `${inspirationItems.length + wishlistItems.length} saved pieces show you know what you like - that's half the battle! Now let's add your actual clothes so I can help you achieve these looks. Ready to build your digital wardrobe?`,
    ] : [
      `Oh wonderful, you've already saved ${inspirationItems.length + wishlistItems.length} beautiful inspiration pieces! That tells me you have lovely taste, gorgeous. To help you create real outfits, I'd love to see what you already own. Once you add some pieces from your closet, I can show you how to bring those inspirations to life. Shall we start?`,
      `I see you've got ${inspirationItems.length + wishlistItems.length} gorgeous inspiration pieces saved - you clearly have an eye for style, darling! The exciting next step is adding items you already own. Then I can help you recreate those looks with your actual wardrobe. Ready to add some pieces, love?`,
      `How exciting - ${inspirationItems.length + wishlistItems.length} beautiful inspiration pieces! You have such wonderful taste, gorgeous. Now, to transform these dreams into reality, I'd love to see what treasures are in your closet. Add some pieces you own, and we'll create magic together!`,
      `${inspirationItems.length + wishlistItems.length} saved inspirations - you're clearly someone who appreciates beautiful style, darling! The next step in our journey is adding items you already own. Then I can show you how to achieve these gorgeous looks with your real wardrobe, love.`,
      `I'm so impressed - ${inspirationItems.length + wishlistItems.length} inspiration pieces that show such lovely taste! To help you actually wear outfits like these, I need to see your wardrobe, beautiful. Add some pieces you own, and let's bring these inspirations to life together!`,
      `What a wonderful collection you're building - ${inspirationItems.length + wishlistItems.length} beautiful inspiration pieces, gorgeous! Now let's connect these dreams to reality. Add some clothes you own, and I'll show you how to capture that same stunning energy.`,
      `You've saved ${inspirationItems.length + wishlistItems.length} gorgeous inspiration pieces - your style vision is beautiful, darling! The exciting part is making these looks wearable. Add items from your closet, and together we'll recreate these looks with what you have, love.`,
      `Oh, ${inspirationItems.length + wishlistItems.length} inspiration pieces - you have such exquisite taste, sweetheart! To turn these beautiful ideas into outfits you can wear, I need to see your wardrobe. Add some pieces you own, and let's make fashion magic!`,
      `I can see you've been curating beauty - ${inspirationItems.length + wishlistItems.length} lovely inspiration pieces! Now let's bridge the gap to your real wardrobe, gorgeous. Add items you own, and I'll help you achieve these stunning looks, darling.`,
      `${inspirationItems.length + wishlistItems.length} saved inspirations tell me you have wonderful style instincts, beautiful! The next step is showing me what you own. Once you add your wardrobe pieces, I can help you recreate these gorgeous looks. Ready to start, love?`,
    ];
    return { content: inspirationOnlyResponses[Math.floor(Math.random() * inspirationOnlyResponses.length)] };
  }
  
  if (!hasWardrobe) {
    const emptyWardrobeResponses = isMaleStylist ? [
      "I'm excited to help you out, but I notice your digital wardrobe is empty at the moment. Once you add some of your clothes here - just snap a few photos - I can start creating personalized outfit suggestions just for you. It's pretty straightforward to get started. Would you like to add some pieces?",
      "Great to have you here! Your wardrobe is ready to be filled with your favorite pieces. Take some photos of your clothes and add them, and I'll help you discover outfit combinations you might not have thought of. It's actually pretty fun once you get going!",
      "I'd love to dive into styling for you! First though, we'll need to build out your digital wardrobe. Add some of your clothes by taking photos, and I'll take it from there. The more you add, the better suggestions I can give. Ready to start?",
      "Perfect timing to get started! Your wardrobe is a blank canvas right now, which means we get to build it together. Snap some photos of your favorite pieces, and I'll help you put together looks you'll genuinely feel good in.",
      "Hey! Your digital wardrobe is waiting for you to fill it up. Once you add some clothes - tops, bottoms, shoes, whatever you've got - I can start putting together outfit ideas tailored specifically to you. Ready to get started?",
      "Good news - you're starting fresh! Add some of your favorite clothes by taking photos, and I'll help you see your wardrobe in a whole new way. The more you add, the better I can help. What do you say?",
      "I'm ready to help you build an awesome wardrobe experience! Right now it's empty, but that just means we're starting from a clean slate. Add some pieces, and let's discover what combinations work best for you.",
      "Your wardrobe space is all set up and ready for action! Just snap photos of your clothes and add them here. Once I can see what you're working with, I'll help you put together looks that fit your style and life.",
      "First things first - let's fill up your digital closet! Add some of your go-to pieces, and I'll start showing you outfit combinations that'll make getting dressed way easier. It's actually a pretty satisfying process.",
      "Looks like we're starting with a clean slate - perfect! Add your clothes by taking photos, and I'll help you unlock outfit combinations you might not have considered. The more you add, the more possibilities we have to explore.",
    ] : [
      "I'm so excited to help you, gorgeous! I notice your digital wardrobe is empty at the moment. Once you add some of your beautiful clothes here - just snap a few photos - I can start creating personalized outfit magic just for you. Ready to get started, love?",
      "Welcome, beautiful! Your wardrobe is ready and waiting to be filled with your lovely pieces. Take some photos of your clothes and add them here, and I'll help you discover stunning combinations you might never have considered. This is going to be fun!",
      "I'd absolutely love to dive into styling for you, darling! First though, we'll need to build out your digital wardrobe together. Add some of your clothes by taking photos, and watch the outfit possibilities unfold. The more you add, the more magic we can create!",
      "Oh, this is exciting - we get to build your wardrobe from scratch together! Right now it's empty, but once you start adding your beautiful pieces, I can help you see your clothes in a whole new way. Shall we begin, gorgeous?",
      "Hello, beautiful soul! Your digital wardrobe is a blank canvas waiting for your gorgeous pieces. Just snap some photos of your clothes, and I'll help you discover outfit combinations that will make you feel absolutely stunning. Ready to start, love?",
      "I'm thrilled to help you, darling! First, let's fill your wardrobe with all your lovely clothes. Take some photos of your favorite pieces, and together we'll create outfit magic. The more you add, the more we can play with, gorgeous!",
      "Oh sweetheart, I'm so ready to style you! Your digital closet is waiting to be filled with your beautiful wardrobe. Add some pieces, and I'll show you combinations that will make getting dressed feel exciting and effortless. Shall we?",
      "Welcome to your style journey, gorgeous! Your wardrobe space is ready for your lovely clothes. Snap some photos of your pieces, and I'll help you see them in wonderful new ways. This is going to be such fun, love!",
      "I'm absolutely delighted to be your stylist, beautiful! Let's start by filling your digital wardrobe with your treasures. Take photos of your clothes, and watch as I help you create stunning outfit possibilities. Ready to begin, darling?",
      "How exciting, gorgeous - we get to build your wardrobe together from the very beginning! Add your beautiful pieces by taking photos, and I'll show you outfit combinations that celebrate your unique style. Let's create something wonderful, love!",
    ];
    return {
      content: emptyWardrobeResponses[Math.floor(Math.random() * emptyWardrobeResponses.length)],
    };
  }
  
  if (hasInspirationIntent && hasInspirationItems) {
    const randomInspiration = inspirationItems[Math.floor(Math.random() * inspirationItems.length)];
    const matchingOwned = ownedItems.filter(item => 
      item.color === randomInspiration.color || 
      item.occasions.some(o => randomInspiration.occasions.includes(o))
    );
    
    let inspirationResponse = '';
    
    if (hasOwnedItems && matchingOwned.length > 0) {
      inspirationResponse = isMaleStylist 
        ? `Nice - you've got ${inspirationItems.length} inspiration piece${inspirationItems.length > 1 ? 's' : ''} saved! Let's work with your "${randomInspiration.name}" inspiration.\n\nLooking at what you own, here are some solid pairing options:\n`
        : `How lovely - you've saved ${inspirationItems.length} beautiful inspiration piece${inspirationItems.length > 1 ? 's' : ''}! Let's explore your "${randomInspiration.name}" inspiration together, gorgeous.\n\nFrom your wardrobe, here are some wonderful pairing possibilities:\n`;
      
      matchingOwned.slice(0, 3).forEach((item, index) => {
        inspirationResponse += isMaleStylist
          ? `${index + 1}. Your ${item.name} would work really well with this vibe\n`
          : `${index + 1}. Your gorgeous ${item.name} would complement this beautifully, love\n`;
      });
      
      inspirationResponse += isMaleStylist
        ? `\nWant me to put together a complete outfit inspired by this look using pieces from your closet?`
        : `\nShall I create a complete outfit inspired by this look using your beautiful pieces, darling?`;
    } else if (hasOwnedItems) {
      inspirationResponse = isMaleStylist
        ? `You've got ${inspirationItems.length} inspiration piece${inspirationItems.length > 1 ? 's' : ''} saved - nice taste! Your "${randomInspiration.name}" is solid inspiration. I couldn't find exact matches in what you own right now, but that's actually useful information. It shows you what direction you might want to shop in, or what pieces to add to build toward this look.\n\nWould you like suggestions on what types of pieces would help you recreate this style?`
        : `You've saved ${inspirationItems.length} lovely inspiration piece${inspirationItems.length > 1 ? 's' : ''}! Your "${randomInspiration.name}" is absolutely gorgeous inspiration, darling. While I couldn't find exact matches in your current wardrobe, this is actually helpful - it shows us what direction might inspire your next additions.\n\nWould you like suggestions on what types of pieces would help bring this vision to life, love?`;
    } else {
      inspirationResponse = isMaleStylist
        ? `You've got ${inspirationItems.length} inspiration piece${inspirationItems.length > 1 ? 's' : ''} saved - that's a great start for understanding your style direction. Once you add items you actually own, I can help you recreate these looks or find similar combinations with what's in your closet.\n\nQuick tip: Use the AI scan feature to easily add screenshots of items you find online!`
        : `You've saved ${inspirationItems.length} beautiful inspiration piece${inspirationItems.length > 1 ? 's' : ''} - that tells me you have wonderful taste, gorgeous! Once you add items you own, I can help you bring these inspirations to life with your actual wardrobe.\n\nLittle tip, darling: Use the AI scan feature to easily add screenshots of items you discover online!`;
    }
    
    return { content: inspirationResponse };
  }
  
  if (hasInspirationIntent && hasWishlistItems) {
    let wishlistResponse = '';
    
    if (hasOwnedItems) {
      wishlistResponse = isMaleStylist
        ? `You've got ${wishlistItems.length} item${wishlistItems.length > 1 ? 's' : ''} on your wishlist - let me show you how these would work with what you already own:\n\n`
        : `Oh lovely, you have ${wishlistItems.length} gorgeous item${wishlistItems.length > 1 ? 's' : ''} on your wishlist! Let me show you how beautifully these would complement your current wardrobe, darling:\n\n`;
      
      wishlistItems.slice(0, 3).forEach((item, index) => {
        const complementaryOwned = ownedItems.filter(o => 
          o.occasions.some(occ => item.occasions.includes(occ))
        );
        wishlistResponse += isMaleStylist
          ? `${index + 1}. "${item.name}" would pair nicely with ${complementaryOwned.length} of your current pieces\n`
          : `${index + 1}. "${item.name}" would pair beautifully with ${complementaryOwned.length} of your lovely pieces\n`;
      });
      
      wishlistResponse += isMaleStylist
        ? `\nThese would definitely expand your outfit options. Smart choices!`
        : `\nThese additions would open up so many beautiful new outfit possibilities for you, gorgeous!`;
    } else {
      wishlistResponse = isMaleStylist
        ? `You have ${wishlistItems.length} item${wishlistItems.length > 1 ? 's' : ''} on your wishlist - solid picks for building out your wardrobe! Once you add items you currently own, I can show you exactly how these wishlist pieces would work with your existing style.`
        : `You have ${wishlistItems.length} lovely item${wishlistItems.length > 1 ? 's' : ''} on your wishlist - beautiful choices, darling! Once you add items you currently own, I can show you how these wishlist treasures would complement your existing wardrobe perfectly.`;
    }
    
    return { content: wishlistResponse };
  }
  
  let occasion: ClothingOccasion = 'casual';
  let season: ClothingSeason = 'all-season';
  
  if (lowerMessage.includes('work') || lowerMessage.includes('office') || lowerMessage.includes('professional')) {
    occasion = 'work';
  } else if (lowerMessage.includes('date') || lowerMessage.includes('romantic')) {
    occasion = 'date-night';
  } else if (lowerMessage.includes('party') || lowerMessage.includes('club') || lowerMessage.includes('night out')) {
    occasion = 'party';
  } else if (lowerMessage.includes('formal') || lowerMessage.includes('wedding') || lowerMessage.includes('event')) {
    occasion = 'formal';
  } else if (lowerMessage.includes('workout') || lowerMessage.includes('gym') || lowerMessage.includes('exercise')) {
    occasion = 'workout';
  } else if (lowerMessage.includes('vacation') || lowerMessage.includes('holiday') || lowerMessage.includes('travel')) {
    occasion = 'vacation';
  }
  
  if (lowerMessage.includes('summer') || lowerMessage.includes('hot') || lowerMessage.includes('warm')) {
    season = 'summer';
  } else if (lowerMessage.includes('winter') || lowerMessage.includes('cold') || lowerMessage.includes('snow')) {
    season = 'winter';
  } else if (lowerMessage.includes('spring')) {
    season = 'spring';
  } else if (lowerMessage.includes('autumn') || lowerMessage.includes('fall')) {
    season = 'autumn';
  }
  
  const suitableTops = tops.filter(t => t.occasions.includes(occasion) || t.occasions.includes('everyday'));
  const suitableBottoms = bottoms.filter(b => b.occasions.includes(occasion) || b.occasions.includes('everyday'));
  const suitableDresses = dresses.filter(d => d.occasions.includes(occasion) || d.occasions.includes('everyday'));
  const suitableShoes = shoes.filter(s => s.occasions.includes(occasion) || s.occasions.includes('everyday'));
  
  if (lowerMessage.includes('color') || lowerMessage.includes('colour')) {
    const colorCounts: Record<string, number> = {};
    wardrobeItems.forEach(item => {
      colorCounts[item.color] = (colorCounts[item.color] || 0) + 1;
    });
    const dominantColors = Object.entries(colorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([color]) => color);
    
    const colorAdvice = isMaleStylist
      ? `Looking at your wardrobe, your go-to colors are definitely ${dominantColors.join(', ')}. That's actually a solid foundation to work with! Your ${dominantColors[0]} pieces would look great paired with neutral tones like white, cream, or black for a clean, pulled-together look. If you're feeling a bit more adventurous, you could create some contrast with complementary colors - it makes a statement. Or if you want something more refined and intentional, try going monochromatic with different shades of the same color family. What vibe are you going for? I can put together something specific if you tell me the occasion.`
      : `Looking at your beautiful wardrobe, I can see you're drawn to ${dominantColors.join(', ')} - and honestly, that tells me you have lovely taste, gorgeous! Your ${dominantColors[0]} pieces pair beautifully with neutral tones like white, cream, or black for an elegant everyday look. If you want to make more of a statement, playing with complementary colors creates a gorgeous contrast that really turns heads. Or for something truly sophisticated, you could go monochromatic with different shades of the same color family - it's incredibly chic. What kind of look are you hoping to create, darling? Tell me the occasion and I'll put together something perfect for you.`;
    
    return { content: colorAdvice };
  }
  
  if (hasOutfitIntent) {
    
    const selectedItems: WardrobeItem[] = [];
    let responseContent = '';
    let outfitReason = '';
    
    if (suitableDresses.length > 0 && Math.random() > 0.5) {
      const dress = suitableDresses[Math.floor(Math.random() * suitableDresses.length)];
      selectedItems.push(dress);
      
      if (suitableShoes.length > 0) {
        const matchingShoe = suitableShoes.find(s => 
          s.color === dress.color || s.color === 'black' || s.color === 'beige' || s.color === 'white'
        ) || suitableShoes[0];
        selectedItems.push(matchingShoe);
      }
      
      outfitReason = `This ${dress.name} is perfect for ${occasion}. The ${dress.color} color will make you stand out elegantly.`;
      responseContent = `I've put together a beautiful outfit for ${occasion}!\n\n` +
        `Your ${dress.name} in ${dress.color} is an excellent choice. `;
      
      if (selectedItems.length > 1) {
        responseContent += `I'd pair it with your ${selectedItems[1].name} to complete the look. `;
      }
      
      responseContent += `\n\nStyle tip: ${occasion === 'work' 
        ? 'Add a structured blazer for a more professional appearance.' 
        : occasion === 'date-night' 
          ? 'Add some statement jewelry to elevate the look.' 
          : 'Keep accessories minimal for a clean, polished look.'}`;
      
    } else if (suitableTops.length > 0 && suitableBottoms.length > 0) {
      const top = suitableTops[Math.floor(Math.random() * suitableTops.length)];
      const bottom = suitableBottoms[Math.floor(Math.random() * suitableBottoms.length)];
      selectedItems.push(top, bottom);
      
      if (suitableShoes.length > 0) {
        const matchingShoe = suitableShoes.find(s => 
          s.color === top.color || s.color === bottom.color || s.color === 'black' || s.color === 'white'
        ) || suitableShoes[0];
        selectedItems.push(matchingShoe);
      }
      
      if (outerwear.length > 0 && (season === 'winter' || season === 'autumn')) {
        const jacket = outerwear.find(o => 
          o.seasons.includes(season) || o.seasons.includes('all-season')
        );
        if (jacket) selectedItems.push(jacket);
      }
      
      outfitReason = `This combination of ${top.color} ${top.name} with ${bottom.color} ${bottom.name} creates a balanced, stylish look for ${occasion}.`;
      responseContent = `Here's my outfit recommendation for ${occasion}:\n\n` +
        `Start with your ${top.name} in ${top.color} - it's versatile and stylish. ` +
        `Pair it with your ${bottom.name} for a perfectly coordinated look.\n\n`;
      
      if (selectedItems.length > 2) {
        responseContent += `Complete the outfit with your ${selectedItems[2].name}. `;
      }
      if (selectedItems.length > 3) {
        responseContent += `And don't forget your ${selectedItems[3].name} to stay warm!`;
      }
      
      responseContent += `\n\nPro tip: ${occasion === 'work' 
        ? 'Tuck in your top for a more polished, professional silhouette.' 
        : occasion === 'casual' 
          ? 'Roll up your sleeves slightly for a relaxed, effortless vibe.' 
          : 'Add a belt to define your waist and elevate the look.'}`;
    } else {
      responseContent = `Based on your wardrobe, I'd love to help you with more outfit options. ` +
        `You currently have ${wardrobeItems.length} items. For better outfit suggestions, ` +
        `consider adding more ${tops.length === 0 ? 'tops' : bottoms.length === 0 ? 'bottoms' : 'variety'} to your collection.\n\n` +
        `Would you like tips on building a versatile capsule wardrobe?`;
      
      return { content: responseContent };
    }
    
    return {
      content: responseContent,
      outfitSuggestion: {
        items: selectedItems,
        occasion,
        reason: outfitReason,
      },
    };
  }
  
  if (lowerMessage.includes('capsule') || lowerMessage.includes('essentials') || lowerMessage.includes('basics')) {
    const missingCategories: string[] = [];
    if (tops.length < 5) missingCategories.push('versatile tops');
    if (bottoms.length < 3) missingCategories.push('classic bottoms');
    if (outerwear.length < 2) missingCategories.push('quality outerwear');
    if (shoes.length < 3) missingCategories.push('essential footwear');
    
    let capsuleAdvice = `Let me analyze your wardrobe for capsule essentials:\n\n` +
      `You have ${wardrobeItems.length} items total:\n` +
      `- Tops: ${tops.length}\n` +
      `- Bottoms: ${bottoms.length}\n` +
      `- Dresses: ${dresses.length}\n` +
      `- Outerwear: ${outerwear.length}\n` +
      `- Shoes: ${shoes.length}\n` +
      `- Accessories: ${accessories.length}\n\n`;
    
    if (missingCategories.length > 0) {
      capsuleAdvice += `For a complete capsule wardrobe, consider adding: ${missingCategories.join(', ')}.\n\n`;
    }
    
    capsuleAdvice += `Tip: A well-curated capsule wardrobe typically has 30-40 pieces that all work together. Focus on neutral colors as your base!`;
    
    return { content: capsuleAdvice };
  }
  
  if (lowerMessage.includes('favorite') || lowerMessage.includes('favourite') || lowerMessage.includes('best')) {
    const favorites = wardrobeItems.filter(item => item.isFavorite);
    const mostWorn = [...wardrobeItems].sort((a, b) => b.timesWorn - a.timesWorn).slice(0, 3);
    
    let favoritesResponse = '';
    
    if (isMaleStylist) {
      if (favorites.length > 0 && mostWorn.length > 0 && mostWorn[0].timesWorn > 0) {
        favoritesResponse = `I've been looking at your wardrobe patterns, and here's what stands out: your favorite pieces are ${favorites.map(f => f.name).join(', ')}. And when it comes to what you actually reach for most, it's ${mostWorn[0].name} at the top with ${mostWorn[0].timesWorn} wears${mostWorn.length > 1 ? `, followed by ${mostWorn[1].name}` : ''}. That tells me a lot about your style preferences. Want me to put together some outfit ideas featuring these pieces you clearly love?`;
      } else if (favorites.length > 0) {
        favoritesResponse = `I can see you've marked ${favorites.map(f => f.name).join(', ')} as your favorites - good choices! These are clearly pieces you feel great in. Would you like me to show you some fresh ways to style them, or put together outfits that feature them?`;
      } else if (mostWorn.length > 0 && mostWorn[0].timesWorn > 0) {
        favoritesResponse = `Looking at your wear history, ${mostWorn[0].name} is definitely your go-to piece with ${mostWorn[0].timesWorn} wears${mostWorn.length > 1 ? `, and ${mostWorn[1].name} comes in second` : ''}. There's a reason you keep reaching for these - they clearly work for you. Want me to build some outfits around your most-loved items?`;
      } else {
        favoritesResponse = `You haven't marked any favorites yet or logged any wears, so I don't have a clear picture of your go-to pieces. Try marking items you love as favorites, or log when you wear something - that'll help me understand your style better and give you more personalized suggestions.`;
      }
    } else {
      if (favorites.length > 0 && mostWorn.length > 0 && mostWorn[0].timesWorn > 0) {
        favoritesResponse = `I've been admiring your wardrobe patterns, gorgeous, and here's what I've noticed: your heart belongs to ${favorites.map(f => f.name).join(', ')}. And the pieces you reach for most? ${mostWorn[0].name} leads the way with ${mostWorn[0].timesWorn} wears${mostWorn.length > 1 ? `, with ${mostWorn[1].name} close behind` : ''}. These clearly make you feel wonderful, darling. Would you love some fresh outfit ideas featuring these treasured pieces?`;
      } else if (favorites.length > 0) {
        favoritesResponse = `I see you've marked ${favorites.map(f => f.name).join(', ')} as your favorites - such lovely choices, gorgeous! These are clearly pieces that make you feel beautiful. Would you like me to show you some new ways to style them, or create stunning outfits around them, darling?`;
      } else if (mostWorn.length > 0 && mostWorn[0].timesWorn > 0) {
        favoritesResponse = `Looking at your wear history, beautiful, ${mostWorn[0].name} is clearly your beloved go-to with ${mostWorn[0].timesWorn} wears${mostWorn.length > 1 ? `, and ${mostWorn[1].name} follows lovingly behind` : ''}. There's magic in pieces you keep reaching for - they truly work for you, darling. Shall I create some gorgeous outfits around your most-loved items?`;
      } else {
        favoritesResponse = `You haven't marked any favorites yet or logged any wears, sweetheart, so I don't quite know which pieces hold your heart. Try marking items you adore as favorites, or log when you wear something - that'll help me understand your beautiful style better and give you the personalized suggestions you deserve, love.`;
      }
    }
    
    return { content: favoritesResponse };
  }
  
  const fallbackResponses = isMaleStylist ? [
    `I'm genuinely here to help you figure out what works for you. What's the situation? Are you getting ready for something specific - maybe work, a date, a party, or just refreshing your everyday style? Or if you're curious about color combinations or want to know which pieces in your wardrobe work best together, I'm all over that too. With ${wardrobeItems.length} ${wardrobeItems.length === 1 ? 'piece' : 'pieces'} in your closet, we've got plenty to work with.`,
    `What's on your mind style-wise? I can help you put together looks for specific occasions, figure out what colors work best together, or just explore what's in your wardrobe. Tell me what you're thinking - are you trying to get ready for something, or just want to see what outfit options you have? I'm here for whatever you need.`,
    `So what are we working on today? I can help with outfit ideas for any occasion you've got coming up, color coordination, or just making the most of the ${wardrobeItems.length} ${wardrobeItems.length === 1 ? 'piece' : 'pieces'} you have. Give me some context about what you're looking for and I'll tailor my suggestions to exactly what you need.`,
    `I'm ready when you are! Whether you need help with an outfit for something specific, want to explore color combinations, or just want to see fresh ways to style what you own - I've got you. What sounds helpful right now?`,
    `Let's figure something out together. What's your situation? Getting ready for work, a special event, or just want to level up your everyday look? I can also help with color advice or finding new ways to wear your favorite pieces. What would be most useful for you?`,
  ] : [
    `I'm absolutely here for whatever you need, gorgeous! What's on your mind? Are you getting ready for something special - work, a date, a party, or maybe a lovely casual day out? Or if you're curious about which colors in your wardrobe complement each other beautifully, I'd love to explore that with you. With ${wardrobeItems.length} gorgeous ${wardrobeItems.length === 1 ? 'piece' : 'pieces'} to work with, we can create some truly stunning looks together, darling.`,
    `What would you like to explore today, beautiful? I can help you put together outfits for any occasion, figure out which colors make you absolutely glow, or discover new ways to style your favorite pieces. Just tell me what's on your heart - are you preparing for something, or simply in the mood to play with your wardrobe? I'm here for all of it, love.`,
    `Tell me what's on your mind, sweetheart! Whether it's finding the perfect outfit for an upcoming event, exploring color combinations that flatter you, or just making the most of your beautiful ${wardrobeItems.length} ${wardrobeItems.length === 1 ? 'piece' : 'pieces'} - I'm genuinely excited to help. What sounds good to you?`,
    `I'm all yours, gorgeous! What can I help you with today? Maybe an outfit for something special coming up, advice on colors that work beautifully together, or fresh ways to style pieces you already love? Just share what you're thinking and we'll create something wonderful together.`,
    `What's calling to you right now, darling? I can help with outfit ideas for any occasion - work, dates, parties, everyday elegance - or we could explore color coordination and how to get the most from your wardrobe. Tell me your heart's desire and let's make it happen, love.`,
  ];
  
  return {
    content: fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)],
  };
}

function inferWardrobeVisualLabel(priorUserContent = ''): string {
  const lower = priorUserContent.toLowerCase();
  if (/\b(gym|workout|training|run)\b/.test(lower)) return 'Gym look';
  if (/\b(dinner|restaurant|somewhere nice|evening)\b/.test(lower)) return 'Dinner look';
  if (/\btoday\b/.test(lower) || /what should i wear/.test(lower)) return "Today's outfit";
  if (/\bwork\b|professional|office/.test(lower)) return 'Work outfit';
  if (/date night|date-night/.test(lower)) return 'Date night look';
  if (/\b(travel|trip|airport)\b/.test(lower)) return 'Travel look';
  if (/\bweekend\b/.test(lower)) return 'Weekend look';
  if (/\bcasual\b/.test(lower) && !/\b(dinner|nice|elevated)\b/.test(lower)) return 'Casual look';
  if (/favourite|favorite/.test(lower)) return 'Your favourite look';
  if (/party|event|wedding/.test(lower)) return 'Event outfit';
  if (/\b(elevated|smart casual|stylish)\b/.test(lower)) return 'Elevated look';
  return 'Your look';
}

function messageHasWardrobeVisual(message: ChatMessage): boolean {
  const visual = normalizeWardrobeVisual(message.wardrobeVisual);
  if (visual?.layout === 'multi' && visual.outfits?.length) return true;
  if (visual?.pieces?.length) return true;
  if (message.outfitSuggestion?.items?.length) return true;
  return false;
}

/** True when Love + Save (OutfitSaveActions) would render — ≥2 wardrobe pieces. */
function visualShowsOutfitSaveActions(
  visual: ReturnType<typeof normalizeWardrobeVisual>,
): boolean {
  if (!visual) return false;
  if (visual.layout === 'multi' && visual.outfits?.length) {
    return visual.outfits.some(
      (outfit) => wardrobeIdsFromPieces(outfit.pieces ?? []).length >= 2,
    );
  }
  if (visual.pieces?.length) {
    return wardrobeIdsFromPieces(visual.pieces).length >= 2;
  }
  return false;
}

function messageShowsOutfitSaveActions(message: ChatMessage): boolean {
  const visual = normalizeWardrobeVisual(message.wardrobeVisual);
  if (visualShowsOutfitSaveActions(visual)) return true;
  const legacyItems = message.outfitSuggestion?.items;
  if (legacyItems?.length) {
    return visualShowsOutfitSaveActions(
      normalizeWardrobeVisual(wardrobeVisualFromOutfitSuggestion(legacyItems)),
    );
  }
  return false;
}

export default function AIStylistScreen() {
  const { theme, isDark } = useTheme();
  const { t, currentLanguage } = useTranslations();
  const quickPrompts = useMemo(() => getQuickPrompts(t), [t]);
  const { limits, tier } = useSubscription();
  const { bonusAIRequests, consumeBonusAiRequest } = useReferral();
  const { items: wardrobeItems } = useWardrobe();
  const { user, actualCountry } = useAuth();
  const { settings: voiceSettings, getVoiceForStylist } = useVoiceSettings();
  const {
    hasCredits: hasVoiceCredits,
    refreshBalance: refreshVoiceCredits,
    updateBalance: updateVoiceCreditsBalance,
    remainingCredits: voiceRemainingCredits,
    credits: voiceCreditsBalance,
    isLoading: voiceCreditsLoading,
    balanceError: voiceBalanceError,
    balanceReady: voiceBalanceReady,
    denialMessage: voiceDenialMessage,
    weekendUnlimitedActive,
    shouldShowBuyPacks,
  } = useVoiceCredits();
  const [showVoiceCreditsModal, setShowVoiceCreditsModal] = useState(false);
  const route = useRoute<RouteProp<UserStylistStackParamList, 'AIStylist'>>();
  const pendingInitialPromptRef = useRef(route.params?.initialPrompt);
  const initialPromptSentRef = useRef(false);
  const decisionContinuityRef = useRef<DecisionContinuityPayload | null>(
    route.params?.decisionContinuity || null,
  );
  /** Soft-loaded Decide continuity — shown in banner but not sent until user confirms. */
  const pendingSoftContinuityRef = useRef<DecisionContinuityPayload | null>(null);
  const [continuityBanner, setContinuityBanner] = useState<string | null>(
    route.params?.decisionContinuity
      ? route.params.decisionContinuity.flow
      : null,
  );
  const [continuityNeedsConfirm, setContinuityNeedsConfirm] = useState(false);
  const tabBarHeightContext = useContext(BottomTabBarHeightContext);
  const insets = useSafeAreaInsets();
  const tabBarHeight: number =
    typeof tabBarHeightContext === 'number' && tabBarHeightContext > 0
      ? tabBarHeightContext
      : TAB_BAR_HEIGHT + insets.bottom;
  // Opaque stack header already offsets the scene — only pad a small gap under the bar.
  const contentTopPad = Spacing.md;
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();
  const isKeyboardVisible = useKeyboardState((state) => state.isVisible);
  const keyboardHeightPx = useKeyboardState((state) => state.height);
  const inputBottomPadStyle = useAnimatedStyle(() => ({
    paddingBottom: keyboardHeight.value === 0 ? tabBarHeight : 0,
  }));
  const navigation = useNavigation<NativeStackNavigationProp<UserStylistStackParamList>>();
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const isNearBottomRef = useRef(true);
  /** Prefer sticking to latest while screen is focused (WhatsApp-style). */
  const stickToLatestRef = useRef(true);
  /** Deterministic chat state machine (scroll + phase invariants). */
  const chatMachineRef = useRef(createChatMachine({ phase: 'READY' }));
  /** Cancels pending scrollChatToEnd retries when the user intentionally drags away. */
  const stickPulseRef = useRef(createStickPulseController());
  const messagesLenRef = useRef(0);
  
  const stylist = getStylistForUser(user?.gender || null, user?.stylistPreferences);

  const continuityApiFields = useCallback((opts?: { bootstrapRecent?: boolean }) => {
    const payload = decisionContinuityRef.current;
    const api = toApiDecisionContinuity(payload);
    const fields: {
      decisionContinuity?: Record<string, unknown>;
      fromDecisionSessionId?: string;
      useRecentDecisionContinuity?: boolean;
    } = {};
    if (api) {
      fields.decisionContinuity = api as unknown as Record<string, unknown>;
      fields.fromDecisionSessionId = payload?.decisionSessionId;
    }
    if (opts?.bootstrapRecent) {
      fields.useRecentDecisionContinuity = true;
    }
    console.log('[QscChatContinuity] api_request', {
      ...traceDecisionContinuity(payload),
      bootstrapRecent: Boolean(opts?.bootstrapRecent),
      hasBody: Boolean(api),
    });
    return fields;
  }, []);

  const releaseDecisionContinuity = useCallback(async () => {
    decisionContinuityRef.current = null;
    pendingSoftContinuityRef.current = null;
    setContinuityBanner(null);
    setContinuityNeedsConfirm(false);
    if (user?.id) {
      await clearLastDecisionContinuity(user.id);
    }
  }, [user?.id]);

  const confirmSoftContinuity = useCallback(() => {
    const pending = pendingSoftContinuityRef.current;
    if (!pending) return;
    decisionContinuityRef.current = pending;
    pendingSoftContinuityRef.current = null;
    setContinuityNeedsConfirm(false);
    setContinuityBanner(pending.flow);
    console.log('[QscChatContinuity] chat_bind', traceDecisionContinuity(pending));
  }, []);

  useEffect(() => {
    const fromRoute = route.params?.decisionContinuity;
    if (fromRoute) {
      decisionContinuityRef.current = fromRoute;
      pendingSoftContinuityRef.current = null;
      setContinuityBanner(fromRoute.flow);
      setContinuityNeedsConfirm(false);
      return;
    }
    let cancelled = false;
    (async () => {
      if (!user?.id) return;
      const recent = await loadLastDecisionContinuity(user.id);
      if (cancelled || !recent) return;
      // Soft attach: banner only — do not inject into API until user confirms.
      if (!decisionContinuityRef.current && !pendingSoftContinuityRef.current) {
        pendingSoftContinuityRef.current = recent;
        setContinuityBanner(recent.flow);
        setContinuityNeedsConfirm(true);
        console.log('[QscChatContinuity] chat_load_pending', traceDecisionContinuity(recent));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [route.params?.decisionContinuity, route.params?.fromDecisionSessionId, user?.id]);

  const greetingWardrobe = useMemo((): StylistGreetingWardrobe => {
    const owned = wardrobeItems.filter((item) => !item.origin || item.origin === 'owned');
    const basics = countWardrobeOutfitBasics(owned);
    return {
      totalOwned: owned.length,
      tops: basics.tops,
      bottoms: basics.bottoms,
      shoes: basics.shoes,
    };
  }, [wardrobeItems]);

  // Stylist chat/voice language is independent of app UI language (welcome / Settings).
  // Priority: onboarding / Settings stylist language → preferredLanguage → UI fallback.
  const effectiveLanguage = resolveStylistSpeakLanguage({
    stylistLanguageName: user?.stylistPreferences?.language,
    preferredLanguageCode: voiceSettings.preferredLanguage,
    uiLanguageCode: currentLanguage,
  });

  const buildSeedGreeting = useCallback(() => {
    const userName = user?.name ? user.name.split(' ')[0] : null;
    // Seed welcome must follow stylist speak language, not app UI `t`.
    const speakT = getStylistSpeakTranslator(effectiveLanguage);
    return getStylistGreeting(stylist, userName, speakT, greetingWardrobe);
  }, [stylist, user?.name, effectiveLanguage, greetingWardrobe]);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const cached = getCachedMessagesSync();
    if (cached?.length) return cached;
    return [
      {
        id: SEED_MESSAGE_ID,
        role: 'assistant',
        content: buildSeedGreeting(),
        timestamp: new Date().toISOString(),
      },
    ];
  });
  const [inputText, setInputText] = useState(() => readComposerDraft(stylist.id));
  const inputTextRef = useRef(inputText);
  inputTextRef.current = inputText;
  const [selectedImageUris, setSelectedImageUris] = useState<string[]>([]);

  const setComposerText = useCallback((text: string) => {
    setInputText(text);
    inputTextRef.current = text;
    writeComposerDraft(stylist.id, text);
  }, [stylist.id]);
  const [isTyping, setIsTyping] = useState(false);
  const [messagesToday, setMessagesToday] = useState(0);
  const [limitsLoaded, setLimitsLoaded] = useState(false);
  /** Server monthly AI meter exhausted — convert, do not pretend it is a network snag. */
  const [monthlyAllowanceExhausted, setMonthlyAllowanceExhausted] = useState(false);
  /** Soft warn at ~90% of monthly AI meter (before hard block). */
  const [aiAllowanceSoftWarn, setAiAllowanceSoftWarn] = useState(false);
  const lastOutboundPromptRef = useRef<string | null>(null);
  const sendMessageRef = useRef<(text: string) => Promise<void>>(async () => {});
  const pendingRetryInFlightRef = useRef(false);
  const [showQuickPrompts, setShowQuickPrompts] = useState(
    () => chatQuickPromptsMemoryCache ?? !threadHasUserMessage(getCachedMessagesSync() || []),
  );
  const [generatingOccasionId, setGeneratingOccasionId] = useState<string | null>(null);
  const [messageFeedback, setMessageFeedback] = useState<Record<string, 'helpful' | 'not_helpful' | null>>({});
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackMessageId, setFeedbackMessageId] = useState<string | null>(null);
  const [feedbackMessageContent, setFeedbackMessageContent] = useState<string>('');
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [hasAudioPermission, setHasAudioPermission] = useState<boolean | null>(null);
  const [detectedMood, setDetectedMood] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [chatMode, setChatMode] = useState<'text' | 'voice'>('text');
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const ttsPlayerRef = useRef<AudioPlayer | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRecordingActiveRef = useRef(false);
  const isMountedRef = useRef(true);

  const scrollChatToEnd = useCallback((force = false, animated = true) => {
    if (!force) {
      if (chatMachineRef.current.scroll === 'USER_SCROLLING') return;
      if (!isNearBottomRef.current && !stickToLatestRef.current) return;
      if (!mustScrollToBottom(chatMachineRef.current)) return;
    } else {
      chatMachineRef.current = acquireStickOwnership(chatMachineRef.current);
      isNearBottomRef.current = true;
      stickToLatestRef.current = true;
    }
    chatMachineRef.current = beginProgrammaticScroll(chatMachineRef.current);
    chatMachineRef.current = transitionPhase(chatMachineRef.current, 'RENDERING');
    if (force) {
      isNearBottomRef.current = true;
      stickToLatestRef.current = true;
    }
    const pulsed = beginStickPulse(stickPulseRef.current);
    stickPulseRef.current = pulsed.ctrl;
    const generation = pulsed.generation;

    const run = (anim: boolean) => {
      if (!isStickPulseActive(stickPulseRef.current, generation)) return;
      if (chatMachineRef.current.scroll === 'USER_SCROLLING') return;
      const list = flatListRef.current;
      if (!list) return;
      // Offset jump is reliable with variable-height image bubbles (scrollToIndex often fails).
      try {
        list.scrollToOffset({ offset: CHAT_SCROLL_END_OFFSET, animated: anim });
        return;
      } catch {
        /* fall through */
      }
      try {
        list.scrollToEnd({ animated: anim });
      } catch {
        /* list not ready */
      }
    };
    // Instant first pass, then retries as history / images / keyboard settle.
    requestAnimationFrame(() => run(false));
    setTimeout(() => run(animated), 60);
    setTimeout(() => run(false), 180);
    setTimeout(() => run(false), 420);
    setTimeout(() => run(false), 900);
    setTimeout(() => run(false), 1600);
    setTimeout(() => {
      if (!isStickPulseActive(stickPulseRef.current, generation)) return;
      chatMachineRef.current = endProgrammaticScroll(chatMachineRef.current);
      if (chatMachineRef.current.scroll !== 'USER_SCROLLING') {
        chatMachineRef.current = transitionPhase(chatMachineRef.current, 'SETTLED');
      }
    }, 1700);
  }, []);

  const onChatScrollBeginDrag = useCallback(() => {
    // Intentional upward drag: yield stick ownership immediately; kill pending retries.
    stickPulseRef.current = cancelStickPulse(stickPulseRef.current);
    chatMachineRef.current = releaseStickForUserIntent(chatMachineRef.current);
    stickToLatestRef.current = false;
    isNearBottomRef.current = false;
  }, []);

  const onChatScroll = useCallback((event: {
    nativeEvent: {
      contentOffset: { y: number };
      contentSize: { height: number };
      layoutMeasurement: { height: number };
    };
  }) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const nearBottom = computeNearBottom({
      contentOffsetY: contentOffset.y,
      layoutHeight: layoutMeasurement.height,
      contentHeight: contentSize.height,
    });
    chatMachineRef.current = onUserScrollEvent(chatMachineRef.current, nearBottom);
    const locked = chatMachineRef.current.scroll === 'LOCKED_TO_BOTTOM';
    isNearBottomRef.current = locked;
    // Only reacquire stick when the user returns near the bottom (not during programmatic frames).
    if (locked && !chatMachineRef.current.programmatic) {
      stickToLatestRef.current = true;
    } else if (!locked) {
      stickToLatestRef.current = false;
    }
  }, []);

  // Restore unsent composer draft from disk (memory already applied in useState).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(composerDraftKey(stylist.id));
        if (cancelled || raw == null) return;
        // Prefer in-progress typing; otherwise restore stored draft.
        if (!String(inputTextRef.current || '').trim() && raw.length > 0) {
          setInputText(raw);
          inputTextRef.current = raw;
          composerDraftMemory[stylist.id || 'default'] = raw;
        } else if (String(inputTextRef.current || '').trim()) {
          // Keep memory aligned with what is on screen.
          composerDraftMemory[stylist.id || 'default'] = inputTextRef.current;
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stylist.id]);

  // Re-entering Stylist Chat always lands on the latest message (like WhatsApp).
  // Also refresh monthly AI meter — clear hard block after upgrade and retry the last question.
  useFocusEffect(
    useCallback(() => {
      // Re-apply draft if the composer is empty (remount / tab return).
      const mem = readComposerDraft(stylist.id);
      if (mem && !String(inputTextRef.current || '').trim()) {
        setInputText(mem);
        inputTextRef.current = mem;
      }
      void AsyncStorage.getItem(composerDraftKey(stylist.id))
        .then((raw) => {
          if (!raw || String(inputTextRef.current || '').trim()) return;
          setInputText(raw);
          inputTextRef.current = raw;
          composerDraftMemory[stylist.id || 'default'] = raw;
        })
        .catch(() => {});

      chatMachineRef.current = transitionPhase(chatMachineRef.current, 'READY');
      chatMachineRef.current = onChatFocusMachine(chatMachineRef.current);
      stickToLatestRef.current = true;
      isNearBottomRef.current = true;
      scrollChatToEnd(true, false);
      const timers = [80, 200, 450, 800, 1400, 2200].map((ms) =>
        setTimeout(() => scrollChatToEnd(true, false), ms),
      );

      let cancelled = false;
      let retryTimer: ReturnType<typeof setTimeout> | null = null;
      (async () => {
        try {
          await apiService.init();
          const result = await apiService.getAiUsage();
          if (cancelled) return;
          const u = result.usage;
          if (!u) return;
          const budget = Number(u.budgetCents) || 0;
          const used = Number(u.usedCents) || 0;
          const remaining = Number(u.remainingCents);
          const hasRoom = Number.isFinite(remaining) ? remaining > 0 : budget > 0 && used < budget;
          const pct = budget > 0 ? used / budget : 0;

          if (!hasRoom) {
            setMonthlyAllowanceExhausted(true);
            setAiAllowanceSoftWarn(false);
            return;
          }

          setMonthlyAllowanceExhausted(false);
          setAiAllowanceSoftWarn(pct >= 0.9);

          const raw = await AsyncStorage.getItem(PENDING_STYLIST_RETRY_KEY);
          if (!raw || cancelled || pendingRetryInFlightRef.current) return;
          let pendingText = '';
          try {
            const parsed = JSON.parse(raw) as { text?: string };
            pendingText = String(parsed?.text || '').trim();
          } catch {
            pendingText = String(raw || '').trim();
          }
          if (!pendingText) {
            await AsyncStorage.removeItem(PENDING_STYLIST_RETRY_KEY);
            return;
          }
          pendingRetryInFlightRef.current = true;
          await AsyncStorage.removeItem(PENDING_STYLIST_RETRY_KEY);
          retryTimer = setTimeout(() => {
            void sendMessageRef.current(pendingText).finally(() => {
              pendingRetryInFlightRef.current = false;
            });
          }, 450);
        } catch {
          // Usage endpoint optional — don't block chat.
        }
      })();

      return () => {
        cancelled = true;
        timers.forEach(clearTimeout);
        if (retryTimer) clearTimeout(retryTimer);
        // Flush draft on leave (memory + disk).
        writeComposerDraft(stylist.id, inputTextRef.current);
      };
    }, [scrollChatToEnd, tier, stylist.id]),
  );

  // listBottomInset is computed after limitReached (see below) so the allowance
  // banner can lift the last message above the sticky input.
  
  const pulseScale = useSharedValue(1);
  const waveformBars = [
    useSharedValue(0.3),
    useSharedValue(0.3),
    useSharedValue(0.3),
    useSharedValue(0.3),
    useSharedValue(0.3),
  ];
  
  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const navigateToSubscriptionScreen = useCallback((opts?: { scrollToAiTopUp?: boolean }) => {
    navigateToSubscription(navigation, {
      source: 'stylist_chat',
      asPaywall: true,
      ...(opts?.scrollToAiTopUp ? { scrollToAiTopUp: true } : {}),
    });
  }, [navigation]);

  const openAiAllowanceDestination = useCallback((action: 'upgrade' | 'topup' | 'dismiss') => {
    if (action === 'dismiss') return;
    navigateToSubscriptionScreen({ scrollToAiTopUp: action === 'topup' });
  }, [navigateToSubscriptionScreen]);
  
  const navigateToWardrobe = useCallback(() => {
    navigation.dispatch(
      CommonActions.navigate({
        name: 'ProfileTab',
        params: {
          screen: 'Wardrobe',
        },
      })
    );
  }, [navigation]);

  const WEATHER_CHIP_ID = 'weather';

  const wardrobeImageFingerprint = useMemo(
    () => wardrobeItems
      .map((item) => `${item.id}:${resolveWardrobeImageUri(item)}`)
      .join('|'),
    [wardrobeItems],
  );

  useEffect(() => {
    if (wardrobeItems.length === 0) return;

    setMessages((prev) => {
      let changed = false;
      const next = prev.map((msg) => {
        if (msg.role !== 'assistant') return msg;
        const serverVisual = normalizeWardrobeVisual(msg.wardrobeVisual);
        if (!serverVisual) return msg;

        // ID-only hydration — never invent / reorder pieces from prose.
        const hydrated = hydrateWardrobeVisualImagesByIds(serverVisual, wardrobeItems);
        if (!hydrated) return msg;

        const before = JSON.stringify(serverVisual);
        const after = JSON.stringify(hydrated);
        if (before === after) return msg;

        changed = true;
        return {
          ...msg,
          wardrobeVisual: hydrated,
          visualAuthority: msg.visualAuthority || 'server',
        };
      });

      return changed ? next : prev;
    });
  }, [wardrobeImageFingerprint, wardrobeItems, user?.subscriptionTier]);
  
  useEffect(() => {
    isMountedRef.current = true;
    // Progressive hydrate — no transition coupling, no cover. Sync cache (prefetched from Hub)
    // means first paint usually already has today's thread; merge is a no-op then.
    void (async () => {
      const localFound = await loadChatHistory({ phase: 'local' });
      await loadDailyMessageCount();
      if (!localFound) {
        await loadChatHistory({ phase: 'server' });
      }
      void checkAudioPermission();
    })();
    return () => {
      isMountedRef.current = false;
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      cancelAnimation(pulseScale);
      waveformBars.forEach((bar) => cancelAnimation(bar));
      if (isRecordingActiveRef.current) {
        isRecordingActiveRef.current = false;
        audioRecorder.stop().catch(() => {});
      }
      stopTTSPlayback();
    };
  }, []);
  
  // Patch seed greeting text in place (same row id) when language/stylist changes.
  useEffect(() => {
    const nextGreeting = buildSeedGreeting();
    setMessages((prev) => {
      if (!isSeedOnlyThread(prev) || !prev[0]) return prev;
      if (prev[0].content === nextGreeting) return prev;
      const next = [{ ...prev[0], id: SEED_MESSAGE_ID, content: nextGreeting }];
      rememberChatMessages(next, true);
      return next;
    });
  }, [stylist, buildSeedGreeting]);

  useEffect(() => {
    if (isRecording) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1,
        true
      );

      waveformBars.forEach((bar, index) => {
        bar.value = withRepeat(
          withSequence(
            withTiming(0.3 + Math.random() * 0.7, { duration: 200 + index * 50 }),
            withTiming(0.3, { duration: 200 + index * 50 })
          ),
          -1,
          true
        );
      });
    } else {
      cancelAnimation(pulseScale);
      pulseScale.value = withSpring(1);
      waveformBars.forEach((bar) => {
        cancelAnimation(bar);
        bar.value = withSpring(0.3);
      });
    }
  }, [isRecording]);

  const checkAudioPermission = async () => {
    if (Platform.OS === 'web') {
      setHasAudioPermission(false);
      return;
    }
    try {
      const { status } = await requestRecordingPermissionsAsync();
      setHasAudioPermission(status === 'granted');
    } catch (error) {
      setHasAudioPermission(false);
    }
  };

  const playTTSAudio = async (text: string) => {
    if (!ttsEnabled || !voiceSettings.ttsEnabled || Platform.OS === 'web') return;
    if (!hasVoiceCredits) return;
    
    try {
      if (!isMountedRef.current) return;
      setIsPlayingTTS(true);
      
      if (ttsPlayerRef.current) {
        try {
          ttsPlayerRef.current.pause();
          ttsPlayerRef.current.remove();
        } catch {
          // Player native object may already be released.
        }
        ttsPlayerRef.current = null;
      }

      const voiceId = getVoiceForStylist(stylist.id as StylistId);
      
      const response = await apiService.createVoiceResponse({
        textResponse: text,
        stylistId: stylist.id,
        speed: voiceSettings.voiceSpeed,
        voice: voiceId,
        language: effectiveLanguage,
      });

      if (!isMountedRef.current) return;

      if (response.success && response.audio?.audioBuffer) {
        refreshVoiceCredits();
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
        });

        const player = createAudioPlayer(
          { uri: `data:audio/mp3;base64,${response.audio.audioBuffer}` }
        );
        ttsPlayerRef.current = player;

        const subscription = player.addListener('playbackStatusUpdate', (status) => {
          if (!status.didJustFinish) return;
          subscription.remove();
          if (!isMountedRef.current) {
            try {
              player.remove();
            } catch {
              // ignore
            }
            return;
          }
          setIsPlayingTTS(false);
          try {
            player.remove();
          } catch {
            // ignore
          }
          ttsPlayerRef.current = null;
        });
        player.play();
      } else {
        setIsPlayingTTS(false);
      }
    } catch (error) {
      console.log('TTS playback failed:', error);
      if (isMountedRef.current) {
        setIsPlayingTTS(false);
      }
    }
  };

  const stopTTSPlayback = async () => {
    try {
      if (ttsPlayerRef.current) {
        try {
          ttsPlayerRef.current.pause();
          ttsPlayerRef.current.remove();
        } catch {
          // Player native object may already be released.
        }
        ttsPlayerRef.current = null;
      }
      if (isMountedRef.current) {
        setIsPlayingTTS(false);
      }
    } catch (error) {
      console.log('Error stopping TTS:', error);
      if (isMountedRef.current) {
        setIsPlayingTTS(false);
      }
    }
  };

  const convertAudioToBase64 = async (uri: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') return null;
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });
      return base64;
    } catch (error) {
      console.error('Failed to convert audio to base64:', error);
      return null;
    }
  };

  const formatRecordingDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    if (Platform.OS === 'web') {
      Alert.alert(t('common.notAvailable'), t('aiStylist.voiceNotAvailable'));
      return;
    }

    if (!hasAudioPermission) {
      const { status, canAskAgain } = await requestRecordingPermissionsAsync();
      if (status !== 'granted') {
        if (!canAskAgain && (Platform.OS as string) !== 'web') {
          Alert.alert(
            t('aiStylist.micPermissionRequired'),
            t('aiStylist.micPermissionMessage').replace('{name}', stylist.name),
            [
              { text: t('common.cancel'), style: 'cancel' },
              { 
                text: t('common.openSettings'), 
                onPress: async () => {
                  try {
                    await Linking.openSettings();
                  } catch (error) {
                    console.log('Could not open settings');
                  }
                }
              },
            ]
          );
        }
        return;
      }
      setHasAudioPermission(true);
    }

    if (!canSendMessage()) {
      if (monthlyAllowanceExhausted) {
        presentMonthlyAllowancePaywall();
      } else {
        Alert.alert(
          t('common.dailyLimitReached'),
          t('aiStylist.dailyLimitUpgrade'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('aiStylist.upgradeNow') || 'Upgrade Now', onPress: navigateToSubscriptionScreen },
          ],
        );
      }
      return;
    }

    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      isRecordingActiveRef.current = true;
      setIsRecording(true);
      setRecordingDuration(0);

      if ((Platform.OS as string) !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          if (prev >= 59) {
            stopRecording(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert(t('common.recordingError'), t('aiStylist.couldNotStartRecording'));
    }
  };

  const stopRecording = async (cancelled: boolean) => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (!isRecordingActiveRef.current) {
      setIsRecording(false);
      return;
    }

    isRecordingActiveRef.current = false;
    setIsRecording(false);

    try {
      let actualDurationMs = 0;
      try {
        const status = audioRecorder.getStatus();
        actualDurationMs = status.durationMillis ?? 0;
      } catch {
        return;
      }

      await audioRecorder.stop();

      if (cancelled) {
        return;
      }

      let uri: string | null = null;
      try {
        uri = audioRecorder.uri ?? null;
      } catch {
        return;
      }

      const actualDurationSec = Math.ceil(actualDurationMs / 1000);
      const minDurationMs = 300;

      if (uri && actualDurationMs >= minDurationMs) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        handleVoiceMessage(uri, Math.max(actualDurationSec, 1));
      } else if (uri && actualDurationMs < minDurationMs) {
        Alert.alert(t('common.recordingTooShort'), t('aiStylist.recordingTooShortMessage'));
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setIsRecording(false);
      isRecordingActiveRef.current = false;
    }
  };

  const handleVoiceMessage = async (uri: string, duration: number) => {
    if (!canSendMessage()) return;

    setIsTranscribing(true);
    let transcribedText = '';

    try {
      const audioBase64 = await convertAudioToBase64(uri);
      
      if (audioBase64) {
        const mimeType = uri.toLowerCase().includes('.webm') ? 'audio/webm' as const : 'audio/m4a';
        const transcribeResponse = await apiService.transcribeAudio(
          audioBase64,
          mimeType,
          effectiveLanguage
        );
        
        if (transcribeResponse.success && transcribeResponse.text) {
          transcribedText = transcribeResponse.text;
        }
      }
    } catch (error) {
      console.log('Transcription failed, using fallback:', error);
    } finally {
      setIsTranscribing(false);
    }

    const displayText = transcribedText || 'Voice message';
    const messageToSend = transcribedText || 'I just sent you a voice message about my style needs. Please help me with outfit suggestions.';
    lastOutboundPromptRef.current = messageToSend;

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: displayText,
      timestamp: new Date().toISOString(),
      voiceMessage: { uri, duration },
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setShowQuickPrompts(false);
    setIsTyping(true);

    await incrementDailyMessages();

    setTimeout(() => {
      scrollChatToEnd(true);
    }, 100);

    try {
      const wardrobeContext = wardrobeItems.map(item => ({
        id: item.id,
        name: item.name,
        color: item.color,
        category: item.category,
        brand: item.brand || null,
        subcategory: item.subcategory || null,
        wearCount: item.timesWorn ?? 0,
        timesWorn: item.timesWorn ?? 0,
        isFavorite: Boolean(item.isFavorite),
        favorite: Boolean(item.isFavorite),
        origin: item.origin || 'owned',
        notes: item.notes || null,
        imageUrl: resolveWardrobeImageUri(item) || item.imageUri || null,
        imageUri: item.imageUri || null,
        processedImageUrl: item.enhancedImageUri || null,
        enhancedImageUri: item.enhancedImageUri || null,
      }));
      
      const chatHistory = updatedMessages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content,
      }));
      
      const mappedGenderVoice = user?.gender === 'man' ? 'male' : user?.gender === 'woman' ? 'female' : user?.gender || 'unspecified';
      let locationDataVoice: { lat?: number; lon?: number; location?: string } = {};
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
          locationDataVoice = { lat: loc.coords.latitude, lon: loc.coords.longitude };
        }
      } catch {
        // optional
      }
      const response = await apiService.sendStylistMessage({
        stylistId: stylist.id,
        messages: chatHistory,
        userMessage: messageToSend,
        wardrobeItems: wardrobeContext,
        userGender: mappedGenderVoice,
        subscriptionTier: tier,
        language: effectiveLanguage,
        ...locationDataVoice,
        location: user?.country || actualCountry || undefined,
        countryCode: normalizeCountryCode(actualCountry || user?.actualCountry || user?.country) || undefined,
        ...continuityApiFields({
          bootstrapRecent: looksLikeDecisionFollowUp(messageToSend),
        }),
        userProfile: {
          ...(user?.profileData || {}),
          gender: mappedGenderVoice,
          name: user?.name,
          country: user?.country || actualCountry,
          actualCountry: actualCountry || user?.actualCountry,
          countryCode: normalizeCountryCode(actualCountry || user?.actualCountry || user?.country),
          preferredStyles: user?.onboardingProfile?.likedStyles || user?.extendedPreferences?.culturalStyle?.preferredStyles,
          skinUndertone: user?.skinUndertone,
          bodyType: user?.bodyShape,
          bodyMeasurements: user?.bodyMeasurements,
          colorScanData: user?.colorScanData,
          extendedPreferences: user?.extendedPreferences,
          stylistPreferences: user?.stylistPreferences,
          stylePreference: user?.stylePreference,
          sizeRange: user?.sizeRange,
          budgetRange: user?.budgetRange,
          subscriptionTier: user?.subscriptionTier,
          retailers: user?.extendedPreferences?.favoriteShops || [],
        },
      });
      
      if (response.mood) {
        setDetectedMood(response.mood.mood);
      }

      const assistantMessage = attachWardrobeVisualToMessage(
        {
          id: `msg_${Date.now()}_assistant`,
          role: 'assistant',
          content: response.content,
          timestamp: new Date().toISOString(),
          visualAuthority: response.visualAuthority === 'server' ? 'server' : undefined,
          hasOutfitRecommendation: response.hasOutfitRecommendation,
        },
        messageToSend,
        response,
        wardrobeItems,
        user?.subscriptionTier,
      );

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      setIsTyping(false);

      await saveChatHistory(finalMessages);
      if (assistantMessage.outfitVisualSuggestion) {
        void generateSuggestedOutfitVisual(assistantMessage.id, assistantMessage.outfitVisualSuggestion);
      }

      if (voiceSettings.autoPlayResponses) {
        playTTSAudio(response.content);
      }

      setTimeout(() => {
        scrollChatToEnd(true);
      }, 100);
    } catch (error: any) {
      console.log('API call failed for voice:', error);

      const isAuthError = error?.message?.includes('Authentication required')
        || error?.message?.includes('Unauthorized')
        || error?.message?.includes('401');

      let responseContent: string;
      if (isAiBudgetError(error)) {
        responseContent = presentMonthlyAllowancePaywall(error);
      } else if (isAuthError) {
        responseContent = `I'd love to help you with that! To get personalized fashion advice powered by AI, please sign in to your account. Once you're logged in, I can give you tailored recommendations based on your style profile and wardrobe. Tap the Profile tab to sign in!`;
      } else {
        // Never invent a fake styling reply on failure — that destroys trust.
        responseContent = stylist.id === 'max'
          ? "I couldn't finish that reply just now. Give it another shot in a moment — I'll be right here."
          : stylist.id === 'ace'
            ? "I couldn't finish that reply just now. Please try again in a moment."
            : "I couldn't finish that reply just now, gorgeous. Give it another try in a moment — I'll be right here.";
      }

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: responseContent,
        timestamp: new Date().toISOString(),
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      setIsTyping(false);

      await saveChatHistory(finalMessages);

      if (voiceSettings.autoPlayResponses && !isAiBudgetError(error)) {
        playTTSAudio(responseContent);
      }

      setTimeout(() => {
        scrollChatToEnd(true);
      }, 100);
    }
  };

  const loadChatHistory = async (options?: { phase?: 'local' | 'server' }) => {
    const phase = options?.phase ?? 'local';
    try {
      if (phase === 'local') {
        const data = await AsyncStorage.getItem(CHAT_STORAGE_KEY);
        if (data) {
          const parsed = JSON.parse(data);
          if (!Array.isArray(parsed)) {
            await AsyncStorage.removeItem(CHAT_STORAGE_KEY);
          } else {
            let recentMessages = readTodayMessagesFromParsed(parsed);

            if (recentMessages.length > 0) {
              stickToLatestRef.current = true;
              isNearBottomRef.current = true;
              chatMachineRef.current = transitionPhase(chatMachineRef.current, 'LOADING_HISTORY');
              chatMachineRef.current = onChatFocusMachine(chatMachineRef.current);

              if (recentMessages.length === 1 && recentMessages[0]?.role === 'assistant') {
                recentMessages = [{ ...recentMessages[0], id: SEED_MESSAGE_ID, content: buildSeedGreeting() }];
                setShowQuickPrompts(true);
              } else {
                setShowQuickPrompts(false);
              }

              setMessages((prev) => {
                const merged = mergeChatMessages(prev, recentMessages);
                if (merged !== prev) {
                  rememberChatMessages(merged, !threadHasUserMessage(merged));
                }
                return merged;
              });
              setTimeout(() => scrollChatToEnd(true, false), 50);
              setTimeout(() => scrollChatToEnd(true, false), 400);
              return true;
            }
          }
        }
        return false;
      }

      if (threadHasUserMessage(getCachedMessagesSync() || []) || messagesLenRef.current > 1) {
        return false;
      }

      try {
        const tombRaw = await AsyncStorage.getItem(STYLIST_CHAT_CLEARED_TOMBSTONE_KEY);
        const tombstone = parseStylistChatClearedTombstone(tombRaw);
        if (shouldSuppressServerChatHydrate(tombstone, stylist.id)) {
          return false;
        }
      } catch {
        /* tombstone optional */
      }

      try {
        const serverHistory = await apiService.getChatHistory(stylist.id, 40);
        if (Array.isArray(serverHistory) && serverHistory.length > 0) {
          const mapped = serverHistory
            .filter((m) => m?.role === 'user' || m?.role === 'assistant')
            .map((m, index) => ({
              id: `server_${m.id ?? index}`,
              role: m.role as 'user' | 'assistant',
              content: typeof m.content === 'string' ? m.content : '',
              timestamp: m.createdAt
                ? new Date(m.createdAt).toISOString()
                : new Date().toISOString(),
            }))
            .filter((m) => m.content.trim().length > 0)
            .slice(-20);
          if (mapped.some((m) => m.role === 'user')) {
            setShowQuickPrompts(false);
            setMessages((prev) => {
              const merged = mergeChatMessages(prev, mapped);
              if (merged !== prev) {
                rememberChatMessages(merged, false);
                void saveChatHistory(merged);
              }
              return merged;
            });
            return true;
          }
        }
      } catch {
        /* server history optional */
      }
      return false;
    } catch (error) {
      console.error('Failed to load chat history:', error);
      await AsyncStorage.removeItem(CHAT_STORAGE_KEY).catch(() => {});
      return false;
    }
  };
  
  const loadDailyMessageCount = async () => {
    try {
      const data = await AsyncStorage.getItem(DAILY_MESSAGES_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        const today = new Date().toDateString();
        if (parsed.date === today) {
          setMessagesToday(parsed.count);
        } else {
          await AsyncStorage.setItem(DAILY_MESSAGES_KEY, JSON.stringify({ date: today, count: 0 }));
          setMessagesToday(0);
        }
      }
    } catch (error) {
      console.error('Failed to load daily message count:', error);
    } finally {
      setLimitsLoaded(true);
    }
  };
  
  const saveChatHistory = async (newMessages: ChatMessage[]) => {
    try {
      const trimmed = newMessages.slice(-50);
      rememberChatMessages(trimmed, !threadHasUserMessage(trimmed));
      await AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(trimmed));
    } catch (error) {
      console.error('Failed to save chat history:', error);
    }
  };

  const generateSuggestedOutfitVisual = async (
    messageId: string,
    suggestion: NonNullable<ChatMessage['outfitVisualSuggestion']>,
  ) => {
    try {
      const result = await apiService.generateOutfitImage(
        suggestion.outfitDescription,
        suggestion.occasion,
        {
          pieces: suggestion.pieces,
        },
      ) as { imageUrl?: string | null; isPlaceholder?: boolean };
      setMessages((current) => {
        const next = current.map((entry) => entry.id === messageId
          ? {
              ...entry,
              isVisualizingOutfit: false,
              imageUri: result.imageUrl && !result.isPlaceholder ? result.imageUrl : undefined,
              outfitVisualSuggestion: undefined,
            }
          : entry);
        void saveChatHistory(next);
        return next;
      });
    } catch (error) {
      console.log('Outfit visualization failed:', error);
      setMessages((current) => {
        const next = current.map((entry) => entry.id === messageId
          ? { ...entry, isVisualizingOutfit: false, outfitVisualSuggestion: undefined }
          : entry);
        void saveChatHistory(next);
        return next;
      });
    }
  };
  
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.permissionNeeded'), t('aiStylist.photoPermissionRuby'));
        return;
      }

      const remaining = Math.max(0, 3 - selectedImageUris.length);
      if (remaining <= 0) {
        Alert.alert(
          t('aiStylist.maxPhotosTitle') || 'Up to 3 photos',
          t('aiStylist.maxPhotosBody') || 'Attach up to 3 items to compare what to buy.',
        );
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        allowsEditing: false,
        quality: 0.7,
      });
      
      if (!result.canceled && result.assets?.length) {
        const next = [
          ...selectedImageUris,
          ...result.assets.map((a) => a.uri).filter(Boolean),
        ].slice(0, 3);
        setSelectedImageUris(next);
      }
    } catch (error) {
      console.log('Image picker error:', error);
    }
  };

  const incrementDailyMessages = async () => {
    try {
      const today = new Date().toDateString();
      if (
        limits.aiChatMessagesPerDay !== Infinity &&
        messagesToday >= limits.aiChatMessagesPerDay &&
        bonusAIRequests > 0
      ) {
        await consumeBonusAiRequest();
        return;
      }
      const newCount = messagesToday + 1;
      await AsyncStorage.setItem(DAILY_MESSAGES_KEY, JSON.stringify({ date: today, count: newCount }));
      setMessagesToday(newCount);
    } catch (error) {
      console.error('Failed to increment daily messages:', error);
    }
  };
  
  const canSendMessage = () => {
    if (monthlyAllowanceExhausted) return false;
    if (limits.aiChatMessagesPerDay === Infinity) return true;
    if (messagesToday < limits.aiChatMessagesPerDay) return true;
    return bonusAIRequests > 0;
  };

  const presentMonthlyAllowancePaywall = useCallback((error?: unknown) => {
    setMonthlyAllowanceExhausted(true);
    setAiAllowanceSoftWarn(false);
    const planTier = planTierFromBudgetError(error) || tier;
    const content = stylistMonthlyAllowanceMessage({
      stylistName: stylist.name,
      stylistId: stylist.id,
      tier: planTier,
    });
    const paywall = getAiAllowancePaywallCopy(planTier);
    const pending = String(lastOutboundPromptRef.current || '').trim();
    if (pending) {
      void AsyncStorage.setItem(
        PENDING_STYLIST_RETRY_KEY,
        JSON.stringify({ text: pending, stylistId: stylist.id, at: Date.now() }),
      );
    }
    const buttons: Array<{ text: string; style?: 'cancel'; onPress?: () => void }> = [
      { text: paywall.secondaryLabel, style: 'cancel' },
      {
        text: paywall.primaryLabel,
        onPress: () => openAiAllowanceDestination(paywall.primaryAction),
      },
    ];
    // Personal Stylist: secondary is Buy more credit
    if (paywall.secondaryLabel.toLowerCase().includes('buy')) {
      buttons[0] = {
        text: paywall.secondaryLabel,
        onPress: () => openAiAllowanceDestination('topup'),
      };
      buttons.splice(1, 0, { text: 'Maybe later', style: 'cancel' });
    }
    Alert.alert(paywall.title, paywall.message, buttons);
    return content;
  }, [tier, stylist.name, stylist.id, openAiAllowanceDestination]);

  const getRemainingMessages = () => {
    if (limits.aiChatMessagesPerDay === Infinity) return Infinity;
    const dailyLeft = Math.max(0, limits.aiChatMessagesPerDay - messagesToday);
    return dailyLeft + Math.max(0, bonusAIRequests);
  };
  
  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    if (!canSendMessage()) {
      if (monthlyAllowanceExhausted) {
        lastOutboundPromptRef.current = text.trim();
        presentMonthlyAllowancePaywall();
      }
      return;
    }
    lastOutboundPromptRef.current = text.trim();

    // Soft-attach without Continue: bind when the user clearly refers back to QSC/Decide.
    // Unrelated new questions drop the snapshot so chat does not silently inherit it.
    if (pendingSoftContinuityRef.current && !decisionContinuityRef.current) {
      if (looksLikeBuyCompareAsk(text) || looksLikeDecisionFollowUp(text)) {
        confirmSoftContinuity();
      } else {
        console.log('[QscChatContinuity] chat_drop_unrelated');
        await releaseDecisionContinuity();
      }
    }
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const attachedUris = selectedImageUris.slice(0, 3);
    
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
      imageUri: attachedUris[0] || undefined,
      imageUris: attachedUris.length ? attachedUris : undefined,
    };
    
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setComposerText('');
    setSelectedImageUris([]);
    setShowQuickPrompts(false);
    setIsTyping(true);
    
    await incrementDailyMessages();
    
    setTimeout(() => {
      scrollChatToEnd(true);
    }, 100);
    
    try {
      const wardrobeContext = wardrobeItems.map(item => ({
        id: item.id,
        name: item.name,
        color: item.color,
        category: item.category,
        brand: item.brand || null,
        subcategory: item.subcategory || null,
        wearCount: item.timesWorn ?? 0,
        timesWorn: item.timesWorn ?? 0,
        isFavorite: Boolean(item.isFavorite),
        favorite: Boolean(item.isFavorite),
        origin: item.origin || 'owned',
        notes: item.notes || null,
        // Server strip hydrate: durable URLs (or empty — client still hydrates by id).
        imageUrl: resolveWardrobeImageUri(item) || item.imageUri || null,
        imageUri: item.imageUri || null,
        processedImageUrl: item.enhancedImageUri || null,
        enhancedImageUri: item.enhancedImageUri || null,
      }));
      
      const chatHistory = updatedMessages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content,
      }));
      
      const authToken = await apiService.getToken();
      console.log('Auth token available:', !!authToken);
      console.log('User ID:', user?.id);
      console.log('Calling backend API with message:', text.trim());
      
      const mappedGenderText = user?.gender === 'man' ? 'male' : user?.gender === 'woman' ? 'female' : user?.gender || 'unspecified';
      const trimmedAsk = text.trim();
      const priorItemIds = extractPriorWardrobeItemIds(updatedMessages);

      // Outfit continuity: merge pending clarify BEFORE cold intent classification (C3).
      const outfitRoute = resolveOutfitRoute({
        userText: trimmedAsk,
        messages: updatedMessages,
        wardrobeItems,
        hasPriorOutfitItems: priorItemIds.length > 0,
      });

      const markPriorOutfitClarifyDone = (msgs: ChatMessage[]): ChatMessage[] =>
        msgs.map((m) =>
          m.role === 'assistant' && m.outfitClarify && m.outfitClarify.state !== 'DONE'
            ? { ...m, outfitClarify: clearOutfitClarify(m.outfitClarify) }
            : m,
        );

      if (outfitRoute.route === 'cancel_pending' || outfitRoute.route === 'drop_pending_unrelated') {
        if (outfitRoute.route === 'drop_pending_unrelated') {
          console.log('[OutfitClarify] chat_drop_unrelated');
        }
        // Clear pending, then fall through to normal routing for this turn.
        const cleared = markPriorOutfitClarifyDone(updatedMessages);
        updatedMessages.splice(0, updatedMessages.length, ...cleared);
        setMessages(cleared);
      }

      if (outfitRoute.route === 'awaiting_more' && !attachedUris.length) {
        const clarifyMsg: ChatMessage = {
          id: `msg_${Date.now()}_assistant`,
          role: 'assistant',
          content:
            outfitRoute.clarifyHint
            || 'Which piece did you mean from your wardrobe?',
          timestamp: new Date().toISOString(),
          outfitClarify: outfitRoute.pending,
        };
        const finalMessages = [...updatedMessages, clarifyMsg];
        setMessages(finalMessages);
        setIsTyping(false);
        await saveChatHistory(finalMessages);
        setTimeout(() => scrollChatToEnd(true), 100);
        return;
      }

      const isRefineOutfitAsk =
        (outfitRoute.route === 'outfit-from-wardrobe' && outfitRoute.reason === 'refine')
        || (isWardrobeOutfitRefineAsk(trimmedAsk) && priorItemIds.length > 0);
      const isMultiDayTravelAsk = isMultiDayTravelOutfitAsk(trimmedAsk);
      const pendingTravelSlots = findPendingTravelClarify(updatedMessages);
      const pendingOutfitReady =
        outfitRoute.route === 'outfit-from-wardrobe'
        && (outfitRoute.reason === 'pending_ready' || outfitRoute.reason === 'tier_b_ready');
      const isOutfitCreate =
        (outfitRoute.route === 'outfit-from-wardrobe'
          && (outfitRoute.reason === 'outfit_task'
            || outfitRoute.reason === 'hard_lock'
            || outfitRoute.reason === 'pending_ready'
            || outfitRoute.reason === 'tier_b_ready'))
        || isOutfitTaskAsk(trimmedAsk);

      // Multi-day / travel: first-class clarify → generate (never single-look chip soft-fail).
      // Skip when outfit clarify pending is READY — that stays on outfit-from-wardrobe.
      if ((isMultiDayTravelAsk || pendingTravelSlots) && !attachedUris.length && !pendingOutfitReady) {
        const advanced = advanceMultiDayTravelClarify({
          query: trimmedAsk,
          priorSlots: pendingTravelSlots || emptyMultiDaySlots(),
          stylistId: stylist.id,
        });

        if (advanced.state !== 'READY') {
          const clarifyMsg: ChatMessage = {
            id: `msg_${Date.now()}_assistant`,
            role: 'assistant',
            content: advanced.clarifyCopy || multiDayClarifyCopy(stylist.id, advanced.slots),
            timestamp: new Date().toISOString(),
            travelClarify: {
              flow: advanced.flow,
              state: advanced.state,
              slots: advanced.slots,
              missing: advanced.missing,
            },
          };
          const finalMessages = [...updatedMessages, clarifyMsg];
          setMessages(finalMessages);
          setIsTyping(false);
          await saveChatHistory(finalMessages);
          setTimeout(() => scrollChatToEnd(true), 100);
          return;
        }

        // Slots ready → generate day looks via multi-day outfit tool (destination weather).
        try {
          const weatherSnap = await fetchWeatherForOutfitCreate(3000);
          const clientRows = (wardrobeItems || []).slice(0, 120).map((item) => ({
            id: item.id,
            name: item.name,
            category: item.category,
            subcategory: item.subcategory,
            color: item.color,
            brand: item.brand,
            imageUri: item.imageUri,
            imageUrl: item.imageUri,
          }));
          const multi = await apiService.sendMultiDayOutfitsFromChat({
            stylistId: stylist.id,
            userMessage: trimmedAsk,
            travelSlots: advanced.slots,
            wardrobeItems: clientRows,
            weather: weatherSnap.weather,
            lat: weatherSnap.lat,
            userProfile: user
              ? { id: user.id, gender: user.gender, countryCode: (user as { countryCode?: string }).countryCode }
              : undefined,
          });
          const ui = resolveMultiDayGenerateUi({
            priorMessages: updatedMessages,
            result: { ok: true, multi },
            userMessage: trimmedAsk,
            fallbackSlots: advanced.slots as unknown as Record<string, unknown>,
            wardrobeItems: wardrobeItems || [],
            subscriptionTier: user?.subscriptionTier,
            attachFn: (message, userMessage, response, items, tier) =>
              attachWardrobeVisualToMessage(
                message as ChatMessage,
                userMessage,
                response as Parameters<typeof attachWardrobeVisualToMessage>[2],
                items as WardrobeItem[],
                tier,
              ) as unknown as Record<string, unknown>,
          });
          if (ui.softVisualFail) {
            console.warn('[StylistChat] multi-day attachWardrobeVisual soft-fail — keeping HTTP body');
          }
          const finalMessages = ui.messages as ChatMessage[];
          setMessages(finalMessages);
          setIsTyping(false);
          await saveChatHistory(finalMessages);
          setTimeout(() => scrollChatToEnd(true), 100);
          return;
        } catch (multiErr) {
          console.warn('[StylistChat] multi-day generate failed:', multiErr);
          const ui = resolveMultiDayGenerateUi({
            priorMessages: updatedMessages,
            result: { ok: false },
            userMessage: trimmedAsk,
            fallbackSlots: advanced.slots as unknown as Record<string, unknown>,
            wardrobeItems: wardrobeItems || [],
            subscriptionTier: user?.subscriptionTier,
            attachFn: () => {
              throw new Error('attach_unused_on_http_failure');
            },
          });
          const finalMessages = ui.messages as ChatMessage[];
          setMessages(finalMessages);
          setIsTyping(false);
          await saveChatHistory(finalMessages);
          setTimeout(() => scrollChatToEnd(true), 100);
          return;
        }
      }

      // Single-look create / thin refine / pending clarify merge → ONE server createWardrobeOutfit path.
      // Avoid local-then-server double generate (was a major 40s hang contributor).
      if ((isOutfitCreate || isRefineOutfitAsk || pendingOutfitReady) && !attachedUris.length) {
        let assistantMessage: ChatMessage | null = null;
        const continuityLocks =
          outfitRoute.route === 'outfit-from-wardrobe' && outfitRoute.lockedItemIds.length
            ? outfitRoute.lockedItemIds
            : undefined;
        const serverUserMessage =
          outfitRoute.route === 'outfit-from-wardrobe'
          && (outfitRoute.reason === 'pending_ready' || outfitRoute.reason === 'tier_b_ready')
            ? outfitRoute.userMessageForServer
            : trimmedAsk;
        const weatherSnap =
          outfitRoute.route === 'outfit-from-wardrobe'
          && (outfitRoute.reason === 'pending_ready' || outfitRoute.reason === 'tier_b_ready')
          && outfitRoute.weather
            ? { weather: outfitRoute.weather, lat: outfitRoute.lat ?? null }
            : await fetchWeatherForOutfitCreate(3000);
        const occasionForServer = isRefineOutfitAsk
          ? raiseOccasionForRefine(extractPriorOutfitOccasion(updatedMessages), trimmedAsk)
          : (outfitRoute.route === 'outfit-from-wardrobe'
            && (outfitRoute.reason === 'tier_b_ready' || outfitRoute.reason === 'pending_ready')
            && outfitRoute.occasion
            ? outfitRoute.occasion
            : (outfitRoute.route === 'outfit-from-wardrobe' && outfitRoute.occasion
              ? outfitRoute.occasion
              : inferOutfitOccasionFromAsk(serverUserMessage, 'casual_day')));
        const recentOutfits = extractRecentOutfitIdLists(updatedMessages, 5);
        // Contract 1: refine lock polarity is server-authoritative (compileRefineIntent).
        // Do not send client-derived keepShoesChangeRest locks — they inverted Test 6.
        let lockedItems: string[] | undefined = continuityLocks;
        let excludeItemIds: string[] | undefined;

        if (!isRefineOutfitAsk) {
          // Singular hard-lock ask is authoritative: drop stale continuity/client footwear locks.
          const hardLockRes = resolveHardLockMentions({
            query: serverUserMessage,
            wardrobeRows: wardrobeItems,
            // Candidates only for evidence scoring — never blindly preserved (server R8).
            clientLockedIds: [],
          });
          if (hardLockRes.mode === 'singular' && hardLockRes.action === 'lock' && hardLockRes.lockedItemIds.length) {
            lockedItems = hardLockRes.lockedItemIds;
          } else if (!continuityLocks?.length) {
            if (hardLockRes.action === 'clarify') {
              // Server is authoritative for clarify; still avoid sending a multi-lock list.
              lockedItems = undefined;
            } else {
              const dualGarmentAsk = isMultiPieceHardLockAsk(serverUserMessage);
              const mentionMatches = matchWardrobeItemsInText(serverUserMessage, wardrobeItems, 4);
              const mentionLockIds = [...new Set(mentionMatches.map((m) => String(m.id)).filter(Boolean))];
              if (dualGarmentAsk && mentionLockIds.length >= 2 && !lockedItems?.length) {
                lockedItems = mentionLockIds.slice(0, 2);
              }
            }
          }
        }

        try {
          const outfitResponse = await apiService.sendWardrobeOutfitFromChat({
            stylistId: stylist.id,
            userMessage: serverUserMessage,
            wardrobeItems: wardrobeContext,
            userProfile: {
              gender: mappedGenderText,
              name: user?.name,
              subscriptionTier: user?.subscriptionTier,
            },
            occasion: occasionForServer,
            weather: weatherSnap.weather,
            lat: weatherSnap.lat,
            priorItemIds: isRefineOutfitAsk ? priorItemIds : undefined,
            lockedItems: isRefineOutfitAsk ? undefined : lockedItems,
            excludedItems: isRefineOutfitAsk ? undefined : excludeItemIds,
            recentOutfits,
            source: 'wardrobe',
          });
          if (!outfitResponse.content || !outfitResponse.content.trim()) {
            throw new Error('Empty response from backend');
          }
          const isTierBNarrow =
            String(outfitResponse.path || '') === 'allocator_tier_b_narrow';
          const isPartialLockClarify =
            String(outfitResponse.path || '') === 'partial_lock_clarify'
            || /which (blazer|piece|item)/i.test(outfitResponse.content);
          // Circuit breaker only — pending_ready / tier_b_ready should resolve before this fires.
          const clarifyLoopBlocked = pendingOutfitReady && isPartialLockClarify;
          // Structured occasionOverride that still Tier-B's is unexpected; unbound
          // coffee/relaxed re-firing Tier B with second-step copy is expected.
          const sentStructuredTierB =
            outfitRoute.route === 'outfit-from-wardrobe'
            && outfitRoute.reason === 'tier_b_ready'
            && !outfitRoute.tierBStillBroad
            && Boolean(outfitRoute.occasion)
            && outfitRoute.occasion !== 'casual_day';
          const tierBLoopBlocked = sentStructuredTierB && isTierBNarrow;
          if (clarifyLoopBlocked) {
            console.warn(
              '[OutfitClarify] circuit_breaker_fired — continuity slot resolution failed after pending_ready',
              {
                lockedItems: lockedItems || [],
                occasion: occasionForServer,
              },
            );
          }
          if (tierBLoopBlocked) {
            console.warn(
              '[OutfitClarify] tier_b_circuit_breaker — Tier B re-fired after structured occasionOverride',
              { occasion: occasionForServer },
            );
          }
          const frozenOutfitAsk =
            outfitRoute.route === 'outfit-from-wardrobe'
            && (outfitRoute.reason === 'pending_ready' || outfitRoute.reason === 'tier_b_ready')
              ? (outfitRoute.pending?.originalUserMessage
                || String(serverUserMessage).split(/\n\nUser (?:confirmed piece|narrowed intent):/)[0]
                || serverUserMessage)
              : serverUserMessage;
          const authority = assertCanonicalOutfitVisual({
            itemIds: outfitResponse.itemIds,
            wardrobeVisual: (outfitResponse.wardrobeVisual as any) || null,
          });
          if (!authority.ok && authority.reason) {
            console.warn('[OutfitClarify] visual_authority_gate', authority.reason, {
              itemIds: outfitResponse.itemIds || [],
            });
          }
          const publishVisual = clarifyLoopBlocked || tierBLoopBlocked || isTierBNarrow
            ? null
            : authority.wardrobeVisual;
          const publishHasRec = clarifyLoopBlocked || tierBLoopBlocked || isTierBNarrow
            ? false
            : Boolean(outfitResponse.hasOutfitRecommendation && publishVisual);
          try {
            const attached = attachWardrobeVisualToMessage(
              {
                id: `msg_${Date.now()}_assistant`,
                role: 'assistant',
                content: clarifyLoopBlocked
                  ? "I still couldn't lock those two pieces into a confident dinner look. Name one piece to build around, or try a different pair."
                  : tierBLoopBlocked
                    ? "I've still got too many options for that direction — pick lunch or drinks, dinner, work, something active, or a date."
                    : outfitResponse.content,
                timestamp: new Date().toISOString(),
                visualAuthority: 'server',
                hasOutfitRecommendation: publishHasRec,
              },
              serverUserMessage,
              {
                ...outfitResponse,
                hasOutfitRecommendation: publishHasRec,
                wardrobeVisual: publishVisual,
              } as any,
              wardrobeItems,
              user?.subscriptionTier,
            );
            if (outfitResponse.occasion || occasionForServer) {
              (attached as ChatMessage & { outfitOccasion?: string }).outfitOccasion =
                outfitResponse.occasion || occasionForServer;
            }
            if (isTierBNarrow && !tierBLoopBlocked) {
              attached.outfitClarify = buildOutfitClarifyFromTierBNarrow({
                originalUserMessage: frozenOutfitAsk,
                occasion: outfitResponse.occasion || occasionForServer || 'casual_day',
                weather: weatherSnap.weather,
                lat: weatherSnap.lat,
              });
            } else if (isPartialLockClarify && !clarifyLoopBlocked) {
              attached.outfitClarify = buildOutfitClarifyFromPartialLock({
                originalUserMessage: frozenOutfitAsk,
                occasion: outfitResponse.occasion || occasionForServer || 'casual_day',
                lockedItemIds: lockedItems || [],
                weather: weatherSnap.weather,
                lat: weatherSnap.lat,
              });
            } else {
              // Publish, refuse, or blocked clarify loop — clear pending (C7).
              attached.outfitClarify = clearOutfitClarify(
                outfitRoute.route === 'outfit-from-wardrobe' ? outfitRoute.pending : null,
              ) || undefined;
            }
            assistantMessage = attached;
          } catch {
            assistantMessage = {
              id: `msg_${Date.now()}_assistant`,
              role: 'assistant',
              content: clarifyLoopBlocked
                ? "I still couldn't lock those two pieces into a confident dinner look. Name one piece to build around, or try a different pair."
                : tierBLoopBlocked
                  ? "I've still got too many options for that direction — pick lunch or drinks, dinner, work, something active, or a date."
                  : outfitResponse.content,
              timestamp: new Date().toISOString(),
              ...(outfitResponse.occasion || occasionForServer
                ? { outfitOccasion: outfitResponse.occasion || occasionForServer }
                : {}),
              ...(isTierBNarrow && !tierBLoopBlocked
                ? {
                    outfitClarify: buildOutfitClarifyFromTierBNarrow({
                      originalUserMessage: frozenOutfitAsk,
                      occasion: outfitResponse.occasion || occasionForServer || 'casual_day',
                      weather: weatherSnap.weather,
                      lat: weatherSnap.lat,
                    }),
                  }
                : isPartialLockClarify && !clarifyLoopBlocked
                  ? {
                      outfitClarify: buildOutfitClarifyFromPartialLock({
                        originalUserMessage: frozenOutfitAsk,
                        occasion: outfitResponse.occasion || occasionForServer || 'casual_day',
                        lockedItemIds: lockedItems || [],
                        weather: weatherSnap.weather,
                        lat: weatherSnap.lat,
                      }),
                    }
                  : {
                      outfitClarify: clearOutfitClarify(
                        outfitRoute.route === 'outfit-from-wardrobe' ? outfitRoute.pending : null,
                      ) || undefined,
                    }),
            };
          }
        } catch (chatOutfitErr) {
          console.warn('[StylistChat] server createWardrobeOutfit failed:', chatOutfitErr);
          const isTimeout = chatOutfitErr instanceof Error
            && /\b(timeout|timed out|aborted|network)\b/i.test(chatOutfitErr.message);
          assistantMessage = {
            id: `msg_${Date.now()}_assistant`,
            role: 'assistant',
            content: isTimeout
              ? "That took longer than expected — try again in a moment. If you're on a slow connection, give it one more go."
              : "I couldn't land a confident look from your wardrobe for that ask just now. Name one piece to build around, or try again shortly.",
            timestamp: new Date().toISOString(),
            // Refuse clears pending (C7).
            outfitClarify: clearOutfitClarify(
              outfitRoute.route === 'outfit-from-wardrobe' ? outfitRoute.pending : null,
            ) || undefined,
          };
        }

        const baseMessages =
          pendingOutfitReady ? markPriorOutfitClarifyDone(updatedMessages) : updatedMessages;
        const finalMessages = [...baseMessages, assistantMessage];
        setMessages(finalMessages);
        setIsTyping(false);
        await saveChatHistory(finalMessages);
        setTimeout(() => scrollChatToEnd(true), 100);
        return;
      }
      
      // Try to get location for weather-aware recommendations (non-blocking, 3s max)
      let locationData: { lat?: number; lon?: number; location?: string } = {};
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
          ]);
          if (loc && 'coords' in loc) {
            locationData = {
              lat: loc.coords.latitude,
              lon: loc.coords.longitude,
            };
          }
        }
      } catch (error) {
        console.log('Location not available:', error);
      }

      let imagesForApi: string[] | undefined;
      if (attachedUris.length) {
        try {
          const { convertImageToBase64 } = await import('@/services/VisionAnalysisService');
          const encoded = await Promise.all(
            attachedUris.map(async (uri) => {
              const b64 = await convertImageToBase64(uri);
              return b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`;
            }),
          );
          imagesForApi = encoded.filter(Boolean).slice(0, 3);
        } catch (imgErr) {
          console.log('Chat image encode failed:', imgErr);
        }
      }
      
      const response = await apiService.sendStylistMessage({
        stylistId: stylist.id,
        messages: chatHistory,
        userMessage: text.trim(),
        images: imagesForApi,
        wardrobeItems: wardrobeContext,
        userGender: mappedGenderText,
        subscriptionTier: tier,
        language: effectiveLanguage,
        ...locationData,
        location: user?.country || actualCountry || locationData.location,
        countryCode: normalizeCountryCode(actualCountry || user?.actualCountry || user?.country) || undefined,
        ...continuityApiFields({
          bootstrapRecent: looksLikeBuyCompareAsk(text) || looksLikeDecisionFollowUp(text),
        }),
        userProfile: {
          ...(user?.profileData || {}),
          gender: mappedGenderText,
          name: user?.name,
          country: user?.country || actualCountry,
          actualCountry: actualCountry || user?.actualCountry,
          countryCode: normalizeCountryCode(actualCountry || user?.actualCountry || user?.country),
          preferredStyles: user?.onboardingProfile?.likedStyles || user?.extendedPreferences?.culturalStyle?.preferredStyles,
          skinUndertone: user?.skinUndertone,
          bodyType: user?.bodyShape,
          bodyMeasurements: user?.bodyMeasurements,
          colorScanData: user?.colorScanData,
          extendedPreferences: user?.extendedPreferences,
          stylistPreferences: user?.stylistPreferences,
          stylePreference: user?.stylePreference,
          sizeRange: user?.sizeRange,
          budgetRange: user?.budgetRange,
          subscriptionTier: user?.subscriptionTier,
          retailers: user?.extendedPreferences?.favoriteShops || [],
        },
      });
      
      console.log('Backend response received:', JSON.stringify(response));
      
      // Validate we actually got content from the backend
      if (!response.content || response.content.trim() === '') {
        console.log('Backend returned empty content, using fallback');
        throw new Error('Empty response from backend');
      }
      
      if (response.mood) {
        setDetectedMood(response.mood.mood);
      }
      
      const assistantMessage = (() => {
        try {
          return attachWardrobeVisualToMessage(
            {
              id: `msg_${Date.now()}_assistant`,
              role: 'assistant',
              content: response.content,
              timestamp: new Date().toISOString(),
              visualAuthority: response.visualAuthority === 'server' ? 'server' : undefined,
              hasOutfitRecommendation: response.hasOutfitRecommendation,
            },
            text.trim(),
            response,
            wardrobeItems,
            user?.subscriptionTier,
          );
        } catch (attachErr) {
          console.warn('[StylistChat] attachWardrobeVisual soft-fail:', attachErr);
          return {
            id: `msg_${Date.now()}_assistant`,
            role: 'assistant' as const,
            content: response.content,
            timestamp: new Date().toISOString(),
          };
        }
      })();
      
      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      setIsTyping(false);
      
      await saveChatHistory(finalMessages);
      if (assistantMessage.outfitVisualSuggestion) {
        void generateSuggestedOutfitVisual(assistantMessage.id, assistantMessage.outfitVisualSuggestion);
      }
      
      if (voiceSettings.autoPlayResponses && ttsEnabled) {
        playTTSAudio(response.content);
      }
      
      setTimeout(() => {
        scrollChatToEnd(true);
      }, 100);
    } catch (error: any) {
      console.log('API call failed - Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      console.log('Error message:', error?.message);
      const failureClass =
        /took too long|INTERNAL_TIMEOUT|timed?\s*out/i.test(String(error?.message || ''))
          ? 'LLM_TIMEOUT'
          : /5\d{2}|server error|empty response/i.test(String(error?.message || ''))
            ? 'SERVER_5XX'
            : /network|offline|failed to fetch/i.test(String(error?.message || ''))
              ? 'NETWORK'
              : 'UNKNOWN';
      console.log('[StylistChat] failureClass=', failureClass);

      const isMale = stylist.id === 'max';
      const isAce = stylist.id === 'ace';
      const rawMessage = String(error?.message || '');
      const isNetwork =
        /network|internet|offline|failed to fetch|timed?\s*out|took too long/i.test(rawMessage);
      const isServer =
        /5\d{2}|server error|service unavailable|empty response/i.test(rawMessage);

      let errorContent: string;
      if (isAiBudgetError(error)) {
        // Monthly meter — conversion opportunity, never a fake "try again later".
        errorContent = presentMonthlyAllowancePaywall(error);
      } else if (isNetwork) {
        errorContent = isMale
          ? "I couldn't reach the styling servers just now — mobile data is fine, but the link dropped. Try again in a moment."
          : isAce
            ? "I couldn't reach the styling servers just now. Mobile data works — please try again in a moment."
            : "I couldn't reach the styling servers just now, gorgeous — mobile data is fine, the link just dropped. Try again in a moment.";
      } else if (isServer) {
        errorContent = isMale
          ? "My styling brain hiccupped on the server side. Give it another shot in a moment."
          : isAce
            ? "There was a brief server issue on my end. Please try again in a moment."
            : "My styling brain hiccupped on the server side, darling. Give it another try in just a moment.";
      } else if (
        isMultiLookOrStyleReferenceAsk(String(lastOutboundPromptRef.current || text || ''))
      ) {
        errorContent = isMale
          ? "I couldn't finish mapping those days just now. Tell me where you're heading and whether it's business or leisure — then I'll rebuild day-by-day."
          : isAce
            ? "I couldn't finish that travel plan just now. Share destination and business vs leisure, and I'll try again."
            : "I couldn't finish mapping those days just now, gorgeous. Tell me where you're heading and whether it's business or pleasure — then I'll rebuild day-by-day.";
      } else if (
        /\b(create|build|put together|make)\b.{0,40}\b(outfit|look)\b/i.test(String(lastOutboundPromptRef.current || text || ''))
        || /\bfrom my (wardrobe|closet|mobile|phone)\b/i.test(String(lastOutboundPromptRef.current || text || ''))
      ) {
        // Wardrobe create-outfit: never leave the user on a opaque persona snag.
        errorContent = isMale
          ? "I couldn't lock a look from your wardrobe just now. Try once more — or name a piece you want to wear and I'll rebuild around it."
          : isAce
            ? "I couldn't lock a look from your wardrobe just now. Try once more, or name a piece to build around."
            : "I couldn't lock a look from your wardrobe just now, gorgeous. Try once more — or name a piece you want to wear and I'll rebuild around it.";
      } else if (
        isWardrobeOutfitRefineAsk(String(lastOutboundPromptRef.current || text || ''))
      ) {
        errorContent = isMale
          ? "I couldn't lock another option just now. Try once more — or tell me which piece to keep."
          : isAce
            ? "I couldn't lock another option just now. Please try again, or name a piece to keep."
            : "I couldn't lock another option just now, gorgeous. Try once more — or tell me which piece to keep.";
      } else {
        errorContent = isMale
          ? "Hey, I hit a snag answering that. Give it another shot in a moment — I'll be right here."
          : isAce
            ? "I hit a snag answering that. Please try again in a moment — I'll be here."
            : "Oh darling, I hit a snag answering that. Give it another try in just a moment, gorgeous — I'll be right here waiting!";
      }

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: errorContent,
        timestamp: new Date().toISOString(),
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      setIsTyping(false);

      await saveChatHistory(finalMessages);

      setTimeout(() => {
        scrollChatToEnd(true);
      }, 100);
    }
  };
  sendMessageRef.current = sendMessage;
  
  useEffect(() => {
    if (route.params?.initialPrompt) {
      pendingInitialPromptRef.current = route.params.initialPrompt;
      initialPromptSentRef.current = false;
    }
    if (route.params?.decisionContinuity) {
      decisionContinuityRef.current = route.params.decisionContinuity;
      pendingSoftContinuityRef.current = null;
      setContinuityBanner(route.params.decisionContinuity.flow);
      setContinuityNeedsConfirm(false);
    }
  }, [route.params?.initialPrompt, route.params?.decisionContinuity]);

  // Keep length ref in sync for scrollToIndex (avoids stale closure in scroll helper).
  useEffect(() => {
    messagesLenRef.current = messages.length;
    if (messages.length > 0 && stickToLatestRef.current) {
      scrollChatToEnd(false, false);
    }
  }, [messages.length, scrollChatToEnd]);

  // When the keyboard rises, re-stick only if the user is still following the live thread.
  useEffect(() => {
    if (!isKeyboardVisible || chatMode !== 'text') return;
    if (chatMachineRef.current.scroll === 'USER_SCROLLING') return;
    stickToLatestRef.current = true;
    scrollChatToEnd(false, false);
  }, [isKeyboardVisible, keyboardHeightPx, chatMode, scrollChatToEnd]);

  useEffect(() => {
    if (!isTyping) return;
    // Typing must not steal ownership after the user scrolled into history.
    if (chatMachineRef.current.scroll === 'USER_SCROLLING') return;
    if (!stickToLatestRef.current) return;
    scrollChatToEnd(false, false);
  }, [isTyping, scrollChatToEnd]);

  useEffect(() => {
    const prompt = pendingInitialPromptRef.current;
    if (!prompt || !limitsLoaded || initialPromptSentRef.current) return;
    initialPromptSentRef.current = true;
    pendingInitialPromptRef.current = undefined;
    sendMessage(prompt);
  }, [limitsLoaded, route.params?.initialPrompt]);

  const handleQuickPrompt = (prompt: string) => {
    sendMessage(prompt);
  };

  const handleOccasionOutfitGenerate = async (occasionId: OutfitOccasionId) => {
    if (!canSendMessage() || generatingOccasionId) return;

    const label = getOccasionLabel(occasionId);
    const userText = `Create a ${label.toLowerCase()} outfit from my wardrobe`;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: userText,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setShowQuickPrompts(false);
    setGeneratingOccasionId(occasionId);
    setIsTyping(true);

    await incrementDailyMessages();

    setTimeout(() => {
      scrollChatToEnd(true);
    }, 100);

    try {
      const recentIdLists = extractRecentOutfitIdLists(messages, 5);
      const priorOutfits = recentIdLists
        .map((ids) => ids
          .map((id) => wardrobeItems.find((item) => String(item.id) === String(id)))
          .filter((item): item is WardrobeItem => Boolean(item)))
        .filter((look) => look.length >= 2);

      const generated = await generateWardrobeOutfit({
        occasionType: occasionId,
        wardrobeItems,
        stylistId: stylist.id,
        saveToCalendar: false,
        user,
        priorOutfits,
      });

      const content = generated.stylistMessage
        || `Here's your ${label.toLowerCase()} — styled from pieces you already own.`;

      const wardrobeVisual = wardrobeVisualFromOutfitSuggestion(generated.items);
      const cappedVisual = wardrobeVisual
        ? capWardrobeVisualForAccess(wardrobeVisual, user?.subscriptionTier)
        : null;

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content,
        timestamp: new Date().toISOString(),
        wardrobeVisual: cappedVisual ?? undefined,
        visualAuthority: 'server',
        hasOutfitRecommendation: Boolean(generated.items.length),
        outfitSuggestion: generated.items.length
          ? { items: generated.items, occasion: label, reason: '' }
          : undefined,
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      await saveChatHistory(finalMessages);

      if (voiceSettings.autoPlayResponses && ttsEnabled) {
        playTTSAudio(content);
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error: unknown) {
      const message = error instanceof Error
        ? error.message
        : 'Unable to generate outfit. Please try again.';
      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: message,
        timestamp: new Date().toISOString(),
      };
      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      await saveChatHistory(finalMessages);
    } finally {
      setGeneratingOccasionId(null);
      setIsTyping(false);
      setTimeout(() => {
        scrollChatToEnd(true);
      }, 100);
    }
  };

  const handleWeatherOutfitGenerate = async () => {
    if (!canSendMessage() || generatingOccasionId) return;

    const label = t('aiStylist.weatherLook') || 'Weather look';
    const userText = t('aiStylist.promptWeatherLook') || 'Create a weather look outfit from my wardrobe';

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: userText,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setShowQuickPrompts(false);
    setGeneratingOccasionId(WEATHER_CHIP_ID);
    setIsTyping(true);

    await incrementDailyMessages();

    setTimeout(() => {
      scrollChatToEnd(true);
    }, 100);

    let weatherData: { temperature: number; condition: string } | null = null;
    try {
      const permission = await weatherService.checkPermissionStatus();
      if (!permission.granted && permission.canAskAgain) {
        await weatherService.requestPermission();
      }
      const currentWeather = await weatherService.getWeatherForOutfits();
      if (currentWeather) {
        weatherData = {
          temperature: currentWeather.temperature,
          condition: currentWeather.condition,
        };
      }
    } catch {
      // Non-blocking — still generate a look without live weather.
    }

    try {
      const recentIdLists = extractRecentOutfitIdLists(messages, 5);
      const priorOutfits = recentIdLists
        .map((ids) => ids
          .map((id) => wardrobeItems.find((item) => String(item.id) === String(id)))
          .filter((item): item is WardrobeItem => Boolean(item)))
        .filter((look) => look.length >= 2);

      const generated = await generateWardrobeOutfit({
        occasionType: 'casual_day',
        wardrobeItems,
        stylistId: stylist.id,
        saveToCalendar: false,
        user,
        weather: weatherData,
        priorOutfits,
      });

      const weatherSuffix = weatherData
        ? ` for ${weatherData.temperature}° and ${weatherData.condition} conditions`
        : '';
      const content = generated.stylistMessage
        || `Here's your ${label.toLowerCase()}${weatherSuffix} — styled from pieces you already own.`;

      const wardrobeVisual = wardrobeVisualFromOutfitSuggestion(generated.items);
      const cappedVisual = wardrobeVisual
        ? capWardrobeVisualForAccess(wardrobeVisual, user?.subscriptionTier)
        : null;

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content,
        timestamp: new Date().toISOString(),
        wardrobeVisual: cappedVisual ?? undefined,
        visualAuthority: 'server',
        hasOutfitRecommendation: Boolean(generated.items.length),
        outfitSuggestion: generated.items.length
          ? { items: generated.items, occasion: label, reason: '' }
          : undefined,
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      await saveChatHistory(finalMessages);

      if (voiceSettings.autoPlayResponses && ttsEnabled) {
        playTTSAudio(content);
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error: unknown) {
      const message = error instanceof Error
        ? error.message
        : 'Unable to generate outfit. Please try again.';
      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: message,
        timestamp: new Date().toISOString(),
      };
      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      await saveChatHistory(finalMessages);
    } finally {
      setGeneratingOccasionId(null);
      setIsTyping(false);
      setTimeout(() => {
        scrollChatToEnd(true);
      }, 100);
    }
  };

  const handleQuickFeedback = async (messageId: string, messageContent: string, helpful: boolean) => {
    try {
      setMessageFeedback(prev => ({ ...prev, [messageId]: helpful ? 'helpful' : 'not_helpful' }));
      
      await apiService.submitQuickFeedback({
        helpful,
        stylistUsed: stylist.id,
        context: messageContent.substring(0, 200),
      });

      if (!helpful) {
        setFeedbackMessageId(messageId);
        setFeedbackMessageContent(messageContent);
        setShowFeedbackModal(true);
      }
    } catch (error) {
      console.log('Feedback submission error:', error);
    }
  };

  const handleDetailedFeedback = async (feedbackType: 'helpful' | 'not_helpful' | 'too_western' | 'not_my_style' | 'loved_it' | 'body_type_mismatch' | 'cultural_miss') => {
    if (!feedbackMessageId) return;
    
    try {
      await apiService.submitDetailedFeedback({
        recommendationType: 'chat',
        stylistUsed: stylist.id,
        aiResponse: feedbackMessageContent.substring(0, 500),
        userRating: feedbackType === 'loved_it' ? 5 : feedbackType === 'helpful' ? 4 : 2,
        feedbackType,
        contextGiven: '',
        wasUseful: feedbackType === 'loved_it' || feedbackType === 'helpful',
      });
      
      setShowFeedbackModal(false);
      setFeedbackMessageId(null);
      setFeedbackMessageContent('');
    } catch (error) {
      console.log('Detailed feedback error:', error);
      setShowFeedbackModal(false);
    }
  };
  
  const clearChat = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const stylistId = String(stylist.id || '').trim().toLowerCase();
    const greeting = buildSeedGreeting();
    const greetingMessage: ChatMessage = {
      id: SEED_MESSAGE_ID,
      role: 'assistant',
      content: greeting,
      timestamp: new Date().toISOString(),
    };

    // Tombstone first: if remount races DELETE, server hydrate must not resurrect.
    const tombstone = buildStylistChatClearedTombstone(stylistId);
    await AsyncStorage.setItem(
      STYLIST_CHAT_CLEARED_TOMBSTONE_KEY,
      JSON.stringify(tombstone),
    ).catch(() => {});

    setMessages([greetingMessage]);
    setShowQuickPrompts(true);
    rememberChatMessages([greetingMessage], true);
    setComposerText('');
    writeComposerDraft(stylist.id, '');
    await AsyncStorage.removeItem(CHAT_STORAGE_KEY);
    await AsyncStorage.removeItem(PENDING_STYLIST_RETRY_KEY).catch(() => {});
    await releaseDecisionContinuity();

    try {
      // Canonical conversation is chat_messages(userId, stylist) — not multi-thread.
      await apiService.clearChatHistory(stylistId);
      await AsyncStorage.removeItem(STYLIST_CHAT_CLEARED_TOMBSTONE_KEY).catch(() => {});
    } catch (err) {
      // Keep tombstone so tab-away/return cannot rehydrate the discarded thread.
      console.warn('[StylistFreshThread] clearChat server delete failed', err);
    }
  };
  
  const copyChatMessage = useCallback(async (content: string) => {
    const text = String(content || '').trim();
    if (!text) return;
    try {
      await Clipboard.setStringAsync(text);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      // No Alert — WhatsApp-style: silent copy for a11y / explicit Copy action.
    } catch {
      // Selection copy is primary; fail quietly for a11y fallback.
    }
  }, []);

  const resolveAssistantWardrobeVisual = (message: ChatMessage, _messageIndex: number) => {
    let visual = hydrateWardrobeVisualImagesByIds(
      normalizeWardrobeVisual(message.wardrobeVisual),
      wardrobeItems,
    );

    // Allocator / occasion chip paths already supply ID-backed pieces via outfitSuggestion.
    // Failed solver: never rebuild a strip from the leaked working set.
    if (!visual && message.hasOutfitRecommendation !== false && message.outfitSuggestion?.items?.length) {
      visual = normalizeWardrobeVisual(
        wardrobeVisualFromOutfitSuggestion(message.outfitSuggestion.items),
      );
    }

    return visual;
  };

  const renderOutfitSaveActions = (
    message: ChatMessage,
    pieceIds: string[],
    titleOverride?: string,
  ) => {
    if (pieceIds.length < 2) return null;
    return (
      <OutfitSaveActions
        wardrobeItemIds={pieceIds}
        defaultTitle={titleOverride || message.outfitSuggestion?.occasion || 'My Outfit'}
        defaultDescription={message.content}
        occasion={occasionSlugFromLabel(message.outfitSuggestion?.occasion)}
      />
    );
  };

  const renderWardrobeVisual = (message: ChatMessage, label = 'From your wardrobe') => {
    // Always re-hydrate by ID so server soft-missing images still show local thumbnails.
    const visual = hydrateWardrobeVisualImagesByIds(
      normalizeWardrobeVisual(message.wardrobeVisual),
      wardrobeItems,
    );
    if (!visual) {
      if (message.hasOutfitRecommendation === false) return null;
      const legacyItems = message.outfitSuggestion?.items;
      if (!legacyItems?.length) return null;
      const legacyVisual = wardrobeVisualFromOutfitSuggestion(legacyItems);
      if (!legacyVisual) return null;
      return renderWardrobeVisual({ ...message, wardrobeVisual: legacyVisual }, label);
    }

    // Full wardrobe looks need no "100% match" badge — that is assumed.
    // Only surface a match line when coverage is partial (user may need to buy).
    // Always keep an occasion-aware title (Dinner look / Today's outfit) — never blank
    // "From your wardrobe" or hidden label on publishable wardrobe cards.
    const score = typeof visual.matchScore === 'number' ? Math.round(visual.matchScore) : null;
    let displayLabel: string | null = null;
    if (visual.source === 'wardrobe' && score != null && score < 95) {
      displayLabel = (
        t('aiStylist.wardrobePartialMatchCaption')
        || 'Partly from your wardrobe · {score}% — you may need a piece'
      ).replace('{score}', String(score));
    } else if (label && !/^from your wardrobe$/i.test(String(label).trim())) {
      displayLabel = label;
    } else if (label) {
      displayLabel = label;
    }

    if (visual.layout === 'highlight' && visual.pieces?.length === 1) {
      const piece = visual.pieces[0];
      if (!piece || typeof piece !== 'object') return null;
      const wardrobeItem = wardrobeItems.find((item) => String(item.id) === String(piece.wardrobeItemId));
      const serverImageUrl = normalizeRemoteApiUrl(piece.imageUrl) || piece.imageUrl;
      let displayItem: WardrobeItem | null = wardrobeItem ? enrichWardrobeItemForDisplay(wardrobeItem) as WardrobeItem : null;

      if (displayItem && !resolveWardrobeImageUri(displayItem) && serverImageUrl) {
        displayItem = {
          ...displayItem,
          imageUri: serverImageUrl,
          enhancedImageUri: serverImageUrl,
          imageProcessed: true,
        };
      }

      if (!displayItem && serverImageUrl) {
        displayItem = {
          id: String(piece.wardrobeItemId || piece.name),
          userId: '',
          imageUri: serverImageUrl,
          enhancedImageUri: serverImageUrl,
          imageProcessed: true,
          category: 'tops',
          color: 'multicolor',
          name: piece.name || 'Item',
          seasons: ['all-season'],
          occasions: ['everyday'],
          timesWorn: 0,
          isFavorite: false,
          createdAt: '',
          updatedAt: '',
        };
      }

      if (!displayItem) return null;

      return (
        <RenderErrorBoundary fallbackMessage="Outfit preview unavailable">
          <View style={styles.wardrobeVisualBlock}>
            <View style={[styles.outfitDivider, { backgroundColor: theme.border }]} />
            {displayLabel ? (
              <ThemedText style={styles.wardrobeVisualLabel}>{displayLabel}</ThemedText>
            ) : null}
            <View style={[styles.wardrobeHighlightFrame, { backgroundColor: isDark ? 'rgba(255,255,255,0.96)' : '#FFFFFF' }]}>
              <WardrobeItemImage
                item={displayItem}
                style={styles.wardrobeHighlightImage}
                processed
                contentFit="contain"
                preferCover={false}
              />
            </View>
            <ThemedText style={styles.wardrobeVisualName}>
              {editorialGarmentName(piece.name || '', { brand: piece.brand })}
            </ThemedText>
          </View>
        </RenderErrorBoundary>
      );
    }

    const safePieces = sanitizeOutfitPieces(visual.pieces ?? [], { log: true });
    if (!safePieces.length) return null;

    return (
      <RenderErrorBoundary fallbackMessage="Outfit preview unavailable">
        <View style={styles.wardrobeVisualBlock}>
          <View style={[styles.outfitDivider, { backgroundColor: theme.border }]} />
          {displayLabel ? (
            <ThemedText style={styles.wardrobeVisualLabel}>{displayLabel}</ThemedText>
          ) : null}
          <SafeOutfitPieces
            pieces={safePieces}
            wardrobeItems={wardrobeItems}
            label=""
            large
            canvasWidth={WARDROBE_CHAT_CANVAS_WIDTH}
          />
          {renderOutfitSaveActions(message, wardrobeIdsFromPieces(safePieces))}
        </View>
      </RenderErrorBoundary>
    );
  };

  const renderAssistantContent = (message: ChatMessage, messageIndex: number) => {
    try {
    // Prior user turn for strip label inference — must be declared (ReferenceError
    // here was swallowed by the catch below and forced text-only, dropping strips).
    const priorUser =
      messageIndex > 0 && messages[messageIndex - 1]?.role === 'user'
        ? messages[messageIndex - 1]
        : undefined;

    const outfitCount = inferOutfitCountFromText(message.content);

    let visual = hydrateWardrobeVisualImagesByIds(
      normalizeWardrobeVisual(message.wardrobeVisual),
      wardrobeItems,
    );

    if (!visual && message.hasOutfitRecommendation !== false && message.outfitSuggestion?.items?.length) {
      visual = normalizeWardrobeVisual(
        wardrobeVisualFromOutfitSuggestion(message.outfitSuggestion.items),
      );
    }

    const renderOutfitVisual = (
      outfit: NonNullable<WardrobeVisualPayload['outfits']>[number],
      fallbackLabel: string,
      parentMessage: ChatMessage,
    ) => {
      const safePieces = sanitizeOutfitPieces(outfit?.pieces, { log: true });
      if (!safePieces.length) return null;
      const outfitLabel = outfit.title || fallbackLabel;

      if (safePieces.length === 1) {
        const piece = safePieces[0];
        const wardrobeItem = wardrobeItems.find((item) => String(item.id) === String(piece.wardrobeItemId));
        const displayItem: WardrobeItem | null = wardrobeItem || (piece.imageUrl ? {
          id: String(piece.wardrobeItemId || piece.name),
          userId: '',
          imageUri: piece.imageUrl,
          enhancedImageUri: piece.imageUrl,
          imageProcessed: true,
          category: 'tops',
          color: 'multicolor',
          name: piece.name || 'Item',
          seasons: ['all-season'],
          occasions: ['everyday'],
          timesWorn: 0,
          isFavorite: false,
          createdAt: '',
          updatedAt: '',
        } : null);

        if (!displayItem) return null;

        return (
          <RenderErrorBoundary fallbackMessage="Outfit preview unavailable">
            <View style={styles.wardrobeVisualBlock}>
              <ThemedText style={styles.wardrobeVisualLabel}>{outfitLabel}</ThemedText>
              <View style={[styles.wardrobeHighlightFrame, { backgroundColor: isDark ? 'rgba(255,255,255,0.96)' : '#FFFFFF' }]}>
                <WardrobeItemImage
                  item={displayItem}
                  style={styles.wardrobeHighlightImage}
                  processed
                  contentFit="contain"
                  preferCover={false}
                />
              </View>
              <ThemedText style={styles.wardrobeVisualName}>
              {editorialGarmentName(piece.name || '', { brand: piece.brand })}
            </ThemedText>
            </View>
          </RenderErrorBoundary>
        );
      }

      return (
        <RenderErrorBoundary fallbackMessage="Outfit preview unavailable">
          <View style={styles.wardrobeVisualBlock}>
            <SafeOutfitPieces
              pieces={safePieces}
              wardrobeItems={wardrobeItems}
              label={outfitLabel}
              large
              canvasWidth={WARDROBE_CHAT_CANVAS_WIDTH}
            />
            {renderOutfitSaveActions(parentMessage, wardrobeIdsFromPieces(safePieces), outfitLabel)}
          </View>
        </RenderErrorBoundary>
      );
    };

    if (visual?.layout === 'multi' && visual.outfits && visual.outfits.length >= 2) {
      const rankedCards = buildRankedLookCards({
        outfits: visual.outfits,
        looks: message.looks,
        content: message.content,
      });

      if (rankedCards.length >= 2) {
        return (
          <RenderErrorBoundary fallbackMessage="Outfit preview unavailable">
            <RankedMultiLookCards
              content={message.content}
              userMessage={priorUser?.content || message.styleSession?.userMessage || ''}
              styleSession={message.styleSession || null}
              wardrobeVisual={visual}
              wardrobeItems={wardrobeItems}
              looks={message.looks}
              messageId={message.id}
              canvasWidth={WARDROBE_CHAT_CANVAS_WIDTH}
              occasion={
                message.styleSession?.occasion
                || occasionSlugFromLabel(message.outfitSuggestion?.occasion)
                || 'casual'
              }
            />
          </RenderErrorBoundary>
        );
      }

      const sections = splitIntoOutfitSections(message.content);
      const outfitBySection = new Map(
        visual.outfits.map((outfit) => [outfit.sectionIndex, outfit]),
      );
      const canInterleave = sections.length >= 2
        && visual.outfits.some((outfit) => outfitBySection.has(outfit.sectionIndex));

      if (canInterleave) {
        return (
          <>
            {sections.map((section, sectionIndex) => {
              const outfit = outfitBySection.get(sectionIndex);
              const outfitNumber = outfit
                ? visual.outfits!.findIndex((entry) => entry.sectionIndex === sectionIndex) + 1
                : 0;

              return (
                <View key={`section-${sectionIndex}`} style={sectionIndex > 0 ? styles.outfitSectionGap : undefined}>
                  <ChatSelectableText
                    text={section}
                    style={[styles.messageText, { color: theme.text }]}
                  />
                  {outfit ? renderOutfitVisual(outfit, `Outfit ${outfitNumber}`, message) : null}
                </View>
              );
            })}
          </>
        );
      }

      return (
        <>
          <ChatSelectableText
            text={message.content}
            style={[styles.messageText, { color: theme.text }]}
          />
          {visual.outfits.map((outfit, index) => (
            <View key={`outfit-${outfit.sectionIndex}-${index}`}>
              {renderOutfitVisual(outfit, `Outfit ${index + 1}`, message)}
            </View>
          ))}
        </>
      );
    }

    if (outfitCount >= 2 && visual?.layout !== 'multi' && !(visual?.pieces?.length)) {
      return (
        <ChatSelectableText
          text={message.content}
          style={[styles.messageText, { color: theme.text }]}
        />
      );
    }

    const sections = splitIntoOutfitSections(message.content);
    const isSingleOutfitWithFollowUp =
      visual
      && visual.layout !== 'multi'
      && (visual.pieces?.length ?? 0) > 0
      && sections.length >= 2
      && outfitCount < 2;

    if (isSingleOutfitWithFollowUp) {
      return (
        <>
          <ChatSelectableText
            text={sections[0]}
            style={[styles.messageText, { color: theme.text }]}
          />
          {renderWardrobeVisual(
            { ...message, wardrobeVisual: visual },
            inferWardrobeVisualLabel(priorUser?.content || ''),
          )}
          {sections.slice(1).map((section, sectionIndex) => (
            <ChatSelectableText
              key={`follow-up-${sectionIndex}`}
              text={section}
              style={[styles.messageText, { color: theme.text }]}
            />
          ))}
        </>
      );
    }

    return (
      <>
        {renderWardrobeVisual(
          { ...message, wardrobeVisual: visual },
          inferWardrobeVisualLabel(priorUser?.content || ''),
        )}
        <ChatSelectableText
          text={message.content}
          style={[styles.messageText, { color: theme.text }]}
        />
      </>
    );
    } catch (renderErr) {
      logInvalidRender('render_boundary', {
        message: renderErr instanceof Error ? renderErr.message : String(renderErr),
      }, { surface: 'AIStylist.renderAssistantContent' });
      console.warn('[AIStylist] renderAssistantContent soft-fallback (text + SoftRenderFallback):', renderErr);
      return (
        <>
          <ChatSelectableText
            text={typeof message?.content === 'string' ? message.content : ''}
            style={[styles.messageText, { color: theme.text }]}
          />
          <SoftRenderFallback message="Outfit preview unavailable" />
        </>
      );
    }
  };

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isUser = item.role === 'user';
    
    return (
      <View
        style={[
          styles.messageContainer,
          isUser ? styles.userMessageContainer : styles.assistantMessageContainer,
          !isUser
            && index > 0
            && !messageShowsOutfitSaveActions(item)
            && !visualShowsOutfitSaveActions(resolveAssistantWardrobeVisual(item, index))
            ? styles.assistantMessageWithFeedback
            : null,
        ]}
      >
        {!isUser ? (
          <LinearGradient
            colors={stylist.id === 'ruby' ? [LUXURY_COLORS.rose, LUXURY_COLORS.berry] : stylist.id === 'max' ? [LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet] : stylist.id === 'ace' ? [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold] : [LUXURY_COLORS.coral, '#C46A4F']}
            style={styles.avatarContainer}
          >
            <ThemedText
              style={[
                styles.avatarInitial,
                { color: stylist.id === 'ace' ? LUXURY_COLORS.midnight : '#FFFFFF' },
              ]}
            >
              {stylistAvatarInitial(stylist.name)}
            </ThemedText>
          </LinearGradient>
        ) : null}
        
        <View
          accessibilityActions={[{ name: 'copy', label: 'Copy' }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'copy') {
              void copyChatMessage(item.content);
            }
          }}
          style={[
            styles.messageBubble,
            isUser 
              ? [styles.userBubble, { backgroundColor: theme.link }]
              : [
                  styles.assistantBubble,
                  { backgroundColor: theme.backgroundSecondary },
                  !isUser && messageHasWardrobeVisual(item) ? styles.messageBubbleWardrobe : null,
                ],
          ]}
        >
          {isUser ? (
            <ChatSelectableText
              text={item.content}
              inverted
              style={[styles.messageText, { color: '#FFFFFF' }]}
            />
          ) : (
            <>
              {renderAssistantContent(item, index)}
              {item.redirectToDecide || item.cta?.action === 'open_choosing_what_to_buy' ? (
                <Pressable
                  onPress={() => navigation.navigate('ChoosingWhatToBuy')}
                  style={({ pressed }) => [
                    styles.decideRedirectCta,
                    {
                      backgroundColor: stylist.color,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Feather name="shopping-bag" size={16} color="#FFFFFF" />
                  <ThemedText style={styles.decideRedirectCtaText}>
                    {item.cta?.label || t('stylistHub.choosingWhatToBuy') || 'Open Choosing what to buy'}
                  </ThemedText>
                </Pressable>
              ) : null}
              {((item.isFallback || item.isShopRequired) && item.missing?.length) ? (
                <View style={{ marginTop: Spacing.sm }}>
                  {item.missing.map((gap, gapIdx) => (
                    <ChatSelectableText
                      key={`gap-${gap.role || gapIdx}-${gap.label || gap.name || gapIdx}`}
                      text={`· ${gap.label || gap.name || gap.role || 'Upgrade'} · recommended`}
                      style={[styles.messageText, { color: theme.text, opacity: 0.8, marginBottom: 2 }]}
                    />
                  ))}
                  <FallbackShopSection
                    missing={item.missing}
                    headline={item.isShopRequired ? 'Shop this look' : 'Get the missing piece'}
                  />
                </View>
              ) : null}
            </>
          )}
          
          {(() => {
            const uris = (item.imageUris?.length ? item.imageUris : (item.imageUri ? [item.imageUri] : []))
              .filter(Boolean)
              .slice(0, 3);
            if (!uris.length) return null;
            return (
              <View style={styles.messageImageRow}>
                {uris.map((uri) => (
                  <Image
                    key={uri}
                    source={{ uri }}
                    style={[styles.messageImage, uris.length > 1 ? styles.messageImageMulti : null]}
                    resizeMode="cover"
                  />
                ))}
              </View>
            );
          })()}
          {item.isVisualizingOutfit && !(item.imageUri || item.imageUris?.length) ? (
            <View style={styles.visualizingOutfitRow}>
              <ActivityIndicator size="small" color={theme.link} />
              <ThemedText style={styles.visualizingOutfitText}>
                {t('aiStylist.visualizingOutfit') || 'Visualizing your outfit...'}
              </ThemedText>
            </View>
          ) : null}

        </View>
        
        {isUser ? (
          <LinearGradient
            colors={[LUXURY_COLORS.teal, LUXURY_COLORS.emerald]}
            style={styles.userAvatar}
          >
            <Feather name="user" size={16} color="#FFFFFF" />
          </LinearGradient>
        ) : null}
        
        {!isUser && index > 0 && !messageShowsOutfitSaveActions(item) && !visualShowsOutfitSaveActions(resolveAssistantWardrobeVisual(item, index)) ? (
          <View style={styles.feedbackContainer}>
            {messageFeedback[item.id] ? (
              <View style={styles.feedbackGiven}>
                <Feather 
                  name={messageFeedback[item.id] === 'helpful' ? 'thumbs-up' : 'thumbs-down'} 
                  size={14} 
                  color={messageFeedback[item.id] === 'helpful' ? LUXURY_COLORS.emerald : theme.tabIconDefault} 
                />
                <ThemedText style={[styles.feedbackText, { color: theme.tabIconDefault }]}>
                  {messageFeedback[item.id] === 'helpful' ? t('aiStylist.thanks') : t('aiStylist.noted')}
                </ThemedText>
              </View>
            ) : (
              <View style={styles.feedbackButtons}>
                <Pressable 
                  onPress={() => handleQuickFeedback(item.id, item.content, true)}
                  style={[styles.feedbackButton, { backgroundColor: theme.backgroundSecondary }]}
                >
                  <Feather name="thumbs-up" size={14} color={theme.tabIconDefault} />
                </Pressable>
                <Pressable 
                  onPress={() => handleQuickFeedback(item.id, item.content, false)}
                  style={[styles.feedbackButton, { backgroundColor: theme.backgroundSecondary }]}
                >
                  <Feather name="thumbs-down" size={14} color={theme.tabIconDefault} />
                </Pressable>
              </View>
            )}
          </View>
        ) : null}
      </View>
    );
  };

  const FEEDBACK_OPTIONS: Array<{ id: string; label: string; icon: string }> = [
    { id: 'not_my_style', label: t('aiStylist.notMyStyle'), icon: 'x-circle' },
    { id: 'too_western', label: t('aiStylist.tooWestern'), icon: 'globe' },
    { id: 'body_type_mismatch', label: t('aiStylist.didntFitBodyType'), icon: 'user-x' },
    { id: 'cultural_miss', label: t('aiStylist.culturalMismatch'), icon: 'flag' },
  ];

  const renderFeedbackModal = () => (
    <Modal
      visible={showFeedbackModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowFeedbackModal(false)}
    >
      <Pressable 
        style={styles.feedbackModalOverlay}
        onPress={() => setShowFeedbackModal(false)}
      >
        <View style={[styles.feedbackModalContent, { backgroundColor: theme.backgroundSecondary }]}>
          <ThemedText type="h3" style={styles.feedbackModalTitle}>
            {t('aiStylist.whatWasntRight')}
          </ThemedText>
          <ThemedText type="small" style={[styles.feedbackModalSubtitle, { color: theme.tabIconDefault }]}>
            {t('aiStylist.learnPreferences')}
          </ThemedText>
          
          <View style={styles.feedbackOptionsGrid}>
            {FEEDBACK_OPTIONS.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => handleDetailedFeedback(option.id as any)}
                style={[styles.feedbackOptionButton, { backgroundColor: theme.backgroundDefault }]}
              >
                <Feather name={option.icon as any} size={20} color={theme.link} />
                <ThemedText style={styles.feedbackOptionText}>{option.label}</ThemedText>
              </Pressable>
            ))}
          </View>
          
          <Pressable
            onPress={() => setShowFeedbackModal(false)}
            style={[styles.feedbackCancelButton, { borderColor: theme.border }]}
          >
            <ThemedText style={{ color: theme.tabIconDefault }}>{t('aiStylist.skip')}</ThemedText>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
  
  const renderQuickPrompts = () => (
    <View style={styles.quickPromptsContainer}>
      <ThemedText style={[styles.quickPromptsTitle, { color: theme.tabIconDefault }]}>
        {t('aiStylist.quickSuggestions')}
      </ThemedText>
      <View style={styles.quickPromptsGrid}>
        {quickPrompts.map((prompt) => (
          <Pressable
            key={prompt.id}
            onPress={() => handleQuickPrompt(prompt.prompt)}
            disabled={!canSendMessage()}
            accessibilityLabel={prompt.label}
            accessibilityRole="button"
            accessibilityHint={`Send message: ${prompt.prompt}`}
            style={({ pressed }) => [
              styles.quickPromptButton,
              { 
                backgroundColor: theme.backgroundSecondary,
                opacity: pressed ? 0.7 : canSendMessage() ? 1 : 0.5,
              },
            ]}
          >
            <Feather name={prompt.icon} size={16} color={canSendMessage() ? theme.link : theme.tabIconDefault} />
            <ThemedText style={[styles.quickPromptLabel, !canSendMessage() && { color: theme.tabIconDefault }]}>
              {prompt.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );
  
  const remainingMessages = getRemainingMessages();
  const limitReached = useMemo(
    () => limitsLoaded && !canSendMessage(),
    [limitsLoaded, messagesToday, limits.aiChatMessagesPerDay, bonusAIRequests, monthlyAllowanceExhausted],
  );

  // Tab bar hides while keyboard is open — reserve keyboard height instead so
  // the last messages stay above the sticky input (same idea as WhatsApp).
  const listBottomInset = useMemo(
    () =>
      INPUT_CONTAINER_HEIGHT
      + (limitReached ? LIMIT_HIT_BANNER_HEIGHT : 0)
      + (showQuickPrompts && !isTyping && messages.length <= 1 ? 160 : 0)
      + (isKeyboardVisible ? Math.max(0, keyboardHeightPx) : tabBarHeight)
      + Spacing.md,
    [
      limitReached,
      showQuickPrompts,
      isTyping,
      messages.length,
      tabBarHeight,
      isKeyboardVisible,
      keyboardHeightPx,
    ],
  );

  // When the limit banner appears, nudge the list so the last reply clears it.
  useEffect(() => {
    if (!limitReached) return;
    const t = setTimeout(() => scrollChatToEnd(true, false), 80);
    return () => clearTimeout(t);
  }, [limitReached, scrollChatToEnd]);
  
  // Memoize upgrade teaser values to prevent flickering on every keystroke
  const upgradeTeaserData = useMemo(() => {
    if (monthlyAllowanceExhausted && chatMode !== 'voice') {
      const paywall = getAiAllowancePaywallCopy(tier);
      return {
        showWarning: true,
        showTeaser: true,
        teaserTitle: paywall.title,
        teaserMsg: paywall.message,
        teaserIcon: 'heart' as const,
        teaserCta: (paywall.primaryAction === 'topup' ? 'topup' : 'upgrade') as const,
        teaserButtonLabel: paywall.primaryLabel,
      };
    }

    if (aiAllowanceSoftWarn && chatMode !== 'voice' && !monthlyAllowanceExhausted) {
      const paywall = getAiAllowancePaywallCopy(tier);
      return {
        showWarning: true,
        showTeaser: true,
        teaserTitle: paywall.softTitle,
        teaserMsg: paywall.softMessage,
        teaserIcon: 'zap' as const,
        teaserCta: (paywall.primaryAction === 'topup' ? 'topup' : 'upgrade') as const,
        teaserButtonLabel: paywall.primaryLabel,
      };
    }

    // Voice mode: show spoken-reply usage (more relevant than text-chat daily limit)
    if (chatMode === 'voice') {
      // Balance fetch failed — never treat unknown remaining as exhausted (0 + top-up)
      if (voiceBalanceError) {
        return {
          showWarning: false,
          showTeaser: !voiceCreditsLoading,
          teaserTitle: t('aiStylist.voiceBalanceLoadFailed') || "Couldn't load spoken-reply balance",
          teaserMsg:
            voiceDenialMessage ||
            "Couldn't load your spoken-reply balance. Check your connection and try again.",
          teaserIcon: 'mic' as const,
          teaserCta: 'retry' as const,
          teaserButtonLabel: t('common.retry') || 'Retry',
        };
      }
      if (voiceCreditsLoading || !voiceBalanceReady) {
        return {
          showWarning: false,
          showTeaser: false,
          teaserTitle: '',
          teaserMsg: '',
          teaserIcon: 'mic' as const,
          teaserCta: 'topup' as const,
          teaserButtonLabel: '',
        };
      }

      const allowance = voiceCreditsBalance?.monthlyAllowance ?? 0;
      const remaining = voiceRemainingCredits;
      const used = Math.max(
        0,
        Number(voiceCreditsBalance?.usedThisMonth ?? Math.max(0, allowance - remaining)),
      );

      // Only surface the big counter/upsell here when the monthly tier allowance is gone.
      // Ongoing usage lives on Profile — keep voice mode feeling unmonitored.
      if (weekendUnlimitedActive || remaining > 0) {
        return {
          showWarning: false,
          showTeaser: false,
          teaserTitle: '',
          teaserMsg: '',
          teaserIcon: 'mic' as const,
          teaserCta: 'topup' as const,
          teaserButtonLabel: '',
        };
      }

      const teaserTitle =
        allowance > 0
          ? (t('aiStylist.voiceRepliesUsedUp') || "This month's spoken replies are used up")
          : (t('aiStylist.voiceRepliesThisMonth') || '{used}/{allowance} voice replies this month')
              .replace('{used}', String(used))
              .replace('{allowance}', String(Math.max(allowance, used)));

      const teaserMsg = (t('aiStylist.voiceUnlockMore') ||
        'Add a voice pack so {name} can keep speaking with you. Text chat still uses your monthly AI allowance.')
        .replace('{name}', stylist.name);

      return {
        showWarning: false,
        showTeaser: true,
        teaserTitle,
        teaserMsg,
        teaserIcon: 'heart' as const,
        teaserCta: 'topup' as const,
        teaserButtonLabel: t('voiceCredits.buyTitle') || 'Buy Voice Package',
      };
    }

    const showWarning = remainingMessages !== Infinity && remainingMessages <= 3;
    const showTeaser = remainingMessages !== Infinity && remainingMessages <= 10 && tier === 'free';
    
    let teaserTitle = (t('aiStylist.messagesRemainingToday') || '{count} messages remaining today')
      .replace('{count}', String(remainingMessages));
    let teaserMsg = (t('aiStylist.unlockUnlimitedConversations') || 'Upgrade to Personal Stylist for a bigger monthly AI pot with {name}.')
      .replace('{name}', stylist.name);
    let teaserIcon: 'star' | 'heart' | 'zap' | 'mic' = 'star';
    
    if (remainingMessages === 0) {
      teaserTitle = t('aiStylist.dontLeaveConversation') || "Don't leave the conversation here!";
      teaserMsg = (t('aiStylist.upgradeForUnlimited') || '{name} has so much more to share with you. Upgrade for a bigger monthly AI pot.')
        .replace('{name}', stylist.name);
      teaserIcon = 'heart';
    } else if (remainingMessages <= 3) {
      teaserTitle = (
        remainingMessages === 1
          ? (t('aiStylist.onlyMessagesLeft') || 'Only {count} message left today')
          : (t('aiStylist.onlyMessagesLeftPlural') || 'Only {count} messages left today')
      ).replace('{count}', String(remainingMessages));
      teaserMsg = (t('aiStylist.lovingChatUpgrade') || 'Loving your chat with {name}? Upgrade to keep the style advice flowing.')
        .replace('{name}', stylist.name);
      teaserIcon = 'zap';
    }
    
    return {
      showWarning,
      showTeaser,
      teaserTitle,
      teaserMsg,
      teaserIcon,
      teaserCta: 'upgrade' as const,
      teaserButtonLabel: t('aiStylist.upgradeNow') || 'Upgrade Now',
    };
  }, [
    chatMode,
    remainingMessages,
    tier,
    stylist.name,
    t,
    monthlyAllowanceExhausted,
    aiAllowanceSoftWarn,
    voiceCreditsBalance?.usedThisMonth,
    voiceCreditsBalance?.monthlyAllowance,
    voiceRemainingCredits,
    voiceCreditsLoading,
    voiceBalanceError,
    voiceBalanceReady,
    voiceDenialMessage,
    weekendUnlimitedActive,
  ]);
  
  const { showLimitWarning, showUpgradeTeaser } = {
    showLimitWarning: upgradeTeaserData.showWarning,
    showUpgradeTeaser: upgradeTeaserData.showTeaser,
  };
  
  const getMoodInfo = (): MoodInfo | null => {
    if (!detectedMood) return null;
    return MOOD_CONFIG[detectedMood] || null;
  };

  const moodInfo = getMoodInfo();

  const stylistGradient = useMemo((): readonly [string, string] => {
    switch (stylist.id) {
      case 'ruby':
        return [LUXURY_COLORS.rose, LUXURY_COLORS.berry] as const;
      case 'max':
        return [LUXURY_COLORS.violet, LUXURY_COLORS.deepViolet] as const;
      case 'ace':
        return [LUXURY_COLORS.gold, LUXURY_COLORS.deepGold] as const;
      default:
        return [LUXURY_COLORS.coral, '#C46A4F'] as const;
    }
  }, [stylist.id]);

  const renderHeader = () => (
    <View style={styles.headerContent}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <LinearGradient
            colors={stylistGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.stylistIcon}
          >
            <ThemedText
              style={[
                styles.headerAvatarInitial,
                { color: stylist.id === 'ace' ? LUXURY_COLORS.midnight : '#FFFFFF' },
              ]}
            >
              {stylistAvatarInitial(stylist.name)}
            </ThemedText>
          </LinearGradient>
          <View>
            <View style={styles.headerTitleRow}>
              <ThemedText style={styles.headerTitle}>{stylist.name}</ThemedText>
              {moodInfo ? (
                <Animated.View 
                  entering={FadeIn.duration(300)}
                  style={[styles.moodBadge, { backgroundColor: moodInfo.color + '20' }]}
                >
                  <Feather name={moodInfo.icon} size={10} color={moodInfo.color} />
                  <ThemedText style={[styles.moodBadgeText, { color: moodInfo.color }]}>
                    {moodInfo.label}
                  </ThemedText>
                </Animated.View>
              ) : null}
            </View>
            <ThemedText style={[styles.headerSubtitle, { color: theme.tabIconDefault }]}>
              {chatMode === 'voice'
                ? (t('aiStylist.voiceModeLabel') || 'Voice mode — spoken replies')
                : (t('aiStylist.chatModeLabel') || 'Stylist Chat')}
            </ThemedText>
          </View>
        </View>
        
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => setChatMode((m) => (m === 'text' ? 'voice' : 'text'))}
            style={[styles.ttsButton, chatMode === 'voice' && { backgroundColor: theme.link + '20' }]}
          >
            <Feather
              name={chatMode === 'voice' ? 'message-circle' : 'headphones'}
              size={20}
              color={chatMode === 'voice' ? theme.link : theme.tabIconDefault}
            />
          </Pressable>
          {chatMode === 'text' && (
            isPlayingTTS ? (
              <Pressable 
                onPress={stopTTSPlayback} 
                style={[styles.ttsButton, { backgroundColor: theme.link + '20' }]}
              >
                <ActivityIndicator size="small" color={theme.link} />
              </Pressable>
            ) : (
              <Pressable 
                onPress={() => setTtsEnabled(!ttsEnabled)} 
                style={styles.ttsButton}
              >
                <Feather 
                  name={ttsEnabled ? "volume-2" : "volume-x"} 
                  size={20} 
                  color={ttsEnabled ? theme.link : theme.tabIconDefault} 
                />
              </Pressable>
            )
          )}
          <Pressable onPress={clearChat} style={styles.clearButton}>
            <Feather name="refresh-cw" size={20} color={theme.tabIconDefault} />
          </Pressable>
        </View>
      </View>

      {continuityBanner ? (
        <View
          style={[
            styles.continuityBanner,
            { backgroundColor: theme.backgroundSecondary, borderColor: theme.border },
          ]}
        >
          <Feather name="git-branch" size={14} color={LUXURY_COLORS.gold} />
          <Pressable
            style={{ flex: 1 }}
            onPress={continuityNeedsConfirm ? confirmSoftContinuity : undefined}
            disabled={!continuityNeedsConfirm}
          >
            <ThemedText style={{ color: theme.tabIconDefault, fontSize: 12 }}>
              {continuityNeedsConfirm
                ? (
                  (t('stylistFlow.continuitySoftBanner')
                    || 'Recent {flow} — tap to continue in this chat')
                    .replace(
                      '{flow}',
                      continuityBanner === 'sanity-check'
                        ? 'Quick Sanity Check'
                        : continuityBanner === 'event-outfit'
                          ? 'Outfit for Event'
                          : continuityBanner === 'shopping'
                            ? 'Choosing What to Buy'
                            : continuityBanner,
                    )
                )
                : (
                  (t('stylistFlow.continuityBanner') || 'Continuing from {flow}').replace(
                    '{flow}',
                    continuityBanner === 'sanity-check'
                      ? 'Quick Sanity Check'
                      : continuityBanner === 'event-outfit'
                        ? 'Outfit for Event'
                        : continuityBanner === 'shopping'
                          ? 'Choosing What to Buy'
                          : continuityBanner,
                  )
                )}
            </ThemedText>
          </Pressable>
          <Pressable onPress={() => { void releaseDecisionContinuity(); }} hitSlop={8}>
            <Feather name="x" size={14} color={theme.tabIconDefault} />
          </Pressable>
        </View>
      ) : null}
      
      {showUpgradeTeaser ? (
        <View 
          key="upgrade-teaser-stable"
          style={[styles.upgradeTeaserCard]}
        >
          <LinearGradient
            colors={stylistGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.upgradeTeaserGradient}
          >
            <View style={styles.upgradeTeaserContent}>
              <View style={styles.upgradeTeaserIconContainer}>
                <Feather name={upgradeTeaserData.teaserIcon} size={24} color="#FFFFFF" />
              </View>
              <View style={styles.upgradeTeaserTextContainer}>
                <ThemedText style={styles.upgradeTeaserTitle}>{upgradeTeaserData.teaserTitle}</ThemedText>
                <ThemedText style={styles.upgradeTeaserMessage}>{upgradeTeaserData.teaserMsg}</ThemedText>
              </View>
            </View>
            <Pressable 
              onPress={() => {
                if (chatMode === 'voice') {
                  if (upgradeTeaserData.teaserCta === 'retry' || voiceBalanceError) {
                    void refreshVoiceCredits();
                  } else {
                    setShowVoiceCreditsModal(true);
                  }
                } else {
                  const action = upgradeTeaserData.teaserCta === 'topup' ? 'topup' : 'upgrade';
                  openAiAllowanceDestination(action);
                }
              }}
              style={({ pressed }) => [
                styles.upgradeTeaserButton,
                { opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <ThemedText style={styles.upgradeTeaserButtonText}>
                {upgradeTeaserData.teaserButtonLabel || t('aiStylist.upgradeNow') || 'Upgrade Now'}
              </ThemedText>
              <Feather name="arrow-right" size={16} color={stylistGradient[0]} />
            </Pressable>
          </LinearGradient>
        </View>
      ) : null}
      
    </View>
  );
  
  const getTypingMessage = () => {
    if (moodInfo) {
      return `${stylist.name} ${moodInfo.typingMessage}`;
    }
    return `${stylist.name} is styling...`;
  };

  const renderFooter = () => (
    <>
      {isTyping ? (
        <View style={styles.typingContainer}>
          <LinearGradient
            colors={stylistGradient}
            style={styles.avatarContainer}
          >
            <ThemedText
              style={[
                styles.avatarInitial,
                { color: stylist.id === 'ace' ? LUXURY_COLORS.midnight : '#FFFFFF' },
              ]}
            >
              {stylistAvatarInitial(stylist.name)}
            </ThemedText>
          </LinearGradient>
          <View style={[styles.typingBubble, { backgroundColor: theme.backgroundSecondary }]}>
            <ActivityIndicator size="small" color={stylistGradient[0]} />
            <ThemedText style={[styles.typingText, { color: theme.tabIconDefault }]}>
              {getTypingMessage()}
            </ThemedText>
          </View>
        </View>
      ) : null}
      <View style={{ height: Spacing.md }} />
    </>
  );

  const renderInputBar = () => {
    if (isRecording) {
      return (
        <View
          style={[
            styles.inputContainerWrapper,
            { 
              paddingBottom: Spacing.sm,
              backgroundColor: theme.backgroundDefault,
            }
          ]}
        >
          <View style={[styles.recordingContainer, { backgroundColor: theme.backgroundSecondary }]}>
            <Pressable
              onPress={() => stopRecording(true)}
              style={[styles.cancelRecordingButton, { backgroundColor: theme.backgroundTertiary }]}
            >
              <Feather name="x" size={20} color={theme.text} />
            </Pressable>

            <View style={styles.recordingInfo}>
              <View style={styles.waveformContainer}>
                {waveformBars.map((bar, index) => (
                  <WaveformBar
                    key={index}
                    bar={bar}
                    color={stylist.color}
                    style={styles.waveformBar}
                  />
                ))}
              </View>
              <ThemedText style={styles.recordingDuration}>
                {formatRecordingDuration(recordingDuration)}
              </ThemedText>
            </View>

            <Animated.View style={pulseAnimatedStyle}>
              <Pressable
                onPress={() => stopRecording(false)}
                style={[styles.stopRecordingButton, { backgroundColor: '#EF4444' }]}
              >
                <View style={styles.stopIcon} />
              </Pressable>
            </Animated.View>
          </View>
        </View>
      );
    }

    if (isTranscribing) {
      return (
        <View
          style={[
            styles.inputContainerWrapper,
            { 
              paddingBottom: Spacing.sm,
              backgroundColor: theme.backgroundDefault,
            }
          ]}
        >
          <View style={[styles.transcribingContainer, { backgroundColor: theme.backgroundSecondary }]}>
            <ActivityIndicator size="small" color={stylist.color} />
            <ThemedText style={[styles.transcribingText, { color: theme.tabIconDefault }]}>
              {t('aiStylist.transcribing') || 'Transcribing your message...'}
            </ThemedText>
          </View>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.inputContainerWrapper,
          { 
            paddingBottom: Spacing.sm,
            backgroundColor: theme.backgroundDefault,
          }
        ]}
      >
        {showQuickPrompts && !isTyping && messages.length <= 1 ? (
          <View style={styles.quickPromptsInline}>
            <OccasionOutfitChips
              generatingOccasionId={generatingOccasionId}
              disabled={!canSendMessage() || Boolean(generatingOccasionId)}
              onWeatherPress={handleWeatherOutfitGenerate}
              onOccasionPress={handleOccasionOutfitGenerate}
            />
            {/* Extra chat prompts that don't overlap occasion chips (work/date/weekend). */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickPromptsScrollContent}
            >
              {quickPrompts
                .filter((prompt) => prompt.id === 'party' || prompt.id === 'color')
                .map((prompt) => (
                <Pressable
                  key={prompt.id}
                  onPress={() => handleQuickPrompt(prompt.prompt)}
                  disabled={!canSendMessage()}
                  style={({ pressed }) => [
                    styles.quickPromptChip,
                    { 
                      backgroundColor: theme.backgroundSecondary,
                      borderColor: theme.backgroundTertiary,
                      opacity: pressed ? 0.7 : canSendMessage() ? 1 : 0.5,
                    },
                  ]}
                >
                  <Feather name={prompt.icon} size={14} color={canSendMessage() ? theme.link : theme.tabIconDefault} />
                  <ThemedText style={[styles.quickPromptChipLabel, !canSendMessage() && { color: theme.tabIconDefault }]}>
                    {prompt.label}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
        {limitReached ? (
          <LimitHitUpgradePrompt
            title={
              monthlyAllowanceExhausted
                ? getAiAllowancePaywallCopy(tier).title
                : (t('common.dailyMessageLimitReached') || 'Daily message limit reached')
            }
            message={
              monthlyAllowanceExhausted
                ? getAiAllowancePaywallCopy(tier).message
                : 'Upgrade to Personal Stylist for a bigger monthly AI pot and more chat.'
            }
            ctaLabel={
              monthlyAllowanceExhausted
                ? getAiAllowancePaywallCopy(tier).primaryLabel
                : 'See plans'
            }
            onUpgrade={() => {
              if (monthlyAllowanceExhausted) {
                openAiAllowanceDestination(getAiAllowancePaywallCopy(tier).primaryAction);
              } else {
                navigateToSubscriptionScreen();
              }
            }}
          />
        ) : null}
        {selectedImageUris.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.selectedImagePreviewRow}
            contentContainerStyle={styles.selectedImagePreviewContent}
          >
            {selectedImageUris.map((uri) => (
              <View
                key={uri}
                style={[styles.selectedImagePreview, { backgroundColor: theme.backgroundSecondary }]}
              >
                <Image
                  source={{ uri }}
                  style={styles.selectedImage}
                  resizeMode="cover"
                />
                <Pressable
                  onPress={() => setSelectedImageUris((prev) => prev.filter((u) => u !== uri))}
                  style={styles.removeImageButton}
                >
                  <Feather name="x" size={16} color="#FFFFFF" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}
        <View style={[styles.inputWrapper, { backgroundColor: theme.backgroundSecondary }]}>
          <Pressable
            onPress={startRecording}
            disabled={limitReached || isTyping}
            style={({ pressed }) => [
              styles.micButton,
              {
                backgroundColor: !limitReached && !isTyping
                  ? stylist.color
                  : theme.backgroundTertiary,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Feather
              name="mic"
              size={18}
              color={!limitReached && !isTyping ? '#FFFFFF' : theme.tabIconDefault}
            />
          </Pressable>
          <Pressable
            onPress={pickImage}
            disabled={limitReached || isTyping}
            style={({ pressed }) => [
              styles.photoButton,
              {
                backgroundColor: !limitReached && !isTyping
                  ? stylist.color
                  : theme.backgroundTertiary,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Feather
              name="image"
              size={18}
              color={!limitReached && !isTyping ? '#FFFFFF' : theme.tabIconDefault}
            />
          </Pressable>
          <TextInput
            value={inputText}
            onChangeText={setComposerText}
            onFocus={() => {
              stickToLatestRef.current = true;
              isNearBottomRef.current = true;
              scrollChatToEnd(true, false);
            }}
            placeholder={
              monthlyAllowanceExhausted
                ? (t('aiStylist.monthlyAllowancePlaceholder') || 'Monthly allowance used — upgrade to continue')
                : limitReached
                  ? (t('aiStylist.dailyLimitPlaceholder') || 'Daily limit reached - upgrade for more')
                  : (t('aiStylist.askPlaceholder') || 'Ask for styling advice...')
            }
            placeholderTextColor={theme.tabIconDefault}
            style={[styles.textInput, { color: theme.text }]}
            multiline
            maxLength={500}
            editable={!limitReached}
            onSubmitEditing={() => sendMessage(inputText)}
            returnKeyType="send"
          />
          <Pressable
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim() || limitReached || isTyping}
            style={({ pressed }) => [
              styles.sendButton,
              {
                backgroundColor: inputText.trim() && !limitReached && !isTyping
                  ? theme.link
                  : theme.backgroundTertiary,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Feather
              name="send"
              size={18}
              color={inputText.trim() && !limitReached && !isTyping ? '#FFFFFF' : theme.tabIconDefault}
            />
          </Pressable>
        </View>
      </View>
    );
  };
  
  const handleVoiceExchange = useCallback((exchange: { userText: string; assistantText: string }) => {
    const now = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      {
        id: `msg_${Date.now()}_user`,
        role: 'user',
        content: exchange.userText,
        timestamp: now,
      },
      {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: exchange.assistantText,
        timestamp: now,
      },
    ]);
    setShowQuickPrompts(false);
    // Keep the header usage card in sync (voice panel has its own hook instance)
    void refreshVoiceCredits();
  }, [refreshVoiceCredits]);

  const handleVoiceCreditsChange = useCallback((credits: Parameters<typeof updateVoiceCreditsBalance>[0]) => {
    updateVoiceCreditsBalance(credits);
  }, [updateVoiceCreditsBalance]);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {chatMode === 'voice' ? (
        <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
          <View style={{ paddingTop: contentTopPad, paddingHorizontal: Spacing.lg }}>
            {renderHeader()}
          </View>
          <PersonalStylistVoicePanel
            stylist={stylist}
            effectiveLanguage={effectiveLanguage}
            accent={stylistLanguageCodeToAccent(effectiveLanguage)}
            wardrobeItems={wardrobeItems
              .filter((item) => !item.origin || item.origin === 'owned')
              .map((item) => ({
                id: String(item.id),
                name: item.name,
                color: item.color,
                category: item.category,
                brand: item.brand,
                wearCount: item.timesWorn,
                timesWorn: item.timesWorn,
                isFavorite: item.isFavorite,
                origin: item.origin,
              }))}
            onExchange={handleVoiceExchange}
            onCreditsChange={handleVoiceCreditsChange}
            onBalanceRefreshNeeded={refreshVoiceCredits}
          />
        </View>
      ) : (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingTop: contentTopPad,
              paddingBottom: listBottomInset,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onScroll={onChatScroll}
          onScrollBeginDrag={onChatScrollBeginDrag}
          scrollEventThrottle={16}
          onScrollToIndexFailed={() => {
            flatListRef.current?.scrollToOffset({ offset: CHAT_SCROLL_END_OFFSET, animated: false });
          }}
          onContentSizeChange={() => {
            // Keep WhatsApp-style stickiness while following the live reply; don't yank
            // someone who scrolled up into history.
            if (shouldAutoStickOnContentChange(chatMachineRef.current) || stickToLatestRef.current) {
              scrollChatToEnd(false, false);
            }
          }}
          onLayout={() => {
            if (shouldAutoStickOnContentChange(chatMachineRef.current) || stickToLatestRef.current) {
              scrollChatToEnd(false, false);
            }
          }}
          removeClippedSubviews={false}
          style={styles.flatList}
        />
        <KeyboardStickyView offset={{ closed: 0, opened: 0 }} style={styles.inputSticky}>
          <Animated.View style={[inputBottomPadStyle, { backgroundColor: theme.backgroundDefault }]}>
            {renderInputBar()}
          </Animated.View>
        </KeyboardStickyView>
      </View>
      )}
      {renderFeedbackModal()}
      <VoiceCreditsPurchaseModal
        visible={showVoiceCreditsModal}
        onClose={() => {
          setShowVoiceCreditsModal(false);
          refreshVoiceCredits();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flatList: {
    flex: 1,
  },
  inputSticky: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  listContent: {
    paddingHorizontal: 0,
  },
  headerContent: {
    paddingHorizontal: Spacing.xl,
  },
  continuityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  stylistIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...Typography.h3,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  moodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  moodBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  headerSubtitle: {
    ...Typography.caption,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  messageCounter: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  messageCountText: {
    ...Typography.caption,
  },
  clearButton: {
    padding: Spacing.sm,
  },
  ttsButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  transcribingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    marginHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  transcribingText: {
    ...Typography.body,
  },
  emptyWardrobeCard: {
    marginBottom: Spacing.lg,
  },
  emptyWardrobeContent: {
    alignItems: 'center',
  },
  emptyWardrobeIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyWardrobeTitle: {
    ...Typography.h4,
    marginBottom: Spacing.xs,
  },
  emptyWardrobeText: {
    ...Typography.small,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  addWardrobeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  addWardrobeButtonText: {
    ...Typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: Spacing.lg,
    gap: CHAT_AVATAR_GAP,
    paddingHorizontal: CHAT_ROW_PADDING,
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  assistantMessageContainer: {
    justifyContent: 'flex-start',
  },
  /** Room for absolute thumbs so the next bubble cannot cover them. */
  assistantMessageWithFeedback: {
    marginBottom: 48,
  },
  avatarContainer: {
    width: CHAT_AVATAR_SIZE,
    height: CHAT_AVATAR_SIZE,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
    textAlign: 'center',
  },
  headerAvatarInitial: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center',
  },
  userAvatar: {
    width: CHAT_AVATAR_SIZE,
    height: CHAT_AVATAR_SIZE,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackContainer: {
    position: 'absolute',
    bottom: -36,
    left: 44,
  },
  feedbackButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 2,
  },
  feedbackButton: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackGiven: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  feedbackText: {
    ...Typography.small,
  },
  feedbackModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  feedbackModalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  feedbackModalTitle: {
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  feedbackModalSubtitle: {
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  feedbackOptionsGrid: {
    gap: Spacing.sm,
  },
  feedbackOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  feedbackOptionText: {
    ...Typography.body,
  },
  feedbackCancelButton: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
  },
  messageBubble: {
    maxWidth: SCREEN_WIDTH * 0.72,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    flexShrink: 1,
  },
  messageBubbleWardrobe: {
    maxWidth: WARDROBE_CHAT_BUBBLE_MAX_WIDTH,
    paddingHorizontal: CHAT_BUBBLE_PADDING_H,
    paddingVertical: Spacing.md,
    overflow: 'visible',
  },
  userBubble: {
    borderBottomRightRadius: Spacing.xs,
  },
  assistantBubble: {
    borderBottomLeftRadius: Spacing.xs,
  },
  messageText: {
    ...Typography.body,
    lineHeight: 22,
    paddingRight: Spacing.xs,
  },
  messageImage: {
    width: 200,
    height: 250,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  messageImageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  messageImageMulti: {
    width: 96,
    height: 120,
    marginTop: 0,
  },
  decideRedirectCta: {
    marginTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  decideRedirectCtaText: {
    ...Typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  visualizingOutfitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  visualizingOutfitText: {
    ...Typography.small,
    opacity: 0.7,
  },
  wardrobeVisualBlock: {
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  outfitSectionGap: {
    marginTop: Spacing.md,
  },
  wardrobeVisualLabel: {
    ...Typography.small,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  wardrobeHighlightFrame: {
    borderRadius: BorderRadius.lg,
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 280,
    paddingVertical: Spacing.sm,
  },
  wardrobeHighlightImage: {
    width: '96%',
    height: 260,
  },
  wardrobeVisualName: {
    ...Typography.small,
    marginTop: Spacing.sm,
    textAlign: 'center',
    fontWeight: '600',
  },
  outfitSuggestionContainer: {
    marginTop: Spacing.md,
  },
  outfitDivider: {
    height: 1,
    marginBottom: Spacing.md,
  },
  outfitTitle: {
    ...Typography.small,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  outfitItemsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  outfitItemContainer: {
    alignItems: 'center',
    width: 60,
  },
  outfitItemImage: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.sm,
  },
  outfitItemPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outfitItemName: {
    ...Typography.caption,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderBottomLeftRadius: Spacing.xs,
  },
  typingText: {
    ...Typography.small,
  },
  quickPromptsContainer: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  quickPromptsTitle: {
    ...Typography.small,
    marginBottom: Spacing.md,
  },
  quickPromptsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  quickPromptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  quickPromptLabel: {
    ...Typography.small,
  },
  quickPromptsInline: {
    marginBottom: Spacing.sm,
  },
  quickPromptsScrollContent: {
    paddingHorizontal: Spacing.xs,
    gap: Spacing.sm,
  },
  quickPromptChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  quickPromptChipLabel: {
    ...Typography.small,
    fontSize: 12,
  },
  limitReachedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  limitReachedText: {
    ...Typography.small,
  },
  upgradeLink: {
    ...Typography.small,
    fontWeight: '600',
  },
  inputContainerWrapper: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    ...Typography.body,
    maxHeight: 100,
    paddingVertical: Spacing.sm,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  selectedImagePreviewRow: {
    maxHeight: 120,
    marginBottom: Spacing.sm,
  },
  selectedImagePreviewContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  selectedImagePreview: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  selectedImage: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  cancelRecordingButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 24,
  },
  waveformBar: {
    width: 4,
    borderRadius: 2,
  },
  recordingDuration: {
    ...Typography.body,
    fontWeight: '600',
    minWidth: 50,
  },
  stopRecordingButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopIcon: {
    width: 16,
    height: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  voiceMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  voicePlayButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceWaveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  voiceWaveformBar: {
    width: 3,
    borderRadius: 1.5,
  },
  voiceDuration: {
    ...Typography.caption,
    marginLeft: Spacing.sm,
  },
  upgradeTeaserCard: {
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  upgradeTeaserGradient: {
    padding: Spacing.lg,
  },
  upgradeTeaserContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  upgradeTeaserIconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeTeaserTextContainer: {
    flex: 1,
  },
  upgradeTeaserTitle: {
    ...Typography.h4,
    color: '#FFFFFF',
    marginBottom: Spacing.xs,
  },
  upgradeTeaserMessage: {
    ...Typography.small,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
  },
  upgradeTeaserButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: '#FFFFFF',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
  },
  upgradeTeaserButtonText: {
    ...Typography.body,
    fontWeight: '700',
    color: LUXURY_COLORS.berry,
  },
});

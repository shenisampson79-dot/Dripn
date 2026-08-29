/**
 * AI Stylist chat account session — invalidate local state on identity change.
 *
 * Launch-safe: account-transition reset (not user-scoped key migration).
 * Server chat_messages remains source of truth after account switches.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STYLIST_CHAT_CLEARED_TOMBSTONE_KEY } from '@/utils/stylistFreshThread';

export const STYLIST_CHAT_STORAGE_KEY = '@dripn_ai_stylist_chat';
export const STYLIST_DAILY_MESSAGES_KEY = '@dripn_ai_daily_messages';
export const STYLIST_COMPOSER_DRAFT_KEY_PREFIX = '@dripn_ai_stylist_composer_draft:';
export const STYLIST_PENDING_RETRY_KEY = '@dripn_stylist_pending_retry';

export type StylistChatMessageSnapshot = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
};

let chatMessagesMemoryCache: StylistChatMessageSnapshot[] | null = null;
let chatQuickPromptsMemoryCache: boolean | null = null;
const composerDraftMemory: Record<string, string> = {};

let hydrateGeneration = 0;
let activeUserId: string | null = null;

export function stylistComposerDraftKey(stylistId: string): string {
  return `${STYLIST_COMPOSER_DRAFT_KEY_PREFIX}${stylistId || 'default'}`;
}

export function getActiveStylistChatUserId(): string | null {
  return activeUserId;
}

export function getStylistChatHydrateGeneration(): number {
  return hydrateGeneration;
}

export function rememberStylistChatMessages(
  msgs: StylistChatMessageSnapshot[],
  showQuickPrompts?: boolean,
): void {
  chatMessagesMemoryCache = msgs.slice(-50);
  if (typeof showQuickPrompts === 'boolean') {
    chatQuickPromptsMemoryCache = showQuickPrompts;
  }
}

export function getCachedStylistChatMessagesSync(): StylistChatMessageSnapshot[] | null {
  return chatMessagesMemoryCache;
}

export function getCachedStylistChatQuickPromptsSync(): boolean | null {
  return chatQuickPromptsMemoryCache;
}

export function readComposerDraftMemory(stylistId: string): string {
  const mem = composerDraftMemory[stylistId || 'default'];
  return typeof mem === 'string' ? mem : '';
}

export function writeComposerDraftMemory(stylistId: string, text: string): void {
  const id = stylistId || 'default';
  const next = String(text || '');
  if (!next.trim()) {
    delete composerDraftMemory[id];
    void AsyncStorage.removeItem(stylistComposerDraftKey(id)).catch(() => {});
    return;
  }
  composerDraftMemory[id] = next;
  void AsyncStorage.setItem(stylistComposerDraftKey(id), next).catch(() => {});
}

export function clearStylistChatMemoryCaches(): void {
  chatMessagesMemoryCache = null;
  chatQuickPromptsMemoryCache = null;
  for (const key of Object.keys(composerDraftMemory)) {
    delete composerDraftMemory[key];
  }
}

/** Cold start / same authenticated user — retain local persistence. */
export function resumeStylistChatSession(userId: string): void {
  activeUserId = String(userId || '').trim() || null;
}

export function beginStylistChatHydrate(userId: string): number {
  hydrateGeneration += 1;
  activeUserId = String(userId || '').trim() || null;
  return hydrateGeneration;
}

export function isStylistChatHydrateCurrent(generation: number, userId: string | null): boolean {
  const uid = String(userId || '').trim() || null;
  return generation === hydrateGeneration && activeUserId === uid;
}

export function isStylistChatSessionActive(userId: string | null): boolean {
  const uid = String(userId || '').trim() || null;
  return activeUserId === uid;
}

export async function clearStylistChatLocalPersistence(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys().catch(() => [] as string[]);
  const draftKeys = keys.filter((k) => k.startsWith(STYLIST_COMPOSER_DRAFT_KEY_PREFIX));
  await AsyncStorage.multiRemove([
    STYLIST_CHAT_STORAGE_KEY,
    STYLIST_DAILY_MESSAGES_KEY,
    STYLIST_PENDING_RETRY_KEY,
    STYLIST_CHAT_CLEARED_TOMBSTONE_KEY,
    ...draftKeys,
  ]).catch(() => {});
}

/** Logout / identity relinquished — wipe local stylist chat artifacts. */
export async function relinquishStylistChatAccountSession(): Promise<void> {
  clearStylistChatMemoryCaches();
  await clearStylistChatLocalPersistence();
  hydrateGeneration += 1;
  activeUserId = null;
}

/**
 * Login / account established.
 * preserveLocal=true only when the same authenticated user resumes without a switch.
 */
export async function establishStylistChatAccountSession(
  nextUserId: string,
  options: { preserveLocal: boolean },
): Promise<number> {
  if (!options.preserveLocal) {
    clearStylistChatMemoryCaches();
    await clearStylistChatLocalPersistence();
  }
  hydrateGeneration += 1;
  activeUserId = String(nextUserId || '').trim() || null;
  return hydrateGeneration;
}

export function shouldPreserveStylistChatLocal(
  priorUserId: string | null | undefined,
  nextUserId: string | null | undefined,
): boolean {
  const prior = String(priorUserId || '').trim();
  const next = String(nextUserId || '').trim();
  if (!prior || !next) return false;
  return prior === next;
}

/** Test-only reset of module singletons. */
export function __resetStylistChatAccountSessionForTests(): void {
  clearStylistChatMemoryCaches();
  hydrateGeneration = 0;
  activeUserId = null;
}

import AsyncStorage from '@react-native-async-storage/async-storage';

import { STYLIST_CHAT_STORAGE_KEY } from '@/utils/stylistChatAccountSession';

export const GUEST_TOKEN_KEY = '@dripn_guest_token';
const GUEST_CHATS_PREFIX = '@dripn_guest_chats:';
/** @deprecated Use STYLIST_CHAT_STORAGE_KEY — kept for existing imports. */
export const AI_STYLIST_CHAT_KEY = STYLIST_CHAT_STORAGE_KEY;

const ALLOWED_STYLISTS = new Set(['ruby', 'max', 'ace', 'ivy']);
const MAX_MESSAGES_PER_STYLIST = 50;

export type GuestStoredMessage = {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: string;
  imageUrl?: string;
  outfitContext?: string;
  outfitOccasion?: string | null;
};

export type GuestChatMap = Record<string, GuestStoredMessage[]>;

export type ClaimConversation = {
  stylist: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
};

function chatsKey(token: string): string {
  return `${GUEST_CHATS_PREFIX}${token}`;
}

function serializeMessage(msg: {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date | string;
  imageUrl?: string;
  outfitContext?: string;
  outfitOccasion?: string | null;
}): GuestStoredMessage | null {
  const content = typeof msg.content === 'string' ? msg.content.trim() : '';
  if (!content && !msg.imageUrl) return null;
  const timestamp =
    msg.timestamp instanceof Date
      ? msg.timestamp.toISOString()
      : (typeof msg.timestamp === 'string' ? msg.timestamp : new Date().toISOString());
  const out: GuestStoredMessage = {
    id: String(msg.id || `msg_${Date.now()}`),
    content: content || (msg.imageUrl ? '[Outfit visual]' : ''),
    isUser: Boolean(msg.isUser),
    timestamp,
  };
  if (typeof msg.imageUrl === 'string' && msg.imageUrl.startsWith('https://')) {
    out.imageUrl = msg.imageUrl;
  }
  if (typeof msg.outfitContext === 'string' && msg.outfitContext.trim()) {
    out.outfitContext = msg.outfitContext.trim();
  }
  if (msg.outfitOccasion != null) {
    out.outfitOccasion = msg.outfitOccasion;
  }
  return out;
}

export function toStoredChatMap(
  map: Record<string, Array<{
    id: string;
    content: string;
    isUser: boolean;
    timestamp: Date | string;
    imageUrl?: string;
    outfitContext?: string;
    outfitOccasion?: string | null;
  }>>,
): GuestChatMap {
  const out: GuestChatMap = {};
  for (const [stylistId, messages] of Object.entries(map || {})) {
    const id = String(stylistId || '').toLowerCase();
    if (!ALLOWED_STYLISTS.has(id) || !Array.isArray(messages)) continue;
    const stored = messages
      .map(serializeMessage)
      .filter((m): m is GuestStoredMessage => m != null)
      .slice(-MAX_MESSAGES_PER_STYLIST);
    if (stored.length > 0) out[id] = stored;
  }
  return out;
}

export function hydrateChatMap(stored: GuestChatMap): Record<string, Array<GuestStoredMessage & { timestamp: Date }>> {
  const out: Record<string, Array<GuestStoredMessage & { timestamp: Date }>> = {};
  for (const [stylistId, messages] of Object.entries(stored || {})) {
    if (!ALLOWED_STYLISTS.has(stylistId) || !Array.isArray(messages)) continue;
    out[stylistId] = messages.map((m) => ({
      ...m,
      timestamp: new Date(m.timestamp || Date.now()),
    }));
  }
  return out;
}

export async function loadGuestChatMap(token: string): Promise<GuestChatMap> {
  if (!token) return {};
  try {
    const raw = await AsyncStorage.getItem(chatsKey(token));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return toStoredChatMap(parsed as GuestChatMap);
  } catch {
    return {};
  }
}

export async function saveGuestChatMap(token: string, map: GuestChatMap): Promise<void> {
  if (!token) return;
  const cleaned = toStoredChatMap(map);
  try {
    if (Object.keys(cleaned).length === 0) {
      await AsyncStorage.removeItem(chatsKey(token));
      return;
    }
    await AsyncStorage.setItem(chatsKey(token), JSON.stringify(cleaned));
  } catch (error) {
    console.log('Failed to persist guest chats:', error);
  }
}

export async function clearGuestChatMap(token: string | null | undefined): Promise<void> {
  if (!token) return;
  try {
    await AsyncStorage.removeItem(chatsKey(token));
  } catch {
    /* ignore */
  }
}

/** Build claim payload + optional local seed for logged-in stylist chat. */
export async function readGuestConversationsForClaim(): Promise<{
  guestToken: string | null;
  conversations: ClaimConversation[];
  seedMessages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    imageUri?: string;
  }>;
}> {
  let guestToken: string | null = null;
  try {
    guestToken = await AsyncStorage.getItem(GUEST_TOKEN_KEY);
  } catch {
    guestToken = null;
  }

  if (!guestToken) {
    return { guestToken: null, conversations: [], seedMessages: [] };
  }

  const map = await loadGuestChatMap(guestToken);
  const conversations: ClaimConversation[] = [];
  let richest: GuestStoredMessage[] = [];

  for (const [stylist, messages] of Object.entries(map)) {
    if (!ALLOWED_STYLISTS.has(stylist) || !Array.isArray(messages) || messages.length === 0) continue;
    const trimmed = messages.slice(-MAX_MESSAGES_PER_STYLIST);
    const claimMsgs = trimmed
      .map((m) => ({
        role: (m.isUser ? 'user' : 'assistant') as 'user' | 'assistant',
        content: typeof m.content === 'string' ? m.content.trim() : '',
      }))
      .filter((m) => m.content.length > 0);
    if (claimMsgs.length === 0) continue;
    conversations.push({ stylist, messages: claimMsgs });
    if (trimmed.length > richest.length) richest = trimmed;
  }

  const now = Date.now();
  const seedMessages = richest.map((m, index) => {
    const seed: {
      id: string;
      role: 'user' | 'assistant';
      content: string;
      timestamp: string;
      imageUri?: string;
    } = {
      id: m.id || `claimed_${now}_${index}`,
      role: m.isUser ? 'user' : 'assistant',
      content: m.content,
      // Keep within "today" filter used by AIStylistScreen
      timestamp: new Date(now - (richest.length - index) * 1000).toISOString(),
    };
    if (m.imageUrl) seed.imageUri = m.imageUrl;
    return seed;
  });

  return { guestToken, conversations, seedMessages };
}

export async function clearGuestSessionLocal(): Promise<void> {
  let token: string | null = null;
  try {
    token = await AsyncStorage.getItem(GUEST_TOKEN_KEY);
  } catch {
    token = null;
  }
  try {
    await AsyncStorage.multiRemove(
      [GUEST_TOKEN_KEY, token ? chatsKey(token) : null].filter(Boolean) as string[],
    );
  } catch {
    if (token) await clearGuestChatMap(token);
    try {
      await AsyncStorage.removeItem(GUEST_TOKEN_KEY);
    } catch {
      /* ignore */
    }
  }
}

export async function seedAiStylistChatFromGuest(
  seedMessages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    imageUri?: string;
  }>,
): Promise<void> {
  if (!seedMessages.length) return;
  // Only seed if there is real back-and-forth (not greeting-only)
  const hasUser = seedMessages.some((m) => m.role === 'user');
  if (!hasUser) return;
  try {
    const existingRaw = await AsyncStorage.getItem(AI_STYLIST_CHAT_KEY);
    if (existingRaw) {
      const existing = JSON.parse(existingRaw);
      if (Array.isArray(existing) && existing.some((m: any) => m?.role === 'user')) {
        // Don't overwrite an active logged-in thread
        return;
      }
    }
    await AsyncStorage.setItem(AI_STYLIST_CHAT_KEY, JSON.stringify(seedMessages.slice(-50)));
  } catch (error) {
    console.log('Failed to seed AI stylist chat from guest:', error);
  }
}

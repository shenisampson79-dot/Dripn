/**
 * DecisionSessionManager — single authority for resumable decision sessions.
 * Screens are temporary; sessions are the source of truth (draft / completed / stale).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

import type { DecisionContext, DecisionResponse } from '@/services/DecisionService';

export type DecisionFlow = 'shopping' | 'event-outfit' | 'sanity-check';
export type DecisionSessionStatus = 'draft' | 'completed' | 'stale';
export type DecisionSessionStep = 'event' | 'input' | 'context' | 'response';

export type DecisionSessionEventDetails = {
  eventType: string;
  dressCode: string;
  venue: string;
  timeOfDay: string;
};

export type DecisionSessionInput = {
  text: string;
  images: string[];
  imageDataUris: string[];
  selectedContexts: DecisionContext[];
  selectedWardrobeIds: string[];
  eventDetails: DecisionSessionEventDetails;
};

export type DecisionSession = {
  id: string;
  userId: string;
  flow: DecisionFlow;
  status: DecisionSessionStatus;
  contextHash: string;
  step: DecisionSessionStep;
  input: DecisionSessionInput;
  result: DecisionResponse | null;
  isSurpriseMe: boolean;
  createdAt: number;
  updatedAt: number;
};

export type ContextSnapshot = {
  wardrobeSignature: string;
  personaSignature: string;
  memorySignature?: string;
};

const SESSION_KEY_PREFIX = '@dripn_decision_session:v1:';
const LEGACY_DRAFT_PREFIX = '@dripn_decision_draft:';
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const COMPLETED_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_INLINE_DATA_URI_CHARS = 900_000;

function sessionKey(userId: string, flow: DecisionFlow): string {
  return `${SESSION_KEY_PREFIX}${userId}:${flow}`;
}

function legacyDraftKey(userId: string, flow: DecisionFlow): string {
  return `${LEGACY_DRAFT_PREFIX}${userId}:${flow}`;
}

function emptyInput(): DecisionSessionInput {
  return {
    text: '',
    images: [],
    imageDataUris: [],
    selectedContexts: [],
    selectedWardrobeIds: [],
    eventDetails: { eventType: '', dressCode: '', venue: '', timeOfDay: '' },
  };
}

function hasMeaningfulInput(input: DecisionSessionInput, result: DecisionResponse | null): boolean {
  if (result) return true;
  if (input.images.length > 0) return true;
  if (input.selectedWardrobeIds.length > 0) return true;
  if (input.text.trim()) return true;
  if (input.selectedContexts.length > 0) return true;
  const e = input.eventDetails;
  return Boolean(e.eventType || e.dressCode || e.venue?.trim() || e.timeOfDay);
}

function slimDataUris(uris: string[]): string[] {
  const total = uris.reduce((sum, u) => sum + (u?.length || 0), 0);
  if (total <= MAX_INLINE_DATA_URI_CHARS) return uris;
  return uris.map((u) => (u?.startsWith('data:') ? '' : u || ''));
}

function isStableImageUri(uri: string): boolean {
  if (!uri || typeof uri !== 'string') return false;
  if (uri.startsWith('content:') || uri.startsWith('ph://') || uri.startsWith('assets-library:')) {
    return false;
  }
  return uri.startsWith('file:') || uri.startsWith('data:image/') || uri.startsWith('http');
}

export async function isImageReadable(uri: string): Promise<boolean> {
  if (!isStableImageUri(uri)) return false;
  if (uri.startsWith('data:image/') && uri.length > 1000) return true;
  if (uri.startsWith('http')) return true;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return Boolean(info.exists);
  } catch {
    return false;
  }
}

export function buildWardrobeSignature(items: Array<{ id?: string | number }>): string {
  const ids = items
    .map((i) => String(i?.id ?? ''))
    .filter(Boolean)
    .sort();
  return `${ids.length}:${ids.join(',')}`;
}

export function buildPersonaSignature(user: {
  gender?: string | null;
  stylePreference?: string | null;
  skinUndertone?: string | null;
  bodyShape?: string | null;
  stylistPreferences?: { selectedStylistId?: string } | null;
  profileData?: Record<string, unknown> | null;
} | null | undefined): string {
  if (!user) return 'anon';
  return [
    user.gender || '',
    user.stylePreference || '',
    user.skinUndertone || '',
    user.bodyShape || '',
    user.stylistPreferences?.selectedStylistId || '',
    JSON.stringify(user.profileData?.styleDna || user.profileData?.stylePreferences || {}),
  ].join('|');
}

export async function computeContextHash(snapshot: ContextSnapshot): Promise<string> {
  const payload = JSON.stringify({
    w: snapshot.wardrobeSignature,
    p: snapshot.personaSignature,
    m: snapshot.memorySignature || '',
  });
  // Fast local fingerprint — equality checks only (not cryptographic)
  let h = 5381;
  for (let i = 0; i < payload.length; i++) {
    h = ((h << 5) + h) ^ payload.charCodeAt(i);
  }
  return `ctx_${(h >>> 0).toString(16)}_${payload.length}`;
}

function newId(): string {
  return `ds_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function sanitizeImages(images: string[], imageDataUris: string[]) {
  const nextImages: string[] = [];
  const nextData: string[] = [];
  const brokenIndexes: number[] = [];

  for (let i = 0; i < images.length; i++) {
    const preview = images[i];
    const data = imageDataUris[i] || '';
    const candidate = data.startsWith('data:image/') && data.length > 1000 ? data : preview;
    if (!(await isImageReadable(candidate)) && !(await isImageReadable(preview))) {
      brokenIndexes.push(i);
      continue;
    }
    nextImages.push(isStableImageUri(preview) ? preview : candidate);
    nextData.push(data.startsWith('data:image/') && data.length > 1000 ? data : '');
  }

  return { images: nextImages, imageDataUris: nextData, brokenIndexes };
}

export const decisionSessionManager = {
  async getActiveSession(userId: string, flow: DecisionFlow): Promise<DecisionSession | null> {
    if (!userId) return null;
    try {
      const raw = await AsyncStorage.getItem(sessionKey(userId, flow));
      if (raw) {
        const session = JSON.parse(raw) as DecisionSession;
        if (!session?.id || session.flow !== flow) return null;
        return session;
      }
      // One-time migrate from earlier draft persistence
      return this.migrateLegacyDraft(userId, flow);
    } catch (error) {
      console.warn('[DecisionSession] get failed:', error);
      return null;
    }
  },

  async migrateLegacyDraft(userId: string, flow: DecisionFlow): Promise<DecisionSession | null> {
    try {
      const raw = await AsyncStorage.getItem(legacyDraftKey(userId, flow));
      if (!raw) return null;
      const draft = JSON.parse(raw);
      const hasResult = Boolean(draft?.response);
      const session: DecisionSession = {
        id: newId(),
        userId,
        flow,
        status: hasResult ? 'completed' : 'draft',
        contextHash: '',
        step: draft.step || (flow === 'event-outfit' ? 'event' : 'input'),
        input: {
          text: draft.contextNotes || '',
          images: draft.images || [],
          imageDataUris: draft.imageDataUris || [],
          selectedContexts: draft.selectedContexts || [],
          selectedWardrobeIds: draft.selectedWardrobeIds || [],
          eventDetails: draft.eventDetails || emptyInput().eventDetails,
        },
        result: draft.response || null,
        isSurpriseMe: Boolean(draft.isSurpriseMe),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await this.saveSession(session);
      await AsyncStorage.removeItem(legacyDraftKey(userId, flow));
      return session;
    } catch {
      return null;
    }
  },

  async saveSession(session: DecisionSession): Promise<void> {
    if (!session.userId) return;
    try {
      // Refuse silent downgrade: draft-without-result must not wipe a completed recommendation
      try {
        const existingRaw = await AsyncStorage.getItem(sessionKey(session.userId, session.flow));
        if (existingRaw) {
          const existing = JSON.parse(existingRaw) as DecisionSession;
          if (
            existing?.result
            && (existing.status === 'completed' || existing.status === 'stale')
            && session.status === 'draft'
            && !session.result
          ) {
            console.warn('[DecisionSession] Refused draft overwrite of completed session');
            return;
          }
        }
      } catch {
        // continue with save
      }

      if (!hasMeaningfulInput(session.input, session.result) && session.status === 'draft') {
        await AsyncStorage.removeItem(sessionKey(session.userId, session.flow));
        return;
      }
      const now = Date.now();
      // TTL: drafts 7d, completed 90d
      const age = now - session.updatedAt;
      if (session.status === 'draft' && age > DRAFT_TTL_MS) {
        await AsyncStorage.removeItem(sessionKey(session.userId, session.flow));
        return;
      }
      if (session.status !== 'draft' && age > COMPLETED_TTL_MS) {
        await AsyncStorage.removeItem(sessionKey(session.userId, session.flow));
        return;
      }

      const slim: DecisionSession = {
        ...session,
        updatedAt: now,
        input: {
          ...session.input,
          images: (session.input.images || []).filter(isStableImageUri),
          imageDataUris: slimDataUris(session.input.imageDataUris || []),
        },
        result: session.result
          ? {
              ...session.result,
              uploadedImages: (session.result.uploadedImages || [])
                .filter(isStableImageUri)
                .map((uri) => (uri.startsWith('data:') && uri.length > 50_000 ? '' : uri))
                .filter(Boolean),
            }
          : null,
      };
      await AsyncStorage.setItem(sessionKey(session.userId, session.flow), JSON.stringify(slim));
    } catch (error) {
      console.warn('[DecisionSession] save failed:', error);
    }
  },

  async clearSession(userId: string, flow: DecisionFlow): Promise<void> {
    if (!userId) return;
    try {
      await AsyncStorage.multiRemove([sessionKey(userId, flow), legacyDraftKey(userId, flow)]);
    } catch (error) {
      console.warn('[DecisionSession] clear failed:', error);
    }
  },

  createSession(userId: string, flow: DecisionFlow, contextHash: string): DecisionSession {
    const now = Date.now();
    return {
      id: newId(),
      userId,
      flow,
      status: 'draft',
      contextHash,
      step: flow === 'event-outfit' ? 'event' : 'input',
      input: emptyInput(),
      result: null,
      isSurpriseMe: false,
      createdAt: now,
      updatedAt: now,
    };
  },

  /**
   * Load active session and apply context invalidation.
   * Completed + hash mismatch → stale (keep snapshot, flag for refresh).
   */
  async loadForScreen(
    userId: string,
    flow: DecisionFlow,
    currentHash: string,
  ): Promise<{ session: DecisionSession | null; brokenImageIndexes: number[] }> {
    let session = await this.getActiveSession(userId, flow);
    if (!session) return { session: null, brokenImageIndexes: [] };

    const sanitized = await sanitizeImages(session.input.images, session.input.imageDataUris);
    session = {
      ...session,
      input: {
        ...session.input,
        images: sanitized.images,
        imageDataUris: sanitized.imageDataUris,
      },
    };

    if (session.contextHash && currentHash && session.contextHash !== currentHash) {
      if (session.status === 'completed' || session.result) {
        session = { ...session, status: 'stale' };
      }
      // Draft with changed context: keep editable, but refresh hash so next complete is current
      if (session.status === 'draft' && !session.result) {
        session = { ...session, contextHash: currentHash };
      }
    }

    // Any saved recommendation must reopen on the result step (never kick back to input)
    if (session.result) {
      session = {
        ...session,
        status: session.status === 'draft' ? 'completed' : session.status,
        step: 'response',
      };
    } else if (session.status === 'completed' || session.status === 'stale') {
      session = { ...session, step: 'response' };
    }

    await this.saveSession(session);
    return { session, brokenImageIndexes: sanitized.brokenIndexes };
  },

  markCompleted(session: DecisionSession, result: DecisionResponse, contextHash: string): DecisionSession {
    return {
      ...session,
      result,
      status: 'completed',
      contextHash,
      step: 'response',
      updatedAt: Date.now(),
    };
  },

  markDraftForEdit(session: DecisionSession, contextHash: string): DecisionSession {
    return {
      ...session,
      status: 'draft',
      contextHash,
      step: session.flow === 'event-outfit' ? 'event' : 'input',
      // Keep prior result visible until new submit replaces it — clear so UI is editable input
      result: null,
      updatedAt: Date.now(),
    };
  },
};

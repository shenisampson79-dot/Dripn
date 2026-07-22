/**
 * DecisionSessionManager — single authority for resumable decision sessions.
 *
 * HARD RULES:
 * - Screens are temporary; sessions are the source of truth
 * - If session.result exists → status is completed|stale and UI is ALWAYS the recommendation
 * - Autosave must NEVER clear or overwrite a completed recommendation with an empty draft
 * - Step is DERIVED from data truth (result?), not trusted from storage alone
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

import type { DecisionContext, DecisionResponse } from '@/services/DecisionService';

export type DecisionFlow = 'shopping' | 'event-outfit' | 'sanity-check';
export type DecisionSessionStatus = 'draft' | 'completed' | 'stale';
/** Pre-result draft substeps only — recommendation view is derived from result. */
export type DecisionDraftSubstep = 'event' | 'input' | 'context';
export type DecisionSessionStep = DecisionDraftSubstep | 'response';

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
  /** Only meaningful while status === draft and no result */
  draftSubstep?: DecisionDraftSubstep;
};

export type DecisionSession = {
  id: string;
  userId: string;
  flow: DecisionFlow;
  status: DecisionSessionStatus;
  contextHash: string;
  /** @deprecated Derived via getDerivedStep — kept for migration only */
  step?: DecisionSessionStep;
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

function emptyInput(flow: DecisionFlow): DecisionSessionInput {
  return {
    text: '',
    images: [],
    imageDataUris: [],
    selectedContexts: [],
    selectedWardrobeIds: [],
    eventDetails: { eventType: '', dressCode: '', venue: '', timeOfDay: '' },
    draftSubstep: flow === 'event-outfit' ? 'event' : 'input',
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
  let h = 5381;
  for (let i = 0; i < payload.length; i++) {
    h = ((h << 5) + h) ^ payload.charCodeAt(i);
  }
  return `ctx_${(h >>> 0).toString(16)}_${payload.length}`;
}

/**
 * UI step is ALWAYS derived from data truth.
 * result → recommendation; otherwise draft substep (event/input).
 */
export function getDerivedStep(session: DecisionSession): DecisionSessionStep {
  if (session.result) return 'response';
  const sub = session.input.draftSubstep;
  if (sub === 'event' || sub === 'input' || sub === 'context') return sub;
  if (session.flow === 'event-outfit') {
    const e = session.input.eventDetails;
    if (!e.eventType || !e.dressCode) return 'event';
  }
  return 'input';
}

/** Lock invariants: result implies completed|stale; never leave a result as draft. */
export function normalizeSession(session: DecisionSession): DecisionSession {
  if (session.result) {
    const status: DecisionSessionStatus =
      session.status === 'stale' ? 'stale' : 'completed';
    return {
      ...session,
      status,
      step: 'response',
      input: {
        ...session.input,
        // Preserve input for edit & re-run, but draftSubstep is irrelevant while locked
      },
    };
  }
  return {
    ...session,
    status: session.status === 'stale' ? 'draft' : session.status === 'completed' ? 'draft' : session.status,
    step: getDerivedStep({ ...session, result: null }),
  };
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

/**
 * Patch drafts only. Completed/stale sessions with a result are immutable here.
 * Explicit unlock goes through markDraftForEdit / clearSession.
 */
export function applyDraftPatch(
  session: DecisionSession,
  patch: {
    input?: Partial<DecisionSessionInput>;
    isSurpriseMe?: boolean;
    contextHash?: string;
  },
): DecisionSession {
  const locked = normalizeSession(session);
  if (locked.result) {
    // 🔒 NEVER allow autosave/UI to clear or mutate a recommendation
    return locked;
  }

  const nextInput: DecisionSessionInput = {
    ...locked.input,
    ...(patch.input || {}),
    eventDetails: {
      ...locked.input.eventDetails,
      ...(patch.input?.eventDetails || {}),
    },
  };

  return normalizeSession({
    ...locked,
    status: 'draft',
    contextHash: patch.contextHash ?? locked.contextHash,
    isSurpriseMe: patch.isSurpriseMe ?? locked.isSurpriseMe,
    input: nextInput,
    result: null,
    updatedAt: Date.now(),
  });
}

export const decisionSessionManager = {
  getDerivedStep,
  normalizeSession,
  applyDraftPatch,

  async getActiveSession(userId: string, flow: DecisionFlow): Promise<DecisionSession | null> {
    if (!userId) return null;
    try {
      const raw = await AsyncStorage.getItem(sessionKey(userId, flow));
      if (raw) {
        const session = JSON.parse(raw) as DecisionSession;
        if (!session?.id || session.flow !== flow) return null;
        return normalizeSession(session);
      }
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
      const draftSubstep: DecisionDraftSubstep =
        draft.step === 'event' || draft.step === 'input' || draft.step === 'context'
          ? draft.step
          : flow === 'event-outfit'
            ? 'event'
            : 'input';
      const session = normalizeSession({
        id: newId(),
        userId,
        flow,
        status: hasResult ? 'completed' : 'draft',
        contextHash: '',
        input: {
          text: draft.contextNotes || '',
          images: draft.images || [],
          imageDataUris: draft.imageDataUris || [],
          selectedContexts: draft.selectedContexts || [],
          selectedWardrobeIds: draft.selectedWardrobeIds || [],
          eventDetails: draft.eventDetails || emptyInput(flow).eventDetails,
          draftSubstep,
        },
        result: draft.response || null,
        isSurpriseMe: Boolean(draft.isSurpriseMe),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await this.persist(session);
      await AsyncStorage.removeItem(legacyDraftKey(userId, flow));
      return session;
    } catch {
      return null;
    }
  },

  /** Low-level persist after normalize. Refuses completed→empty-draft wipes. */
  async persist(session: DecisionSession): Promise<void> {
    if (!session.userId) return;
    const normalized = normalizeSession(session);
    try {
      const existingRaw = await AsyncStorage.getItem(sessionKey(normalized.userId, normalized.flow));
      if (existingRaw) {
        const existing = normalizeSession(JSON.parse(existingRaw) as DecisionSession);
        if (existing.result && !normalized.result) {
          console.warn('[DecisionSession] HARD BLOCK: refused wipe of result');
          return;
        }
      }

      if (!hasMeaningfulInput(normalized.input, normalized.result) && !normalized.result) {
        await AsyncStorage.removeItem(sessionKey(normalized.userId, normalized.flow));
        return;
      }

      const now = Date.now();
      const age = now - normalized.updatedAt;
      if (!normalized.result && age > DRAFT_TTL_MS) {
        await AsyncStorage.removeItem(sessionKey(normalized.userId, normalized.flow));
        return;
      }
      if (normalized.result && age > COMPLETED_TTL_MS) {
        await AsyncStorage.removeItem(sessionKey(normalized.userId, normalized.flow));
        return;
      }

      const slim: DecisionSession = {
        ...normalized,
        updatedAt: now,
        // Do not persist misleading step — load derives it
        step: undefined,
        input: {
          ...normalized.input,
          images: (normalized.input.images || []).filter(isStableImageUri),
          imageDataUris: slimDataUris(normalized.input.imageDataUris || []),
        },
        result: normalized.result
          ? {
              ...normalized.result,
              uploadedImages: (normalized.result.uploadedImages || [])
                .filter(isStableImageUri)
                .map((uri) => (uri.startsWith('data:') && uri.length > 50_000 ? '' : uri))
                .filter(Boolean),
            }
          : null,
      };
      await AsyncStorage.setItem(sessionKey(slim.userId, slim.flow), JSON.stringify(slim));
    } catch (error) {
      console.warn('[DecisionSession] persist failed:', error);
    }
  },

  /** @deprecated use persist — kept for call-site compatibility */
  async saveSession(session: DecisionSession): Promise<void> {
    return this.persist(session);
  },

  /**
   * Autosave draft input only. No-op if session already has a result.
   */
  async autosaveDraft(
    session: DecisionSession,
    patch: {
      input?: Partial<DecisionSessionInput>;
      isSurpriseMe?: boolean;
      contextHash?: string;
    },
  ): Promise<DecisionSession> {
    const next = applyDraftPatch(session, patch);
    if (session.result) {
      return normalizeSession(session);
    }
    await this.persist(next);
    return next;
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
    return normalizeSession({
      id: newId(),
      userId,
      flow,
      status: 'draft',
      contextHash,
      input: emptyInput(flow),
      result: null,
      isSurpriseMe: false,
      createdAt: now,
      updatedAt: now,
    });
  },

  async loadForScreen(
    userId: string,
    flow: DecisionFlow,
    currentHash: string,
  ): Promise<{ session: DecisionSession | null; step: DecisionSessionStep; brokenImageIndexes: number[] }> {
    let session = await this.getActiveSession(userId, flow);
    if (!session) return { session: null, step: flow === 'event-outfit' ? 'event' : 'input', brokenImageIndexes: [] };

    const sanitized = await sanitizeImages(session.input.images, session.input.imageDataUris);
    session = normalizeSession({
      ...session,
      input: {
        ...session.input,
        images: sanitized.images,
        imageDataUris: sanitized.imageDataUris,
      },
    });

    if (session.contextHash && currentHash && session.contextHash !== currentHash) {
      if (session.result) {
        session = normalizeSession({ ...session, status: 'stale' });
      } else {
        session = normalizeSession({ ...session, contextHash: currentHash, status: 'draft' });
      }
    }

    await this.persist(session);
    return {
      session,
      step: getDerivedStep(session),
      brokenImageIndexes: sanitized.brokenIndexes,
    };
  },

  markCompleted(session: DecisionSession, result: DecisionResponse, contextHash: string): DecisionSession {
    return normalizeSession({
      ...session,
      result,
      status: 'completed',
      contextHash,
      updatedAt: Date.now(),
    });
  },

  /** Explicit unlock only — the one path allowed to clear result. */
  markDraftForEdit(session: DecisionSession, contextHash: string): DecisionSession {
    return normalizeSession({
      ...session,
      status: 'draft',
      contextHash,
      result: null,
      input: {
        ...session.input,
        draftSubstep: session.flow === 'event-outfit' ? 'event' : 'input',
      },
      updatedAt: Date.now(),
    });
  },
};

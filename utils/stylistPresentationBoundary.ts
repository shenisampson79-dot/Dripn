/**
 * Client presentation boundary — keep in lockstep with
 * Dripn-Server/services/stylistPresentationBoundary.js
 *
 * Engine context is never eligible for direct rendering.
 * UI components receive SafePresentation only — never EngineDiagnostics.
 */

export const ENGINE_LEAK_SENTINEL = 'INTERNAL_ONLY_DO_NOT_RENDER';

export const INTERNAL_SENTINELS = {
  system: 'ZZ_INTERNAL_SYSTEM_DO_NOT_RENDER_91A7',
  work: 'ZZ_WORK_DRESS_CODE_SECRET_B82C',
  guard: 'ZZ_COMPAT_GUARD_INTERNAL_C44D',
  vision: 'ZZ_VISION_CONTEXT_PRIVATE_E19F',
  debug: 'ZZ_DEBUG_METADATA_PRIVATE_F73A',
} as const;

export const SAFE_FALLBACKS = {
  qsc: "I've got your look. If a piece fights the rest of the outfit, swap that piece only.",
  gon: "I couldn't lock a confident outfit from your wardrobe. Try again in a moment.",
  chat: "I couldn't finish that thought cleanly. Ask me again in a moment.",
  events: "I couldn't lock a confident event look. Try again in a moment.",
  shopping: "I couldn't compare those options confidently. Add a clearer photo or a short brief and I'll decide.",
} as const;

export const SAFE_SURFACE_FALLBACKS = {
  ...SAFE_FALLBACKS,
  qscAlternative: "I couldn't build a confident alternative from your wardrobe.",
  qscGuardReject: "This look doesn't work for that brief, and I couldn't lock a confident replacement.",
  qscFraming: "I couldn't get a confident read on this look. Try again with the full outfit clearly in frame.",
  gonScan: "I couldn't read that scan. Try again with the pieces clearly in frame.",
  gonLooks: "I couldn't build looks from your wardrobe. Try again in a moment.",
  gonImage: 'Image unavailable',
  chatClarify: "I lost the thread on that look. Tell me what you want to check.",
  chatRefuse: "That combination doesn't work together. Let's try a different mix from what you own.",
  chatIncomplete: "I couldn't complete a full look with a top, bottom, and shoes from your wardrobe yet. Tell me the occasion and I will rebuild from owned pieces only.",
  eventsIncomplete: "I couldn't complete a confident event look from your wardrobe.",
  shoppingUnsure: "I couldn't make a confident call on these options.",
  shoppingHandoff: 'Add a photo or a short brief and I can compare options clearly.',
} as const;

export const PRESENTATION_FAILURE = {
  VISION_NULL: 'vision_null',
  VISION_THROW: 'vision_throw',
  ALT_FAIL: 'alt_fail',
  WORK_FALLBACK: 'work_fallback',
  GUARD_REJECT: 'guard_reject',
  SCAN_FAIL: 'scan_fail',
  NO_CANDIDATE: 'no_candidate',
  PARTIAL_LOOK: 'partial_look',
  WORK_GEN_FAIL: 'work_gen_fail',
  HYDRATION_FAIL: 'hydration_fail',
  PIPELINE_THROW: 'pipeline_throw',
  GUARD_REFUSE: 'guard_refuse',
  CONTINUITY_MALFORMED: 'continuity_malformed',
  WORK_REQUEST: 'work_request',
  HYDRATION_PARTIAL: 'hydration_partial',
  EVENT_GEN_FAIL: 'event_gen_fail',
  EVENT_REJECT_ALL: 'event_reject_all',
  EVENT_OVERRIDE: 'event_override',
  EVENT_INCOMPLETE: 'event_incomplete',
  SHOP_VISION_FAIL: 'shop_vision_fail',
  SHOP_WORK_REJECT: 'shop_work_reject',
  SHOP_SOLVER_FAIL: 'shop_solver_fail',
  SHOP_HANDOFF: 'shop_handoff',
} as const;

export type PresentationSurface = keyof typeof SAFE_FALLBACKS;
export type PresentationFailure = typeof PRESENTATION_FAILURE[keyof typeof PRESENTATION_FAILURE];

export type CanonicalOutfitPiece = {
  id: string;
  name: string;
  role?: string;
  imageState?: 'ok' | 'unavailable';
  alt?: string;
};

export type CanonicalOutfitView = {
  itemIds: string[];
  canonicalItemIds: string[];
  proseItemIds: string[];
  pieces: CanonicalOutfitPiece[];
};

/** The only object UI components may render. */
export type SafePresentation = {
  surface: PresentationSurface;
  headline?: string;
  body: string;
  summary: string;
  bullets: string[];
  outfit: CanonicalOutfitView | null;
  looks: CanonicalOutfitView[];
  imageState?: 'ok' | 'unavailable' | 'partial' | null;
  errorCode?: string;
};

/** Internal only — never pass to <Text>. */
export type EngineDiagnostics = {
  prompt?: string;
  context?: string;
  guardReasons?: string[];
  rawVision?: unknown;
  debug?: unknown;
};

export const FORBIDDEN_VISIBLE_PATTERNS: RegExp[] = [
  /\bSYSTEM\b/,
  /internal[_ -]?context/i,
  /compatibility[_ -]?guard/i,
  /forceEngine/i,
  /workDressCode/i,
  /candidateIds?/i,
  /pieceIds?/i,
  /styleLane/i,
  /thermalWeight/i,
  /BELIEF_PROVEN/i,
  /YOLO_PROVEN/i,
  /prompt:/i,
  /workplace dress code from settings/i,
  /keep one clear style lane/i,
  /internal[_ -]?only/i,
  /system prompt/i,
];

export const VISIBLE_PAYLOAD_KEYS = [
  'decision',
  'recommendation',
  'stylistResponse',
  'message',
  'reasoning',
  'overallVerdict',
  'stylistNote',
  'outfitSummary',
  'confidenceNote',
  'ratingLabel',
  'text',
  'displayText',
  'explanation',
  'response',
  'fallback',
  'headline',
  'body',
  'summary',
] as const;

const ENGINE_LEAK_RES: RegExp[] = [
  new RegExp(ENGINE_LEAK_SENTINEL, 'i'),
  /\bWorkplace dress code from Settings\b/i,
  /\bjudge against this code\b/i,
  /\bgeneric office default\b/i,
  /\bKeep one clear style lane end to end\b/i,
  /\bINTERNAL[_A-Z0-9]{4,}\b/,
  /\bDEBUG[_A-Z0-9]{3,}\b/,
  /\bhardFail\b/i,
  /\bsoftBias\b/,
  /\bstyleScore\b/i,
  /\bdisplayState\s*[:=]/i,
  /\bwork_trainers_ban\b/,
  /\bperformance_trainer_tailored\b/,
  /\bCOMPAT_[A-Z_]+\b/,
  /\bhard_block\b/i,
  /\bUSER PROFILE\b/,
  /\bFASHION WISDOM\b/,
  /\bCRITICAL:\s*Use this profile\b/i,
  /\bNever recommend trainers or sneakers for this workplace\b/i,
  /\bTrainers only if they are clean\/minimal lifestyle\b/i,
  /ZZ_[A-Z0-9_]{8,}/,
];

const FATAL_ENGINE_LEAK_RES: RegExp[] = [
  new RegExp(ENGINE_LEAK_SENTINEL, 'i'),
  /\bINTERNAL[_A-Z0-9]{4,}\b/,
  /\bDEBUG[_A-Z0-9]{3,}\b/,
  /\bhardFail\b/i,
  /\bsoftBias\b/,
  /\bstyleScore\b/i,
  /\bdisplayState\s*[:=]/i,
  /\bwork_trainers_ban\b/,
  /\bperformance_trainer_tailored\b/,
  /\bCOMPAT_[A-Z_]+\b/,
  /\bhard_block\b/i,
  /\bUSER PROFILE\b/,
  /\bFASHION WISDOM\b/,
  /\bCRITICAL:\s*Use this profile\b/i,
  /ZZ_[A-Z0-9_]{8,}/,
];

export function containsEngineLeak(value?: string | null): boolean {
  const text = String(value || '');
  if (!text.trim()) return false;
  return ENGINE_LEAK_RES.some((re) => re.test(text));
}

export function isFatalEngineLeak(value?: string | null): boolean {
  const text = String(value || '');
  if (!text.trim()) return false;
  return FATAL_ENGINE_LEAK_RES.some((re) => re.test(text));
}

export function cannedFallback(surface: PresentationSurface = 'qsc'): string {
  return SAFE_FALLBACKS[surface] || SAFE_FALLBACKS.qsc;
}

export function presentText(raw?: string | null, surface: PresentationSurface = 'qsc'): string {
  const text = String(raw || '').trim();
  if (!text || containsEngineLeak(text)) return cannedFallback(surface);
  return text;
}

export function presentOptionalField(raw?: string | null, surface: PresentationSurface = 'qsc'): string {
  const text = String(raw || '').trim();
  if (!text || containsEngineLeak(text)) return '';
  if (text === cannedFallback(surface)) return '';
  return text;
}

function walkVisibleStrings(node: unknown, acc: string[]): string[] {
  if (node == null) return acc;
  if (typeof node === 'string') {
    acc.push(node);
    return acc;
  }
  if (Array.isArray(node)) {
    for (const item of node) walkVisibleStrings(item, acc);
    return acc;
  }
  if (typeof node !== 'object') return acc;
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if ((VISIBLE_PAYLOAD_KEYS as readonly string[]).includes(key) || typeof value === 'string') {
      if (typeof value === 'string') acc.push(value);
    }
    if (value && typeof value === 'object') walkVisibleStrings(value, acc);
  }
  return acc;
}

export function collectVisibleStrings(payload: unknown): string[] {
  return walkVisibleStrings(payload, []);
}

export function sealVisiblePayload<T extends Record<string, unknown>>(
  payload: T,
  { surface = 'qsc' }: { surface?: PresentationSurface } = {},
): T {
  if (!payload || typeof payload !== 'object') return payload;
  const next = { ...payload } as Record<string, unknown>;
  const fallback = cannedFallback(surface);
  for (const key of VISIBLE_PAYLOAD_KEYS) {
    if (typeof next[key] !== 'string') continue;
    next[key] = presentText(next[key] as string, surface);
    if (!next[key]) next[key] = fallback;
  }
  return next as T;
}

export function assertNoEngineLeak(payload: unknown, label = 'payload'): true {
  const leaked = collectVisibleStrings(payload).filter((s) => containsEngineLeak(s));
  if (leaked.length) {
    throw new Error(`${label}: engine leak in visible field: ${leaked[0].slice(0, 80)}`);
  }
  return true;
}

const HARD_FALLBACK_FAILURES = new Set<string>([
  PRESENTATION_FAILURE.VISION_NULL,
  PRESENTATION_FAILURE.VISION_THROW,
  PRESENTATION_FAILURE.ALT_FAIL,
  PRESENTATION_FAILURE.WORK_FALLBACK,
  PRESENTATION_FAILURE.GUARD_REJECT,
  PRESENTATION_FAILURE.SCAN_FAIL,
  PRESENTATION_FAILURE.NO_CANDIDATE,
  PRESENTATION_FAILURE.WORK_GEN_FAIL,
  PRESENTATION_FAILURE.PIPELINE_THROW,
  PRESENTATION_FAILURE.CONTINUITY_MALFORMED,
  PRESENTATION_FAILURE.EVENT_GEN_FAIL,
  PRESENTATION_FAILURE.EVENT_REJECT_ALL,
  PRESENTATION_FAILURE.EVENT_INCOMPLETE,
  PRESENTATION_FAILURE.SHOP_VISION_FAIL,
  PRESENTATION_FAILURE.SHOP_SOLVER_FAIL,
  PRESENTATION_FAILURE.SHOP_HANDOFF,
]);

const EMPTY_OUTFIT_FAILURES = new Set<string>([
  PRESENTATION_FAILURE.VISION_NULL,
  PRESENTATION_FAILURE.VISION_THROW,
  PRESENTATION_FAILURE.ALT_FAIL,
  PRESENTATION_FAILURE.WORK_FALLBACK,
  PRESENTATION_FAILURE.GUARD_REJECT,
  PRESENTATION_FAILURE.SCAN_FAIL,
  PRESENTATION_FAILURE.NO_CANDIDATE,
  PRESENTATION_FAILURE.WORK_GEN_FAIL,
  PRESENTATION_FAILURE.PIPELINE_THROW,
  PRESENTATION_FAILURE.GUARD_REFUSE,
  PRESENTATION_FAILURE.CONTINUITY_MALFORMED,
  PRESENTATION_FAILURE.EVENT_GEN_FAIL,
  PRESENTATION_FAILURE.EVENT_REJECT_ALL,
  PRESENTATION_FAILURE.EVENT_INCOMPLETE,
  PRESENTATION_FAILURE.SHOP_VISION_FAIL,
  PRESENTATION_FAILURE.SHOP_SOLVER_FAIL,
  PRESENTATION_FAILURE.SHOP_HANDOFF,
]);

export function fallbackForFailure(surface: PresentationSurface = 'qsc', failure?: string | null): string {
  switch (failure) {
    case PRESENTATION_FAILURE.ALT_FAIL:
      return SAFE_SURFACE_FALLBACKS.qscAlternative;
    case PRESENTATION_FAILURE.GUARD_REJECT:
      return SAFE_SURFACE_FALLBACKS.qscGuardReject;
    case PRESENTATION_FAILURE.SCAN_FAIL:
      return SAFE_SURFACE_FALLBACKS.gonScan;
    case PRESENTATION_FAILURE.NO_CANDIDATE:
    case PRESENTATION_FAILURE.WORK_GEN_FAIL:
      return SAFE_SURFACE_FALLBACKS.gonLooks;
    case PRESENTATION_FAILURE.GUARD_REFUSE:
      return SAFE_SURFACE_FALLBACKS.chatRefuse;
    case PRESENTATION_FAILURE.CONTINUITY_MALFORMED:
      return SAFE_SURFACE_FALLBACKS.chatClarify;
    case PRESENTATION_FAILURE.EVENT_REJECT_ALL:
    case PRESENTATION_FAILURE.EVENT_INCOMPLETE:
      return SAFE_SURFACE_FALLBACKS.eventsIncomplete;
    case PRESENTATION_FAILURE.SHOP_SOLVER_FAIL:
      return SAFE_SURFACE_FALLBACKS.shoppingUnsure;
    case PRESENTATION_FAILURE.SHOP_HANDOFF:
      return SAFE_SURFACE_FALLBACKS.shoppingHandoff;
    default:
      return cannedFallback(surface);
  }
}

function sealPiece(piece: Record<string, unknown> | null | undefined, surface: PresentationSurface): CanonicalOutfitPiece | null {
  if (!piece || typeof piece !== 'object') return null;
  const id = String(piece.id || piece.wardrobeItemId || '').trim();
  const name = presentOptionalField(typeof piece.name === 'string' ? piece.name : '', surface);
  if (!id || !name || containsEngineLeak(id) || containsEngineLeak(name)) return null;
  const imageState = piece.imageState === 'unavailable' ? 'unavailable' as const : 'ok' as const;
  return {
    id,
    name,
    role: presentOptionalField(typeof piece.role === 'string' ? piece.role : '', surface) || undefined,
    imageState,
    alt: imageState === 'unavailable' ? SAFE_SURFACE_FALLBACKS.gonImage : undefined,
  };
}

function sealOutfitView(outfit: Record<string, unknown> | null | undefined, surface: PresentationSurface): CanonicalOutfitView | null {
  if (!outfit || typeof outfit !== 'object') return null;
  const pieces = (Array.isArray(outfit.pieces) ? outfit.pieces : [])
    .map((p) => sealPiece(p as Record<string, unknown>, surface))
    .filter((p): p is CanonicalOutfitPiece => Boolean(p));
  const itemIds = pieces.map((p) => p.id);
  if (!itemIds.length) return null;
  const canonical = Array.isArray(outfit.canonicalItemIds) && outfit.canonicalItemIds.length
    ? outfit.canonicalItemIds.map(String)
    : itemIds;
  const prose = Array.isArray(outfit.proseItemIds) && outfit.proseItemIds.length
    ? outfit.proseItemIds.map(String)
    : itemIds;
  if (canonical.some((id) => containsEngineLeak(id)) || prose.some((id) => containsEngineLeak(id))) {
    return null;
  }
  return { itemIds, canonicalItemIds: canonical, proseItemIds: prose, pieces };
}

export function toSafePresentation(input: {
  surface?: PresentationSurface;
  failure?: string | null;
  modelOutput?: string | null;
  headline?: string | null;
  bullets?: string[];
  outfit?: Record<string, unknown> | null;
  looks?: Record<string, unknown>[];
  imageState?: SafePresentation['imageState'];
  diagnostics?: EngineDiagnostics;
} = {}): { presentation: SafePresentation; diagnostics: EngineDiagnostics } {
  const surface = input.surface || 'qsc';
  const failure = input.failure || null;
  const diagnostics = input.diagnostics && typeof input.diagnostics === 'object' ? input.diagnostics : {};
  const fallback = fallbackForFailure(surface, failure);
  const raw = input.modelOutput;
  const leaked = !String(raw || '').trim() || containsEngineLeak(raw) || isFatalEngineLeak(raw);
  const forceFallback = Boolean(failure) && (HARD_FALLBACK_FAILURES.has(failure) || leaked);
  const body = forceFallback ? fallback : presentText(raw, surface);
  const headline = presentOptionalField(input.headline, surface) || undefined;
  const bullets = (Array.isArray(input.bullets) ? input.bullets : [])
    .map((b) => presentOptionalField(b, surface))
    .filter(Boolean);

  let outfit: CanonicalOutfitView | null = null;
  let looks: CanonicalOutfitView[] = [];
  if (!failure || !EMPTY_OUTFIT_FAILURES.has(failure)) {
    if (Array.isArray(input.looks) && input.looks.length) {
      looks = input.looks
        .map((look) => sealOutfitView(look, surface))
        .filter((look): look is CanonicalOutfitView => Boolean(look));
    }
    outfit = sealOutfitView(input.outfit || null, surface);
  }

  let imageState = input.imageState || null;
  if (failure === PRESENTATION_FAILURE.HYDRATION_FAIL) {
    imageState = 'unavailable';
    if (outfit) {
      outfit = {
        ...outfit,
        pieces: outfit.pieces.map((p) => ({
          ...p,
          imageState: 'unavailable' as const,
          alt: SAFE_SURFACE_FALLBACKS.gonImage,
        })),
      };
    }
  } else if (failure === PRESENTATION_FAILURE.HYDRATION_PARTIAL && outfit) {
    imageState = 'partial';
  }

  return {
    presentation: {
      surface,
      headline,
      body,
      summary: body,
      bullets,
      outfit,
      looks,
      imageState,
      errorCode: failure || undefined,
    },
    diagnostics,
  };
}

export function assertNoInternalLeak(rendered: unknown, label = 'presentation'): true {
  const text = JSON.stringify(rendered ?? '');
  for (const sentinel of Object.values(INTERNAL_SENTINELS)) {
    if (text.includes(sentinel)) {
      throw new Error(`${label}: sentinel leaked: ${sentinel}`);
    }
  }
  if (text.includes(ENGINE_LEAK_SENTINEL)) {
    throw new Error(`${label}: ENGINE_LEAK_SENTINEL leaked`);
  }
  for (const re of FORBIDDEN_VISIBLE_PATTERNS) {
    if (re.test(text)) {
      throw new Error(`${label}: forbidden visible pattern ${re}`);
    }
  }
  return true;
}

export function assertCanonicalOutfitRender(
  presentation: SafePresentation,
  { mustBeEmpty = false }: { mustBeEmpty?: boolean } = {},
): true {
  const stripIds = [...(presentation?.outfit?.itemIds || [])].sort();
  const lookIds = (presentation?.looks || []).flatMap((look) => look.itemIds || []);
  if (mustBeEmpty) {
    if (stripIds.length || lookIds.length) {
      throw new Error('rejected / failed candidate pool rendered as an outfit');
    }
    return true;
  }
  if (!presentation?.outfit) return true;
  const canonical = [...(presentation.outfit.canonicalItemIds || presentation.outfit.itemIds || [])].sort();
  const prose = [...(presentation.outfit.proseItemIds || presentation.outfit.itemIds || [])].sort();
  if (JSON.stringify(stripIds) !== JSON.stringify(canonical)) {
    throw new Error('strip ids drifted from canonical outfit ids');
  }
  if (JSON.stringify(prose) !== JSON.stringify(stripIds)) {
    throw new Error('prose item ids drifted from strip ids');
  }
  return true;
}

export function poisonedEngineContext(): string {
  return [
    INTERNAL_SENTINELS.system,
    'Workplace dress code from Settings: Business casual.',
    INTERNAL_SENTINELS.work,
    'Keep one clear style lane.',
    INTERNAL_SENTINELS.guard,
    INTERNAL_SENTINELS.vision,
    INTERNAL_SENTINELS.debug,
    'workDressCode=business_casual forceEngine=true styleLane=office thermalWeight=2',
    'candidateIds=[rej-1,rej-2] pieceIds=[p-9] BELIEF_PROVEN YOLO_PROVEN prompt: SYSTEM',
  ].join('\n');
}

/**
 * Multi-day travel Chat success/failure UI — post-HTTP attachment contract.
 *
 * Keeps attachWardrobeVisualToMessage arity correct and soft-fails visuals
 * so a successful HTTP multi-day body is never discarded as generate failure.
 */

export const MULTI_DAY_GENERATE_FAIL_COPY =
  "I have the trip details but couldn't lock day looks just now. Try again in a moment — or add a few more tops, bottoms, and shoes.";

export const MULTI_DAY_SUCCESS_FALLBACK_COPY =
  "Here's your day-by-day plan from pieces you already own.";

export type MultiDayHttpSuccessBody = {
  content?: string;
  hasOutfitRecommendation?: boolean;
  travelClarify?: {
    flow?: string;
    state?: string;
    slots?: Record<string, unknown>;
  } | null;
  responseType?: string;
  lookCount?: number;
  looks?: Array<{
    role?: string | null;
    roleLabel?: string | null;
    label?: string | null;
    reason?: string | null;
    itemIds?: Array<string | number>;
  }>;
  wardrobeVisual?: unknown;
};

export type AttachWardrobeVisualContract = (
  message: Record<string, unknown>,
  userMessage: string,
  response: Record<string, unknown>,
  wardrobeItems: unknown[],
  subscriptionTier?: string | null,
) => Record<string, unknown>;

export type MultiDayAttachArgs = {
  message: Record<string, unknown>;
  userMessage: string;
  response: Record<string, unknown>;
  wardrobeItems: unknown[];
  subscriptionTier: string | null | undefined;
};

function buildTravelClarifyDone(
  multi: MultiDayHttpSuccessBody,
  fallbackSlots: Record<string, unknown>,
) {
  if (multi.travelClarify) {
    return {
      flow: String(multi.travelClarify.flow || 'multi_day_travel_clarify'),
      state: String(multi.travelClarify.state || 'DONE'),
      slots: (multi.travelClarify.slots as Record<string, unknown>) || fallbackSlots,
    };
  }
  return {
    flow: 'multi_day_travel_clarify',
    state: 'DONE',
    slots: fallbackSlots,
  };
}

/** Base assistant fields from a successful multi-day HTTP body (pre-attach). */
export function buildMultiDayBaseAssistantMessage(opts: {
  multi: MultiDayHttpSuccessBody;
  fallbackSlots: Record<string, unknown>;
  messageId?: string;
  nowIso?: string;
}): Record<string, unknown> {
  const content = opts.multi.content || MULTI_DAY_SUCCESS_FALLBACK_COPY;
  const travelClarify = buildTravelClarifyDone(opts.multi, opts.fallbackSlots);
  return {
    id: opts.messageId || `msg_${Date.now()}_assistant`,
    role: 'assistant',
    content,
    timestamp: opts.nowIso || new Date().toISOString(),
    travelClarify,
    responseType: opts.multi.responseType || 'multi',
    lookCount: opts.multi.lookCount,
    looks: opts.multi.looks,
    hasOutfitRecommendation: Boolean(opts.multi.hasOutfitRecommendation),
    visualAuthority: opts.multi.wardrobeVisual ? 'server' : null,
  };
}

/**
 * Correct 5-arg attach contract for multi-day (matches working Chat call sites).
 * Soft-fail: if attach throws, still return server content + multi-day metadata.
 */
export function attachMultiDaySuccessMessage(opts: {
  multi: MultiDayHttpSuccessBody;
  userMessage: string;
  fallbackSlots: Record<string, unknown>;
  wardrobeItems: unknown[];
  subscriptionTier?: string | null;
  messageId?: string;
  nowIso?: string;
  attachFn: AttachWardrobeVisualContract;
}): {
  message: Record<string, unknown>;
  softVisualFail: boolean;
  attachArgs: MultiDayAttachArgs;
} {
  const base = buildMultiDayBaseAssistantMessage({
    multi: opts.multi,
    fallbackSlots: opts.fallbackSlots,
    messageId: opts.messageId,
    nowIso: opts.nowIso,
  });

  const response: Record<string, unknown> = {
    content: base.content,
    wardrobeVisual: opts.multi.wardrobeVisual ?? null,
    visualAuthority: opts.multi.wardrobeVisual ? 'server' : null,
    hasOutfitRecommendation: Boolean(opts.multi.hasOutfitRecommendation),
    responseType: opts.multi.responseType || 'multi',
    lookCount: opts.multi.lookCount,
    looks: opts.multi.looks,
  };

  const attachArgs: MultiDayAttachArgs = {
    message: base,
    userMessage: String(opts.userMessage || ''),
    response,
    wardrobeItems: opts.wardrobeItems || [],
    subscriptionTier: opts.subscriptionTier ?? null,
  };

  try {
    const attached = opts.attachFn(
      attachArgs.message,
      attachArgs.userMessage,
      attachArgs.response,
      attachArgs.wardrobeItems,
      attachArgs.subscriptionTier,
    );
    return {
      message: {
        ...attached,
        // Preserve travelClarify even if attach spreads a thinner message.
        travelClarify: base.travelClarify,
        responseType: attached.responseType ?? base.responseType,
        lookCount: attached.lookCount ?? base.lookCount,
        looks: attached.looks ?? base.looks,
      },
      softVisualFail: false,
      attachArgs,
    };
  } catch {
    return {
      message: {
        ...base,
        // Soft-fail: keep plan text + metadata; drop only visual strip.
        visualAuthority: null,
        wardrobeVisual: undefined,
      },
      softVisualFail: true,
      attachArgs,
    };
  }
}

export function buildMultiDayHttpFailureMessage(opts: {
  fallbackSlots: Record<string, unknown>;
  messageId?: string;
  nowIso?: string;
}): Record<string, unknown> {
  return {
    id: opts.messageId || `msg_${Date.now()}_assistant`,
    role: 'assistant',
    content: MULTI_DAY_GENERATE_FAIL_COPY,
    timestamp: opts.nowIso || new Date().toISOString(),
    travelClarify: {
      flow: 'multi_day_travel_clarify',
      state: 'READY',
      slots: opts.fallbackSlots,
    },
  };
}

/**
 * Orchestrates post-HTTP UI: success → attach (soft visual); error → fail copy.
 * Returns the message array that would be passed to setMessages.
 */
export function resolveMultiDayGenerateUi(opts: {
  priorMessages: unknown[];
  result:
    | { ok: true; multi: MultiDayHttpSuccessBody }
    | { ok: false };
  userMessage: string;
  fallbackSlots: Record<string, unknown>;
  wardrobeItems: unknown[];
  subscriptionTier?: string | null;
  attachFn: AttachWardrobeVisualContract;
  messageId?: string;
  nowIso?: string;
}): {
  messages: unknown[];
  usedFailureCopy: boolean;
  softVisualFail: boolean;
  attachArgs: MultiDayAttachArgs | null;
  assistantMessage: Record<string, unknown>;
} {
  if (!opts.result.ok) {
    const assistantMessage = buildMultiDayHttpFailureMessage({
      fallbackSlots: opts.fallbackSlots,
      messageId: opts.messageId,
      nowIso: opts.nowIso,
    });
    return {
      messages: [...opts.priorMessages, assistantMessage],
      usedFailureCopy: true,
      softVisualFail: false,
      attachArgs: null,
      assistantMessage,
    };
  }

  const attached = attachMultiDaySuccessMessage({
    multi: opts.result.multi,
    userMessage: opts.userMessage,
    fallbackSlots: opts.fallbackSlots,
    wardrobeItems: opts.wardrobeItems,
    subscriptionTier: opts.subscriptionTier,
    messageId: opts.messageId,
    nowIso: opts.nowIso,
    attachFn: opts.attachFn,
  });

  return {
    messages: [...opts.priorMessages, attached.message],
    usedFailureCopy: false,
    softVisualFail: attached.softVisualFail,
    attachArgs: attached.attachArgs,
    assistantMessage: attached.message,
  };
}

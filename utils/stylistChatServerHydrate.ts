/**
 * Server hydrate helpers — mapping, acceptance, safe diagnostics (no message bodies).
 */

export type StylistChatHydrateMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
};

export type ServerHydrateDiagnosticOutcome =
  | 'stale_session'
  | 'tombstone_suppressed'
  | 'request_failed'
  | 'empty_history'
  | 'no_user_messages'
  | 'accepted';

export type ServerChatHistoryRow = {
  id?: number;
  role?: string;
  content?: string;
  createdAt?: string;
};

const SEED_MESSAGE_ID = 'msg_seed_init';

export function mapServerChatHistoryRows(
  serverHistory: ServerChatHistoryRow[],
): StylistChatHydrateMessage[] {
  if (!Array.isArray(serverHistory)) return [];
  return serverHistory
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
}

export function evaluateServerHydrateAcceptance(
  mapped: StylistChatHydrateMessage[],
): 'empty_history' | 'no_user_messages' | 'accepted' {
  if (!mapped.length) return 'empty_history';
  if (!mapped.some((m) => m.role === 'user')) return 'no_user_messages';
  return 'accepted';
}

function isSeedOnlyThread(msgs: StylistChatHydrateMessage[]): boolean {
  if (msgs.length === 0) return true;
  return (
    msgs.length === 1 &&
    msgs[0]?.role === 'assistant' &&
    (msgs[0].id === SEED_MESSAGE_ID || !msgs.some((m) => m.role === 'user'))
  );
}

/** Seed-only → server thread merge (matches AIStylistScreen progressive hydrate). */
export function applyServerHydrateMerge(
  prev: StylistChatHydrateMessage[],
  incoming: StylistChatHydrateMessage[],
): StylistChatHydrateMessage[] {
  if (!incoming.length) return prev;
  if (isSeedOnlyThread(prev) && (incoming.some((m) => m.role === 'user') || incoming.length > 1)) {
    return incoming.map((m, i) =>
      i === 0 && prev[0] && m.role === 'assistant' ? { ...m, id: prev[0].id } : m,
    );
  }
  return incoming;
}

export function logStylistChatServerHydrateDiagnostic(params: {
  outcome: ServerHydrateDiagnosticOutcome;
  stylistId: string;
  rawRowCount?: number;
  mappedRowCount?: number;
  userMessageCount?: number;
  requestError?: string;
}): void {
  const payload: Record<string, string | number> = {
    phase: 'server',
    outcome: params.outcome,
    stylist: String(params.stylistId || 'ruby').trim().toLowerCase(),
  };
  if (typeof params.rawRowCount === 'number') payload.rawRowCount = params.rawRowCount;
  if (typeof params.mappedRowCount === 'number') payload.mappedRowCount = params.mappedRowCount;
  if (typeof params.userMessageCount === 'number') payload.userMessageCount = params.userMessageCount;
  if (params.requestError) payload.requestError = params.requestError;
  console.log('[StylistChatHydrate]', JSON.stringify(payload));
}

export function sanitizeHydrateRequestError(error: unknown): string {
  if (error && typeof error === 'object') {
    const status = (error as { status?: number; statusCode?: number }).status
      ?? (error as { statusCode?: number }).statusCode;
    if (typeof status === 'number') return `http_${status}`;
    const code = (error as { code?: string }).code;
    if (typeof code === 'string' && code.trim()) return code.trim().slice(0, 40);
  }
  return 'request_failed';
}

import { isDevTestingModeEnabled } from '@/utils/devTesting';

export type TodaysOutfitTracePhase =
  | 'trigger'
  | 'generate'
  | 'validate'
  | 'render'
  | 'button_click'
  | 'cache_hit'
  | 'cache_miss'
  | 'timeout'
  | 'fallback';

export type TodaysOutfitTraceEntry = {
  at: number;
  phase: TodaysOutfitTracePhase;
  detail?: Record<string, unknown>;
};

const MAX_TRACE_ENTRIES = 80;
const traceLog: TodaysOutfitTraceEntry[] = [];
let traceEnabled: boolean | null = null;

async function shouldTrace(): Promise<boolean> {
  if (__DEV__) return true;
  if (traceEnabled == null) {
    traceEnabled = await isDevTestingModeEnabled().catch(() => false);
  }
  return traceEnabled;
}

export function getTodaysOutfitTraceLog(): readonly TodaysOutfitTraceEntry[] {
  return traceLog;
}

export function clearTodaysOutfitTraceLog(): void {
  traceLog.length = 0;
}

export async function traceTodaysOutfit(
  phase: TodaysOutfitTracePhase,
  detail?: Record<string, unknown>,
): Promise<void> {
  const entry: TodaysOutfitTraceEntry = { at: Date.now(), phase, detail };
  traceLog.push(entry);
  if (traceLog.length > MAX_TRACE_ENTRIES) traceLog.shift();

  if (!(await shouldTrace())) return;
  console.log(`[TodaysOutfit:${phase}]`, detail ?? '');
}

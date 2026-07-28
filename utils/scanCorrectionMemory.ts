/**
 * Session + light persistent learning from tap-to-correct on Digitize.
 * Instantly biases next labels in-session; persists category rename preferences.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@dripn/scan_label_corrections_v1';

export type ScanCategoryCorrection = {
  fromCategory: string;
  toCategory: string;
  count: number;
  updatedAt: number;
};

type Store = {
  categorySwaps: ScanCategoryCorrection[];
};

let memory: Store = { categorySwaps: [] };
let loaded = false;
const sessionSwaps: Array<{ from: string; to: string }> = [];

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Store;
    if (Array.isArray(parsed?.categorySwaps)) {
      memory = { categorySwaps: parsed.categorySwaps.slice(0, 40) };
    }
  } catch {
    memory = { categorySwaps: [] };
  }
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // ignore
  }
}

export async function loadScanCorrectionMemory(): Promise<void> {
  await ensureLoaded();
}

export function recordCategoryCorrection(fromCategory: string, toCategory: string): void {
  const from = String(fromCategory || '').toLowerCase().trim();
  const to = String(toCategory || '').toLowerCase().trim();
  if (!from || !to || from === to) return;

  sessionSwaps.push({ from, to });

  void (async () => {
    await ensureLoaded();
    const existing = memory.categorySwaps.find((row) => row.fromCategory === from && row.toCategory === to);
    if (existing) {
      existing.count += 1;
      existing.updatedAt = Date.now();
    } else {
      memory.categorySwaps.unshift({
        fromCategory: from,
        toCategory: to,
        count: 1,
        updatedAt: Date.now(),
      });
    }
    memory.categorySwaps = memory.categorySwaps
      .sort((a, b) => b.count - a.count || b.updatedAt - a.updatedAt)
      .slice(0, 40);
    await persist();
  })();
}

/**
 * Apply learned / session category bias to a fresh detection.
 * Repeated corrections (≥2) or same-session swaps auto-apply.
 */
export function preferCorrectedCategory(category: string): string {
  const from = String(category || '').toLowerCase().trim();
  if (!from) return category;

  const sessionHit = [...sessionSwaps].reverse().find((s) => s.from === from);
  if (sessionHit) return sessionHit.to;

  const strong = memory.categorySwaps.find(
    (row) => row.fromCategory === from && row.count >= 2,
  );
  if (strong) return strong.toCategory;

  return category;
}

export function clearSessionScanCorrections(): void {
  sessionSwaps.length = 0;
}

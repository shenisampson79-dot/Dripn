/**
 * Client ↔ server Core calendar sync.
 * Hash normalization must match server dfyPackageService.normalizeCoreCalendarForHash.
 */

import * as Crypto from 'expo-crypto';
import type { WardrobeItem } from '@/contexts/WardrobeContext';
import type { StylistId } from '@/services/DFYService';
import type { DFYCalendarMappedOutfit } from '@/utils/dfyCalendarBridge';

export const CORE_CALENDAR_ENGINE_VERSION = 'core_v2.0';

export type ClientCalendarDayTier = 'strict' | 'soft' | 'rotation' | 'emergency';

/** Must stay in sync with server normalizeCoreCalendarForHash */
export function normalizeCoreCalendarForHash(payload: {
  calendar?: Array<{
    day?: number;
    date?: string;
    outfit?: { items?: Array<{ id?: string | number }>; itemIds?: string[] };
  }>;
  duration?: number;
  engineVersion?: string | null;
  startDate?: string | null;
}) {
  const rows = Array.isArray(payload?.calendar) ? payload.calendar : [];
  const days = rows
    .map((entry, idx) => {
      const fromItems = (entry.outfit?.items || []).map((i) => String(i.id ?? ''));
      const fromIds = (entry.outfit?.itemIds || []).map(String);
      const itemIds = [...new Set([...fromItems, ...fromIds].filter(Boolean))].sort();
      return {
        date: String(entry.date || '').slice(0, 10),
        day: entry.day ?? idx + 1,
        itemIds,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.day - b.day);

  return {
    duration: payload?.duration ?? days.length,
    engineVersion: payload?.engineVersion || null,
    startDate: payload?.startDate ? String(payload.startDate).slice(0, 10) : null,
    days,
  };
}

export async function hashCoreCalendarPayload(payload: {
  calendar: Array<{
    day?: number;
    date?: string;
    outfit?: { items?: Array<{ id?: string | number }>; itemIds?: string[] };
  }>;
  duration?: number;
  engineVersion?: string | null;
  startDate?: string | null;
}): Promise<string> {
  const normalized = normalizeCoreCalendarForHash(payload);
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    JSON.stringify(normalized),
  );
}

export function buildWardrobeSnapshotHash(wardrobe: WardrobeItem[]): string {
  const ids = wardrobe.map((w) => String(w.id)).sort();
  // Lightweight fingerprint — server validates item ownership separately
  return `wardrobe_${ids.length}_${ids.slice(0, 5).join('-')}_${ids[ids.length - 1] || 'empty'}`;
}

export function buildCoreCalendarStoragePayload(
  outfits: DFYCalendarMappedOutfit[],
  params: {
    startDate: string;
    endDate: string;
    stylistId?: StylistId;
    engineVersion?: string;
    wardrobeSnapshotHash?: string;
    generatedAt?: string;
    dayTiers?: ClientCalendarDayTier[];
  },
) {
  const generatedAt = params.generatedAt || new Date().toISOString();
  const calendar = outfits.map((outfit, idx) => ({
    day: outfit.dayNumber || idx + 1,
    date: String(outfit.date).slice(0, 10),
    occasion: outfit.title,
    stylistNote: outfit.stylistNote,
    outfit: {
      items: outfit.itemIds.map((id) => ({ id })),
      itemIds: outfit.itemIds,
    },
    metadata: params.dayTiers?.[idx]
      ? { tier: params.dayTiers[idx], dayNumber: outfit.dayNumber || idx + 1 }
      : { dayNumber: outfit.dayNumber || idx + 1 },
  }));

  return {
    calendar,
    duration: outfits.length,
    startDate: params.startDate,
    endDate: params.endDate,
    generatedAt,
    engineVersion: params.engineVersion || CORE_CALENDAR_ENGINE_VERSION,
    wardrobeSnapshotHash: params.wardrobeSnapshotHash || null,
    stylistId: params.stylistId || 'ruby',
    tier: 'core' as const,
    source: 'client_allocator' as const,
  };
}

export async function buildClientCalendarSaveRequest(
  outfits: DFYCalendarMappedOutfit[],
  wardrobe: WardrobeItem[],
  params: {
    startDate: string;
    endDate: string;
    stylistId?: StylistId;
    dayTiers?: ClientCalendarDayTier[];
    force?: boolean;
  },
) {
  const generatedAt = new Date().toISOString();
  const storagePayload = buildCoreCalendarStoragePayload(outfits, {
    ...params,
    generatedAt,
    wardrobeSnapshotHash: buildWardrobeSnapshotHash(wardrobe),
  });

  const calendarHash = await hashCoreCalendarPayload(storagePayload);

  return {
    calendar: {
      days: storagePayload.calendar.map((row) => ({
        date: row.date,
        occasion: row.occasion,
        stylistNote: row.stylistNote,
        outfit: {
          itemIds: row.outfit.itemIds,
          metadata: row.metadata,
        },
      })),
    },
    startDate: params.startDate,
    endDate: params.endDate,
    duration: storagePayload.duration,
    generatedAt,
    engineVersion: storagePayload.engineVersion,
    wardrobeSnapshotHash: storagePayload.wardrobeSnapshotHash,
    calendarHash,
    stylistId: params.stylistId || 'ruby',
    force: params.force || false,
  };
}

export function pickNewerCalendarSource(
  localGeneratedAt?: string | null,
  remoteGeneratedAt?: string | null,
): 'local' | 'remote' | 'equal' {
  const localMs = localGeneratedAt ? new Date(localGeneratedAt).getTime() : 0;
  const remoteMs = remoteGeneratedAt ? new Date(remoteGeneratedAt).getTime() : 0;
  if (!localMs && !remoteMs) return 'equal';
  if (remoteMs > localMs) return 'remote';
  if (localMs > remoteMs) return 'local';
  return 'equal';
}

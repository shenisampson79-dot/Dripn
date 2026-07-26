/**
 * Local daily reminder for Today's Outfit at the user's "Appear at" hour.
 * Fires even when the app is closed (the previous 8am miss).
 * Times are Europe/London so UK 8am stays correct if the phone travels.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  getTodaysOutfitPopupPrefs,
  type TodaysOutfitPopupPrefs,
} from '@/utils/todaysOutfitPrefs';
import {
  dateKeyInTimeZone,
  nextDateAtHourInTimeZone,
  TODAYS_OUTFIT_TIMEZONE,
} from '@/utils/todaysOutfitTime';

export const TODAYS_OUTFIT_NOTIF_TYPE = 'todays_outfit';
const SCHEDULED_ID_KEY = '@dripn_todays_outfit_local_notif_id';
/** Set when notification fires or is tapped — TodaysOutfitCard opens the modal. */
export const TODAYS_OUTFIT_OPEN_PENDING_KEY = '@dripn_todays_outfit_open_pending';

export async function markTodaysOutfitOpenPending(): Promise<void> {
  try {
    await AsyncStorage.setItem(TODAYS_OUTFIT_OPEN_PENDING_KEY, '1');
  } catch {
    // non-fatal
  }
}

export async function peekTodaysOutfitOpenPending(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(TODAYS_OUTFIT_OPEN_PENDING_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function consumeTodaysOutfitOpenPending(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(TODAYS_OUTFIT_OPEN_PENDING_KEY);
    if (v !== '1') return false;
    await AsyncStorage.removeItem(TODAYS_OUTFIT_OPEN_PENDING_KEY);
    return true;
  } catch {
    return false;
  }
}

export function isTodaysOutfitNotification(
  data: Record<string, unknown> | undefined | null,
): boolean {
  return Boolean(data && data.type === TODAYS_OUTFIT_NOTIF_TYPE);
}

function notificationDayKey(when: unknown): string | null {
  if (when == null) return null;
  if (typeof when === 'number') {
    // Expo may report seconds or ms
    return dateKeyFromMs(when < 1e12 ? when * 1000 : when);
  }
  if (when instanceof Date) return dateKeyFromMs(when.getTime());
  if (typeof when === 'string') {
    const t = Date.parse(when);
    return Number.isFinite(t) ? dateKeyFromMs(t) : null;
  }
  return null;
}

function dateKeyFromMs(ms: number): string {
  return dateKeyInTimeZone(new Date(ms), TODAYS_OUTFIT_TIMEZONE);
}

/**
 * App-root bootstrap: mark open-pending + route to Stylist hub when the
 * Today's Outfit notification is tapped (including cold start).
 * TodaysOutfitCard consumes the pending flag and opens the modal.
 */
export function installTodaysOutfitNotificationOpenHandler(opts?: {
  navigateToStylistHub?: () => void;
}): () => void {
  if (Platform.OS === 'web') return () => {};

  const armOpen = async (data: Record<string, unknown> | undefined | null, when?: unknown) => {
    if (!isTodaysOutfitNotification(data)) return;
    const day = notificationDayKey(when);
    const today = dateKeyInTimeZone(new Date(), TODAYS_OUTFIT_TIMEZONE);
    if (day && day !== today) return;

    await markTodaysOutfitOpenPending();
    try {
      opts?.navigateToStylistHub?.();
    } catch {
      // ignore
    }
  };

  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    const data = notification.request.content.data as Record<string, unknown> | undefined;
    void armOpen(data, notification.date);
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as Record<string, unknown> | undefined;
    void armOpen(data, response.notification.date);
  });

  void (async () => {
    try {
      const last = await Notifications.getLastNotificationResponseAsync();
      if (!last) return;
      const data = last.notification.request.content.data as Record<string, unknown> | undefined;
      await armOpen(data, last.notification.date);
      // Prevent re-arming on every subsequent cold start with the same response.
      if (typeof (Notifications as any).clearLastNotificationResponseAsync === 'function') {
        await (Notifications as any).clearLastNotificationResponseAsync();
      }
    } catch {
      // ignore
    }
  })();

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}

async function cancelStoredSchedule(): Promise<void> {
  try {
    const id = await AsyncStorage.getItem(SCHEDULED_ID_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(SCHEDULED_ID_KEY);
    }
  } catch {
    // ignore
  }
  try {
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of pending) {
      const data = n.content?.data as Record<string, unknown> | undefined;
      if (isTodaysOutfitNotification(data)) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Schedule the next UK Appear-at notification (absolute DATE), then reschedule
 * on each app open so the chain continues without relying on fragile TZ triggers.
 */
export async function syncTodaysOutfitLocalNotification(
  prefs?: TodaysOutfitPopupPrefs | null,
): Promise<void> {
  if (Platform.OS === 'web') return;

  const resolved = prefs || (await getTodaysOutfitPopupPrefs());
  await cancelStoredSchedule();

  if (!resolved.enabled) return;

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') {
      console.warn('[TodaysOutfit] notification permission not granted — in-app popup only');
      return;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('todays-outfit', {
        name: "Today's Outfit",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const hour = Math.min(23, Math.max(0, Math.round(resolved.appearAtHour)));
    const fireAt = nextDateAtHourInTimeZone(hour, TODAYS_OUTFIT_TIMEZONE);
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Today's outfit is ready",
        body: 'Tap to see what to wear today',
        data: { type: TODAYS_OUTFIT_NOTIF_TYPE },
        sound: 'default',
        ...(Platform.OS === 'android' ? { channelId: 'todays-outfit' } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
      },
    });
    await AsyncStorage.setItem(SCHEDULED_ID_KEY, identifier);
    console.log(
      `[TodaysOutfit] next UK notification at ${fireAt.toISOString()} (${hour}:00 ${TODAYS_OUTFIT_TIMEZONE})`,
    );
  } catch (err) {
    console.warn('[TodaysOutfit] failed to schedule local notification:', err);
  }
}

import { Linking, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

/** Open HTTPS URLs in an in-app browser, falling back to the system browser on failure. */
export async function openExternalUrl(url: string): Promise<void> {
  if (!url?.startsWith('http')) {
    throw new Error('Invalid billing portal URL.');
  }

  try {
    await WebBrowser.openBrowserAsync(url, {
      dismissButtonStyle: 'close',
      showInRecents: true,
      ...(Platform.OS === 'android' ? { createTask: false } : {}),
    });
    return;
  } catch (webBrowserError: unknown) {
    const webMessage =
      webBrowserError instanceof Error ? webBrowserError.message : String(webBrowserError);

    const canOpen = await Linking.canOpenURL(url).catch(() => false);
    if (!canOpen) {
      throw new Error(
        webMessage || 'Could not open the billing page on this device. Try again or use a browser.',
      );
    }

    await Linking.openURL(url);
  }
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.trim()) return record.message;
    if (typeof record.error === 'string' && record.error.trim()) return record.error;
  }
  return fallback;
}

/**
 * Customer Live HUD chrome — score badge + headline pill.
 * Visible whenever a numeric score exists, including ~N and clash 41.
 * Holding a published snapshot must not hide the boxes.
 *
 * First-start only: with no published score yet, keep the same chrome
 * showing "—" and "Analysing…". Recalibration must not use this shell.
 */

import { isProvisionalLiveHeadline } from '@/utils/livePublishedIdentity';
import { headlineFromScore, isRemovedCustomerHeadline } from '@/utils/liveOutcomeContract';

export const LIVE_FIRST_START_HEADLINE = 'Analysing…';
export const LIVE_FIRST_START_SCORE = '—';
/** Wait until the camera preview has been showing, then reveal Analysing. */
export const LIVE_ANALYSING_AFTER_PREVIEW_MS = 1000;

/** Mirrors LiveStylistScreen awaitingFirstPublish — any feedback object owns the HUD. */
export function deriveLiveFirstPublishDashVisible(args: {
  liveState: 'idle' | 'starting' | 'camera-loading' | 'live' | 'error' | string;
  feedback: unknown;
  previewReadyAt: number | null;
  previewElapsedMs: number;
  delayMs?: number;
}): boolean {
  if (args.feedback) return false;
  if (args.liveState !== 'live' || args.previewReadyAt == null) return false;
  return shouldShowLoadingAfterPreview({
    hasPublishedScore: false,
    previewElapsedMs: args.previewElapsedMs,
    delayMs: args.delayMs,
  });
}

export function liveHudAwaitingFirstPublish(args: {
  sessionActive: boolean;
  hasPublishedScore: boolean;
  /** First camera frame / session visible, plus the preview delay. */
  previewReady?: boolean;
}): boolean {
  if (!args.sessionActive || args.hasPublishedScore) return false;
  return args.previewReady === true;
}

export function shouldShowLoadingAfterPreview(args: {
  hasPublishedScore: boolean;
  previewElapsedMs: number;
  delayMs?: number;
}): boolean {
  if (args.hasPublishedScore) return false;
  return args.previewElapsedMs >= (args.delayMs ?? LIVE_ANALYSING_AFTER_PREVIEW_MS);
}

export function liveHudChrome(args: {
  score: number | null | undefined;
  headline?: string | null;
  styleLane?: string | null;
  hasConflict?: boolean;
  awaitingFirstPublish?: boolean;
}): {
  showScore: boolean;
  showHeadline: boolean;
  headline: string;
  loadingShell: boolean;
  numericScore: number | null;
} {
  const n = Number(args.score);
  const showNumeric = args.score != null && Number.isFinite(n);
  if (showNumeric) {
    let headline = String(args.headline || '').trim();
    if (isProvisionalLiveHeadline(headline) || isRemovedCustomerHeadline(headline)) {
      headline = '';
    }
    if (!headline) {
      headline = headlineFromScore(n, args.styleLane);
    }
    return {
      showScore: true,
      showHeadline: Boolean(headline),
      headline,
      loadingShell: false,
      numericScore: n,
    };
  }
  if (args.awaitingFirstPublish) {
    return {
      showScore: true,
      showHeadline: true,
      headline: LIVE_FIRST_START_HEADLINE,
      loadingShell: true,
      numericScore: null,
    };
  }
  return {
    showScore: false,
    showHeadline: false,
    headline: '',
    loadingShell: false,
    numericScore: null,
  };
}

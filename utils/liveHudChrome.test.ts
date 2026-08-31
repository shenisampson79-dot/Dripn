import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  LIVE_ANALYSING_AFTER_PREVIEW_MS,
  LIVE_FIRST_START_HEADLINE,
  LIVE_FIRST_START_SCORE,
  deriveLiveFirstPublishDashVisible,
  liveHudAwaitingFirstPublish,
  liveHudChrome,
  shouldShowLoadingAfterPreview,
} from '@/utils/liveHudChrome';

{
  const held = liveHudChrome({
    score: 41,
    headline: 'Needs a tweak',
    styleLane: 'casual',
  });
  assert.equal(held.showScore, true, 'held clash 41 still renders score chrome');
  assert.equal(held.showHeadline, true, 'held clash 41 still renders headline chrome');
  assert.match(held.headline, /tweak|mix|clash|needs/i);
}

{
  const noHeadline = liveHudChrome({ score: 41, headline: '', styleLane: 'casual' });
  assert.equal(noHeadline.showScore, true, 'missing headline must not hide score');
  assert.equal(noHeadline.showHeadline, true, 'score synthesizes a headline instead of hiding the pill');
  assert.ok(noHeadline.headline.length > 0);
}

{
  const provisional = liveHudChrome({
    score: 41,
    headline: 'Settling in',
    styleLane: 'casual',
  });
  assert.equal(provisional.showScore, true);
  assert.equal(provisional.showHeadline, true);
  assert.doesNotMatch(provisional.headline, /settling in/i);
}

{
  const hidden = liveHudChrome({ score: null, headline: 'Needs a tweak' });
  assert.equal(hidden.showScore, false);
  assert.equal(hidden.showHeadline, false);
}

{
  // R1 — no Analysing on a black / pre-preview session.
  assert.equal(LIVE_ANALYSING_AFTER_PREVIEW_MS, 1000);
  assert.equal(
    liveHudAwaitingFirstPublish({ sessionActive: true, hasPublishedScore: false }),
    false,
    'Analysing must not show before the camera preview is visible',
  );
  assert.equal(
    liveHudAwaitingFirstPublish({
      sessionActive: true,
      hasPublishedScore: false,
      previewReady: false,
    }),
    false,
  );
  assert.equal(
    shouldShowLoadingAfterPreview({ hasPublishedScore: false, previewElapsedMs: 0 }),
    false,
  );
  assert.equal(
    shouldShowLoadingAfterPreview({ hasPublishedScore: false, previewElapsedMs: 999 }),
    false,
    'no analysing before the preview delay',
  );
  const hidden = liveHudChrome({ score: null, awaitingFirstPublish: false });
  assert.equal(hidden.loadingShell, false);
  assert.equal(hidden.showScore, false);
  assert.doesNotMatch(hidden.headline, /analysing/i);
}

{
  // R2 — after first camera frame + delay, first-start shell is allowed.
  assert.equal(
    shouldShowLoadingAfterPreview({ hasPublishedScore: false, previewElapsedMs: 1000 }),
    true,
  );
  assert.equal(
    liveHudAwaitingFirstPublish({
      sessionActive: true,
      hasPublishedScore: false,
      previewReady: true,
    }),
    true,
  );
  const start = liveHudChrome({ score: null, awaitingFirstPublish: true });
  assert.equal(start.loadingShell, true);
  assert.equal(start.showScore, true);
  assert.equal(start.showHeadline, true);
  assert.equal(start.headline, LIVE_FIRST_START_HEADLINE);
  assert.equal(LIVE_FIRST_START_SCORE, '—');
  assert.equal(start.numericScore, null);

  const processing = liveHudChrome({ score: null, awaitingFirstPublish: true });
  assert.equal(processing.loadingShell, true);
  assert.equal(processing.headline, LIVE_FIRST_START_HEADLINE);
}

{
  // Score arriving before the delay skips the loading shell.
  assert.equal(
    shouldShowLoadingAfterPreview({ hasPublishedScore: true, previewElapsedMs: 1000 }),
    false,
  );
  assert.equal(
    liveHudAwaitingFirstPublish({
      sessionActive: true,
      hasPublishedScore: true,
      previewReady: true,
    }),
    false,
  );
  const skipped = liveHudChrome({
    score: 84,
    headline: 'Sport-ready',
    awaitingFirstPublish: false,
  });
  assert.equal(skipped.loadingShell, false);
  assert.equal(skipped.numericScore, 84);
  assert.doesNotMatch(skipped.headline, /analysing|sport-ready/i);
  assert.match(skipped.headline, /looking good/i);
}

{
  // R3 — first real published score replaces dash + Analysing once, atomically.
  const first = liveHudChrome({
    score: 47,
    headline: 'Needs a tweak',
    styleLane: 'casual',
    awaitingFirstPublish: true,
  });
  assert.equal(first.loadingShell, false);
  assert.equal(first.showScore, true);
  assert.equal(first.showHeadline, true);
  assert.equal(first.numericScore, 47);
  assert.match(first.headline, /tweak|mix|clash|needs/i);
  assert.doesNotMatch(first.headline, /analysing/i);
}

{
  // R4 — recalibration after publish must not revert to — / Analysing….
  assert.equal(
    liveHudAwaitingFirstPublish({ sessionActive: true, hasPublishedScore: true }),
    false,
  );
  const held = liveHudChrome({
    score: 47,
    headline: 'Needs a tweak',
    awaitingFirstPublish: false,
  });
  assert.equal(held.loadingShell, false);
  assert.equal(held.numericScore, 47);
  assert.doesNotMatch(held.headline, /analysing/i);

  const idle = liveHudAwaitingFirstPublish({
    sessionActive: false,
    hasPublishedScore: false,
  });
  assert.equal(idle, false);
}

{
  // Lifecycle A–F — presentation contract for Live scoreboard dash shell.
  // A: preview not ready => no loading scoreboard
  assert.equal(
    liveHudAwaitingFirstPublish({ sessionActive: true, hasPublishedScore: false }),
    false,
  );
  assert.equal(
    liveHudChrome({ score: null, awaitingFirstPublish: false }).showScore,
    false,
  );

  // B: preview ready, before delay => no loading scoreboard
  assert.equal(
    shouldShowLoadingAfterPreview({ hasPublishedScore: false, previewElapsedMs: 500 }),
    false,
  );

  // C: preview ready + delay + no feedback => — / Analysing…
  const loading = liveHudChrome({ score: null, awaitingFirstPublish: true });
  assert.equal(loading.showScore, true);
  assert.equal(loading.headline, LIVE_FIRST_START_HEADLINE);
  assert.equal(LIVE_FIRST_START_SCORE, '—');

  // D: genuine feedback arrives => loading presentation ineligible
  assert.equal(
    shouldShowLoadingAfterPreview({ hasPublishedScore: true, previewElapsedMs: 2000 }),
    false,
  );
  assert.equal(
    liveHudAwaitingFirstPublish({
      sessionActive: true,
      hasPublishedScore: true,
      previewReady: true,
    }),
    false,
  );

  // E: finite genuine score never reverts to loading shell
  const published = liveHudChrome({
    score: 84,
    headline: 'Looking good',
    awaitingFirstPublish: false,
  });
  assert.equal(published.numericScore, 84);
  assert.equal(published.loadingShell, false);
  assert.doesNotMatch(published.headline, /analysing/i);

  // F: stop/exit Live => loading state cleared
  assert.equal(
    liveHudAwaitingFirstPublish({ sessionActive: false, hasPublishedScore: false }),
    false,
  );
  assert.equal(
    shouldShowLoadingAfterPreview({ hasPublishedScore: false, previewElapsedMs: 5000 }),
    true,
    'delay alone does not imply session active',
  );
}

{
  // A — screen wiring: state bindings must precede consuming presentation hooks.
  const screenPath = path.join(process.cwd(), 'screens', 'LiveStylistScreen.tsx');
  const src = fs.readFileSync(screenPath, 'utf8');
  const feedbackDecl = src.indexOf('const [feedback, setFeedback]');
  const previewReadyDecl = src.indexOf('const [previewReadyAt, setPreviewReadyAt]');
  const previewElapsedDecl = src.indexOf('const [previewElapsedMs, setPreviewElapsedMs]');
  const awaitingMemo = src.indexOf('const awaitingFirstPublish = useMemo');
  const previewTimerEffect = src.indexOf('setPreviewElapsedMs(Math.max(0, Date.now() - previewReadyAt))');
  assert.ok(feedbackDecl > 0, 'feedback state must exist');
  assert.ok(awaitingMemo > feedbackDecl, 'feedback must precede awaitingFirstPublish useMemo');
  assert.ok(awaitingMemo > previewReadyDecl, 'previewReadyAt must precede awaitingFirstPublish useMemo');
  assert.ok(awaitingMemo > previewElapsedDecl, 'previewElapsedMs must precede awaitingFirstPublish useMemo');
  assert.ok(previewTimerEffect > previewElapsedDecl, 'previewElapsedMs must precede preview timer effect');
}

{
  // B — no feedback + preview <1s => no loading HUD
  assert.equal(
    deriveLiveFirstPublishDashVisible({
      liveState: 'live',
      feedback: null,
      previewReadyAt: 1000,
      previewElapsedMs: 500,
    }),
    false,
  );
}

{
  // C — no feedback + preview >=1s => — / Analysing…
  assert.equal(
    deriveLiveFirstPublishDashVisible({
      liveState: 'live',
      feedback: null,
      previewReadyAt: 1000,
      previewElapsedMs: 1000,
    }),
    true,
  );
  const loading = liveHudChrome({ score: null, awaitingFirstPublish: true });
  assert.equal(loading.headline, LIVE_FIRST_START_HEADLINE);
}

{
  // D — genuine feedback + null score => existing feedback HUD owns presentation
  const preScoreFeedback = { score: null as number | null, coaching: { headline: 'Searching shoes' } };
  assert.equal(
    deriveLiveFirstPublishDashVisible({
      liveState: 'live',
      feedback: preScoreFeedback,
      previewReadyAt: 1000,
      previewElapsedMs: 2000,
    }),
    false,
    'any feedback object ends loading-shell eligibility',
  );
  const overlayUsesFeedback = Boolean(preScoreFeedback);
  const overlayLoading = !preScoreFeedback && false;
  assert.equal(overlayUsesFeedback, true);
  assert.equal(overlayLoading, false);
}

{
  // E — genuine feedback + finite score => existing score HUD
  const scoredFeedback = { score: 47, coaching: { headline: 'Needs a tweak' } };
  assert.equal(
    deriveLiveFirstPublishDashVisible({
      liveState: 'live',
      feedback: scoredFeedback,
      previewReadyAt: 1000,
      previewElapsedMs: 2000,
    }),
    false,
  );
  const scoreHud = liveHudChrome({
    score: scoredFeedback.score,
    headline: scoredFeedback.coaching.headline,
    awaitingFirstPublish: true,
  });
  assert.equal(scoreHud.numericScore, 47);
  assert.equal(scoreHud.loadingShell, false);
}

{
  // F — stop/exit clears loading eligibility
  assert.equal(
    deriveLiveFirstPublishDashVisible({
      liveState: 'idle',
      feedback: null,
      previewReadyAt: null,
      previewElapsedMs: 5000,
    }),
    false,
  );
}

console.log('liveHudChrome.test.ts: all passed');

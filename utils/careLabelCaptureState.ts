/**
 * Care-label capture UX state machine (Improve Recognition).
 * White → Amber (min dwell) → Green countdown → Capture.
 * Pure timing/stability logic — no RN imports.
 */

export type CareLabelCapturePhase = 'white' | 'amber' | 'green';

export type CareLabelPresenceBand = 'idle' | 'hold' | 'ready';

export const CARE_LABEL_CAPTURE = {
  /** Minimum time in amber before green is allowed. */
  amberMinMs: 900,
  /** Consecutive non-idle samples required after amber min before green. */
  amberStableSamples: 2,
  /** Countdown seconds once green locks. */
  countdownSec: 3,
} as const;

export type CareLabelCaptureState = {
  phase: CareLabelCapturePhase;
  amberEnteredAt: number | null;
  amberStableSamples: number;
  countdownActive: boolean;
};

export function createCareLabelCaptureState(): CareLabelCaptureState {
  return {
    phase: 'white',
    amberEnteredAt: null,
    amberStableSamples: 0,
    countdownActive: false,
  };
}

export function presenceBandFromUi(ui: 'idle' | 'hold' | 'ready'): CareLabelPresenceBand {
  if (ui === 'ready') return 'ready';
  if (ui === 'hold') return 'hold';
  return 'idle';
}

/**
 * Advance phase from a presence sample.
 * Returns next state + whether to start / cancel countdown.
 */
export function advanceCareLabelCapture(
  prev: CareLabelCaptureState,
  band: CareLabelPresenceBand,
  nowMs: number,
  opts: {
    amberMinMs?: number;
    amberStableSamples?: number;
  } = {},
): {
  state: CareLabelCaptureState;
  startCountdown: boolean;
  cancelCountdown: boolean;
  hint: string;
} {
  const amberMinMs = opts.amberMinMs ?? CARE_LABEL_CAPTURE.amberMinMs;
  const needStable = opts.amberStableSamples ?? CARE_LABEL_CAPTURE.amberStableSamples;

  // Lost label — always reset
  if (band === 'idle') {
    return {
      state: createCareLabelCaptureState(),
      startCountdown: false,
      cancelCountdown: prev.countdownActive || prev.phase !== 'white',
      hint: 'Fill the tall box with the care label',
    };
  }

  // During green countdown, any drop below ready cancels
  if (prev.countdownActive) {
    if (band !== 'ready') {
      return {
        state: {
          phase: 'amber',
          amberEnteredAt: nowMs,
          amberStableSamples: band === 'hold' ? 1 : 0,
          countdownActive: false,
        },
        startCountdown: false,
        cancelCountdown: true,
        hint: 'Label spotted — hold steady',
      };
    }
    return {
      state: prev,
      startCountdown: false,
      cancelCountdown: false,
      hint: 'Hold still — capturing…',
    };
  }

  // Enter / stay amber
  const amberEnteredAt = prev.phase === 'white' || prev.amberEnteredAt == null
    ? nowMs
    : prev.amberEnteredAt;
  const amberAge = nowMs - amberEnteredAt;
  const amberStableSamples = prev.phase === 'amber'
    ? prev.amberStableSamples + 1
    : 1;

  if (amberAge < amberMinMs || amberStableSamples < needStable || band !== 'ready') {
    return {
      state: {
        phase: 'amber',
        amberEnteredAt,
        amberStableSamples,
        countdownActive: false,
      },
      startCountdown: false,
      cancelCountdown: false,
      hint: 'Label spotted — hold steady',
    };
  }

  // Amber satisfied + ready → green countdown
  return {
    state: {
      phase: 'green',
      amberEnteredAt,
      amberStableSamples,
      countdownActive: true,
    },
    startCountdown: true,
    cancelCountdown: false,
    hint: 'Hold still — capturing…',
  };
}

export function improveRecognitionSuccessCopy(outcome: 'full' | 'front_only' | 'label_unread'): {
  title: string;
  body: string;
} {
  if (outcome === 'full') {
    return {
      title: 'Got it',
      body: 'This will help us recognise this garment faster next time.',
    };
  }
  if (outcome === 'front_only') {
    return {
      title: 'Front saved',
      body: 'We saved a visual fingerprint from the front photo. You can add a care label later to improve recognition further.',
    };
  }
  return {
    title: 'Almost',
    body: 'Front fingerprint saved, but that photo didn’t look like a care label. Try again with a sharper close-up of the tag.',
  };
}

export function improveRecognitionFailCopy(): { title: string; body: string } {
  return {
    title: 'Not a care label',
    body: 'That didn’t look like a care label — try again with the tag filling the tall box.',
  };
}

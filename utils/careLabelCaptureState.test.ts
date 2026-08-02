/**
 * Run: npx tsx utils/careLabelCaptureState.test.ts
 */
import assert from 'node:assert/strict';
import {
  advanceCareLabelCapture,
  createCareLabelCaptureState,
  CARE_LABEL_CAPTURE,
  improveRecognitionFailCopy,
  improveRecognitionSuccessCopy,
} from './careLabelCaptureState';

let s = createCareLabelCaptureState();
let r = advanceCareLabelCapture(s, 'hold', 1000);
assert.equal(r.state.phase, 'amber');
assert.match(r.hint, /hold steady/i);
assert.equal(r.startCountdown, false);

// Too soon for green even if ready
r = advanceCareLabelCapture(r.state, 'ready', 1000 + CARE_LABEL_CAPTURE.amberMinMs - 100);
assert.equal(r.state.phase, 'amber');
assert.equal(r.startCountdown, false);

// After min amber + enough samples + ready → green
r = advanceCareLabelCapture(r.state, 'ready', 1000 + CARE_LABEL_CAPTURE.amberMinMs + 50);
assert.equal(r.state.phase, 'green');
assert.equal(r.startCountdown, true);

// Lose lock during countdown
r = advanceCareLabelCapture(
  { ...r.state, countdownActive: true },
  'idle',
  5000,
);
assert.equal(r.state.phase, 'white');
assert.equal(r.cancelCountdown, true);

const ok = improveRecognitionSuccessCopy('full');
assert.match(ok.body, /help us recognise/i);
assert.doesNotMatch(ok.body, /perfect|instantly/i);

const fail = improveRecognitionFailCopy();
assert.match(fail.body, /didn’t look like a care label/i);

console.log('careLabelCaptureState.test.ts: all passed');

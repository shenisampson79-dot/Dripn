import assert from 'node:assert/strict';
import {
  encodedFrameLength,
  encodedFrameLengthDelta,
  hasMeaningfulLiveSceneChange,
} from './liveFrameHash';

assert.equal(encodedFrameLength('rs_hash'), 1000);
assert.equal(encodedFrameLengthDelta('rs_a', 'rs_b'), 0);
assert.ok(encodedFrameLengthDelta('rs_a', '1jk_b') > 0.4);

const baseTop = {
  category: 'tops',
  subcategory: 'top',
  name: 'Beige top',
  color: 'beige',
  confidence: 0.9,
  bbox: [0.3, 0.2, 0.35, 0.45],
};

assert.equal(
  hasMeaningfulLiveSceneChange([baseTop], [{ ...baseTop, bbox: [0.3, 0.2, 0.36, 0.45] }]),
  false,
  'small box jitter is not a scene change',
);

assert.equal(
  hasMeaningfulLiveSceneChange([baseTop], [{
    ...baseTop,
    name: 'Black Leather Jacket',
    category: 'outerwear',
    subcategory: 'jacket',
    color: 'black',
    confidence: 0.88,
  }]),
  true,
  'new outer layer triggers cloud',
);

assert.equal(
  hasMeaningfulLiveSceneChange([baseTop], [{ ...baseTop, color: 'black', confidence: 0.8 }]),
  true,
  'large upper colour replacement triggers cloud even if YOLO keeps generic top',
);

assert.equal(
  hasMeaningfulLiveSceneChange([baseTop], [{ ...baseTop, bbox: [0.25, 0.18, 0.46, 0.5] }]),
  true,
  'silhouette expansion triggers cloud',
);

assert.equal(
  hasMeaningfulLiveSceneChange([baseTop], [baseTop], 'rs_old', 'rs_new'),
  false,
  'hash content alone is not treated as perceptual change',
);

assert.equal(
  hasMeaningfulLiveSceneChange([baseTop], [baseTop], 'rs_old', '1jk_new'),
  true,
  'large cumulative encoded-frame shift is a fallback event',
);

console.log('liveFrameHash.test.ts: all passed');

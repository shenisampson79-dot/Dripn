import assert from 'node:assert/strict';

import {
  detectSuspectLiveRead,
  hasUnreliableColour,
  looksTooLongForShorts,
} from '@/utils/liveSuspectRead';
import type { OnDeviceDetection } from '@/services/onDeviceGarmentDetector';

function det(over: Partial<OnDeviceDetection>): OnDeviceDetection {
  return {
    name: 'Item',
    category: 'bottoms',
    confidence: 0.9,
    bbox: [0.3, 0.5, 0.3, 0.14],
    ...over,
  } as OnDeviceDetection;
}

// Field case: floral trousers labelled "Blue shorts" with a box running to mid-calf.
assert.equal(
  looksTooLongForShorts(det({
    subcategory: 'shorts',
    name: 'Blue Shorts',
    bbox: [0.31, 0.42, 0.3, 0.24],
  })),
  true,
);

// Real shorts sitting above the knee are not suspicious.
assert.equal(
  looksTooLongForShorts(det({
    subcategory: 'shorts',
    name: 'Beige Shorts',
    bbox: [0.32, 0.44, 0.28, 0.13],
  })),
  false,
);

// Vision-confirmed swim shorts keep their identity even on a tall box.
assert.equal(
  looksTooLongForShorts(det({
    subcategory: 'swim_shorts',
    name: 'Blue Swim Shorts',
    bbox: [0.3, 0.42, 0.3, 0.26],
  })),
  false,
);

// Trousers labels are never questioned for being long.
assert.equal(
  looksTooLongForShorts(det({ subcategory: 'trousers', name: 'Blue Trousers', bbox: [0.3, 0.42, 0.3, 0.5] })),
  false,
);

assert.equal(hasUnreliableColour(det({ color: 'other' })), true);
assert.equal(hasUnreliableColour(det({ color: 'unknown' })), true);
assert.equal(hasUnreliableColour(det({ color: undefined })), true);
assert.equal(hasUnreliableColour(det({ color: 'pink' })), false);

// Length outranks colour: a wrong garment type moves the score, colour only copy.
{
  const suspect = detectSuspectLiveRead([
    det({ category: 'tops', subcategory: 'top', color: 'other', bbox: [0.25, 0.12, 0.4, 0.3] }),
    det({ subcategory: 'shorts', name: 'Blue Shorts', bbox: [0.31, 0.42, 0.3, 0.24] }),
  ]);
  assert.equal(suspect?.reason, 'bottom_length');
}

{
  const suspect = detectSuspectLiveRead([
    det({ category: 'tops', subcategory: 'top', color: 'other', bbox: [0.25, 0.12, 0.4, 0.3] }),
    det({ subcategory: 'shorts', name: 'Beige Shorts', color: 'beige', bbox: [0.32, 0.44, 0.28, 0.13] }),
  ]);
  assert.equal(suspect?.reason, 'garment_colour');
}

// A coherent read must not spend a cloud call.
assert.equal(
  detectSuspectLiveRead([
    det({ category: 'tops', subcategory: 't-shirt', color: 'white', bbox: [0.25, 0.12, 0.4, 0.3] }),
    det({ subcategory: 'shorts', color: 'beige', name: 'Beige Shorts', bbox: [0.32, 0.44, 0.28, 0.13] }),
    det({ category: 'shoes', subcategory: 'sneakers', color: 'white', bbox: [0.34, 0.86, 0.26, 0.1] }),
  ]),
  null,
);

console.log('liveSuspectRead.test.ts: all passed');

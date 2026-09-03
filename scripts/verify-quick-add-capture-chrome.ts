/**
 * Quick Add capture chrome — customer instruction + no diagnostic overlay.
 * Run: npx tsx scripts/verify-quick-add-capture-chrome.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'screens/QuickAddScreen.tsx'), 'utf8');
const wardrobeSrc = fs.readFileSync(path.join(root, 'screens/WardrobeScreen.tsx'), 'utf8');

const cameraStart = src.lastIndexOf('<CameraView');
const stylesStart = src.lastIndexOf('const styles = StyleSheet.create');
assert.ok(cameraStart >= 0 && stylesStart > cameraStart, 'camera chrome slice');
const cameraUi = src.slice(cameraStart, stylesStart);

assert.match(src, /Centre the garment, then tap Capture/, 'customer instruction copy');
assert.equal(
  cameraUi.includes('Centre the garment in the box — tap Capture'),
  false,
  'old instruction must not appear in the capture chrome',
);
assert.equal(cameraUi.includes('white → amber → green'), false, 'no white/amber/green diagnostic copy');
assert.equal(cameraUi.includes('Trace armed'), false, 'no trace-armed diagnostic copy');
assert.equal(cameraUi.includes('overflow OK'), false, 'no overflow-OK diagnostic copy');
assert.equal(cameraUi.includes('Copy {traceCount}'), false, 'no copy-counter in production chrome');

assert.equal(cameraUi.includes('{hint}'), false, 'hint must not overlay the camera target');
assert.match(cameraUi, /styles\.frame/, 'guide rectangle retained');
assert.match(src, /handleCapture/, 'capture handler retained');
assert.match(src, /handleGallery/, 'gallery control retained');
assert.match(src, /setFacing/, 'camera-switch retained');
assert.match(src, /setTorch/, 'flash retained');
assert.match(src, /navigation\.goBack\(\)/, 'close retained');
assert.match(src, /copyQuickAddTrace/, 'trace/copy implementation retained');
assert.match(src, /sampleForAutoCapture/, 'YOLO sample loop retained');
assert.match(src, /takePictureAsync/, 'camera capture retained');
assert.match(wardrobeSrc, /navigate\("QuickAdd"\)/, 'Wardrobe Quick Add entry retained');

console.log('verify-quick-add-capture-chrome: all passed');

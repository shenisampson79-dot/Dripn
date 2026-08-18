/**
 * Run: npx tsx utils/livePreviewBbox.test.ts
 */
import assert from 'node:assert/strict';

import {
  computePreviewFit,
  formatLiveBboxDiagnostic,
  liveBboxDiagnostic,
  mapNormalizedBboxToPreview,
} from '@/utils/livePreviewBbox';

// Same aspect: cover is identity (naive nx*previewW).
{
  const fit = computePreviewFit(360, 640, 360, 640, 'cover');
  assert.equal(fit.scale, 1);
  assert.equal(fit.offsetX, 0);
  assert.equal(fit.offsetY, 0);
  const box = mapNormalizedBboxToPreview([0.2, 0.1, 0.5, 0.3], fit);
  assert.equal(box.x, 72);
  assert.equal(box.y, 64);
  assert.equal(box.w, 180);
  assert.equal(box.h, 192);
}

// Taller source on shorter preview (cover): crop top+bottom so tops are not stretched onto legs.
{
  const srcW = 360;
  const srcH = 780;
  const previewW = 390;
  const previewH = 657;
  const fit = computePreviewFit(srcW, srcH, previewW, previewH, 'cover');
  assert.ok(fit.scale > 1);
  assert.ok(fit.offsetY < 0, 'cover crops overflow on Y');
  const top = mapNormalizedBboxToPreview([0.2, 0.12, 0.5, 0.28], fit);
  const naiveY = 0.12 * previewH;
  assert.ok(top.y < naiveY, 'cover Y sits higher than naive stretch (not on legs/feet)');
  const shorts = mapNormalizedBboxToPreview([0.28, 0.42, 0.38, 0.22], fit);
  const shortsBottom = shorts.y + shorts.h;
  assert.ok(shortsBottom < previewH * 0.85, 'shorts box must not sit on feet under cover crop');
}

// Landscape source on portrait preview (cover): crop sides, Y fills preview.
{
  const fit = computePreviewFit(640, 360, 390, 657, 'cover');
  assert.equal(Number(fit.offsetY.toFixed(2)), 0);
  assert.ok(fit.offsetX < 0, 'cover crops overflow on X');
  const box = mapNormalizedBboxToPreview([0.4, 0.5, 0.2, 0.2], fit);
  assert.equal(Number(box.y.toFixed(1)), Number((0.5 * 657).toFixed(1)));
}

// Contain letterboxes rather than crops.
{
  const fit = computePreviewFit(640, 360, 390, 657, 'contain');
  assert.ok(fit.offsetY > 0);
  assert.ok(Math.abs(fit.offsetX) < 1);
}

{
  const fit = computePreviewFit(360, 640, 390, 700, 'cover');
  const d = liveBboxDiagnostic([0.25, 0.1, 0.5, 0.3], fit);
  const line = formatLiveBboxDiagnostic(d);
  assert.match(line, /srcW=360/);
  assert.match(line, /srcH=640/);
  assert.match(line, /previewW=390/);
  assert.match(line, /previewH=700/);
  assert.match(line, /fit=cover/);
  assert.match(line, /scale=/);
  assert.match(line, /offsetX=/);
  assert.match(line, /offsetY=/);
  assert.match(line, /bbox=\[/);
  assert.match(line, /screen=\[/);
}

console.log('livePreviewBbox.test.ts: all passed');

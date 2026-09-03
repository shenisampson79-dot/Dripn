/**
 * Bulk Add review list must render when a pending item needs review.
 * Run: npx tsx utils/bulkAddLowConfidenceReview.test.ts
 *
 * Production crash: review JSX referenced unbound LUXURY_COLORS while the
 * screen only imported LuxuryColors. High-confidence batches never entered
 * that branch.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'screens/BulkWardrobeUploadScreen.tsx'), 'utf8');
const themeSrc = readFileSync(join(root, 'constants/theme.ts'), 'utf8');

type PendingReviewItem = {
  needsReview: boolean;
  confidence: number;
};

function sliceFn(haystack: string, startNeedle: string, endNeedle: string): string {
  const start = haystack.indexOf(startNeedle);
  const end = haystack.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0 && end > start, `could not slice ${startNeedle}`);
  return haystack.slice(start, end);
}

function importedThemeNames(screenSrc: string): string[] {
  const match = screenSrc.match(/import\s*\{([^}]+)\}\s*from\s*['"]@\/constants\/theme['"]/);
  assert.ok(match, 'Bulk Add must import colours from @/constants/theme');
  return match[1]
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const aliased = part.match(/^(\w+)\s+as\s+(\w+)$/);
      return aliased ? aliased[2] : part;
    });
}

function luxuryGoldFromTheme(): string {
  const gold = themeSrc.match(/export const LuxuryColors = \{[\s\S]*?\bgold:\s*['"](#[0-9A-Fa-f]+)['"]/);
  assert.ok(gold, 'LuxuryColors.gold must remain in constants/theme.ts');
  return gold[1];
}

function themeValueForImport(name: string): unknown {
  if (name === 'LuxuryColors' || name === 'LUXURY_COLORS') {
    return { gold: luxuryGoldFromTheme() };
  }
  return {};
}

function evalWithScreenThemeScope(expr: string, imported: string[]): unknown {
  const fn = new Function(
    ...imported,
    `"use strict"; return (${expr});`,
  ) as (...args: unknown[]) => unknown;
  return fn(...imported.map(themeValueForImport));
}

function reviewColorExprs(slice: string): string[] {
  const exprs: string[] = [];
  const re =
    /\b(?:LUXURY_COLORS|LuxuryColors)\.[A-Za-z0-9_]+(?:\s*\+\s*['"][^'"]+['"])?/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(slice))) {
    exprs.push(match[0]);
  }
  assert.ok(exprs.length > 0, 'review UI must still use the LuxuryColors palette');
  return exprs;
}

function needsReviewChrome(item: PendingReviewItem): boolean {
  return item.needsReview || item.confidence < 0.7;
}

function renderReviewState(items: PendingReviewItem[], imported: string[]): {
  captionColors: unknown[];
  bannerColors: unknown[];
} {
  const itemSlice = sliceFn(src, 'const renderPendingItem', 'const renderPendingItems');
  const listSlice = sliceFn(src, 'const renderPendingItems', 'const renderEditModal');
  const captionExprs = reviewColorExprs(itemSlice);
  const bannerExprs = reviewColorExprs(listSlice);

  const captionColors: unknown[] = [];
  for (const item of items) {
    if (!needsReviewChrome(item)) continue;
    for (const expr of captionExprs) {
      captionColors.push(evalWithScreenThemeScope(expr, imported));
    }
  }

  const bannerColors: unknown[] = [];
  const needsCheckCount = items.filter(needsReviewChrome).length;
  if (needsCheckCount > 0) {
    for (const expr of bannerExprs) {
      bannerColors.push(evalWithScreenThemeScope(expr, imported));
    }
  }

  return { captionColors, bannerColors };
}

const imported = importedThemeNames(src);
assert.ok(
  imported.includes('LuxuryColors'),
  'screen must keep the existing LuxuryColors import',
);

assert.match(
  src,
  /item\.needsReview \|\| item\.confidence < 0\.7/,
  'per-item low-confidence / needsReview caption retained',
);
assert.match(
  src,
  /i\.needsReview \|\| i\.confidence < 0\.7/,
  'review-banner count still uses needsReview or confidence < 0.7',
);

{
  const needsReviewItem: PendingReviewItem = { needsReview: true, confidence: 0.92 };
  const rendered = renderReviewState([needsReviewItem], imported);
  assert.ok(rendered.captionColors.length > 0, 'needsReview item must paint the caption');
  assert.ok(rendered.bannerColors.length > 0, 'needsReview item must paint the review banner');
  for (const color of [...rendered.captionColors, ...rendered.bannerColors]) {
    assert.equal(typeof color, 'string');
    assert.match(String(color), /^#/);
  }
}

{
  const lowConfidenceItem: PendingReviewItem = { needsReview: false, confidence: 0.4 };
  const rendered = renderReviewState([lowConfidenceItem], imported);
  assert.ok(rendered.captionColors.length > 0, 'confidence < 0.7 must paint the caption');
  assert.ok(rendered.bannerColors.length > 0, 'confidence < 0.7 must paint the review banner');
}

{
  const highConfidenceItem: PendingReviewItem = { needsReview: false, confidence: 0.95 };
  const rendered = renderReviewState([highConfidenceItem], imported);
  assert.equal(rendered.captionColors.length, 0, 'high-confidence items skip review chrome');
  assert.equal(rendered.bannerColors.length, 0, 'high-confidence items skip review banner');
}

console.log('bulkAddLowConfidenceReview: all passed');

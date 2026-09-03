/**
 * My Wardrobe empty-state / top-actions contract.
 * Run: npx tsx scripts/verify-wardrobe-empty-actions.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const wardrobeSrc = fs.readFileSync(path.join(root, 'screens/WardrobeScreen.tsx'), 'utf8');
const stackSrc = fs.readFileSync(path.join(root, 'navigation/WardrobeStackNavigator.tsx'), 'utf8');

function sliceFn(src: string, startNeedle: string, endNeedle: string): string {
  const start = src.indexOf(startNeedle);
  const end = src.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(start >= 0 && end > start, `could not slice ${startNeedle}`);
  return src.slice(start, end);
}

const actionsBar = sliceFn(wardrobeSrc, 'const renderQuickActionsBar', 'const renderWardrobeItem');
const emptyState = sliceFn(wardrobeSrc, 'const renderEmptyState = () =>', 'const renderListEmptyComponent');
const emptyCategory = sliceFn(wardrobeSrc, 'const renderEmptyCategoryState', 'const renderEmptyState = () =>');
const quickAddHandler = sliceFn(wardrobeSrc, 'const handleQuickAdd', 'const handleBulkAdd');
const bulkAddHandler = sliceFn(wardrobeSrc, 'const handleBulkAdd', 'const handleScanWardrobe');
const scanHandler = sliceFn(wardrobeSrc, 'const handleScanWardrobe', 'const handleAICreateOutfit');

assert.equal(actionsBar.includes('handleScanWardrobe'), false, 'Scan must not appear in the top actions bar');
assert.equal(actionsBar.includes("navigate(\"DigitizeWardrobe\")"), false, 'top bar must not navigate to Scan/Digitize');
assert.match(actionsBar, /handleQuickAdd/, 'Quick Add must remain in the top bar');
assert.match(actionsBar, /handleBulkAdd/, 'Bulk Add must remain in the top bar');
assert.ok(
  actionsBar.indexOf('handleQuickAdd') < actionsBar.indexOf('handleBulkAdd'),
  'top bar order must be Quick Add | Bulk Add',
);
assert.ok(
  /quickActionChip:\s*\{[^}]*flex:\s*1/s.test(wardrobeSrc),
  'top actions must be equal-width',
);

assert.match(emptyState, /Build your wardrobe/, 'empty state title');
assert.match(
  emptyState,
  /Add your clothes to get more personalised outfit suggestions and styling advice/,
  'empty state body',
);
assert.equal(emptyState.includes('handleScanWardrobe'), false, 'empty state must not show Scan');
assert.equal(emptyState.includes('scanMyWardrobe'), false, 'empty state must not use Scan copy');
assert.equal(emptyState.includes('handleQuickAdd'), false, 'empty state must not duplicate Quick Add');
assert.equal(emptyState.includes('handleBulkAdd'), false, 'empty state must not duplicate Bulk Add');
assert.equal(emptyState.includes('Feather name="camera"'), false, 'empty state must not show the large camera icon');

assert.match(quickAddHandler, /navigate\("QuickAdd"\)/, 'Quick Add must keep the existing QuickAdd flow');
assert.match(bulkAddHandler, /navigate\("BulkWardrobeUpload"\)/, 'Bulk Add must keep the existing Bulk Add flow');
assert.match(scanHandler, /navigate\("DigitizeWardrobe"\)/, 'Scan implementation must be retained');

assert.match(emptyCategory, /handleQuickAdd/, 'filtered empty category may still offer Quick Add');
assert.match(wardrobeSrc, /renderWardrobeItem/, 'item grid renderer retained');
assert.match(wardrobeSrc, /selectionMode/, 'existing select/delete retained');

assert.match(stackSrc, /QuickAdd:/, 'Quick Add route retained');
assert.match(stackSrc, /BulkWardrobeUpload/, 'Bulk Add route retained');
assert.match(stackSrc, /DigitizeWardrobe/, 'Scan/Digitize route retained');
assert.match(stackSrc, /ScanWardrobe/, 'ScanWardrobe screen retained');
assert.match(stackSrc, /name="Wardrobe"/, 'Wardrobe stack entry retained');

const entitlementFiles = [
  'utils/appleEntitlementIsolation.ts',
  'utils/appleEntitlementIsolation.test.ts',
  'utils/appleRestoreLocalEntitlement.test.ts',
  'screens/SubscriptionScreen.tsx',
];
for (const rel of entitlementFiles) {
  assert.ok(fs.existsSync(path.join(root, rel)), `${rel} must remain untouched on disk`);
}

console.log('verify-wardrobe-empty-actions: all passed');

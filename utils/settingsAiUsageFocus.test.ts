/**
 * Settings AI allowance refetches on screen focus.
 * Run: npx tsx utils/settingsAiUsageFocus.test.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const settingsSrc = readFileSync(join(root, '../screens/SettingsScreen.tsx'), 'utf8');

assert.match(settingsSrc, /const loadAiUsage = useCallback\(/);
assert.match(settingsSrc, /apiService\.getAiUsage\(\)/);
assert.match(
  settingsSrc,
  /useFocusEffect\([\s\S]*?loadAiUsage\(\)/,
);
assert.doesNotMatch(
  settingsSrc,
  /useEffect\([\s\S]*?getAiUsage\(\)/,
);

console.log('settingsAiUsageFocus.test.ts: all assertions passed');

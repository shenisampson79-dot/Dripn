/**
 * Settings AI allowance refetches on screen focus without stale overwrites.
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

// Guard against out-of-order focus fetches overwriting fresh usage.
assert.match(settingsSrc, /aiUsageRequestGen\s*=\s*useRef\(0\)/);
assert.match(
  settingsSrc,
  /const requestGen = \+\+aiUsageRequestGen\.current/,
);
assert.match(
  settingsSrc,
  /if \(requestGen !== aiUsageRequestGen\.current\) return/,
);
assert.match(
  settingsSrc,
  /return \(\) => \{[\s\S]*?aiUsageRequestGen\.current \+= 1/,
);

// Percentage still derives from server usage fields only.
assert.match(
  settingsSrc,
  /aiUsage\.usedCents \/ Math\.max\(aiUsage\.budgetCents, 1\)/,
);

console.log('settingsAiUsageFocus.test.ts: all assertions passed');

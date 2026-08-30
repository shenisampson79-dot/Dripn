/**
 * P1 — sign-out must reach auth stack without global error boundary.
 * Run: npx tsx scripts/verify-sign-out-auth-regression.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const authStackSrc = read('navigation/AuthStackNavigator.tsx');
const authContextSrc = read('contexts/AuthContext.tsx');
const appSrc = read('App.tsx');
const hookSrc = read('hooks/useAuthPasswordResetDeepLinks.ts');
const deepLinkSrc = read('utils/passwordResetDeepLink.ts');

console.log('=== verify-sign-out-auth-regression ===\n');

assert.doesNotMatch(
  authStackSrc,
  /PasswordResetDeepLinkHandler/,
  'deep-link handler must not be a Stack.Navigator sibling',
);
assert.doesNotMatch(
  authStackSrc,
  /return\s*\(\s*<>[\s\S]{0,120}Stack\.Navigator/,
  'AuthStack must not wrap navigator in Fragment with siblings',
);
assert.match(authStackSrc, /useAuthPasswordResetDeepLinks/, 'deep links routed via in-stack hook');
assert.match(hookSrc, /initialLaunchUrlChecked/, 'getInitialURL processed once per app session');
assert.match(hookSrc, /safeNavigateToResetPassword/, 'reset navigation is guarded');
assert.match(hookSrc, /try\s*\{[\s\S]*safeNavigateToResetPassword/, 'navigation errors must not throw');

assert.match(authContextSrc, /clearPasswordResetToken\(\)/, 'logout clears stashed reset token');
assert.match(
  authContextSrc,
  /const logout = async[\s\S]*setUser\(null\)/,
  'logout clears user session',
);
assert.match(
  appSrc,
  /if \(!isAuthenticated\) \{[\s\S]*AuthStackNavigator/,
  'signed-out state renders auth stack',
);

assert.match(deepLinkSrc, /clearPasswordResetToken/, 'reset token clear helper exists');

console.log('All sign-out auth regression checks passed.');

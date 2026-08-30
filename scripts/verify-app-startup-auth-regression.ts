/**
 * P1 — app startup must not block on password-reset deep links or hung OTA checks.
 * Run: npx tsx scripts/verify-app-startup-auth-regression.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parsePasswordResetToken } from '../utils/passwordResetDeepLink';

const root = resolve(__dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const appSrc = read('App.tsx');
const authStackSrc = read('navigation/AuthStackNavigator.tsx');
const hookSrc = read('hooks/useAuthPasswordResetDeepLinks.ts');
const authContextSrc = read('contexts/AuthContext.tsx');
const deepLinkSrc = read('utils/passwordResetDeepLink.ts');

console.log('=== verify-app-startup-auth-regression ===\n');

// 1. Authenticated cold launch, no reset URL → MainTab (not blocked on auth stack / reset hook)
assert.match(
  appSrc,
  /if \(isLoading\) \{[\s\S]*LoadingScreen/,
  'auth bootstrap shows loading until hydrate completes',
);
assert.match(
  appSrc,
  /if \(!isAuthenticated\) \{[\s\S]*AuthStackNavigator/,
  'signed-out renders auth stack',
);
assert.match(
  appSrc,
  /MainTabNavigator/,
  'authenticated path reaches main tabs',
);
assert.match(
  appSrc,
  /hasCompletedOnboarding[\s\S]*MainTabNavigator|MainTabNavigator[\s\S]*hasCompletedOnboarding/,
  'onboarded authenticated users reach main navigator',
);

// 2. Signed-out cold launch, no reset URL → auth flow
assert.doesNotMatch(
  authStackSrc,
  /if\s*\(\s*!isAuthenticated/,
  'auth stack does not own session gate (AppContent does)',
);
assert.match(authStackSrc, /initialRouteName/, 'auth stack has default welcome route');

// 3. getInitialURL() null → startup cannot remain blocked on deep-link await
assert.match(
  appSrc,
  /Linking\.getInitialURL\(\)\.then\(captureInvite\)/,
  'App enqueues cold-start URL without awaiting before render',
);
assert.doesNotMatch(
  appSrc,
  /await\s+Linking\.getInitialURL/,
  'cold-start URL must not be awaited on boot path',
);
assert.doesNotMatch(
  hookSrc,
  /Linking\.getInitialURL/,
  'reset hook must not re-read cold-start URL (iOS single-read + no boot block)',
);

// 4. Unrelated initial URL → normal startup (reset parser ignores non-reset links)
assert.equal(parsePasswordResetToken(null), null, 'null initial URL ignored');
assert.equal(parsePasswordResetToken('dripn://today'), null, 'unrelated deep link ignored');
assert.equal(
  parsePasswordResetToken('dripn://invite/abc'),
  null,
  'invite links are not reset tokens',
);

// 5. Reset deep link → ResetPassword initial route + warm listener
assert.equal(
  parsePasswordResetToken('dripn://reset-password?token=abc123'),
  'abc123',
  'native reset deep link parsed',
);
assert.match(
  authStackSrc,
  /consumePasswordResetToken/,
  'auth stack consumes App-stashed native reset token once',
);
assert.match(
  authStackSrc,
  /resolvedInitialRoute = resetToken \? "ResetPassword"/,
  'reset token selects ResetPassword initial route',
);
assert.match(hookSrc, /addEventListener\('url'/, 'warm reset links handled while auth stack mounted');

// OTA boot gate must not wait forever (native splash while updatesReady false)
assert.match(
  appSrc,
  /UPDATES_BOOT_TIMEOUT_MS/,
  'expo-updates check has bounded timeout',
);
assert.match(
  appSrc,
  /Promise\.race\([\s\S]*UPDATES_BOOT_TIMEOUT_MS/,
  'updates boot uses timeout race',
);
assert.match(
  appSrc,
  /if \(!updatesReady\) \{[\s\S]*return null/,
  'splash gate documented: updatesReady blocks provider mount',
);

// 6. Sign Out preserved
assert.match(authContextSrc, /clearPasswordResetToken\(\)/, 'logout clears stashed reset token');
assert.match(
  authContextSrc,
  /const logout = async[\s\S]*setUser\(null\)/,
  'logout clears session',
);

// 7–8. Password reset + forgot-password scripts remain wired
const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
assert.ok(pkg.scripts['verify:password-reset-flow'], 'password reset verify script exists');
assert.ok(pkg.scripts['verify:forgot-password-login'], 'forgot-password verify script exists');
assert.ok(deepLinkSrc.includes('clearPasswordResetToken'), 'reset token clear helper exists');

console.log('All app startup auth regression checks passed.');

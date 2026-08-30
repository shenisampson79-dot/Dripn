/**
 * P1 — complete password reset flow (client only).
 * Run: npx tsx scripts/verify-password-reset-flow.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  PASSWORD_RESET_MIN_LENGTH,
  parsePasswordResetToken,
} from '../utils/passwordResetDeepLink';

const root = resolve(__dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const apiSrc = read('services/ApiService.ts');
const resetScreenSrc = read('screens/ResetPasswordScreen.tsx');
const authStackSrc = read('navigation/AuthStackNavigator.tsx');
const appSrc = read('App.tsx');
const hookSrc = read('hooks/useAuthPasswordResetDeepLinks.ts');
const deepLinkSrc = read('utils/passwordResetDeepLink.ts');
const authScreenSrc = read('screens/AuthScreen.tsx');
const en = JSON.parse(read('locales/en.json')) as Record<string, string>;

console.log('=== verify-password-reset-flow ===\n');

assert.equal(PASSWORD_RESET_MIN_LENGTH, 6, 'min length must match server');

assert.equal(
  parsePasswordResetToken('dripn://reset-password?token=abc123'),
  'abc123',
  'native deep link token',
);
assert.equal(
  parsePasswordResetToken('https://dripnapp.com/reset-password?token=hextoken'),
  'hextoken',
  'web reset URL token',
);
assert.equal(parsePasswordResetToken('dripn://today'), null, 'unrelated deep link ignored');
assert.equal(parsePasswordResetToken('dripn://reset-password'), null, 'empty token rejected');

assert.match(apiSrc, /async resetPassword\s*\(/, 'ApiService.resetPassword exists');
assert.match(apiSrc, /\/api\/auth\/reset-password/, 'calls existing reset endpoint');
const resetMethodMatch = apiSrc.match(
  /async resetPassword[\s\S]*?\n  \}/,
);
assert.ok(resetMethodMatch, 'resetPassword method body found');
assert.doesNotMatch(
  resetMethodMatch![0],
  /setToken/,
  'resetPassword must not auto-sign-in',
);

assert.match(resetScreenSrc, /resetPasswordConfirm/, 'confirm password field');
assert.match(resetScreenSrc, /PASSWORD_RESET_MIN_LENGTH/, 'min length enforced');
assert.match(resetScreenSrc, /resetPasswordMismatch/, 'mismatch rejected');
assert.match(resetScreenSrc, /apiService\.resetPassword/, 'submits to API');
assert.match(resetScreenSrc, /resetPasswordInvalidToken/, 'invalid token recovery copy');
assert.match(resetScreenSrc, /mode: 'login'/, 'success routes to Sign In');
assert.doesNotMatch(
  resetScreenSrc,
  /\bsetToken\(|\blogin\(/,
  'reset screen must not establish session directly',
);

assert.match(authStackSrc, /ResetPasswordScreen/, 'auth stack registers reset screen');
assert.match(authStackSrc, /readWebPasswordResetToken/, 'web token opens reset screen');
assert.match(authStackSrc, /useAuthPasswordResetDeepLinks/, 'native deep-link hook wired in auth stack');
assert.match(
  authStackSrc,
  /resolvedInitialRoute = resetToken \? "ResetPassword"/,
  'web /reset-password initial route',
);
assert.doesNotMatch(
  authStackSrc,
  /PasswordResetDeepLinkHandler/,
  'handler must not sit outside Stack.Navigator',
);

assert.match(appSrc, /parsePasswordResetToken/, 'App stashes reset deep links');
assert.match(hookSrc, /parsePasswordResetToken/, 'hook parses reset deep links');
assert.match(deepLinkSrc, /readWebPasswordResetToken/, 'web path helper exists');

assert.match(authScreenSrc, /auth\.forgotPassword/, 'forgot-password link preserved');
assert.doesNotMatch(
  authScreenSrc,
  /isSignup\s*\?\s*[\s\S]{0,120}auth\.forgotPassword/,
  'forgot-password login-only',
);

assert.ok(en['auth.resetPasswordNew']?.length > 3, 'reset copy present');
assert.ok(en['auth.resetPasswordConfirm']?.length > 3, 'confirm copy present');

console.log('All password reset flow checks passed.');

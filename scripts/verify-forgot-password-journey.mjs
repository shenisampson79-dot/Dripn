/**
 * Forgot Password journey regression checks (client + web, no native deep links).
 * Run: npm run verify:forgot-password-journey
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function assertIncludes(content, needle, label) {
  assert.ok(content.includes(needle), `${label}: expected ${JSON.stringify(needle)}`);
}

function assertExcludes(content, needle, label) {
  assert.ok(!content.includes(needle), `${label}: must not contain ${JSON.stringify(needle)}`);
}

const authScreen = read('screens/AuthScreen.tsx');
const apiService = read('services/ApiService.ts');
const vercel = JSON.parse(read('vercel.json'));
const resetHtml = read('public/reset-password.html');

const frozenFiles = [
  'App.tsx',
  'contexts/AuthContext.tsx',
  'navigation/AuthStackNavigator.tsx',
];

for (const file of frozenFiles) {
  const full = path.join(root, file);
  assert.ok(fs.existsSync(full), `${file} exists`);
}

assertIncludes(authScreen, "t('auth.forgotPassword')", 'login forgot link label');
assertIncludes(authScreen, 'handleForgotPassword', 'forgot handler');
assertIncludes(authScreen, 'apiService.requestForgotPassword', 'uses entered email via API');
assertIncludes(authScreen, '!isSignup ? (', 'login-only forgot link');
assertIncludes(authScreen, 'forgotPasswordSent', 'generic success copy');
assertExcludes(authScreen, 'result.message', 'client must not render server forgot message');

assertIncludes(authScreen, 'isValidForgotPasswordEmail', 'email validation helper');
assertIncludes(authScreen, 'sendForgotPasswordRequest', 'shared forgot request helper');
assertIncludes(authScreen, 'forgotPasswordModalVisible', 'email-entry modal state');
assertIncludes(authScreen, 'handleForgotPasswordModalSubmit', 'modal submit handler');
assertIncludes(authScreen, 'isValidForgotPasswordEmail(trimmedLoginEmail)', 'valid login email requests directly');
assertIncludes(authScreen, 'setForgotPasswordModalVisible(true)', 'empty/invalid login email opens modal');
assertIncludes(authScreen, "t('auth.forgotPasswordInvalidEmail')", 'invalid modal email blocked');
assertIncludes(authScreen, "t('auth.forgotPasswordSendLink')", 'modal send button copy');
assertExcludes(
  authScreen,
  "Alert.alert(t('auth.forgotPasswordTitle'), t('auth.forgotPasswordEnterEmail'))",
  'must not dead-end with enter-email alert only',
);

assertIncludes(apiService, "async requestForgotPassword(email: string)", 'ApiService forgot method');
assertIncludes(apiService, "'/api/auth/forgot-password'", 'forgot endpoint path');
assertExcludes(apiService, 'reset-password?token', 'ApiService must not embed reset URLs');

assertIncludes(resetHtml, '<h1>Reset your password</h1>', 'reset page heading');
assertIncludes(resetHtml, "params.get('token')", 'reads token from query string');
assertExcludes(resetHtml, 'console.log', 'reset page must not log');
assertIncludes(resetHtml, "fetch('/api/auth/reset-password'", 'posts to reset endpoint');
assertIncludes(resetHtml, 'Password must be at least 6 characters', 'min length validation');
assertIncludes(resetHtml, 'Passwords do not match', 'mismatch validation');
assertIncludes(resetHtml, 'reset-missing-token', 'missing token safe state');
assertIncludes(resetHtml, 'invalid or has expired', 'invalid/expired safe copy');
assertIncludes(resetHtml, 'Open the Dripn app and sign in', 'success directs back to app');
assertExcludes(resetHtml, 'dripn://', 'no native deep links on web page');

const rewriteDestinations = (vercel.rewrites || []).map((r) => r.destination);
assert.ok(rewriteDestinations.includes('/reset-password.html'), 'vercel /reset-password rewrite');

for (const file of frozenFiles) {
  const src = read(file);
  assertExcludes(src, 'ResetPassword', `${file}: no native ResetPassword route`);
  assertExcludes(src, 'PasswordResetDeepLink', `${file}: no deep link handler`);
  assertExcludes(src, 'reset-password?token', `${file}: no reset URL deep link wiring`);
}

assertExcludes(authScreen, 'ResetPassword', 'AuthScreen: no native reset screen navigation');
assertExcludes(authScreen, 'dripn://reset-password', 'AuthScreen: no native reset deep link');

console.log('verify-forgot-password-journey: ok');

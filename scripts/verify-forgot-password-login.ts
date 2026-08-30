/**
 * Launch P2 — login forgot-password entry point (client only).
 * Run: npx tsx scripts/verify-forgot-password-login.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');
const authScreenPath = resolve(root, 'screens/AuthScreen.tsx');
const apiPath = resolve(root, 'services/ApiService.ts');
const enPath = resolve(root, 'locales/en.json');

const authSrc = readFileSync(authScreenPath, 'utf8');
const apiSrc = readFileSync(apiPath, 'utf8');
const en = JSON.parse(readFileSync(enPath, 'utf8')) as Record<string, string>;

console.log('=== verify-forgot-password-login ===\n');

assert.match(apiSrc, /requestForgotPassword\s*\(/, 'ApiService must expose requestForgotPassword');
assert.match(apiSrc, /\/api\/auth\/forgot-password/, 'ApiService must call existing forgot-password endpoint');
assert.match(apiSrc, /email\.trim\(\)\.toLowerCase\(\)/, 'ApiService must normalize email before request');

assert.match(authSrc, /handleForgotPassword/, 'AuthScreen must handle forgot-password tap');
assert.match(authSrc, /!isSignup\s*\?\s*\(/, 'Forgot-password link must be login-only');
assert.match(authSrc, /auth\.forgotPassword/, 'AuthScreen must use auth.forgotPassword copy key');
assert.match(authSrc, /apiService\.requestForgotPassword/, 'AuthScreen must call ApiService forgot-password');
assert.doesNotMatch(
  authSrc,
  /isSignup\s*\?\s*[\s\S]{0,120}auth\.forgotPassword/,
  'Forgot-password link must not appear on signup',
);

assert.equal(en['auth.forgotPassword'], 'Forgot your password?', 'English forgot-password label');
assert.ok(en['auth.forgotPasswordEnterEmail']?.length > 10, 'Empty-email guidance copy required');
assert.ok(en['auth.forgotPasswordSent']?.length > 10, 'Success copy required');

console.log('All forgot-password login checks passed.');

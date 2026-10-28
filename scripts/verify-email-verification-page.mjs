/**
 * Dedicated /verify-email page regression checks.
 * Run: npm run verify:email-verification-page
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

const html = read('public/verify-email.html');
const vercel = JSON.parse(read('vercel.json'));
const prepare = read('scripts/prepare-public-legal-pages.mjs');

assert.match(html, /<h1>Verify your email<\/h1>/);
assert.match(html, /id="verify-preamble"/);
assert.match(html, /Confirm your Dripn account email so you can use all features\./);
assert.match(html, /Checking your verification link/);
assert.match(html, /This verification link is missing or incomplete/);
assert.match(html, /This verification link is invalid or has expired/);
assert.match(html, /We could not verify your email right now/);
assert.match(html, /<h2>Email verified!<\/h2>/);
assert.match(html, /Your Dripn account email has been successfully verified\./);
assert.match(html, /You're all set\. Open the Dripn app to continue your style journey\./);
assert.match(html, /preambleEl\.hidden = true/);
assert.match(html, /params\.get\('token'\)/);
assert.match(html, /fetch\('\/api\/auth\/verify-email\?token=' \+ encodeURIComponent\(token\)/);
assert.match(html, /method: 'GET'/);
assert.match(html, /history\.replaceState/);
assert.match(html, /name="referrer" content="no-referrer"/);
assert.match(html, /noindex, nofollow/);
assert.match(html, /verify-missing/);
assert.match(html, /verify-expired/);
assert.match(html, /verify-error/);
assert.match(html, /verify-success/);
assert.match(html, /Try again/);
assert.match(html, /alreadyVerified/);
assert.doesNotMatch(html, /<h2>Email verified<\/h2>/);
assert.doesNotMatch(html, /Your email is verified\. Open the Dripn app and continue\./);
assert.doesNotMatch(html, /console\.(log|info|debug|warn|error)/);
assert.doesNotMatch(html, /localStorage|sessionStorage/);
assert.doesNotMatch(html, /dripn:\/\//);
assert.doesNotMatch(html, /gtag|googletagmanager|mixpanel|segment/i);
assert.doesNotMatch(html, /id="root"/);
assert.match(prepare, /writeVerifyEmailPage/);
assert.match(prepare, /verify-email.html/);

const rewrites = vercel.rewrites || [];
const verify = rewrites.find((r) => r.source === '/verify-email');
const verifySlash = rewrites.find((r) => r.source === '/verify-email/');
const catchAll = rewrites.find((r) => r.source === '/(.*)');
const app = rewrites.find((r) => r.source === '/app');
assert.equal(verify?.destination, '/verify-email.html');
assert.equal(verifySlash?.destination, '/verify-email.html');
assert.equal(app?.destination, '/app.html');
assert.equal(catchAll?.destination, '/app.html');
assert.ok(
  rewrites.findIndex((r) => r.source === '/verify-email')
    < rewrites.findIndex((r) => r.source === '/(.*)'),
);

console.log('verify-email-verification-page: ok');

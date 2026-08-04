#!/usr/bin/env node
/**
 * Automated billing sweep — Playwright Stripe checkout + API tier verification.
 * Usage: node scripts/billing-sweep-auto.mjs [--edge-only] [--product-only]
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const API = process.env.SWEEP_API || 'https://dripn-server.onrender.com';
const PASSWORD = 'SweepTest123!';
const CARD = { number: '4242424242424242', exp: '12/34', cvc: '123', name: 'Sweep Test', postal: 'SW1A 1AA' };

const SUB_TESTS = [
  { id: 'T1', plan: 'style_chat', expected: 'style_chat', label: 'Style Chat £9.99/mo' },
  { id: 'T2', plan: 'personal_stylist', expected: 'personal_stylist', label: 'Personal Stylist £14.99/mo' },
  { id: 'T3', plan: 'stylist_unlimited', expected: 'stylist_unlimited', label: 'Stylist Pro £19.99/mo' },
  { id: 'T4', plan: 'core_wardrobe', expected: 'core_wardrobe', label: 'Core Wardrobe £39.99', dfy: true },
  { id: 'T5', plan: 'outfit_setup', expected: 'outfit_setup', label: 'Outfit Setup £19.99', dfy: true },
];

const EDGE_TESTS = [
  { id: 'E1', label: 'style_chat → personal_stylist upgrade', steps: ['style_chat', 'personal_stylist'], finalExpected: 'personal_stylist' },
  { id: 'E2', label: 'personal_stylist → stylist_unlimited upgrade', steps: ['personal_stylist', 'stylist_unlimited'], finalExpected: 'stylist_unlimited' },
  { id: 'E3', label: 'outfit_setup purchased twice', steps: ['outfit_setup', 'outfit_setup'], finalExpected: 'outfit_setup', dfy: true },
];

const TIER_ALIASES = {
  subscription: 'style_chat',
  premium: 'personal_stylist',
  pro: 'stylist_unlimited',
  lite: 'outfit_setup',
  core: 'core_wardrobe',
};

function norm(t) {
  return TIER_ALIASES[t] || t;
}

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
    method: opts.method || 'GET',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  return { ok: res.ok, status: res.status, json };
}

async function register(testId) {
  const email = `dripn-sweep-${Date.now()}-${testId}@test.dripn.local`;
  let r = await api('/api/auth/register', { method: 'POST', body: { email, password: PASSWORD, displayName: 'Sweep' } });
  if (!r.ok) {
    r = await api('/api/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
  }
  if (!r.ok) throw new Error(`Auth failed ${email}: ${r.status}`);
  return { email, token: r.json.token };
}

async function createCheckout(token, email, plan, dfy) {
  if (dfy || plan === 'core_wardrobe' || plan === 'outfit_setup') {
    const r = await api('/api/checkout/dfy/create-session', { method: 'POST', token, body: { email, productId: plan } });
    if (!r.ok) throw new Error(`DFY checkout fail: ${JSON.stringify(r.json)}`);
    return { sessionId: r.json.sessionId, checkoutUrl: r.json.checkoutUrl };
  }
  const r = await api('/api/subscription/create-checkout', { method: 'POST', token, body: { plan, billingCycle: 'monthly' } });
  if (!r.ok) throw new Error(`Sub checkout fail: ${JSON.stringify(r.json)}`);
  return { sessionId: r.json.sessionId, checkoutUrl: r.json.checkoutUrl };
}

async function syncSuccess(sessionId) {
  const res = await fetch(`${API}/api/checkout/success?session_id=${encodeURIComponent(sessionId)}`, { redirect: 'manual' });
  return { status: res.status, location: res.headers.get('location'), ok: res.status >= 300 && res.status < 400 };
}

async function verifyTier(token, expected) {
  const me = await api('/api/auth/me', { token });
  const status = await api('/api/subscription/status', { token });
  await api('/api/subscription/verify', { method: 'POST', token }).catch(() => ({}));
  const me2 = await api('/api/auth/me', { token });
  const status2 = await api('/api/subscription/status', { token });

  const meTier = me2.json?.subscriptionTier ?? me.json?.subscriptionTier ?? 'unknown';
  const statusTier = status2.json?.subscription?.tier ?? status2.json?.plan ?? status.json?.plan ?? 'unknown';
  const active = status2.json?.subscription?.isActive ?? status2.json?.active ?? false;

  const match = (t) => norm(t) === norm(expected);
  return {
    pass: match(meTier) && match(statusTier),
    meTier,
    statusTier,
    active,
  };
}

async function payStripe(page, checkoutUrl) {
  await page.goto(checkoutUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.getByPlaceholder('1234 1234 1234 1234').waitFor({ timeout: 60000 });
  await page.getByPlaceholder('1234 1234 1234 1234').fill(CARD.number);
  await page.getByPlaceholder('MM / YY').fill(CARD.exp);
  await page.getByPlaceholder('CVC').fill(CARD.cvc);
  await page.getByPlaceholder('Full name on card').fill(CARD.name);
  const postal = page.getByPlaceholder('Postal code');
  if (await postal.count()) await postal.fill(CARD.postal);

  const payBtn = page.getByRole('button', { name: /Pay/i });
  await payBtn.click();

  await page.waitForURL(/checkout\/success|dripnapp\.com|dripn-server|subscription\?status/, { timeout: 120000 }).catch(async () => {
    await page.waitForTimeout(8000);
  });

  const url = page.url();
  const sessionMatch = url.match(/session_id=([^&]+)/);
  return { redirectUrl: url, sessionId: sessionMatch?.[1] ?? null, redirectOk: /success|status=success/.test(url) };
}

async function runTest(page, test, plans) {
  const row = { id: test.id, label: test.label, checkout: 'FAIL', payment: 'FAIL', redirect: 'FAIL', tierUnlock: 'FAIL', notes: '' };
  let token, email, lastSessionId;

  try {
    ({ email, token } = await register(test.id));

    for (const plan of plans) {
      const dfy = test.dfy || plan === 'core_wardrobe' || plan === 'outfit_setup';
      const { checkoutUrl, sessionId } = await createCheckout(token, email, plan, dfy);
      row.checkout = checkoutUrl ? 'PASS' : 'FAIL';
      lastSessionId = sessionId;

      const pay = await payStripe(page, checkoutUrl);
      row.payment = pay.redirectOk || pay.sessionId ? 'PASS' : 'FAIL';
      row.redirect = pay.redirectOk ? 'PASS' : (pay.redirectUrl.includes('success') ? 'PASS' : 'FAIL');

      if (lastSessionId) {
        const sync = await syncSuccess(lastSessionId);
        if (sync.ok) row.redirect = 'PASS';
      }
      await page.waitForTimeout(1500);
    }

    const expected = test.finalExpected || test.expected;
    let v = await verifyTier(token, expected);
    if (!v.pass && lastSessionId) {
      await syncSuccess(lastSessionId);
      await page.waitForTimeout(2000);
      v = await verifyTier(token, expected);
    }

    row.tierUnlock = v.pass ? 'PASS' : 'FAIL';
    row.notes = `email=${email} me=${v.meTier} status=${v.statusTier} active=${v.active}`;
  } catch (e) {
    row.notes = `error: ${e.message}`;
  }

  return row;
}

async function main() {
  const args = process.argv.slice(2);
  const edgeOnly = args.includes('--edge-only');
  const productOnly = args.includes('--product-only');

  let tests = [];
  if (!edgeOnly) tests.push(...SUB_TESTS);
  if (!productOnly) tests.push(...EDGE_TESTS);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results = [];

  for (const test of tests) {
    console.error(`Running ${test.id}: ${test.label || test.plan}...`);
    const plans = test.steps || [test.plan];
    const row = await runTest(page, test, plans);
    results.push(row);
    console.error(`  → checkout=${row.checkout} payment=${row.payment} redirect=${row.redirect} tier=${row.tierUnlock}`);
  }

  await browser.close();

  const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'sweep-results.json');
  fs.writeFileSync(outPath, JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2));

  const passed = results.filter((r) => [r.checkout, r.payment, r.redirect, r.tierUnlock].every((x) => x === 'PASS')).length;
  console.log(JSON.stringify({ summary: { total: results.length, passed, failed: results.length - passed }, results }, null, 2));
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});

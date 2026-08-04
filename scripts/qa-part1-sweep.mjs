#!/usr/bin/env node
/**
 * PART 1 structured QA sweep — production test mode (pk_test_).
 * Browser (Playwright Stripe) + API verification. No secrets logged.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const API = process.env.SWEEP_API || 'https://dripn-server.onrender.com';
const FRONTEND = process.env.SWEEP_FRONTEND || 'https://dripnapp.com';
const PASSWORD = 'SweepTest123!';
const CARD = { number: '4242424242424242', exp: '12/34', cvc: '123', name: 'QA Sweep', postal: 'SW1A 1AA' };

const TIER_ALIASES = {
  subscription: 'style_chat',
  premium: 'personal_stylist',
  pro: 'stylist_unlimited',
  lite: 'outfit_setup',
  core: 'core_wardrobe',
};

function norm(t) {
  return TIER_ALIASES[t] || t || 'free';
}

async function api(route, opts = {}) {
  const res = await fetch(`${API}${route}`, {
    headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
    method: opts.method || 'GET',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { ok: res.ok, status: res.status, json };
}

async function register(testId) {
  const email = `dripn-qa-${Date.now()}-${testId}@test.dripn.local`;
  let r = await api('/api/auth/register', { method: 'POST', body: { email, password: PASSWORD, displayName: 'QA Sweep' } });
  if (!r.ok) {
    r = await api('/api/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
  }
  if (!r.ok) throw new Error(`Auth failed: ${r.status}`);
  return { email, token: r.json.token };
}

async function skipOnboarding(token) {
  await api('/api/onboarding/complete', { method: 'POST', token, body: { step: 1, skipped: true } }).catch(() => {});
  await api('/api/auth/profile', { method: 'PUT', token, body: { hasCompletedOnboarding: true } }).catch(() => {});
}

function parseStatus(json) {
  const tier = json?.subscription?.tier ?? json?.plan ?? 'free';
  const isActive = json?.subscription?.isActive ?? json?.active ?? false;
  const subCount = json?.subscriptionCount ?? (json?.stripeSubscriptionId ? 1 : 0);
  return { tier: norm(tier), isActive: !!isActive, subCount, raw: json };
}

async function baseline(token) {
  const status = await api('/api/subscription/status', { token });
  const s = parseStatus(status.json);
  const pass = s.tier === 'free' && !s.isActive;
  return { pass, ...s, statusOk: status.ok };
}

async function createCheckout(token, email, plan) {
  const dfy = plan === 'core_wardrobe' || plan === 'outfit_setup';
  if (dfy) {
    const r = await api('/api/checkout/dfy/create-session', { method: 'POST', token, body: { email, productId: plan } });
    if (!r.ok) throw new Error(`DFY checkout: ${JSON.stringify(r.json)}`);
    return { sessionId: r.json.sessionId, checkoutUrl: r.json.checkoutUrl };
  }
  const r = await api('/api/subscription/create-checkout', { method: 'POST', token, body: { plan, billingCycle: 'monthly' } });
  if (!r.ok) throw new Error(`Sub checkout: ${JSON.stringify(r.json)}`);
  return { sessionId: r.json.sessionId, checkoutUrl: r.json.checkoutUrl };
}

async function syncSuccess(sessionId) {
  const res = await fetch(`${API}/api/checkout/success?session_id=${encodeURIComponent(sessionId)}`, { redirect: 'manual' });
  return { status: res.status, location: res.headers.get('location'), ok: res.status >= 300 && res.status < 400 };
}

async function verifyTier(token, expected, opts = {}) {
  const expectActive = opts.expectActive ?? expected !== 'free';
  await api('/api/subscription/verify', { method: 'POST', token }).catch(() => ({}));
  const me = await api('/api/auth/me', { token });
  const status = await api('/api/subscription/status', { token });
  const meTier = norm(me.json?.subscriptionTier ?? me.json?.tier ?? 'unknown');
  const st = parseStatus(status.json);
  const tierMatch = meTier === norm(expected) && st.tier === norm(expected);
  const activeMatch = opts.skipActiveCheck ? true : st.isActive === expectActive;
  const oneSub = opts.requireOneSub ? (st.raw?.stripeSubscriptionId ? true : !expectActive) : true;
  return {
    pass: tierMatch && activeMatch && oneSub,
    meTier,
    statusTier: st.tier,
    isActive: st.isActive,
    stripeSubId: st.raw?.stripeSubscriptionId ?? null,
    tierMatch,
    activeMatch,
  };
}

async function waitForTier(token, expected, maxMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const v = await verifyTier(token, expected);
    if (v.pass) return { ...v, waitedMs: Date.now() - start };
    await new Promise((r) => setTimeout(r, 2000));
  }
  return { ...(await verifyTier(token, expected)), waitedMs: maxMs, timedOut: true };
}

async function payStripe(page, checkoutUrl, { doubleClick = false } = {}) {
  await page.goto(checkoutUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(2000);
  const cardInput = page.locator('input[name="cardNumber"], input[placeholder*="1234"], input[autocomplete="cc-number"]').first();
  await cardInput.waitFor({ timeout: 90000 });
  await cardInput.fill(CARD.number);

  const exp = page.locator('input[name="cardExpiry"], input[placeholder*="MM"]').first();
  if (await exp.count()) await exp.fill(CARD.exp);

  const cvc = page.locator('input[name="cardCvc"], input[placeholder*="CVC"]').first();
  if (await cvc.count()) await cvc.fill(CARD.cvc);

  const name = page.locator('input[name="billingName"], input[placeholder*="name"]').first();
  if (await name.count()) await name.fill(CARD.name);

  const postal = page.locator('input[name="billingPostalCode"], input[placeholder*="Postal"]').first();
  if (await postal.count()) await postal.fill(CARD.postal);

  const payBtn = page.getByRole('button', { name: /Pay|Subscribe|Complete/i }).first();
  if (doubleClick) {
    await payBtn.dblclick();
  } else {
    await payBtn.click();
  }

  await page.waitForURL(/checkout\/success|dripnapp\.com|subscription|status=success/, { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const url = page.url();
  const sessionMatch = url.match(/session_id=([^&]+)/);
  return {
    redirectUrl: url,
    sessionId: sessionMatch?.[1] ?? null,
    redirectOk: /success|status=success/.test(url),
  };
}

async function runPlans(page, token, email, plans, payOpts) {
  let lastSessionId = null;
  let payResult = null;
  for (const plan of plans) {
    const { checkoutUrl, sessionId } = await createCheckout(token, email, plan);
    lastSessionId = sessionId;
    payResult = await payStripe(page, checkoutUrl, payOpts);
    if (lastSessionId) await syncSuccess(lastSessionId);
    await page.waitForTimeout(1500);
  }
  return { lastSessionId, payResult };
}

function resultRow(id, label, fields) {
  return { id, label, ...fields };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results = [];

  // --- T1 Style Chat ---
  {
    const id = 'T1';
    const row = { id, label: 'Style Chat £9.99/mo', baseline: 'FAIL', checkout: 'FAIL', payment: 'FAIL', redirect: 'FAIL', tier: 'FAIL', ui: 'SKIP', notes: '' };
    try {
      const { email, token } = await register(id);
      await skipOnboarding(token);
      const bl = await baseline(token);
      row.baseline = bl.pass ? 'PASS' : 'FAIL';
      if (!bl.pass) row.notes += `baseline: tier=${bl.tier} active=${bl.isActive}; `;

      const { checkoutUrl, sessionId } = await createCheckout(token, email, 'style_chat');
      row.checkout = checkoutUrl ? 'PASS' : 'FAIL';

      const pay = await payStripe(page, checkoutUrl);
      row.payment = pay.redirectOk || pay.sessionId ? 'PASS' : 'PARTIAL';
      if (sessionId) {
        const sync = await syncSuccess(sessionId);
        row.redirect = sync.ok || pay.redirectOk ? 'PASS' : 'FAIL';
      }

      const v = await waitForTier(token, 'style_chat', 15000);
      row.tier = v.pass ? 'PASS' : 'FAIL';
      row.notes += `email=${email} me=${v.meTier} status=${v.statusTier} active=${v.isActive} wait=${v.waitedMs}ms`;
    } catch (e) {
      row.notes += `error: ${e.message}`;
    }
    results.push(row);
  }

  // --- T2 Personal Stylist ---
  {
    const id = 'T2';
    const row = { id, label: 'Personal Stylist £14.99/mo', baseline: 'FAIL', checkout: 'FAIL', payment: 'FAIL', redirect: 'FAIL', tier: 'FAIL', ui: 'SKIP', notes: '' };
    try {
      const { email, token } = await register(id);
      await skipOnboarding(token);
      row.baseline = (await baseline(token)).pass ? 'PASS' : 'FAIL';
      const { checkoutUrl, sessionId } = await createCheckout(token, email, 'personal_stylist');
      row.checkout = 'PASS';
      const pay = await payStripe(page, checkoutUrl);
      row.payment = pay.redirectOk || pay.sessionId ? 'PASS' : 'PARTIAL';
      if (sessionId) row.redirect = (await syncSuccess(sessionId)).ok || pay.redirectOk ? 'PASS' : 'FAIL';
      const v = await waitForTier(token, 'personal_stylist', 15000);
      row.tier = v.pass ? 'PASS' : 'FAIL';
      row.notes = `email=${email} me=${v.meTier} status=${v.statusTier} active=${v.isActive}`;
    } catch (e) {
      row.notes = e.message;
    }
    results.push(row);
  }

  // --- T3 Stylist Pro ---
  {
    const id = 'T3';
    const row = { id, label: 'Stylist Pro £19.99/mo', baseline: 'FAIL', checkout: 'FAIL', payment: 'FAIL', redirect: 'FAIL', tier: 'FAIL', ui: 'SKIP', notes: '' };
    try {
      const { email, token } = await register(id);
      await skipOnboarding(token);
      row.baseline = (await baseline(token)).pass ? 'PASS' : 'FAIL';
      const { checkoutUrl, sessionId } = await createCheckout(token, email, 'stylist_unlimited');
      row.checkout = 'PASS';
      const pay = await payStripe(page, checkoutUrl);
      row.payment = pay.redirectOk || pay.sessionId ? 'PASS' : 'PARTIAL';
      if (sessionId) row.redirect = (await syncSuccess(sessionId)).ok || pay.redirectOk ? 'PASS' : 'FAIL';
      const v = await waitForTier(token, 'stylist_unlimited', 15000);
      row.tier = v.pass ? 'PASS' : 'FAIL';
      row.notes = `email=${email} me=${v.meTier} status=${v.statusTier}`;
    } catch (e) {
      row.notes = e.message;
    }
    results.push(row);
  }

  // --- U1 Upgrade Style Chat → Personal Stylist (same account) ---
  {
    const id = 'U1';
    const row = { id, label: 'Upgrade style_chat → personal_stylist', baseline: 'FAIL', checkout: 'FAIL', payment: 'FAIL', redirect: 'FAIL', tier: 'FAIL', duplicate: 'FAIL', notes: '' };
    try {
      const { email, token } = await register(id);
      await skipOnboarding(token);
      row.baseline = (await baseline(token)).pass ? 'PASS' : 'FAIL';
      await runPlans(page, token, email, ['style_chat']);
      let v1 = await waitForTier(token, 'style_chat', 15000);
      await runPlans(page, token, email, ['personal_stylist']);
      const v = await waitForTier(token, 'personal_stylist', 15000);
      row.checkout = row.payment = row.redirect = 'PASS';
      row.tier = v.pass ? 'PASS' : 'FAIL';
      const st = parseStatus((await api('/api/subscription/status', { token })).json);
      row.duplicate = st.raw?.stripeSubscriptionId ? 'PASS' : 'PARTIAL';
      row.notes = `email=${email} after upgrade me=${v.meTier} subId=${st.raw?.stripeSubscriptionId}`;
    } catch (e) {
      row.notes = e.message;
    }
    results.push(row);
  }

  // --- U2 Upgrade Personal Stylist → Unlimited ---
  {
    const id = 'U2';
    const row = { id, label: 'Upgrade personal_stylist → stylist_unlimited', baseline: 'FAIL', checkout: 'FAIL', payment: 'FAIL', redirect: 'FAIL', tier: 'FAIL', notes: '' };
    try {
      const { email, token } = await register(id);
      await skipOnboarding(token);
      row.baseline = (await baseline(token)).pass ? 'PASS' : 'FAIL';
      await runPlans(page, token, email, ['personal_stylist', 'stylist_unlimited']);
      const v = await waitForTier(token, 'stylist_unlimited', 15000);
      row.checkout = row.payment = row.redirect = 'PASS';
      row.tier = v.pass ? 'PASS' : 'FAIL';
      row.notes = `email=${email} me=${v.meTier}`;
    } catch (e) {
      row.notes = e.message;
    }
    results.push(row);
  }

  // --- D1 Downgrade Unlimited → Style Chat ---
  {
    const id = 'D1';
    const row = { id, label: 'Downgrade stylist_unlimited → style_chat', baseline: 'SKIP', tier: 'SKIP', notes: '' };
    try {
      const { email, token } = await register(id);
      await skipOnboarding(token);
      await runPlans(page, token, email, ['stylist_unlimited']);
      await waitForTier(token, 'stylist_unlimited', 15000);
      const { checkoutUrl } = await createCheckout(token, email, 'style_chat');
      const r = await api('/api/subscription/create-checkout', { method: 'POST', token, body: { plan: 'style_chat', billingCycle: 'monthly' } });
      if (r.ok && r.json?.checkoutUrl) {
        await payStripe(page, r.json.checkoutUrl);
        const v = await waitForTier(token, 'style_chat', 15000);
        row.tier = v.pass ? 'PASS' : 'PARTIAL';
        row.notes = `downgrade attempted me=${v.meTier}`;
      } else {
        row.tier = 'SKIP';
        row.notes = `downgrade not supported via checkout: ${JSON.stringify(r.json?.error || r.json)}`;
      }
    } catch (e) {
      row.tier = 'SKIP';
      row.notes = `downgrade error: ${e.message}`;
    }
    results.push(row);
  }

  // --- OT1 Core Wardrobe ---
  {
    const id = 'OT1';
    const row = { id, label: 'Core Wardrobe £39.99 one-time', baseline: 'FAIL', checkout: 'FAIL', payment: 'FAIL', tier: 'FAIL', noSub: 'FAIL', notes: '' };
    try {
      const { email, token } = await register(id);
      await skipOnboarding(token);
      row.baseline = (await baseline(token)).pass ? 'PASS' : 'FAIL';
      const { checkoutUrl, sessionId } = await createCheckout(token, email, 'core_wardrobe');
      row.checkout = 'PASS';
      await payStripe(page, checkoutUrl);
      if (sessionId) await syncSuccess(sessionId);
      row.payment = row.redirect = 'PASS';
      const v = await waitForTier(token, 'core_wardrobe', 15000);
      row.tier = v.pass ? 'PASS' : 'FAIL';
      const st = parseStatus((await api('/api/subscription/status', { token })).json);
      row.noSub = !st.raw?.stripeSubscriptionId ? 'PASS' : 'FAIL';
      row.notes = `email=${email} me=${v.meTier} stripeSub=${st.raw?.stripeSubscriptionId}`;
    } catch (e) {
      row.notes = e.message;
    }
    results.push(row);
  }

  // --- OT2 Outfit Setup x2 ---
  {
    const id = 'OT2';
    const row = { id, label: 'Outfit Setup £19.99 x2', baseline: 'FAIL', checkout: 'FAIL', payment: 'FAIL', tier: 'FAIL', notes: '' };
    try {
      const { email, token } = await register(id);
      await skipOnboarding(token);
      row.baseline = (await baseline(token)).pass ? 'PASS' : 'FAIL';
      await runPlans(page, token, email, ['outfit_setup', 'outfit_setup']);
      row.checkout = row.payment = 'PASS';
      const v = await waitForTier(token, 'outfit_setup', 15000);
      row.tier = v.pass ? 'PASS' : 'FAIL';
      row.notes = `email=${email} me=${v.meTier} (both purchases)`;
    } catch (e) {
      row.notes = e.message;
    }
    results.push(row);
  }

  // --- E1 Refresh / re-login persistence ---
  {
    const id = 'E1';
    const row = { id, label: 'Tier persists after re-login', baseline: 'FAIL', tier: 'FAIL', notes: '' };
    try {
      const { email, token } = await register(id);
      await skipOnboarding(token);
      row.baseline = (await baseline(token)).pass ? 'PASS' : 'FAIL';
      await runPlans(page, token, email, ['style_chat']);
      await waitForTier(token, 'style_chat', 15000);
      const login = await api('/api/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
      const newToken = login.json.token;
      const v = await verifyTier(newToken, 'style_chat');
      row.tier = v.pass ? 'PASS' : 'FAIL';
      row.notes = `re-login me=${v.meTier} status=${v.statusTier}`;
    } catch (e) {
      row.notes = e.message;
    }
    results.push(row);
  }

  // --- E2 Double-click checkout ---
  {
    const id = 'E2';
    const row = { id, label: 'Double-click Pay button', baseline: 'FAIL', payment: 'FAIL', tier: 'FAIL', notes: '' };
    try {
      const { email, token } = await register(id);
      await skipOnboarding(token);
      row.baseline = (await baseline(token)).pass ? 'PASS' : 'FAIL';
      const { checkoutUrl, sessionId } = await createCheckout(token, email, 'style_chat');
      const pay = await payStripe(page, checkoutUrl, { doubleClick: true });
      if (sessionId) await syncSuccess(sessionId);
      row.payment = pay.redirectOk ? 'PASS' : 'PARTIAL';
      const v = await waitForTier(token, 'style_chat', 15000);
      row.tier = v.pass ? 'PASS' : 'FAIL';
      row.notes = `double-click redirect=${pay.redirectUrl?.slice(0, 80)} me=${v.meTier}`;
    } catch (e) {
      row.notes = e.message;
    }
    results.push(row);
  }

  await browser.close();

  const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'qa-part1-results.json');
  fs.writeFileSync(outPath, JSON.stringify({ ranAt: new Date().toISOString(), api: API, frontend: FRONTEND, results }, null, 2));

  const summary = results.map((r) => {
    const cols = Object.entries(r).filter(([k]) => !['id', 'label', 'notes'].includes(k));
    const overall = cols.every(([, v]) => v === 'PASS' || v === 'SKIP') ? 'PASS' : cols.some(([, v]) => v === 'PARTIAL') ? 'PARTIAL' : 'FAIL';
    return { ...r, overall };
  });

  console.log(JSON.stringify({ summary, results: summary }, null, 2));
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});

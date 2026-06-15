#!/usr/bin/env node
/**
 * Seed analytics dashboard — register, pay, cancel, winback click, verify APIs.
 * No secrets logged.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const API = process.env.SWEEP_API || 'https://dripn-server.onrender.com';
const FRONTEND = process.env.SWEEP_FRONTEND || 'https://dripnapp.com';
const PASSWORD = 'SweepTest123!';
const CARD = { number: '4242424242424242', exp: '12/34', cvc: '123', name: 'Analytics Seed', postal: 'SW1A 1AA' };
const ADMIN_SECRET = process.env.EXPO_PUBLIC_ADMIN_SECRET || process.env.ADMIN_SECRET || '';
const CRON_SECRET = process.env.CRON_SECRET || '';

const report = {
  ranAt: new Date().toISOString(),
  api: API,
  frontend: FRONTEND,
  email: null,
  steps: {},
  analytics: {},
  errors: [],
};

async function api(route, opts = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    ...(opts.adminSecret ? { 'x-admin-secret': opts.adminSecret } : {}),
    ...(opts.cronSecret ? { 'x-cron-secret': opts.cronSecret } : {}),
    ...(opts.headers || {}),
  };
  const res = await fetch(`${API}${route}`, {
    headers,
    method: opts.method || 'GET',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    redirect: opts.redirect || 'follow',
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 400) };
  }
  return { ok: res.ok, status: res.status, json, headers: res.headers };
}

async function register() {
  const ts = Date.now();
  const email = `dripn-analytics-${ts}@test.dripn.local`;
  let r = await api('/api/auth/register', {
    method: 'POST',
    body: { email, password: PASSWORD, displayName: 'Analytics Seed' },
  });
  if (!r.ok) {
    r = await api('/api/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
  }
  if (!r.ok) throw new Error(`Auth failed: ${r.status}`);
  return { email, token: r.json.token, userId: r.json.user?.id };
}

async function skipOnboarding(token) {
  await api('/api/onboarding/complete', { method: 'POST', token, body: { step: 1, skipped: true } }).catch(() => {});
  await api('/api/auth/profile', { method: 'PUT', token, body: { hasCompletedOnboarding: true } }).catch(() => {});
}

async function createCheckout(token, plan = 'style_chat') {
  const r = await api('/api/subscription/create-checkout', {
    method: 'POST',
    token,
    body: { plan, billingCycle: 'monthly' },
  });
  if (!r.ok) throw new Error(`Checkout failed: ${JSON.stringify(r.json)}`);
  return { sessionId: r.json.sessionId, checkoutUrl: r.json.checkoutUrl };
}

async function syncSuccess(sessionId) {
  const res = await fetch(`${API}/api/checkout/success?session_id=${encodeURIComponent(sessionId)}`, { redirect: 'manual' });
  return { status: res.status, location: res.headers.get('location'), ok: res.status >= 300 && res.status < 400 };
}

async function payStripe(page, checkoutUrl) {
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
  await payBtn.click();
  await page.waitForURL(/checkout\/success|dripnapp\.com|subscription|status=success/, { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const url = page.url();
  const sessionMatch = url.match(/session_id=([^&]+)/);
  return { redirectUrl: url, sessionId: sessionMatch?.[1] ?? null, redirectOk: /success|status=success/.test(url) };
}

async function waitForTier(token, expected = 'style_chat', maxMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    await api('/api/subscription/verify', { method: 'POST', token }).catch(() => {});
    const me = await api('/api/auth/me', { token });
    const status = await api('/api/subscription/status', { token });
    const meTier = me.json?.subscriptionTier ?? me.json?.tier ?? 'unknown';
    const statusTier = status.json?.subscription?.tier ?? status.json?.plan ?? 'unknown';
    const isActive = status.json?.subscription?.isActive ?? status.json?.active ?? false;
    if (meTier === expected && statusTier === expected && isActive) {
      return { pass: true, meTier, statusTier, isActive, waitedMs: Date.now() - start, me: me.json, status: status.json };
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  const me = await api('/api/auth/me', { token });
  const status = await api('/api/subscription/status', { token });
  return {
    pass: false,
    meTier: me.json?.subscriptionTier,
    statusTier: status.json?.subscription?.tier ?? status.json?.plan,
    isActive: status.json?.subscription?.isActive,
    timedOut: true,
    me: me.json,
    status: status.json,
  };
}

async function runCancelFlow(token) {
  await api('/api/subscription/cancel/start', { method: 'POST', token });
  await api('/api/subscription/cancel/feedback', {
    method: 'POST',
    token,
    body: { reason: 'not_using', feedback: 'Analytics seed test', wouldReturn: true },
  });
  let offer = await api('/api/subscription/cancel/offer', { method: 'POST', token, body: { reason: 'not_using' } });
  if (!offer.ok) {
    offer = await api('/api/subscription/cancel/offer', { token });
  }
  const cancel = await api('/api/subscription/cancel', {
    method: 'POST',
    token,
    body: { reason: 'not_using', immediately: false, variant: offer.json?.variant ?? 'B' },
  });
  return { offer: offer.json, cancel: cancel.json, cancelOk: cancel.ok, cancelStatus: cancel.status };
}

async function triggerWinbackCron() {
  if (!CRON_SECRET) {
    return { skipped: true, reason: 'CRON_SECRET not set in env' };
  }
  const r = await api('/api/cron/winback-emails', { method: 'POST', cronSecret: CRON_SECRET });
  return { skipped: false, ok: r.ok, status: r.status, json: r.json };
}

async function simulateWinbackClick(token) {
  const params = new URLSearchParams({
    source: 'winback_email',
    campaign: 'day0',
    cta: 'resume_50',
    variant: 'B',
  });
  const landingUrl = `${FRONTEND}/subscription?${params.toString()}`;
  const landingRes = await fetch(landingUrl, { redirect: 'follow' });
  const eventRes = await api('/api/analytics/event', {
    method: 'POST',
    token,
    body: {
      event: 'winback_landing',
      source: 'winback_email',
      campaign: 'day0',
      cta: 'resume_50',
      variant: 'B',
    },
  });
  const clickRes = await api('/api/analytics/event', {
    method: 'POST',
    token,
    body: {
      event: 'winback_cta_click',
      source: 'winback_email',
      campaign: 'day0',
      cta: 'resume_50',
      variant: 'B',
    },
  });
  return {
    landingUrl,
    landingStatus: landingRes.status,
    landingOk: landingRes.ok,
    winbackLandingEvent: { ok: eventRes.ok, status: eventRes.status },
    winbackClickEvent: { ok: clickRes.ok, status: clickRes.status },
  };
}

function hasNonZeroData(json, keys) {
  const out = {};
  for (const k of keys) {
    const v = json?.[k];
    out[k] = v;
    out[`${k}_nonZero`] = typeof v === 'number' ? v > 0 : Array.isArray(v) ? v.length > 0 : !!v;
  }
  return out;
}

async function fetchAnalytics() {
  const adminOpts = ADMIN_SECRET ? { adminSecret: ADMIN_SECRET } : {};
  const endpoints = [
    ['/api/analytics/summary', ['total', 'events', 'revenue', 'offers', 'emailConversions', 'payments']],
    ['/api/analytics/revenue', ['totalRevenue', 'revenueToday', 'revenue7d', 'revenue30d', 'winbackRevenue', 'subscriptionRevenue', 'payingUsers', 'trend']],
    ['/api/analytics/retention', ['recoveryRate', 'revenueSaved', 'retentionByOffer', 'cancelFlow']],
    ['/api/analytics/email-performance', ['topEmail', 'ctaPerformance', 'revenueByEmail', 'sendsByType']],
  ];
  const results = { adminSecretConfigured: !!ADMIN_SECRET, unauthorized: false };
  for (const [route, keys] of endpoints) {
    const r = await api(route, adminOpts);
    results[route] = {
      ok: r.ok,
      status: r.status,
      ...(r.ok ? hasNonZeroData(r.json, keys) : { error: r.json?.error || r.json?.raw || 'request failed' }),
    };
    if (r.status === 401 || r.status === 403) results.unauthorized = true;
  }
  return results;
}

async function verifyPayments(token) {
  const verify = await api('/api/subscription/verify', { method: 'POST', token });
  const status = await api('/api/subscription/status', { token });
  let payments = null;
  if (ADMIN_SECRET) {
    const p = await api('/api/admin/payments', { adminSecret: ADMIN_SECRET });
    payments = { ok: p.ok, status: p.status, count: p.json?.payments?.length ?? p.json?.count ?? null };
  }
  return { verify: { ok: verify.ok, json: verify.json }, status: status.json, payments };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 1. Register
    const { email, token } = await register();
    report.email = email;
    report.steps.register = { ok: true, email };

    await skipOnboarding(token);

    // 2. Checkout + pay
    const { checkoutUrl, sessionId } = await createCheckout(token, 'style_chat');
    report.steps.checkout = { ok: true, sessionId: sessionId?.slice(0, 12) + '...' };

    const pay = await payStripe(page, checkoutUrl);
    if (sessionId) await syncSuccess(sessionId);
    report.steps.payment = { ok: pay.redirectOk || !!pay.sessionId, redirectUrl: pay.redirectUrl?.slice(0, 120) };

    // 3. Verify tier
    const tier = await waitForTier(token, 'style_chat', 20000);
    report.steps.tierVerify = {
      ok: tier.pass,
      meTier: tier.meTier,
      statusTier: tier.statusTier,
      isActive: tier.isActive,
      waitedMs: tier.waitedMs,
    };

    const paymentCheck = await verifyPayments(token);
    report.steps.payments = paymentCheck;

    // 4. Cancel subscription
    const cancelFlow = await runCancelFlow(token);
    report.steps.cancel = cancelFlow;

    const statusAfterCancel = await api('/api/subscription/status', { token });
    report.steps.statusAfterCancel = {
      ok: statusAfterCancel.ok,
      cancelAtPeriodEnd: statusAfterCancel.json?.subscription?.cancelAtPeriodEnd ?? statusAfterCancel.json?.cancelAtPeriodEnd,
      tier: statusAfterCancel.json?.subscription?.tier ?? statusAfterCancel.json?.plan,
    };

    // 5. Winback cron (optional)
    report.steps.winbackCron = await triggerWinbackCron();

    // 6. Simulate email click
    report.steps.winbackClick = await simulateWinbackClick(token);

    // 7-8. Analytics APIs
    report.analytics = await fetchAnalytics();
    report.dashboardUrl = `${FRONTEND}/admin/analytics`;
  } catch (e) {
    report.errors.push(e.message);
    report.fatal = e.message;
  } finally {
    await browser.close();
  }

  const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'analytics-seed-results.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});

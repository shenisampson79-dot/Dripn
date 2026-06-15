#!/usr/bin/env node
/**
 * E2E retention/analytics test — 3 personas × accept/reject paths.
 * Uses production API; optional DATABASE_URL for signal seeding.
 * Prints PASS/FAIL per step. No secrets logged.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const API = process.env.SWEEP_API || process.env.EXPO_PUBLIC_API_URL || 'https://dripn-server.onrender.com';
const FRONTEND = process.env.SWEEP_FRONTEND || 'https://dripnapp.com';
const PASSWORD = 'E2ERetention123!';
const CARD = { number: '4242424242424242', exp: '12/34', cvc: '123', name: 'E2E Retention', postal: 'SW1A 1AA' };
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.EXPO_PUBLIC_ADMIN_SECRET || '';
const CRON_SECRET = process.env.CRON_SECRET || '';
const DATABASE_URL = process.env.DATABASE_URL || '';

const PERSONAS = [
  {
    key: 'high_churn',
    label: 'Persona A (high churn)',
    seed: { outfits: 0, cancelEvents: 3, lastActiveDays: 35, failedPayments: 0 },
    expect: { personaSegment: 'high_churn', type: 'discount', acceptedOffer: 'discount_50', offerKey: 'retention_50' },
  },
  {
    key: 'low_usage',
    label: 'Persona B (low usage)',
    seed: { outfits: 2, cancelEvents: 0, lastActiveDays: 1, failedPayments: 0 },
    expect: { personaSegment: 'low_usage', type: 'downgrade', acceptedOffer: 'downgrade_style_chat' },
  },
  {
    key: 'medium',
    label: 'Persona C (medium)',
    seed: { outfits: 8, cancelEvents: 2, lastActiveDays: 14, failedPayments: 0 },
    expect: { personaSegment: 'medium', type: 'pause', acceptedOffer: 'pause_3_months' },
  },
];

const report = {
  ranAt: new Date().toISOString(),
  api: API,
  frontend: FRONTEND,
  databaseSeeding: !!DATABASE_URL,
  personas: {},
  global: {},
  errors: [],
};

function step(name, pass, details = {}) {
  const status = pass ? 'PASS' : 'FAIL';
  console.log(`${status}  ${name}`);
  if (Object.keys(details).length) console.log('       ', JSON.stringify(details).slice(0, 300));
  return { pass, status, ...details };
}

async function api(route, opts = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    ...(opts.adminSecret ? { 'x-admin-secret': opts.adminSecret } : {}),
    ...(opts.adminJwt ? { Authorization: `Bearer ${opts.adminJwt}` } : {}),
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

async function getAdminJwt() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return null;
  const r = await api('/api/admin/login', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  return r.ok ? r.json.token : null;
}

let dbPool = null;
async function getDb() {
  if (!DATABASE_URL) return null;
  if (dbPool) return dbPool;
  const { Pool } = await import('@neondatabase/serverless');
  dbPool = new Pool({ connectionString: DATABASE_URL });
  return dbPool;
}

async function seedPersonaSignals(userId, seed) {
  const pool = await getDb();
  if (!pool) {
    return { skipped: true, reason: 'DATABASE_URL not set — using natural signals only' };
  }

  const client = await pool.connect();
  try {
    if (seed.outfits > 0) {
      for (let i = 0; i < seed.outfits; i++) {
        await client.query(
          `INSERT INTO outfit_suggestions (user_id, suggestion, created_at) VALUES ($1, $2, NOW())`,
          [userId, JSON.stringify({ test: true, i })],
        ).catch(async () => {
          await client.query(
            `INSERT INTO chat_messages (user_id, role, content, created_at) VALUES ($1, 'user', $2, NOW())`,
            [userId, `e2e seed message ${i}`],
          ).catch(() => {});
        });
      }
    }

    if (seed.cancelEvents > 0) {
      for (let i = 0; i < seed.cancelEvents; i++) {
        await client.query(
          `INSERT INTO cancel_events (user_id, reason, action, cancelled, created_at)
           VALUES ($1, 'e2e_seed', 'cancel_flow_start', FALSE, NOW())`,
          [userId],
        ).catch(() => {});
      }
    }

    if (seed.lastActiveDays > 0) {
      await client.query(
        `UPDATE users SET updated_at = NOW() - ($1 || ' days')::interval WHERE id = $2`,
        [String(seed.lastActiveDays), userId],
      ).catch(() => {});
    }

    return { seeded: true, ...seed };
  } finally {
    client.release();
  }
}

async function register(suffix) {
  const ts = Date.now();
  const email = `dripn-e2e-${suffix}-${ts}@test.dripn.local`;
  let r = await api('/api/auth/register', {
    method: 'POST',
    body: { email, password: PASSWORD, displayName: `E2E ${suffix}` },
  });
  if (!r.ok) {
    r = await api('/api/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
  }
  if (!r.ok) throw new Error(`Auth failed: ${r.status} ${JSON.stringify(r.json)}`);
  return { email, token: r.json.token, userId: r.json.user?.id };
}

async function skipOnboarding(token) {
  await api('/api/onboarding/complete', { method: 'POST', token, body: { step: 1, skipped: true } }).catch(() => {});
  await api('/api/auth/profile', { method: 'PUT', token, body: { hasCompletedOnboarding: true } }).catch(() => {});
}

async function createCheckout(token) {
  const r = await api('/api/subscription/create-checkout', {
    method: 'POST',
    token,
    body: { plan: 'style_chat', billingCycle: 'monthly' },
  });
  if (!r.ok) throw new Error(`Checkout failed: ${JSON.stringify(r.json)}`);
  return { sessionId: r.json.sessionId, checkoutUrl: r.json.checkoutUrl };
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
  return { redirectUrl: url, sessionId: sessionMatch?.[1] ?? null };
}

async function waitForTier(token, expected = 'style_chat', maxMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    await api('/api/subscription/verify', { method: 'POST', token }).catch(() => {});
    const status = await api('/api/subscription/status', { token });
    const tier = status.json?.subscription?.tier ?? status.json?.plan;
    const isActive = status.json?.subscription?.isActive ?? status.json?.active;
    if (tier === expected && isActive) return { pass: true, tier, waitedMs: Date.now() - start };
    await new Promise((r) => setTimeout(r, 2000));
  }
  const status = await api('/api/subscription/status', { token });
  return { pass: false, tier: status.json?.subscription?.tier, timedOut: true };
}

async function fetchCancelOffer(token) {
  let r = await api('/api/subscription/cancel/offer', { method: 'POST', token, body: { reason: 'not_using' } });
  if (r.status === 404 || r.status === 405) {
    r = await api('/api/subscription/cancel/offer', { token });
  }
  return r;
}

function verifyOffer(offer, expect, churnScore) {
  const checks = {
    personaSegment: offer?.personaSegment === expect.personaSegment,
    type: offer?.type === expect.type,
    acceptedOffer: offer?.acceptedOffer === expect.acceptedOffer,
    offerKey: expect.offerKey == null || offer?.offerKey === expect.offerKey,
    churnScorePresent: churnScore != null,
  };
  const pass = Object.values(checks).every(Boolean);
  return { pass, checks, offer, churnScore };
}

async function acceptOffer(token, offer, variant) {
  const type = offer?.type;
  if (type === 'discount') {
    return api('/api/subscription/apply-discount', {
      method: 'POST',
      token,
      body: {
        reason: 'not_using',
        variant,
        acceptedOffer: offer.acceptedOffer,
        offer: offer.offerKey || 'retention_30',
        offerType: 'discount',
      },
    });
  }
  if (type === 'pause') {
    return api('/api/subscription/pause', {
      method: 'POST',
      token,
      body: {
        months: offer.pauseMonths ?? 3,
        reason: 'not_using',
        variant,
        acceptedOffer: offer.acceptedOffer,
        offerType: 'pause',
      },
    });
  }
  if (type === 'downgrade') {
    return api('/api/subscription/downgrade', {
      method: 'POST',
      token,
      body: {
        plan: offer.highlightPlan || 'style_chat',
        reason: 'not_using',
        variant,
        acceptedOffer: offer.acceptedOffer,
        offerType: 'downgrade',
      },
    });
  }
  return { ok: false, status: 400, json: { error: 'no accept action for type' } };
}

async function rejectOffer(token, variant) {
  await api('/api/subscription/cancel/start', { method: 'POST', token });
  await api('/api/subscription/cancel/feedback', {
    method: 'POST',
    token,
    body: { reason: 'not_using', feedback: 'E2E reject path', wouldReturn: false },
  });
  return api('/api/subscription/cancel', {
    method: 'POST',
    token,
    body: { reason: 'not_using', immediately: false, variant, acceptedOffer: 'confirmed_cancel' },
  });
}

async function runPersonaFlow(page, persona, pathType) {
  const suffix = `${persona.key}-${pathType}`;
  const steps = {};
  const { email, token, userId } = await register(suffix);
  steps.register = step(`${persona.label} [${pathType}] register`, true, { email });

  await skipOnboarding(token);
  const seedResult = await seedPersonaSignals(userId, persona.seed);
  steps.seedSignals = step(
    `${persona.label} [${pathType}] seed signals`,
    seedResult.skipped || seedResult.seeded,
    seedResult,
  );

  const { checkoutUrl, sessionId } = await createCheckout(token);
  steps.checkout = step(`${persona.label} [${pathType}] checkout`, true, { sessionId: sessionId?.slice(0, 14) });

  const pay = await payStripe(page, checkoutUrl);
  if (sessionId) {
    await fetch(`${API}/api/checkout/success?session_id=${encodeURIComponent(sessionId)}`, { redirect: 'manual' });
  }
  steps.payment = step(`${persona.label} [${pathType}] stripe payment`, !!pay.sessionId || /success/.test(pay.redirectUrl));

  const tier = await waitForTier(token);
  steps.tier = step(`${persona.label} [${pathType}] tier active`, tier.pass, tier);

  const verify = await api('/api/subscription/verify', { method: 'POST', token });
  steps.paymentsVerify = step(`${persona.label} [${pathType}] subscription verify`, verify.ok, { status: verify.status });

  const offerRes = await fetchCancelOffer(token);
  const offer = offerRes.json?.offer;
  const churnScore = offerRes.json?.churnScore;
  const offerCheck = verifyOffer(offer, persona.expect, churnScore);
  steps.cancelOffer = step(
    `${persona.label} [${pathType}] cancel/offer segment`,
    offerRes.ok && offerCheck.pass,
    { status: offerRes.status, ...offerCheck },
  );

  const variant = offerRes.json?.variant ?? 'B';
  if (pathType === 'accept') {
    const acceptRes = await acceptOffer(token, offer, variant);
    steps.acceptPath = step(
      `${persona.label} [accept] accept offer`,
      acceptRes.ok,
      { status: acceptRes.status, response: acceptRes.json },
    );
  } else {
    const rejectRes = await rejectOffer(token, variant);
    steps.rejectPath = step(
      `${persona.label} [reject] confirm cancel`,
      rejectRes.ok,
      { status: rejectRes.status, response: rejectRes.json },
    );
  }

  return { email, userId, token, steps, offerEventId: offerRes.json?.offerEventId };
}

async function runGlobalChecks(adminJwt) {
  const global = {};
  const adminOpts = adminJwt
    ? { adminJwt }
    : ADMIN_SECRET
      ? { adminSecret: ADMIN_SECRET }
      : {};

  if (CRON_SECRET) {
    const winback = await api('/api/cron/winback-emails', { method: 'POST', cronSecret: CRON_SECRET });
    global.winbackCron = step('Winback cron', winback.ok, { status: winback.status, json: winback.json });

    const optimize = await api('/api/cron/optimize-offers', { method: 'POST', cronSecret: CRON_SECRET });
    global.optimizeCron = step('Optimize-offers cron', optimize.ok, { status: optimize.status, json: optimize.json });
  } else {
    global.winbackCron = step('Winback cron', false, { skipped: true, reason: 'CRON_SECRET not set' });
    global.optimizeCron = step('Optimize-offers cron', false, { skipped: true, reason: 'CRON_SECRET not set' });
  }

  const clickRes = await api('/api/analytics/event', {
    method: 'POST',
    token: null,
    body: {},
  });
  global.emailClickAuth = step('Email click requires auth', clickRes.status === 401, { status: clickRes.status });

  if (adminOpts.adminJwt || adminOpts.adminSecret) {
    const sync = await api('/api/admin/analytics/sync-stripe-payments', { method: 'POST', ...adminOpts });
    global.stripeSync = step('Stripe payments sync', sync.ok, { status: sync.status, json: sync.json });

    const insights = await api('/api/admin/analytics/insights', adminOpts);
    global.insights = step('Admin analytics insights', insights.ok && Array.isArray(insights.json?.insights), {
      status: insights.status,
      count: insights.json?.insights?.length,
    });

    for (const route of ['/api/analytics/revenue', '/api/analytics/retention', '/api/analytics/email-performance', '/api/analytics/experiments']) {
      const r = await api(route, adminOpts);
      global[route] = step(`Analytics ${route}`, r.ok, { status: r.status });
    }
  } else {
    global.adminAuth = step('Admin analytics auth', false, {
      skipped: true,
      reason: 'Set ADMIN_EMAIL+ADMIN_PASSWORD or ADMIN_SECRET',
    });
  }

  return global;
}

async function simulateEmailClick(token, userId) {
  const params = new URLSearchParams({
    source: 'winback_email',
    campaign: 'day0',
    campaign_id: 'day0',
    user_id: String(userId),
    cta: 'resume_50',
    cta_id: 'resume_50',
    variant: 'B',
  });
  const landingUrl = `${FRONTEND}/subscription?${params.toString()}`;
  const landingRes = await fetch(landingUrl, { redirect: 'follow' });
  const eventRes = await api('/api/analytics/event', {
    method: 'POST',
    token,
    body: {
      event: 'winback_cta_click',
      source: 'winback_email',
      campaign: 'day0',
      cta: 'resume_50',
      variant: 'B',
      metadata: { user_id: String(userId), campaign_id: 'day0', cta_id: 'resume_50' },
    },
  });
  const hasAttribution = params.has('user_id') && params.has('campaign_id') && params.has('cta_id');
  return step(
    'Winback email click simulation',
    landingRes.ok && eventRes.ok && hasAttribution,
    { landingStatus: landingRes.status, eventStatus: eventRes.status, landingUrl },
  );
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const adminJwt = await getAdminJwt();

  try {
    for (const persona of PERSONAS) {
      report.personas[persona.key] = { accept: {}, reject: {} };
      for (const pathType of ['accept', 'reject']) {
        try {
          const result = await runPersonaFlow(page, persona, pathType);
          report.personas[persona.key][pathType] = result.steps;
          if (pathType === 'accept' && result.token) {
            report.personas[persona.key].emailClick = await simulateEmailClick(result.token, result.userId);
          }
        } catch (e) {
          report.errors.push(`${persona.key}/${pathType}: ${e.message}`);
          console.log(`FAIL  ${persona.label} [${pathType}] fatal: ${e.message}`);
        }
      }
    }

    report.global = await runGlobalChecks(adminJwt);
  } catch (e) {
    report.errors.push(e.message);
    console.error('FATAL:', e.message);
  } finally {
    await browser.close();
    if (dbPool) await dbPool.end().catch(() => {});
  }

  const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'e2e-retention-results.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  let total = 0;
  let passed = 0;
  const countSteps = (obj) => {
    for (const v of Object.values(obj)) {
      if (v?.pass != null) {
        total++;
        if (v.pass) passed++;
      } else if (typeof v === 'object' && v !== null) countSteps(v);
    }
  };
  countSteps(report);

  console.log(`\n--- Summary: ${passed}/${total} steps passed ---`);
  console.log(`Results: ${outPath}`);

  const anyFail = passed < total || report.errors.length > 0;
  process.exit(anyFail ? 1 : 0);
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});

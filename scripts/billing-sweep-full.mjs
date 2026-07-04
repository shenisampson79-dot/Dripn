#!/usr/bin/env node
/**
 * Full billing sweep orchestrator — register, checkout, sync, verify.
 * Stripe payment completed separately (browser). No secrets logged.
 */
const API = process.env.SWEEP_API || 'https://dripn-server.onrender.com';
const PASSWORD = 'SweepTest123!';

const SUB_TESTS = [
  { id: 'T1', plan: 'style_chat', expected: 'style_chat', label: 'Style Chat £9.99/mo' },
  { id: 'T2', plan: 'personal_stylist', expected: 'personal_stylist', label: 'Personal Stylist £14.99/mo' },
  { id: 'T3', plan: 'stylist_unlimited', expected: 'stylist_unlimited', label: 'Stylist Unlimited £19.99/mo' },
  { id: 'T4', plan: 'core_wardrobe', expected: 'core_wardrobe', label: 'Core Wardrobe £39.99', type: 'dfy' },
  { id: 'T5', plan: 'outfit_setup', expected: 'outfit_setup', label: 'Outfit Setup £19.99', type: 'dfy' },
];

const EDGE_TESTS = [
  { id: 'E1', steps: [{ plan: 'style_chat' }, { plan: 'personal_stylist' }], finalExpected: 'personal_stylist', label: 'style_chat → personal_stylist upgrade' },
  { id: 'E2', steps: [{ plan: 'personal_stylist' }, { plan: 'stylist_unlimited' }], finalExpected: 'stylist_unlimited', label: 'personal_stylist → stylist_unlimited upgrade' },
  { id: 'E3', steps: [{ plan: 'outfit_setup' }, { plan: 'outfit_setup' }], finalExpected: 'outfit_setup', label: 'outfit_setup purchased twice' },
];

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
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

function tsEmail(suffix = '') {
  const ts = Date.now();
  return `dripn-sweep-${ts}${suffix ? `-${suffix}` : ''}@test.dripn.local`;
}

async function register(email = tsEmail()) {
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: { email, password: PASSWORD, displayName: 'Sweep' },
  });
  if (!reg.ok) {
    const login = await api('/api/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
    if (!login.ok) throw new Error(`register/login failed for ${email}: ${reg.status}`);
    return { email, token: login.json.token, user: login.json.user };
  }
  return { email, token: reg.json.token, user: reg.json.user };
}

async function skipOnboarding(token) {
  await api('/api/onboarding/complete', { method: 'POST', token, body: { step: 1, skipped: true } }).catch(() => {});
  await api('/api/auth/profile', {
    method: 'PUT',
    token,
    body: { hasCompletedOnboarding: true },
  }).catch(() => {});
}

async function createCheckout(token, email, plan, type) {
  if (type === 'dfy' || plan === 'core_wardrobe' || plan === 'outfit_setup') {
    const r = await api('/api/checkout/dfy/create-session', {
      method: 'POST',
      token,
      body: { email, productId: plan },
    });
    if (!r.ok) throw new Error(`DFY checkout ${plan}: ${r.status} ${JSON.stringify(r.json)}`);
    return { sessionId: r.json.sessionId, checkoutUrl: r.json.checkoutUrl, plan };
  }
  const r = await api('/api/subscription/create-checkout', {
    method: 'POST',
    token,
    body: { plan, billingCycle: 'monthly' },
  });
  if (!r.ok) throw new Error(`Sub checkout ${plan}: ${r.status} ${JSON.stringify(r.json)}`);
  return { sessionId: r.json.sessionId, checkoutUrl: r.json.checkoutUrl, plan };
}

async function syncSuccess(sessionId) {
  const res = await fetch(`${API}/api/checkout/success?session_id=${encodeURIComponent(sessionId)}`, { redirect: 'manual' });
  return {
    status: res.status,
    location: res.headers.get('location'),
    redirectOk: res.status >= 300 && res.status < 400,
  };
}

async function verifyTier(token, expected) {
  const me = await api('/api/auth/me', { token });
  const status = await api('/api/subscription/status', { token });
  let verify = { json: {} };
  try {
    verify = await api('/api/subscription/verify', { method: 'POST', token });
  } catch {
    verify = await api('/api/subscription/verify', { method: 'POST', token });
  }

  const meTier = me.json?.subscriptionTier ?? me.json?.tier ?? 'unknown';
  const statusPlan = status.json?.subscription?.tier ?? status.json?.plan ?? status.json?.subscription?.plan ?? 'unknown';
  const verifyPlan = verify.json?.plan ?? verify.json?.tier ?? 'unknown';
  const active = status.json?.subscription?.isActive ?? status.json?.active ?? false;

  const tierMatch = (t) => t === expected || normalize(t) === normalize(expected);
  const pass = tierMatch(meTier) && tierMatch(statusPlan);

  return { pass, meTier, statusPlan, verifyPlan, active, meOk: me.ok, statusOk: status.ok };
}

function normalize(t) {
  const map = {
    subscription: 'style_chat',
    premium: 'personal_stylist',
    pro: 'stylist_unlimited',
    lite: 'outfit_setup',
    core: 'core_wardrobe',
  };
  return map[t] || t;
}

async function prepareTest(testId, plan, type, emailSuffix = '') {
  const email = tsEmail(testId + emailSuffix);
  const { token } = await register(email);
  await skipOnboarding(token);
  const checkout = await createCheckout(token, email, plan, type);
  return { testId, email, token, ...checkout };
}

async function recordResult(row) {
  console.log(JSON.stringify({ type: 'result', ...row }));
}

const cmd = process.argv[2];

try {
  if (cmd === 'prepare-sub') {
    const t = SUB_TESTS.find((x) => x.id === process.argv[3]) || SUB_TESTS[0];
    console.log(JSON.stringify(await prepareTest(t.id, t.plan, t.type), null, 2));
  } else if (cmd === 'prepare-edge') {
    const e = EDGE_TESTS.find((x) => x.id === process.argv[3]) || EDGE_TESTS[0];
    const stepIdx = parseInt(process.argv[4] || '0', 10);
    const step = e.steps[stepIdx];
    const emailSuffix = stepIdx === 0 ? '' : `-s${stepIdx}`;
    console.log(JSON.stringify(await prepareTest(e.id, step.plan, step.plan.includes('_') ? 'dfy' : undefined, emailSuffix), null, 2));
  } else if (cmd === 'prepare-all') {
    const out = [];
    for (const t of SUB_TESTS) {
      out.push(await prepareTest(t.id, t.plan, t.type));
    }
    for (const e of EDGE_TESTS) {
      const email = tsEmail(e.id);
      const { token } = await register(email);
      await skipOnboarding(token);
      const steps = [];
      for (let i = 0; i < e.steps.length; i++) {
        const s = e.steps[i];
        const type = s.plan.includes('_') ? 'dfy' : undefined;
        steps.push({ ...(await createCheckout(token, email, s.plan, type)), step: i });
      }
      out.push({ testId: e.id, email, token, steps, label: e.label, finalExpected: e.finalExpected });
    }
    console.log(JSON.stringify(out, null, 2));
  } else if (cmd === 'sync') {
    console.log(JSON.stringify(await syncSuccess(process.argv[3]), null, 2));
  } else if (cmd === 'verify') {
    const token = process.argv[3];
    const expected = process.argv[4];
    console.log(JSON.stringify(await verifyTier(token, expected), null, 2));
  } else if (cmd === 'checkout-step') {
    const token = process.argv[3];
    const email = process.argv[4];
    const plan = process.argv[5];
    const type = plan.includes('_') ? 'dfy' : undefined;
    console.log(JSON.stringify(await createCheckout(token, email, plan, type), null, 2));
  } else {
    console.log(`Usage:
  prepare-sub <T1-T5>
  prepare-edge <E1-E3> [stepIndex]
  prepare-all
  sync <sessionId>
  verify <token> <expectedTier>
  checkout-step <token> <email> <plan>`);
  }
} catch (e) {
  console.error('ERROR:', e.message);
  process.exit(1);
}

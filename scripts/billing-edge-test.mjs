#!/usr/bin/env node
/** Edge-case billing tests via API + backend success sync */
const API = 'https://dripn-server.onrender.com';
const PASSWORD = 'SweepTest123!';

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
    method: opts.method || 'GET',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 300) }; }
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${path} → ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function login(n) {
  const email = `dripn-sweep-${n}@test.dripn.local`;
  try {
    const data = await api('/api/auth/register', { method: 'POST', body: { email, password: PASSWORD, displayName: `Sweep ${n}` } });
    return { email, token: data.token, user: data.user };
  } catch {
    const data = await api('/api/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
    return { email, token: data.token, user: data.user };
  }
}

async function checkout(token, email, plan) {
  if (plan === 'core_wardrobe' || plan === 'outfit_setup') {
    return api('/api/checkout/dfy/create-session', { method: 'POST', token, body: { email, productId: plan } });
  }
  return api('/api/subscription/create-checkout', { method: 'POST', token, body: { plan, billingCycle: 'monthly' } });
}

async function sync(sessionId) {
  await fetch(`${API}/api/checkout/success?session_id=${encodeURIComponent(sessionId)}`, { redirect: 'manual' });
}

async function tier(n) {
  const { token, user } = await login(n);
  const status = await api('/api/subscription/status', { token });
  return { subscriptionTier: user.subscriptionTier, statusTier: status.subscription?.tier, active: status.subscription?.isActive };
}

async function payPlan(n, plan) {
  const { token, email } = await login(n);
  const c = await checkout(token, email, plan);
  console.log(`Account ${n}: created checkout ${c.sessionId} for ${plan}`);
  console.log(`  PAY IN STRIPE: ${c.checkoutUrl}`);
  return { sessionId: c.sessionId, checkoutUrl: c.checkoutUrl, plan };
}

async function payAndSync(n, plan) {
  const { sessionId } = await payPlan(n, plan);
  // Note: requires Stripe payment completed externally; sync assumes paid session
  await sync(sessionId);
  const t = await tier(n);
  console.log(`Account ${n} after sync:`, t);
  return t;
}

const cmd = process.argv[2];
const n = process.argv[3];
const plan = process.argv[4];

if (cmd === 'checkout') {
  console.log(JSON.stringify(await payPlan(n, plan), null, 2));
} else if (cmd === 'sync') {
  await sync(process.argv[3]);
  console.log(JSON.stringify(await tier(n), null, 2));
} else if (cmd === 'tier') {
  console.log(JSON.stringify(await tier(n), null, 2));
} else {
  console.log('Usage: checkout <n> <plan> | sync <sessionId> <n> | tier <n>');
}

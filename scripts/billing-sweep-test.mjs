#!/usr/bin/env node
/**
 * Billing sweep test helper — API registration, checkout creation, tier verification.
 * Usage: node scripts/billing-sweep-test.mjs <command> [args]
 */
const API = 'https://dripn-server.onrender.com';
const PASSWORD = 'SweepTest123!';

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}), ...opts.headers },
    method: opts.method || 'GET',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${path} → ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function loginByAccount(n) {
  const email = `dripn-sweep-${n}@test.dripn.local`;
  const login = await api('/api/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
  return { email, token: login.token, user: login.user };
}

async function register(n) {
  const email = `dripn-sweep-${n}@test.dripn.local`;
  try {
    const data = await api('/api/auth/register', {
      method: 'POST',
      body: { email, password: PASSWORD, displayName: `Sweep ${n}` },
    });
    return { email, token: data.token, user: data.user };
  } catch (e) {
    const msg = String(e.message);
    if (msg.includes('409') || msg.includes('already registered') || msg.includes('needsVerification')) {
      return loginByAccount(n);
    }
    throw e;
  }
}

async function getMe(token) {
  return api('/api/auth/me', { token });
}

async function getStatus(token) {
  return api('/api/subscription/status', { token });
}

async function createSubCheckout(token, plan, billingCycle = 'monthly') {
  return api('/api/subscription/create-checkout', {
    method: 'POST',
    token,
    body: { plan, billingCycle },
  });
}

async function createBillingCheckout(token, plan, billingCycle = 'monthly') {
  return api('/api/billing/checkout', {
    method: 'POST',
    token,
    body: { plan, billingCycle },
  });
}

async function createDfyCheckout(token, email, productId) {
  return api('/api/checkout/dfy/create-session', {
    method: 'POST',
    token,
    body: { email, productId },
  });
}

async function hitSuccess(sessionId) {
  const res = await fetch(`${API}/api/checkout/success?session_id=${encodeURIComponent(sessionId)}`, { redirect: 'manual' });
  return { status: res.status, location: res.headers.get('location') };
}

async function managePortal(token, returnUrl = 'https://dripnapp.com/subscription') {
  const res = await fetch(`${API}/api/subscription/manage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ returnUrl }),
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 300) }; }
  return { ok: res.ok, status: res.status, body: json };
}

async function verifySubscription(token, sessionId) {
  try {
    return await api('/api/subscription/verify', { method: 'POST', token, body: { sessionId } });
  } catch {
    return null;
  }
}

const cmd = process.argv[2];
const args = process.argv.slice(3);

try {
  if (cmd === 'register') {
    const r = await register(args[0] || '1');
    console.log(JSON.stringify(r, null, 2));
  } else if (cmd === 'me') {
    console.log(JSON.stringify(await getMe(args[0]), null, 2));
  } else if (cmd === 'status') {
    console.log(JSON.stringify(await getStatus(args[0]), null, 2));
  } else if (cmd === 'checkout-sub') {
    console.log(JSON.stringify(await createSubCheckout(args[0], args[1], args[2] || 'monthly'), null, 2));
  } else if (cmd === 'checkout-billing') {
    console.log(JSON.stringify(await createBillingCheckout(args[0], args[1], args[2] || 'monthly'), null, 2));
  } else if (cmd === 'checkout-dfy') {
    console.log(JSON.stringify(await createDfyCheckout(args[0], args[1], args[2]), null, 2));
  } else if (cmd === 'success') {
    console.log(JSON.stringify(await hitSuccess(args[0]), null, 2));
  } else if (cmd === 'manage') {
    const { token } = await login(args[0] || '1');
    console.log(JSON.stringify(await managePortal(token, args[1]), null, 2));
  } else if (cmd === 'verify') {
    console.log(JSON.stringify(await verifySubscription(args[0], args[1]), null, 2));
  } else if (cmd === 'login') {
    console.log(JSON.stringify(await loginByAccount(args[0] || '1'), null, 2));
  } else if (cmd === 'check-account') {
    const n = args[0] || '1';
    const expected = args[1];
    const { token } = await loginByAccount(n);
    const me = await getMe(token);
    const status = await getStatus(token);
    const tier = me.subscriptionTier;
    const statusTier = status.subscription?.tier ?? status.plan ?? null;
    const pass = expected ? tier === expected && statusTier === expected : true;
    console.log(JSON.stringify({ pass, expected, subscriptionTier: tier, statusTier, statusActive: status.subscription?.isActive ?? status.active }, null, 2));
  } else if (cmd === 'checkout-for-account') {
    const n = args[0];
    const plan = args[1];
    const billingCycle = args[2] || 'monthly';
    const { token, email } = await loginByAccount(n);
    let checkout;
    if (plan === 'core_wardrobe' || plan === 'outfit_setup') {
      checkout = await createDfyCheckout(token, email, plan);
    } else {
      checkout = await createSubCheckout(token, plan, billingCycle);
    }
    console.log(JSON.stringify({ account: n, email, ...checkout }, null, 2));
  } else if (cmd === 'full-check') {
    const token = args[0];
    const expected = args[1];
    const me = await getMe(token);
    const status = await getStatus(token);
    const pass = me.subscriptionTier === expected && (status.subscription?.tier ?? status.plan) === expected;
    console.log(JSON.stringify({ pass, expected, subscriptionTier: me.subscriptionTier, statusTier: status.subscription?.tier ?? status.plan, statusActive: status.subscription?.isActive ?? status.active }, null, 2));
  } else {
    console.log('Commands: register <n> | login <n> | manage <n> [returnUrl] | check-account <n> [expectedTier] | checkout-for-account <n> <plan> [monthly] | me <token> | status <token> | checkout-sub <token> <plan> | checkout-billing <token> <plan> | checkout-dfy <token> <email> <productId> | success <sessionId> | verify <token> <sessionId> | full-check <token> <expectedTier>');
  }
} catch (e) {
  console.error('ERROR:', e.message);
  process.exit(1);
}

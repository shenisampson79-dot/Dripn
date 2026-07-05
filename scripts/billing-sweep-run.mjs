#!/usr/bin/env node
/**
 * Run billing sweep: register accounts, create checkouts, verify tiers.
 * After Stripe payment in browser, syncs via backend success URL if needed.
 */
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const API = 'https://dripn-server.onrender.com';
const PASSWORD = 'SweepTest123!';
const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'billing-sweep-test.mjs');

const TESTS = [
  { id: 1, plan: 'style_chat', type: 'sub', expected: 'style_chat', note: 'Style Chat £9.99/mo' },
  { id: 2, plan: 'personal_stylist', type: 'sub', expected: 'personal_stylist', note: 'Personal Stylist £14.99/mo' },
  { id: 3, plan: 'stylist_unlimited', type: 'sub', expected: 'stylist_unlimited', note: 'Stylist Unlimited £19.99/mo' },
  { id: 4, plan: 'core_wardrobe', type: 'dfy', expected: 'core_wardrobe', note: 'Core Wardrobe £39.99' },
  { id: 5, plan: 'outfit_setup', type: 'dfy', expected: 'outfit_setup', note: 'Outfit Setup £19.99' },
];

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
    method: opts.method || 'GET',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${path} → ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

async function login(n) {
  const email = `dripn-sweep-${n}@test.dripn.local`;
  try {
    const data = await api('/api/auth/register', { method: 'POST', body: { email, password: PASSWORD, displayName: `Sweep ${n}` } });
    return { email, token: data.token, user: data.user };
  } catch (e) {
    const msg = String(e.message);
    if (msg.includes('409') || msg.includes('already registered') || msg.includes('needsVerification')) {
      const data = await api('/api/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
      return { email, token: data.token, user: data.user };
    }
    throw e;
  }
}

async function createCheckout(token, email, plan) {
  if (plan === 'core_wardrobe' || plan === 'outfit_setup') {
    return api('/api/checkout/dfy/create-session', { method: 'POST', token, body: { email, productId: plan } });
  }
  return api('/api/subscription/create-checkout', { method: 'POST', token, body: { plan, billingCycle: 'monthly' } });
}

async function syncSuccess(sessionId) {
  const res = await fetch(`${API}/api/checkout/success?session_id=${encodeURIComponent(sessionId)}`, { redirect: 'manual' });
  return { status: res.status, location: res.headers.get('location') };
}

async function checkTier(n, expected) {
  const { token, user } = await login(n);
  let meTier = user.subscriptionTier;
  try {
    const me = await api('/api/auth/me', { token });
    meTier = me.subscriptionTier ?? meTier;
  } catch {
    // /api/auth/me intermittently 500 — fall back to login + status
  }
  const status = await api('/api/subscription/status', { token });
  const tier = meTier;
  const statusTier = status.subscription?.tier;
  return {
    pass: tier === expected && statusTier === expected,
    subscriptionTier: tier,
    statusTier,
    statusActive: status.subscription?.isActive,
  };
}

async function inspectSuccessUrl(n, plan) {
  const { token, email } = await login(n);
  const checkout = await createCheckout(token, email, plan);
  const url = checkout.checkoutUrl || checkout.url;
  const usesFrontend = url && !url.includes('dripn-server.onrender.com');
  const successOnFrontend = url ? false : false;
  // Parse success from session by checking checkout URL host only; actual success_url is in Stripe session
  return { sessionId: checkout.sessionId, checkoutUrl: url, plan };
}

const cmd = process.argv[2];

if (cmd === 'prepare') {
  for (const t of TESTS) {
    const { email } = await login(t.id);
    const checkout = await createCheckout((await login(t.id)).token, email, t.plan);
    console.log(JSON.stringify({ ...t, email, sessionId: checkout.sessionId, checkoutUrl: checkout.checkoutUrl }));
  }
} else if (cmd === 'sync') {
  const sessionId = process.argv[3];
  console.log(JSON.stringify(await syncSuccess(sessionId), null, 2));
} else if (cmd === 'verify') {
  const n = process.argv[3];
  const expected = process.argv[4];
  console.log(JSON.stringify(await checkTier(n, expected), null, 2));
} else if (cmd === 'verify-all') {
  const results = [];
  for (const t of TESTS) {
    try {
      const r = await checkTier(t.id, t.expected);
      results.push({ ...t, ...r });
    } catch (e) {
      results.push({ ...t, pass: false, error: e.message });
    }
  }
  console.log(JSON.stringify(results, null, 2));
} else {
  console.log('Usage: prepare | sync <sessionId> | verify <n> <expected> | verify-all');
}

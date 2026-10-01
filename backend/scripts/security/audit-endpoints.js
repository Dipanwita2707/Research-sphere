/**
 * Endpoint security audit: calls EVERY registered route against a running backend.
 *
 *   AUDIT_BASE=http://127.0.0.1:5099 node scripts/security/audit-endpoints.js [--auth]
 *
 * Phase 1 (always): no credentials, then a forged token (wrong signature) and an "alg: none"
 *   token. Every route must refuse (401/403), except the explicit PUBLIC allowlist below.
 *   Any 2xx is a security finding; any 5xx is a robustness finding.
 * Phase 2 (--auth): signs in as each role and calls every route with a dummy id / empty body.
 *   Any 5xx is a finding (input should be rejected with 4xx, never crash). State-changing
 *   endpoints listed in SKIP_AUTHED are not exercised (logout, session revocation, ...).
 *
 * Exit code 1 when there are findings.
 */

'use strict';

const crypto = require('crypto');
const { collectRoutes } = require('./route-inventory');

const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:5099';
const DUMMY_UUID = '00000000-0000-4000-8000-00000000abcd';

/** Routes intended to work without signing in (method + path pattern). */
const PUBLIC = [
  ['GET', /^\/health$/], ['GET', /^\/ready$/], ['GET', /^\/api\/v1\/health$/],
  ['POST', /^\/api\/v1\/auth\/(login|forgot-password|reset-password|verify-reset-otp|verify-otp|refresh)$/],
  ['GET', /^\/api\/v1\/auth\/(reset-password\/validate|csrf)/],
  ['POST', /^\/api\/v1\/license\/verify$/], ['GET', /^\/api\/v1\/license\/verify$/],
  ['GET', /^\/api\/v1\/dpdp\/public\//], ['POST', /^\/api\/v1\/dpdp\/public\//],
  ['POST', /^\/api\/v1\/contact$/], ['GET', /^\/api\/v1\/public\//],
  ['POST', /^\/api\/v1\/auth\/logout$/],
];

/** Not exercised while signed in, because they would end the session or mutate real state. */
const SKIP_AUTHED = [/\/auth\/logout/, /\/auth\/(sessions|logout-all)/, /\/pipeline\/runs$/, /\/cache\/flush$/, /\/change-password/, /\/dpdp\/consents\/.+\/withdraw/, /\/dpdp\/requests$/];

const isPublic = (m, p) => PUBLIC.some(([pm, re]) => (pm === m || pm === 'ALL') && re.test(p));

const concrete = (p) =>
  p
    .replace(/\/\*\w*/g, '/a/b.txt')
    .replace(/:(\w+)/g, (_, name) => (/token$/i.test(name) ? 'x'.repeat(40) : /slug/i.test(name) ? 'no-such-slug' : /uid|query|code|purpose|type|status|scope|format|category|year/i.test(name) && !/id$/i.test(name) ? 'x' : DUMMY_UUID));

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const forgedTokens = () => {
  const payload = { id: DUMMY_UUID, role: 'superadmin', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 };
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64(payload);
  const sig = crypto.createHmac('sha256', 'not-the-real-secret').update(`${head}.${body}`).digest('base64url');
  return { wrongSig: `${head}.${body}.${sig}`, algNone: `${b64({ alg: 'none', typ: 'JWT' })}.${body}.` };
};

async function call(method, url, { cookie, bearer, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  try {
    const res = await fetch(BASE + url, { method, headers, body: method === 'GET' || method === 'HEAD' ? undefined : JSON.stringify(body ?? {}), redirect: 'manual', signal: AbortSignal.timeout(20000) });
    const text = await res.text();
    return { status: res.status, text: text.slice(0, 160) };
  } catch (e) {
    return { status: 0, text: e.message };
  }
}

async function login(username, password) {
  const res = await fetch(`${BASE}/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  const ck = (res.headers.getSetCookie?.() || []).find((c) => c.startsWith('token='));
  return { status: res.status, cookie: ck ? ck.split(';')[0] : null };
}

async function pool(items, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }));
  return out;
}

async function main() {
  const { routes } = collectRoutes();
  const findings = [];
  const testable = routes.filter((r) => r.path.startsWith('/') && !r.path.includes(' '));
  console.log(`Auditing ${testable.length} routes against ${BASE}\n`);

  // Sign in first: the login limiter allows 10 attempts per 15 min per IP, and phase 1 also hits /auth/login.
  const sessions = [];
  if (process.argv.includes('--auth')) {
    for (const [username, password] of (process.env.AUDIT_USERS || '').split(',').filter(Boolean).map((x) => x.split(':'))) {
      const { status, cookie } = await login(username, password);
      if (cookie) sessions.push({ username, cookie });
      else findings.push({ kind: 'LOGIN', who: username, method: 'POST', path: '/api/v1/auth/login', status, text: 'could not sign in' });
    }
  }

  // ── Phase 1: unauthenticated + forged ───────────────────────────────────────
  const { wrongSig, algNone } = forgedTokens();
  const phase1 = await pool(testable, 8, async (r) => {
    const url = concrete(r.path);
    const anon = await call(r.method, url);
    const forged = await call(r.method, url, { bearer: wrongSig, cookie: `token=${wrongSig}` });
    const none = await call(r.method, url, { bearer: algNone, cookie: `token=${algNone}` });
    return { r, url, anon, forged, none };
  });
  const tally = {};
  for (const { r, url, anon, forged, none } of phase1) {
    const pub = isPublic(r.method, r.path);
    for (const [label, res] of [['anonymous', anon], ['forged token', forged], ['alg:none token', none]]) {
      tally[res.status] = (tally[res.status] || 0) + 1;
      if (res.status >= 500 || res.status === 0) findings.push({ kind: 'CRASH', who: label, method: r.method, path: r.path, url, status: res.status, text: res.text });
      else if (!pub && res.status >= 200 && res.status < 300) findings.push({ kind: 'UNPROTECTED', who: label, method: r.method, path: r.path, url, status: res.status, text: res.text });
    }
  }
  console.log('Phase 1 status distribution (anonymous + forged):', JSON.stringify(tally));

  // ── Phase 2: signed in ──────────────────────────────────────────────────────
  if (process.argv.includes('--auth')) {
    for (const { username, cookie } of sessions) {
      const targets = testable.filter((r) => !SKIP_AUTHED.some((re) => re.test(r.path)));
      const res = await pool(targets, 6, async (r) => ({ r, res: await call(r.method, concrete(r.path), { cookie }) }));
      const dist = {};
      for (const { r, res: x } of res) {
        dist[x.status] = (dist[x.status] || 0) + 1;
        if (x.status >= 500 || x.status === 0) findings.push({ kind: 'CRASH', who: username, method: r.method, path: r.path, status: x.status, text: x.text });
        if (x.status === 201) console.log(`  note: ${username} created a record via ${r.method} ${r.path} with an empty body: ${x.text.slice(0, 100)}`);
      }
      console.log(`Phase 2 as ${username}:`, JSON.stringify(dist));
    }
  }

  // ── Report ──────────────────────────────────────────────────────────────────
  const uniq = new Map();
  for (const f of findings) {
    const k = `${f.kind} ${f.method} ${f.path}`;
    if (!uniq.has(k)) uniq.set(k, { ...f, who: new Set([f.who]) });
    else uniq.get(k).who.add(f.who);
  }
  console.log(`\nFindings: ${uniq.size}`);
  for (const f of uniq.values()) console.log(` [${f.kind}] ${f.method} ${f.path} -> ${f.status} (${[...f.who].join(', ')}) ${f.text.replace(/\s+/g, ' ').slice(0, 110)}`);
  return uniq.size;
}

main()
  .then((n) => setTimeout(() => process.exit(n ? 1 : 0), 50))
  .catch((e) => {
    console.error(e);
    process.exit(2);
  });

/**
 * Checks the keys in .env against the real services: `npm run check:keys`.
 * Never prints key values, never creates PostHog events and never writes a row to the sheet
 * (it only sends requests that the endpoint must reject or silently drop).
 */
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');
const { PUBLIC_POSTHOG_KEY: KEY = '', PUBLIC_POSTHOG_HOST: HOST = 'https://us.i.posthog.com', PUBLIC_REGISTER_ENDPOINT: EP = '' } = process.env;

let failed = 0;
const ok = (m) => console.log(`  ✔ ${m}`);
const warn = (m) => console.log(`  ⚠ ${m}`);
const bad = (m) => { failed++; console.log(`  ✘ ${m}`); };
const mask = (v) => (v ? `${v.slice(0, 4)}…${v.slice(-3)} (${v.length} chars)` : '(empty)');

/* ---------- PostHog ---------- */
console.log('\nPostHog');
if (!KEY) bad('PUBLIC_POSTHOG_KEY is empty: analytics stay off');
else if (KEY.startsWith('phx_')) bad('PUBLIC_POSTHOG_KEY is a PERSONAL API key (phx_…). It is private: revoke it in PostHog and use the project key (phc_…)');
else if (!/^phc_[A-Za-z0-9]{20,}$/.test(KEY)) bad(`PUBLIC_POSTHOG_KEY does not look like a project key: ${mask(KEY)}`);
else ok(`project key format ${mask(KEY)}`);

let host;
try { host = new URL(HOST); } catch { bad(`PUBLIC_POSTHOG_HOST is not a URL: ${HOST}`); }
if (host) {
  if (/^(us|eu)\.i\.posthog\.com$/.test(host.hostname)) ok(`host ${host.origin}`);
  else if (/^(app|us|eu)\.posthog\.com$/.test(host.hostname)) warn(`host ${host.origin} is the app UI; use the ingestion host (us.i.posthog.com or eu.i.posthog.com)`);
  else warn(`custom host ${host.href} (reverse proxy?)`);
}
// Keeps the path of a proxy host such as https://flutterperu.com/ingest.
const at = (path) => host.href.replace(/\/$/, '') + path;
if (KEY && host && !KEY.startsWith('phx_')) {
  try {
    // Feature-flags endpoint: authenticates the project key without creating any event.
    const res = await fetch(at('/flags/?v=2'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: KEY, distinct_id: 'flutterconf-key-check' }),
    });
    if (res.ok) ok(`key accepted by ${host.hostname} (HTTP ${res.status})`);
    else if (res.status === 401) bad(`key rejected by ${host.hostname} (HTTP 401): wrong key, or the project lives in the other region (US/EU)`);
    else bad(`unexpected answer from ${host.hostname}: HTTP ${res.status}`);
    const asset = await fetch(at('/static/array.js').replace('.i.posthog.com', '-assets.i.posthog.com'), { method: 'HEAD' });
    asset.ok ? ok('library (array.js) reachable') : bad(`array.js not reachable: HTTP ${asset.status}`);
  } catch (e) { bad(`could not reach PostHog: ${e.message}`); }
}

/* ---------- Apps Script endpoint ---------- */
console.log('\nSign-up endpoint (Google Apps Script)');
const post = async (body) => {
  const res = await fetch(EP, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow' });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: res.status + ' ' + text.slice(0, 80).replace(/\s+/g, ' ') }; }
};
let version = 0;
if (!EP) bad('PUBLIC_REGISTER_ENDPOINT is empty: the form says "abre en unas horas"');
else if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(EP)) {
  bad('PUBLIC_REGISTER_ENDPOINT should look like https://script.google.com/macros/s/<id>/exec' + (EP.endsWith('/dev') ? ' (it ends in /dev: that is the test URL, only you can use it)' : ''));
} else {
  ok('URL format (…/exec)');
  try {
    const res = await fetch(EP, { redirect: 'follow' });
    const text = await res.text();
    let health = null;
    try { health = JSON.parse(text); } catch { /* Google login page or error HTML */ }
    if (health?.ok && health.service === 'flutterconf-peru-register') {
      version = health.version ?? 1;
      ok(`health check answers (Code.gs version ${version})`);
      if (version < 3) warn(`the deployed script is version ${version}, the repo has 3: paste the new Code.gs and use Deploy → Manage deployments → Edit → Version: New version`);
    } else if (/accounts\.google\.com|ServiceLogin/.test(text)) bad('Google asks to sign in: set "Who has access" to "Anyone" in the deployment');
    else bad(`health check did not answer as expected (HTTP ${res.status})`);

    if (version) {
      const base = { name: 'Key Check', email: 'key.check@example.com', role: 'otro', city: '', page: '/check-keys', elapsed: 9000 };
      const r1 = await post({ ...base, consent: false });
      r1.ok === false && r1.error === 'consent' ? ok('rejects a sign-up without consent (nothing written)') : bad(`consent check: ${JSON.stringify(r1)}`);
      const r2 = await post({ ...base, consent: true, website: 'http://bot' });
      r2.ok === true ? ok('honeypot answers ok to bots (nothing written)') : bad(`honeypot: ${JSON.stringify(r2)}`);
      if (version >= 2) {
        const r3 = await post({ ...base, consent: true, email: 'bot@mailinator.com' });
        r3.error === 'email_disposable' ? ok('rejects disposable inboxes') : bad(`disposable check: ${JSON.stringify(r3)}`);
        const r4 = await post({ ...base, consent: true, name: 'Buy now http://spam.xyz' });
        r4.error === 'name' ? ok('rejects links in names') : bad(`name check: ${JSON.stringify(r4)}`);
        const r5 = await post({ ...base, consent: true, elapsed: 300 });
        r5.ok === true ? ok('time trap drops instant submissions (nothing written)') : bad(`time trap: ${JSON.stringify(r5)}`);
        const r6 = await post({ ...base, consent: true, page: 'x'.repeat(3000) });
        r6.error === 'too_large' ? ok('rejects oversized bodies') : bad(`size limit: ${JSON.stringify(r6)}`);
      }
    }
  } catch (e) { bad(`could not reach the endpoint: ${e.message}`); }
}

console.log(failed ? `\n${failed} problem(s) found.\n` : '\nAll keys look good.\n');
process.exit(failed ? 1 : 0);

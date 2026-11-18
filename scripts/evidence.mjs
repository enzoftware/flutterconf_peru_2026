/**
 * Evidence screenshots for pull requests. Run: `npm run evidence -- [options]`.
 *
 * Drives the local Google Chrome over the DevTools protocol (no npm dependency): it scrolls to each
 * target the way a visitor would, so the scroll engine reveals the section (data-r, pins, counters),
 * waits for the motion to settle, then saves a viewport PNG. A plain `chrome --screenshot` of
 * `/#section` shows an empty page, because nothing scrolls and nothing gets revealed.
 *
 *   --url <url>       page to open (default http://localhost:4321/flutterconf_peru_2026/)
 *   --at <targets>    comma-separated CSS selectors to scroll to, or "top" (default "top")
 *   --sizes <list>    comma-separated: desktop (1280×800), mobile (390×844) or WxH (default desktop,mobile)
 *   --out <dir>       output folder (default exports/evidence, git-ignored)
 *   --name <prefix>   file name prefix (default "shot")
 *   --wait <ms>       settle time after scrolling (default 1200)
 *
 * Files are named <prefix>-<target>-<size>.png and their paths are printed, one per line.
 * Example: npm run evidence -- --at "top,#registro" --name signup
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values: opt } = parseArgs({
  options: {
    url: { type: 'string', default: 'http://localhost:4321/flutterconf_peru_2026/' },
    at: { type: 'string', default: 'top' },
    sizes: { type: 'string', default: 'desktop,mobile' },
    out: { type: 'string', default: 'exports/evidence' },
    name: { type: 'string', default: 'shot' },
    wait: { type: 'string', default: '1200' },
  },
});

const CHROME = process.env.CHROME_PATH ?? [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(existsSync);
if (!CHROME) { console.error('Google Chrome not found. Set CHROME_PATH.'); process.exit(1); }

const PRESETS = { desktop: { width: 1280, height: 800, mobile: false, scale: 1 }, mobile: { width: 390, height: 844, mobile: true, scale: 2 } };
const sizes = opt.sizes.split(',').map((s) => s.trim()).map((s) => {
  if (PRESETS[s]) return { label: s, ...PRESETS[s] };
  const m = /^(\d+)x(\d+)$/.exec(s);
  if (!m) { console.error(`Unknown size "${s}": use desktop, mobile or WxH.`); process.exit(1); }
  return { label: s, width: +m[1], height: +m[2], mobile: +m[1] < 768, scale: 1 };
});
const targets = opt.at.split(',').map((s) => s.trim()).filter(Boolean);
const out = resolve(opt.out);
mkdirSync(out, { recursive: true });
const slug = (s) => s.replace(/^[#.]/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'top';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Chrome + a minimal CDP client ---------- */
const profile = mkdtempSync(join(tmpdir(), 'evidence-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-color-profile=srgb',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const wsUrl = await new Promise((ok, fail) => {
  let buf = '';
  chrome.stderr.on('data', (d) => { buf += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf); if (m) ok(m[1]); });
  chrome.on('exit', () => fail(new Error('Chrome exited before DevTools was ready.')));
  setTimeout(() => fail(new Error('Timed out waiting for Chrome DevTools.')), 15000);
});
const ws = new WebSocket(wsUrl);
await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
let seq = 0;
const pending = new Map(), listeners = new Set();
ws.onmessage = ({ data }) => {
  const msg = JSON.parse(data);
  if (msg.id && pending.has(msg.id)) {
    const { ok, fail } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? fail(new Error(msg.error.message)) : ok(msg.result);
  } else for (const l of listeners) l(msg);
};
const send = (method, params = {}, sessionId) => new Promise((ok, fail) => {
  const id = ++seq;
  pending.set(id, { ok, fail });
  ws.send(JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) }));
});
const once = (method, sessionId) => new Promise((ok) => {
  const l = (msg) => { if (msg.method === method && msg.sessionId === sessionId) { listeners.delete(l); ok(msg.params); } };
  listeners.add(l);
});

/** Scrolls like a visitor (small steps, one per frame) so the engine reveals everything on the way. */
const scrollTo = (target) => `(async () => {
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const el = ${JSON.stringify(target)} === 'top' ? null : document.querySelector(${JSON.stringify(target)});
  if (${JSON.stringify(target)} !== 'top' && !el) return 'missing';
  const goal = el ? Math.max(0, el.getBoundingClientRect().top + scrollY - 40) : 0;
  const step = Math.max(40, innerHeight / 8) * Math.sign(goal - scrollY || 1);
  while (Math.abs(goal - scrollY) > Math.abs(step)) { scrollBy(0, step); await frame(); }
  scrollTo(0, goal); await frame(); await frame();
  return 'ok';
})()`;

try {
  for (const size of sizes) {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Page.enable', {}, sessionId);
    await send('Emulation.setDeviceMetricsOverride', { width: size.width, height: size.height, deviceScaleFactor: size.scale, mobile: size.mobile }, sessionId);
    const loaded = once('Page.loadEventFired', sessionId);
    await send('Page.navigate', { url: opt.url }, sessionId);
    await loaded;
    await send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => true)', awaitPromise: true }, sessionId);
    await sleep(800);
    for (const target of targets) {
      const { result } = await send('Runtime.evaluate', { expression: scrollTo(target), awaitPromise: true }, sessionId);
      if (result.value === 'missing') { console.error(`No element matches ${target} on ${opt.url}`); process.exitCode = 1; continue; }
      await sleep(+opt.wait);
      const { data } = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
      const file = join(out, `${opt.name}-${slug(target)}-${size.label}.png`);
      writeFileSync(file, Buffer.from(data, 'base64'));
      console.log(file);
    }
    await send('Target.closeTarget', { targetId });
  }
} finally {
  ws.close();
  chrome.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}

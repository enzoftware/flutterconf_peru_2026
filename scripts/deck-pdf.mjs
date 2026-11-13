#!/usr/bin/env node
/**
 * Export a sponsor deck to PDF with the local Google Chrome (no npm dependencies).
 *
 *   npm run dev                                   # decks with publish:false only exist in dev
 *   npm run deck:pdf -- somnio-software           # → exports/somnio-software.pdf
 *   npm run deck:pdf -- somnio-software --base http://localhost:4322/flutterconf_peru_2026
 *
 * Waits for fonts and images, then prints with the page's own @page size (1920×1080 px per slide)
 * and backgrounds on. Fails if Monchila is missing or any image did not load, so a broken PDF never
 * goes out. Set CHROME_PATH to use another Chromium-based browser.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith('--'));
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
if (!slug) { console.error('Usage: npm run deck:pdf -- <slug> [--base <dev url>] [--out <file.pdf>]'); process.exit(1); }
const base = opt('base', 'http://localhost:4321/flutterconf_peru_2026').replace(/\/$/, '');
const out = opt('out', `exports/${slug}.pdf`);
const url = `${base}/decks/${slug}/`;

const CHROME = process.env.CHROME_PATH ?? [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(existsSync);
if (!CHROME) { console.error('Google Chrome not found. Set CHROME_PATH.'); process.exit(1); }

const profile = mkdtempSync(join(tmpdir(), 'deck-pdf-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--force-color-profile=srgb',
], { stdio: ['ignore', 'ignore', 'pipe'] });

const cleanup = () => { chrome.kill(); try { rmSync(profile, { recursive: true, force: true }); } catch {} };

try {
  const wsBrowser = await new Promise((resolve, reject) => {
    let buf = '';
    chrome.stderr.on('data', (d) => { buf += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf); if (m) resolve(m[1]); });
    chrome.on('exit', (code) => reject(new Error(`Chrome exited (${code})`)));
    setTimeout(() => reject(new Error('Chrome did not start')), 15000);
  });

  // One WebSocket to the browser, flattened sessions for the page.
  const ws = new WebSocket(wsBrowser);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map(); const listeners = [];
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else listeners.forEach((l) => l(msg));
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const n = ++id; pending.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params, ...(sessionId && { sessionId }) }));
  });
  const once = (method, sessionId) => new Promise((resolve) => {
    const l = (m) => { if (m.method === method && m.sessionId === sessionId) { listeners.splice(listeners.indexOf(l), 1); resolve(m.params); } };
    listeners.push(l);
  });

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false }, sessionId);
  const loaded = once('Page.loadEventFired', sessionId);
  const nav = await send('Page.navigate', { url }, sessionId);
  if (nav.errorText) throw new Error(`${url}: ${nav.errorText}. Is \`npm run dev\` running? Pass --base if it uses another port.`);
  await loaded;

  const { result } = await send('Runtime.evaluate', {
    awaitPromise: true, returnByValue: true,
    expression: `(async () => {
      if (!document.querySelector('.slide')) return { error: 'No slides on ' + location.href + ' (404, or the deck is unpublished and this is not the dev server).' };
      await document.fonts.ready;
      const imgs = [...document.querySelectorAll('.slide img')];
      await Promise.all(imgs.map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })));
      await new Promise((r) => setTimeout(r, 600));
      const fonts = [...document.fonts].filter((f) => f.family.startsWith('Monchila')).map((f) => f.family + ':' + f.status);
      return {
        slides: document.querySelectorAll('.slide').length,
        brokenImages: imgs.filter((i) => !i.naturalWidth).map((i) => i.alt || i.src),
        monchila: fonts,
        warning: document.querySelector('.deck-warn')?.innerText ?? null,
      };
    })()`,
  }, sessionId);
  const info = result.value;
  if (info.error) throw new Error(info.error);
  if (!info.monchila.some((f) => f === 'Monchila:loaded')) throw new Error('Monchila is not loaded; see brand/fonts/monchila/README.md.');
  if (info.brokenImages.length) throw new Error(`Images that did not load: ${info.brokenImages.join(', ')}`);
  if (info.warning) console.warn(`Deck warning: ${info.warning}`);

  // Print media first: the page sizes its title filters for 1920 px slides when it switches.
  await send('Emulation.setEmulatedMedia', { media: 'print' }, sessionId);
  await new Promise((r) => setTimeout(r, 300));
  const { data } = await send('Page.printToPDF', {
    printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false,
    marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
  }, sessionId);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, Buffer.from(data, 'base64'));
  console.log(`${info.slides} slides → ${out}`);
  ws.close();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  cleanup();
}

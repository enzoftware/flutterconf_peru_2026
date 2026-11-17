/**
 * Tests for Code.gs, run in Node with in-memory fakes of the Apps Script services (`npm test`).
 * Covers spam traps, duplicates, throttling, formula injection and parity with src/lib/registration.ts.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { CASES } from '../../src/lib/registration.cases.ts';

const code = readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');

/** Fresh script context with a fake spreadsheet (rows as arrays) and a fake cache. */
function load({ rows = [] } = {}) {
  const sheet = {
    rows,
    getLastRow: () => sheet.rows.length,
    appendRow: (r) => sheet.rows.push(Array.from(r, String)),
    setFrozenRows() {},
    getRange: (r, c, nr, nc) => ({
      getValues: () => sheet.rows.slice(r - 1, r - 1 + nr).map((row) => row.slice(c - 1, c - 1 + nc)),
      setValues: (v) => { Array.from(v).forEach((vals, i) => { sheet.rows[r - 1 + i] = Array.from(vals, String); }); },
      setFontWeight() {},
      createTextFinder: (value) => ({
        matchEntireCell: () => ({
          findNext: () => sheet.rows.slice(r - 1, r - 1 + nr).some((row) => row[c - 1] === value) ? {} : null,
        }),
      }),
    }),
  };
  const cache = new Map();
  const ctx = {
    console,
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet, insertSheet: () => sheet }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) ?? null, put: (k, v) => cache.set(k, v) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ setMimeType: () => JSON.parse(s) }) },
    Utilities: { formatDate: () => '2026-11-17 12:00:00' },
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  const post = (body) => ctx.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } });
  return { ctx, sheet, cache, post };
}

const person = (over = {}) => ({
  name: 'Ana Quispe', email: 'ana@example.com', role: 'dev-flutter', city: 'Lima', consent: true,
  website: '', elapsed: 9000, page: '/', source: 'instagram', utm_source: 'instagram', utm_medium: '', utm_campaign: 'launch', ...over,
});
const dataRows = (sheet) => sheet.rows.slice(1);

let s;
beforeEach(() => { s = load(); });

test('health check reports the deployed version', () => {
  assert.deepEqual(s.ctx.doGet(), { ok: true, service: 'flutterconf-peru-register', version: 3 });
});

test('valid sign-up appends one row with headers and attribution', () => {
  assert.deepEqual(s.post(person()), { ok: true });
  assert.equal(s.sheet.rows[0][0], 'Fecha (Lima)');
  assert.equal(s.sheet.rows[0][11], 'Clave correo');
  const [row] = dataRows(s.sheet);
  assert.deepEqual(row.slice(1, 12), ['Ana Quispe', 'ana@example.com', 'dev-flutter', 'Lima', 'Sí', 'instagram', 'instagram', '', 'launch', '/', 'ana@example.com']);
});

test('honeypot: answers ok, writes nothing', () => {
  assert.deepEqual(s.post(person({ website: 'http://spam.xyz' })), { ok: true });
  assert.equal(dataRows(s.sheet).length, 0);
});

test('time trap: sent 1 s after load answers ok, writes nothing', () => {
  assert.deepEqual(s.post(person({ elapsed: 1000 })), { ok: true });
  assert.equal(dataRows(s.sheet).length, 0);
});

test('duplicate: same inbox written differently is stored once', () => {
  s.post(person({ email: 'ana.quispe@gmail.com' }));
  s.cache.clear(); // past the 10-minute cooldown: the sheet lookup must still catch it
  assert.deepEqual(s.post(person({ email: 'AnaQuispe+flutter@googlemail.com' })), { ok: true });
  assert.equal(dataRows(s.sheet).length, 1);
});

test('duplicate: rows from version 1 (no key column) are still detected', () => {
  const v1 = load({ rows: [['Fecha (Lima)', 'Nombre', 'Correo'], ['2026-11-17', 'Ana', 'ana@example.com']] });
  assert.deepEqual(v1.post(person()), { ok: true });
  assert.equal(v1.sheet.rows[0][11], 'Clave correo', 'header row upgraded');
});

test('a failed write stays retryable (no false "duplicate")', () => {
  s.post(person({ email: 'seed@example.com' })); // creates the header row
  const append = s.sheet.appendRow;
  s.sheet.appendRow = () => { throw new Error('Sheets is down'); };
  assert.deepEqual(s.post(person()), { ok: false, error: 'server' });
  s.sheet.appendRow = append;
  assert.deepEqual(s.post(person()), { ok: true });
  assert.equal(dataRows(s.sheet).length, 2);
});

test('cooldown: hammering the same email does not touch the sheet', () => {
  s.post(person());
  for (let i = 0; i < 5; i++) assert.deepEqual(s.post(person()), { ok: true });
  assert.equal(dataRows(s.sheet).length, 1);
});

test('rate limit: more than 60 sign-ups in a minute are refused', () => {
  let limited = 0;
  for (let i = 0; i < 65; i++) if (s.post(person({ email: `p${i}@example.com` })).error === 'rate_limited') limited++;
  assert.equal(limited, 5);
  assert.equal(dataRows(s.sheet).length, 60);
});

test('formula injection is neutralized in free-text columns', () => {
  s.post(person({ utm_campaign: '=IMPORTXML("http://evil","//a")', source: '+cmd' }));
  const [row] = dataRows(s.sheet);
  assert.ok(row[9].startsWith("'="));
  assert.ok(row[6].startsWith("'+"));
});

test('time trap: a body without elapsed is dropped too', () => {
  const { elapsed, ...noElapsed } = person();
  assert.deepEqual(s.post(noElapsed), { ok: true });
  assert.deepEqual(s.post(person({ elapsed: '9000' })), { ok: true });
  assert.equal(dataRows(s.sheet).length, 0);
});

test('duplicates get the same answer as new sign-ups (no way to probe who registered)', () => {
  const first = s.post(person());
  s.cache.clear();
  assert.deepEqual(s.post(person()), first);
  assert.equal(dataRows(s.sheet).length, 1);
});

test('bad requests', () => {
  assert.deepEqual(s.post('{not json'), { ok: false, error: 'bad_request' });
  assert.deepEqual(s.post('[1,2]'), { ok: false, error: 'bad_request' });
  assert.deepEqual(s.post(JSON.stringify(person({ page: 'x'.repeat(3000) }))), { ok: false, error: 'too_large' });
  assert.equal(dataRows(s.sheet).length, 0);
});

// Parity: the server must accept and reject exactly what the form does.
for (const [desc, over, expected] of CASES) {
  test(`parity with registration.ts: ${desc}`, () => {
    const t = load();
    const r = t.post(person(over));
    if (expected === null) assert.equal(r.ok, true, JSON.stringify(r));
    else assert.deepEqual(r, { ok: false, error: expected });
  });
}

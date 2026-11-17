/** Sign-up validation rules (`npm test`). The same CASES run against Code.gs in Code.test.mjs. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, emailKey, isDisposable } from './registration.ts';
import { CASES } from './registration.cases.ts';

const base = { name: 'Ana Quispe', email: 'ana@example.com', role: 'dev-flutter', city: 'Lima', consent: true };


for (const [desc, over, expected] of CASES) {
  test(`validate: ${desc}`, () => {
    const r = validate({ ...base, ...over });
    if (expected === null) assert.equal(r.ok, true, JSON.stringify(r));
    else assert.deepEqual(r, { ok: false, error: expected });
  });
}

test('validate trims and collapses spaces', () => {
  const r = validate({ ...base, name: '  Ana    Quispe ', email: ' ANA@example.com ' });
  assert.ok(r.ok);
  if (r.ok) { assert.equal(r.data.name, 'Ana Quispe'); assert.equal(r.data.email, 'ana@example.com'); }
});

test('emailKey: one key per inbox', () => {
  assert.equal(emailKey('Ana.Quispe+flutter@Gmail.com'), 'anaquispe@gmail.com');
  assert.equal(emailKey('ana.quispe@googlemail.com'), 'anaquispe@gmail.com');
  assert.equal(emailKey('ana.quispe+x@empresa.pe'), 'ana.quispe@empresa.pe'); // dots matter outside Gmail
});

test('isDisposable', () => {
  assert.equal(isDisposable('a@mailinator.com'), true);
  assert.equal(isDisposable('a@gmail.com'), false);
  assert.equal(isDisposable('a@notmailinator.com'), false);
});

/**
 * FlutterConf Perú 2026 · sign-up endpoint ("Avísame primero").
 *
 * A Google Apps Script web app bound to the sign-up spreadsheet. The landing posts the form here
 * and this script appends one row per person. Setup: integrations/google-sheets/README.md.
 *
 * The URL is public (it ships in the page), so the script defends itself:
 *  1. body size limit (2 KB) and JSON parsing inside try/catch,
 *  2. honeypot field ("website") and a time trap (sent faster than 2.5 s after the page loaded):
 *     both answer ok without writing, so bots don't learn they were caught,
 *  3. the same validation as src/lib/registration.ts (names without links or digits, real email format,
 *     disposable inboxes rejected, known roles only, explicit consent),
 *  4. duplicates: one row per inbox, using a normalized key (lowercase, no +tag, Gmail without dots),
 *  5. throttling: the same inbox at most once per 10 minutes, and 60 sign-ups per minute overall,
 *  6. a script lock so concurrent writes never collide, and formula injection is neutralized.
 *
 * Keep the rules in sync with src/lib/registration.ts. `npm test` runs the same cases on both.
 */

const VERSION = 3;
const SHEET_NAME = 'Registros';
const HEADERS = ['Fecha (Lima)', 'Nombre', 'Correo', 'Perfil', 'Ciudad', 'Acepta correos', 'Fuente', 'UTM source', 'UTM medium', 'UTM campaign', 'Página', 'Clave correo'];
const KEY_COL = 12; // "Clave correo": normalized email used for duplicates
const ROLES = ['estudiante', 'dev-flutter', 'dev-otro', 'diseno-producto', 'lider-empresa', 'otro'];
const LIMITS = { name: 80, email: 120, city: 60 };
const MIN_FILL_MS = 2500;
const MAX_BODY = 2048;
const MAX_PER_MINUTE = 60;
const EMAIL_COOLDOWN_S = 600;
const DISPOSABLE_DOMAINS = [
  '10minutemail.com', 'burnermail.io', 'dispostable.com', 'emailondeck.com', 'fakeinbox.com', 'getnada.com',
  'guerrillamail.com', 'guerrillamail.net', 'mailinator.com', 'maildrop.cc', 'mintemail.com', 'mohmal.com',
  'sharklasers.com', 'temp-mail.org', 'tempail.com', 'tempmail.com', 'tempmail.net', 'throwawaymail.com',
  'trashmail.com', 'yopmail.com',
];
const NAME_RE = /^\p{L}[\p{L}\p{M}' .-]*$/u;
const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;
const LINK_RE = /https?:|www\.|\.(com|net|org|io|xyz|ru)\b|[<>]/i;

function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) || '';
    if (raw.length > MAX_BODY) return json({ ok: false, error: 'too_large' });
    let body;
    try { body = JSON.parse(raw || '{}'); } catch (_) { return json({ ok: false, error: 'bad_request' }); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ ok: false, error: 'bad_request' });

    // Bots: answer ok so they move on, write nothing.
    if (body.website) return json({ ok: true });
    if (typeof body.elapsed === 'number' && body.elapsed < MIN_FILL_MS) return json({ ok: true });

    const v = validate(body);
    if (!v.ok) return json({ ok: false, error: v.error });
    const data = v.data;

    const cache = CacheService.getScriptCache();
    const seen = 'em_' + data.emailKey;
    if (cache.get(seen)) return json({ ok: true, duplicate: true });

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      // Under the lock, so two requests can't both read 59 and let a 61st sign-up through.
      if (!underRateLimit(cache)) return json({ ok: false, error: 'rate_limited' });
      const sheet = getSheet();
      if (isDuplicate(sheet, data)) {
        cache.put(seen, '1', EMAIL_COOLDOWN_S);
        return json({ ok: true, duplicate: true });
      }
      const extra = (k, max) => safe(clean(body[k], max));
      sheet.appendRow([
        Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM-dd HH:mm:ss'),
        safe(data.name), data.email, data.role, safe(data.city), 'Sí',
        extra('source', 60), extra('utm_source', 60), extra('utm_medium', 60), extra('utm_campaign', 80), extra('page', 200),
        data.emailKey,
      ]);
      // Only after the row exists: a failed write stays retryable instead of answering "duplicate".
      cache.put(seen, '1', EMAIL_COOLDOWN_S);
    } finally {
      lock.releaseLock();
    }
    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: 'server' });
  }
}

/** Health check: open the /exec URL in a browser. `version` tells you which Code.gs is deployed. */
function doGet() {
  return json({ ok: true, service: 'flutterconf-peru-register', version: VERSION });
}

/* ---------- validation (mirror of src/lib/registration.ts) ---------- */
function clean(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max + 1);
}

function emailKey(email) {
  const parts = email.trim().toLowerCase().split('@');
  let l = (parts[0] || '').split('+')[0];
  let d = parts[1] || '';
  if (d === 'googlemail.com') d = 'gmail.com';
  if (d === 'gmail.com') l = l.replace(/\./g, '');
  return l + '@' + d;
}

function isDisposable(email) {
  const domain = (email.split('@')[1] || '').toLowerCase();
  return DISPOSABLE_DOMAINS.some(function (d) { return domain === d || domain.endsWith('.' + d); });
}

function validate(b) {
  const name = clean(b.name, LIMITS.name);
  const email = clean(b.email, LIMITS.email).toLowerCase();
  const role = clean(b.role, 32);
  const city = clean(b.city, LIMITS.city);
  if (name.length < 2 || name.length > LIMITS.name || !NAME_RE.test(name) || LINK_RE.test(name)) return { ok: false, error: 'name' };
  if (email.length > LIMITS.email || !EMAIL_RE.test(email)) return { ok: false, error: 'email' };
  if (isDisposable(email)) return { ok: false, error: 'email_disposable' };
  if (ROLES.indexOf(role) < 0) return { ok: false, error: 'role' };
  if (city && (city.length > LIMITS.city || !NAME_RE.test(city) || LINK_RE.test(city))) return { ok: false, error: 'city' };
  if (b.consent !== true) return { ok: false, error: 'consent' };
  return { ok: true, data: { name: name, email: email, emailKey: emailKey(email), role: role, city: city } };
}

/** A value starting with = + - @ would run as a formula when the sheet is opened. */
function safe(v) {
  return /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
}

/* ---------- sheet ---------- */
function underRateLimit(cache) {
  const key = 'rl_' + Math.floor(Date.now() / 60000);
  const n = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(n), 120);
  return n <= MAX_PER_MINUTE;
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  const head = sheet.getRange(1, 1, 1, HEADERS.length);
  if (head.getValues()[0].join('|') !== HEADERS.join('|')) head.setValues([HEADERS]); // upgrades sheets made by version 1
  sheet.setFrozenRows(1);
  head.setFontWeight('bold');
  return sheet;
}

/** Same inbox already registered? Checks the normalized key, and the raw email for rows from version 1. */
function isDuplicate(sheet, data) {
  const last = sheet.getLastRow();
  if (last < 2) return false;
  const found = (col, value) => sheet.getRange(2, col, last - 1, 1).createTextFinder(value).matchEntireCell(true).findNext() !== null;
  return found(KEY_COL, data.emailKey) || found(3, data.email);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

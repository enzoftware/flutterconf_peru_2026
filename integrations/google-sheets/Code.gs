/**
 * FlutterConf Perú 2026 · sign-up endpoint ("Avísame primero").
 *
 * A Google Apps Script web app bound to the sign-up spreadsheet. The landing posts the form here
 * and this script appends one row per person. Setup: integrations/google-sheets/README.md.
 *
 * Protections (the URL is public, it ships in the page):
 *  - strict validation and length limits on every field,
 *  - honeypot field ("website") that real people never fill,
 *  - one row per email (a repeated email updates nothing and answers ok),
 *  - a global rate limit per minute (CacheService) and a lock so concurrent writes never collide.
 */

const SHEET_NAME = 'Registros';
const HEADERS = ['Fecha (Lima)', 'Nombre', 'Correo', 'Perfil', 'Ciudad', 'Acepta correos', 'Fuente', 'UTM source', 'UTM medium', 'UTM campaign', 'Página'];
const ROLES = ['estudiante', 'dev-flutter', 'dev-otro', 'diseno-producto', 'lider-empresa', 'otro'];
const MAX_PER_MINUTE = 60;

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    // Bots fill every field; people never see this one. Answer ok so the bot moves on.
    if (body.website) return json({ ok: true });

    const data = clean(body);
    if (data.error) return json({ ok: false, error: data.error });

    if (!underRateLimit()) return json({ ok: false, error: 'rate_limited' });

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sheet = getSheet();
      if (emailExists(sheet, data.email)) return json({ ok: true, duplicate: true });
      sheet.appendRow([
        Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM-dd HH:mm:ss'),
        data.name, data.email, data.role, data.city, data.consent ? 'Sí' : 'No',
        data.source, data.utmSource, data.utmMedium, data.utmCampaign, data.page,
      ]);
    } finally {
      lock.releaseLock();
    }
    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: 'server' });
  }
}

/** GET answers a health check, so you can open the /exec URL in a browser to test the deploy. */
function doGet() {
  return json({ ok: true, service: 'flutterconf-peru-register' });
}

function clean(b) {
  const str = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max);
  // Formula injection: a value starting with = + - @ would run as a formula when the sheet is opened.
  const safe = (v) => (/^[=+\-@]/.test(v) ? "'" + v : v);
  const name = safe(str(b.name, 80));
  const email = str(b.email, 120).toLowerCase();
  const role = str(b.role, 32);
  const city = safe(str(b.city, 60));
  if (name.length < 2) return { error: 'name' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: 'email' };
  if (ROLES.indexOf(role) < 0) return { error: 'role' };
  if (b.consent !== true) return { error: 'consent' };
  return {
    name, email, role, city, consent: true,
    source: safe(str(b.source, 60)),
    utmSource: safe(str(b.utm_source, 60)),
    utmMedium: safe(str(b.utm_medium, 60)),
    utmCampaign: safe(str(b.utm_campaign, 80)),
    page: safe(str(b.page, 200)),
  };
}

function underRateLimit() {
  const cache = CacheService.getScriptCache();
  const key = 'rl_' + Math.floor(Date.now() / 60000);
  const n = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(n), 120);
  return n <= MAX_PER_MINUTE;
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sheet;
}

function emailExists(sheet, email) {
  const last = sheet.getLastRow();
  if (last < 2) return false;
  return sheet.getRange(2, 3, last - 1, 1).createTextFinder(email).matchEntireCell(true).findNext() !== null;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

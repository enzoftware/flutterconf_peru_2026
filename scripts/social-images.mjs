/**
 * Link-preview images and site icons for the launch landing. Run: `npm run social`.
 *
 * Writes to public/social/ (SVG sources with the fonts embedded, plus PNG exports, because
 * WhatsApp, Facebook, LinkedIn, X, Slack and Discord only accept raster og:images) and the icons to public/.
 *
 *   og-1200x630    landscape card (Open Graph + X summary_large_image, WhatsApp, LinkedIn, Slack, Discord…)
 *   og-1200x1200   square card (WhatsApp/Telegram small previews, Instagram/LinkedIn posts)
 *   favicon.svg, favicon-32.png, apple-touch-icon.png (180), icon-512.png   Dash with the Peruvian flag
 *
 * Content comes from src/data/event.json. Fonts: FlutterChicha (brand/fonts) and Bungee (downloaded from
 * Google Fonts at generation time, embedded as base64). PNGs are rendered with the local Google Chrome.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const event = JSON.parse(readFileSync(join(root, 'src/data/event.json'), 'utf8'));
const OUT = join(root, 'public/social');
mkdirSync(OUT, { recursive: true });

const CHROME = process.env.CHROME_PATH ?? [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(existsSync);
if (!CHROME) { console.error('Google Chrome not found. Set CHROME_PATH.'); process.exit(1); }

/* ---------- fonts ---------- */
const b64 = (p) => readFileSync(join(root, p)).toString('base64');
const FC = {
  'FlutterChicha': 'FlutterChicha-Regular', 'FlutterChicha Sombra': 'FlutterChichaSombra-Regular',
  'FlutterChicha Amarillo': 'FlutterChichaAmarillo-Regular', 'FlutterChicha Naranja': 'FlutterChichaNaranja-Regular',
  'FlutterChicha Brillo': 'FlutterChichaBrillo-Regular',
};
/** fetch() that throws on HTTP errors, so an error page is never embedded as a font. */
const get = async (url, init) => {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res;
};
const css = await (await get('https://fonts.googleapis.com/css2?family=Bungee&display=block', {
  headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36' },
})).text();
// Google serves Bungee in unicode-range subsets (latin, latin-ext, vietnamese): embed each one.
const faces = [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map((m) => m[1]);
if (!faces.length) { console.error('Could not resolve Bungee from Google Fonts.'); process.exit(1); }
let bungee = '';
for (const f of faces) {
  const src = /url\((https:[^)]+)\)/.exec(f)?.[1], range = /unicode-range:\s*([^;]+);/.exec(f)?.[1];
  if (!src) continue;
  const data = Buffer.from(await (await get(src)).arrayBuffer()).toString('base64');
  bungee += `@font-face{font-family:"Bungee";src:url(data:font/woff2;base64,${data}) format("woff2")${range ? `;unicode-range:${range}` : ''}}`;
}
const FONTS = Object.entries(FC).map(([f, file]) => `@font-face{font-family:"${f}";src:url(data:font/woff2;base64,${b64(`brand/fonts/flutterchicha/${file}.woff2`)}) format("woff2")}`).join('') + bungee;

/* ---------- Dash with the Peruvian flag (static: no <animate>, ids namespaced) ---------- */
const dashSrc = readFileSync(join(root, 'brand/assets/dash/dash-bandera.svg'), 'utf8')
  .replace(/<animate\b[^>]*\/>/g, '').replace(/<title>.*?<\/title>/, '');
const dashInner = dashSrc.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
/** Dash as a nested <svg> placed at (x, y) with width w (viewBox 300×308, the flag pole reaches y≈0). */
const dash = (x, y, w) => `<svg x="${x}" y="${y}" width="${w}" height="${(w * 308 / 300).toFixed(1)}" viewBox="0 -2 300 310" overflow="visible">${dashInner}</svg>`;

/* ---------- drawing helpers ---------- */
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
/** Chicha lettering: the six stacked layers of the web .ch component, one <text> per layer. */
function chicha(lines, x, y, size, anchor = 'start') {
  const lh = size * 1.02;
  const t = (attrs) => `<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" letter-spacing="${size * 0.01}" ${attrs}>${lines.map((l, i) => `<tspan x="${x}" dy="${i ? lh : 0}">${esc(l)}</tspan>`).join('')}</text>`;
  return [
    t(`font-family="FlutterChicha Sombra" fill="#1467C4" stroke="#03070F" stroke-width="${size * 0.05}" paint-order="stroke" stroke-linejoin="round"`),
    t(`font-family="FlutterChicha" fill="#03070F" stroke="#03070F" stroke-width="${size * 0.07}" stroke-linejoin="round"`),
    t(`font-family="FlutterChicha" fill="#F7F7F2"`),
    t(`font-family="FlutterChicha Amarillo" fill="#E6FF2B"`),
    t(`font-family="FlutterChicha Naranja" fill="#FF4D12"`),
    t(`font-family="FlutterChicha Brillo" fill="#fff" opacity=".8"`),
  ].join('');
}
/** Sticker label with a hard offset shadow (Bungee). */
function sticker({ x, y, text, sub, size, bg, shadow = '#F25D50', rot = 0, anchor = 'middle', padX = size * 0.7 }) {
  const w = Math.max(text.length * size * 0.82, sub ? sub.length * size * 0.42 : 0) + padX * 2; // Bungee is wide and monospaced-ish
  const h = size * (sub ? 2.15 : 1.75);
  const left = anchor === 'middle' ? x - w / 2 : x;
  const cx = left + w / 2;
  return `<g transform="rotate(${rot} ${cx} ${y + h / 2})">
    <rect x="${left + 7}" y="${y + 7}" width="${w}" height="${h}" rx="${size * 0.55}" fill="${shadow}"/>
    <rect x="${left}" y="${y}" width="${w}" height="${h}" rx="${size * 0.55}" fill="${bg}" stroke="#021C3F" stroke-width="5"/>
    <text x="${cx}" y="${y + size * 1.22}" font-family="Bungee" font-size="${size}" fill="#021C3F" text-anchor="middle">${esc(text)}</text>
    ${sub ? `<text x="${cx}" y="${y + size * 1.86}" font-family="Bungee" font-size="${size * 0.46}" letter-spacing="${size * 0.04}" fill="#021C3F" text-anchor="middle">${esc(sub)}</text>` : ''}
  </g>`;
}
function rays(cx, cy, r, n = 36) {
  let p = '';
  for (let i = 0; i < n; i++) {
    const a1 = (i / n) * Math.PI * 2, a2 = ((i + 0.5) / n) * Math.PI * 2;
    p += `<path d="M${cx},${cy}L${(cx + r * Math.cos(a1)).toFixed(1)},${(cy + r * Math.sin(a1)).toFixed(1)}L${(cx + r * Math.cos(a2)).toFixed(1)},${(cy + r * Math.sin(a2)).toFixed(1)}Z" fill="${i % 2 ? '#0553B1' : '#1CDAC5'}"/>`;
  }
  return `<g opacity=".28">${p}</g>`;
}
const sparkle = (x, y, s, c) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0,-1 C.12,-.12 .12,-.12 1,0 C.12,.12 .12,.12 0,1 C-.12,.12 -.12,.12 -1,0 C-.12,-.12 -.12,-.12 0,-1Z" fill="${c}"/>`;
function ribbon(y, w, items, rot, bg = '#FFF275', shadow = '#F25D50') {
  const run = Array.from({ length: 4 }, () => items).flat().join('  ★  ');
  return `<g transform="rotate(${rot} ${w / 2} ${y})">
    <rect x="-100" y="${y + 8}" width="${w + 200}" height="64" fill="${shadow}"/>
    <rect x="-100" y="${y}" width="${w + 200}" height="64" fill="${bg}" stroke="#021C3F" stroke-width="5"/>
    <text x="-40" y="${y + 44}" font-family="Bungee" font-size="28" fill="#021C3F">${esc(run)}</text>
  </g>`;
}
const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<title>${esc(event.name)} · ${esc(event.dateLong)} · ${esc(event.venue)}</title>
<defs><style>${FONTS}</style>
<radialGradient id="bg" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="#0553B1"/><stop offset=".55" stop-color="#042B59"/><stop offset="1" stop-color="#021C3F"/></radialGradient>
<clipPath id="frame"><rect width="${w}" height="${h}"/></clipPath></defs>
<g clip-path="url(#frame)"><rect width="${w}" height="${h}" fill="url(#bg)"/>${body}</g></svg>`;

/* ---------- facts ---------- */
const [weekday, day, , month] = event.dateLong.split(' '); // Sábado 19 de diciembre de 2026
const DATE = `${weekday.slice(0, 3).toUpperCase()} ${day} ${month.slice(0, 3).toUpperCase()} 2026`; // SÁB 19 DIC 2026
const PLACE = event.venue.split(',')[0].toUpperCase(); // BLOOM TOWER
const PLACE_SUB = `${event.district.toUpperCase()} · ${event.city.toUpperCase()}`;
const RIB = ['¡Flutter!', '¡Dart!', DATE, PLACE, event.hashtag];

/* ---------- 1200 × 630 ---------- */
const og = svg(1200, 630, `
  ${rays(905, 300, 900)}
  ${sparkle(700, 470, 22, '#FFF275')}${sparkle(640, 46, 16, '#1CDAC5')}${sparkle(1150, 90, 20, '#8FC2FF')}
  <g transform="rotate(-2 230 70)">
    <rect x="66" y="48" width="290" height="46" rx="23" fill="#FFF275"/><rect x="60" y="42" width="290" height="46" rx="23" fill="#F25D50" stroke="#021C3F" stroke-width="4"/>
    <text x="205" y="73" font-family="Bungee" font-size="19" letter-spacing="2.6" fill="#F3F8FF" text-anchor="middle" dominant-baseline="middle">★ LIMA · PERÚ ★</text>
  </g>
  ${chicha(['¡Flutter', 'Conf Perú!'], 56, 200, 112)}
  <text x="66" y="402" font-family="Bungee" font-size="78" fill="#F25D50">2026</text>
  <text x="60" y="396" font-family="Bungee" font-size="78" fill="#FFF275">2026</text>
  ${sticker({ x: 330, y: 352, text: DATE, size: 30, bg: '#1CDAC5', rot: -3, anchor: 'start' })}
  ${sticker({ x: 60, y: 432, text: PLACE, sub: PLACE_SUB, size: 34, bg: '#8FC2FF', rot: 2, anchor: 'start', shadow: '#FFF275' })}
  ${dash(745, 92, 420)}
  ${ribbon(548, 1200, RIB, -2.5)}
`);

/* ---------- 1200 × 1200 ---------- */
const sq = svg(1200, 1200, `
  ${rays(600, 700, 1300)}
  ${sparkle(110, 120, 32, '#FFF275')}${sparkle(1090, 150, 24, '#1CDAC5')}${sparkle(1080, 640, 20, '#8FC2FF')}${sparkle(120, 700, 18, '#F25D50')}
  <g transform="rotate(-2 600 96)">
    <rect x="463" y="74" width="290" height="50" rx="25" fill="#FFF275"/><rect x="455" y="66" width="290" height="50" rx="25" fill="#F25D50" stroke="#021C3F" stroke-width="4"/>
    <text x="600" y="93" font-family="Bungee" font-size="20" letter-spacing="2.8" fill="#F3F8FF" text-anchor="middle" dominant-baseline="middle">★ LIMA · PERÚ ★</text>
  </g>
  ${chicha(['¡Flutter', 'Conf Perú!'], 600, 270, 138, 'middle')}
  <text x="608" y="510" font-family="Bungee" font-size="96" fill="#F25D50" text-anchor="middle">2026</text>
  <text x="600" y="502" font-family="Bungee" font-size="96" fill="#FFF275" text-anchor="middle">2026</text>
  ${sticker({ x: 250, y: 640, text: `${weekday.slice(0, 3).toUpperCase()} ${day}`, sub: `${month.toUpperCase()} 2026`, size: 46, bg: '#1CDAC5', rot: -5 })}
  ${sticker({ x: 950, y: 640, text: 'BLOOM', sub: 'TOWER · PISO 16', size: 46, bg: '#8FC2FF', rot: 5 })}
  ${dash(420, 545, 360)}
  <text x="600" y="980" font-family="Bungee" font-size="30" fill="#F3F8FF" text-anchor="middle">${esc(`${event.address.toUpperCase()} · ${PLACE_SUB}`)}</text>
  ${ribbon(1050, 1200, RIB, -2.5)}
`);

/* ---------- icons: Dash with the flag on a cyan disc ---------- */
const icon = (s, disc = true) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 320 320">
${disc ? '<rect width="320" height="320" rx="72" fill="#1CDAC5"/>' : ''}
<svg x="${disc ? 22 : 4}" y="${disc ? 14 : 2}" width="${disc ? 276 : 312}" height="${disc ? 292 : 316}" viewBox="0 -2 300 310" overflow="visible">${dashInner}</svg></svg>`;

writeFileSync(join(OUT, 'og-1200x630.svg'), og);
writeFileSync(join(OUT, 'og-1200x1200.svg'), sq);
writeFileSync(join(root, 'public/favicon.svg'), icon(64, false).replace(/ width="64" height="64"/, ''));

/* ---------- PNG exports with headless Chrome ---------- */
const tmp = mkdtempSync(join(tmpdir(), 'social-'));
function png(svgText, w, h, out) {
  const f = join(tmp, `${w}x${h}.svg`);
  writeFileSync(f, svgText);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--force-color-profile=srgb',
    `--user-data-dir=${join(tmp, 'profile')}`, '--default-background-color=00000000', '--virtual-time-budget=3000',
    `--window-size=${w},${h}`, `--screenshot=${out}`, pathToFileURL(f).href], { stdio: 'ignore' });
  console.log('wrote', out.replace(root, ''));
}
try {
  png(og, 1200, 630, join(OUT, 'og-1200x630.png'));
  png(sq, 1200, 1200, join(OUT, 'og-1200x1200.png'));
  png(icon(180), 180, 180, join(root, 'public/apple-touch-icon.png'));
  png(icon(512), 512, 512, join(root, 'public/icon-512.png'));
  png(icon(32, false), 32, 32, join(root, 'public/favicon-32.png'));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

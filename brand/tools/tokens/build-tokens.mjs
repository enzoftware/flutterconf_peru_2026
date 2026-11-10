// Generates brand/tokens/tokens.css from brand/tokens/tokens.json (the single source of truth).
// Run: node brand/tools/tokens/build-tokens.mjs   (also runs automatically before `npm run dev/build`)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const t = JSON.parse(readFileSync(resolve(root, 'tokens/tokens.json'), 'utf8'));
const first = t.color.themes[0].id;
const val = (v) => (typeof v === 'string' ? v : v[first]);
const ref = (v) => v.replace(/^\{(.+)\}$/, 'var(--$1)');
const lines = [];
lines.push('/* FlutterConf Perú Chicha — generated from tokens.json. Do not edit by hand. */');
for (const f of t.type.fonts) {
  lines.push(`@font-face { font-family: "${f.family}"; src: url("../fonts/flutterchicha/${f.file.split('/').pop()}") format("woff2"); font-weight: ${f.weight}; font-display: block; }`);
}
lines.push(':root {');
for (const c of t.color.tokens) lines.push(`  --${c.name}: ${ref(val(c.value))};`);
for (const fam of ['spacing', 'radius', 'shadow', 'stroke']) for (const x of t[fam]?.tokens ?? []) lines.push(`  --${x.name}: ${val(x.value)};`);
for (const [k, v] of Object.entries(t.type.families)) lines.push(`  --font-${k}: ${v};`);
lines.push('}');
for (const g of t.type.groups) for (const s of g.styles) {
  const fam = s.family ?? g.family;
  lines.push(`.${s.name} { font-family: var(--font-${fam}); font-size: ${s.fontSize}; line-height: ${s.lineHeight}; font-weight: ${s.fontWeight};${s.letterSpacing ? ` letter-spacing: ${s.letterSpacing};` : ''} }`);
}
writeFileSync(resolve(root, 'tokens/tokens.css'), lines.join('\n') + '\n');
console.log('brand/tokens/tokens.css written');

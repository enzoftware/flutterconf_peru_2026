/**
 * Monchila, the retro script of the neon titles (sponsor decks and the landing).
 *
 * Monchila is a commercial font and is NOT committed (the repo is public). Run
 * brand/tools/monchila/fix_overlaps.py to drop the fixed files in brand/fonts/monchila/ (see the README
 * there). When they are missing, decks fall back to Bungee and the landing to FlutterChicha.
 */
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

export type FontFile = { url: string; format: string; path: string };
type Ext = 'woff2' | 'ttf' | 'otf';
const FORMAT: Record<Ext, string> = { woff2: 'woff2', ttf: 'truetype', otf: 'opentype' };

const urls = import.meta.glob('../../brand/fonts/monchila/*.{woff2,otf,ttf}', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

/** First file named `<stem>.<ext>`, in the order of `prefer`. */
function font(stem: string, prefer: Ext[]): FontFile | null {
  for (const ext of prefer) {
    const hit = Object.entries(urls).find(([p]) => p.endsWith(`/${stem}.${ext}`));
    if (hit) return { url: hit[1], format: FORMAT[ext], path: resolve('brand/fonts/monchila', basename(hit[0])) };
  }
  return null;
}

/**
 * Decks: TrueType first. Chrome embeds TrueType fonts in PDFs as real fonts but turns CFF (.otf) into
 * Type 3 glyphs, which macOS Preview draws wrong under the neon gradient (see fix_overlaps.py). The
 * WOFF2 copies hold the same TrueType outlines; production builds only get those (see deploy.yml).
 */
export const deckFonts = { fill: font('Monchila', ['ttf', 'woff2', 'otf']), silhouette: font('MonchilaSilueta', ['ttf', 'woff2', 'otf']) };
/** Web: the same TrueType outlines, compressed as WOFF2 when the fix script wrote them. */
export const webFonts = { fill: font('Monchila', ['woff2', 'ttf', 'otf']), silhouette: font('MonchilaSilueta', ['woff2', 'ttf', 'otf']) };
export const hasMonchila = Boolean(webFonts.fill && webFonts.silhouette);

/** @font-face rules for "Monchila" (fill) and "Monchila Silueta" (outline and ring). */
export function fontFaceCss(fonts: { fill: FontFile | null; silhouette: FontFile | null }): string {
  const face = (family: string, f: FontFile | null) =>
    f ? `@font-face{font-family:"${family}";src:url("${f.url}") format("${f.format}");font-weight:400;font-display:block}` : '';
  return face('Monchila', fonts.fill) + face('Monchila Silueta', fonts.silhouette);
}

/**
 * Characters the installed Monchila maps, read from the cmap of the TTF/OTF at build time. Empty (no
 * check) without those files, e.g. in production, which only gets the compressed WOFF2s.
 */
const covered: Set<number> = (() => {
  const file = font('Monchila', ['ttf', 'otf']);
  return file ? cmapOf(readFileSync(file.path)) : new Set();
})();

/** Characters of `text` that Monchila can't draw (they would fall back to another font). */
export function missingGlyphs(text: string): string[] {
  if (!covered.size) return [];
  return [...new Set([...text].filter((c) => !/\s/.test(c) && !covered.has(c.codePointAt(0)!)))];
}

/** Unicode code points of a TrueType/OpenType font (cmap formats 4 and 12). */
function cmapOf(buf: Buffer): Set<number> {
  const out = new Set<number>();
  const tables = buf.readUInt16BE(4);
  let cmap = 0;
  for (let i = 0; i < tables; i++) {
    const rec = 12 + i * 16;
    if (buf.toString('latin1', rec, rec + 4) === 'cmap') cmap = buf.readUInt32BE(rec + 8);
  }
  if (!cmap) return out;
  for (let i = 0, n = buf.readUInt16BE(cmap + 2); i < n; i++) {
    const sub = cmap + buf.readUInt32BE(cmap + 4 + i * 8 + 4);
    const format = buf.readUInt16BE(sub);
    if (format === 4) {
      const segs = buf.readUInt16BE(sub + 6) / 2;
      const ends = sub + 14, starts = ends + segs * 2 + 2;
      for (let s = 0; s < segs; s++) {
        const end = buf.readUInt16BE(ends + s * 2);
        for (let c = buf.readUInt16BE(starts + s * 2); c <= end && c < 0xffff; c++) out.add(c);
      }
    } else if (format === 12) {
      for (let g = 0, groups = buf.readUInt32BE(sub + 12); g < groups; g++) {
        const at = sub + 16 + g * 12;
        for (let c = buf.readUInt32BE(at), end = buf.readUInt32BE(at + 4); c <= end; c++) out.add(c);
      }
    }
  }
  return out;
}

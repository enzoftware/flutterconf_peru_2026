/**
 * Build-time access to the design system in `brand/`, for the brand page and its downloads.
 * Only the files a designer needs are published; generators (`tools/`) and archives stay in the repo.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';

const ROOT = join(process.cwd(), 'brand');

/** Folders (and their file extensions) published under /marca/archivos/. */
const PUBLISHED: [dir: string, exts: string[]][] = [
  ['', ['.md']],
  ['assets/dash', ['.svg', '.md']],
  ['assets/formas', ['.svg', '.md']],
  ['assets/ornamentos', ['.svg', '.md']],
  ['components', ['.md']],
  ['css', ['.css']],
  ['fonts', ['.md']],
  ['fonts/flutterchicha', ['.ttf', '.woff2']],
  ['reference', ['.png']],
  ['templates', ['.html']],
  ['tokens', ['.css', '.json']],
];

export interface BrandFile { path: string; name: string; size: number }

/** Every published file, as a path relative to `brand/` with forward slashes. */
export function brandFiles(): BrandFile[] {
  return PUBLISHED.flatMap(([dir, exts]) =>
    readdirSync(join(ROOT, dir), { withFileTypes: true })
      .filter((d) => d.isFile() && exts.some((e) => d.name.endsWith(e)))
      .map((d) => {
        const path = dir ? posix.join(dir, d.name) : d.name;
        return { path, name: d.name, size: statSync(join(ROOT, path)).size };
      }),
  ).sort((a, b) => a.path.localeCompare(b.path));
}

export const inDir = (dir: string): BrandFile[] => brandFiles().filter((f) => posix.dirname(f.path) === dir);
export const readBrand = (path: string): Buffer => readFileSync(join(ROOT, path));
export const readBrandText = (path: string): string => readBrand(path).toString('utf8');

/** First paragraph of a component guide (`brand/components/<Name>.md`), without markdown emphasis. */
export function guideIntro(name: string): string {
  const para = readBrandText(`components/${name}.md`).split(/\n\s*\n/).find((p) => p.trim() && !p.startsWith('#')) ?? '';
  return para.replace(/\*\*|`/g, '').trim();
}

/** SVG markup of an asset, for inline previews. */
export const svg = (path: string): string => readBrandText(path).replace(/<\?xml[^>]*>\s*/, '');

export const kb = (bytes: number): string => (bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`);

const TYPES: Record<string, string> = {
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.md': 'text/markdown; charset=utf-8', '.html': 'text/html; charset=utf-8', '.zip': 'application/zip',
};
export const contentType = (path: string): string => TYPES[posix.extname(path)] ?? 'application/octet-stream';

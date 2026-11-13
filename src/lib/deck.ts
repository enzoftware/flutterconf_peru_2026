/**
 * Sponsor deck helpers: slide types, accent colors, the local Monchila font and a glyph check.
 * Decks live in src/content/decks/*.json and render at /decks/<slug>/.
 */
import type { CollectionEntry } from 'astro:content';

export type Deck = CollectionEntry<'decks'>['data'];
export type DeckSlide = Deck['slides'][number];
export type SlideOf<T extends DeckSlide['type']> = Extract<DeckSlide, { type: T }>;
export type Accent = SlideOf<'stats'>['items'][number]['color'];

/** Brand token for each accent name allowed in deck JSON. */
export const ACCENT: Record<Accent, string> = {
  yellow: 'var(--yellow)', green: 'var(--green)', red: 'var(--red)', sky: 'var(--sky)', paper: 'var(--paper)',
};

/** Spanish label for each slide type, shown under the slide in the review view. */
export const SLIDE_LABEL: Record<DeckSlide['type'], string> = {
  cover: 'Portada', stats: 'Cifras', agenda: 'Agenda', spotlight: 'Propuesta', benefits: 'Beneficios', venue: 'Lugar', team: 'Equipo', closing: 'Cierre',
};

/**
 * Monchila is licensed per seat and is NOT committed (the repo is public). Drop the licensed file in
 * brand/fonts/monchila/ (see the README there). When it is missing, titles fall back to Bungee.
 */
const FORMATS = { woff2: 'woff2', otf: 'opentype', ttf: 'truetype' } as const;
type FontFile = { url: string; format: string };
const found = import.meta.glob('../../brand/fonts/monchila/*.{woff2,otf,ttf}', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
/** First file named `<stem>.<ext>`, preferring woff2, then otf, then ttf. */
function font(stem: string): FontFile | null {
  for (const ext of Object.keys(FORMATS) as (keyof typeof FORMATS)[]) {
    const hit = Object.entries(found).find(([path]) => path.endsWith(`/${stem}.${ext}`));
    if (hit) return { url: hit[1], format: FORMATS[ext] };
  }
  return null;
}
/** Regular Monchila (fill) and its hole-free silhouette (outline and ring of the neon lettering). */
export const monchila = font('Monchila');
export const monchilaSilueta = font('MonchilaSilueta');

/** The Monchila demo has no accented letters or ñ. Lists the titles that would break. */
const MISSING = /[áéíóúÁÉÍÓÚñÑüÜ]/;
export function glyphWarnings(slides: DeckSlide[]): string[] {
  return slides.flatMap((s, i) => (MISSING.test(s.title) ? [`Diapositiva ${i + 1}: «${s.title.replace(/\n/g, ' ')}»`] : []));
}

/** "Line one\nline two" → lines. */
export const lines = (text: string): string[] => text.split('\n');

/** Two-digit slide number. */
export const pad = (n: number): string => String(n).padStart(2, '0');

/** Unique id for each title's sticker filter (Lettering.astro); one counter per build. */
let letteringIds = 0;
export const nextLetteringId = (): string => `lt-ink-${++letteringIds}`;

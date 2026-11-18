/**
 * Sponsor deck helpers: slide types, accent colors, the local Monchila font and a glyph check.
 * Font loading lives in src/lib/monchila.ts (shared with the landing).
 * Decks live in src/content/decks/*.json and render at /decks/<slug>/.
 */
import type { CollectionEntry } from 'astro:content';
import tokens from '../../brand/tokens/tokens.json';
import { deckFonts, missingGlyphs } from './monchila';

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

/** Monchila for the deck titles (TrueType first, for the PDF export). Null when it isn't installed. */
export const monchila = deckFonts.fill;
export const monchilaSilueta = deckFonts.silhouette;

/** Titles with characters the installed Monchila can't draw. */
export function glyphWarnings(slides: DeckSlide[]): string[] {
  return slides.flatMap((s, i) => {
    const missing = missingGlyphs(s.title);
    return missing.length ? [`Diapositiva ${i + 1}: «${s.title.replace(/\n/g, ' ')}» (${missing.join(' ')})`] : [];
  });
}

/** "Line one\nline two" → lines. */
export const lines = (text: string): string[] => text.split('\n');

/** Two-digit slide number. */
export const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * Neon lettering fill: fc-verde 6% → fc-amarillo 34% → yellow 48% → fc-naranja 74% → red 100% (of the
 * title box, top to bottom). Print draws it as bands (see Lettering.astro); keep these stops in sync
 * with the screen gradient on .lt-f in deck.css.
 */
const GRADIENT: [number, string][] = [[6, 'fc-verde'], [34, 'fc-amarillo'], [48, 'yellow'], [74, 'fc-naranja'], [100, 'red']];
const BANDS = 64;

const hex = (name: string): number[] => {
  const value = tokens.color.tokens.find((t: { name: string }) => t.name === name)?.value;
  if (!value) throw new Error(`Missing brand token ${name}`);
  return [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
};
const STOPS = GRADIENT.map(([at, name]) => [at, hex(name)] as const);

/** Gradient color at `at` percent of the title box. */
function colorAt(at: number): string {
  let rgb = STOPS[0][1];
  for (let i = 1; i < STOPS.length && at > STOPS[i - 1][0]; i++) {
    const [a, from] = STOPS[i - 1];
    const [b, to] = STOPS[i];
    const t = Math.min(1, (at - a) / (b - a));
    rgb = from.map((v, k) => Math.round(v + (to[k] - v) * t));
  }
  return `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Bands of the neon fill, top first: each one is clipped from `top` (percent of the title box) to the
 * bottom, so the next band covers it and no seam can show between them.
 */
export const LETTERING_BANDS: { top: number; color: string }[] = Array.from({ length: BANDS }, (_, i) => {
  const top = i === 0 ? 0 : STOPS[0][0] + ((100 - STOPS[0][0]) * i) / BANDS;
  const mid = i === 0 ? STOPS[0][0] : top + (100 - STOPS[0][0]) / BANDS / 2;
  return { top: Number(top.toFixed(3)), color: colorAt(mid) };
});

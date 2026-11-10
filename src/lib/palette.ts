/** Accent rotation used by cards, stickers and the speaker fan (Flutter brand accents). */
export const ACCENTS = ['#FFF275', '#1CDAC5', '#8FC2FF', '#6200EE', '#F25D50'] as const;
export const accent = (i: number): string => ACCENTS[((i % ACCENTS.length) + ACCENTS.length) % ACCENTS.length];
/** Slight sticker rotations for cards. */
export const tilt = (i: number): string => [-3, 2.5, -1.5, 3.5, -2.5, 1.5, -4, 2][i % 8] + 'deg';
/** Speaker fan: [x (cqw), y (px), start rotation, end rotation] per card, two staggered rows. */
export const FAN: [number, number, number, number][] = [
  [-36, -150, -14, -6], [-24, 140, -8, 4], [-12, -150, -4, -3], [0, 140, 2, -2],
  [12, -150, 6, 3], [24, 140, 10, -4], [36, -150, 14, 6],
];

/** Clip polygon (6-lobe flower scaled by the animatable --fk) for the Forma viva reveal. */
export function formaClipCss(): string {
  const n = 48, a = 0.14, pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * 2 * Math.PI, r = ((1 + a * Math.cos(6 * t)) / (1 + a)) * 50;
    pts.push(`calc(50% + var(--fk) * ${(r * Math.cos(t)).toFixed(2)}%) calc(50% + var(--fk) * ${(r * Math.sin(t)).toFixed(2)}%)`);
  }
  return `.k-forma [data-r]{ clip-path:polygon(${pts.join(',')}) } @media (prefers-reduced-motion: reduce){ .k-forma [data-r]{ clip-path:none } }`;
}

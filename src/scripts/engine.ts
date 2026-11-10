/**
 * Scroll engine for the landing (one passive scroll listener, work batched in requestAnimationFrame).
 *
 *  [data-r]     reveal: toggles .in while on screen and .gone once it has left above (works both ways)
 *  [data-p]     sets --p (0 → 1 while the element crosses the viewport) for parallax
 *  .pin         sets --pp (0 → 1 while its sticky child is pinned) and --tx for horizontal tracks
 *  [data-count] counts up when its reveal parent enters
 *  Forma viva   the background M3 shape morphs/moves per .z section (only if .fv layer exists)
 *  Dash asoma   Dash peeks in from the edges at each section/heading (only if .pk layer exists)
 *
 * Only transform, opacity, clip-path and CSS custom properties are animated.
 * With prefers-reduced-motion everything is shown statically.
 */
import { mixD, type ShapeName } from '../lib/art';

interface Box { el: HTMLElement; t: number; h: number }
interface Reveal extends Box { v: boolean | null; skip: boolean }

const FORMA_SEQ: ShapeName[] = ['cookie', 'flower', 'sunny', 'clover', 'burst', 'gem', 'soft', 'pill'];
const FORMA_COLORS = ['#1CDAC5', '#FFF275', '#F25D50', '#027DFD', '#6200EE'];
const PEEK_LINES = ['¡Hola, causa! Sigue bajando', 'Psst… mira esto', '¡Esto se pone bueno!', '¡Ellos sí saben!',
  '¿Ya tienes tu entrada?', '¡Síguenos, pe!', '¡Un poquito más!', '¡Nos vemos el 19!'];

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

/** Document-relative top, ignoring transforms (reveals are translated while hidden). */
function docTop(el: HTMLElement): number {
  let y = 0;
  let e: HTMLElement | null = el;
  while (e) { y += e.offsetTop; e = e.offsetParent as HTMLElement | null; }
  return y;
}

export function boot(): void {
  const lp = document.querySelector<HTMLElement>('.lp');
  if (!lp) return;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (RM) lp.querySelectorAll('animate').forEach((a) => a.remove());

  const nav = lp.querySelector<HTMLElement>('.nav');
  const R: Reveal[] = [...lp.querySelectorAll<HTMLElement>('[data-r]')].map((el) => ({ el, t: 0, h: 0, v: null, skip: false }));
  const P: Box[] = [...lp.querySelectorAll<HTMLElement>('[data-p]')].map((el) => ({ el, t: 0, h: 0 }));
  const PIN = [...lp.querySelectorAll<HTMLElement>('.pin')].map((el) => ({ el, t: 0, h: 0, tr: el.querySelector<HTMLElement>('.track') }));
  const Z: Box[] = [...lp.querySelectorAll<HTMLElement>('.z')].map((el) => ({ el, t: 0, h: 0 }));
  const HD = [...lp.querySelectorAll<HTMLElement>('h2')];
  const fvA = lp.querySelector<SVGSVGElement>('.fv.fa');
  const fvB = lp.querySelector<SVGSVGElement>('.fv.fb');
  const PK = [...lp.querySelectorAll<HTMLElement>('.pk')];

  let H = 0, W = 0, wide = false, raf = 0, triggers: number[] = [];
  let fvI = -1, fvE = -1;
  const peekLast = new WeakMap<HTMLElement, number>();
  const counting = new WeakMap<HTMLElement, boolean>();

  function countUp(el: HTMLElement): void {
    const n = Number(el.dataset.count), suf = el.dataset.suf ?? '', t0 = performance.now(), dur = 900;
    const targets = el.classList.contains('ch') ? [...el.querySelectorAll<HTMLElement>('span[aria-hidden]')] : [el];
    counting.set(el, true);
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur), v = Math.round(n * (1 - Math.pow(1 - k, 3)));
      targets.forEach((t) => (t.textContent = v + suf));
      if (k < 1 && counting.get(el)) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function forma(st: number): void {
    if (!fvA || !fvB || !Z.length) return;
    const mid = st + H * 0.5;
    let i = 0;
    for (let j = 0; j < Z.length; j++) if (Z[j].t <= mid) i = j;
    const f = clamp((mid - Z[i].t) / (Z[i].h || 1));
    let e = clamp((f - 0.6) / 0.4);
    e = e * e * (3 - 2 * e);
    if (i === Z.length - 1) e = 0;
    const a = FORMA_SEQ[i % FORMA_SEQ.length], b = FORMA_SEQ[(i + 1) % FORMA_SEQ.length];
    const er = Math.round(e * 40) / 40;
    const pa = fvA.firstElementChild as SVGPathElement, pb = fvB.firstElementChild as SVGPathElement;
    if (i !== fvI || er !== fvE) {
      pa.setAttribute('d', mixD(a, b, er));
      pb.setAttribute('d', mixD(b, a, er));
      if (i !== fvI) { pa.style.fill = FORMA_COLORS[i % FORMA_COLORS.length]; pb.style.stroke = '#FFF275'; }
      fvI = i; fvE = er;
    }
    const s0 = i % 2 ? 0.2 : 0.8, s1 = i % 2 ? 0.8 : 0.2, x = (s0 + (s1 - s0) * e) * W;
    const fs = Math.min(W * 0.66, 620), fb = fs * 0.42;
    const sc = 0.92 + 0.1 * Math.sin(st / 520), rot = st * 0.05;
    fvA.style.setProperty('--fs', fs + 'px');
    fvB.style.setProperty('--fs', fb + 'px');
    fvA.style.transform = `translate(${(x - fs / 2).toFixed(1)}px, ${(H * 0.52 - fs / 2).toFixed(1)}px) rotate(${rot.toFixed(1)}deg) scale(${sc.toFixed(3)})`;
    const xb = W - x, yb = H * (0.24 + 0.5 * e);
    fvB.style.transform = `translate(${(xb - fb / 2).toFixed(1)}px, ${(yb - fb / 2).toFixed(1)}px) rotate(${(-rot * 1.6).toFixed(1)}deg)`;
  }

  function peek(st: number): void {
    if (!PK.length) return;
    const best = PK.map(() => ({ v: 0, j: -1 }));
    for (let j = 0; j < triggers.length; j++) {
      const d = st + H * 0.62 - triggers[j], v = Math.max(0, 1 - Math.abs(d) / (H * 0.4)), e = j % 3;
      if (v > best[e].v) best[e] = { v, j: j + 1 };
    }
    PK.forEach((el, e) => {
      const b = best[e], v = Math.min(1, b.v * 1.7), ve = 1 - Math.pow(1 - v, 3);
      el.style.setProperty('--pk', ve.toFixed(3));
      if (b.j > 0 && peekLast.get(el) !== b.j) {
        peekLast.set(el, b.j);
        const bub = el.querySelector('.bub');
        if (bub) bub.textContent = PEEK_LINES[(b.j - 1) % PEEK_LINES.length];
      }
    });
  }

  function update(force = false): void {
    raf = 0;
    const st = window.scrollY;
    nav?.classList.toggle('on', st > 30);
    for (const o of R) {
      if (o.skip) continue;
      const top = o.t - st, v = RM || (top < H * 0.92 && top + o.h > H * 0.04);
      if (v !== o.v || force) {
        const changed = v !== o.v;
        o.v = v;
        o.el.classList.toggle('in', v);
        o.el.classList.toggle('gone', !v && top + o.h <= H * 0.04);
        if (changed) {
          o.el.querySelectorAll<HTMLElement>('[data-count]').forEach((c) => (v ? countUp(c) : counting.set(c, false)));
        }
      }
    }
    for (const o of P) o.el.style.setProperty('--p', clamp((H - (o.t - st)) / (H + o.h)).toFixed(4));
    for (const o of PIN) o.el.style.setProperty('--pp', clamp((st - o.t) / Math.max(1, o.h - H)).toFixed(4));
    if (!RM) { forma(st); peek(st); }
  }

  function measure(): void {
    H = window.innerHeight;
    W = lp!.clientWidth;
    wide = W >= 760;
    document.documentElement.style.setProperty('--vh', H + 'px');
    for (const o of R) {
      o.t = docTop(o.el); o.h = o.el.offsetHeight;
      o.skip = wide && !!o.el.closest('.stick');
      if (o.skip) o.el.classList.add('in');
    }
    for (const o of P) { o.t = docTop(o.el); o.h = o.el.offsetHeight; }
    for (const o of PIN) {
      o.t = docTop(o.el); o.h = o.el.offsetHeight;
      if (o.tr) o.el.style.setProperty('--tx', wide ? Math.max(0, o.tr.scrollWidth - document.documentElement.clientWidth) + 'px' : '0px');
    }
    for (const o of Z) { o.t = docTop(o.el); o.h = o.el.offsetHeight; }
    if (PK.length) {
      const cand = [...Z.slice(1).map((o) => o.t), ...HD.map(docTop)].sort((a, b) => a - b);
      triggers = [];
      for (const y of cand) if (y > H * 0.9 && (!triggers.length || y - triggers[triggers.length - 1] > H * 0.9)) triggers.push(y);
    }
    update(true);
  }

  const onScroll = () => { if (!raf) raf = requestAnimationFrame(() => update()); };
  let mt = 0;
  const remeasure = (delay = 120) => { clearTimeout(mt); mt = window.setTimeout(measure, delay); };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => remeasure());
  lp.addEventListener('toggle', () => remeasure(300), true); // FAQ <details> change the page height
  window.addEventListener('load', () => remeasure(0));
  document.fonts?.ready.then(() => remeasure(0));
  measure();
}

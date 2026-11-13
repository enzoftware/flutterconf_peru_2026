/**
 * Sponsor deck viewer: P (or "Presentar") shows one slide full screen; arrows, space and clicks move;
 * Esc leaves. "Exportar PDF" opens the print dialog (1920×1080 pages, see deck.css). The slide number
 * is kept in the URL hash (#3) so a reload stays on the same slide.
 */
export function bootDeck(): void {
  fitLettering();
  const root = document.documentElement;
  const items = Array.from(document.querySelectorAll<HTMLElement>('.deck-item'));
  if (!items.length) return;
  let cur = 0;

  const presenting = (): boolean => root.classList.contains('is-presenting');
  const show = (i: number): void => {
    cur = Math.max(0, Math.min(items.length - 1, i));
    items.forEach((el, k) => el.classList.toggle('is-current', k === cur));
    history.replaceState(null, '', `#s${cur + 1}`);
  };
  const nearest = (): number => {
    const i = items.findIndex((el) => el.getBoundingClientRect().bottom > innerHeight / 3);
    return i < 0 ? 0 : i;
  };
  const enter = (): void => {
    root.classList.add('is-presenting');
    show(nearest());
    root.requestFullscreen?.().catch(() => { /* fullscreen is optional */ });
  };
  const exit = (): void => {
    root.classList.remove('is-presenting');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    items[cur].scrollIntoView({ block: 'center' });
  };

  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (!presenting()) {
      if (e.key === 'p' || e.key === 'P') { e.preventDefault(); enter(); }
      return;
    }
    const next = ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'];
    const prev = ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'];
    if (next.includes(e.key)) { e.preventDefault(); show(cur + 1); }
    else if (prev.includes(e.key)) { e.preventDefault(); show(cur - 1); }
    else if (e.key === 'Home') show(0);
    else if (e.key === 'End') show(items.length - 1);
    else if (e.key === 'Escape') exit();
  });
  // Esc while in fullscreen only exits fullscreen; leave present mode with it.
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && presenting()) exit(); });

  document.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLElement>('[data-deck]');
    if (btn?.dataset.deck === 'present') return enter();
    if (btn?.dataset.deck === 'print') return window.print();
    if (presenting()) show(e.clientX < innerWidth / 3 ? cur - 1 : cur + 1);
  });

  const fromHash = /^#s(\d+)$/.exec(location.hash);
  if (fromHash) { cur = Math.min(items.length, Number(fromHash[1])) - 1; items[cur]?.scrollIntoView({ block: 'center' }); }
}

/**
 * Size the sticker filters of the neon titles (see Lettering.astro). Filter radii are in pixels, so
 * they are set from each title's font size: on load, whenever a slide changes size (review, present)
 * and for print, where every slide is 1920 px wide and the font size is exactly --fs px.
 */
function fitLettering(): void {
  const titles = Array.from(document.querySelectorAll<HTMLElement>('.lt-neon .s-title[data-fs]'));
  if (!titles.length) return;
  const EDGE = 0.5; // px over which a thresholded edge goes from transparent to opaque

  const fit = (title: HTMLElement, fontPx: number): void => {
    title.querySelectorAll<SVGElement>('[data-k]').forEach((el) => {
      const sigma = Number(el.dataset.k) * fontPx;
      if (el instanceof SVGFEGaussianBlurElement) { el.setAttribute('stdDeviation', sigma.toFixed(2)); return; }
      // feFuncA: alpha' = slope · (alpha − t) + 0.5, steep enough for a crisp edge at this blur size.
      const t = Number(el.dataset.t);
      const slope = Math.max(4, sigma / (Number(el.dataset.phi) * EDGE));
      el.setAttribute('slope', slope.toFixed(2));
      el.setAttribute('intercept', (0.5 - slope * t).toFixed(3));
    });
  };
  const forScreen = (): void => titles.forEach((t) => fit(t, parseFloat(getComputedStyle(t).fontSize)));
  const forPrint = (): void => titles.forEach((t) => fit(t, Number(t.dataset.fs)));

  forScreen();
  let queued = false;
  const ro = new ResizeObserver(() => {
    if (queued || matchMedia('print').matches) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; forScreen(); });
  });
  titles.forEach((t) => ro.observe(t));
  addEventListener('beforeprint', forPrint);
  addEventListener('afterprint', forScreen);
  matchMedia('print').addEventListener('change', (e) => (e.matches ? forPrint() : forScreen()));
}

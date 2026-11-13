/**
 * Sponsor deck viewer: P (or "Presentar") shows one slide full screen; arrows, space and clicks move;
 * Esc leaves. "Exportar PDF" opens the print dialog (1920×1080 pages, see deck.css). The slide number
 * is kept in the URL hash (#3) so a reload stays on the same slide.
 */
export function bootDeck(): void {
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

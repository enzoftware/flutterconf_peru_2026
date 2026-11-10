/**
 * Live examples for the brand page. Each demo is plain HTML using the `.fcp-*` classes from
 * `brand/css/components.css`, so the code shown is exactly what marketing can paste into a template.
 * `a` is the path prefix of the brand assets (relative `../assets/` in snippets, absolute on the page).
 */
const LAYERS = ['sh', 'k', 'b', 'y', 'n', 'h'];

/** FlutterChicha lettering markup (the six stacked layers plus a screen-reader copy). */
export function chicha(text: string, style = ''): string {
  const lines = text.split('\n');
  const html = lines.join('<br>');
  return `<span class="fcp-chicha"${style ? ` style="${style}"` : ''}>\n  <span class="vh">${lines.join(' ')}</span>\n${LAYERS.map((c) => `  <span class="${c}" aria-hidden="true">${html}</span>`).join('\n')}\n</span>`;
}

export interface Demo { id: string; name: string; guide?: string; html: (a: string) => string }

export const DEMOS: Demo[] = [
  { id: 'chicha', name: 'Chicha', guide: 'Chicha', html: () => chicha('¡Nos vemos\nen Lima!', 'font-size:clamp(40px, 9vw, 72px)') },
  { id: 'boton', name: 'Botón', guide: 'Boton', html: () => `<a class="fcp-btn" href="#">Compra tu entrada</a>
<a class="fcp-btn is-alt" href="#">Postula tu charla</a>
<a class="fcp-btn is-sm" href="#">Entradas</a>
<div style="background:var(--yellow);padding:20px;border-radius:16px">
  <a class="fcp-btn is-dark" href="#">Ver agenda</a>
</div>` },
  { id: 'etiqueta', name: 'Etiqueta, chip y antetítulo', guide: 'Etiqueta', html: () => `<span class="fcp-kicker">Agenda · un solo día</span>
<span class="fcp-chip">★ SÁB 19 DIC · LIMA ★</span>
<span class="fcp-tag">19 DIC<small>SÁBADO</small></span>
<span class="fcp-tag is-sky">9:00<small>A 15:00</small></span>` },
  { id: 'cinta', name: 'Cinta', guide: 'Cinta', html: () => `<span class="fcp-ribbon">FLUTTER<i>★</i>DART<i>★</i>DASH<i>★</i>COMUNIDAD<i>★</i>LIMA<i>★</i>FLUTTER<i>★</i>DART</span>
<span class="fcp-ribbon is-green">CHARLAS<i>★</i>TALLERES<i>★</i>NETWORKING<i>★</i>CHARLAS<i>★</i>TALLERES</span>` },
  { id: 'carta-ponente', name: 'Carta de ponente', guide: 'CartaPonente', html: (a) => `<article class="fcp-speaker" style="rotate:-4deg">
  <div class="pp"><span class="pl">PERÚ</span><img src="${a}dash/dash-posado.svg" alt=""></div>
  <h3>Tu nombre aquí</h3>
  <p>Título de la charla en una o dos líneas</p>
</article>
<article class="fcp-speaker" style="--k:var(--green);rotate:3deg">
  <div class="pp"><span class="pl">GDE</span><img src="${a}dash/dash-posado.svg" alt=""></div>
  <h3>Otra ponente</h3>
  <p>Flutter en producción, sin miedo</p>
</article>` },
  { id: 'tarjeta-tema', name: 'Tarjeta de tema', guide: 'TarjetaTema', html: () => `<div class="fcp-topic" style="--rt:-2deg">
  <span class="n">01</span><h3>Flutter + IA</h3>
  <p>Apps que piensan, con Gemini y Dart.</p>
</div>
<div class="fcp-topic" style="--k:var(--sky-light);--rt:2deg">
  <span class="n">02</span><h3>Dart en el server</h3>
  <p>Un lenguaje de punta a punta.</p>
</div>` },
  { id: 'entrada', name: 'Entrada', guide: 'Entrada', html: () => `<div class="fcp-ticket-wrap">
  <div class="fcp-ticket">
    <h3>General</h3>
    <div class="pr"><small>S/</small>60</div>
    <p class="nt">Precio de ejemplo</p>
    <ul><li>Todas las charlas</li><li>Almuerzo y café</li><li>Sticker de Dash</li></ul>
    <a class="fcp-btn is-sm" href="#">Comprar</a>
  </div>
</div>
<div class="fcp-ticket-wrap" style="--k:var(--red)">
  <div class="fcp-ticket is-featured">
    <h3>Estudiante</h3>
    <div class="pr"><small>S/</small>35</div>
    <p class="nt">Precio de ejemplo</p>
    <ul><li>Todas las charlas</li><li>Almuerzo y café</li></ul>
    <a class="fcp-btn is-sm is-dark" href="#">Comprar</a>
  </div>
</div>` },
  { id: 'burbuja', name: 'Burbuja de Dash', html: () => `<span class="fcp-bubble">¡Hola, causa! Sigue bajando</span>` },
];

export const TEMPLATES = [
  { file: 'post', name: 'Post', size: '1080 × 1080', w: 1128, h: 1128, guide: 'Post' },
  { file: 'historia', name: 'Historia', size: '1080 × 1920', w: 1128, h: 1968, guide: 'Historia' },
  { file: 'diapositiva', name: 'Diapositiva', size: '1920 × 1080', w: 1968, h: 1128, guide: 'Diapositiva' },
] as const;

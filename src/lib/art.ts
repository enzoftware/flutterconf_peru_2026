/**
 * Art helpers ported from the approved prototype: Dash (SVG, with the waving Peruvian flag),
 * the Dash icon, Material 3 polar shapes and chicha ornaments. Everything returns SVG strings
 * rendered at build time with set:html. Only SH/SP/mixD are also used in the browser
 * (Forma viva layer).
 */
export interface DashOptions { fly?: boolean; vb?: string; flag?: boolean; c?: string }

export const FLAG: string = (() => {
  const x0 = 31, W = 62, y0 = 8, H = 42, A = 4.6, PH = [0, 1.57, 3.14, 4.71];
  const yo = (x: number, ph: number): number => A * ((x - x0) / W) * Math.sin((x - x0) / 40 * 2 * Math.PI - ph);
  const band = (xa: number, xb: number, ph: number): string => { const pts: [number, number][] = []; for (let x = xa; x <= xb + .01; x += (xb - xa) / 6) pts.push([x, y0 + yo(x, ph)]);
    for (let x = xb; x >= xa - .01; x -= (xb - xa) / 6) pts.push([x, y0 + H + yo(x, ph)]);
    return 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L') + 'Z'; };
  const cut = [x0, x0 + W / 3, x0 + 2 * W / 3, x0 + W], fill = ['#D91023', '#FFFFFF', '#D91023'];
  const bands = fill.map((f, i) => { const ds = PH.map(ph => band(cut[i], cut[i + 1], ph)); ds.push(ds[0]);
    return `<path d="${ds[0]}" fill="${f}"><animate attributeName="d" dur="1.1s" repeatCount="indefinite" values="${ds.join(';')}"/></path>`; }).join('');
  const edge = PH.map(ph => band(x0, x0 + W, ph)); edge.push(edge[0]);
  return `<g class="d-flag"><path d="M30,120 L30,7" stroke="#6E4B35" stroke-width="4.6" stroke-linecap="round"/><circle cx="30" cy="5.5" r="4.6" fill="#FFD34D" stroke="#B8860B" stroke-width="1"/>${bands}<path d="${edge[0]}" fill="none" stroke="#7A0A14" stroke-opacity=".45" stroke-width="1.2"><animate attributeName="d" dur="1.1s" repeatCount="indefinite" values="${edge.join(';')}"/></path></g>`;
})();

export function dash(o: DashOptions = {}): string {
  const fly = !!o.fly;
  return `<svg class="dash ${fly ? 'fly' : 'idle'} ${o.c || ''}" viewBox="${o.vb || '0 0 300 308'}" aria-hidden="true" focusable="false">
  <g class="d-legs">
    <path class="ol" d="M105,232 L104,284 C104,291 128,291 128,284 L127,232Z" fill="url(#dg-leg)"/>
    <path class="ol" d="M71,292 C67,284 77,279 91,280 L121,280 C133,280 139,288 135,296 C133,303 125,305 119,302 C115,307 105,307 101,302 C95,307 85,306 83,300 C75,303 69,298 71,292Z" fill="#79563F"/>
    <path class="ol" d="M182,232 L183,284 C183,291 204,291 204,284 L203,232Z" fill="url(#dg-leg)"/>
    <path class="ol" d="M184,281 L214,280 C228,279 240,284 240,292 C242,299 236,304 228,301 C224,306 214,306 210,301 C206,306 196,306 192,301 C184,303 178,298 180,292 C180,287 182,283 184,281Z" fill="#79563F"/>
    <path d="M90,288 C100,286 112,286 124,288 M196,288 C206,286 218,286 230,288" stroke="#A47E66" stroke-opacity=".55" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  </g>
  <g class="d-feet">
    <path class="ol" d="M108,240 L108,258 C108,262 124,262 124,258 L124,240Z" fill="url(#dg-leg)"/><ellipse class="ol" cx="112" cy="262" rx="18" ry="7.5" fill="#79563F"/>
    <path class="ol" d="M186,240 L186,258 C186,262 202,262 202,258 L202,240Z" fill="url(#dg-leg)"/><ellipse class="ol" cx="198" cy="262" rx="18" ry="7.5" fill="#79563F"/>
  </g>
  <g class="d-gh" fill="#22D2FF">
    <path d="M70,112 C44,78 22,46 12,8 C34,40 56,72 78,104Z"/>
    <path d="M234,152 C262,122 284,92 298,58 C290,96 268,128 242,162Z"/>
  </g>
  <ellipse class="d-bw ol" cx="240" cy="83" rx="20" ry="22" transform="rotate(24 240 83)" fill="url(#dg-wing)"/>
  <g class="d-tuft">
    <ellipse class="ol" cx="174" cy="46" rx="11" ry="17" transform="rotate(38 174 46)" fill="url(#dg-wing)"/>
    <ellipse class="ol" cx="150" cy="34" rx="23" ry="33" transform="rotate(32 150 34)" fill="url(#dg-wing)"/>
    <ellipse cx="141" cy="22" rx="7" ry="13" transform="rotate(32 141 22)" fill="#fff" opacity=".4"/>
  </g>
  <circle class="ol" cx="162.6" cy="156.2" r="99.6" fill="url(#dg-body)"/>
  <g clip-path="url(#dg-clip)">
    <path d="M86,199 C104,214 126,222 150,222 C174,222 196,212 213,198 C226,206 240,214 270,218 L270,270 L50,270 L50,218 C64,214 76,206 86,199Z" fill="url(#dg-belly)"/>
    <path d="M86,199 C104,214 126,222 150,222 C174,222 196,212 213,198" stroke="#6E9AAE" stroke-opacity=".45" stroke-width="3" fill="none"/>
    <circle cx="162.6" cy="156.2" r="99.6" fill="url(#dg-shade)"/>
    <circle cx="162.6" cy="156.2" r="99.6" fill="url(#dg-rim)"/>
    <ellipse cx="108" cy="84" rx="34" ry="15" fill="#fff" opacity=".42" transform="rotate(-34 108 84)"/>
  </g>
  <path d="M80,152 C72,128 80,99 108,95 C126,93 140,99 149,109 C159,99 175,93 194,95 C220,98 230,124 224,150 C220,166 206,172 190,172 C176,172 166,178 152,181 C136,183 120,178 108,172 C94,170 84,164 80,152Z" fill="url(#dg-mask)" stroke="#3B9DBF" stroke-opacity=".28" stroke-width="2"/>
  <path d="M86,122 C92,104 106,97 122,97 M174,96 C196,94 214,104 220,118" stroke="#B5F6FF" stroke-opacity=".75" stroke-width="3" fill="none" stroke-linecap="round"/>
  <g class="d-eye"><ellipse cx="107.8" cy="137.8" rx="16.9" ry="21.6" fill="url(#dg-eye)" stroke="#19B874" stroke-width="2.8"/><circle cx="112.6" cy="125" r="4.3" fill="#fff"/></g>
  <g class="d-eye"><ellipse cx="188.7" cy="137.8" rx="18" ry="22.6" fill="url(#dg-eye)" stroke="#19B874" stroke-width="2.8"/><circle cx="192" cy="125" r="4.7" fill="#fff"/></g>
  <path class="ol" d="M124,160 C124,150 136,145 148,147 C160,149 166,158 162,168 C158,176 150,180 144,184 C140,190 134,196 130,194 C125,192 127,184 126,178 C124,172 123,166 124,160Z" fill="url(#dg-beak)"/>
  <path d="M130,181 C138,182 148,180 156,174" stroke="#33200F" stroke-opacity=".7" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <ellipse cx="141" cy="155" rx="9" ry="4.5" fill="#fff" opacity=".28" transform="rotate(-12 141 155)"/>
  <g class="d-wl">
    ${o.flag === false ? '' : FLAG}
    <path class="ol" d="M72,110 C60,92 42,80 27,84 C15,88 15,100 25,106 C11,106 3,118 7,128 C10,135 17,137 23,136 C11,144 9,158 19,163 C31,169 51,166 68,164 C76,148 78,128 72,110Z" fill="url(#dg-wing)"/>
    <path d="M27,106 C39,110 53,116 67,120 M23,136 C37,138 53,140 67,142" stroke="#0E8FCB" stroke-opacity=".45" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M30,90 C40,88 52,94 60,102" stroke="#fff" stroke-opacity=".45" stroke-width="3" fill="none" stroke-linecap="round"/>
  </g>
  <g class="d-wr">
    <path class="ol" d="M232,160 C240,150 254,152 266,160 C282,170 296,186 298,200 C299,210 292,214 284,210 C288,222 282,232 272,228 C266,234 256,232 252,224 C242,212 230,196 228,184 C226,174 228,166 232,160Z" fill="url(#dg-wing)"/>
    <path d="M246,178 C254,194 262,208 270,224 M258,172 C268,186 278,198 286,210" stroke="#0E8FCB" stroke-opacity=".45" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M242,160 C252,158 262,162 272,170" stroke="#fff" stroke-opacity=".45" stroke-width="3" fill="none" stroke-linecap="round"/>
  </g>
</svg>`;
}

export const dashHead = (): string => dash({ vb: '56 -2 214 214', flag: false });

/** Compact Dash mark (Material Design Icons "flutter-dash", Apache-2.0). */
export const dashIcon = (c = ''): string => `<svg class="di ${c}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M8.086 15.423q-.055-.08.418-.664q.474-.584 1.084-1.242q.695-.785 1.621-1.74q.281-.373.72-.383t.73.352q.262.342.177.768q-.084.427-.463.632q-1.17.694-2.084 1.22q-.8.442-1.474.79t-.729.267m2.856 5.923q-.125 0-.222-.042q-.096-.042-.154-.148q-.078-.127-.168-.352t-.09-.525q0-.192.025-.353t.055-.322q-.569-.105-.96-.569q-.39-.463-.39-1.073q0-.158.056-.448q-1.557-.55-2.514-1.756t-1.244-3.11q-.125.125-.248.18q-.124.057-.289.057q-.309 0-.785-.476t-.476-2.060q0-1.459.85-2.635t1.694-1.176q.281 0 .35.25t.068.466q.815-1.139 2.022-1.879t2.684-.907q.128-.605.611-.96q.483-.354 1.03-.354V4q.08-.111.21-.212q.107-.084.265-.148t.37-.063t.37.063q.16.064.265.148q.13.1.212.212q-.318 0-.53.187q-.211.186-.267.472q1.14.296 2.112.97q.97.676 1.646 1.625q0-.218.068-.467t.35-.249q.846 0 1.695 1.174t.849 2.634q0 1.587-.476 2.063t-.794.476q-.141 0-.272-.053t-.256-.159q-.296 2.114-1.447 3.372q-1.151 1.257-3.051 1.680q.063.298.284.479q.22.18.515.18h.484q.147 0 .254.085q.107.084.15.21q.106.336.373.63q.266.295.484.5q.161.137.158.336q-.002.2-.17.305q-.232.17-.589.296q-.357.127-.936.177q-.125 0-.222-.042q-.096-.042-.154-.148q-.078-.127-.168-.352t-.09-.525q0-.192.025-.353t.055-.322q-.503-.087-.858-.444q-.355-.358-.442-.856q-.317.04-.634.06q-.318.02-.679.02q-.552 0-1.072-.052q-.52-.053-1-.159l-.05.212q0 .36.24.603t.602.243h.49q.15 0 .256.084t.15.21q.106.336.373.63q.267.295.484.5q.162.137.159.336t-.171.305q-.231.17-.589.296q-.357.127-.936.177m6.77-8.275q.105-.423.158-.888q.053-.466.053-.994q0-2.454-1.735-4.187t-4.19-1.733T7.81 7.004t-1.733 4.188q0 .524.053.98q.053.458.159.874q.125-.423.289-.824t.4-.768q-.13-.312-.198-.632t-.068-.68q0-1.336.919-2.258t2.250-.922q.613 0 1.153.223t.963.605q.423-.382.963-.605t1.154-.223q1.333 0 2.254.924t.92 2.256q0 .36-.077.68q-.078.32-.215.632q.237.367.414.768t.302.85m-5.721 4.044q1.838 0 3.101-.572t1.964-1.713q0-.064.01-.127t.011-.127q0-.635-.146-1.228q-.146-.594-.439-1.124q-.448.498-1.052.79t-1.324.293q-.175 0-.35-.016q-.174-.015-.335-.065q.106-.144.159-.3q.052-.154.077-.333q.025-.045.025-.09v-.092q.125.024.212.037t.212.013q.973 0 1.650-.678t.676-1.652t-.676-1.650q-.677-.674-1.650-.674q-.443 0-.835.157q-.392.158-.702.452L12 8.921l-.576-.503q-.32-.293-.708-.452q-.389-.158-.832-.158q-.973 0-1.650.677t-.676 1.650q0 .852.531 1.483t1.347.794l-.634.71q-.373-.137-.703-.371t-.591-.526q-.292.53-.439 1.123q-.146.593-.146 1.229v.212q.716 1.157 1.983 1.742t3.085.585m1.225-5.933q-.37-.433-.37-1.046q0-.612.37-1.047q.37-.436.9-.436q.528 0 .899.433q.37.433.37 1.045t-.37 1.048t-.9.436q-.528 0-.899-.433m1.209-1.471q.144 0 .235-.096q.09-.096.09-.224t-.093-.222t-.216-.093q-.145 0-.235.093t-.09.216q0 .145.092.235q.093.09.217.09m-5.440 1.472q-.37-.433-.37-1.046q0-.612.37-1.047q.37-.436.9-.436q.528 0 .899.433q.37.433.37 1.045t-.37 1.048t-.9.436q-.528 0-.899-.433m1.209-1.471q.144 0 .235-.096q.09-.096.09-.224t-.093-.222t-.216-.093q-.145 0-.235.093t-.09.216q0 .145.092.235q.093.09.217.09"/></svg>`;

/** Gradients and clip path Dash needs; rendered once per page by the layout. */
export const DASH_DEFS = `<!-- Dash palette sampled from the official 3D render -->
    <radialGradient id="dg-body" cx=".4" cy=".22" r=".86"><stop offset="0" stop-color="#E6FFFF"/><stop offset=".3" stop-color="#C6F6FF"/><stop offset=".62" stop-color="#A5DCEC"/><stop offset=".88" stop-color="#83B8CC"/><stop offset="1" stop-color="#6A99AE"/></radialGradient>
    <radialGradient id="dg-shade" cx=".38" cy=".26" r=".8"><stop offset=".6" stop-color="#3D7A94" stop-opacity="0"/><stop offset="1" stop-color="#3D7A94" stop-opacity=".32"/></radialGradient>
    <radialGradient id="dg-rim" cx="1" cy=".55" r=".5"><stop offset="0" stop-color="#2EE9FF" stop-opacity=".55"/><stop offset="1" stop-color="#2EE9FF" stop-opacity="0"/></radialGradient>
    <linearGradient id="dg-mask" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5CE6FF"/><stop offset="1" stop-color="#1FCBF5"/></linearGradient>
    <linearGradient id="dg-wing" x1="0" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="#40F0FF"/><stop offset=".55" stop-color="#22D2FF"/><stop offset="1" stop-color="#10A8EC"/></linearGradient>
    <radialGradient id="dg-belly" cx=".5" cy=".05" r="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".45" stop-color="#ECEEEF"/><stop offset="1" stop-color="#AEB4B8"/></radialGradient>
    <radialGradient id="dg-eye" cx=".45" cy=".35" r=".7"><stop offset="0" stop-color="#454545"/><stop offset="1" stop-color="#1C1C1C"/></radialGradient>
    <linearGradient id="dg-beak" x1="0" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#A47E66"/><stop offset=".5" stop-color="#7D5944"/><stop offset="1" stop-color="#4B3122"/></linearGradient>
    <linearGradient id="dg-leg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7A5640"/><stop offset=".55" stop-color="#5E3F2B"/><stop offset="1" stop-color="#6E4B35"/></linearGradient>
    <clipPath id="dg-clip"><circle cx="162.6" cy="156.2" r="99.6"/></clipPath>`;

export type ShapeName = 'cookie' | 'clover' | 'sunny' | 'flower' | 'burst' | 'gem' | 'pill' | 'soft';
export const SH: Record<ShapeName, [number, number]> = { cookie:[9,.075], clover:[4,.2], sunny:[8,.1], flower:[6,.15], burst:[12,.06], gem:[3,.13], pill:[2,.18], soft:[5,.05] };
const NPT = 144;
function shapePts(k: ShapeName): [number, number][] {
  const [n, a] = SH[k], R = 49 / (1 + a), pts: [number, number][] = [];
  for (let i = 0; i < NPT; i++){
    const t = i / NPT * 2 * Math.PI, r = R * (1 + a * Math.cos(n * t));
    pts.push([50 + r * Math.cos(t - Math.PI/2), 50 + r * Math.sin(t - Math.PI/2)]);
  }
  return pts;
}
export const SP = Object.fromEntries((Object.keys(SH) as ShapeName[]).map((k) => [k, shapePts(k)])) as Record<ShapeName, [number, number][]>;
export const ptsD = (p: [number, number][], s = 1): string => 'M' + p.map(q => (q[0]*s).toFixed(s === 1 ? 2 : 4) + ',' + (q[1]*s).toFixed(s === 1 ? 2 : 4)).join('L') + 'Z';
export function mixD(a: ShapeName, b: ShapeName, t: number): string { const A = SP[a], B = SP[b]; return ptsD(A.map((q, i) => [q[0] + (B[i][0] - q[0]) * t, q[1] + (B[i][1] - q[1]) * t])); }

export const sparkle = (c: string): string => `<svg viewBox="-1 -1 2 2"><path d="M0,-1 C.12,-.12 .12,-.12 1,0 C.12,.12 .12,.12 0,1 C-.12,.12 -.12,.12 -1,0 C-.12,-.12 -.12,-.12 0,-1Z" fill="${c}"/></svg>`;
export const diamond = (c: string, k: string): string => `<svg viewBox="0 0 40 60"><path d="M20,2 L38,30 L20,58 L2,30Z" fill="${c}" stroke="${k}" stroke-width="4" stroke-linejoin="round"/><path d="M20,16 L29,30 L20,44 L11,30Z" fill="${k}"/></svg>`;
export function flower(c1: string, c2: string, k: string): string { let p = ''; for (let i = 0; i < 8; i++) p += `<ellipse cx="50" cy="22" rx="12" ry="22" fill="${i % 2 ? c2 : c1}" stroke="${k}" stroke-width="4" transform="rotate(${i*45} 50 50)"/>`; return `<svg viewBox="0 0 100 100">${p}<circle cx="50" cy="50" r="14" fill="${k}"/><circle cx="50" cy="50" r="6" fill="${c1}"/></svg>`; }
export function rays(cols: string[]): string { let p = ''; const n = 36; for (let i = 0; i < n; i++){ const a1 = i / n * Math.PI * 2, a2 = (i + .5) / n * Math.PI * 2; p += `<path d="M500,500 L${(500 + 720*Math.cos(a1)).toFixed(1)},${(500 + 720*Math.sin(a1)).toFixed(1)} L${(500 + 720*Math.cos(a2)).toFixed(1)},${(500 + 720*Math.sin(a2)).toFixed(1)}Z" fill="${cols[i % cols.length]}"/>`; } return `<svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice">${p}</svg>`; }
export function starburst(n: number, c: string, k: string): string { let d = ''; for (let i = 0; i < n * 2; i++){ const a = i / (n*2) * Math.PI * 2 - Math.PI/2, r = i % 2 ? 38 : 49; d += (i ? 'L' : 'M') + (50 + r*Math.cos(a)).toFixed(2) + ',' + (50 + r*Math.sin(a)).toFixed(2); } return `<svg viewBox="0 0 100 100"><path d="${d}Z" fill="${c}" stroke="${k}" stroke-width="2.4" stroke-linejoin="round"/></svg>`; }

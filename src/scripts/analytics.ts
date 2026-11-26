/**
 * PostHog analytics, loaded without an npm dependency.
 *
 * Same approach as PostHog's official snippet: a tiny stub queues calls, and the full library
 * (array.js from PostHog's asset CDN) loads once the page is idle, so it never competes with the LCP.
 * Off when PUBLIC_POSTHOG_KEY is empty (see .env.example).
 *
 *  track(event, props)     custom event (queued until the library loads; no-op when analytics are off)
 *  [data-ev="name"]        click tracking: any element with data-ev sends that event on click,
 *                          with data-ev-label as the `label` property.
 *
 * Personal data (name, email) is never sent to PostHog: sign-ups are counted as anonymous events.
 *
 * Consent (CookieBanner.astro): PostHog runs with `cookieless_mode: 'on_reject'` and
 * `opt_out_capturing_by_default`, so a visit counts even if the banner is never answered:
 *  - no answer yet  → cookieless events (server-side daily hash), nothing stored on the device
 *  - "Aceptar"      → opt_in_capturing(): events with a cookie and a persistent anonymous id
 *  - "Rechazar"     → opt_out_capturing(): cookieless events, as before the answer
 * Needs "Enable cookieless tracking" on in PostHog (Settings → Project → Web analytics), or every visit
 * without "Aceptar" is discarded. The choice is also kept under `fcp-cookies` so the banner knows not to
 * come back.
 *
 * On flutterperu.com PUBLIC_POSTHOG_HOST is the /ingest reverse proxy (worker/index.js), so ad blockers
 * that block *.posthog.com don't drop the visit.
 */
import { PUBLIC_POSTHOG_HOST, PUBLIC_POSTHOG_KEY } from 'astro:env/client';

type Props = Record<string, string | number | boolean | undefined>;
/** `sendBeacon` survives the page being closed, for events sent while the visitor leaves. */
type CaptureOptions = { transport?: 'sendBeacon' };
interface PostHogStub extends Array<unknown> {
  _i: unknown[];
  __SV?: number;
  __loaded?: boolean;
  capture?: (event: string, props?: Props, options?: CaptureOptions) => void;
  opt_in_capturing?: () => void;
  opt_out_capturing?: () => void;
  [method: string]: unknown;
}
declare global { interface Window { posthog?: PostHogStub } }

const METHODS = ['capture', 'identify', 'register', 'register_once', 'reset', 'opt_in_capturing', 'opt_out_capturing', 'set_config'];

export const analyticsOn = Boolean(PUBLIC_POSTHOG_KEY);

export type Consent = 'yes' | 'no';
const CONSENT_KEY = 'fcp-cookies';

/** The visitor's cookie choice on this browser, or null if they haven't answered. */
export function consent(): Consent | null {
  try { const v = localStorage.getItem(CONSENT_KEY); return v === 'yes' || v === 'no' ? v : null; } catch { return null; }
}

export function setConsent(v: Consent): void {
  try { localStorage.setItem(CONSENT_KEY, v); } catch { /* private mode: PostHog still keeps its own record */ }
  const ph = window.posthog as PostHogStub | undefined;
  (v === 'yes' ? ph?.opt_in_capturing : ph?.opt_out_capturing)?.call(ph);
}

export function track(event: string, props: Props = {}, options?: CaptureOptions): void {
  window.posthog?.capture?.(event, props, options);
}

/** UTM parameters and ?ref= from the current URL (also sent with the sign-up form). */
export function attribution(): { source: string; utm_source: string; utm_medium: string; utm_campaign: string } {
  const q = new URLSearchParams(location.search);
  return {
    source: q.get('ref') ?? q.get('utm_source') ?? (document.referrer ? new URL(document.referrer).hostname : 'directo'),
    utm_source: q.get('utm_source') ?? '',
    utm_medium: q.get('utm_medium') ?? '',
    utm_campaign: q.get('utm_campaign') ?? '',
  };
}

export function initAnalytics(): void {
  if (!PUBLIC_POSTHOG_KEY || window.posthog) return;
  const host = PUBLIC_POSTHOG_HOST.replace(/\/$/, '');
  const proxied = !/\.i\.posthog\.com$/.test(new URL(host).hostname);

  // Stub: every method pushes [name, ...args]; array.js replays the queue when it loads.
  const ph = [] as unknown as PostHogStub;
  ph._i = [];
  ph.people = [];
  for (const m of METHODS) ph[m] = (...args: unknown[]) => { ph.push([m, ...args]); };
  ph._i.push([PUBLIC_POSTHOG_KEY, {
    api_host: host,
    ...(proxied && { ui_host: 'https://us.posthog.com' }), // toolbar and app links (the proxy only forwards to US)
    defaults: '2025-05-24',              // pageviews + page leaves on SPA-style history changes, sane autocapture
    person_profiles: 'identified_only',  // anonymous visitors don't create person profiles
    respect_dnt: true,
    cookieless_mode: 'on_reject',       // cookieless unless the visitor clicks "Aceptar"
    opt_out_capturing_by_default: true, // no answer yet counts as rejected: cookieless instead of nothing
    disable_session_recording: true,    // turn on from PostHog if you ever want replays (inputs are masked by default)
  }, 'posthog']);
  ph.__SV = 1;
  window.posthog = ph;

  const load = () => {
    const s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = host.replace('.i.posthog.com', '-assets.i.posthog.com') + '/static/array.js';
    document.head.appendChild(s);
  };
  const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1200));
  if (document.readyState === 'complete') idle(load);
  else window.addEventListener('load', () => idle(load), { once: true });

  // Pageviews, page leaves and UTM parameters are captured by PostHog itself (`defaults` above).
  document.addEventListener('click', (e) => {
    const el = (e.target as Element | null)?.closest<HTMLElement>('[data-ev]');
    if (el) track(el.dataset.ev!, { label: el.dataset.evLabel, href: el.getAttribute('href') ?? undefined });
  });
}

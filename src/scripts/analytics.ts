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
 */
import { PUBLIC_POSTHOG_HOST, PUBLIC_POSTHOG_KEY } from 'astro:env/client';

type Props = Record<string, string | number | boolean | undefined>;
interface PostHogStub extends Array<unknown> {
  _i: unknown[];
  __SV?: number;
  __loaded?: boolean;
  capture?: (event: string, props?: Props) => void;
  [method: string]: unknown;
}
declare global { interface Window { posthog?: PostHogStub } }

const METHODS = ['capture', 'identify', 'register', 'register_once', 'reset', 'opt_in_capturing', 'opt_out_capturing', 'set_config'];

export const analyticsOn = Boolean(PUBLIC_POSTHOG_KEY);

export function track(event: string, props: Props = {}): void {
  window.posthog?.capture?.(event, props);
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

  // Stub: every method pushes [name, ...args]; array.js replays the queue when it loads.
  const ph = [] as unknown as PostHogStub;
  ph._i = [];
  ph.people = [];
  for (const m of METHODS) ph[m] = (...args: unknown[]) => { ph.push([m, ...args]); };
  ph._i.push([PUBLIC_POSTHOG_KEY, {
    api_host: host,
    defaults: '2025-05-24',              // pageviews + page leaves on SPA-style history changes, sane autocapture
    person_profiles: 'identified_only',  // anonymous visitors don't create person profiles
    respect_dnt: true,
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

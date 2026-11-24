/**
 * PostHog reverse proxy for flutterperu.com: /ingest/* → PostHog US cloud.
 *
 * Ad blockers drop requests to *.posthog.com, and the landing's audience (developers) runs them a lot,
 * so analytics.ts talks to https://flutterperu.com/ingest instead (`build:cf` sets PUBLIC_POSTHOG_HOST).
 * Only /ingest/* runs this script (`assets.run_worker_first` in wrangler.jsonc); Workers Static Assets
 * keeps serving every page and file without a Worker invocation.
 *
 * Follows PostHog's Cloudflare proxy guide: /static/* and /array/* (the library and the remote config)
 * come from the asset host and are cached at the edge, everything else goes to the ingestion host.
 */
const PREFIX = '/ingest';
const API_HOST = 'us.i.posthog.com';
const ASSET_HOST = 'us-assets.i.posthog.com';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(`${PREFIX}/`)) return env.ASSETS.fetch(request);

    const path = url.pathname.slice(PREFIX.length) + url.search;
    const isAsset = path.startsWith('/static/') || path.startsWith('/array/');
    const upstream = `https://${isAsset ? ASSET_HOST : API_HOST}${path}`;

    const headers = new Headers(request.headers);
    headers.delete('cookie'); // flutterperu.com cookies are not PostHog's business
    headers.delete('host');
    // GeoIP and the cookieless daily hash need the visitor's IP, not the Worker's.
    const ip = request.headers.get('CF-Connecting-IP');
    if (ip) headers.set('X-Forwarded-For', ip);

    const init = { method: request.method, headers, body: request.body, redirect: 'manual' };
    if (!isAsset || request.method !== 'GET') return fetch(upstream, init);

    const cache = caches.default;
    const hit = await cache.match(request);
    if (hit) return hit;
    const res = await fetch(upstream, init);
    if (res.ok) ctx.waitUntil(cache.put(request, res.clone()));
    return res;
  },
};

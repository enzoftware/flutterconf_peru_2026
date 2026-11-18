import { defineConfig, envField } from 'astro/config';

// GitHub Pages serves the site from /<repo>/. Override with SITE_URL / BASE_PATH when moving hosts
// (for a custom domain or Cloudflare Pages use BASE_PATH=/).
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://enzoftware.github.io',
  base: process.env.BASE_PATH ?? '/flutterconf_peru_2026',
  output: 'static',
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'auto' },
  compressHTML: true,
  // Keys read at build time from .env (local) or the GitHub Actions secrets (deploy). See .env.example.
  // All of them are optional: without them the site builds, analytics stay off and the form says so.
  env: {
    schema: {
      PUBLIC_POSTHOG_KEY: envField.string({ context: 'client', access: 'public', optional: true }),
      PUBLIC_POSTHOG_HOST: envField.string({ context: 'client', access: 'public', url: true, default: 'https://us.i.posthog.com' }),
      PUBLIC_REGISTER_ENDPOINT: envField.string({ context: 'client', access: 'public', optional: true }),
      // Set by the PR preview workflow (.github/workflows/preview.yml): every page becomes noindex.
      PREVIEW_BUILD: envField.boolean({ context: 'server', access: 'public', default: false }),
    },
  },
});

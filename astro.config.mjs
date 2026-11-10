import { defineConfig } from 'astro/config';

// GitHub Pages serves the site from /<repo>/. Override with SITE_URL / BASE_PATH when moving hosts
// (for a custom domain or Cloudflare Pages use BASE_PATH=/).
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://enzoftware.github.io',
  base: process.env.BASE_PATH ?? '/flutterconf_peru_2026',
  output: 'static',
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'auto' },
  compressHTML: true,
});

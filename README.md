# FlutterConf Perú 2026

Landing page and design system for **FlutterConf Perú 2026**: a full day of Flutter and Dart on **Saturday 19 December 2026, 9:00–15:00, at Bloom Tower, San Isidro (Lima)**.

- **Site:** https://enzoftware.github.io/flutterconf_peru_2026/ (GitHub Pages, deployed from `main`)
- **Design system:** [`brand/`](brand/README.md). The brand book, the FlutterChicha font, Dash, tokens and social templates all live there. Browse it and download the kit at https://enzoftware.github.io/flutterconf_peru_2026/brand/.
- **Design decisions:** [`DESIGN.md`](DESIGN.md) · **Guide for agents and contributors:** [`AGENTS.md`](AGENTS.md)

## Getting started

```bash
nvm use            # Node 24 (minimum 22.23)
npm ci
npm run dev        # http://localhost:4321/flutterconf_peru_2026/
npm run build      # types + static build in dist/
```

## Editing content (organizing teams)

All content is JSON in `src/content/` (plus `src/data/event.json`). Edit the file, open a PR, and the preview builds by itself. If a field is missing or has the wrong type, the build fails and tells you which one.

| Team | Files |
| --- | --- |
| Logística y Sponsors | `tickets.json`, `sponsorTiers.json`, `faq.json`, `src/data/event.json` (venue, links) |
| Speakers | `speakers.json`, `agenda.json`, `topics.json` |
| Comunicaciones | `social.json`, `posts.json`, `stats.json` |
| Landing | everything else |

Speaker photos and sponsor logos go in `public/` (for example `public/speakers/ana.jpg`). Reference them without a leading slash: `"photo": "speakers/ana.jpg"`.

## Deploy

Every push to `main` builds and publishes to GitHub Pages (`.github/workflows/deploy.yml`). PRs run the type check, the build and Lighthouse (`.github/workflows/ci.yml`). To move to another host or a custom domain, set `SITE_URL` and `BASE_PATH` (for example `BASE_PATH=/`) in the build environment.

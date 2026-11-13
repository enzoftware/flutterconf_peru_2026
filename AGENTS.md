# AGENTS.md

Guide for AI coding agents (Claude Code, Codex, Cursor, …) working on this repository. Read this first, then `DESIGN.md` for the visual and motion rules.

## What this is

- **FlutterConf Perú 2026** landing page: one day of Flutter and Dart. Saturday 19 December 2026, 9:00–15:00, at Bloom Tower (Flora Tristán 310, 16th floor), Magdalena del Mar, Lima.
- **The Chicha Dash design system** in `brand/`: tokens, the FlutterChicha font, Dash and ornament SVGs, component guidelines and social media templates. It is also published as a page at `/brand/`, with live fonts, components and downloads.
- Site copy is in **Spanish (Peru)** and uses "tú". Code, comments and these docs are in English.

## Stack

- [Astro](https://astro.build) 7, static output, TypeScript strict. No UI framework and no client islands.
- Plain CSS. Brand tokens come from `brand/tokens/tokens.css`, and the page styles are in `src/styles/landing.css`.
- All motion is one vanilla TypeScript scroll engine (`src/scripts/engine.ts`, about 3 KB gzipped).
- Content lives in **content collections** (`src/content/*.json`), and Zod validates it at build time.
- Deploy is GitHub Pages through GitHub Actions (`.github/workflows/deploy.yml`) on every push to `main`. PRs run `ci.yml` (type check, build, Lighthouse).

## Commands

| Command | What it does |
| --- | --- |
| `npm ci` | Install (Node ≥ 22.23; `.nvmrc` pins 24) |
| `npm run dev` | Regenerate tokens, start the dev server at `http://localhost:4321/flutterconf_peru_2026/` |
| `npm run build` | Tokens → `astro check` (types) → static build in `dist/` |
| `npm run preview` | Serve `dist/` |
| `npm run tokens` | Regenerate `brand/tokens/tokens.css` from `brand/tokens/tokens.json` |

Before you finish a change, run `npm run build`. It must end with `0 errors`.

## Map

```
brand/                      Design system (source of truth for anything visual)
  tokens/tokens.json        Colors, type, spacing, radius, shadows (edit this)
  tokens/tokens.css         GENERATED from tokens.json (never edit by hand)
  fonts/flutterchicha/      FlutterChicha, 5 stackable layers (TTF + WOFF2)
  fonts/archive/            Rejected explorations (ChichaV2), kept for history
  fonts/monchila/           Monchila, the sponsor-deck title font (licensed, git-ignored; README only)
  assets/{dash,formas,ornamentos}/   SVG exports (Dash with and without the Peruvian flag)
  components/*.md           Usage rules per component (Chicha, Boton, CartaPonente, …)
  css/components.css        Standalone component classes for marketing pages and templates
  templates/*.html          Post 1080², Story 1080×1920, Slide 1920×1080
  tools/flutterchicha/      Font generator (Python, see brand/README.md)
  tools/tokens/             tokens.json → tokens.css
  brand-book.md             Brand book (Spanish)
src/
  content/*.json            Editable content: speakers, agenda, tickets, sponsors, FAQ…
  content/decks/*.json      Sponsor decks, one file per sponsor (slug = file name)
  content.config.ts         Collection schemas (Zod)
  data/event.json           Event facts: date, hours, venue, links
  components/*.astro        One component per landing section + Chicha, Dash, Floater, Ribbon, KitLayers
  components/brand/         Pieces of the brand page
  pages/index.astro         The landing
  pages/brand/index.astro   Brand page: renders brand/ live (tokens, FlutterChicha, components, SVGs, templates)
  pages/decks/[slug].astro  Sponsor deck viewer: review list, present mode (P), PDF export
  components/deck/          Deck slide layouts (DeckSlide picks one by `type`), Frame, Title
  layouts/Deck.astro        Deck layout (noindex, no scroll engine, loads Monchila if installed)
  pages/brand/files/     Serves brand/ files at build time (no copies in public/)
  pages/brand/downloads/    ZIP downloads built from brand/ at build time (src/lib/zip.ts)
  data/brand-demos.ts       HTML examples of the .fcp-* components shown on the brand page
  data/site.ts              Repo URL, GitHub link helper, base-path-aware url()
  lib/brand.ts              Which brand/ files are published, guide intros, sizes
  lib/art.ts                Dash SVG (with flag), Dash icon, M3 shapes, ornaments (build time)
  lib/palette.ts            Accent rotation, speaker fan geometry, Forma viva clip polygon
  scripts/engine.ts         Scroll engine (reveals, parallax, pins, counters, Forma viva, Dash peeking)
  styles/landing.css        Page styles (ported from the approved prototype)
  styles/deck.css           Sponsor deck styles (style A, "Afiche nocturno")
  scripts/deck.ts           Deck viewer: present mode, keyboard, print
  lib/deck.ts               Deck types, accent map, Monchila loader, glyph check
```

## Conventions

- **Content changes go in `src/content/*.json` or `src/data/event.json`**, not in components. Entries are ordered by `id` (`"01"`, `"02"`, …), and the schema in `src/content.config.ts` lists every field.
- **Visual values come from brand tokens.** Add a color or size to `brand/tokens/tokens.json` first, then run `npm run tokens`. Never introduce colors outside the Flutter brand palette plus its listed tints.
- **Chicha headings** use `<Chicha text={'Line one\nline two'} />`. Never hand-write the six layer spans.
- **Dash** is always `<Dash />` (or `dash()` from `src/lib/art.ts`) and is never redrawn or recolored. `flag` defaults to `true`. Pass `flag={false}` where many Dashes repeat, such as speaker photos and posts.
- **Motion:** add `data-r="up|pop|left|right|drop|zoom|spin"` for reveal-on-scroll and `data-p` for parallax (`--p`). Animate only `transform`, `opacity`, `clip-path` and custom properties, and keep a single scroll listener (the engine). Everything must still read with `prefers-reduced-motion: reduce`, which the engine and CSS already handle.
- **No new runtime dependencies** without a reason recorded in the PR. The JS budget is under 30 KB gzipped for the whole page.
- **Accessibility:**
  - Decorative SVGs get `aria-hidden="true"`.
  - Chicha text keeps its `.vh` copy for screen readers.
  - Interactive elements keep a visible focus state (green `#1CDAC5` ring).
  - Contrast targets WCAG AA.
- **Base path:** links to files under `public/` must use `import.meta.env.BASE_URL`, because the site is served from `/flutterconf_peru_2026/` on GitHub Pages. In-page anchors (`#agenda`) need nothing.
- **Fonts:** FlutterChicha is generated, never edited in a font editor. Change `brand/tools/flutterchicha/build.py`, rebuild, and commit the TTF and WOFF2 outputs together.
- **Brand page:** `/brand/` reads `brand/` at build time, so a change in `brand/` shows up there on the next build with no extra step. To publish a new folder or file type, add it to `PUBLISHED` in `src/lib/brand.ts`. A new component in `brand/css/components.css` also needs a demo in `src/data/brand-demos.ts`.
- **Commits:** small and descriptive (`feat:`, `fix:`, `docs:`, `chore:`, `brand:`). Open a PR to `main`; never push directly to `main`.

## Brand guardrails (from flutter.dev/brand)

- Palette:
  - Flutter Navy `#042B59`, Blue `#0553B1`, Sky `#027DFD`.
  - Accents Red `#F25D50`, Yellow `#FFF275`, Purple `#6200EE`, Green `#1CDAC5`.
  - The only derived tones are the ones already listed in `tokens.json`.
- Never make the Flutter logo the most prominent element, and never attach it to the event name. The event mark is the Dash icon plus "FlutterConf Perú".
- Turn ligatures off wherever "Flutter" is set (already global).
- Dash is the Flutter/Dart mascot. Don't distort, recolor or dress him, and don't use the flag alone as a logo.

## Sponsor decks

Each sponsor gets its own deck at `/decks/<slug>/`, built from `src/content/decks/<slug>.json`.

- **New sponsor:** copy an existing JSON file, rename it (the file name is the URL slug), and edit `sponsor`, `title` and the slides. The schema in `src/content.config.ts` (`deckSlide`) lists every field per slide `type`: `cover`, `stats`, `agenda`, `spotlight`, `benefits`, `closing`. Reorder, remove or repeat slides freely.
- **Privacy:** `publish` defaults to `false`, which keeps the deck out of the production build (`npm run dev` always shows it). Set it to `true` only if the deck may be public on GitHub Pages.
- **Present and export:** open the deck in `npm run dev`, press `P` to present (arrows to move, Esc to leave), or use "Exportar PDF" and choose "Save as PDF" with no margins and background graphics on.
- **Style:** option A, "Afiche nocturno", from the deck style exploration. Sizes inside a slide use `--u` (1/1920 of the slide width), so slides scale to any screen and print at 1920×1080.
- **Titles use Monchila**, a licensed font that is never committed. Follow `brand/fonts/monchila/README.md` to install it. The demo has no accents or ñ, so keep Monchila titles free of them; the deck page and the build log list any title that breaks.
- **New layout:** add a branch to the `deckSlide` union, a label in `SLIDE_LABEL` (`src/lib/deck.ts`), the markup in `src/components/deck/DeckSlide.astro` and its styles in `src/styles/deck.css`.

## Not done yet (good next tasks)

- Real speakers, photos, sponsor logos, ticket and CFP links (placeholders today).
- Subset the FlutterChicha WOFF2s to the glyphs used, and self-host Bungee and Rubik.
- An Open Graph image (1200×630) built from the Post template.
- A custom domain. Moving hosts only needs `SITE_URL` and `BASE_PATH` (see `astro.config.mjs`).

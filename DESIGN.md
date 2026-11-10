# DESIGN.md

Design decisions for the FlutterConf Perú 2026 landing and brand. The full brand book (in Spanish, for marketing) is `brand/brand-book.md`. This file explains *why* things look and move the way they do, so changes stay coherent.

## Concept

**Chicha × Flutter.** Lima's *chicha* posters have fluorescent stripes, heavy hand-painted letters, ornaments and hard offset shadows. Here they meet Flutter's official palette, with Dash as the guide. Flutter, Dart and Dash come first, and Lima appears only as the venue. The team picked this direction from three explored options.

The approved combination uses three named layers, so future explorations can mix them:

| Layer | Choice | Notes |
| --- | --- | --- |
| Structure | **Afiche** (option M) | Central poster hero, crossed ribbons, counters, topic cards, pinned speaker fan, pinned horizontal agenda, tickets, community, sponsors and CFP, FAQ, finale |
| Style | **Chicha** | Flutter palette, FlutterChicha lettering, Bungee and Rubik, hard shadows and ink outlines |
| Animation | **Forma viva + Dash asoma** | Morphing M3 shape behind the page, flower-shaped reveals, Dash peeking in from the edges |

The speaker section uses the **fan cards** taken from the "Máxima" exploration.

## Layout: one continuous flow

- The page has no boxed sections. Each `.z` section paints a gradient from `--a` to `--b`, and the next one starts where the previous ended, so the background reads as one long poster: navy, purple, blue, navy, yellow, red, navy.
- The content column is `min(1180px, 100% - 32px)`. Ornaments, ribbons and the morphing shape break out of it on purpose.
- There are only two pinned moments:
  - the speaker fan (the cards open as you scroll)
  - the agenda (a horizontal track from 9:00 to 15:00)

  On narrow screens (under 760px wide) the fan becomes a 2-column grid and the agenda becomes a column.

## Color

- Use only the official Flutter colors:
  - Navy `#042B59`, Blue `#0553B1`, Sky `#027DFD`.
  - Red `#F25D50`, Yellow `#FFF275`, Purple `#6200EE`, Green `#1CDAC5`.
- Derived tones: Navy deep `#021C3F` (ink and night background), Purple deep `#3A0B91`, Sky light `#8FC2FF`, paper `#F3F8FF`.
- The FlutterChicha lettering keeps the colors of the hand-painted reference: white `#F7F7F2`, fluorescent yellow `#E6FF2B`, orange `#FF4D12`, blue shadow `#1467C4`. These are the only colors outside the Flutter palette, and they apply to the lettering only.
- On yellow or red backgrounds, text is ink (`#021C3F`) and the button is the dark variant.

## Typography

- **FlutterChicha** is our own chicha font, drawn from the hand-painted alphabet in `brand/reference/`, whose rights FlutterConf Perú owns.
  - It comes as five stacked layers: Sombra, Base, Amarillo, Naranja and Brillo. The web adds an ink outline layer so headings stay readable on colored backgrounds.
  - Use it for headings from 28 px up, one chicha phrase per view.
- **Bungee** is for UI labels: buttons, tags, chips, ribbons and kickers.
- **Bungee Shade** is for the year and numerals.
- **Rubik** (400–900) is for running text.

## Motion principles

1. **Scroll drives everything.** Positions come from scroll, not time. The only loops are micro ones: Dash blinking and waving, the flag waving, the shape slowly turning.
2. **Everything enters and leaves.** Reveals play in both directions, and an element that leaves above gets `.gone`. With the Forma viva kit, blocks open out of a six-petal flower and close back into it.
3. **There is always a guide.**
   - The background M3 shape changes outline (cookie, flower, sun, clover, burst…), color and side at each section, with its dotted twin on the opposite side.
   - At each section change or heading, Dash peeks in from the left, right or bottom with a short line in Peruvian Spanish ("¡Hola, causa!").
4. **Depth in three speeds.** Ornaments drift with parallax (`data-p` with `--spd` and `--rot`) at a different speed from the content.
5. **Reduced motion is a first-class mode.** Everything is visible and still, Dash stays perched, and the flag stops waving.

## Dash

- Dash is drawn as SVG over the official 3D render, so the proportions match. Wings, eyes, tuft and legs are separate groups, which lets him blink, wave and tuck his legs.
- He holds a small **Peruvian flag** in his raised wing. It waves through SVG `<animate>`, so exported SVGs wave too.
- The hero and the finale show him perched. Peekers and speaker cards show him without the flag where he repeats.

## Performance budget

| Metric | Budget | Today (first build) |
| --- | --- | --- |
| JS (gzip) | < 30 KB | ~3 KB |
| CSS (gzip) | < 20 KB | ~10 KB |
| HTML (gzip) | < 25 KB | ~16 KB |
| Fonts | < 60 KB | ~33 KB FlutterChicha + Google Fonts |
| LCP (4G) | < 2.0 s | to measure in CI (Lighthouse) |
| CLS | 0 | |
| INP | < 200 ms | |

Rules that protect it:
- One scroll listener batched with `requestAnimationFrame`.
- Measure on resize only, never during scroll.
- Animate transform, opacity, clip-path and custom properties only.
- The morph path updates at most 40 steps per section.

## Voice

- Talk like a Peruvian dev speaking to another, using "tú": "Compra tu entrada", "¿Quién sube al escenario?".
- Light local slang ("causa", "pe") only in Dash's speech bubbles, never in practical information.
- Times use 24 h with a colon (9:00), prices use soles (S/), and graphics have no emojis.

# brand/ · Chicha Dash design system

Source of truth for everything visual in FlutterConf Perú 2026: the website, posts, stories, slides and print.

| Path | Contents |
| --- | --- |
| [`brand-book.md`](brand-book.md) | Brand book (Spanish): voice, color, type, shape, Dash, motion, formats |
| `tokens/tokens.json` | Design tokens (colors, type styles, spacing, radius, shadows, strokes). **Edit this.** |
| `tokens/tokens.css` | Generated CSS variables, type classes and `@font-face` rules. Regenerate with `npm run tokens`. |
| `fonts/flutterchicha/` | **FlutterChicha**: 5 stackable layers, TTF (install for Canva, Figma, Keynote) and WOFF2 (web). See [`fonts/README.md`](fonts/README.md). |
| `fonts/archive/chichav2/` | First font exploration (not used, kept for history) |
| `assets/dash/` | Dash SVGs: perched, outlined, flying, head, icon, plus versions with the Peruvian flag |
| `assets/formas/` | The 8 Material 3 shapes in brand colors |
| `assets/ornamentos/` | Chicha ornaments: sparkle, diamond, chicha flower, star seal, bolt |
| `components/*.md` | Usage rules per component: Chicha, Boton, Etiqueta, Cinta, CartaPonente, TarjetaTema, Entrada, Post, Historia, Diapositiva |
| `css/components.css` | The same components as standalone CSS classes (`.fcp-*`) for marketing pages |
| `templates/` | HTML templates: `post.html` (1080×1080), `historia.html` (1080×1920), `diapositiva.html` (1920×1080). Open one in a browser, edit the text, and export it as an image at 1× from the browser's device mode. |
| `reference/` | The hand-painted chicha alphabet that FlutterChicha is drawn from (rights owned by FlutterConf Perú) |
| `tools/` | Generators: `flutterchicha/` (font), `chichav2/` (stroke engine the font reuses), `tokens/` (tokens → CSS) |

## Rebuilding FlutterChicha

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r brand/tools/requirements.txt
python brand/tools/flutterchicha/build.py brand/fonts/flutterchicha
```

The script builds every glyph from geometric primitives:
- Bézier ellipse arcs for bowls and arches.
- Straight shapes for stems, bars and diagonals.
- Bracketed wedge serifs, beaks and spurs.
- Flush ball terminals.

It then splits each glyph into the five layers. Commit the TTF and WOFF2 outputs together, and if the site should pick them up, run `npm run build`.

## Using the lettering outside the web

Stack five text boxes with the same text, size and position, in this order from bottom to top:

1. FlutterChicha Sombra, in `#1467C4`
2. FlutterChicha (base), in `#F7F7F2`
3. FlutterChicha Amarillo, in `#E6FF2B`
4. FlutterChicha Naranja, in `#FF4D12`
5. FlutterChicha Brillo, in white at 80 %

Group them before you move them. On colored backgrounds, add an ink (`#050507`) stroke to the base layer.

The design system is also published as an interactive claude.ai Design System artifact ("FlutterConf Perú Chicha"). Keep both in sync when anything here changes.

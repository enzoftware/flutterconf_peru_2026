# Monchila (neon titles)

Monchila is the retro script of the neon titles: the headings of the launch landing (`src/components/Neon.astro`) and the titles of the sponsor decks (`/decks/<slug>/`). The brand page keeps FlutterChicha, and the landing falls back to it when the files below are missing.

## License

Monchila is a commercial font by AHWE Project (ahweproject.com/product/monchila). The free demo is for personal use only. A sponsor deck and the public website are commercial use, so buy the commercial license before sending a deck, and make sure it covers web embedding (a webfont license) before the landing ships with it: the deployed site serves the font file, and anyone can download it.

The font file is **never committed**: this repository is public, and committing it would redistribute the font. `.gitignore` excludes every `.otf`, `.ttf` and `.woff2` in this folder.

## Install it locally

1. Get `Monchila.otf` (the licensed version).
2. Fix its outlines and copy it here:

   ```bash
   python3 -m venv .venv && source .venv/bin/activate
   pip install -r brand/tools/requirements.txt
   python brand/tools/monchila/fix_overlaps.py ~/Downloads/Monchila.otf brand/fonts/monchila/Monchila.ttf
   ```

   This writes two TrueType files, `Monchila.ttf` (titles) and `MonchilaSilueta.ttf` (the same letters grown by 0.085 em and without holes, used for the ink outline and orange ring of the neon lettering), plus a WOFF2 copy of each for the landing. Decks load the TTFs (see "Why TrueType"), the landing the WOFF2s.

3. Run `npm run dev` and open `/` or `/decks/<slug>/`.

Without the files, everything still builds: the landing headings fall back to FlutterChicha and the deck titles to Bungee. The deck page shows a red notice when that happens.

## Production (GitHub Pages)

The deploy workflow (`.github/workflows/deploy.yml`) writes the two WOFF2 files from repository secrets before the build, so the font never enters git. Production only gets the WOFF2s: the landing uses them, and a published deck falls back to them (same TrueType outlines).

After running the fix script, store each file base64-encoded (a secret holds up to 48 KB; each file is under 30 KB encoded):

```bash
base64 -i brand/fonts/monchila/Monchila.woff2 | gh secret set MONCHILA_WOFF2
base64 -i brand/fonts/monchila/MonchilaSilueta.woff2 | gh secret set MONCHILA_SILUETA_WOFF2
```

Run it again whenever the font files change (for example, with the licensed file), then re-run the deploy. Without the secrets, the deploy logs a warning and the headings fall back to FlutterChicha. PR builds (`ci.yml`) never get the font, so they check that fallback.

## Why the fix

The demo's lowercase `s` has a contour that overlaps itself. FreeType fills it correctly, but Chrome and Safari cut triangular holes into the letter. `fix_overlaps.py` merges overlapping contours with skia-pathops (nonzero winding), which keeps the drawing identical and makes it render the same everywhere. Run it on the licensed file too, in case it carries the same defect.

## Why TrueType

Chrome embeds TrueType fonts in exported PDFs as real fonts, but turns CFF fonts (`.otf`) into Type 3 glyphs. macOS Preview draws the gradient of the neon titles wrong over Type 3 text, so the script converts both files to TrueType. If you still have an older `Monchila.otf` here, run the script again and delete the `.otf` files.

## Accents

The demo has no `á é í ó ú ñ ü` (or their capitals), but it has the marks `´ ˜ ¨`. `fix_overlaps.py` composes each missing letter from the base letter and the mark, centered over the top of the letter (the `i` loses its dot first), in both files. Letters the font already has are left alone, so the licensed file keeps its own drawings if it brings them.

The build reads the installed file's character map: the deck page and the build log list any deck title with a character Monchila can't draw, and `<Neon>` warns in the build log.

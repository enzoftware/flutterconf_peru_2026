# Monchila (sponsor decks only)

Monchila is the retro script used for the titles of the sponsor decks (`/decks/<slug>/`). It is **not** part of the Chicha Dash web identity: the landing and the brand page keep FlutterChicha, Bungee and Rubik.

## License

Monchila is a commercial font by AHWE Project (ahweproject.com/product/monchila). The free demo is for personal use only, and a sponsor deck is commercial use, so buy the commercial license before sending a deck.

The font file is **never committed**: this repository is public, and committing it would redistribute the font. `.gitignore` excludes every `.otf`, `.ttf` and `.woff2` in this folder.

## Install it locally

1. Get `Monchila.otf` (the licensed version).
2. Fix its outlines and copy it here:

   ```bash
   python3 -m venv .venv && source .venv/bin/activate
   pip install -r brand/tools/requirements.txt
   python brand/tools/monchila/fix_overlaps.py ~/Downloads/Monchila.otf brand/fonts/monchila/Monchila.otf
   ```

   This writes two files: `Monchila.otf` (titles) and `MonchilaSilueta.otf` (the same letters grown by 0.085 em and without holes, used for the ink outline and orange ring of the neon lettering).

3. Run `npm run dev` and open `/decks/<slug>/`.

Without the file, the decks still build and the titles fall back to Bungee. The deck page shows a red notice when that happens.

## Why the fix

The demo's lowercase `s` has a contour that overlaps itself. FreeType fills it correctly, but Chrome and Safari cut triangular holes into the letter. `fix_overlaps.py` merges overlapping contours with skia-pathops (nonzero winding), which keeps the drawing identical and makes it render the same everywhere. Run it on the licensed file too, in case it carries the same defect.

## Missing glyphs

The demo has no `á é í ó ú ñ`. Keep Monchila titles free of those letters until the licensed file confirms them; the deck page lists any title that uses them. Running text (Rubik) and labels (Bungee) are not affected.

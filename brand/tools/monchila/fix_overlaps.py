"""Prepare Monchila for the web: fix overlapping contours, build the outline "silhouette", and save
both as TrueType.

1. <output>: every glyph rewritten as the union of its contours (nonzero winding) with
   skia-pathops. The demo's lowercase "s" has a self-overlapping contour that Chrome and Safari
   cut holes into; the union renders the same everywhere. Spanish letters the font lacks
   (á é í ó ú ñ ü and capitals) are composed from its own base letters and its ´ ˜ ¨ marks.
2. <output dir>/MonchilaSilueta.ttf: each glyph with channels narrower than 0.3 em closed
   (grow then shrink by CLOSE), grown by OUTLINE units (0.085 em) with round joins, and with its
   holes removed. The deck's neon lettering fills it in ink for the outline
   and strokes it thinly in orange for the ring, so loops, counters and narrow channels read as
   solid black and the ring only follows the outer edge.

Both are written with TrueType (quadratic) outlines, plus a WOFF2 copy of each for the landing. Chrome embeds TrueType fonts in PDFs as real
fonts, but turns CFF (.otf) fonts into Type 3 glyphs, and macOS Preview draws the deck's clipped
gradient bands over Type 3 text wrong.

Advances, kerning and features are untouched.

Usage:
    python brand/tools/monchila/fix_overlaps.py <input.otf> <output.ttf>
"""
from __future__ import annotations

import sys
from pathlib import Path

import pathops
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont, newTable

SILHOUETTE = "MonchilaSilueta.ttf"
OUTLINE = 85  # font units (UPM 1000): how far the ink outline reaches past the letter
CLOSE = 150  # gaps and channels narrower than 2 × CLOSE inside a letter fill in solid
GAP = 40  # font units between the top of a letter and the accent composed over it
TOP_BAND = 120  # the accent centers on the part of the letter within this many units of its top

# Spanish letters composed from a base letter and a mark when the font lacks them (see accented()).
ACCENTED = {
    "á": ("a", "´"), "é": ("e", "´"), "í": ("i", "´"), "ó": ("o", "´"), "ú": ("u", "´"),
    "Á": ("A", "´"), "É": ("E", "´"), "Í": ("I", "´"), "Ó": ("O", "´"), "Ú": ("U", "´"),
    "ñ": ("n", "˜"), "Ñ": ("N", "˜"), "ü": ("u", "¨"), "Ü": ("U", "¨"),
}


def merged(glyphs, name: str) -> pathops.Path:
    path = pathops.Path()
    glyphs[name].draw(path.getPen(glyphSet=glyphs))
    path.fillType = pathops.FillType.WINDING
    path.simplify(fix_winding=True)
    return path


def ring(path: pathops.Path, radius: float) -> pathops.Path:
    """The band within `radius` of the outline (a round-joined stroke)."""
    band = pathops.Path()
    band.addPath(path)
    band.stroke(radius * 2, pathops.LineCap.ROUND_CAP, pathops.LineJoin.ROUND_JOIN, 4)
    band.convertConicsToQuads()  # round joins come out as conics, which CFF and simplify() can't take
    return band


def grow(path: pathops.Path, radius: float) -> pathops.Path:
    return pathops.op(path, ring(path, radius), pathops.PathOp.UNION, fix_winding=True)


def shrink(path: pathops.Path, radius: float) -> pathops.Path:
    return pathops.op(path, ring(path, radius), pathops.PathOp.DIFFERENCE, fix_winding=True)


def silhouette(path: pathops.Path) -> pathops.Path:
    """Close channels narrower than 2 × CLOSE, grow by OUTLINE, then drop the holes."""
    if not list(path.contours):
        return path
    closed = shrink(grow(path, CLOSE), CLOSE)
    return outer_only(grow(closed, OUTLINE))


def outer_only(path: pathops.Path) -> pathops.Path:
    """Drop holes: keep the contours that wind like the largest one, then union them."""
    contours = list(path.contours)
    if len(contours) < 2:
        return path
    outer = max(contours, key=lambda c: abs(c.area)).clockwise
    result = pathops.Path()
    for c in contours:
        if c.clockwise == outer:
            result.addPath(c)
    result.fillType = pathops.FillType.WINDING
    result.simplify(fix_winding=True)
    return result


def bounds(path: pathops.Path) -> tuple[float, float, float, float]:
    return path.bounds if list(path.contours) else (0, 0, 0, 0)


def top_center(path: pathops.Path, depth: float) -> float:
    """Horizontal center of the part of the letter within `depth` units of its top, where the accent sits."""
    x0, _, x1, y1 = bounds(path)
    band = pathops.Path()
    pen = band.getPen()
    pen.moveTo((x0 - 1, y1 - depth)); pen.lineTo((x1 + 1, y1 - depth)); pen.lineTo((x1 + 1, y1 + 1)); pen.lineTo((x0 - 1, y1 + 1))
    pen.closePath()
    top = pathops.op(path, band, pathops.PathOp.INTERSECTION, fix_winding=True)
    tx0, _, tx1, _ = bounds(top)
    return (tx0 + tx1) / 2


def without_dot(path: pathops.Path, x_height: float) -> pathops.Path:
    """The letter without the contours that float above the x-height (the dot of the i)."""
    out = pathops.Path()
    for c in path.contours:
        if c.bounds[1] < x_height - 50:
            out.addPath(c)
    out.fillType = pathops.FillType.WINDING
    return out


def accented(font: TTFont, glyphs) -> dict[str, tuple[int, str, pathops.Path]]:
    """Accented letters the font lacks, built from its own base letters and marks.

    The Monchila demo ships ´ and ˜ but no á é í ó ú ñ. Each missing letter is the base letter plus
    the mark, centered over the top of the letter and GAP units above it (the i loses its dot first).
    Returns {glyph name: (codepoint, base glyph name, merged outline)}. Letters the font already has
    are left alone, so the licensed file keeps its own drawings.
    """
    cmap = font.getBestCmap()
    x_height = font["OS/2"].sxHeight or 500
    made = {}
    for char, (base, mark) in ACCENTED.items():
        code = ord(char)
        if code in cmap or ord(base) not in cmap or ord(mark) not in cmap:
            continue
        base_name, mark_name = cmap[ord(base)], cmap[ord(mark)]
        letter = merged(glyphs, base_name)
        if base in "ij":
            letter = without_dot(letter, x_height)
        accent = merged(glyphs, mark_name)
        _, _, _, top = bounds(letter)
        mx0, my0, mx1, _ = bounds(accent)
        dx = top_center(letter, TOP_BAND) - (mx0 + mx1) / 2
        dy = top + GAP - my0
        path = pathops.op(letter, accent.transform(1, 0, 0, 1, dx, dy), pathops.PathOp.UNION, fix_winding=True)
        made[f"uni{code:04X}"] = (code, base_name, path)
    return made


def rewrite(src: Path, out: Path, transform) -> int:
    font = TTFont(src)
    if "CFF " not in font:
        raise SystemExit(f"{src} has no CFF outlines; this script only handles .otf (CFF) files")
    glyphs = font.getGlyphSet()
    order = font.getGlyphOrder()
    extra = accented(font, glyphs)

    outlines = {}
    for name in order:
        pen = TTGlyphPen(None)
        # Cubic → quadratic within 1 unit; CFF winds counter-clockwise, TrueType clockwise.
        transform(merged(glyphs, name)).draw(Cu2QuPen(pen, 1.0, reverse_direction=True))
        outlines[name] = pen.glyph()
    hmtx = font["hmtx"]
    for name, (code, base_name, path) in extra.items():
        pen = TTGlyphPen(None)
        shape = transform(path)
        shape.draw(Cu2QuPen(pen, 1.0, reverse_direction=True))
        outlines[name] = pen.glyph()
        hmtx[name] = (hmtx[base_name][0], round(bounds(shape)[0]))
        for table in font["cmap"].tables:
            if table.isUnicode():
                table.cmap[code] = name
    font.setGlyphOrder(order + list(extra))
    to_truetype(font, outlines)

    if transform is silhouette:
        for rec in font["name"].names:
            if rec.nameID in (1, 3, 4, 6, 16):
                rec.string = rec.toUnicode().replace("Monchila", "Monchila Silueta" if rec.nameID != 6 else "MonchilaSilueta")
    out.parent.mkdir(parents=True, exist_ok=True)
    font.save(out)
    return len(order)


def to_truetype(font: TTFont, outlines: dict) -> None:
    """Swap the CFF table for glyf/loca and fix the tables that depend on the outline format."""
    del font["CFF "]
    for tag in ("VORG", "DSIG"):
        if tag in font:
            del font[tag]
    font["loca"] = newTable("loca")
    glyf = font["glyf"] = newTable("glyf")
    glyf.glyphOrder = font.getGlyphOrder()
    glyf.glyphs = outlines
    maxp = font["maxp"] = newTable("maxp")
    maxp.tableVersion = 0x00010000
    for field in ("maxZones", "maxTwilightPoints", "maxStorage", "maxFunctionDefs", "maxInstructionDefs",
                  "maxStackElements", "maxSizeOfInstructions", "maxComponentElements"):
        setattr(maxp, field, 0)
    maxp.maxZones = 1
    font["head"].glyphDataFormat = 0
    post = font["post"]
    post.formatType = 2.0
    post.extraNames = []
    post.mapping = {}
    font.sfntVersion = "\x00\x01\x00\x00"


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    src, out = Path(sys.argv[1]).expanduser(), Path(sys.argv[2])
    n = rewrite(src, out, lambda p: p)
    rewrite(src, out.parent / SILHOUETTE, silhouette)
    # WOFF2 copies for the landing: the same TrueType outlines, about half the size.
    for ttf in (out, out.parent / SILHOUETTE):
        font = TTFont(ttf)
        font.flavor = "woff2"
        font.save(ttf.with_suffix(".woff2"))
    print(f"{n} glyphs -> {out} and {out.parent / SILHOUETTE} (+ .woff2)")

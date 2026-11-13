"""Prepare Monchila for the web: fix overlapping contours, build the outline "silhouette", and save
both as TrueType.

1. <output>: every glyph rewritten as the union of its contours (nonzero winding) with
   skia-pathops. The demo's lowercase "s" has a self-overlapping contour that Chrome and Safari
   cut holes into; the union renders the same everywhere.
2. <output dir>/MonchilaSilueta.ttf: each glyph with channels narrower than 0.3 em closed
   (grow then shrink by CLOSE), grown by OUTLINE units (0.085 em) with round joins, and with its
   holes removed. The deck's neon lettering fills it in ink for the outline
   and strokes it thinly in orange for the ring, so loops, counters and narrow channels read as
   solid black and the ring only follows the outer edge.

Both are written with TrueType (quadratic) outlines. Chrome embeds TrueType fonts in PDFs as real
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


def rewrite(src: Path, out: Path, transform) -> int:
    font = TTFont(src)
    if "CFF " not in font:
        raise SystemExit(f"{src} has no CFF outlines; this script only handles .otf (CFF) files")
    glyphs = font.getGlyphSet()
    order = font.getGlyphOrder()

    outlines = {}
    for name in order:
        pen = TTGlyphPen(None)
        # Cubic → quadratic within 1 unit; CFF winds counter-clockwise, TrueType clockwise.
        transform(merged(glyphs, name)).draw(Cu2QuPen(pen, 1.0, reverse_direction=True))
        outlines[name] = pen.glyph()
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
    print(f"{n} glyphs -> {out} and {out.parent / SILHOUETTE}")

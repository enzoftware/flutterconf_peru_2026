"""Prepare Monchila for the web: fix overlapping contours and build the outline "silhouette".

1. <output>: every CFF glyph rewritten as the union of its contours (nonzero winding) with
   skia-pathops. The demo's lowercase "s" has a self-overlapping contour that Chrome and Safari
   cut holes into; the union renders the same everywhere.
2. <output dir>/MonchilaSilueta.otf: each glyph with channels narrower than 0.3 em closed
   (grow then shrink by CLOSE), grown by OUTLINE units (0.085 em) with round joins, and with its
   holes removed. The deck's neon lettering fills it in ink for the outline
   and strokes it thinly in orange for the ring, so loops, counters and narrow channels read as
   solid black and the ring only follows the outer edge.

Advances, kerning and features are untouched.

Usage:
    python brand/tools/monchila/fix_overlaps.py <input.otf> <output.otf>
"""
from __future__ import annotations

import sys
from pathlib import Path

import pathops
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.ttLib import TTFont

SILHOUETTE = "MonchilaSilueta.otf"
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
    cff = font["CFF "].cff
    top = cff.topDictIndex[0]
    private = top.Private
    nominal = getattr(private, "nominalWidthX", 0)
    glyphs = font.getGlyphSet()

    paths = {name: transform(merged(glyphs, name)) for name in font.getGlyphOrder()}
    for name, path in paths.items():
        pen = T2CharStringPen(font["hmtx"][name][0] - nominal, None, roundTolerance=0.5)
        path.draw(pen)
        top.CharStrings[name] = pen.getCharString(private=private, globalSubrs=cff.GlobalSubrs)

    if transform is silhouette:
        for rec in font["name"].names:
            if rec.nameID in (1, 3, 4, 6, 16):
                rec.string = rec.toUnicode().replace("Monchila", "Monchila Silueta" if rec.nameID != 6 else "MonchilaSilueta")
    out.parent.mkdir(parents=True, exist_ok=True)
    font.save(out)
    return len(paths)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    src, out = Path(sys.argv[1]).expanduser(), Path(sys.argv[2])
    n = rewrite(src, out, lambda p: p)
    rewrite(src, out.parent / SILHOUETTE, silhouette)
    print(f"{n} glyphs -> {out} and {out.parent / SILHOUETTE}")

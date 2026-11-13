"""Merge overlapping contours in Monchila so browsers render it like FreeType.

The demo's lowercase "s" has a self-overlapping contour: FreeType fills it, but Chrome and
Safari cut holes into the letter. This rewrites every CFF glyph as the union of its contours
(nonzero winding) using skia-pathops, keeping advances, kerning and features untouched.

Usage:
    python brand/tools/monchila/fix_overlaps.py <input.otf> <output.otf>
"""
from __future__ import annotations

import sys
from pathlib import Path

import pathops
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.ttLib import TTFont


def fix(src: Path, out: Path) -> int:
    font = TTFont(src)
    if "CFF " not in font:
        raise SystemExit(f"{src} has no CFF outlines; this script only handles .otf (CFF) files")
    cff = font["CFF "].cff
    top = cff.topDictIndex[0]
    private = top.Private
    nominal = getattr(private, "nominalWidthX", 0)
    glyphs = font.getGlyphSet()

    changed = 0
    for name in font.getGlyphOrder():
        path = pathops.Path()
        glyphs[name].draw(path.getPen(glyphSet=glyphs))
        before = list(path.segments)
        path.fillType = pathops.FillType.WINDING
        path.simplify(fix_winding=True)
        if list(path.segments) != before:
            changed += 1
        pen = T2CharStringPen(font["hmtx"][name][0] - nominal, None, roundTolerance=0.5)
        path.draw(pen)
        top.CharStrings[name] = pen.getCharString(private=private, globalSubrs=cff.GlobalSubrs)

    out.parent.mkdir(parents=True, exist_ok=True)
    font.save(out)
    return changed


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    n = fix(Path(sys.argv[1]).expanduser(), Path(sys.argv[2]))
    print(f"Rewrote outlines ({n} glyphs changed) -> {sys.argv[2]}")

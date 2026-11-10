"""ChichaV2 font generator.

Each glyph is a set of pen skeletons (SVG-like M/L/C paths) plus round ball
terminals. Skeletons are stroked with a broad-nib model (thick verticals,
thin horizontals), then unioned with skia-pathops into clean outlines.

Three layered families are produced from the same skeletons:
  ChichaV2       - main letter (Normal)
  ChichaV2 Dura  - fat outline layer, sits behind as border/shadow
  ChichaV2 Luz   - thin inline highlight, sits on top

All three share advance widths, so they stack perfectly in CSS.

Usage: python build.py <out_dir>
"""
import math
import re
import sys
from pathlib import Path as FsPath

import pathops
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.roundingPen import RoundingPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

UPM = 1000
NIB = 228          # broad-nib width
MINW = 80          # hairline minimum
BALL = 1.22        # global ball-terminal scale
NIBANG = math.radians(8)
LSB = 32

VARIANTS = {
    "Normal": dict(w=lambda w: w, r=lambda r: r, off=(0, 0)),
    "Dura":   dict(w=lambda w: w + 112, r=lambda r: r + 56, off=(0, 0)),
    "Luz":    dict(w=lambda w: max(16, w * 0.2), r=lambda r: r * 0.34, off=(-18, 20)),
}

# ---------------------------------------------------------------- geometry
K = 0.5523


def ell(cx, cy, rx, ry):
    return (f"M {cx} {cy+ry} C {cx-K*rx} {cy+ry} {cx-rx} {cy+K*ry} {cx-rx} {cy} "
            f"C {cx-rx} {cy-K*ry} {cx-K*rx} {cy-ry} {cx} {cy-ry} "
            f"C {cx+K*rx} {cy-ry} {cx+rx} {cy-K*ry} {cx+rx} {cy} "
            f"C {cx+rx} {cy+K*ry} {cx+K*rx} {cy+ry} {cx} {cy+ry}")


def arc(cx, cy, rx, ry, a0, a1):
    a0, a1 = math.radians(a0), math.radians(a1)
    n = max(1, math.ceil(abs(a1 - a0) / (math.pi / 2)))
    out = []
    for i in range(n):
        t0 = a0 + (a1 - a0) * i / n
        t1 = a0 + (a1 - a0) * (i + 1) / n
        al = 4 / 3 * math.tan((t1 - t0) / 4)
        p0 = (math.cos(t0), math.sin(t0))
        p3 = (math.cos(t1), math.sin(t1))
        p1 = (p0[0] - al * p0[1], p0[1] + al * p0[0])
        p2 = (p3[0] + al * p3[1], p3[1] - al * p3[0])
        f = lambda p: f"{cx + rx * p[0]:.1f} {cy + ry * p[1]:.1f}"
        if i == 0:
            out.append(f"M {f(p0)}")
        out.append(f"C {f(p1)} {f(p2)} {f(p3)}")
    return " ".join(out)


def arcpt(cx, cy, rx, ry, a):
    a = math.radians(a)
    return (cx + rx * math.cos(a), cy + ry * math.sin(a))


def parse(d):
    toks = re.findall(r"[MLC]|-?\d+(?:\.\d+)?", d)
    segs, i, cur, cmd = [], 0, None, None
    while i < len(toks):
        t = toks[i]
        if t in "MLC":
            cmd = t
            i += 1
            continue
        if cmd == "M":
            cur = (float(toks[i]), float(toks[i + 1]))
            i += 2
            cmd = "L"
        elif cmd == "L":
            p = (float(toks[i]), float(toks[i + 1]))
            i += 2
            segs.append(("L", cur, p))
            cur = p
        elif cmd == "C":
            v = [float(x) for x in toks[i:i + 6]]
            i += 6
            p = (v[4], v[5])
            segs.append(("C", cur, (v[0], v[1]), (v[2], v[3]), p))
            cur = p
    return segs


def bez(s, t):
    if s[0] == "L":
        (x0, y0), (x1, y1) = s[1], s[2]
        return (x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)
    _, p0, p1, p2, p3 = s
    mt = 1 - t
    return tuple(mt**3 * p0[k] + 3 * mt * mt * t * p1[k] + 3 * mt * t * t * p2[k] + t**3 * p3[k] for k in (0, 1))


def deriv(s, t):
    if s[0] == "L":
        return (s[2][0] - s[1][0], s[2][1] - s[1][1])
    _, p0, p1, p2, p3 = s
    mt = 1 - t
    d = tuple(3 * mt * mt * (p1[k] - p0[k]) + 6 * mt * t * (p2[k] - p1[k]) + 3 * t * t * (p3[k] - p2[k]) for k in (0, 1))
    if math.hypot(*d) < 1e-6:
        a, b = bez(s, max(0, t - 0.01)), bez(s, min(1, t + 0.01))
        d = (b[0] - a[0], b[1] - a[1])
    return d


def nibw(dx, dy):
    th = math.atan2(dy, dx)
    return max(MINW, NIB * abs(math.sin(th - NIBANG)))


def disc(x, y, r, n=40):
    return [(x + r * math.cos(2 * math.pi * i / n), y + r * math.sin(2 * math.pi * i / n)) for i in range(n)]


def stroke_polys(segs, opts, wf, off):
    """Return list of polygons for one stroke (bands split at sharp corners + discs)."""
    k = opts.get("k", 1.0)
    tb, te = opts.get("tb", 0), opts.get("te", 0)
    # sample
    samples = []  # (x, y, dx, dy, seg_index)
    for si, s in enumerate(segs):
        n = 26 if s[0] == "C" else 12
        for j in range(n + 1):
            if si > 0 and j == 0:
                continue
            t = j / n
            p = bez(s, t)
            d = deriv(s, t)
            samples.append([p[0], p[1], d[0], d[1], si, j == 0 or j == n])
    # arclength
    L = [0.0]
    for a, b in zip(samples, samples[1:]):
        L.append(L[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
    tot = L[-1] or 1
    pts = []
    for (x, y, dx, dy, si, node), l in zip(samples, L):
        s = l / tot
        w = nibw(dx, dy) * k
        f = 1.0
        if tb and s < tb:
            f = min(f, 0.28 + 0.72 * (s / tb))
        if te and s > 1 - te:
            f = min(f, 0.28 + 0.72 * ((1 - s) / te))
        w = wf(w * f)
        m = math.hypot(dx, dy) or 1
        nx, ny = -dy / m, dx / m
        pts.append((x + off[0], y + off[1], nx, ny, w, si))
    # split into runs at sharp corners between segments
    runs, cur = [], [pts[0]]
    joins = []
    for a, b in zip(pts, pts[1:]):
        if a[5] != b[5]:
            ang = math.degrees(math.acos(max(-1, min(1, a[2] * b[2] + a[3] * b[3]))))
            if ang > 18:
                runs.append(cur)
                joins.append((a[0], a[1], a[4]))
                cur = [a]
        cur.append(b)
    runs.append(cur)
    polys = []
    for run in runs:
        if len(run) < 2:
            continue
        left = [(x + nx * w / 2, y + ny * w / 2) for x, y, nx, ny, w, _ in run]
        right = [(x - nx * w / 2, y - ny * w / 2) for x, y, nx, ny, w, _ in run]
        polys.append(left + right[::-1])
    for x, y, w in joins:
        polys.append(disc(x, y, w / 2))
    if opts.get("cap", True):
        for p in (pts[0], pts[-1]):
            polys.append(disc(p[0], p[1], p[4] / 2))
    return polys


def to_path(poly):
    p = pathops.Path()
    pen = p.getPen()
    pen.moveTo(poly[0])
    for q in poly[1:]:
        pen.lineTo(q)
    pen.closePath()
    p.simplify(clockwise=True)
    return p


def build_outline(gdef, variant):
    v = VARIANTS[variant]
    polys = []
    for d, opts in gdef.get("s", []):
        polys += stroke_polys(parse(d) if isinstance(d, str) else d, opts, v["w"], v["off"])
    for x, y, r in gdef.get("b", []):
        polys.append(disc(x + v["off"][0], y + v["off"][1], v["r"](r * BALL)))
    if not polys:
        return None
    acc = None
    for poly in polys:
        p = to_path(poly)
        acc = p if acc is None else pathops.op(acc, p, pathops.PathOp.UNION, fix_winding=True)
    acc.simplify(clockwise=True)
    return drop_small_holes(acc)


def drop_small_holes(path, min_area=9000):
    """Remove tiny enclosed gaps left where balls meet stroke ends."""
    from fontTools.pens.recordingPen import RecordingPen
    rec = RecordingPen()
    path.draw(rec)
    contours, cur = [], []
    for op, args in rec.value:
        cur.append((op, args))
        if op in ("closePath", "endPath"):
            contours.append(cur)
            cur = []
    out = pathops.Path()
    pen = out.getPen()
    for c in contours:
        pts = [a[-1] for op, a in c if a]
        area = sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts))) / 2
        if area > 0 and abs(area) < min_area:   # counter-clockwise = hole in clockwise output
            continue
        for op, args in c:
            getattr(pen, op)(*args)
    out.simplify(clockwise=True)
    return out


def bounds(path):
    if path is None:
        return None
    b = path.bounds
    return b if b and b[2] > b[0] else None


# ---------------------------------------------------------------- glyph design
# Metrics: baseline 0, x-height 500, caps 700, ascender 740, descender -230.
G = {}


def g(ch, s=(), b=(), adv=None):
    G[ch] = {"s": [x if isinstance(x, tuple) else (x, {}) for x in s], "b": list(b), "adv": adv}


T = {"te": 0.35}       # tapered end
TB = {"tb": 0.35}      # tapered start
FLAG = ("M 70 740 C 26 754 -22 736 -26 700 C -28 674 -10 658 14 660", {})   # curled entry flag on ascenders

# lowercase -------------------------------------------------------------
g("a", [ell(210, 250, 150, 212), "M 360 470 L 360 120 C 360 30 420 0 478 26 C 510 42 522 70 514 98"], [(510, 100, 46)])
g("b", ["M 70 740 L 70 30", ell(232, 250, 160, 212), FLAG], [(14, 664, 48)])
c_end = arcpt(235, 250, 170, 212, 42)
g("c", [arc(235, 250, 170, 212, 42, 318)], [(c_end[0] - 4, c_end[1] - 8, 66)])
g("d", [ell(210, 250, 150, 212), "M 360 740 L 360 120 C 360 30 420 0 478 26 C 510 42 522 70 514 98",
        "M 360 740 C 340 740 315 728 302 705"], [(510, 100, 46), (308, 698, 50)])
e_end = arcpt(232, 250, 168, 212, 318)
g("e", ["M 72 262 L 398 262", arc(232, 250, 168, 212, 4, 318)], [(e_end[0] + 6, e_end[1] - 4, 52)])
g("f", ["M 170 30 L 170 560 C 170 700 232 740 300 740 C 352 740 382 716 386 686",
        "M 40 470 L 320 470", ("M 40 30 L 290 30", {})], [(380, 672, 62)])
g("g", [ell(210, 262, 150, 205), "M 360 470 L 360 -60 C 360 -200 272 -244 180 -244 C 80 -244 18 -192 18 -132 C 18 -94 46 -72 80 -78"], [(82, -76, 54)])
g("h", ["M 70 740 L 70 0", "M 70 330 C 110 440 180 472 240 472 C 322 472 360 420 360 330 L 360 120 C 360 30 420 0 478 26 C 510 42 522 70 514 98", FLAG], [(510, 100, 46), (14, 664, 48)])
g("i", ["M 90 470 L 90 120 C 90 30 150 0 208 26 C 240 42 252 70 244 98", "M 90 470 C 60 470 35 458 22 435"], [(240, 100, 46), (90, 645, 68), (28, 430, 46)])
G["dotlessi"] = {"s": [x for x in G["i"]["s"]], "b": [(240, 100, 46), (28, 430, 46)], "adv": None}
g("j", ["M 160 470 L 160 -80 C 160 -200 90 -244 10 -236 C -50 -228 -80 -190 -76 -150 C -72 -118 -48 -104 -22 -110", "M 160 470 C 130 470 105 458 92 435"], [(-20, -108, 52), (160, 645, 68), (98, 430, 46)])
g("k", ["M 70 740 L 70 0", "M 340 470 C 250 420 150 330 76 250", "M 150 300 C 230 200 290 42 392 42", FLAG], [(398, 48, 48), (14, 664, 48)])
g("l", ["M 90 740 L 90 120 C 90 30 150 0 208 26 C 240 42 252 70 244 98", "M 90 740 C 60 740 35 728 22 705"], [(240, 100, 46), (28, 698, 54)])
g("m", ["M 70 470 L 70 0", "M 70 330 C 104 440 166 472 224 472 C 300 472 350 420 350 330 L 350 0",
        "M 350 330 C 384 440 446 472 504 472 C 580 472 630 420 630 330 L 630 120 C 630 30 690 0 748 26 C 780 42 792 70 784 98",
        "M 70 470 C 40 470 15 458 2 435"], [(780, 100, 46), (8, 430, 46)])
g("n", ["M 70 470 L 70 0", "M 70 330 C 110 440 180 472 240 472 C 322 472 360 420 360 330 L 360 120 C 360 30 420 0 478 26 C 510 42 522 70 514 98",
        "M 70 470 C 40 470 15 458 2 435"], [(510, 100, 46), (8, 430, 46)])
g("o", [ell(242, 250, 172, 212)])
g("p", ["M 70 470 L 70 -230", ell(232, 250, 160, 212), "M 70 470 C 40 470 15 458 2 435", "M -10 -230 L 160 -230"], [(8, 430, 46)])
g("q", [ell(210, 250, 150, 212), "M 360 470 L 360 -150 C 360 -215 410 -238 462 -212"], [(466, -206, 46)])
g("r", ["M 70 470 L 70 0", "M 70 330 C 110 440 170 472 240 472 C 292 472 322 452 332 422", "M 70 470 C 40 470 15 458 2 435"], [(318, 414, 64), (8, 430, 46)])
g("s", ["M 330 420 C 300 460 250 472 200 472 C 110 472 62 420 62 360 C 62 290 122 270 200 250 C 290 228 352 200 352 130 C 352 60 292 28 200 28 C 130 28 72 50 42 100"], [(318, 412, 58), (50, 96, 54)])
g("t", ["M 150 640 L 150 120 C 150 50 190 28 240 28 C 290 28 322 50 342 92", "M 40 470 L 300 470"], [(338, 88, 44), (40, 470, 46)])
g("u", ["M 70 470 L 70 140 C 70 60 120 28 190 28 C 270 28 330 80 360 180", "M 360 470 L 360 120 C 360 30 420 0 478 26 C 510 42 522 70 514 98", "M 70 470 C 40 470 15 458 2 435"], [(510, 100, 46), (8, 430, 46)])
g("v", ["M 20 470 C 90 320 150 160 205 32 C 260 160 320 320 378 440 C 392 468 420 478 446 464"], [(446, 462, 48)])
g("w", ["M 20 470 L 160 32 L 300 380 L 440 32 C 500 200 540 330 576 440 C 590 468 615 478 640 464"], [(640, 462, 48)])
g("x", ["M 40 470 C 150 330 260 170 390 32", "M 390 470 C 260 330 150 170 40 32"], [(398, 464, 48), (32, 38, 48)])
g("y", ["M 30 470 L 210 60", "M 390 470 L 222 -80 C 192 -170 130 -244 50 -244 C -10 -244 -40 -204 -36 -164 C -32 -132 -8 -118 18 -124"], [(20, -122, 52), (390, 464, 46)])
g("z", ["M 52 470 L 372 470 L 62 30 L 382 30"], [(48, 470, 48), (388, 34, 48)])

# capitals ---------------------------------------------------------------
CH = ("M 90 690 C 16 714 -56 690 -56 628 C -56 584 -24 560 16 566", {})      # cap entry swash
CB = (16, 570, 58)
g("A", ["M 30 30 L 262 690 L 488 70 C 506 24 536 12 576 40", "M 128 270 L 404 270", "M -16 54 C 2 32 18 26 30 30"], [(580, 46, 46), (-14, 58, 46)])
g("B", ["M 90 690 L 90 30", "M 0 690 L 262 690 C 382 690 432 640 432 540 C 432 440 372 382 252 382 L 90 382",
        "M 252 382 C 402 382 472 320 472 210 C 472 92 392 30 262 30 L 0 30", CH], [CB])
c_c = arcpt(305, 350, 272, 320, 40)
g("C", [arc(305, 350, 272, 320, 40, 322)], [(c_c[0] - 6, c_c[1] - 10, 78), (arcpt(305, 350, 272, 320, 322)[0] + 4, arcpt(305, 350, 272, 320, 322)[1], 48)])
g("D", ["M 90 690 L 90 30", "M 0 690 L 240 690 C 420 690 522 560 522 360 C 522 160 420 30 240 30 L 0 30", CH], [CB])
g("E", ["M 90 690 L 90 30", "M 0 690 L 400 690 C 430 690 442 670 442 640", "M 90 372 L 330 372", "M 0 30 L 420 30 C 452 30 464 52 464 82", CH], [CB, (442, 630, 54), (464, 92, 54)])
g("F", ["M 90 690 L 90 120 C 90 30 40 0 -22 18", "M 90 690 L 430 690 C 482 690 502 662 494 622", "M 90 372 L 340 372", CH], [CB, (490, 612, 62), (-24, 28, 56)])
gc0 = arcpt(305, 350, 272, 320, 40)
g("G", [arc(305, 350, 272, 320, 40, 340), "M 330 300 L 572 300", "M 572 310 L 572 70"], [(gc0[0] - 6, gc0[1] - 10, 72)])
g("H", ["M 90 690 L 90 30", "M 470 690 L 470 120 C 470 30 530 0 588 26 C 620 42 632 70 624 98", "M 90 372 L 470 372", CH], [CB, (620, 100, 46)])
g("I", ["M 130 690 L 130 30", "M 30 690 L 230 690", "M 30 30 L 230 30"], [(24, 690, 46), (236, 30, 46)])
g("J", ["M 340 690 L 340 120 C 340 0 268 -42 176 -42 C 92 -42 32 0 30 82", "M 230 690 L 450 690"], [(40, 92, 66), (456, 690, 46)])
g("K", ["M 90 690 L 90 30", "M 480 690 L 100 320", "M 214 430 L 428 82 C 456 32 494 20 536 46", CH], [CB, (540, 52, 46), (486, 690, 46)])
g("L", ["M 110 690 L 110 30", "M 110 30 L 470 30 C 502 30 514 52 514 82", "M 110 690 C 70 690 45 676 34 650"], [(514, 94, 56), (34, 645, 56)])
g("M", ["M 40 30 L 122 690 L 326 200 L 530 690 L 600 110 C 610 40 650 20 690 42"], [(694, 48, 46), (36, 40, 52)])
g("N", ["M 90 30 L 90 690 L 480 30 L 480 690"], [(86, 34, 54), (484, 690, 54)])
g("O", [ell(322, 350, 282, 320)])
g("P", ["M 90 690 L 90 30", "M 0 690 L 262 690 C 402 690 472 620 472 510 C 472 400 402 330 262 330 L 90 330", "M 0 30 L 180 30", CH], [CB])
g("Q", [ell(322, 350, 282, 320), "M 330 60 C 420 -40 520 -62 622 -20"], [(624, -16, 52)])
g("R", ["M 90 690 L 90 30", "M 0 690 L 262 690 C 402 690 472 620 472 510 C 472 400 402 330 262 330 L 90 330",
        "M 262 330 C 362 300 402 200 432 100 C 452 40 492 20 542 46", CH], [CB, (546, 52, 46)])
g("S", ["M 470 600 C 430 670 362 692 282 692 C 162 692 82 630 82 530 C 82 430 172 400 282 370 C 402 340 492 300 492 190 C 492 80 402 18 272 18 C 172 18 92 50 42 120"], [(458, 588, 72), (46, 114, 66)])
g("T", ["M 20 690 L 522 690", "M 272 690 L 272 110 C 272 40 232 12 182 32"], [(180, 42, 52), (16, 680, 56), (528, 680, 56)])
g("U", ["M 90 690 L 90 232 C 90 92 172 20 292 20 C 412 20 492 92 492 232 L 492 690", CH], [CB, (498, 690, 50)])
g("V", ["M 20 690 L 282 32 L 544 690"], [(16, 684, 54), (548, 684, 54)])
g("W", ["M 20 690 L 172 32 L 342 550 L 512 32 L 664 690"], [(16, 684, 54), (668, 684, 54)])
g("X", ["M 40 690 L 502 30", "M 502 690 L 40 30"], [(36, 694, 50), (508, 26, 50)])
g("Y", ["M 20 690 L 272 342 L 524 690", "M 272 342 L 272 30"], [(16, 694, 54), (528, 694, 54)])
g("Z", ["M 52 690 L 472 690 L 52 30 L 492 30"], [(46, 690, 50), (498, 34, 50)])

# digits ------------------------------------------------------------------
g("0", [ell(262, 350, 222, 320)])
g("1", ["M 100 560 L 262 690 L 262 30", "M 122 30 L 402 30"], [(96, 556, 50)])
g("2", ["M 62 560 C 92 652 172 692 262 692 C 382 692 452 622 452 522 C 452 382 302 282 62 30 L 472 30"], [(62, 550, 62), (478, 34, 46)])
g("3", ["M 72 600 C 122 672 182 692 262 692 C 372 692 442 632 442 542 C 442 442 362 392 242 392",
        "M 242 392 C 382 392 472 322 472 212 C 472 92 382 20 252 20 C 152 20 82 60 52 120"], [(72, 590, 62), (56, 114, 62)])
g("4", ["M 362 30 L 362 690 L 30 222 L 502 222"])
g("5", ["M 442 690 L 132 690 L 102 400 C 162 432 212 442 262 442 C 392 442 472 362 472 232 C 472 92 382 20 252 20 C 152 20 82 60 52 120"], [(56, 114, 62), (448, 690, 46)])
g("6", ["M 422 640 C 372 680 322 692 272 692 C 132 692 52 562 52 332 C 52 122 142 20 272 20", ell(266, 226, 196, 196)], [(424, 630, 60)])
g("7", ["M 40 690 L 472 690 L 202 30"], [(36, 690, 52)])
g("8", [ell(262, 524, 170, 160), ell(262, 192, 202, 172)])
g("9", [ell(256, 472, 196, 200), "M 452 472 C 452 152 362 20 232 20 C 162 20 112 40 82 72"], [(88, 72, 60)])

# punctuation ---------------------------------------------------------------
g(" ", adv=250)
g(".", [], [(70, 62, 70)])
g(",", [("M 108 42 C 108 -40 68 -100 18 -132", {"te": 0.5})], [(70, 62, 70)])
g("!", [("M 90 690 L 90 230", {"te": 0.45})], [(90, 62, 70)])
g("¡", [("M 90 -190 L 90 270", {"te": 0.45})], [(90, 438, 70)])
g("?", ["M 52 562 C 82 652 162 692 252 692 C 362 692 432 632 432 532 C 432 422 332 382 262 332 C 232 302 232 262 232 222"], [(56, 556, 62), (232, 62, 70)])
g(":", [], [(70, 62, 66), (70, 402, 66)])


def rot180(d, cx, cy):
    return [(s[0],) + tuple((2 * cx - p[0], 2 * cy - p[1]) for p in s[1:]) for s in parse(d)]


g("¿", [(rot180(G["?"]["s"][0][0], 242, 240), {})], [(2 * 242 - x, 2 * 240 - y, r) for x, y, r in G["?"]["b"]])
g(";", [("M 108 42 C 108 -40 68 -100 18 -132", {"te": 0.5})], [(70, 62, 70), (70, 402, 66)])
g("-", ["M 40 280 L 300 280"])
g("–", ["M 40 280 L 470 280"])
g("'", [("M 60 720 L 60 520", {"te": 0.5})])
g('"', [("M 60 720 L 60 520", {"te": 0.5}), ("M 200 720 L 200 520", {"te": 0.5})])
g("/", ["M 30 -100 L 330 740"])
g("+", ["M 40 300 L 420 300", "M 230 110 L 230 490"])
g("#", ["M 160 600 L 120 60", "M 340 600 L 300 60", "M 40 420 L 440 420", "M 30 240 L 430 240"])
g("(", [arc(320, 250, 230, 480, 110, 250)])
g(")", [arc(-60, 250, 230, 480, 70, -70)])
g("→", ["M 40 300 L 520 300", "M 390 440 L 524 300 L 390 160"])
g("@", [ell(330, 300, 120, 140), "M 450 420 L 450 220 C 450 150 500 130 550 160 C 600 200 610 260 610 320 C 610 500 490 620 330 620 C 170 620 50 490 50 320 C 50 140 170 10 330 10 C 400 10 460 30 500 60"])
g("&", ["M 520 30 L 160 470 C 120 520 120 580 160 630 C 200 680 300 680 330 620 C 360 560 320 500 240 450 C 120 380 60 320 60 220 C 60 100 160 20 280 20 C 380 20 460 80 520 200"], [(520, 30, 52)])
g("%", [ell(130, 560, 90, 120), ell(430, 150, 90, 120), "M 450 690 L 110 20"])
g("*", ["M 200 700 L 200 460", "M 90 640 L 310 520", "M 90 520 L 310 640"])

# ornaments (flourishes): { left, } right, ~ center crest, | sprig ----------
def mirx(d, ax):
    return [(s[0],) + tuple((2 * ax - p[0], p[1]) for p in s[1:]) for s in (parse(d) if isinstance(d, str) else d)]


FL = [
    ("M 640 300 C 520 300 430 360 380 430 C 330 500 240 520 186 476 C 146 442 158 384 210 376", {"k": 0.6}),
    ("M 640 300 C 520 300 430 240 380 170 C 330 100 240 80 186 124 C 146 158 158 216 210 224", {"k": 0.6}),
    ("M 560 300 C 500 330 470 370 480 432", {"te": 0.5, "k": 0.6}),
    ("M 560 300 C 500 270 470 230 480 168", {"te": 0.5, "k": 0.6}),
    ("M 470 300 C 400 300 330 300 250 300", {"te": 0.6, "k": 0.6}),
]
FLB = [(214, 378, 44), (214, 222, 44), (646, 300, 34)]
g("{", FL, FLB)
g("}", [(mirx(d, 360), o) for d, o in FL], [(720 - x, y, r) for x, y, r in FLB])
CR = [
    ("M 400 300 C 400 420 340 500 270 500 C 210 500 180 460 188 420", {"k": 0.6}),
    ("M 400 300 C 400 420 460 500 530 500 C 590 500 620 460 612 420", {"k": 0.6}),
    ("M 400 300 C 300 300 200 260 120 200 C 70 160 30 180 36 230", {"k": 0.6}),
    ("M 400 300 C 500 300 600 260 680 200 C 730 160 770 180 764 230", {"k": 0.6}),
    ("M 400 300 L 400 640", {"te": 0.55, "k": 0.7}),
]
g("~", CR, [(196, 424, 40), (604, 424, 40), (44, 238, 38), (756, 238, 38), (400, 300, 56)])
g("|", [("M 200 -150 C 200 100 200 400 200 760", {"tb": 0.3, "te": 0.3, "k": 0.5}),
        ("M 200 300 C 260 360 300 420 300 500", {"te": 0.5, "k": 0.5}), ("M 200 160 C 140 220 100 280 100 360", {"te": 0.5, "k": 0.5})], [])


# accents (composites) ------------------------------------------------------
ACC = {
    "acute": dict(s=[("M -40 0 L 60 120", {"tb": 0.6})], b=[]),
    "tilde": dict(s=["M -120 20 C -90 92 -44 92 0 52 C 44 12 90 12 120 84"], b=[]),
    "dier":  dict(s=[], b=[(-82, 46, 48), (82, 46, 48)]),
}


def tr(d, dx, dy):
    segs = parse(d) if isinstance(d, str) else d
    out = []
    for s in segs:
        out.append((s[0],) + tuple((p[0] + dx, p[1] + dy) for p in s[1:]))
    return out


def compose(name, base, acc, dy):
    bd = G[base]
    xs = []
    for d, _ in bd["s"]:
        for s in (parse(d) if isinstance(d, str) else d):
            xs += [p[0] for p in s[1:]]
    xs += [b[0] for b in bd["b"]]
    cx = (min(xs) + max(xs)) / 2
    a = ACC[acc]
    s = list(bd["s"]) + [(tr(d if isinstance(d, str) else d, cx, dy), o) for d, o in
                         [(x if isinstance(x, tuple) else (x, {})) for x in a["s"]]]
    b = list(bd["b"]) + [(x + cx, y + dy, r) for x, y, r in a["b"]]
    G[name] = {"s": s, "b": b, "adv": None}


for base, ch in [("a", "á"), ("e", "é"), ("o", "ó"), ("u", "ú")]:
    compose(ch, base, "acute", 590)
compose("í", "dotlessi", "acute", 590)
compose("ñ", "n", "tilde", 600)
compose("ü", "u", "dier", 600)
for base, ch in [("A", "Á"), ("E", "É"), ("I", "Í"), ("O", "Ó"), ("U", "Ú")]:
    compose(ch, base, "acute", 780)
compose("Ñ", "N", "tilde", 790)
compose("Ü", "U", "dier", 790)

CHARS = [c for c in G if len(c) == 1]


# ---------------------------------------------------------------- font build
def gname(c):
    return "space" if c == " " else f"uni{ord(c):04X}"


def build(out_dir):
    out_dir = FsPath(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    # metrics from the Normal layer
    outlines = {v: {} for v in VARIANTS}
    metrics = {}
    for c in CHARS:
        for v in VARIANTS:
            outlines[v][c] = build_outline(G[c], v)
        b = bounds(outlines["Normal"][c])
        if G[c]["adv"] is not None or b is None:
            metrics[c] = (G[c]["adv"] or 250, 0)
        else:
            shift = LSB - b[0]
            metrics[c] = (round(b[2] - b[0] + 2 * LSB), shift)
    files = []
    for v in VARIANTS:
        family = "ChichaV2" if v == "Normal" else f"ChichaV2 {v}"
        order = [".notdef"] + [gname(c) for c in CHARS]
        fb = FontBuilder(UPM, isTTF=True)
        fb.setupGlyphOrder(order)
        fb.setupCharacterMap({ord(c): gname(c) for c in CHARS})
        glyphs, hmtx = {}, {}
        pen = TTGlyphPen(None)
        pen.moveTo((50, 0)); pen.lineTo((50, 700)); pen.lineTo((450, 700)); pen.lineTo((450, 0)); pen.closePath()
        glyphs[".notdef"] = pen.glyph()
        hmtx[".notdef"] = (500, 50)
        for c in CHARS:
            adv, shift = metrics[c]
            pen = TTGlyphPen(None)
            p = outlines[v][c]
            if p is not None:
                class Shift(RoundingPen):
                    pass
                rp = RoundingPen(pen)
                rec = pathops.Path()
                p2 = pathops.Path(p)
                p2.transform(1, 0, 0, 1, shift, 0) if hasattr(p2, "transform") else None
                # manual shift via pen wrapper
                from fontTools.pens.transformPen import TransformPen
                p.draw(TransformPen(rp, (1, 0, 0, 1, shift, 0)))
            glyphs[gname(c)] = pen.glyph()
            hmtx[gname(c)] = (adv, 0)
        fb.setupGlyf(glyphs)
        # recompute lsb from glyph bounds
        glyf = fb.font["glyf"]
        for n in order:
            gl = glyf[n]
            gl.recalcBounds(glyf)
            hmtx[n] = (hmtx[n][0], getattr(gl, "xMin", 0) if gl.numberOfContours else 0)
        fb.setupHorizontalMetrics(hmtx)
        fb.setupHorizontalHeader(ascent=1000, descent=-360)
        fb.setupNameTable({"familyName": family, "styleName": "Regular",
                           "uniqueFontIdentifier": f"{family.replace(' ', '')}-Regular;1.0",
                           "fullName": f"{family} Regular", "psName": f"{family.replace(' ', '')}-Regular",
                           "version": "Version 1.000", "copyright": "ChichaV2 (c) 2026 FlutterConf Perú community",
                           "licenseDescription": "Original typeface. Licensed under the SIL Open Font License 1.1."})
        fb.setupOS2(sTypoAscender=900, sTypoDescender=-300, sTypoLineGap=0, usWinAscent=1000, usWinDescent=360,
                    sxHeight=500, sCapHeight=700, achVendID="CHV2", fsType=0)
        fb.setupPost()
        from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
        fea = """
@ROUND = [%(round)s];
@CAPOV = [%(capov)s];
feature kern {
  pos @CAPOV @ROUND -70;
  pos [uni0054] [uni002E uni002C] -90;
  pos [uni0041] [uni0054 uni0056 uni0057 uni0059] -60;
  pos [uni0054 uni0056 uni0057 uni0059] [uni0041] -60;
  pos [uni004C] [uni0054 uni0056 uni0059] -80;
  pos [uni0072] [uni002E uni002C] -50;
  pos [uni0066] [uni0061 uni0065 uni006F] -30;
} kern;
""" % {"round": " ".join(gname(c) for c in "aceoqsáéóñ" if c in CHARS),
       "capov": " ".join(gname(c) for c in "TVWYFP" if c in CHARS)}
        addOpenTypeFeaturesFromString(fb.font, fea)
        stem = family.replace(" ", "")
        ttf = out_dir / f"{stem}-Regular.ttf"
        fb.save(str(ttf))
        f = TTFont(str(ttf))
        f.flavor = "woff2"
        f.save(str(out_dir / f"{stem}-Regular.woff2"))
        files.append(ttf)
    return files


if __name__ == "__main__":
    for f in build(sys.argv[1] if len(sys.argv) > 1 else "out"):
        print(f)

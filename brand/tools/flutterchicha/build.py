"""FlutterChicha font generator (v2: geometric outlines).

A Peruvian chicha sign-painting display face, drawn from the FlutterConf
Perú hand-painted reference alphabet: Latin wedge serifs with soft brackets,
Tuscan mid-stem spurs, ball terminals and strong thick/thin contrast.
Upper and lower case, digits, Spanish accents, punctuation and three
ornaments (star, bolt, burst).

v2 builds every curve from true Bézier ellipse arcs: bowls and arches are
"arc bands" between an outer and an inner ellipse, with independent
centres so the stress (thick sides, thin tops) is controlled exactly.
Stems, bars and diagonals are straight shapes; serifs, spurs and beaks have
curved brackets and slightly blunted tips. Everything is unioned with
skia-pathops and converted to TrueType quadratics with cu2qu.

Five layered families come out of the same outlines. They share advance
widths, so they stack exactly (CSS, Figma, Canva, Keynote: one text box per layer):
  FlutterChicha          - full letter (paint it white)
  FlutterChicha Amarillo - the letter below the yellow band line
  FlutterChicha Naranja  - the letter below the orange band line
  FlutterChicha Brillo   - short painted highlight streaks inside the bands
  FlutterChicha Sombra   - solid extrusion down-left, sits behind everything

Usage: python build.py <out_dir>
"""
import math
import sys
from pathlib import Path as FsPath

import pathops
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

sys.path.insert(0, str(FsPath(__file__).resolve().parent.parent / "chichav2"))
import build as cv  # noqa: E402  (only for the smooth S / s / punctuation pen strokes)

cv.NIB, cv.MINW, cv.NIBANG = 172, 46, math.radians(12)

UPM = 1000
LSB = 36
CAP, XH, ASC, DSC = 700, 500, 740, -230
SW, HT, BW, BH = 142, 48, 150, 50          # caps: stem, hairline, bowl side, bowl top/bottom
LSW, LHT, LBW, LBH = 124, 42, 132, 44      # lowercase
YEL, ORA = 372, 262                        # band lines (absolute, a whole word shares them)
WAVE_A, WAVE_L = 8, 150                    # painted wobble on the band edges
SHADOW = (-74, -58)                        # extrusion vector (down-left, like the reference)


# ------------------------------------------------------------------ path primitives
class Pen:
    def __init__(self):
        self.p = pathops.Path()
        self.pen = self.p.getPen()

    def M(self, x, y): self.pen.moveTo((x, y)); return self
    def L(self, x, y): self.pen.lineTo((x, y)); return self
    def C(self, x1, y1, x2, y2, x, y): self.pen.curveTo((x1, y1), (x2, y2), (x, y)); return self

    def done(self):
        self.pen.closePath()
        self.p.simplify(fix_winding=True, keep_starting_points=False)
        return self.p


def poly(pts):
    pen = Pen().M(*pts[0])
    for q in pts[1:]:
        pen.L(*q)
    return pen.done()


def rect(x0, y0, x1, y1):
    return poly([(x0, y0), (x1, y0), (x1, y1), (x0, y1)])


def diag(xb, yb, xt, yt, w):
    """Straight stroke between two y levels; w is its horizontal width."""
    return poly([(xb - w / 2, yb), (xb + w / 2, yb), (xt + w / 2, yt), (xt - w / 2, yt)])


def _arc(pen, cx, cy, rx, ry, a0, a1, move=False):
    t0, t1 = math.radians(a0), math.radians(a1)
    n = max(1, math.ceil(abs(t1 - t0) / (math.pi / 2) - 1e-9))
    pt = lambda t: (cx + rx * math.cos(t), cy + ry * math.sin(t))
    tg = lambda t: (-rx * math.sin(t), ry * math.cos(t))
    if move:
        pen.M(*pt(t0))
    else:
        pen.L(*pt(t0))
    for i in range(n):
        u0, u1 = t0 + (t1 - t0) * i / n, t0 + (t1 - t0) * (i + 1) / n
        k = 4 / 3 * math.tan((u1 - u0) / 4)
        p0, p3, d0, d3 = pt(u0), pt(u1), tg(u0), tg(u1)
        pen.C(p0[0] + k * d0[0], p0[1] + k * d0[1], p3[0] - k * d3[0], p3[1] - k * d3[1], *p3)


def ellipse(cx, cy, rx, ry):
    pen = Pen()
    _arc(pen, cx, cy, rx, ry, 0, 360, move=True)
    return pen.done()


def band(o, i, a0, a1):
    """Area between an outer ellipse o=(cx,cy,rx,ry) and an inner one i, from angle a0 to a1 (ccw, degrees)."""
    pen = Pen()
    _arc(pen, *o, a0, a1, move=True)
    _arc(pen, *i, a1, a0)
    return pen.done()


def ring(o, i):
    return pathops.op(ellipse(*o), ellipse(*i), pathops.PathOp.DIFFERENCE, fix_winding=True)


def at(e, a, f=0.5, i=None):
    """Point at angle a on ellipse e, or between ellipse e and i (f=0 outer, 1 inner)."""
    t = math.radians(a)
    po = (e[0] + e[2] * math.cos(t), e[1] + e[3] * math.sin(t))
    if i is None:
        return po
    pi = (i[0] + i[2] * math.cos(t), i[1] + i[3] * math.sin(t))
    return (po[0] + (pi[0] - po[0]) * f, po[1] + (pi[1] - po[1]) * f)


def ball(x, y, r):
    return ellipse(x, y, r, r)


def serif(x, y, w, up=True, l=True, r=True, reach=58, h=94, tip=9):
    """Latin wedge serif: a soft concave bracket that ends in a slightly blunt point on line y."""
    d = 1 if up else -1
    out = []
    for side in ((-1,) if l else ()) + ((1,) if r else ()):
        e = x + side * w / 2
        tx = e + side * reach
        pen = Pen().M(e - side * 2, y).L(tx, y).L(tx, y + d * tip)
        pen.C(e + side * reach * 0.42, y + d * tip * 1.2, e, y + d * h * 0.42, e, y + d * h)
        pen.L(e - side * 2, y + d * h)
        out.append(pen.done())
    return out


def spur(x, ym, w, reach=36, h=46):
    """Tuscan spur: a small curved point on both sides of a stem."""
    out = []
    for side in (-1, 1):
        e = x + side * w / 2
        pen = Pen().M(e - side * 2, ym + h)
        pen.C(e, ym + h * 0.45, e + side * reach * 0.55, ym + 6, e + side * reach, ym)
        pen.C(e + side * reach * 0.55, ym - 6, e, ym - h * 0.45, e - side * 2, ym - h)
        out.append(pen.done())
    return out


def beak(x, y, down=True, w=74, h=118, arm=48):
    """Vertical wedge at the end of an arm (E, F, L, T, Z): x is the arm end, y its outer edge."""
    d = -1 if down else 1
    pen = Pen().M(x - w, y).L(x + 2, y).L(x + 2, y + d * (h - 8)).L(x - 6, y + d * h)
    pen.C(x - 14, y + d * (arm + 26), x - w * 0.45, y + d * arm, x - w, y + d * arm)
    return pen.done()


def beakL(x, y, down=True, w=74, h=118, arm=48):
    """Beak on the left end of an arm."""
    d = -1 if down else 1
    pen = Pen().M(x + w, y).L(x - 2, y).L(x - 2, y + d * (h - 8)).L(x + 6, y + d * h)
    pen.C(x + 14, y + d * (arm + 26), x + w * 0.45, y + d * arm, x + w, y + d * arm)
    return pen.done()


def vstroke(d, wmin, wmax, power=1.35, n=420, taper=()):
    """Smooth variable-width stroke: thick where the path runs vertically, thin where it runs
    horizontally, sampled densely by arclength so the outline has no lumps."""
    segs = cv.parse(d)
    raw = []
    for s_ in segs:
        for j in range(60):
            t = j / 60
            raw.append(cv.bez(s_, t))
    raw.append(cv.bez(segs[-1], 1))
    L = [0.0]
    for a, b in zip(raw, raw[1:]):
        L.append(L[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
    tot = L[-1]
    pts, k = [], 0
    for i in range(n + 1):
        target = tot * i / n
        while k < len(L) - 2 and L[k + 1] < target:
            k += 1
        f = (target - L[k]) / ((L[k + 1] - L[k]) or 1)
        pts.append((raw[k][0] + (raw[k + 1][0] - raw[k][0]) * f, raw[k][1] + (raw[k + 1][1] - raw[k][1]) * f))
    left, right = [], []
    for i, (x, y) in enumerate(pts):
        a, b = pts[max(0, i - 2)], pts[min(len(pts) - 1, i + 2)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        m = math.hypot(dx, dy) or 1
        vert = abs(dy) / m
        w = wmin + (wmax - wmin) * vert ** power
        for (t0, t1, f0) in taper:          # (start, end, factor) in 0..1 of length
            u = i / n
            if t0 <= u <= t1:
                w *= f0 + (1 - f0) * (abs(u - (t0 if t0 > 0 else t1)) / (t1 - t0))
        nx, ny = -dy / m, dx / m
        left.append((x + nx * w / 2, y + ny * w / 2))
        right.append((x - nx * w / 2, y - ny * w / 2))
    return poly(left + right[::-1])


def term(o, i, a, r, f=None):
    """Ball terminal: tangent to the outer edge at angle a, swelling into the counter.
    The band should end at the same angle so its cut end is hidden inside the ball."""
    po, pi = at(o, a), at(i, a)
    t = math.hypot(pi[0] - po[0], pi[1] - po[1]) or 1
    r = max(r, t * 0.56)
    k = r / t
    return ball(po[0] + (pi[0] - po[0]) * k, po[1] + (pi[1] - po[1]) * k, r)


def dserif(x, y, w, up=True, reach=46, h=26):
    """Slab-wedge serif for diagonal strokes: a short tapered foot centred on the stroke end."""
    d = 1 if up else -1
    return poly([(x - w / 2 - reach, y), (x + w / 2 + reach, y), (x + w / 2 + reach * 0.15, y + d * h), (x - w / 2 - reach * 0.15, y + d * h)])


def nib(d, opts=None):
    """Smooth broad-nib stroke from the ChichaV2 engine (no end discs; add balls explicitly)."""
    opts = dict({"cap": False}, **(opts or {}))
    polys = cv.stroke_polys(cv.parse(d) if isinstance(d, str) else d, opts, lambda w: w, (0, 0))
    return [poly(p) for p in polys if len(p) >= 3]


def star(cx, cy, r1, r2, n):
    return poly([(cx + (r1 if i % 2 == 0 else r2) * math.cos(math.pi / 2 + i * math.pi / n),
                  cy + (r1 if i % 2 == 0 else r2) * math.sin(math.pi / 2 + i * math.pi / n)) for i in range(2 * n)])


def union(paths):
    acc = None
    for p in paths:
        if p is None:
            continue
        acc = p if acc is None else pathops.op(acc, p, pathops.PathOp.UNION, fix_winding=True)
    if acc is not None:
        acc.simplify(fix_winding=True)
    return acc


def moved(path, dx, dy, sx=1, sy=1, ox=0, oy=0):
    out = pathops.Path()
    path.draw(TransformPen(out.getPen(), (sx, 0, 0, sy, dx + ox - sx * ox, dy + oy - sy * oy)))
    return out


# ------------------------------------------------------------------ glyph table
G = {}


def g(ch, *parts, adv=None):
    flat = []
    for p in parts:
        if isinstance(p, (list, tuple)):
            flat += [x for x in p if x is not None]
        elif p is not None:
            flat.append(p)
    G[ch] = {"shapes": flat, "adv": adv}


def stem(x, y0, y1, w=SW, top=(True, True), foot=(True, True), small=False):
    rc, hh = (50, 80) if small else (58, 94)
    out = [rect(x - w / 2, y0, x + w / 2, y1)]
    if any(foot):
        out += serif(x, y0, w, True, *foot, reach=rc, h=hh)
    if any(top):
        out += serif(x, y1, w, False, *top, reach=rc, h=hh)
    return out


def lstem(x, y0, y1, top=(True, False), foot=(True, True), w=LSW):
    return stem(x, y0, y1, w, top, foot, small=True)


def dbowl(x0, y0, y1, xr, xm, side=BW, th=BH):
    """D-shaped bowl attached to a stem whose right edge is x0: bars from x0 to xm, half-ellipse to xr."""
    cy, ry = (y0 + y1) / 2, (y1 - y0) / 2
    rx = xr - xm
    o = (xm, cy, rx, ry)
    i = (xm, cy, max(10, rx - side), ry - th)
    return [rect(x0 - 4, y0, xm + 1, y0 + th), rect(x0 - 4, y1 - th, xm + 1, y1), band(o, i, -90, 90)]


# ---- capitals ------------------------------------------------------------
g("A", diag(64, 0, 284, CAP, 74), diag(556, 0, 322, CAP, 156), rect(150, 214, 470, 260), rect(250, CAP - 24, 400, CAP),
  dserif(64, 0, 74), serif(556, 0, 156))
g("B", stem(110, 0, CAP, top=(True, False), foot=(True, False)),
  dbowl(181, 348, CAP, 470, 270, 140, 46), dbowl(181, 0, 396, 520, 290, 148, 48))
_Co, _Ci = (356, 350, 306, 360), (372, 350, 158, 310)
g("C", band(_Co, _Ci, 44, 318), term(_Co, _Ci, 44, 48), term(_Co, _Ci, 318, 30))
g("D", stem(110, 0, CAP, top=(True, False), foot=(True, False)), dbowl(181, 0, CAP, 600, 290, 152, 50))
g("E", stem(110, 0, CAP, top=(True, False), foot=(True, False)),
  rect(150, CAP - 48, 486, CAP), beak(486, CAP, True),
  rect(150, 330, 410, 376), beak(410, 376, True, 34, 62), beak(410, 330, False, 34, 62),
  rect(150, 0, 512, 48), beak(512, 0, False))
g("F", stem(110, 0, CAP, top=(True, False)),
  rect(150, CAP - 48, 486, CAP), beak(486, CAP, True),
  rect(150, 316, 400, 362), beak(400, 362, True, 34, 62), beak(400, 316, False, 34, 62))
_Go, _Gi = (356, 350, 306, 360), (372, 350, 158, 310)
g("G", band(_Go, _Gi, 44, 330), term(_Go, _Gi, 44, 48), rect(520, 40, 660, 336), rect(420, 290, 710, 336),
  serif(590, 336, 140, False, False, True, reach=50, h=40))
g("H", stem(110, 0, CAP), stem(530, 0, CAP), rect(150, 330, 490, 376))
g("I", stem(120, 0, CAP), spur(120, 350, SW))
_Jo, _Ji = (262, 196, 212, 210), (262, 196, 72, 162)
g("J", rect(332, 196, 474, CAP), serif(403, CAP, SW, False), band(_Jo, _Ji, 188, 360), term(_Jo, _Ji, 188, 50))
g("K", stem(110, 0, CAP), diag(140, 236, 530, CAP, 74), dserif(530, CAP, 74, False), diag(586, 0, 300, 430, 154), serif(586, 0, 154))
g("L", stem(120, 0, CAP, foot=(True, False)), spur(120, 400, SW), rect(150, 0, 512, 48), beak(512, 0, False))
g("M", stem(84, 0, CAP, 60, top=(True, False)), diag(356, 0, 112, CAP, 156), diag(358, 0, 598, CAP, 74),
  rect(56, CAP - 20, 190, CAP), stem(640, 0, CAP, SW, top=(False, True)), rect(380, 0, 330, 0) if False else None)
g("N", stem(92, 0, CAP, 60, top=(True, False)), diag(512, 0, 124, CAP, 160), rect(62, CAP - 20, 202, CAP),
  stem(544, 30, CAP, 60, foot=(False, False)), rect(468, 0, 574, 30))
_Oo, _Oi = (360, 350, 318, 360), (360, 350, 166, 310)
g("O", ring(_Oo, _Oi))
g("P", stem(110, 0, CAP, top=(True, False)), dbowl(181, 288, CAP, 520, 290, 150, 48))
g("Q", ring(_Oo, _Oi), Pen().M(300, 92).C(380, -14, 500, -74, 676, -48).L(680, -12).C(520, -26, 430, 26, 372, 128).done())
g("R", stem(110, 0, CAP, top=(True, False)), dbowl(181, 300, CAP, 520, 290, 150, 48),
  diag(590, 0, 380, 330, 146), serif(590, 0, 146, True, False, True))
g("S", vstroke("M 472 606 C 432 670 370 696 290 696 C 168 696 92 632 92 532 C 92 430 184 398 296 370 C 412 340 506 300 506 188 C 506 72 414 4 282 4 C 184 4 104 40 56 112", 46, 156),
  ball(458, 588, 50), ball(74, 120, 50))
g("T", rect(24, CAP - 48, 636, CAP), beakL(24, CAP, True), beak(636, CAP, True), stem(330, 0, CAP - 48, top=(False, False)), spur(330, 330, SW))
_Uo, _Ui = (296, 246, 258, 260), (330, 250, 168, 212)
g("U", stem(110, 246, CAP, foot=(False, False)), stem(530, 0, CAP, 60, foot=(False, True)), band(_Uo, _Ui, 180, 360))
g("V", diag(330, 0, 92, CAP, 156), diag(342, 0, 600, CAP, 74), dserif(92, CAP, 156, False), dserif(600, CAP, 74, False), rect(254, 0, 378, 18))
g("W", diag(214, 0, 54, CAP, 150), diag(222, 0, 382, CAP, 70), diag(536, 0, 382, CAP, 150), diag(544, 0, 712, CAP, 70),
  dserif(54, CAP, 150, False), dserif(712, CAP, 70, False), dserif(382, CAP, 150, False, 30), rect(148, 0, 282, 16), rect(468, 0, 604, 16))
g("X", diag(590, 0, 86, CAP, 156), diag(86, 0, 590, CAP, 74), dserif(86, CAP, 156, False), dserif(590, CAP, 74, False),
  dserif(590, 0, 156), dserif(86, 0, 74))
g("Y", diag(338, 330, 86, CAP, 156), diag(338, 330, 600, CAP, 74), dserif(86, CAP, 156, False), dserif(600, CAP, 74, False),
  stem(338, 0, 352, top=(False, False)))
g("Z", rect(66, CAP - 48, 552, CAP), beakL(66, CAP, True), diag(118, 48, 520, CAP - 48, 164), rect(56, 0, 572, 48), beak(572, 0, False))

# ---- lowercase -----------------------------------------------------------
_aho, _ahi = (276, 332, 194, 168), (258, 332, 142, 124)
_abo, _abi = (230, 150, 184, 160), (250, 150, 88, 114)
g("a", lstem(404, 0, 334, top=(False, False), foot=(False, True)), band(_aho, _ahi, 0, 160), term(_aho, _ahi, 160, 40),
  ring(_abo, _abi))
_bo, _bi = (306, 250, 210, 260), (276, 250, 112, 216)
g("b", lstem(100, 0, ASC, foot=(False, False)), rect(38, 0, 160, 60), ring(_bo, _bi))
_co, _ci = (276, 250, 236, 260), (296, 250, 104, 216)
g("c", band(_co, _ci, 42, 318), term(_co, _ci, 42, 42), term(_co, _ci, 318, 24))
_do, _di = (240, 250, 210, 260), (270, 250, 112, 216)
g("d", lstem(420, 0, ASC, foot=(False, True)), ring(_do, _di))
_eo, _ei = (276, 250, 236, 260), (290, 250, 106, 216)
g("e", band(_eo, _ei, 0, 318), rect(44, 234, 510, 278), term(_eo, _ei, 318, 24))
_fo, _fi = (306, 556, 200, 184), (318, 556, 78, 138)
g("f", lstem(170, 0, 560, top=(False, False)), band(_fo, _fi, 38, 180), term(_fo, _fi, 38, 40), rect(40, XH - 46, 366, XH))
_gbo, _gbi = (240, 262, 210, 250), (270, 262, 112, 206)
_gto, _gti = (250, -64, 234, 170), (250, -64, 104, 126)
g("g", rect(358, -64, 482, XH), serif(420, XH, LSW, False, False, True, reach=50, h=80), ring(_gbo, _gbi), band(_gto, _gti, 180, 360),
  term(_gto, _gti, 186, 40))
_ho, _hi = (300, 330, 200, 172), (270, 330, 108, 128)
g("h", lstem(100, 0, ASC), band(_ho, _hi, 0, 180), lstem(438, 0, 334, top=(False, False)))
g("i", lstem(110, 0, XH), ball(110, 660, 70))
_jo, _ji = (128, -64, 166, 166), (128, -64, 42, 120)
g("j", rect(232, -64, 356, XH), serif(294, XH, LSW, False, True, False, reach=50, h=80), band(_jo, _ji, 202, 360), term(_jo, _ji, 202, 38),
  ball(294, 660, 70))
g("k", lstem(100, 0, ASC), diag(134, 168, 448, XH, 62), dserif(448, XH, 62, False, 40, 22), diag(500, 0, 300, 300, 136), serif(500, 0, 136, reach=50, h=80))
g("l", lstem(110, 0, ASC), spur(110, 430, LSW, 24, 34))
_m1o, _m1i = (270, 330, 170, 172), (240, 330, 76, 128)
g("m", lstem(100, 0, XH), band(_m1o, _m1i, 0, 180), lstem(378, 0, 334, top=(False, False)),
  band(moved_e := (548, 330, 170, 172), (518, 330, 76, 128), 0, 180), lstem(656, 0, 334, top=(False, False)))
g("n", lstem(100, 0, XH), band(_ho, _hi, 0, 180), lstem(438, 0, 334, top=(False, False)))
_oo, _oi = (276, 250, 236, 262), (276, 250, 104, 218)
g("o", ring(_oo, _oi))
g("p", lstem(100, DSC, XH), ring(_bo, _bi))
g("q", lstem(420, DSC, XH, top=(False, False)), ring(_do, _di))
_ro, _ri = (262, 330, 162, 172), (250, 330, 90, 128)
g("r", lstem(100, 0, XH), band(_ro, _ri, 30, 180), term(_ro, _ri, 30, 40))
g("s", vstroke("M 368 420 C 338 474 286 504 220 504 C 132 504 78 460 78 392 C 78 316 146 294 224 274 C 310 252 386 220 386 134 C 386 50 316 -4 216 -4 C 140 -4 82 26 50 82", 42, 136),
  ball(356, 406, 42), ball(64, 92, 42))
_to, _ti = (298, 150, 198, 160), (308, 150, 76, 116)
g("t", rect(98, 150, 222, 650), serif(160, 650, LSW, False, True, False, reach=46, h=70), band(_to, _ti, 180, 330), term(_to, _ti, 330, 26),
  rect(30, XH - 46, 344, XH))
_uo, _ui = (269, 170, 231, 180), (269, 170, 107, 136)
g("u", lstem(100, 170, XH, top=(True, True), foot=(False, False)), band(_uo, _ui, 180, 360), lstem(438, 0, XH, top=(True, False), foot=(False, True)))
g("v", diag(270, 0, 72, XH, 138), diag(280, 0, 470, XH, 62), dserif(72, XH, 138, False, 40, 22), dserif(470, XH, 62, False, 40, 22), rect(204, 0, 318, 16))
g("w", diag(188, 0, 44, XH, 132), diag(194, 0, 330, XH, 60), diag(476, 0, 330, XH, 132), diag(482, 0, 622, XH, 60),
  dserif(44, XH, 132, False, 40, 22), dserif(622, XH, 60, False, 40, 22), dserif(330, XH, 132, False, 24, 20), rect(134, 0, 248, 14), rect(424, 0, 538, 14))
g("x", diag(470, 0, 70, XH, 138), diag(70, 0, 470, XH, 62), dserif(70, XH, 138, False, 40, 22), dserif(470, XH, 62, False, 40, 22),
  dserif(470, 0, 138, True, 40, 22), dserif(70, 0, 62, True, 40, 22))
_yo, _yi = (104, -116, 118, 116), (114, -116, 58, 72)
g("y", diag(276, 30, 66, XH, 138), diag(200, -120, 478, XH, 62), dserif(66, XH, 138, False, 40, 22), dserif(478, XH, 62, False, 40, 22),
  band(_yo, _yi, 204, 352), term(_yo, _yi, 204, 36))
g("z", rect(56, XH - 46, 470, XH), beakL(56, XH, True, 40, 90), diag(104, 46, 444, XH - 46, 152), rect(46, 0, 486, 46), beak(486, 0, False, 40, 90))

# ---- digits (lining, cap height) -----------------------------------------
g("0", ring((300, 350, 262, 358), (300, 350, 116, 310)))
g("1", stem(310, 0, CAP, top=(False, False)), diag(170, 560, 250, CAP - 6, 64), rect(239, CAP - 46, 381, CAP), spur(310, 330, SW))
_2o, _2i = (290, 484, 222, 218), (276, 484, 84, 172)
g("2", band(_2o, _2i, -32, 166), term(_2o, _2i, 166, 46), diag(110, 48, 466, 384, 150), rect(52, 0, 540, 48), beak(540, 0, False))
_3a, _3ai = (290, 528, 200, 176), (276, 528, 74, 130)
_3b, _3bi = (296, 200, 230, 210), (280, 200, 90, 162)
g("3", band(_3a, _3ai, -90, 152), term(_3a, _3ai, 152, 44), band(_3b, _3bi, -152, 90), term(_3b, _3bi, -152, 46))
g("4", stem(410, 0, CAP, top=(False, False)), diag(60, 230, 342, CAP, 64), rect(52, 196, 590, 244))
_5o, _5i = (306, 228, 230, 238), (290, 228, 92, 190)
g("5", rect(176, CAP - 48, 512, CAP), beak(512, CAP, True), rect(150, 400, 214, CAP), band(_5o, _5i, -152, 128), term(_5o, _5i, -152, 46))
_6o, _6i = (306, 230, 240, 240), (306, 230, 104, 194)
_6uo, _6ui = (342, 320, 276, 380), (364, 320, 140, 330)
g("6", ring(_6o, _6i), band(_6uo, _6ui, 60, 182), term(_6uo, _6ui, 60, 44))
g("7", rect(62, CAP - 48, 556, CAP), beakL(62, CAP, True), diag(270, 0, 520, CAP - 48, 156), dserif(270, 0, 156))
g("8", ring((300, 200, 246, 210), (300, 200, 112, 162)), ring((300, 530, 206, 180), (300, 530, 84, 134)))
G["9"] = {"shapes": [moved(s, 0, 0, -1, -1, 306, 350) for s in G["6"]["shapes"]], "adv": None}

# ---- punctuation -----------------------------------------------------------
g(" ", adv=270)
g(".", ball(74, 66, 74))
g(",", ball(74, 66, 74), Pen().M(130, 70).C(132, -10, 100, -90, 34, -140).L(20, -120).C(56, -76, 60, -30, 40, 20).done())
g("!", Pen().M(40, CAP).L(156, CAP).L(118, 220).L(78, 220).done(), ball(98, 66, 74))
g("¡", Pen().M(40, -200).L(156, -200).L(118, 280).L(78, 280).done(), ball(98, 434, 74))
_qo, _qi = (262, 520, 202, 184), (250, 520, 76, 136)
g("?", band(_qo, _qi, -90, 168), term(_qo, _qi, 168, 44), rect(212, 220, 290, 360), ball(250, 66, 74))
G["¿"] = {"shapes": [moved(s, 0, 0, -1, -1, 254, 250) for s in G["?"]["shapes"]], "adv": None}
g(":", ball(74, 66, 70), ball(74, 430, 70))
g(";", ball(74, 430, 70), G[","]["shapes"])
g("-", rect(40, 252, 310, 322))
g("–", rect(40, 252, 500, 322))
g("'", diag(66, 480, 72, 730, 62))
g('"', diag(66, 480, 72, 730, 62), diag(196, 480, 202, 730, 62))
g("/", diag(40, -100, 360, 740, 74))
g("+", rect(40, 278, 460, 330), rect(224, 96, 276, 512))
g("#", diag(140, 60, 190, 620, 62), diag(320, 60, 370, 620, 62), rect(40, 400, 480, 444), rect(30, 216, 470, 260))
g("(", band((360, 250, 296, 500), (370, 250, 220, 470), 110, 250))
g(")", band((-60, 250, 296, 500), (-70, 250, 220, 470), -70, 70))
g("→", rect(40, 276, 470, 324), poly([(380, 470), (560, 300), (380, 130), (380, 200), (480, 300), (380, 400)]))
g("@", ring((330, 300, 130, 150), (330, 300, 70, 96)), rect(400, 170, 470, 450),
  band((340, 320, 300, 320), (340, 320, 250, 274), -60, 300))
g("&", vstroke("M 566 24 L 186 470 C 146 520 146 580 186 630 C 226 680 326 680 356 620 C 386 560 346 500 266 450 C 146 380 86 320 86 220 C 86 100 186 20 306 20 C 406 20 486 80 546 200", 46, 150), ball(560, 40, 44))
g("%", ring((140, 560, 96, 126), (140, 560, 42, 82)), ring((450, 150, 96, 126), (450, 150, 42, 82)), diag(112, 20, 480, 690, 60))
g("*", star(220, 560, 176, 64, 4))
g("$", G["S"]["shapes"], rect(266, -86, 316, 786))

# ---- ornaments from the reference: 8-point star, bolt, burst ----------------
g("★", star(340, 300, 330, 74, 8), ball(340, 300, 40))
g("⚡", poly([(430, 730), (140, 300), (310, 300), (176, -90), (560, 404), (372, 404), (530, 730)]))
_burst = []
for i in range(12):
    a = i / 12 * 2 * math.pi
    r0, r1, w = (200, 350, 40) if i % 2 == 0 else (230, 300, 30)
    c, s_ = math.cos(a), math.sin(a)
    _burst.append(poly([(340 + r0 * c - w / 2 * s_, 300 + r0 * s_ + w / 2 * c), (340 + r1 * c, 300 + r1 * s_), (340 + r0 * c + w / 2 * s_, 300 + r0 * s_ - w / 2 * c)]))
for a in (10, 100, 190, 280):
    _burst.append(band((340, 300, 150, 150), (340, 300, 112, 112), a, a + 62))
g("✺", _burst, ball(340, 300, 46))

# ---- accents (composites) --------------------------------------------------
ACC = {
    "acute": [Pen().M(-50, 0).L(10, 0).C(50, 50, 80, 100, 96, 140).L(46, 160).C(20, 110, -16, 50, -50, 0).done()],
    "tilde": [poly([(x, 50 + 30 * math.sin(x / 120 * math.pi) + 21) for x in range(-130, 131, 10)]
                   + [(x, 50 + 30 * math.sin(x / 120 * math.pi) - 21) for x in range(130, -131, -10)])],
    "dier": [ball(-86, 48, 52), ball(86, 48, 52)],
}
G["dotlessi"] = {"shapes": lstem(110, 0, XH), "adv": None}


def outline(gd):
    return union(gd["shapes"]) if gd["shapes"] else None


def compose(name, base, acc, dy):
    b = outline(G[base]).bounds
    cx = (b[0] + b[2]) / 2
    G[name] = {"shapes": list(G[base]["shapes"]) + [moved(s, cx, dy) for s in ACC[acc]], "adv": None}


for base, ch in [("a", "á"), ("e", "é"), ("o", "ó"), ("u", "ú")]:
    compose(ch, base, "acute", 596)
compose("í", "dotlessi", "acute", 596)
compose("ñ", "n", "tilde", 600)
compose("ü", "u", "dier", 606)
for base, ch in [("A", "Á"), ("E", "É"), ("I", "Í"), ("O", "Ó"), ("U", "Ú")]:
    compose(ch, base, "acute", 786)
compose("Ñ", "N", "tilde", 796)
compose("Ü", "U", "dier", 800)

CHARS = [c for c in G if len(c) == 1]


# ------------------------------------------------------------------ layers
def wave_band(ytop, phase=0.0):
    pen = Pen().M(-400, -800).L(1700, -800)
    x = 1700
    pts = [(xx, ytop + WAVE_A * math.sin((xx + phase) / WAVE_L * 2 * math.pi)) for xx in range(1700, -401, -25)]
    for p in pts:
        pen.L(*p)
    return pen.done()


def layers(o):
    if o is None:
        return dict.fromkeys(["Base", "Amarillo", "Naranja", "Brillo", "Sombra"])
    inter = lambda a, b: pathops.op(a, b, pathops.PathOp.INTERSECTION, fix_winding=True)
    yel = inter(o, wave_band(YEL))
    ora = inter(o, wave_band(ORA, 61))
    core = o
    for dx, dy in ((36, 0), (-36, 0), (0, 26), (0, -26)):
        core = inter(core, moved(o, dx, dy))
    streaks = union([rect(-400, y, 1700, y + 13) for y in (ORA - 62, YEL - 34)])
    bri = inter(core, streaks)
    sha = union([o] + [moved(o, SHADOW[0] * t / 40, SHADOW[1] * t / 40) for t in range(1, 41)])
    return {"Base": o, "Amarillo": yel, "Naranja": ora, "Brillo": bri, "Sombra": sha}


# ------------------------------------------------------------------ font build
def gname(c):
    return "space" if c == " " else f"uni{ord(c):04X}"


FAMILIES = {"Base": "FlutterChicha", "Amarillo": "FlutterChicha Amarillo", "Naranja": "FlutterChicha Naranja",
            "Brillo": "FlutterChicha Brillo", "Sombra": "FlutterChicha Sombra"}


def build(out_dir):
    out_dir = FsPath(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    L, metrics = {}, {}
    for c in CHARS:
        o = outline(G[c])
        L[c] = layers(o)
        b = o.bounds if o is not None else None
        if G[c]["adv"] is not None or not b or b[2] <= b[0]:
            metrics[c] = (G[c]["adv"] or 270, 0)
        else:
            metrics[c] = (round(b[2] - b[0] + 2 * LSB), LSB - b[0])
    files = []
    for layer, family in FAMILIES.items():
        order = [".notdef"] + [gname(c) for c in CHARS]
        fb = FontBuilder(UPM, isTTF=True)
        fb.setupGlyphOrder(order)
        fb.setupCharacterMap({ord(c): gname(c) for c in CHARS})
        glyphs, hmtx = {}, {}
        pen = TTGlyphPen(None)
        pen.moveTo((50, 0)); pen.lineTo((50, 700)); pen.lineTo((450, 700)); pen.lineTo((450, 0)); pen.closePath()
        glyphs[".notdef"], hmtx[".notdef"] = pen.glyph(), (500, 50)
        for c in CHARS:
            adv, shift = metrics[c]
            pen = TTGlyphPen(None)
            p = L[c][layer]
            if p is not None:
                p = pathops.Path(p)
                p.simplify(fix_winding=True, clockwise=True)
                p.draw(TransformPen(Cu2QuPen(pen, max_err=0.6, reverse_direction=False), (1, 0, 0, 1, shift, 0)))
            glyphs[gname(c)] = pen.glyph()
            hmtx[gname(c)] = (adv, 0)
        fb.setupGlyf(glyphs)
        glyf = fb.font["glyf"]
        for n in order:
            gl = glyf[n]
            gl.recalcBounds(glyf)
            hmtx[n] = (hmtx[n][0], getattr(gl, "xMin", 0) if gl.numberOfContours else 0)
        fb.setupHorizontalMetrics(hmtx)
        fb.setupHorizontalHeader(ascent=1000, descent=-380)
        ps = family.replace(" ", "")
        fb.setupNameTable({"familyName": family, "styleName": "Regular", "uniqueFontIdentifier": f"{ps}-Regular;2.0",
                           "fullName": f"{family} Regular", "psName": f"{ps}-Regular", "version": "Version 2.100",
                           "copyright": "FlutterChicha (c) 2026 FlutterConf Perú. Drawn from the FlutterConf Perú hand-painted chicha alphabet.",
                           "licenseDescription": "Licensed to FlutterConf Perú for web, print and social media use."})
        fb.setupOS2(sTypoAscender=900, sTypoDescender=-320, sTypoLineGap=0, usWinAscent=1000, usWinDescent=380,
                    sxHeight=XH, sCapHeight=CAP, achVendID="FCPE", fsType=0)
        fb.setupPost()
        addOpenTypeFeaturesFromString(fb.font, """
feature kern {
  pos [uni0054 uni0056 uni0057 uni0059 uni0046 uni0050] [uni0041 uni00C1] -80;
  pos [uni0041 uni00C1] [uni0054 uni0056 uni0057 uni0059] -80;
  pos [uni004C] [uni0054 uni0056 uni0059] -100;
  pos [uni0054 uni0056 uni0057 uni0059 uni0046 uni0050] [uni0061 uni0065 uni006F uni00E1 uni00E9 uni00F3 uni002E uni002C] -70;
  pos [uni0072] [uni002E uni002C] -60;
  pos [uni0066] [uni0061 uni0065 uni006F] -24;
} kern;
""")
        ttf = out_dir / f"{ps}-Regular.ttf"
        fb.save(str(ttf))
        f = TTFont(str(ttf))
        f.flavor = "woff2"
        f.save(str(out_dir / f"{ps}-Regular.woff2"))
        files.append(ttf)
    return files


if __name__ == "__main__":
    for f in build(sys.argv[1] if len(sys.argv) > 1 else "out"):
        print(f)

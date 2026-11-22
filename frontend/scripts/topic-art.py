"""Draws flat scene illustrations for course lessons and word-trainer topics.

Pure local SVG (no AI service): run `python3 scripts/topic-art.py` from
frontend/ and it writes public/images/topics/<key>.svg.
"""
from pathlib import Path
import math

OUT = Path(__file__).resolve().parent.parent / "public" / "images" / "topics"
W, H = 400, 240
SKIN = ["#f2c7a5", "#d9a07a", "#a86b4a", "#f5d6bd"]
HAIR = ["#2b2321", "#6b3e26", "#c98a3c", "#1d1d2b"]
INK = "#1f2333"


# Scenes stay still; the cards around them carry the motion.
ANIMATE = False
STYLE = """<style>
.f{animation:f 3.2s ease-in-out infinite}@keyframes f{50%{transform:translateY(-7px)}}
.w{transform-box:fill-box;transform-origin:50% 100%;animation:w 1.1s ease-in-out infinite alternate}@keyframes w{from{transform:rotate(-12deg)}to{transform:rotate(14deg)}}
.sp{transform-box:fill-box;transform-origin:center;animation:sp 16s linear infinite}@keyframes sp{to{transform:rotate(360deg)}}
.rv{transform-box:fill-box;transform-origin:center;animation:rv 4s linear infinite}@keyframes rv{to{transform:rotate(-360deg)}}
.dr{animation:dr 7s ease-in-out infinite alternate}@keyframes dr{from{transform:translateX(-14px)}to{transform:translateX(14px)}}
.pu{transform-box:fill-box;transform-origin:center;animation:pu 1.5s ease-in-out infinite}@keyframes pu{50%{transform:scale(1.18)}}
.st{animation:st 2.4s ease-in-out infinite}@keyframes st{0%{transform:translateY(8px);opacity:0}40%{opacity:1}100%{transform:translateY(-12px);opacity:0}}
.fa{animation:fa 1.3s linear infinite}@keyframes fa{0%{transform:translateY(-12px);opacity:0}25%{opacity:1}100%{transform:translateY(26px);opacity:0}}
.sw{transform-box:fill-box;transform-origin:50% 0;animation:sw 2.4s ease-in-out infinite alternate}@keyframes sw{from{transform:rotate(-9deg)}to{transform:rotate(9deg)}}
.rk{transform-box:fill-box;transform-origin:50% 100%;animation:rk 2.8s ease-in-out infinite alternate}@keyframes rk{from{transform:rotate(-5deg)}to{transform:rotate(5deg)}}
.dv{animation:dv 4.5s ease-in-out infinite alternate}@keyframes dv{from{transform:translateX(-40px)}to{transform:translateX(30px)}}
.fl{animation:fl 6s ease-in-out infinite}@keyframes fl{0%,100%{transform:translate(-14px,6px)}50%{transform:translate(16px,-10px)}}
.hd{transform-box:fill-box;transform-origin:50% 100%;animation:sp 8s linear infinite}
.nd{transform-box:fill-box;transform-origin:50% 100%;animation:nd 2.2s ease-in-out infinite alternate}@keyframes nd{from{transform:rotate(-70deg)}to{transform:rotate(70deg)}}
.tw{transform-box:fill-box;transform-origin:center;animation:tw 1.8s ease-in-out infinite}@keyframes tw{0%,100%{opacity:.35;transform:scale(.8)}50%{opacity:1;transform:scale(1.1)}}
.bo{animation:bo 1.6s ease-in-out infinite}@keyframes bo{50%{transform:translateY(-4px)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>"""


def A(cls, content, delay=0):
    d = f' style="animation-delay:{delay}s"' if delay else ""
    return f'<g class="{cls}"{d}>{content}</g>'


def svg(bg, body, accent):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice">{STYLE if ANIMATE else ""}'
        f'<rect width="{W}" height="{H}" fill="{bg}"/>'
        f'<g class="dr"><circle cx="320" cy="40" r="120" fill="{accent}" opacity=".35"/></g>'
        f'<circle cx="40" cy="230" r="90" fill="{accent}" opacity=".25"/>'
        f'<rect y="196" width="{W}" height="44" fill="#000" opacity=".08"/>'
        f"{body}</svg>"
    )


def g(content, x=0, y=0, s=1, r=0):
    return f'<g transform="translate({x} {y}) rotate({r}) scale({s})">{content}</g>'


# ---------- characters ----------
def hand(color, cuff="#fff"):
    """Open palm, wrist at (0,0), fingers pointing up (-y)."""
    f = ""
    for i, (dx, h) in enumerate([(-11, 20), (-4, 24), (3, 23), (10, 18)]):
        f += f'<rect x="{dx - 3}" y="{-34 - h}" width="7" height="{h + 8}" rx="3.5" fill="{color}"/>'
    f += f'<rect x="-15" y="-38" width="30" height="32" rx="10" fill="{color}"/>'
    f += f'<rect x="-8" y="-12" width="9" height="20" rx="4.5" fill="{color}" transform="rotate(-55 -14 -18)"/>'
    f += f'<rect x="-13" y="-8" width="26" height="12" rx="4" fill="{cuff}"/>'
    return f


def person(x, base, s=1, shirt="#3b82f6", hair=0, skin=0, mood="smile", wave=None, long_hair=False, child=False):
    sk, hr = SKIN[skin % 4], HAIR[hair % 4]
    p = ""
    p += f'<path d="M-38 0 Q-38 -52 0 -56 Q38 -52 38 0 Z" fill="{shirt}"/>'
    p += f'<rect x="-7" y="-66" width="14" height="14" fill="{sk}"/>'
    if long_hair:
        p += f'<path d="M-25 -88 Q-30 -50 -22 -44 L22 -44 Q30 -50 25 -88 Z" fill="{hr}"/>'
    p += f'<circle cx="0" cy="-86" r="22" fill="{sk}"/>'
    p += f'<path d="M-23 -88 Q-22 -112 0 -110 Q22 -112 23 -88 Q14 -100 -2 -98 Q-14 -98 -23 -88 Z" fill="{hr}"/>'
    p += f'<circle cx="-8" cy="-86" r="2.4" fill="{INK}"/><circle cx="8" cy="-86" r="2.4" fill="{INK}"/>'
    p += '<circle cx="-14" cy="-78" r="3.5" fill="#ff8a8a" opacity=".45"/><circle cx="14" cy="-78" r="3.5" fill="#ff8a8a" opacity=".45"/>'
    if mood == "smile":
        p += f'<path d="M-7 -76 Q0 -70 7 -76" stroke="{INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>'
    elif mood == "sad":
        p += f'<path d="M-7 -72 Q0 -78 7 -72" stroke="{INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>'
    elif mood == "wow":
        p += f'<ellipse cx="0" cy="-74" rx="3.5" ry="4.5" fill="{INK}"/>'
    else:
        p += f'<path d="M-6 -75 L6 -75" stroke="{INK}" stroke-width="2.2" stroke-linecap="round"/>'
    if wave is not None:
        side = 1 if wave >= 0 else -1
        arm = f'<rect x="{side * 24 - 7}" y="-80" width="14" height="44" rx="7" fill="{shirt}" transform="rotate({side * 25} {side * 30} -40)"/>'
        arm += g(hand(sk, shirt), side * 46, -78, 0.75, side * 18)
        p += A("w", arm, -0.3 * (hair % 3))
    return A("bo", g(p, x, base, s * (0.8 if child else 1)), -0.4 * (skin % 4))


# ---------- objects ----------
def bubble(x, y, w, h, color="#fff", inner="", tail=-1):
    return A("f", _bubble(x, y, w, h, color, inner, tail), -x / 100)


def _bubble(x, y, w, h, color="#fff", inner="", tail=-1):
    t = f'<path d="M{w * 0.3 if tail < 0 else w * 0.6} {h - 2} l{-10 if tail < 0 else 10} 16 l14 -16 Z" fill="{color}"/>'
    return g(f'<rect width="{w}" height="{h}" rx="{min(h / 2, 16)}" fill="{color}"/>{t}{inner}', x, y)


def dots(w, h, c=INK):
    return "".join(f'<circle cx="{w / 2 + d}" cy="{h / 2}" r="3.5" fill="{c}"/>' for d in (-12, 0, 12))


def glyph(w, h, ch, c=INK, size=26):
    return f'<text x="{w / 2}" y="{h / 2 + size * 0.36}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="800" font-size="{size}" fill="{c}">{ch}</text>'


def heart(x, y, s=1, c="#ef4444"):
    return A("pu", g(f'<path d="M0 8 C-14 -4 -10 -16 0 -9 C10 -16 14 -4 0 8 Z" fill="{c}"/>', x, y, s))


def sun(x, y, r=26, c="#fbbf24"):
    rays = "".join(
        f'<rect x="-3" y="{-r - 16}" width="6" height="11" rx="3" fill="{c}" transform="rotate({a})"/>' for a in range(0, 360, 45)
    )
    return g(f'<g class="sp">{rays}<circle r="{r + 18}" fill="none"/></g><circle r="{r}" fill="{c}"/>', x, y)


def cloud(x, y, s=1, c="#fff"):
    return A("dr", g(f'<circle cx="-22" cy="4" r="16" fill="{c}"/><circle cx="0" cy="-6" r="22" fill="{c}"/><circle cx="24" cy="4" r="15" fill="{c}"/><rect x="-38" y="4" width="78" height="16" rx="8" fill="{c}"/>', x, y, s), -x / 60)


def drops(x, y, n=4, c="#60a5fa"):
    return "".join(A("fa", g(f'<path d="M0 -8 Q6 0 0 6 Q-6 0 0 -8 Z" fill="{c}"/>', x + i * 16, y + (i % 2) * 12), -0.33 * i) for i in range(n))


def snow(x, y, s=1, c="#fff"):
    return g(A("sp", _snow(0, 0, 1, c)), x, y, s)


def _snow(x, y, s=1, c="#fff"):
    l = "".join(f'<rect x="-1.5" y="-12" width="3" height="24" rx="1.5" fill="{c}" transform="rotate({a})"/>' for a in (0, 60, 120))
    return g(l, x, y, s)


def umbrella(x, y, s=1, c="#ef4444"):
    return A("rk", g(f'<path d="M-40 0 Q0 -50 40 0 Q30 -8 20 0 Q10 -8 0 0 Q-10 -8 -20 0 Q-30 -8 -40 0 Z" fill="{c}"/><rect x="-2" y="-2" width="4" height="44" fill="{INK}"/><path d="M2 42 q0 8 -8 8" stroke="{INK}" stroke-width="4" fill="none" stroke-linecap="round"/>', x, y, s))


def leaf(x, y, s=1, c="#f59e0b", r=0):
    return A("sw", g(f'<path d="M0 0 Q16 -22 0 -40 Q-16 -22 0 0 Z" fill="{c}"/><path d="M0 0 L0 -36" stroke="#00000033" stroke-width="2"/>', x, y, s, r))


def cup(x, y, s=1, c="#fff", coffee="#7c4a2d"):
    steam = "".join(f'<path class="st" style="animation-delay:{d / 10}s" d="M{d} -46 q6 -8 0 -16 q-6 -8 0 -16" stroke="#ffffffaa" stroke-width="4" fill="none" stroke-linecap="round"/>' for d in (-10, 6))
    return g(
        f'{steam}<path d="M-26 -32 L26 -32 L20 6 Q18 14 10 14 L-10 14 Q-18 14 -20 6 Z" fill="{c}"/>'
        f'<ellipse cx="0" cy="-32" rx="26" ry="6" fill="{coffee}"/>'
        f'<path d="M24 -22 q18 0 14 14 q-3 9 -16 8" stroke="{c}" stroke-width="7" fill="none"/>'
        f'<ellipse cx="0" cy="18" rx="38" ry="7" fill="#00000022"/>',
        x, y, s,
    )


def croissant(x, y, s=1):
    return g(
        '<path d="M-40 0 Q-30 -34 0 -36 Q30 -34 40 0 Q30 -12 20 -10 Q10 -22 0 -22 Q-10 -22 -20 -10 Q-30 -12 -40 0 Z" fill="#e7a33e"/>'
        '<path d="M-14 -30 Q-8 -18 -10 -8 M14 -30 Q8 -18 10 -8" stroke="#b8741f" stroke-width="3" fill="none"/>',
        x, y, s,
    )


def plate(x, y, s=1, food="#ef4444"):
    return g(
        f'<ellipse cx="0" cy="0" rx="48" ry="14" fill="#fff"/><ellipse cx="0" cy="-2" rx="34" ry="9" fill="#e5e7eb"/>'
        f'<circle cx="-10" cy="-8" r="10" fill="{food}"/><circle cx="8" cy="-10" r="9" fill="#22c55e"/><circle cx="16" cy="-4" r="6" fill="#fbbf24"/>'
        f'<rect x="56" y="-30" width="5" height="40" rx="2.5" fill="#cbd5e1"/><rect x="-62" y="-30" width="5" height="40" rx="2.5" fill="#cbd5e1"/>',
        x, y, s,
    )


def house(x, y, s=1, wall="#fef3c7", roof="#dc2626"):
    return g(
        f'<rect x="-50" y="-60" width="100" height="60" fill="{wall}"/><path d="M-62 -58 L0 -104 L62 -58 Z" fill="{roof}"/>'
        f'<rect x="-14" y="-36" width="28" height="36" rx="3" fill="#92400e"/><rect x="-42" y="-48" width="20" height="18" rx="2" fill="#93c5fd"/>'
        f'<rect x="22" y="-48" width="20" height="18" rx="2" fill="#93c5fd"/>',
        x, y, s,
    )


def tree(x, y, s=1, c="#16a34a"):
    return g(f'<rect x="-5" y="-30" width="10" height="30" fill="#7c4a2d"/><circle cx="0" cy="-52" r="28" fill="{c}"/><circle cx="-16" cy="-38" r="16" fill="{c}"/><circle cx="16" cy="-38" r="16" fill="{c}"/>', x, y, s)


def building(x, y, w, h, c="#64748b"):
    win = "".join(
        f'<rect x="{x + 8 + i * 16}" y="{y - h + 10 + j * 20}" width="9" height="11" fill="#fde68a" opacity="{0.95 if (i + j) % 3 else 0.4}"/>'
        for i in range(int((w - 8) // 16)) for j in range(int((h - 16) // 20))
    )
    return f'<rect x="{x}" y="{y - h}" width="{w}" height="{h}" fill="{c}"/>{win}'


def clock(x, y, r=40, c="#fff", rim=INK, hh=-60, mm=90):
    ticks = "".join(f'<rect x="-1.5" y="{-r + 6}" width="3" height="7" fill="{rim}" transform="rotate({a})"/>' for a in range(0, 360, 30))
    return g(
        f'<circle r="{r + 5}" fill="{rim}"/><circle r="{r}" fill="{c}"/>{ticks}'
        f'<rect x="-2.5" y="{-r * 0.5}" width="5" height="{r * 0.5}" rx="2.5" fill="{rim}" transform="rotate({hh})"/>'
        f'<rect class="hd" x="-2" y="{-r * 0.75}" width="4" height="{r * 0.75}" rx="2" fill="#ef4444"/><circle r="4" fill="{rim}"/>',
        x, y,
    )


def calendar(x, y, s=1, top="#ef4444", marks=(), checks=()):
    cells = ""
    for j in range(3):
        for i in range(5):
            k = j * 5 + i
            fill = "#fde68a" if k in marks else "#f1f5f9"
            cells += f'<rect x="{-46 + i * 19}" y="{-22 + j * 17}" width="15" height="13" rx="3" fill="{fill}"/>'
            if k in checks:
                cells += f'<path d="M{-43 + i * 19} {-15 + j * 17} l4 4 l7 -8" stroke="#16a34a" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
    return g(
        f'<rect x="-54" y="-50" width="108" height="86" rx="10" fill="#fff"/><rect x="-54" y="-50" width="108" height="22" rx="10" fill="{top}"/>'
        f'<rect x="-54" y="-36" width="108" height="8" fill="{top}"/><rect x="-32" y="-58" width="6" height="16" rx="3" fill="{INK}"/><rect x="26" y="-58" width="6" height="16" rx="3" fill="{INK}"/>{cells}',
        x, y, s,
    )


def coins(x, y, s=1):
    return A("f", _coins(x, y, s), -x / 90)


def _coins(x, y, s=1):
    st = "".join(f'<ellipse cx="0" cy="{-i * 8}" rx="22" ry="7" fill="#f59e0b"/><ellipse cx="0" cy="{-i * 8 - 2}" rx="22" ry="7" fill="#fbbf24"/>' for i in range(5))
    return g(st + f'<text x="0" y="-36" text-anchor="middle" font-family="Arial" font-weight="800" font-size="12" fill="#b45309">₽</text>', x, y, s)


def bag(x, y, s=1, c="#ec4899"):
    return g(
        f'<path d="M-18 -50 Q-18 -72 0 -72 Q18 -72 18 -50" stroke="{INK}" stroke-width="5" fill="none"/>'
        f'<path d="M-36 -54 L36 -54 L42 0 L-42 0 Z" fill="{c}"/><rect x="-36" y="-54" width="72" height="10" fill="#00000018"/>',
        x, y, s,
    )


def tag(x, y, s=1, c="#fff", r=-15):
    return A("sw", g(f'<path d="M0 0 L50 0 L66 16 L50 32 L0 32 Z" fill="{c}"/><circle cx="54" cy="16" r="4" fill="{INK}"/>' + glyph(46, 32, "%", "#ef4444", 20), x, y, s, r))


def face(x, y, r=24, mood="smile", c="#fbbf24"):
    return A("f", _face(x, y, r, mood, c), -x / 90)


def _face(x, y, r=24, mood="smile", c="#fbbf24"):
    m = {
        "smile": f'<path d="M-10 6 Q0 16 10 6" stroke="{INK}" stroke-width="3" fill="none" stroke-linecap="round"/>',
        "sad": f'<path d="M-10 12 Q0 2 10 12" stroke="{INK}" stroke-width="3" fill="none" stroke-linecap="round"/>',
        "wow": f'<ellipse cx="0" cy="9" rx="5" ry="7" fill="{INK}"/>',
        "angry": f'<path d="M-10 11 L10 11" stroke="{INK}" stroke-width="3" stroke-linecap="round"/><path d="M-13 -12 L-4 -7 M13 -12 L4 -7" stroke="{INK}" stroke-width="3" stroke-linecap="round"/>',
    }[mood]
    return g(f'<circle r="{r}" fill="{c}"/><circle cx="-8" cy="-4" r="3" fill="{INK}"/><circle cx="8" cy="-4" r="3" fill="{INK}"/>{m}', x, y)


def firstaid(x, y, s=1):
    return g(
        '<rect x="-40" y="-56" width="80" height="56" rx="8" fill="#fff"/><path d="M-12 -62 v-6 h24 v6" stroke="#fff" stroke-width="5" fill="none"/>'
        '<rect x="-7" y="-46" width="14" height="36" rx="2" fill="#ef4444"/><rect x="-18" y="-35" width="36" height="14" rx="2" fill="#ef4444"/>',
        x, y, s,
    )


def thermometer(x, y, s=1, r=20):
    return g('<rect x="-7" y="-70" width="14" height="70" rx="7" fill="#fff"/><circle cx="0" cy="0" r="12" fill="#ef4444"/><rect x="-3" y="-40" width="6" height="40" fill="#ef4444"/>', x, y, s, r)


def pill(x, y, s=1, r=30):
    return A("f", g('<rect x="-22" y="-9" width="44" height="18" rx="9" fill="#fff"/><path d="M0 -9 h13 a9 9 0 0 1 0 18 h-13 Z" fill="#3b82f6"/>', x, y, s, r), -x / 80)


def book(x, y, s=1, c="#3b82f6"):
    lines = "".join(f'<rect x="{sx}" y="{-34 + i * 9}" width="30" height="3" rx="1.5" fill="#cbd5e1"/>' for sx in (-40, 8) for i in range(4))
    return g(
        f'<path d="M-50 -44 Q-25 -54 0 -44 L0 6 Q-25 -4 -50 6 Z" fill="#fff"/><path d="M50 -44 Q25 -54 0 -44 L0 6 Q25 -4 50 6 Z" fill="#f8fafc"/>'
        f'<path d="M-54 -40 L-54 10 Q-27 0 0 10 Q27 0 54 10 L54 -40" stroke="{c}" stroke-width="5" fill="none"/>{lines}',
        x, y, s,
    )


def pencil(x, y, s=1, r=-35):
    return A("rk", g('<rect x="-6" y="-60" width="12" height="52" fill="#fbbf24"/><rect x="-6" y="-66" width="12" height="8" fill="#f472b6"/><path d="M-6 -8 L6 -8 L0 8 Z" fill="#fde7c6"/><path d="M-2 2 L2 2 L0 8 Z" fill="' + INK + '"/>', x, y, s, r))


def board(x, y, s=1, txt="А Б В"):
    return g(f'<rect x="-70" y="-60" width="140" height="80" rx="6" fill="#7c4a2d"/><rect x="-64" y="-54" width="128" height="68" rx="4" fill="#1f5135"/>'
             f'<text x="0" y="-12" text-anchor="middle" font-family="Arial" font-weight="700" font-size="24" fill="#fff" opacity=".9">{txt}</text>', x, y, s)


def cat(x, y, s=1, c="#f59e0b"):
    return A("bo", _cat(x, y, s, c))


def _cat(x, y, s=1, c="#f59e0b"):
    return g(
        f'<ellipse cx="0" cy="-22" rx="34" ry="24" fill="{c}"/><circle cx="-22" cy="-52" r="20" fill="{c}"/>'
        f'<path d="M-38 -62 L-36 -84 L-24 -70 Z M-6 -62 L-8 -84 L-20 -70 Z" fill="{c}"/>'
        f'<circle cx="-29" cy="-54" r="2.6" fill="{INK}"/><circle cx="-15" cy="-54" r="2.6" fill="{INK}"/><path d="M-25 -46 q3 3 6 0" stroke="{INK}" stroke-width="2" fill="none"/>'
        f'<path d="M30 -20 Q56 -30 48 -60" stroke="{c}" stroke-width="9" fill="none" stroke-linecap="round"/>',
        x, y, s,
    )


def dog(x, y, s=1, c="#a16207"):
    return A("bo", _dog(x, y, s, c), -0.7)


def _dog(x, y, s=1, c="#a16207"):
    return g(
        f'<ellipse cx="0" cy="-22" rx="36" ry="22" fill="{c}"/><circle cx="30" cy="-50" r="20" fill="{c}"/>'
        f'<ellipse cx="18" cy="-46" rx="8" ry="16" fill="#713f12" transform="rotate(20 18 -46)"/><ellipse cx="46" cy="-44" rx="7" ry="5" fill="{INK}"/>'
        f'<circle cx="34" cy="-56" r="2.6" fill="{INK}"/><rect x="-30" y="-6" width="10" height="16" rx="4" fill="{c}"/><rect x="16" y="-6" width="10" height="16" rx="4" fill="{c}"/>'
        f'<path d="M-34 -30 Q-50 -44 -44 -56" stroke="{c}" stroke-width="8" fill="none" stroke-linecap="round"/>',
        x, y, s,
    )


def palette(x, y, s=1):
    blobs = "".join(f'<circle cx="{cx}" cy="{cy}" r="8" fill="{c}"/>' for cx, cy, c in [(-24, -10, "#ef4444"), (-8, -22, "#fbbf24"), (12, -22, "#22c55e"), (26, -8, "#3b82f6"), (-20, 10, "#a855f7")])
    return g(f'<path d="M0 -36 C30 -36 46 -16 42 4 C38 20 20 12 14 22 C8 32 -4 34 -18 30 C-40 24 -46 0 -36 -18 C-28 -30 -16 -36 0 -36 Z" fill="#fde7c6"/><circle cx="12" cy="8" r="7" fill="#00000022"/>{blobs}', x, y, s)


def plane(x, y, s=1, c="#fff", r=-12):
    return A("fl", g(f'<path d="M-50 0 Q-50 -10 -36 -10 L40 -10 Q56 -8 60 0 Q56 8 40 10 L-36 10 Q-50 10 -50 0 Z" fill="{c}"/>'
             f'<path d="M0 -8 L-18 -40 L-6 -40 L22 -8 Z M0 8 L-18 40 L-6 40 L22 8 Z M-40 -8 L-50 -26 L-42 -26 L-28 -8 Z" fill="#93c5fd"/>'
             + "".join(f'<circle cx="{i}" cy="-1" r="3" fill="#60a5fa"/>' for i in range(-20, 40, 12)), x, y, s, r))


def suitcase(x, y, s=1, c="#f97316"):
    return g(f'<rect x="-14" y="-82" width="28" height="16" rx="6" stroke="{INK}" stroke-width="5" fill="none"/><rect x="-34" y="-70" width="68" height="70" rx="10" fill="{c}"/>'
             f'<rect x="-16" y="-70" width="6" height="70" fill="#00000022"/><rect x="10" y="-70" width="6" height="70" fill="#00000022"/>', x, y, s)


def pin(x, y, s=1, c="#ef4444"):
    return A("f", g(f'<path d="M0 0 C-30 -34 -26 -64 0 -64 C26 -64 30 -34 0 0 Z" fill="{c}"/><circle cx="0" cy="-42" r="10" fill="#fff"/>', x, y, s))


def bus(x, y, s=1, c="#facc15"):
    return A("dv", _bus(x, y, s, c))


def _bus(x, y, s=1, c="#facc15"):
    win = "".join(f'<rect x="{-60 + i * 26}" y="-58" width="20" height="18" rx="3" fill="#bfdbfe"/>' for i in range(5))
    return g(f'<rect x="-66" y="-66" width="136" height="58" rx="12" fill="{c}"/>{win}<circle cx="-36" cy="-6" r="11" fill="{INK}"/><circle cx="40" cy="-6" r="11" fill="{INK}"/><circle cx="-36" cy="-6" r="4" fill="#cbd5e1"/><circle cx="40" cy="-6" r="4" fill="#cbd5e1"/>', x, y, s)


def car(x, y, s=1, c="#ef4444"):
    return A("dv", _car(x, y, s, c))


def _car(x, y, s=1, c="#ef4444"):
    return g(f'<path d="M-50 -14 L-40 -34 Q-36 -42 -26 -42 L22 -42 Q32 -42 38 -32 L50 -14 Z" fill="{c}"/><rect x="-60" y="-16" width="120" height="22" rx="8" fill="{c}"/>'
             f'<path d="M-32 -18 L-26 -36 L-4 -36 L-4 -18 Z M4 -18 L4 -36 L22 -36 L32 -18 Z" fill="#bfdbfe"/><circle cx="-32" cy="8" r="11" fill="{INK}"/><circle cx="34" cy="8" r="11" fill="{INK}"/>', x, y, s)


def laptop(x, y, s=1):
    return g('<rect x="-50" y="-66" width="100" height="62" rx="6" fill="#334155"/><rect x="-44" y="-60" width="88" height="50" rx="3" fill="#93c5fd"/>'
             '<rect x="-36" y="-50" width="40" height="5" rx="2.5" fill="#fff"/><rect x="-36" y="-40" width="60" height="5" rx="2.5" fill="#fff" opacity=".7"/><rect x="-36" y="-30" width="30" height="5" rx="2.5" fill="#fff" opacity=".7"/>'
             '<path d="M-62 -4 L62 -4 L56 6 L-56 6 Z" fill="#94a3b8"/>', x, y, s)


def briefcase(x, y, s=1, c="#7c4a2d"):
    return g(f'<rect x="-14" y="-62" width="28" height="14" rx="5" stroke="{INK}" stroke-width="5" fill="none"/><rect x="-42" y="-52" width="84" height="52" rx="8" fill="{c}"/><rect x="-42" y="-34" width="84" height="5" fill="#00000030"/><rect x="-7" y="-38" width="14" height="10" rx="2" fill="#fbbf24"/>', x, y, s)


def mountain(x, y, s=1, c="#475569"):
    return g(f'<path d="M-90 0 L-20 -100 L50 0 Z" fill="{c}"/><path d="M-36 -78 L-20 -100 L-4 -78 L-12 -72 L-20 -80 L-28 -72 Z" fill="#fff"/><path d="M0 0 L50 -66 L100 0 Z" fill="{c}" opacity=".75"/>', x, y, s)


def flower(x, y, s=1, c="#f472b6"):
    return A("rk", _flower(x, y, s, c), -x / 70)


def _flower(x, y, s=1, c="#f472b6"):
    pet = "".join(f'<ellipse cx="0" cy="-12" rx="7" ry="11" fill="{c}" transform="rotate({a})"/>' for a in range(0, 360, 60))
    return g(f'<rect x="-2" y="0" width="4" height="40" fill="#16a34a"/>' + g(pet + '<circle r="7" fill="#fbbf24"/>'), x, y - 40 * s, s)


def bulb(x, y, s=1):
    return A("pu", _bulb(x, y, s))


def _bulb(x, y, s=1):
    rays = "".join(f'<rect x="-2.5" y="-74" width="5" height="12" rx="2.5" fill="#fde047" transform="rotate({a} 0 -32)"/>' for a in (-60, -30, 0, 30, 60))
    return g(f'{rays}<circle cx="0" cy="-32" r="28" fill="#fde047"/><rect x="-14" y="-8" width="28" height="10" rx="3" fill="#94a3b8"/><rect x="-11" y="4" width="22" height="8" rx="3" fill="#64748b"/>'
             '<path d="M-8 -26 q8 -10 16 0" stroke="#ca8a04" stroke-width="3" fill="none"/>', x, y, s)


def globe(x, y, r=34):
    return A("f", _globe(x, y, r))


def _globe(x, y, r=34):
    return g(f'<circle r="{r}" fill="#38bdf8"/><path d="M-20 -22 Q-6 -30 4 -18 Q0 -6 -12 -4 Q-24 0 -20 -22 Z M8 6 Q24 0 26 14 Q18 28 6 22 Q0 14 8 6 Z" fill="#22c55e"/>', x, y)


def arrow_path(d, c="#fff"):
    return f'<path d="{d}" stroke="{c}" stroke-width="4" stroke-dasharray="8 8" fill="none" stroke-linecap="round"/>'


def blocks(x, y, labels, colors):
    out = ""
    for i, (t, c) in enumerate(zip(labels, colors)):
        out += g(f'<rect x="-22" y="-44" width="44" height="44" rx="8" fill="{c}"/><rect x="-22" y="-8" width="44" height="8" rx="4" fill="#00000022"/>' + glyph(0, -44, t, "#fff", 26).replace(f'x="0"', 'x="0" ').replace('y="-', 'y="-'), x + i * 52, y - (i % 2) * 6)
    return out


def num_block(x, y, t, c, r=0):
    return A("f", _num_block(x, y, t, c, r), -x / 70)


def _num_block(x, y, t, c, r=0):
    return g(f'<rect x="-24" y="-48" width="48" height="48" rx="9" fill="{c}"/><rect x="-24" y="-8" width="48" height="8" rx="4" fill="#00000022"/>'
             f'<text x="0" y="-14" text-anchor="middle" font-family="Arial" font-weight="800" font-size="28" fill="#fff">{t}</text>', x, y, 1, r)


def bed(x, y, s=1):
    return g('<rect x="-70" y="-30" width="140" height="26" rx="6" fill="#60a5fa"/><rect x="-74" y="-62" width="12" height="66" rx="5" fill="#7c4a2d"/><rect x="62" y="-40" width="12" height="44" rx="5" fill="#7c4a2d"/>'
             '<rect x="-60" y="-46" width="40" height="18" rx="9" fill="#fff"/><path d="M-20 -30 Q20 -46 60 -30 Z" fill="#3b82f6"/>', x, y, s)


def shapes(x, y):
    return (g('<rect x="-40" y="-80" width="80" height="80" rx="10" fill="#fff"/>', x, y)
            + g('<circle r="18" fill="#fde68a"/>', x + 80, y - 18)
            + g('<path d="M0 -40 L24 0 L-24 0 Z" fill="#fca5a5"/>', x + 130, y))


def mirror_frame(x, y):
    return g('<ellipse cx="0" cy="-50" rx="36" ry="48" fill="#e2e8f0"/><ellipse cx="0" cy="-50" rx="28" ry="40" fill="#bae6fd"/><path d="M-12 -70 l20 -16 M-6 -56 l14 -11" stroke="#fff" stroke-width="4" stroke-linecap="round"/><rect x="-4" y="-2" width="8" height="10" fill="#94a3b8"/>', x, y)


def store(x, y):
    aw = "".join(f'<path d="M{-80 + i * 32} -90 h32 v14 a16 16 0 0 1 -32 0 Z" fill="{"#ef4444" if i % 2 else "#fff"}"/>' for i in range(5))
    return g(f'<rect x="-76" y="-90" width="152" height="90" fill="#fde68a"/>{aw}<rect x="-60" y="-56" width="50" height="40" rx="3" fill="#bfdbfe"/><rect x="14" y="-56" width="40" height="56" rx="3" fill="#92400e"/>', x, y)


def table(x, y, w=180, c="#7c4a2d"):
    return f'<rect x="{x - w / 2}" y="{y}" width="{w}" height="10" rx="5" fill="{c}"/><rect x="{x - w / 2 + 14}" y="{y + 10}" width="8" height="40" fill="{c}"/><rect x="{x + w / 2 - 22}" y="{y + 10}" width="8" height="40" fill="{c}"/>'


def scales(x, y, tilt=-10):
    return A("rk", _scales(x, y, 0))


def _scales(x, y, tilt=-10):
    return g(f'<rect x="-3" y="-90" width="6" height="90" fill="{INK}"/><rect x="-30" y="-4" width="60" height="8" rx="4" fill="{INK}"/>'
             + g(f'<rect x="-70" y="-3" width="140" height="6" rx="3" fill="{INK}"/><path d="M-70 0 l-16 30 h32 Z M70 0 l-16 30 h32 Z" fill="#fbbf24"/>', 0, -88, 1, tilt), x, y)


def speedo(x, y, level):
    a = -90 + 180 * level
    return g(f'<path d="M-60 0 A60 60 0 0 1 60 0" stroke="#fff" stroke-width="16" fill="none"/><path d="M-60 0 A60 60 0 0 1 -30 -52" stroke="#22c55e" stroke-width="16" fill="none"/>'
             f'<path d="M30 -52 A60 60 0 0 1 60 0" stroke="#ef4444" stroke-width="16" fill="none"/><path d="M-30 -52 A60 60 0 0 1 30 -52" stroke="#fbbf24" stroke-width="16" fill="none"/>'
             f'<rect class="nd" x="-3" y="-52" width="6" height="52" rx="3" fill="{INK}"/><circle r="8" fill="{INK}"/>', x, y)


# ---------- scenes ----------
S = {}
S["greet"] = svg("#2f6bff", bubble(150, 26, 100, 42, "#fff", glyph(100, 42, "Привет!", INK, 17)) +
                 person(120, 200, 1, "#f97316", 0, 0, wave=-1) + person(290, 200, 1, "#10b981", 1, 2, wave=1, long_hair=True), "#7aa2ff")
S["family"] = svg("#00798c", house(320, 196, 0.9) + person(90, 200, 1, "#3b82f6", 0, 1) + person(170, 200, 1, "#f472b6", 2, 0, long_hair=True) +
                  person(130, 200, 0.7, "#fbbf24", 3, 1, child=True) + heart(130, 40, 1.6), "#4fb3c2")
S["numbers"] = svg("#e07a3f", num_block(80, 196, "1", "#2f6bff", -6) + num_block(140, 196, "2", "#10b981") + num_block(200, 196, "3", "#a855f7", 5) +
                   num_block(110, 148, "4", "#ef4444", 4) + num_block(170, 148, "5", "#0ea5e9", -4) +
                   g(hand(SKIN[0], "#1f2333"), 310, 210, 1.6, 0), "#f4a776")
S["time"] = svg("#30638e", clock(130, 112, 56, hh=-50, mm=60) + calendar(290, 128, 1, marks=(3, 7), checks=(0, 1, 2)), "#5d8fc0")
S["money"] = svg("#3f7d20", bag(120, 196, 1.3) + coins(240, 196, 1.2) + coins(286, 196, 0.9) + tag(290, 60, 1, "#fff", 12), "#77ae55")
S["day"] = svg("#8e5572", bed(110, 190, 0.9) + sun(300, 140, 34) + clock(300, 60, 26, hh=-120, mm=0) +
               '<rect x="0" y="150" width="400" height="0"/>', "#b98aa0")
S["cafe"] = svg("#c98a0b", table(200, 160, 260) + cup(150, 156, 1.2) + croissant(270, 156, 1) + g('<rect x="-30" y="-70" width="60" height="70" rx="6" fill="#fff"/>' +
                "".join(f'<rect x="-20" y="{-58 + i * 14}" width="40" height="5" rx="2.5" fill="#e5e7eb"/>' for i in range(4)), 340, 100, 0.7, 8), "#ecc260")
S["feelings"] = svg("#2a9d8f", face(90, 120, 34, "smile") + face(190, 90, 30, "sad", "#93c5fd") + face(290, 128, 32, "wow", "#fca5a5") + heart(200, 180, 2.2) + heart(340, 50, 1.2, "#fbbf24"), "#6cc4b8")
S["health"] = svg("#5c6bc0", firstaid(140, 190, 1.4) + thermometer(270, 180, 1.1, 25) + pill(330, 90) + pill(250, 60, 0.8, -20) + heart(70, 60, 1.6), "#8e9ae0")
S["study"] = svg("#b5651d", board(130, 120, 1.1) + book(290, 186, 1.1, "#ef4444") + pencil(350, 120) , "#d9955a")
S["animals"] = svg("#a23b72", cat(130, 196, 1.3) + dog(270, 196, 1.2) + palette(330, 60, 0.9), "#cf6fa3")
S["weather"] = svg("#4e8b6f", sun(110, 80, 36) + cloud(170, 110, 1.2) + drops(150, 150, 4) + umbrella(300, 140, 1.1) + snow(350, 50, 1) + leaf(60, 190, 1, "#f59e0b", -20), "#86bfa4")
S["people"] = svg("#d1495b", person(80, 200, 0.9, "#3b82f6", 0, 1) + person(160, 200, 1, "#fbbf24", 2, 0, long_hair=True) + person(240, 200, 0.95, "#10b981", 1, 2) +
                  person(320, 200, 0.85, "#a855f7", 3, 3, long_hair=True) + bubble(260, 30, 70, 36, "#fff", dots(70, 36)), "#e8848f")
S["looks"] = svg("#00798c", mirror_frame(120, 190) + person(250, 200, 1.05, "#f472b6", 2, 3, long_hair=True) + g('<rect x="-26" y="-6" width="20" height="12" rx="6" fill="none" stroke="#1f2333" stroke-width="3"/><rect x="6" y="-6" width="20" height="12" rx="6" fill="none" stroke="#1f2333" stroke-width="3"/><path d="M-6 0 h12" stroke="#1f2333" stroke-width="3"/>', 250, 110, 1.05), "#4fb3c2")
S["city"] = svg("#3d405b", building(30, 200, 70, 140, "#64748b") + building(110, 200, 60, 100, "#475569") + building(180, 200, 80, 160, "#334155") + building(270, 200, 60, 110, "#64748b") +
                bus(330, 206, 0.7) + pin(220, 60, 0.8), "#6d7099")
S["travel"] = svg("#0ea5b7", plane(140, 70, 1.2) + suitcase(260, 200, 1.1) + suitcase(330, 200, 0.8, "#2f6bff") + cloud(60, 160, 0.8) + cloud(300, 50, 0.6), "#68d1dc")
S["often"] = svg("#e07a3f", calendar(140, 126, 1.3, marks=(2, 9), checks=(0, 2, 4, 5, 7, 9, 10)) + A("rv", g('<path d="M-30 0 A30 30 0 1 1 0 30" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M-6 18 L0 30 L-14 36" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>', 310, 110, 1.2)), "#f4a776")
S["week"] = svg("#30638e", "".join(num_block(56 + i * 48, 170 - (i % 2) * 14, d, c) for i, (d, c) in enumerate(zip(["П", "В", "С", "Ч", "П", "С", "В"], ["#ef4444", "#f97316", "#fbbf24", "#22c55e", "#0ea5e9", "#a855f7", "#ec4899"]))) + sun(330, 50, 22), "#5d8fc0")
S["shop"] = svg("#3f7d20", store(130, 200) + bag(290, 200, 1) + tag(320, 70, 0.9, "#fff", -12), "#77ae55")
S["restaurant"] = svg("#8e5572", table(200, 160, 280, "#fff") + plate(150, 150, 1) + g('<rect x="-4" y="-80" width="8" height="70" rx="3" fill="#7f1d1d"/><path d="M-8 -80 h16 l-2 -24 h-12 Z" fill="#7f1d1d"/>', 300, 160) +
                      g('<circle r="12" fill="#fde68a"/><rect x="-3" y="10" width="6" height="30" fill="#fff"/>', 340, 120), "#b98aa0")
S["opinions"] = svg("#c98a0b", person(110, 200, 1, "#2f6bff", 0, 1, mood="wow") + person(290, 200, 1, "#ef4444", 2, 0, long_hair=True, mood="flat") +
                    bubble(40, 24, 64, 44, "#fff", glyph(64, 44, "?", "#2f6bff", 30)) + bubble(296, 24, 64, 44, "#fff", glyph(64, 44, "!", "#ef4444", 30), 1) + heart(200, 60, 1.4), "#ecc260")
S["work"] = svg("#2a9d8f", table(190, 160, 240, "#fff") + laptop(170, 158, 1) + briefcase(320, 200, 1) + cup(260, 156, 0.6) + book(70, 230, 0.7), "#6cc4b8")
S["nature"] = svg("#4e8b6f", mountain(250, 200, 1.1) + tree(70, 200, 1.1) + tree(130, 200, 0.8, "#15803d") + sun(330, 50, 22) + flower(190, 200, 1) + flower(215, 200, 0.8, "#fbbf24") + dog(350, 214, 0.55), "#86bfa4")
S["talk"] = svg("#5c6bc0", person(110, 200, 1, "#f97316", 1, 0, wave=1) + person(290, 200, 1, "#14b8a6", 0, 2, long_hair=True) +
                bubble(150, 20, 100, 42, "#fff", glyph(100, 42, "Спасибо", INK, 15)) + heart(200, 110, 1.4), "#8e9ae0")
S["space"] = svg("#3d405b", person(200, 210, 1, "#fbbf24", 0, 1, wave=1) + house(70, 170, 0.6) + tree(340, 180, 0.8) + arrow_path("M200 70 Q120 30 80 70") + arrow_path("M220 70 Q300 30 340 80") +
                 '<circle cx="80" cy="70" r="6" fill="#fff"/><circle cx="340" cy="80" r="6" fill="#fff"/>', "#6d7099")
S["classifiers"] = svg("#e07a3f", car(170, 160, 1.1) + arrow_path("M60 200 Q170 210 300 170 Q360 150 370 110") + g(hand(SKIN[1], "#1f2333"), 320, 120, 1, 70), "#f4a776")
S["reported"] = svg("#a23b72", person(80, 200, 0.85, "#3b82f6", 0, 1) + person(200, 200, 0.95, "#fbbf24", 2, 0, long_hair=True) + person(320, 200, 0.85, "#10b981", 1, 2) +
                    bubble(30, 30, 60, 36, "#fff", dots(60, 36)) + arrow_path("M100 50 Q200 0 300 50") + bubble(290, 34, 60, 36, "#fde68a", dots(60, 36), 1), "#cf6fa3")
S["past"] = svg("#30638e", clock(120, 110, 52, hh=-140, mm=-100) + g('<path d="M-40 0 A40 40 0 1 0 0 -40" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M-14 -50 L0 -40 L-12 -26" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>', 120, 110, 1.6) +
                book(300, 186, 1, "#fbbf24") + "".join(f'<circle cx="{280 + i * 22}" cy="80" r="{4 + i}" fill="#fff" opacity="{0.4 + i * 0.2}"/>' for i in range(3)), "#5d8fc0")
S["cause"] = svg("#d1495b", cloud(90, 80, 1.1) + drops(70, 120, 3) + g('<path d="M0 0 h50 M36 -14 L50 0 L36 14" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>', 170, 110) +
                 umbrella(300, 110, 1) + person(300, 214, 0.6, "#fbbf24", 0, 1), "#e8848f")
S["debate"] = svg("#3f7d20", scales(200, 200, -10) + bubble(40, 40, 70, 40, "#fff", glyph(70, 40, "?", "#2f6bff", 28)) + bubble(290, 30, 70, 40, "#fff", glyph(70, 40, "!", "#ef4444", 28), 1), "#77ae55")
S["degree"] = svg("#c98a0b", speedo(200, 170, 0.8) + "".join(g(f'<rect x="-10" y="{-h}" width="20" height="{h}" rx="5" fill="#fff" opacity="{0.5 + i * 0.12}"/>', 40 + i * 24, 210) for i, h in enumerate([20, 36, 52, 70])) +
                  "".join(g(f'<rect x="-10" y="{-h}" width="20" height="{h}" rx="5" fill="#fff" opacity="{0.5 + i * 0.12}"/>', 296 + i * 24, 210) for i, h in enumerate([70, 52, 36, 20]))[::-1][::-1], "#ecc260")
S["story"] = svg("#8e5572", book(200, 196, 1.6, "#fbbf24") + "".join(A("tw", g('<path d="M0 -12 L3 -3 L12 -3 L5 3 L8 12 L0 6 L-8 12 L-5 3 L-12 -3 L-3 -3 Z" fill="#fde68a"/>', x, y, s), -x / 100) for x, y, s in [(120, 60, 1.2), (200, 36, 1.6), (290, 64, 1), (340, 120, 0.8), (70, 130, 0.8)]) +
                cloud(200, 110, 0.6), "#b98aa0")
S["actions"] = svg("#2a9d8f", g(
    '<circle cx="0" cy="-118" r="16" fill="' + SKIN[0] + '"/><path d="M-4 -100 L6 -60" stroke="#ef4444" stroke-width="18" stroke-linecap="round"/>'
    '<path d="M2 -92 L28 -76 L44 -92 M0 -90 L-24 -78 L-36 -60" stroke="#ef4444" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
    '<path d="M6 -60 L30 -34 L22 -4 M6 -60 L-14 -30 L-42 -26" stroke="#1f2333" stroke-width="11" fill="none" stroke-linecap="round" stroke-linejoin="round"/>', 140, 200, 1.2) +
    "".join(f'<rect x="{30 + i * 6}" y="{90 + i * 20}" width="{40 - i * 8}" height="5" rx="2.5" fill="#fff" opacity=".6"/>' for i in range(3)) + suitcase(290, 200, 0.7, "#fbbf24") + bag(350, 200, 0.6), "#6cc4b8")
S["ideas"] = svg("#3d405b", bulb(140, 180, 1.4) + globe(290, 90, 38) + book(300, 210, 0.7, "#22c55e") + pencil(360, 170, 0.8, 20), "#6d7099")
S["describe"] = svg("#b5651d", shapes(80, 190) + g('<rect x="-50" y="-6" width="100" height="12" rx="6" fill="#fff"/><path d="M-50 0 l12 -12 M-50 0 l12 12 M50 0 l-12 -12 M50 0 l-12 12" stroke="#fff" stroke-width="6" stroke-linecap="round"/>', 210, 60) + palette(320, 120, 0.9), "#d9955a")

OUT.mkdir(parents=True, exist_ok=True)
for k, v in S.items():
    (OUT / f"{k}.svg").write_text(v, encoding="utf-8")
print(len(S), "illustrations ->", OUT)

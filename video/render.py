# Pub PronoRadar (9:16, 1080x1920, 30 i/s) : vraies captures de l'app dans un téléphone en verre incliné,
# sur fond noir et vert avec grille fine, typographie animée calée sur la musique (112 BPM), logo en final.
# Usage : python3 render.py <dossier_travail> <sortie.mp4> [format: 916|11|169]
# Le dossier de travail contient seg/<plan>/*.jpg (extraits des enregistrements), fonts/, music.wav.
import math
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

WORK = Path(sys.argv[1])
OUT = sys.argv[2]
FPS = 30
W, H = 1080, 1920
BAR = 4 * 60 / 112
DUR = 25.0

INK = (238, 243, 240)  # blanc cassé (jamais de blanc pur)
GREEN = (74, 222, 128)
DEEP = (22, 163, 74)
BG = (6, 10, 8)

BEBAS = str(WORK / "fonts" / "Bebas_Neue_Regular.ttf")
INTER = "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"
font = lambda size: ImageFont.truetype(BEBAS, size)
sans = lambda size: ImageFont.truetype(INTER, size)


def ease_out(x):
    x = min(max(x, 0), 1)
    return 1 - (1 - x) ** 3


def ease_in_out(x):
    x = min(max(x, 0), 1)
    return 3 * x * x - 2 * x * x * x


# ---------------------------------------------------------------- plans
# (début, fin, plan, mouvement d'entrée). Coupes sur les mesures de la musique.
SHOTS = [
    (0 * BAR, 1 * BAR, "a_landing", "rise"),
    (1 * BAR, 2 * BAR, "b_matchs", "swing"),
    (2 * BAR, 4 * BAR, "c_coupons", "push"),
    (4 * BAR, 4 * BAR + 1.3, "d_analyse", "whip"),
    (4 * BAR + 1.3, 4 * BAR + 2.7, "e_probas", "cut"),
    (4 * BAR + 2.7, 6 * BAR, "f_compos", "zoom"),
    (6 * BAR, 7 * BAR, "g_paris", "flip"),
    (7 * BAR, 8 * BAR, "h_select", "slide"),
    (8 * BAR, 9 * BAR, "i_bilan", "dolly"),
]
END = 9 * BAR  # carton final

# Textes : (début, fin, lignes). *mot* = mot en vert.
TEXTS = [
    (0.15, 1 * BAR - 0.05, ["*64* MATCHS", "AUJOURD'HUI."]),
    (1 * BAR + 0.05, 2 * BAR - 0.05, ["TU N'AS PAS LE TEMPS", "DE TOUT *ANALYSER*."]),
    (2 * BAR + 0.05, 3 * BAR - 0.05, ["CHAQUE MATIN,", "L'IA PRÉPARE", "TES *COUPONS*."]),
    (3 * BAR + 0.05, 4 * BAR - 0.05, ["DU PLUS *SÛR*…", "À LA *GROSSE* *COTE*."]),
    (4 * BAR + 0.05, 5 * BAR - 0.05, ["CHAQUE MATCH", "*ANALYSÉ*."]),
    (5 * BAR + 0.05, 6 * BAR - 0.05, ["COTES · FORME", "· *COMPOS*."]),
    (6 * BAR + 0.05, 7 * BAR - 0.05, ["PAS QUE DES", "*VICTOIRES*."]),
    (7 * BAR + 0.05, 8 * BAR - 0.05, ["OU ANALYSE", "*TES* MATCHS."]),
    (8 * BAR + 0.05, 9 * BAR - 0.1, ["TOUT EST PUBLIÉ.", "*GAGNÉ* OU PERDU."]),
]

frames_cache: dict[str, list[Path]] = {}


def shot_frame(name, local, length):
    files = frames_cache.setdefault(name, sorted((WORK / "seg" / name).glob("*.jpg")))
    i = min(int(local / length * len(files)), len(files) - 1)
    img = Image.open(files[i]).convert("RGB")
    # Barre d'état du téléphone (heure, pastille d'enregistrement) masquée sous un bandeau sombre.
    ImageDraw.Draw(img).rectangle([0, 0, img.width, 50], fill=(8, 10, 9))
    return img


# ---------------------------------------------------------------- fond
def make_background():
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    base = np.zeros((H, W, 3), np.float32) + np.array(BG, np.float32)
    # Halo vert bas-gauche et lueur plus froide en haut à droite (dégradé doux, réf. 02).
    for cx, cy, r, col, a in ((180, 1500, 900, DEEP, 0.55), (980, 260, 700, (20, 120, 90), 0.35)):
        d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / r
        base += np.array(col, np.float32)[None, None] * (np.clip(1 - d, 0, 1) ** 2 * a)[..., None]
    img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8))
    # Grille fine (réf. 01), plus visible au centre.
    grid = Image.new("L", (W, H), 0)
    g = ImageDraw.Draw(grid)
    for x in range(0, W, 54):
        g.line([(x, 0), (x, H)], fill=26)
    for y in range(0, H, 54):
        g.line([(0, y), (W, y)], fill=26)
    vign = np.clip(1 - np.sqrt(((xx - W / 2) / (W * 0.75)) ** 2 + ((yy - H * 0.55) / (H * 0.6)) ** 2), 0, 1)
    grid = Image.fromarray((np.array(grid, np.float32) * vign).astype(np.uint8))
    img.paste(Image.new("RGB", (W, H), (120, 200, 150)), (0, 0), grid)
    return img


BACKGROUND = make_background()


def blob_layer(t):
    # Deux taches floues qui dérivent lentement : le fond respire.
    layer = Image.new("RGB", (W // 4, H // 4), (0, 0, 0))
    d = ImageDraw.Draw(layer)
    for i, (r, col) in enumerate(((70, (22, 163, 74)), (55, (16, 110, 80)))):
        cx = W / 8 + math.sin(t * 0.35 + i * 2.1) * 70 + i * 60
        cy = H / 8 * (1.2 + i * 0.9) + math.cos(t * 0.27 + i) * 60
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
    return layer.filter(ImageFilter.GaussianBlur(28)).resize((W, H), Image.BILINEAR)


# ---------------------------------------------------------------- téléphone en verre
SCR_W, SCR_H = 560, 1212
BEZ = 16
PH_W, PH_H = SCR_W + 2 * BEZ, SCR_H + 2 * BEZ
R = 74


def rounded_mask(w, h, r):
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], r, fill=255)
    return m


PHONE_MASK = rounded_mask(PH_W, PH_H, R)
SCREEN_MASK = rounded_mask(SCR_W, SCR_H, R - BEZ)


def phone_image(screen, sweep):
    ph = Image.new("RGBA", (PH_W, PH_H), (0, 0, 0, 0))
    body = Image.new("RGBA", (PH_W, PH_H), (24, 30, 27, 255))
    ph.paste(body, (0, 0), PHONE_MASK)
    ph.paste(screen, (BEZ, BEZ), SCREEN_MASK)
    d = ImageDraw.Draw(ph)
    # Bord en verre : liseré clair + reflet vert discret.
    d.rounded_rectangle([1, 1, PH_W - 2, PH_H - 2], R, outline=(150, 190, 165, 150), width=3)
    d.rounded_rectangle([BEZ - 2, BEZ - 2, PH_W - BEZ + 1, PH_H - BEZ + 1], R - BEZ + 2, outline=(0, 0, 0, 200), width=3)
    # Reflet qui balaie la vitre en diagonale (réf. 01).
    if 0 <= sweep <= 1:
        band = Image.new("L", (PH_W, PH_H), 0)
        bd = ImageDraw.Draw(band)
        x = -PH_W * 0.6 + sweep * PH_W * 2.0
        bd.polygon([(x, 0), (x + 170, 0), (x + 170 - PH_H * 0.45, PH_H), (x - PH_H * 0.45, PH_H)], fill=60)
        band = band.filter(ImageFilter.GaussianBlur(18))
        band = Image.fromarray((np.array(band) * (np.array(PHONE_MASK) / 255)).astype(np.uint8))
        ph.alpha_composite(Image.merge("RGBA", (*[Image.new("L", (PH_W, PH_H), 235)] * 3, band)))
    return ph


def perspective_coeffs(src, dst):
    # Coefficients PIL (sortie -> entrée) pour envoyer le rectangle src sur le quadrilatère dst.
    m = []
    for (x, y), (u, v) in zip(dst, src):
        m.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        m.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    a = np.array(m, float)
    b = np.array([c for p in src for c in p], float)
    return np.linalg.solve(a, b).tolist()


def place_phone(canvas, ph, cx, cy, scale, yaw, pitch, alpha=1.0):
    # Rotation 3D (lacet puis tangage) des 4 coins, projection avec une focale fixe.
    f = 2200
    w, h = PH_W * scale, PH_H * scale
    corners = []
    for x, y in ((-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)):
        x1 = x * math.cos(yaw)
        z1 = x * math.sin(yaw)
        y2 = y * math.cos(pitch) - z1 * math.sin(pitch)
        z2 = y * math.sin(pitch) + z1 * math.cos(pitch)
        k = f / (f + z2)
        corners.append((cx + x1 * k, cy + y2 * k))
    xs = [c[0] for c in corners]
    ys = [c[1] for c in corners]
    x0, y0 = int(min(xs)) - 2, int(min(ys)) - 2
    bw, bh = int(max(xs)) - x0 + 4, int(max(ys)) - y0 + 4
    dst = [(c[0] - x0, c[1] - y0) for c in corners]
    src = [(0, 0), (PH_W, 0), (PH_W, PH_H), (0, PH_H)]
    warped = ph.transform((bw, bh), Image.PERSPECTIVE, perspective_coeffs(src, dst), Image.BICUBIC)
    # Ombre portée verte sous le téléphone.
    sh = Image.new("L", (bw + 160, bh + 160), 0)
    ImageDraw.Draw(sh).polygon([(x + 80, y + 110) for x, y in dst], fill=int(110 * alpha))
    sh = sh.filter(ImageFilter.GaussianBlur(45))
    canvas.paste(Image.new("RGB", sh.size, (2, 30, 14)), (x0 - 80, y0 - 80), sh)
    if alpha < 1:
        a = warped.getchannel("A").point(lambda v: int(v * alpha))
        warped.putalpha(a)
    canvas.paste(warped, (x0, y0), warped)


def phone_pose(t):
    """Position, échelle et angles du téléphone selon le plan et son mouvement d'entrée."""
    for start, end, name, move in SHOTS:
        if start <= t < end:
            break
    else:
        return None
    local = t - start
    k = ease_out(local / 0.55)
    cx, cy, s = W / 2, 1215, 1.0
    yaw = math.radians(-14) + math.sin(t * 0.9) * math.radians(3)  # léger flottement permanent
    pitch = math.radians(8)
    if move == "rise":  # entre par le bas en se redressant
        cy += (1 - k) * 900
        yaw += (1 - k) * math.radians(-30)
    elif move == "swing":  # bascule de l'autre côté
        yaw = math.radians(14) * (1 - 2 * (1 - k))
    elif move == "push":  # avance vers nous sur le temps fort
        s = 1.0 + 0.1 * math.sin(min(local / 0.35, 1) * math.pi) + 0.06 * ease_in_out(local / (end - start))
    elif move == "whip":  # balayage horizontal rapide
        cx += (1 - k) * -1300
    elif move == "zoom":  # on rentre dans l'écran pour le terrain
        s = 1.0 + 0.14 * ease_in_out(local / 0.8)
        cy += 40 * ease_in_out(local / 0.8)
        yaw *= 1 - ease_in_out(local / 0.8)
    elif move == "flip":  # retournement du téléphone
        flip = ease_in_out(local / 0.45)
        yaw = math.radians(-90) * (1 - flip) + math.radians(12) * flip
    elif move == "slide":  # glisse depuis la droite
        cx += (1 - k) * 1100
        yaw = math.radians(-22) * (1 - k) + math.radians(-10) * k
    elif move == "dolly":  # recul de caméra
        s = 1.12 - 0.12 * k
    if move != "zoom" and name in ("d_analyse", "e_probas"):
        s = 1.04
    # Sortie vers le carton final : le téléphone recule et s'efface.
    if name == "i_bilan" and end - t < 0.45:
        q = ease_in_out(1 - (end - t) / 0.45)
        s *= 1 - 0.35 * q
        cy += 160 * q
    return name, local, end - start, cx, cy, s, yaw, pitch


# ---------------------------------------------------------------- typographie
def draw_text_block(canvas, t):
    d = ImageDraw.Draw(canvas)
    for start, end, lines in TEXTS:
        if not start <= t < end:
            continue
        size = 128 if max(len(l) for l in lines) <= 16 else 104
        f = font(size)
        y = 175 if len(lines) <= 2 else 120
        word_i = 0
        out = ease_in_out((t - (end - 0.18)) / 0.18)  # sortie : glisse vers le haut
        for line in lines:
            words = line.split(" ")
            total = sum(f.getlength(w.replace("*", "")) for w in words) + f.getlength(" ") * (len(words) - 1)
            x = (W - total) / 2
            for wd in words:
                accent = "*" in wd
                txt = wd.replace("*", "")
                k = ease_out((t - start - word_i * 0.07) / 0.28)
                if k > 0:
                    a = int(255 * k * (1 - out))
                    dy = (1 - k) * 60 - out * 50
                    col = GREEN if accent else INK
                    layer = Image.new("RGBA", (int(f.getlength(txt)) + 20, size + 30), (0, 0, 0, 0))
                    ImageDraw.Draw(layer).text((10, 0), txt, font=f, fill=(*col, a))
                    canvas.paste(layer, (int(x) - 10, int(y + dy)), layer)
                x += f.getlength(txt + " ")
                word_i += 1
            y += size * 0.92


def draw_odds_counter(canvas, t):
    # Pendant « du plus sûr à la grosse cote » : une pastille de verre où la cote grimpe.
    t0, t1 = 3 * BAR, 4 * BAR
    if not t0 <= t < t1:
        return
    k = ease_in_out((t - t0) / (t1 - t0 - 0.4))
    odds = 1.36 * (8.59 / 1.36) ** k
    appear = ease_out((t - t0) / 0.3) * (1 - ease_in_out((t - (t1 - 0.2)) / 0.2))
    chip = Image.new("RGBA", (360, 170), (0, 0, 0, 0))
    cd = ImageDraw.Draw(chip)
    cd.rounded_rectangle([0, 0, 359, 169], 36, fill=(16, 40, 26, int(215 * appear)), outline=(120, 220, 160, int(170 * appear)), width=3)
    cd.text((32, 22), "COTE", font=sans(30), fill=(*INK, int(200 * appear)))
    cd.text((30, 52), f"{odds:.2f}", font=font(108), fill=(*GREEN, int(255 * appear)))
    canvas.paste(chip, (int(70 - (1 - appear) * 80), 1560), chip)


def draw_badge(canvas, t):
    # Rappel légal discret pendant toute la pub.
    d = ImageDraw.Draw(canvas)
    d.rounded_rectangle([W - 128, 1828, W - 48, 1880], 26, outline=(200, 220, 208), width=3)
    d.text((W - 113, 1834), "18+", font=sans(30), fill=(220, 232, 225))


# ---------------------------------------------------------------- carton final
LOGO = Image.open(Path(__file__).resolve().parents[1] / "app" / "icon.png").convert("RGBA")
rng = np.random.default_rng(3)
SPARKS = [(rng.uniform(80, W - 80), rng.uniform(250, H - 250), rng.uniform(10, 26), rng.uniform(0, 6.28), rng.uniform(0.8, 1.6)) for _ in range(26)]


def sparkle(d, x, y, r, a, col):
    # Étincelle à quatre branches (réf. 02).
    d.polygon([(x, y - r), (x + r * 0.22, y - r * 0.22), (x + r, y), (x + r * 0.22, y + r * 0.22), (x, y + r), (x - r * 0.22, y + r * 0.22), (x - r, y), (x - r * 0.22, y - r * 0.22)], fill=(*col, a))


def draw_end(canvas, t):
    local = t - END
    if local < 0:
        return
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for x, y, r, ph, sp in SPARKS:
        tw = 0.5 + 0.5 * math.sin(local * 3 * sp + ph)
        a = int(200 * tw * ease_out(local / 0.6))
        sparkle(d, x, y - local * 25 * sp, r * (0.6 + 0.4 * tw), a, GREEN if ph > 3 else (200, 245, 215))
    canvas.paste(layer, (0, 0), layer)

    k = ease_out(local / 0.7)
    size = int(330 * (0.6 + 0.4 * k))
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse([W / 2 - 300, 640 - 300, W / 2 + 300, 640 + 300], fill=int(120 * k))
    glow = glow.filter(ImageFilter.GaussianBlur(90))
    canvas.paste(Image.new("RGB", (W, H), DEEP), (0, 0), glow)
    logo = LOGO.resize((size, size), Image.LANCZOS)
    m = rounded_mask(size, size, int(size * 0.22))
    a = Image.fromarray((np.array(m) * k).astype(np.uint8))
    canvas.paste(logo, (W // 2 - size // 2, 640 - size // 2), a)

    d = ImageDraw.Draw(canvas)
    k2 = ease_out((local - 0.35) / 0.5)
    if k2 > 0:
        f = font(150)
        full = "PRONORADAR"
        x = (W - f.getlength(full)) / 2
        y = 870 + (1 - k2) * 40
        layer = Image.new("RGBA", (W, 200), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        ld.text((x, 0), "PRONO", font=f, fill=(*INK, int(255 * k2)))
        ld.text((x + f.getlength("PRONO"), 0), "RADAR", font=f, fill=(*GREEN, int(255 * k2)))
        canvas.paste(layer, (0, int(y)), layer)
    k3 = ease_out((local - 0.8) / 0.5)
    if k3 > 0:
        bw, bh = 700, 130
        bx, by = (W - bw) / 2, 1130 + (1 - k3) * 40
        btn = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
        bd = ImageDraw.Draw(btn)
        bd.rounded_rectangle([0, 0, bw - 1, bh - 1], 65, fill=(*DEEP, int(255 * k3)))
        label = "CRÉE TON COMPTE GRATUIT"
        bf = font(70)
        bd.text(((bw - bf.getlength(label)) / 2, 28), label, font=bf, fill=(*INK, int(255 * k3)))
        canvas.paste(btn, (int(bx), int(by)), btn)
        uf = sans(42)
        url = "pronoradar.vercel.app"
        d.text(((W - uf.getlength(url)) / 2, 1300), url, font=uf, fill=(*INK,))
    k4 = ease_out((local - 1.1) / 0.5)
    if k4 > 0:
        sf = sans(30)
        for i, line in enumerate(["Aide à la décision par IA · aucun gain garanti", "18+ · Jouez de façon responsable"]):
            d.text(((W - sf.getlength(line)) / 2, 1640 + i * 46), line, font=sf, fill=(170, 190, 178))


# ---------------------------------------------------------------- rendu
def render_frame(i):
    t = i / FPS
    canvas = BACKGROUND.copy()
    blobs = blob_layer(t)
    canvas = Image.fromarray(np.clip(np.array(canvas, np.int16) + np.array(blobs, np.int16) // 3, 0, 255).astype(np.uint8))
    pose = phone_pose(t)
    if pose:
        name, local, length, cx, cy, s, yaw, pitch = pose
        screen = shot_frame(name, local, length)
        sweep = (local - 0.1) / 0.9 if name in ("a_landing", "c_coupons", "f_compos", "i_bilan") else -1
        alpha = 1.0
        if name == "i_bilan" and length - local < 0.45:
            alpha = 1 - ease_in_out(1 - (length - local) / 0.45)
        place_phone(canvas, phone_image(screen, sweep), cx, cy, s, yaw, pitch, alpha)
        # Flash bref sur chaque coupe (synchronisé sur la mesure).
        if local < 0.08 and name != "a_landing":
            canvas = Image.blend(canvas, Image.new("RGB", (W, H), (30, 60, 40)), 0.25 * (1 - local / 0.08))
    draw_text_block(canvas, t)
    draw_odds_counter(canvas, t)
    draw_end(canvas, t)
    if t < END:
        draw_badge(canvas, t)
    return canvas


def crop_for(fmt, img):
    if fmt == "11":  # carré : on garde le centre, texte et téléphone compris, en réduisant
        sq = img.resize((W * 1080 // H, 1080), Image.LANCZOS)
        out = Image.new("RGB", (1080, 1080), BG)
        out.paste(BACKGROUND.resize((1080, 1080)), (0, 0))
        out.paste(sq, ((1080 - sq.width) // 2, 0))
        return out
    if fmt == "169":
        v = img.resize((W * 1080 // H, 1080), Image.LANCZOS)
        out = BACKGROUND.resize((1920, 1080))
        out.paste(v, ((1920 - v.width) // 2, 0))
        return out
    return img


if __name__ == "__main__":
    fmt = sys.argv[3] if len(sys.argv) > 3 else "916"
    total = int(DUR * FPS)
    first = render_frame(0)
    size = crop_for(fmt, first).size
    cmd = [
        "ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{size[0]}x{size[1]}", "-r", str(FPS), "-i", "-",
        "-i", str(WORK / "music.wav"), "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", OUT,
    ]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(total):
        frame = first if i == 0 else render_frame(i)
        p.stdin.write(crop_for(fmt, frame).tobytes())
        if i % 60 == 0:
            print(f"{i}/{total}", flush=True)
    p.stdin.close()
    p.wait()
    print("ok", OUT)

"""Build the link-preview image and site icons.

Run from the repository root after tools/prepare_images.py:
  python3 tools/make_share_assets.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets" / "aippi-2026"
SERIF = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc"
SERIF_REGULAR = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc"


def cjk_font(path, size):
    # Pick the Simplified Chinese face inside the collection.
    for index in range(10):
        font = ImageFont.truetype(path, size, index=index)
        if font.getname()[0].endswith(" SC"):
            return font
    return ImageFont.truetype(path, size)


RED, DEEP, CREAM, PAPER = (139, 0, 0), (87, 0, 0), (245, 240, 232), (250, 246, 238)


def share_image():
    w, h = 1200, 630
    canvas = Image.new("RGB", (w, h), CREAM)
    draw = ImageDraw.Draw(canvas)
    draw.rectangle([0, 0, 470, h], fill=RED)
    title = cjk_font(SERIF, 64)
    sub = cjk_font(SERIF_REGULAR, 28)
    small = cjk_font(SERIF_REGULAR, 24)
    draw.text((52, 150), "印出中国故事", font=title, fill=CREAM)
    draw.text((54, 245), "Print a Chinese Story", font=sub, fill=CREAM)
    draw.line([(54, 305), (180, 305)], fill=(230, 190, 170), width=2)
    draw.text((54, 330), "雕版印刷 · 亲手体验", font=small, fill=CREAM)
    draw.text((54, 368), "Woodblock printing to try", font=small, fill=CREAM)
    draw.text((54, 500), "AIPPI 2026 · 50号展位 / Booth 50", font=small, fill=CREAM)
    draw.text((54, 538), "段和段律师事务所 Duan & Duan", font=small, fill=CREAM)
    prints = ["01-portrait/print", "08-protect-innovation/print"]
    tiles = []
    for name in prints:
        img = Image.open(ASSETS / f"{name}-1000.webp").convert("RGB")
        scale = 460 / img.height
        tiles.append(img.resize((round(img.width * scale), 460), Image.LANCZOS))
    gap = 24
    total = sum(t.width for t in tiles) + gap * (len(tiles) - 1)
    x = 470 + (w - 470 - total) // 2
    for tile in tiles:
        shadow = Image.new("RGBA", (tile.width + 40, tile.height + 40), (0, 0, 0, 0))
        ImageDraw.Draw(shadow).rectangle([20, 24, tile.width + 20, tile.height + 24], fill=(60, 30, 10, 70))
        shadow = shadow.filter(ImageFilter.GaussianBlur(8))
        top = (h - 460) // 2
        canvas.paste(shadow, (x - 20, top - 20), shadow)
        canvas.paste(tile, (x, top))
        x += tile.width + gap
    canvas.save(ASSETS / "share.jpg", quality=86, optimize=True, progressive=True)


def icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    radius = round(size * 0.18)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=RED)
    inset = round(size * 0.1)
    draw.rounded_rectangle([inset, inset, size - 1 - inset, size - 1 - inset], radius=max(1, radius // 2),
                           outline=CREAM, width=max(1, round(size * 0.04)))
    font = cjk_font(SERIF, round(size * 0.58))
    box = draw.textbbox((0, 0), "印", font=font)
    tx = (size - (box[2] - box[0])) / 2 - box[0]
    ty = (size - (box[3] - box[1])) / 2 - box[1]
    draw.text((tx, ty), "印", font=font, fill=CREAM)
    return img


def icons():
    icon(180).convert("RGB").save(ROOT / "apple-touch-icon.png", optimize=True)
    icon(64).resize((32, 32), Image.LANCZOS).save(ROOT / "favicon-32.png", optimize=True)


if __name__ == "__main__":
    share_image()
    icons()

"""Straighten, crop and resize exhibition photos for the web page.

The original photos stay untouched. For each photo this writes, next to it:
  <name>-full.jpeg     straightened and cropped, up to 2000 px, for "open full image"
  <name>-1000.webp     page image, 1000 px on the long side
  <name>-640.webp      smaller page image for phones
  <name>-thumb.webp    240 px thumbnail for the overview strip

Corner points are measured by hand on each original photo, in the order
top-left, top-right, bottom-right, bottom-left. "inset" trims a share of
each side after straightening, to drop frame walls and shadows; "trim"
overrides it per side as [left, top, right, bottom]. "rotate" turns the
result counterclockwise in degrees (multiples of 90).

Run from the repository root:  python3 tools/prepare_images.py
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets" / "aippi-2026"

PHOTOS = {
    "01-portrait/print": {"corners": [[89, 99], [1433, 115], [1383, 1915], [74, 1888]], "inset": 0.025, "trim": [0.025, 0.025, 0.045, 0.025]},
    "01-portrait/block": {"corners": [[32, 59], [1482, 81], [1446, 1985], [24, 1989]], "inset": 0.008, "rotate": 180},
    "02-porcelain/print": {"corners": [[91, 126], [1471, 126], [1391, 1872], [125, 1851]], "inset": 0.025, "trim": [0.07, 0.025, 0.025, 0.025]},
    "02-porcelain/block": {"corners": [[67, 89], [1987, 100], [1981, 1373], [49, 1360]], "inset": 0.008, "rotate": 90},
    "03-dragon-tiger/dragon-print": {"corners": [[63, 97], [1838, 105], [1796, 1407], [143, 1409]], "inset": 0.025},
    "03-dragon-tiger/tiger-print": {"corners": [[184, 97], [1885, 110], [1796, 1346], [286, 1373]], "inset": 0.025, "trim": [0.04, 0.025, 0.025, 0.025]},
    "04-dragon-jar/print": {"corners": [[58, 68], [1441, 71], [1397, 1920], [53, 1920]], "inset": 0.025, "trim": [0.065, 0.025, 0.025, 0.025]},
    "04-dragon-jar/block": {"corners": [[97, 385], [1463, 359], [1497, 1706], [129, 1750]], "inset": 0.008},
    "05-instant-happiness/print": {"corners": [[52, 135], [1354, 121], [1247, 1661], [202, 1674]], "inset": 0.025, "trim": [0.05, 0.025, 0.025, 0.025]},
    "06-swift-success/print": {"corners": [[99, 224], [1355, 218], [1267, 1740], [194, 1741]], "inset": 0.025, "trim": [0.045, 0.025, 0.025, 0.025]},
    "07-instant-riches/print": {"corners": [[101, 197], [1373, 191], [1291, 1708], [232, 1729]], "inset": 0.025, "trim": [0.05, 0.025, 0.025, 0.025]},
    "08-protect-innovation/print": {"corners": [[70, 41], [1488, 70], [1297, 1721], [186, 1698]], "inset": 0.025, "trim": [0.09, 0.025, 0.025, 0.025]},
}


def straighten(image, corners, trim):
    pts = np.array(corners, dtype=np.float32)
    tl, tr, br, bl = pts
    width = (np.linalg.norm(tr - tl) + np.linalg.norm(br - bl)) / 2
    height = (np.linalg.norm(bl - tl) + np.linalg.norm(br - tr)) / 2
    w, h = int(round(width)), int(round(height))
    target = np.array([[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]], dtype=np.float32)
    matrix = cv2.getPerspectiveTransform(pts, target)
    warped = cv2.warpPerspective(image, matrix, (w, h), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)
    left, top, right, bottom = trim
    return warped[round(h * top):h - round(h * bottom), round(w * left):w - round(w * right)]


def fit(img, longest):
    scale = longest / max(img.size)
    if scale >= 1:
        return img.copy()
    return img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)


def main():
    report = {}
    for name, spec in PHOTOS.items():
        source = ASSETS / f"{name}-original.jpeg"
        bgr = cv2.imread(str(source), cv2.IMREAD_COLOR)
        trim = spec.get("trim", [spec["inset"]] * 4)
        out = straighten(bgr, spec["corners"], trim)
        img = Image.fromarray(cv2.cvtColor(out, cv2.COLOR_BGR2RGB))
        if spec.get("rotate"):
            img = img.rotate(spec["rotate"], expand=True)
        full = fit(img, 2000)
        full.save(ASSETS / f"{name}-full.jpeg", quality=85, optimize=True, progressive=True)
        fit(img, 1000).save(ASSETS / f"{name}-1000.webp", quality=78, method=6)
        fit(img, 640).save(ASSETS / f"{name}-640.webp", quality=76, method=6)
        fit(img, 240).save(ASSETS / f"{name}-thumb.webp", quality=72, method=6)
        report[name] = {"full": list(full.size), "w1000": list(fit(img, 1000).size), "w640": list(fit(img, 640).size)}
    json.dump(report, sys.stdout, indent=1)


if __name__ == "__main__":
    main()

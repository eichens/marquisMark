#!/usr/bin/env python3
"""Generate a macOS-style app icon (squircle) from the existing glyph art.

Output: src-tauri/icons/icon-source.png (1024x1024, RGBA, transparent corners).

The macOS app-icon "squircle" is a superellipse, not a normal rounded
rectangle. We approximate it by sampling |x|^n + |y|^n = r^n with n ~ 5.0.

Layout follows Apple's HIG icon grid:
- Canvas: 1024x1024
- Squircle bbox: ~824x824 centered (10% padding all around)
- Glyph: ~520x520 centered inside the squircle
"""
from __future__ import annotations
import math
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ICON_DIR = ROOT / "src-tauri" / "icons"
SOURCE_GLYPH = ICON_DIR / "icon.png"
OUT = ICON_DIR / "icon-source.png"

CANVAS = 1024
SQUIRCLE_SIZE = 824   # ~80% of canvas — matches Apple icon grid
GLYPH_SIZE = 520      # logo lives inside the squircle's safe area
N_EXP = 5.0           # superellipse exponent
BG_COLOR = (26, 27, 38, 255)    # near-black, matches dark theme bg-primary
GLYPH_COLOR = (255, 255, 255, 255)


def squircle_mask(size: int, n: float) -> Image.Image:
    """Return an L-mode mask containing the superellipse, AA-sampled at 4x."""
    scale = 4
    big = size * scale
    mask = Image.new("L", (big, big), 0)
    px = mask.load()
    half = big / 2
    r_n = half ** n
    for y in range(big):
        dy = abs(y - half + 0.5)
        dy_n = dy ** n
        if dy_n >= r_n:
            continue
        # Solve x for the boundary: |x|^n + |y|^n = r^n
        x_max = (r_n - dy_n) ** (1.0 / n)
        x0 = int(half - x_max)
        x1 = int(half + x_max)
        for x in range(max(0, x0), min(big, x1 + 1)):
            px[x, y] = 255
    return mask.resize((size, size), Image.LANCZOS)


def extract_glyph_from_source() -> Image.Image:
    """Pull the dark glyph out of the existing icon and return a white version
    on a transparent background, trimmed to its bounding box."""
    img = Image.open(SOURCE_GLYPH).convert("RGBA")
    # The source is dark-on-white. Treat any pixel that's "dark enough" as
    # part of the glyph; everything else becomes transparent.
    px = img.load()
    w, h = img.size
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out_px = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            # Perceived brightness; pixels darker than ~50% become glyph.
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            if lum < 128:
                # Anti-alias edge: lower alpha for mid-tones near threshold.
                edge_alpha = int(255 * min(1.0, (128 - lum) / 64.0))
                out_px[x, y] = (255, 255, 255, edge_alpha)
    return out.crop(out.getbbox())


def build_icon() -> None:
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))

    # Squircle background.
    sq = Image.new("RGBA", (SQUIRCLE_SIZE, SQUIRCLE_SIZE), (0, 0, 0, 0))
    sq_draw = ImageDraw.Draw(sq)
    mask = squircle_mask(SQUIRCLE_SIZE, N_EXP)
    sq_draw.bitmap((0, 0), mask, fill=BG_COLOR)
    sq.putalpha(mask)
    canvas.paste(sq, ((CANVAS - SQUIRCLE_SIZE) // 2, (CANVAS - SQUIRCLE_SIZE) // 2), sq)

    # Glyph.
    glyph = extract_glyph_from_source()
    gw, gh = glyph.size
    scale = GLYPH_SIZE / max(gw, gh)
    glyph = glyph.resize((int(gw * scale), int(gh * scale)), Image.LANCZOS)
    gw, gh = glyph.size
    canvas.paste(glyph, ((CANVAS - gw) // 2, (CANVAS - gh) // 2), glyph)

    canvas.save(OUT, "PNG")
    print(f"Wrote {OUT} ({CANVAS}x{CANVAS})")


if __name__ == "__main__":
    build_icon()

#!/usr/bin/env python3
"""Generate circular app icons from the Prabhat Samgiita emblem."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
EMBLEM = ROOT / "apps/web/public/brand/prabhat-samgiita-emblem.png"
WEB_PUBLIC = ROOT / "apps/web/public/brand"
WEB_APP = ROOT / "apps/web/app"
MOBILE_ASSETS = ROOT / "apps/mobile/assets"

NAVY = (9, 45, 86, 255)
GOLD = (202, 138, 39, 180)


def _strip_white_background(image: Image.Image, threshold: int = 235) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if r >= threshold and g >= threshold and b >= threshold:
                pixels[x, y] = (255, 255, 255, 0)
    return rgba


def _circular_mask(size: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    return mask


def make_icon(size: int, emblem_scale: float = 0.78, gold_ring: bool = True) -> Image.Image:
    emblem = _strip_white_background(Image.open(EMBLEM))
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    draw.ellipse((0, 0, size - 1, size - 1), fill=NAVY)
    if gold_ring:
        ring = max(2, size // 80)
        draw.ellipse((ring, ring, size - ring - 1, size - ring - 1), outline=GOLD, width=max(1, size // 128))

    emblem_size = int(size * emblem_scale)
    emblem_resized = emblem.resize((emblem_size, emblem_size), Image.Resampling.LANCZOS)
    offset = (size - emblem_size) // 2
    canvas.paste(emblem_resized, (offset, offset), emblem_resized)

    masked = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    masked.paste(canvas, (0, 0), _circular_mask(size))
    return masked


def save_png(path: Path, image: Image.Image) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=True)


def save_ico(path: Path, sizes: tuple[int, ...]) -> None:
    images = [make_icon(size, emblem_scale=0.76).convert("RGBA") for size in sizes]
    path.parent.mkdir(parents=True, exist_ok=True)
    images[0].save(
        path,
        format="ICO",
        sizes=[(size, size) for size in sizes],
        append_images=images[1:],
    )


def main() -> None:
    if not EMBLEM.exists():
        raise SystemExit(f"Missing emblem: {EMBLEM}")

    outputs = {
        WEB_PUBLIC / "app-icon-192.png": 192,
        WEB_PUBLIC / "app-icon-512.png": 512,
        WEB_APP / "icon.png": 512,
        WEB_APP / "apple-icon.png": 180,
        WEB_PUBLIC / "apple-icon.png": 180,
        MOBILE_ASSETS / "icon.png": 1024,
        MOBILE_ASSETS / "splash-icon.png": 512,
        MOBILE_ASSETS / "adaptive-icon.png": 1024,
    }

    for path, size in outputs.items():
        scale = 0.68 if "adaptive-icon" in path.name else 0.78
        save_png(path, make_icon(size, emblem_scale=scale))

    save_ico(WEB_APP / "favicon.ico", (16, 32, 48))
    save_ico(WEB_PUBLIC / "favicon.ico", (16, 32, 48))

    print("Generated circular icons:")
    for path in outputs:
        print(f"  - {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

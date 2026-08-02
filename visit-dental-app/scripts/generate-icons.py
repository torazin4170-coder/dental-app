"""Generate favicon / PWA icons from source tooth illustration."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
SOURCE = Path(
    r"C:\Users\toraz\.cursor\projects\d-ADS-personal-visual-explainers\assets"
    r"\c__Users_toraz_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_tooth_ha_pikapika-26723154-dbc6-4eda-a2db-f532948ccbc0.png"
)
# 白い歯がタブで消えないよう、テーマ色に合う淡い青背景
FAVICON_BG = (219, 234, 254, 255)


def crop_to_content(im: Image.Image, padding_ratio: float = 0.08) -> Image.Image:
    im = im.convert("RGBA")
    bbox = im.getbbox()
    if not bbox:
        return im
    x0, y0, x1, y1 = bbox
    w, h = x1 - x0, y1 - y0
    pad = int(max(w, h) * padding_ratio)
    left = max(0, x0 - pad)
    top = max(0, y0 - pad)
    right = min(im.width, x1 + pad)
    bottom = min(im.height, y1 + pad)
    return im.crop((left, top, right, bottom))


def fit_square(im: Image.Image, size: int, bg: tuple[int, int, int, int] | None = None) -> Image.Image:
    im = im.convert("RGBA")
    scale = min(size / im.width, size / im.height)
    nw, nh = max(1, int(im.width * scale)), max(1, int(im.height * scale))
    resized = im.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), bg or (0, 0, 0, 0))
    ox, oy = (size - nw) // 2, (size - nh) // 2
    canvas.paste(resized, (ox, oy), resized)
    return canvas


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    src = Image.open(SOURCE)
    cropped = crop_to_content(src)

    fit_square(cropped, 180).save(PUBLIC / "apple-touch-icon.png", optimize=True)
    fit_square(cropped, 192).save(PUBLIC / "pwa-192.png", optimize=True)
    fit_square(cropped, 512).save(PUBLIC / "pwa-512.png", optimize=True)

    for size in (16, 32, 48):
        fit_square(cropped, size, FAVICON_BG).save(PUBLIC / f"favicon-{size}.png", optimize=True)

    # ICO: 高解像度源から複数サイズを一括生成（Chrome タブは 32px 前後を使用）
    master = fit_square(cropped, 256, FAVICON_BG)
    master.save(
        PUBLIC / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )

    print("Wrote:", ", ".join(sorted(p.name for p in PUBLIC.glob("favicon*"))))


if __name__ == "__main__":
    main()

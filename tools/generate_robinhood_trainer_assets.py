from collections import deque
from pathlib import Path
import colorsys

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
TAMERIA = ROOT / "assets" / "images" / "tameria"
BATTLE = ROOT / "assets" / "images" / "monster-tamer" / "battle"
SOURCE_SHEET = TAMERIA / "intro-girl.png"
OUTPUT_SHEET = TAMERIA / "robinhood-jr-trainer.png"
GENERATED_BATTLE = Path(r"C:\Users\nacho\AppData\Local\hermes\cache\images\openai_codex_gpt-image-2-medium_20260713_090023_fcf85bef.png")
OUTPUT_BATTLE = BATTLE / "trainer_youth_girl_robinhood.png"

FRAME_W = 64
FRAME_H = 88
LIME_HUE = 78 / 360
DARK_GREEN = (29, 61, 24, 255)
INK = (15, 17, 12, 255)


def recolor_pink_to_lime(image: Image.Image) -> Image.Image:
    result = image.convert("RGBA")
    pixels = result.load()
    for y in range(result.height):
        for x in range(result.width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            # The source trainer's garment is a rose/magenta family. Skin, hair,
            # boots and outlines fall outside this narrow hue band.
            if h >= 0.94 and s >= 0.35 and v >= 0.18:
                new_s = max(0.82, min(1.0, s * 1.18))
                new_v = min(1.0, v * 1.16 + 0.04)
                nr, ng, nb = colorsys.hsv_to_rgb(LIME_HUE, new_s, new_v)
                pixels[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    return result


def add_hood_and_logo(sheet: Image.Image) -> None:
    draw = ImageDraw.Draw(sheet)

    # Back-facing row: the hood rim peeks out below the hair.
    for col in range(3):
        ox = col * FRAME_W
        draw.line([(ox + 22, 48), (ox + 27, 51), (ox + 37, 51), (ox + 42, 48)], fill=DARK_GREEN, width=2)

    # Right-facing row: hood volume sits behind the neck.
    for col in range(3):
        ox = col * FRAME_W
        oy = FRAME_H
        draw.line([(ox + 22, oy + 44), (ox + 20, oy + 49), (ox + 24, oy + 53)], fill=DARK_GREEN, width=2)

    # Left-facing row.
    for col in range(3):
        ox = col * FRAME_W
        oy = FRAME_H * 3
        draw.line([(ox + 42, oy + 44), (ox + 44, oy + 49), (ox + 40, oy + 53)], fill=DARK_GREEN, width=2)

    # Front walk row and dedicated idle row: hood opening, drawstrings and a
    # tiny readable feather/arrow emblem on the chest.
    for row in (2, 4):
        oy = row * FRAME_H
        for col in range(3):
            ox = col * FRAME_W
            draw.line([(ox + 24, oy + 45), (ox + 28, oy + 49), (ox + 36, oy + 49), (ox + 40, oy + 45)], fill=DARK_GREEN, width=2)
            draw.line([(ox + 29, oy + 49), (ox + 29, oy + 53)], fill=INK, width=1)
            draw.line([(ox + 35, oy + 49), (ox + 35, oy + 53)], fill=INK, width=1)
            # Simplified Robinhood feather/arrow at pixel scale.
            draw.polygon(
                [
                    (ox + 30, oy + 54),
                    (ox + 35, oy + 52),
                    (ox + 34, oy + 55),
                    (ox + 36, oy + 55),
                    (ox + 32, oy + 60),
                    (ox + 33, oy + 56),
                    (ox + 29, oy + 58),
                ],
                fill=INK,
            )


def create_overworld_sheet() -> None:
    source = Image.open(SOURCE_SHEET).convert("RGBA")
    assert source.size == (FRAME_W * 3, FRAME_H * 5), source.size
    result = recolor_pink_to_lime(source)
    add_hood_and_logo(result)
    result.save(OUTPUT_SHEET, optimize=True)


def remove_connected_checkerboard(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()

    def is_checker(x: int, y: int) -> bool:
        r, g, b, _ = pixels[x, y]
        return min(r, g, b) >= 180 and max(r, g, b) - min(r, g, b) <= 20

    visited = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()
    for x in range(width):
        if is_checker(x, 0):
            queue.append((x, 0))
        if is_checker(x, height - 1):
            queue.append((x, height - 1))
    for y in range(height):
        if is_checker(0, y):
            queue.append((0, y))
        if is_checker(width - 1, y):
            queue.append((width - 1, y))

    while queue:
        x, y = queue.popleft()
        idx = y * width + x
        if visited[idx] or not is_checker(x, y):
            continue
        visited[idx] = 1
        pixels[x, y] = (*pixels[x, y][:3], 0)
        if x:
            queue.append((x - 1, y))
        if x + 1 < width:
            queue.append((x + 1, y))
        if y:
            queue.append((x, y - 1))
        if y + 1 < height:
            queue.append((x, y + 1))

    return rgba


def create_battle_sprite() -> None:
    cleaned = remove_connected_checkerboard(Image.open(GENERATED_BATTLE))
    alpha = cleaned.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise RuntimeError("Generated battle trainer has no visible pixels")
    character = cleaned.crop(bbox)

    canvas_size = (256, 383)
    max_size = (246, 373)
    scale = min(max_size[0] / character.width, max_size[1] / character.height)
    resized = character.resize(
        (round(character.width * scale), round(character.height * scale)),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    x = (canvas_size[0] - resized.width) // 2
    y = canvas_size[1] - resized.height - 5
    canvas.alpha_composite(resized, (x, y))
    canvas.save(OUTPUT_BATTLE, optimize=True)


if __name__ == "__main__":
    create_overworld_sheet()
    create_battle_sprite()
    print(OUTPUT_SHEET)
    print(OUTPUT_BATTLE)

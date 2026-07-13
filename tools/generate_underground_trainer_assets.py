from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
TAMERIA = ROOT / "assets" / "images" / "tameria"
BATTLE = ROOT / "assets" / "images" / "monster-tamer" / "battle"
SOURCE_SHEET = TAMERIA / "bnb-rapper-npc.png"
OUTPUT_SHEET = TAMERIA / "underground-jr-trainer.png"
GENERATED_BATTLE = Path(r"C:\Users\nacho\AppData\Local\hermes\cache\images\openai_codex_gpt-image-2-medium_20260713_092736_1c0c56e1.png")
OUTPUT_BATTLE = BATTLE / "trainer_youth_boy_underground.png"

FRAME_W = 64
FRAME_H = 88
INK = (12, 12, 15, 255)
HAIR_SHADOW = (176, 166, 143, 255)
HAIR = (239, 232, 211, 255)
HAIR_LIGHT = (255, 250, 231, 255)
VIOLET = (119, 62, 214, 255)
VIOLET_LIGHT = (157, 91, 247, 255)
CYAN = (43, 205, 225, 255)
STEEL = (109, 117, 129, 255)


def expand_with_idle_row(source: Image.Image) -> Image.Image:
    assert source.size == (FRAME_W * 3, FRAME_H * 4), source.size
    sheet = Image.new("RGBA", (FRAME_W * 3, FRAME_H * 5), (0, 0, 0, 0))
    sheet.alpha_composite(source, (0, 0))
    # Reuse the three front-facing poses as a subtle low-rate breathing/sway idle.
    front_row = source.crop((0, FRAME_H * 2, FRAME_W * 3, FRAME_H * 3))
    sheet.alpha_composite(front_row, (0, FRAME_H * 4))
    return sheet


def add_platinum_hair(draw: ImageDraw.ImageDraw, ox: int, oy: int, direction: str) -> None:
    if direction == "front":
        outline = [(ox + 23, oy + 29), (ox + 43, oy + 29), (ox + 41, oy + 34), (ox + 38, oy + 33),
                   (ox + 35, oy + 38), (ox + 31, oy + 34), (ox + 27, oy + 37), (ox + 27, oy + 33),
                   (ox + 23, oy + 34)]
        fill = [(ox + 25, oy + 30), (ox + 41, oy + 30), (ox + 39, oy + 32), (ox + 36, oy + 32),
                (ox + 34, oy + 36), (ox + 31, oy + 33), (ox + 28, oy + 35), (ox + 28, oy + 32),
                (ox + 25, oy + 33)]
        draw.polygon(outline, fill=INK)
        draw.polygon(fill, fill=HAIR)
        draw.line([(ox + 27, oy + 30), (ox + 34, oy + 31), (ox + 39, oy + 30)], fill=HAIR_LIGHT, width=1)
    elif direction == "back":
        draw.line([(ox + 22, oy + 35), (ox + 25, oy + 40), (ox + 31, oy + 38), (ox + 36, oy + 41), (ox + 42, oy + 35)], fill=INK, width=3)
        draw.line([(ox + 23, oy + 35), (ox + 26, oy + 38), (ox + 31, oy + 37), (ox + 36, oy + 39), (ox + 41, oy + 35)], fill=HAIR, width=2)
    elif direction == "right":
        draw.polygon([(ox + 38, oy + 29), (ox + 46, oy + 31), (ox + 43, oy + 34), (ox + 45, oy + 37),
                      (ox + 40, oy + 36), (ox + 38, oy + 40), (ox + 36, oy + 34)], fill=INK)
        draw.polygon([(ox + 39, oy + 30), (ox + 44, oy + 31), (ox + 41, oy + 34), (ox + 43, oy + 35),
                      (ox + 39, oy + 35), (ox + 38, oy + 38), (ox + 38, oy + 33)], fill=HAIR)
        draw.point((ox + 41, oy + 30), fill=HAIR_LIGHT)
    else:
        draw.polygon([(ox + 26, oy + 29), (ox + 18, oy + 31), (ox + 21, oy + 34), (ox + 19, oy + 37),
                      (ox + 24, oy + 36), (ox + 26, oy + 40), (ox + 28, oy + 34)], fill=INK)
        draw.polygon([(ox + 25, oy + 30), (ox + 20, oy + 31), (ox + 23, oy + 34), (ox + 21, oy + 35),
                      (ox + 25, oy + 35), (ox + 26, oy + 38), (ox + 26, oy + 33)], fill=HAIR)
        draw.point((ox + 23, oy + 30), fill=HAIR_LIGHT)


def add_techwear_details(sheet: Image.Image) -> None:
    draw = ImageDraw.Draw(sheet)
    for row in range(5):
        direction = ("back", "right", "front", "left", "front")[row]
        oy = row * FRAME_H
        for col in range(3):
            ox = col * FRAME_W
            add_platinum_hair(draw, ox, oy, direction)

            if direction == "front":
                # Violet bomber lining, diagonal utility strap, cyan buckle and
                # asymmetrical cargo accents establish the techwear identity.
                draw.line([(ox + 24, oy + 48), (ox + 31, oy + 51), (ox + 40, oy + 47)], fill=VIOLET, width=2)
                draw.line([(ox + 25, oy + 48), (ox + 39, oy + 64)], fill=STEEL, width=2)
                draw.rectangle((ox + 34, oy + 57, ox + 37, oy + 60), fill=CYAN)
                draw.line([(ox + 22, oy + 61), (ox + 20, oy + 67)], fill=VIOLET_LIGHT, width=2)
                draw.line([(ox + 41, oy + 65), (ox + 39, oy + 73)], fill=VIOLET, width=2)
                draw.line([(ox + 23, oy + 79), (ox + 29, oy + 79)], fill=CYAN, width=2)
                draw.line([(ox + 37, oy + 79), (ox + 43, oy + 79)], fill=VIOLET_LIGHT, width=2)
            elif direction == "back":
                draw.line([(ox + 21, oy + 49), (ox + 32, oy + 53), (ox + 43, oy + 49)], fill=VIOLET, width=2)
                draw.line([(ox + 26, oy + 54), (ox + 38, oy + 65)], fill=STEEL, width=2)
                draw.rectangle((ox + 35, oy + 61, ox + 38, oy + 64), fill=CYAN)
            elif direction == "right":
                draw.line([(ox + 25, oy + 48), (ox + 39, oy + 51)], fill=VIOLET, width=2)
                draw.line([(ox + 27, oy + 50), (ox + 38, oy + 64)], fill=STEEL, width=2)
                draw.rectangle((ox + 35, oy + 58, ox + 38, oy + 61), fill=CYAN)
                draw.line([(ox + 39, oy + 72), (ox + 43, oy + 74)], fill=VIOLET_LIGHT, width=2)
            else:
                draw.line([(ox + 39, oy + 48), (ox + 25, oy + 51)], fill=VIOLET, width=2)
                draw.line([(ox + 37, oy + 50), (ox + 26, oy + 64)], fill=STEEL, width=2)
                draw.rectangle((ox + 26, oy + 58, ox + 29, oy + 61), fill=CYAN)
                draw.line([(ox + 25, oy + 72), (ox + 21, oy + 74)], fill=VIOLET_LIGHT, width=2)


def create_overworld_sheet() -> None:
    source = Image.open(SOURCE_SHEET).convert("RGBA")
    sheet = expand_with_idle_row(source)
    add_techwear_details(sheet)
    sheet.save(OUTPUT_SHEET, optimize=True)


def remove_connected_magenta(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()

    def is_magenta(x: int, y: int) -> bool:
        r, g, b, _ = pixels[x, y]
        return r >= 170 and b >= 125 and g <= 105 and r - g >= 85 and b - g >= 65

    visited = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()
    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
    for y in range(height):
        queue.append((0, y))
        queue.append((width - 1, y))

    while queue:
        x, y = queue.popleft()
        idx = y * width + x
        if visited[idx] or not is_magenta(x, y):
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

    # Remove bright magenta anti-alias spill left around the silhouette while
    # preserving the darker, blue-heavy violet garment accents.
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a and r >= 120 and b >= 120 and g <= 115 and abs(r - b) <= 70:
                pixels[x, y] = (r, g, b, 0)

    # Peel remaining pink-purple fringe from the transparent boundary only.
    # Legitimate violet fabric is more blue-heavy and falls outside this hue.
    import colorsys
    for _ in range(3):
        remove = []
        for y in range(1, height - 1):
            for x in range(1, width - 1):
                r, g, b, a = pixels[x, y]
                if not a:
                    continue
                h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                touches_alpha = any(pixels[x + dx, y + dy][3] == 0 for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)))
                if touches_alpha and 0.79 <= h <= 0.92 and s >= 0.45 and v >= 0.25:
                    remove.append((x, y))
        for x, y in remove:
            r, g, b, _ = pixels[x, y]
            pixels[x, y] = (r, g, b, 0)
    return rgba


def create_battle_sprite() -> None:
    cleaned = remove_connected_magenta(Image.open(GENERATED_BATTLE))
    bbox = cleaned.getchannel("A").getbbox()
    if bbox is None:
        raise RuntimeError("Generated battle trainer has no visible pixels")
    character = cleaned.crop(bbox)
    canvas_size = (256, 381)
    max_size = (250, 373)
    scale = min(max_size[0] / character.width, max_size[1] / character.height)
    resized = character.resize((round(character.width * scale), round(character.height * scale)), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    canvas.alpha_composite(resized, ((canvas_size[0] - resized.width) // 2, canvas_size[1] - resized.height - 4))
    canvas.save(OUTPUT_BATTLE, optimize=True)


if __name__ == "__main__":
    create_overworld_sheet()
    create_battle_sprite()
    print(OUTPUT_SHEET)
    print(OUTPUT_BATTLE)

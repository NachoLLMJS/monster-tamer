from collections import deque
from pathlib import Path
import colorsys

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
MAP_GENERATED_SOURCE = ROOT / "tools" / "sources" / "lime-techwear-map-sheet-chibi-generated.png"
BATTLE_SOURCE = ROOT / "tools" / "sources" / "lime-techwear-trainer-source.png"
MAP_OUTPUT = ROOT / "assets" / "images" / "tameria" / "lime-techwear-jr-trainer.png"
BATTLE_OUTPUT = ROOT / "assets" / "images" / "monster-tamer" / "battle" / "trainer_youth_girl_lime_techwear.png"

FRAME_WIDTH = 64
FRAME_HEIGHT = 88


def shade(color, amount):
    return tuple(max(0, min(255, channel + amount)) for channel in color)


def recolor_frame(frame, row):
    image = frame.convert("RGBA")
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            # Turn the existing jacket's blue/cyan fabric into acid lime.
            if y >= 31 and 0.48 <= h <= 0.72 and s >= 0.22:
                light = int(v * 105)
                pixels[x, y] = (max(45, 96 + light), max(88, 142 + light), max(0, 2 + light // 5), a)
                continue
            # Replace all visible skin with a warm dark-brown palette.
            if 0.035 <= h <= 0.16 and s >= 0.18 and v >= 0.28:
                value = int(v * 58)
                pixels[x, y] = (82 + value, 38 + value // 2, 17 + value // 4, a)

    # The old cap becomes an asymmetric mint mohawk plus shaved brown side.
    pixels = image.load()
    for y in range(3, 34):
        for x in range(11, 53):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            _, _, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if v < 0.04:
                continue
            if row in (2, 4):
                mint_side = x <= 35
            elif row == 1:
                mint_side = y <= 20 or x <= 26
            elif row == 3:
                mint_side = y <= 20 or x >= 38
            else:
                mint_side = 23 <= x <= 42
            if mint_side:
                level = int(v * 90)
                pixels[x, y] = (55 + level // 2, 150 + level, 145 + level, a)
            else:
                level = int(v * 48)
                pixels[x, y] = (73 + level, 37 + level // 2, 24 + level // 3, a)

    draw = ImageDraw.Draw(image)
    # Compact oversized-hood collar: it expands the shoulders without hiding
    # the face or flattening the whole sprite into a green block.
    if row in (2, 4):
        collar = [(18, 45), (23, 39), (29, 41), (34, 38), (42, 41), (47, 46), (43, 50), (21, 50)]
    elif row == 1:
        collar = [(17, 45), (22, 39), (33, 39), (44, 43), (47, 48), (20, 50)]
    elif row == 3:
        collar = [(47, 45), (42, 39), (31, 39), (20, 43), (17, 48), (44, 50)]
    else:
        collar = [(18, 46), (22, 39), (31, 37), (42, 40), (47, 46), (43, 50), (21, 50)]
    draw.polygon(collar, fill=(126, 197, 0, 255), outline=(7, 13, 9, 255))
    draw.line(collar[1:5], fill=(199, 255, 24, 255), width=1)

    # Long mint side braid, narrow enough to retain the original pixel-art
    # anatomy while making the character recognisable in every direction.
    if row in (2, 4):
        braid_x = 21
    elif row in (0, 1):
        braid_x = 19
    else:
        braid_x = 43
    draw.line((braid_x, 27, braid_x, 63), fill=(4, 10, 9, 255), width=4)
    braid_colors = [(104, 235, 218, 255), (57, 190, 181, 255)]
    for index, y in enumerate(range(28, 61, 6)):
        offset = 1 if index % 2 else 0
        draw.ellipse((braid_x - 2 + offset, y, braid_x + 2 + offset, y + 5), fill=braid_colors[index % 2], outline=(6, 21, 19, 255), width=1)
    draw.polygon([(braid_x - 2, 61), (braid_x + 2, 61), (braid_x, 67)], fill=(72, 212, 198, 255), outline=(5, 17, 16, 255))

    # Black harness and tiny sleeve insignia tie the map sprite to battle art.
    if row in (2, 4):
        draw.line((27, 48, 39, 65), fill=(8, 11, 10, 255), width=3)
        draw.polygon([(44, 51), (49, 53), (46, 56)], fill=(5, 8, 6, 255))
    return image


def _projection_bands(counts, minimum_count, maximum_gap=3):
    active = [index for index, count in enumerate(counts) if count >= minimum_count]
    if not active:
        return []
    bands = []
    start = previous = active[0]
    for index in active[1:]:
        if index - previous > maximum_gap + 1:
            bands.append((start, previous + 1))
            start = index
        previous = index
    bands.append((start, previous + 1))
    return bands


def create_map_sheet():
    source = remove_magenta_background(Image.open(MAP_GENERATED_SOURCE))
    alpha = source.getchannel("A")
    source_width, source_height = source.size

    row_counts = []
    for y in range(source_height):
        row_counts.append(sum(1 for value in alpha.crop((0, y, source_width, y + 1)).get_flattened_data() if value))
    row_bands = _projection_bands(row_counts, minimum_count=12, maximum_gap=4)
    if len(row_bands) != 5:
        raise RuntimeError(f"Expected 5 generated character rows, found {row_bands}")

    frames = []
    bounds = []
    for row_index, (top, bottom) in enumerate(row_bands):
        column_counts = []
        for x in range(source_width):
            column_counts.append(sum(1 for value in alpha.crop((x, top, x + 1, bottom)).get_flattened_data() if value))
        column_bands = _projection_bands(column_counts, minimum_count=5, maximum_gap=6)
        if len(column_bands) != 4:
            raise RuntimeError(f"Expected 4 characters in generated row {row_index}, found {column_bands}")
        for column_index, (left, right) in enumerate(column_bands):
            frame = source.crop((left, top, right, bottom))
            bbox = frame.getchannel("A").getbbox()
            if bbox is None:
                raise RuntimeError(f"Generated map frame {row_index},{column_index} is empty")
            character = frame.crop(bbox)
            frames.append(character)
            bounds.append(character.size)

    max_width = max(width for width, _ in bounds)
    max_height = max(height for _, height in bounds)
    scale = min(56 / max_width, 80 / max_height)
    output = Image.new("RGBA", (FRAME_WIDTH * 4, FRAME_HEIGHT * 5), (0, 0, 0, 0))
    for index, character in enumerate(frames):
        width = max(1, round(character.width * scale))
        height = max(1, round(character.height * scale))
        character = character.resize((width, height), Image.Resampling.NEAREST)
        row, column = divmod(index, 4)
        x = column * FRAME_WIDTH + (FRAME_WIDTH - width) // 2
        y = row * FRAME_HEIGHT + FRAME_HEIGHT - height - 4
        output.alpha_composite(character, (x, y))
    output.save(MAP_OUTPUT, optimize=True)


def remove_magenta_background(image):
    image = image.convert("RGBA")
    width, height = image.size
    pixels = image.load()
    visited = bytearray(width * height)
    queue = deque()
    for x in range(width):
        queue.append((x, 0)); queue.append((x, height - 1))
    for y in range(height):
        queue.append((0, y)); queue.append((width - 1, y))

    def is_magenta(x, y):
        r, g, b, a = pixels[x, y]
        return a > 0 and r > 145 and b > 110 and g < 135 and r - g > 55 and b - g > 45

    while queue:
        x, y = queue.popleft()
        idx = y * width + x
        if visited[idx] or not is_magenta(x, y):
            continue
        visited[idx] = 1
        pixels[x, y] = (0, 0, 0, 0)
        if x: queue.append((x - 1, y))
        if x + 1 < width: queue.append((x + 1, y))
        if y: queue.append((x, y - 1))
        if y + 1 < height: queue.append((x, y + 1))

    # Chroma trapped inside closed silhouettes (for example between the legs)
    # is not edge-connected, so remove every remaining unmistakable magenta pixel.
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a and r > 140 and b > 110 and g < 135 and r - g > 55 and b - g > 45:
                pixels[x, y] = (0, 0, 0, 0)

    # Remove magenta antialias fringe while preserving the turquoise braid and lime jacket.
    for _ in range(3):
        remove = []
        for y in range(1, height - 1):
            for x in range(1, width - 1):
                r, g, b, a = pixels[x, y]
                if not a:
                    continue
                h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                if 0.79 <= h <= 0.93 and s >= 0.42 and v >= 0.24:
                    if any(pixels[x + dx, y + dy][3] == 0 for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1))):
                        remove.append((x, y))
        if not remove:
            break
        for x, y in remove:
            r, g, b, _ = pixels[x, y]
            pixels[x, y] = (r, g, b, 0)
    return image


def create_battle_sprite():
    source = remove_magenta_background(Image.open(BATTLE_SOURCE))
    bbox = source.getchannel("A").getbbox()
    assert bbox is not None
    character = source.crop(bbox)
    target = Image.new("RGBA", (256, 383), (0, 0, 0, 0))
    character.thumbnail((246, 373), Image.Resampling.LANCZOS)
    target.alpha_composite(character, ((target.width - character.width) // 2, target.height - character.height - 5))
    target.save(BATTLE_OUTPUT, optimize=True)


def main():
    create_map_sheet()
    create_battle_sprite()
    print(MAP_OUTPUT)
    print(BATTLE_OUTPUT)


if __name__ == "__main__":
    main()

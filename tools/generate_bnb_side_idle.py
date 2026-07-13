from pathlib import Path
import colorsys

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tools" / "sources" / "bnb-rapper-side-idle-generated.png"
OUTPUT = ROOT / "assets" / "images" / "tameria" / "bnb-rapper-npc.png"
FRAME_WIDTH = 64
FRAME_HEIGHT = 88


def remove_magenta(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            unmistakable_chroma = r > 140 and b > 110 and g < 150 and r - g > 45 and b - g > 35
            magenta_fringe = 0.79 <= h <= 0.96 and s >= 0.32 and v >= 0.18
            if a and (unmistakable_chroma or magenta_fringe):
                pixels[x, y] = (0, 0, 0, 0)
    return image


def projection_bands(counts, minimum_count, maximum_gap=8):
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


def main() -> None:
    source = remove_magenta(Image.open(SOURCE))
    alpha = source.getchannel("A")
    column_counts = [
        sum(1 for value in alpha.crop((x, 0, x + 1, source.height)).get_flattened_data() if value)
        for x in range(source.width)
    ]
    columns = projection_bands(column_counts, minimum_count=8, maximum_gap=16)
    if len(columns) != 4:
        raise RuntimeError(f"Expected four side-idle sprites, found {columns}")

    frames = []
    for left, right in columns:
        frame = source.crop((left, 0, right, source.height))
        bbox = frame.getchannel("A").getbbox()
        if bbox is None:
            raise RuntimeError("Generated side-idle frame is empty")
        frames.append(frame.crop(bbox))

    max_width = max(frame.width for frame in frames)
    max_height = max(frame.height for frame in frames)
    scale = min(58 / max_width, 80 / max_height)

    original = Image.open(OUTPUT).convert("RGBA")
    if original.size[:2] not in {(256, 440), (256, 528)}:
        raise RuntimeError(f"Unexpected BNB rapper sheet size: {original.size}")
    output = Image.new("RGBA", (FRAME_WIDTH * 4, FRAME_HEIGHT * 6), (0, 0, 0, 0))
    output.alpha_composite(original.crop((0, 0, 256, 440)), (0, 0))

    for column, frame in enumerate(frames):
        width = max(1, round(frame.width * scale))
        height = max(1, round(frame.height * scale))
        frame = frame.resize((width, height), Image.Resampling.NEAREST)
        x = column * FRAME_WIDTH + (FRAME_WIDTH - width) // 2
        y = 5 * FRAME_HEIGHT + FRAME_HEIGHT - height - 4
        output.alpha_composite(frame, (x, y))

    output.save(OUTPUT, optimize=True)
    print(OUTPUT)


if __name__ == "__main__":
    main()

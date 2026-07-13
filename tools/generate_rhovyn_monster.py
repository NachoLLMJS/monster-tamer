from pathlib import Path
import colorsys

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tools" / "sources" / "rhovyn-robinhood-idle-generated.png"
OUTPUT = ROOT / "assets" / "images" / "monster-tamer" / "monsters" / "rhovyn-battle-idle.png"
FRAME_SIZE = 256
FRAME_COUNT = 4


def remove_magenta(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    pixels = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            obvious_chroma = r > 145 and b > 115 and g < 155 and r - g > 45 and b - g > 35
            magenta_fringe = 0.79 <= h <= 0.96 and s >= 0.32 and v >= 0.2
            if a and (obvious_chroma or magenta_fringe):
                pixels[x, y] = (0, 0, 0, 0)
    return image


def projection_bands(counts, minimum_count, maximum_gap=12):
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
    columns = projection_bands(column_counts, minimum_count=10, maximum_gap=24)
    if len(columns) != FRAME_COUNT:
        raise RuntimeError(f"Expected {FRAME_COUNT} Rhovyn frames, found {columns}")

    frames = []
    for left, right in columns:
        frame = source.crop((left, 0, right, source.height))
        bbox = frame.getchannel("A").getbbox()
        if bbox is None:
            raise RuntimeError("Generated Rhovyn frame is empty")
        frames.append(frame.crop(bbox))

    max_width = max(frame.width for frame in frames)
    max_height = max(frame.height for frame in frames)
    scale = min(228 / max_width, 240 / max_height)
    output = Image.new("RGBA", (FRAME_SIZE * FRAME_COUNT, FRAME_SIZE), (0, 0, 0, 0))

    for index, frame in enumerate(frames):
        width = max(1, round(frame.width * scale))
        height = max(1, round(frame.height * scale))
        frame = frame.resize((width, height), Image.Resampling.NEAREST)
        x = index * FRAME_SIZE + (FRAME_SIZE - width) // 2
        y = 246 - height
        output.alpha_composite(frame, (x, y))

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    output.save(OUTPUT, optimize=True)
    print(OUTPUT)


if __name__ == "__main__":
    main()

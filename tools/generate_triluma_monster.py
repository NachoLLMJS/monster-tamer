from pathlib import Path
import colorsys

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tools" / "sources" / "triluma-solana-idle-generated.png"
OUTPUT = ROOT / "assets" / "images" / "monster-tamer" / "monsters" / "triluma-battle-idle.png"
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
            magenta_fringe = 0.79 <= h <= 0.96 and s >= 0.38 and v >= 0.22
            if a and (obvious_chroma or magenta_fringe):
                pixels[x, y] = (0, 0, 0, 0)
    return image


def main() -> None:
    source = remove_magenta(Image.open(SOURCE))
    columns = [
        (round(index * source.width / FRAME_COUNT), round((index + 1) * source.width / FRAME_COUNT))
        for index in range(FRAME_COUNT)
    ]

    frames = []
    for left, right in columns:
        frame = source.crop((left, 0, right, source.height))
        bbox = frame.getchannel("A").getbbox()
        if bbox is None:
            raise RuntimeError("Generated Triluma frame is empty")
        frames.append(frame.crop(bbox))

    max_width = max(frame.width for frame in frames)
    max_height = max(frame.height for frame in frames)
    scale = min(244 / max_width, 232 / max_height)
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

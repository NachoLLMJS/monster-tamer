from pathlib import Path
import colorsys

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MAP_SOURCE = ROOT / "tools" / "sources" / "green-pirate-trainer-map-chibi-generated.png"
BATTLE_SOURCE = ROOT / "tools" / "sources" / "green-pirate-trainer-battle-generated.png"
MAP_OUTPUT = ROOT / "assets" / "images" / "tameria" / "green-pirate-jr-trainer.png"
BATTLE_OUTPUT = (
    ROOT / "assets" / "images" / "monster-tamer" / "battle" / "trainer_youth_boy_green_pirate.png"
)
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


def projection_bands(counts, minimum_count, maximum_gap=4):
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


def create_map_sheet() -> None:
    source = remove_magenta(Image.open(MAP_SOURCE))
    alpha = source.getchannel("A")

    row_counts = [
        sum(1 for value in alpha.crop((0, y, source.width, y + 1)).get_flattened_data() if value)
        for y in range(source.height)
    ]
    row_bands = projection_bands(row_counts, minimum_count=12)
    if len(row_bands) != 5:
        raise RuntimeError(f"Expected 5 generated rows, found {row_bands}")

    frames = []
    for row_index, (top, bottom) in enumerate(row_bands):
        column_counts = [
            sum(1 for value in alpha.crop((x, top, x + 1, bottom)).get_flattened_data() if value)
            for x in range(source.width)
        ]
        column_bands = projection_bands(column_counts, minimum_count=5, maximum_gap=7)
        if len(column_bands) != 4:
            raise RuntimeError(f"Expected 4 characters in row {row_index}, found {column_bands}")
        for column_index, (left, right) in enumerate(column_bands):
            frame = source.crop((left, top, right, bottom))
            bbox = frame.getchannel("A").getbbox()
            if bbox is None:
                raise RuntimeError(f"Generated frame {row_index},{column_index} is empty")
            frames.append(frame.crop(bbox))

    max_width = max(frame.width for frame in frames)
    max_height = max(frame.height for frame in frames)
    scale = min(58 / max_width, 80 / max_height)
    output = Image.new("RGBA", (FRAME_WIDTH * 4, FRAME_HEIGHT * 5), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        width = max(1, round(frame.width * scale))
        height = max(1, round(frame.height * scale))
        frame = frame.resize((width, height), Image.Resampling.NEAREST)
        row, column = divmod(index, 4)
        x = column * FRAME_WIDTH + (FRAME_WIDTH - width) // 2
        y = row * FRAME_HEIGHT + FRAME_HEIGHT - height - 4
        output.alpha_composite(frame, (x, y))
    output.save(MAP_OUTPUT, optimize=True)


def create_battle_sprite() -> None:
    source = remove_magenta(Image.open(BATTLE_SOURCE))
    bbox = source.getchannel("A").getbbox()
    if bbox is None:
        raise RuntimeError("Generated battle character is empty")
    character = source.crop(bbox)
    target = Image.new("RGBA", (256, 383), (0, 0, 0, 0))
    character.thumbnail((246, 373), Image.Resampling.LANCZOS)
    target.alpha_composite(character, ((target.width - character.width) // 2, target.height - character.height - 5))
    target.save(BATTLE_OUTPUT, optimize=True)


def main() -> None:
    MAP_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    BATTLE_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    create_map_sheet()
    create_battle_sprite()
    print(MAP_OUTPUT)
    print(BATTLE_OUTPUT)


if __name__ == "__main__":
    main()

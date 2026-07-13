from pathlib import Path
import colorsys

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "tools" / "sources"
MAP_OUTPUT_DIR = ROOT / "assets" / "images" / "tameria"
BATTLE_OUTPUT_DIR = ROOT / "assets" / "images" / "monster-tamer" / "battle"
FRAME_WIDTH = 64
FRAME_HEIGHT = 88

MAP_CHARACTERS = {
    "chibi-bnb-rapper-generated.png": "bnb-rapper-npc.png",
    "chibi-waterfront-man-generated.png": "waterfront-man-npc.png",
    "chibi-item-merchant-generated.png": "item-merchant-npc.png",
    "chibi-forest-ranger-generated.png": "forest-ranger-npc.png",
    "chibi-field-nurse-generated.png": "field-nurse-npc.png",
    "chibi-green-rival-generated.png": "green-rival-trainer.png",
    "chibi-inn-healer-generated.png": "inn-healer-npc.png",
}


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


def create_map_sheet(source_path: Path, output_path: Path) -> None:
    source = remove_magenta(Image.open(source_path))
    alpha = source.getchannel("A")
    row_counts = [
        sum(1 for value in alpha.crop((0, y, source.width, y + 1)).get_flattened_data() if value)
        for y in range(source.height)
    ]
    row_bands = projection_bands(row_counts, minimum_count=12)
    if len(row_bands) != 5:
        raise RuntimeError(f"{source_path.name}: expected 5 rows, found {row_bands}")

    frames = []
    for row_index, (top, bottom) in enumerate(row_bands):
        column_counts = [
            sum(1 for value in alpha.crop((x, top, x + 1, bottom)).get_flattened_data() if value)
            for x in range(source.width)
        ]
        column_bands = projection_bands(column_counts, minimum_count=5, maximum_gap=7)
        if len(column_bands) != 4:
            raise RuntimeError(f"{source_path.name}: row {row_index} has columns {column_bands}")
        for column_index, (left, right) in enumerate(column_bands):
            frame = source.crop((left, top, right, bottom))
            bbox = frame.getchannel("A").getbbox()
            if bbox is None:
                raise RuntimeError(f"{source_path.name}: frame {row_index},{column_index} is empty")
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
    output.save(output_path, optimize=True)


def create_battle_sprite() -> Path:
    source = remove_magenta(Image.open(SOURCE_DIR / "chibi-green-rival-battle-generated.png"))
    bbox = source.getchannel("A").getbbox()
    if bbox is None:
        raise RuntimeError("Generated green rival battle character is empty")
    character = source.crop(bbox)
    target = Image.new("RGBA", (256, 383), (0, 0, 0, 0))
    character.thumbnail((246, 373), Image.Resampling.LANCZOS)
    target.alpha_composite(character, ((target.width - character.width) // 2, target.height - character.height - 5))
    output_path = BATTLE_OUTPUT_DIR / "trainer_youth_boy_green_rival.png"
    target.save(output_path, optimize=True)
    return output_path


def main() -> None:
    MAP_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    BATTLE_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for source_name, output_name in MAP_CHARACTERS.items():
        output_path = MAP_OUTPUT_DIR / output_name
        create_map_sheet(SOURCE_DIR / source_name, output_path)
        print(output_path)
    print(create_battle_sprite())


if __name__ == "__main__":
    main()

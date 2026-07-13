from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "images" / "monster-tamer" / "map" / "forest_1_level_background.png"
OUTPUT = ROOT / "assets" / "images" / "monster-tamer" / "map" / "forest_1_level_background_cleared.png"

# Five 64 px boulder tiles occupy columns 7..11 in row 0. The row directly below
# is the same unobstructed grass surface, so it is the authoritative replacement.
ROCK_GATE_BOX = (7 * 64, 0, 12 * 64, 64)
GRASS_SOURCE_BOX = (7 * 64, 64, 12 * 64, 128)


def main() -> None:
    image = Image.open(SOURCE).convert("RGBA")
    grass = image.crop(GRASS_SOURCE_BOX)
    image.alpha_composite(grass, (ROCK_GATE_BOX[0], ROCK_GATE_BOX[1]))
    image.save(OUTPUT, optimize=True)
    print(OUTPUT)


if __name__ == "__main__":
    main()

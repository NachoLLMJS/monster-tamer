from pathlib import Path
import shutil

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
MAP_DIR = ROOT / "assets" / "images" / "monster-tamer" / "map"
BACKGROUND = MAP_DIR / "main_1_level_background.png"
BACKUP_DIR = MAP_DIR / "backups_robinhood_house"
BACKUP = BACKUP_DIR / "main_1_level_background_before_robinhood_house.png"
GENERATED_HOUSE_SOURCE = ROOT / "tools" / "sources" / "robinhood-house-generated.png"
GENERATED_HOUSE_ASSET = MAP_DIR / "robinhood-generated-house.png"
DOOR_SHEET = MAP_DIR / "mother-house-door.png"

# The replacement keeps the original house footprint and door anchor.
HOUSE_TARGET_BOX = (866, 4410, 1121, 4745)
DOOR_BOX = (1020, 4607, 1072, 4695)
OLD_STAIR_BOX = (1024, 4704, 1073, 4748)
CLEAN_GRASS_SOURCE_BOX = (1120, 4704, 1169, 4748)

# Silhouette of the complete house produced by OpenAI Codex Image Generation.
# A separate chimney polygon includes the pixels rising above the roof slope.
HOUSE_SOURCE_CROP_BOX = (116, 190, 961, 1325)
HOUSE_POLYGON = [
    (528, 190), (960, 385), (960, 680), (935, 690),
    (935, 1300), (816, 1300), (816, 1324), (640, 1324),
    (640, 1300), (143, 1300), (143, 680), (116, 680), (116, 385),
]
CHIMNEY_POLYGON = [(716, 224), (838, 224), (851, 453), (710, 453)]


def extract_generated_house() -> Image.Image:
    generated = Image.open(GENERATED_HOUSE_SOURCE).convert("RGBA")
    mask = Image.new("L", generated.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.polygon(HOUSE_POLYGON, fill=255)
    draw.polygon(CHIMNEY_POLYGON, fill=255)
    generated.putalpha(mask)
    generated = generated.crop(HOUSE_SOURCE_CROP_BOX)
    target_size = (HOUSE_TARGET_BOX[2] - HOUSE_TARGET_BOX[0], HOUSE_TARGET_BOX[3] - HOUSE_TARGET_BOX[1])
    generated = generated.resize(target_size, Image.Resampling.LANCZOS)
    # Keep the generated pixel-art texture crisp at native game scale.
    alpha = generated.getchannel("A")
    rgb = generated.convert("RGB").quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    generated = rgb.convert("RGBA")
    generated.putalpha(alpha.point(lambda value: 255 if value >= 96 else 0))
    generated.save(GENERATED_HOUSE_ASSET, optimize=True)
    return generated


def create_door_sheet(background: Image.Image) -> None:
    closed = background.crop(DOOR_BOX).convert("RGBA")
    sheet = Image.new("RGBA", (closed.width * 3, closed.height), (0, 0, 0, 0))
    sheet.alpha_composite(closed, (0, 0))

    # Door panel coordinates inside the generated-house crop. The closed frame
    # is the generated door; the next two frames pivot that same slab inward.
    panel_box = (10, 10, 45, 78)
    panel = closed.crop(panel_box)

    half = closed.copy()
    half_draw = ImageDraw.Draw(half)
    half_draw.rectangle(panel_box, fill=(18, 13, 11, 255))
    half_draw.rectangle((12, 13, 43, 77), fill=(34, 22, 17, 255))
    half_panel = panel.resize((18, panel.height), Image.Resampling.NEAREST)
    half.alpha_composite(half_panel, (27, panel_box[1]))
    half_draw.line((26, 11, 26, 78), fill=(6, 6, 5, 255), width=2)
    sheet.alpha_composite(half, (closed.width, 0))

    opened = closed.copy()
    opened_draw = ImageDraw.Draw(opened)
    opened_draw.rectangle(panel_box, fill=(14, 10, 9, 255))
    opened_draw.rectangle((12, 13, 42, 77), fill=(24, 15, 13, 255))
    slim_panel = panel.resize((8, panel.height), Image.Resampling.NEAREST)
    opened.alpha_composite(slim_panel, (37, panel_box[1]))
    opened_draw.line((36, 11, 36, 78), fill=(5, 5, 4, 255), width=2)
    sheet.alpha_composite(opened, (closed.width * 2, 0))
    sheet.save(DOOR_SHEET, optimize=True)


def main() -> None:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    if not BACKUP.exists():
        shutil.copy2(BACKGROUND, BACKUP)
    background = Image.open(BACKUP).convert("RGBA")
    clean_grass = background.crop(CLEAN_GRASS_SOURCE_BOX)
    background.alpha_composite(clean_grass, (OLD_STAIR_BOX[0], OLD_STAIR_BOX[1]))
    generated_house = extract_generated_house()
    background.alpha_composite(generated_house, (HOUSE_TARGET_BOX[0], HOUSE_TARGET_BOX[1]))
    background.save(BACKGROUND, optimize=True)
    DOOR_SHEET.unlink(missing_ok=True)
    print(BACKGROUND)
    print(GENERATED_HOUSE_ASSET)
    print(BACKUP)


if __name__ == "__main__":
    main()

import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MAP_PATH = ROOT / "assets" / "data" / "main_1.json"
BACKUP_PATH = ROOT / "assets" / "data" / "main_1.json.bak-before-collision-snapshot-v4"
WIDTH = 40
HEIGHT = 87
COLLISION_GID = 189


def find_collision_layer(layers):
    for layer in layers:
        if layer.get("name") == "Collision" and layer.get("type") == "tilelayer":
            return layer
        nested = find_collision_layer(layer.get("layers", []))
        if nested is not None:
            return nested
    return None


def xs(*values):
    result = []
    for value in values:
        result.extend(range(value[0], value[1] + 1) if isinstance(value, tuple) else [value])
    return result


# Exact delta exported by snapshot-v4-stable-grid. Coordinates are Tiled tile
# coordinates; each expected prior value is asserted before the write.
SET = {
    1: xs(17, 23, 24),
    2: xs(23, 24),
    3: xs(17, 23, 24),
    4: xs(17, 23, 24),
    5: xs(17, 23, 24),
    6: xs(17, 23, 24),
    7: xs(17, 23, 24),
    8: xs(17, 23, 24),
    9: xs(17, 23, 24),
    10: xs(17, 23, 24),
    11: xs(17, 23, 24),
    12: xs(17, 23),
    13: xs(17, 23, 24),
    14: xs(17, 23, 24),
    15: xs(17, 23, 24),
    16: xs((6, 15), 17, (23, 35)),
    17: xs(5, 35),
    19: xs((35, 37)),
}

CLEAR = {
    1: xs(22),
    2: xs(21, 22),
    3: xs((12, 16), 22),
    4: xs(12, 13),
    5: xs(12),
    6: xs(12, 13),
    7: xs(12),
    8: xs(12, 13),
    9: xs(12),
    10: xs(12, 13),
    11: xs(12),
    12: xs((12, 15), 21, 22),
    13: xs(22),
    14: xs(21, 22),
    15: xs(22),
    16: xs(18, 21, 22),
    17: xs(16, 22),
    18: xs((6, 17), (21, 34)),
}


def main():
    data = json.loads(MAP_PATH.read_text(encoding="utf-8"))
    assert (data["width"], data["height"], data["tilewidth"], data["tileheight"]) == (WIDTH, HEIGHT, 64, 64)
    layer = find_collision_layer(data["layers"])
    assert layer is not None
    assert (layer["width"], layer["height"], len(layer["data"])) == (WIDTH, HEIGHT, WIDTH * HEIGHT)

    changes = []
    unchanged = 0
    for y, columns in SET.items():
        for x in columns:
            index = y * WIDTH + x
            before = layer["data"][index]
            if before == COLLISION_GID:
                unchanged += 1
                continue
            assert before == 0, f"Unexpected tile value at ({x}, {y}): {before}"
            layer["data"][index] = COLLISION_GID
            changes.append((x, y, before, COLLISION_GID))
    for y, columns in CLEAR.items():
        for x in columns:
            index = y * WIDTH + x
            before = layer["data"][index]
            if before == 0:
                unchanged += 1
                continue
            assert before == COLLISION_GID, f"Unexpected tile value at ({x}, {y}): {before}"
            layer["data"][index] = 0
            changes.append((x, y, before, 0))

    if not BACKUP_PATH.exists():
        shutil.copy2(MAP_PATH, BACKUP_PATH)
    MAP_PATH.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Applied {len(changes)} collision edits from snapshot-v4-stable-grid ({unchanged} cells already matched)")
    print(f"Backup: {BACKUP_PATH}")


if __name__ == "__main__":
    main()

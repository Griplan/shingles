import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from ai.segmentation import SegmentationResult


def export_result(result: SegmentationResult, output: str | Path) -> Path:
    """Caller owns an empty/private output directory; never overwrite earlier runs."""
    folder = Path(output)
    if folder.exists() and any(folder.iterdir()):
        raise FileExistsError("Output must be empty; previous experiments are preserved.")
    folder.mkdir(parents=True, exist_ok=True, mode=0o700)
    original = Image.fromarray(result.image)
    original.save(folder / "original.png")
    w, h = original.size
    for ri, group in enumerate(result.local_masks or []):
        for ci, local in enumerate(group):
            Image.fromarray(local.astype(np.uint8)*255).save(folder/f'local-{ri}-candidate-{ci}-mask.png')
    for candidate, mask in zip(result.record["candidates"], result.masks):
        name = candidate["candidate_id"]
        Image.fromarray(mask.astype(np.uint8) * 255).save(folder / candidate["mask_ref"])
        rgba = np.zeros((h, w, 4), dtype=np.uint8)
        rgba[mask] = (0, 180, 130, 95)
        layer = Image.fromarray(rgba)
        layer.save(folder / f"{name}-alpha.png")
        Image.alpha_composite(original.convert("RGBA"), layer).save(folder / f"{name}-overlay.png")
        outlines = original.copy()
        pen = ImageDraw.Draw(outlines)
        if candidate["geometry"]:
            for polygon in candidate["geometry"]["coordinates"]:
                for i, ring in enumerate(polygon):
                    pen.line([(x * w, y * h) for x, y in ring],
                             fill=(10, 190, 100) if i == 0 else (230, 80, 20), width=2)
        outlines.save(folder / f"{name}-polygons.png")
    prompted = original.copy()
    draw = ImageDraw.Draw(prompted)
    prompts = result.record["prompts"]
    for x, y, label in prompts["points"]:
        draw.ellipse((x-4, y-4, x+4, y+4), fill="lime" if label else "red", outline="black", width=1)
    if prompts["box"]:
        draw.rectangle(prompts["box"], outline="cyan", width=2)
    for box in prompts.get('additional_boxes', []):
        draw.rectangle(box, outline="cyan", width=2)
    prompted.save(folder / "prompts.png")
    path = folder / "result.json"
    path.write_text(json.dumps(result.record, ensure_ascii=False, indent=2, allow_nan=False))
    return path

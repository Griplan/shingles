"""Prepare de-identified crop and explicitly synthetic inputs, locally only."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw


def main():
    root = Path("ai/experiments/inputs")
    # Crop inspected NIH/CDC image to neck skin, removing facial features.
    crop = Image.open(root / "cdc-18254.jpg").convert("RGB").crop((90, 350, 390, 760))
    images = {"cdc-18254-neck-crop.png": crop}
    synthetic = Image.new("RGB", (320, 240), (210, 195, 180))
    draw = ImageDraw.Draw(synthetic)
    draw.ellipse((45, 50, 115, 120), fill=(165, 65, 85), outline=(115, 45, 55), width=2)
    draw.polygon([(200,135),(245,125),(268,180),(230,200),(200,175)], fill=(170,70,90))
    images["synthetic-disconnected.png"] = synthetic
    faint = Image.new("RGB", (320, 240), (210, 195, 180))
    ImageDraw.Draw(faint).ellipse((100, 60, 230, 190), fill=(207, 189, 176))
    images["synthetic-low-contrast.png"] = faint
    for name, im in images.items():
        path = root / name
        if path.exists():
            # Existing bytes remain untouched; only allow identical decoded pixels.
            assert Image.open(path).convert("RGB").tobytes() == im.tobytes(), "Existing experiment input differs"
        else:
            im.save(path)
    rows = []
    for name in ["cdc-21505.jpg", "cdc-21506.jpg", "cdc-18254.jpg", *images]:
        p = root / name
        rows.append({"id": name, "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
                     "dimensions": list(Image.open(p).size), "bytes": p.stat().st_size})
    print(json.dumps(rows, indent=2))


if __name__ == "__main__": main()

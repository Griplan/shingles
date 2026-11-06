"""Contact sheets of actual model outputs, all candidates visible, no cherry-picking."""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps


def main():
    parser = argparse.ArgumentParser(); parser.add_argument("run"); args = parser.parse_args()
    root = Path(args.run)
    summary = json.loads((root / "summary.json").read_text())
    rows = summary["records"]
    font = ImageFont.load_default(size=14)
    canvas = Image.new("RGB", (1120, 90 + len(rows) * 240 + 70), "white")
    draw = ImageDraw.Draw(canvas)
    draw.text((12, 8), "MobileSAM real inference | candidates are NOT diagnoses or confirmed lesion boundaries", fill="black", font=font)
    draw.text((12, 30), "Input prompts                      Candidate 0 overlay                Candidate 1 overlay                Candidate 2 overlay", fill="black", font=font)
    for index, row in enumerate(rows):
        y = 65 + index * 240
        draw.text((12, y), row["case"] + " | " + row["image_id"], fill="black", font=font)
        folder = root / row["case"]
        files = ["prompts.png"] + [f"candidate-{i}-overlay.png" for i in range(3)]
        for column, file in enumerate(files):
            picture = Image.open(folder / file).convert("RGB")
            picture.thumbnail((266, 195))
            canvas.paste(picture, (column * 280 + (280-picture.width)//2, y + 25))
            if column:
                candidate = row["candidates"][column-1]
                draw.text((column*280+5, y+222), f"parts={candidate['component_count']}  score={candidate['model_score']:.3f}", fill="black", font=font)
    footer = canvas.height-65
    draw.text((12, footer), "Images: CDC PHIL 21505/21506 (CDC / K.L. Herrmann), 18254 (NIAID), plus labelled synthetic inputs.", fill="black", font=font)
    draw.text((12, footer+20), "Sources free at ww​​wn.cdc.gov/phil. Local masks/crop added for experiments. No CDC/NIH/US Government endorsement.", fill="black", font=font)
    target = root / "all-candidates.jpg"
    if target.exists(): raise FileExistsError("Do not overwrite preview evidence")
    canvas.save(target, quality=92)
    # Four-column detailed views for the box and ambiguous boundary examples.
    for case in ("B_box", "F_unclear", "G_neck_crop"):
        if not (root/case).exists(): continue
        sheet = Image.new("RGB", (1400, 450), "white"); pen = ImageDraw.Draw(sheet)
        pen.text((12, 10), f"{case} | candidate 0 | original / binary mask / alpha overlay / polygon outlines", fill="black", font=font)
        for col, file in enumerate(["original.png", "candidate-0-mask.png", "candidate-0-overlay.png", "candidate-0-polygons.png"]):
            pic = Image.open(root / case / file).convert("RGB"); pic.thumbnail((340, 340))
            sheet.paste(pic, (col*350+(350-pic.width)//2, 50+(340-pic.height)//2))
        pen.text((12, 400), "Source: CDC PHIL / NIAID; originals freely available at CDC. Experimental overlays; no agency endorsement.", fill="black", font=font)
        sheet.save(root / f"{case}-detail.jpg", quality=92)
    print(str(target))


if __name__ == "__main__": main()

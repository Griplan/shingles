"""Nine real model runs; no fake prediction, no ground-truth medical metric."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path

from ai.errors import SegmentationError
from ai.export import export_result
from ai.inference.mobile_sam import MobileSAM
from ai.segmentation import segment_image


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--device", default="cpu", choices=["cpu", "mps", "cuda"])
    parser.add_argument("--output", required=True)
    parser.add_argument("--case", default=None)
    args = parser.parse_args()
    started_at = datetime.now(timezone.utc).isoformat()
    root = Path(args.output)
    root.mkdir(parents=True, exist_ok=False, mode=0o700)
    model = MobileSAM("ai/models/MobileSAM-source/weights/mobile_sam.pt", args.device)
    config = json.loads(Path("ai/experiments/cases.json").read_text())
    records = []
    for case in config["cases"]:
        if args.case and case["id"] != args.case: continue
        prompts = {"coordinate_space": config["coordinate_space"],
                   **{k: case[k] for k in ("points", "box") if k in case}}
        try:
            result = segment_image(Path("ai/experiments/inputs") / case["image"], prompts, model=model)
            export_result(result, root / case["id"])
            row = {"case": case["id"], "image_id": case["image"], "status": result.record["status"],
                   "timings": result.record["timings"], "environment": result.record["environment"],
                   "candidates": [{k: c.get(k) for k in ("candidate_id", "status", "model_score", "pixel_area",
                                                       "component_count", "hole_count", "vertex_count")}
                                  for c in result.record["candidates"]]}
        except SegmentationError as exc:
            row = {"case": case["id"], "status": "failed", "error": exc.as_dict()}
        records.append(row)
        print(json.dumps(row), flush=True)
        (root / "summary.json").write_text(json.dumps({"started_at": started_at,
            "model": model.metadata, "records": records, "medical_ground_truth": "NONE"}, indent=2))
    if not records or any(r["status"] != "needs_confirmation" for r in records): return 1
    return 0


if __name__ == "__main__": raise SystemExit(main())

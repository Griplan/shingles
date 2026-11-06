"""python -m ai.cli --image ... --prompts ... --output ..."""
import argparse
import json
from pathlib import Path
from uuid import uuid4

from ai.errors import SegmentationError
from ai.export import export_result
from ai.inference.mobile_sam import MobileSAM
from ai.preprocessing.image import prepare_image, validate_prompts
from ai.segmentation import segment_image


def main(argv=None):
    parser = argparse.ArgumentParser(description="Local prompted photo segmentation; human confirmation required.")
    parser.add_argument("--image", required=True)
    parser.add_argument("--prompts", required=True, help="JSON in orientation-corrected photo pixel coordinates")
    parser.add_argument("--output", required=True, help="New or empty private output directory")
    parser.add_argument("--checkpoint", default="ai/models/MobileSAM-source/weights/mobile_sam.pt")
    parser.add_argument("--device", default="cpu", choices=["cpu", "mps", "cuda"])
    parser.add_argument("--threads", default=4, type=int)
    parser.add_argument("--simplify-px", default=0.0, type=float)
    args = parser.parse_args(argv)
    out = Path(args.output)
    if out.exists() and (not out.is_dir() or any(out.iterdir())):
        print(json.dumps({"status": "failed", "error": {"code": "OUTPUT_EXISTS", "message": "Use a new output directory."}}))
        return 2
    try:
        out.mkdir(parents=True, exist_ok=True, mode=0o700)
        import math
        if not math.isfinite(args.simplify_px) or args.simplify_px < 0:
            raise SegmentationError("INVALID_SIMPLIFICATION", "Use a finite nonnegative simplification tolerance.")
        try:
            path = Path(args.prompts)
            if path.stat().st_size > 16384:
                raise ValueError()
            prompts = json.loads(path.read_text())
        except (OSError, ValueError):
            raise SegmentationError("INVALID_PROMPTS", "Cannot read bounded prompts JSON.") from None
        # Validate inputs before allocating a model.
        prepared = prepare_image(args.image)
        validate_prompts(prompts, prepared.metadata["width"], prepared.metadata["height"])
        del prepared
        model = MobileSAM(args.checkpoint, args.device, args.threads)
        result = segment_image(args.image, prompts, model=model, simplify_px=args.simplify_px)
        export_result(result, out)
        print(json.dumps({"result_id": result.record["result_id"], "status": result.record["status"],
                          "candidate_count": len(result.record["candidates"])}))
        return 0 if result.record["status"] == "needs_confirmation" else 3
    except SegmentationError as exc:
        error = exc.as_dict()
    except MemoryError:
        error = {"code": "OUT_OF_MEMORY", "message": "Insufficient memory; no result confirmed."}
    except OSError:
        error = {"code": "OUTPUT_FAILED", "message": "Cannot write experiment outputs."}
    failure = {"schema_version": "photo-segmentation-v1", "result_id": str(uuid4()),
               "status": "failed", "error": error, "candidates": []}
    try:
        (out / "failure.json").write_text(json.dumps(failure, indent=2))
    except OSError:
        pass
    print(json.dumps(failure))
    return 2


if __name__ == "__main__":
    raise SystemExit(main())

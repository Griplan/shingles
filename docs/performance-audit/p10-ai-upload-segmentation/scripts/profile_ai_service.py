"""P10 local MobileSAM/AI-session profile with public or synthetic input only.

The script uses the production MobileSAM and AISessions implementations in an
isolated temporary directory. It records phase timings, never image pixels,
prompts, result geometry, credentials or patient data.
"""
from __future__ import annotations

import json
import platform
import resource
import statistics
import sys
import tempfile
import time
from pathlib import Path

import psutil
from PIL import Image


ROOT = Path(__file__).resolve().parents[4]
sys.path[:0] = [str(ROOT), str(ROOT / "backend")]

from ai.inference.mobile_sam import MobileSAM  # noqa: E402
from app.schemas.ai import SegmentRequest  # noqa: E402
from app.services.ai_sessions import AISessions  # noqa: E402


def summary(values: list[float]) -> dict[str, float | int]:
    ordered = sorted(values)
    return {
        "count": len(values),
        "median": statistics.median(values),
        "p95": ordered[min(len(ordered) - 1, max(0, int(round(0.95 * (len(ordered) - 1)))))],
        "min": min(values),
        "max": max(values),
    }


def make_photo(folder: Path) -> Path:
    source = Image.open(ROOT / "ai/experiments/inputs/cdc-21505.jpg").convert("RGB")
    target = Image.new("RGB", (1920, 1080), "white")
    scale = min(1920 / source.width, 1080 / source.height)
    resized = source.resize(
        (round(source.width * scale), round(source.height * scale)),
        Image.Resampling.LANCZOS,
    )
    target.paste(
        resized,
        ((1920 - resized.width) // 2, (1080 - resized.height) // 2),
    )
    path = folder / "public-cdc-21505-1920x1080.jpg"
    target.save(path, quality=92, optimize=True)
    return path


def request(photo_id: str, revision: int, box: tuple[float, float, float, float],
            points: list[dict] | None = None, strategy: str = "context_crop") -> SegmentRequest:
    return SegmentRequest.model_validate({
        "photo_id": photo_id,
        "request_id": f"p10-{revision}",
        "prompt_revision": revision,
        "strategy": strategy,
        "prompts": {
            "coordinate_space": "photo_oriented_normalized_v1",
            "points": points or [],
            "box": {
                "xMin": box[0],
                "yMin": box[1],
                "xMax": box[2],
                "yMax": box[3],
            },
        },
    })


def run_one(service: AISessions, sid: str, token: str, payload: SegmentRequest,
            scenario: str, iteration: int) -> dict:
    process = psutil.Process()
    rss_before = process.memory_info().rss
    cpu_before = time.process_time()
    wall_before = time.perf_counter()
    response = service.segment(sid, token, payload)
    wall_ms = (time.perf_counter() - wall_before) * 1000
    cpu_ms = (time.process_time() - cpu_before) * 1000
    rss_after = process.memory_info().rss
    record = service.sessions[sid]["result"]["record"]
    timings = record["timings"]
    candidates = response["candidates"]
    return {
        "scenario": scenario,
        "iteration": iteration,
        "wall_ms": wall_ms,
        "cpu_ms": cpu_ms,
        "rss_before_bytes": rss_before,
        "rss_after_bytes": rss_after,
        "encode_ms": timings["encode_seconds"] * 1000,
        "decode_ms": timings["decode_seconds"] * 1000,
        "inference_ms": timings["inference_seconds"] * 1000,
        "polygon_ms": timings["polygon_seconds"] * 1000,
        "total_recorded_ms": timings["total_seconds"] * 1000,
        "strategy": record["model_transform"]["strategy"],
        "candidate_count": len(candidates),
        "valid_candidate_count": sum(candidate["status"] == "ok" for candidate in candidates),
        "response_bytes": len(json.dumps(response, ensure_ascii=False).encode()),
    }


def main() -> None:
    output = Path(sys.argv[1]).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    checkpoint = ROOT / "ai/models/MobileSAM-source/weights/mobile_sam.pt"
    load_started = time.perf_counter()
    model = MobileSAM(checkpoint, device="cpu", threads=4)
    model_load_ms = (time.perf_counter() - load_started) * 1000

    with tempfile.TemporaryDirectory(prefix="p10-ai-") as temporary:
        folder = Path(temporary)
        photo = make_photo(folder)
        service = AISessions(root=folder / "sessions", model_factory=lambda: model)
        created = service.create()
        sid = created["session_id"]
        token = created["session_token"]
        raw = photo.read_bytes()
        upload_started = time.perf_counter()
        uploaded = service.upload(sid, token, raw)
        upload_ms = (time.perf_counter() - upload_started) * 1000
        photo_id = uploaded["photo_id"]
        rows: list[dict] = []
        revision = 0

        same_box = (0.24, 0.28, 0.55, 0.72)
        for iteration in range(20):
            revision += 1
            rows.append(run_one(
                service, sid, token,
                request(photo_id, revision, same_box),
                "same_photo_same_box_context_crop", iteration,
            ))

        shifted_boxes = [
            (0.22 + 0.004 * (iteration % 6), 0.26 + 0.003 * (iteration % 5),
             0.53 + 0.004 * (iteration % 6), 0.70 + 0.003 * (iteration % 5))
            for iteration in range(10)
        ]
        for iteration, box in enumerate(shifted_boxes):
            revision += 1
            rows.append(run_one(
                service, sid, token,
                request(photo_id, revision, box),
                "same_photo_changed_box_context_crop", iteration,
            ))

        for iteration in range(10):
            revision += 1
            points = [
                {"x": 0.40, "y": 0.50, "label": 1},
                {"x": 0.72, "y": 0.62, "label": 0},
            ]
            rows.append(run_one(
                service, sid, token,
                request(photo_id, revision, same_box, points),
                "same_photo_foreground_background_points", iteration,
            ))

        for iteration in range(5):
            revision += 1
            rows.append(run_one(
                service, sid, token,
                request(photo_id, revision, same_box, strategy="full_image"),
                "same_photo_full_image", iteration,
            ))

        service.delete(sid, token)
        service.close()

    by_scenario: dict[str, dict] = {}
    for name in sorted({row["scenario"] for row in rows}):
        selected = [row for row in rows if row["scenario"] == name]
        by_scenario[name] = {
            "wall_ms": summary([row["wall_ms"] for row in selected]),
            "encode_ms": summary([row["encode_ms"] for row in selected]),
            "decode_ms": summary([row["decode_ms"] for row in selected]),
            "inference_ms": summary([row["inference_ms"] for row in selected]),
            "polygon_ms": summary([row["polygon_ms"] for row in selected]),
            "rss_after_bytes": summary([row["rss_after_bytes"] for row in selected]),
        }

    report = {
        "schema_version": "p10-ai-service-profile-v1",
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "environment": {
            "platform": platform.platform(),
            "python": platform.python_version(),
            "logical_cpus": psutil.cpu_count(),
            "model_threads": 4,
            "device": "cpu",
            "process_highwater_bytes": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
            * (1 if sys.platform == "darwin" else 1024),
        },
        "input": {
            "source": "public CDC PHIL 21505",
            "source_url": "https://wwwn.cdc.gov/phil/Details.aspx?pid=21505",
            "source_license": "CDC public-domain educational image; attribution required",
            "prepared_dimensions": [1920, 1080],
            "prepared_bytes": photo.stat().st_size if photo.exists() else len(raw),
            "medical_accuracy": "NOT_MEASURED",
        },
        "model": model.metadata,
        "model_load_ms": model_load_ms,
        "upload_decode_orient_encode_ms": upload_ms,
        "uploaded_image": uploaded["image"],
        "runs": rows,
        "summary": by_scenario,
        "interpretation_limits": [
            "Local Apple Mac CPU; not Tencent Cloud CPU or phone performance.",
            "Synthetic prompts on a public educational image; no clinical ground truth.",
            "MobileSAM encode and decode are model-reported monotonic timings.",
            "No image content, prompt vertices or result geometry are stored in this evidence.",
        ],
    }
    output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(f"PASS: {len(rows)} real local MobileSAM inferences")


if __name__ == "__main__":
    main()

"""Isolated 1-thread CPU profile for P8. No HTTP, remote access or patient data."""
import io
import json
import os
from pathlib import Path
import resource
import sys
from tempfile import TemporaryDirectory
from time import perf_counter

from PIL import Image
from ai.preprocessing import image as preprocess
from ai import segmentation
from app.schemas.ai import SegmentRequest
from app.services.ai_sessions import AISessions, AIError

ROOT = Path(__file__).resolve().parents[1]

def rss_mib():
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / (1024**2 if sys.platform == "darwin" else 1024)

def jpeg(image):
    out = io.BytesIO()
    image.save(out, format="JPEG", quality=94)
    return out.getvalue()

def main():
    os.environ["DERMATOME_ENV"] = "controlled"
    with Image.open(ROOT / "ai/experiments/inputs/cdc-21505.jpg") as source:
        photo = Image.new("RGB", (4032, 3024), "white")
        photo.paste(source.resize((4032, 2650), Image.Resampling.LANCZOS), (0, 187))
    original = jpeg(photo)
    prepared = jpeg(photo.resize((1920, 1440), Image.Resampling.LANCZOS))
    del photo
    report = {"device": "local CPU, controlled limits, one MobileSAM thread", "upload_bytes": len(prepared)}
    load = preprocess.prepare_image
    segment = segmentation.segment_image

    def timed_load(*args, **kwargs):
        start = perf_counter()
        output = load(*args, **kwargs)
        report["pillow_decode_orient_rgb_ms"] = (perf_counter() - start) * 1000
        return output

    def timed_segment(*args, **kwargs):
        output = segment(*args, **kwargs)
        report["model_and_geometry_seconds"] = output.record["timings"]
        report["model_transform"] = output.record["model_transform"] if "model_transform" in output.record else output.record.get("transform")
        return output

    preprocess.prepare_image = timed_load
    segmentation.segment_image = timed_segment
    with TemporaryDirectory(prefix="p8-profile-") as tmp:
        service = AISessions(root=tmp)
        try:
            created = service.create()
            sid, token = created["session_id"], created["session_token"]
            for source in (original, b" " * (10 * 1024 * 1024 + 1)):
                start = perf_counter()
                try:
                    service.upload(sid, token, source)
                    raise AssertionError("oversize upload was accepted")
                except AIError as exc:
                    report.setdefault("rejected", []).append(
                        {"code": exc.code, "http_status": exc.status, "elapsed_ms": (perf_counter() - start) * 1000}
                    )
                assert not (service.root / sid / "upload.bin").exists()
            assert [row["code"] for row in report["rejected"]] == ["INVALID_DIMENSIONS", "IMAGE_TOO_LARGE"]
            report["peak_rss_mib_before_upload"] = rss_mib()
            start = perf_counter()
            upload = service.upload(sid, token, prepared)
            report["upload_service_ms"] = (perf_counter() - start) * 1000
            report["peak_rss_mib_after_upload"] = rss_mib()
            prompts = {"coordinate_space":"photo_oriented_normalized_v1","points":[],
                       "box":{"xMin":.30714,"yMin":.52858,"xMax":.70714,"yMax":.79528}}
            start = perf_counter()
            result = service.segment(sid, token, SegmentRequest(photo_id=upload["photo_id"],
                request_id="P8_PROFILE", prompt_revision=1, prompts=prompts))
            report["segment_service_cold_ms"] = (perf_counter() - start) * 1000
            report["peak_rss_mib_after_segment"] = rss_mib()
            report["candidate_statuses"] = [c["status"] for c in result["candidates"]]
            service.delete(sid, token)
            assert not (service.root / sid).exists()
            report["temporary_session_removed"] = True
        finally:
            service.close()
    print(json.dumps(report, indent=2))

if __name__ == "__main__":
    main()

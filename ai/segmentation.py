"""Independent photo-space result contract. No body template or atlas dependency."""
from dataclasses import dataclass
from datetime import datetime, timezone
import platform
import resource
import hashlib
from time import perf_counter, process_time
from uuid import uuid4

import numpy as np
import psutil

from ai.errors import SegmentationError
from ai.preprocessing.image import PreparedImage, prepare_image, validate_prompts, MAX_PIXELS, MAX_SIDE
from ai.postprocessing.polygons import mask_to_polygons
from ai.postprocessing.quality import inspect_candidates
from ai.inference.local_regions import predict_regions


@dataclass
class SegmentationResult:
    record: dict
    image: np.ndarray
    masks: list[np.ndarray]
    local_masks: list | None = None


def segment_image(image, prompts: dict, *, model, simplify_px: float = 0.0, strategy: str = 'full_image') -> SegmentationResult:
    """Real inference via an explicitly loaded model. Failures raise safe typed errors.

    Candidate score is SAM's internal predicted mask IoU, not a medical score.
    No candidate is automatically confirmed or mapped to an anatomical template.
    """
    start, cpu_start = perf_counter(), process_time()
    # Services may pass an already validated, oriented image to avoid decoding twice.
    # The HTTP upload size cap applies to the uploaded file, not a larger lossless PNG.
    prepared = image if isinstance(image, PreparedImage) else prepare_image(image)
    rgb = prepared.rgb
    if (not isinstance(rgb, np.ndarray) or rgb.dtype != np.uint8 or rgb.ndim != 3
            or rgb.shape[2] != 3 or min(rgb.shape[:2]) < 8 or max(rgb.shape[:2]) > MAX_SIDE
            or rgb.shape[0] * rgb.shape[1] > MAX_PIXELS
            or prepared.metadata.get("width") != rgb.shape[1] or prepared.metadata.get("height") != rgb.shape[0]):
        raise SegmentationError("INVALID_IMAGE", "Invalid prepared image.")
    h, w = prepared.rgb.shape[:2]
    checked = validate_prompts(prompts, w, h)
    masks, scores, timings, transform, local_masks = predict_regions(model, prepared.rgb, checked, strategy)
    if (masks.dtype != np.bool_ or masks.ndim != 3 or masks.shape[1:] != (h, w)
            or len(masks) != len(scores) or len(masks) == 0 or not np.isfinite(scores).all()):
        raise SegmentationError("MODEL_OUTPUT_INVALID", "Model returned invalid candidate data.")
    candidates = []
    geometry_start = perf_counter()
    for index, (mask, score) in enumerate(zip(masks, scores)):
        try:
            converted = mask_to_polygons(mask, simplify_px)
        except SegmentationError as exc:
            converted = {"status": "contour_failed", "geometry": None, "error": exc.as_dict()}
        candidates.append({"candidate_id": f"candidate-{index}", "model_score": float(score),
                           "score_meaning": ("mean_of_local_sam_scores_not_diagnostic" if transform["strategy"]=="context_crop" else "sam_predicted_mask_iou_not_diagnostic"),
                           "mask_ref": f"candidate-{index}-mask.png", **converted})
    statuses = [c["status"] for c in candidates]
    display_order = inspect_candidates(candidates, masks, checked)
    for c,touches in zip(candidates,transform.get("crop_boundary_candidates",[])):
        if touches:c["quality"]["warnings"].append("CROP_EDGE")
    if "contour_failed" in statuses:
        status = "partial_failure" if "ok" in statuses else "contour_failed"
    elif "ok" in statuses:
        status = "needs_confirmation"
    else:
        status = "empty_mask"
    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    peak_bytes = peak if platform.system() == "Darwin" else peak * 1024
    record = {
        "schema_version": "photo-segmentation-v1", "result_id": str(uuid4()),
        "created_at": datetime.now(timezone.utc).isoformat(), "status": status,
        "error": None if status == "needs_confirmation" else {"code": status.upper(),
                 "message": "Inspect candidate statuses; result is not confirmed."},
        "requires_user_confirmation": True, "confirmed_candidate_id": None,
        "coordinate_space": "photo_oriented_normalized_v1", "image": {
            **prepared.metadata, "oriented_rgb_sha256": hashlib.sha256(prepared.rgb.tobytes()).hexdigest()},
        "coordinate_convention": "top_left_x_right_y_down; polygon pixel edges divided by width,height",
        "model": model.metadata, "prompts": checked, "model_transform": transform,
        "candidates": candidates, "display_order": display_order,
        "timings": {**timings, "polygon_seconds": perf_counter() - geometry_start,
                    "total_seconds": perf_counter() - start, "process_cpu_seconds": process_time() - cpu_start},
        "environment": {"platform": platform.platform(), "python": platform.python_version(),
                        "logical_cpus": psutil.cpu_count(), "rss_bytes": psutil.Process().memory_info().rss,
                        "process_peak_rss_bytes": peak_bytes, "gpu_utilization": "NOT_MEASURED"},
        "warnings": ["Candidate photo segmentation only; not diagnosis, anatomy recognition or registration.",
                     "Multiple candidates are alternatives; do not union them or select by medical confidence.",
                     "Crop exterior is not inferred; inspect context boundaries and omitted targets."],
    }
    return SegmentationResult(record, prepared.rgb, list(masks), local_masks)

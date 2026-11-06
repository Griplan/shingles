"""Controlled cold + three warm predictions, same image/prompts per device."""
import argparse
import hashlib
import json
import resource
from time import process_time, perf_counter

import psutil
from ai.inference.mobile_sam import MobileSAM
from ai.preprocessing.image import prepare_image, validate_prompts


def main():
    p = argparse.ArgumentParser(); p.add_argument("--device", choices=["cpu", "mps"], required=True)
    args = p.parse_args()
    model = MobileSAM("ai/models/MobileSAM-source/weights/mobile_sam.pt", args.device)
    photo = prepare_image("ai/experiments/inputs/cdc-21505.jpg")
    prompts = validate_prompts({"coordinate_space": "photo_oriented_pixels_v1", "box": [215,245,495,385]}, 700, 460)
    records = []
    for i in range(4):
        cpu = process_time(); wall = perf_counter()
        masks, scores, times, _ = model.predict(photo.rgb, prompts)
        row = {"iteration": i, "kind": "cold" if i == 0 else "warm", **times,
               "cpu_seconds": process_time()-cpu, "wall_seconds": perf_counter()-wall,
               "rss_bytes": psutil.Process().memory_info().rss,
               "process_peak_rss_macos_bytes": resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,
               "masks_sha256": hashlib.sha256(masks.tobytes()).hexdigest()}
        if args.device == "mps":
            row["mps_current_allocated_bytes"] = model.torch.mps.current_allocated_memory()
            row["mps_driver_allocated_bytes"] = model.torch.mps.driver_allocated_memory()
        records.append(row)
    print(json.dumps({"model":model.metadata,"records":records,"gpu_utilization":"NOT_MEASURED"}, indent=2))


if __name__ == "__main__": main()

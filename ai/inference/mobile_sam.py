import hashlib
from pathlib import Path
from time import perf_counter

import numpy as np

from ai.errors import SegmentationError

SOURCE_COMMIT = "f706ad9c4eb7f219c00d9050e46328518ffb65d2"
WEIGHT_GIT_BLOB = "7ef2d090979fd9853adf17b7a99c8b94a1c5a6a7"
WEIGHT_BYTES = 40728226


class MobileSAM:
    """One instance per sequential worker; SamPredictor is stateful, not thread safe."""

    def __init__(self, checkpoint: str | Path, device: str = "cpu", threads: int = 4):
        started = perf_counter()
        if device not in {"cpu", "mps", "cuda"} or type(threads) is not int or not 1 <= threads <= 16:
            raise SegmentationError("INVALID_RUNTIME", "Unsupported device or thread count.")
        try:
            import torch
            from mobile_sam import SamPredictor, sam_model_registry

            self.torch = torch
            if (device == "mps" and not torch.backends.mps.is_available()
                    or device == "cuda" and not torch.cuda.is_available()):
                raise SegmentationError("DEVICE_UNAVAILABLE", "Requested accelerator is unavailable.")
            torch.set_num_threads(threads)
            path = Path(checkpoint)
            if path.stat().st_size != WEIGHT_BYTES:
                raise SegmentationError("MODEL_CHECKSUM_MISMATCH", "Checkpoint does not match the pinned official model.")
            data = path.read_bytes()
            git_sha = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
            if git_sha != WEIGHT_GIT_BLOB:
                raise SegmentationError("MODEL_CHECKSUM_MISMATCH", "Checkpoint integrity verification failed.")
            sha256 = hashlib.sha256(data).hexdigest()
            del data
            model = sam_model_registry["vit_t"](checkpoint=None)
            state = torch.load(path, map_location="cpu", weights_only=True)
            model.load_state_dict(state, strict=True)
            del state
            # TinyViT caches attention biases in eval(): build cache on the target device.
            model.to(device=device)
            model.eval()
            self.predictor = SamPredictor(model)
            self.device = device
            self.sync()
            self.metadata = {"name": "MobileSAM", "variant": "vit_t", "package_version": "1.0",
                             "source_commit": SOURCE_COMMIT, "license": "Apache-2.0",
                             "weights_sha256": sha256, "weights_bytes": WEIGHT_BYTES,
                             "device": device, "dtype": "float32", "torch": torch.__version__,
                             "threads": threads, "load_seconds": perf_counter() - started,
                             "source": "https://github.com/ChaoningZhang/MobileSAM"}
        except SegmentationError:
            raise
        except MemoryError:
            raise SegmentationError("OUT_OF_MEMORY", "Insufficient memory loading model.") from None
        except Exception as exc:
            code = "OUT_OF_MEMORY" if "out of memory" in str(exc).lower() else "MODEL_LOAD_FAILED"
            raise SegmentationError(code, "Cannot load local pretrained model; check installation and checkpoint.") from None

    def sync(self):
        if self.device == "mps":
            self.torch.mps.synchronize()
        elif self.device == "cuda":
            self.torch.cuda.synchronize()

    def predict(self, rgb: np.ndarray, prompts: dict):
        try:
            self.sync()
            start = perf_counter()
            with self.torch.inference_mode():
                self.predictor.set_image(rgb, image_format="RGB")
                self.sync()
                encoded = perf_counter()
                points = prompts["points"]
                masks, scores, _ = self.predictor.predict(
                    point_coords=np.array([p[:2] for p in points], dtype=np.float32) if points else None,
                    point_labels=np.array([p[2] for p in points]) if points else None,
                    box=np.array(prompts["box"], dtype=np.float32) if prompts["box"] is not None else None,
                    multimask_output=True,
                )
                self.sync()
            finished = perf_counter()
            # Predictor maps prompts through ResizeLongestSide and masks back to original H,W.
            if masks.ndim != 3 or masks.shape[1:] != rgb.shape[:2] or not np.isfinite(scores).all():
                raise SegmentationError("MODEL_OUTPUT_INVALID", "Mask dimensions or candidate scores are invalid.")
            transform = {"kind": "sam_resize_longest_side_pad_then_postprocess",
                         "original_hw": list(rgb.shape[:2]),
                         "resized_hw": list(self.predictor.input_size), "padded_hw": [1024, 1024]}
            return masks.astype(bool), scores, {
                "encode_seconds": encoded - start, "decode_seconds": finished - encoded,
                "inference_seconds": finished - start,
            }, transform
        except SegmentationError:
            raise
        except MemoryError:
            raise SegmentationError("OUT_OF_MEMORY", "Insufficient memory during inference.") from None
        except Exception as exc:
            code = "OUT_OF_MEMORY" if "out of memory" in str(exc).lower() else "INFERENCE_FAILED"
            raise SegmentationError(code, "Model inference failed; no replacement prediction was produced.") from None
        finally:
            self.predictor.reset_image()

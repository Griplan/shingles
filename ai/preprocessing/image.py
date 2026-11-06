from dataclasses import dataclass
from pathlib import Path
import warnings
import math

from PIL import Image, ImageOps, UnidentifiedImageError
import numpy as np

from ai.errors import SegmentationError

MAX_BYTES = 20 * 1024 * 1024
MAX_PIXELS = 12_000_000
MAX_SIDE = 8192


@dataclass
class PreparedImage:
    rgb: np.ndarray
    metadata: dict


def prepare_image(path: str | Path, *, max_bytes=None, max_pixels=None) -> PreparedImage:
    """Prompts refer to THIS orientation-corrected image, not stored JPEG axes.

    No additional resize/crop is performed here. SAM owns its reversible resize.
    Exported previews intentionally contain no EXIF, filename or GPS metadata.
    """
    try:
        max_bytes = MAX_BYTES if max_bytes is None else max_bytes
        max_pixels = MAX_PIXELS if max_pixels is None else max_pixels
        p = Path(path)
        if p.stat().st_size > max_bytes:
            raise SegmentationError("IMAGE_TOO_LARGE", "Image exceeds 20 MiB.")
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(p) as source:
                if source.format not in {"JPEG", "PNG", "WEBP"}:
                    raise SegmentationError("UNSUPPORTED_FORMAT", "Use a still JPEG, PNG or WebP.")
                if getattr(source, "n_frames", 1) != 1:
                    raise SegmentationError("UNSUPPORTED_FORMAT", "Animated images are not supported.")
                w, h = source.size
                if min(w, h) < 8 or max(w, h) > MAX_SIDE or w * h > max_pixels:
                    raise SegmentationError("INVALID_DIMENSIONS", "Image dimensions exceed supported limits.")
                orientation = source.getexif().get(274, 1)
                if orientation not in range(1, 9):
                    raise SegmentationError("INVALID_ORIENTATION", "Invalid EXIF orientation.")
                upright = ImageOps.exif_transpose(source)
                # Transparent input is displayed and inferred on the same white background.
                rgba = upright.convert("RGBA")
                background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
                rgb = np.array(Image.alpha_composite(background, rgba).convert("RGB"))
                return PreparedImage(rgb, {
                    "stored_width": w, "stored_height": h,
                    "width": rgb.shape[1], "height": rgb.shape[0],
                    "exif_orientation": orientation, "orientation_applied": orientation != 1,
                    "orientation_policy": "exif_transpose_before_prompts",
                    "alpha_background": "white", "metadata_stripped": True,
                })
    except SegmentationError:
        raise
    except (Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise SegmentationError("INVALID_DIMENSIONS", "Decompression size exceeds safety limits.") from None
    except MemoryError:
        raise SegmentationError("OUT_OF_MEMORY", "Insufficient memory while decoding image.") from None
    except (OSError, ValueError, TypeError, UnidentifiedImageError, SyntaxError):
        raise SegmentationError("INVALID_IMAGE", "Image is missing, unreadable or corrupt.") from None


def validate_prompts(prompts: dict, width: int, height: int) -> dict:
    """Input uses oriented-photo pixel coordinates, output includes explicit basis."""
    def fail():
        raise SegmentationError("INVALID_PROMPTS", "Provide valid photo-pixel foreground points or a box.")

    def finite(v):
        try:
            return type(v) in (int, float) and math.isfinite(v)
        except (OverflowError, TypeError):
            return False

    if not isinstance(prompts, dict) or set(prompts) - {"coordinate_space", "points", "box", "additional_boxes"}:
        fail()
    if prompts.get("coordinate_space") != "photo_oriented_pixels_v1":
        fail()
    points = prompts.get("points", [])
    box = prompts.get("box")
    additional = prompts.get("additional_boxes", [])
    if not isinstance(additional, list) or len(additional) > 3 or (additional and box is None):
        fail()
    if not isinstance(points, list) or len(points) > 64:
        fail()
    for point in points:
        if not isinstance(point, list) or len(point) != 3:
            fail()
        x, y, label = point
        if not finite(x) or not finite(y) or not (0 <= x < width and 0 <= y < height):
            fail()
        if type(label) is not int or label not in (0, 1):
            fail()
    for region in ([box] if box is not None else []) + additional:
        if not isinstance(region, list) or len(region) != 4 or not all(finite(v) for v in region):
            fail()
        x0, y0, x1, y1 = region
        if not (0 <= x0 < x1 <= width and 0 <= y0 < y1 <= height):
            fail()
    if box is None and not any(p[2] == 1 for p in points):
        fail()
    result = {"coordinate_space": "photo_oriented_pixels_v1", "points": [p[:] for p in points],
              "box": box[:] if box is not None else None}
    if additional:
        result["additional_boxes"] = [b[:] for b in additional]
    return result

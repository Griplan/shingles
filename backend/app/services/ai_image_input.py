"""Decode an uploaded source with bounded memory before MobileSAM sees it."""
from dataclasses import dataclass
import math
from pathlib import Path
import warnings

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

from ai.errors import SegmentationError
from app.services.ai_limits import (
    MAX_SOURCE_PIXELS,
    MAX_SOURCE_SIDE,
    MAX_UPLOAD_BYTES,
    MIN_IMAGE_SIDE,
)


@dataclass(frozen=True)
class PreparedUpload:
    rgb: np.ndarray
    metadata: dict


def _oriented_size(width: int, height: int, orientation: int) -> tuple[int, int]:
    return (height, width) if orientation in (5, 6, 7, 8) else (width, height)


def _target_size(width: int, height: int, max_pixels: int) -> tuple[int, int]:
    if width * height <= max_pixels:
        return width, height
    ratio = math.sqrt(max_pixels / (width * height))
    target_width = max(MIN_IMAGE_SIDE, min(width, math.floor(width * ratio)))
    target_height = max(MIN_IMAGE_SIDE, min(height, math.floor(height * ratio)))
    while target_width * target_height > max_pixels:
        if target_width >= target_height and target_width > MIN_IMAGE_SIDE:
            target_width -= 1
        elif target_height > MIN_IMAGE_SIDE:
            target_height -= 1
        else:
            raise SegmentationError("INVALID_DIMENSIONS", "Image cannot be safely resized.")
    return target_width, target_height


def prepare_upload_image(
    path: str | Path,
    *,
    max_bytes: int = MAX_UPLOAD_BYTES,
    max_source_pixels: int = MAX_SOURCE_PIXELS,
    inference_pixels: int,
) -> PreparedUpload:
    """Validate source metadata, downscale before RGBA/RGB materialization.

    JPEG uses Pillow's draft decoder when possible. The full-resolution upload is
    therefore not converted to several full-size arrays merely to produce the
    bounded image used by MobileSAM and normalized photo coordinates.
    """
    try:
        image_path = Path(path)
        if image_path.stat().st_size > max_bytes:
            raise SegmentationError("IMAGE_TOO_LARGE", "Image exceeds the upload limit.")
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(image_path) as source:
                if source.format not in {"JPEG", "PNG", "WEBP"}:
                    raise SegmentationError(
                        "UNSUPPORTED_FORMAT", "Use a still JPEG, PNG or WebP."
                    )
                if getattr(source, "n_frames", 1) != 1:
                    raise SegmentationError(
                        "UNSUPPORTED_FORMAT", "Animated images are not supported."
                    )
                stored_width, stored_height = source.size
                if (
                    min(stored_width, stored_height) < MIN_IMAGE_SIDE
                    or max(stored_width, stored_height) > MAX_SOURCE_SIDE
                    or stored_width * stored_height > max_source_pixels
                ):
                    raise SegmentationError(
                        "INVALID_DIMENSIONS",
                        "Image dimensions exceed supported limits.",
                    )
                orientation = source.getexif().get(274, 1)
                if orientation not in range(1, 9):
                    raise SegmentationError(
                        "INVALID_ORIENTATION", "Invalid EXIF orientation."
                    )

                oriented_width, oriented_height = _oriented_size(
                    stored_width, stored_height, orientation
                )
                target_oriented_width, target_oriented_height = _target_size(
                    oriented_width, oriented_height, inference_pixels
                )
                if orientation in (5, 6, 7, 8):
                    target_stored_width = target_oriented_height
                    target_stored_height = target_oriented_width
                else:
                    target_stored_width = target_oriented_width
                    target_stored_height = target_oriented_height

                if source.format == "JPEG" and hasattr(source, "draft"):
                    source.draft(
                        "RGB", (target_stored_width, target_stored_height)
                    )
                source.thumbnail(
                    (target_stored_width, target_stored_height),
                    Image.Resampling.LANCZOS,
                )
                upright = ImageOps.exif_transpose(source)
                rgba = upright.convert("RGBA")
                background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
                rgb = np.array(
                    Image.alpha_composite(background, rgba).convert("RGB")
                )
                output_height, output_width = rgb.shape[:2]
                if output_width * output_height > inference_pixels:
                    raise SegmentationError(
                        "INVALID_DIMENSIONS",
                        "Server image resizing exceeded the inference budget.",
                    )
                return PreparedUpload(
                    rgb,
                    {
                        "stored_width": stored_width,
                        "stored_height": stored_height,
                        "width": output_width,
                        "height": output_height,
                        "exif_orientation": orientation,
                        "orientation_applied": orientation != 1,
                        "orientation_policy": "exif_transpose_before_prompts",
                        "alpha_background": "white",
                        "metadata_stripped": True,
                        "source_pixels": stored_width * stored_height,
                        "inference_pixel_limit": inference_pixels,
                        "server_resized": (
                            output_width != oriented_width
                            or output_height != oriented_height
                        ),
                        "resize_policy": "server_safe_downscale_before_rgb_v1",
                    },
                )
    except SegmentationError:
        raise
    except (Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise SegmentationError(
            "INVALID_DIMENSIONS", "Decompression size exceeds safety limits."
        ) from None
    except MemoryError:
        raise SegmentationError(
            "OUT_OF_MEMORY", "Insufficient memory while decoding image."
        ) from None
    except (OSError, ValueError, TypeError, UnidentifiedImageError, SyntaxError):
        raise SegmentationError(
            "INVALID_IMAGE", "Image is missing, unreadable or corrupt."
        ) from None

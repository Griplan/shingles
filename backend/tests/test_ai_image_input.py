import numpy as np
import pytest
from PIL import Image

from ai.errors import SegmentationError
from app.services.ai_image_input import prepare_upload_image
from app.services.ai_limits import (
    CONTROLLED_INFERENCE_PIXELS,
    MAX_SOURCE_PIXELS,
)


@pytest.mark.parametrize(
    "size",
    [(4032, 3024), (6000, 4000), (8064, 6048), (10000, 5000)],
)
def test_common_phone_photos_are_safely_downscaled(tmp_path, size):
    path = tmp_path / f"{size[0]}x{size[1]}.jpg"
    Image.new("RGB", size, (160, 130, 110)).save(
        path, "JPEG", quality=85, optimize=False
    )

    result = prepare_upload_image(
        path,
        max_bytes=50 * 1024 * 1024,
        max_source_pixels=MAX_SOURCE_PIXELS,
        inference_pixels=CONTROLLED_INFERENCE_PIXELS,
    )

    width, height = result.metadata["width"], result.metadata["height"]
    assert result.rgb.shape == (height, width, 3)
    assert result.metadata["source_pixels"] == size[0] * size[1]
    assert width * height <= CONTROLLED_INFERENCE_PIXELS
    assert abs(width / height - size[0] / size[1]) < 0.002
    assert result.metadata["server_resized"] is True
    assert result.metadata["resize_policy"] == "server_safe_downscale_before_rgb_v1"


def test_exif_orientation_is_applied_before_downscale(tmp_path):
    data = np.zeros((240, 320, 3), np.uint8)
    data[:, :160] = (255, 0, 0)
    data[:, 160:] = (0, 0, 255)
    image = Image.fromarray(data)
    exif = Image.Exif()
    exif[274] = 6
    path = tmp_path / "rotated.jpg"
    image.save(path, "JPEG", exif=exif)

    result = prepare_upload_image(
        path,
        inference_pixels=30_000,
    )

    assert result.metadata["stored_width"] == 320
    assert result.metadata["stored_height"] == 240
    assert result.metadata["width"] == 150
    assert result.metadata["height"] == 200
    assert result.metadata["orientation_applied"] is True
    assert np.all(result.rgb[0, 0, 0] > 200)
    assert np.all(result.rgb[-1, 0, 2] > 200)


def test_transparent_input_uses_white_background(tmp_path):
    path = tmp_path / "transparent.png"
    Image.new("RGBA", (16, 16), (255, 0, 0, 0)).save(path)

    result = prepare_upload_image(
        path,
        inference_pixels=CONTROLLED_INFERENCE_PIXELS,
    )

    assert np.all(result.rgb == 255)
    assert result.metadata["alpha_background"] == "white"


def test_source_byte_and_pixel_limits_are_checked(tmp_path):
    path = tmp_path / "image.png"
    Image.new("RGB", (8, 8), "white").save(path)
    with pytest.raises(SegmentationError) as byte_error:
        prepare_upload_image(path, max_bytes=2, inference_pixels=100)
    assert byte_error.value.code == "IMAGE_TOO_LARGE"

    with pytest.raises(SegmentationError) as pixel_error:
        prepare_upload_image(
            path,
            max_source_pixels=63,
            inference_pixels=100,
        )
    assert pixel_error.value.code == "INVALID_DIMENSIONS"


@pytest.mark.parametrize("kind,code", [
    ("corrupt", "INVALID_IMAGE"),
    ("gif", "UNSUPPORTED_FORMAT"),
    ("tiny", "INVALID_DIMENSIONS"),
])
def test_invalid_sources_fail_closed(tmp_path, kind, code):
    path = tmp_path / "image"
    if kind == "corrupt":
        path.write_bytes(b"not an image")
    elif kind == "gif":
        Image.new("RGB", (16, 16), "white").save(path, "GIF")
    else:
        Image.new("RGB", (4, 16), "white").save(path, "PNG")

    with pytest.raises(SegmentationError) as error:
        prepare_upload_image(
            path,
            inference_pixels=CONTROLLED_INFERENCE_PIXELS,
        )
    assert error.value.code == code

import json
import numpy as np
from PIL import Image
import pytest

from ai.errors import SegmentationError
from ai.preprocessing.image import prepare_image, validate_prompts


def test_exif_rotation_and_metadata_stripping(tmp_path):
    data = np.zeros((10, 20, 3), np.uint8)
    data[:, :10] = [255, 0, 0]
    data[:, 10:] = [0, 0, 255]
    image = Image.fromarray(data)
    exif = Image.Exif(); exif[274] = 6
    image.save(tmp_path / "rotated.png", exif=exif)
    result = prepare_image(tmp_path / "rotated.png")
    assert result.rgb.shape == (20, 10, 3)
    assert list(result.rgb[0, 0]) == [255, 0, 0]
    assert list(result.rgb[-1, 0]) == [0, 0, 255]
    assert result.metadata["stored_width"] == 20
    assert result.metadata["orientation_applied"]


def test_alpha_uses_same_white_background(tmp_path):
    path = tmp_path / "transparent.png"
    Image.new("RGBA", (8, 8), (255, 0, 0, 0)).save(path)
    assert np.all(prepare_image(path).rgb == 255)


@pytest.mark.parametrize("kind,code", [("corrupt", "INVALID_IMAGE"), ("missing", "INVALID_IMAGE"),
                                      ("gif", "UNSUPPORTED_FORMAT"), ("tiny", "INVALID_DIMENSIONS")])
def test_bad_images(tmp_path, kind, code):
    path = tmp_path / "image"
    if kind == "corrupt": path.write_bytes(b"not an image")
    if kind == "gif": Image.new("RGB", (8, 8)).save(path, format="GIF")
    if kind == "tiny": Image.new("RGB", (1, 8)).save(path, format="PNG")
    with pytest.raises(SegmentationError) as e:
        prepare_image(path)
    assert e.value.code == code


def test_oversize_checked_before_decode(tmp_path, monkeypatch):
    monkeypatch.setattr("ai.preprocessing.image.MAX_BYTES", 2)
    path = tmp_path / "too-big"; path.write_bytes(b"123")
    with pytest.raises(SegmentationError) as e: prepare_image(path)
    assert e.value.code == "IMAGE_TOO_LARGE"


def test_dimension_limit_before_decode(tmp_path, monkeypatch):
    monkeypatch.setattr("ai.preprocessing.image.MAX_PIXELS", 63)
    path = tmp_path / "size.png"; Image.new("RGB", (8, 8)).save(path)
    with pytest.raises(SegmentationError) as e: prepare_image(path)
    assert e.value.code == "INVALID_DIMENSIONS"


@pytest.mark.parametrize("prompts", [
    {}, {"points": [[4, 4, 1]]},
    {"coordinate_space": "normalized_template", "points": [[.5, .5, 1]]},
    {"points": [[8, 4, 1]]}, {"points": [[4, -1, 1]]},
    {"points": [[float("nan"), 1, 1]]}, {"points": [[True, 1, 1]]},
    {"points": [[10**1000, 1, 1]]},
    {"points": [[1, 1, True]]}, {"points": [[1, 1, 0]]}, {"points": [[1, 1]]},
    {"box": [2, 2, 1, 1]}, {"box": [0, 0, 8, 9]}, {"points": "bad"},
])
def test_invalid_prompts(prompts):
    # Missing coordinate basis is specifically tested above, all other examples explicit.
    if prompts and "coordinate_space" not in prompts and prompts != {"points": [[4, 4, 1]]}:
        prompts = {"coordinate_space": "photo_oriented_pixels_v1", **prompts}
    with pytest.raises(SegmentationError) as e: validate_prompts(prompts, 8, 8)
    assert e.value.code == "INVALID_PROMPTS"


def test_box_only_and_fg_bg_valid():
    base = {"coordinate_space": "photo_oriented_pixels_v1"}
    assert validate_prompts({**base, "box": [0, 0, 8, 8]}, 8, 8)["box"] == [0, 0, 8, 8]
    assert len(validate_prompts({**base, "points": [[1, 1, 1], [7, 7, 0]]}, 8, 8)["points"]) == 2


def test_invalid_image_type():
    with pytest.raises(SegmentationError) as e: prepare_image(None)
    assert e.value.code == "INVALID_IMAGE"

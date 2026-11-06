"""Contract/error tests use an explicit test double, not model feasibility evidence."""
import json
import numpy as np
import pytest
from PIL import Image

from ai.errors import SegmentationError
from ai.export import export_result
from ai.segmentation import segment_image
from ai.cli import main
from ai.inference.mobile_sam import MobileSAM

PROMPTS = {"coordinate_space": "photo_oriented_pixels_v1", "points": [[4, 4, 1]]}


class SyntheticPredictor:
    metadata = {"name": "TEST_DOUBLE_NOT_AI"}
    def predict(self, image, prompts):
        mask = np.zeros((1, *image.shape[:2]), bool)
        mask[0, 1:4, 2:6] = True
        return mask, np.array([.5]), {}, {}


@pytest.fixture
def photo(tmp_path):
    path = tmp_path / "input.png"; Image.new("RGB", (12, 8), "white").save(path)
    return path


def test_contract_and_export_alignment(photo, tmp_path):
    result = segment_image(photo, PROMPTS, model=SyntheticPredictor())
    assert result.record["coordinate_space"] == "photo_oriented_normalized_v1"
    assert result.record["status"] == "needs_confirmation"
    assert result.record["confirmed_candidate_id"] is None
    out = tmp_path / "out"
    export_result(result, out)
    alpha = np.array(Image.open(out / "candidate-0-alpha.png"))
    assert np.array_equal(alpha[:, :, 3] > 0, result.masks[0])
    assert Image.open(out / "candidate-0-mask.png").size == (12, 8)
    assert json.loads((out / "result.json").read_text())["image"]["width"] == 12
    with pytest.raises(FileExistsError): export_result(result, out)


def test_contour_failure_retains_original_mask(photo, monkeypatch):
    def fail(*args): raise SegmentationError("CONTOUR_FAILED", "Test failure")
    monkeypatch.setattr("ai.segmentation.mask_to_polygons", fail)
    result = segment_image(photo, PROMPTS, model=SyntheticPredictor())
    assert result.record["status"] == "contour_failed"
    assert result.masks[0].sum() == 12
    assert result.record["candidates"][0]["error"]["code"] == "CONTOUR_FAILED"


def test_empty_mask_not_success(photo):
    class Empty(SyntheticPredictor):
        def predict(self, image, prompts):
            return np.zeros((1, *image.shape[:2]), bool), np.array([.1]), {}, {}
    result = segment_image(photo, PROMPTS, model=Empty())
    assert result.record["status"] == "empty_mask"


def test_inference_failure_propagates(photo):
    class Broken(SyntheticPredictor):
        def predict(self, image, prompts):
            raise SegmentationError("INFERENCE_FAILED", "Test failure")
    with pytest.raises(SegmentationError): segment_image(photo, PROMPTS, model=Broken())


def test_bad_mask_dimensions_not_success(photo):
    class Wrong(SyntheticPredictor):
        def predict(self, image, prompts):
            return np.ones((1, 4, 4), bool), np.array([.1]), {}, {}
    with pytest.raises(SegmentationError) as e: segment_image(photo, PROMPTS, model=Wrong())
    assert e.value.code == "MODEL_OUTPUT_INVALID"


def test_cli_failure_json_and_no_sensitive_path(photo, tmp_path, capsys):
    prompt = tmp_path / "bad.json"; prompt.write_text("{}")
    out = tmp_path / "failure"
    assert main(["--image", str(photo), "--prompts", str(prompt), "--output", str(out)]) == 2
    assert json.loads((out / "failure.json").read_text())["error"]["code"] == "INVALID_PROMPTS"
    assert str(tmp_path) not in capsys.readouterr().out
    assert main(["--image", str(photo), "--prompts", str(prompt), "--output", str(out)]) == 2


def test_missing_model_and_wrong_model(tmp_path):
    with pytest.raises(SegmentationError) as e: MobileSAM(tmp_path / "absent")
    assert e.value.code == "MODEL_LOAD_FAILED"
    weight = tmp_path / "wrong.pt"; weight.write_bytes(b"wrong")
    with pytest.raises(SegmentationError) as e: MobileSAM(weight)
    assert e.value.code == "MODEL_CHECKSUM_MISMATCH"


def test_inference_oom_is_explicit():
    class BadPredictor:
        cleared = False
        def set_image(self, *args, **kwargs): raise RuntimeError("out of memory")
        def reset_image(self): self.cleared = True
    import torch
    model = MobileSAM.__new__(MobileSAM)
    model.device = "cpu"; model.torch = torch; model.predictor = BadPredictor()
    with pytest.raises(SegmentationError) as e: model.predict(np.zeros((8, 8, 3), np.uint8), PROMPTS)
    assert e.value.code == "OUT_OF_MEMORY" and model.predictor.cleared


def test_cli_existing_file_output_and_invalid_tolerance(photo, tmp_path):
    prompt = tmp_path / "prompt.json"; prompt.write_text(json.dumps(PROMPTS))
    file = tmp_path / "file"; file.write_text("preserve")
    args = ["--image", str(photo), "--prompts", str(prompt)]
    assert main([*args, "--output", str(file)]) == 2
    assert file.read_text() == "preserve"
    out = tmp_path / "invalid"
    assert main([*args, "--output", str(out), "--simplify-px", "nan"]) == 2
    assert json.loads((out / "failure.json").read_text())["error"]["code"] == "INVALID_SIMPLIFICATION"

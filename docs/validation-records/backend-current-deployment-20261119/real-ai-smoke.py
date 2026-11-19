"""Public-HTTP AI smoke for the deployed backend.

Only the repository's public CDC PHIL 21505 educational fixture is uploaded.
The script never prints access tokens, session keys, or image contents.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

import httpx


ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
BASE = "http://212.64.26.206/dermatome-test"
FIXTURE = ROOT / "ai/experiments/inputs/cdc-21505.jpg"


def timed(client: httpx.Client, method: str, path: str, **kwargs):
    started = time.perf_counter()
    response = client.request(method, path, **kwargs)
    return response, round((time.perf_counter() - started) * 1000, 2)


def expect(response: httpx.Response, status: int, name: str):
    if response.status_code != status:
        try:
            detail = response.json().get("error", {}).get("code")
        except ValueError:
            detail = response.text[:200]
        raise AssertionError(f"{name}: HTTP {response.status_code}, expected {status}, {detail}")


checks: list[dict] = []
access_headers: dict[str, str] = {}
session_headers: dict[str, str] = {}
session_id: str | None = None

with httpx.Client(base_url=BASE, trust_env=False, timeout=90) as client:
    try:
        response, ms = timed(client, "GET", "/api/v1/health")
        expect(response, 200, "health")
        checks.append({"name": "health", "status": 200, "ms": ms})

        response, ms = timed(client, "POST", "/api/v1/access/session", json={})
        expect(response, 200, "access_session")
        access_token = response.json()["access_token"]
        access_headers = {"authorization": f"Bearer {access_token}"}
        checks.append({"name": "access_session", "status": 200, "ms": ms})

        response, ms = timed(
            client, "GET", "/api/v1/ready", headers=access_headers
        )
        expect(response, 200, "ready")
        ready = response.json()
        checks.append(
            {
                "name": "ready",
                "status": 200,
                "ms": ms,
                "ai_model_loaded_before": ready.get("ai_model_loaded"),
            }
        )

        response, ms = timed(
            client, "POST", "/api/v1/ai/sessions", headers=access_headers, json={}
        )
        expect(response, 200, "ai_session_create")
        created = response.json()
        session_id = created["session_id"]
        session_headers = {
            **access_headers,
            "x-ai-session-key": created["session_token"],
        }
        checks.append({"name": "ai_session_create", "status": 200, "ms": ms})

        image_bytes = FIXTURE.read_bytes()
        response, ms = timed(
            client,
            "POST",
            f"/api/v1/ai/sessions/{session_id}/photo",
            headers=session_headers,
            files={"file": ("public-CDC21505.jpg", image_bytes, "image/jpeg")},
        )
        expect(response, 200, "photo_upload")
        photo = response.json()
        image = photo["image"]
        checks.append(
            {
                "name": "photo_upload",
                "status": 200,
                "ms": ms,
                "image_width": image["width"],
                "image_height": image["height"],
                "source_pixels": image.get("source_pixels"),
                "inference_pixel_limit": image.get("inference_pixel_limit"),
                "server_resized": image.get("server_resized"),
            }
        )

        payload = {
            "photo_id": photo["photo_id"],
            "request_id": "BACKEND_CURRENT_PUBLIC_AI",
            "prompt_revision": 1,
            "strategy": "context_crop",
            "prompts": {
                "coordinate_space": "photo_oriented_normalized_v1",
                "points": [],
                "box": {
                    "xMin": 215 / 700,
                    "yMin": 245 / 460,
                    "xMax": 495 / 700,
                    "yMax": 385 / 460,
                },
            },
        }
        response, ms = timed(
            client,
            "POST",
            f"/api/v1/ai/sessions/{session_id}/segment",
            headers=session_headers,
            json=payload,
        )
        expect(response, 200, "mobile_sam_segment")
        segmented = response.json()
        candidates = segmented["candidates"]
        ok_candidates = [c for c in candidates if c.get("status") == "ok"]
        if not ok_candidates:
            raise AssertionError("mobile_sam_segment returned no ok candidate")
        candidate = ok_candidates[0]
        checks.append(
            {
                "name": "mobile_sam_segment",
                "status": 200,
                "ms": ms,
                "coordinate_space": segmented["coordinate_space"],
                "candidate_count": len(candidates),
                "ok_candidate_count": len(ok_candidates),
                "selected_candidate": candidate["candidate_id"],
                "selected_area_ratio": candidate["area_ratio"],
                "selected_component_count": candidate["component_count"],
                "selected_hole_count": candidate["hole_count"],
            }
        )

        response, ms = timed(
            client,
            "POST",
            f"/api/v1/ai/sessions/{session_id}/confirm",
            headers=session_headers,
            json={
                "photo_id": photo["photo_id"],
                "result_id": segmented["result_id"],
                "candidate_id": candidate["candidate_id"],
                "prompt_revision": 1,
                "edit_revision": 0,
            },
        )
        expect(response, 200, "confirm")
        confirmed = response.json()
        checks.append(
            {
                "name": "confirm",
                "status": 200,
                "ms": ms,
                "confirmed_by_user": confirmed["confirmed_by_user"],
                "coordinate_space": confirmed["coordinate_space"],
                "geometry_type": confirmed["geometry"]["type"],
                "polygon_parts": len(confirmed["geometry"]["coordinates"]),
                "hole_count": sum(
                    len(part) - 1 for part in confirmed["geometry"]["coordinates"]
                ),
            }
        )

        response, ms = timed(
            client,
            "GET",
            f"/api/v1/ai/sessions/{session_id}/assets/{confirmed['mask_asset']}",
            headers=session_headers,
            params={"result_id": segmented["result_id"]},
        )
        expect(response, 200, "mask_asset")
        checks.append(
            {
                "name": "mask_asset",
                "status": 200,
                "ms": ms,
                "bytes": len(response.content),
                "png_signature": response.content.startswith(b"\x89PNG\r\n\x1a\n"),
            }
        )

        response, ms = timed(
            client,
            "DELETE",
            f"/api/v1/ai/sessions/{session_id}",
            headers=session_headers,
        )
        expect(response, 204, "session_delete")
        checks.append({"name": "session_delete", "status": 204, "ms": ms})

        response, ms = timed(
            client,
            "GET",
            f"/api/v1/ai/sessions/{session_id}/assets/photo.png",
            headers=session_headers,
        )
        expect(response, 410, "deleted_session_gone")
        checks.append({"name": "deleted_session_gone", "status": 410, "ms": ms})
    finally:
        if session_id:
            try:
                client.delete(
                    f"/api/v1/ai/sessions/{session_id}",
                    headers=session_headers,
                )
            except Exception:
                pass
        if access_headers:
            try:
                client.delete("/api/v1/access/session", headers=access_headers)
            except Exception:
                pass

report = {
    "endpoint": BASE,
    "input": "CDC PHIL 21505 public educational fixture",
    "input_sha256": __import__("hashlib").sha256(FIXTURE.read_bytes()).hexdigest(),
    "checks": checks,
    "passed": len(checks),
    "failed": 0,
    "medical_accuracy": "NOT_MEASURED",
}
(OUT / "real-ai-smoke.json").write_text(
    json.dumps(report, ensure_ascii=False, indent=2) + "\n"
)
print(json.dumps({"status": "PASSED", "passed": len(checks), "report": str(OUT / "real-ai-smoke.json")}, ensure_ascii=False))

"""Low-load, read-only cloud identity/readiness probe for P10.

The public test session is automatically issued by the existing controlled
service and revoked at the end. No administrator credential or image is used.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import httpx


BASE = "http://212.64.26.206/dermatome-test"


def timed_get(client: httpx.Client, url: str, headers: dict[str, str] | None = None) -> tuple[int, dict, float]:
    started = time.perf_counter()
    response = client.get(url, headers=headers or {})
    elapsed_ms = (time.perf_counter() - started) * 1000
    try:
        payload = response.json()
    except ValueError:
        payload = {}
    return response.status_code, payload, elapsed_ms


def main() -> None:
    output = Path(sys.argv[1]).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    headers: dict[str, str] = {}
    report: dict = {
        "schema_version": "p10-cloud-state-v1",
        "endpoint": BASE,
        "transport": "HTTP public-IP development channel; not HTTPS or phone validation",
        "measured_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
    }
    with httpx.Client(timeout=20, trust_env=False) as client:
        health_status, health, health_ms = timed_get(client, BASE + "/api/v1/health")
        access = client.post(BASE + "/api/v1/access/session", json={})
        access_payload = access.json()
        if access.status_code == 200:
            headers["authorization"] = "Bearer " + access_payload["access_token"]
        ready_status, ready, ready_ms = timed_get(client, BASE + "/api/v1/ready", headers)
        report.update({
            "health": {"status": health_status, "response": health, "wall_ms": health_ms},
            "access_session": {
                "status": access.status_code,
                "access_kind": access_payload.get("access_kind"),
                "token_type": access_payload.get("token_type"),
            },
            "ready": {"status": ready_status, "response": ready, "wall_ms": ready_ms},
        })
        if headers:
            revoke = client.delete(BASE + "/api/v1/access/session", headers=headers)
            report["access_session"]["revoke_status"] = revoke.status_code
    output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({
        "health": report["health"]["status"],
        "ready": report["ready"]["status"],
        "template_id": ready.get("identity", {}).get("template_id"),
        "template_version": ready.get("identity", {}).get("template_version"),
        "geometry_id": ready.get("identity", {}).get("geometry_id"),
        "atlas_id": ready.get("identity", {}).get("atlas_id"),
        "atlas_version": ready.get("identity", {}).get("atlas_version"),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

"""临时启动本地 Uvicorn，验证 V0 HTTP 响应后关闭；不使用患者数据。"""

from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

BACKEND = Path(__file__).resolve().parents[1] / "backend"


def request_json(url: str, method: str = "GET") -> tuple[int, object]:
    request = Request(
        url,
        data=b"{}" if method == "POST" else None,
        headers={"Content-Type": "application/json"},
        method=method,
    )
    try:
        response = urlopen(request, timeout=2)
    except HTTPError as exc:
        response = exc
    with response:
        return response.code, json.load(response)


def main() -> int:
    # 只监听回环地址，选空闲端口，不占用用户默认的 8000 端口。
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    command = [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(port)]
    base = f"http://127.0.0.1:{port}/api/v1"
    print("COMMAND:", " ".join(command), flush=True)
    with tempfile.TemporaryFile(mode="w+", encoding="utf-8") as log:
        process = subprocess.Popen(command, cwd=BACKEND, stdout=log, stderr=subprocess.STDOUT,
                                   env={**os.environ, 'DERMATOME_ENV': 'production', 'ENABLE_REFERENCE_MATCHING': '0'})
        try:
            deadline = time.monotonic() + 10
            while True:
                if process.poll() is not None:
                    raise RuntimeError(f"Uvicorn 启动失败，退出码 {process.returncode}")
                try:
                    status, payload = request_json(f"{base}/health")
                    break
                except (URLError, TimeoutError):
                    if time.monotonic() >= deadline:
                        raise RuntimeError("Uvicorn 健康检查等待超时")
                    time.sleep(0.1)
            expected = {"status": "ok", "project": "dermatome-mapper", "version": "v0"}
            if status != 200 or payload != expected:
                raise RuntimeError(f"health 响应不符合契约：{status} {payload}")
            print("PASSED: GET health", status, json.dumps(payload, ensure_ascii=False))
            for path, method, expected_status, expected_code in (("atlas", "GET", 501, "NOT_IMPLEMENTED"), ("evaluate", "POST", 403, "MATCHING_DISABLED")):
                status, payload = request_json(f"{base}/{path}", method)
                if status != expected_status or not isinstance(payload, dict) or payload.get("error", {}).get("code") != expected_code:
                    raise RuntimeError(f"{path} 响应不符合占位契约：{status} {payload}")
                print(f"PASSED: {method} {path}", status, json.dumps(payload, ensure_ascii=False))
        finally:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
            log.seek(0)
            print(log.read(), end="")
    print("PASSED: 本地 HTTP 冒烟结束，临时服务已关闭。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

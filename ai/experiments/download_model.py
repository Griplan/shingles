"""Explicit setup only: pinned official GitHub blobs, verified before writing.

No image leaves the machine. Inference never calls this downloader.
"""
import base64
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

from ai.inference.mobile_sam import SOURCE_COMMIT


def fetch(url, binary=False):
    with tempfile.TemporaryDirectory() as tmp:
        dest = Path(tmp) / "download"
        command = ["curl", "--fail", "--silent", "--show-error", "--location", "--max-time", "900"]
        if binary: command += ["-H", "Accept: application/vnd.github.raw+json"]
        subprocess.run([*command, "-o", str(dest), url], check=True)
        return dest.read_bytes()


def main():
    base = "https://api.github.com/repos/ChaoningZhang/MobileSAM"
    tree = json.loads(fetch(f"{base}/git/trees/{SOURCE_COMMIT}?recursive=1"))["tree"]
    root = Path("ai/models/MobileSAM-source")
    manifest = []
    for item in tree:
        name = item["path"]
        if item["type"] != "blob" or not (name.startswith("mobile_sam/") or
                name in {"setup.py", "LICENSE", "README.md", "weights/mobile_sam.pt"}): continue
        if ".." in Path(name).parts or Path(name).is_absolute(): raise ValueError("Unsafe source path")
        target = root / name
        data = target.read_bytes() if target.exists() else fetch(f"{base}/git/blobs/{item['sha']}", True)
        # Some GitHub responses use base64 JSON even when raw is requested.
        if data.startswith(b'{"sha"') or data.startswith(b'{\n  "sha"'):
            data = base64.b64decode(json.loads(data)["content"])
        actual = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
        if actual != item["sha"]: raise ValueError("Official Git blob mismatch; remove incomplete local download and retry")
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists(): target.write_bytes(data)
        manifest.append({"path": name, "git_blob": actual, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)})
    (root / "verified-files.json").write_text(json.dumps(manifest, indent=2))
    print("Official source and checkpoint verified; source installation is a separate step.")


if __name__ == "__main__": main()

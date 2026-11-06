"""TTL sweeper while the main service is stopped; never follows symlinks."""
import fcntl
import json
from pathlib import Path
import re
import shutil
import time
def cleanup(root,now=None):
 root=Path(root); now=time.time() if now is None else now
 if root.is_dir():
    with (root/'.owner-lock').open('a') as lock:
        try: fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError: return  # Running service owns cleanup.
        for path in root.iterdir():
            if not re.fullmatch('[a-f0-9]{32}',path.name) or path.is_symlink() or not path.is_dir():continue
            state=path/'session.json'
            try:
                if state.is_symlink() or state.stat().st_size>40*1024*1024:continue
                expired=json.loads(state.read_bytes())['expires_at']<=now
            except (OSError,ValueError,KeyError,TypeError):continue
            if expired:shutil.rmtree(path)

if __name__ == "__main__":
 cleanup(Path("/srv/dermatome-mapper/runtime/uploads/v5-ai-sessions"))

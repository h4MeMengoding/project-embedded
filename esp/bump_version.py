# Pre-build PlatformIO: naikkan patch versi (x.y.z -> x.y.z+1) setiap kali isi src/ atau include/ berubah,
# lalu tulis include/version.h (FW_VERSION). Build ulang tanpa perubahan tidak menaikkan versi (binary identik).
Import("env")
import hashlib
from pathlib import Path

root = Path(env["PROJECT_DIR"])
state = root / "version.txt"  # "<versi> <hash isi terakhir>"
h = hashlib.sha1()
for f in sorted([*(root / "src").rglob("*"), *(root / "include").rglob("*")]):
    if f.is_file() and f.name != "version.h":
        h.update(f.name.encode())
        h.update(f.read_bytes())
digest = h.hexdigest()[:12]

ver, last = ([*state.read_text().split(), ""])[:2] if state.exists() else ("1.0.0", "")
if digest != last:
    a, b, c = (int(x) for x in ver.split("."))
    ver = f"{a}.{b}.{c + 1}"
    state.write_text(f"{ver} {digest}\n")
(root / "include" / "version.h").write_text(f'#pragma once\n#define FW_VERSION "{ver}"  // dibuat bump_version.py, jangan diedit\n')
print(f"[versi] firmware {ver}")

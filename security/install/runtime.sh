#!/usr/bin/env bash
# Official release archives; checksums verified before extracting/executing.
set -euo pipefail
umask 077
tools_dir="${SECURITY_TOOLS_DIR:-$HOME/.local/share/open-seo-security}"
mkdir -p "$tools_dir/bin" "$tools_dir/runtime"
python3 - "$tools_dir" <<'PY'
import hashlib
import pathlib
import re
import sys
import tarfile
import urllib.request
import zipfile

root = pathlib.Path(sys.argv[1])
cache = root / "runtime"

def download(url, name):
    out = cache / name
    with urllib.request.urlopen(url, timeout=120) as response, out.open("wb") as target:
        while data := response.read(1024 * 1024):
            target.write(data)
    return out

if sys.platform != "linux":
    raise SystemExit("Runtime installer supports Linux x86_64; use official releases for other platforms.")
import platform
if platform.machine() not in ("x86_64", "amd64"):
    raise SystemExit("Runtime installer requires Linux x86_64.")

nuclei_version = "3.11.1"
asset = f"nuclei_{nuclei_version}_linux_amd64.zip"
base = f"https://github.com/projectdiscovery/nuclei/releases/download/v{nuclei_version}/"
checksums = download(base + f"nuclei_{nuclei_version}_checksums.txt", "nuclei-checksums.txt")
archive = download(base + asset, "nuclei.zip")
expected = next(line.split()[0] for line in checksums.read_text().splitlines() if line.split()[-1] == asset)
assert hashlib.sha256(archive.read_bytes()).hexdigest() == expected, "Nuclei checksum mismatch"
with zipfile.ZipFile(archive) as bundle:
    binary = root / "bin/nuclei"
    binary.write_bytes(bundle.read("nuclei"))
    binary.chmod(0o755)

zap_version = "2.17.0"
asset = f"ZAP_{zap_version}_Linux.tar.gz"
page = download(f"https://github.com/zaproxy/zaproxy/releases/tag/v{zap_version}", "zap-release.html")
row = next(row for row in re.findall(r"<tr>(.*?)</tr>", page.read_text(), re.S) if asset in row)
expected = re.search(r"[a-f0-9]{64}", row).group(0)
archive = download(f"https://github.com/zaproxy/zaproxy/releases/download/v{zap_version}/{asset}", "zap.tar.gz")
assert hashlib.sha256(archive.read_bytes()).hexdigest() == expected, "ZAP checksum mismatch"
with tarfile.open(archive) as bundle:
    bundle.extractall(cache, filter="data")
print(f"Installed checksum-verified Nuclei {nuclei_version} and OWASP ZAP {zap_version}.")
print("Burp Suite: install an officially licensed Community/Professional release from https://portswigger.net/burp/releases.")
print("Community supports manual proxy review, not automated vulnerability scanning. No license bypass or unofficial mirror is used.")
PY
"$tools_dir/bin/nuclei" -version
"$tools_dir/runtime/ZAP_2.17.0/zap.sh" -silent -version

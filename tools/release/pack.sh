#!/usr/bin/env bash
# The Windows release zip (docs/release.md): the production build (approved pieces only) and the launcher, nothing else.
# Usage: bash tools/release/pack.sh <version>   e.g. bash tools/release/pack.sh 0.1b   ->  release/pianor-0.1b-windows.zip
set -euo pipefail
version="${1:?usage: pack.sh <version>}"
cd "$(dirname "$0")/../.."
# The private pieces and portrait (d107) are built in where this machine has them: never in a release.
if [ -e private ]; then echo "refusing: this checkout has a private/ folder; pack from a clean clone" >&2; exit 1; fi
if [ -n "$(git status --porcelain)" ]; then echo "refusing: uncommitted changes" >&2; exit 1; fi
# VITE_PIANOR_RELEASE: the game leaves out what only a developer uses, such as the bug report (ft_1_16.AC4)
PIANOR_NO_PRIVATE_PIECES=1 VITE_PIANOR_RELEASE=1 npm run build
out="release/pianor-$version"
rm -rf "$out" "$out-windows.zip"
mkdir -p "$out/game"
cp -r dist/. "$out/game/"
# the hardware check page and its script are for developers
rm -f "$out/game/spike.html" "$out/game/assets"/spike-*
# the repository README's pictures (public/readme) are for the repository page, not the game
rm -rf "$out/game/readme"
cp tools/release/windows/pianor.ps1 "$out/"
# cmd.exe and Windows PowerShell 5.1 want CRLF line ends; the repository keeps LF (.gitattributes)
for f in tools/release/windows/*.cmd tools/release/windows/README.txt tools/release/windows/pianor.ps1; do
  sed 's/\r$//; s/$/\r/' "$f" > "$out/$(basename "$f")"
done
printf 'Pianor %s, built from %s\r\n' "$version" "$(git rev-parse --short HEAD)" > "$out/VERSION.txt"
cp LICENSE "$out/LICENSE.txt"
# zip where it is installed; else Windows' own PowerShell (Git Bash on Windows has no zip)
if command -v zip >/dev/null 2>&1; then
  (cd release && zip -qr "pianor-$version-windows.zip" "pianor-$version")
else
  ps="$(command -v pwsh || command -v powershell.exe || command -v powershell || true)"
  if [ -z "$ps" ]; then echo "refusing: neither zip nor PowerShell is installed" >&2; exit 1; fi
  (cd release && "$ps" -NoProfile -Command "Compress-Archive -Path 'pianor-$version' -DestinationPath 'pianor-$version-windows.zip' -Force")
fi
echo "release/pianor-$version-windows.zip"

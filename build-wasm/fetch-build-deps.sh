#!/usr/bin/env bash
# Pre-download every FetchContent tarball referenced by sherpa-onnx's build
# into ~/Downloads (CMake checks $HOME/Downloads first for each dep).
#
# Usage: bash fetch-build-deps.sh /path/to/sherpa-onnx-src
set -e

SRC=${1:?usage: bash fetch-build-deps.sh /path/to/sherpa-onnx-src}
DEST="$HOME/Downloads"
mkdir -p "$DEST"

seen=""
count=0

fetch() {
  local url="$1" expected="$2"
  local fname
  fname="$(basename "$url")"
  case "$seen" in *"|$fname|"*) return ;; esac
  seen="$seen|$fname|"
  count=$((count + 1))
  if [ -f "$DEST/$fname" ]; then
    echo "have  $fname"
    return
  fi
  echo "fetch $fname"
  curl -SL -o "$DEST/$fname" "$url" || { echo "FAILED $fname"; return; }
  if [ -n "$expected" ]; then
    local got
    got="$(sha256sum "$DEST/$fname" | cut -d' ' -f1)"
    if [ "$got" != "$expected" ]; then
      echo "HASH MISMATCH for $fname: got $got want $expected"
      rm -f "$DEST/$fname"
    else
      echo "  hash ok"
    fi
  fi
}

for f in "$SRC"/cmake/*.cmake "$SRC"/wasm/*/CMakeLists.txt; do
  [ -f "$f" ] || continue
  # Extract quoted https URLs ending in tar.gz/zip/tar.bz2 and any SHA256=
  while IFS= read -r url; do
    hash="$(grep -A4 "$url" "$f" | grep -o 'SHA256=[a-f0-9]\{64\}' | head -1 | cut -d= -f2)"
    fetch "$url" "$hash"
  done < <(grep -o '"https://[^"]*\.\(tar\.gz\|zip\|tar\.bz2\)"' "$f" | tr -d '"' | sort -u)
done

echo "done - $count distinct deps processed"

#!/usr/bin/env bash
# Builds the installable Millennium theme ZIP and verifies it.
#   scripts/package.sh            → dist/PlayStation-5-Millennium-Theme-v<version>.zip
# The ZIP holds ONE folder, PlayStation-5-Millennium-Theme/, with skin.json at its root —
# exactly what Millennium expects inside <Steam>/millennium/themes/.
# Developer tool only: users just download the ZIP from GitHub Releases.
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="PlayStation-5-Millennium-Theme"
VERSION="$(node -p "require('./skin.json').version")"
OUT="dist/${NAME}-v${VERSION}.zip"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

node scripts/validate.mjs >/dev/null
mkdir -p "$STAGE/$NAME" dist
# theme files only — tests, scripts, CI and screenshots stay in the repository
cp -R skin.json css js fonts README.md CHANGELOG.md LICENSE "$STAGE/$NAME/"
find "$STAGE" -name '.DS_Store' -delete
rm -f "$OUT"
( cd "$STAGE" && zip -qrX9 "$OLDPWD/$OUT" "$NAME" )

# verify: archive integrity, single top-level folder, and the extracted copy validates
unzip -tq "$OUT" >/dev/null
TOP="$(unzip -Z1 "$OUT" | cut -d/ -f1 | sort -u)"
[ "$TOP" = "$NAME" ] || { echo "unexpected top-level entries: $TOP" >&2; exit 1; }
CHECK="$(mktemp -d)"
unzip -q "$OUT" -d "$CHECK"
node scripts/validate.mjs "$CHECK/$NAME" >/dev/null
rm -rf "$CHECK"
( cd dist && sha256sum "$(basename "$OUT")" > "$(basename "$OUT").sha256" )
echo "$OUT"
echo "files: $(unzip -Z1 "$OUT" | grep -vc '/$')  size: $(du -h "$OUT" | cut -f1)  sha256: $(cut -d' ' -f1 "$OUT.sha256")"

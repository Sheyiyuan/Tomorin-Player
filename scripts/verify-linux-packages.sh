#!/usr/bin/env bash
set -euo pipefail

ARTIFACT_ROOT=${1:-artifacts}
DEB_PATH=$(find "$ARTIFACT_ROOT" -type f -name '*.deb' -print -quit)
RPM_PATH=$(find "$ARTIFACT_ROOT" -type f -name '*.rpm' -print -quit)

[[ -n "$DEB_PATH" ]] || { echo "DEB package not found below $ARTIFACT_ROOT" >&2; exit 1; }
[[ -n "$RPM_PATH" ]] || { echo "RPM package not found below $ARTIFACT_ROOT" >&2; exit 1; }

docker run --rm \
  -v "$(dirname "$DEB_PATH"):/packages:ro" \
  debian:bookworm-slim \
  sh -euc '
    apt-get update
    apt-get install -y "/packages/'"$(basename "$DEB_PATH")"'"
    dpkg-query -W -f="${Status}\n" half-beat | grep -q "install ok installed"
    ! ldd /usr/bin/half-beat | grep -q "not found"
    apt-get remove -y half-beat
  '

docker run --rm \
  -v "$(dirname "$RPM_PATH"):/packages:ro" \
  fedora:43 \
  sh -euc '
    dnf install -y "/packages/'"$(basename "$RPM_PATH")"'"
    rpm -q half-beat
    ! ldd /usr/bin/half-beat | grep -q "not found"
    dnf remove -y half-beat
  '

echo "Debian and Fedora package dependency verification passed."

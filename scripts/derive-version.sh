#!/bin/bash
# Derive version for builds
# Usage: derive-version.sh
# Outputs: version string to stdout

set -euo pipefail

if [[ "${GITHUB_REF_TYPE:-}" == "tag" ]]; then
    # For tagged releases, use the tag name (remove 'v' prefix)
    VERSION="${GITHUB_REF_NAME#v}"
    echo "Tagged release version: ${VERSION}" >&2
else
    # For dev builds, increment patch version from latest tag
    echo "Deriving dev version..." >&2
    
    # Get latest tag
    LATEST_TAG=$(git tag --list 'v*' --sort=-v:refname | head -n1 || echo "")
    echo "Latest tag: ${LATEST_TAG:-none}" >&2
    
    BASE_VER=${LATEST_TAG#v}
    
    # Handle case where no tags exist or tag format is invalid
    if [[ -z "$BASE_VER" || "$BASE_VER" == "$LATEST_TAG" ]]; then 
        echo "No valid tags found, using base version 0.0.0" >&2
        BASE_VER="0.0.0"
    fi
    
    # Parse the stable tag baseline.
    if [[ $BASE_VER =~ ^([0-9]+)\.([0-9]+)\.([0-9]+) ]]; then
        MAJOR=${BASH_REMATCH[1]}
        MINOR=${BASH_REMATCH[2]}
        PATCH=${BASH_REMATCH[3]}
        echo "Parsed base version: ${MAJOR}.${MINOR}.${PATCH}" >&2
    else
        echo "Invalid version format in tag, using 0.0.0" >&2
        MAJOR=0
        MINOR=0
        PATCH=0
    fi

    NEXT_PATCH=$((PATCH + 1))
    NEXT_VER="${MAJOR}.${MINOR}.${NEXT_PATCH}"

    # A planned minor/major release can be declared in package.json before a
    # stable tag exists. Use it when it is newer than the automatic patch bump.
    PACKAGE_VERSION=""
    if [[ -f frontend/package.json ]]; then
        PACKAGE_VERSION=$(sed -nE 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"([0-9]+\.[0-9]+\.[0-9]+)".*/\1/p' frontend/package.json)
    fi
    if [[ $PACKAGE_VERSION =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
        PACKAGE_MAJOR=${BASH_REMATCH[1]}
        PACKAGE_MINOR=${BASH_REMATCH[2]}
        PACKAGE_PATCH=${BASH_REMATCH[3]}
        if (( PACKAGE_MAJOR > MAJOR
            || (PACKAGE_MAJOR == MAJOR && PACKAGE_MINOR > MINOR)
            || (PACKAGE_MAJOR == MAJOR && PACKAGE_MINOR == MINOR && PACKAGE_PATCH >= NEXT_PATCH) )); then
            NEXT_VER=$PACKAGE_VERSION
        fi
    fi
    echo "Development target version: ${NEXT_VER}" >&2
    
    # Add dev suffix with date and commit hash
    DATE=$(date -u +%Y%m%d)
    COMMIT_SHA=${GITHUB_SHA:-$(git rev-parse HEAD 2>/dev/null || printf 'unknown')}
    HASH=${COMMIT_SHA:0:7}
    VERSION="${NEXT_VER}-dev.${DATE}.${HASH}"
    
    echo "Generated dev version: ${VERSION}" >&2
fi

echo "${VERSION}"

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
    
    # Parse version components more robustly
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
    
    # Increment patch version for dev builds
    PATCH=$((PATCH + 1))
    NEXT_VER="${MAJOR}.${MINOR}.${PATCH}"
    
    # Add dev suffix with date and commit hash
    DATE=$(date -u +%Y%m%d)
    HASH=${GITHUB_SHA::7}
    VERSION="${NEXT_VER}-dev.${DATE}.${HASH}"
    
    echo "Generated dev version: ${VERSION}" >&2
fi

echo "${VERSION}"
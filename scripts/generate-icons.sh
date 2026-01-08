#!/bin/bash
# Generate platform-specific icons from PNG source
# Usage: scripts/generate-icons.sh [platform]
# Platforms: windows, all (default: all)

set -euo pipefail

PLATFORM=${1:-all}
SOURCE_PNG="assets/icons/appicon-256.png"

if [[ ! -f "$SOURCE_PNG" ]]; then
    echo "Error: Source PNG not found: $SOURCE_PNG" >&2
    exit 1
fi

generate_windows_ico() {
    echo "Generating Windows ICO file..."
    mkdir -p build/windows
    
    if command -v convert >/dev/null 2>&1; then
        # Use ImageMagick to create multi-resolution ICO file
        echo "Using ImageMagick to generate multi-resolution ICO..."
        convert "$SOURCE_PNG" \
            \( -clone 0 -resize 16x16 \) \
            \( -clone 0 -resize 32x32 \) \
            \( -clone 0 -resize 48x48 \) \
            \( -clone 0 -resize 256x256 \) \
            -delete 0 build/windows/icon.ico
        echo "✓ Generated build/windows/icon.ico with resolutions: 16x16, 32x32, 48x48, 256x256"
        
        # Verify the generated ICO file
        if command -v identify >/dev/null 2>&1; then
            echo "ICO file info:"
            identify build/windows/icon.ico || true
        fi
        
    elif command -v icotool >/dev/null 2>&1; then
        # Fallback to icotool if ImageMagick is not available
        echo "Using icotool to generate ICO..."
        icotool -c -o build/windows/icon.ico "$SOURCE_PNG"
        echo "✓ Generated build/windows/icon.ico using icotool"
        
    else
        echo "Warning: Neither ImageMagick nor icotool found"
        echo "Available tools for ICO generation:"
        echo "  - ImageMagick: sudo apt install imagemagick"
        echo "  - icoutils: sudo apt install icoutils"
        echo "Copying PNG as fallback (may not work properly)..."
        cp "$SOURCE_PNG" build/windows/icon.ico
        echo "⚠ Copied PNG as build/windows/icon.ico (fallback)"
    fi
}

case "$PLATFORM" in
    windows)
        generate_windows_ico
        ;;
    all)
        generate_windows_ico
        ;;
    *)
        echo "Unknown platform: $PLATFORM" >&2
        echo "Supported platforms: windows, all" >&2
        exit 1
        ;;
esac

echo "Icon generation completed for platform: $PLATFORM"
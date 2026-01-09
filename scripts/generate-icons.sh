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
        # Use ImageMagick auto-resize feature for optimal ICO generation
        echo "Using ImageMagick auto-resize for clean multi-resolution ICO..."
        
        convert "$SOURCE_PNG" -define icon:auto-resize=256,128,64,48,32,16 build/windows/icon.ico
        
        echo "✓ Generated build/windows/icon.ico with auto-resized resolutions:"
        echo "  Sizes: 256x256(PNG), 128x128, 64x64, 48x48, 32x32, 16x16"
        echo "  Optimized for all Windows display scenarios"
        
        # Verify the generated ICO file
        if command -v identify >/dev/null 2>&1; then
            echo "ICO file info:"
            identify build/windows/icon.ico || true
            echo ""
            echo "File size: $(ls -lh build/windows/icon.ico | awk '{print $5}')"
        fi
        
    elif command -v icotool >/dev/null 2>&1; then
        # Fallback to icotool - generate standard sizes
        echo "Using icotool for ICO generation..."
        
        # Create temporary directory for individual icons
        TEMP_DIR=$(mktemp -d)
        trap "rm -rf $TEMP_DIR" EXIT
        
        # Generate standard Windows icon sizes
        sizes=(16 32 48 64 128 256)
        
        for size in "${sizes[@]}"; do
            if command -v convert >/dev/null 2>&1; then
                convert "$SOURCE_PNG" -resize ${size}x${size} -background transparent "$TEMP_DIR/icon_${size}.png"
            else
                # If no convert, just copy the original for the largest size
                if [[ $size -eq 256 ]]; then
                    cp "$SOURCE_PNG" "$TEMP_DIR/icon_${size}.png"
                else
                    echo "Warning: Cannot resize without ImageMagick, skipping ${size}x${size}"
                    continue
                fi
            fi
        done
        
        # Combine all sizes into ICO file
        icotool -c -o build/windows/icon.ico "$TEMP_DIR"/icon_*.png
        echo "✓ Generated build/windows/icon.ico using icotool with standard resolutions"
        
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
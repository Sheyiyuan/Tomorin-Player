package main

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"os"
)

const (
	designIconPath = "assets/icons/appicon.png"
	wailsIconPath  = "build/appicon.png"
	expectedSize   = 512
	pngRGBA        = 6
)

var pngSignature = []byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a}

type iconFile struct {
	image image.Image
}

func main() {
	designIcon, err := readIcon(designIconPath)
	if err != nil {
		fail(err)
	}
	wailsIcon, err := readIcon(wailsIconPath)
	if err != nil {
		fail(err)
	}

	if !samePixels(designIcon.image, wailsIcon.image) {
		fail(fmt.Errorf("%s pixels differ from %s", wailsIconPath, designIconPath))
	}

	fmt.Printf("Verified Wails app icon: %s (512x512 RGBA, source pixels match)\n", wailsIconPath)
}

func readIcon(path string) (*iconFile, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", path, err)
	}
	if len(data) < 33 || !bytes.Equal(data[:8], pngSignature) || string(data[12:16]) != "IHDR" {
		return nil, fmt.Errorf("%s is not a valid PNG with an IHDR header", path)
	}

	width := binary.BigEndian.Uint32(data[16:20])
	height := binary.BigEndian.Uint32(data[20:24])
	if width != expectedSize || height != expectedSize {
		return nil, fmt.Errorf("%s must be %dx%d, got %dx%d", path, expectedSize, expectedSize, width, height)
	}
	if data[25] != pngRGBA {
		return nil, fmt.Errorf("%s must use PNG RGBA color type, got %d", path, data[25])
	}

	decoded, err := png.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("decode %s: %w", path, err)
	}
	return &iconFile{image: decoded}, nil
}

func samePixels(left image.Image, right image.Image) bool {
	if left.Bounds() != right.Bounds() {
		return false
	}
	for y := left.Bounds().Min.Y; y < left.Bounds().Max.Y; y++ {
		for x := left.Bounds().Min.X; x < left.Bounds().Max.X; x++ {
			leftColor := color.NRGBA64Model.Convert(left.At(x, y)).(color.NRGBA64)
			rightColor := color.NRGBA64Model.Convert(right.At(x, y)).(color.NRGBA64)
			if leftColor != rightColor {
				return false
			}
		}
	}
	return true
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, "App icon verification failed:", err)
	os.Exit(1)
}

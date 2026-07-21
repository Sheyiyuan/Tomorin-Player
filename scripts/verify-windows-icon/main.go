package main

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"image"
	"image/color"
	_ "image/png"
	"os"

	"github.com/tc-hib/winres"
)

const generatedIconPath = "build/windows/icon.ico"

var expectedSizes = []int{16, 32, 48, 64, 128, 256}

func main() {
	if len(os.Args) != 2 {
		fail(fmt.Errorf("usage: go run ./scripts/verify-windows-icon <executable>"))
	}

	executablePath := os.Args[1]
	executable, err := os.Open(executablePath)
	if err != nil {
		fail(fmt.Errorf("open %s: %w", executablePath, err))
	}
	defer executable.Close()

	resources, err := winres.LoadFromEXE(executable)
	if err != nil {
		fail(fmt.Errorf("load PE resources from %s: %w", executablePath, err))
	}

	var groupIDs []winres.Identifier
	iconResourceCount := 0
	resources.WalkType(winres.RT_GROUP_ICON, func(resourceID winres.Identifier, _ uint16, _ []byte) bool {
		groupIDs = append(groupIDs, resourceID)
		return true
	})
	resources.WalkType(winres.RT_ICON, func(_ winres.Identifier, _ uint16, _ []byte) bool {
		iconResourceCount++
		return true
	})
	if len(groupIDs) != 1 {
		fail(fmt.Errorf("expected one RT_GROUP_ICON resource, got %d", len(groupIDs)))
	}
	if iconResourceCount != len(expectedSizes) {
		fail(fmt.Errorf("expected %d RT_ICON resources, got %d", len(expectedSizes), iconResourceCount))
	}

	embeddedIcon, err := resources.GetIcon(groupIDs[0])
	if err != nil {
		fail(fmt.Errorf("extract RT_GROUP_ICON resource: %w", err))
	}
	var embeddedICO bytes.Buffer
	if err := embeddedIcon.SaveICO(&embeddedICO); err != nil {
		fail(fmt.Errorf("rebuild embedded ICO: %w", err))
	}

	embeddedImages, err := parseICO(embeddedICO.Bytes())
	if err != nil {
		fail(fmt.Errorf("parse embedded ICO: %w", err))
	}
	generatedData, err := os.ReadFile(generatedIconPath)
	if err != nil {
		fail(fmt.Errorf("read %s: %w", generatedIconPath, err))
	}
	generatedImages, err := parseICO(generatedData)
	if err != nil {
		fail(fmt.Errorf("parse %s: %w", generatedIconPath, err))
	}

	if err := verifyImages(embeddedImages, generatedImages); err != nil {
		fail(err)
	}

	fmt.Printf("Verified Windows icon resources in %s: RT_GROUP_ICON=1, RT_ICON=%d, sizes=%v\n", executablePath, iconResourceCount, expectedSizes)
}

func parseICO(data []byte) (map[int]image.Image, error) {
	if len(data) < 6 || binary.LittleEndian.Uint16(data[0:2]) != 0 || binary.LittleEndian.Uint16(data[2:4]) != 1 {
		return nil, fmt.Errorf("invalid ICO header")
	}
	count := int(binary.LittleEndian.Uint16(data[4:6]))
	if count == 0 || len(data) < 6+count*16 {
		return nil, fmt.Errorf("invalid ICO directory")
	}

	images := make(map[int]image.Image, count)
	for index := 0; index < count; index++ {
		entry := 6 + index*16
		width := int(data[entry])
		height := int(data[entry+1])
		if width == 0 {
			width = 256
		}
		if height == 0 {
			height = 256
		}
		if width != height {
			return nil, fmt.Errorf("ICO entry %d is not square: %dx%d", index, width, height)
		}

		length := int(binary.LittleEndian.Uint32(data[entry+8 : entry+12]))
		offset := int(binary.LittleEndian.Uint32(data[entry+12 : entry+16]))
		if length <= 0 || offset < 0 || offset > len(data)-length {
			return nil, fmt.Errorf("ICO entry %d points outside the file", index)
		}
		decoded, _, err := image.Decode(bytes.NewReader(data[offset : offset+length]))
		if err != nil {
			return nil, fmt.Errorf("decode ICO entry %d: %w", index, err)
		}
		if decoded.Bounds().Dx() != width || decoded.Bounds().Dy() != height {
			return nil, fmt.Errorf("ICO entry %d header and image dimensions differ", index)
		}
		if _, exists := images[width]; exists {
			return nil, fmt.Errorf("duplicate %dx%d ICO entry", width, height)
		}
		images[width] = decoded
	}
	return images, nil
}

func verifyImages(embedded map[int]image.Image, generated map[int]image.Image) error {
	if len(embedded) != len(expectedSizes) || len(generated) != len(expectedSizes) {
		return fmt.Errorf("expected %d icon sizes, got embedded=%d generated=%d", len(expectedSizes), len(embedded), len(generated))
	}
	for _, size := range expectedSizes {
		embeddedImage, embeddedOK := embedded[size]
		generatedImage, generatedOK := generated[size]
		if !embeddedOK || !generatedOK {
			return fmt.Errorf("missing %dx%d icon: embedded=%t generated=%t", size, size, embeddedOK, generatedOK)
		}
		if !samePixels(embeddedImage, generatedImage) {
			return fmt.Errorf("embedded %dx%d icon differs from %s", size, size, generatedIconPath)
		}
	}
	return nil
}

func samePixels(left image.Image, right image.Image) bool {
	if left.Bounds().Size() != right.Bounds().Size() {
		return false
	}
	for y := 0; y < left.Bounds().Dy(); y++ {
		for x := 0; x < left.Bounds().Dx(); x++ {
			leftColor := color.NRGBA64Model.Convert(left.At(left.Bounds().Min.X+x, left.Bounds().Min.Y+y)).(color.NRGBA64)
			rightColor := color.NRGBA64Model.Convert(right.At(right.Bounds().Min.X+x, right.Bounds().Min.Y+y)).(color.NRGBA64)
			if leftColor != rightColor {
				return false
			}
		}
	}
	return true
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, "Windows icon verification failed:", err)
	os.Exit(1)
}

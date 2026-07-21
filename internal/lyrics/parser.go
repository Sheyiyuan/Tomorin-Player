// Package lyrics decodes and normalizes user-supplied LRC and text lyrics.
package lyrics

import (
	"bytes"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"

	"half-beat-player/internal/models"

	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/transform"
)

const MaxInputBytes = 1 << 20

var (
	timestampPattern = regexp.MustCompile(`\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]`)
	metadataPattern  = regexp.MustCompile(`^\[([A-Za-z][A-Za-z0-9_-]*):(.*)\]$`)
	timestampLike    = regexp.MustCompile(`\[\d{1,3}:`)
)

// Result is a decoded, normalized lyric document.
type Result struct {
	Text             string
	Format           string
	Encoding         string
	Lines            []models.LyricLine
	Metadata         map[string]string
	EmbeddedOffsetMS int
	Warnings         []string
	ValidLineCount   int
}

// Decode accepts UTF-8, UTF-8 with BOM and GB18030 input.
func Decode(data []byte) (string, string, error) {
	if len(data) > MaxInputBytes {
		return "", "", fmt.Errorf("歌词文件不能超过 1 MiB")
	}
	if bytes.HasPrefix(data, []byte{0xEF, 0xBB, 0xBF}) {
		data = data[3:]
		if !utf8.Valid(data) {
			return "", "", fmt.Errorf("UTF-8 BOM 后的内容不是有效 UTF-8")
		}
		return string(data), "utf-8-bom", nil
	}
	if utf8.Valid(data) {
		return string(data), "utf-8", nil
	}
	decoded, _, err := transform.Bytes(simplifiedchinese.GB18030.NewDecoder(), data)
	if err != nil || !utf8.Valid(decoded) {
		return "", "", fmt.Errorf("歌词编码不受支持，请使用 UTF-8 或 GB18030")
	}
	return string(decoded), "gb18030", nil
}

// Parse decodes bytes and parses timestamped LRC. Fewer than two valid timed
// lines are deliberately treated as plain text.
func Parse(data []byte) (Result, error) {
	return ParseWithDuration(data, 0)
}

// ParseWithDuration adds non-blocking validation for timestamps more than ten
// minutes beyond a known song duration. A zero duration disables that warning.
func ParseWithDuration(data []byte, durationMS int64) (Result, error) {
	text, encoding, err := Decode(data)
	if err != nil {
		return Result{}, err
	}
	result := parseText(text, durationMS)
	result.Encoding = encoding
	return result, nil
}

type sortableLine struct {
	models.LyricLine
	order int
}

func parseText(text string, durationMS int64) Result {
	text = strings.ReplaceAll(text, "\r\n", "\n")
	text = strings.ReplaceAll(text, "\r", "\n")
	result := Result{
		Text:     text,
		Format:   "plain",
		Metadata: map[string]string{},
		Lines:    []models.LyricLine{},
		Warnings: []string{},
	}
	parsed := make([]sortableLine, 0)
	order := 0
	for lineIndex, rawLine := range strings.Split(text, "\n") {
		line := strings.TrimSpace(rawLine)
		if line == "" {
			continue
		}
		if metadata := metadataPattern.FindStringSubmatch(line); len(metadata) == 3 && timestampPattern.FindString(line) == "" {
			key := strings.ToLower(metadata[1])
			value := strings.TrimSpace(metadata[2])
			result.Metadata[key] = value
			if key == "offset" {
				if offset, err := strconv.Atoi(value); err == nil {
					result.EmbeddedOffsetMS = offset
				} else {
					result.Warnings = append(result.Warnings, "offset 标签不是有效整数")
				}
			}
			continue
		}

		matches := timestampPattern.FindAllStringSubmatchIndex(line, -1)
		if len(matches) == 0 {
			if timestampLike.MatchString(line) {
				result.Warnings = append(result.Warnings, fmt.Sprintf("第 %d 行：时间标签格式无效", lineIndex+1))
			}
			continue
		}
		lastEnd := matches[len(matches)-1][1]
		lyricText := strings.TrimSpace(line[lastEnd:])
		validOnLine := 0
		for _, match := range matches {
			startMS, ok := parseTimestamp(line, match)
			if !ok {
				result.Warnings = append(result.Warnings, fmt.Sprintf("第 %d 行：时间值超出范围", lineIndex+1))
				continue
			}
			validOnLine++
			parsed = append(parsed, sortableLine{
				LyricLine: models.LyricLine{StartMS: startMS, Text: lyricText},
				order:     order,
			})
			order++
		}
		if validOnLine == 0 && timestampLike.MatchString(line) && len(matches) > 0 {
			continue
		}
	}

	if len(parsed) < 2 {
		result.ValidLineCount = len(parsed)
		if len(parsed) == 1 {
			result.Warnings = append(result.Warnings, "仅找到 1 行有效时间标签，已按纯文本处理")
		}
		return result
	}

	sort.SliceStable(parsed, func(i, j int) bool {
		if parsed[i].StartMS == parsed[j].StartMS {
			return parsed[i].order < parsed[j].order
		}
		return parsed[i].StartMS < parsed[j].StartMS
	})
	seen := make(map[string]struct{}, len(parsed))
	previousWasEmpty := false
	for _, line := range parsed {
		line.StartMS += result.EmbeddedOffsetMS
		if line.StartMS < 0 {
			line.StartMS = 0
		}
		key := strconv.Itoa(line.StartMS) + "\x00" + line.Text
		if _, exists := seen[key]; exists {
			continue
		}
		isEmpty := strings.TrimSpace(line.Text) == ""
		if isEmpty && previousWasEmpty {
			continue
		}
		seen[key] = struct{}{}
		result.Lines = append(result.Lines, line.LyricLine)
		previousWasEmpty = isEmpty
	}
	result.Format = "lrc"
	result.ValidLineCount = len(result.Lines)
	if durationMS > 0 && int64(result.Lines[len(result.Lines)-1].StartMS) > durationMS+10*60*1000 {
		result.Warnings = append(result.Warnings, "存在超过歌曲时长 10 分钟的时间标签")
	}
	return result
}

func parseTimestamp(line string, indexes []int) (int, bool) {
	minute, errMinute := strconv.Atoi(line[indexes[2]:indexes[3]])
	second, errSecond := strconv.Atoi(line[indexes[4]:indexes[5]])
	if errMinute != nil || errSecond != nil || second > 59 {
		return 0, false
	}
	fractionMS := 0
	if indexes[6] >= 0 && indexes[7] >= 0 {
		fraction := line[indexes[6]:indexes[7]]
		value, err := strconv.Atoi(fraction)
		if err != nil {
			return 0, false
		}
		switch len(fraction) {
		case 1:
			fractionMS = value * 100
		case 2:
			fractionMS = value * 10
		default:
			fractionMS = value
		}
	}
	return (minute*60+second)*1000 + fractionMS, true
}

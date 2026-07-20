package lyrics

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"golang.org/x/text/encoding/simplifiedchinese"
)

func TestParseLRCFormatsAndMultipleTimestamps(t *testing.T) {
	input := []byte("\ufeff[ar:歌手]\n[offset:-100]\n[00:01]第一行\n[00:02.34][00:03.456]第二行\n[00:02.34]重复点不同文本\n[00:02.34]重复点不同文本")
	got, err := Parse(input)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if got.Format != "lrc" || got.Encoding != "utf-8-bom" || got.EmbeddedOffsetMS != -100 {
		t.Fatalf("unexpected result: %#v", got)
	}
	wantStarts := []int{900, 2240, 2240, 3356}
	if len(got.Lines) != len(wantStarts) {
		t.Fatalf("lines = %#v", got.Lines)
	}
	for i, want := range wantStarts {
		if got.Lines[i].StartMS != want {
			t.Fatalf("line %d start = %d, want %d", i, got.Lines[i].StartMS, want)
		}
	}
}

func TestParseWarnsOnlyWhenTimestampExceedsKnownDurationByTenMinutes(t *testing.T) {
	got, err := ParseWithDuration([]byte("[00:01]start\n[11:01]late"), 60_000)
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Warnings) != 1 || !strings.Contains(got.Warnings[0], "歌曲时长 10 分钟") {
		t.Fatalf("warnings = %#v", got.Warnings)
	}
	withoutDuration, err := Parse([]byte("[00:01]start\n[11:01]late"))
	if err != nil || len(withoutDuration.Warnings) != 0 {
		t.Fatalf("unknown duration warnings = %#v, %v", withoutDuration.Warnings, err)
	}
}

func TestParseTenThousandLinesWithinBudget(t *testing.T) {
	var input strings.Builder
	for index := 0; index < 10_000; index++ {
		_, _ = fmt.Fprintf(&input, "[%03d:%02d.%03d]line %d\n", index/60, index%60, index%1000, index)
	}
	started := time.Now()
	got, err := Parse([]byte(input.String()))
	elapsed := time.Since(started)
	if err != nil || len(got.Lines) != 10_000 {
		t.Fatalf("large parse lines=%d err=%v", len(got.Lines), err)
	}
	if elapsed >= 50*time.Millisecond {
		t.Fatalf("10,000-line parse took %s, budget is 50ms", elapsed)
	}
}

func TestParseFallsBackToPlainText(t *testing.T) {
	got, err := Parse([]byte("第一段\n[00:01]唯一时间行"))
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if got.Format != "plain" || len(got.Lines) != 0 || got.ValidLineCount != 1 || len(got.Warnings) == 0 {
		t.Fatalf("unexpected plain result: %#v", got)
	}
}

func TestParseGB18030AndInputLimit(t *testing.T) {
	encoded, err := simplifiedchinese.GB18030.NewEncoder().Bytes([]byte("[00:01]你好\n[00:02]世界"))
	if err != nil {
		t.Fatalf("encode fixture: %v", err)
	}
	got, err := Parse(encoded)
	if err != nil || got.Encoding != "gb18030" || got.Lines[0].Text != "你好" {
		t.Fatalf("Parse GB18030 = %#v, %v", got, err)
	}
	if _, err := Parse([]byte(strings.Repeat("a", MaxInputBytes+1))); err == nil {
		t.Fatal("oversized input accepted")
	}
}

func TestParseReportsLineNumbersAndMergesConsecutiveTimedBlanks(t *testing.T) {
	got, err := Parse([]byte("[00:01]first\n[00:61]invalid\n[00:03]\n[00:04]\n[00:05]last"))
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	if len(got.Warnings) == 0 || !strings.Contains(got.Warnings[0], "第 2 行") {
		t.Fatalf("warnings = %#v", got.Warnings)
	}
	if len(got.Lines) != 3 || got.Lines[1].Text != "" || got.Lines[2].Text != "last" {
		t.Fatalf("lines = %#v", got.Lines)
	}
}

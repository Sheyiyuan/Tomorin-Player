package services

import "testing"

func TestValidatePageNumber(t *testing.T) {
	tests := []struct {
		name       string
		page       int
		totalPages int
		wantErr    bool
	}{
		{name: "first page", page: 1, totalPages: 3},
		{name: "last page", page: 3, totalPages: 3},
		{name: "zero", page: 0, totalPages: 3, wantErr: true},
		{name: "negative", page: -1, totalPages: 3, wantErr: true},
		{name: "past last", page: 4, totalPages: 3, wantErr: true},
		{name: "empty video", page: 1, totalPages: 0, wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validatePageNumber(tt.page, tt.totalPages)
			if (err != nil) != tt.wantErr {
				t.Fatalf("validatePageNumber(%d, %d) error = %v, wantErr %v", tt.page, tt.totalPages, err, tt.wantErr)
			}
		})
	}
}

func TestFormatSongName(t *testing.T) {
	if got := formatSongName("Title", 1, "Part", 1); got != "Title" {
		t.Fatalf("single page title = %q", got)
	}
	if got := formatSongName("Title", 2, "Part", 3); got != "TitleP2 Part" {
		t.Fatalf("multi page title = %q", got)
	}
}

func TestExtractBVID(t *testing.T) {
	tests := map[string]string{
		"plain": "BV1xx411c7mD",
		"url":   "https://www.bilibili.com/video/BV1xx411c7mD?p=2",
		"text":  "播放 BV1xx411c7mD 谢谢",
		"bad":   "av12345",
	}

	for name, input := range tests {
		t.Run(name, func(t *testing.T) {
			want := "BV1xx411c7mD"
			if name == "bad" {
				want = ""
			}
			if got := extractBVID(input); got != want {
				t.Fatalf("extractBVID(%q) = %q, want %q", input, got, want)
			}
		})
	}
}

package lyrics

import "testing"

func TestMatchScoreRejectsVersionAndArtistConflicts(t *testing.T) {
	exact := MatchScore("夜曲", "周杰伦", 230, "夜曲", "周杰伦", 231, 0.75, 0.8)
	wrongArtist := MatchScore("夜曲", "周杰伦", 230, "夜曲", "其他歌手", 231, 0.75, 0.8)
	instrumental := MatchScore("夜曲", "周杰伦", 230, "夜曲 伴奏", "周杰伦", 231, 0.75, 0.8)
	if exact < 0.86 {
		t.Fatalf("exact score = %.3f", exact)
	}
	if wrongArtist >= exact || instrumental >= exact {
		t.Fatalf("conflicts were not penalized: exact %.3f artist %.3f instrumental %.3f", exact, wrongArtist, instrumental)
	}
}

func TestMatcherFixturesCoverVersionsMultiPageAndTitleDirection(t *testing.T) {
	fixtures := []struct {
		name           string
		targetTitle    string
		candidateTitle string
		wantAtLeast    float64
		wantBelow      float64
	}{
		{name: "live exact", targetTitle: "夜曲 Live", candidateTitle: "夜曲 Live", wantAtLeast: 0.86},
		{name: "live conflict", targetTitle: "夜曲 Live", candidateTitle: "夜曲", wantBelow: 0.86},
		{name: "remix exact", targetTitle: "夜曲 Remix", candidateTitle: "夜曲 Remix", wantAtLeast: 0.86},
		{name: "cover conflict", targetTitle: "夜曲 翻唱", candidateTitle: "夜曲", wantBelow: 0.86},
		{name: "instrumental conflict", targetTitle: "夜曲 伴奏", candidateTitle: "夜曲", wantBelow: 0.86},
		{name: "multi page decoration", targetTitle: "P2 - 夜曲 BV1xx411c7mD", candidateTitle: "夜曲", wantAtLeast: 0.86},
	}
	for _, fixture := range fixtures {
		t.Run(fixture.name, func(t *testing.T) {
			score := MatchScore(fixture.targetTitle, "周杰伦", 230, fixture.candidateTitle, "周杰伦", 230, 0.75, 0.8)
			if fixture.wantAtLeast > 0 && score < fixture.wantAtLeast {
				t.Fatalf("score %.3f < %.3f", score, fixture.wantAtLeast)
			}
			if fixture.wantBelow > 0 && score >= fixture.wantBelow {
				t.Fatalf("score %.3f >= %.3f", score, fixture.wantBelow)
			}
		})
	}

	queries := BuildSearchQueries("", "周杰伦 - 夜曲", "fallback", "周杰伦", 1)
	if len(queries) != 3 || queries[0].Title != "fallback" || queries[1].Title != "夜曲" || queries[1].Artist != "周杰伦" || queries[2].Title != "周杰伦" {
		t.Fatalf("title-direction queries = %#v", queries)
	}
	multiPage := BuildSearchQueries("P3 - Remix 版本", "视频主标题", "fallback", "歌手", 3)
	if len(multiPage) != 2 || multiPage[0].Title != "fallback" || multiPage[1].Title != "Remix 版本" {
		t.Fatalf("multi-page query = %#v", multiPage)
	}
}

func TestReliableMatchRequiresExactIdentityAndDuration(t *testing.T) {
	if !IsReliableMatch("夜曲", "周杰伦", 230, "夜曲", "周杰伦", 234) {
		t.Fatal("exact identity within five seconds was rejected")
	}
	fixtures := []struct {
		name            string
		targetArtist    string
		candidateTitle  string
		candidateArtist string
		candidateLength int
	}{
		{name: "missing artist", targetArtist: "", candidateTitle: "夜曲", candidateArtist: "周杰伦", candidateLength: 230},
		{name: "fuzzy title", targetArtist: "周杰伦", candidateTitle: "夜曲 Live", candidateArtist: "周杰伦", candidateLength: 230},
		{name: "wrong artist", targetArtist: "周杰伦", candidateTitle: "夜曲", candidateArtist: "其他歌手", candidateLength: 230},
		{name: "duration too far", targetArtist: "周杰伦", candidateTitle: "夜曲", candidateArtist: "周杰伦", candidateLength: 236},
	}
	for _, fixture := range fixtures {
		t.Run(fixture.name, func(t *testing.T) {
			if IsReliableMatch("夜曲", fixture.targetArtist, 230, fixture.candidateTitle, fixture.candidateArtist, fixture.candidateLength) {
				t.Fatal("uncertain match was accepted")
			}
		})
	}
}

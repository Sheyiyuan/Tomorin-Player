package lyrics

import (
	"math"
	"regexp"
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

var (
	decorationPattern = regexp.MustCompile(`[\[\]【】()（）<>《》]`)
	bvidPattern       = regexp.MustCompile(`(?i)\bBV[0-9A-Za-z]{10}\b`)
	pagePrefixPattern = regexp.MustCompile(`(?i)^\s*(?:P\s*)?\d{1,3}\s*[.、:_-]+\s*`)
	titleSeparator    = regexp.MustCompile(`\s+[-–—|]\s+`)
)

// SearchQuery preserves both interpretations of an ambiguous "artist - title"
// string instead of mutating the song metadata based on a guess.
type SearchQuery struct {
	Title  string
	Artist string
}

// BuildSearchQueries applies the page/title precedence used for lyric lookup.
func BuildSearchQueries(pageTitle, videoTitle, fallbackTitle, artist string, totalPages int) []SearchQuery {
	artist = cleanQueryText(artist)
	bases := []string{fallbackTitle}
	if totalPages > 1 && strings.TrimSpace(pageTitle) != "" {
		bases = append(bases, pageTitle)
	} else if strings.TrimSpace(videoTitle) != "" {
		bases = append(bases, videoTitle)
	}
	queries := make([]SearchQuery, 0, len(bases)*2)
	seen := make(map[string]struct{})
	for _, rawBase := range bases {
		base := cleanQueryText(rawBase)
		if base == "" {
			continue
		}
		parts := titleSeparator.Split(base, 2)
		baseQueries := []SearchQuery{{Title: base, Artist: artist}}
		if len(parts) == 2 && strings.TrimSpace(parts[0]) != "" && strings.TrimSpace(parts[1]) != "" {
			baseQueries = []SearchQuery{
				{Title: strings.TrimSpace(parts[0]), Artist: strings.TrimSpace(parts[1])},
				{Title: strings.TrimSpace(parts[1]), Artist: strings.TrimSpace(parts[0])},
			}
			if artist != "" && normalizeText(baseQueries[1].Artist) == normalizeText(artist) {
				baseQueries[0], baseQueries[1] = baseQueries[1], baseQueries[0]
			}
		}
		for _, query := range baseQueries {
			key := normalizeText(query.Title) + "\x00" + normalizeText(query.Artist)
			if _, exists := seen[key]; exists {
				continue
			}
			seen[key] = struct{}{}
			queries = append(queries, query)
		}
	}
	return queries
}

func cleanQueryText(value string) string {
	value = norm.NFKC.String(value)
	value = bvidPattern.ReplaceAllString(value, " ")
	value = pagePrefixPattern.ReplaceAllString(value, "")
	return strings.Join(strings.Fields(decorationPattern.ReplaceAllString(value, " ")), " ")
}

// MatchScore applies the product's weighted metadata score. Provider and
// evidence quality are supplied by the adapter because they are source-specific.
func MatchScore(targetTitle, targetArtist string, targetDurationSeconds int, candidateTitle, candidateArtist string, candidateDurationSeconds int, evidence, providerQuality float64) float64 {
	title := textSimilarity(targetTitle, candidateTitle)
	artist := textSimilarity(targetArtist, candidateArtist)
	if strings.TrimSpace(targetArtist) == "" || strings.TrimSpace(candidateArtist) == "" {
		artist = 0.45
	}
	duration := durationScore(targetDurationSeconds, candidateDurationSeconds)
	version := versionScore(targetTitle, candidateTitle)
	score := title*0.34 + artist*0.20 + duration*0.22 + version*0.10 + evidence*0.09 + providerQuality*0.05
	if hasVersion(targetTitle, "伴奏", "instrumental", "karaoke") != hasVersion(candidateTitle, "伴奏", "instrumental", "karaoke") {
		score -= 0.30
	}
	if hasVersion(targetTitle, "live", "现场") != hasVersion(candidateTitle, "live", "现场") {
		score -= 0.18
	}
	if hasVersion(targetTitle, "翻唱", "cover") != hasVersion(candidateTitle, "翻唱", "cover") {
		score -= 0.20
	}
	if artist < 0.25 && strings.TrimSpace(targetArtist) != "" && strings.TrimSpace(candidateArtist) != "" {
		score -= 0.35
	}
	return math.Max(0, math.Min(1, score))
}

// IsReliableMatch is the hard gate for unattended external lyric matching.
// Fuzzy scores remain useful for ranking, but cannot make missing identity
// evidence safe enough for automatic display.
func IsReliableMatch(targetTitle, targetArtist string, targetDurationSeconds int, candidateTitle, candidateArtist string, candidateDurationSeconds int) bool {
	if normalizeText(targetTitle) == "" || normalizeText(targetTitle) != normalizeText(candidateTitle) {
		return false
	}
	if normalizeText(targetArtist) == "" || normalizeText(targetArtist) != normalizeText(candidateArtist) {
		return false
	}
	if targetDurationSeconds <= 0 || candidateDurationSeconds <= 0 {
		return false
	}
	difference := targetDurationSeconds - candidateDurationSeconds
	if difference < 0 {
		difference = -difference
	}
	return difference <= 5 && versionScore(targetTitle, candidateTitle) > 0
}

func normalizeText(value string) string {
	value = norm.NFKC.String(value)
	value = bvidPattern.ReplaceAllString(value, " ")
	value = pagePrefixPattern.ReplaceAllString(value, "")
	value = strings.ToLower(decorationPattern.ReplaceAllString(value, " "))
	var builder strings.Builder
	lastSpace := false
	for _, r := range value {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			builder.WriteRune(r)
			lastSpace = false
		} else if !lastSpace {
			builder.WriteByte(' ')
			lastSpace = true
		}
	}
	return strings.TrimSpace(builder.String())
}

func textSimilarity(left, right string) float64 {
	left = normalizeText(left)
	right = normalizeText(right)
	if left == "" || right == "" {
		return 0
	}
	if left == right {
		return 1
	}
	editSimilarity := normalizedEditSimilarity(left, right)
	leftTokens := strings.Fields(left)
	rightTokens := strings.Fields(right)
	if len(leftTokens) == 1 && len(rightTokens) == 1 {
		if strings.Contains(left, right) || strings.Contains(right, left) {
			shorter := math.Min(float64(len([]rune(left))), float64(len([]rune(right))))
			longer := math.Max(float64(len([]rune(left))), float64(len([]rune(right))))
			return math.Min(0.82, 0.65+0.17*(shorter/longer))
		}
		return editSimilarity
	}
	set := make(map[string]struct{}, len(leftTokens))
	for _, token := range leftTokens {
		set[token] = struct{}{}
	}
	intersection := 0
	for _, token := range rightTokens {
		if _, ok := set[token]; ok {
			intersection++
		}
		set[token] = struct{}{}
	}
	jaccard := float64(intersection) / float64(len(set))
	return jaccard*0.6 + editSimilarity*0.4
}

func normalizedEditSimilarity(left, right string) float64 {
	leftRunes := []rune(left)
	rightRunes := []rune(right)
	longest := max(len(leftRunes), len(rightRunes))
	if longest == 0 {
		return 1
	}
	previous := make([]int, len(rightRunes)+1)
	for index := range previous {
		previous[index] = index
	}
	for leftIndex, leftRune := range leftRunes {
		current := make([]int, len(rightRunes)+1)
		current[0] = leftIndex + 1
		for rightIndex, rightRune := range rightRunes {
			cost := 1
			if leftRune == rightRune {
				cost = 0
			}
			current[rightIndex+1] = min(
				current[rightIndex]+1,
				min(previous[rightIndex+1]+1, previous[rightIndex]+cost),
			)
		}
		previous = current
	}
	return math.Max(0, 1-float64(previous[len(rightRunes)])/float64(longest))
}

func durationScore(left, right int) float64 {
	if left <= 0 || right <= 0 {
		return 0.5
	}
	difference := left - right
	if difference < 0 {
		difference = -difference
	}
	switch {
	case difference <= 2:
		return 1
	case difference <= 5:
		return 0.9
	case difference <= 10:
		return 0.7
	case difference <= 20:
		return 0.35
	default:
		return 0
	}
}

func versionScore(left, right string) float64 {
	versions := [][]string{{"live", "现场"}, {"伴奏", "instrumental", "karaoke"}, {"翻唱", "cover"}, {"remix"}, {"纯音乐"}}
	found := false
	for _, version := range versions {
		leftHas := hasVersion(left, version...)
		rightHas := hasVersion(right, version...)
		if leftHas || rightHas {
			found = true
			if leftHas != rightHas {
				return 0
			}
		}
	}
	if found {
		return 1
	}
	return 0.8
}

func hasVersion(value string, terms ...string) bool {
	value = normalizeText(value)
	for _, term := range terms {
		if strings.Contains(value, normalizeText(term)) {
			return true
		}
	}
	return false
}

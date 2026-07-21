package services

import (
	"crypto/sha256"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"half-beat-player/internal/models"
)

var (
	uuidStorageKeyPattern = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
	bvidStorageKeyPattern = regexp.MustCompile(`^BV[0-9A-Za-z]{10}$`)
)

func ensurePrivateDir(path string) error {
	if err := os.MkdirAll(path, 0o700); err != nil {
		return err
	}
	return os.Chmod(path, 0o700)
}

func existingFileWithin(root, path string) (string, bool) {
	root, err := filepath.Abs(root)
	if err != nil {
		return "", false
	}
	path, err = filepath.Abs(path)
	if err != nil {
		return "", false
	}
	rel, err := filepath.Rel(root, path)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", false
	}
	resolvedRoot, err := filepath.EvalSymlinks(root)
	if err != nil {
		return "", false
	}
	resolvedPath, err := filepath.EvalSymlinks(path)
	if err != nil {
		return "", false
	}
	rel, err = filepath.Rel(resolvedRoot, resolvedPath)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", false
	}
	info, err := os.Stat(resolvedPath)
	return resolvedPath, err == nil && info.Mode().IsRegular()
}

// storageKey keeps historical UUID/BVID names readable while ensuring every
// other database identifier becomes one non-user-controlled path component.
func storageKey(id string) string {
	if uuidStorageKeyPattern.MatchString(id) || bvidStorageKeyPattern.MatchString(id) {
		return id
	}
	hash := sha256.Sum256([]byte(id))
	return fmt.Sprintf("id-%x", hash)
}

func localAudioFilename(song models.Song) string {
	page := song.PageNumber
	if page <= 0 {
		page = 1
	}

	if song.ID != "" && song.ID != song.BVID {
		return storageKey(song.ID) + ".m4s"
	}
	if song.BVID != "" {
		key := storageKey(song.BVID)
		if song.TotalPages > 1 || song.PageNumber > 1 {
			return fmt.Sprintf("%s-P%d.m4s", key, page)
		}
		return key + ".m4s"
	}
	if song.ID != "" {
		return storageKey(song.ID) + ".m4s"
	}
	return ""
}

func localAudioCandidates(song models.Song) []string {
	primary := localAudioFilename(song)
	if primary == "" {
		return nil
	}
	candidates := []string{primary}
	if song.TotalPages <= 1 && song.PageNumber <= 1 && song.ID != "" {
		for _, legacy := range []string{storageKey(song.ID) + ".m4s", legacyAudioFilename(song.ID)} {
			if legacy != "" && legacy != primary {
				candidates = append(candidates, legacy)
			}
		}
	}
	return candidates
}

func legacyAudioFilename(id string) string {
	if id == "" || len(id) > 128 {
		return ""
	}
	for _, char := range id {
		if (char < 'a' || char > 'z') && (char < 'A' || char > 'Z') &&
			(char < '0' || char > '9') && char != '-' && char != '_' {
			return ""
		}
	}
	return id + ".m4s"
}

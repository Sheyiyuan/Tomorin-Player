package services

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"half-beat-player/internal/models"
)

func pagingTestService(t *testing.T) *Service {
	t.Helper()
	return testService(t, &models.Favorite{}, &models.SongRef{}, &models.Song{}, &models.PlaylistSource{})
}

func seedPagedFavorite(t *testing.T, service *Service, count int) {
	t.Helper()
	favorite := models.Favorite{ID: "favorite", Title: "Long list", CreatedAt: time.Now(), UpdatedAt: time.Now()}
	if err := service.db.Create(&favorite).Error; err != nil {
		t.Fatal(err)
	}
	songs := make([]models.Song, 0, count)
	refs := make([]models.SongRef, 0, count)
	for index := 0; index < count; index++ {
		id := fmt.Sprintf("song-%03d", index)
		singer := "Singer"
		if index == count-1 {
			singer = "Needle Artist"
		}
		songs = append(songs, models.Song{ID: id, BVID: fmt.Sprintf("BV%010d", index), Name: fmt.Sprintf("Track %03d", index), Singer: singer})
		refs = append(refs, models.SongRef{FavoriteID: favorite.ID, SongID: id, Position: count - index - 1})
	}
	if err := service.db.CreateInBatches(songs, 100).Error; err != nil {
		t.Fatal(err)
	}
	if err := service.db.CreateInBatches(refs, 100).Error; err != nil {
		t.Fatal(err)
	}
}

func TestFavoriteSummariesAndPagingAvoidFullMembershipHydration(t *testing.T) {
	service := pagingTestService(t)
	seedPagedFavorite(t, service, 205)

	summaries, err := service.ListFavoriteSummaries()
	if err != nil {
		t.Fatal(err)
	}
	if len(summaries) != 1 || summaries[0].SongCount != 205 {
		t.Fatalf("summaries = %#v", summaries)
	}
	page, err := service.ListFavoriteSongs(models.FavoriteSongPageRequest{FavoriteID: "favorite", Offset: 100, Limit: 500})
	if err != nil {
		t.Fatal(err)
	}
	if page.Total != 205 || page.Offset != 100 || page.Limit != 200 || len(page.Items) != 105 || page.Revision == "" {
		t.Fatalf("page = %#v", page)
	}
	if page.Items[0].ID != "song-104" || page.Items[len(page.Items)-1].ID != "song-000" {
		t.Fatalf("page order first=%q last=%q", page.Items[0].ID, page.Items[len(page.Items)-1].ID)
	}
}

func TestFavoriteSongSearchCoversUnloadedRowsAndEscapesWildcards(t *testing.T) {
	service := pagingTestService(t)
	seedPagedFavorite(t, service, 150)
	page, err := service.ListFavoriteSongs(models.FavoriteSongPageRequest{FavoriteID: "favorite", Query: "needle", Limit: 100})
	if err != nil {
		t.Fatal(err)
	}
	if page.Total != 1 || len(page.Items) != 1 || page.Items[0].ID != "song-149" {
		t.Fatalf("search page = %#v", page)
	}
	page, err = service.ListFavoriteSongs(models.FavoriteSongPageRequest{FavoriteID: "favorite", Query: "%", Limit: 100})
	if err != nil {
		t.Fatal(err)
	}
	if page.Total != 0 {
		t.Fatalf("wildcard search total = %d", page.Total)
	}
}

func TestLocalSongSearchAndGetSongsByIDs(t *testing.T) {
	service := pagingTestService(t)
	seedPagedFavorite(t, service, 25)
	page, err := service.SearchLocalSongPage(models.LocalSongSearchRequest{Query: "BV0000000024", Limit: 10})
	if err != nil {
		t.Fatal(err)
	}
	if page.Total != 1 || len(page.Items) != 1 || page.Items[0].ID != "song-024" {
		t.Fatalf("local search = %#v", page)
	}
	ordered, err := service.GetSongsByIDs([]string{"song-003", "missing", "song-001", "song-003"})
	if err != nil {
		t.Fatal(err)
	}
	got := make([]string, 0, len(ordered))
	for _, song := range ordered {
		got = append(got, song.ID)
	}
	if strings.Join(got, ",") != "song-003,song-001,song-003" {
		t.Fatalf("ordered songs = %v", got)
	}
}

func TestAtomicFavoriteOperationsMaintainCountsOrderAndLocks(t *testing.T) {
	service := pagingTestService(t)
	seedPagedFavorite(t, service, 3)
	if err := service.db.Create(&models.Song{ID: "new-song", Name: "New"}).Error; err != nil {
		t.Fatal(err)
	}

	added, err := service.AddSongsToFavorite("favorite", []string{"new-song", "new-song"})
	if err != nil || added.SongCount != 4 {
		t.Fatalf("add = %#v, %v", added, err)
	}
	removed, err := service.RemoveSongFromFavorite("favorite", "song-001")
	if err != nil || removed.SongCount != 3 {
		t.Fatalf("remove = %#v, %v", removed, err)
	}
	page, err := service.ListFavoriteSongs(models.FavoriteSongPageRequest{FavoriteID: "favorite"})
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 3 || page.Items[2].ID != "new-song" {
		t.Fatalf("members after mutation = %#v", page.Items)
	}
	copy, err := service.DuplicateFavorite("favorite", "Copy")
	if err != nil || copy.Title != "Copy" || copy.SongCount != 3 {
		t.Fatalf("copy = %#v, %v", copy, err)
	}
	memberships, err := service.GetFavoriteMemberships("new-song")
	if err != nil || len(memberships) != 2 {
		t.Fatalf("memberships = %v, %v", memberships, err)
	}

	source := models.PlaylistSource{ID: "source", FavoriteID: "favorite", Provider: biliPlaylistProvider, RemoteID: "1", Locked: true}
	if err := service.db.Create(&source).Error; err != nil {
		t.Fatal(err)
	}
	if _, err := service.RenameFavorite("favorite", "blocked"); err == nil || !strings.Contains(err.Error(), ErrorCodePlaylistLocked) {
		t.Fatalf("locked rename error = %v", err)
	}
	if _, err := service.AddSongsToFavorite("favorite", []string{"song-001"}); err == nil || !strings.Contains(err.Error(), ErrorCodePlaylistLocked) {
		t.Fatalf("locked add error = %v", err)
	}
}

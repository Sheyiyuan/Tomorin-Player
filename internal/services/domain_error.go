package services

import (
	"encoding/json"
	"errors"
	"fmt"
)

const (
	ErrorCodeLyricNotFound    = "LYRIC_NOT_FOUND"
	ErrorCodeProvider         = "LYRIC_PROVIDER_UNAVAILABLE"
	ErrorCodeLyricParse       = "LYRIC_PARSE_FAILED"
	ErrorCodeLyricTooLarge    = "LYRIC_IMPORT_TOO_LARGE"
	ErrorCodePlaylistLocked   = "PLAYLIST_LOCKED"
	ErrorCodePlaylistDetached = "PLAYLIST_DETACHED"
	ErrorCodeSyncAuth         = "SYNC_AUTH_REQUIRED"
	ErrorCodeSyncPermission   = "SYNC_PERMISSION_DENIED"
	ErrorCodeSyncRateLimited  = "SYNC_RATE_LIMITED"
	ErrorCodeSyncIncomplete   = "SYNC_SNAPSHOT_INCOMPLETE"
	ErrorCodeSyncLocalCommit  = "SYNC_LOCAL_COMMIT_FAILED"
	ErrorCodeSyncInterrupted  = "SYNC_INTERRUPTED"
)

type DomainError struct {
	Code      string            `json:"code"`
	Message   string            `json:"message"`
	Retryable bool              `json:"retryable"`
	Details   map[string]string `json:"details,omitempty"`
	Cause     error             `json:"-"`
}

func (e *DomainError) Error() string {
	payload, err := json.Marshal(e)
	if err == nil {
		return string(payload)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func (e *DomainError) Unwrap() error { return e.Cause }

func domainError(code, message string, cause error) error {
	return domainErrorWithDetails(code, message, defaultRetryable(code), nil, cause)
}

func domainErrorWithDetails(code, message string, retryable bool, details map[string]string, cause error) error {
	if cause != nil {
		if details == nil {
			details = make(map[string]string)
		}
		details["cause"] = cause.Error()
	}
	return &DomainError{Code: code, Message: message, Retryable: retryable, Details: details, Cause: cause}
}

func defaultRetryable(code string) bool {
	switch code {
	case ErrorCodeProvider, ErrorCodeSyncRateLimited, ErrorCodeSyncIncomplete, ErrorCodeSyncLocalCommit, ErrorCodeSyncInterrupted:
		return true
	default:
		return false
	}
}

func taskErrorFields(err error, fallbackCode string) (string, string, bool, map[string]string) {
	var domain *DomainError
	if errors.As(err, &domain) {
		return domain.Code, domain.Message, domain.Retryable, cloneStringMap(domain.Details)
	}
	message := "操作失败"
	if err != nil && err.Error() != "" {
		message = err.Error()
	}
	return fallbackCode, message, defaultRetryable(fallbackCode), nil
}

func cloneStringMap(source map[string]string) map[string]string {
	if source == nil {
		return nil
	}
	cloned := make(map[string]string, len(source))
	for key, value := range source {
		cloned[key] = value
	}
	return cloned
}
